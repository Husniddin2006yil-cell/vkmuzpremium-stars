import test from "node:test";
import assert from "node:assert/strict";
import worker from "../worker.js";

const BOT_TOKEN = "local_test_token_for_mock_requests_only";
const encoder = new TextEncoder();

async function hmac(keyBytes, data) {
  const key = await crypto.subtle.importKey("raw", keyBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(data)));
}

function hex(bytes) {
  return Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");
}

async function signedInitData(userId = 12345) {
  const params = new URLSearchParams();
  params.set("auth_date", String(Math.floor(Date.now() / 1000)));
  params.set("user", JSON.stringify({ id: userId, first_name: "Тест" }));
  const checkString = Array.from(params.entries())
    .sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
  const secret = await hmac(encoder.encode("WebAppData"), BOT_TOKEN);
  params.set("hash", hex(await hmac(secret, checkString)));
  return params.toString();
}

async function webhookSecret() {
  const digest = await hmac(encoder.encode("VKMUSICX Telegram webhook v1"), BOT_TOKEN);
  return Buffer.from(digest).toString("base64url");
}

function jsonRequest(path, body, headers = {}) {
  return new Request(`https://worker.test${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

function makeDb({ first = async () => null, run = async () => ({ meta: { changes: 1 } }), batch = async () => [] } = {}) {
  const calls = [];
  const db = {
    calls,
    prepare(sql) {
      const statement = {
        sql,
        values: [],
        bind(...values) { this.values = values; return this; },
        async first() { calls.push({ kind: "first", sql: this.sql, values: this.values }); return first(this.sql, this.values); },
        async run() { calls.push({ kind: "run", sql: this.sql, values: this.values }); return run(this.sql, this.values); },
      };
      return statement;
    },
    async batch(statements) {
      const normalized = statements.map(s => ({ sql: s.sql, values: s.values }));
      calls.push({ kind: "batch", statements: normalized });
      return batch(normalized);
    },
  };
  return db;
}

function mockTelegram(t, handler) {
  const previous = globalThis.fetch;
  globalThis.fetch = async (input, init = {}) => {
    const method = new URL(input).pathname.split("/").pop();
    const payload = init.body ? JSON.parse(init.body) : {};
    const result = await handler(method, payload);
    return new Response(JSON.stringify({ ok: true, result }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };
  t.after(() => { globalThis.fetch = previous; });
}

test("basic health reports configured services without exposing credentials", async () => {
  const response = await worker.fetch(new Request("https://worker.test/health"), {
    DB: makeDb(), BOT_TOKEN,
  });
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.configured, true);
  assert.equal(JSON.stringify(body).includes(BOT_TOKEN), false);
});

test("invalid Mini App initData is rejected before database access", async () => {
  const db = makeDb({ first: async () => { throw new Error("DB must not be queried"); } });
  const response = await worker.fetch(jsonRequest("/api/status", { initData: "invalid" }), { DB: db, BOT_TOKEN });
  assert.equal(response.status, 401);
  assert.equal(db.calls.length, 0);
});

test("valid signed initData creates a recurring XTR invoice at the fixed plan price", async t => {
  const db = makeDb({
    first: async sql => {
      if (sql.includes("SELECT COUNT(*)")) return { total: 0 };
      return null;
    },
  });
  let invoicePayload;
  mockTelegram(t, async (method, payload) => {
    assert.equal(method, "createInvoiceLink");
    invoicePayload = payload;
    return "https://t.me/$local-test-invoice";
  });

  const response = await worker.fetch(jsonRequest("/api/create-invoice", {
    plan: "pro",
    initData: await signedInitData(),
  }), { DB: db, BOT_TOKEN });
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.stars, 99);
  assert.equal(body.invoiceUrl, "https://t.me/$local-test-invoice");
  assert.equal(invoicePayload.currency, "XTR");
  assert.equal(invoicePayload.provider_token, "");
  assert.equal(invoicePayload.subscription_period, 2_592_000);
  assert.deepEqual(invoicePayload.prices, [{ label: "PRO / 30 дней", amount: 99 }]);
});

test("Telegram diagnostic checks D1, bot identity, and webhook URL without changing it", async t => {
  const db = makeDb({ first: async () => ({ ok: 1 }) });
  const calls = [];
  mockTelegram(t, async method => {
    calls.push(method);
    if (method === "getMe") return { id: 123, username: "VkMuzicXbot" };
    if (method === "getWebhookInfo") return { url: "https://worker.test/telegram/webhook" };
    throw new Error(`Unexpected method: ${method}`);
  });

  const response = await worker.fetch(new Request("https://worker.test/health?check=telegram"), { DB: db, BOT_TOKEN });
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.database, true);
  assert.equal(body.botUsername, "VkMuzicXbot");
  assert.equal(body.webhookMatches, true);
  assert.deepEqual(calls.sort(), ["getMe", "getWebhookInfo"].sort());
});

test("a duplicate successful-payment charge cannot activate a second time", async t => {
  const db = makeDb({
    first: async sql => {
      if (sql.includes("SELECT update_id")) return null;
      if (sql.includes("SELECT order_id")) return {
        order_id: "order-1", tg_user_id: "12345", plan: "pro", amount: 99, currency: "XTR",
      };
      if (sql.includes("SELECT subscription_charge_id")) return null;
      return null;
    },
    batch: async statements => {
      assert.match(statements[1].sql, /WHERE changes\(\) = 1/);
      return [{ meta: { changes: 0 } }, { meta: { changes: 0 } }, { meta: { changes: 0 } }];
    },
  });
  mockTelegram(t, async () => { throw new Error("Duplicate charge must not send another receipt"); });

  const update = {
    update_id: 9001,
    message: {
      from: { id: 12345 },
      chat: { id: 12345 },
      successful_payment: {
        invoice_payload: "order-1",
        telegram_payment_charge_id: "charge-1",
        currency: "XTR",
        total_amount: 99,
        is_recurring: true,
        is_first_recurring: true,
        subscription_expiration_date: Math.floor(Date.now() / 1000) + 2_592_000,
      },
    },
  };
  const response = await worker.fetch(jsonRequest("/telegram/webhook", update, {
    "X-Telegram-Bot-Api-Secret-Token": await webhookSecret(),
  }), { DB: db, BOT_TOKEN });
  assert.equal(response.status, 200);
  assert.equal(await response.text(), "ok");
  assert.equal(db.calls.filter(call => call.kind === "batch").length, 1);
});
