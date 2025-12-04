// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {X402X} from "../src/X402X.sol";
import {BondingCurveHook} from "../src/BondingCurveHook.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title DeployBondingCurve
 * @notice Deployment script for X402X token and BondingCurveHook
 * 
 * This script deploys:
 * - X402X: ERC20 token with 1 billion total supply
 * - BondingCurveHook: Hook for purchasing X402X tokens via bonding curve
 * - Automatically transfers 100M X402X tokens to BondingCurveHook for sale
 * 
 * Usage:
 *   # Deploy with network prefix
 *   forge script script/DeployBondingCurve.s.sol:DeployBondingCurve \
 *     --sig "deploy(string)" "BASE_SEPOLIA" \
 *     --rpc-url $RPC_URL \
 *     --broadcast \
 *     --verify
 *   
 *   # Deploy without prefix (legacy)
 *   forge script script/DeployBondingCurve.s.sol:DeployBondingCurve \
 *     --rpc-url $RPC_URL \
 *     --broadcast \
 *     --verify
 * 
 * Required environment variables:
 * - DEPLOYER_PRIVATE_KEY: Deployer private key
 * - SETTLEMENT_ROUTER_ADDRESS: Address of deployed SettlementRouter
 * - USDC_TOKEN_ADDRESS: Address of USDC token contract (must support EIP-3009)
 * 
 * Optional environment variable:
 * - NETWORK_PREFIX: Network prefix for environment variables (e.g., "BASE_SEPOLIA", "X_LAYER_TESTNET")
 *   If not provided via function parameter, will try to read from env
 * 
 * After deployment:
 * 1. 100M X402X tokens are automatically transferred to BondingCurveHook
 * 2. Users can immediately purchase X402X tokens using USDC through SettlementRouter
 */
