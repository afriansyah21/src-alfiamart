// Data CONTOH (dummy) untuk pengembangan. Bukan data asli UMKM.
// Aman dijalankan ulang: akun dan produk yang sudah ada tidak diubah.
import bcrypt from 'bcryptjs';
import { pool } from '../src/db.js';

// Akun kasir cabang login dengan username; cabang ditentukan dari username-nya.
// Akun tanpa username (mis. kasir@example.com) dianggap cabang Alfiamart 1.
const users = [
  { name: 'Owner Contoh', email: 'owner@example.com', role: 'owner' },
  { name: 'Kasir Contoh', email: 'kasir@example.com', role: 'kasir' },
  { name: 'Kasir Alfiamart 1', username: 'alfiamartsatu', role: 'kasir' },
  { name: 'Kasir Alfiamart 2', username: 'alfiamartdua', role: 'kasir' },
];
const PASSWORD = 'password123'; // hanya untuk lingkungan pengembangan
const STOK_AWAL_PER_CABANG = 10;

const products = [
  ['BRS-5KG', 'Beras 5 kg', 'Sembako', 'karung', 68000],
  ['MNY-1L', 'Minyak goreng 1 L', 'Sembako', 'botol', 18000],
  ['GLA-1KG', 'Gula pasir 1 kg', 'Sembako', 'kg', 17500],
  ['TLR-1KG', 'Telur ayam 1 kg', 'Sembako', 'kg', 29000],
  ['MIE-GRG', 'Mi instan goreng', 'Makanan', 'pcs', 3500],
  ['KPI-SCT', 'Kopi sachet', 'Minuman', 'pcs', 2000],
  ['TEH-BTL', 'Teh botol 450 ml', 'Minuman', 'botol', 5000],
  ['SBN-BTG', 'Sabun mandi batang', 'Kebersihan', 'pcs', 4500],
  ['RKK-A', 'Rokok contoh A (12 batang)', 'Rokok', 'bungkus', 24000],
  ['RKK-B', 'Rokok contoh B (16 batang)', 'Rokok', 'bungkus', 32000],
];

const hash = await bcrypt.hash(PASSWORD, 10);
for (const u of users) {
  // Tanpa target konflik: melewati akun yang email ATAU username-nya sudah terdaftar
  await pool.query(
    'INSERT INTO users (name, username, email, password_hash, role) VALUES ($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING',
    [u.name, u.username ?? null, u.email ?? null, hash, u.role]);
}
for (const [sku, name, category, unit, price] of products) {
  const { rows } = await pool.query(
    `INSERT INTO products (sku, name, category, unit, price, stock_alfiamart1, stock_alfiamart2, stock)
     VALUES ($1,$2,$3,$4,$5,$6,$6,$7) ON CONFLICT (sku) DO NOTHING RETURNING id`,
    [sku, name, category, unit, price, STOK_AWAL_PER_CABANG, STOK_AWAL_PER_CABANG * 2]);
  if (rows[0]) await pool.query(`INSERT INTO price_history (product_id, old_price, new_price, source) VALUES ($1, NULL, $2, 'import')`, [rows[0].id, price]);
}
console.log('Seed selesai. Login (kata sandi semua akun: ' + PASSWORD + '):');
console.log('  owner@example.com  -> owner');
console.log('  alfiamartsatu      -> kasir cabang Alfiamart 1');
console.log('  alfiamartdua       -> kasir cabang Alfiamart 2');
console.log('  kasir@example.com  -> kasir (dianggap cabang Alfiamart 1)');
await pool.end();
