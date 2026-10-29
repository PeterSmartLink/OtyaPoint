/**
 * MTN MoMo provider boundary for OmniPoint.
 *
 * Non-operational scaffold only. No OAuth calls, payment initiation, balance
 * requests, callbacks, or live/sandbox network traffic is performed here.
 * Implement only after the owner's Uganda MTN developer portal contract is reviewed.
 */
export type MtnEnvironment = "disabled" | "sandbox";

export interface MtnMoMoConfig {
  environment: MtnEnvironment;
  apiOrigin?: string;
  subscriptionKey?: string;
  apiUser?: string;
  apiKey?: string;
}

export type MtnCapability =
  | "COLLECTION"
  | "DISBURSEMENT"
  | "TRANSACTION_STATUS"
  | "ACCOUNT_BALANCE"
  | "ACCOUNT_HOLDER_VALIDATION"
  | "REFUND";

export interface MtnOperationRequest {
  operationId: string;
  idempotencyKey: string;
  amountUgx: number;
  customerMsisdn: string;
  reference: string;
  capability: MtnCapability;
}

export interface MtnOperationResult {
  status: "NOT_CONFIGURED";
  operationId: string;
  provider: "MTN_MOMO";
  detail: string;
}

/** Preflight only. A passing shape check is never permission to send a request. */
export function inspectMtnConfig(config: MtnMoMoConfig): {
  readyForSandboxContractWork: boolean;
  reasons: string[];
} {
  const reasons: string[] = [];
  if (config.environment !== "sandbox") reasons.push("MTN MoMo calls are disabled; live mode is not implemented.");
  if (!config.apiOrigin) reasons.push("Add the exact Uganda sandbox origin shown in the MTN developer portal.");
  else {
    try {
      const origin = new URL(config.apiOrigin);
      if (origin.protocol !== "https:" || origin.username || origin.password || origin.search || origin.hash) {
        reasons.push("MTN API origin must be an HTTPS origin without embedded credentials, query, or fragment.");
      }
    } catch {
      reasons.push("MTN API origin is not a valid URL.");
    }
  }
  if (!config.subscriptionKey) reasons.push("Sandbox subscription key is not configured.");
  if (!config.apiUser) reasons.push("Sandbox API user is not configured.");
  if (!config.apiKey) reasons.push("Sandbox API key is not configured.");
  reasons.push("No requests are allowed until Uganda product scopes, headers, callbacks, status checks, and sandbox tests are reviewed.");
  return { readyForSandboxContractWork: false, reasons };
}

export async function submitMtnOperation(
  request: MtnOperationRequest,
  _config: MtnMoMoConfig,
): Promise<MtnOperationResult> {
  return {
    status: "NOT_CONFIGURED",
    operationId: request.operationId,
    provider: "MTN_MOMO",
    detail: "No MTN request was sent. Implement the approved Uganda sandbox contract before enabling this operation.",
  };
}
