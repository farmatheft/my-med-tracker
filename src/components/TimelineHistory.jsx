import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "../firebase";
import { formatTime, formatViewedDate, getStartOfDay } from "../utils/time";
import PillTower from "./PillTower";

// Panel card height + gap between stacked panels
const PANEL_H = 72;
// Connector line is drawn when panel is displaced more than this (px) from its dot
const CONNECTOR_THRESHOLD_PX = 6;

/**
 * Layout solver: dots stay at their exact timestamp pixel positions.
 * Panels are distributed so they never overlap (min PANEL_H apart).
 */
function solveLayout(items) {
  if (items.length === 0) return [];
  if (items.length === 1) return [{ ...items[0], panelY: items[0].dotY }];

  const n = items.length;
  const mid = Math.floor(n / 2);
  const panels = new Array(n);
  panels[mid] = items[mid].dotY;

  for (let i = mid - 1; i >= 0; i--) {
    panels[i] = Math.min(panels[i + 1] - PANEL_H, items[i].dotY);
  }
  for (let i = mid + 1; i < n; i++) {
    panels[i] = Math.max(panels[i - 1] + PANEL_H, items[i].dotY);
  }

  for (let pass = 0; pass < 20; pass++) {
    for (let i = 1; i < n; i++) {
      if (panels[i] < panels[i - 1] + PANEL_H) {
        panels[i] = panels[i - 1] + PANEL_H;
      }
    }
    for (let i = n - 2; i >= 0; i--) {
      if (panels[i] > panels[i + 1] - PANEL_H) {
        panels[i] = panels[i + 1] - PANEL_H;
      }
    }
    for (let i = 0; i < n; i++) {
      const target = items[i].dotY;
      const nudge = (target - panels[i]) * 0.12;
      panels[i] += nudge;
    }
    for (let i = 1; i < n; i++) {
      if (panels[i] < panels[i - 1] + PANEL_H) panels[i] = panels[i - 1] + PANEL_H;
    }
    for (let i = n - 2; i >= 0; i--) {
      if (panels[i] > panels[i + 1] - PANEL_H) panels[i] = panels[i + 1] - PANEL_H;
    }
  }

  return items.map((it, idx) => ({ ...it, panelY: panels[idx] }));
}

const ZOOM_LEVELS = [
  { value: 0.25, label: "0.25x" },
  { value: 0.5, label: "0.5x" },
  { value: 0.75, label: "0.75x" },
  { value: 1, label: "1x" },
  { value: 1.25, label: "1.25x" },
  { value: 1.5, label: "1.5x" },
  { value: 2, label: "2x" },
  { value: 2.5, label: "2.5x" },
  { value: 3, label: "3x" },
  { value: 3.5, label: "3.5x" },
  { value: 4, label: "4x" },
  { value: 4.5, label: "4.5x" },
  { value: 5, label: "5x" },
  { value: 5.5, label: "5.5x" },
  { value: 6, label: "6x" },
  { value: 8, label: "8x" },
  { value: 10, label: "10x" },
];

const BASE_DAY_HEIGHT_PX = 1440;

// Minimum pixel gap between two intake items before clustering
const CLUSTER_THRESHOLD_PX = 56;

