import { useEffect } from 'react';

const Notification = ({ message, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 2500);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div
      className="fixed left-1/2 -translate-x-1/2 rounded-2xl z-[100] notification-enter border shadow-xl"
      style={{
        bottom: 36,
        padding: "10px 16px",
        background: 'var(--action-bg)',
        color: 'var(--text-primary)',
        borderColor: 'var(--action-border)',
        boxShadow: '0 8px 32px var(--shadow-color-strong), 0 0 0 1px var(--action-border)',
        minWidth: 160,
        maxWidth: 'calc(100vw - 32px)',
        width: 'auto',
      }}
    >
      <div className="flex items-center" style={{ gap: 10 }}>
        <div
          className="flex items-center justify-center flex-shrink-0"
          style={{
            width: 22,
            height: 22,
            borderRadius: '50%',
            background: 'rgba(52, 211, 153, 0.15)',
            border: '1px solid rgba(52, 211, 153, 0.4)',
          }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ width: 12, height: 12 }}>
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <span style={{ fontWeight: 600, fontSize: 13, letterSpacing: "0.02em" }}>{message}</span>
      </div>
    </div>
  );
};

export default Notification;
