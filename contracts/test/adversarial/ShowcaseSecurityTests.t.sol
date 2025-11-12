// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

import {Test, console} from "forge-std/Test.sol";
import {NFTMintHook} from "../../examples/nft-mint/NFTMintHook.sol";
import {RandomNFT} from "../../examples/nft-mint/RandomNFT.sol";
import {RewardHook} from "../../examples/reward-points/RewardHook.sol";
import {RewardToken} from "../../examples/reward-points/RewardToken.sol";
import {SettlementRouter} from "../../src/SettlementRouter.sol";
import {MockUSDC} from "../mocks/MockUSDC.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";

/**
 * @title ShowcaseSecurityTests
 * @notice Security tests for showcase hooks: reentrancy, malicious contracts, edge cases
 */
contract ShowcaseSecurityTests is Test {
    SettlementRouter public router;
    NFTMintHook public nftMintHook;
    RewardHook public rewardHook;
    MockUSDC public usdc;
    RandomNFT public nft;
    RewardToken public rewardToken;
    
    address public payer = address(0x1);
    address public merchant = address(0x2);
    address public facilitator = address(0x3);
    
    uint256 constant AMOUNT = 1_000_000; // 1 USDC
    uint256 constant FEE = 10_000; // 0.01 USDC
    
    function setUp() public {
        // Deploy core contracts
        router = new SettlementRouter();
        usdc = new MockUSDC();
        
        // Deploy hooks
        nftMintHook = new NFTMintHook(address(router));
        rewardHook = new RewardHook(address(router));
        
        // Deploy supporting contracts
        nft = new RandomNFT(address(nftMintHook));
        rewardToken = new RewardToken(address(rewardHook));
        
        // Setup payer
        usdc.mint(payer, 100 * AMOUNT);
        vm.prank(payer);
        usdc.approve(address(router), type(uint256).max);
    }
    
    // ===== Helper Functions =====
    
    /**
     * @notice Helper to execute settlement with proper commitment calculation
     */
    function executeSettlement(
        address token,
        address from,
        uint256 value,
        bytes32 salt,
        address payTo,
        uint256 facilitatorFee,
        address hook,
        bytes memory hookData
    ) internal {
        // Calculate commitment (becomes the nonce)
        bytes32 nonce = router.calculateCommitment(
            token,
            from,
            value,
            0,              // validAfter
            type(uint256).max, // validBefore
            salt,
            payTo,
            facilitatorFee,
            hook,
            hookData
        );
        
        // Execute settlement
        router.settleAndExecute(
            token,
            from,
            value,
            0,              // validAfter
            type(uint256).max, // validBefore
            nonce,
            new bytes(0),   // signature
            salt,
            payTo,
            facilitatorFee,
            hook,
            hookData
        );
    }
    
    // ===== Malicious NFT Contract Tests =====
    
    /**
     * @notice Test that NFTMintHook is protected against reentrancy via malicious NFT
     */
    function testMaliciousNFTReentrancy() public {
        MaliciousNFT maliciousNFT = new MaliciousNFT(address(router), address(usdc), merchant);
        
        // Encode hook data with malicious NFT
        NFTMintHook.MintConfig memory config = NFTMintHook.MintConfig({
            nftContract: address(maliciousNFT)
        });
        bytes memory hookData = abi.encode(config);
        
        bytes32 salt = keccak256("test-salt");
        
        // Mint USDC to router (simulating direct transfer attack recovery)
        usdc.mint(address(router), AMOUNT);
        
        // Calculate commitment (becomes the nonce)
        bytes32 nonce = router.calculateCommitment(
            address(usdc),
            payer,
            AMOUNT,
            0,
            type(uint256).max,
            salt,
            merchant,
            FEE,
            address(nftMintHook),
            hookData
        );
        
        vm.prank(facilitator);
        // The malicious NFT will try to reenter, but funds are already secured
        router.settleAndExecute(
            address(usdc),
            payer,
            AMOUNT,
            0,
            type(uint256).max,
            nonce,
            new bytes(0), // signature
            salt,
            merchant,
            FEE,
            address(nftMintHook),
            hookData
        );
        
        // Verify merchant received payment despite reentrancy attempt
        assertEq(usdc.balanceOf(merchant), AMOUNT - FEE);
    }
    
    /**
     * @notice Test that NFTMintHook properly handles mint failures
     */
    function testMaliciousNFTMintFailure() public {
        FailingNFT failingNFT = new FailingNFT();
        
        NFTMintHook.MintConfig memory config = NFTMintHook.MintConfig({
            nftContract: address(failingNFT)
        });
        bytes memory hookData = abi.encode(config);
        
        bytes32 salt = keccak256("test-salt-2");
        
        usdc.mint(address(router), AMOUNT);
        
        // Calculate commitment (becomes the nonce)
        bytes32 nonce = router.calculateCommitment(
            address(usdc),
            payer,
            AMOUNT,
            0,
            type(uint256).max,
            salt,
            merchant,
            FEE,
            address(nftMintHook),
            hookData
        );
        
        vm.prank(facilitator);
        // Should revert with HookExecutionFailed wrapping Error(string) "Mint not allowed"
        vm.expectRevert(
            abi.encodeWithSelector(
                SettlementRouter.HookExecutionFailed.selector,
                address(nftMintHook),
                abi.encodeWithSignature("Error(string)", "Mint not allowed")
            )
        );
        router.settleAndExecute(
            address(usdc),
            payer,
            AMOUNT,
            0,
            type(uint256).max,
            nonce,
            new bytes(0), // signature
            salt,
            merchant,
            FEE,
            address(nftMintHook),
            hookData
        );
    }
    
    // ===== Malicious Reward Token Tests =====
    
    /**
     * @notice Test that RewardHook handles reward distribution failures properly
     */
    function testMaliciousRewardTokenDistributeFails() public {
        FailingRewardToken failingToken = new FailingRewardToken();
        
        RewardHook.RewardConfig memory config = RewardHook.RewardConfig({
            rewardToken: address(failingToken)
        });
        bytes memory hookData = abi.encode(config);
        
        bytes32 salt = keccak256("test-salt-3");
        
        usdc.mint(address(router), AMOUNT);
        
        // Calculate commitment (becomes the nonce)
        bytes32 nonce = router.calculateCommitment(
            address(usdc),
            payer,
            AMOUNT,
            0,
            type(uint256).max,
            salt,
            merchant,
            FEE,
            address(rewardHook),
            hookData
        );
        
        vm.prank(facilitator);
        // Should revert with HookExecutionFailed wrapping RewardDistributionFailed
        vm.expectRevert(
            abi.encodeWithSelector(
                SettlementRouter.HookExecutionFailed.selector,
                address(rewardHook),
                abi.encodeWithSelector(RewardHook.RewardDistributionFailed.selector)
            )
        );
        router.settleAndExecute(
            address(usdc),
            payer,
            AMOUNT,
            0,
            type(uint256).max,
            nonce,
            new bytes(0), // signature
            salt,
            merchant,
            FEE,
            address(rewardHook),
            hookData
        );
    }
    
    /**
     * @notice Test that RewardHook handles insufficient reward tokens
     */
    function testRewardTokenInsufficientBalance() public {
        // Create a reward token with empty balance
        RewardToken emptyToken = new RewardToken(address(rewardHook));
        
        // Get remaining rewards first
        uint256 remaining = emptyToken.remainingRewards();
        
        // Drain all tokens
        vm.prank(address(rewardHook));
        emptyToken.distribute(address(this), remaining);
        
        RewardHook.RewardConfig memory config = RewardHook.RewardConfig({
            rewardToken: address(emptyToken)
        });
        bytes memory hookData = abi.encode(config);
        
        bytes32 salt = keccak256("test-salt-4");
        
        usdc.mint(address(router), AMOUNT);
        
        // Calculate commitment (becomes the nonce)
        bytes32 nonce = router.calculateCommitment(
            address(usdc),
            payer,
            AMOUNT,
            0,
            type(uint256).max,
            salt,
            merchant,
            FEE,
            address(rewardHook),
            hookData
        );
        
        vm.prank(facilitator);
        // Should revert with HookExecutionFailed wrapping RewardDistributionFailed
        vm.expectRevert(
            abi.encodeWithSelector(
                SettlementRouter.HookExecutionFailed.selector,
                address(rewardHook),
                abi.encodeWithSelector(RewardHook.RewardDistributionFailed.selector)
            )
        );
        router.settleAndExecute(
            address(usdc),
            payer,
            AMOUNT,
            0,
            type(uint256).max,
            nonce,
            new bytes(0), // signature
            salt,
            merchant,
            FEE,
            address(rewardHook),
            hookData
        );
    }
    
    // ===== Address Validation Tests =====
    
    /**
     * @notice Test that NFTMintHook rejects zero address for NFT contract
     */
    function testNFTMintHookZeroAddressNFT() public {
        NFTMintHook.MintConfig memory config = NFTMintHook.MintConfig({
            nftContract: address(0)
        });
        bytes memory hookData = abi.encode(config);
        
        bytes32 salt = keccak256("test-salt-5");
        usdc.mint(address(router), AMOUNT);
        
        // Calculate commitment (becomes the nonce)
        bytes32 nonce = router.calculateCommitment(
            address(usdc),
            payer,
            AMOUNT,
            0,
            type(uint256).max,
            salt,
            address(0), // zero payTo
            FEE,
            address(nftMintHook),
            hookData
        );
        
        vm.prank(facilitator);
        // Should revert with HookExecutionFailed wrapping InvalidAddress
        vm.expectRevert(
            abi.encodeWithSelector(
                SettlementRouter.HookExecutionFailed.selector,
                address(nftMintHook),
                abi.encodeWithSelector(NFTMintHook.InvalidAddress.selector)
            )
        );
        router.settleAndExecute(
            address(usdc),
            payer,
            AMOUNT,
            0,
            type(uint256).max,
            nonce,
            new bytes(0), // signature
            salt,
            address(0), // zero payTo
            FEE,
            address(nftMintHook),
            hookData
        );
    }
    
    /**
     * @notice Test that RewardHook rejects zero address for reward token
     */
    function testRewardHookZeroAddressToken() public {
        RewardHook.RewardConfig memory config = RewardHook.RewardConfig({
            rewardToken: address(0)
        });
        bytes memory hookData = abi.encode(config);
        
        bytes32 salt = keccak256("test-salt-6");
        usdc.mint(address(router), AMOUNT);
        
        // Calculate commitment (becomes the nonce)
        bytes32 nonce = router.calculateCommitment(
            address(usdc),
            payer,
            AMOUNT,
            0,
            type(uint256).max,
            salt,
            merchant,
            FEE,
            address(rewardHook),
            hookData
        );
        
        vm.prank(facilitator);
        // Should revert with HookExecutionFailed wrapping InvalidAddress
        vm.expectRevert(
            abi.encodeWithSelector(
                SettlementRouter.HookExecutionFailed.selector,
                address(rewardHook),
                abi.encodeWithSelector(RewardHook.InvalidAddress.selector)
            )
        );
        router.settleAndExecute(
            address(usdc),
            payer,
            AMOUNT,
            0,
            type(uint256).max,
            nonce,
            new bytes(0), // signature
            salt,
            merchant,
            FEE,
            address(rewardHook),
            hookData
        );
    }
    
    /**
     * @notice Test that RewardHook rejects zero payTo address
     */
    function testRewardHookZeroAddressPayTo() public {
        RewardHook.RewardConfig memory config = RewardHook.RewardConfig({
            rewardToken: address(rewardToken)
        });
        bytes memory hookData = abi.encode(config);
        
        bytes32 salt = keccak256("test-salt-7");
        usdc.mint(address(router), AMOUNT);
        
        // Calculate commitment (becomes the nonce)
        bytes32 nonce = router.calculateCommitment(
            address(usdc),
            payer,
            AMOUNT,
            0,
            type(uint256).max,
            salt,
            address(0), // zero payTo
            FEE,
            address(rewardHook),
            hookData
        );
        
        vm.prank(facilitator);
        // Should revert with HookExecutionFailed wrapping InvalidAddress
        vm.expectRevert(
            abi.encodeWithSelector(
                SettlementRouter.HookExecutionFailed.selector,
                address(rewardHook),
                abi.encodeWithSelector(RewardHook.InvalidAddress.selector)
            )
        );
        router.settleAndExecute(
            address(usdc),
            payer,
            AMOUNT,
            0,
            type(uint256).max,
            nonce,
            new bytes(0), // signature
            salt,
            address(0), // zero payTo
            FEE,
            address(rewardHook),
            hookData
        );
    }
    
    // ===== Reward Calculation Tests =====
    
    /**
     * @notice Test reward calculation with very large amount
     * @dev With the cap protection, large amounts should only receive max rewards
     */
    function testRewardCalculationLargeAmount() public {
        // Test with max realistic USDC amount (< 2^96)
        uint256 largeAmount = 1_000_000_000 * 10**6; // 1 billion USDC
        
        // Mint large amount to payer and approve
        usdc.mint(payer, largeAmount);
        vm.prank(payer);
        usdc.approve(address(router), type(uint256).max);
        
        usdc.mint(address(router), largeAmount);
        
        RewardHook.RewardConfig memory config = RewardHook.RewardConfig({
            rewardToken: address(rewardToken)
        });
        bytes memory hookData = abi.encode(config);
        
        bytes32 salt = keccak256("test-salt-8");
        
        // Calculate commitment (becomes the nonce)
        bytes32 nonce = router.calculateCommitment(
            address(usdc),
            payer,
            largeAmount,
            0,
            type(uint256).max,
            salt,
            merchant,
            0,
            address(rewardHook),
            hookData
        );
        
        vm.prank(facilitator);
        router.settleAndExecute(
            address(usdc),
            payer,
            largeAmount,
            0,
            type(uint256).max,
            nonce,
            new bytes(0), // signature
            salt,
            merchant,
            0,
            address(rewardHook),
            hookData
        );
        
        // With cap protection: rewards are capped at MAX_REWARD_AMOUNT (0.1 USDC)
        // Expected: (100_000 * 1000 * 10^18) / 100_000 = 1000 * 10^18
        uint256 MAX_REWARD_AMOUNT = 100_000;
        uint256 expected = (MAX_REWARD_AMOUNT * 1000 * 10**18) / 100_000;
        assertEq(expected, 1000 * 10**18);
        
        // Verify payer received CAPPED reward tokens (not full amount)
        assertEq(rewardToken.balanceOf(payer), expected);
    }
    
    // ===== RandomNFT Max Supply Tests =====
    
    /**
     * @notice Test that RandomNFT enforces max supply
     */
    function testRandomNFTMaxSupplyEnforced() public {
        // Mint 9,999 NFTs
        vm.startPrank(address(nftMintHook));
        for (uint256 i = 0; i < 9_999; i++) {
            nft.mint(payer);
        }
        
        // 10,000th mint should succeed
        nft.mint(payer);
        assertEq(nft.totalSupply(), 10_000);
        
        // 10,001st mint should fail
        vm.expectRevert(RandomNFT.MaxSupplyReached.selector);
        nft.mint(payer);
        
        vm.stopPrank();
    }
}

