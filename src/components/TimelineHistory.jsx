import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '../firebase';
import { formatTime, formatViewedDate, getStartOfDay } from '../utils/time';

const SUBTYPE_COLORS = {
  IV: 'var(--subtype-iv)',
  IM: 'var(--subtype-im)',
  PO: 'var(--subtype-po)',
  'IV+PO': 'var(--subtype-ivpo)',
  'VTRK': 'var(--subtype-vtrk)'
};

const SUBTYPE_GLOWS = {
  IV: '0 0 20px var(--glow-light), 0 0 40px var(--glow-light)',
  IM: '0 0 20px var(--glow-light), 0 0 40px var(--glow-light)',
  PO: '0 0 20px var(--glow-light), 0 0 40px var(--glow-light)',
  'IV+PO': '0 0 20px var(--glow-light), 0 0 40px var(--glow-light)',
  'VTRK': '0 0 20px var(--glow-light), 0 0 40px var(--glow-light)'
};

const SUBTYPE_BORDER_COLORS = {
  IV: 'var(--subtype-iv)',
  IM: 'var(--subtype-im)',
  PO: 'var(--subtype-po)',
  'IV+PO': 'var(--subtype-ivpo)',
  'VTRK': 'var(--subtype-vtrk)'
};

const ZOOM_LEVELS = [
  { value: 0.25, label: '0.25x' },
  { value: 0.5, label: '0.5x' },
  { value: 0.75, label: '0.75x' },
  { value: 1, label: '1x' },
  { value: 1.25, label: '1.25x' },
  { value: 1.5, label: '1.5x' },
  { value: 2, label: '2x' },
  { value: 2.5, label: '2.5x' },
  { value: 3, label: '3x' },
  { value: 3.5, label: '3.5x' },
  { value: 4, label: '4x' },
  { value: 4.5, label: '4.5x' },
  { value: 5, label: '5x' },
  { value: 5.5, label: '5.5x' },
  { value: 6, label: '6x' },
  { value: 8, label: '8x' },
  { value: 10, label: '10x' }
];

// Base height for 24 hours in pixels (1 minute = 1 pixel at 1x zoom)
const BASE_DAY_HEIGHT_PX = 1440;

