// Tes integrasi: butuh PostgreSQL. Jalankan dengan:
//   DATABASE_URL=postgres://... JWT_SECRET=x SERVICE_API_KEY=svc npm test
// Tes ini MENGHAPUS isi tabel pada database yang dipakai, jadi gunakan database uji.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';

const { pool } = await import('../src/db.js');
const { createApp } = await import('../src/app.js');

let server, base, ownerToken, kasirToken, secondOwnerToken;
let askAiChatMock;

const call = async (method, path, { token, body, headers = {} } = {}) => {
  const res = await fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  return { status: res.status, json: text ? JSON.parse(text) : null };
};

before(async () => {
  await pool.query(fs.readFileSync(new URL('../../db/schema.sql', import.meta.url), 'utf8'));
  await pool.query('TRUNCATE chat_messages, chat_sessions, transaction_items, transactions, price_history, products, users RESTART IDENTITY CASCADE');
  const hash = await bcrypt.hash('rahasia123', 4);
  await pool.query(`INSERT INTO users (name,email,password_hash,role) VALUES ('Owner','owner@t.id',$1,'owner'),('Kasir','kasir@t.id',$1,'kasir'),('Owner 2','owner2@t.id',$1,'owner')`, [hash]);
  askAiChatMock = async (body) => ({
      status: 'ok',
      data: {
        intent: 'cek_penjualan',
        confidence: 0.9,
        reply: `Jawaban aman untuk: ${body.message}`,
        action: null,
        sources: [{ type: 'guide', id: 'chat-test', title: 'Tes chat' }],
        fallback: false,
      },
      fallback: false,
      error: null,
    });
  server = createApp({ askAiChat: (body) => askAiChatMock(body) }).listen(0);
  base = `http://localhost:${server.address().port}/api/v1`;
  ownerToken = (await call('POST', '/auth/login', { body: { username: 'owner@t.id', password: 'rahasia123' } })).json.data.token;
  kasirToken = (await call('POST', '/auth/login', { body: { username: 'kasir@t.id', password: 'rahasia123' } })).json.data.token;
  secondOwnerToken = (await call('POST', '/auth/login', { body: { username: 'owner2@t.id', password: 'rahasia123' } })).json.data.token;
});
after(async () => { server.close(); await pool.end(); });

test('login gagal dengan kata sandi salah', async () => {
  const r = await call('POST', '/auth/login', { body: { username: 'owner@t.id', password: 'salah' } });
  assert.equal(r.status, 401);
  assert.equal(r.json.error.code, 'UNAUTHORIZED');
});

test('validasi: harga negatif / teks ditolak dengan pesan jelas', async () => {
  for (const price of [-1, 'abc', 1500.5]) {
    const r = await call('POST', '/products', { token: ownerToken, body: { sku: 'X', name: 'X', price } });
    assert.equal(r.status, 400);
    assert.equal(r.json.error.code, 'VALIDATION_ERROR');
  }
  const empty = await call('POST', '/products', { token: ownerToken, body: { sku: 'X', name: '', price: 1000 } });
  assert.equal(empty.status, 400);
});

test('kasir tidak dapat membuat/ubah produk (peran)', async () => {
  const r = await call('POST', '/products', { token: kasirToken, body: { sku: 'K1', name: 'K', price: 1000 } });
  assert.equal(r.status, 403);
  const anon = await call('GET', '/products');
  assert.equal(anon.status, 401);
});

let beras;
test('owner membuat produk, SKU ganda ditolak, riwayat harga tercatat', async () => {
  const r = await call('POST', '/products', { token: ownerToken, body: { sku: 'BRS', name: 'Beras 5 kg', category: 'Sembako', price: 68000 } });
  assert.equal(r.status, 201);
  beras = r.json.data;
  const dup = await call('POST', '/products', { token: ownerToken, body: { sku: 'BRS', name: 'Lain', price: 1000 } });
  assert.equal(dup.status, 409);
  assert.equal(dup.json.error.code, 'SKU_EXISTS');
  const h = await call('GET', `/products/${beras.id}/price-history`, { token: ownerToken });
  assert.equal(h.json.data.length, 1);
  assert.equal(h.json.data[0].old_price, null);
});

