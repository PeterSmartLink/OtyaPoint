export async function saleRequestFingerprint(paymentMethod, lines) {
  const canonical = JSON.stringify({
    version: 1,
    paymentMethod,
    items: [...lines].sort((a, b) =>
      a.productId < b.productId ? -1 : a.productId > b.productId ? 1 : 0
    )
  });
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonical));
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, "0")).join("");
}
