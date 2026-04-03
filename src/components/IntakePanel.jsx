import { useState } from "react";
import { GiWaterDrop } from "react-icons/gi";
import { FaSyringe, FaPills, FaGhost } from "react-icons/fa";
import { addDoc, collection, Timestamp, query, orderBy, limit, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import PillTower from "./PillTower";
import { formatDateInput, formatTimeInput } from "../utils/time";

/* ═══════════════════════════════════════════════════════════════════════════
   Constants
   ═══════════════════════════════════════════════════════════════════════════ */

const PILL25_MG  = 25;   // mg per full 25mg pill
const PILL25_STEP = 12.5; // half-pill step
const PILL10_MG  = 10;    // mg per 10mg pill
const PILL10_STEP = 10;   // step = 1 pill

const getActiveColor = (patient) =>
  patient === "AH" ? "var(--accent-ah)" : "var(--accent-ei)";

const makePatientState = () => ({
  pills25: 50,  // mg (= 2 pills)
  pills10: 0,   // mg (= 0 pills)
});

/* ═══════════════════════════════════════════════════════════════════════════
   IntakePanel — dual pill columns, mobile-optimised
   ═══════════════════════════════════════════════════════════════════════════ */

export default function IntakePanel({ onAddSuccess, disabled = false }) {
  const [activePatient, setActivePatient] = useState("AH");
  const [stateAH, setStateAH] = useState(makePatientState);
  const [stateEI, setStateEI] = useState(makePatientState);
  const [confirmStep, setConfirmStep] = useState("idle");
  const [dateValue, setDateValue] = useState(formatDateInput(new Date()));
  const [timeValue, setTimeValue] = useState(formatTimeInput(new Date()));
  const [isAdding, setIsAdding] = useState(false);

  const getState = (p) => (p === "AH" ? stateAH : stateEI);
  const patchState = (p, patch) => {
    if (p === "AH") setStateAH((s) => ({ ...s, ...patch }));
    else setStateEI((s) => ({ ...s, ...patch }));
  };

  const isAH = activePatient === "AH";
  const st = getState(activePatient);
  const totalMg = st.pills25 + st.pills10;
  const accentColor = getActiveColor(activePatient);

  /* ── Adjust helpers ─────────────────────────────────────────────────── */
  const adjust25 = (delta) => {
    const next = Math.max(0, Math.min(200 - st.pills10, st.pills25 + delta * PILL25_STEP));
    patchState(activePatient, { pills25: next });
  };

  const adjust10 = (delta) => {
    const next = Math.max(0, Math.min(200 - st.pills25, st.pills10 + delta * PILL10_STEP));
    patchState(activePatient, { pills10: next });
  };

  /* ── Save to Firestore ──────────────────────────────────────────────── */
  const handleAddIntake = async (intakeTime) => {
    setIsAdding(true);
    try {
      await addDoc(collection(db, "intakes"), {
        patientId: activePatient,
        dosage: totalMg,
        unit: "mg",
        subtype: "PO",
        instrument: "pills",
        pills25mg: st.pills25,
        pills10mg: st.pills10,
        timestamp: Timestamp.fromDate(intakeTime),
        createdAt: Timestamp.now(),
      });

      // Bank deduction
      if (totalMg > 0) {
        const bankCol = activePatient === "AH" ? "bank_logs_ah" : "bank_logs_ei";
        const bankQ = query(collection(db, bankCol), orderBy("timestamp", "desc"), limit(1));
        const snap = await getDocs(bankQ);
        if (!snap.empty) {
          const latest = snap.docs[0].data();
          const newRem = Math.max(0, latest.currentRemainder - totalMg);
          await addDoc(collection(db, bankCol), {
            timestamp: Timestamp.fromDate(intakeTime),
            createdAt: Timestamp.now(),
            totalCapacity: latest.totalCapacity,
            currentRemainder: Math.round(newRem * 10) / 10,
            type: "intake",
            amount: -totalMg,
            note: `Прийом ${activePatient} PO`,
          });
        }
      }

      onAddSuccess(`${activePatient}: Додано ${totalMg} мг (PO)`);
      patchState(activePatient, { pills25: 0, pills10: 0 });
      setConfirmStep("idle");
    } catch (e) {
      console.error(e);
    } finally {
      setIsAdding(false);
    }
  };

  const openConfirm = () => {
    setDateValue(formatDateInput(new Date()));
    setTimeValue(formatTimeInput(new Date()));
    setConfirmStep("confirm");
  };

  const handleAddWithTime = () => {
    handleAddIntake(new Date(`${dateValue}T${timeValue}`));
  };

  /* ── Preview values for both patients (header tabs) ─────────────────── */
  const previewAH = stateAH.pills25 + stateAH.pills10;
  const previewEI = stateEI.pills25 + stateEI.pills10;

  /* ═══════════════════════════════════════════════════════════════════════
     Render
     ═══════════════════════════════════════════════════════════════════════ */
  return (
    <div
      className="relative rounded-3xl overflow-hidden touch-manipulation"
      style={{
        background: "var(--surface-2)",
        backdropFilter: "blur(32px)",
        WebkitBackdropFilter: "blur(32px)",
        border: "1px solid var(--glass-border)",
        boxShadow: "0 8px 40px var(--shadow-color-strong), inset 0 1px 0 var(--glass-shine)",
        opacity: disabled ? 0.4 : 1,
        pointerEvents: disabled ? "none" : "auto",
        transition: "opacity 0.3s",
      }}
    >
      {/* Top shine */}
      <div className="absolute inset-x-0 top-0 h-px pointer-events-none z-10"
        style={{ background: "linear-gradient(90deg, transparent 5%, var(--glass-shine) 50%, transparent 95%)" }} />

      {/* Background glow */}
      <div className="absolute inset-0 pointer-events-none transition-all duration-700"
        style={{
          background: isAH
            ? "radial-gradient(ellipse 70% 80% at -10% 50%, var(--accent-ah) 0%, transparent 65%)"
            : "radial-gradient(ellipse 70% 80% at 110% 50%, var(--accent-ei) 0%, transparent 65%)",
          opacity: 0.1,
        }} />

      {/* ── PATIENT TABS ── */}
      <div className="flex relative z-10" style={{ borderBottom: "1px solid var(--glass-border)" }}>
        {[
          { id: "AH", accent: "var(--accent-ah)", mg: previewAH },
          { id: "EI", accent: "var(--accent-ei)", mg: previewEI },
        ].map(({ id, accent, mg }) => {
          const isActive = activePatient === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setActivePatient(id)}
              className="flex-1 relative flex flex-col items-center py-2 transition-all duration-300"
              style={{
                background: isActive
                  ? `linear-gradient(180deg, color-mix(in srgb, ${accent} 14%, transparent), transparent)`
                  : "transparent",
                color: isActive ? accent : "var(--text-secondary)",
                WebkitTapHighlightColor: "transparent",
              }}
            >
              <div className="absolute bottom-0 left-3 right-3 h-0.5 rounded-full transition-all duration-300"
                style={{ background: accent, opacity: isActive ? 1 : 0, boxShadow: isActive ? `0 0 8px ${accent}` : "none" }} />
              <span className="text-[11px] font-black tracking-[0.18em] uppercase leading-none"
                style={{ opacity: isActive ? 1 : 0.35, textShadow: isActive ? `0 0 12px ${accent}88` : "none" }}>
                {id === "AH" ? "P1" : id === "EI" ? "P2" : id}
              </span>
              <span className="text-[9px] font-bold mt-0.5 tabular-nums"
                style={{ color: isActive ? accent : "var(--text-secondary)", opacity: isActive ? 0.85 : 0.25 }}>
                {mg} мг
              </span>
            </button>
          );
        })}
      </div>

      {/* ── BODY — pill towers + controls ── */}
      <div className="relative z-10">
        {/* IDLE state: pills + controls */}
        <div
          className="flex flex-col transition-all duration-300"
          style={{
            opacity: confirmStep !== "idle" ? 0 : 1,
            pointerEvents: confirmStep !== "idle" ? "none" : "auto",
            maxHeight: confirmStep !== "idle" ? 0 : 600,
            overflow: confirmStep !== "idle" ? "hidden" : "visible",
          }}
        >
          {/* Tap zones — left = AH, right = EI */}
          <div className="flex" style={{ minHeight: 200 }}>
            {/* LEFT SIDE — AH towers (10mg + 25mg) */}
            <div
              className="flex-1 flex items-end justify-center gap-1 px-2 pb-3 pt-10 cursor-pointer relative transition-all duration-300"
              onClick={() => setActivePatient("AH")}
              style={{
                opacity: isAH ? 1 : 0.3,
                WebkitTapHighlightColor: "transparent",
              }}
            >
              {/* 10mg tower */}
              <div className="w-10 flex-shrink-0" style={{ height: 140 }}>
                <PillTower
                  pills={stateAH.pills10 / PILL10_MG}
                  accentColor="var(--accent-ah)"
                  pillType="10"
                />
              </div>
              {/* 25mg tower */}
              <div className="w-16 flex-shrink-0" style={{ height: 140 }}>
                <PillTower
                  pills={stateAH.pills25 / PILL25_MG}
                  accentColor="var(--accent-ah)"
                  pillType="25"
                />
              </div>
              {/* Label */}
              <div className="absolute top-2 left-0 right-0 flex justify-center">
                <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full"
                  style={{
                    color: "var(--accent-ah)",
                    background: isAH ? "color-mix(in srgb, var(--accent-ah) 12%, transparent)" : "transparent",
                    border: isAH ? "1px solid color-mix(in srgb, var(--accent-ah) 25%, transparent)" : "1px solid transparent",
                  }}>P1</span>
              </div>
            </div>

            {/* CENTER — controls column */}
            <div className="flex flex-col items-center justify-center gap-3 px-2 py-3 flex-shrink-0" style={{ width: 140 }}>
              {/* Total dosage */}
              <div className="text-center mb-1">
                <div className="text-3xl font-black tabular-nums leading-none" style={{ color: accentColor }}>
                  {totalMg}
                </div>
                <div className="text-[10px] font-bold mt-0.5" style={{ color: accentColor, opacity: 0.6 }}>мг</div>
              </div>

              {/* 10mg control */}
              <PillControl
                label="10 мг"
                count={st.pills10 / PILL10_MG}
                countLabel={`${st.pills10 / PILL10_MG} таб`}
                mgLabel={`${st.pills10} мг`}
                onMinus={() => adjust10(-1)}
                onPlus={() => adjust10(1)}
                accentColor={accentColor}
                pillType="10"
              />

              {/* 25mg control */}
              <PillControl
                label="25 мг"
                count={st.pills25 / PILL25_MG}
                countLabel={`${(st.pills25 / PILL25_MG).toFixed(1).replace(".0", "")} таб`}
                mgLabel={`${st.pills25} мг`}
                onMinus={() => adjust25(-1)}
                onPlus={() => adjust25(1)}
                accentColor={accentColor}
                pillType="25"
              />
            </div>

            {/* RIGHT SIDE — EI towers (25mg + 10mg) */}
            <div
              className="flex-1 flex items-end justify-center gap-1 px-2 pb-3 pt-10 cursor-pointer relative transition-all duration-300"
              onClick={() => setActivePatient("EI")}
              style={{
                opacity: !isAH ? 1 : 0.3,
                WebkitTapHighlightColor: "transparent",
              }}
            >
              {/* 25mg tower */}
              <div className="w-16 flex-shrink-0" style={{ height: 140 }}>
                <PillTower
                  pills={stateEI.pills25 / PILL25_MG}
                  accentColor="var(--accent-ei)"
                  pillType="25"
                />
              </div>
              {/* 10mg tower */}
              <div className="w-10 flex-shrink-0" style={{ height: 140 }}>
                <PillTower
                  pills={stateEI.pills10 / PILL10_MG}
                  accentColor="var(--accent-ei)"
                  pillType="10"
                />
              </div>
              {/* Label */}
              <div className="absolute top-2 left-0 right-0 flex justify-center">
                <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full"
                  style={{
                    color: "var(--accent-ei)",
                    background: !isAH ? "color-mix(in srgb, var(--accent-ei) 12%, transparent)" : "transparent",
                    border: !isAH ? "1px solid color-mix(in srgb, var(--accent-ei) 25%, transparent)" : "1px solid transparent",
                  }}>P2</span>
              </div>
            </div>
          </div>

          {/* Add button */}
          <div className="px-4 pb-3 pt-1">
            <button
              type="button"
              onClick={openConfirm}
              disabled={totalMg === 0}
              className="w-full py-3 rounded-2xl font-black text-sm transition-all duration-300 hover:scale-[1.02] active:scale-[0.97] relative overflow-hidden group"
              style={{
                background: totalMg > 0 ? "var(--add-btn-bg)" : "rgba(255,255,255,0.04)",
                color: totalMg > 0 ? "var(--add-btn-text)" : "var(--text-secondary)",
                border: totalMg > 0 ? "1px solid var(--add-btn-border)" : "1px solid var(--glass-border)",
                boxShadow: totalMg > 0 ? "0 8px 24px var(--shadow-color-strong), 0 0 16px var(--add-btn-glow)44" : "none",
                opacity: totalMg > 0 ? 1 : 0.4,
              }}
            >
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0) 55%)" }} />
              <span className="inline-flex items-center justify-center gap-2 relative z-10">
                <span className="text-xl leading-none">+</span>
                Додати {totalMg} мг
              </span>
            </button>
          </div>
        </div>

        {/* ── CONFIRM OVERLAY ── */}
        {confirmStep !== "idle" && (
          <div
            className="flex flex-col justify-between px-4 py-4 gap-3"
            style={{ animation: "fadeSlideUp 0.22s cubic-bezier(0.34,1.56,0.64,1) both" }}
          >
            <style>{`
              @keyframes fadeSlideUp {
                from { opacity:0; transform:translateY(12px) scale(0.97); }
                to   { opacity:1; transform:translateY(0)    scale(1);    }
              }
            `}</style>

            {/* Summary */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl flex items-center justify-center font-black text-xs flex-shrink-0"
                style={{
                  background: `color-mix(in srgb, ${accentColor} 18%, transparent)`,
                  border: `1.5px solid color-mix(in srgb, ${accentColor} 40%, transparent)`,
                  color: accentColor,
                }}>
                {activePatient === "AH" ? "P1" : "P2"}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-lg font-black tracking-tighter leading-none" style={{ color: "var(--text-primary)" }}>
                  {totalMg} <span className="text-xs font-bold opacity-50">мг</span>
                </div>
                <div className="text-[9px] font-bold mt-0.5" style={{ color: "var(--text-secondary)", opacity: 0.7 }}>
                  {st.pills25 > 0 && `${(st.pills25 / PILL25_MG).toFixed(1).replace(".0", "")}×25мг`}
                  {st.pills25 > 0 && st.pills10 > 0 && " + "}
                  {st.pills10 > 0 && `${st.pills10 / PILL10_MG}×10мг`}
                  {" · PO"}
                </div>
              </div>
              <button type="button" onClick={() => setConfirmStep("idle")}
                className="w-7 h-7 rounded-full flex items-center justify-center transition-all hover:opacity-70 active:scale-90 flex-shrink-0"
                style={{ background: "rgba(255,255,255,0.07)", color: "var(--text-secondary)", border: "1px solid var(--glass-border)" }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="w-3.5 h-3.5">
                  <path d="M18 6L6 18M6 6l12 12"/>
                </svg>
              </button>
            </div>

            {/* Time picker */}
            {confirmStep === "pick-time" && (
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: "Дата", type: "date", val: dateValue, set: setDateValue },
                  { label: "Час",  type: "time", val: timeValue, set: setTimeValue },
                ].map(({ label, type, val, set }) => (
                  <div key={type}>
                    <label className="block text-[9px] font-black uppercase tracking-wider mb-1"
                      style={{ color: "var(--text-secondary)" }}>{label}</label>
                    <input type={type} value={val} onChange={(e) => set(e.target.value)}
                      className="w-full rounded-xl px-2 py-2 text-xs font-semibold focus:outline-none"
                      style={{
                        background: "rgba(255,255,255,0.06)",
                        border: `1px solid color-mix(in srgb, ${accentColor} 30%, transparent)`,
                        color: "var(--text-primary)",
                      }} />
                  </div>
                ))}
              </div>
            )}

            {/* Action buttons */}
            <div className="flex flex-col gap-1.5" style={{ borderTop: "1px solid var(--glass-border)", paddingTop: 8 }}>
              {confirmStep === "confirm" ? (
                <>
                  <button type="button" onClick={() => handleAddIntake(new Date())} disabled={isAdding}
                    className="w-full py-3 rounded-2xl font-black text-sm transition-all duration-200 hover:scale-[1.02] active:scale-[0.97] relative overflow-hidden group"
                    style={{
                      background: "var(--add-btn-bg)", color: "var(--add-btn-text)",
                      border: "1px solid var(--add-btn-border)",
                      boxShadow: "0 8px 24px var(--shadow-color-strong), 0 0 16px var(--add-btn-glow)44",
                      opacity: isAdding ? 0.6 : 1,
                    }}>
                    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                      style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0) 55%)" }} />
                    <span className="relative z-10 inline-flex items-center justify-center gap-2">
                      {isAdding
                        ? <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                        : <span className="text-xl leading-none">+</span>}
                      Додати зараз
                    </span>
                  </button>
                  <button type="button" onClick={() => setConfirmStep("pick-time")}
                    className="w-full py-2.5 rounded-xl font-bold text-xs transition-all hover:opacity-80 active:scale-[0.97]"
                    style={{ background: "rgba(255,255,255,0.04)", color: "var(--text-secondary)", border: "1px solid var(--glass-border)" }}>
                    <span className="inline-flex items-center gap-1.5">
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                      </svg>
                      Вказати час
                    </span>
                  </button>
                </>
              ) : (
                <div className="flex gap-2">
                  <button type="button" onClick={() => setConfirmStep("confirm")}
                    className="flex-1 rounded-xl px-3 py-2.5 text-xs font-bold transition-all active:scale-95"
                    style={{ border: "1px solid var(--glass-border)", color: "var(--text-primary)", background: "rgba(255,255,255,0.04)" }}>
                    Назад
                  </button>
                  <button type="button" onClick={handleAddWithTime} disabled={isAdding}
                    className="flex-[2] rounded-xl px-3 py-2.5 text-xs font-black transition-all active:scale-95 hover:opacity-90 relative overflow-hidden"
                    style={{
                      background: `linear-gradient(135deg, ${accentColor}, color-mix(in srgb, ${accentColor} 70%, #fff))`,
                      color: "white", opacity: isAdding ? 0.6 : 1,
                      boxShadow: `0 6px 20px color-mix(in srgb, ${accentColor} 40%, transparent)`,
                    }}>
                    {isAdding ? "..." : "Додати"}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   PillControl — inline +/- row for a single pill type
   ═══════════════════════════════════════════════════════════════════════════ */

function PillControl({ label, count, countLabel, mgLabel, onMinus, onPlus, accentColor, pillType }) {
  const is10 = pillType === "10";
  return (
    <div
      className="w-full flex items-center gap-1.5 rounded-xl px-2 py-1.5"
      style={{
        background: "rgba(255,255,255,0.03)",
        border: "1px solid var(--glass-border)",
      }}
    >
      <button type="button" onClick={onMinus}
        className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-black transition-all active:scale-90"
        style={{
          background: `color-mix(in srgb, ${accentColor} 10%, transparent)`,
          color: accentColor,
          border: `1px solid color-mix(in srgb, ${accentColor} 20%, transparent)`,
          WebkitTapHighlightColor: "transparent",
        }}>−</button>

      <div className="flex-1 text-center min-w-0">
        <div className="flex items-center justify-center gap-1">
          <PillTower pills={0} pillType={pillType} mini className="flex-shrink-0" />
          <span className="text-[11px] font-black tabular-nums" style={{ color: accentColor }}>{countLabel}</span>
        </div>
        <div className="text-[8px] font-bold" style={{ color: "var(--text-secondary)", opacity: 0.5 }}>
          {mgLabel} · {is10 ? "крок 1" : "крок ½"}
        </div>
      </div>

      <button type="button" onClick={onPlus}
        className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-black transition-all active:scale-90"
        style={{
          background: `color-mix(in srgb, ${accentColor} 10%, transparent)`,
          color: accentColor,
          border: `1px solid color-mix(in srgb, ${accentColor} 20%, transparent)`,
          WebkitTapHighlightColor: "transparent",
        }}>+</button>
    </div>
  );
}
