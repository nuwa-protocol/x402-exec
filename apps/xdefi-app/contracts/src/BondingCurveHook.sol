// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ISettlementHook} from "contracts/src/interfaces/ISettlementHook.sol";
import {UD60x18} from "@prb/math/UD60x18.sol";

/**
 * @title BondingCurveHook
 * @notice Hook that allows users to purchase X402X tokens using USDC via an exponential bonding curve
 * @dev Implements an exponential bonding curve: P(x) = P0 * exp(k * x)
 *
 * This version sets defaults so that:
 * - TOTAL_SALE_SUPPLY = 100,000,000 tokens
 * - Final marginal price P(1) = 0.003 USDC
 * - Total revenue when fully sold ≈ 80,000 USDC
 *
 * Derived parameters (normalized x in [0,1]):
 * - k  ≈  3.65280641579468         -> k_ud60x18 = 3652806415794679808
 * - P0 ≈  0.00007775486736425522   -> P0_ud60x18 = 77754867364255
 *
 * Note: inside the contract USDC amounts are handled with 6 decimals externally,
 * but computations use UD60x18 (18 decimals). Conversion is applied when returning USDC 6-decimals.
 */
contract BondingCurveHook is ISettlementHook {
    using SafeERC20 for IERC20;

    // ===== Constants =====
    address public immutable settlementRouter;
    uint256 public constant TOTAL_SALE_SUPPLY = 100_000_000 * 10**18;
    uint256 public constant USDC_DECIMALS = 6;
    uint256 public constant X402X_DECIMALS = 18;
    uint256 private constant UNIT = 1e18;

    // Wrapped UD60x18 parameters (defaults chosen to meet your target)
    // P0 ≈ 0.00007775486736425522 USDC -> UD60x18 = P0 * 1e18
    // k  ≈ 3.65280641579468         -> UD60x18 = k * 1e18
    UD60x18 public immutable P0;
    UD60x18 public immutable k;

    address public x402xToken;
    address public usdcToken;
    address public admin;

    uint256 public tokensSold;
    uint256 public totalUsdcCollected;

    event TokensDeposited(address indexed admin, uint256 amount);
    event TokensPurchased(
        bytes32 indexed contextKey,
        address indexed buyer,
        uint256 usdcAmount,
        uint256 tokensReceived,
        uint256 newPrice
    );
    event AdminChanged(address indexed oldAdmin, address indexed newAdmin);
    event TokensWithdrawn(address indexed admin, uint256 amount);

    error OnlyRouter();
    error OnlyAdmin();
    error InvalidAddress();
    error InsufficientTokens();
    error SaleCompleted();
    error InvalidToken();
    error InvalidAmount();
    error CalculationError();

    modifier onlyRouter() {
        if (msg.sender != settlementRouter) revert OnlyRouter();
        _;
    }

    modifier onlyAdmin() {
        if (msg.sender != admin) revert OnlyAdmin();
        _;
    }

    /**
     * NOTE: You can either pass _P0_ud60x18/_k_ud60x18 to override the defaults
     * or pass zero to use the defaults embedded here.
     *
     * Defaults chosen (to meet your request):
     * - _P0_default = 77754867364255            (UD60x18)  ≈ 0.00007775486736425522 USDC
     * - _k_default  = 3652806415794679808       (UD60x18)  ≈ 3.65280641579468
     */
    constructor(
        address _settlementRouter,
        address _x402xToken,
        address _usdcToken,
        address _admin,
        uint256 _P0_ud60x18,
        uint256 _k_ud60x18
    ) {
        require(_settlementRouter != address(0), "Invalid router address");
        require(_x402xToken != address(0), "Invalid X402X token address");
        require(_usdcToken != address(0), "Invalid USDC token address");
        require(_admin != address(0), "Invalid admin address");

        settlementRouter = _settlementRouter;
        x402xToken = _x402xToken;
        usdcToken = _usdcToken;
        admin = _admin;

        // Defaults chosen to meet: final price = 0.003 USDC & total revenue ≈ 80k USDC
        uint256 defaultP0 = 77_754_867_364_255; // 7.7754867364255e13
        uint256 defaultK  = 3_652_806_415_794_679_808; // ~3.6528e18

        P0 = UD60x18.wrap(_P0_ud60x18 > 0 ? _P0_ud60x18 : defaultP0);
        k  = UD60x18.wrap(_k_ud60x18 > 0 ? _k_ud60x18 : defaultK);
    }

    // ========== Execute / admin / deposit ==========

    function execute(
        bytes32 contextKey,
        address payer,
        address token,
        uint256 amount,
        bytes32 /* salt */,
        address payTo,
        address /* facilitator */,
        bytes calldata /* data */
    ) external onlyRouter returns (bytes memory) {
        if (token != usdcToken) revert InvalidToken();
        if (amount == 0) revert InvalidAmount();
        if (tokensSold >= TOTAL_SALE_SUPPLY) revert SaleCompleted();

        uint256 tokensToReceive = calculateTokensForUsdc(amount);
        uint256 contractBalance = IERC20(x402xToken).balanceOf(address(this));
        if (tokensToReceive > contractBalance) revert InsufficientTokens();

        if (tokensSold + tokensToReceive > TOTAL_SALE_SUPPLY) {
            revert SaleCompleted();
        }

        tokensSold += tokensToReceive;
        totalUsdcCollected += amount;

        // transfer USDC from settlementRouter to this
        IERC20(token).safeTransferFrom(settlementRouter, address(this), amount);

        // transfer tokens to buyer
        IERC20(x402xToken).safeTransfer(payTo, tokensToReceive);

        uint256 newPrice = getCurrentPrice();

        emit TokensPurchased(contextKey, payTo, amount, tokensToReceive, newPrice);

        return abi.encode(tokensToReceive);
    }

    function depositTokens(uint256 amount) external onlyAdmin {
        if (amount == 0) revert InvalidAmount();
        IERC20(x402xToken).safeTransferFrom(msg.sender, address(this), amount);
        emit TokensDeposited(msg.sender, amount);
    }

    function withdrawTokens(uint256 amount) external onlyAdmin {
        if (amount == 0) revert InvalidAmount();
        uint256 available = IERC20(x402xToken).balanceOf(address(this));
        if (amount > available) revert InsufficientTokens();
        IERC20(x402xToken).safeTransfer(msg.sender, amount);
        emit TokensWithdrawn(msg.sender, amount);
    }

    function setAdmin(address newAdmin) external onlyAdmin {
        if (newAdmin == address(0)) revert InvalidAddress();
        address oldAdmin = admin;
        admin = newAdmin;
        emit AdminChanged(oldAdmin, newAdmin);
    }

    function withdrawUsdc(uint256 amount) external onlyAdmin {
        if (amount == 0) revert InvalidAmount();
        uint256 available = IERC20(usdcToken).balanceOf(address(this));
        if (amount > available) revert InsufficientTokens();
        IERC20(usdcToken).safeTransfer(msg.sender, amount);
    }

    // ========== Views ==========

    /**
     * Price per token in USDC (6 decimals)
     */
    function getCurrentPrice() public view returns (uint256) {
        if (tokensSold == 0) {
            // return P0 in USDC 6 decimals
            return UD60x18.unwrap(P0) / 10**(X402X_DECIMALS - USDC_DECIMALS);
        }
        if (tokensSold >= TOTAL_SALE_SUPPLY) {
            UD60x18 xFinal = UD60x18.wrap(UNIT); // x = 1.0
            UD60x18 expKxFinal = k.mul(xFinal).exp();
            UD60x18 finalPrice18 = P0.mul(expKxFinal);
            return UD60x18.unwrap(finalPrice18) / 10**(X402X_DECIMALS - USDC_DECIMALS);
        }

        UD60x18 x = UD60x18.wrap((tokensSold * UNIT) / TOTAL_SALE_SUPPLY);
        UD60x18 kx = k.mul(x);
        UD60x18 expKx = kx.exp();
        UD60x18 price18 = P0.mul(expKx);
        return UD60x18.unwrap(price18) / 10**(X402X_DECIMALS - USDC_DECIMALS);
    }

    /**
     * Calculate tokens purchasable with usdcAmount (6 decimals)
     * Uses algebraic rearrangement to compute target exp(k*x1) then binary search for x1
     */
    function calculateTokensForUsdc(uint256 usdcAmount) public view returns (uint256) {
        if (usdcAmount == 0) return 0;
        if (tokensSold >= TOTAL_SALE_SUPPLY) return 0;

        // convert to 18 decimals for calc
        uint256 usdcAmount18 = usdcAmount * 10**(X402X_DECIMALS - USDC_DECIMALS);

        // current normalized x0
        UD60x18 x0 = UD60x18.wrap((tokensSold * UNIT) / TOTAL_SALE_SUPPLY);

        // exp(k*x0)
        UD60x18 kx0 = k.mul(x0);
        UD60x18 expKx0 = kx0.exp();

        // targetExp = exp(k*x0) + (k * usdcAmount18) / (P0 * TOTAL_SALE_SUPPLY)
        // For exponential curve: Revenue = (P0 * TOTAL_SALE_SUPPLY / k) * (exp(k*x1) - exp(k*x0))
        // Rearranging: exp(k*x1) = exp(k*x0) + (k * usdcAmount18) / (P0 * TOTAL_SALE_SUPPLY)
        // use uint math on unwrap
        uint256 term = (UD60x18.unwrap(k) * usdcAmount18 * UNIT) / (UD60x18.unwrap(P0) * TOTAL_SALE_SUPPLY);
        uint256 targetExp = UD60x18.unwrap(expKx0) + term;

        // binary search for x1 in [x0, 1.0] such that exp(k*x1) <= targetExp
        UD60x18 low = x0;
        UD60x18 high = UD60x18.wrap(UNIT);
        UD60x18 best = x0;

        for (uint256 i = 0; i < 80; ++i) {
            uint256 midUnwrapped = (UD60x18.unwrap(low) + UD60x18.unwrap(high)) / 2;
            UD60x18 mid = UD60x18.wrap(midUnwrapped);
            UD60x18 kmid = k.mul(mid);
            UD60x18 expMid = kmid.exp();
            uint256 expMidV = UD60x18.unwrap(expMid);

            if (expMidV <= targetExp) {
                best = mid;
                // move low up
                uint256 newLow = UD60x18.unwrap(mid) + 1;
                if (newLow > UD60x18.unwrap(high)) break;
                low = UD60x18.wrap(newLow);
            } else {
                if (UD60x18.unwrap(mid) == 0) break;
                uint256 newHigh = UD60x18.unwrap(mid) - 1;
                high = UD60x18.wrap(newHigh);
            }
        }

        uint256 x1Unwrapped = UD60x18.unwrap(best);
        uint256 s1 = (x1Unwrapped * TOTAL_SALE_SUPPLY) / UNIT;
        if (s1 <= tokensSold) return 0;
        uint256 tokensToBuy = s1 - tokensSold;

        uint256 remaining = TOTAL_SALE_SUPPLY - tokensSold;
        if (tokensToBuy > remaining) tokensToBuy = remaining;

        return tokensToBuy;
    }

    /**
     * Calculate USDC needed to purchase `tokenAmount` tokens
     */
    function calculateUsdcForTokens(uint256 tokenAmount) public view returns (uint256) {
        if (tokenAmount == 0) return 0;
        if (tokensSold >= TOTAL_SALE_SUPPLY) return 0;

        uint256 s0 = tokensSold;
        uint256 s1 = s0 + tokenAmount;
        if (s1 > TOTAL_SALE_SUPPLY) {
            s1 = TOTAL_SALE_SUPPLY;
            tokenAmount = s1 - tokensSold;
        }

        UD60x18 x0 = UD60x18.wrap((s0 * UNIT) / TOTAL_SALE_SUPPLY);
        UD60x18 x1 = UD60x18.wrap((s1 * UNIT) / TOTAL_SALE_SUPPLY);

        UD60x18 kx0 = k.mul(x0);
        UD60x18 kx1 = k.mul(x1);
        UD60x18 expKx0 = kx0.exp();
        UD60x18 expKx1 = kx1.exp();

        uint256 expDiff = UD60x18.unwrap(expKx1) - UD60x18.unwrap(expKx0);
        if (expDiff == 0) return 0;

        // Revenue = (P0 * TOTAL_SALE_SUPPLY / k) * (exp(k*x1) - exp(k*x0))
        // For exponential curve: Revenue = ∫[s0 to s1] P0 * exp(k * s / TOTAL_SALE_SUPPLY) ds
        // = (P0 * TOTAL_SALE_SUPPLY / k) * (exp(k*x1) - exp(k*x0))
        uint256 numerator = UD60x18.unwrap(P0) * expDiff * TOTAL_SALE_SUPPLY / UNIT;
        uint256 cost18 = numerator / UD60x18.unwrap(k);
        return cost18 / 10**(X402X_DECIMALS - USDC_DECIMALS);
    }

    function getRemainingSupply() external view returns (uint256) {
        if (tokensSold >= TOTAL_SALE_SUPPLY) return 0;
        return TOTAL_SALE_SUPPLY - tokensSold;
    }

    function getTokenBalance() external view returns (uint256) {
        return IERC20(x402xToken).balanceOf(address(this));
    }

    function getUsdcBalance() external view returns (uint256) {
        return IERC20(usdcToken).balanceOf(address(this));
    }
}