const TimelineHistory = ({ onDayChange, selectedId, onSelectIntake, scrollToNextDay, scrollToPrevDay, hideData = false }) => {
  const [intakes, setIntakes] = useState([]);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [zoomLevel, setZoomLevel] = useState(1);
  const [expandedClusters, setExpandedClusters] = useState(new Set());
  const scrollRef = useRef(null);
  const dayRefs = useRef([]);

  const DAY_VIEWPORT_HEIGHT_PX = useMemo(() => {
    return BASE_DAY_HEIGHT_PX * zoomLevel;
  }, [zoomLevel]);

  useEffect(() => {
    if (hideData) { setIntakes([]); return; }
    const q = query(collection(db, "intakes"), orderBy("timestamp", "desc"));
    return onSnapshot(q, (snapshot) => {
      setIntakes(
        snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
          timestamp: doc.data().timestamp?.toDate() || new Date(),
        })),
      );
    });
  }, [hideData]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const groupedByDay = useMemo(() => {
    const groups = {};
    const today = getStartOfDay(new Date());
    groups[today.toLocaleDateString("uk-UA")] = { date: today, intakes: [] };

    intakes.forEach((intake) => {
      const dateStr = getStartOfDay(intake.timestamp).toLocaleDateString("uk-UA");
      if (!groups[dateStr])
        groups[dateStr] = { date: getStartOfDay(intake.timestamp), intakes: [] };
      groups[dateStr].intakes.push(intake);
    });

    return Object.values(groups).sort((a, b) => b.date - a.date);
  }, [intakes]);

  const sortedDays = useMemo(() => groupedByDay, [groupedByDay]);

  useEffect(() => {
    dayRefs.current = sortedDays.map((_, idx) => dayRefs.current[idx] || { current: null });
  }, [sortedDays]);

  const updateCurrentDayHeading = useCallback(() => {
    if (!scrollRef.current || !sortedDays.length) return;
    const containerTop = scrollRef.current.getBoundingClientRect().top;
    const headerOffset = 48;
    let activeIndex = 0;

    dayRefs.current.forEach((ref, idx) => {
      if (!ref.current) return;
      const rect = ref.current.getBoundingClientRect();
      const topOffset = rect.top - containerTop;
      if (topOffset <= headerOffset) activeIndex = idx;
    });

    const activeDay = sortedDays[activeIndex];
    if (activeDay) {
      onDayChange(formatViewedDate(activeDay.date));
    }
  }, [onDayChange, sortedDays]);

  useEffect(() => { updateCurrentDayHeading(); }, [updateCurrentDayHeading, sortedDays]);

  const handleScrollToNextDay = useCallback(() => {
    if (!scrollRef.current || !sortedDays.length) return;
    const containerTop = scrollRef.current.getBoundingClientRect().top;
    const headerOffset = 48;
    let activeIndex = 0;
    dayRefs.current.forEach((ref, idx) => {
      if (!ref.current) return;
      const rect = ref.current.getBoundingClientRect();
      const topOffset = rect.top - containerTop;
      if (topOffset <= headerOffset) activeIndex = idx;
    });
    const targetIndex = activeIndex - 1;
    if (targetIndex >= 0 && dayRefs.current[targetIndex]?.current) {
      dayRefs.current[targetIndex].current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [sortedDays]);

  const handleScrollToPrevDay = useCallback(() => {
    if (!scrollRef.current || !sortedDays.length) return;
    const containerTop = scrollRef.current.getBoundingClientRect().top;
    const headerOffset = 48;
    let activeIndex = 0;
    dayRefs.current.forEach((ref, idx) => {
      if (!ref.current) return;
      const rect = ref.current.getBoundingClientRect();
      const topOffset = rect.top - containerTop;
      if (topOffset <= headerOffset) activeIndex = idx;
    });
    const targetIndex = activeIndex + 1;
    if (targetIndex < sortedDays.length && dayRefs.current[targetIndex]?.current) {
      dayRefs.current[targetIndex].current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [sortedDays]);

  useEffect(() => {
    if (scrollToNextDay) scrollToNextDay.current = handleScrollToNextDay;
  }, [scrollToNextDay, handleScrollToNextDay]);

  useEffect(() => {
    if (scrollToPrevDay) scrollToPrevDay.current = handleScrollToPrevDay;
  }, [scrollToPrevDay, handleScrollToPrevDay]);

  const getTimeTop = (date) => {
    const mins = date.getHours() * 60 + date.getMinutes();
    return (BASE_DAY_HEIGHT_PX - mins) * zoomLevel;
  };

  const formatDurationHM = (minutesTotal) => {
    const total = Math.max(0, Math.round(minutesTotal));
    const h = Math.floor(total / 60);
    const m = total % 60;
    return `${h}:${String(m).padStart(2, "0")}`;
  };

  const getAbsoluteYWithinTimeline = useCallback(
    (dayIndexByStartMs, dateObj) => {
      const dayStart = getStartOfDay(dateObj).getTime();
      const dayIdx = dayIndexByStartMs.get(dayStart);
      if (dayIdx === undefined) return null;
      const mins = dateObj.getHours() * 60 + dateObj.getMinutes();
      const dayPosition = (BASE_DAY_HEIGHT_PX - mins) * zoomLevel;
      return dayIdx * (BASE_DAY_HEIGHT_PX * zoomLevel) + dayPosition;
    },
    [zoomLevel],
  );

  const zoomIn = () => {
    const currentIndex = ZOOM_LEVELS.findIndex((z) => z.value === zoomLevel);
    if (currentIndex < ZOOM_LEVELS.length - 1) setZoomLevel(ZOOM_LEVELS[currentIndex + 1].value);
  };

  const zoomOut = () => {
    const currentIndex = ZOOM_LEVELS.findIndex((z) => z.value === zoomLevel);
    if (currentIndex > 0) setZoomLevel(ZOOM_LEVELS[currentIndex - 1].value);
  };

  const toMg = (dosage, unit) => {
    const val = parseFloat(dosage) || 0;
    return unit === "ml" ? val * 20 : val;
  };

  const computeClusters = useCallback(
    (dayIntakes, patientId) => {
      const items = dayIntakes
        .filter((i) => i.patientId === patientId)
        .slice()
        .sort((a, b) => b.timestamp - a.timestamp);

      if (items.length === 0) return [];

      const withPos = items.map((i) => ({ intake: i, topPx: getTimeTop(i.timestamp) }));

      const result = [];
      let i = 0;
      while (i < withPos.length) {
        const group = [withPos[i]];
        let j = i + 1;
        while (j < withPos.length) {
          const gap = withPos[j].topPx - group[group.length - 1].topPx;
          if (gap < CLUSTER_THRESHOLD_PX) {
            group.push(withPos[j]);
            j++;
          } else {
            break;
          }
        }
        if (group.length === 1) {
          result.push({ type: "single", intake: group[0].intake, topPx: group[0].topPx });
        } else {
          const avgTop = group.reduce((s, g) => s + g.topPx, 0) / group.length;
          const totalMg = group.reduce((s, g) => s + toMg(g.intake.dosage, g.intake.unit), 0);
          const lastTime = group[0].intake.timestamp;
          result.push({
            type: "cluster",
            intakes: group.map((g) => g.intake),
            topPx: avgTop,
            totalMg,
            lastTime,
          });
        }
        i = j;
      }
      return result;
    },
    [zoomLevel], // eslint-disable-line react-hooks/exhaustive-deps
  );

  /** Build a mini pill tower description from intake data */
  const getPillInfo = (intake) => {
    const pills25 = intake.pills25mg ? intake.pills25mg / 25 : 0;
    const pills10 = intake.pills10mg ? intake.pills10mg / 10 : 0;
    return { pills25, pills10, totalMg: parseFloat(intake.dosage) || 0 };
  };

  return (
    <div className="flex flex-col h-full">
      {/* Zoom Controls */}
      <div
        className="flex items-center justify-center gap-2 py-2 px-4 relative z-30"
        style={{
          borderBottom: "1px solid var(--glass-border)",
          background: "rgba(255,255,255,0.03)",
          backdropFilter: "blur(12px)",
        }}
      >
        <button
          onClick={zoomOut}
          disabled={zoomLevel <= 0.5}
          className="w-8 h-8 rounded-lg text-sm font-bold transition-all duration-200 disabled:opacity-25 enabled:hover:bg-white/10 enabled:active:scale-95 flex items-center justify-center"
          style={{ color: "var(--text-primary)", border: "1px solid var(--glass-border)" }}
        >
          −
        </button>
        <div className="flex items-center gap-1.5">
          <svg
            className="w-3.5 h-3.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            style={{ color: "var(--text-secondary)", opacity: 0.7 }}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7"
            />
          </svg>
          <select
            value={zoomLevel}
            onChange={(e) => setZoomLevel(parseFloat(e.target.value))}
            className="px-2 py-1.5 rounded-lg text-xs font-bold outline-none cursor-pointer transition-all duration-200"
            style={{
              color: "var(--add-btn-text)",
              background: "var(--add-btn-bg)",
              borderColor: "var(--add-btn-border)",
              border: "1px solid var(--add-btn-border)",
              minWidth: "64px",
            }}
          >
            {ZOOM_LEVELS.map((level) => (
              <option key={level.value} value={level.value}>
                {level.label}
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={zoomIn}
          disabled={zoomLevel >= 5}
          className="w-8 h-8 rounded-lg text-sm font-bold transition-all duration-200 disabled:opacity-25 enabled:hover:bg-white/10 enabled:active:scale-95 flex items-center justify-center"
          style={{ color: "var(--text-primary)", border: "1px solid var(--glass-border)" }}
        >
          +
        </button>
        <span
          className="text-[10px] font-bold ml-1 px-2 py-0.5 rounded-lg"
          style={{
            color: "var(--text-secondary)",
            background: "rgba(255,255,255,0.05)",
            border: "1px solid var(--glass-border)",
          }}
        >
          {Math.round(zoomLevel * 100)}%
        </span>
      </div>

      <div
        ref={scrollRef}
        className="flex-grow overflow-y-auto custom-scrollbar px-3 pb-20"
        onClick={() => onSelectIntake(null)}
        onScroll={updateCurrentDayHeading}
      >
        <div className="relative">
          {/* Gaps: time passed between adjacent intakes */}
          <div className="absolute inset-0 pointer-events-none z-0">
            {(() => {
              const dayIndexByStartMs = new Map(
                sortedDays.map((d, idx) => [d.date.getTime(), idx]),
              );

              const buildPatientItems = (patientId) =>
                intakes
                  .filter((i) => i.patientId === patientId)
                  .filter((i) => i.timestamp instanceof Date)
                  .slice()
                  .sort((a, b) => b.timestamp - a.timestamp);

              const commonStyle = {
                color: "var(--text-secondary)",
                opacity: 0.22,
                fontSize: "32px",
                fontWeight: 500,
                letterSpacing: "0.02em",
                textShadow: "0 2px 0 rgba(0,0,0,0.08)",
              };

              const buildGapLabels = (patientId) => {
                const items = buildPatientItems(patientId);
                const labels = [];

                for (let idx = 0; idx < items.length - 1; idx += 1) {
                  const a = items[idx];
                  const b = items[idx + 1];
                  const y1 = getAbsoluteYWithinTimeline(dayIndexByStartMs, a.timestamp);
                  const y2 = getAbsoluteYWithinTimeline(dayIndexByStartMs, b.timestamp);
                  if (y1 == null || y2 == null) continue;
                  const minutesPassed = Math.abs((a.timestamp - b.timestamp) / 60000);
                  if (minutesPassed < 1) continue;
                  labels.push({ id: `${a.id}__${b.id}`, y: (y1 + y2) / 2, label: formatDurationHM(minutesPassed) });
                }

                const lastPast = items.find((i) => i.timestamp.getTime() <= currentTime.getTime());
                if (lastPast) {
                  const y1 = getAbsoluteYWithinTimeline(dayIndexByStartMs, currentTime);
                  const y2 = getAbsoluteYWithinTimeline(dayIndexByStartMs, lastPast.timestamp);
                  if (y1 != null && y2 != null) {
                    const minutesPassed = Math.abs((currentTime - lastPast.timestamp) / 60000);
                    if (minutesPassed >= 1) {
                      labels.push({ id: `${lastPast.id}__now`, y: (y1 + y2) / 2, label: formatDurationHM(minutesPassed) });
                    }
                  }
                }

                return labels;
              };

              const ahLabels = buildGapLabels("AH");
              const eiLabels = buildGapLabels("EI");

              return (
                <>
                  {ahLabels.map((g) => (
                    <div
                      key={`ah-gap-${g.id}`}
                      className="absolute whitespace-nowrap"
                      style={{ top: `${g.y}px`, transform: "translateY(-50%)", left: "calc(50% - 120px)", ...commonStyle }}
                    >
                      {g.label}
                    </div>
                  ))}
                  {eiLabels.map((g) => (
                    <div
                      key={`ei-gap-${g.id}`}
                      className="absolute whitespace-nowrap"
                      style={{ top: `${g.y}px`, transform: "translateY(-50%)", right: "calc(50% - 120px)", left: "auto", ...commonStyle }}
                    >
                      {g.label}
                    </div>
                  ))}
                </>
              );
            })()}
          </div>

          {sortedDays.map((day, index) => (
            <div
              key={day.date.getTime()}
              ref={(el) => { dayRefs.current[index] = { current: el }; }}
              className="relative"
              style={{ height: `${DAY_VIEWPORT_HEIGHT_PX}px`, background: "transparent" }}
            >
              {/* Markers */}
              <div className="absolute inset-0 pointer-events-none z-0">
                {(() => {
                  let tickInterval, labelInterval;
                  if (zoomLevel <= 0.375) { tickInterval = 60; labelInterval = 180; }
                  else if (zoomLevel <= 0.625) { tickInterval = 30; labelInterval = 180; }
                  else if (zoomLevel <= 0.875) { tickInterval = 30; labelInterval = 180; }
                  else if (zoomLevel <= 1.375) { tickInterval = 15; labelInterval = 120; }
                  else if (zoomLevel <= 1.75) { tickInterval = 15; labelInterval = 120; }
                  else if (zoomLevel <= 2.25) { tickInterval = 15; labelInterval = 60; }
                  else if (zoomLevel <= 2.75) { tickInterval = 15; labelInterval = 30; }
                  else if (zoomLevel <= 3.25) { tickInterval = 10; labelInterval = 30; }
                  else if (zoomLevel <= 3.75) { tickInterval = 10; labelInterval = 30; }
                  else if (zoomLevel <= 4.25) { tickInterval = 5; labelInterval = 15; }
                  else if (zoomLevel <= 4.75) { tickInterval = 5; labelInterval = 15; }
                  else if (zoomLevel <= 5.75) { tickInterval = 1; labelInterval = 10; }
                  else if (zoomLevel <= 7) { tickInterval = 1; labelInterval = 10; }
                  else if (zoomLevel <= 10) { tickInterval = 1; labelInterval = 5; }
                  else { tickInterval = 1; labelInterval = 1; }

                  const markers = [];
                  for (let mins = 0; mins < 1440; mins += tickInterval) {
                    const hour = Math.floor(mins / 60);
                    const min = mins % 60;
                    const showLabel = mins % labelInterval === 0;
                    markers.push({ mins, hour, min, showLabel });
                  }

                  const tickWidth = 4;
                  const tickOffset = 0;
                  const labelOffset = tickOffset + 20;

                  return (
                    <>
                      {markers.map(({ mins, hour, min, showLabel }) => {
                        const top = getTimeTop(new Date(day.date.getTime() + mins * 60000));
                        return (
                          <div
                            key={mins}
                            className="absolute flex items-center"
                            style={{ top: `${top}px`, transform: "translateY(-50%)", left: "50%", width: "0", height: "0" }}
                          >
                            <div className="h-px absolute" style={{ background: "var(--marker-color)", opacity: showLabel ? 0.8 : 0.5, width: `${showLabel ? tickWidth : tickWidth * 0.8}px`, right: `calc(50% + ${tickOffset}px)` }} />
                            <div className="h-px absolute" style={{ background: "var(--marker-color)", opacity: showLabel ? 0.8 : 0.5, width: `${showLabel ? tickWidth : tickWidth * 0.8}px`, left: `calc(50% + ${tickOffset}px)` }} />
                            {showLabel && (
                              <>
                                <span className="absolute text-[10px]" style={{ color: "var(--marker-color)", opacity: 0.4, right: `calc(50% + ${labelOffset}px)` }}>
                                  {String(hour).padStart(2, "0")}:{String(min).padStart(2, "0")}
                                </span>
                                <span className="absolute text-[10px]" style={{ color: "var(--marker-color)", opacity: 0.4, left: `calc(50% + ${labelOffset}px)` }}>
                                  {String(hour).padStart(2, "0")}:{String(min).padStart(2, "0")}
                                </span>
                              </>
                            )}
                          </div>
                        );
                      })}
                    </>
                  );
                })()}
              </div>

              {/* Left Line - AH */}
              <div className="absolute top-6 bottom-6 z-0" style={{ left: "calc(50% - 10px)", width: "2px" }}>
                <div className="absolute inset-y-0 rounded-full" style={{ width: "2px", background: "var(--timeline-line)", opacity: 0.6 }} />
              </div>
              {/* Right Line - EI */}
              <div className="absolute top-6 bottom-6 z-0" style={{ left: "calc(50% + 10px)", width: "2px" }}>
                <div className="absolute inset-y-0 rounded-full" style={{ width: "2px", background: "var(--timeline-line)", opacity: 0.6 }} />
              </div>

              {/* Current Time Line */}
              {getStartOfDay(currentTime).getTime() === day.date.getTime() && (
                <div
                  className="absolute left-0 right-0 z-10 pointer-events-none"
                  style={{ top: `${getTimeTop(currentTime)}px`, transform: "translateY(-50%)" }}
                >
                  <div className="absolute h-px" style={{ background: "var(--accent-ah)", width: "calc(50% - 60px)", right: "calc(50% - 60px)", opacity: 0.5 }} />
                  <div className="absolute w-2.5 h-2.5 rounded-full" style={{ background: "var(--accent-ah)", left: "50%", transform: "translateX(-50%)", boxShadow: "0 0 5px var(--glow-light)" }} />
                  <div className="absolute h-px" style={{ background: "var(--accent-ah)", width: "calc(50% - 60px)", left: "calc(50% - 60px)", opacity: 0.5 }} />
                  <div
                    className="absolute left-1/2 -translate-x-1/2 -top-5 px-2 py-0.5 rounded text-[9px] font-bold whitespace-nowrap"
                    style={{ color: "var(--accent-ah)", background: "color-mix(in srgb, var(--surface) 85%, transparent)", boxShadow: "0 2px 8px var(--shadow-color)" }}
                  >
                    {formatTime(currentTime)}
                  </div>
                </div>
              )}

              {/* Intakes */}
              <div className="absolute inset-0 z-20">
                {(() => {

                  const renderCard = (intake, dotY, panelY) => {
                    const isNO = intake.patientId === "NO" || intake.subtype === "LOST";
                    const isAH = intake.patientId === "AH";
                    const isSelected = selectedId === intake.id;

                    const accentColor = isAH ? "var(--accent-ah)" : "var(--accent-ei)";
                    const pillInfo = getPillInfo(intake);
                    const totalMg = parseFloat(intake.dosage) || 0;

                    const displaced = Math.abs(panelY - dotY) > CONNECTOR_THRESHOLD_PX;
                    const ARM_H = 14;

                    return (
                      <div key={intake.id} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, pointerEvents: "none" }}>
                        {/* Connector */}
                        {displaced && !isNO && (
                          <div style={{ position: "absolute", left: "50%", top: 0, width: 0, height: 0, overflow: "visible", pointerEvents: "none", zIndex: 8 }}>
                            <svg style={{ overflow: "visible", position: "absolute", top: 0, left: 0 }} width="0" height="0">
                              {isAH ? (
                                <path
                                  d={`M ${-10} ${dotY} L ${-10 - ARM_H} ${dotY} L ${-10 - ARM_H} ${panelY} L ${-10} ${panelY}`}
                                  fill="none" stroke={accentColor} strokeWidth="1" strokeDasharray="3 3" strokeLinecap="round" strokeLinejoin="round" opacity="0.35"
                                />
                              ) : (
                                <path
                                  d={`M ${10} ${dotY} L ${10 + ARM_H} ${dotY} L ${10 + ARM_H} ${panelY} L ${10} ${panelY}`}
                                  fill="none" stroke={accentColor} strokeWidth="1" strokeDasharray="3 3" strokeLinecap="round" strokeLinejoin="round" opacity="0.35"
                                />
                              )}
                            </svg>
                          </div>
                        )}

                        {/* Dot */}
                        {!isNO && (
                          <div
                            style={{
                              position: "absolute",
                              top: `${dotY}px`,
                              transform: "translateY(-50%)",
                              left: isAH ? "calc(50% - 10px - 5px)" : "calc(50% + 10px - 5px)",
                              width: 10,
                              height: 10,
                              borderRadius: "50%",
                              background: accentColor,
                              zIndex: 15,
                              pointerEvents: "none",
                              boxShadow: `0 0 6px ${accentColor}`,
                            }}
                          />
                        )}

                        {/* Panel card — redesigned square-ish panel */}
                        <div
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectIntake(isSelected ? null : intake);
                          }}
                          className={`absolute flex items-center transition-all duration-200 cursor-pointer ${isNO
                            ? "left-1/2 justify-center"
                            : !isAH
                              ? "left-1/2 ml-[20px] justify-end"
                              : "right-1/2 mr-[20px] justify-start"
                            } ${selectedId && !isSelected ? "opacity-80" : isNO ? "opacity-80 hover:opacity-100" : "opacity-100"}`}
                          style={{
                            top: `${panelY}px`,
                            transform: isNO ? "translate(-50%, -50%)" : "translateY(-50%)",
                            width: isNO ? "7em" : "auto",
                            maxWidth: "calc(50% - 18px)",
                            zIndex: isNO ? 5 : 12,
                            pointerEvents: "auto",
                          }}
                        >
                          {isNO ? (
                            /* LOST record — minimal */
                            <div
                              className="px-3 py-1.5 rounded-xl flex items-center gap-1"
                              style={{
                                background: "rgba(120,120,120,0.1)",
                                border: "1px dashed rgba(160,160,160,0.4)",
                              }}
                            >
                              <span className="text-[10px] font-bold" style={{ color: "var(--text-secondary)", opacity: 0.6 }}>
                                {intake.dosage} {intake.unit}
                              </span>
                              <span className="text-[9px]" style={{ color: "var(--text-secondary)", opacity: 0.4 }}>
                                {formatTime(intake.timestamp)}
                              </span>
                            </div>
                          ) : (
                            /* Main intake card — tall, borderless, with pill towers */
                            <div
                              className="rounded-2xl relative overflow-hidden flex flex-col"
                              style={{
                                background: `color-mix(in srgb, ${accentColor} 6%, var(--surface))`,
                                boxShadow: isSelected
                                  ? `0 12px 36px var(--shadow-color-strong), 0 0 0 2px ${accentColor}`
                                  : `0 4px 16px var(--shadow-color)`,
                                transform: isSelected ? "scale(1.05)" : "scale(1)",
                                minWidth: 64,
                                border: "none",
                              }}
                            >
                              {/* Top accent bar */}
                              <div style={{ height: 3, background: accentColor, opacity: 0.7, borderRadius: "2px 2px 0 0" }} />

                              <div className="flex items-stretch">
                                {/* Pill towers mini visualization */}
                                {(pillInfo.pills25 > 0 || pillInfo.pills10 > 0) && (
                                  <div className="flex items-end gap-0 pl-2 py-1.5 flex-shrink-0">
                                    {pillInfo.pills25 > 0 && (
                                      <div style={{ width: 20, height: 36 }}>
                                        <PillTower
                                          pills={pillInfo.pills25}
                                          accentColor={accentColor}
                                          pillType="25"
                                        />
                                      </div>
                                    )}
                                    {pillInfo.pills10 > 0 && (
                                      <div style={{ width: 16, height: 36, marginLeft: -2 }}>
                                        <PillTower
                                          pills={pillInfo.pills10}
                                          accentColor={accentColor}
                                          pillType="10"
                                        />
                                      </div>
                                    )}
                                  </div>
                                )}

                                {/* Info */}
                                <div className="flex flex-col justify-center px-2.5 py-2 gap-0.5 min-w-0">
                                  <div className="flex items-baseline gap-1">
                                    <span className="text-base font-black tabular-nums leading-none" style={{ color: accentColor }}>
                                      {totalMg}
                                    </span>
                                    <span className="text-[9px] font-bold leading-none" style={{ color: accentColor, opacity: 0.55 }}>
                                      мг
                                    </span>
                                  </div>

                                  {/* Pill breakdown */}
                                  {(pillInfo.pills25 > 0 || pillInfo.pills10 > 0) && (
                                    <div className="text-[8px] font-bold leading-tight" style={{ color: "var(--text-secondary)", opacity: 0.5 }}>
                                      {pillInfo.pills25 > 0 && `${pillInfo.pills25 % 1 !== 0 ? pillInfo.pills25.toFixed(1) : pillInfo.pills25}×25`}
                                      {pillInfo.pills25 > 0 && pillInfo.pills10 > 0 && " + "}
                                      {pillInfo.pills10 > 0 && `${pillInfo.pills10}×10`}
                                    </div>
                                  )}

                                  {/* Non-pill dosage for legacy records */}
                                  {pillInfo.pills25 === 0 && pillInfo.pills10 === 0 && intake.unit === "ml" && (
                                    <div className="text-[8px] font-bold" style={{ color: "var(--text-secondary)", opacity: 0.45 }}>
                                      {intake.dosage} мл
                                    </div>
                                  )}

                                  <span className="text-[9px] font-semibold leading-none mt-0.5" style={{ color: "var(--text-secondary)", opacity: 0.5 }}>
                                    {formatTime(intake.timestamp)}
                                  </span>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  };

                  const renderPatientSide = (items, patientId) => {
                    const isAH = patientId === "AH";

                    const layoutUnits = [];
                    const clusterNodes = [];

                    items.forEach((item) => {
                      if (item.type === "single") {
                        layoutUnits.push({ dotY: item.topPx, intake: item.intake });
                      } else {
                        const clusterKey = item.intakes.map((i) => i.id).join("_");
                        const isExpanded = expandedClusters.has(clusterKey);
                        if (isExpanded) {
                          item.intakes.forEach((intake) => {
                            layoutUnits.push({ dotY: getTimeTop(intake.timestamp), intake });
                          });
                        } else {
                          clusterNodes.push(item);
                        }
                      }
                    });

                    layoutUnits.sort((a, b) => a.dotY - b.dotY);
                    const solved = solveLayout(layoutUnits);

                    const clusterEls = clusterNodes.map((cluster) => {
                      const clusterKey = cluster.intakes.map((i) => i.id).join("_");
                      const accentColor = isAH ? "var(--accent-ah)" : "var(--accent-ei)";
                      const totalMgRounded = Math.round(cluster.totalMg * 10) / 10;

                      const toggleExpand = (e) => {
                        e.stopPropagation();
                        setExpandedClusters((prev) => {
                          const next = new Set(prev);
                          if (next.has(clusterKey)) next.delete(clusterKey);
                          else next.add(clusterKey);
                          return next;
                        });
                      };

                      return (
                        <div
                          key={`cluster-${clusterKey}`}
                          onClick={toggleExpand}
                          className={`absolute flex items-center transition-all duration-200 cursor-pointer ${!isAH
                            ? "left-1/2 ml-[20px] justify-end"
                            : "right-1/2 mr-[20px] justify-start"
                            } opacity-100`}
                          style={{ top: `${cluster.topPx}px`, transform: "translateY(-50%)", maxWidth: "calc(50% - 18px)", zIndex: 12 }}
                        >
                          {/* Cluster dot */}
                          <div
                            className={`absolute w-5 h-5 rounded-full z-10 flex items-center justify-center ${!isAH ? "left-[9px]" : "right-[7px]"}`}
                            style={{
                              background: "var(--surface)",
                              border: `3px solid ${accentColor}`,
                              boxShadow: `0 0 0 2px var(--surface), 0 0 0 4px ${accentColor}`,
                            }}
                          >
                            <span className="text-[9px] font-black leading-none" style={{ color: accentColor }}>
                              {cluster.intakes.length}
                            </span>
                          </div>

                          {/* Cluster panel — redesigned */}
                          <div
                            className="rounded-2xl relative overflow-hidden flex flex-col"
                            style={{
                              background: `color-mix(in srgb, ${accentColor} 10%, var(--surface))`,
                              boxShadow: `0 6px 20px var(--shadow-color)`,
                              border: "none",
                              minWidth: 64,
                            }}
                          >
                            <div style={{ height: 3, background: accentColor, opacity: 0.85, borderRadius: "2px 2px 0 0" }} />
                            <div className="px-3 py-2 flex flex-col items-center gap-0.5">
                              <div className="flex items-baseline gap-1">
                                <span className="text-base font-black tabular-nums" style={{ color: accentColor }}>
                                  {totalMgRounded}
                                </span>
                                <span className="text-[9px] font-bold" style={{ color: accentColor, opacity: 0.55 }}>
                                  мг
                                </span>
                              </div>
                              <div className="flex items-center gap-1">
                                <span className="text-[9px] font-semibold" style={{ color: "var(--text-secondary)", opacity: 0.5 }}>
                                  {cluster.intakes.length} пр · {formatTime(cluster.lastTime)}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    });

                    const cardEls = solved.map(({ intake, dotY, panelY }) =>
                      renderCard(intake, dotY, panelY),
                    );

                    return [...clusterEls, ...cardEls];
                  };

                  const noIntakes = day.intakes.filter(
                    (i) => i.patientId === "NO" || i.subtype === "LOST",
                  );

                  const ahItems = computeClusters(day.intakes, "AH");
                  const eiItems = computeClusters(day.intakes, "EI");

                  return (
                    <>
                      {noIntakes.map((intake) =>
                        renderCard(intake, getTimeTop(intake.timestamp), getTimeTop(intake.timestamp)),
                      )}
                      {renderPatientSide(ahItems, "AH")}
                      {renderPatientSide(eiItems, "EI")}
                    </>
                  );
                })()}
              </div>

              <div className="absolute top-3 left-0 right-0 flex justify-center pointer-events-none z-30">
                <span
                  className="px-3 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest"
                  style={{ background: "transparent", color: "var(--text-secondary)", opacity: 0.75 }}
                >
                  {formatViewedDate(day.date)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default TimelineHistory;
