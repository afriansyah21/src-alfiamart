import Joi from 'joi';

const price = Joi.number().integer().min(0).max(100_000_000).messages({
  'number.base': 'Harga harus berupa angka',
  'number.integer': 'Harga harus bilangan bulat (rupiah)',
  'number.min': 'Harga tidak boleh negatif',
});

const stock = Joi.number().integer().min(0).max(1_000_000).messages({
  'number.base': 'Stok harus berupa angka',
  'number.integer': 'Stok harus bilangan bulat',
  'number.min': 'Stok tidak boleh negatif',
});

export const loginSchema = Joi.object({
  username: Joi.string().trim().min(1).max(100).required(),
  password: Joi.string().min(1).required(),
});

export const productCreateSchema = Joi.object({
  sku: Joi.string().trim().max(50).required(),
  name: Joi.string().trim().min(1).max(150).required(),
  category: Joi.string().trim().max(60).default('Lainnya'),
  unit: Joi.string().trim().max(20).default('pcs'),
  price: price.required(),
  stock: stock.default(2),
  stock_alfiamart1: stock.default(1),
  stock_alfiamart2: stock.default(1),
});

export const productUpdateSchema = Joi.object({
  name: Joi.string().trim().min(1).max(150),
  category: Joi.string().trim().max(60),
  unit: Joi.string().trim().max(20),
  price,
  stock,
  stock_alfiamart1: stock,
  stock_alfiamart2: stock,
  is_active: Joi.boolean(),
}).min(1);

export const productListQuery = Joi.object({
  q: Joi.string().trim().allow(''),
  category: Joi.string().trim(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(200).default(50),
});

export const idParam = Joi.object({ id: Joi.string().guid().required() });
export const historyIdParam = Joi.object({ id: Joi.number().integer().min(1).required() });

export const importSchema = Joi.object({
  rows: Joi.array().items(Joi.object().unknown(true)).min(1).max(1000).required(),
});
export const importRowSchema = Joi.object({
  sku: Joi.string().trim().max(50).required(),
  name: Joi.string().trim().min(1).max(150).required(),
  category: Joi.string().trim().max(60).default('Lainnya'),
  unit: Joi.string().trim().max(20).default('pcs'),
  price,
}).required();

export const transactionSchema = Joi.object({
  client_id: Joi.string().guid().required(),
  payment_method: Joi.string().valid('tunai', 'qris', 'transfer').required(),
  // Toleransi 5 menit untuk jam perangkat kasir yang sedikit lebih maju dari server
  occurred_at: Joi.date().iso().required().custom((value, helpers) =>
    (value.getTime() > Date.now() + 5 * 60 * 1000 ? helpers.message('Waktu transaksi tidak boleh di masa depan') : value)),
  items: Joi.array().items(Joi.object({
    product_id: Joi.string().guid().required(),
    qty: Joi.number().integer().min(1).max(1000).required(),
    // harga yang dilihat kasir saat transaksi (penting untuk transaksi offline).
    // Jika tidak dikirim, server memakai harga produk saat ini.
    unit_price: price,
  })).min(1).max(100).required(),
});
export const transactionBatchSchema = Joi.object({
  transactions: Joi.array().min(1).max(50).required(),
});

export const dateRangeQuery = Joi.object({
  from: Joi.date().iso(),
  to: Joi.date().iso(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(500).default(100),
});

export const chatSchema = Joi.object({
  message: Joi.string().trim().min(1).max(500).required(),
  session_id: Joi.string().guid().required(),
  channel: Joi.string().valid('web', 'telegram').default('web'),
});

export const chatSessionParamSchema = Joi.object({
  session_id: Joi.string().guid().required(),
});

export const summaryQuerySchema = Joi.object({
  type: Joi.string().valid('sales', 'price_changes').required(),
  period: Joi.string()
    .valid(
      'hari_ini',
      'kemarin',
      '7_hari_terakhir',
      'minggu_ini',
      'minggu_lalu',
      'bulan_ini',
      'bulan_lalu'
    )
    .default('kemarin'),
});
