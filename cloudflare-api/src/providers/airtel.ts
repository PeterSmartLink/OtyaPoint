/**
 * Airtel Money provider boundary for OmniPoint.
 *
 * Deliberately non-operational scaffold: this module performs no network requests,
 * obtains no access token, and initiates no collection/disbursement. Implement the
 * request/response mapping only after the exact Uganda API contract is supplied
 * from the owner's Airtel Africa Developer Console.
 */

export type AirtelEnvironment = "disabled" | "sandbox";

export interface AirtelMoneyConfig {
  environment: AirtelEnvironment;
  /** Must be the official Airtel UAT origin confirmed by the country-specific console. */
  apiOrigin?: string;
  clientId?: string;
  clientSecret?: string;
}

export type AirtelCapability =
  | "COLLECTION"
  | "DISBURSEMENT"
  | "TRANSACTION_STATUS"
  | "REFUND";

export interface AirtelOperationRequest {
  operationId: string;
  idempotencyKey: string;
  amountUgx: number;
  customerMsisdn: string;
  reference: string;
  capability: AirtelCapability;
}

export interface AirtelOperationResult {
  status: "NOT_CONFIGURED";
  operationId: string;
  provider: "AIRTEL_MONEY";
  detail: string;
}

/**
 * Fail-closed preflight only. This is intentionally not a credential validator:
 * successful preflight does not mean an API request is permitted.
 */
export function inspectAirtelConfig(config: AirtelMoneyConfig): {
  readyForSandboxContractWork: boolean;
  reasons: string[];
} {
  const reasons: string[] = [];
  if (config.environment !== "sandbox") {
    reasons.push("Airtel calls are disabled; live mode is not implemented.");
  }
  if (!config.apiOrigin) {
    reasons.push("Add the exact Uganda UAT origin from the developer console.");
  } else {
    try {
      const origin = new URL(config.apiOrigin);
      if (
        origin.protocol !== "https:" ||
        origin.hostname !== "openapiuat.airtel.africa" ||
        origin.pathname !== "/" ||
        origin.search ||
        origin.hash
      ) {
        reasons.push("Only the documented Airtel UAT origin is allowed for sandbox preparation.");
      }
    } catch {
      reasons.push("Airtel API origin is not a valid URL.");
    }
  }
  if (!config.clientId) reasons.push("Sandbox client ID is not configured.");
  if (!config.clientSecret) reasons.push("Sandbox client secret is not configured.");

  // Even with all fields present, the exact Uganda product contract must be reviewed
  // before any adapter can make requests. This module never performs network I/O.
  reasons.push("Provider calls remain disabled until country-specific docs, scopes, callback verification, and sandbox tests are reviewed.");
  return { readyForSandboxContractWork: false, reasons };
}

/**
 * Safe placeholder for the Worker route to call while integration is incomplete.
 * Never returns a fake success and never contacts Airtel.
 */
export async function submitAirtelOperation(
  request: AirtelOperationRequest,
  _config: AirtelMoneyConfig,
): Promise<AirtelOperationResult> {
  return {
    status: "NOT_CONFIGURED",
    operationId: request.operationId,
    provider: "AIRTEL_MONEY",
    detail: "No Airtel request was sent. Implement the approved Uganda sandbox contract before enabling this operation.",
  };
}
