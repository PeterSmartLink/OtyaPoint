/**
 * Interswitch / Quickteller provider boundary for OmniPoint.
 *
 * Interswitch and Quickteller are treated as a provider family with distinct
 * product capabilities, not as two assumed-independent fallback rails. No network
 * calls are made until the exact Uganda product contract is reviewed.
 */
export type InterswitchEnvironment = "disabled" | "sandbox";
export type InterswitchProduct =
  | "PAYMENT_GATEWAY"
  | "QUICKTELLER_BUSINESS"
  | "VALUE_ADDED_SERVICES"
  | "AGENT_PAYPOINT";

export type InterswitchCapability =
  | "COLLECTION"
  | "TRANSACTION_STATUS"
  | "AIRTIME"
  | "DATA"
  | "BILL_PAYMENT"
  | "AGENT_CASH_IN"
  | "AGENT_CASH_OUT"
  | "REFUND";

export interface InterswitchConfig {
  environment: InterswitchEnvironment;
  product?: InterswitchProduct;
  apiOrigin?: string;
  clientId?: string;
  clientSecret?: string;
}

export interface InterswitchOperationRequest {
  operationId: string;
  idempotencyKey: string;
  amountUgx: number;
  reference: string;
  capability: InterswitchCapability;
}

export interface InterswitchOperationResult {
  status: "NOT_CONFIGURED";
  operationId: string;
  provider: "INTERSWITCH";
  product?: InterswitchProduct;
  detail: string;
}

/** Shape check only; product entitlement and API contract must be verified separately. */
export function inspectInterswitchConfig(config: InterswitchConfig): {
  readyForSandboxContractWork: boolean;
  reasons: string[];
} {
  const reasons: string[] = [];
  if (config.environment !== "sandbox") reasons.push("Interswitch calls are disabled; live mode is not implemented.");
  if (!config.product) reasons.push("Select a product explicitly after Uganda eligibility is confirmed.");
  if (!config.apiOrigin) reasons.push("Add the exact sandbox origin from the selected product's current documentation.");
  else {
    try {
      const origin = new URL(config.apiOrigin);
      if (origin.protocol !== "https:" || origin.username || origin.password || origin.search || origin.hash) {
        reasons.push("API origin must be an HTTPS origin without embedded credentials, query, or fragment.");
      }
    } catch {
      reasons.push("API origin is not a valid URL.");
    }
  }
  if (!config.clientId) reasons.push("Sandbox client ID is not configured.");
  if (!config.clientSecret) reasons.push("Sandbox client secret is not configured.");
  reasons.push("No requests are allowed until product-specific Uganda scopes, signing, callbacks, and status enquiry are reviewed.");
  return { readyForSandboxContractWork: false, reasons };
}

export async function submitInterswitchOperation(
  request: InterswitchOperationRequest,
  config: InterswitchConfig,
): Promise<InterswitchOperationResult> {
  return {
    status: "NOT_CONFIGURED",
    operationId: request.operationId,
    provider: "INTERSWITCH",
    ...(config.product ? { product: config.product } : {}),
    detail: "No Interswitch/Quickteller request was sent. Implement only the approved product contract.",
  };
}
