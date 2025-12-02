import {
  DebugAppKitProvider,
  useDebugAppKit,
} from "@/components/debug/debug-appkit-provider";
import { HookDataComposer } from "@/components/debug/hook-data-composer";
import { zodResolver } from "@hookform/resolvers/zod";
import { X402Client } from "@x402x/client";
import { AlertCircle, CheckCircle, Loader2, Wallet } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { createWalletClient, custom, publicActions } from "viem";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FACILITATOR_HOSTED_URL,
  SUPPORTED_NETWORKS,
} from "@/constants/facilitator";

// Minimal chain params for adding unsupported networks to wallets (EIP-3085)
// Only include entries for chains some wallets may not ship with by default.
const ADD_CHAIN_PARAMS: Record<
  string,
  {
    chainName: string;
    nativeCurrency: { name: string; symbol: string; decimals: number };
    rpcUrls: string[];
    blockExplorerUrls?: string[];
  }
> = {
  "x-layer": {
    chainName: "X Layer",
    nativeCurrency: { name: "OKB", symbol: "OKB", decimals: 18 },
    rpcUrls: ["https://rpc.xlayer.tech"],
    blockExplorerUrls: ["https://www.oklink.com/xlayer"],
  },
  "x-layer-testnet": {
    chainName: "X Layer Testnet",
    nativeCurrency: { name: "OKB", symbol: "OKB", decimals: 18 },
    rpcUrls: ["https://testrpc.xlayer.tech/terigon"],
    blockExplorerUrls: ["https://www.oklink.com/xlayer-test"],
  },
  base: {
    chainName: "Base",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: ["https://mainnet.base.org"],
    blockExplorerUrls: ["https://basescan.org"],
  },
  "base-sepolia": {
    chainName: "Base Sepolia",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: ["https://sepolia.base.org"],
    blockExplorerUrls: ["https://sepolia.basescan.org"],
  },
};

function getInjectedProvider(): any | undefined {
  const w: any = window as any;
  // Some wallets inject multiple providers (MetaMask + others)
  const eth = w?.ethereum;
  if (
    eth?.providers &&
    Array.isArray(eth.providers) &&
    eth.providers.length > 0
  ) {
    const candidates: any[] = eth.providers;
    const preferredFlags = ["isOkxWallet", "isMetaMask", "isCoinbaseWallet"];
    for (const flag of preferredFlags) {
      const found = candidates.find((p) => p && p[flag]);
      if (found) return found;
    }
    return candidates[0];
  }
  // Some wallets expose a dedicated global
  if (w?.okxwallet) return w.okxwallet;
  return eth;
}

async function ensureWalletNetwork(
  networkKey: string,
  chainId: number,
): Promise<void> {
  const eth = getInjectedProvider() as
    | { request: (args: any) => Promise<any> }
    | undefined;
  if (!eth)
    throw new Error(
      "No EIP-1193 provider found. Please install a browser wallet.",
    );

  // If already on the right network, return silently
  try {
    const currentHex: string = await eth.request({ method: "eth_chainId" });
    const current = Number.parseInt(currentHex, 16);
    if (current === chainId) return;
  } catch {
    /* ignore */
  }

  const targetHex = `0x${chainId.toString(16)}`;
  try {
    await eth.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: targetHex }],
    });
    return;
  } catch (err: any) {
    // 4902 means the chain hasn't been added to the wallet
    const code = err?.code;
    const msg = (err?.message || "").toLowerCase();
    const needsAdd =
      code === 4902 ||
      msg.includes("unrecognized chain") ||
      msg.includes("not added");
    if (!needsAdd) {
      if (code === 4001)
        throw new Error("Network switch was rejected in the wallet");
      throw new Error(
        `Failed to switch network: ${err?.message || "unknown error"}`,
      );
    }
  }

  // Try to add the chain, then switch again
  const add = ADD_CHAIN_PARAMS[networkKey];
  if (!add) {
    throw new Error(
      `The selected network (${networkKey}) is not available in your wallet. ` +
      `Please add it manually in your wallet settings and try again.`,
    );
  }
  try {
    await eth.request({
      method: "wallet_addEthereumChain",
      params: [
        {
          chainId: targetHex,
          chainName: add.chainName,
          nativeCurrency: add.nativeCurrency,
          rpcUrls: add.rpcUrls,
          blockExplorerUrls: add.blockExplorerUrls,
        },
      ],
    });
    await eth.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: targetHex }],
    });
  } catch (addErr: any) {
    if (addErr?.code === 4001)
      throw new Error("Adding the network was rejected in the wallet");
    throw new Error(
      `Failed to add/switch the network: ${addErr?.message || "unknown error"}`,
    );
  }
}

