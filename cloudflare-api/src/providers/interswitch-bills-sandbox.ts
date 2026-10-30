/**
 * InterSwitch Bills Payment API v1 — isolated sandbox contract client.
 *
 * Safety: this module is not wired into the Worker router and performs no
 * requests by itself. Live URLs are deliberately not supported. Payment
 * submission is disabled unless a caller explicitly opts in for sandbox tests.
 * Never pass client secrets from a browser/mobile client or log access tokens.
 */

export const INTERSWITCH_BILLS_SANDBOX_BASE =
  "https://sandbox.interswitchng.com/marketplace-routing/api";

export type JsonRecord = Record<string, unknown>;
export type BillsApiEnvelope<T = unknown> = {
  success?: boolean;
  code?: string;
  message?: string;
  data?: T;
};

export type BillsClientOptions = {
  accessToken: string;
  fetchImpl?: typeof fetch;
  /** Must be explicitly true for controlled sandbox payment tests. Defaults false. */
  allowSandboxPaymentSubmission?: boolean;
  timeoutMs?: number;
};

export class BillsProviderError extends Error {
  readonly kind: "disabled" | "transport" | "http" | "invalid_response";
  readonly httpStatus?: number;
  constructor(
    kind: BillsProviderError["kind"],
    message: string,
    httpStatus?: number,
  ) {
    super(message);
    this.name = "BillsProviderError";
    this.kind = kind;
    this.httpStatus = httpStatus;
  }
}

function requireText(value: unknown, field: string, max = 180): string {
  if (typeof value !== "string" || !value.trim() || value.trim().length > max) {
    throw new TypeError(`Invalid ${field}`);
  }
  return value.trim();
}

function requireAmount(value: unknown): number {
  // Keep the provider's decimal contract unresolved. This only rejects
  // non-positive/non-finite numbers; it does NOT convert currency units.
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    throw new TypeError("Invalid amount");
  }
  return value;
}

export class InterSwitchBillsSandboxClient {
  private readonly token: string;
  private readonly fetchImpl: typeof fetch;
  private readonly allowPayment: boolean;
  private readonly timeoutMs: number;

  constructor(options: BillsClientOptions) {
    this.token = requireText(options.accessToken, "accessToken", 8192);
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.allowPayment = options.allowSandboxPaymentSubmission === true;
    this.timeoutMs = options.timeoutMs ?? 8000;
    if (!Number.isSafeInteger(this.timeoutMs) || this.timeoutMs < 1000 || this.timeoutMs > 30000) {
      throw new TypeError("timeoutMs must be an integer between 1000 and 30000");
    }
  }

  async getBillers(): Promise<BillsApiEnvelope> {
    return this.request("GET", "/v1/vas/billers");
  }

  async getPaymentItems(billerId: string | number): Promise<BillsApiEnvelope> {
    const id = typeof billerId === "number"
      ? (Number.isSafeInteger(billerId) && billerId > 0 ? String(billerId) : "")
      : requireText(billerId, "billerId", 64);
    if (!id || !/^[A-Za-z0-9_-]{1,64}$/.test(id)) throw new TypeError("Invalid billerId");
    const query = new URLSearchParams({ "biller-id": id });
    return this.request("GET", `/v1/vas/billers/payment-item?${query.toString()}`);
  }

  async validateCustomer(customerId: string, paymentCode: string): Promise<BillsApiEnvelope> {
    const payload = [{
      customerId: requireText(customerId, "customerId", 180),
      paymentCode: requireText(paymentCode, "paymentCode", 80),
    }];
    // The array shape mirrors the dashboard's curl example; confirm against
    // an official sandbox contract test before enabling this integration.
    return this.request("POST", "/v1/vas/validate-customer", payload);
  }

  async pay(input: {
    customerId: string;
    paymentCode: string;
    reference: string;
    amount: number;
  }): Promise<BillsApiEnvelope> {
    if (!this.allowPayment) {
      throw new BillsProviderError("disabled", "Sandbox payment submission is disabled.");
    }
    const payload = {
      customerId: requireText(input.customerId, "customerId", 180),
      paymentCode: requireText(input.paymentCode, "paymentCode", 80),
      reference: requireText(input.reference, "reference", 128),
      amount: requireAmount(input.amount),
    };
    return this.request("POST", "/v1/vas/pay", payload);
  }

  async getTransaction(requestReference: string): Promise<BillsApiEnvelope> {
    const reference = requireText(requestReference, "requestReference", 128);
    return this.request("GET", `/v1/vas/transactions?${new URLSearchParams({ "request-reference": reference })}`);
  }

  private async request(method: "GET" | "POST", path: string, body?: unknown): Promise<BillsApiEnvelope> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    let response: Response;
    try {
      response = await this.fetchImpl(`${INTERSWITCH_BILLS_SANDBOX_BASE}${path}`, {
        method,
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.token}`,
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        signal: controller.signal,
        redirect: "error",
      });
    } catch {
      // Never include request headers, token, or raw provider exception text.
      throw new BillsProviderError("transport", "InterSwitch sandbox request failed or timed out; query status before retrying a payment.");
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) {
      // Do not include provider response body: it may echo sensitive values.
      throw new BillsProviderError("http", `InterSwitch sandbox returned HTTP ${response.status}.`, response.status);
    }
    let parsed: unknown;
    try {
      parsed = await response.json();
    } catch {
      throw new BillsProviderError("invalid_response", "InterSwitch sandbox returned invalid JSON.");
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new BillsProviderError("invalid_response", "InterSwitch sandbox returned an unexpected response shape.");
    }
    return parsed as BillsApiEnvelope;
  }
}
