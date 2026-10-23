import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import ts from 'typescript'
import { webcrypto } from 'node:crypto'

globalThis.crypto ??= webcrypto

const source = await readFile(resolve('cloudflare-api/src/index.ts'), 'utf8')
const js = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 }
}).outputText
const worker = (await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`)).default
const secret = 'test-only-omnipoint-hmac-secret-32-bytes-minimum'

function fakeDb({ health = { ok: 1 }, products = [], failHealth = false, failBatch = false } = {}) {
  const calls = []
  const db = {
    calls,
    prepare(sql) {
      const statement = {
        sql,
        values: [],
        bind(...values) { this.values = values; return this },
        async first() {
          calls.push({ kind: 'first', sql, values: this.values })
          if (failHealth) throw new Error('database unavailable')
          return health
        },
        async all() {
          calls.push({ kind: 'all', sql, values: this.values })
          return { results: products }
        },
        async run() {
          calls.push({ kind: 'run', sql, values: this.values })
          return { success: true }
        }
      }
      return statement
    },
    async batch(statements) {
      calls.push({ kind: 'batch', statements: statements.map(s => ({ sql: s.sql, values: s.values })) })
      if (failBatch) throw new Error('atomic batch failed')
      return [{ success: true }, { success: true }]
    }
  }
  return db
}

function b64url(value) {
  return Buffer.from(value).toString('base64url')
}

async function token(overrides = {}) {
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const claims = {
    sub: 'test-staff-1',
    role: 'MANAGER',
    exp: Math.floor(Date.now() / 1000) + 300,
    iss: 'omnipoint',
    aud: 'omnipoint-api',
    ...overrides
  }
  const payload = b64url(JSON.stringify(claims))
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const signature = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${header}.${payload}`)))
  return `${header}.${payload}.${b64url(signature)}`
}

function request(path, { method = 'GET', bearer, headers = {}, body } = {}) {
  const allHeaders = new Headers(headers)
  if (bearer) allHeaders.set('authorization', `Bearer ${bearer}`)
  return new Request(`https://omnipoint-test.invalid${path}`, { method, headers: allHeaders, body })
}

test('health endpoint is read-only and does not require auth', async () => {
  const DB = fakeDb()
  const response = await worker.fetch(request('/health'), { DB })
  assert.equal(response.status, 200)
  assert.equal((await response.json()).status, 'ok')
  assert.equal(DB.calls.length, 1)
  assert.equal(DB.calls[0].kind, 'first')
})

test('health endpoint reports database outage without exposing internals', async () => {
  const response = await worker.fetch(request('/health'), { DB: fakeDb({ failHealth: true }) })
  assert.equal(response.status, 503)
  assert.deepEqual(await response.json(), { service: 'omnipoint-migration-api', status: 'database_unavailable' })
})

test('protected routes fail closed when HMAC secret is missing', async () => {
  const response = await worker.fetch(request('/api/products'), { DB: fakeDb() })
  assert.equal(response.status, 503)
  assert.deepEqual(await response.json(), { error: 'auth_not_configured' })
})

test('protected routes reject missing, malformed, expired and wrong-audience tokens', async t => {
  const cases = [
    ['missing token', undefined],
    ['malformed token', 'not-a-token'],
    ['expired token', await token({ exp: Math.floor(Date.now() / 1000) - 1 })],
    ['wrong audience', await token({ aud: 'other-api' })],
    ['wrong issuer', await token({ iss: 'other-issuer' })],
    ['Otya Auth token shape without OmniPoint role and audience is rejected', await token({ role: undefined, iss: undefined, aud: undefined })]
  ]
  for (const [name, bearer] of cases) await t.test(name, async () => {
    const response = await worker.fetch(request('/api/products', { bearer }), { DB: fakeDb(), AUTH_HMAC_SECRET: secret })
    assert.equal(response.status, 401)
    assert.deepEqual(await response.json(), { error: 'unauthorized' })
  })
})

test('authenticated product list is bounded and returns the request id', async () => {
  const DB = fakeDb({ products: [{ id: 'p1', sku: 'SKU-1', name: 'Test phone' }] })
  const response = await worker.fetch(request('/api/products', { bearer: await token(), headers: { 'cf-ray': 'test-request-1' } }), { DB, AUTH_HMAC_SECRET: secret })
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { data: [{ id: 'p1', sku: 'SKU-1', name: 'Test phone' }], requestId: 'test-request-1' })
  assert.match(DB.calls[0].sql, /LIMIT 200/)
})

test('attendant cannot create products', async () => {
  const DB = fakeDb()
  const response = await worker.fetch(request('/api/products', {
    method: 'POST',
    bearer: await token({ role: 'ATTENDANT' }),
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ sku: 'SKU-1', name: 'Phone', costPrice: 10, sellingPrice: 15 })
  }), { DB, AUTH_HMAC_SECRET: secret })
  assert.equal(response.status, 403)
  assert.equal(DB.calls.length, 0)
})

test('product creation rejects non-JSON, malformed JSON and invalid fields', async t => {
  const cases = [
    ['wrong content type', { headers: { 'content-type': 'text/plain' }, body: '{}' }, 415],
    ['malformed JSON', { headers: { 'content-type': 'application/json' }, body: '{' }, 400],
    ['invalid product', { headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sku: '', name: 'Phone', costPrice: 10, sellingPrice: 15 }) }, 400]
  ]
  for (const [name, options, status] of cases) await t.test(name, async () => {
    const DB = fakeDb()
    const response = await worker.fetch(request('/api/products', { method: 'POST', bearer: await token(), ...options }), { DB, AUTH_HMAC_SECRET: secret })
    assert.equal(response.status, status)
    assert.equal(DB.calls.length, 0)
  })
})

test('product creation submits product and audit event in one atomic D1 batch', async () => {
  const DB = fakeDb()
  const response = await worker.fetch(request('/api/products', {
    method: 'POST',
    bearer: await token(),
    headers: { 'content-type': 'application/json', 'cf-ray': 'create-request-1' },
    body: JSON.stringify({ sku: 'SKU-1', name: 'Phone', costPrice: 10, sellingPrice: 15 })
  }), { DB, AUTH_HMAC_SECRET: secret })
  assert.equal(response.status, 201)
  const payload = await response.json()
  assert.equal(payload.sku, 'SKU-1')
  assert.equal(DB.calls.length, 1)
  assert.equal(DB.calls[0].kind, 'batch')
  assert.equal(DB.calls[0].statements.length, 2)
  assert.match(DB.calls[0].statements[0].sql, /INSERT INTO Product/)
  assert.match(DB.calls[0].statements[1].sql, /INSERT INTO AuditEvent/)
  assert.equal(DB.calls[0].statements[1].values[1], 'test-staff-1')
})

test('sale and agency transaction endpoints remain disabled', async t => {
  for (const path of ['/api/sales', '/api/agency-transactions', '/api/reconciliation']) await t.test(path, async () => {
    const DB = fakeDb()
    const response = await worker.fetch(request(path, { method: 'POST', bearer: await token() }), { DB, AUTH_HMAC_SECRET: secret })
    assert.equal(response.status, 501)
    assert.equal(DB.calls.length, 0)
    assert.ok(['sales_posting_not_enabled', 'provider_adapter_required', 'reconciliation_not_enabled'].includes((await response.json()).error))
  })
})
