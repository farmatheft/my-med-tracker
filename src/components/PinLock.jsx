import { useState, useCallback, useEffect, useRef, useMemo } from "react";

/**
 * SHA-256 hash via Web Crypto API.
 * Returns lowercase hex string.
 */
async function sha256(text) {
  const data = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Pre-computed hashes for security (removing plain text PINs from source)
const UNLOCK_HASH = "fccb6362a9a78e111197c4f93837549f6bffc9c29661d213eefb9d2df6176fd7"; // The required PIN
const PANIC_HASH  = "3f95b1b8a32c2c0251dfdbc3c8a30aab6d6e680cf0ef03e8af84a65dff0c4a85"; // The panic mode PIN

/**
 * Full-screen PIN lock overlay.
 * @param {function} onUnlock - called with { mode: "normal" | "panic" }
 */
export default function PinLock({ onUnlock }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);
  const [checking, setChecking] = useState(false);
  const dotRefs = useRef([]);

  const handleDigit = useCallback((digit) => {
    setPin((prev) => {
      if (prev.length >= 4) return prev;
      return prev + digit;
    });
    setError(false);
  }, []);

  const handleBackspace = useCallback(() => {
    setPin((prev) => prev.slice(0, -1));
    setError(false);
  }, []);

  // Physical keyboard support
  useEffect(() => {
    const handler = (e) => {
      if (e.key >= "0" && e.key <= "9") handleDigit(e.key);
      if (e.key === "Backspace") handleBackspace();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleDigit, handleBackspace]);

  // Check the PIN exactly when the 4th digit is entered
  useEffect(() => {
    if (pin.length === 4 && !checking) {
      setChecking(true);
      (async () => {
        const inputHash = await sha256(pin);
        if (inputHash === UNLOCK_HASH) {
          onUnlock({ mode: "normal" });
        } else if (inputHash === PANIC_HASH) {
          onUnlock({ mode: "panic" });
        } else {
          setError(true);
          setPin("");
          if (navigator.vibrate) navigator.vibrate(200);
        }
        setChecking(false);
      })();
    }
  }, [pin, checking, onUnlock]);

  const numpad = [
    "1", "2", "3",
    "4", "5", "6",
    "7", "8", "9",
    "",  "0", "⌫",
  ];

  // Memoize the numpad to completely prevent re-renders of the keys on every digit press
  const numpadGrid = useMemo(() => {
    return (
      <div className="grid grid-cols-3" style={{ gap: 10, width: "min(260px, 78vw)" }}>
        {numpad.map((d, i) => {
          if (d === "") return <div key={i} />;
          const isBack = d === "⌫";
          return (
            <button
              key={i}
              type="button"
              onPointerDown={(e) => {
                // Prevent ghost clicks and trigger instantly
                e.preventDefault();
                isBack ? handleBackspace() : handleDigit(d);
              }}
              className="aspect-square rounded-full flex items-center justify-center transition-all duration-75 active:bg-white/15"
              style={{
                background: "transparent",
                border: "none",
                color: "var(--text-primary)",
                fontSize: isBack ? 22 : 32,
                fontWeight: isBack ? "normal" : "300",
                WebkitTapHighlightColor: "transparent",
              }}
            >
              {d}
            </button>
          );
        })}
      </div>
    );
  }, [handleDigit, handleBackspace, numpad]);

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center select-none"
      style={{
        background: "linear-gradient(135deg, var(--bg-gradient-start), var(--bg-gradient-end))",
      }}
    >
      {/* Ambient glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: "radial-gradient(ellipse 60% 50% at 50% 40%, var(--accent-primary) 0%, transparent 70%)",
          opacity: 0.08,
        }}
      />

      {/* Lock icon */}
      <div className="mb-8 relative">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
          className="w-14 h-14" style={{ color: "var(--accent-primary)", filter: "drop-shadow(0 0 20px var(--accent-primary))" }}>
          <rect x="3" y="11" width="18" height="11" rx="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          <circle cx="12" cy="16" r="1" fill="currentColor" />
        </svg>
      </div>

      {/* Title */}
      <p style={{ fontSize: 11, fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.25em", marginBottom: 20, color: "var(--text-secondary)", opacity: 0.6 }}>
        Введіть PIN
      </p>

      {/* PIN dots */}
      <div className="flex gap-5 mb-4">
        {[0, 1, 2, 3].map((i) => {
          const filled = i < pin.length;
          return (
            <div
              key={i}
              ref={(el) => { dotRefs.current[i] = el; }}
              className="w-4 h-4 rounded-full transition-all duration-200"
              style={{
                background: filled ? "var(--accent-primary)" : "transparent",
                border: `2.5px solid ${error ? "#ef4444" : filled ? "var(--accent-primary)" : "rgba(255,255,255,0.2)"}`,
                boxShadow: filled ? "0 0 14px color-mix(in srgb, var(--accent-primary) 50%, transparent)" : "none",
                transform: error && filled ? "scale(1.3)" : filled ? "scale(1.1)" : "scale(1)",
                animation: error ? "pinShake 0.4s ease" : "none",
              }}
            />
          );
        })}
      </div>

      {/* Error message */}
      <div className="h-5 mb-6 text-xs font-bold transition-opacity duration-300"
        style={{ color: "#ef4444", opacity: error ? 1 : 0 }}>
        Невірний PIN
      </div>

      {/* Numpad */}
      {numpadGrid}

      <style>{`
        @keyframes pinShake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-8px); }
          40% { transform: translateX(8px); }
          60% { transform: translateX(-5px); }
          80% { transform: translateX(5px); }
        }
      `}</style>
    </div>
  );
}
