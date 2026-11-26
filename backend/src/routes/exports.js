import { Router } from 'express';
import Joi from 'joi';
import { query } from '../db.js';
import { validate } from '../middleware/validate.js';
import { requireServiceKeyOrOwner } from '../middleware/auth.js';

// Endpoint baca-saja untuk tim DS (analisis, dasbor) dan AE (basis pengetahuan RAG).
// Akses: header X-Service-Key atau login owner.
const router = Router();
router.use(requireServiceKeyOrOwner);

const exportQuery = Joi.object({
  from: Joi.date().iso(),
  to: Joi.date().iso(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(5000).default(1000),
});

router.get('/products', async (_req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT id, sku, name, category, unit, price, stock,
              stock_alfiamart1, stock_alfiamart2, is_active, updated_at
       FROM products ORDER BY name`
    );
    res.json({ success: true, data: rows, meta: { total: rows.length } });
  } catch (err) { next(err); }
});

// Satu baris per item transaksi (format datar siap untuk pandas)
router.get('/transactions', validate(exportQuery, 'query'), async (req, res, next) => {
  try {
    const { from, to, page, limit } = req.valid.query;
    const where = [];
    const params = [];
    if (from) { params.push(from); where.push(`t.occurred_at >= $${params.length}`); }
    if (to) { params.push(to); where.push(`t.occurred_at <= $${params.length}`); }
    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const total = Number((await query(
      `SELECT count(*) FROM transaction_items i JOIN transactions t ON t.id = i.transaction_id ${clause}`, params)).rows[0].count);
    params.push(limit, (page - 1) * limit);
    const { rows } = await query(
      `SELECT t.id AS transaction_id, t.occurred_at, t.payment_method,
              t.cashier_id, u.name AS cashier_name,
              CASE WHEN u.username = 'alfiamartdua' THEN 'alfiamart2' ELSE 'alfiamart1' END AS branch,
              i.product_id, p.sku, i.product_name, p.category, i.unit_price, i.qty, i.subtotal
       FROM transaction_items i
       JOIN transactions t ON t.id = i.transaction_id
       JOIN users u ON u.id = t.cashier_id
       JOIN products p ON p.id = i.product_id
       ${clause} ORDER BY t.occurred_at ASC, i.id ASC LIMIT $${params.length - 1} OFFSET $${params.length}`, params);
    res.json({ success: true, data: rows, meta: { page, limit, total } });
  } catch (err) { next(err); }
});

router.get('/price-history', validate(exportQuery, 'query'), async (req, res, next) => {
  try {
    const { from, to, page, limit } = req.valid.query;
    const where = [];
    const params = [];
    if (from) { params.push(from); where.push(`h.changed_at >= $${params.length}`); }
    if (to) { params.push(to); where.push(`h.changed_at <= $${params.length}`); }
    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const total = Number((await query(
      `SELECT count(*) FROM price_history h ${clause}`, params)).rows[0].count);
    params.push(limit, (page - 1) * limit);
    const { rows } = await query(
      `SELECT h.id, h.product_id, p.sku, p.name,
              h.old_price, h.new_price, h.source, h.reverted,
              h.changed_by, h.changed_at
       FROM price_history h
       LEFT JOIN products p ON p.id = h.product_id
       ${clause} ORDER BY h.changed_at ASC, h.id ASC
       LIMIT $${params.length - 1} OFFSET $${params.length}`, params);
    res.json({ success: true, data: rows, meta: { page, limit, total } });
  } catch (err) { next(err); }
});

export default router;
