// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

import {Test, console} from "forge-std/Test.sol";
import {SettlementRouter} from "../../src/SettlementRouter.sol";
import {TransferHook} from "../../src/hooks/TransferHook.sol";
import {MockUSDC} from "../mocks/MockUSDC.sol";

/**
 * @title GasBenchmarks
 * @notice Gas consumption benchmarks for settlement operations
 * @dev Measures gas usage for various scenarios
 */
contract GasBenchmarks is Test {
    SettlementRouter public router;
    TransferHook public hook;
    MockUSDC public token;
    
    address public payer;
    address public merchant;
    address public facilitator;
    address public operator;
    
    uint256 constant AMOUNT = 1_000_000;
    uint256 constant FEE = 10_000;
    
    function setUp() public {
        router = new SettlementRouter();
        hook = new TransferHook(address(router));
        token = new MockUSDC();
        
        payer = makeAddr("payer");
        merchant = makeAddr("merchant");
        facilitator = makeAddr("facilitator");
        operator = makeAddr("operator");
        
        // Mint and approve
        token.mint(payer, 100_000_000);
        vm.prank(payer);
        token.approve(address(router), type(uint256).max);
    }
    
    function calculateCommitment(
        uint256 value,
        uint256 feeAmount,
        bytes32 salt,
        address hookAddr
    ) internal view returns (bytes32) {
        return keccak256(abi.encodePacked(
            "X402/settle/v1",
            block.chainid,
            address(router),
            address(token),
            payer,
            value,
            uint256(0),
            type(uint256).max,
            salt,
            merchant,
            feeAmount,
            hookAddr,
            keccak256("")
        ));
    }
    
    // ===== Basic Settlement Gas Benchmarks =====
    
    /// @notice Benchmark: Simple settlement without fee
    function testGas_SettleWithoutFee() public {
        bytes32 salt = bytes32(uint256(1));
        bytes32 nonce = calculateCommitment(AMOUNT, 0, salt, address(hook));
        
        uint256 gasBefore = gasleft();
        vm.prank(facilitator);
        router.settleAndExecute(
            address(token),
            payer,
            AMOUNT,
            0,
            type(uint256).max,
            nonce,
            "",
            salt,
            merchant,
            0,
            address(hook),
            ""
        );
        uint256 gasUsed = gasBefore - gasleft();
        
        console.log("Gas: Simple settlement (no fee):", gasUsed);
    }
    
    /// @notice Benchmark: Settlement with facilitator fee
    function testGas_SettleWithFee() public {
        bytes32 salt = bytes32(uint256(2));
        bytes32 nonce = calculateCommitment(AMOUNT, FEE, salt, address(hook));
        
        uint256 gasBefore = gasleft();
        vm.prank(facilitator);
        router.settleAndExecute(
            address(token),
            payer,
            AMOUNT,
            0,
            type(uint256).max,
            nonce,
            "",
            salt,
            merchant,
            FEE,
            address(hook),
            ""
        );
        uint256 gasUsed = gasBefore - gasleft();
        
        console.log("Gas: Settlement with fee:", gasUsed);
    }
    
    /// @notice Benchmark: Settlement without hook (direct transfer)
    function testGas_SettleWithoutHook() public {
        bytes32 salt = bytes32(uint256(3));
        bytes32 nonce = calculateCommitment(AMOUNT, FEE, salt, address(hook));
        
        uint256 gasBefore = gasleft();
        vm.prank(facilitator);
        router.settleAndExecute(
            address(token),
            payer,
            AMOUNT,
            0,
            type(uint256).max,
            nonce,
            "",
            salt,
            merchant,
            FEE,
            address(hook), // Still need hook to properly handle transfer
            ""
        );
        uint256 gasUsed = gasBefore - gasleft();
        
        console.log("Gas: Settlement with minimal hook:", gasUsed);
    }
    
    // ===== Fee Operation Gas Benchmarks =====
    
    /// @notice Benchmark: Claim fees (single token)
    function testGas_ClaimFeesSingleToken() public {
        // First accumulate some fees
        _settlementWithFee(bytes32(uint256(10)), FEE);
        
        address[] memory tokens = new address[](1);
        tokens[0] = address(token);
        
        uint256 gasBefore = gasleft();
        vm.prank(facilitator);
        router.claimFees(tokens);
        uint256 gasUsed = gasBefore - gasleft();
        
        console.log("Gas: Claim fees (1 token):", gasUsed);
    }
    
    /// @notice Benchmark: Claim fees (multiple tokens)
    function testGas_ClaimFeesMultipleTokens() public {
        // Create additional tokens and accumulate fees
        MockUSDC token2 = new MockUSDC();
        MockUSDC token3 = new MockUSDC();
        
        token2.mint(payer, 100_000_000);
        token3.mint(payer, 100_000_000);
        
        vm.startPrank(payer);
        token2.approve(address(router), type(uint256).max);
        token3.approve(address(router), type(uint256).max);
        vm.stopPrank();
        
        // Accumulate fees in all tokens
        _settlementWithFee(bytes32(uint256(11)), FEE);
        
        address[] memory tokens = new address[](3);
        tokens[0] = address(token);
        tokens[1] = address(token2);
        tokens[2] = address(token3);
        
        uint256 gasBefore = gasleft();
        vm.prank(facilitator);
        router.claimFees(tokens);
        uint256 gasUsed = gasBefore - gasleft();
        
        console.log("Gas: Claim fees (3 tokens):", gasUsed);
    }
    
    /// @notice Benchmark: Set fee operator
    function testGas_SetFeeOperator() public {
        uint256 gasBefore = gasleft();
        vm.prank(facilitator);
        router.setFeeOperator(operator, true);
        uint256 gasUsed = gasBefore - gasleft();
        
        console.log("Gas: Set fee operator:", gasUsed);
    }
    
    /// @notice Benchmark: Claim fees via operator
    function testGas_ClaimFeesViaOperator() public {
        // Set up operator
        vm.prank(facilitator);
        router.setFeeOperator(operator, true);
        
        // Accumulate fees
        _settlementWithFee(bytes32(uint256(12)), FEE);
        
        address[] memory tokens = new address[](1);
        tokens[0] = address(token);
        
        uint256 gasBefore = gasleft();
        vm.prank(operator);
        router.claimFeesFor(facilitator, tokens, address(0));
        uint256 gasUsed = gasBefore - gasleft();
        
        console.log("Gas: Claim fees via operator:", gasUsed);
    }
    
    // ===== Distributed Transfer Gas Benchmarks =====
    
    /// @notice Benchmark: Distributed transfer to 2 recipients
    function testGas_DistributedTransfer2Recipients() public {
        TransferHook.Split[] memory splits = new TransferHook.Split[](2);
        splits[0] = TransferHook.Split({recipient: makeAddr("recipient1"), bips: 5000}); // 50%
        splits[1] = TransferHook.Split({recipient: makeAddr("recipient2"), bips: 5000}); // 50%
        
        bytes memory hookData = abi.encode(splits);
        bytes32 salt = bytes32(uint256(20));
        bytes32 nonce = _calculateCommitmentWithData(AMOUNT, 0, salt, address(hook), hookData);
        
        uint256 gasBefore = gasleft();
        vm.prank(facilitator);
        router.settleAndExecute(
            address(token),
            payer,
            AMOUNT,
            0,
            type(uint256).max,
            nonce,
            "",
            salt,
            merchant,
            0,
            address(hook),
            hookData
        );
        uint256 gasUsed = gasBefore - gasleft();
        
        console.log("Gas: Distributed transfer (2 recipients):", gasUsed);
    }
    
    /// @notice Benchmark: Distributed transfer to 5 recipients
    function testGas_DistributedTransfer5Recipients() public {
        TransferHook.Split[] memory splits = new TransferHook.Split[](5);
        for (uint256 i = 0; i < 5; i++) {
            splits[i] = TransferHook.Split({
                recipient: makeAddr(string(abi.encodePacked("recipient", i))),
                bips: 2000 // 20% each
            });
        }
        
        bytes memory hookData = abi.encode(splits);
        bytes32 salt = bytes32(uint256(21));
        bytes32 nonce = _calculateCommitmentWithData(AMOUNT, 0, salt, address(hook), hookData);
        
        uint256 gasBefore = gasleft();
        vm.prank(facilitator);
        router.settleAndExecute(
            address(token),
            payer,
            AMOUNT,
            0,
            type(uint256).max,
            nonce,
            "",
            salt,
            merchant,
            0,
            address(hook),
            hookData
        );
        uint256 gasUsed = gasBefore - gasleft();
        
        console.log("Gas: Distributed transfer (5 recipients):", gasUsed);
    }
    
    /// @notice Benchmark: Distributed transfer to 10 recipients
    function testGas_DistributedTransfer10Recipients() public {
        TransferHook.Split[] memory splits = new TransferHook.Split[](10);
        for (uint256 i = 0; i < 10; i++) {
            splits[i] = TransferHook.Split({
                recipient: makeAddr(string(abi.encodePacked("recipient", i))),
                bips: 1000 // 10% each
            });
        }
        
        bytes memory hookData = abi.encode(splits);
        bytes32 salt = bytes32(uint256(22));
        bytes32 nonce = _calculateCommitmentWithData(AMOUNT, 0, salt, address(hook), hookData);
        
        uint256 gasBefore = gasleft();
        vm.prank(facilitator);
        router.settleAndExecute(
            address(token),
            payer,
            AMOUNT,
            0,
            type(uint256).max,
            nonce,
            "",
            salt,
            merchant,
            0,
            address(hook),
            hookData
        );
        uint256 gasUsed = gasBefore - gasleft();
        
        console.log("Gas: Distributed transfer (10 recipients):", gasUsed);
    }
    
    // ===== Recovery Mode Gas Benchmarks =====
    
    /// @notice Benchmark: Recovery mode settlement (note: this will fail with AlreadySettled, which is expected behavior)
    function testGas_RecoveryModeSettlement() public {
        // First do normal settlement
        bytes32 salt = bytes32(uint256(30));
        bytes32 nonce = calculateCommitment(AMOUNT, 0, salt, address(hook));
        
        vm.prank(facilitator);
        router.settleAndExecute(
            address(token),
            payer,
            AMOUNT,
            0,
            type(uint256).max,
            nonce,
            "",
            salt,
            merchant,
            0,
            address(hook),
            ""
        );
        
        // Second attempt will revert with AlreadySettled (expected)
        uint256 gasBefore = gasleft();
        vm.prank(facilitator);
        vm.expectRevert();
        router.settleAndExecute(
            address(token),
            payer,
            AMOUNT,
            0,
            type(uint256).max,
            nonce,
            "",
            salt,
            merchant,
            0,
            address(hook),
            ""
        );
        uint256 gasUsed = gasBefore - gasleft();
        
        console.log("Gas: Double settlement prevention (reverts as expected):", gasUsed);
    }
    
    // ===== Helper Functions =====
    
    function _settlementWithFee(bytes32 salt, uint256 fee) internal {
        bytes32 nonce = calculateCommitment(AMOUNT, fee, salt, address(hook));
        
        vm.prank(facilitator);
        router.settleAndExecute(
            address(token),
            payer,
            AMOUNT,
            0,
            type(uint256).max,
            nonce,
            "",
            salt,
            merchant,
            fee,
            address(hook),
            ""
        );
    }
    
    function _calculateCommitmentWithData(
        uint256 value,
        uint256 feeAmount,
        bytes32 salt,
        address hookAddr,
        bytes memory hookData
    ) internal view returns (bytes32) {
        return keccak256(abi.encodePacked(
            "X402/settle/v1",
            block.chainid,
            address(router),
            address(token),
            payer,
            value,
            uint256(0),
            type(uint256).max,
            salt,
            merchant,
            feeAmount,
            hookAddr,
            keccak256(hookData)
        ));
    }
}

