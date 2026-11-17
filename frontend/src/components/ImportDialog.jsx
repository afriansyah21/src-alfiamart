import { useState } from 'react';
import Papa from 'papaparse';
import api, { errorMessage } from '../api/client.js';
import { parsePrice } from '../format.js';
import Modal from './Modal.jsx';
import { useToast } from './Toast.jsx';
import { FileText, AlertCircle } from 'lucide-react';

const ALIASES = {
  sku:      ['sku', 'kode'],
  name:     ['name', 'nama', 'nama produk'],
  category: ['category', 'kategori'],
  unit:     ['unit', 'satuan'],
  price:    ['price', 'harga'],
};
const pick     = (row, keys) => { for (const k of keys) if (row[k] !== undefined) return String(row[k]).trim(); return ''; };
const toApiRow = (row) => ({
  sku:      pick(row, ALIASES.sku),
  name:     pick(row, ALIASES.name),
  category: pick(row, ALIASES.category) || undefined,
  unit:     pick(row, ALIASES.unit) || undefined,
  price:    parsePrice(pick(row, ALIASES.price)),
});

export default function ImportDialog({ onClose, onDone }) {
  const toast = useToast();
  const [rows, setRows]           = useState(null);
  const [fileName, setFileName]   = useState('');
  const [report, setReport]       = useState(null);
  const [busy, setBusy]           = useState(false);
  const [parseError, setParseError] = useState('');

  const onFile = (e) => {
    const file = e.target.files?.[0];
    setRows(null); setReport(null); setParseError('');
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setParseError('Berkas harus berformat CSV. Di Excel: Simpan sebagai → CSV UTF-8.');
      return;
    }
    setFileName(file.name);
    Papa.parse(file, {
      header: true, skipEmptyLines: true, transformHeader: (h) => h.trim().toLowerCase(),
      complete: (res) => {
        if (res.data.length === 0) return setParseError('Berkas kosong atau tidak memiliki baris data.');
        if (res.data.length > 1000) return setParseError('Maksimal 1000 baris per impor.');
        setRows(res.data.map(toApiRow));
      },
      error: () => setParseError('Berkas tidak dapat dibaca. Pastikan formatnya CSV.'),
    });
  };

  const send = async () => {
    setBusy(true);
    try {
      const res = await api.post('/products/import', { rows });
      setReport(res.data.data);
      toast.success('Impor selesai');
      onDone();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally { setBusy(false); }
  };

  return (
    <Modal title="Impor produk dan harga dari CSV" onClose={onClose} wide>
      {report ? (
        /* ── Hasil impor ── */
        <div>
          <p className="mb-4 text-sm">
            Hasil impor <strong>{fileName}</strong>:
          </p>
          <dl className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
            {[
              ['Baris',           report.total],
              ['Produk baru',     report.created],
              ['Harga diperbarui', report.updated],
              ['Tidak berubah',   report.unchanged],
              ['Gagal',           report.failed],
            ].map(([k, v]) => (
              <div key={k} className={`rounded-lg border px-3 py-2 ${k === 'Gagal' && v > 0 ? 'border-[#F4B8B8] bg-[#FCEAEA]' : 'border-[#E3E5E8]'}`}>
                <dt className="text-xs text-[#5F6670]">{k}</dt>
                <dd className={`text-2xl font-bold ${k === 'Gagal' && v > 0 ? 'text-[#A01520]' : ''}`}>{v}</dd>
              </div>
            ))}
          </dl>
          {report.errors.length > 0 && (
            <div>
              <p className="label mb-1">Baris yang gagal</p>
              <ul className="max-h-48 divide-y divide-[#E3E5E8] overflow-y-auto rounded-lg border border-[#F4B8B8] text-sm">
                {report.errors.map((er, i) => (
                  <li key={i} className="px-3 py-2 text-[#A01520]">
                    <strong>Baris {er.row}</strong>{er.sku ? ` (${er.sku})` : ''}: {er.message}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="mt-5 flex justify-end">
            <button type="button" className="btn btn-primary" onClick={onClose}>Selesai</button>
          </div>
        </div>
      ) : (
        /* ── Upload form ── */
        <div className="space-y-4">
          <p className="text-sm text-[#5F6670]">
            Kolom yang dibaca: <code>sku</code>, <code>nama</code>, <code>kategori</code>, <code>satuan</code>, <code>harga</code>.
            SKU yang sudah ada akan diperbarui, SKU baru ditambahkan. Baris yang salah dilaporkan tanpa membatalkan baris lain.{' '}
            <a className="font-semibold text-[#D6212A] underline" href="/contoh-impor.csv" download>Unduh contoh berkas</a>.
          </p>

          {/* Upload area */}
          <div>
            <label htmlFor="csv" className="label">Pilih berkas CSV</label>
            <div className="flex items-center gap-3 rounded-lg border-2 border-dashed border-[#E3E5E8] bg-[#F4F4F5] px-4 py-5">
              <FileText size={28} className="shrink-0 text-[#5F6670]" />
              <div className="min-w-0 flex-1">
                <input id="csv" type="file" accept=".csv,text/csv" className="w-full text-sm" onChange={onFile} />
                {fileName && <p className="mt-1 truncate text-xs text-[#5F6670]">{fileName}</p>}
              </div>
            </div>
            {parseError && (
              <div className="mt-2 flex items-start gap-2 text-sm text-[#A01520]" role="alert">
                <AlertCircle size={15} className="mt-0.5 shrink-0" />
                {parseError}
              </div>
            )}
          </div>

          {/* Pratinjau tabel */}
          {rows && (
            <div>
              <p className="label mb-1">Pratinjau ({rows.length} baris, menampilkan 5 pertama)</p>
              <div className="overflow-x-auto rounded-lg border border-[#E3E5E8]">
                <table className="w-full text-left text-sm">
                  <thead className="bg-[#F4F4F5]">
                    <tr>
                      {['SKU', 'Nama', 'Kategori', 'Satuan', 'Harga'].map((h) => (
                        <th key={h} className="px-3 py-2 font-semibold text-[#1F2328]">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 5).map((r, i) => (
                      <tr key={i} className="border-t border-[#E3E5E8]">
                        <td className="px-3 py-2">{r.sku || '-'}</td>
                        <td className="px-3 py-2">{r.name || '-'}</td>
                        <td className="px-3 py-2">{r.category || '-'}</td>
                        <td className="px-3 py-2">{r.unit || '-'}</td>
                        <td className="px-3 py-2">{r.price === '' ? '-' : r.price}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Batal</button>
            <button type="button" className="btn btn-primary" disabled={!rows || busy} onClick={send}>
              {busy ? 'Mengimpor…' : rows ? `Impor ${rows.length} baris` : 'Impor'}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
