import { useCallback, useEffect, useState } from 'react';
import api, { errorMessage } from '../api/client.js';
import { dateTime, rupiah } from '../format.js';
import Modal from './Modal.jsx';
import { useToast } from './Toast.jsx';
import { ArrowRight, RotateCcw } from 'lucide-react';

const SOURCE = { manual: 'Diubah manual', import: 'Impor CSV', revert: 'Pembatalan' };

export default function PriceHistory({ product, onClose, onChanged }) {
  const toast = useToast();
  const [items, setItems] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy]   = useState(false);

  const load = useCallback(() => {
    api.get(`/products/${product.id}/price-history`)
      .then((res) => setItems(res.data.data))
      .catch((err) => setError(errorMessage(err)));
  }, [product.id]);
  useEffect(load, [load]);

  const latest = items?.find((h) => !h.reverted);
  const revert = async (h) => {
    setBusy(true);
    try {
      await api.post(`/price-history/${h.id}/revert`);
      toast.success(`Harga dikembalikan ke ${rupiah(h.old_price)}`);
      load(); onChanged();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally { setBusy(false); }
  };

  return (
    <Modal title={`Riwayat harga: ${product.name}`} onClose={onClose} wide>
      {error && (
        <p role="alert" className="mb-3 text-sm text-[#A01520]">{error}</p>
      )}
      {!items && !error && (
        <p className="text-sm text-[#5F6670]">Memuat riwayat…</p>
      )}
      {items && items.length === 0 && (
        <p className="text-sm text-[#5F6670]">Belum ada perubahan harga.</p>
      )}
      {items && items.length > 0 && (
        <ul className="divide-y divide-[#E3E5E8] rounded-lg border border-[#E3E5E8]">
          {items.map((h) => (
            <li
              key={h.id}
              className={`flex flex-wrap items-center justify-between gap-3 px-4 py-3 ${
                h.reverted ? 'bg-[#F4F4F5] opacity-70' : ''
              }`}
            >
              <div>
                {/* Perubahan harga: lama → baru */}
                <div className="flex flex-wrap items-center gap-2">
                  {h.old_price !== null && (
                    <>
                      <span className="font-mono text-sm text-[#5F6670] line-through">{rupiah(h.old_price)}</span>
                      <ArrowRight size={14} className="text-[#5F6670]" />
                    </>
                  )}
                  <span className="price-tag text-lg">{rupiah(h.new_price)}</span>
                  {h.reverted && (
                    <span className="rounded bg-[#E3E5E8] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#5F6670]">
                      Dibatalkan
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-xs text-[#5F6670]">
                  {SOURCE[h.source]} · {dateTime(h.changed_at)}
                </p>
              </div>

              {/* Tombol batalkan — hanya entri paling baru yang belum dibatalkan */}
              {latest?.id === h.id && h.old_price !== null && (
                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  disabled={busy}
                  onClick={() => revert(h)}
                >
                  <RotateCcw size={14} />
                  Batalkan perubahan ini
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
