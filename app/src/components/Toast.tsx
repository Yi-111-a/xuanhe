import { AnimatePresence, motion } from 'framer-motion';
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { errorMessage } from '../api/client';

interface Toast {
  id: number;
  tone: 'error' | 'info' | 'success';
  title: string;
  message: string;
  code?: string;
}

interface ToastApi {
  error: (err: unknown, title?: string) => void;
  info: (message: string, title?: string) => void;
  success: (message: string, title?: string) => void;
}

const Ctx = createContext<ToastApi>({ error: () => {}, info: () => {}, success: () => {} });
export const useToast = () => useContext(Ctx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const counter = useRef(0);
  const push = useCallback((t: Omit<Toast, 'id'>) => {
    const id = ++counter.current;
    setItems((xs) => [...xs.slice(-3), { ...t, id }]);
    window.setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== id)), t.tone === 'error' ? 7000 : 3500);
  }, []);
  const api = useMemo<ToastApi>(
    () => ({
      error: (err, title = '有司回奏') => {
        if ((err as Error)?.name === 'AbortError') return;
        const { code, message } = errorMessage(err);
        push({ tone: 'error', title, message, code });
      },
      info: (message, title = '御前') => push({ tone: 'info', title, message }),
      success: (message, title = '已办') => push({ tone: 'success', title, message }),
    }),
    [push],
  );
  return (
    <Ctx.Provider value={api}>
      {children}
      <div className="toasts" aria-live="polite">
        <AnimatePresence>
          {items.map((t) => (
            <motion.div
              key={t.id}
              className={`toast toast--${t.tone}`}
              data-testid="toast.item"
              data-code={t.code ?? ''}
              initial={{ opacity: 0, y: -18, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, transition: { duration: 0.2 } }}
              transition={{ duration: 0.35, ease: [0.22, 0.8, 0.24, 1] }}
            >
              <span className="toast-seal t-title">{t.tone === 'error' ? '驳' : t.tone === 'success' ? '准' : '闻'}</span>
              <div className="toast-body">
                <div className="toast-title t-title">{t.title}</div>
                <div className="toast-msg">{t.message}</div>
                {t.code && <div className="toast-code t-num">{t.code}</div>}
              </div>
              <button className="toast-close" data-testid="toast.close" aria-label="关闭" onClick={() => setItems((xs) => xs.filter((x) => x.id !== t.id))}>
                ×
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </Ctx.Provider>
  );
}
