// Data CONTOH (dummy) untuk pengembangan. Bukan data asli UMKM.
import bcrypt from 'bcryptjs';
import { pool } from '../src/db.js';

const users = [
  { name: 'Owner Contoh', email: 'owner@example.com', role: 'owner' },
  { name: 'Kasir Contoh', email: 'kasir@example.com', role: 'kasir' },
];
const PASSWORD = 'password123'; // hanya untuk lingkungan pengembangan

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
  await pool.query(
    'INSERT INTO users (name,email,password_hash,role) VALUES ($1,$2,$3,$4) ON CONFLICT (email) DO NOTHING', [u.name, u.email, hash, u.role]);
}
for (const [sku, name, category, unit, price] of products) {
  const { rows } = await pool.query(
    'INSERT INTO products (sku,name,category,unit,price) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (sku) DO NOTHING RETURNING id',
    [sku, name, category, unit, price]);
  if (rows[0]) await pool.query(`INSERT INTO price_history (product_id, old_price, new_price, source) VALUES ($1, NULL, $2, 'import')`, [rows[0].id, price]);
}
console.log(`Seed selesai. Login: owner@example.com / kasir@example.com, kata sandi: ${PASSWORD}`);
await pool.end();
