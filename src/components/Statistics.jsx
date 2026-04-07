import { useState, useEffect, useMemo } from "react";
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
  ScatterChart,
  Scatter,
  ReferenceLine,
} from "recharts";
import { collection, query, orderBy, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import {
  FaArrowLeft,
  FaSyringe,
  FaChartLine,
  FaClock,
  FaHourglassHalf,
  FaDroplet,
  FaFire,
  FaCalendarCheck,
  FaBullseye,
  FaArrowTrendUp,
} from "react-icons/fa6";

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884d8"];

const SUBTYPE_COLORS = {
  IV: "var(--subtype-iv)",
  IM: "var(--subtype-im)",
  PO: "var(--subtype-po)",
  "IV+PO": "var(--subtype-ivpo)",
  VTRK: "var(--subtype-vtrk)",
};

const DAY_NAMES = ["Нд", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];

const convertToMg = (dosage, unit) => {
  if (unit === "ml") {
    return dosage * 20;
  }
  return dosage;
};

const formatHour = (hour) => {
  return `${String(hour).padStart(2, "0")}:00`;
};

/**
 * Calculate average interval between consecutive intakes for a single patient.
 * Filters out gaps > 48h (missed days) to get realistic dosing intervals.
 * Returns formatted string like "4.2" (hours) or null if not enough data.
 */
const calculateIntervals = (intakes) => {
  if (intakes.length < 2) return null;

  const sorted = [...intakes].sort((a, b) => a.timestamp - b.timestamp);
  let totalDiff = 0;
  let count = 0;

  for (let i = 1; i < sorted.length; i++) {
    const diffMs = sorted[i].timestamp - sorted[i - 1].timestamp;
    const diffHours = diffMs / (1000 * 60 * 60);
    if (diffHours <= 48) {
      totalDiff += diffMs;
      count++;
    }
  }

  if (count === 0) return null;
  const avgMs = totalDiff / count;
  const avgHours = avgMs / (1000 * 60 * 60);
  return avgHours.toFixed(1);
};

/**
 * Build array of {index, hours, date} for each consecutive interval
 * between intakes of a single patient (gaps > 48h excluded).
 */
const buildIntervalHistory = (intakes) => {
  if (intakes.length < 2) return [];
  const sorted = [...intakes].sort((a, b) => a.timestamp - b.timestamp);
  const result = [];
  for (let i = 1; i < sorted.length; i++) {
    const diffMs = sorted[i].timestamp - sorted[i - 1].timestamp;
    const diffHours = diffMs / (1000 * 60 * 60);
    if (diffHours <= 48) {
      result.push({
        index: result.length + 1,
        hours: parseFloat(diffHours.toFixed(2)),
        date: sorted[i].timestamp,
        label: sorted[i].timestamp.toLocaleDateString("uk-UA", {
          day: "2-digit",
          month: "2-digit",
        }),
      });
    }
  }
  return result;
};

/**
 * Format a relative time string for "last dose" display.
 */
const formatLastDose = (date) => {
  if (!date) return null;
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.round(diffMs / 60000);
  if (diffMins < 60) return `${diffMins} хв тому`;
  const diffHours = diffMs / (1000 * 60 * 60);
  if (diffHours < 24) return `${diffHours.toFixed(1)} год тому`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} дн тому`;
};

/**
 * Calculate active day streak ending today.
 */
const calculateStreak = (chartData) => {
  const sorted = [...chartData].sort((a, b) =>
    b.fullDate.localeCompare(a.fullDate),
  );
  let streak = 0;
  const today = new Date();
  for (let i = 0; i < sorted.length; i++) {
    const expected = new Date(today);
    expected.setDate(today.getDate() - i);
    const expectedKey = `${expected.getFullYear()}-${String(expected.getMonth() + 1).padStart(2, "0")}-${String(expected.getDate()).padStart(2, "0")}`;
    const day = sorted.find((d) => d.fullDate === expectedKey);
    if (day && (day.AH > 0 || day.EI > 0)) {
      streak++;
    } else {
      break;
    }
  }
  return streak;
};

/**
 * Consistency score: % of days in range that had at least one intake (combined)
 */
const calculateConsistency = (chartData) => {
  if (!chartData.length) return 0;
  const activeDays = chartData.filter((d) => d.AH > 0 || d.EI > 0).length;
  return Math.round((activeDays / chartData.length) * 100);
};

const calculateStats = (rawIntakes, daysToShow) => {
  if (!rawIntakes.length) return null;

  const intakes = rawIntakes.filter(
    (i) => i.patientId !== "NO" && i.subtype !== "LOST",
  );
  if (!intakes.length) return null;

  const now = new Date();

  // -- LAST 24H STATS --
  const last24hStart = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const last24hIntakes = intakes.filter((i) => i.timestamp >= last24hStart);

  const last24hStats = {
    AH: { count: 0, mg: 0 },
    EI: { count: 0, mg: 0 },
    total: last24hIntakes.length,
  };
  last24hIntakes.forEach((i) => {
    const pid = i.patientId || "AH";
    if (!last24hStats[pid]) return;
    const mg = convertToMg(parseFloat(i.dosage) || 0, i.unit || "mg");
    last24hStats[pid].count++;
    last24hStats[pid].mg += mg;
  });

  // -- MAIN RANGE STATS --
  const startDate = new Date(now);
  startDate.setDate(now.getDate() - daysToShow + 1);
  startDate.setHours(0, 0, 0, 0);

  const filteredIntakes = intakes.filter(
    (intake) => intake.timestamp >= startDate,
  );

  if (filteredIntakes.length === 0) {
    return {
      chartData: [],
      hourlyData: Array(24)
        .fill(0)
        .map((_, i) => ({
          hour: i,
          label: formatHour(i),
          AH: 0,
          EI: 0,
          AH_mg: 0,
          EI_mg: 0,
        })),
      patientStats: {
        AH: {
          count: 0,
          mg: 0,
          subtypes: {},
          maxDailyMg: 0,
          lastDose: null,
          avgDailyMg: "0",
          avgDailyCount: "0.0",
          avgIntervalHours: null,
          maxSingleDoseMg: 0,
          intervalHistory: [],
          minIntervalHours: null,
          maxIntervalHours: null,
        },
        EI: {
          count: 0,
          mg: 0,
          subtypes: {},
          maxDailyMg: 0,
          lastDose: null,
          avgDailyMg: "0",
          avgDailyCount: "0.0",
          avgIntervalHours: null,
          maxSingleDoseMg: 0,
          intervalHistory: [],
          minIntervalHours: null,
          maxIntervalHours: null,
        },
      },
      last24hStats,
      pieData: { AH: [], EI: [] },
      totalIntakes: 0,
      weeklyHeatmap: [],
      cumulativeData: [],
      streak: 0,
      consistency: 0,
    };
  }

  // Initialize data structures
  const dailyData = {};
  const hourlyData = Array(24)
    .fill(0)
    .map((_, i) => ({
      hour: i,
      label: formatHour(i),
      AH: 0,
      EI: 0,
      AH_mg: 0,
      EI_mg: 0,
    }));

  // Weekly heatmap: day-of-week (0-6) × patient count
  const weeklyData = Array(7)
    .fill(0)
    .map((_, i) => ({
      day: DAY_NAMES[i],
      dayIndex: i,
      AH: 0,
      EI: 0,
    }));

  const patientStats = {
    AH: {
      count: 0,
      mg: 0,
      subtypes: {},
      maxDailyMg: 0,
      lastDose: null,
      intervals: [],
      maxSingleDoseMg: 0,
      pills10: 0,
      pills25: 0,
    },
    EI: {
      count: 0,
      mg: 0,
      subtypes: {},
      maxDailyMg: 0,
      lastDose: null,
      intervals: [],
      maxSingleDoseMg: 0,
      pills10: 0,
      pills25: 0,
    },
  };

  const getDayKey = (date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  };

  // Fill dailyData with empty entries for all days in range
  for (let i = 0; i < daysToShow; i++) {
    const d = new Date(startDate);
    d.setDate(d.getDate() + i);
    const key = getDayKey(d);
    dailyData[key] = {
      date: d.toLocaleDateString("uk-UA", { day: "2-digit", month: "2-digit" }),
      fullDate: key,
      AH: 0,
      EI: 0,
      AH_mg: 0,
      EI_mg: 0,
    };
  }

  // Process filtered intakes
  filteredIntakes.forEach((intake) => {
    const date = intake.timestamp;
    const key = getDayKey(date);
    const hour = date.getHours();
    const dow = date.getDay(); // 0=Sun..6=Sat
    const patientId = intake.patientId || "AH";
    const dosage = parseFloat(intake.dosage) || 0;
    const unit = intake.unit || "mg";
    const mg = convertToMg(dosage, unit);
    const subtype = intake.subtype || "PO";

    // Daily stats
    if (dailyData[key]) {
      dailyData[key][patientId] = (dailyData[key][patientId] || 0) + 1;
      dailyData[key][`${patientId}_mg`] =
        (dailyData[key][`${patientId}_mg`] || 0) + mg;
    }

    // Hourly stats
    if (hourlyData[hour]) {
      hourlyData[hour][patientId] += 1;
      hourlyData[hour][`${patientId}_mg`] += mg;
    }

    // Weekly heatmap
    weeklyData[dow][patientId] += 1;

    // Patient stats
    if (patientStats[patientId]) {
      patientStats[patientId].count += 1;
      patientStats[patientId].mg += mg;
      if (intake.pills10mg) patientStats[patientId].pills10 += intake.pills10mg / 10;
      if (intake.pills25mg) patientStats[patientId].pills25 += intake.pills25mg / 25;
      
      patientStats[patientId].subtypes[subtype] =
        (patientStats[patientId].subtypes[subtype] || 0) + 1;
      patientStats[patientId].intervals.push(intake);

      if (mg > patientStats[patientId].maxSingleDoseMg) {
        patientStats[patientId].maxSingleDoseMg = mg;
      }

      if (
        !patientStats[patientId].lastDose ||
        date > patientStats[patientId].lastDose
      ) {
        patientStats[patientId].lastDose = date;
      }
    }
  });

  // Build sorted chart array
  const chartData = Object.values(dailyData).sort((a, b) =>
    a.fullDate.localeCompare(b.fullDate),
  );

  // Cumulative data (running total of mg per patient)
  let cumAH = 0;
  let cumEI = 0;
  const cumulativeData = chartData.map((day) => {
    cumAH += day.AH_mg;
    cumEI += day.EI_mg;
    return {
      date: day.date,
      fullDate: day.fullDate,
      AH_cum: Math.round(cumAH),
      EI_cum: Math.round(cumEI),
    };
  });

  // Calculate max daily mg per patient
  chartData.forEach((day) => {
    ["AH", "EI"].forEach((pid) => {
      if (day[`${pid}_mg`] > patientStats[pid].maxDailyMg) {
        patientStats[pid].maxDailyMg = day[`${pid}_mg`];
      }
    });
  });

  // Streak and consistency
  const streak = calculateStreak(chartData);
  const consistency = calculateConsistency(chartData);

  // Averages and interval analysis
  ["AH", "EI"].forEach((pid) => {
    const ps = patientStats[pid];
    const daysWithData = chartData.filter((d) => d[pid] > 0).length;
    const effectiveDays = Math.max(1, daysWithData);

    ps.avgDailyMg = (ps.mg / effectiveDays).toFixed(0);
    ps.avgDailyCount = (ps.count / effectiveDays).toFixed(1);
    ps.avgIntervalHours = calculateIntervals(ps.intervals);

    // Per-interval history for chart
    ps.intervalHistory = buildIntervalHistory(ps.intervals);

    // Min/max interval (excluding outliers >48h, already filtered in buildIntervalHistory)
    if (ps.intervalHistory.length > 0) {
      const hrs = ps.intervalHistory.map((x) => x.hours);
      ps.minIntervalHours = Math.min(...hrs).toFixed(1);
      ps.maxIntervalHours = Math.max(...hrs).toFixed(1);
    } else {
      ps.minIntervalHours = null;
      ps.maxIntervalHours = null;
    }
  });

  const getPieData = (subtypes) => {
    return Object.entries(subtypes)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  };

  return {
    chartData,
    hourlyData,
    patientStats,
    last24hStats,
    pieData: {
      AH: getPieData(patientStats.AH.subtypes),
      EI: getPieData(patientStats.EI.subtypes),
    },
    totalIntakes: filteredIntakes.length,
    weeklyHeatmap: weeklyData,
    cumulativeData,
    streak,
    consistency,
  };
};

const StatCard = ({ title, value, subtext, icon: Icon, color }) => (
  <div
    className="rounded-2xl border border-[var(--border)] relative overflow-hidden hover:scale-[1.02] transition-transform animate-in fade-in zoom-in duration-300"
    style={{ background: "var(--surface)", padding: 12 }}
  >
    <div className="flex justify-between items-start" style={{ marginBottom: 10 }}>
      <div style={{ padding: 6, borderRadius: 10, background: `${color}22` }}>
        <Icon style={{ width: 14, height: 14, color }} />
      </div>
    </div>
    <div style={{ fontSize: 22, fontWeight: 900, color: "var(--text-primary)", marginBottom: 4, fontVariantNumeric: "tabular-nums" }}>
      {value}
    </div>
    <div style={{ fontSize: 9, fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.12em" }}>
      {title}
    </div>
    {subtext && (
      <div style={{ fontSize: 9, color: "var(--text-secondary)", marginTop: 4, opacity: 0.6 }}>
        {subtext}
      </div>
    )}
    <div
      className="absolute" style={{ bottom: -24, right: -24, width: 80, height: 80, borderRadius: "50%", opacity: 0.06, background: color }}
    />
  </div>
);

const SectionTitle = ({ icon: Icon, children }) => (
  <h3 style={{ fontSize: 9, fontWeight: 900, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.3em", marginBottom: 16, display: "flex", alignItems: "center", gap: 6 }}>
    <Icon style={{ opacity: 0.7, width: 12, height: 12 }} />
    {children}
  </h3>
);

const ChartCard = ({ children, delay = 0, className = "" }) => (
  <div
    className={`rounded-3xl border border-[var(--border)] animate-in fade-in slide-in-from-bottom-8 duration-700 ${className}`}
    style={{
      background: "var(--surface)",
      animationDelay: `${delay}ms`,
      padding: 16,
    }}
  >
    {children}
  </div>
);

const commonTooltipStyle = {
  background: "var(--surface-2)",
  border: "1px solid var(--border)",
  borderRadius: "12px",
  boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
  fontSize: "12px",
};

const commonAxisStyle = {
  stroke: "var(--text-secondary)",
  tick: { fill: "var(--text-secondary)", fontSize: 9 },
  tickLine: false,
  axisLine: false,
};

export default function Statistics({ onBack }) {
  const [intakes, setIntakes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState("7");

  useEffect(() => {
    const q = query(collection(db, "intakes"), orderBy("timestamp", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setIntakes(
        snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
          timestamp: doc.data().timestamp?.toDate() || new Date(),
        })),
      );
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const stats = useMemo(
    () => calculateStats(intakes, parseInt(dateRange)),
    [intakes, dateRange],
  );

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <div className="loading-spinner" />
        <div className="text-[var(--text-secondary)] font-medium text-sm">
          Завантаження...
        </div>
      </div>
    );
  }

  if (!stats || stats.totalIntakes === 0) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex-1 flex flex-col items-center justify-center text-center p-8 opacity-60">
          <FaChartLine className="w-14 h-14 mb-4 text-[var(--text-secondary)]" />
          <h3 className="text-xl font-bold text-[var(--text-primary)]">
            Немає даних
          </h3>
          <p className="text-sm text-[var(--text-secondary)] mt-2">
            Додайте записи, щоб побачити статистику
          </p>
        </div>
      </div>
    );
  }

  const {
    patientStats,
    last24hStats,
    chartData,
    hourlyData,
    pieData,
    weeklyHeatmap,
    cumulativeData,
    streak,
    consistency,
  } = stats;

  const avgIntervalNum = (pid) =>
    patientStats[pid].avgIntervalHours != null
      ? parseFloat(patientStats[pid].avgIntervalHours)
      : null;

  // Merge AH + EI interval histories for combined chart, keeping patient label
  const mergedIntervalHistory = [
    ...patientStats.AH.intervalHistory.map((d) => ({
      ...d,
      patient: "AH",
      AH_hours: d.hours,
      EI_hours: null,
    })),
    ...patientStats.EI.intervalHistory.map((d) => ({
      ...d,
      patient: "EI",
      AH_hours: null,
      EI_hours: d.hours,
    })),
  ].sort((a, b) => a.date - b.date);

  // Build per-day interval for each patient separately for line chart
  // We'll use two separate line datasets overlaid
  const ahIntervals = patientStats.AH.intervalHistory;
  const eiIntervals = patientStats.EI.intervalHistory;

  return (
    <div className="flex flex-col" style={{ gap: 16, paddingBottom: 32 }}>
      {/* Date Range Selector */}
      <div className="flex items-center justify-between" style={{ gap: 8 }}>
        <div
          className="flex"
          style={{ gap: 3, padding: 3, borderRadius: 14, border: "1px solid var(--border)", background: "var(--surface)" }}
        >
          {[
            { v: "3", label: "3д" },
            { v: "7", label: "7д" },
            { v: "14", label: "14д" },
            { v: "30", label: "30д" },
            { v: "90", label: "90д" },
          ].map(({ v, label }) => (
            <button
              key={v}
              onClick={() => setDateRange(v)}
              className="transition-all duration-200 btn-mobile"
              style={{
                padding: "5px 10px",
                borderRadius: 10,
                fontSize: 11,
                fontWeight: 700,
                background:
                  dateRange === v ? "var(--accent-primary)" : "transparent",
                color: dateRange === v ? "#fff" : "var(--text-secondary)",
              }}
            >
              {label}
            </button>
          ))}
        </div>
        <span style={{ fontSize: 11, color: "var(--text-secondary)", fontWeight: 600, opacity: 0.6, whiteSpace: "nowrap" }}>
          {stats.totalIntakes} пр.
        </span>
      </div>

      {/* Last 24 Hours */}
      <div
        className="rounded-3xl border border-[var(--border)] animate-in fade-in slide-in-from-bottom-4 duration-500"
        style={{ background: "var(--surface)", padding: 14 }}
      >
        <h3 style={{ fontSize: 9, fontWeight: 900, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.3em", marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
          <FaClock style={{ opacity: 0.7, width: 12, height: 12 }} />
          Останні 24 години
        </h3>
        <div className="grid grid-cols-2" style={{ gap: 10 }}>
          {["AH", "EI"].map((pid) => (
            <div
              key={pid}
              className="rounded-2xl border border-[var(--border)] text-center"
              style={{ background: "var(--surface-2)", padding: 10 }}
            >
              <div
                style={{ fontSize: 9, fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: 6, color: `var(--accent-${pid.toLowerCase()})` }}
              >
                {pid === "AH" ? "P1" : "P2"}
              </div>
              <div
                style={{ fontSize: 26, fontWeight: 900, fontVariantNumeric: "tabular-nums", color: `var(--accent-${pid.toLowerCase()})` }}
              >
                {last24hStats[pid].mg.toFixed(0)}
                <span
                  style={{ fontSize: 11, fontWeight: 500, marginLeft: 3, color: "var(--text-secondary)" }}
                >
                  мг
                </span>
              </div>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", opacity: 0.6, marginTop: 4 }}>
                {last24hStats[pid].count} пр.
              </div>
              {patientStats[pid].lastDose && (
                <div style={{ fontSize: 9, color: "var(--text-secondary)", opacity: 0.5, marginTop: 2 }}>
                  {formatLastDose(patientStats[pid].lastDose)}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Summary Stats Grid — row 1: intervals */}
      <div className="grid grid-cols-2" style={{ gap: 10 }}>
        <StatCard
          title="Сер. інтервал P1"
          value={
            patientStats.AH.avgIntervalHours != null
              ? `${patientStats.AH.avgIntervalHours} год`
              : "—"
          }
          subtext={
            patientStats.AH.minIntervalHours != null
              ? `мін ${patientStats.AH.minIntervalHours} / макс ${patientStats.AH.maxIntervalHours} год`
              : "Недостатньо даних"
          }
          icon={FaHourglassHalf}
          color="var(--accent-ah)"
        />
        <StatCard
          title="Сер. інтервал P2"
          value={
            patientStats.EI.avgIntervalHours != null
              ? `${patientStats.EI.avgIntervalHours} год`
              : "—"
          }
          subtext={
            patientStats.EI.minIntervalHours != null
              ? `мін ${patientStats.EI.minIntervalHours} / макс ${patientStats.EI.maxIntervalHours} год`
              : "Недостатньо даних"
          }
          icon={FaHourglassHalf}
          color="var(--accent-ei)"
        />
        <StatCard
          title="Загалом мг P1"
          value={Math.round(patientStats.AH.mg)}
          subtext={patientStats.AH.pills10 > 0 || patientStats.AH.pills25 > 0 ? `${patientStats.AH.pills10}х10 + ${patientStats.AH.pills25}х25` : `~${patientStats.AH.avgDailyMg} мг/д`}
          icon={FaSyringe}
          color="var(--accent-ah)"
        />
        <StatCard
          title="Загалом мг P2"
          value={Math.round(patientStats.EI.mg)}
          subtext={patientStats.EI.pills10 > 0 || patientStats.EI.pills25 > 0 ? `${patientStats.EI.pills10}х10 + ${patientStats.EI.pills25}х25` : `~${patientStats.EI.avgDailyMg} мг/д`}
          icon={FaDroplet}
          color="var(--accent-ei)"
        />
      </div>

      {/* Summary Stats Grid — row 2: streak & consistency */}
      <div className="grid grid-cols-2" style={{ gap: 10 }}>
        <StatCard
          title="Серія активних дн."
          value={`${streak} дн`}
          subtext="Поспіль днів з прийомами"
          icon={FaFire}
          color="var(--accent-primary)"
        />
        <StatCard
          title="Регулярність"
          value={`${consistency}%`}
          subtext={`Днів з прийомами за ${dateRange}д`}
          icon={FaCalendarCheck}
          color="var(--accent-primary)"
        />
        <StatCard
          title="Прийомів/день P1"
          value={patientStats.AH.avgDailyCount}
          subtext={`Макс доб. ${Math.round(patientStats.AH.maxDailyMg)} мг`}
          icon={FaBullseye}
          color="var(--accent-ah)"
        />
        <StatCard
          title="Прийомів/день P2"
          value={patientStats.EI.avgDailyCount}
          subtext={`Макс доб. ${Math.round(patientStats.EI.maxDailyMg)} мг`}
          icon={FaBullseye}
          color="var(--accent-ei)"
        />
      </div>

      {/* Daily Dosage Area Chart */}
      <ChartCard delay={100}>
        <SectionTitle icon={FaChartLine}>Динаміка дозування (мг)</SectionTitle>
        <div className="h-[220px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={chartData}
              margin={{ top: 5, right: 5, left: -25, bottom: 0 }}
            >
              <defs>
                <linearGradient id="colorAH" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor="var(--accent-ah)"
                    stopOpacity={0.35}
                  />
                  <stop
                    offset="95%"
                    stopColor="var(--accent-ah)"
                    stopOpacity={0}
                  />
                </linearGradient>
                <linearGradient id="colorEI" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor="var(--accent-ei)"
                    stopOpacity={0.35}
                  />
                  <stop
                    offset="95%"
                    stopColor="var(--accent-ei)"
                    stopOpacity={0}
                  />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="var(--border)"
                vertical={false}
                opacity={0.5}
              />
              <XAxis
                dataKey="date"
                stroke="var(--text-secondary)"
                tick={{ fill: "var(--text-secondary)", fontSize: 9 }}
                tickLine={false}
                axisLine={false}
                dy={8}
                interval={Math.max(0, Math.floor(chartData.length / 6))}
              />
              <YAxis
                stroke="var(--text-secondary)"
                tick={{ fill: "var(--text-secondary)", fontSize: 9 }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                contentStyle={commonTooltipStyle}
                labelStyle={{
                  color: "var(--text-primary)",
                  fontWeight: "bold",
                  marginBottom: "4px",
                }}
                itemStyle={{ color: "var(--text-secondary)" }}
                cursor={{
                  stroke: "var(--text-secondary)",
                  strokeWidth: 1,
                  strokeDasharray: "4 4",
                  opacity: 0.5,
                }}
              />
              <Legend
                wrapperStyle={{
                  paddingTop: "16px",
                  fontSize: "11px",
                  color: "var(--text-secondary)",
                }}
              />
              <Area
                type="monotone"
                dataKey="AH_mg"
                name="P1 (мг)"
                stroke="var(--accent-ah)"
                fillOpacity={1}
                fill="url(#colorAH)"
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0 }}
                animationDuration={1000}
              />
              <Area
                type="monotone"
                dataKey="EI_mg"
                name="P2 (мг)"
                stroke="var(--accent-ei)"
                fillOpacity={1}
                fill="url(#colorEI)"
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0 }}
                animationDuration={1000}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>

      {/* Daily Intake Count Bar Chart */}
      <ChartCard delay={150}>
        <SectionTitle icon={FaSyringe}>Кількість прийомів по днях</SectionTitle>
        <div className="h-[180px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{ top: 5, right: 5, left: -25, bottom: 0 }}
              barCategoryGap="30%"
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="var(--border)"
                vertical={false}
                opacity={0.5}
              />
              <XAxis
                dataKey="date"
                stroke="var(--text-secondary)"
                tick={{ fill: "var(--text-secondary)", fontSize: 9 }}
                tickLine={false}
                axisLine={false}
                dy={8}
                interval={Math.max(0, Math.floor(chartData.length / 6))}
              />
              <YAxis
                stroke="var(--text-secondary)"
                tick={{ fill: "var(--text-secondary)", fontSize: 9 }}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
              />
              <Tooltip
                cursor={{ fill: "var(--border)", opacity: 0.15 }}
                contentStyle={commonTooltipStyle}
                labelStyle={{
                  color: "var(--text-primary)",
                  fontWeight: "bold",
                  marginBottom: "4px",
                }}
                itemStyle={{ color: "var(--text-secondary)" }}
              />
              <Legend
                wrapperStyle={{
                  paddingTop: "12px",
                  fontSize: "11px",
                  color: "var(--text-secondary)",
                }}
              />
              <Bar
                dataKey="AH"
                name="P1"
                fill="var(--accent-ah)"
                radius={[4, 4, 0, 0]}
                animationDuration={1000}
                fillOpacity={0.85}
              />
              <Bar
                dataKey="EI"
                name="P2"
                fill="var(--accent-ei)"
                radius={[4, 4, 0, 0]}
                animationDuration={1000}
                fillOpacity={0.85}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>

      {/* Interval History Line Chart */}
      {(ahIntervals.length >= 2 || eiIntervals.length >= 2) && (
        <ChartCard delay={200}>
          <SectionTitle icon={FaHourglassHalf}>
            Динаміка інтервалів між прийомами (год)
          </SectionTitle>
          <div className="grid grid-cols-1 gap-4">
            {/* AH intervals */}
            {ahIntervals.length >= 2 && (
              <div>
                <div
                  className="text-[10px] font-black uppercase tracking-widest mb-2 text-center"
                  style={{ color: "var(--accent-ah)" }}
                >
                  P1 — {ahIntervals.length} інтервалів · сер.{" "}
                  {patientStats.AH.avgIntervalHours} год
                </div>
                <div className="h-[140px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={ahIntervals}
                      margin={{ top: 5, right: 10, left: -25, bottom: 0 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="var(--border)"
                        vertical={false}
                        opacity={0.5}
                      />
                      <XAxis
                        dataKey="label"
                        stroke="var(--text-secondary)"
                        tick={{ fill: "var(--text-secondary)", fontSize: 8 }}
                        tickLine={false}
                        axisLine={false}
                        dy={6}
                        interval={Math.max(
                          0,
                          Math.floor(ahIntervals.length / 5),
                        )}
                      />
                      <YAxis
                        stroke="var(--text-secondary)"
                        tick={{ fill: "var(--text-secondary)", fontSize: 9 }}
                        tickLine={false}
                        axisLine={false}
                        unit="г"
                        domain={["auto", "auto"]}
                      />
                      <Tooltip
                        contentStyle={commonTooltipStyle}
                        labelStyle={{
                          color: "var(--text-primary)",
                          fontWeight: "bold",
                        }}
                        itemStyle={{ color: "var(--text-secondary)" }}
                        formatter={(val) => [`${val} год`, "Інтервал"]}
                      />
                      {patientStats.AH.avgIntervalHours != null && (
                        <ReferenceLine
                          y={parseFloat(patientStats.AH.avgIntervalHours)}
                          stroke="var(--accent-ah)"
                          strokeDasharray="5 3"
                          strokeOpacity={0.5}
                          strokeWidth={1.5}
                        />
                      )}
                      <Line
                        type="monotone"
                        dataKey="hours"
                        name="Інтервал"
                        stroke="var(--accent-ah)"
                        strokeWidth={2}
                        dot={{ r: 2.5, fill: "var(--accent-ah)", strokeWidth: 0 }}
                        activeDot={{ r: 5, strokeWidth: 0 }}
                        animationDuration={1000}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
            {/* EI intervals */}
            {eiIntervals.length >= 2 && (
              <div>
                <div
                  className="text-[10px] font-black uppercase tracking-widest mb-2 text-center"
                  style={{ color: "var(--accent-ei)" }}
                >
                  P2 — {eiIntervals.length} інтервалів · сер.{" "}
                  {patientStats.EI.avgIntervalHours} год
                </div>
                <div className="h-[140px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={eiIntervals}
                      margin={{ top: 5, right: 10, left: -25, bottom: 0 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="var(--border)"
                        vertical={false}
                        opacity={0.5}
                      />
                      <XAxis
                        dataKey="label"
                        stroke="var(--text-secondary)"
                        tick={{ fill: "var(--text-secondary)", fontSize: 8 }}
                        tickLine={false}
                        axisLine={false}
                        dy={6}
                        interval={Math.max(
                          0,
                          Math.floor(eiIntervals.length / 5),
                        )}
                      />
                      <YAxis
                        stroke="var(--text-secondary)"
                        tick={{ fill: "var(--text-secondary)", fontSize: 9 }}
                        tickLine={false}
                        axisLine={false}
                        unit="г"
                        domain={["auto", "auto"]}
                      />
                      <Tooltip
                        contentStyle={commonTooltipStyle}
                        labelStyle={{
                          color: "var(--text-primary)",
                          fontWeight: "bold",
                        }}
                        itemStyle={{ color: "var(--text-secondary)" }}
                        formatter={(val) => [`${val} год`, "Інтервал"]}
                      />
                      {patientStats.EI.avgIntervalHours != null && (
                        <ReferenceLine
                          y={parseFloat(patientStats.EI.avgIntervalHours)}
                          stroke="var(--accent-ei)"
                          strokeDasharray="5 3"
                          strokeOpacity={0.5}
                          strokeWidth={1.5}
                        />
                      )}
                      <Line
                        type="monotone"
                        dataKey="hours"
                        name="Інтервал"
                        stroke="var(--accent-ei)"
                        strokeWidth={2}
                        dot={{ r: 2.5, fill: "var(--accent-ei)", strokeWidth: 0 }}
                        activeDot={{ r: 5, strokeWidth: 0 }}
                        animationDuration={1000}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>
        </ChartCard>
      )}

      {/* Cumulative Dosage Chart */}
      <ChartCard delay={250}>
        <SectionTitle icon={FaArrowTrendUp}>
          Накопичене дозування (мг)
        </SectionTitle>
        <div className="h-[200px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={cumulativeData}
              margin={{ top: 5, right: 5, left: -20, bottom: 0 }}
            >
              <defs>
                <linearGradient id="cumAH" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor="var(--accent-ah)"
                    stopOpacity={0.25}
                  />
                  <stop
                    offset="95%"
                    stopColor="var(--accent-ah)"
                    stopOpacity={0}
                  />
                </linearGradient>
                <linearGradient id="cumEI" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor="var(--accent-ei)"
                    stopOpacity={0.25}
                  />
                  <stop
                    offset="95%"
                    stopColor="var(--accent-ei)"
                    stopOpacity={0}
                  />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="var(--border)"
                vertical={false}
                opacity={0.5}
              />
              <XAxis
                dataKey="date"
                stroke="var(--text-secondary)"
                tick={{ fill: "var(--text-secondary)", fontSize: 9 }}
                tickLine={false}
                axisLine={false}
                dy={8}
                interval={Math.max(0, Math.floor(cumulativeData.length / 6))}
              />
              <YAxis
                stroke="var(--text-secondary)"
                tick={{ fill: "var(--text-secondary)", fontSize: 9 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(1)}к` : v)}
              />
              <Tooltip
                contentStyle={commonTooltipStyle}
                labelStyle={{
                  color: "var(--text-primary)",
                  fontWeight: "bold",
                  marginBottom: "4px",
                }}
                itemStyle={{ color: "var(--text-secondary)" }}
                formatter={(val) => [`${val} мг`, ""]}
                cursor={{
                  stroke: "var(--text-secondary)",
                  strokeWidth: 1,
                  strokeDasharray: "4 4",
                  opacity: 0.5,
                }}
              />
              <Legend
                wrapperStyle={{
                  paddingTop: "16px",
                  fontSize: "11px",
                  color: "var(--text-secondary)",
                }}
              />
              <Area
                type="monotone"
                dataKey="AH_cum"
                name="P1 накоп."
                stroke="var(--accent-ah)"
                fill="url(#cumAH)"
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0 }}
                animationDuration={1200}
              />
              <Area
                type="monotone"
                dataKey="EI_cum"
                name="P2 накоп."
                stroke="var(--accent-ei)"
                fill="url(#cumEI)"
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0 }}
                animationDuration={1200}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>

      {/* Hourly Distribution */}
      <ChartCard delay={300}>
        <SectionTitle icon={FaClock}>Розподіл по годинах</SectionTitle>
        <div className="h-[180px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={hourlyData}
              margin={{ top: 5, right: 5, left: -25, bottom: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="var(--border)"
                vertical={false}
                opacity={0.5}
              />
              <XAxis
                dataKey="hour"
                stroke="var(--text-secondary)"
                tick={{ fill: "var(--text-secondary)", fontSize: 9 }}
                tickFormatter={(val) => (val % 6 === 0 ? formatHour(val) : "")}
                tickLine={false}
                axisLine={false}
                dy={8}
              />
              <YAxis
                stroke="var(--text-secondary)"
                tick={{ fill: "var(--text-secondary)", fontSize: 9 }}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
              />
              <Tooltip
                cursor={{ fill: "var(--border)", opacity: 0.15 }}
                contentStyle={commonTooltipStyle}
                labelFormatter={(val) =>
                  `${formatHour(val)} – ${formatHour(val + 1)}`
                }
                itemStyle={{ color: "var(--text-secondary)" }}
              />
              <Legend
                wrapperStyle={{
                  paddingTop: "12px",
                  fontSize: "11px",
                  color: "var(--text-secondary)",
                }}
              />
              <Bar
                dataKey="AH"
                name="P1"
                stackId="a"
                fill="var(--accent-ah)"
                radius={[0, 0, 3, 3]}
                animationDuration={1000}
                fillOpacity={0.85}
              />
              <Bar
                dataKey="EI"
                name="P2"
                stackId="a"
                fill="var(--accent-ei)"
                radius={[3, 3, 0, 0]}
                animationDuration={1000}
                fillOpacity={0.85}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>

      {/* Weekly Activity Pattern */}
      <ChartCard delay={350}>
        <SectionTitle icon={FaCalendarCheck}>
          Активність по днях тижня
        </SectionTitle>
        <div className="h-[180px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={weeklyHeatmap}
              margin={{ top: 5, right: 5, left: -25, bottom: 0 }}
              barCategoryGap="20%"
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="var(--border)"
                vertical={false}
                opacity={0.5}
              />
              <XAxis
                dataKey="day"
                stroke="var(--text-secondary)"
                tick={{ fill: "var(--text-secondary)", fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                dy={6}
              />
              <YAxis
                stroke="var(--text-secondary)"
                tick={{ fill: "var(--text-secondary)", fontSize: 9 }}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
              />
              <Tooltip
                cursor={{ fill: "var(--border)", opacity: 0.15 }}
                contentStyle={commonTooltipStyle}
                labelStyle={{
                  color: "var(--text-primary)",
                  fontWeight: "bold",
                  marginBottom: "4px",
                }}
                itemStyle={{ color: "var(--text-secondary)" }}
              />
              <Legend
                wrapperStyle={{
                  paddingTop: "12px",
                  fontSize: "11px",
                  color: "var(--text-secondary)",
                }}
              />
              <Bar
                dataKey="AH"
                name="P1"
                stackId="b"
                fill="var(--accent-ah)"
                radius={[0, 0, 3, 3]}
                animationDuration={1000}
                fillOpacity={0.85}
              />
              <Bar
                dataKey="EI"
                name="P2"
                stackId="b"
                fill="var(--accent-ei)"
                radius={[3, 3, 0, 0]}
                animationDuration={1000}
                fillOpacity={0.85}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>

      {/* Subtype Distribution */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {["AH", "EI"].map((pid, idx) => (
          <div
            key={pid}
            className="rounded-3xl p-5 border border-[var(--border)] animate-in fade-in slide-in-from-bottom-8 duration-700"
            style={{
              background: "var(--surface)",
              animationDelay: `${400 + idx * 100}ms`,
            }}
          >
            <h3
              className="text-[10px] font-black uppercase tracking-[0.3em] mb-4 text-center"
              style={{ color: `var(--accent-${pid.toLowerCase()})` }}
            >
              Типи прийому {pid === "AH" ? "P1" : "P2"}
            </h3>
            {pieData[pid].length === 0 ? (
              <div className="h-[140px] flex items-center justify-center text-[var(--text-secondary)] text-xs opacity-50">
                Немає даних
              </div>
            ) : (
              <>
                <div className="h-[140px] relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData[pid]}
                        cx="50%"
                        cy="50%"
                        innerRadius={38}
                        outerRadius={62}
                        paddingAngle={3}
                        dataKey="value"
                        stroke="none"
                        animationDuration={1000}
                      >
                        {pieData[pid].map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={
                              SUBTYPE_COLORS[entry.name] ||
                              COLORS[index % COLORS.length]
                            }
                            fillOpacity={0.9}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          background: "var(--surface-2)",
                          border: "1px solid var(--border)",
                          borderRadius: "10px",
                          fontSize: "12px",
                        }}
                        itemStyle={{ color: "var(--text-secondary)" }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  {/* Center count */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="text-center">
                      <span
                        className="text-2xl font-black tabular-nums"
                        style={{ color: `var(--accent-${pid.toLowerCase()})` }}
                      >
                        {patientStats[pid].count}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap justify-center gap-2 mt-3">
                  {pieData[pid].map((entry, index) => (
                    <div key={index} className="flex items-center gap-1.5">
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{
                          backgroundColor:
                            SUBTYPE_COLORS[entry.name] ||
                            COLORS[index % COLORS.length],
                        }}
                      />
                      <span className="text-[11px] font-semibold text-[var(--text-secondary)]">
                        {entry.name}{" "}
                        <span className="opacity-50">({entry.value})</span>
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
