import { createClient } from "@supabase/supabase-js";
import { getLogger } from "../telemetry.js";
import { PaymentRequirements, SettleResponse } from "x402/types";

const logger = getLogger();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  logger.warn("Supabase URL or key not provided. Transaction logging will be disabled.");
}

export const supabase =
  supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;


export async function recordHook(paymentRequirements: PaymentRequirements, settleResponse: SettleResponse) {
  if (!supabase) {
    return;
  }

  const {
    network,
    asset,
    maxAmountRequired,
    extra,
  } = paymentRequirements;
  const { payer } = settleResponse;
  const hookAddress = extra?.hook;

  if (!hookAddress || !payer) {
    logger.warn("Hook address or payer not found, skipping transaction logging.");
    return;
  }
  const { error } = await supabase.rpc("upsert_hook_stats", {
    h_address: hookAddress,
    h_network: network,
    user_address: payer,
    t_volume: maxAmountRequired,
    h_asset: asset,
    // Pass additional hook metadata for insertion on first record
    h_name: extra?.name || "Untitled Hook", // Default name if not provided
    h_description: extra?.description,
    h_pay_to: extra?.payTo,
    h_facilitator_fee: extra?.facilitatorFee,
    h_settlement_router: extra?.settlementRouter,
    h_data: extra?.data,
  });

  return error;
}

export async function recordTransaction(paymentRequirements: PaymentRequirements, settleResponse: SettleResponse) {
  if (!supabase) {
    return;
  }

  const {
    network,
    payTo,
    maxAmountRequired,
    extra,
  } = paymentRequirements;
  const { payer } = settleResponse;
  const hookAddress = extra?.hook;
  const version = '2';
  const hookName = extra?.name || "Untitled Hook";
  const { transaction } = settleResponse;

  const { error } = await supabase.from("x402_transactions").insert({
    tx_hash: transaction,
    network: network,
    block_timestamp: Math.floor(Date.now()/1000),
    from_addr: payer,
    to_addr: payTo,
    hook: hookAddress,
    hook_name: hookName,
    facilitator: Number(extra?.facilitatorFee),
    amount: maxAmountRequired,
    version,
  });
  return error;
}