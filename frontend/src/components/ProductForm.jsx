import { useState } from 'react';
import api, { errorMessage } from '../api/client.js';
import { parsePrice, rupiah } from '../format.js';
import Modal from './Modal.jsx';
import { useToast } from './Toast.jsx';
import { ArrowRight } from 'lucide-react';

const LABELS = {
  name: 'Nama',
  category: 'Kategori',
  unit: 'Satuan',
  price: 'Harga',
  stock_alfiamart1: 'Stok Alfiamart 1',
  stock_alfiamart2: 'Stok Alfiamart 2',
};

export default function ProductForm({ product, categories, onClose, onSaved }) {
  const editing = Boolean(product);
  const toast   = useToast();
  const [form, setForm]       = useState({
    sku:              product?.sku              ?? '',
    name:             product?.name             ?? '',
    category:         product?.category         ?? 'Sembako',
    unit:             product?.unit             ?? 'pcs',
    price:            product ? String(product.price) : '',
    stock_alfiamart1: product?.stock_alfiamart1 !== undefined ? String(product.stock_alfiamart1) : '1',
    stock_alfiamart2: product?.stock_alfiamart2 !== undefined ? String(product.stock_alfiamart2) : '1',
  });
  const [errors, setErrors]     = useState({});
  const [reviewing, setReviewing] = useState(false);
  const [busy, setBusy]         = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const totalStockPreview = (parseInt(form.stock_alfiamart1, 10) || 0) + (parseInt(form.stock_alfiamart2, 10) || 0);

  const validate = () => {
    const e = {};
    if (!editing && !form.sku.trim()) e.sku = 'SKU wajib diisi';
    if (!form.name.trim()) e.name = 'Nama produk wajib diisi';
    if (parsePrice(form.price) === '') e.price = 'Harga wajib diisi dengan angka';
    if (form.stock_alfiamart1.trim() === '' || isNaN(Number(form.stock_alfiamart1)) || Number(form.stock_alfiamart1) < 0) {
      e.stock_alfiamart1 = 'Stok Alfiamart 1 minimal 0';
    }
    if (form.stock_alfiamart2.trim() === '' || isNaN(Number(form.stock_alfiamart2)) || Number(form.stock_alfiamart2) < 0) {
      e.stock_alfiamart2 = 'Stok Alfiamart 2 minimal 0';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const changes = editing
    ? Object.keys(LABELS).filter((k) => {
        if (k === 'price') return String(parsePrice(form.price)) !== String(product.price);
        if (k === 'stock_alfiamart1') return String(Number(form.stock_alfiamart1)) !== String(product.stock_alfiamart1 ?? 1);
        if (k === 'stock_alfiamart2') return String(Number(form.stock_alfiamart2)) !== String(product.stock_alfiamart2 ?? 1);
        return String(form[k].trim()) !== String(product[k]);
      })
    : [];

  const save = async () => {
    setBusy(true);
    try {
      const s1 = Math.max(0, parseInt(form.stock_alfiamart1, 10) || 0);
      const s2 = Math.max(0, parseInt(form.stock_alfiamart2, 10) || 0);
      const totalStock = s1 + s2;
      const body = {
        name:             form.name.trim(),
        category:         form.category.trim() || 'Lainnya',
        unit:             form.unit.trim() || 'pcs',
        price:            parsePrice(form.price),
        stock_alfiamart1: s1,
        stock_alfiamart2: s2,
        stock:            totalStock,
        // Jika total stok > 0 saat edit, aktifkan kembali produk
        ...(editing && totalStock > 0 && !product.is_active ? { is_active: true } : {})
      };
      if (editing) {
        await api.patch(`/products/${product.id}`, body);
        toast.success('Perubahan produk disimpan');
      } else {
        await api.post('/products', { sku: form.sku.trim(), ...body });
        toast.success('Produk ditambahkan');
      }
      onSaved();
    } catch (err) {
      toast.error(errorMessage(err));
      setReviewing(false);
    } finally { setBusy(false); }
  };

  const submit = (e) => {
    e.preventDefault();
    if (!validate()) return;
    if (editing) {
      if (changes.length === 0) return onClose();
      return setReviewing(true);
    }
    save();
  };

  const show = (k, v) => (k === 'price' ? rupiah(v) : v);

  return (
    <Modal title={editing ? 'Ubah produk' : 'Tambah produk'} onClose={onClose}>
      {reviewing ? (
        /* ── Pratinjau perubahan ── */
        <div>
          <p className="mb-4 text-sm text-[#5F6670]">
            Periksa perubahan berikut sebelum disimpan. Harga baru langsung dipakai kasir dan katalog.
          </p>
          <ul className="divide-y divide-[#E3E5E8] rounded-lg border border-[#E3E5E8]">
            {changes.map((k) => (
              <li key={k} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                <span className="text-sm font-semibold">{LABELS[k]}</span>
                <span className="flex items-center gap-2 text-sm">
                  <span className="text-[#5F6670] line-through">{show(k, product[k])}</span>
                  <ArrowRight size={14} className="text-[#5F6670]" />
                  {k === 'price'
                    ? <span className="price-tag text-lg">{show(k, parsePrice(form.price))}</span>
                    : <strong>{String(form[k]).trim()}</strong>}
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-5 flex justify-end gap-2">
            <button type="button" className="btn btn-secondary" onClick={() => setReviewing(false)} disabled={busy}>
              Kembali
            </button>
            <button type="button" className="btn btn-primary" onClick={save} disabled={busy}>
              {busy ? 'Menyimpan…' : 'Simpan perubahan'}
            </button>
          </div>
        </div>
      ) : (
        /* ── Form isi data ── */
        <form onSubmit={submit} className="space-y-4" noValidate>
          <div>
            <label htmlFor="sku" className="label">SKU (kode produk)</label>
            <input id="sku" className="field" value={form.sku} onChange={set('sku')} disabled={editing} autoFocus={!editing} />
            {errors.sku && <p className="error-text mt-1">{errors.sku}</p>}
          </div>
          <div>
            <label htmlFor="pname" className="label">Nama produk</label>
            <input id="pname" className="field" value={form.name} onChange={set('name')} autoFocus={editing} />
            {errors.name && <p className="error-text mt-1">{errors.name}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="category" className="label">Kategori</label>
              <input id="category" className="field" list="category-list" value={form.category} onChange={set('category')} />
              <datalist id="category-list">{categories.map((c) => <option key={c} value={c} />)}</datalist>
            </div>
            <div>
              <label htmlFor="unit" className="label">Satuan</label>
              <input id="unit" className="field" value={form.unit} onChange={set('unit')} />
            </div>
          </div>
          <div>
            <label htmlFor="price" className="label">Harga (rupiah)</label>
            <input id="price" className="field" inputMode="numeric" value={form.price} onChange={set('price')} placeholder="cth: 68000" />
            {errors.price
              ? <p className="error-text mt-1">{errors.price}</p>
              : <p className="hint mt-1">Hanya angka.</p>}
          </div>
          <div className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-3 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-[#475569]">Stok per Cabang Toko</span>
              <span className="text-xs font-semibold text-[#0F172A] bg-white border border-[#CBD5E1] px-2 py-0.5 rounded">
                Total: {totalStockPreview}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="stock_alfiamart1" className="label text-xs">Stok Alfiamart 1</label>
                <input
                  id="stock_alfiamart1"
                  className="field bg-white"
                  type="number"
                  min="0"
                  value={form.stock_alfiamart1}
                  onChange={set('stock_alfiamart1')}
                  placeholder="1"
                />
                {errors.stock_alfiamart1 && <p className="error-text mt-1">{errors.stock_alfiamart1}</p>}
              </div>
              <div>
                <label htmlFor="stock_alfiamart2" className="label text-xs">Stok Alfiamart 2</label>
                <input
                  id="stock_alfiamart2"
                  className="field bg-white"
                  type="number"
                  min="0"
                  value={form.stock_alfiamart2}
                  onChange={set('stock_alfiamart2')}
                  placeholder="1"
                />
                {errors.stock_alfiamart2 && <p className="error-text mt-1">{errors.stock_alfiamart2}</p>}
              </div>
            </div>
            <p className="hint text-[11px]">Total stok otomatis dijumlahkan dari kedua cabang.</p>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Batal</button>
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {editing ? 'Tinjau perubahan' : busy ? 'Menyimpan…' : 'Tambah produk'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
