/**
 * Provider-neutral payment contracts for OmniPoint.
 *
 * These types deliberately contain no Interswitch credentials, URLs, or
 * provider-specific request fields. Implementations must live server-side.
 * No real provider is wired by this contract alone.
 */

export type PaymentStatus =
  | "PENDING"
  | "SUCCEEDED"
  | "FAILED"
  | "UNKNOWN"
  | "REVERSED"
  | "REFUNDED";

export type PaymentService =
  | "SHOP_CHECKOUT"
  | "AIRTIME"
  | "DATA"
  | "BILL_PAYMENT"
  | "AGENCY_CASH_IN"
  | "AGENCY_CASH_OUT"
  | "FLOAT_PURCHASE";

export interface PaymentRequest {
  /** OmniPoint's stable, unique transaction ID. Never use a provider reference here. */
  transactionId: string;
  /** Stable key reused for every retry of the same logical operation. */
  idempotencyKey: string;
  service: PaymentService;
  amountMinor: number;
  currency: "UGX";
  customerReference?: string;
  description: string;
  returnUrl?: string;
}

export interface PaymentInitiation {
  status: PaymentStatus;
  provider: string;
  /** Opaque provider-side reference, if one has been assigned. */
  providerReference?: string;
  /** A hosted checkout URL, when the provider's product uses one. */
  checkoutUrl?: string;
  /** Safe, non-secret code for logs and support. */
  reasonCode?: string;
}

export interface PaymentStatusResult {
  status: PaymentStatus;
  provider: string;
  providerReference: string;
  /** Amount/currency reported by the provider, when available. */
  amountMinor?: number;
  currency?: string;
  /** Provider's event or transaction time, if supplied and validated. */
  occurredAt?: string;
}

export interface ProviderCapabilities {
  collections: boolean;
  refunds: boolean;
  airtime: boolean;
  data: boolean;
  billPayments: boolean;
  agencyCashIn: boolean;
  agencyCashOut: boolean;
  floatPurchase: boolean;
  webhookVerification: boolean;
  statusInquiry: boolean;
}

export interface VerifiedProviderEvent {
  provider: string;
  providerReference: string;
  transactionId?: string;
  status: PaymentStatus;
  amountMinor?: number;
  currency?: string;
  eventId?: string;
}

export interface PaymentProvider {
  readonly id: string;
  getCapabilities(): ProviderCapabilities;
  initiatePayment(input: PaymentRequest): Promise<PaymentInitiation>;
  checkStatus(providerReference: string): Promise<PaymentStatusResult>;
  verifyCallback(request: Request): Promise<VerifiedProviderEvent>;
}

/** Validate money before any adapter is called. Amounts use integer minor units. */
export function validatePaymentRequest(input: PaymentRequest): string | null {
  if (!input.transactionId.trim()) return "transaction_id_required";
  if (!input.idempotencyKey.trim()) return "idempotency_key_required";
  if (!Number.isSafeInteger(input.amountMinor) || input.amountMinor <= 0) {
    return "amount_must_be_positive_integer_minor_units";
  }
  if (input.currency !== "UGX") return "unsupported_currency";
  if (!input.description.trim() || input.description.length > 240) {
    return "invalid_description";
  }
  return null;
}