contract DeployBondingCurve is Script {
    address settlementRouter;
    address usdcToken;
    uint256 deployerPrivateKey;
    address deployer;
    string networkPrefix;
    
    // Deployed contract addresses
    address x402xToken;
    address bondingCurveHook;
    
    function setUp() public {
        deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        deployer = vm.addr(deployerPrivateKey);
        settlementRouter = vm.envAddress("SETTLEMENT_ROUTER_ADDRESS");
        usdcToken = vm.envAddress("USDC_TOKEN_ADDRESS");
        
        // Try to get network prefix from environment variable (optional)
        try vm.envString("NETWORK_PREFIX") returns (string memory prefix) {
            networkPrefix = prefix;
        } catch {
            networkPrefix = "";
        }
        
        console.log("=== Deployment Configuration ===");
        console.log("Deployer:", deployer);
        console.log("Settlement Router:", settlementRouter);
        console.log("USDC Token:", usdcToken);
        console.log("Network Chain ID:", block.chainid);
        if (bytes(networkPrefix).length > 0) {
            console.log("Network Prefix:", networkPrefix);
        }
        console.log("");
    }
    
    /**
     * @notice Deploy X402X and BondingCurveHook with network prefix
     * @param prefix Network prefix (e.g., "BASE_SEPOLIA", "X_LAYER_TESTNET")
     */
    function deploy(string memory prefix) external {
        networkPrefix = prefix;
        _deploy();
    }
    
    /**
     * @notice Deploy X402X and BondingCurveHook (legacy - no prefix)
     */
    function deploy() external {
        _deploy();
    }
    
    /**
     * @notice Internal deployment function
     */
    function _deploy() internal {
        console.log("=== Starting Deployment ===");
        console.log("");
        
        vm.startBroadcast(deployerPrivateKey);
        
        // Step 1: Deploy X402X token
        console.log("Step 1: Deploying X402X token...");
        X402X token = new X402X();
        x402xToken = address(token);
        console.log("X402X Token:", x402xToken);
        console.log("Total Supply: 1,000,000,000 X402X");
        console.log("All tokens minted to deployer:", deployer);
        console.log("");
        
        // Step 2: Deploy BondingCurveHook
        console.log("Step 2: Deploying BondingCurveHook...");

        uint256 P0_ud60x18 = 0;
        uint256 k_ud60x18 = 0;
        
        BondingCurveHook hook = new BondingCurveHook(
            settlementRouter,
            x402xToken,
            usdcToken,
            deployer, // Admin is the deployer
            P0_ud60x18,
            k_ud60x18
        );
        bondingCurveHook = address(hook);
        // Read actual P0 and k from the deployed contract (in case defaults are used)
        uint256 actualP0 = hook.P0();
        uint256 actualK = hook.k();
        console.log("BondingCurveHook:", bondingCurveHook);
        console.log("Admin:", deployer);
        console.log("Total Sale Supply: 100,000,000 X402X");
        console.log("Bonding Curve: Exponential P(x) = P0 * exp(k*x)");
        if (P0_ud60x18 == 0 || k_ud60x18 == 0) {
            console.log("WARNING: Zero P0 or k passed; contract will use default values.");
        }
        console.log("Initial Price (P0):", actualP0);
        console.log("Growth Factor (k):", actualK);
        // Calculate and log the target total revenue using the actual values
        // Note: For simplicity, just log the formula with actual values; onchain math is not trivial here
        console.log("Target Total Revenue: (P0/k) * (exp(k) - 1) with actual parameters:");
        console.log("Formula: Total = (P0/k) * (exp(k) - 1)");
        console.log("P0 =", actualP0, ", k =", actualK);
        console.log("");
        
        // Step 3: Transfer 100M X402X tokens to BondingCurveHook
        console.log("Step 3: Transferring 100M X402X tokens to BondingCurveHook...");
        uint256 saleSupply = 100_000_000 * 10**18; // 100M tokens
        token.transfer(bondingCurveHook, saleSupply);
        console.log("Transferred 100,000,000 X402X tokens to BondingCurveHook");
        console.log("Hook token balance:", token.balanceOf(bondingCurveHook) / 10**18);
        console.log("");
        
        vm.stopBroadcast();
        
        // Print summary
        _printSummary();
        
        // Print next steps
        _printNextSteps();
    }
    
    /**
     * @notice Print deployment summary
     */
    function _printSummary() internal view {
        console.log("=== Deployment Summary ===");
        console.log("");
        
        bool hasPrefix = bytes(networkPrefix).length > 0;
        
        if (hasPrefix) {
            console.log("Add these to your .env file:");
            console.log("  %s_X402X_TOKEN_ADDRESS=%s", networkPrefix, x402xToken);
            console.log("  %s_BONDING_CURVE_HOOK_ADDRESS=%s", networkPrefix, bondingCurveHook);
        } else {
            console.log("Add these to your .env file:");
            console.log("  X402X_TOKEN_ADDRESS=%s", x402xToken);
            console.log("  BONDING_CURVE_HOOK_ADDRESS=%s", bondingCurveHook);
        }
        console.log("");
    }
    
    /**
     * @notice Print next steps instructions
     */
    function _printNextSteps() internal view {
        console.log("=== Next Steps ===");
        console.log("");
        console.log("1. Verify token balances:");
        console.log("   - X402X balance in hook:", bondingCurveHook);
        console.log("   - Check hook.getTokenBalance()");
        console.log("   - Expected: 100,000,000 X402X");
        console.log("");
        console.log("2. Users can now purchase X402X tokens:");
        console.log("   - Use SettlementRouter.settleAndExecute()");
        console.log("   - Set hook address to:", bondingCurveHook);
        console.log("   - Payment token must be USDC:", usdcToken);
        console.log("");
        console.log("3. Monitor sales:");
        console.log("   - hook.tokensSold() - tokens sold so far");
        console.log("   - hook.getCurrentPrice() - current price per token");
        console.log("   - hook.totalUsdcCollected() - total USDC collected");
        console.log("");
        console.log("4. Admin can withdraw:");
        console.log("   - hook.withdrawUsdc(amount) - withdraw collected USDC");
        console.log("   - hook.withdrawTokens(amount) - withdraw unsold tokens");
        console.log("");
    }
}

