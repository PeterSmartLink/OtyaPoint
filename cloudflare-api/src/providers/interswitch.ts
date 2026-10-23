/**
 * Interswitch integration boundary for OmniPoint.
 *
 * This is deliberately a contract, not a live API client. Product endpoints,
 * authentication details, currency conventions and callback signatures must be
 * taken from the current documentation for the exact product enabled on the
 * merchant account. Do not infer Uganda availability from legacy SDK examples.
 */

export type ProviderTransactionStatus =
  | "PENDING"
  | "SUCCEEDED"
  | "FAILED"
  | "UNKNOWN"
  | "REVERSED";

export type InterswitchCapability =
  | "CHECKOUT"
  | "AIRTIME_DATA"
  | "BILL_PAYMENT"
  | "AGENCY_CASH_OUT"
  | "TRANSFER"
  | "WALLET"
  | "PAYCODE"
  | "SMARTPOS";

export interface ProviderTransactionRequest {
  /** Unique OmniPoint reference, created before calling the provider. */
  reference: string;
  /** Unique key used to prevent duplicate execution where supported. */
  idempotencyKey: string;
  capability: InterswitchCapability;
  /** Integer in the currency's confirmed minor-unit convention. */
  amountMinor: number;
  currency: "UGX" | string;
  /** Must not contain secrets, PAN/CVV, passwords, or raw identity documents. */
  metadata?: Record<string, string | number | boolean | null>;
}

export interface ProviderTransactionResult {
  reference: string;
  providerReference?: string;
  status: ProviderTransactionStatus;
  /** Stable normalized code; do not expose raw provider payload to the browser. */
  code?: string;
  /** Safe user-facing summary only. */
  message?: string;
}

export interface InterswitchAdapter {
  createTransaction(
    request: ProviderTransactionRequest,
  ): Promise<ProviderTransactionResult>;
  queryTransaction(
    reference: string,
  ): Promise<ProviderTransactionResult>;
}

/**
 * Fail-closed placeholder. Replace with a product-specific implementation only
 * after the exact sandbox API, authentication, signing, status and retry rules
 * are verified. It intentionally makes no network calls and records no money.
 */
export class InterswitchNotConfiguredError extends Error {
  readonly code = "INTERSWITCH_ADAPTER_NOT_CONFIGURED";

  constructor() {
    super(
      "Interswitch sandbox adapter is not configured for an approved product. No provider request was sent.",
    );
    this.name = "InterswitchNotConfiguredError";
  }
}

export const interswitchAdapter: InterswitchAdapter = {
  async createTransaction() {
    throw new InterswitchNotConfiguredError();
  },
  async queryTransaction() {
    throw new InterswitchNotConfiguredError();
  },
};
