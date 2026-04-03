import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "../firebase";
import { formatTime, formatViewedDate, getStartOfDay } from "../utils/time";
import { PillIcon } from "./PillTower";

// Minimum pixel gap between two intake bubbles before clustering kicks in
const CLUSTER_THRESHOLD_PX = 38;
// Panel card height + gap between stacked panels
const PANEL_H = 48;
// Connector line is drawn when panel is displaced more than this (px) from its dot
const CONNECTOR_THRESHOLD_PX = 4;

/**
 * Layout solver: dots stay at their exact timestamp pixel positions.
 * Panels are distributed so they never overlap (min PANEL_H apart).
 *
 * Anchoring rule: the MIDDLE item's panel stays as close as possible to its
 * dot. Items above the middle are pushed upward from there, items below
 * are pushed downward — so the group "fans out" from the middle entry.
 *
 * After the initial fan-out we do a few relaxation passes to handle cases
 * where the dots themselves are spread wider than PANEL_H.
 */
function solveLayout(items) {
  if (items.length === 0) return [];
  if (items.length === 1) return [{ ...items[0], panelY: items[0].dotY }];

  const n = items.length;
  // items are sorted by dotY ascending (top of screen first)

  // Place panels starting from the middle item anchored to its dot
  const mid = Math.floor(n / 2);
  const panels = new Array(n);
  panels[mid] = items[mid].dotY;

  // Fan upward from mid (each panel is PANEL_H above the next)
  for (let i = mid - 1; i >= 0; i--) {
    panels[i] = Math.min(panels[i + 1] - PANEL_H, items[i].dotY);
  }
  // Fan downward from mid
  for (let i = mid + 1; i < n; i++) {
    panels[i] = Math.max(panels[i - 1] + PANEL_H, items[i].dotY);
  }

  // Relaxation: push overlapping panels apart while respecting dot ordering
  for (let pass = 0; pass < 20; pass++) {
    // Push apart top→bottom
    for (let i = 1; i < n; i++) {
      if (panels[i] < panels[i - 1] + PANEL_H) {
        panels[i] = panels[i - 1] + PANEL_H;
      }
    }
    // Push apart bottom→top
    for (let i = n - 2; i >= 0; i--) {
      if (panels[i] > panels[i + 1] - PANEL_H) {
        panels[i] = panels[i + 1] - PANEL_H;
      }
    }
    // Gentle pull: each panel nudges toward its own dot (only if it won't create overlap)
    for (let i = 0; i < n; i++) {
      const target = items[i].dotY;
      const nudge = (target - panels[i]) * 0.12;
      panels[i] += nudge;
    }
    // Re-enforce spacing after nudge
    for (let i = 1; i < n; i++) {
      if (panels[i] < panels[i - 1] + PANEL_H) panels[i] = panels[i - 1] + PANEL_H;
    }
    for (let i = n - 2; i >= 0; i--) {
      if (panels[i] > panels[i + 1] - PANEL_H) panels[i] = panels[i + 1] - PANEL_H;
    }
  }

  return items.map((it, idx) => ({ ...it, panelY: panels[idx] }));
}

const SUBTYPE_COLORS = {
  IV: "var(--subtype-iv)",
  IM: "var(--subtype-im)",
  PO: "var(--subtype-po)",
  "IV+PO": "var(--subtype-ivpo)",
  VTRK: "var(--subtype-vtrk)",
};

const SUBTYPE_GLOWS = {
  IV: "0 0 20px var(--glow-light), 0 0 40px var(--glow-light)",
  IM: "0 0 20px var(--glow-light), 0 0 40px var(--glow-light)",
  PO: "0 0 20px var(--glow-light), 0 0 40px var(--glow-light)",
  "IV+PO": "0 0 20px var(--glow-light), 0 0 40px var(--glow-light)",
  VTRK: "0 0 20px var(--glow-light), 0 0 40px var(--glow-light)",
};

const SUBTYPE_BORDER_COLORS = {
  IV: "var(--subtype-iv)",
  IM: "var(--subtype-im)",
  PO: "var(--subtype-po)",
  "IV+PO": "var(--subtype-ivpo)",
  VTRK: "var(--subtype-vtrk)",
};

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

