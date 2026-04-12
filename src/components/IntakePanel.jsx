import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { addDoc, collection, Timestamp, query, orderBy, limit, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import PillTower from "./PillTower";
import { formatDateInput, formatTimeInput } from "../utils/time";

/* ═══════════════════════════════════════════════════════════════════════════
   Constants
   ═══════════════════════════════════════════════════════════════════════════ */

const PILL5_MG = 5;     // mg per 5mg pill
const PILL10_MG = 10;   // mg per 10mg pill
const PILL25_MG = 25;   // mg per 25mg pill

// All steps are 1 pill now
const PILL5_STEP = 5;    // +/- 1 pill = +/- 5mg
const PILL10_STEP = 10;  // +/- 1 pill = +/- 10mg
const PILL25_STEP = 25;  // +/- 1 pill = +/- 25mg

const MAX_PILLS_PER_TYPE = 10; // max pills in any single tower

const getActiveColor = (patient) =>
  patient === "AH" ? "var(--accent-ah)" : "var(--accent-ei)";

const makePatientState = () => ({
  pills5: 0,   // stored as mg
  pills10: 0,
  pills25: 50, // 2 pills default
});

/* ═══════════════════════════════════════════════════════════════════════════
   Isometric Pill SVG Icons for tab selector
   ═══════════════════════════════════════════════════════════════════════════ */

function IsoPill5({ active, accentColor }) {
  return (
    <svg viewBox="0 0 44 44" style={{ width: 40, height: 40 }}>
      <defs>
        <linearGradient id="iso5-top" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f8fafc" />
          <stop offset="100%" stopColor="#e8ecf0" />
        </linearGradient>
        <linearGradient id="iso5-side" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f1f5f9" />
          <stop offset="100%" stopColor="#d1d5db" />
        </linearGradient>
      </defs>
      {/* Side */}
      <ellipse cx="22" cy="27" rx="14" ry="9" fill="url(#iso5-side)" stroke="#b0b8c4" strokeWidth="0.6" />
      {/* Top */}
      <ellipse cx="22" cy="22" rx="14" ry="9" fill="url(#iso5-top)" stroke="#b0b8c4" strokeWidth="0.8" />
      {/* Highlight */}
      <ellipse cx="19" cy="20" rx="5" ry="3" fill="white" opacity="0.5" />
      {active && (
        <ellipse cx="22" cy="22" rx="16" ry="11" fill="none"
          stroke={accentColor} strokeWidth="1.5" opacity="0.6" />
      )}
    </svg>
  );
}

function IsoPill10({ active, accentColor }) {
  return (
    <svg viewBox="0 0 50 50" style={{ width: 44, height: 44 }}>
      <defs>
        <linearGradient id="iso10-top" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#e2e8f0" />
        </linearGradient>
        <linearGradient id="iso10-side" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f8fafc" />
          <stop offset="100%" stopColor="#cbd5e1" />
        </linearGradient>
      </defs>
      <ellipse cx="25" cy="30" rx="17" ry="11" fill="url(#iso10-side)" stroke="#94a3b8" strokeWidth="0.5" />
      <ellipse cx="25" cy="24" rx="17" ry="11" fill="url(#iso10-top)" stroke="#94a3b8" strokeWidth="0.7" />
      <ellipse cx="21" cy="22" rx="6" ry="4" fill="white" opacity="0.4" />
      {active && (
        <ellipse cx="25" cy="24" rx="19" ry="13" fill="none"
          stroke={accentColor} strokeWidth="1.5" opacity="0.6" />
      )}
    </svg>
  );
}

function IsoPill25({ active, accentColor }) {
  return (
    <svg viewBox="0 0 60 44" style={{ width: 52, height: 38 }}>
      <defs>
        <linearGradient id="iso25-top" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#e2e8f0" />
        </linearGradient>
        <linearGradient id="iso25-side" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f8fafc" />
          <stop offset="100%" stopColor="#cbd5e1" />
        </linearGradient>
        <linearGradient id="iso25-score" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#94a3b8" stopOpacity="0" />
          <stop offset="20%" stopColor="#94a3b8" stopOpacity="0.7" />
          <stop offset="80%" stopColor="#94a3b8" stopOpacity="0.7" />
          <stop offset="100%" stopColor="#94a3b8" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`M 2 22 v 8 a 28 10 0 0 0 56 0 v -8 Z`}
        fill="url(#iso25-side)" stroke="#94a3b8" strokeWidth="0.5" />
      <ellipse cx="30" cy="22" rx="28" ry="10" fill="url(#iso25-top)" stroke="#94a3b8" strokeWidth="0.7" />
      <line x1="4" y1="22" x2="56" y2="22" stroke="url(#iso25-score)" strokeWidth="1.2" strokeLinecap="round" />
      <ellipse cx="24" cy="20" rx="10" ry="4" fill="white" opacity="0.35" />
      {active && (
        <ellipse cx="30" cy="22" rx="29" ry="12" fill="none"
          stroke={accentColor} strokeWidth="1.5" opacity="0.6" />
      )}
    </svg>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   AnimatedTowerArea — shows only non-zero pill towers, centered, with
   appear/disappear animations and rearrangement
   ═══════════════════════════════════════════════════════════════════════════ */

function AnimatedTowerArea({ pills5, pills10, pills25, accentColor }) {
  const count5 = pills5 / PILL5_MG;
  const count10 = pills10 / PILL10_MG;
  const count25 = pills25 / PILL25_MG;

  // Build list of active towers (non-zero only)
  const towers = useMemo(() => {
    const list = [];
    if (count5 > 0) list.push({ key: '5', type: '5', count: count5, width: 36 });
    if (count10 > 0) list.push({ key: '10', type: '10', count: count10, width: 40 });
    if (count25 > 0) list.push({ key: '25', type: '25', count: count25, width: 52 });
    return list;
  }, [count5, count10, count25]);

  // Track towers for appear/disappear
  const [visibleTowers, setVisibleTowers] = useState(new Set());
  const [removingTowers, setRemovingTowers] = useState(new Set());
  const prevTowersRef = useRef(new Set());

  useEffect(() => {
    const currentKeys = new Set(towers.map(t => t.key));
    const prevKeys = prevTowersRef.current;

    // New towers appearing
    const appearing = [...currentKeys].filter(k => !prevKeys.has(k));
    // Towers disappearing
    const disappearing = [...prevKeys].filter(k => !currentKeys.has(k));

    if (disappearing.length > 0) {
      setRemovingTowers(new Set(disappearing));
      setTimeout(() => {
        setRemovingTowers(new Set());
        setVisibleTowers(currentKeys);
      }, 350);
    } else {
      setVisibleTowers(currentKeys);
    }

    prevTowersRef.current = currentKeys;
  }, [towers]);

  // Merge visible and removing towers for render
  const renderTowers = useMemo(() => {
    const list = [];
    // Add all currently visible
    towers.forEach(t => list.push({ ...t, state: 'visible' }));
    // Add removing towers (only if not already in current)
    removingTowers.forEach(key => {
      if (!towers.find(t => t.key === key)) {
        const width = key === '5' ? 36 : key === '10' ? 40 : 52;
        list.push({ key, type: key, count: 0, width, state: 'removing' });
      }
    });
    // Sort: 5, 10, 25
    list.sort((a, b) => parseInt(a.key) - parseInt(b.key));
    return list;
  }, [towers, removingTowers]);

  // Calculate gap — shrinks as more towers are added
  const gap = renderTowers.length >= 3 ? 4 : renderTowers.length === 2 ? 8 : 0;

  return (
    <div
      className="flex items-end justify-center transition-all duration-400"
      style={{
        gap,
        minHeight: 130,
        padding: '10px 4px 0',
      }}
    >
      {renderTowers.length === 0 && (
        <div className="flex items-center justify-center" style={{ height: 100, opacity: 0.15 }}>
          <svg viewBox="0 0 60 24" style={{ width: 60, height: 24 }}>
            <ellipse cx="30" cy="12" rx="28" ry="10" fill="var(--text-secondary)" opacity="0.3"
              stroke="var(--text-secondary)" strokeWidth="0.8" strokeDasharray="3 3" />
          </svg>
        </div>
      )}
      {renderTowers.map((tower) => {
        const isNew = !prevTowersRef.current?.has?.(tower.key) && tower.state !== 'removing';
        const isRemoving = tower.state === 'removing';

        return (
          <div
            key={tower.key}
            className="flex flex-col items-center"
            style={{
              width: tower.width,
              height: 130,
              transition: 'all 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)',
              animation: isRemoving
                ? 'towerDisappear 0.35s ease-in forwards'
                : isNew
                  ? 'towerAppear 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) both'
                  : 'none',
              transformOrigin: 'bottom center',
            }}
          >
            <PillTower
              pills={tower.count}
              accentColor={accentColor}
              pillType={tower.type}
              animate={true}
            />
            {/* Tower label */}
            <div style={{
              fontSize: 8,
              fontWeight: 800,
              color: accentColor,
              opacity: 0.5,
              marginTop: -2,
              textAlign: 'center',
            }}>
              {tower.count}×{tower.type === '5' ? '5' : tower.type === '10' ? '10' : '25'}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   IntakePanel — redesigned with pill type tabs + animated towers
   ═══════════════════════════════════════════════════════════════════════════ */

export default function IntakePanel({ onAddSuccess }) {
  const [activePatient, setActivePatient] = useState("AH");
  const [stateAH, setStateAH] = useState(makePatientState);
  const [stateEI, setStateEI] = useState(makePatientState);
  const [activePillType, setActivePillType] = useState("25"); // which pill tab is selected
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
  const totalMg = st.pills5 + st.pills10 + st.pills25;
  const accentColor = getActiveColor(activePatient);

  /* ── Adjust helpers ─────────────────────────────────────────────── */
  const adjust5 = (delta) => {
    const currentCount = st.pills5 / PILL5_MG;
    const nextCount = Math.max(0, Math.min(MAX_PILLS_PER_TYPE, currentCount + delta));
    patchState(activePatient, { pills5: nextCount * PILL5_MG });
  };

  const adjust10 = (delta) => {
    const currentCount = st.pills10 / PILL10_MG;
    const nextCount = Math.max(0, Math.min(MAX_PILLS_PER_TYPE, currentCount + delta));
    patchState(activePatient, { pills10: nextCount * PILL10_MG });
  };

  const adjust25 = (delta) => {
    const currentCount = st.pills25 / PILL25_MG;
    const nextCount = Math.max(0, Math.min(MAX_PILLS_PER_TYPE, currentCount + delta));
    patchState(activePatient, { pills25: nextCount * PILL25_MG });
  };

  // Get adjust function for the active pill type
  const adjustActive = (delta) => {
    if (activePillType === "5") adjust5(delta);
    else if (activePillType === "10") adjust10(delta);
    else adjust25(delta);
  };

  // Get the count for active pill type
  const getActiveCount = () => {
    if (activePillType === "5") return st.pills5 / PILL5_MG;
    if (activePillType === "10") return st.pills10 / PILL10_MG;
    return st.pills25 / PILL25_MG;
  };

  const getActiveMg = () => {
    if (activePillType === "5") return st.pills5;
    if (activePillType === "10") return st.pills10;
    return st.pills25;
  };

  /* ── Save to Firestore ──────────────────────────────────────────── */
  const handleAddIntake = async (intakeTime) => {
    setIsAdding(true);
    try {
      await addDoc(collection(db, "intakes"), {
        patientId: activePatient,
        dosage: totalMg,
        unit: "mg",
        subtype: "PO",
        instrument: "pills",
        pills5mg: st.pills5,
        pills10mg: st.pills10,
        pills25mg: st.pills25,
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

      const displayPatient = activePatient === "AH" ? "P1" : activePatient === "EI" ? "P2" : activePatient;
      onAddSuccess(`${displayPatient}: Додано ${totalMg} мг (PO)`);
      patchState(activePatient, { pills5: 0, pills10: 0, pills25: 0 });
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

  /* ── Preview values for both patients (header tabs) ─────────────── */
  const previewAH = stateAH.pills5 + stateAH.pills10 + stateAH.pills25;
  const previewEI = stateEI.pills5 + stateEI.pills10 + stateEI.pills25;

  const activeCount = getActiveCount();
  const activeMg = getActiveMg();

  /* ═══════════════════════════════════════════════════════════════════
     Render
     ═══════════════════════════════════════════════════════════════════ */
  return (
    <div
      className="relative rounded-3xl overflow-hidden touch-manipulation"
      style={{
        background: "var(--surface-2)",
        backdropFilter: "blur(32px)",
        WebkitBackdropFilter: "blur(32px)",
        border: "1px solid var(--glass-border)",
        boxShadow: "0 8px 40px var(--shadow-color-strong), inset 0 1px 0 var(--glass-shine)",
        opacity: 1,
        pointerEvents: "auto",
        transition: "opacity 0.3s",
      }}
    >
      {/* Keyframe animations */}
      <style>{`
        @keyframes towerAppear {
          0% { transform: scaleY(0) scaleX(0.5); opacity: 0; }
          60% { transform: scaleY(1.05) scaleX(1.02); opacity: 1; }
          100% { transform: scaleY(1) scaleX(1); opacity: 1; }
        }
        @keyframes towerDisappear {
          0% { transform: scaleY(1) scaleX(1); opacity: 1; }
          100% { transform: scaleY(0) scaleX(0.5); opacity: 0; }
        }
        @keyframes fadeSlideUp {
          from { opacity:0; transform:translateY(12px) scale(0.97); }
          to   { opacity:1; transform:translateY(0)    scale(1);    }
        }
      `}</style>

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
              <span style={{ fontSize: 11, fontWeight: 900, letterSpacing: "0.18em", textTransform: "uppercase", lineHeight: 1, opacity: isActive ? 1 : 0.35, textShadow: isActive ? `0 0 12px ${accent}88` : "none" }}>
                {id === "AH" ? "P1" : id === "EI" ? "P2" : id}
              </span>
              <span style={{ fontSize: 9, fontWeight: 700, marginTop: 2, fontVariantNumeric: "tabular-nums", color: isActive ? accent : "var(--text-secondary)", opacity: isActive ? 0.85 : 0.25 }}>
                  {mg} мг
                </span>
            </button>
          );
        })}
      </div>

      {/* ── BODY — pill towers + controls ── */}
      <div className="relative z-10">
          {/* Pill type tabs + tower + controls */}
          <div
            className="flex flex-col transition-all duration-300"
            style={{
              opacity: confirmStep !== "idle" ? 0 : 1,
              pointerEvents: confirmStep !== "idle" ? "none" : "auto",
              maxHeight: confirmStep !== "idle" ? 0 : 800,
              overflow: confirmStep !== "idle" ? "hidden" : "visible",
            }}
          >
            {/* ── Pill Tower Area ── */}
            <AnimatedTowerArea
              pills5={st.pills5}
              pills10={st.pills10}
              pills25={st.pills25}
              accentColor={accentColor}
            />

            {/* ── Pill Type Tabs (3 isometric pills) ── */}
            <div className="flex items-end justify-center" style={{ gap: 2, padding: "0 8px", marginTop: 4 }}>
              {[
                { type: "5", label: "5мг", Comp: IsoPill5 },
                { type: "10", label: "10мг", Comp: IsoPill10 },
                { type: "25", label: "25мг", Comp: IsoPill25 },
              ].map(({ type, label, Comp }) => {
                const isActive = activePillType === type;
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setActivePillType(type)}
                    className="flex flex-col items-center transition-all duration-200 active:scale-95"
                    style={{
                      flex: 1,
                      padding: "6px 2px 4px",
                      borderRadius: 14,
                      background: isActive
                        ? `color-mix(in srgb, ${accentColor} 10%, transparent)`
                        : "transparent",
                      border: isActive
                        ? `1.5px solid color-mix(in srgb, ${accentColor} 30%, transparent)`
                        : "1.5px solid transparent",
                      WebkitTapHighlightColor: "transparent",
                      transform: isActive ? "scale(1.05)" : "scale(1)",
                    }}
                  >
                    <Comp active={isActive} accentColor={accentColor} />
                    <span style={{
                      fontSize: 9,
                      fontWeight: 900,
                      marginTop: 2,
                      color: isActive ? accentColor : "var(--text-secondary)",
                      opacity: isActive ? 1 : 0.4,
                      letterSpacing: "0.05em",
                    }}>
                      {label}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* ── Controls for active pill type ── */}
            <div className="flex items-center justify-center" style={{ gap: 12, padding: "10px 16px 6px" }}>
              {/* Minus button */}
              <button
                type="button"
                onClick={() => adjustActive(-1)}
                className="rounded-2xl flex items-center justify-center transition-all duration-200 active:scale-90 btn-mobile"
                style={{
                  width: 48,
                  height: 48,
                  fontSize: 24,
                  fontWeight: 900,
                  background: `color-mix(in srgb, ${accentColor} 10%, transparent)`,
                  border: `1.5px solid color-mix(in srgb, ${accentColor} 25%, transparent)`,
                  color: accentColor,
                  opacity: activeCount > 0 ? 1 : 0.3,
                  WebkitTapHighlightColor: "transparent",
                }}
              >
                −
              </button>

              {/* Count display */}
              <div className="flex flex-col items-center" style={{ minWidth: 80 }}>
                <div style={{
                  fontSize: 32,
                  fontWeight: 900,
                  fontVariantNumeric: "tabular-nums",
                  lineHeight: 1,
                  color: accentColor,
                }}>
                  {activeCount}
                </div>
                <div style={{
                  fontSize: 9,
                  fontWeight: 700,
                  marginTop: 3,
                  color: accentColor,
                  opacity: 0.5,
                }}>
                  таб · {activeMg} мг
                </div>
              </div>

              {/* Plus button */}
              <button
                type="button"
                onClick={() => adjustActive(1)}
                className="rounded-2xl flex items-center justify-center transition-all duration-200 active:scale-90 btn-mobile"
                style={{
                  width: 48,
                  height: 48,
                  fontSize: 24,
                  fontWeight: 900,
                  background: `color-mix(in srgb, ${accentColor} 10%, transparent)`,
                  border: `1.5px solid color-mix(in srgb, ${accentColor} 25%, transparent)`,
                  color: accentColor,
                  opacity: activeCount < MAX_PILLS_PER_TYPE ? 1 : 0.3,
                  WebkitTapHighlightColor: "transparent",
                }}
              >
                +
              </button>
            </div>

            {/* Total dosage summary */}
            <div className="text-center" style={{ padding: "2px 0 6px" }}>
              <span style={{
                fontSize: 11,
                fontWeight: 800,
                color: "var(--text-secondary)",
                opacity: 0.5,
              }}>
                Загалом:{" "}
                <span style={{ color: accentColor, opacity: 1, fontWeight: 900 }}>
                  {totalMg} мг
                </span>
              </span>
            </div>

            {/* Add button */}
            <div style={{ padding: "4px 12px 10px" }}>
              <button
                type="button"
                onClick={openConfirm}
                disabled={totalMg === 0}
                className="w-full rounded-2xl transition-all duration-300 hover:scale-[1.02] active:scale-[0.97] relative overflow-hidden group btn-mobile"
                style={{
                  padding: "10px 0",
                  fontSize: 13,
                  fontWeight: 900,
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
            {/* Summary */}
            <div className="flex items-center" style={{ gap: 10 }}>
              <div className="flex items-center justify-center flex-shrink-0"
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 14,
                  fontSize: 11,
                  fontWeight: 900,
                  background: `color-mix(in srgb, ${accentColor} 18%, transparent)`,
                  border: `1.5px solid color-mix(in srgb, ${accentColor} 40%, transparent)`,
                  color: accentColor,
                }}>
                {activePatient === "AH" ? "P1" : "P2"}
              </div>
              <div className="flex-1 min-w-0">
                <div style={{ fontSize: 17, fontWeight: 900, letterSpacing: "-0.02em", lineHeight: 1, color: "var(--text-primary)" }}>
                  {totalMg} <span style={{ fontSize: 11, fontWeight: 700, opacity: 0.5 }}>мг</span>
                </div>
                <div style={{ fontSize: 9, fontWeight: 700, marginTop: 3, color: "var(--text-secondary)", opacity: 0.7 }}>
                  {st.pills5 > 0 && `${st.pills5 / PILL5_MG}×5мг`}
                  {st.pills5 > 0 && (st.pills10 > 0 || st.pills25 > 0) && " + "}
                  {st.pills10 > 0 && `${st.pills10 / PILL10_MG}×10мг`}
                  {st.pills10 > 0 && st.pills25 > 0 && " + "}
                  {st.pills25 > 0 && `${st.pills25 / PILL25_MG}×25мг`}
                  {" · PO"}
                </div>
              </div>
              <button type="button" onClick={() => setConfirmStep("idle")}
                className="flex items-center justify-center transition-all hover:opacity-70 active:scale-90 flex-shrink-0 btn-mobile"
                style={{ width: 26, height: 26, borderRadius: "50%", background: "rgba(255,255,255,0.07)", color: "var(--text-secondary)", border: "1px solid var(--glass-border)" }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ width: 12, height: 12 }}>
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Time picker */}
            {confirmStep === "pick-time" && (
              <div className="grid grid-cols-2" style={{ gap: 8 }}>
                {[
                  { label: "Дата", type: "date", val: dateValue, set: setDateValue },
                  { label: "Час", type: "time", val: timeValue, set: setTimeValue },
                ].map(({ label, type, val, set }) => (
                  <div key={type}>
                    <label style={{ display: "block", fontSize: 8, fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 4, color: "var(--text-secondary)" }}>{label}</label>
                    <input type={type} value={val} onChange={(e) => set(e.target.value)}
                      className="w-full focus:outline-none"
                      style={{
                        borderRadius: 10,
                        padding: "7px 8px",
                        fontSize: 12,
                        fontWeight: 600,
                        background: "rgba(255,255,255,0.06)",
                        border: `1px solid color-mix(in srgb, ${accentColor} 30%, transparent)`,
                        color: "var(--text-primary)",
                      }} />
                  </div>
                ))}
              </div>
            )}

            {/* Action buttons */}
            <div className="flex flex-col" style={{ gap: 5, borderTop: "1px solid var(--glass-border)", paddingTop: 8 }}>
              {confirmStep === "confirm" ? (
                <>
                  <button type="button" onClick={() => handleAddIntake(new Date())} disabled={isAdding}
                    className="w-full rounded-2xl transition-all duration-200 hover:scale-[1.02] active:scale-[0.97] relative overflow-hidden group btn-mobile"
                    style={{
                      padding: "10px 0",
                      fontSize: 13,
                      fontWeight: 900,
                      background: "var(--add-btn-bg)", color: "var(--add-btn-text)",
                      border: "1px solid var(--add-btn-border)",
                      boxShadow: "0 8px 24px var(--shadow-color-strong), 0 0 16px var(--add-btn-glow)44",
                      opacity: isAdding ? 0.6 : 1,
                    }}>
                    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                      style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0) 55%)" }} />
                    <span className="relative z-10 inline-flex items-center justify-center" style={{ gap: 6 }}>
                      {isAdding
                        ? <span className="border-2 border-current border-t-transparent rounded-full animate-spin" style={{ width: 14, height: 14 }} />
                        : <span style={{ fontSize: 18, lineHeight: 1 }}>+</span>}
                      Додати зараз
                    </span>
                  </button>
                  <button type="button" onClick={() => setConfirmStep("pick-time")}
                    className="w-full rounded-xl transition-all hover:opacity-80 active:scale-[0.97] btn-mobile"
                    style={{ padding: "8px 0", fontSize: 11, fontWeight: 700, background: "rgba(255,255,255,0.04)", color: "var(--text-secondary)", border: "1px solid var(--glass-border)" }}>
                    <span className="inline-flex items-center" style={{ gap: 5 }}>
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ width: 11, height: 11 }}>
                        <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                      </svg>
                      Вказати час
                    </span>
                  </button>
                </>
              ) : (
                <div className="flex" style={{ gap: 8 }}>
                  <button type="button" onClick={() => setConfirmStep("confirm")}
                    className="flex-1 rounded-xl transition-all active:scale-95 btn-mobile"
                    style={{ padding: "8px 10px", fontSize: 12, fontWeight: 700, border: "1px solid var(--glass-border)", color: "var(--text-primary)", background: "rgba(255,255,255,0.04)" }}>
                    Назад
                  </button>
                  <button type="button" onClick={handleAddWithTime} disabled={isAdding}
                    className="flex-[2] rounded-xl transition-all active:scale-95 hover:opacity-90 relative overflow-hidden btn-mobile"
                    style={{
                      padding: "8px 10px",
                      fontSize: 12,
                      fontWeight: 900,
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
