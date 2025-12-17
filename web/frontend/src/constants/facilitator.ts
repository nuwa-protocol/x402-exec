import { getNetworkConfig, getSupportedNetworks } from "@x402x/core";

export const FACILITATOR_HOSTED_URL = "https://facilitator.x402x.dev/" as const;
const ISSUE_DEFAULT_TITLE =
	"[Request] Add new facilitator network - NETWORK NAME/ASSET NAME";
const ISSUE_DEFAULT_BODY = `## Summary

- Network name:
- Chain ID:
- Payment tokens (symbol + address):
`;

const issueParams = new URLSearchParams({
	title: ISSUE_DEFAULT_TITLE,
	body: ISSUE_DEFAULT_BODY,
});

export const GH_ROOT =
	"https://github.com/nuwa-protocol/x402-exec/tree/main/" as const;

export const ISSUE_SUBMIT_URL = `https://github.com/nuwa-protocol/x402-exec/issues/new?${issueParams.toString()}`;

export type ApiEndpoint = {
	id: string;
	method: "GET" | "POST";
	path: string;
	title: string;
	summary: string;
	baseUrl?: string;
	request?: string;
	response?: string;
};

export const API_ENDPOINTS: ApiEndpoint[] = [
	{
		id: "supported",
		method: "GET",
		path: "/supported",
		title: "Supported payment kinds",
		summary:
			"Returns all scheme/network pairs the facilitator can currently settle.",
		baseUrl: FACILITATOR_HOSTED_URL,
		request: `curl -s ${FACILITATOR_HOSTED_URL}supported`,
		response: `{"kinds":[{"x402Version":1,"scheme":"exact","network":"base-sepolia"},{"x402Version":1,"scheme":"exact","network":"x-layer-testnet"},{"x402Version":1,"scheme":"exact","network":"base"},{"x402Version":1,"scheme":"exact","network":"x-layer"}]}`,
	},
	{
		id: "verify-get",
		method: "GET",
		path: "/verify",
		title: "Verify endpoint metadata",
		summary: "Inspects the POST /verify contract (body schema, description).",
		baseUrl: FACILITATOR_HOSTED_URL,
		request: `curl -s ${FACILITATOR_HOSTED_URL}verify`,
		response: `{
  "endpoint": "/verify",
  "description": "POST to verify x402 payments",
  "body": {
    "paymentPayload": "PaymentPayload",
    "paymentRequirements": "PaymentRequirements"
  }
}`,
	},
	{
		id: "verify-post",
		method: "POST",
		path: "/verify",
		title: "Verify a payment",
		summary:
			"Submits a PaymentPayload + PaymentRequirements atomically for validation.",
		baseUrl: FACILITATOR_HOSTED_URL,
		request: `curl -s -X POST ${FACILITATOR_HOSTED_URL}verify \\
  -H 'Content-Type: application/json' \\
  -d '{
    "paymentPayload": {
      "x402Version": 1,
      "scheme": "exact",
      "network": "base-sepolia",
      "payload": {
        "signature": "0x3fe0e2092920d11b74fb54f5453e2443cfd25596f08828cd444cea0d11f15b267b5ffac38f267cdfe728473f8655ad76795bb9e8b69109e779bccfa7c75cc6f8e2",
        "authorization": {
          "from": "0xdD2FD4581271e230360230F9337D5c0430Bf44C0",
          "to": "0x817e4f0ee2fbdaac426f1178e149f7dc98873ecb",
          "value": "112000",
          "validAfter": "0",
          "validBefore": "1736553600",
          "nonce": "0x02d182e3075df891b9f3c0a06a60ca54c84c0d791bee20cb0750adb751260c74"
        }
      }
    },
    "paymentRequirements": {
      "scheme": "exact",
      "network": "base-sepolia",
      "asset": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
      "maxAmountRequired": "112000",
      "payTo": "0x817e4f0ee2fbdaac426f1178e149f7dc98873ecb",
      "resource": "https://merchant.example/api/transfer-with-hook/payment",
      "description": "Transfer with Hook demo purchase",
      "mimeType": "application/json",
      "maxTimeoutSeconds": 3600,
      "extra": {
        "name": "USDC",
        "version": "2",
        "settlementRouter": "0x817e4f0ee2fbdaac426f1178e149f7dc98873ecb",
        "salt": "0x4adc32ff975582075c44027c498ae7b4f57e14f60d3df6d6fd35ac59bfc51bc5",
        "payTo": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
        "facilitatorFee": "12000",
        "hook": "0x6b486aF5A08D27153d0374BE56A1cB1676c460a8",
        "hookData": "0x"
      }
    }
  }'`,
		response: `{
  "isValid": true,
  "payer": "0xdD2FD4581271e230360230F9337D5c0430Bf44C0"
}`,
	},
	{
		id: "settle-get",
		method: "GET",
		path: "/settle",
		title: "Settle endpoint metadata",
		summary: "Explains POST /settle modes plus expected payload shape.",
		baseUrl: FACILITATOR_HOSTED_URL,
		request: `curl -s ${FACILITATOR_HOSTED_URL}settle`,
		response: `{
  "endpoint": "/settle",
  "description": "POST to settle x402 payments",
  "supportedModes": ["standard", "settlementRouter"],
  "body": {
    "paymentPayload": "PaymentPayload",
    "paymentRequirements": "PaymentRequirements (with optional extra.settlementRouter)"
  }
}`,
	},
	{
		id: "settle-post",
		method: "POST",
		path: "/settle",
		title: "Settle a payment",
		summary:
			"Executes payment settlement and surfaces tx metadata when successful.",
		baseUrl: FACILITATOR_HOSTED_URL,
		request: `curl -s -X POST ${FACILITATOR_HOSTED_URL}settle \\
  -H 'Content-Type: application/json' \\
  -d '{
    "paymentPayload": {
      "x402Version": 1,
      "scheme": "exact",
      "network": "base-sepolia",
      "payload": {
        "signature": "0x3fe0e2092920d11b74fb54f5453e2443cfd25596f08828cd444cea0d11f15b267b5ffac38f267cdfe728473f8655ad76795bb9e8b69109e779bccfa7c75cc6f8e2",
        "authorization": {
          "from": "0xdD2FD4581271e230360230F9337D5c0430Bf44C0",
          "to": "0x817e4f0ee2fbdaac426f1178e149f7dc98873ecb",
          "value": "112000",
          "validAfter": "0",
          "validBefore": "1736553600",
          "nonce": "0x02d182e3075df891b9f3c0a06a60ca54c84c0d791bee20cb0750adb751260c74"
        }
      }
    },
    "paymentRequirements": {
      "scheme": "exact",
      "network": "base-sepolia",
      "asset": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
      "maxAmountRequired": "112000",
      "payTo": "0x817e4f0ee2fbdaac426f1178e149f7dc98873ecb",
      "resource": "https://merchant.example/api/transfer-with-hook/payment",
      "description": "Transfer with Hook demo purchase",
      "mimeType": "application/json",
      "maxTimeoutSeconds": 3600,
      "extra": {
        "name": "USDC",
        "version": "2",
        "settlementRouter": "0x817e4f0ee2fbdaac426f1178e149f7dc98873ecb",
        "salt": "0x4adc32ff975582075c44027c498ae7b4f57e14f60d3df6d6fd35ac59bfc51bc5",
        "payTo": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
        "facilitatorFee": "12000",
        "hook": "0x6b486aF5A08D27153d0374BE56A1cB1676c460a8",
        "hookData": "0x"
      }
    }
  }'`,
		response: `{
  "success": true,
  "transaction": "0xade93c73d5cd9f82c3baf8b4f2245d152341a84f984f6d0332ba6983fc7fb9a3",
  "network": "base-sepolia",
  "payer": "0xdD2FD4581271e230360230F9337D5c0430Bf44C0"
}`,
	},
];