const TimelineHistory = ({ onDayChange, selectedId, onSelectIntake, isSelectingTime, onTimeSelected }) => {
  const [intakes, setIntakes] = useState([]);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [selectedLine, setSelectedLine] = useState(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const isPointerDown = useRef(false);
  const scrollRef = useRef(null);
  const dayRefs = useRef([]);

  // Calculate day height based on zoom
  const DAY_VIEWPORT_HEIGHT_PX = useMemo(() => {
    return BASE_DAY_HEIGHT_PX * zoomLevel;
  }, [zoomLevel]);

  useEffect(() => {
    const q = query(collection(db, 'intakes'), orderBy('timestamp', 'desc'));
    return onSnapshot(q, (snapshot) => {
      setIntakes(
        snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
          timestamp: doc.data().timestamp?.toDate() || new Date()
        }))
      );
    });
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const effectiveSelectedLine = useMemo(() => {
    if (!isSelectingTime) return null;
    if (selectedLine) return selectedLine;
    const now = currentTime;
    return { date: getStartOfDay(now), mins: now.getHours() * 60 + now.getMinutes() };
  }, [currentTime, isSelectingTime, selectedLine]);

  const groupedByDay = useMemo(() => {
    const groups = {};
    const today = getStartOfDay(new Date());
    groups[today.toLocaleDateString('uk-UA')] = { date: today, intakes: [] };

    intakes.forEach((intake) => {
      const dateStr = getStartOfDay(intake.timestamp).toLocaleDateString('uk-UA');
      if (!groups[dateStr]) groups[dateStr] = { date: getStartOfDay(intake.timestamp), intakes: [] };
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

  // Convert time to pixel position (1440px = 24 hours at 1x zoom, scaled by zoomLevel)
  const getTimeTop = (date) => {
    const mins = date.getHours() * 60 + date.getMinutes();
    // Invert: 00:00 should be at bottom, 23:59 at top
    // Scale by zoomLevel so records stay at correct positions
    return (BASE_DAY_HEIGHT_PX - mins) * zoomLevel;
  };

  const getTopFromMins = (mins) => (BASE_DAY_HEIGHT_PX - mins) * zoomLevel;

  const getMinutesFromPointer = (rect, clientY) => {
    const relative = Math.min(Math.max(clientY - rect.top, 0), rect.height);
    // Invert: top of container = 23:59, bottom = 00:00
    // Scale back by zoomLevel to get actual minutes
    const mins = BASE_DAY_HEIGHT_PX - (relative / zoomLevel);
    return Math.round(mins);
  };

  const formatDurationHM = (minutesTotal) => {
    const total = Math.max(0, Math.round(minutesTotal));
    const h = Math.floor(total / 60);
    const m = total % 60;
    return `${h}:${String(m).padStart(2, '0')}`;
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
    [zoomLevel]
  );

  const getDayFromPointer = (clientY) => {
    if (!dayRefs.current.length) return null;
    for (let i = 0; i < dayRefs.current.length; i += 1) {
      const ref = dayRefs.current[i]?.current;
      if (!ref) continue;
      const rect = ref.getBoundingClientRect();
      if (clientY >= rect.top && clientY <= rect.bottom) {
        return { day: sortedDays[i], rect };
      }
    }
    return null;
  };

  const updateSelectionFromPointer = (clientY) => {
    const target = getDayFromPointer(clientY);
    if (!target) return;
    const mins = getMinutesFromPointer(target.rect, clientY);
    const selectedDate = new Date(target.day.date);
    selectedDate.setHours(Math.floor(mins / 60), mins % 60, 0, 0);
    setSelectedLine({ date: target.day.date, mins });
    onTimeSelected(selectedDate);
  };

  const handlePointerMove = (e) => {
    if (!e.clientY) return;
    if (isPointerDown.current) {
      updateSelectionFromPointer(e.clientY);
    }
  };

  const handlePointerDown = (e) => {
    isPointerDown.current = true;
    updateSelectionFromPointer(e.clientY);
  };

  const handlePointerUp = () => {
    isPointerDown.current = false;
  };

  useEffect(() => {
    const handleWindowUp = () => {
      isPointerDown.current = false;
    };
    window.addEventListener('pointerup', handleWindowUp);
    window.addEventListener('pointercancel', handleWindowUp);
    return () => {
      window.removeEventListener('pointerup', handleWindowUp);
      window.removeEventListener('pointercancel', handleWindowUp);
    };
  }, []);

  const zoomIn = () => {
    const currentIndex = ZOOM_LEVELS.findIndex(z => z.value === zoomLevel);
    if (currentIndex < ZOOM_LEVELS.length - 1) {
      setZoomLevel(ZOOM_LEVELS[currentIndex + 1].value);
    }
  };

  const zoomOut = () => {
    const currentIndex = ZOOM_LEVELS.findIndex(z => z.value === zoomLevel);
    if (currentIndex > 0) {
      setZoomLevel(ZOOM_LEVELS[currentIndex - 1].value);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Zoom Controls */}
      <div className="flex items-center justify-center gap-2 py-2 px-4 bg-surface-1/80 backdrop-blur-sm border-b border-surface-2/50">
        <button
          onClick={zoomOut}
          disabled={zoomLevel <= 0.5}
          className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 disabled:opacity-30 enabled:hover:bg-surface-2/50"
          style={{ color: 'var(--text-primary)' }}
        >
          −
        </button>
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--text-secondary)' }}>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
          </svg>
          <select
            value={zoomLevel}
            onChange={(e) => setZoomLevel(parseFloat(e.target.value))}
            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-surface-2/50 border border-surface-3/50 outline-none cursor-pointer transition-all duration-200 hover:border-surface-3"
            style={{ color: 'var(--add-btn-text)', background: 'var(--add-btn-bg)', border-color: 'var(--add-btn-border)',  minWidth: '70px' }}
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
          className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 disabled:opacity-30 enabled:hover:bg-surface-2/50"
          style={{ color: 'var(--text-primary)' }}
        >
          +
        </button>
        <span className="text-xs font-medium ml-2" style={{ color: 'var(--text-secondary)', opacity: 0.7 }}>
          {Math.round(zoomLevel * 100)}%
        </span>
      </div>

      <div
        ref={scrollRef}
        className="flex-grow overflow-y-auto custom-scrollbar px-5 pb-20"
        onClick={() => onSelectIntake(null)}
        onScroll={updateCurrentDayHeading}
        onPointerMove={handlePointerMove}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
      >
        <div className="relative">
          {/* Gaps: time passed between adjacent intakes across the whole timeline (AH left, EI right) */}
          <div className="absolute inset-0 pointer-events-none z-0">
            {(() => {
              const dayIndexByStartMs = new Map(sortedDays.map((d, idx) => [d.date.getTime(), idx]));

              const buildPatientItems = (patientId) =>
                intakes
                  .filter((i) => i.patientId === patientId)
                  .filter((i) => i.timestamp instanceof Date)
                  .slice()
                  .sort((a, b) => b.timestamp - a.timestamp);

              const commonStyle = {
                color: 'var(--text-secondary)',
                opacity: 0.22,
                fontSize: '32px',
                fontWeight: 500,
                letterSpacing: '0.02em',
                textShadow: '0 2px 0 rgba(0,0,0,0.08)'
              };

              const buildGapLabels = (patientId) => {
                const items = buildPatientItems(patientId);
                const labels = [];

                // Between each two intakes (even across different days)
                for (let idx = 0; idx < items.length - 1; idx += 1) {
                  const a = items[idx];
                  const b = items[idx + 1];
                  const y1 = getAbsoluteYWithinTimeline(dayIndexByStartMs, a.timestamp);
                  const y2 = getAbsoluteYWithinTimeline(dayIndexByStartMs, b.timestamp);
                  if (y1 == null || y2 == null) continue;
                  const minutesPassed = Math.abs((a.timestamp - b.timestamp) / 60000);
                  if (minutesPassed < 1) continue;
                  labels.push({
                    id: `${a.id}__${b.id}`,
                    y: (y1 + y2) / 2,
                    label: formatDurationHM(minutesPassed)
                  });
                }

                // Between last past intake and now
                const lastPast = items.find((i) => i.timestamp.getTime() <= currentTime.getTime());
                if (lastPast) {
                  const y1 = getAbsoluteYWithinTimeline(dayIndexByStartMs, currentTime);
                  const y2 = getAbsoluteYWithinTimeline(dayIndexByStartMs, lastPast.timestamp);
                  if (y1 != null && y2 != null) {
                    const minutesPassed = Math.abs((currentTime - lastPast.timestamp) / 60000);
                    if (minutesPassed >= 1) {
                      labels.push({
                        id: `${lastPast.id}__now`,
                        y: (y1 + y2) / 2,
                        label: formatDurationHM(minutesPassed)
                      });
                    }
                  }
                }

                return labels;
              };

              const ahLabels = buildGapLabels('AH');
              const eiLabels = buildGapLabels('EI');

              return (
                <>
                  {/* AH labels on left side (left of left line) */}
                  {ahLabels.map((g) => (
                    <div
                      key={`ah-gap-${g.id}`}
                      className="absolute whitespace-nowrap"
                      style={{
                        top: `${g.y}px`,
                        transform: 'translateY(-50%)',
                        left: 'calc(50% - 120px)',
                        ...commonStyle
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
                        transform: 'translateY(-50%)',
                        right: 'calc(50% - 120px)',
                        left: 'auto',
                        ...commonStyle
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
                background: 'transparent'
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

                  const tickWidth = 4;// * zoomLevel;
                  const tickOffset = 0;
                  const labelOffset = tickOffset + 20;

                  return (
                    <>
                      {markers.map(({ mins, hour, min, showLabel }) => {
                        const top = getTimeTop(new Date(day.date.getTime() + mins * 60000));
                        return (
                          <div key={mins} className="absolute flex items-center" style={{ top: `${top}px`, transform: 'translateY(-50%)', left: '50%', width: '0', height: '0' }}>
                            {/* Left tick (for left line) */}
                            <div 
                              className="h-px absolute"
                              style={{ 
                                background: 'var(--marker-color)', 
                                opacity: showLabel ? 0.8 : 0.5,
                                width: `${showLabel ? tickWidth : tickWidth * 0.8}px`,
                                right: `calc(50% + ${tickOffset}px)`
                              }} 
                            />
                            {/* Right tick (for right line) */}
                            <div 
                              className="h-px absolute"
                              style={{ 
                                background: 'var(--marker-color)', 
                                opacity: showLabel ? 0.8 : 0.5,
                                width: `${showLabel ? tickWidth : tickWidth * 0.8}px`,
                                left: `calc(50% + ${tickOffset}px)`
                              }} 
                            />
                            {showLabel && (
                              <>
                                <span
                                  className="absolute text-[10px]"
                                  style={{ 
                                    color: 'var(--marker-color)', 
                                    opacity: 0.4,
                                    right: `calc(50% + ${labelOffset}px)`
                                  }}
                                >
                                  {String(hour).padStart(2, '0')}:{String(min).padStart(2, '0')}
                                </span>
                                <span
                                  className="absolute text-[10px]"
                                  style={{
                                    color: 'var(--marker-color)', 
                                    opacity: 0.4,
                                    left: `calc(50% + ${labelOffset}px)`
                                  }}
                                >
                                  {String(hour).padStart(2, '0')}:{String(min).padStart(2, '0')}
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
                  left: 'calc(50% - 10px)',
                  width: '2px'
                }}
              >
                <div
                  className="absolute inset-y-0 rounded-full"
                  style={{ 
                    width: '2px', 
                    background: 'var(--timeline-line)', 
                    opacity: 0.6
                  }}
                />
              </div>
              {/* Right Line - EI */}
              <div
                className="absolute top-6 bottom-6 z-0"
                style={{ 
                  left: 'calc(50% + 10px)',
                  width: '2px'
                }}
              >
                <div
                  className="absolute inset-y-0 rounded-full"
                  style={{ 
                    width: '2px', 
                    background: 'var(--timeline-line)', 
                    opacity: 0.6
                  }}
                />
              </div>

              {/* Current Time Line */}
              {getStartOfDay(currentTime).getTime() === day.date.getTime() && (
                <div 
                  className="absolute left-0 right-0 z-10 pointer-events-none" 
                  style={{ top: `${getTimeTop(currentTime)}px`, transform: 'translateY(-50%)' }}
                >
                  {/* Left marker */}
                  <div 
                    className="absolute h-px"
                    style={{ 
                      background: 'var(--accent-ah)',
                      width: 'calc(50% - 60px)',
                      right: 'calc(50% - 60px)',
                      opacity: 0.5
                    }} 
                  />
                  {/* Center dot */}
                  <div 
                    className="absolute w-2.5 h-2.5 rounded-full"
                    style={{ 
                      background: 'var(--accent-ah)',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      boxShadow: '0 0 5px var(--glow-light)'
                    }}
                  />
                  {/* Right marker */}
                  <div 
                    className="absolute h-px"
                    style={{ 
                      background: 'var(--accent-ah)',
                      width: 'calc(50% - 60px)',
                      left: 'calc(50% - 60px)',
                      opacity: 0.5
                    }} 
                  />
                  {/* Time label */}
                  <div 
                    className="absolute left-1/2 -translate-x-1/2 -top-5 px-2 py-0.5 rounded text-[9px] font-bold whitespace-nowrap"
                    style={{ 
                      color: 'var(--accent-ah)',
                      background: 'color-mix(in srgb, var(--surface) 85%, transparent)',
                      boxShadow: '0 2px 8px var(--shadow-color)'
                    }}
                  >
                    {formatTime(currentTime)}
                  </div>
                </div>
              )}

              {/* Selected Time Line */}
              {isSelectingTime &&
                effectiveSelectedLine &&
                effectiveSelectedLine.date.getTime() === day.date.getTime() && (
                <div
                  className="absolute left-0 right-0 z-10 pointer-events-none"
                  style={{ top: `${getTopFromMins(effectiveSelectedLine.mins)}px`, transform: 'translateY(-50%)' }}
                >
                  <div 
                    className="w-full h-px" 
                    style={{ 
                      background: 'var(--accent-ei)', 
                      opacity: 0.75,
                      boxShadow: '0 0 15px var(--glow-light)'
                    }} 
                  />
                  <div
                    className="absolute left-1/2 -translate-x-1/2 -top-4 px-4 py-1 rounded-full text-[10px] font-black"
                    style={{
                      color: 'var(--text-primary)',
                      background: 'color-mix(in srgb, var(--success-color) 42%, transparent)',
                      border: '1px solid color-mix(in srgb, var(--success-color) 55%, transparent)',
                      boxShadow: '0 10px 24px var(--shadow-color)'
                    }}
                  >
                    {formatTime(new Date(day.date.getTime() + effectiveSelectedLine.mins * 60000))}
                  </div>
                </div>
              )}

              {/* Intakes */}
              <div className="absolute inset-0 z-20">
                {day.intakes.map((intake) => {
                  const isAH = intake.patientId === 'AH';
                  const isSelected = selectedId === intake.id;
                  const top = getTimeTop(intake.timestamp);
                  const subtype = intake.subtype;

                  const mainAccent = isAH ? 'var(--accent-ah)' : 'var(--accent-ei)';
                  const bubbleBg = isAH
                    ? 'color-mix(in srgb, var(--accent-ah) 9%, transparent)'
                    : 'color-mix(in srgb, var(--accent-ei) 9%, transparent)';

                  // Get subtype-specific colors and effects
                  const subtypeColor = SUBTYPE_COLORS[subtype] || 'var(--text-secondary)';
                  const subtypeGlow = SUBTYPE_GLOWS[subtype] || 'none';
                  const subtypeBorderColor = SUBTYPE_BORDER_COLORS[subtype] || 'rgba(255,255,255,0.55)';

                  return (
                    <div
                      key={intake.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectIntake(isSelected ? null : intake);
                      }}
                      className={`absolute flex items-center transition-all duration-200 cursor-pointer ${
                        // AH on left of left line, EI on right of right line
                        !isAH ? 'left-1/2 -ml-[9px] pr-5 justify-end' : 'right-1/2 -mr-[9px] pl-5 justify-start'
                      } ${selectedId && !isSelected ? 'opacity-30' : 'opacity-100'}`}
                      style={{ 
                        top: `${top}px`, 
                        transform: 'translateY(-50%)', 
                        width: '10em',
                      }}
                    >
                      {/* Connector dot with glow - positioned on the line */}
                      <div
                        className={`absolute w-3 h-3 rounded-full border-2 z-10 ${
                          // AH dots on left line (right side of AH card, touching left vertical line)
                          // EI dots on right line (left side of EI card, touching right vertical line)
                          !isAH ? 'left-[13px]' : 'right-[11px]'
                        }`}
                        style={{
                          //background: isAH ? 'var(--accent-ah)' : 'var(--accent-ei)', 
			  background: subtype ? subtypeColor : 'var(--text-secondary)',
                          borderColor: subtype ? subtypeColor : 'var(--text-secondary)',
                          opacity: 1,
                          // borderColor: 'var(--surface)',
                          //boxShadow: `0 0 1px var(--glow-light)`
                        }}
                      />
                      {/* Colored Frame/Border for Subtype */}
                  
                      <div
                        className="px-3 py-2 rounded-2xl border relative"
                        style={{
                          background: bubbleBg,
                          borderColor: subtype ? subtypeBorderColor : 'rgba(255,255,255,0.55)',
                          boxShadow: isSelected 
                            ? `0 18px 44px var(--shadow-color-strong), 0 0 20px var(--glow-light)`
                            : '0 5px 22px var(--shadow-color), 0 0 10px var(--glow-dark)',
                          transform: isSelected ? 'scale(1.09)' : 'scale(1)',
                          backdropFilter: 'blur(8px)'
                        }}
                      >
                        <div className="flex items-center gap-1">
                          <span className="text-sm font-black" style={{ color: 'var(--text-primary)' }}>
                            {intake.dosage}
                          </span>
                          <span className="text-[10px] font-black" style={{ color: 'var(--text-secondary)', opacity: 0.7 }}>
                            {intake.unit}
                          </span>
                          <span className="text-[10px] font-semibold" style={{ color: 'var(--text-secondary)', opacity: 0.6 }}>
                            {formatTime(intake.timestamp)}
                          </span>
                          
                          {subtype && (
                            <span
                              className={`absolute inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-black z-0 ${
                                isAH ? 'left-[-2px] ml-[-17px] top-[-5px]' : 'right-[-2px] mr-[-10px] top-[-5px]'
                              }`}
                              style={{ 
                                backgroundColor: subtypeColor, 
                                color: 'white',
                                opacity: 0.9,
                                borderRadius: 100,
                                transform: (isAH && (subtype == 'IV+PO' || subtype == 'VTRK')) ? 'rotate(-45deg)' : 
                                (!isAH && (subtype == 'IV+PO' || subtype == 'VTRK')) ? 'rotate(45deg)' : 
                                'rotate(0deg)',
                                boxShadow: subtypeGlow !== 'none' ? `0 0 10px ${subtypeColor}` : 'none'
                              }}
                            >
                              {subtype}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="absolute top-3 left-0 right-0 flex justify-center pointer-events-none z-30">
                <span
                  className="px-3 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest"
                  style={{ 
                    background: 'transparent', 
                    color: 'var(--text-secondary)', 
                    opacity: 0.75
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
