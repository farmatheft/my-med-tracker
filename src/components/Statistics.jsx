import { useEffect, useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '../firebase';
import { getStartOfDay } from '../utils/time';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

const SUBTYPE_COLORS = {
  IV: 'var(--subtype-iv)',
  IM: 'var(--subtype-im)',
  PO: 'var(--subtype-po)',
  'IV+PO': 'var(--subtype-ivpo)',
  'VTRK': 'var(--subtype-vtrk)'
};

export default function Statistics({ onBack }) {
  const [intakes, setIntakes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState('7'); // days to show

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
      setLoading(false);
    });
  }, []);

  const stats = useMemo(() => {
    if (!intakes.length) return null;

    const daysToShow = parseInt(dateRange);
    const today = getStartOfDay(new Date());
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - daysToShow + 1);

    // Filter intakes within date range
    const filteredIntakes = intakes.filter(intake => 
      intake.timestamp >= startDate && intake.timestamp <= today
    );

    // Group by day
    const dailyStats = {};
    for (let i = 0; i < daysToShow; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit' });
      dailyStats[dateStr] = {
        date: dateStr,
        fullDate: date,
        AH: 0,
        EI: 0,
        total: 0,
        subtypes: {}
      };
    }

    filteredIntakes.forEach(intake => {
      const dateStr = intake.timestamp.toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit' });
      const patient = intake.patient || 'AH';
      const subtype = intake.subtype || 'PO';
      
      if (dailyStats[dateStr]) {
        dailyStats[dateStr][patient] = (dailyStats[dateStr][patient] || 0) + 1;
        dailyStats[dateStr].total = (dailyStats[dateStr].total || 0) + 1;
        dailyStats[dateStr].subtypes[subtype] = (dailyStats[dateStr].subtypes[subtype] || 0) + 1;
      }
    });

    const chartData = Object.values(dailyStats).reverse();

    // Subtype distribution for the period
    const subtypeDistribution = {};
    filteredIntakes.forEach(intake => {
      const subtype = intake.subtype || 'PO';
      subtypeDistribution[subtype] = (subtypeDistribution[subtype] || 0) + 1;
    });

    const subtypePieData = Object.entries(subtypeDistribution).map(([name, value]) => ({ name, value }));

    // Patient totals
    const patientTotals = { AH: 0, EI: 0 };
    filteredIntakes.forEach(intake => {
      const patient = intake.patient || 'AH';
      patientTotals[patient] = (patientTotals[patient] || 0) + 1;
    });

    // Average per day
    const avgPerDay = filteredIntakes.length / daysToShow;

    return {
      chartData,
      subtypePieData,
      patientTotals,
      total: filteredIntakes.length,
      avgPerDay: avgPerDay.toFixed(1)
    };
  }, [intakes, dateRange]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-[var(--text-primary)]">Завантаження...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="px-4 py-2 rounded-full border border-[var(--border)] text-[var(--text-primary)] text-sm font-semibold hover:scale-105 transition-transform"
          style={{ background: 'linear-gradient(135deg, var(--card-bg-start), var(--card-bg-end))' }}
        >
          ← Назад
        </button>
        <h2 className="text-xl font-black text-[var(--text-primary)] uppercase tracking-tight">Статистика</h2>
        <select
          value={dateRange}
          onChange={(e) => setDateRange(e.target.value)}
          className="px-3 py-2 rounded-full border border-[var(--border)] text-[var(--text-primary)] text-sm font-semibold bg-[var(--surface)]"
        >
          <option value="7">7 днів</option>
          <option value="14">14 днів</option>
          <option value="30">30 днів</option>
        </select>
      </div>

      {!stats ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-[var(--text-secondary)]">Немає даних</div>
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-2xl p-4 border border-[var(--border)] text-center" style={{ background: 'linear-gradient(135deg, var(--card-bg-start), var(--card-bg-end))' }}>
              <div className="text-3xl font-black text-[var(--accent-ah)]">{stats.patientTotals.AH}</div>
              <div className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide">AH</div>
            </div>
            <div className="rounded-2xl p-4 border border-[var(--border)] text-center" style={{ background: 'linear-gradient(135deg, var(--card-bg-start), var(--card-bg-end))' }}>
              <div className="text-3xl font-black text-[var(--accent-ei)]">{stats.patientTotals.EI}</div>
              <div className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide">EI</div>
            </div>
            <div className="rounded-2xl p-4 border border-[var(--border)] text-center" style={{ background: 'linear-gradient(135deg, var(--card-bg-start), var(--card-bg-end))' }}>
              <div className="text-3xl font-black text-[var(--text-primary)]">{stats.total}</div>
              <div className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide">Всього</div>
            </div>
          </div>

          {/* Daily Chart */}
          <div className="rounded-3xl p-4 border border-[var(--border)]" style={{ background: 'var(--surface)' }}>
            <h3 className="text-sm font-black text-[var(--text-primary)] uppercase tracking-wide mb-4">Кількість прийомів за день</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={stats.chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="date" stroke="var(--text-secondary)" tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} />
                <YAxis stroke="var(--text-secondary)" tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} />
                <Tooltip 
                  contentStyle={{ 
                    background: 'var(--surface)', 
                    border: '1px solid var(--border)',
                    borderRadius: '8px'
                  }}
                  labelStyle={{ color: 'var(--text-primary)' }}
                />
                <Bar dataKey="AH" fill="var(--accent-ah)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="EI" fill="var(--accent-ei)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-3">
            {/* Subtype Pie Chart */}
            <div className="rounded-3xl p-4 border border-[var(--border)]" style={{ background: 'var(--surface)' }}>
              <h3 className="text-sm font-black text-[var(--text-primary)] uppercase tracking-wide mb-4 text-center">Типи прийому</h3>
              <ResponsiveContainer width="100%" height={150}>
                <PieChart>
                  <Pie
                    data={stats.subtypePieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={30}
                    outerRadius={60}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {stats.subtypePieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={SUBTYPE_COLORS[entry.name] || COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                      background: 'var(--surface)', 
                      border: '1px solid var(--border)',
                      borderRadius: '8px'
                    }}
                    labelStyle={{ color: 'var(--text-primary)' }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap justify-center gap-2 mt-2">
                {stats.subtypePieData.map((entry, index) => (
                  <div key={index} className="flex items-center gap-1">
                    <div 
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: SUBTYPE_COLORS[entry.name] || COLORS[index % COLORS.length] }}
                    />
                    <span className="text-xs text-[var(--text-secondary)]">{entry.name}: {entry.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Stats Summary */}
            <div className="rounded-3xl p-4 border border-[var(--border)] flex flex-col justify-center" style={{ background: 'var(--surface)' }}>
              <div className="text-center mb-4">
                <div className="text-4xl font-black text-[var(--text-primary)]">{stats.avgPerDay}</div>
                <div className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide">Середнє за день</div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-[var(--text-secondary)]">AH</span>
                  <span className="font-semibold text-[var(--accent-ah)]">{stats.patientTotals.AH}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[var(--text-secondary)]">EI</span>
                  <span className="font-semibold text-[var(--accent-ei)]">{stats.patientTotals.EI}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[var(--text-secondary)]">Днів у періоді</span>
                  <span className="font-semibold text-[var(--text-primary)]">{dateRange}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Daily Trend */}
          <div className="rounded-3xl p-4 border border-[var(--border)]" style={{ background: 'var(--surface)' }}>
            <h3 className="text-sm font-black text-[var(--text-primary)] uppercase tracking-wide mb-4">Динаміка за період</h3>
            <ResponsiveContainer width="100%" height={150}>
              <LineChart data={stats.chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="date" stroke="var(--text-secondary)" tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} />
                <YAxis stroke="var(--text-secondary)" tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} />
                <Tooltip 
                  contentStyle={{ 
                    background: 'var(--surface)', 
                    border: '1px solid var(--border)',
                    borderRadius: '8px'
                  }}
                  labelStyle={{ color: 'var(--text-primary)' }}
                />
                <Line type="monotone" dataKey="total" stroke="var(--text-primary)" strokeWidth={2} dot={{ fill: 'var(--text-primary)' }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  );
}
