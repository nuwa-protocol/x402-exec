// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {RevenueSplitHook} from "../examples/revenue-split/RevenueSplitHook.sol";
import {NFTMintHook} from "../examples/nft-mint/NFTMintHook.sol";
import {RandomNFT} from "../examples/nft-mint/RandomNFT.sol";
import {RewardToken} from "../examples/reward-points/RewardToken.sol";
import {RewardHook} from "../examples/reward-points/RewardHook.sol";

/**
 * @title DeployShowcase
 * @notice Deployment script for Settlement Showcase scenarios
 * 
 * This script deploys all contracts needed for the three showcase scenarios:
 * - referral: RevenueSplitHook
 * - nft: NFTMintHook + RandomNFT
 * - reward: RewardHook + RewardToken
 * 
 * Usage:
 *   # Deploy all scenarios
 *   forge script script/Deploy.s.sol:DeployShowcase --sig "deployAll()" --rpc-url $RPC_URL --broadcast
 *   
 *   # Deploy specific scenario
 *   forge script script/Deploy.s.sol:DeployShowcase --sig "deployReferral()" --rpc-url $RPC_URL --broadcast
 *   forge script script/Deploy.s.sol:DeployShowcase --sig "deployNFT()" --rpc-url $RPC_URL --broadcast
 *   forge script script/Deploy.s.sol:DeployShowcase --sig "deployReward()" --rpc-url $RPC_URL --broadcast
 * 
 * Required environment variables:
 * - RPC_URL: Network RPC endpoint
 * - DEPLOYER_PRIVATE_KEY: Deployer private key
 * - SETTLEMENT_ROUTER_ADDRESS: Address of deployed SettlementRouter
 */
contract DeployShowcase is Script {
    address settlementRouter;
    uint256 deployerPrivateKey;
    
    // Deployed contract addresses
    address revenueSplitHook;
    address nftMintHook;
    address randomNFT;
    address rewardToken;
    address rewardHook;
    
    function setUp() public {
        settlementRouter = vm.envAddress("SETTLEMENT_ROUTER_ADDRESS");
        deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        
        console.log("Settlement Router:", settlementRouter);
        console.log("Deployer:", vm.addr(deployerPrivateKey));
        console.log("Network Chain ID:", block.chainid);
        console.log("");
    }
    
    /**
     * @notice Deploy all scenarios
     */
    function deployAll() external {
        vm.startBroadcast(deployerPrivateKey);
        
        _deployReferral();
        _deployNFT();
        _deployReward();
        
        vm.stopBroadcast();
        
        _printSummary(true, true, true);
    }
    
    /**
     * @notice Deploy referral split scenario
     */
    function deployReferral() external {
        vm.startBroadcast(deployerPrivateKey);
        _deployReferral();
        vm.stopBroadcast();
        _printSummary(true, false, false);
    }
    
    /**
     * @notice Deploy NFT mint scenario
     */
    function deployNFT() external {
        vm.startBroadcast(deployerPrivateKey);
        _deployNFT();
        vm.stopBroadcast();
        _printSummary(false, true, false);
    }
    
    /**
     * @notice Deploy reward points scenario
     */
    function deployReward() external {
        vm.startBroadcast(deployerPrivateKey);
        _deployReward();
        vm.stopBroadcast();
        _printSummary(false, false, true);
    }
    
    // Internal deployment functions
    
    function _deployReferral() internal {
        console.log("=== Deploying Referral Split (revenue-split) ===");
        revenueSplitHook = address(new RevenueSplitHook(settlementRouter));
        console.log("RevenueSplitHook:", revenueSplitHook);
        console.log("");
    }
    
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
    
    function _printSummary(bool referral, bool nft, bool reward) internal view {
        console.log("=== Deployment Summary ===");
        console.log("");
        
        if (referral) {
            console.log("Referral Split (revenue-split/):");
            console.log("  REVENUE_SPLIT_HOOK_ADDRESS=%s", revenueSplitHook);
            console.log("");
        }
        
        if (nft) {
            console.log("NFT Mint (nft-mint/):");
            console.log("  NFT_MINT_HOOK_ADDRESS=%s", nftMintHook);
            console.log("  RANDOM_NFT_ADDRESS=%s", randomNFT);
            console.log("");
        }
        
        if (reward) {
            console.log("Reward Points (reward-points/):");
            console.log("  REWARD_HOOK_ADDRESS=%s", rewardHook);
            console.log("  REWARD_TOKEN_ADDRESS=%s", rewardToken);
            console.log("");
        }
        
        console.log("Copy these addresses to server/.env");
    }
}
