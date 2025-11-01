// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {SettlementRouter} from "../src/SettlementRouter.sol";

/**
 * @title DeploySettlement
 * @notice Deployment script for SettlementRouter core contract
 * 
 * This script ONLY deploys the core SettlementRouter contract.
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
        
        console.log("Deploying SettlementRouter...");
        console.log("Deployer:", vm.addr(deployerPrivateKey));
        console.log("Network Chain ID:", block.chainid);
        console.log("");
        
        vm.startBroadcast(deployerPrivateKey);
        
        // Deploy SettlementRouter
        SettlementRouter router = new SettlementRouter();
        
        vm.stopBroadcast();
        
        // Output deployment information
        console.log("=== Deployment Complete ===");
        console.log("SettlementRouter:", address(router));
        console.log("");
        console.log("Save this address to your .env file:");
        console.log("SETTLEMENT_ROUTER_ADDRESS=%s", address(router));
        console.log("");
        console.log("Next steps:");
        console.log("1. Update .env with SETTLEMENT_ROUTER_ADDRESS");
        console.log("2. Deploy scenario contracts (e.g., examples/showcase)");
    }
}
