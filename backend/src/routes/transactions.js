import { Router } from 'express';
import { query, withTransaction } from '../db.js';
import { validate } from '../middleware/validate.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { ApiError, badRequest, notFound } from '../errors.js';
import { transactionSchema, transactionBatchSchema, dateRangeQuery, idParam } from '../schemas.js';

const MAX_TOTAL = 2_000_000_000; // batas INTEGER PostgreSQL

async function loadTransaction(clientOrPool, where, param) {
  const t = (await clientOrPool.query(
    `SELECT t.id, t.client_id, t.payment_method, t.total, t.occurred_at, t.created_at, t.cashier_id, u.name AS cashier_name
     FROM transactions t JOIN users u ON u.id = t.cashier_id WHERE ${where}`, [param])).rows[0];
  if (!t) return null;
  t.items = (await clientOrPool.query(
    'SELECT product_id, product_name, unit_price, qty, subtotal FROM transaction_items WHERE transaction_id = $1 ORDER BY id', [t.id])).rows;
  return t;
}

// Menyimpan satu transaksi secara idempoten berdasarkan client_id.
// Mengembalikan { duplicate, transaction }.
export async function createTransaction(payload, user) {
  return withTransaction(async (c) => {
    const existing = await loadTransaction(c, 't.client_id = $1', payload.client_id);
    if (existing) return { duplicate: true, transaction: existing };

    const ids = [...new Set(payload.items.map((i) => i.product_id))];
    const { rows: products } = await c.query(
      'SELECT id, name, price, stock, stock_alfiamart1, stock_alfiamart2 FROM products WHERE id = ANY($1::uuid[]) FOR UPDATE',
      [ids]
    );
    const byId = new Map(products.map((p) => [p.id, p]));
    const isCabang2 = user?.username === 'alfiamartdua';

    const lines = payload.items.map((item) => {
      const p = byId.get(item.product_id);
      if (!p) throw new ApiError(422, 'PRODUCT_NOT_FOUND', `Produk ${item.product_id} tidak ditemukan`);
      const currentBranchStock = isCabang2 ? (p.stock_alfiamart2 ?? 0) : (p.stock_alfiamart1 ?? 0);
      if (item.qty > currentBranchStock) {
        throw new ApiError(400, 'INSUFFICIENT_STOCK', `Stok ${p.name} di cabang tidak mencukupi (tersedia: ${currentBranchStock}, diminta: ${item.qty})`);
      }
      const unitPrice = item.unit_price ?? p.price;
      return { product_id: p.id, name: p.name, unit_price: unitPrice, qty: item.qty, subtotal: unitPrice * item.qty };
    });
    const total = lines.reduce((sum, l) => sum + l.subtotal, 0);
    if (total > MAX_TOTAL) throw badRequest('Total transaksi melebihi batas yang diizinkan');

    const ins = await c.query(
      `INSERT INTO transactions (client_id, cashier_id, payment_method, total, occurred_at)
       VALUES ($1,$2,$3,$4,$5) ON CONFLICT (client_id) DO NOTHING RETURNING id`,
      [payload.client_id, user.id, payload.payment_method, total, payload.occurred_at]);
    if (!ins.rows[0]) { // dikirim bersamaan dari dua permintaan: anggap duplikat
      return { duplicate: true, transaction: await loadTransaction(c, 't.client_id = $1', payload.client_id) };
    }
    for (const l of lines) {
      await c.query(
        'INSERT INTO transaction_items (transaction_id, product_id, product_name, unit_price, qty, subtotal) VALUES ($1,$2,$3,$4,$5,$6)',
        [ins.rows[0].id, l.product_id, l.name, l.unit_price, l.qty, l.subtotal]);

      // Pengurangan stok otomatis saat transaksi berhasil disimpan
      // Jika kasir adalah alfiamartsatu, kurangi stock_alfiamart1
      // Jika kasir adalah alfiamartdua, kurangi stock_alfiamart2
      // Update juga total stock = stock_alfiamart1 + stock_alfiamart2
      // Jika total stok habis (<= 0), otomatis set is_active = FALSE
      if (user?.username === 'alfiamartdua') {
        await c.query(
          `UPDATE products 
           SET stock_alfiamart2 = GREATEST(0, stock_alfiamart2 - $2),
               stock = GREATEST(0, stock_alfiamart1 + GREATEST(0, stock_alfiamart2 - $2)),
               is_active = CASE WHEN (stock_alfiamart1 + GREATEST(0, stock_alfiamart2 - $2)) <= 0 THEN FALSE ELSE is_active END,
               updated_at = now()
           WHERE id = $1`,
          [l.product_id, l.qty]
        );
      } else {
        // Default untuk alfiamartsatu atau lainnya
        await c.query(
          `UPDATE products 
           SET stock_alfiamart1 = GREATEST(0, stock_alfiamart1 - $2),
               stock = GREATEST(0, GREATEST(0, stock_alfiamart1 - $2) + stock_alfiamart2),
               is_active = CASE WHEN (GREATEST(0, stock_alfiamart1 - $2) + stock_alfiamart2) <= 0 THEN FALSE ELSE is_active END,
               updated_at = now()
           WHERE id = $1`,
          [l.product_id, l.qty]
        );
      }
    }
    return { duplicate: false, transaction: await loadTransaction(c, 't.id = $1', ins.rows[0].id) };
  });
}

