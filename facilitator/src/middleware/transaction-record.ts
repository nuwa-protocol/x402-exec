import type { Request, Response, NextFunction } from "express";
import type { PaymentRequirements, SettleResponse } from "@x402/core/types";
import type { PaymentPayload } from "@x402/core/types";
import { getLogger } from "../telemetry.js";
import { recordHook, recordTransaction } from "../lib/supabase.js";

const logger = getLogger();

/**
 * Creates a middleware to log transaction details after settlement.
 * It inspects the response body of the POST /settle endpoint.
 */
export function createTransactionRecordMiddleware() {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.path !== "/settle" || req.method !== "POST") {
      return next();
    }

    const originalJson = res.json;

    res.json = function (body) {
      try {
        const paymentRequirements: PaymentRequirements | undefined = req.body?.paymentRequirements;
        const paymentPayload: PaymentPayload | undefined = req.body?.paymentPayload;
        const settleResponse: SettleResponse = body;

        if (paymentRequirements && settleResponse?.transaction) {
          const { transaction } = settleResponse;
          logger.info(
            {
              transaction,
            },
            "Transaction information captured",
          );

          recodeTransaction(paymentRequirements, settleResponse, paymentPayload).catch((error) => {
            logger.error({ error, transaction }, "Failed to record transaction (unhandled)");
          });
        }
      } catch (error) {
        logger.error({ error }, "Failed to log transaction from response");
      }

      return originalJson.call(this, body);
    };

    next();
  };
}

export async function recodeTransaction(
  paymentRequirements: PaymentRequirements,
  settleResponse: SettleResponse,
  paymentPayload?: PaymentPayload,
) {
  const { transaction } = settleResponse;

  try {
    const error = await recordHook(paymentRequirements, settleResponse, paymentPayload);
    if (error) {
      throw error;
    }
    const error1 = await recordTransaction(paymentRequirements, settleResponse, paymentPayload);
    if (error1) {
      throw error1;
    }
  } catch (error) {
    logger.error({ error, transaction }, "Failed to upsert hook stats");
  }
}