export type PaymentToken = {
	symbol: string;
	label: string;
	address: string;
	explorerUrl?: string;
};

export type SupportedNetwork = {
  name: string;
  network: string;
  chainId: number;
  status: "Mainnet" | "Testnet";
  settlementRouter: string;
  explorerUrl: string;
  // Optional base URL to view transactions for this network (e.g., https://basescan.org/tx/)
  txExplorerBaseUrl?: string;
  paymentTokens: PaymentToken[];
};

// Build supported payment tokens from the SDK's per-network config.
// Each network supports its configured default asset.
export const SUPPORTED_PAYMENT_TOKENS: Record<string, PaymentToken[]> = (() => {
  const result: Record<string, PaymentToken[]> = {};
  for (const n of getSupportedNetworks()) {
    const cfg = getNetworkConfig(n);
    const addressBase = cfg.addressExplorerBaseUrl;
    const defaultAsset = cfg.defaultAsset;
    const tokenName = defaultAsset.eip712.name;

		result[n] = [
			{
        //TODO config symbol from network config
				symbol: "USDC",
				label: tokenName,
				address: defaultAsset.address,
				explorerUrl: addressBase ? `${addressBase}${defaultAsset.address}` : undefined,
			},
		];
	}
	return result;
})();

// Build supported networks list from SDK + meta config
export const SUPPORTED_NETWORKS: SupportedNetwork[] = (() => {
  const list: SupportedNetwork[] = [];
  for (const n of getSupportedNetworks()) {
    const cfg = getNetworkConfig(n);
    list.push({
      name: cfg.name ?? n,
      network: n,
      chainId: cfg.chainId,
      status: cfg.type === "mainnet" ? "Mainnet" : "Testnet",
      settlementRouter: cfg.settlementRouter,
      explorerUrl: cfg.addressExplorerBaseUrl
        ? `${cfg.addressExplorerBaseUrl}${cfg.settlementRouter}`
        : "",
      txExplorerBaseUrl: cfg.txExplorerBaseUrl,
      paymentTokens: SUPPORTED_PAYMENT_TOKENS[n] ?? [],
    });
  }
  return list;
})();
