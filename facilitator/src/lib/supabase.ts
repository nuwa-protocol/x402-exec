import { createClient } from "@supabase/supabase-js";
import { getLogger } from "../telemetry.js";
import { PaymentRequirements, SettleResponse, PaymentPayload } from "@x402/core/types";
import { parseSettlementExtra, getNetworkConfig } from "@x402x/extensions";

const logger = getLogger();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

export const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

/**
 * Get hook name from network config by matching hook address
 */
function getHookName(network: string, hookAddress: string): string {
  try {
    const networkConfig = getNetworkConfig(network as any);

    // Check builtin hooks
    for (const [key, address] of Object.entries(networkConfig.hooks || {})) {
      if (address.toLowerCase() === hookAddress.toLowerCase()) {
        // Convert "transfer" to "Transfer Hook"
        return key.charAt(0).toUpperCase() + key.slice(1) + " Hook";
      }
    }

    // Check demo hooks
    for (const [key, address] of Object.entries(networkConfig.demoHooks || {})) {
      if (address.toLowerCase() === hookAddress.toLowerCase()) {
        // Convert "nftMint" to "NFT Mint Hook", "reward" to "Reward Hook"
        const formattedKey = key.replace(/([A-Z])/g, ' $1').trim();
        return formattedKey.charAt(0).toUpperCase() + formattedKey.slice(1) + " Hook";
      }
    }

    // Fallback for custom hooks
    return "Custom Hook";
  } catch (error) {
    logger.warn({ error, network, hookAddress }, "Failed to get hook name from network config");
    return "Unknown Hook";
  }
}

/**
 * Extract payment amount from PaymentPayload
 * For EVM exact scheme, amount is in payload.authorization.value
 */
function extractPaymentAmount(paymentPayload?: PaymentPayload): string {
  if (!paymentPayload) {
    return "0";
  }

  try {
    // Try to extract from V2 EVM exact payload structure
    const evmPayload = (paymentPayload as any).payload;
    if (evmPayload?.authorization?.value) {
      return evmPayload.authorization.value;
    }
  } catch (error) {
    logger.warn({ error }, "Failed to extract payment amount from payload");
  }

  return "0";
}

export async function recordHook(
  paymentRequirements: PaymentRequirements,
  settleResponse: SettleResponse,
  paymentPayload?: PaymentPayload,
) {
  const { network, asset, extra } = paymentRequirements;
  // Extract actual payment amount from paymentPayload
  const paymentAmount = extractPaymentAmount(paymentPayload);
  const { payer } = settleResponse;

  // Parse and validate settlement extra parameters
  let settlementExtra;
  try {
    settlementExtra = extra ? parseSettlementExtra(extra) : undefined;
  } catch (error) {
    logger.warn({ error }, "Failed to parse settlement extra, skipping hook logging.");
    return;
  }

  const hookAddress = settlementExtra?.hook;

  if (!hookAddress || !payer) {
    logger.warn("Hook address or payer not found, skipping transaction logging.");
    return;
  }

  // Get hook name from network config
  const hookName = getHookName(network, hookAddress);

  // Log hook record for debugging (works even without Supabase configured)
  logger.info({
    hook: hookAddress,
    network,
    asset,
    payer,
    volume: paymentAmount,
    hookName,
    payTo: settlementExtra?.payTo,
    facilitatorFee: settlementExtra?.facilitatorFee,
    settlementRouter: settlementExtra?.settlementRouter,
    hookData: settlementExtra?.hookData,
  }, "Hook record");

  if (!supabase) {
    return;
  }

  const { error } = await supabase.rpc("upsert_hook_stats", {
    h_address: hookAddress,
    h_network: network,
    user_address: payer,
    t_volume: paymentAmount,
    h_asset: asset,
    // Pass additional hook metadata for insertion on first record
    h_name: hookName,
    h_description: `${hookName} on ${network}`,
    h_pay_to: settlementExtra?.payTo,
    h_facilitator_fee: settlementExtra?.facilitatorFee,
    h_settlement_router: settlementExtra?.settlementRouter,
    h_data: settlementExtra?.hookData,
  });

  if (error) {
    logger.warn({ error }, "Failed to record hook in Supabase");
  }

  return error;
}

export async function recordTransaction(
  paymentRequirements: PaymentRequirements,
  settleResponse: SettleResponse,
  paymentPayload?: PaymentPayload,
) {
  const { network, payTo, extra } = paymentRequirements;
  // Extract actual payment amount from paymentPayload
  const paymentAmount = extractPaymentAmount(paymentPayload);
  const { payer, transaction } = settleResponse;
  const version = "2";

  // Parse and validate settlement extra parameters
  let settlementExtra;
  try {
    settlementExtra = extra ? parseSettlementExtra(extra) : undefined;
  } catch (error) {
    logger.warn({ error }, "Failed to parse settlement extra, skipping transaction logging.");
    return;
  }

  const hookAddress = settlementExtra?.hook;

  // Get hook name from network config
  const hookName = hookAddress ? getHookName(network, hookAddress) : "Unknown Hook";

  // Log transaction record for debugging (works even without Supabase configured)
  logger.info({
    txHash: transaction,
    network,
    from: payer,
    to: payTo,
    hook: hookAddress,
    hookName,
    facilitatorFee: settlementExtra?.facilitatorFee,
    amount: paymentAmount,
    version,
  }, "Transaction record");

  if (!supabase) {
    return;
  }

  const { error } = await supabase.from("x402_transactions").insert({
    tx_hash: transaction,
    network: network,
    block_timestamp: Math.floor(Date.now() / 1000),
    from_addr: payer,
    to_addr: payTo,
    hook: hookAddress,
    hook_name: hookName,
    facilitator: Number(settlementExtra?.facilitatorFee || 0),
    amount: paymentAmount,
    version,
  });

  if (error) {
    logger.warn({ error }, "Failed to record transaction in Supabase");
  }

  return error;
}
