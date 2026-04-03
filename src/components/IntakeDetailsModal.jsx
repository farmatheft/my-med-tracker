import { useState } from "react";
import { FaPills, FaTrash } from "react-icons/fa6";
import { deleteDoc, doc, Timestamp, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import { formatDateInput, formatTimeInput } from "../utils/time";
import PillTower from "./PillTower";

const PILL25_MG = 25;
const PILL25_STEP = 12.5;
const PILL10_MG = 10;
const PILL10_STEP = 10;

const IntakeDetailsModal = ({ intake, onClose }) => {
  // Try to detect pill breakdown from record, fallback to dosage
  const initial25 = intake.pills25mg ?? intake.dosage ?? 0;
  const initial10 = intake.pills10mg ?? 0;

  const [pills25, setPills25] = useState(initial25);
  const [pills10, setPills10] = useState(initial10);
  const [dateValue, setDateValue] = useState(formatDateInput(intake.timestamp));
  const [timeValue, setTimeValue] = useState(formatTimeInput(intake.timestamp));
  const [showConfirm, setShowConfirm] = useState(false);

  const totalMg = pills25 + pills10;
  const accentColor = intake.patientId === "AH" ? "var(--accent-ah)" : "var(--accent-ei)";

  const handleSave = async () => {
    const nextDate = new Date(`${dateValue}T${timeValue}`);
    await updateDoc(doc(db, "intakes", intake.id), {
      dosage: totalMg,
      unit: "mg",
      subtype: "PO",
      instrument: "pills",
      pills25mg: pills25,
      pills10mg: pills10,
      timestamp: Timestamp.fromDate(nextDate),
      updatedAt: Timestamp.now(),
    });
    onClose();
  };

  const handleDelete = async () => {
    await deleteDoc(doc(db, "intakes", intake.id));
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 transition-all"
      onClick={onClose}>
      <div
        className="relative w-full sm:w-[min(92vw,440px)] sm:mt-12 rounded-t-[2rem] sm:rounded-[2rem] max-h-[90vh] overflow-y-auto border p-5 shadow-2xl"
        style={{
          background: "var(--surface)",
          borderColor: "var(--glass-border)",
          boxShadow: "0 -10px 40px var(--shadow-color-strong), inset 0 1px 0 var(--glass-shine)",
          backdropFilter: "blur(32px)",
          WebkitBackdropFilter: "blur(32px)",
          animation: "modalSlideUp 0.3s cubic-bezier(0.34,1.56,0.64,1)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <style>{`
          @keyframes modalSlideUp {
            from { opacity: 0; transform: translateY(40px); }
            to { opacity: 1; transform: translateY(0); }
          }
        `}</style>

        {/* Top shine */}
        <div className="absolute inset-x-0 top-0 h-px pointer-events-none z-10 rounded-t-[2rem]"
          style={{ background: "linear-gradient(90deg, transparent 5%, var(--glass-shine) 50%, transparent 95%)" }} />

        {/* Grab handle (mobile) */}
        <div className="flex justify-center mb-4 sm:hidden">
          <div className="w-10 h-1 rounded-full" style={{ background: "var(--text-secondary)", opacity: 0.25 }} />
        </div>

        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-base font-black" style={{ color: "var(--text-primary)" }}>
              Редагувати запис
            </h3>
            <div className="flex items-center gap-1.5 mt-1">
              <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full"
                style={{ color: accentColor, background: `color-mix(in srgb, ${accentColor} 12%, transparent)` }}>
                {intake.patientId === "AH" ? "P1" : "P2"}
              </span>
              <span className="text-[10px] font-bold" style={{ color: "var(--text-secondary)" }}>PO</span>
            </div>
          </div>
          <button type="button" onClick={onClose}
            className="w-7 h-7 rounded-full flex items-center justify-center transition-all hover:opacity-70 active:scale-90"
            style={{ background: "rgba(255,255,255,0.07)", color: "var(--text-secondary)", border: "1px solid var(--glass-border)" }}>
            ✕
          </button>
        </div>

        {/* Pill towers + total */}
        <div className="flex items-end justify-center gap-3 mb-4 py-2" style={{ height: 110 }}>
          <div className="w-12">
            <PillTower pills={pills10 / PILL10_MG} accentColor={accentColor} pillType="10" />
          </div>
          <div className="text-center px-3">
            <div className="text-3xl font-black tabular-nums leading-none" style={{ color: accentColor }}>{totalMg}</div>
            <div className="text-[10px] font-bold mt-0.5" style={{ color: accentColor, opacity: 0.6 }}>мг</div>
          </div>
          <div className="w-20">
            <PillTower pills={pills25 / PILL25_MG} accentColor={accentColor} pillType="25" />
          </div>
        </div>

        {/* Controls */}
        <div className="space-y-2.5 mb-4">
          {/* 10mg row */}
          <ModalPillControl
            label="10 мг"
            count={pills10 / PILL10_MG}
            mg={pills10}
            step="×1"
            onMinus={() => setPills10((v) => Math.max(0, v - PILL10_STEP))}
            onPlus={() => setPills10((v) => Math.max(0, Math.min(200 - pills25, v + PILL10_STEP)))}
            accent={accentColor}
            pillType="10"
          />

          {/* 25mg row */}
          <ModalPillControl
            label="25 мг"
            count={pills25 / PILL25_MG}
            mg={pills25}
            step="×½"
            onMinus={() => setPills25((v) => Math.max(0, v - PILL25_STEP))}
            onPlus={() => setPills25((v) => Math.max(0, Math.min(200 - pills10, v + PILL25_STEP)))}
            accent={accentColor}
            pillType="25"
          />
        </div>

        {/* Date & Time */}
        <div className="grid grid-cols-2 gap-2.5 mb-4">
          {[
            { label: "Дата", type: "date", val: dateValue, set: setDateValue },
            { label: "Час", type: "time", val: timeValue, set: setTimeValue },
          ].map(({ label, type, val, set }) => (
            <div key={type}>
              <label className="block text-[9px] font-black uppercase tracking-wider mb-1.5"
                style={{ color: "var(--text-secondary)" }}>{label}</label>
              <input type={type} value={val} onChange={(e) => set(e.target.value)}
                className="w-full rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none"
                style={{
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid var(--glass-border)",
                  color: "var(--text-primary)",
                }} />
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2.5">
          <button type="button" onClick={() => setShowConfirm(true)}
            className="w-11 h-11 flex items-center justify-center rounded-full transition-all hover:scale-105 active:scale-90"
            style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", color: "#ef4444" }}>
            <FaTrash size={14} />
          </button>
          <button type="button" onClick={onClose}
            className="flex-1 rounded-2xl px-4 py-2.5 text-xs font-bold transition-all hover:opacity-80"
            style={{ border: "1px solid var(--glass-border)", color: "var(--text-primary)", background: "rgba(255,255,255,0.04)" }}>
            Закрити
          </button>
          <button type="button" onClick={handleSave}
            className="flex-1 rounded-2xl px-4 py-2.5 text-xs font-black shadow-lg transition-all hover:scale-[1.02] active:scale-[0.97]"
            style={{
              background: `linear-gradient(135deg, ${accentColor}, color-mix(in srgb, ${accentColor} 70%, #fff))`,
              color: "white",
              boxShadow: `0 6px 20px color-mix(in srgb, ${accentColor} 35%, transparent)`,
            }}>
            Зберегти
          </button>
        </div>

        {/* Delete confirm */}
        {showConfirm && (
          <div className="absolute inset-0 flex items-center justify-center rounded-[2rem] z-10"
            style={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)" }}>
            <div className="w-[min(80vw,300px)] rounded-2xl p-5 text-center shadow-2xl"
              style={{ background: "var(--surface)", border: "1px solid var(--glass-border)" }}>
              <div className="w-11 h-11 rounded-full mx-auto flex items-center justify-center mb-3"
                style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444" }}>
                <FaTrash size={16} />
              </div>
              <p className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>Видалити запис?</p>
              <p className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>Цю дію не можна скасувати.</p>
              <div className="mt-4 flex gap-2">
                <button type="button" onClick={() => setShowConfirm(false)}
                  className="flex-1 rounded-xl px-3 py-2 text-xs font-bold"
                  style={{ border: "1px solid var(--glass-border)", color: "var(--text-primary)", background: "rgba(255,255,255,0.04)" }}>
                  Скасувати
                </button>
                <button type="button" onClick={handleDelete}
                  className="flex-1 rounded-xl px-3 py-2 text-xs font-bold text-white shadow-lg"
                  style={{ background: "#ef4444" }}>
                  Підтвердити
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

function ModalPillControl({ label, count, mg, step, onMinus, onPlus, accent, pillType }) {
  return (
    <div className="flex items-center gap-2 rounded-xl px-3 py-2"
      style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--glass-border)" }}>
      <button type="button" onClick={onMinus}
        className="w-9 h-9 rounded-xl flex items-center justify-center text-base font-black transition-all active:scale-90"
        style={{
          background: `color-mix(in srgb, ${accent} 10%, transparent)`, color: accent,
          border: `1px solid color-mix(in srgb, ${accent} 25%, transparent)`,
          WebkitTapHighlightColor: "transparent",
        }}>−</button>
      <div className="flex-1 text-center">
        <div className="flex items-center justify-center gap-1.5">
          <PillTower pills={0} pillType={pillType} mini className="flex-shrink-0" />
          <span className="text-xs font-black tabular-nums" style={{ color: accent }}>
            {pillType === "25" ? count.toFixed(1).replace(".0", "") : count} таб
          </span>
          <span className="text-[9px] font-bold" style={{ color: "var(--text-secondary)", opacity: 0.5 }}>
            ({mg} мг)
          </span>
        </div>
        <div className="text-[8px] font-bold mt-0.5" style={{ color: "var(--text-secondary)", opacity: 0.4 }}>
          {label} · крок {step}
        </div>
      </div>
      <button type="button" onClick={onPlus}
        className="w-9 h-9 rounded-xl flex items-center justify-center text-base font-black transition-all active:scale-90"
        style={{
          background: `color-mix(in srgb, ${accent} 10%, transparent)`, color: accent,
          border: `1px solid color-mix(in srgb, ${accent} 25%, transparent)`,
          WebkitTapHighlightColor: "transparent",
        }}>+</button>
    </div>
  );
}

export default IntakeDetailsModal;
