import type {
  PaymentInitiation,
  PaymentProvider,
  PaymentRequest,
  PaymentStatusResult,
  ProviderCapabilities,
  VerifiedProviderEvent,
} from "./contracts";

/**
 * Safe default until a provider is configured and approved.
 * It never makes network calls and never reports a transaction as successful.
 */
export class DisabledPaymentProvider implements PaymentProvider {
  readonly id = "disabled";

  getCapabilities(): ProviderCapabilities {
    return {
      collections: false,
      refunds: false,
      airtime: false,
      data: false,
      billPayments: false,
      agencyCashIn: false,
      agencyCashOut: false,
      floatPurchase: false,
      webhookVerification: false,
      statusInquiry: false,
    };
  }

  async initiatePayment(_input: PaymentRequest): Promise<PaymentInitiation> {
    return {
      status: "FAILED",
      provider: this.id,
      reasonCode: "payment_provider_not_configured",
    };
  }

  async checkStatus(_providerReference: string): Promise<PaymentStatusResult> {
    throw new Error("payment_provider_not_configured");
  }

  async verifyCallback(_request: Request): Promise<VerifiedProviderEvent> {
    throw new Error("payment_provider_not_configured");
  }
}