import * as z from "zod";

// Form schema for payment execution (addresses/hex validated here to avoid inline checks)
const addressHex = /^0x[a-fA-F0-9]{40}$/;
const dataHex = /^0x[0-9a-fA-F]*$/;

const paymentFormSchema = z.object({
  network: z
    .string()
    .min(1, "Please select a network")
    .refine((v) => SUPPORTED_NETWORKS.some((n) => n.network === v), {
      message: "Unsupported network",
    }),
  amount: z
    .string()
    .min(1, "Please enter an amount")
    .refine((v) => /^\d+$/.test(v), {
      message: "Amount must be a positive integer",
    }),
  payToAddress: z
    .string()
    .trim()
    .min(1, "Please enter a recipient address")
    .refine((v) => addressHex.test(v), {
      message: "Recipient must be a valid 0x address",
    }),
  hookAddress: z
    .string()
    .trim()
    .min(1, "Please enter a hook address")
    .refine((v) => addressHex.test(v), {
      message: "Hook must be a valid 0x address",
    }),
  // Only keep the encoded hook data string supplied by the composer; allow null for empty/invalid
  encodedHookData: z
    .union([
      z
        .string()
        .trim()
        .refine((v) => dataHex.test(v), {
          message: "Hook data must be 0x hex",
        }),
      z.null(),
    ])
    .optional(),
  facilitatorFee: z
    .string()
    .optional()
    .refine((v) => (v == null || v === "" ? true : /^\d+$/.test(v)), {
      message: "Facilitator fee must be a positive integer",
    }),
});

type PaymentFormData = z.infer<typeof paymentFormSchema>;

export default function DebugPage() {
  return (
    <DebugAppKitProvider>
      <DebugPageContent />
    </DebugAppKitProvider>
  );
}

