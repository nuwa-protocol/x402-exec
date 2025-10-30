// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {SettlementHub} from "../src/SettlementHub.sol";

/**
 * @title DeploySettlement
 * @notice Deployment script for SettlementHub core contract
 * 
 * This script ONLY deploys the core SettlementHub contract.
 * Hooks and scenario-specific contracts should be deployed separately
 * using scenario-specific deployment scripts.
 * 
 * Usage:
 *   forge script script/DeploySettlement.s.sol:DeploySettlement \
 *     --rpc-url $RPC_URL \
 *     --broadcast \
 *     --verify
 * 
 * Required environment variables:
 *   - RPC_URL: Network RPC endpoint
 *   - DEPLOYER_PRIVATE_KEY: Deployer private key
 *   - ETHERSCAN_API_KEY: (optional) For contract verification
 */
contract DeploySettlement is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        
        console.log("Deploying SettlementHub...");
        console.log("Deployer:", vm.addr(deployerPrivateKey));
        console.log("Network Chain ID:", block.chainid);
        console.log("");
        
        vm.startBroadcast(deployerPrivateKey);
        
        // Deploy SettlementHub
        SettlementHub hub = new SettlementHub();
        
        vm.stopBroadcast();
        
        // Output deployment information
        console.log("=== Deployment Complete ===");
        console.log("SettlementHub:", address(hub));
        console.log("");
        console.log("Save this address to your .env file:");
        console.log("SETTLEMENT_HUB_ADDRESS=%s", address(hub));
        console.log("");
        console.log("Next steps:");
        console.log("1. Update .env with SETTLEMENT_HUB_ADDRESS");
        console.log("2. Deploy scenario contracts (e.g., examples/settlement-showcase)");
    }
}
