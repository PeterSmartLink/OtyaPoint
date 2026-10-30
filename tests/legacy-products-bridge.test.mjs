import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const route = readFileSync(new URL("../app/api/bridge/products/route.ts", import.meta.url), "utf8");

test("legacy products bridge fails closed until Otya Auth session contract is implemented", () => {
  assert.match(route, /cloudflare_bridge_identity_contract_unverified/);
  assert.match(route, /status:\s*503/);
  assert.match(route, /Cache-Control.*no-store/);
  assert.doesNotMatch(route, /createHmac|makeToken|OMNIPOINT_API_HMAC_SECRET|OMNIPOINT_CLOUDFLARE_API_URL/);
  assert.doesNotMatch(route, /requireStaff|fetch\(/);
});
