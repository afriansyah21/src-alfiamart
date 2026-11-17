const rupiahFmt = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 });
const dateFmt = new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' });

export const rupiah = (n) => rupiahFmt.format(n).replace(/\s/g, ' ');
export const dateTime = (iso) => dateFmt.format(new Date(iso));
// "Rp 68.000" / "68.000" / "68000" -> 68000 ; kosong -> ''
export const parsePrice = (v) => {
  const digits = String(v ?? '').replace(/\D/g, '');
  return digits === '' ? '' : Number(digits);
};
