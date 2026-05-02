import React, { createContext, useContext, useState, useCallback } from 'react';
import Toast from '../components/common/Toast';

const ToastContext = createContext(null);

let _id = 0;

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = 'info', duration = 4000) => {
    const id = ++_id;
    setToasts(prev => [...prev, { id, message, type, duration }]);
  }, []);

  const dismiss = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  // Backward compatibility + Primary helper
  const showToast = useCallback((message, type, duration) => {
    addToast(message, type, duration);
  }, [addToast]);

  const value = {
    showToast,
    success: (msg, dur)  => addToast(msg, 'success', dur),
    error  : (msg, dur)  => addToast(msg, 'error',   dur),
    warning: (msg, dur)  => addToast(msg, 'warning',  dur),
    info   : (msg, dur)  => addToast(msg, 'info',    dur),
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/* Toast container — bottom-right */}
      <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-3 items-end">
        {toasts.map(t => (
          <Toast key={t.id} {...t} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
};
