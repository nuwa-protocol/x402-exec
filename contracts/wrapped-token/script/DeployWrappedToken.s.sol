// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {WrappedToken} from "../src/WrappedToken.sol";

/**
 * @title DeployWrappedToken
 * @notice Deployment script for WrappedToken contract
 * 
 * This script deploys a WrappedToken contract for a specific underlying token.
 * The wrapped token will support EIP-3009 transferWithAuthorization for facilitator usage.
 * 
 * Usage:
 *   forge script script/DeployWrappedToken.s.sol:DeployWrappedToken \
 *     --rpc-url $RPC_URL \
 *     --broadcast \
 *     --verify
 * 
 * Required environment variables:
 *   - DEPLOYER_PRIVATE_KEY: Deployer private key
 *   - ETHERSCAN_API_KEY: (optional) For contract verification
 * 
 * Configuration:
 *   - Underlying Token: 0x221c5B1a293aAc1187ED3a7D7d2d9aD7fE1F3FB0
 *   - Name: "x402 Wrapped"
 *   - Symbol: "USDTx"
 */
contract DeployWrappedToken is Script {
    // Configuration
    // mainnet 0x55d398326f99059fF775485246999027B3197955
    address constant UNDERLYING_TOKEN = 0x221c5B1a293aAc1187ED3a7D7d2d9aD7fE1F3FB0;
    string constant TOKEN_NAME = "x402 Wrapped USDT";
    string constant TOKEN_SYMBOL = "USDTx";
    
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        console.log("=== Deployment Configuration ===");
        console.log("Deployer:", deployer);
        console.log("Network Chain ID:", block.chainid);
        console.log("Underlying Token:", UNDERLYING_TOKEN);
        console.log("Token Name:", TOKEN_NAME);
        console.log("Token Symbol:", TOKEN_SYMBOL);
        console.log("");
        
        vm.startBroadcast(deployerPrivateKey);
        
        // Deploy WrappedToken
        console.log("Deploying WrappedToken...");
        WrappedToken wrappedToken = new WrappedToken(
            UNDERLYING_TOKEN,
            TOKEN_NAME,
            TOKEN_SYMBOL
        );
        
        vm.stopBroadcast();
        
        // Output deployment information
        console.log("=== Deployment Complete ===");
        console.log("WrappedToken Address:", address(wrappedToken));
        console.log("Underlying Token:", wrappedToken.underlying());
        console.log("Token Name:", wrappedToken.name());
        console.log("Token Symbol:", wrappedToken.symbol());
        console.log("Decimals:", wrappedToken.decimals());
        console.log("");
        console.log("Save this address to your .env file:");
        console.log("WRAPPED_TOKEN_ADDRESS=%s", address(wrappedToken));
        console.log("");
        console.log("=== Usage ===");
        console.log("Users can now:");
        console.log("1. Wrap tokens: wrappedToken.wrap(amount)");
        console.log("2. Unwrap tokens: wrappedToken.unwrap(amount)");
        console.log("3. Use ERC3009: wrappedToken.transferWithAuthorization(...)");
        console.log("");
        console.log("The wrapped token supports EIP-3009 for facilitator payments.");
    }
}

