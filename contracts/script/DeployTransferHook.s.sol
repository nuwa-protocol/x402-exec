// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {TransferHook} from "../src/hooks/TransferHook.sol";

/**
 * @title DeployTransferHook
 * @notice Deployment script for TransferHook built-in contract
 * 
 * This script deploys the protocol's built-in TransferHook, which provides
 * basic transfer functionality with facilitator fee support. This is intended
 * to be deployed once per network and used by all projects.
 * 
 * Prerequisites:
 *   - SettlementRouter must be deployed first
 * 
 * Usage:
 *   forge script script/DeployTransferHook.s.sol:DeployTransferHook \
 *     --sig "run(address)" <SETTLEMENT_ROUTER_ADDRESS> \
 *     --rpc-url $RPC_URL \
 *     --broadcast \
 *     --verify
 * 
 * Required environment variables:
 *   - RPC_URL: Network RPC endpoint
 *   - DEPLOYER_PRIVATE_KEY: Deployer private key
 *   - ETHERSCAN_API_KEY: (optional) For contract verification
 */
contract DeployTransferHook is Script {
    function run(address settlementRouter) external {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        
        console.log("Deploying TransferHook...");
        console.log("Deployer:", vm.addr(deployerPrivateKey));
        console.log("Network Chain ID:", block.chainid);
        console.log("SettlementRouter:", settlementRouter);
        console.log("");
        
        // Validate SettlementRouter address
        require(settlementRouter != address(0), "SettlementRouter address is zero");
        require(settlementRouter.code.length > 0, "SettlementRouter not deployed at address");
        
        vm.startBroadcast(deployerPrivateKey);
        
        // Deploy TransferHook
        TransferHook transferHook = new TransferHook(settlementRouter);
        
        vm.stopBroadcast();
        
        // Output deployment information
        console.log("=== Deployment Complete ===");
        console.log("TransferHook:", address(transferHook));
        console.log("");
        console.log("Verification:");
        console.log("  SettlementRouter:", transferHook.settlementRouter());
        console.log("");
        console.log("Next steps:");
        console.log("1. Update documentation with TransferHook address");
        console.log("2. Configure Resource Servers to use this hook for simple transfers");
        console.log("3. Test with facilitator integration");
    }
}

