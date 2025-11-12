// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
// RevenueSplitHook has been deprecated and replaced by TransferHook
import {NFTMintHook} from "../examples/nft-mint/NFTMintHook.sol";
import {RandomNFT} from "../examples/nft-mint/RandomNFT.sol";
import {RewardToken} from "../examples/reward-points/RewardToken.sol";
import {RewardHook} from "../examples/reward-points/RewardHook.sol";

/**
 * @title DeployShowcase
 * @notice Deployment script for x402-exec Showcase scenarios
 * 
 * This script deploys all contracts needed for the two showcase scenarios:
 * - nft: NFTMintHook + RandomNFT
 * - reward: RewardHook + RewardToken
 * 
 * Note: RevenueSplitHook has been deprecated. Use TransferHook (built-in) instead.
 * 
 * Usage:
 *   # Deploy all scenarios (with network prefix)
 *   forge script script/Deploy.s.sol:DeployShowcase --sig "deployAll(string)" "BASE_SEPOLIA" --rpc-url $RPC_URL --broadcast
 *   
 *   # Deploy specific scenario
 *   forge script script/Deploy.s.sol:DeployShowcase --sig "deployNFT(string)" "BASE_SEPOLIA" --rpc-url $RPC_URL --broadcast
 *   forge script script/Deploy.s.sol:DeployShowcase --sig "deployReward(string)" "BASE_SEPOLIA" --rpc-url $RPC_URL --broadcast
 * 
 * Required environment variables:
 * - RPC_URL: Network RPC endpoint
 * - DEPLOYER_PRIVATE_KEY: Deployer private key
 * - SETTLEMENT_ROUTER_ADDRESS: Address of deployed SettlementRouter
 * 
 * Optional environment variable:
 * - NETWORK_PREFIX: Network prefix for environment variables (e.g., "BASE_SEPOLIA", "X_LAYER_TESTNET")
 *   If not provided via function parameter, will try to read from env
 */
contract DeployShowcase is Script {
    address settlementRouter;
    uint256 deployerPrivateKey;
    string networkPrefix;
    
    // Deployed contract addresses
    address nftMintHook;
    address randomNFT;
    address rewardToken;
    address rewardHook;
    
    function setUp() public {
        settlementRouter = vm.envAddress("SETTLEMENT_ROUTER_ADDRESS");
        deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        
        // Try to get network prefix from environment variable (optional)
        try vm.envString("NETWORK_PREFIX") returns (string memory prefix) {
            networkPrefix = prefix;
        } catch {
            networkPrefix = "";
        }
        
        console.log("Settlement Router:", settlementRouter);
        console.log("Deployer:", vm.addr(deployerPrivateKey));
        console.log("Network Chain ID:", block.chainid);
        if (bytes(networkPrefix).length > 0) {
            console.log("Network Prefix:", networkPrefix);
        }
        console.log("");
    }
    
    /**
     * @notice Deploy all scenarios with network prefix
     * @param prefix Network prefix (e.g., "BASE_SEPOLIA", "X_LAYER_TESTNET")
     */
    function deployAll(string memory prefix) external {
        networkPrefix = prefix;
        vm.startBroadcast(deployerPrivateKey);
        
        _deployNFT();
        _deployReward();
        
        vm.stopBroadcast();
        
        _printSummary(true, true);
    }
    
    /**
     * @notice Deploy all scenarios (legacy - no prefix)
     */
    function deployAll() external {
        vm.startBroadcast(deployerPrivateKey);
        
        _deployNFT();
        _deployReward();
        
        vm.stopBroadcast();
        
        _printSummary(true, true);
    }
    
    /**
     * @notice Deploy NFT mint scenario with network prefix
     */
    function deployNFT(string memory prefix) external {
        networkPrefix = prefix;
        vm.startBroadcast(deployerPrivateKey);
        _deployNFT();
        vm.stopBroadcast();
        _printSummary(true, false);
    }
    
    /**
     * @notice Deploy NFT mint scenario (legacy - no prefix)
     */
    function deployNFT() external {
        vm.startBroadcast(deployerPrivateKey);
        _deployNFT();
        vm.stopBroadcast();
        _printSummary(true, false);
    }
    
    /**
     * @notice Deploy reward points scenario with network prefix
     */
    function deployReward(string memory prefix) external {
        networkPrefix = prefix;
        vm.startBroadcast(deployerPrivateKey);
        _deployReward();
        vm.stopBroadcast();
        _printSummary(false, true);
    }
    
    /**
     * @notice Deploy reward points scenario (legacy - no prefix)
     */
    function deployReward() external {
        vm.startBroadcast(deployerPrivateKey);
        _deployReward();
        vm.stopBroadcast();
        _printSummary(false, true);
    }
    
    // Internal deployment functions
    
    function _deployNFT() internal {
        console.log("=== Deploying NFT Mint (nft-mint) ===");
        
        // Deploy NFTMintHook first
        nftMintHook = address(new NFTMintHook(settlementRouter));
        console.log("NFTMintHook:", nftMintHook);
        
        // Deploy RandomNFT with NFTMintHook as minter
        randomNFT = address(new RandomNFT(nftMintHook));
        console.log("RandomNFT:", randomNFT);
        console.log("NFTMintHook set as minter during deployment");
        console.log("");
    }
    
    function _deployReward() internal {
        console.log("=== Deploying Reward Points (reward-points) ===");
        
        // Deploy RewardHook first (reusable infrastructure)
        rewardHook = address(new RewardHook(settlementRouter));
        console.log("RewardHook:", rewardHook);
        
        // Deploy RewardToken with RewardHook address (secure by design)
        rewardToken = address(new RewardToken(rewardHook));
        console.log("RewardToken:", rewardToken);
        console.log("RewardHook set as distributor during deployment");
        console.log("");
    }
    
    function _printSummary(bool nft, bool reward) internal view {
        console.log("=== Deployment Summary ===");
        console.log("");
        
        // Check if we have a network prefix
        bool hasPrefix = bytes(networkPrefix).length > 0;
        
        if (nft) {
            console.log("NFT Mint (nft-mint/):");
            if (hasPrefix) {
                console.log("  %s_NFT_MINT_HOOK_ADDRESS=%s", networkPrefix, nftMintHook);
                console.log("  %s_RANDOM_NFT_ADDRESS=%s", networkPrefix, randomNFT);
            } else {
                console.log("  NFT_MINT_HOOK_ADDRESS=%s", nftMintHook);
                console.log("  RANDOM_NFT_ADDRESS=%s", randomNFT);
            }
            console.log("");
        }
        
        if (reward) {
            console.log("Reward Points (reward-points/):");
            if (hasPrefix) {
                console.log("  %s_REWARD_HOOK_ADDRESS=%s", networkPrefix, rewardHook);
                console.log("  %s_REWARD_TOKEN_ADDRESS=%s", networkPrefix, rewardToken);
            } else {
                console.log("  REWARD_HOOK_ADDRESS=%s", rewardHook);
                console.log("  REWARD_TOKEN_ADDRESS=%s", rewardToken);
            }
            console.log("");
        }
        
        console.log("Copy these addresses to examples/showcase/server/.env");
    }
}
