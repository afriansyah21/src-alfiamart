-- Skema database SRC Alfiamart (satu sumber data tunggal)
-- PostgreSQL 13+ (gen_random_uuid() bawaan). Aman dijalankan ulang.

CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('owner', 'kasir')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS products (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku         TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  category    TEXT NOT NULL DEFAULT 'Lainnya',
  unit        TEXT NOT NULL DEFAULT 'pcs',
  price       INTEGER NOT NULL CHECK (price >= 0),          -- rupiah, tanpa desimal
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,                -- false = tidak tampil di kasir/katalog
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_products_category ON products (category);
CREATE INDEX IF NOT EXISTS idx_products_name ON products (lower(name));

-- Riwayat perubahan harga: dasar fitur riwayat, pratinjau, dan pembatalan
CREATE TABLE IF NOT EXISTS price_history (
  id          BIGSERIAL PRIMARY KEY,
  product_id  UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  old_price   INTEGER,                                      -- NULL saat produk baru dibuat
  new_price   INTEGER NOT NULL CHECK (new_price >= 0),
  changed_by  UUID REFERENCES users(id),
  source      TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'import', 'revert')),
  reverted    BOOLEAN NOT NULL DEFAULT FALSE,
  changed_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_price_history_product ON price_history (product_id, changed_at DESC);

-- client_id = kunci idempotensi dari kasir (UUID dibuat di perangkat).
-- Transaksi yang dikirim ulang saat sinkronisasi offline tidak akan tersimpan ganda.
CREATE TABLE IF NOT EXISTS transactions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id       UUID NOT NULL UNIQUE,
  cashier_id      UUID NOT NULL REFERENCES users(id),
  payment_method  TEXT NOT NULL CHECK (payment_method IN ('tunai', 'qris', 'transfer')),
  total           INTEGER NOT NULL CHECK (total >= 0),
  occurred_at     TIMESTAMPTZ NOT NULL,                     -- waktu transaksi di perangkat kasir
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()        -- waktu diterima server (sinkron)
);
CREATE INDEX IF NOT EXISTS idx_transactions_occurred ON transactions (occurred_at DESC);

CREATE TABLE IF NOT EXISTS transaction_items (
  id              BIGSERIAL PRIMARY KEY,
  transaction_id  UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  product_id      UUID NOT NULL REFERENCES products(id),
  product_name    TEXT NOT NULL,                            -- salinan nama saat transaksi
  unit_price      INTEGER NOT NULL CHECK (unit_price >= 0), -- salinan harga saat transaksi
  qty             INTEGER NOT NULL CHECK (qty > 0),
  subtotal        INTEGER NOT NULL CHECK (subtotal >= 0)
);
CREATE INDEX IF NOT EXISTS idx_items_transaction ON transaction_items (transaction_id);

-- ---------- Akun cabang & stok per cabang ----------
-- Ditulis sebagai ALTER ... IF NOT EXISTS agar database yang sudah ada ikut diperbarui
-- cukup dengan menjalankan ulang `npm run db:init` (data lama tidak terhapus).

-- Login memakai username (akun kasir cabang: alfiamartsatu, alfiamartdua) atau email (akun lama).
-- Cabang kasir ditentukan dari username-nya (lihat backend/src/routes/transactions.js).
ALTER TABLE users ADD COLUMN IF NOT EXISTS username TEXT;
ALTER TABLE users ALTER COLUMN username DROP NOT NULL;
ALTER TABLE users ALTER COLUMN email DROP NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users (lower(username));

-- Stok per cabang. `stock` = stock_alfiamart1 + stock_alfiamart2, dijaga oleh backend.
-- Produk yang baru masuk lewat impor CSV mulai dari stok 0.
ALTER TABLE products ADD COLUMN IF NOT EXISTS stock_alfiamart1 INTEGER NOT NULL DEFAULT 0 CHECK (stock_alfiamart1 >= 0);
ALTER TABLE products ADD COLUMN IF NOT EXISTS stock_alfiamart2 INTEGER NOT NULL DEFAULT 0 CHECK (stock_alfiamart2 >= 0);
ALTER TABLE products ADD COLUMN IF NOT EXISTS stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0);

-- Riwayat percakapan owner dan jawaban AI
CREATE TABLE IF NOT EXISTS chat_sessions (
  id UUID PRIMARY KEY,
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_owner ON chat_sessions (owner_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS chat_messages (
  id BIGSERIAL PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL CHECK (char_length(content) > 0),
  intent TEXT,
  confidence DOUBLE PRECISION CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
  action JSONB,
  sources JSONB NOT NULL DEFAULT '[]'::jsonb,
  fallback BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_chat_messages_session_created ON chat_messages (session_id, created_at ASC);
