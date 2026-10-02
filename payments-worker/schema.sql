CREATE TABLE IF NOT EXISTS orders (
  order_id TEXT PRIMARY KEY,
  tg_user_id TEXT NOT NULL,
  plan TEXT NOT NULL CHECK (plan IN ('pro', 'premium')),
  amount INTEGER NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL CHECK (currency = 'XTR'),
  status TEXT NOT NULL CHECK (status IN ('pending', 'paid', 'failed')),
  invoice_url TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_orders_user_created ON orders (tg_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_user_plan_status ON orders (tg_user_id, plan, status, created_at DESC);

CREATE TABLE IF NOT EXISTS payments (
  charge_id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  tg_user_id TEXT NOT NULL,
  plan TEXT NOT NULL CHECK (plan IN ('pro', 'premium')),
  amount INTEGER NOT NULL,
  currency TEXT NOT NULL CHECK (currency = 'XTR'),
  paid_at INTEGER NOT NULL,
  is_recurring INTEGER NOT NULL DEFAULT 0,
  is_first_recurring INTEGER NOT NULL DEFAULT 0,
  subscription_expires_at INTEGER NOT NULL,
  update_id INTEGER,
  FOREIGN KEY (order_id) REFERENCES orders(order_id)
);
CREATE INDEX IF NOT EXISTS idx_payments_user_paid ON payments (tg_user_id, paid_at DESC);

CREATE TABLE IF NOT EXISTS subscriptions (
  tg_user_id TEXT PRIMARY KEY,
  plan TEXT NOT NULL CHECK (plan IN ('pro', 'premium')),
  status TEXT NOT NULL CHECK (status IN ('active', 'expired')),
  expires_at INTEGER NOT NULL,
  auto_renew INTEGER NOT NULL DEFAULT 1 CHECK (auto_renew IN (0, 1)),
  subscription_charge_id TEXT NOT NULL,
  last_charge_id TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS webhook_updates (
  update_id INTEGER PRIMARY KEY,
  processed_at INTEGER NOT NULL
);
