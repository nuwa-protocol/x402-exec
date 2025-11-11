// Centralized snippets for demo/code examples used across the site
export type NodeKey =
	| "hook-shared"
	| "hook-split"
	| "hook-mint"
	| "hook-rewards";

export type Snippet = {
	title: string;
	lang: "solidity";
	explain: string;
	code: string;
};

// Centralized snippets so App and other components can reuse them
export const SNIPPETS: Record<NodeKey, Snippet> = {
	"hook-shared": {
		title: "settlement-router.sol",
		lang: "solidity",
		explain:
			"Router approves funds then calls your Hook.execute. See @contracts/examples for full code.",
		code: `function settleAndExecute(
  address token, address from, uint256 value, bytes32 nonce, bytes calldata sig,
  bytes32 salt, address payTo, uint256 fee, address hook, bytes calldata data
) external {
  IERC3009(token).transferWithAuthorization(
    from, address(this), value, 0, type(uint256).max, nonce, sig
  );

  uint256 amt = value - fee;

  if (hook != address(0)) {
    IERC20(token).forceApprove(hook, amt);

    ISettlementHook(hook).execute(
      keccak256(abi.encodePacked(from, token, nonce)),
      from, token, amt, salt, payTo, msg.sender, data
    );
  }
}`,
	},
	"hook-split": {
		title: "payment-split-hook.sol",
		lang: "solidity",
		explain: "Only the execute part. See @contracts/examples for full code.",
		code: `function execute(
  bytes32, address, address token, uint256 amount, bytes32, address, address, bytes calldata data
) external returns (bytes memory) {
  Split[] memory s = abi.decode(data, (Split[]));

  uint256 total;
  for (uint i; i < s.length; i++) {
    require(s[i].recipient != address(0), "RECIPIENT");
    total += s[i].bips;
  }
  require(total == 10000, "BPS");

  uint256 remain = amount;
  for (uint i; i < s.length; i++) {
    uint256 part = i == s.length - 1 ? remain : (amount * s[i].bips) / 10000;
    if (i != s.length - 1) remain -= part;
    IERC20(token).transferFrom(settlementRouter, s[i].recipient, part);
  }
  return abi.encode(s.length);
}`,
	},
	"hook-mint": {
		title: "pay-to-mint-hook.sol",
		lang: "solidity",
		explain: "Only the execute part. See @contracts/examples for full code.",
		code: `function execute(
  bytes32, address, address token, uint256 amount, bytes32, address, address, bytes calldata data
) external returns (bytes memory) {
  MintConfig memory c = abi.decode(data, (MintConfig));

  require(
    c.nftContract != address(0) && c.recipient != address(0) && c.merchant != address(0),
    "ADDR"
  );

  (bool ok,) = c.nftContract.call(
    abi.encodeWithSignature("mint(address,uint256)", c.recipient, c.tokenId)
  );
  require(ok, "MINT");

  IERC20(token).transferFrom(settlementRouter, c.merchant, amount);
  return abi.encode(c.tokenId);
}`,
	},
	"hook-rewards": {
		title: "pay-to-reward-hook.sol",
		lang: "solidity",
		explain: "Only the execute part. See @contracts/examples for full code.",
		code: `function execute(
  bytes32, address payer, address token, uint256 amount, bytes32, address, address, bytes calldata data
) external returns (bytes memory) {
  RewardConfig memory c = abi.decode(data, (RewardConfig));

  require(c.rewardToken != address(0) && c.merchant != address(0), "ADDR");

  IERC20(token).transferFrom(settlementRouter, c.merchant, amount);

  uint256 points = (amount * REWARD_RATE * 1e18) / 100000;
  IRewardToken(c.rewardToken).distribute(payer, points);

  return abi.encode(points);
}`,
	},
};
