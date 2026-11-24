import { Router } from 'express';
import { query, withTransaction } from '../db.js';
import { validate } from '../middleware/validate.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { conflict, notFound } from '../errors.js';
import {
  productCreateSchema, productUpdateSchema, productListQuery, idParam, historyIdParam, importSchema, importRowSchema,
} from '../schemas.js';

const FIELDS = 'id, sku, name, category, unit, price, stock, stock_alfiamart1, stock_alfiamart2, is_active, created_at, updated_at';

async function searchProducts({ q, category, page, limit }, { onlyActive }) {
  const where = [];
  const params = [];
  if (onlyActive) where.push('is_active = TRUE');
  if (q) { params.push(`%${q.toLowerCase()}%`); where.push(`(lower(name) LIKE $${params.length} OR lower(sku) LIKE $${params.length})`); }
  if (category) { params.push(category); where.push(`category = $${params.length}`); }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const total = Number((await query(`SELECT count(*) FROM products ${clause}`, params)).rows[0].count);
  params.push(limit, (page - 1) * limit);
  const { rows } = await query(
    `SELECT ${FIELDS} FROM products ${clause} ORDER BY name ASC LIMIT $${params.length - 1} OFFSET $${params.length}`, params);
  return { rows, meta: { page, limit, total } };
}

// ---------- Katalog publik (pelanggan, tanpa login) ----------
export const catalogRouter = Router();

catalogRouter.get('/', validate(productListQuery, 'query'), async (req, res, next) => {
  try {
    const { rows, meta } = await searchProducts(req.valid.query, { onlyActive: true });
    res.json({ success: true, data: rows.map(({ is_active, created_at, ...p }) => p), meta });
  } catch (err) { next(err); }
});

