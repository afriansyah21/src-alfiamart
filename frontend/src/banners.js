// Default banner promo minimarket SRC Alfiamart
export const DEFAULT_BANNERS = [
  {
    id: 1,
    title: 'Promo Spesial Mingguan',
    subtitle: 'Hemat s/d 30% untuk Beras & Minyak Goreng',
    tag: 'Harga Spesial',
    bg: 'from-[#D6212A] to-[#B51A22]',
    accent: '#FFC72C',
    imgUrl: ''
  },
  {
    id: 2,
    title: 'Kebutuhan Dapur & Sembako',
    subtitle: 'Stok lengkap harga selalu sama dengan kasir',
    tag: 'Paling Laris',
    bg: 'from-[#0284C7] to-[#0369A1]',
    accent: '#BAE6FD',
    imgUrl: ''
  },
  {
    id: 3,
    title: 'Camilan & Minuman Segar',
    subtitle: 'Beli 2 Lebih Hemat setiap akhir pekan',
    tag: 'Spesial Member',
    bg: 'from-[#059669] to-[#047857]',
    accent: '#A7F3D0',
    imgUrl: ''
  },
  {
    id: 4,
    title: 'Kebersihan & Perawatan Rumah',
    subtitle: 'Diskon produk detergen & sabun cuci',
    tag: 'Super Hemat',
    bg: 'from-[#7C3AED] to-[#6D28D9]',
    accent: '#DDD6FE',
    imgUrl: ''
  },
  {
    id: 5,
    title: 'Belanja Cepat di SRC Alfiamart',
    subtitle: 'Buka setiap hari melayani kebutuhan warga',
    tag: 'Info Toko',
    bg: 'from-[#EA580C] to-[#C2410C]',
    accent: '#FED7AA',
    imgUrl: ''
  }
];

const BANNER_STORAGE_KEY = 'src_promo_banners';

export function getStoredBanners() {
  try {
    const raw = localStorage.getItem(BANNER_STORAGE_KEY);
    if (!raw) return DEFAULT_BANNERS;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_BANNERS;
  } catch {
    return DEFAULT_BANNERS;
  }
}

export function saveStoredBanners(banners) {
  try {
    localStorage.setItem(BANNER_STORAGE_KEY, JSON.stringify(banners));
    window.dispatchEvent(new Event('banners:updated'));
  } catch (err) {
    console.error('Gagal menyimpan banner ke localStorage', err);
  }
}