test('ubah harga langsung terbaca di katalog publik dan kasir (satu sumber data)', async () => {
  const up = await call('PATCH', `/products/${beras.id}`, { token: ownerToken, body: { price: 70000 } });
  assert.equal(up.json.data.price, 70000);
  const cat = await call('GET', '/catalog?q=beras');
  assert.equal(cat.status, 200);
  assert.equal(cat.json.data[0].price, 70000);
  const kasir = await call('GET', '/products?q=beras', { token: kasirToken });
  assert.equal(kasir.json.data[0].price, 70000);
});

test('pembatalan hanya untuk perubahan terakhir', async () => {
  const hist = (await call('GET', `/products/${beras.id}/price-history`, { token: ownerToken })).json.data;
  const latest = hist[0]; // 68000 -> 70000
  const oldest = hist[hist.length - 1];
  const bad = await call('POST', `/price-history/${oldest.id}/revert`, { token: ownerToken });
  assert.equal(bad.status, 409); // pembuatan produk (old_price null)
  await call('PATCH', `/products/${beras.id}`, { token: ownerToken, body: { price: 71000 } });
  const notLatest = await call('POST', `/price-history/${latest.id}/revert`, { token: ownerToken });
  assert.equal(notLatest.json.error.code, 'NOT_LATEST');
  const newest = (await call('GET', `/products/${beras.id}/price-history`, { token: ownerToken })).json.data[0];
  const ok = await call('POST', `/price-history/${newest.id}/revert`, { token: ownerToken });
  assert.equal(ok.status, 200);
  assert.equal(ok.json.data.price, 70000);
  const again = await call('POST', `/price-history/${newest.id}/revert`, { token: ownerToken });
  assert.equal(again.json.error.code, 'ALREADY_REVERTED');
});

test('impor massal: baris valid masuk, baris salah dilaporkan', async () => {
  const r = await call('POST', '/products/import', { token: ownerToken, body: { rows: [
    { sku: 'MNY', name: 'Minyak 1 L', category: 'Sembako', price: 18000 },
    { sku: 'BRS', name: 'Beras 5 kg', category: 'Sembako', price: 69000 },
    { sku: 'GLA', name: 'Gula 1 kg', price: '' },
    { sku: 'MNY', name: 'Minyak dobel', price: 19000 },
    { name: 'Tanpa SKU', price: 1000 },
  ] } });
  assert.equal(r.status, 200);
  const d = r.json.data;
  assert.deepEqual([d.created, d.updated, d.failed], [1, 1, 3]);
  assert.equal(d.errors.length, 3);
});

let minyak, txClientId;
test('transaksi: total dihitung server, harga snapshot tersimpan', async () => {
  minyak = (await call('GET', '/products?q=minyak', { token: kasirToken })).json.data[0];
  // Produk hasil impor mulai dari stok 0; isi stok cabang 1 (kasir@t.id tanpa username = cabang 1)
  await call('PATCH', `/products/${minyak.id}`, { token: ownerToken, body: { stock_alfiamart1: 10 } });
  const bras = (await call('GET', '/products?q=beras', { token: kasirToken })).json.data[0];
  txClientId = randomUUID();
  const r = await call('POST', '/transactions', { token: kasirToken, body: {
    client_id: txClientId, payment_method: 'qris', occurred_at: new Date(Date.now() - 60000).toISOString(),
    items: [{ product_id: minyak.id, qty: 2 }, { product_id: bras.id, qty: 1, unit_price: 70000 }],
  } });
  assert.equal(r.status, 201);
  assert.equal(r.json.data.total, 2 * 18000 + 70000);
  assert.equal(r.json.data.items.length, 2);
});

test('idempotensi: kirim ulang transaksi yang sama tidak menggandakan data', async () => {
  const body = { client_id: txClientId, payment_method: 'qris', occurred_at: new Date(Date.now() - 60000).toISOString(), items: [{ product_id: minyak.id, qty: 2 }] };
  const r = await call('POST', '/transactions', { token: kasirToken, body });
  assert.equal(r.status, 200);
  assert.equal(r.json.meta.duplicate, true);
  const n = (await pool.query('SELECT count(*)::int AS n FROM transactions')).rows[0].n;
  assert.equal(n, 1);
});