// Base height for 24 hours in pixels (1 minute = 1 pixel at 1x zoom)
const BASE_DAY_HEIGHT_PX = 1440;

const TimelineHistory = ({ onDayChange, selectedId, onSelectIntake, scrollToNextDay, scrollToPrevDay, hideData = false }) => {
  const [intakes, setIntakes] = useState([]);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [zoomLevel, setZoomLevel] = useState(1);
  const [expandedClusters, setExpandedClusters] = useState(new Set());
  const scrollRef = useRef(null);
  const dayRefs = useRef([]);

  // Calculate day height based on zoom
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
      const dateStr = getStartOfDay(intake.timestamp).toLocaleDateString(
        "uk-UA",
      );
      if (!groups[dateStr])
        groups[dateStr] = {
          date: getStartOfDay(intake.timestamp),
          intakes: [],
        };
      groups[dateStr].intakes.push(intake);
    });

    return Object.values(groups).sort((a, b) => b.date - a.date);
  }, [intakes]);

  const sortedDays = useMemo(() => groupedByDay, [groupedByDay]);

  useEffect(() => {
    dayRefs.current = sortedDays.map(
      (_, idx) => dayRefs.current[idx] || { current: null },
    );
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
      if (topOffset <= headerOffset) {
        activeIndex = idx;
      }
    });

    const activeDay = sortedDays[activeIndex];
    if (activeDay) {
      onDayChange(formatViewedDate(activeDay.date));
    }
  }, [onDayChange, sortedDays]);

  useEffect(() => {
    updateCurrentDayHeading();
  }, [updateCurrentDayHeading, sortedDays]);

  // Scroll to start of next day (newer day, index - 1)
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
    // Next day = index - 1 (newer, higher up in DOM)
    const targetIndex = activeIndex - 1;
    if (targetIndex >= 0 && dayRefs.current[targetIndex]?.current) {
      dayRefs.current[targetIndex].current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [sortedDays]);

  // Scroll to start of prev day (older day, index + 1)
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
    // Prev day = index + 1 (older, lower in DOM)
    const targetIndex = activeIndex + 1;
    if (targetIndex < sortedDays.length && dayRefs.current[targetIndex]?.current) {
      dayRefs.current[targetIndex].current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [sortedDays]);

  // Expose scroll handlers via callback props
  useEffect(() => {
    if (scrollToNextDay) scrollToNextDay.current = handleScrollToNextDay;
  }, [scrollToNextDay, handleScrollToNextDay]);

  useEffect(() => {
    if (scrollToPrevDay) scrollToPrevDay.current = handleScrollToPrevDay;
  }, [scrollToPrevDay, handleScrollToPrevDay]);

  // Convert time to pixel position (1440px = 24 hours at 1x zoom, scaled by zoomLevel)
  const getTimeTop = (date) => {
    const mins = date.getHours() * 60 + date.getMinutes();
    // Invert: 00:00 should be at bottom, 23:59 at top
    // Scale by zoomLevel so records stay at correct positions
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
      // Position within day - scale by zoomLevel
      const dayPosition = (BASE_DAY_HEIGHT_PX - mins) * zoomLevel;
      return dayIdx * (BASE_DAY_HEIGHT_PX * zoomLevel) + dayPosition;
    },
    [zoomLevel],
  );

  const zoomIn = () => {
    const currentIndex = ZOOM_LEVELS.findIndex((z) => z.value === zoomLevel);
    if (currentIndex < ZOOM_LEVELS.length - 1) {
      setZoomLevel(ZOOM_LEVELS[currentIndex + 1].value);
    }
  };

  const zoomOut = () => {
    const currentIndex = ZOOM_LEVELS.findIndex((z) => z.value === zoomLevel);
    if (currentIndex > 0) {
      setZoomLevel(ZOOM_LEVELS[currentIndex - 1].value);
    }
  };

  // Convert a dosage to mg (ml → mg at 20:1 ratio)
  const toMg = (dosage, unit) => {
    const val = parseFloat(dosage) || 0;
    return unit === "ml" ? val * 20 : val;
  };

  // Group intakes for one patient+day into clusters when they are too close.
  // Returns an array of items, each either { type: 'single', intake } or
  // { type: 'cluster', intakes, topPx, totalMg, lastTime }.
  const computeClusters = useCallback(
    (dayIntakes, patientId) => {
      const items = dayIntakes
        .filter((i) => i.patientId === patientId)
        .slice()
        .sort((a, b) => b.timestamp - a.timestamp); // newest (top) first

      if (items.length === 0) return [];

      // Assign pixel positions
      const withPos = items.map((i) => ({ intake: i, topPx: getTimeTop(i.timestamp) }));

      // Greedy clustering: scan top→bottom (ascending topPx).
      // Since timeline is inverted (top = recent), sorted desc timestamp = ascending topPx.
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
          // last time = the one with the latest timestamp (smallest topPx = first in group since desc-sorted)
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

  return (
    <div className="flex flex-col h-full">
      {/* Zoom Controls — glass bar */}
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
        className="flex-grow overflow-y-auto custom-scrollbar px-5 pb-20"
        onClick={() => onSelectIntake(null)}
        onScroll={updateCurrentDayHeading}
      >
        <div className="relative">
          {/* Gaps: time passed between adjacent intakes across the whole timeline (AH left, EI right) */}
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

                // Between each two intakes (even across different days)
                for (let idx = 0; idx < items.length - 1; idx += 1) {
                  const a = items[idx];
                  const b = items[idx + 1];
                  const y1 = getAbsoluteYWithinTimeline(
                    dayIndexByStartMs,
                    a.timestamp,
                  );
                  const y2 = getAbsoluteYWithinTimeline(
                    dayIndexByStartMs,
                    b.timestamp,
                  );
                  if (y1 == null || y2 == null) continue;
                  const minutesPassed = Math.abs(
                    (a.timestamp - b.timestamp) / 60000,
                  );
                  if (minutesPassed < 1) continue;
                  labels.push({
                    id: `${a.id}__${b.id}`,
                    y: (y1 + y2) / 2,
                    label: formatDurationHM(minutesPassed),
                  });
                }

                // Between last past intake and now
                const lastPast = items.find(
                  (i) => i.timestamp.getTime() <= currentTime.getTime(),
                );
                if (lastPast) {
                  const y1 = getAbsoluteYWithinTimeline(
                    dayIndexByStartMs,
                    currentTime,
                  );
                  const y2 = getAbsoluteYWithinTimeline(
                    dayIndexByStartMs,
                    lastPast.timestamp,
                  );
                  if (y1 != null && y2 != null) {
                    const minutesPassed = Math.abs(
                      (currentTime - lastPast.timestamp) / 60000,
                    );
                    if (minutesPassed >= 1) {
                      labels.push({
                        id: `${lastPast.id}__now`,
                        y: (y1 + y2) / 2,
                        label: formatDurationHM(minutesPassed),
                      });
                    }
                  }
                }

                return labels;
              };

              const ahLabels = buildGapLabels("AH");
              const eiLabels = buildGapLabels("EI");

              return (
                <>
                  {/* AH labels on left side (left of left line) */}
                  {ahLabels.map((g) => (
                    <div
                      key={`ah-gap-${g.id}`}
                      className="absolute whitespace-nowrap"
                      style={{
                        top: `${g.y}px`,
                        transform: "translateY(-50%)",
                        left: "calc(50% - 120px)",
                        ...commonStyle,
                      }}
                    >
                      {g.label}
                    </div>
                  ))}

                  {/* EI labels on right side (right of right line) */}
                  {eiLabels.map((g) => (
                    <div
                      key={`ei-gap-${g.id}`}
                      className="absolute whitespace-nowrap"
                      style={{
                        top: `${g.y}px`,
                        transform: "translateY(-50%)",
                        right: "calc(50% - 120px)",
                        left: "auto",
                        ...commonStyle,
                      }}
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
              ref={(el) => {
                dayRefs.current[index] = { current: el };
              }}
              className="relative"
              style={{
                height: `${DAY_VIEWPORT_HEIGHT_PX}px`,
                background: "transparent",
              }}
            >
              {/* Markers - horizontal lines with tick marks on outer sides of parallel lines */}
              <div className="absolute inset-0 pointer-events-none z-0">
                {(() => {
                  // Calculate marker intervals based on zoom level
                  // Format: tickInterval, labelInterval
                  let tickInterval, labelInterval;
                  if (zoomLevel <= 0.375) {
                    tickInterval = 60; // Every 1 hour
                    labelInterval = 180; // Every 3 hours
                  } else if (zoomLevel <= 0.625) {
                    tickInterval = 30; // Every 30 min
                    labelInterval = 180; // Every 3 hours
                  } else if (zoomLevel <= 0.875) {
                    tickInterval = 30; // Every 30 min
                    labelInterval = 180; // Every 3 hours
                  } else if (zoomLevel <= 1.375) {
                    tickInterval = 15; // Every 15 min
                    labelInterval = 120; // Every 2 hours
                  } else if (zoomLevel <= 1.75) {
                    tickInterval = 15; // Every 15 min
                    labelInterval = 120; // Every 2 hours
                  } else if (zoomLevel <= 2.25) {
                    tickInterval = 15; // Every 15 min
                    labelInterval = 60; // Every 1 hour
                  } else if (zoomLevel <= 2.75) {
                    tickInterval = 15; // Every 15 min
                    labelInterval = 30; // Every 30 min
                  } else if (zoomLevel <= 3.25) {
                    tickInterval = 10; // Every 10 min
                    labelInterval = 30; // Every 30 min
                  } else if (zoomLevel <= 3.75) {
                    tickInterval = 10; // Every 10 min
                    labelInterval = 30; // Every 30 min
                  } else if (zoomLevel <= 4.25) {
                    tickInterval = 5; // Every 5 min
                    labelInterval = 15; // Every 15 min
                  } else if (zoomLevel <= 4.75) {
                    tickInterval = 5; // Every 5 min
                    labelInterval = 15; // Every 15 min
                  } else if (zoomLevel <= 5.75) {
                    tickInterval = 1; // Every 1 min
                    labelInterval = 10; // Every 10 min
                  } else if (zoomLevel <= 7) {
                    tickInterval = 1; // Every 1 min
                    labelInterval = 10; // Every 10 min
                  } else if (zoomLevel <= 10) {
                    tickInterval = 1; // Every 1 min
                    labelInterval = 5; // Every 5 min
                  } else {
                    tickInterval = 1; // Every 1 min
                    labelInterval = 1; // Every 1 min
                  }

                  // Generate all markers
                  const markers = [];
                  for (let mins = 0; mins < 1440; mins += tickInterval) {
                    const hour = Math.floor(mins / 60);
                    const min = mins % 60;
                    // Show label at labelInterval
                    const showLabel = mins % labelInterval === 0;
                    markers.push({ mins, hour, min, showLabel });
                  }

                  const tickWidth = 4; // * zoomLevel;
                  const tickOffset = 0;
                  const labelOffset = tickOffset + 20;

                  return (
                    <>
                      {markers.map(({ mins, hour, min, showLabel }) => {
                        const top = getTimeTop(
                          new Date(day.date.getTime() + mins * 60000),
                        );
                        return (
                          <div
                            key={mins}
                            className="absolute flex items-center"
                            style={{
                              top: `${top}px`,
                              transform: "translateY(-50%)",
                              left: "50%",
                              width: "0",
                              height: "0",
                            }}
                          >
                            {/* Left tick (for left line) */}
                            <div
                              className="h-px absolute"
                              style={{
                                background: "var(--marker-color)",
                                opacity: showLabel ? 0.8 : 0.5,
                                width: `${showLabel ? tickWidth : tickWidth * 0.8}px`,
                                right: `calc(50% + ${tickOffset}px)`,
                              }}
                            />
                            {/* Right tick (for right line) */}
                            <div
                              className="h-px absolute"
                              style={{
                                background: "var(--marker-color)",
                                opacity: showLabel ? 0.8 : 0.5,
                                width: `${showLabel ? tickWidth : tickWidth * 0.8}px`,
                                left: `calc(50% + ${tickOffset}px)`,
                              }}
                            />
                            {showLabel && (
                              <>
                                <span
                                  className="absolute text-[10px]"
                                  style={{
                                    color: "var(--marker-color)",
                                    opacity: 0.4,
                                    right: `calc(50% + ${labelOffset}px)`,
                                  }}
                                >
                                  {String(hour).padStart(2, "0")}:
                                  {String(min).padStart(2, "0")}
                                </span>
                                <span
                                  className="absolute text-[10px]"
                                  style={{
                                    color: "var(--marker-color)",
                                    opacity: 0.4,
                                    left: `calc(50% + ${labelOffset}px)`,
                                  }}
                                >
                                  {String(hour).padStart(2, "0")}:
                                  {String(min).padStart(2, "0")}
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

              {/* Two Parallel Lines in Center */}
              {/* Left Line - AH */}
              <div
                className="absolute top-6 bottom-6 z-0"
                style={{
                  left: "calc(50% - 10px)",
                  width: "2px",
                }}
              >
                <div
                  className="absolute inset-y-0 rounded-full"
                  style={{
                    width: "2px",
                    background: "var(--timeline-line)",
                    opacity: 0.6,
                  }}
                />
              </div>
              {/* Right Line - EI */}
              <div
                className="absolute top-6 bottom-6 z-0"
                style={{
                  left: "calc(50% + 10px)",
                  width: "2px",
                }}
              >
                <div
                  className="absolute inset-y-0 rounded-full"
                  style={{
                    width: "2px",
                    background: "var(--timeline-line)",
                    opacity: 0.6,
                  }}
                />
              </div>

              {/* Current Time Line */}
              {getStartOfDay(currentTime).getTime() === day.date.getTime() && (
                <div
                  className="absolute left-0 right-0 z-10 pointer-events-none"
                  style={{
                    top: `${getTimeTop(currentTime)}px`,
                    transform: "translateY(-50%)",
                  }}
                >
                  {/* Left marker */}
                  <div
                    className="absolute h-px"
                    style={{
                      background: "var(--accent-ah)",
                      width: "calc(50% - 60px)",
                      right: "calc(50% - 60px)",
                      opacity: 0.5,
                    }}
                  />
                  {/* Center dot */}
                  <div
                    className="absolute w-2.5 h-2.5 rounded-full"
                    style={{
                      background: "var(--accent-ah)",
                      left: "50%",
                      transform: "translateX(-50%)",
                      boxShadow: "0 0 5px var(--glow-light)",
                    }}
                  />
                  {/* Right marker */}
                  <div
                    className="absolute h-px"
                    style={{
                      background: "var(--accent-ah)",
                      width: "calc(50% - 60px)",
                      left: "calc(50% - 60px)",
                      opacity: 0.5,
                    }}
                  />
                  {/* Time label */}
                  <div
                    className="absolute left-1/2 -translate-x-1/2 -top-5 px-2 py-0.5 rounded text-[9px] font-bold whitespace-nowrap"
                    style={{
                      color: "var(--accent-ah)",
                      background:
                        "color-mix(in srgb, var(--surface) 85%, transparent)",
                      boxShadow: "0 2px 8px var(--shadow-color)",
                    }}
                  >
                    {formatTime(currentTime)}
                  </div>
                </div>
              )}

              {/* Intakes */}
              <div className="absolute inset-0 z-20">
                {(() => {
                  // ── helpers ──────────────────────────────────────────────

                  // Render a single intake card + dot + optional connector line.
                  // dotY   = exact pixel position of the timeline dot (never moves)
                  // panelY = pixel position where the panel card is rendered
                  // Both measured from the top of the day block, used with translateY(-50%)
                  const renderCard = (intake, dotY, panelY) => {
                    const isNO = intake.patientId === "NO" || intake.subtype === "LOST";
                    const isAH = intake.patientId === "AH";
                    const isSelected = selectedId === intake.id;
                    const subtype = intake.subtype;

                    const bubbleBg = isNO
                      ? "transparent"
                      : isAH
                      ? "color-mix(in srgb, var(--accent-ah) 9%, transparent)"
                      : "color-mix(in srgb, var(--accent-ei) 9%, transparent)";

                    const subtypeColor = SUBTYPE_COLORS[subtype] || "var(--text-secondary)";
                    const subtypeGlow = SUBTYPE_GLOWS[subtype] || "none";
                    // LOST records: dashed grey border
                    const subtypeBorderColor = isNO
                      ? "rgba(160,160,160,0.55)"
                      : SUBTYPE_BORDER_COLORS[subtype] || "rgba(255,255,255,0.55)";

                    // Connector line from dot to panel (only when displaced)
                    const displaced = Math.abs(panelY - dotY) > CONNECTOR_THRESHOLD_PX;

                    // Mind-map connector geometry:
                    // AH side: dot is on the left vertical line (center - 10px).
                    //   Panel is to the LEFT of the dot. Connector goes:
                    //   dot → short horizontal arm LEFT → vertical run → short horizontal arm to panel edge
                    // EI side: dot is on the right vertical line (center + 10px).
                    //   Panel is to the RIGHT. Mirror of AH.
                    //
                    // We render this as a single SVG path using calc()-free positioning:
                    // The SVG is absolutely positioned and fills the day block.
                    // dotX for AH  ≈ 50% - 10px  →  we use CSS variable workaround via inline style width trick.
                    // Since we can't use calc() in SVG attributes we render the SVG in a way where
                    // the coordinate origin is placed at the center of the day block.

                    const lineColor = subtype ? subtypeColor : "var(--text-secondary)";
                    // Horizontal arm length (px from the vertical timeline line to where the bend is)
                    const ARM_H = 14;

                    return (
                      <div key={intake.id} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, pointerEvents: "none" }}>
                        {/* Mind-map connector: dot → arm → vertical run → arm → panel */}
                        {displaced && !isNO && (
                          <div
                            style={{
                              position: "absolute",
                              // Container anchored to the center of the day block
                              // We use left:50% and then offset with negative margin
                              left: "50%",
                              top: 0,
                              width: 0,
                              height: 0,
                              overflow: "visible",
                              pointerEvents: "none",
                              zIndex: 8,
                            }}
                          >
                            <svg
                              style={{ overflow: "visible", position: "absolute", top: 0, left: 0 }}
                              width="0"
                              height="0"
                            >
                              {isAH ? (
                                // AH: dot at x = -10, panel to the LEFT
                                // Path: dot(x=-10, y=dotY) → left arm → (x=-10-ARM_H, dotY) →
                                //        vertical → (x=-10-ARM_H, panelY) → right arm → (x=-10, panelY)
                                <path
                                  d={`M ${-10} ${dotY} L ${-10 - ARM_H} ${dotY} L ${-10 - ARM_H} ${panelY} L ${-10} ${panelY}`}
                                  fill="none"
                                  stroke={lineColor}
                                  strokeWidth="1.5"
                                  strokeDasharray="4 3"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  opacity="0.6"
                                />
                              ) : (
                                // EI: dot at x = +10, panel to the RIGHT
                                <path
                                  d={`M ${10} ${dotY} L ${10 + ARM_H} ${dotY} L ${10 + ARM_H} ${panelY} L ${10} ${panelY}`}
                                  fill="none"
                                  stroke={lineColor}
                                  strokeWidth="1.5"
                                  strokeDasharray="4 3"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  opacity="0.6"
                                />
                              )}
                            </svg>
                          </div>
                        )}

                        {/* Dot — always at dotY on the timeline line */}
                        {!isNO && (
                          <div
                            style={{
                              position: "absolute",
                              top: `${dotY}px`,
                              transform: "translateY(-50%)",
                              // AH dot: on left line (calc 50%-10px), EI dot: on right line (calc 50%+10px)
                              left: isAH ? "calc(50% - 10px - 6px)" : "calc(50% + 10px - 6px)",
                              width: 12,
                              height: 12,
                              borderRadius: "50%",
                              border: "2px solid",
                              background: subtype ? subtypeColor : "var(--text-secondary)",
                              borderColor: subtype ? subtypeColor : "var(--text-secondary)",
                              zIndex: 15,
                              pointerEvents: "none",
                            }}
                          />
                        )}

                        {/* Panel card — at panelY, interactive */}
                        <div
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectIntake(isSelected ? null : intake);
                          }}
                          className={`absolute flex items-center transition-all duration-200 cursor-pointer ${
                            isNO
                              ? "left-1/2 justify-center"
                              : !isAH
                                ? "left-1/2 -ml-[9px] pr-5 justify-end"
                                : "right-1/2 -mr-[9px] pl-5 justify-start"
                          } ${selectedId && !isSelected ? "opacity-30" : isNO ? "opacity-40 hover:opacity-70" : "opacity-100"}`}
                          style={{
                            top: `${panelY}px`,
                            transform: isNO ? "translate(-50%, -50%)" : "translateY(-50%)",
                            width: "10em",
                            zIndex: isNO ? 5 : 12,
                            pointerEvents: "auto",
                          }}
                        >
                          <div
                            className="px-3 py-2 rounded-2xl border relative flex flex-col items-center min-w-[70px]"
                            style={{
                              background: bubbleBg,
                              borderColor: subtypeBorderColor,
                              // LOST: dashed grey; others: solid
                              borderStyle: isNO ? "dashed" : "solid",
                              borderWidth: isNO ? "1.5px" : "1px",
                              boxShadow: isSelected
                                ? `0 18px 44px var(--shadow-color-strong), 0 0 20px var(--glow-light)`
                                : isNO
                                ? "none"
                                : "0 5px 22px var(--shadow-color), 0 0 10px var(--glow-dark)",
                              transform: isSelected ? "scale(1.09)" : "scale(1)",
                            }}
                          >
                            <div className="flex items-center gap-1">
                              {/* Pill-specific rendering */}
                              {(intake.instrument === "pills" || (intake.subtype === "PO" && intake.unit === "mg" && intake.dosage % 12.5 === 0 && intake.dosage > 0)) ? (
                                <>
                                  <PillIcon size={14} className="flex-shrink-0" />
                                  <span className="text-sm font-black" style={{ color: "var(--subtype-po)" }}>
                                    {(parseFloat(intake.dosage) / 25).toFixed(1).replace(".0", "")}
                                  </span>
                                  <span className="text-[9px] font-bold" style={{ color: "var(--subtype-po)", opacity: 0.6 }}>
                                    таб
                                  </span>
                                  <span className="text-[9px] font-bold" style={{ color: "var(--text-secondary)", opacity: 0.4 }}>
                                    {intake.dosage}мг
                                  </span>
                                </>
                              ) : (
                                <>
                                  <span className="text-sm font-black" style={{ color: "var(--text-primary)" }}>
                                    {intake.dosage}
                                  </span>
                                  <span className="text-[10px] font-black" style={{ color: "var(--text-secondary)", opacity: 0.7 }}>
                                    {intake.unit}
                                  </span>
                                  {intake.unit === "ml" && (
                                    <span className="text-[9px] font-bold ml-0.5" style={{ color: "var(--text-secondary)", opacity: 0.5 }}>
                                      ~{(parseFloat(intake.dosage) * 20).toFixed(0)} mg
                                    </span>
                                  )}
                                </>
                              )}
                              <span className="text-[10px] font-semibold" style={{ color: "var(--text-secondary)", opacity: 0.6 }}>
                                {formatTime(intake.timestamp)}
                              </span>
                              {subtype && (
                                <span
                                  className={`absolute inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-black z-0 ${
                                    isNO
                                      ? "top-[-8px] left-1/2 -translate-x-1/2"
                                      : isAH
                                        ? "left-[-2px] ml-[-17px] top-[-5px]"
                                        : "right-[-2px] mr-[-10px] top-[-5px]"
                                  }`}
                                  style={{
                                    backgroundColor: isNO ? "rgba(160,160,160,0.8)" : subtypeColor,
                                    color: isNO ? "var(--surface)" : "white",
                                    opacity: 0.9,
                                    borderRadius: 100,
                                    transform: isNO
                                      ? "none"
                                      : isAH && (subtype === "IV+PO" || subtype === "VTRK")
                                      ? "rotate(-45deg)"
                                      : !isAH && (subtype === "IV+PO" || subtype === "VTRK")
                                      ? "rotate(45deg)"
                                      : "rotate(0deg)",
                                    boxShadow: subtypeGlow !== "none" && !isNO ? `0 0 10px ${subtypeColor}` : "none",
                                  }}
                                >
                                  {(intake.instrument === "pills" || (subtype === "PO" && intake.unit === "mg" && intake.dosage % 12.5 === 0 && intake.dosage > 0))
                                    ? <><PillIcon size={10} className="mr-0.5" />{subtype}</>
                                    : subtype
                                  }
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  };

                  // ── Build layout for one patient side ────────────────────
                  // Returns rendered elements for all items (singles + clusters + expanded)
                  const renderPatientSide = (items, patientId) => {
                    const isAH = patientId === "AH";

                    // Collect all visible layout units for this patient:
                    // Each unit: { dotY, intake, fromCluster }
                    // For collapsed clusters: render cluster node (handled separately below)
                    // For expanded clusters + singles: go into layout solver

                    const layoutUnits = []; // { dotY, intake }
                    const clusterNodes = []; // collapsed cluster nodes to render as-is

                    items.forEach((item) => {
                      if (item.type === "single") {
                        layoutUnits.push({ dotY: item.topPx, intake: item.intake });
                      } else {
                        // cluster
                        const clusterKey = item.intakes.map((i) => i.id).join("_");
                        const isExpanded = expandedClusters.has(clusterKey);
                        if (isExpanded) {
                          // Each intake in the expanded cluster becomes a layout unit
                          item.intakes.forEach((intake) => {
                            layoutUnits.push({ dotY: getTimeTop(intake.timestamp), intake });
                          });
                        } else {
                          clusterNodes.push(item);
                        }
                      }
                    });

                    // Sort layout units by dotY ascending (top of screen first)
                    layoutUnits.sort((a, b) => a.dotY - b.dotY);

                    // Solve panel positions
                    const solved = solveLayout(layoutUnits);

                    // Render collapsed cluster nodes (they have their own fixed position)
                    const clusterEls = clusterNodes.map((cluster) => {
                      const clusterKey = cluster.intakes.map((i) => i.id).join("_");
                      const accentColor = isAH ? "var(--accent-ah)" : "var(--accent-ei)";
                      const bubbleBg = isAH
                        ? "color-mix(in srgb, var(--accent-ah) 12%, transparent)"
                        : "color-mix(in srgb, var(--accent-ei) 12%, transparent)";
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
                          className={`absolute flex items-center transition-all duration-200 cursor-pointer ${
                            !isAH
                              ? "left-1/2 -ml-[9px] pr-5 justify-end"
                              : "right-1/2 -mr-[9px] pl-5 justify-start"
                          } opacity-100`}
                          style={{
                            top: `${cluster.topPx}px`,
                            transform: "translateY(-50%)",
                            width: "10em",
                            zIndex: 12,
                          }}
                        >
                          {/* Cluster dot — double ring with count */}
                          <div
                            className={`absolute w-5 h-5 rounded-full z-10 flex items-center justify-center ${
                              !isAH ? "left-[9px]" : "right-[7px]"
                            }`}
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

                          {/* Cluster panel */}
                          <div
                            className="px-3 py-2 rounded-2xl relative flex flex-col items-center min-w-[70px]"
                            style={{
                              background: bubbleBg,
                              border: `2px solid ${accentColor}`,
                              outline: `1px solid ${accentColor}`,
                              outlineOffset: "2px",
                              boxShadow: `0 5px 22px var(--shadow-color), 0 0 12px var(--glow-dark)`,
                            }}
                          >
                            <div className="flex items-center gap-1">
                              <span className="text-sm font-black" style={{ color: "var(--text-primary)" }}>
                                {totalMgRounded}
                              </span>
                              <span className="text-[10px] font-black" style={{ color: "var(--text-secondary)", opacity: 0.7 }}>
                                mg
                              </span>
                              <span className="text-[10px] font-semibold" style={{ color: "var(--text-secondary)", opacity: 0.6 }}>
                                {formatTime(cluster.lastTime)}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    });

                    // Render solved layout units (singles + expanded cluster items)
                    const cardEls = solved.map(({ intake, dotY, panelY }) =>
                      renderCard(intake, dotY, panelY),
                    );

                    return [...clusterEls, ...cardEls];
                  };

                  // ── LOST / NO intakes — rendered individually, centred ──
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
                  style={{
                    background: "transparent",
                    color: "var(--text-secondary)",
                    opacity: 0.75,
                  }}
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
