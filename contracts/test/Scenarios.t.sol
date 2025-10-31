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
        nft.mint(user, 0); // tokenId is ignored
        
        assertEq(nft.ownerOf(0), user);
        assertEq(nft.totalSupply(), 1);
        assertEq(nft.remainingSupply(), 999);
    }
    
    function testNFTMintOnlyMinter() public {
        vm.prank(user);
        vm.expectRevert(RandomNFT.OnlyMinter.selector);
        nft.mint(user, 0);
    }
    
    function testNFTMaxSupply() public {
        vm.startPrank(nftMintHook);
        
        // Mint 1000 NFTs
        for (uint256 i = 0; i < 1000; i++) {
            nft.mint(user, i);
        }
        
        // Try to mint one more
        vm.expectRevert(RandomNFT.MaxSupplyReached.selector);
        nft.mint(user, 1000);
        
        vm.stopPrank();
    }
    
    // ===== RewardToken Tests =====
    
    function testRewardTokenInitialSupply() public {
        uint256 maxSupply = 1_000_000 * 10**18;
        assertEq(rewardToken.totalSupply(), maxSupply);
        assertEq(rewardToken.balanceOf(address(rewardToken)), maxSupply);
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
}

