import {
  validatePaymentRequest,
  type PaymentInitiation,
  type PaymentProvider,
  type PaymentRequest,
  type PaymentStatusResult,
  type ProviderCapabilities,
  type VerifiedProviderEvent,
} from "./contracts";

/**
 * Sandbox-only Quickteller Web Checkout form builder.
 *
 * This adapter deliberately performs no network calls. It creates a POST form
 * for the documented Interswitch sandbox endpoint. It cannot verify payment,
 * post ledger entries, or be treated as production-ready.
 */
export interface QuicktellerSandboxConfig {
  merchantCode: string;
  payItemId: string;
  siteRedirectUrl: string;
  customerEmail: string;
  payItemName?: string;
}

const SANDBOX_CHECKOUT_ACTION =
  "https://newwebpay-sandbox.interswitchng.com/collections/w/pay";

function safeConfigValue(value: string, max: number): string {
  return value.trim().slice(0, max);
}

function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

export class QuicktellerSandboxCheckout implements PaymentProvider {
  readonly id = "quickteller-sandbox";

  constructor(private readonly config: QuicktellerSandboxConfig) {}

  getCapabilities(): ProviderCapabilities {
    // Deliberately false: a checkout form alone is not a complete payment flow.
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

  async initiatePayment(input: PaymentRequest): Promise<PaymentInitiation> {
    const invalid = validatePaymentRequest(input);
    if (invalid) return { status: "FAILED", provider: this.id, reasonCode: invalid };
    if (input.service !== "SHOP_CHECKOUT") {
      return { status: "FAILED", provider: this.id, reasonCode: "sandbox_adapter_shop_checkout_only" };
    }

    const merchantCode = safeConfigValue(this.config.merchantCode, 80);
    const payItemId = safeConfigValue(this.config.payItemId, 80);
    const customerEmail = safeConfigValue(this.config.customerEmail, 254);
    const siteRedirectUrl = safeConfigValue(this.config.siteRedirectUrl, 2048);
    const payItemName = safeConfigValue(this.config.payItemName || "OmniPoint shop purchase", 100);

    if (!merchantCode || !payItemId || !customerEmail || !siteRedirectUrl || !payItemName) {
      return { status: "FAILED", provider: this.id, reasonCode: "sandbox_checkout_configuration_missing" };
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) {
      return { status: "FAILED", provider: this.id, reasonCode: "invalid_customer_email_configuration" };
    }
    if (!isHttpsUrl(siteRedirectUrl)) {
      return { status: "FAILED", provider: this.id, reasonCode: "redirect_url_must_use_https" };
    }
    if (!/^[A-Za-z0-9._:-]{1,100}$/.test(input.transactionId)) {
      return { status: "FAILED", provider: this.id, reasonCode: "invalid_transaction_reference" };
    }

    return {
      status: "PENDING",
      provider: this.id,
      providerReference: input.transactionId,
      checkoutForm: {
        action: SANDBOX_CHECKOUT_ACTION,
        method: "POST",
        fields: {
          merchant_code: merchantCode,
          pay_item_id: payItemId,
          pay_item_name: payItemName,
          txn_ref: input.transactionId,
          amount: String(input.amountMinor),
          currency: "800",
          cust_email: customerEmail,
          site_redirect_url: siteRedirectUrl,
        },
      },
      reasonCode: "sandbox_checkout_form_ready_server_verification_required",
    };
  }

  async checkStatus(_providerReference: string): Promise<PaymentStatusResult> {
    throw new Error("quickteller_server_side_requery_not_implemented");
  }

  async verifyCallback(_request: Request): Promise<VerifiedProviderEvent> {
    throw new Error("quickteller_callback_verification_not_implemented");
  }
}