// ===== Malicious Contract Implementations =====

/**
 * @notice Malicious NFT that attempts reentrancy during mint
 */
contract MaliciousNFT {
    address public router;
    address public token;
    address public merchant;
    bool public attacked;
    
    constructor(address _router, address _token, address _merchant) {
        router = _router;
        token = _token;
        merchant = _merchant;
    }
    
    function mint(address /* to */) external {
        // Try to reenter by calling another settlement
        // This should fail because funds are already secured
        if (!attacked) {
            attacked = true;
            // Attempt reentrancy (will fail due to nonce already used or other protections)
            try SettlementRouter(router).settleAndExecute(
                token,
                address(this),
                1000,
                0,
                type(uint256).max,
                keccak256("evil-salt"),
                new bytes(0), // signature
                keccak256("evil-salt"),
                merchant,
                0,
                address(this),
                ""
            ) {
                // Should not succeed
                revert("Reentrancy should have failed");
            } catch {
                // Expected to fail
            }
        }
    }
}

/**
 * @notice NFT that always fails to mint
 */
contract FailingNFT {
    function mint(address /* to */) external pure {
        revert("Mint not allowed");
    }
}

/**
 * @notice Reward token that always fails to distribute
 */
contract FailingRewardToken {
    function distribute(address /* to */, uint256 /* amount */) external pure {
        revert("Distribution not allowed");
    }
}