catalogRouter.get('/categories', async (_req, res, next) => {
  try {
    const { rows } = await query('SELECT category, count(*)::int AS total FROM products WHERE is_active = TRUE GROUP BY category ORDER BY category');
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

// ---------- Produk (owner & kasir) ----------
const router = Router();
router.use(requireAuth);

router.get('/', validate(productListQuery, 'query'), async (req, res, next) => {
  try {
    // Kasir hanya melihat produk aktif; owner melihat semua
    const { rows, meta } = await searchProducts(req.valid.query, { onlyActive: req.user.role !== 'owner' });
    res.json({ success: true, data: rows, meta });
  } catch (err) { next(err); }
});

router.get('/:id', validate(idParam, 'params'), async (req, res, next) => {
  try {
    const { rows } = await query(`SELECT ${FIELDS} FROM products WHERE id = $1`, [req.valid.params.id]);
    if (!rows[0] || (!rows[0].is_active && req.user.role !== 'owner')) throw notFound('Produk tidak ditemukan');
    res.json({ success: true, data: rows[0] });
  } catch (err) { next(err); }
});

router.post('/', requireRole('owner'), validate(productCreateSchema), async (req, res, next) => {
  try {
    const p = req.valid.body;
    const product = await withTransaction(async (c) => {
      // Total stok selalu dihitung dari stok cabang (nilai `stock` dari klien diabaikan)
      const s1 = p.stock_alfiamart1;
      const s2 = p.stock_alfiamart2;
      const totalStock = s1 + s2;
      const { rows } = await c.query(
        `INSERT INTO products (sku, name, category, unit, price, stock, stock_alfiamart1, stock_alfiamart2)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING ${FIELDS}`,
        [p.sku, p.name, p.category, p.unit, p.price, totalStock, s1, s2]);
      await c.query(`INSERT INTO price_history (product_id, old_price, new_price, changed_by, source) VALUES ($1, NULL, $2, $3, 'manual')`,
        [rows[0].id, p.price, req.user.id]);
      return rows[0];
    }).catch((err) => { throw err.code === '23505' ? conflict(`SKU "${p.sku}" sudah dipakai produk lain`, 'SKU_EXISTS') : err; });
    res.status(201).json({ success: true, data: product });
  } catch (err) { next(err); }
});

router.patch('/:id', requireRole('owner'), validate(idParam, 'params'), validate(productUpdateSchema), async (req, res, next) => {
  try {
    const { id } = req.valid.params;
    const changes = req.valid.body;
    const product = await withTransaction(async (c) => {
      const cur = (await c.query('SELECT * FROM products WHERE id = $1 FOR UPDATE', [id])).rows[0];
      if (!cur) throw notFound('Produk tidak ditemukan');
      const next = { ...cur, ...changes };
      
      // Hitung ulang total stok jika cabang diubah
      if (changes.stock_alfiamart1 !== undefined || changes.stock_alfiamart2 !== undefined) {
        const s1 = next.stock_alfiamart1 ?? 0;
        const s2 = next.stock_alfiamart2 ?? 0;
        next.stock = s1 + s2;
      } else if (changes.stock !== undefined && changes.stock_alfiamart1 === undefined && changes.stock_alfiamart2 === undefined) {
        // Jika hanya total stock yang diubah manual, sesuaikan s1 & s2 proporsional atau simpan langsung
        next.stock = changes.stock;
      }

      // Bila total stock diset 0, otomatis nonaktifkan jika tidak diset secara eksplisit
      if (next.stock === 0 && changes.is_active === undefined) {
        next.is_active = false;
      }
      const { rows } = await c.query(
        `UPDATE products 
         SET name=$2, category=$3, unit=$4, price=$5, stock=$6, stock_alfiamart1=$7, stock_alfiamart2=$8, is_active=$9, updated_at=now() 
         WHERE id=$1 RETURNING ${FIELDS}`,
        [id, next.name, next.category, next.unit, next.price, next.stock, next.stock_alfiamart1, next.stock_alfiamart2, next.is_active]);
      if (changes.price !== undefined && changes.price !== cur.price) {
        await c.query(`INSERT INTO price_history (product_id, old_price, new_price, changed_by, source) VALUES ($1,$2,$3,$4,'manual')`,
          [id, cur.price, changes.price, req.user.id]);
      }
      return rows[0];
    });
    res.json({ success: true, data: product });
  } catch (err) { next(err); }
});

// Hapus produk permanen (atau nonaktifkan bila sudah memiliki transaksi)
router.delete('/:id', requireRole('owner'), validate(idParam, 'params'), async (req, res, next) => {
  try {
    const { id } = req.valid.params;
    await withTransaction(async (c) => {
      // Cek apakah produk pernah digunakan dalam transaksi
      const hasTx = (await c.query('SELECT 1 FROM transaction_items WHERE product_id = $1 LIMIT 1', [id])).rows.length > 0;
      if (hasTx) {
        // Jika ada transaksi, jangan hapus fisik agar integrity laporan kasir tetap utuh, tandai is_active = FALSE
        await c.query('UPDATE products SET is_active = FALSE, updated_at = now() WHERE id = $1', [id]);
      } else {
        // Jika belum pernah ditransaksikan, hapus fisik sepenuhnya dari database
        await c.query('DELETE FROM price_history WHERE product_id = $1', [id]);
        const del = await c.query('DELETE FROM products WHERE id = $1 RETURNING id', [id]);
        if (!del.rows[0]) throw notFound('Produk tidak ditemukan');
      }
    });
    res.status(204).end();
  } catch (err) { next(err); }
});

router.get('/:id/price-history', requireRole('owner'), validate(idParam, 'params'), async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT h.id, h.product_id, h.old_price, h.new_price, h.source, h.reverted, h.changed_at, u.name AS changed_by
       FROM price_history h LEFT JOIN users u ON u.id = h.changed_by
       WHERE h.product_id = $1 ORDER BY h.changed_at DESC, h.id DESC`, [req.valid.params.id]);
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

// Impor massal. Baris valid diproses, baris salah dilaporkan (tidak menggagalkan seluruh impor).
router.post('/import', requireRole('owner'), validate(importSchema), async (req, res, next) => {
  try {
    const result = { total: req.valid.body.rows.length, created: 0, updated: 0, unchanged: 0, failed: 0, errors: [] };
    const valid = [];
    req.valid.body.rows.forEach((raw, i) => {
      const { value, error } = importRowSchema.validate(raw, { abortEarly: false, stripUnknown: true, convert: true });
      if (error) {
        result.failed += 1;
        result.errors.push({ row: i + 1, sku: raw?.sku ?? null, message: error.details.map((d) => d.message).join('; ') });
      } else valid.push({ row: i + 1, ...value });
    });
    const seen = new Set();
    await withTransaction(async (c) => {
      for (const r of valid) {
        if (seen.has(r.sku)) { result.failed += 1; result.errors.push({ row: r.row, sku: r.sku, message: 'SKU muncul lebih dari sekali dalam berkas' }); continue; }
        seen.add(r.sku);
        const cur = (await c.query('SELECT id, price FROM products WHERE sku = $1 FOR UPDATE', [r.sku])).rows[0];
        if (!cur) {
          const id = (await c.query('INSERT INTO products (sku,name,category,unit,price) VALUES ($1,$2,$3,$4,$5) RETURNING id',
            [r.sku, r.name, r.category, r.unit, r.price])).rows[0].id;
          await c.query(`INSERT INTO price_history (product_id, old_price, new_price, changed_by, source) VALUES ($1,NULL,$2,$3,'import')`, [id, r.price, req.user.id]);
          result.created += 1;
        } else {
          await c.query('UPDATE products SET name=$2, category=$3, unit=$4, price=$5, is_active=TRUE, updated_at=now() WHERE id=$1',
            [cur.id, r.name, r.category, r.unit, r.price]);
          if (cur.price !== r.price) {
            await c.query(`INSERT INTO price_history (product_id, old_price, new_price, changed_by, source) VALUES ($1,$2,$3,$4,'import')`,
              [cur.id, cur.price, r.price, req.user.id]);
            result.updated += 1;
          } else result.unchanged += 1;
        }
      }
    });
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

export default router;

// ---------- Pembatalan perubahan harga ----------
export const priceHistoryRouter = Router();
priceHistoryRouter.use(requireAuth, requireRole('owner'));

// Hanya perubahan terakhir sebuah produk yang dapat dibatalkan.
priceHistoryRouter.post('/:id/revert', validate(historyIdParam, 'params'), async (req, res, next) => {
  try {
    const product = await withTransaction(async (c) => {
      const h = (await c.query('SELECT * FROM price_history WHERE id = $1 FOR UPDATE', [req.valid.params.id])).rows[0];
      if (!h) throw notFound('Riwayat harga tidak ditemukan');
      if (h.reverted) throw conflict('Perubahan ini sudah dibatalkan', 'ALREADY_REVERTED');
      if (h.old_price === null) throw conflict('Pembuatan produk tidak dapat dibatalkan dari riwayat harga', 'NOT_REVERTIBLE');
      const latest = (await c.query('SELECT id FROM price_history WHERE product_id = $1 AND reverted = FALSE ORDER BY changed_at DESC, id DESC LIMIT 1', [h.product_id])).rows[0];
      if (latest.id !== h.id) throw conflict('Hanya perubahan harga terakhir yang dapat dibatalkan', 'NOT_LATEST');
      const cur = (await c.query('SELECT price FROM products WHERE id = $1 FOR UPDATE', [h.product_id])).rows[0];
      const { rows } = await c.query(`UPDATE products SET price = $2, updated_at = now() WHERE id = $1 RETURNING ${FIELDS}`, [h.product_id, h.old_price]);
      await c.query('UPDATE price_history SET reverted = TRUE WHERE id = $1', [h.id]);
      await c.query(`INSERT INTO price_history (product_id, old_price, new_price, changed_by, source) VALUES ($1,$2,$3,$4,'revert')`,
        [h.product_id, cur.price, h.old_price, req.user.id]);
      return rows[0];
    });
    res.json({ success: true, data: product });
  } catch (err) { next(err); }
});
