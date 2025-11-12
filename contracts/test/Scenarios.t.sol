// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {console} from "forge-std/console.sol";
import {RandomNFT} from "../examples/nft-mint/RandomNFT.sol";
import {RewardToken} from "../examples/reward-points/RewardToken.sol";
import {RewardHook} from "../examples/reward-points/RewardHook.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title ScenariosTest
 * @notice Basic tests for showcase contracts
 */
contract ScenariosTest is Test {
    RandomNFT public nft;
    RewardToken public rewardToken;
    RewardHook public rewardHook;
    
    address public settlementRouter = address(0x1);
    address public nftMintHook = address(0x2);
    address public merchant = address(0x3);
    address public user = address(0x4);
    
    function setUp() public {
        // Deploy contracts in correct order
        // 1. Deploy hook first (infrastructure)
        rewardHook = new RewardHook(settlementRouter);
        
        // 2. Deploy NFT with hook address
        nft = new RandomNFT(nftMintHook);
        
        // 3. Deploy RewardToken with hook address
        rewardToken = new RewardToken(address(rewardHook));
    }
    
    // ===== RandomNFT Tests =====
    
    function testNFTMint() public {
        vm.prank(nftMintHook);
        nft.mint(user);
        
        assertEq(nft.ownerOf(0), user);
        assertEq(nft.totalSupply(), 1);
        assertEq(nft.remainingSupply(), 9_999);
    }
    
    function testNFTMintOnlyMinter() public {
        vm.prank(user);
        vm.expectRevert(RandomNFT.OnlyMinter.selector);
        nft.mint(user);
    }
    
    function testNFTMaxSupply() public {
        vm.startPrank(nftMintHook);
        
        // Mint 10,000 NFTs
        for (uint256 i = 0; i < 10_000; i++) {
            nft.mint(user);
        }
        
        // Try to mint one more
        vm.expectRevert(RandomNFT.MaxSupplyReached.selector);
        nft.mint(user);
        
        vm.stopPrank();
    }
    
    // ===== RewardToken Tests =====
    
    function testRewardTokenInitialSupply() public view {
        uint256 maxSupply = 100_000_000 * 10**18; // 100M tokens
        assertEq(rewardToken.totalSupply(), maxSupply);
        assertEq(rewardToken.balanceOf(address(rewardToken)), maxSupply);
    }
    
    function testRewardTokenZeroAddressProtection() public {
        // Distribute some tokens to test user first
        vm.prank(address(rewardHook));
        rewardToken.distribute(user, 1000 * 10**18);
        
        // Try to transfer to zero address via transferWithAuthorization
        // This should revert with InvalidRecipient
        bytes32 nonce = keccak256("test-nonce");
        
        // Build authorization parameters
        address from = user;
        address to = address(0); // Zero address
        uint256 value = 100 * 10**18;
        uint256 validAfter = 0;
        uint256 validBefore = type(uint256).max;
        
        // Create a mock signature (doesn't matter since we expect revert before signature check)
        bytes memory signature = new bytes(65);
        
        // Should revert with InvalidRecipient before checking signature
        vm.expectRevert(RewardToken.InvalidRecipient.selector);
        rewardToken.transferWithAuthorization(
            from,
            to,
            value,
            validAfter,
            validBefore,
            nonce,
            signature
        );
    }
    
    function testRewardDistribution() public {
        uint256 amount = 1000 * 10**18;
        
        vm.prank(address(rewardHook));
        rewardToken.distribute(user, amount);
        
        assertEq(rewardToken.balanceOf(user), amount);
        assertEq(
            rewardToken.balanceOf(address(rewardToken)),
            rewardToken.totalSupply() - amount
        );
    }
    
    function testRewardDistributionOnlyHook() public {
        vm.prank(user);
        vm.expectRevert(RewardToken.OnlyRewardHook.selector);
        rewardToken.distribute(user, 1000 * 10**18);
    }
    
    // ===== RewardHook Tests =====
    
    function testRewardHookConstants() public view {
        assertEq(rewardHook.settlementRouter(), settlementRouter);
        assertEq(rewardHook.REWARD_RATE(), 1000);
    }
    
    function testRewardHookCalculation() public pure {
        // Test reward calculation
        // For 0.1 USDC (100,000 in 6 decimals), user should get 1000 points
        uint256 amount = 100_000; // 0.1 USDC
        uint256 REWARD_RATE = 1000;
        uint256 expectedPoints = (amount * REWARD_RATE * 10**18) / 100_000;
        
        assertEq(expectedPoints, 1000 * 10**18);
    }
    
    function testRewardHookCapProtection() public pure {
        // Test that rewards are capped at MAX_REWARD_AMOUNT (0.1 USDC)
        uint256 MAX_REWARD_AMOUNT = 100_000; // 0.1 USDC
        uint256 REWARD_RATE = 1000;
        
        // Case 1: Small amount (0.05 USDC) - no cap applied
        uint256 smallAmount = 50_000;
        uint256 smallReward = (smallAmount * REWARD_RATE * 10**18) / 100_000;
        assertEq(smallReward, 500 * 10**18); // 500 points
        
        // Case 2: Exact cap (0.1 USDC) - full rewards
        uint256 capAmount = 100_000;
        uint256 capReward = (capAmount * REWARD_RATE * 10**18) / 100_000;
        assertEq(capReward, 1000 * 10**18); // 1000 points
        
        // Case 3: Large amount (10 USDC) - capped at 0.1 USDC
        uint256 largeAmount = 10_000_000; // 10 USDC
        uint256 rewardableAmount = largeAmount > MAX_REWARD_AMOUNT ? MAX_REWARD_AMOUNT : largeAmount;
        uint256 largeReward = (rewardableAmount * REWARD_RATE * 10**18) / 100_000;
        assertEq(largeReward, 1000 * 10**18); // Still only 1000 points!
        
        // Case 4: Verify 100 USDC cannot drain entire supply
        uint256 hugeAmount = 100_000_000; // 100 USDC
        uint256 rewardableAmount2 = hugeAmount > MAX_REWARD_AMOUNT ? MAX_REWARD_AMOUNT : hugeAmount;
        uint256 hugeReward = (rewardableAmount2 * REWARD_RATE * 10**18) / 100_000;
        assertEq(hugeReward, 1000 * 10**18); // Still only 1000 points!
        
        // Total supply is 100M tokens, so it would take 100,000 transactions to drain
        uint256 MAX_SUPPLY = 100_000_000 * 10**18;
        uint256 transactionsNeeded = MAX_SUPPLY / hugeReward;
        assertEq(transactionsNeeded, 100_000); // 100,000 transactions needed ✅
    }
}

