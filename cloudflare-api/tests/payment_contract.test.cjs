const test = require("node:test");
const assert = require("node:assert/strict");
const {
  validatePaymentRequest,
} = require("/tmp/omnipoint-payment-tests/contracts.js");
const {
  DisabledPaymentProvider,
} = require("/tmp/omnipoint-payment-tests/disabled-provider.js");

function validRequest(overrides = {}) {
  return {
    transactionId: "omni-txn-001",
    idempotencyKey: "idem-001",
    service: "SHOP_CHECKOUT",
    amountMinor: 250000,
    currency: "UGX",
    description: "Shop purchase",
    ...overrides,
  };
}

test("accepts a valid UGX payment request using integer minor units", () => {
  assert.equal(validatePaymentRequest(validRequest()), null);
});

test("rejects blank transaction IDs and idempotency keys", () => {
  assert.equal(validatePaymentRequest(validRequest({ transactionId: " " })), "transaction_id_required");
  assert.equal(validatePaymentRequest(validRequest({ idempotencyKey: " " })), "idempotency_key_required");
});

test("rejects zero, negative, fractional, and unsafe amounts", () => {
  for (const amountMinor of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1, NaN]) {
    assert.equal(
      validatePaymentRequest(validRequest({ amountMinor })),
      "amount_must_be_positive_integer_minor_units",
    );
  }
});

test("rejects unsupported currency and invalid descriptions at runtime", () => {
  assert.equal(validatePaymentRequest(validRequest({ currency: "USD" })), "unsupported_currency");
  assert.equal(validatePaymentRequest(validRequest({ description: " " })), "invalid_description");
  assert.equal(validatePaymentRequest(validRequest({ description: "x".repeat(241) })), "invalid_description");
});

test("disabled provider advertises no capabilities and never reports success", async () => {
  const provider = new DisabledPaymentProvider();
  assert.equal(provider.id, "disabled");
  assert.ok(Object.values(provider.getCapabilities()).every((enabled) => enabled === false));
  const result = await provider.initiatePayment(validRequest());
  assert.equal(result.status, "FAILED");
  assert.equal(result.reasonCode, "payment_provider_not_configured");
  await assert.rejects(() => provider.checkStatus("provider-ref"), /payment_provider_not_configured/);
  await assert.rejects(
    () => provider.verifyCallback(new Request("https://example.invalid/callback", { method: "POST" })),
    /payment_provider_not_configured/,
  );
});

const {
  QuicktellerSandboxCheckout,
} = require("/tmp/omnipoint-payment-tests/quickteller-sandbox.js");

function sandboxConfig(overrides = {}) {
  return {
    merchantCode: "TEST-MERCHANT",
    payItemId: "TEST-ITEM",
    siteRedirectUrl: "https://omnipoint.example.invalid/payment-return",
    customerEmail: "sandbox@example.invalid",
    ...overrides,
  };
}

test("Quickteller adapter only prepares a fixed sandbox POST form and never claims success", async () => {
  const provider = new QuicktellerSandboxCheckout(sandboxConfig());
  const result = await provider.initiatePayment(validRequest());
  assert.equal(result.status, "PENDING");
  assert.equal(result.provider, "quickteller-sandbox");
  assert.equal(result.checkoutForm.action, "https://newwebpay-sandbox.interswitchng.com/collections/w/pay");
  assert.equal(result.checkoutForm.method, "POST");
  assert.equal(result.checkoutForm.fields.txn_ref, "omni-txn-001");
  assert.equal(result.checkoutForm.fields.amount, "250000");
  assert.equal(result.checkoutForm.fields.currency, "800");
  assert.ok(Object.values(provider.getCapabilities()).every((enabled) => enabled === false));
  await assert.rejects(() => provider.checkStatus("omni-txn-001"), /requery_not_implemented/);
  await assert.rejects(
    () => provider.verifyCallback(new Request("https://example.invalid/callback", { method: "POST" })),
    /callback_verification_not_implemented/,
  );
});

test("Quickteller sandbox adapter rejects non-checkout services and unsafe redirect configuration", async () => {
  const provider = new QuicktellerSandboxCheckout(sandboxConfig());
  assert.equal(
    (await provider.initiatePayment(validRequest({ service: "AGENCY_CASH_OUT" }))).reasonCode,
    "sandbox_adapter_shop_checkout_only",
  );
  const unsafeRedirect = new QuicktellerSandboxCheckout(sandboxConfig({ siteRedirectUrl: "http://insecure.example.invalid/return" }));
  assert.equal(
    (await unsafeRedirect.initiatePayment(validRequest())).reasonCode,
    "redirect_url_must_use_https",
  );
});
