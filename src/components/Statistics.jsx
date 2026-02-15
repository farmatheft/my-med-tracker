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
  FaPills,
  FaChartLine,
  FaClock,
  FaHourglassHalf,
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

const formatTime = (hour) => {
  return `${String(hour).padStart(2, "0")}:00`;
};

const calculateIntervals = (intakes) => {
  // intakes should be sorted descending (newest first)
  // We need ascending for easier interval calc
  const sorted = [...intakes].sort((a, b) => a.timestamp - b.timestamp);
  let totalDiff = 0;
  let count = 0;

  for (let i = 1; i < sorted.length; i++) {
    const diff = sorted[i].timestamp - sorted[i - 1].timestamp;
    // Filter out huge gaps (e.g. > 24 hours) which might be missed days, or keep them?
    // Let's keep simpler logic first: all intervals.
    totalDiff += diff;
    count++;
  }

  if (count === 0) return 0;
  const avgMs = totalDiff / count;
  const avgHours = avgMs / (1000 * 60 * 60);
  return avgHours.toFixed(1);
};

const calculateStats = (intakes, daysToShow) => {
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

  // Initialize data structures
  const dailyData = {}; // Key: YYYY-MM-DD
  const hourlyData = Array(24)
    .fill(0)
    .map((_, i) => ({
      hour: i,
      label: formatTime(i),
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

  // Helper to init daily data
  const getDayKey = (date) => {
    return date.toISOString().split("T")[0];
  };

  // Fill dailyData with empty entries for the range
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

  // Process main filtered intakes
  filteredIntakes.forEach((intake) => {
    const date = intake.timestamp;
    const key = getDayKey(date);
    const hour = date.getHours();
    const patientId = intake.patientId || "AH";
    const dosage = parseFloat(intake.dosage) || 0;
    const unit = intake.unit || "mg";
    const mg = convertToMg(dosage, unit);
    const subtype = intake.subtype || "PO";

    // Daily Stats
    if (dailyData[key]) {
      dailyData[key][patientId] += 1;
      dailyData[key][`${patientId}_mg`] += mg;
    }

    // Hourly Stats (Aggregate)
    hourlyData[hour][patientId] += 1;
    hourlyData[hour][`${patientId}_mg`] += mg;

    // Patient Total Stats
    if (patientStats[patientId]) {
      patientStats[patientId].count += 1;
      patientStats[patientId].mg += mg;
      patientStats[patientId].subtypes[subtype] =
        (patientStats[patientId].subtypes[subtype] || 0) + 1;

      patientStats[patientId].intervals.push(intake);

      // Update last dose (global check from all filtered, but effectively latest is usually in range)
      if (
        !patientStats[patientId].lastDose ||
        date > patientStats[patientId].lastDose
      ) {
        patientStats[patientId].lastDose = date;
      }
    }
  });

  // Calculate Max Daily Mg and finalize daily data array
  const chartData = Object.values(dailyData).sort((a, b) =>
    a.fullDate.localeCompare(b.fullDate),
  );

  chartData.forEach((day) => {
    ["AH", "EI"].forEach((pid) => {
      if (day[`${pid}_mg`] > patientStats[pid].maxDailyMg) {
        patientStats[pid].maxDailyMg = day[`${pid}_mg`];
      }
    });
  });

  // Calculate Averages & Intervals
  const daysCount = Math.max(1, daysToShow);
  ["AH", "EI"].forEach((pid) => {
    patientStats[pid].avgDailyMg = (patientStats[pid].mg / daysCount).toFixed(
      0,
    );
    patientStats[pid].avgDailyCount = (
      patientStats[pid].count / daysCount
    ).toFixed(1);
    patientStats[pid].avgIntervalHours = calculateIntervals(
      patientStats[pid].intervals,
    );
  });

  // Format Subtype Data for Pie Charts
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

const StatCard = ({ title, value, subtext, icon: Icon, color, trend }) => (
  <div
    className="rounded-2xl p-4 border border-[var(--border)] relative overflow-hidden group hover:scale-[1.02] transition-transform animate-in fade-in zoom-in duration-300"
    style={{ background: "var(--surface)" }}
  >
    <div className="flex justify-between items-start mb-2">
      <div className="p-2 rounded-lg" style={{ background: `${color}20` }}>
        <Icon className="w-5 h-5" style={{ color }} />
      </div>
      {trend && (
        <span
          className={`text-xs font-bold px-2 py-1 rounded-full ${trend > 0 ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500"}`}
        >
          {trend > 0 ? "+" : ""}
          {trend}%
        </span>
      )}
    </div>
    <div className="text-2xl font-black text-[var(--text-primary)] mb-1">
      {value}
    </div>
    <div className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide">
      {title}
    </div>
    {subtext && (
      <div className="text-xs text-[var(--text-secondary)] mt-1 opacity-70">
        {subtext}
      </div>
    )}
    <div
      className="absolute -bottom-4 -right-4 w-24 h-24 rounded-full opacity-5"
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
        <div className="w-8 h-8 border-4 border-[var(--accent-primary)] border-t-transparent rounded-full animate-spin" />
        <div className="text-[var(--text-secondary)] font-medium">
          Завантаження статистики...
        </div>
      </div>
    );
  }

  if (!stats || stats.totalIntakes === 0) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          >
            <FaArrowLeft /> Назад
          </button>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center text-center p-8 opacity-60">
          <FaChartLine className="w-16 h-16 mb-4 text-[var(--text-secondary)]" />
          <h3 className="text-xl font-bold text-[var(--text-primary)]">
            Немає даних
          </h3>
          <p className="text-[var(--text-secondary)]">
            Додайте записи, щоб побачити статистику
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-10">
      {/* Header */}
      <div className="flex items-center justify-between sticky top-0 z-10 py-2 backdrop-blur-md bg-[var(--bg-gradient-start)]/80">
        <button
          onClick={onBack}
          className="p-2 rounded-full hover:bg-[var(--surface)] text-[var(--text-primary)] transition-colors"
        >
          <FaArrowLeft className="w-5 h-5" />
        </button>
        <h2 className="text-xl font-black text-[var(--text-primary)] uppercase tracking-tight">
          Статистика
        </h2>
        <select
          value={dateRange}
          onChange={(e) => setDateRange(e.target.value)}
          className="px-4 py-2 rounded-full border border-[var(--border)] text-[var(--text-primary)] text-sm font-bold bg-[var(--surface)] outline-none focus:ring-2 focus:ring-[var(--accent-primary)]"
        >
          <option value="3">3 дні</option>
          <option value="7">7 днів</option>
          <option value="14">14 днів</option>
          <option value="30">30 днів</option>
          <option value="90">90 днів</option>
        </select>
      </div>

      {/* Last 24 Hours Section */}
      <div className="rounded-3xl p-5 border border-[var(--border)] bg-gradient-to-br from-[var(--surface)] to-[var(--surface-2)] shadow-lg animate-in fade-in slide-in-from-bottom-8 duration-700">
        <h3 className="text-sm font-black text-[var(--text-primary)] uppercase tracking-wide mb-4 flex items-center gap-2">
          <FaClock className="text-[var(--accent-primary)]" /> Останні 24 години
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 rounded-2xl bg-[var(--surface)] border border-[var(--border)]">
            <div className="text-xs font-bold text-[var(--text-secondary)] uppercase mb-2 text-center">
              AH
            </div>
            <div className="flex flex-col items-center">
              <span className="text-2xl font-black text-[var(--accent-ah)]">
                {stats.last24hStats.AH.mg.toFixed(0)}{" "}
                <span className="text-xs font-medium text-[var(--text-secondary)]">
                  мг
                </span>
              </span>
              <span className="text-xs font-semibold text-[var(--text-secondary)] opacity-70">
                {stats.last24hStats.AH.count} прийомів
              </span>
            </div>
          </div>
          <div className="p-4 rounded-2xl bg-[var(--surface)] border border-[var(--border)]">
            <div className="text-xs font-bold text-[var(--text-secondary)] uppercase mb-2 text-center">
              EI
            </div>
            <div className="flex flex-col items-center">
              <span className="text-2xl font-black text-[var(--accent-ei)]">
                {stats.last24hStats.EI.mg.toFixed(0)}{" "}
                <span className="text-xs font-medium text-[var(--text-secondary)]">
                  мг
                </span>
              </span>
              <span className="text-xs font-semibold text-[var(--text-secondary)] opacity-70">
                {stats.last24hStats.EI.count} прийомів
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          title="Середній інтервал AH"
          value={`${stats.patientStats.AH.avgIntervalHours} год`}
          subtext="Між прийомами"
          icon={FaHourglassHalf}
          color="var(--accent-ah)"
        />
        <StatCard
          title="Середній інтервал EI"
          value={`${stats.patientStats.EI.avgIntervalHours} год`}
          subtext="Між прийомами"
          icon={FaHourglassHalf}
          color="var(--accent-ei)"
        />
        <StatCard
          title="Загалом мг AH"
          value={Math.round(stats.patientStats.AH.mg)}
          subtext={`Середнє: ${stats.patientStats.AH.avgDailyMg} мг/день`}
          icon={FaSyringe}
          color="var(--accent-ah)"
        />
        <StatCard
          title="Загалом мг EI"
          value={Math.round(stats.patientStats.EI.mg)}
          subtext={`Середнє: ${stats.patientStats.EI.avgDailyMg} мг/день`}
          icon={FaSyringe}
          color="var(--accent-ei)"
        />
      </div>

      {/* Main Chart: Daily Mg */}
      <div
        className="rounded-3xl p-5 border border-[var(--border)] animate-in fade-in slide-in-from-bottom-8 duration-700 delay-100"
        style={{ background: "var(--surface)" }}
      >
        <h3 className="text-sm font-black text-[var(--text-primary)] uppercase tracking-wide mb-6 flex items-center gap-2">
          <FaChartLine /> Динаміка дозування (мг)
        </h3>
        <div className="h-[250px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={stats.chartData}
              margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
            >
              <defs>
                <linearGradient id="colorAH" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor="var(--accent-ah)"
                    stopOpacity={0.3}
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
                    stopOpacity={0.3}
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
              />
              <XAxis
                dataKey="date"
                stroke="var(--text-secondary)"
                tick={{ fill: "var(--text-secondary)", fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                dy={10}
              />
              <YAxis
                stroke="var(--text-secondary)"
                tick={{ fill: "var(--text-secondary)", fontSize: 10 }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                contentStyle={{
                  background: "var(--surface-2)",
                  border: "1px solid var(--border)",
                  borderRadius: "12px",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                }}
                labelStyle={{
                  color: "var(--text-primary)",
                  fontWeight: "bold",
                  marginBottom: "4px",
                }}
                cursor={{
                  stroke: "var(--text-secondary)",
                  strokeWidth: 1,
                  strokeDasharray: "4 4",
                }}
              />
              <Legend wrapperStyle={{ paddingTop: "20px" }} />
              <Area
                type="monotone"
                dataKey="AH_mg"
                name="AH (мг)"
                stroke="var(--accent-ah)"
                fillOpacity={1}
                fill="url(#colorAH)"
                strokeWidth={3}
                animationDuration={1500}
              />
              <Area
                type="monotone"
                dataKey="EI_mg"
                name="EI (мг)"
                stroke="var(--accent-ei)"
                fillOpacity={1}
                fill="url(#colorEI)"
                strokeWidth={3}
                animationDuration={1500}
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
        <h3 className="text-sm font-black text-[var(--text-primary)] uppercase tracking-wide mb-6 flex items-center gap-2">
          <FaClock /> Розподіл по годинах (сумарно)
        </h3>
        <div className="h-[200px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={stats.hourlyData}
              margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="var(--border)"
                vertical={false}
              />
              <XAxis
                dataKey="hour"
                stroke="var(--text-secondary)"
                tick={{ fill: "var(--text-secondary)", fontSize: 10 }}
                tickFormatter={(val) => (val % 4 === 0 ? formatTime(val) : "")}
                tickLine={false}
                axisLine={false}
                dy={10}
              />
              <YAxis
                stroke="var(--text-secondary)"
                tick={{ fill: "var(--text-secondary)", fontSize: 10 }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                cursor={{ fill: "var(--border)", opacity: 0.2 }}
                contentStyle={{
                  background: "var(--surface-2)",
                  border: "1px solid var(--border)",
                  borderRadius: "12px",
                }}
                labelFormatter={(val) =>
                  `${formatTime(val)} - ${formatTime(val + 1)}`
                }
              />
              <Legend />
              <Bar
                dataKey="AH"
                name="AH (кількість)"
                stackId="a"
                fill="var(--accent-ah)"
                radius={[0, 0, 4, 4]}
                animationDuration={1500}
              />
              <Bar
                dataKey="EI"
                name="EI (кількість)"
                stackId="a"
                fill="var(--accent-ei)"
                radius={[4, 4, 0, 0]}
                animationDuration={1500}
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
              className="text-sm font-black uppercase tracking-wide mb-4 text-center"
              style={{ color: `var(--accent-${pid.toLowerCase()})` }}
            >
              Типи прийому {pid}
            </h3>
            <div className="h-[160px] relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stats.pieData[pid]}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={70}
                    paddingAngle={2}
                    dataKey="value"
                    stroke="none"
                    animationDuration={1500}
                  >
                    {stats.pieData[pid].map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={
                          SUBTYPE_COLORS[entry.name] ||
                          COLORS[index % COLORS.length]
                        }
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: "var(--surface-2)",
                      border: "1px solid var(--border)",
                      borderRadius: "8px",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              {/* Center Label */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <span
                  className="text-lg font-black"
                  style={{ color: `var(--accent-${pid.toLowerCase()})` }}
                >
                  {stats.patientStats[pid].count}
                </span>
              </div>
            </div>
            <div className="flex flex-wrap justify-center gap-3 mt-4">
              {stats.pieData[pid].map((entry, index) => (
                <div key={index} className="flex items-center gap-1.5">
                  <div
                    className="w-2.5 h-2.5 rounded-full"
                    style={{
                      backgroundColor:
                        SUBTYPE_COLORS[entry.name] ||
                        COLORS[index % COLORS.length],
                    }}
                  />
                  <span className="text-xs font-medium text-[var(--text-secondary)]">
                    {entry.name}{" "}
                    <span className="opacity-50">({entry.value})</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
