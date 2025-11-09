// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title MaliciousRevertingToken
 * @notice Token that reverts on transfer to cause DoS
 */
contract MaliciousRevertingToken is ERC20 {
    error MaliciousTransferRevert();
    
    constructor() ERC20("MaliciousToken", "MAL") {}
    
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
    
    function transfer(address /* to */, uint256 /* amount */) public pure override returns (bool) {
        revert MaliciousTransferRevert();
    }
    
    function transferFrom(address /* from */, address /* to */, uint256 /* amount */) public pure override returns (bool) {
        revert MaliciousTransferRevert();
    }
}

/**
 * @title MaliciousFalseReturnToken
 * @notice Token that returns false on transfer instead of reverting
 */
contract MaliciousFalseReturnToken is ERC20 {
    constructor() ERC20("FalseToken", "FALSE") {}
    
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
    
    function transfer(address /* to */, uint256 /* amount */) public pure override returns (bool) {
        return false;
    }
    
    function transferFrom(address /* from */, address /* to */, uint256 /* amount */) public pure override returns (bool) {
        return false;
    }
}

/**
 * @title MaliciousReentrantToken
 * @notice Token that attempts reentrancy on transfer
 */
contract MaliciousReentrantToken is ERC20 {
    address public target;
    bytes public attackData;
    bool public attacking;
    
    constructor() ERC20("ReentrantToken", "REENT") {}
    
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
    
    function setAttack(address _target, bytes calldata _data) external {
        target = _target;
        attackData = _data;
    }
    
    function transfer(address to, uint256 amount) public override returns (bool) {
        if (!attacking && target != address(0)) {
            attacking = true;
            (bool success,) = target.call(attackData);
            attacking = false;
            require(success, "Attack failed");
        }
        return super.transfer(to, amount);
    }
    
    function transferFrom(address from, address to, uint256 amount) public override returns (bool) {
        if (!attacking && target != address(0)) {
            attacking = true;
            (bool success,) = target.call(attackData);
            attacking = false;
            require(success, "Attack failed");
        }
        return super.transferFrom(from, to, amount);
    }
}

/**
 * @title MaliciousFeeOnTransferToken
 * @notice Token that takes a fee on transfer (commonly seen in DeFi)
 */
contract MaliciousFeeOnTransferToken is ERC20 {
    uint256 public feePercent = 10; // 10% fee
    
    constructor() ERC20("FeeToken", "FEE") {}
    
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
    
    function transfer(address to, uint256 amount) public override returns (bool) {
        uint256 fee = (amount * feePercent) / 100;
        uint256 actualAmount = amount - fee;
        
        super.transfer(to, actualAmount);
        super.transfer(address(0), fee); // Burn fee
        
        return true;
    }
    
    function transferFrom(address from, address to, uint256 amount) public override returns (bool) {
        uint256 fee = (amount * feePercent) / 100;
        uint256 actualAmount = amount - fee;
        
        super.transferFrom(from, to, actualAmount);
        super.transferFrom(from, address(0), fee); // Burn fee
        
        return true;
    }
}

