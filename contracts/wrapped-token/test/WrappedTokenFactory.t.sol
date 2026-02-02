// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {WrappedTokenFactory} from "../src/WrappedTokenFactory.sol";
import {WrappedToken} from "../src/WrappedToken.sol";
import {MockUSDC} from "./mocks/MockUSDC.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title MockToken
 * @notice A simple ERC20 token for testing
 */
contract MockToken is ERC20 {
    uint8 private _decimals;
    
    constructor(string memory name, string memory symbol, uint8 decimals_) ERC20(name, symbol) {
        _decimals = decimals_;
    }
    
    function decimals() public view override returns (uint8) {
        return _decimals;
    }
    
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

/**
 * @title WrappedTokenFactoryTest
 * @notice Tests for WrappedTokenFactory
 */
contract WrappedTokenFactoryTest is Test {
    WrappedTokenFactory public factory;
    MockUSDC public usdc;
    MockToken public dai;
    MockToken public weth;
    
    function setUp() public {
        factory = new WrappedTokenFactory();
        usdc = new MockUSDC();
        dai = new MockToken("Dai Stablecoin", "DAI", 18);
        weth = new MockToken("Wrapped Ether", "WETH", 18);
    }
    
    function test_CreateWrappedToken() public {
        address wrappedUSDC = factory.createWrappedToken(
            address(usdc),
            "Wrapped USDC",
            "WUSDC"
        );
        
        assertTrue(wrappedUSDC != address(0), "Wrapped token should be created");
        assertEq(factory.wrappedTokens(address(usdc)), wrappedUSDC, "Mapping should be set");
        assertEq(factory.wrappedTokenCount(), 1, "Count should be 1");
        
        WrappedToken wToken = WrappedToken(wrappedUSDC);
        assertEq(wToken.underlying(), address(usdc), "Underlying should match");
        assertEq(wToken.name(), "Wrapped USDC", "Name should match");
        assertEq(wToken.symbol(), "WUSDC", "Symbol should match");
    }
    
    function test_CreateMultipleWrappedTokens() public {
        address wrappedUSDC = factory.createWrappedToken(
            address(usdc),
            "Wrapped USDC",
            "WUSDC"
        );
        
        address wrappedDAI = factory.createWrappedToken(
            address(dai),
            "Wrapped DAI",
            "WDAI"
        );
        
        address wrappedWETH = factory.createWrappedToken(
            address(weth),
            "Wrapped WETH",
            "WWETH"
        );
        
        assertEq(factory.wrappedTokenCount(), 3, "Should have 3 wrapped tokens");
        assertEq(factory.wrappedTokens(address(usdc)), wrappedUSDC, "USDC mapping");
        assertEq(factory.wrappedTokens(address(dai)), wrappedDAI, "DAI mapping");
        assertEq(factory.wrappedTokens(address(weth)), wrappedWETH, "WETH mapping");
    }
    
    function test_CannotCreateDuplicate() public {
        factory.createWrappedToken(address(usdc), "Wrapped USDC", "WUSDC");
        
        vm.expectRevert(
            abi.encodeWithSelector(
                WrappedTokenFactory.TokenAlreadyWrapped.selector,
                address(usdc),
                factory.wrappedTokens(address(usdc))
            )
        );
        factory.createWrappedToken(address(usdc), "Wrapped USDC 2", "WUSDC2");
    }
    
    function test_GetWrappedToken() public {
        address wrappedUSDC = factory.createWrappedToken(
            address(usdc),
            "Wrapped USDC",
            "WUSDC"
        );
        
        assertEq(factory.getWrappedToken(address(usdc)), wrappedUSDC, "Should return wrapped token");
        assertEq(factory.getWrappedToken(address(dai)), address(0), "Should return zero for non-existent");
    }
    
    function test_GetAllWrappedTokens() public {
        address wrappedUSDC = factory.createWrappedToken(
            address(usdc),
            "Wrapped USDC",
            "WUSDC"
        );
        
        address wrappedDAI = factory.createWrappedToken(
            address(dai),
            "Wrapped DAI",
            "WDAI"
        );
        
        address[] memory all = factory.getAllWrappedTokens();
        assertEq(all.length, 2, "Should have 2 tokens");
        assertEq(all[0], wrappedUSDC, "First should be USDC");
        assertEq(all[1], wrappedDAI, "Second should be DAI");
    }
    
    function test_CannotCreateWithZeroAddress() public {
        vm.expectRevert(WrappedTokenFactory.InvalidTokenAddress.selector);
        factory.createWrappedToken(address(0), "Wrapped Token", "WTKN");
    }
    
    function test_WrapAnyToken() public {
        // Create wrapped token for USDC
        address wrappedUSDC = factory.createWrappedToken(
            address(usdc),
            "Wrapped USDC",
            "WUSDC"
        );
        WrappedToken wUSDC = WrappedToken(wrappedUSDC);
        
        // Create wrapped token for DAI
        address wrappedDAI = factory.createWrappedToken(
            address(dai),
            "Wrapped DAI",
            "WDAI"
        );
        WrappedToken wDAI = WrappedToken(wrappedDAI);
        
        // Test wrapping USDC
        address user = makeAddr("user");
        usdc.mint(user, 1000 * 10**6);
        vm.startPrank(user);
        usdc.approve(wrappedUSDC, 1000 * 10**6);
        wUSDC.wrap(1000 * 10**6);
        assertEq(wUSDC.balanceOf(user), 1000 * 10**6, "User should have wrapped USDC");
        vm.stopPrank();
        
        // Test wrapping DAI
        dai.mint(user, 1000 * 10**18);
        vm.startPrank(user);
        dai.approve(wrappedDAI, 1000 * 10**18);
        wDAI.wrap(1000 * 10**18);
        assertEq(wDAI.balanceOf(user), 1000 * 10**18, "User should have wrapped DAI");
        vm.stopPrank();
    }
}

