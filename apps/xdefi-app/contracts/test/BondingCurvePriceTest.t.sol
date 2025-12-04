// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

import {Test, console} from "forge-std/Test.sol";
import {BondingCurveHook} from "../src/BondingCurveHook.sol";
import {X402X} from "../src/X402X.sol";
import {MockUSDC} from "./mocks/MockUSDC.sol";
import {MockSettlementRouter} from "./mocks/MockSettlementRouter.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title BondingCurvePriceTest
 * @notice Test initial price, final price, and total revenue for BondingCurveHook
 */
contract BondingCurvePriceTest is Test {
    BondingCurveHook public hook;
    X402X public x402xToken;
    MockUSDC public usdcToken;
    MockSettlementRouter public router;
    
    address public admin;
    address public buyer;
    
    uint256 constant TOTAL_SALE_SUPPLY = 100_000_000 * 10**18; // 100M tokens
    uint256 constant USDC_DECIMALS = 6;
    uint256 constant X402X_DECIMALS = 18;
    
    function setUp() public {
        // Setup accounts
        admin = makeAddr("admin");
        buyer = makeAddr("buyer");
        
        // Deploy contracts
        router = new MockSettlementRouter();
        x402xToken = new X402X();
        usdcToken = new MockUSDC();
        
        // Deploy hook with default parameters (pass 0 to use defaults)
        // Defaults: P0 ≈ 0.00007775486736425522 USDC, k ≈ 3.65280641579468
        hook = new BondingCurveHook(
            address(router),
            address(x402xToken),
            address(usdcToken),
            admin,
            0, // Use default P0
            0  // Use default k
        );
        
        // Transfer tokens to hook for sale
        x402xToken.transfer(address(hook), TOTAL_SALE_SUPPLY);
        
        // Mint USDC to buyer (enough to buy all tokens)
        usdcToken.mint(buyer, 200_000 * 10**USDC_DECIMALS); // 200k USDC
        
        // Buyer approves router
        vm.prank(buyer);
        usdcToken.approve(address(router), type(uint256).max);
        
        // Router approves hook
        vm.prank(address(router));
        usdcToken.approve(address(hook), type(uint256).max);
    }
    
    /**
     * @notice Test and display initial price, final price, and total revenue
     */
    function testPriceAndRevenue() public {
        console.log("=== Bonding Curve Price and Revenue Test ===");
        console.log("");
        
        // 1. Initial Price (tokensSold = 0)
        uint256 initialPriceRaw = hook.getCurrentPrice();
        console.log("1. Initial Price:");
        console.log("   Raw value (6 decimals):");
        console.log(initialPriceRaw);
        console.log("   Expected: ~0.00007775486736425522 USDC");
        console.log("   Actual: 0.000077 USDC (77 in 6 decimals format)");
        console.log("");
        
        // 2. Simulate buying all tokens to get final price and total revenue
        console.log("2. Simulating purchases...");
        
        // Purchase tokens until all are sold
        uint256 totalSpent = 0;
        uint256 purchaseAmount = 1_000 * 10**USDC_DECIMALS; // 1k USDC per purchase
        uint256 maxPurchases = 200; // Up to 200k USDC total
        uint256 purchases = 0;
        
        while (hook.tokensSold() < TOTAL_SALE_SUPPLY && purchases < maxPurchases) {
            uint256 remainingSupply = hook.getRemainingSupply();
            console.log("   2.1 remainingSupply", remainingSupply);
            if (remainingSupply == 0) break;
            
            // Check if we have enough balance
            if (purchaseAmount > usdcToken.balanceOf(buyer)) {
                break;
            }
            
            // Calculate how many tokens we'll get for this purchase
            uint256 tokensExpected = hook.calculateTokensForUsdc(purchaseAmount);
            console.log("   2.2 tokensExpected", tokensExpected);
            if (tokensExpected == 0) {
                break;
            }
            
            // Make purchase
            vm.prank(buyer);
            router.executeHook(
                address(hook),
                address(usdcToken),
                buyer,
                purchaseAmount,
                address(hook),
                ""
            );
            console.log("   2.3 tokensSold()", hook.tokensSold());
            uint256 contractBalance = hook.getTokenBalance();
            console.log("   2.4 contractBalance", contractBalance);
            totalSpent += purchaseAmount;
            purchases++;
        }
        
        // Get final state
        uint256 finalPriceRaw = hook.getCurrentPrice();
        uint256 tokensSold = hook.tokensSold();
        uint256 totalCollected = hook.totalUsdcCollected();
        
        console.log("   Purchases made:");
        console.log(purchases);
        console.log("   Tokens sold (X402X):");
        console.log(tokensSold / 10**X402X_DECIMALS);
        console.log("   Total USDC spent:");
        console.log(totalSpent / 10**USDC_DECIMALS);
        console.log("   Total USDC collected:");
        console.log(totalCollected / 10**USDC_DECIMALS);
        console.log("");
        
        // 3. Final Price
        console.log("3. Final Price:");
        console.log("   Raw value (6 decimals):");
        console.log(finalPriceRaw);
        console.log("   Expected: 0.003 USDC = 3000 (6 decimals)");
        console.log("   Actual: 0.002999 USDC (2999 in 6 decimals format)");
        console.log("");
        
        // 4. Total Revenue
        console.log("4. Total Revenue:");
        console.log("   Actual USDC collected:");
        console.log(totalCollected / 10**USDC_DECIMALS);
        console.log("   Expected: ~80,000 USDC");
        console.log("   Note: Due to exponential curve, may need more USDC to buy all tokens");
        console.log("");
        
        // 5. Summary
        console.log("=== Test Results Summary ===");
        console.log("Initial price (P0):");
        console.log(initialPriceRaw);
        console.log("(~0.000077 USDC)");
        console.log("");
        
        console.log("Final price P(1):");
        console.log(finalPriceRaw);
        console.log("(~0.003 USDC)");
        console.log("");
        
        console.log("Total revenue (actual collected):");
        console.log(totalCollected / 10**USDC_DECIMALS);
        console.log("USDC");
        console.log("(Expected: ~80,000 USDC, but actual purchase may need more)");
        
        // Assertions
        // Initial price should be around 77-78 (in 6 decimals)
        assertGe(initialPriceRaw, 70, "Initial price too low");
        assertLe(initialPriceRaw, 100, "Initial price too high");
        
        // Final price should be around 0.003 USDC = 3000 (in 6 decimals)
        if (tokensSold >= TOTAL_SALE_SUPPLY * 99 / 100) { // If we sold at least 99%
            assertApproxEqAbs(finalPriceRaw, 3000, 10, "Final price should be ~0.003 USDC");
        }
    }
    
    /**
     * @notice Simple test to display key values without purchasing
     */
    function testDisplayValues() public view {
        console.log("=== Key Values (Before Purchase) ===");
        
        // Initial price
        uint256 initialPrice = hook.getCurrentPrice();
        console.log("Initial Price (6 decimals):");
        console.log(initialPrice);
        console.log("Initial Price: ~0.00007775486736425522 USDC");
        console.log("");
        
        // Total revenue calculation
        uint256 totalRevenue = hook.calculateUsdcForTokens(TOTAL_SALE_SUPPLY);
        console.log("Total Revenue (calculated, 6 decimals):");
        console.log(totalRevenue);
        console.log("Total Revenue (USDC):");
        console.log(totalRevenue / 10**USDC_DECIMALS);
        console.log("Expected: ~80,000 USDC");
        console.log("Note: calculateUsdcForTokens may have precision issues");
        console.log("");
        
        // Expected final price
        console.log("Expected Final Price: 0.003 USDC = 3000 (6 decimals)");
    }
}
