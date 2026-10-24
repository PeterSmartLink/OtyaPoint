import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const route = readFileSync(new URL('../../app/api/bridge/products/route.ts', import.meta.url), 'utf8')
const dashboard = readFileSync(new URL('../../app/dashboard.tsx', import.meta.url), 'utf8')

test('Cloudflare bridge forwards the HttpOnly Otya access token without minting a local JWT', () => {
  assert.match(route, /cookies\(\)/)
  assert.match(route, /jar\.get\("otya_access_token"\)/)
  assert.match(route, /Authorization:.*accessToken/)
  assert.doesNotMatch(route, /createHmac|makeToken|OMNIPOINT_API_HMAC_SECRET/)
  assert.doesNotMatch(route, /requireStaff\(/)
})

test('bridge fails closed when the API URL or Otya access token is missing', () => {
  assert.match(route, /cloudflare_bridge_not_configured/)
  assert.match(route, /otya_auth_required/)
  assert.match(route, /status: 503/)
  assert.match(route, /status: 401/)
  assert.match(route, /cache: "no-store"/)
})

test('bridge never treats browser-provided role or identity fields as authorization', () => {
  assert.doesNotMatch(route, /request\.json\(|request\.headers\.get\(["']x-role/i)
  assert.match(route, /Authorization:.*accessToken/)
})

test('inventory UI never silently substitutes demo products when the live API fails', () => {
  assert.match(dashboard, /setInventorySource\("unavailable"\)/)
  assert.match(dashboard, /setProducts\(\[\]\)/)
  assert.doesNotMatch(dashboard, /setProducts\(initialProducts\)/)
  assert.match(dashboard, /sample products are intentionally hidden/)
})
