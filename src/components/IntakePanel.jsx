import { useState } from "react";
import { GiWaterDrop } from "react-icons/gi";
import { FaSyringe, FaPills, FaGhost } from "react-icons/fa";
import { addDoc, collection, Timestamp, query, orderBy, limit, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import SyringeSlider from "syringe-slider";
import SubtypeSelector from "./SubtypeSelector";
import { formatDateInput, formatTimeInput } from "../utils/time";

const UNIT_CONFIG = {
  mg: { min: 0, max: 100, step: 1,   default: 0, label: "мг" },
  ml: { min: 0, max: 5.0, step: 0.1, default: 0, label: "мл" },
};

const SUBTYPE_OPTIONS = [
  { value: "IV",    label: "IV",    icon: GiWaterDrop },
  { value: "IM",    label: "IM",    icon: FaSyringe   },
  { value: "PO",    label: "PO",    icon: FaPills     },
  { value: "IV+PO", label: "IV+PO", icon: GiWaterDrop },
  { value: "VTRK",  label: "VTRK",  icon: GiWaterDrop },
  { value: "LOST",  label: "LOST",  icon: FaGhost     },
];

const PATIENT_DEFAULTS = {
  AH: { subtype: "IM", unit: "mg" },
  EI: { subtype: "IV", unit: "mg" },
};

const getActiveColor = (subtype, patient) => {
  if (subtype === "IV")    return "var(--subtype-iv)";
  if (subtype === "IM")    return "var(--subtype-im)";
  if (subtype === "PO")    return "var(--subtype-po)";
  if (subtype === "IV+PO") return "var(--subtype-ivpo)";
  if (subtype === "VTRK")  return "var(--subtype-vtrk)";
  return patient === "AH" ? "var(--accent-ah)" : "var(--accent-ei)";
};

const makePatientState = (patient) => ({
  unit:    PATIENT_DEFAULTS[patient].unit,
  dosage:  UNIT_CONFIG[PATIENT_DEFAULTS[patient].unit].default,
  subtype: PATIENT_DEFAULTS[patient].subtype,
});

export default function IntakePanel({ onAddSuccess }) {
  const [activePatient, setActivePatient] = useState("AH");
  const [stateAH, setStateAH] = useState(() => makePatientState("AH"));
  const [stateEI, setStateEI] = useState(() => makePatientState("EI"));
  const [confirmStep, setConfirmStep] = useState("idle");
  const [dateValue, setDateValue]     = useState(formatDateInput(new Date()));
  const [timeValue, setTimeValue]     = useState(formatTimeInput(new Date()));
  const [isAdding, setIsAdding]       = useState(false);

  const getState   = (p) => (p === "AH" ? stateAH : stateEI);
  const patchState = (p, patch) => {
    if (p === "AH") setStateAH((s) => ({ ...s, ...patch }));
    else            setStateEI((s) => ({ ...s, ...patch }));
  };

  const active      = getState(activePatient);
  const activeColor = getActiveColor(active.subtype, activePatient);
  const isAHActive  = activePatient === "AH";
  const ahState     = getState("AH");
  const eiState     = getState("EI");

  const handleUnitChange = (newUnit) => {
    const prev = active.dosage;
    let newDosage = newUnit === "mg"
      ? Math.round(prev * 20)
      : Math.round((prev / 20) * 10) / 10;
    const cfg = UNIT_CONFIG[newUnit];
    newDosage = Math.min(Math.max(newDosage, cfg.min), cfg.max);
    patchState(activePatient, { unit: newUnit, dosage: newDosage });
  };

  const adjustDosage = (delta) => {
    const cfg  = UNIT_CONFIG[active.unit];
    const next = Math.round((active.dosage + delta * cfg.step) * 10) / 10;
    patchState(activePatient, { dosage: Math.min(Math.max(next, cfg.min), cfg.max) });
  };

  const handleAddIntake = async (intakeTime) => {
    const finalPatientId = active.subtype === "LOST" ? "NO" : activePatient;
    setIsAdding(true);
    try {
      await addDoc(collection(db, "intakes"), {
        patientId: finalPatientId,
        dosage:    active.dosage,
        unit:      active.unit,
        subtype:   active.subtype || null,
        timestamp: Timestamp.fromDate(intakeTime),
        createdAt: Timestamp.now(),
      });

      // Deduct from the patient-specific bank
      if (active.dosage > 0 && active.subtype !== "LOST") {
        const bankCollection = activePatient === "AH" ? "bank_logs_ah" : "bank_logs_ei";
        const amountToDeduct = active.unit === "mg" ? active.dosage : Math.round(active.dosage * 20);
        const bankQuery = query(collection(db, bankCollection), orderBy("timestamp", "desc"), limit(1));
        const bankSnapshot = await getDocs(bankQuery);

        if (!bankSnapshot.empty) {
          const latestBankLog = bankSnapshot.docs[0].data();
          const newRemainder = Math.max(0, latestBankLog.currentRemainder - amountToDeduct);
          const noteText = `Прийом ${finalPatientId} ${active.subtype || ""}`.trim();

          await addDoc(collection(db, bankCollection), {
            timestamp: Timestamp.fromDate(intakeTime),
            createdAt: Timestamp.now(),
            totalCapacity: latestBankLog.totalCapacity,
            currentRemainder: Math.round(newRemainder * 10) / 10,
            type: "intake",
            amount: -amountToDeduct,
            note: noteText,
          });
        }
      }

      onAddSuccess(
        `${finalPatientId}: Додано ${active.dosage} ${active.unit}${
          active.subtype === "LOST" ? " (LOST)" : ""
        }`
      );
      patchState(activePatient, { dosage: 0 });
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
    const date = new Date(`${dateValue}T${timeValue}`);
    handleAddIntake(date);
  };

  const finalPatient = active.subtype === "LOST" ? "NO" : activePatient;

  return (
    <div
      className="relative rounded-3xl"
      style={{
        background: "var(--surface-2)",
        backdropFilter: "blur(32px)",
        WebkitBackdropFilter: "blur(32px)",
        border: "1px solid var(--glass-border)",
        boxShadow: `0 8px 40px var(--shadow-color-strong), inset 0 1px 0 var(--glass-shine)`,
        transition: "box-shadow 0.5s ease",
      }}
    >
      {/* Top shine */}
      <div
        className="absolute inset-x-0 top-0 h-px pointer-events-none z-10"
        style={{ background: "linear-gradient(90deg, transparent 5%, var(--glass-shine) 50%, transparent 95%)" }}
      />

      {/* Animated patient glow behind everything */}
      <div
        className="absolute inset-0 pointer-events-none transition-all duration-700"
        style={{
          background: isAHActive
            ? `radial-gradient(ellipse 70% 80% at -10% 50%, var(--accent-ah) 0%, transparent 65%)`
            : `radial-gradient(ellipse 70% 80% at 110% 50%, var(--accent-ei) 0%, transparent 65%)`,
          opacity: 0.1,
        }}
      />
      {/* Secondary glow from bottom for depth */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `radial-gradient(ellipse 100% 60% at 50% 110%, ${isAHActive ? "var(--accent-ah)" : "var(--accent-ei)"} 0%, transparent 70%)`,
          opacity: 0.06,
          transition: "background 0.6s ease",
        }}
      />

      {/* ── PATIENT TAB SWITCHER ── */}
      <div
        className="flex relative z-10"
        style={{ borderBottom: "1px solid var(--glass-border)" }}
      >
        {[
          { id: "AH", accent: "var(--accent-ah)" },
          { id: "EI", accent: "var(--accent-ei)" },
        ].map(({ id, accent }) => {
          const isActive = activePatient === id;
          const pState   = getState(id);
          const pColor   = getActiveColor(pState.subtype, id);
          return (
            <button
              key={id}
              type="button"
              onClick={() => setActivePatient(id)}
              className="flex-1 relative flex flex-col items-center py-2.5 transition-all duration-300"
              style={{
                background: isActive
                  ? `linear-gradient(180deg, color-mix(in srgb, ${accent} 14%, transparent), transparent)`
                  : "transparent",
                color: isActive ? accent : "var(--text-secondary)",
              }}
            >
              {/* Active indicator bar */}
              <div
                className="absolute bottom-0 left-3 right-3 h-0.5 rounded-full transition-all duration-300"
                style={{
                  background: accent,
                  opacity: isActive ? 1 : 0,
                  boxShadow: isActive ? `0 0 8px ${accent}` : "none",
                }}
              />
              <span
                className="text-[11px] font-black tracking-[0.18em] uppercase leading-none"
                style={{
                  opacity: isActive ? 1 : 0.35,
                  textShadow: isActive ? `0 0 12px ${accent}88` : "none",
                  transition: "opacity 0.3s, text-shadow 0.3s",
                }}
              >
                {id}
              </span>
              {/* Mini dosage preview */}
              <span
                className="text-[9px] font-bold mt-0.5 tabular-nums"
                style={{
                  color: isActive ? pColor : "var(--text-secondary)",
                  opacity: isActive ? 0.85 : 0.25,
                  transition: "opacity 0.3s, color 0.3s",
                }}
              >
                {pState.dosage} {pState.unit}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── BODY ── */}
      <div className="relative flex items-stretch" style={{ minHeight: 340, overflow: "visible" }}>

        {/* LEFT SYRINGE: AH */}
        <SyringeColumn
          patient="AH"
          state={ahState}
          isActive={isAHActive}
          accentVar="var(--accent-ah)"
          side="right"
          onActivate={() => setActivePatient("AH")}
          onChange={(v) => { if (!isAHActive) setActivePatient("AH"); patchState("AH", { dosage: v }); }}
        />

        {/* CENTER CONTROLS */}
        <div className="flex flex-col flex-1 min-w-0 px-3 pt-2.5 pb-3 gap-2 relative">

          {/* ── IDLE: dosage controls ── */}
          <div
            className="flex flex-col flex-1 gap-2 transition-all duration-300"
            style={{
              opacity:       confirmStep !== "idle" ? 0 : 1,
              pointerEvents: confirmStep !== "idle" ? "none" : "auto",
            }}
          >
            {/* Unit toggle */}
            <div className="flex justify-center">
              <div
                className="flex rounded-xl overflow-hidden p-0.5 gap-0.5"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid var(--glass-border)",
                }}
              >
                {["mg", "ml"].map((u) => (
                  <button
                    key={u}
                    onClick={() => handleUnitChange(u)}
                    className="px-4 py-1.5 text-[10px] font-black transition-all duration-200 rounded-lg"
                    style={{
                      background: active.unit === u
                        ? `color-mix(in srgb, ${activeColor} 22%, transparent)`
                        : "transparent",
                      color: active.unit === u ? activeColor : "var(--text-secondary)",
                      border: active.unit === u ? `1px solid ${activeColor}55` : "1px solid transparent",
                      boxShadow: active.unit === u ? `0 0 8px ${activeColor}33` : "none",
                    }}
                  >
                    {u}
                  </button>
                ))}
              </div>
            </div>

            {/* Subtype selector */}
            <SubtypeSelector
              value={active.subtype}
              onChange={(v) => patchState(activePatient, { subtype: v })}
              options={SUBTYPE_OPTIONS}
            />

            {/* Dosage display */}
            <div className="flex flex-col items-center justify-center flex-1 py-0.5">
              {/* Big number with halo */}
              <div
                className="relative flex items-end gap-1.5"
                style={{ filter: `drop-shadow(0 0 16px ${activeColor}55)` }}
              >
                <span
                  key={activePatient}
                  className="text-5xl leading-none font-black tracking-tighter tabular-nums"
                  style={{ color: activeColor }}
                >
                  {active.dosage}
                </span>
                <span
                  className="text-xs font-black pb-1.5"
                  style={{ color: activeColor, opacity: 0.6 }}
                >
                  {UNIT_CONFIG[active.unit].label}
                </span>
              </div>

              {/* ± buttons */}
              <div className="flex gap-3 mt-2.5">
                {[{ d: -1, sym: "−" }, { d: 1, sym: "+" }].map(({ d, sym }) => (
                  <button
                    key={d}
                    onClick={() => adjustDosage(d)}
                    className="w-10 h-10 rounded-2xl flex items-center justify-center text-base font-black transition-all duration-150 hover:scale-110 active:scale-90"
                    style={{
                      background: `color-mix(in srgb, ${activeColor} 12%, transparent)`,
                      color: activeColor,
                      border: `1px solid ${activeColor}44`,
                      boxShadow: `0 4px 12px ${activeColor}20`,
                    }}
                  >
                    {sym}
                  </button>
                ))}
              </div>
            </div>

            {/* Add button */}
            <button
              type="button"
              onClick={openConfirm}
              className="w-full py-3.5 rounded-2xl font-black text-sm transition-all duration-300 hover:scale-[1.03] hover:-translate-y-0.5 active:scale-[0.97] group relative overflow-hidden"
              style={{
                background: "var(--add-btn-bg)",
                color:      "var(--add-btn-text)",
                border:     "1px solid var(--add-btn-border)",
                boxShadow:  `0 10px 30px var(--shadow-color-strong), 0 0 20px var(--add-btn-glow)44`,
              }}
            >
              <div
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0) 55%)" }}
              />
              <span className="inline-flex items-center justify-center gap-2 relative z-10">
                <span className="text-xl leading-none">+</span>
                Додати
              </span>
            </button>
          </div>

          {/* ── CONFIRM OVERLAY ── */}
          {confirmStep !== "idle" && (
            <div
              className="absolute inset-0 flex flex-col justify-between"
              style={{
                animation: "fadeSlideUp 0.22s cubic-bezier(0.34,1.56,0.64,1) both",
                padding: "4px 0 0",
              }}
            >
              <style>{`
                @keyframes fadeSlideUp {
                  from { opacity:0; transform:translateY(12px) scale(0.97); }
                  to   { opacity:1; transform:translateY(0)    scale(1);    }
                }
              `}</style>

              {/* Summary row */}
              <div className="flex items-center gap-2 px-0.5 pt-0.5">
                <div
                  className="w-10 h-10 rounded-2xl flex items-center justify-center font-black text-xs flex-shrink-0"
                  style={{
                    background: `color-mix(in srgb, ${activeColor} 18%, transparent)`,
                    border: `1.5px solid ${activeColor}55`,
                    color: activeColor,
                    boxShadow: `0 4px 16px ${activeColor}30`,
                  }}
                >
                  {finalPatient}
                </div>
                <div className="flex-1 min-w-0">
                  <div
                    className="text-lg font-black tracking-tighter leading-none"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {active.dosage}{" "}
                    <span className="text-xs font-bold opacity-50">{active.unit}</span>
                  </div>
                  {active.subtype && (
                    <div
                      className="text-[9px] font-black uppercase tracking-wider mt-0.5"
                      style={{ color: activeColor, opacity: 0.85 }}
                    >
                      {active.subtype}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setConfirmStep("idle")}
                  className="w-7 h-7 rounded-full flex items-center justify-center transition-all hover:opacity-70 active:scale-90 flex-shrink-0"
                  style={{
                    background: "rgba(255,255,255,0.07)",
                    color: "var(--text-secondary)",
                    border: "1px solid var(--glass-border)",
                  }}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="w-3.5 h-3.5">
                    <path d="M18 6L6 18M6 6l12 12"/>
                  </svg>
                </button>
              </div>

              {/* Time picker */}
              {confirmStep === "pick-time" && (
                <div className="grid grid-cols-2 gap-2 px-0.5">
                  {[
                    { label: "Дата", type: "date", val: dateValue, set: setDateValue },
                    { label: "Час",  type: "time", val: timeValue, set: setTimeValue },
                  ].map(({ label, type, val, set }) => (
                    <div key={type}>
                      <label
                        className="block text-[9px] font-black uppercase tracking-wider mb-1"
                        style={{ color: "var(--text-secondary)" }}
                      >
                        {label}
                      </label>
                      <input
                        type={type}
                        value={val}
                        onChange={(e) => set(e.target.value)}
                        className="w-full rounded-xl px-2 py-2 text-xs font-semibold focus:outline-none"
                        style={{
                          background: "rgba(255,255,255,0.06)",
                          border: `1px solid ${activeColor}44`,
                          color: "var(--text-primary)",
                          backdropFilter: "blur(8px)",
                        }}
                      />
                    </div>
                  ))}
                </div>
              )}

              {/* Action buttons */}
              <div
                className="flex flex-col gap-1.5"
                style={{ borderTop: "1px solid var(--glass-border)", paddingTop: 8 }}
              >
                {confirmStep === "confirm" ? (
                  <>
                    <button
                      type="button"
                      onClick={() => handleAddIntake(new Date())}
                      disabled={isAdding}
                      className="w-full py-3.5 rounded-2xl font-black text-sm transition-all duration-200 hover:scale-[1.02] active:scale-[0.97] relative overflow-hidden group"
                      style={{
                        background: "var(--add-btn-bg)",
                        color:      "var(--add-btn-text)",
                        border:     "1px solid var(--add-btn-border)",
                        boxShadow:  `0 8px 24px var(--shadow-color-strong), 0 0 16px var(--add-btn-glow)44`,
                        opacity:    isAdding ? 0.6 : 1,
                      }}
                    >
                      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300" style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0) 55%)" }} />
                      <span className="relative z-10 inline-flex items-center justify-center gap-2">
                        {isAdding
                          ? <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                          : <span className="text-xl leading-none">+</span>
                        }
                        Додати зараз
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmStep("pick-time")}
                      className="w-full py-2.5 rounded-xl font-bold text-xs transition-all hover:opacity-80 active:scale-[0.97]"
                      style={{
                        background: "rgba(255,255,255,0.04)",
                        color: "var(--text-secondary)",
                        border: "1px solid var(--glass-border)",
                      }}
                    >
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
                    <button
                      type="button"
                      onClick={() => setConfirmStep("confirm")}
                      className="flex-1 rounded-xl px-3 py-2.5 text-xs font-bold transition-all active:scale-95"
                      style={{
                        border: "1px solid var(--glass-border)",
                        color: "var(--text-primary)",
                        background: "rgba(255,255,255,0.04)",
                      }}
                    >
                      Назад
                    </button>
                    <button
                      type="button"
                      onClick={handleAddWithTime}
                      disabled={isAdding}
                      className="flex-[2] rounded-xl px-3 py-2.5 text-xs font-black transition-all active:scale-95 hover:opacity-90 relative overflow-hidden"
                      style={{
                        background: `linear-gradient(135deg, ${activeColor}, color-mix(in srgb, ${activeColor} 70%, #fff))`,
                        color: "white",
                        opacity: isAdding ? 0.6 : 1,
                        boxShadow: `0 6px 20px ${activeColor}55`,
                      }}
                    >
                      {isAdding ? "..." : "Додати"}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT SYRINGE: EI */}
        <SyringeColumn
          patient="EI"
          state={eiState}
          isActive={!isAHActive}
          accentVar="var(--accent-ei)"
          side="left"
          onActivate={() => setActivePatient("EI")}
          onChange={(v) => { if (isAHActive) setActivePatient("EI"); patchState("EI", { dosage: v }); }}
        />
      </div>
    </div>
  );
}

/* ─── Syringe column ─────────────────────────────────────────────────────────── */
function SyringeColumn({ patient, state, isActive, accentVar, side, onActivate, onChange }) {
  const color = getActiveColor(state.subtype, patient);
  return (
    <div
      className="relative flex-shrink-0 flex flex-col"
      style={{
        width: 120,
        borderRight: side === "right" ? "1px solid var(--glass-border)" : "none",
        borderLeft:  side === "left"  ? "1px solid var(--glass-border)" : "none",
        opacity:    isActive ? 1 : 0.35,
        transition: "opacity 0.4s ease",
        overflow: "visible",
        zIndex: 10,
        background: isActive
          ? `linear-gradient(${side === "right" ? "to right" : "to left"}, color-mix(in srgb, ${accentVar} 8%, transparent), transparent)`
          : "transparent",
      }}
    >
      {/* Wrapper allows plunger rod to overflow upward above the panel */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          top: "-60px",
          bottom: 0,
          overflow: "visible",
        }}
      >
        <SyringeSlider
          value={state.dosage}
          onChange={(v) => {
            const step = UNIT_CONFIG[state.unit].step;
            const precision = step < 1 ? Math.round(1 / step) : 1;
            onChange(Math.round(v * precision) / precision);
          }}
          max={UNIT_CONFIG[state.unit].max}
          stepSize={UNIT_CONFIG[state.unit].step}
          liquidColor={color}
        />
      </div>
    </div>
  );
}
