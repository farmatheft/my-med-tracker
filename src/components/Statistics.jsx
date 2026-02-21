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
} from "react-icons/fa6";

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884d8"];

const SUBTYPE_COLORS = {
  IV: "var(--subtype-iv)",
  IM: "var(--subtype-im)",
  PO: "var(--subtype-po)",
  "IV+PO": "var(--subtype-ivpo)",
  VTRK: "var(--subtype-vtrk)",
};

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

  // Sort ascending by timestamp
  const sorted = [...intakes].sort((a, b) => a.timestamp - b.timestamp);
  let totalDiff = 0;
  let count = 0;

  for (let i = 1; i < sorted.length; i++) {
    const diffMs = sorted[i].timestamp - sorted[i - 1].timestamp;
    const diffHours = diffMs / (1000 * 60 * 60);
    // Filter out unrealistically large gaps (> 48h) — those represent missed days
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

const calculateStats = (rawIntakes, daysToShow) => {
  if (!rawIntakes.length) return null;

  // Filter out LOST records from all statistics
  const intakes = rawIntakes.filter(i => i.patientId !== "NO" && i.subtype !== "LOST");
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
  // Start of day N days ago (inclusive)
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
        .map((_, i) => ({ hour: i, label: formatHour(i), AH: 0, EI: 0, AH_mg: 0, EI_mg: 0 })),
      patientStats: {
        AH: { count: 0, mg: 0, subtypes: {}, maxDailyMg: 0, lastDose: null, avgDailyMg: "0", avgDailyCount: "0.0", avgIntervalHours: null },
        EI: { count: 0, mg: 0, subtypes: {}, maxDailyMg: 0, lastDose: null, avgDailyMg: "0", avgDailyCount: "0.0", avgIntervalHours: null },
      },
      last24hStats,
      pieData: { AH: [], EI: [] },
      totalIntakes: 0,
    };
  }

  // Initialize data structures
  const dailyData = {}; // Key: YYYY-MM-DD
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

  const patientStats = {
    AH: {
      count: 0,
      mg: 0,
      subtypes: {},
      maxDailyMg: 0,
      lastDose: null,
      intervals: [],
    },
    EI: {
      count: 0,
      mg: 0,
      subtypes: {},
      maxDailyMg: 0,
      lastDose: null,
      intervals: [],
    },
  };

  const getDayKey = (date) => {
    // Use local date parts to avoid UTC offset issues
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

    // Patient stats
    if (patientStats[patientId]) {
      patientStats[patientId].count += 1;
      patientStats[patientId].mg += mg;
      patientStats[patientId].subtypes[subtype] =
        (patientStats[patientId].subtypes[subtype] || 0) + 1;
      patientStats[patientId].intervals.push(intake);

      // Track most recent dose
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

  // Calculate max daily mg per patient
  chartData.forEach((day) => {
    ["AH", "EI"].forEach((pid) => {
      if (day[`${pid}_mg`] > patientStats[pid].maxDailyMg) {
        patientStats[pid].maxDailyMg = day[`${pid}_mg`];
      }
    });
  });

  // Calculate averages:
  // Use number of days that actually have intakes for a more meaningful average,
  // but allow dividing by daysToShow for "overall period" average.
  ["AH", "EI"].forEach((pid) => {
    const ps = patientStats[pid];

    // Count days with at least 1 intake for this patient
    const daysWithData = chartData.filter((d) => d[pid] > 0).length;
    const effectiveDays = Math.max(1, daysWithData);

    ps.avgDailyMg = (ps.mg / effectiveDays).toFixed(0);
    ps.avgDailyCount = (ps.count / effectiveDays).toFixed(1);
    ps.avgIntervalHours = calculateIntervals(ps.intervals);
  });

  // Format subtype data for pie charts
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
  };
};

