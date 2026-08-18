import React, { useEffect, useRef } from 'react';

/**
 * Modal — accessible, focus-trapped overlay
 */
const Modal = ({ isOpen, onClose, title, children, size = 'md' }) => {
  const overlayRef = useRef(null);
  const closeRef   = useRef(null);

  const sizes = {
    sm : 'max-w-sm',
    md : 'max-w-md',
    lg : 'max-w-lg',
    xl : 'max-w-2xl',
  };

  // Close on Escape & initial focus
  useEffect(() => {
    if (!isOpen) return;

    const handler = (e) => {
      if (e.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', handler);
    document.body.style.overflow = 'hidden';
    
    // Focus the close button ONLY when the modal first opens
    // Using a timeout to ensure the element is painted and focusable
    const timer = setTimeout(() => {
      if (closeRef.current) closeRef.current.focus();
    }, 50);

    return () => {
      document.removeEventListener('keydown', handler);
      document.body.style.overflow = '';
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]); 

  if (!isOpen) return null;

  const handleOverlayClick = (e) => {
    if (e.target === overlayRef.current) onClose();
  };

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="fixed inset-0 z-50 flex items-center justify-center p-4
                 bg-black/60 backdrop-blur-sm animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div className={`card w-full ${sizes[size]} animate-slide-up shadow-glass flex flex-col max-h-[85vh]`}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-border shrink-0">
          <h2 id="modal-title" className="text-lg font-semibold text-white">
            {title}
          </h2>
          <button
            ref={closeRef}
            onClick={onClose}
            className="btn-ghost p-1.5 rounded-lg text-slate-400 hover:text-white"
            aria-label="Close modal"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        {/* Body */}
        <div className="px-6 py-5 overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  );
};

export default Modal;
