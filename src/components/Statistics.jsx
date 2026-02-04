import { useEffect, useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, Legend } from 'recharts';
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
        AH_subtypes: {},
        EI_subtypes: {}
      };
    }

    filteredIntakes.forEach(intake => {
      const dateStr = intake.timestamp.toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit' });
      const patient = intake.patient || 'AH';
      const subtype = intake.subtype || 'PO';
      
      if (dailyStats[dateStr]) {
        dailyStats[dateStr][patient] = (dailyStats[dateStr][patient] || 0) + 1;
        dailyStats[dateStr].total = (dailyStats[dateStr].total || 0) + 1;
        const subtypesKey = `${patient}_subtypes`;
        dailyStats[dateStr][subtypesKey][subtype] = (dailyStats[dateStr][subtypesKey][subtype] || 0) + 1;
      }
    });

    const chartData = Object.values(dailyStats).reverse();

    // Subtype distribution for each patient
    const ahSubtypeDistribution = {};
    const eiSubtypeDistribution = {};
    filteredIntakes.forEach(intake => {
      const patient = intake.patient || 'AH';
      const subtype = intake.subtype || 'PO';
      if (patient === 'AH') {
        ahSubtypeDistribution[subtype] = (ahSubtypeDistribution[subtype] || 0) + 1;
      } else {
        eiSubtypeDistribution[subtype] = (eiSubtypeDistribution[subtype] || 0) + 1;
      }
    });

    const ahSubtypePieData = Object.entries(ahSubtypeDistribution).map(([name, value]) => ({ name, value }));
    const eiSubtypePieData = Object.entries(eiSubtypeDistribution).map(([name, value]) => ({ name, value }));

    // Patient totals
    const patientTotals = { AH: 0, EI: 0 };
    filteredIntakes.forEach(intake => {
      const patient = intake.patient || 'AH';
      patientTotals[patient] = (patientTotals[patient] || 0) + 1;
    });

    // Average per day per patient
    const avgPerDay = {
      AH: (patientTotals.AH / daysToShow).toFixed(1),
      EI: (patientTotals.EI / daysToShow).toFixed(1)
    };

    // Comparison data
    const comparison = {
      AH: patientTotals.AH,
      EI: patientTotals.EI,
      difference: Math.abs(patientTotals.AH - patientTotals.EI),
      leader: patientTotals.AH > patientTotals.EI ? 'AH' : patientTotals.EI > patientTotals.AH ? 'EI' : null
    };

    return {
      chartData,
      ahSubtypePieData,
      eiSubtypePieData,
      patientTotals,
      avgPerDay,
      total: filteredIntakes.length,
      comparison
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
          {/* Comparison Summary */}
          <div className="rounded-3xl p-4 border border-[var(--border)]" style={{ background: 'var(--surface)' }}>
            <h3 className="text-sm font-black text-[var(--text-primary)] uppercase tracking-wide mb-4 text-center">Порівняння AH vs EI</h3>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-3xl font-black text-[var(--accent-ah)]">{stats.patientTotals.AH}</div>
                <div className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide">AH</div>
              </div>
              <div className="text-center flex flex-col justify-center">
                <div className="text-xl font-bold text-[var(--text-primary)]">VS</div>
                <div className="text-xs text-[var(--text-secondary)] mt-1">
                  {stats.comparison.difference > 0 ? (
                    <span>{stats.comparison.leader} +{stats.comparison.difference}</span>
                  ) : (
                    <span>Порівну</span>
                  )}
                </div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-black text-[var(--accent-ei)]">{stats.patientTotals.EI}</div>
                <div className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide">EI</div>
              </div>
            </div>
          </div>

          {/* Daily Chart - Side by Side Comparison */}
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
                <Legend />
                <Bar dataKey="AH" fill="var(--accent-ah)" radius={[4, 4, 0, 0]} name="AH" />
                <Bar dataKey="EI" fill="var(--accent-ei)" radius={[4, 4, 0, 0]} name="EI" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Separate Trend Lines */}
          <div className="rounded-3xl p-4 border border-[var(--border)]" style={{ background: 'var(--surface)' }}>
            <h3 className="text-sm font-black text-[var(--text-primary)] uppercase tracking-wide mb-4">Динаміка AH vs EI</h3>
            <ResponsiveContainer width="100%" height={200}>
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
                <Legend />
                <Line type="monotone" dataKey="AH" stroke="var(--accent-ah)" strokeWidth={2} dot={{ fill: 'var(--accent-ah)' }} name="AH" />
                <Line type="monotone" dataKey="EI" stroke="var(--accent-ei)" strokeWidth={2} dot={{ fill: 'var(--accent-ei)' }} name="EI" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Separate Pie Charts for Each Patient */}
          <div className="grid grid-cols-2 gap-3">
            {/* AH Subtypes */}
            <div className="rounded-3xl p-4 border border-[var(--border)]" style={{ background: 'var(--surface)' }}>
              <h3 className="text-sm font-black text-[var(--accent-ah)] uppercase tracking-wide mb-4 text-center">Типи прийому AH</h3>
              <ResponsiveContainer width="100%" height={120}>
                <PieChart>
                  <Pie
                    data={stats.ahSubtypePieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={20}
                    outerRadius={50}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {stats.ahSubtypePieData.map((entry, index) => (
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
              <div className="flex flex-wrap justify-center gap-2">
                {stats.ahSubtypePieData.map((entry, index) => (
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

            {/* EI Subtypes */}
            <div className="rounded-3xl p-4 border border-[var(--border)]" style={{ background: 'var(--surface)' }}>
              <h3 className="text-sm font-black text-[var(--accent-ei)] uppercase tracking-wide mb-4 text-center">Типи прийому EI</h3>
              <ResponsiveContainer width="100%" height={120}>
                <PieChart>
                  <Pie
                    data={stats.eiSubtypePieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={20}
                    outerRadius={50}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {stats.eiSubtypePieData.map((entry, index) => (
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
              <div className="flex flex-wrap justify-center gap-2">
                {stats.eiSubtypePieData.map((entry, index) => (
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
          </div>

          {/* Average per day comparison */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-3xl p-4 border border-[var(--border)] text-center" style={{ background: 'linear-gradient(135deg, var(--card-bg-start), var(--card-bg-end))' }}>
              <div className="text-2xl font-black text-[var(--accent-ah)]">{stats.avgPerDay.AH}</div>
              <div className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide">Середнє AH/день</div>
            </div>
            <div className="rounded-3xl p-4 border border-[var(--border)] text-center" style={{ background: 'linear-gradient(135deg, var(--card-bg-start), var(--card-bg-end))' }}>
              <div className="text-2xl font-black text-[var(--accent-ei)]">{stats.avgPerDay.EI}</div>
              <div className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide">Середнє EI/день</div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
