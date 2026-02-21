import { useEffect } from 'react';

const Notification = ({ message, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 2500);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div
      className="fixed bottom-10 left-1/2 -translate-x-1/2 px-5 py-3.5 rounded-2xl z-[100] notification-enter border shadow-xl"
      style={{
        background: 'var(--action-bg)',
        color: 'var(--text-primary)',
        borderColor: 'var(--action-border)',
        boxShadow: '0 8px 32px var(--shadow-color-strong), 0 0 0 1px var(--action-border)',
        minWidth: '180px',
        maxWidth: '90vw',
      }}
    >
      <div className="flex items-center gap-3">
        <div
          className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
          style={{
            background: 'rgba(52, 211, 153, 0.15)',
            border: '1px solid rgba(52, 211, 153, 0.4)',
          }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <span className="font-semibold text-sm tracking-wide">{message}</span>
      </div>
    </div>
  );
};

export default Notification;
