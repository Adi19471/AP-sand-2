/** Lightweight toast notifications - success, error and info banners. */
import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';

const ToastContext = createContext(null);
const DEFAULT_DURATION = 4500;

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);
  const timers = useRef(new Map());

  const dismiss = useCallback((id) => {
    setToasts((current) => current.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const push = useCallback(
    (type, message, duration = DEFAULT_DURATION) => {
      if (!message) return null;
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setToasts((current) => [...current.slice(-3), { id, type, message }]);
      const timer = setTimeout(() => dismiss(id), duration);
      timers.current.set(id, timer);
      return id;
    },
    [dismiss],
  );

  const value = useMemo(
    () => ({
      toast: {
        success: (message, duration) => push('success', message, duration),
        error: (message, duration) => push('error', message, duration ?? 6000),
        info: (message, duration) => push('info', message, duration),
      },
      dismiss,
    }),
    [push, dismiss],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-stack" role="status" aria-live="polite">
        {toasts.map((item) => (
          <div key={item.id} className={`toast toast--${item.type}`}>
            <span className="toast__icon">
              {item.type === 'success' && <CheckCircle2 size={18} />}
              {item.type === 'error' && <AlertCircle size={18} />}
              {item.type === 'info' && <Info size={18} />}
            </span>
            <p className="toast__message">{item.message}</p>
            <button
              type="button"
              className="toast__close"
              onClick={() => dismiss(item.id)}
              aria-label="Dismiss notification"
            >
              <X size={15} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used inside <ToastProvider>.');
  return context.toast;
};

export default useToast;
