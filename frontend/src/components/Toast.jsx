import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { CheckCircle, XCircle } from 'lucide-react';

const ToastContext = createContext(null);
export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);

  const push = useCallback((type, message) => {
    const id = Math.random().toString(36).slice(2);
    setItems((cur) => [...cur, { id, type, message }]);
    setTimeout(
      () => setItems((cur) => cur.filter((t) => t.id !== id)),
      type === 'error' ? 7000 : 3500,
    );
  }, []);

  const api = useMemo(
    () => ({ success: (m) => push('success', m), error: (m) => push('error', m) }),
    [push],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      {/* Toast di atas cart-bar di ponsel, di kanan bawah desktop */}
      <div
        className="fixed bottom-20 left-1/2 z-50 flex w-[min(92vw,26rem)] -translate-x-1/2 flex-col gap-2 lg:bottom-6 lg:left-auto lg:right-6 lg:translate-x-0"
        role="status"
        aria-live="polite"
      >
        {items.map((t) => (
          <div
            key={t.id}
            className={`flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-semibold text-white shadow-lg ${
              t.type === 'error'
                ? 'bg-[#A01520]'   /* merah lebih gelap untuk error */
                : 'bg-[#1E7B4F]'   /* hijau sukses */
            }`}
          >
            {t.type === 'error'
              ? <XCircle size={18} className="shrink-0" />
              : <CheckCircle size={18} className="shrink-0" />}
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