const router = Router();
router.use(requireAuth, requireRole('kasir', 'owner'));

router.post('/', validate(transactionSchema), async (req, res, next) => {
  try {
    const { duplicate, transaction } = await createTransaction(req.valid.body, req.user);
    res.status(duplicate ? 200 : 201).json({ success: true, data: transaction, meta: { duplicate } });
  } catch (err) { next(err); }
});

// Sinkronisasi offline: kirim banyak transaksi sekaligus. Hasil dilaporkan per transaksi
// agar kasir tahu mana yang berhasil, duplikat (sudah pernah masuk), atau gagal.
router.post('/batch', validate(transactionBatchSchema), async (req, res, next) => {
  try {
    const results = [];
    for (const raw of req.valid.body.transactions) {
      const { value, error } = transactionSchema.validate(raw, { abortEarly: false, stripUnknown: true, convert: true });
      const clientId = raw?.client_id ?? null;
      if (error) {
        results.push({ client_id: clientId, status: 'failed', error: { code: 'VALIDATION_ERROR', message: error.details.map((d) => d.message).join('; ') } });
        continue;
      }
      try {
        const { duplicate } = await createTransaction(value, req.user);
        results.push({ client_id: value.client_id, status: duplicate ? 'duplicate' : 'synced' });
      } catch (err) {
        if (!(err instanceof ApiError)) throw err;
        results.push({ client_id: value.client_id, status: 'failed', error: { code: err.code, message: err.message } });
      }
    }
    const summary = results.reduce((s, r) => ({ ...s, [r.status]: (s[r.status] || 0) + 1 }), { synced: 0, duplicate: 0, failed: 0 });
    res.json({ success: true, data: { results, summary } });
  } catch (err) { next(err); }
});

router.get('/', validate(dateRangeQuery, 'query'), async (req, res, next) => {
  try {
    const { from, to, page, limit } = req.valid.query;
    const where = [];
    const params = [];
    if (req.user.role === 'kasir') { params.push(req.user.id); where.push(`t.cashier_id = $${params.length}`); }
    if (from) { params.push(from); where.push(`t.occurred_at >= $${params.length}`); }
    if (to) { params.push(to); where.push(`t.occurred_at <= $${params.length}`); }
    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const total = Number((await query(`SELECT count(*) FROM transactions t ${clause}`, params)).rows[0].count);
    params.push(limit, (page - 1) * limit);
    const { rows } = await query(
      `SELECT t.id, t.client_id, t.payment_method, t.total, t.occurred_at, t.created_at, u.name AS cashier_name
       FROM transactions t JOIN users u ON u.id = t.cashier_id ${clause}
       ORDER BY t.occurred_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`, params);
    res.json({ success: true, data: rows, meta: { page, limit, total } });
  } catch (err) { next(err); }
});

router.get('/:id', validate(idParam, 'params'), async (req, res, next) => {
  try {
    const t = await loadTransaction({ query }, 't.id = $1', req.valid.params.id);
    if (!t || (req.user.role === 'kasir' && t.cashier_id !== req.user.id)) throw notFound('Transaksi tidak ditemukan');
    res.json({ success: true, data: t });
  } catch (err) { next(err); }
});

export default router;