function DebugPageContent() {
  const { openModal, address, isConnected } = useDebugAppKit();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [executionResult, setExecutionResult] = useState<{
    txHash: string;
    network: string;
    payer: string;
  } | null>(null);
  // No templates used

  const form = useForm<PaymentFormData>({
    resolver: zodResolver(paymentFormSchema),
    defaultValues: {
      network: "",
      amount: "",
      payToAddress: "",
      hookAddress: "",
      encodedHookData: null,
      facilitatorFee: "",
    },
  });

  // Selected network derived from form state when executing
  const selectedNetwork = form.watch("network");

  // Auto-switch wallet network when the user changes selection (if connected)
  const lastTriedNetworkRef = useRef<string | null>(null);
  useEffect(() => {
    if (!isConnected) return;
    const nk = selectedNetwork?.trim();
    if (!nk || nk === lastTriedNetworkRef.current) return;
    const sn = SUPPORTED_NETWORKS.find((n) => n.network === nk);
    if (!sn) return;
    ensureWalletNetwork(sn.network, sn.chainId)
      .then(() => {
        lastTriedNetworkRef.current = nk;
        setError(null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [isConnected, selectedNetwork]);

  const handleConnectWallet = useCallback(() => {
    openModal();
  }, [openModal]);

  const handleExecutePayment = useCallback(
    async (data: PaymentFormData) => {
      // Reset result state for a fresh submission (clear old success/error)
      setExecutionResult(null);
      setError(null);
      setIsLoading(true);

      // Early guard after resetting state so prior results don't linger
      if (!isConnected || !address) {
        setIsLoading(false);
        setError("Please connect your wallet first");
        return;
      }

      try {
        // Form-level validation handled by Zod (address/amount/network/hex). Runtime checks below are still required.
        const encodedHookData = data.encodedHookData ?? "0x";

        const sn = SUPPORTED_NETWORKS.find((n) => n.network === data.network)!;

        // Ensure wallet is on the correct network (try to auto-add/switch if needed)
        await ensureWalletNetwork(sn.network, sn.chainId);

        // Build viem wallet client from injected provider and extend with public actions
        const eth = getInjectedProvider();
        if (!eth)
          throw new Error(
            "No EIP-1193 provider found. Please install a browser wallet.",
          );
        const chain = {
          id: sn.chainId,
          name: sn.name,
          nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
          rpcUrls: {
            default: { http: [] as string[] },
            public: { http: [] as string[] },
          },
        } as const;
        const wallet = createWalletClient({
          account: address as `0x${string}`,
          chain,
          transport: custom(eth),
        }).extend(publicActions);

        // Use default facilitator URL unless overridden elsewhere
        const facilitatorUrl = FACILITATOR_HOSTED_URL.replace(/\/$/, "");

        const client = new X402Client({
          wallet: wallet as any,
          network: sn.network,
          facilitatorUrl,
        });
        const result = await client.execute({
          hook: data.hookAddress as `0x${string}`,
          hookData: encodedHookData as `0x${string}`,
          amount: data.amount,
          payTo: data.payToAddress as `0x${string}`,
          facilitatorFee: data.facilitatorFee || undefined,
        });

        setExecutionResult({
          txHash: result.txHash,
          network: result.network,
          payer: result.payer,
        });
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Payment settlement failed",
        );
      } finally {
        setIsLoading(false);
      }
    },
    [isConnected, address],
  );

  const onSubmit = useCallback(
    (data: PaymentFormData) => {
      handleExecutePayment(data);
    },
    [handleExecutePayment],
  );

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-5xl font-bold tracking-tight">Payment Debug</h1>
        <p className="text-muted-foreground mt-1">
          Test and debug X402 payment execution with custom endpoints.
        </p>
      </div>

      {!isConnected ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 space-y-4">
            <Wallet className="h-12 w-12 text-muted-foreground" />
            <p className="text-center text-muted-foreground">
              Connect your wallet to debug payments
            </p>
            <Button onClick={handleConnectWallet}>
              <Wallet className="mr-2 h-4 w-4" />
              Connect Wallet
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Facilitator Settlement</CardTitle>
              <CardDescription>
                Fill in the payment details to test the settlement endpoint
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form
                  onSubmit={form.handleSubmit(onSubmit)}
                  className="space-y-6"
                >
                  <FormField
                    control={form.control}
                    name="network"
                    render={({ field }) => (
                      <FormItem>
                        {/* Make label larger and clearer on the Debug page only */}
                        <FormLabel className="text-base md:text-lg font-semibold">
                          Network
                        </FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select network" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {SUPPORTED_NETWORKS.map((network) => (
                              <SelectItem
                                key={network.network}
                                value={network.network}
                              >
                                {network.name} ({network.status})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="amount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-base md:text-lg font-semibold">
                          Amount (USDC)
                        </FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            type="number"
                            placeholder="100000"
                            min="0"
                          />
                        </FormControl>
                        <FormDescription>
                          Amount in smallest units (6 decimals for USDC)
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="hookAddress"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-base md:text-lg font-semibold">
                          Hook Address *
                        </FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="0x..." />
                        </FormControl>
                        <FormDescription>
                          Contract address to execute after payment
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="encodedHookData"
                    render={({ field }) => (
                      <FormItem>
                        <HookDataComposer
                          value={field.value}
                          onChange={field.onChange}
                        />
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="payToAddress"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-base md:text-lg font-semibold">
                          PayTo Address *
                        </FormLabel>
                        <FormControl>
                          <div className="flex gap-2">
                            <Input {...field} placeholder="0x..." />
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => {
                                if (address) {
                                  form.setValue("payToAddress", address);
                                }
                              }}
                              disabled={!address}
                            >
                              Use My Address
                            </Button>
                          </div>
                        </FormControl>
                        <FormDescription>
                          The address that will receive the payment
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="facilitatorFee"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-base md:text-lg font-semibold">
                          Facilitator Fee (Optional)
                        </FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            type="number"
                            placeholder="Auto-query from facilitator"
                            min="0"
                          />
                        </FormControl>
                        <FormDescription>
                          Fee for the facilitator (in smallest units). If not
                          set, will query the facilitator for the fee.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button type="submit" disabled={isLoading} className="w-full">
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Executing Payment...
                      </>
                    ) : (
                      "Sign & Execute Settlement"
                    )}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>

          {/* Templates removed */}

          {executionResult && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-500" />
                    Payment Executed
                  </span>
                  {(() => {
                    const sn = SUPPORTED_NETWORKS.find(
                      (n) => n.network === executionResult.network,
                    );
                    const url = sn?.txExplorerBaseUrl
                      ? `${sn.txExplorerBaseUrl}${executionResult.txHash}`
                      : null;
                    return url ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => window.open(url, "_blank")}
                      >
                        View in Explorer
                      </Button>
                    ) : null;
                  })()}
                </CardTitle>
                <CardDescription>Execution complete</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="font-semibold">Transaction Hash:</span>
                    <code className="text-xs bg-muted px-2 py-1 rounded break-all ml-2">
                      {executionResult.txHash}
                    </code>
                  </div>
                  <div>
                    <span className="font-semibold">Network:</span>
                    <span className="ml-2">{executionResult.network}</span>
                  </div>
                  <div>
                    <span className="font-semibold">Payer:</span>
                    <code className="text-xs bg-muted px-1 py-0.5 rounded ml-2">
                      {executionResult.payer}
                    </code>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>
      )}
    </div>
  );
}

// Template UI removed