test('sinkronisasi batch: synced, duplicate, failed dilaporkan per transaksi', async () => {
  const newId = randomUUID();
  const r = await call('POST', '/transactions/batch', { token: kasirToken, body: { transactions: [
    { client_id: newId, payment_method: 'tunai', occurred_at: new Date(Date.now() - 1000).toISOString(), items: [{ product_id: minyak.id, qty: 1 }] },
    { client_id: txClientId, payment_method: 'qris', occurred_at: new Date(Date.now() - 60000).toISOString(), items: [{ product_id: minyak.id, qty: 2 }] },
    { client_id: randomUUID(), payment_method: 'tunai', occurred_at: new Date(Date.now() - 1000).toISOString(), items: [{ product_id: randomUUID(), qty: 1 }] },
    { client_id: randomUUID(), payment_method: 'kartu', occurred_at: new Date().toISOString(), items: [] },
  ] } });
  assert.equal(r.status, 200);
  assert.deepEqual(r.json.data.results.map((x) => x.status), ['synced', 'duplicate', 'failed', 'failed']);
  assert.deepEqual(r.json.data.summary, { synced: 1, duplicate: 1, failed: 2 });
});

test('total melebihi batas ditolak, bukan error server', async () => {
  // Stok dibuat cukup agar yang diuji benar-benar batas total, bukan stok kurang
  await call('PATCH', `/products/${minyak.id}`, { token: ownerToken, body: { price: 100000000, stock_alfiamart1: 1000 } });
  const r = await call('POST', '/transactions', { token: kasirToken, body: {
    client_id: randomUUID(), payment_method: 'tunai', occurred_at: new Date(Date.now() - 1000).toISOString(),
    items: [{ product_id: minyak.id, qty: 1000 }] } });
  assert.equal(r.status, 400);
  assert.equal(r.json.error.code, 'VALIDATION_ERROR');
});

test('ekspor untuk DS/AE: butuh kunci layanan atau owner', async () => {
  assert.equal((await call('GET', '/export/products')).status, 401);
  assert.equal((await call('GET', '/export/products', { token: kasirToken })).status, 403);
  const withKey = await call('GET', '/export/transactions', { headers: { 'X-Service-Key': process.env.SERVICE_API_KEY } });
  assert.equal(withKey.status, 200);
  assert.ok(withKey.json.data.length >= 3);
  assert.ok('category' in withKey.json.data[0] && 'subtotal' in withKey.json.data[0]);
});

test('kasir hanya melihat transaksinya sendiri; endpoint tak dikenal -> 404', async () => {
  const mine = await call('GET', '/transactions', { token: kasirToken });
  assert.equal(mine.status, 200);
  const unknown = await call('GET', '/tidak-ada');
  assert.equal(unknown.status, 404);
});

test('waktu transaksi: toleransi jam perangkat 5 menit, masa depan ditolak', async () => {
  const mk = (ms) => ({ client_id: randomUUID(), payment_method: 'tunai', occurred_at: new Date(Date.now() + ms).toISOString(), items: [{ product_id: minyak.id, qty: 1, unit_price: 1000 }] });
  const slightly = await call('POST', '/transactions', { token: kasirToken, body: mk(60 * 1000) });
  assert.equal(slightly.status, 201);
  const future = await call('POST', '/transactions', { token: kasirToken, body: mk(60 * 60 * 1000) });
  assert.equal(future.status, 400);
});

test('stok cabang: berkurang sesuai cabang kasir, stok kurang ditolak, habis = nonaktif', async () => {
  const hash = await bcrypt.hash('rahasia123', 4);
  await pool.query(`INSERT INTO users (name,username,password_hash,role) VALUES ('Kasir 2','alfiamartdua',$1,'kasir')`, [hash]);
  const login = await call('POST', '/auth/login', { body: { username: 'AlfiamartDua', password: 'rahasia123' } });
  assert.equal(login.status, 200);
  const cabang2Token = login.json.data.token;

  const created = await call('POST', '/products', { token: ownerToken, body: { sku: 'TEH', name: 'Teh botol', price: 5000, stock_alfiamart1: 3, stock_alfiamart2: 2 } });
  assert.equal(created.json.data.stock, 5); // total selalu = cabang 1 + cabang 2
  const id = created.json.data.id;
  const sell = (token, qty) => call('POST', '/transactions', { token, body: {
    client_id: randomUUID(), payment_method: 'tunai', occurred_at: new Date(Date.now() - 1000).toISOString(),
    items: [{ product_id: id, qty }] } });
  const stokNow = async () => {
    const p = (await call('GET', `/products/${id}`, { token: ownerToken })).json.data;
    return [p.stock_alfiamart1, p.stock_alfiamart2, p.stock, p.is_active];
  };

  assert.equal((await sell(cabang2Token, 2)).status, 201);
  assert.deepEqual(await stokNow(), [3, 0, 3, true]); // hanya stok cabang 2 yang berkurang
  assert.equal((await sell(cabang2Token, 1)).json.error.code, 'INSUFFICIENT_STOCK');
  assert.equal((await sell(kasirToken, 3)).status, 201);
  assert.deepEqual(await stokNow(), [0, 0, 0, false]);
});

