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

let server, base, ownerToken, kasirToken;

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
  await pool.query('TRUNCATE transaction_items, transactions, price_history, products, users RESTART IDENTITY CASCADE');
  const hash = await bcrypt.hash('rahasia123', 4);
  await pool.query(`INSERT INTO users (name,email,password_hash,role) VALUES ('Owner','owner@t.id',$1,'owner'),('Kasir','kasir@t.id',$1,'kasir')`, [hash]);
  server = createApp().listen(0);
  base = `http://localhost:${server.address().port}/api/v1`;
  ownerToken = (await call('POST', '/auth/login', { body: { email: 'owner@t.id', password: 'rahasia123' } })).json.data.token;
  kasirToken = (await call('POST', '/auth/login', { body: { email: 'kasir@t.id', password: 'rahasia123' } })).json.data.token;
});
after(async () => { server.close(); await pool.end(); });

test('login gagal dengan kata sandi salah', async () => {
  const r = await call('POST', '/auth/login', { body: { email: 'owner@t.id', password: 'salah' } });
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
  await call('PATCH', `/products/${minyak.id}`, { token: ownerToken, body: { price: 100000000 } });
  const r = await call('POST', '/transactions', { token: kasirToken, body: {
    client_id: randomUUID(), payment_method: 'tunai', occurred_at: new Date(Date.now() - 1000).toISOString(),
    items: [{ product_id: minyak.id, qty: 1000 }] } });
  assert.equal(r.status, 400);
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
