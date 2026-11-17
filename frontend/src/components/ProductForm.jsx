import { useState } from 'react';
import api, { errorMessage } from '../api/client.js';
import { parsePrice, rupiah } from '../format.js';
import Modal from './Modal.jsx';
import { useToast } from './Toast.jsx';
import { ArrowRight } from 'lucide-react';

const LABELS = { name: 'Nama', category: 'Kategori', unit: 'Satuan', price: 'Harga' };

export default function ProductForm({ product, categories, onClose, onSaved }) {
  const editing = Boolean(product);
  const toast   = useToast();
  const [form, setForm]       = useState({
    sku:      product?.sku      ?? '',
    name:     product?.name     ?? '',
    category: product?.category ?? 'Sembako',
    unit:     product?.unit     ?? 'pcs',
    price:    product ? String(product.price) : '',
  });
  const [errors, setErrors]     = useState({});
  const [reviewing, setReviewing] = useState(false);
  const [busy, setBusy]         = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const validate = () => {
    const e = {};
    if (!editing && !form.sku.trim()) e.sku = 'SKU wajib diisi';
    if (!form.name.trim()) e.name = 'Nama produk wajib diisi';
    if (parsePrice(form.price) === '') e.price = 'Harga wajib diisi dengan angka';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const changes = editing
    ? Object.keys(LABELS).filter(
        (k) => String(k === 'price' ? parsePrice(form.price) : form[k].trim()) !== String(product[k])
      )
    : [];

  const save = async () => {
    setBusy(true);
    try {
      const body = {
        name:     form.name.trim(),
        category: form.category.trim() || 'Lainnya',
        unit:     form.unit.trim() || 'pcs',
        price:    parsePrice(form.price),
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
                    : <strong>{form[k].trim()}</strong>}
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
              : <p className="hint mt-1">Hanya angka, tanpa titik atau koma.</p>}
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