let chatSessionId;

test('chat owner sukses, pesan dan jawaban tersimpan, history dapat dibaca', async () => {
  chatSessionId = randomUUID();
  const sent = await call('POST', '/chat', {
    token: ownerToken,
    body: { message: 'Omzet kemarin berapa?', session_id: chatSessionId, channel: 'web' },
  });

  assert.equal(sent.status, 200);
  assert.equal(sent.json.data.session_id, chatSessionId);
  assert.equal(sent.json.data.reply, 'Jawaban aman untuk: Omzet kemarin berapa?');
  assert.equal(sent.json.data.fallback, false);

  const history = await call('GET', `/chat/sessions/${chatSessionId}`, { token: ownerToken });
  assert.equal(history.status, 200);
  assert.equal(history.json.data.session_id, chatSessionId);
  assert.equal(history.json.data.messages.length, 2);
  assert.deepEqual(history.json.data.messages.map((message) => message.role), ['user', 'assistant']);
  assert.equal(history.json.data.messages[0].content, 'Omzet kemarin berapa?');
  assert.equal(history.json.data.messages[1].intent, 'cek_penjualan');
});

test('chat membatasi role dan validasi input', async () => {
  const noToken = await call('POST', '/chat', {
    body: { message: 'Halo', session_id: randomUUID(), channel: 'web' },
  });
  assert.equal(noToken.status, 401);

  const cashier = await call('POST', '/chat', {
    token: kasirToken,
    body: { message: 'Halo', session_id: randomUUID(), channel: 'web' },
  });
  assert.equal(cashier.status, 403);

  const invalidMessage = await call('POST', '/chat', {
    token: ownerToken,
    body: { message: '   ', session_id: randomUUID(), channel: 'web' },
  });
  assert.equal(invalidMessage.status, 400);
  assert.equal(invalidMessage.json.error.code, 'VALIDATION_ERROR');

  const invalidSession = await call('POST', '/chat', {
    token: ownerToken,
    body: { message: 'Halo', session_id: 'bukan-uuid', channel: 'web' },
  });
  assert.equal(invalidSession.status, 400);

  const invalidChannel = await call('POST', '/chat', {
    token: ownerToken,
    body: { message: 'Halo', session_id: randomUUID(), channel: 'sms' },
  });
  assert.equal(invalidChannel.status, 400);
});

test('owner tidak dapat membaca session milik owner lain', async () => {
  const forbidden = await call('GET', `/chat/sessions/${chatSessionId}`, { token: secondOwnerToken });
  assert.equal(forbidden.status, 404);
  assert.equal(forbidden.json.error.code, 'NOT_FOUND');
});

test('fallback AI tersimpan dan pesan owner tetap tersimpan', async () => {
  const fallbackSession = randomUUID();
  const previousMock = askAiChatMock;
  askAiChatMock = async () => ({
    status: 'lambat',
    data: {
      intent: 'di_luar_konteks',
      confidence: 0,
      reply: 'Jawaban membutuhkan waktu lebih lama dari biasanya.',
      action: null,
      sources: [],
      fallback: true,
    },
    fallback: true,
    error: { code: 'AI_TIMEOUT' },
  });

  try {
    const sent = await call('POST', '/chat', {
      token: ownerToken,
      body: { message: 'Pesan sebelum timeout', session_id: fallbackSession, channel: 'web' },
    });
    assert.equal(sent.status, 200);
    assert.equal(sent.json.data.fallback, true);

    const history = await call('GET', `/chat/sessions/${fallbackSession}`, { token: ownerToken });
    assert.equal(history.status, 200);
    assert.equal(history.json.data.messages.length, 2);
    assert.equal(history.json.data.messages[0].content, 'Pesan sebelum timeout');
    assert.equal(history.json.data.messages[1].fallback, true);
  } finally {
    askAiChatMock = previousMock;
  }
});