const StatCard = ({ title, value, subtext, icon: Icon, color }) => (
  <div
    className="rounded-2xl p-4 border border-[var(--border)] relative overflow-hidden hover:scale-[1.02] transition-transform animate-in fade-in zoom-in duration-300"
    style={{ background: "var(--surface)" }}
  >
    <div className="flex justify-between items-start mb-3">
      <div className="p-2 rounded-xl" style={{ background: `${color}22` }}>
        <Icon className="w-4 h-4" style={{ color }} />
      </div>
    </div>
    <div className="text-2xl font-black text-[var(--text-primary)] mb-1 tabular-nums">
      {value}
    </div>
    <div className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">
      {title}
    </div>
    {subtext && (
      <div className="text-[10px] text-[var(--text-secondary)] mt-1 opacity-60">
        {subtext}
      </div>
    )}
    <div
      className="absolute -bottom-6 -right-6 w-20 h-20 rounded-full opacity-[0.06]"
      style={{ background: color }}
    />
  </div>
);

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

  const { patientStats, last24hStats, chartData, hourlyData, pieData } = stats;

  return (
    <div className="flex flex-col gap-5 pb-10">
      {/* Date Range Selector */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1 p-1 rounded-2xl border border-[var(--border)]" style={{ background: "var(--surface)" }}>
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
              className="px-3 py-1.5 rounded-xl text-xs font-bold transition-all duration-200"
              style={{
                background:
                  dateRange === v ? "var(--accent-primary)" : "transparent",
                color:
                  dateRange === v ? "#fff" : "var(--text-secondary)",
              }}
            >
              {label}
            </button>
          ))}
        </div>
        <span className="text-xs text-[var(--text-secondary)] font-semibold opacity-60">
          {stats.totalIntakes} прийомів
        </span>
      </div>

      {/* Last 24 Hours */}
      <div
        className="rounded-3xl p-4 border border-[var(--border)] animate-in fade-in slide-in-from-bottom-4 duration-500"
        style={{ background: "var(--surface)" }}
      >
        <h3 className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-[0.3em] mb-3 flex items-center gap-2">
          <FaClock className="opacity-70" />
          Останні 24 години
        </h3>
        <div className="grid grid-cols-2 gap-3">
          {["AH", "EI"].map((pid) => (
            <div
              key={pid}
              className="p-3 rounded-2xl border border-[var(--border)] text-center"
              style={{ background: "var(--surface-2)" }}
            >
              <div
                className="text-[10px] font-black uppercase tracking-widest mb-2"
                style={{ color: `var(--accent-${pid.toLowerCase()})` }}
              >
                {pid}
              </div>
              <div
                className="text-3xl font-black tabular-nums"
                style={{ color: `var(--accent-${pid.toLowerCase()})` }}
              >
                {last24hStats[pid].mg.toFixed(0)}
                <span
                  className="text-xs font-medium ml-1"
                  style={{ color: "var(--text-secondary)" }}
                >
                  мг
                </span>
              </div>
              <div className="text-xs font-semibold text-[var(--text-secondary)] opacity-60 mt-1">
                {last24hStats[pid].count} прийомів
              </div>
              {patientStats[pid].lastDose && (
                <div className="text-[10px] text-[var(--text-secondary)] opacity-50 mt-0.5">
                  {formatLastDose(patientStats[pid].lastDose)}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Summary Stats Grid */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard
          title="Середній інтервал AH"
          value={
            patientStats.AH.avgIntervalHours != null
              ? `${patientStats.AH.avgIntervalHours} год`
              : "—"
          }
          subtext={
            patientStats.AH.avgIntervalHours == null
              ? "Недостатньо даних"
              : "Між прийомами"
          }
          icon={FaHourglassHalf}
          color="var(--accent-ah)"
        />
        <StatCard
          title="Середній інтервал EI"
          value={
            patientStats.EI.avgIntervalHours != null
              ? `${patientStats.EI.avgIntervalHours} год`
              : "—"
          }
          subtext={
            patientStats.EI.avgIntervalHours == null
              ? "Недостатньо даних"
              : "Між прийомами"
          }
          icon={FaHourglassHalf}
          color="var(--accent-ei)"
        />
        <StatCard
          title="Загалом мг AH"
          value={Math.round(patientStats.AH.mg)}
          subtext={`~${patientStats.AH.avgDailyMg} мг/день`}
          icon={FaSyringe}
          color="var(--accent-ah)"
        />
        <StatCard
          title="Загалом мг EI"
          value={Math.round(patientStats.EI.mg)}
          subtext={`~${patientStats.EI.avgDailyMg} мг/день`}
          icon={FaDroplet}
          color="var(--accent-ei)"
        />
      </div>

      {/* Daily Dosage Chart */}
      <div
        className="rounded-3xl p-5 border border-[var(--border)] animate-in fade-in slide-in-from-bottom-8 duration-700 delay-100"
        style={{ background: "var(--surface)" }}
      >
        <h3 className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-[0.3em] mb-5 flex items-center gap-2">
          <FaChartLine className="opacity-70" />
          Динаміка дозування (мг)
        </h3>
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
                contentStyle={{
                  background: "var(--surface-2)",
                  border: "1px solid var(--border)",
                  borderRadius: "12px",
                  boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
                  fontSize: "12px",
                }}
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
                name="AH (мг)"
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
                name="EI (мг)"
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
      </div>

      {/* Hourly Distribution */}
      <div
        className="rounded-3xl p-5 border border-[var(--border)] animate-in fade-in slide-in-from-bottom-8 duration-700 delay-200"
        style={{ background: "var(--surface)" }}
      >
        <h3 className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-[0.3em] mb-5 flex items-center gap-2">
          <FaClock className="opacity-70" />
          Розподіл по годинах
        </h3>
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
                contentStyle={{
                  background: "var(--surface-2)",
                  border: "1px solid var(--border)",
                  borderRadius: "12px",
                  fontSize: "12px",
                }}
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
                name="AH"
                stackId="a"
                fill="var(--accent-ah)"
                radius={[0, 0, 3, 3]}
                animationDuration={1000}
                fillOpacity={0.85}
              />
              <Bar
                dataKey="EI"
                name="EI"
                stackId="a"
                fill="var(--accent-ei)"
                radius={[3, 3, 0, 0]}
                animationDuration={1000}
                fillOpacity={0.85}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Subtype Distribution */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {["AH", "EI"].map((pid, idx) => (
          <div
            key={pid}
            className={`rounded-3xl p-5 border border-[var(--border)] animate-in fade-in slide-in-from-bottom-8 duration-700 delay-${300 + idx * 100}`}
            style={{ background: "var(--surface)" }}
          >
            <h3
              className="text-[10px] font-black uppercase tracking-[0.3em] mb-4 text-center"
              style={{ color: `var(--accent-${pid.toLowerCase()})` }}
            >
              Типи прийому {pid}
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
