import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useProfile } from '../context/ProfileContext';
import api from '../api';
import MacroDonutChart from '../components/MacroDonutChart';

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Filler,
  ChartOptions,
  ChartData
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Filler
);

/* ===================== TYPES ===================== */

type Progress = {
  month: string;
  weight_kg: number;
  notes?: string;
};

type Profile = {
  name: string;
  bmi: number;
  bmi_category: string;
  weight_kg: number;
  height_cm: number;
  lifestyle_level: string;
};

export default function Dashboard() {
  const { profile, progress, rec, loading, refetch } = useProfile();
  const [newWeight, setNewWeight] = useState<number | ''>('');
  const [note, setNote] = useState<string>('');
  const [quote, setQuote] = useState<string>('');
  const [macroData, setMacroData] = useState<any>(null);
  const [macroLoading, setMacroLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;

    const heightMeters = profile.height_cm / 100;
    const idealBMI = 22;
    const idealWeightKg = Number((idealBMI * heightMeters * heightMeters).toFixed(1));
    const deltaKg = profile.weight_kg - idealWeightKg;
    const deltaAbs = Math.abs(deltaKg);

    let pMsg = "";
    if (deltaAbs <= 0.5) {
      pMsg = "You're at your ideal weight! You're doing amazing, keep it up! 🎉";
    } else if (deltaKg > 0) {
      pMsg = `Just ${deltaAbs.toFixed(1)}kg more to reach your goal weight. You've got this! 💪`;
    } else {
      pMsg = `Only ${deltaAbs.toFixed(1)}kg until you hit your target. You're stronger than you think! 🚀`;
    }

    const genericQuotes = [
      "The only bad workout is the one that didn't happen.",
      "Fitness is not about being better than someone else. It's about being better than you were yesterday.",
      "Your body can stand almost anything. It's your mind that you have to convince.",
      "Motivation is what gets you started. Habit is what keeps you going.",
      "Your health is an investment, not an expense.",
      "Small steps every day lead to big results."
    ];
    
    const rQuote = genericQuotes[Math.floor(Math.random() * genericQuotes.length)];
    setQuote(JSON.stringify({ personal: pMsg, daily: rQuote }));
  }, [profile]);

  // Fetch macro data
  useEffect(() => {
    const fetchMacroData = async () => {
      try {
        const today = new Date().toISOString().split('T')[0];
        const response = await api.get(`/public-nutrition/daily/${today}`);
        setMacroData(response.data);
      } catch (error) {
        console.error('Error fetching macro data:', error);
        // Set default data on error
        setMacroData({
          consumed: { protein: 85, carbs: 220, fats: 65 },
          target: { protein: 120, carbs: 250, fats: 75 },
          calories: 1440
        });
      } finally {
        setMacroLoading(false);
      }
    };

    fetchMacroData();
  }, []);

  const handleWeightSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWeight) return;

    const month = new Date().toLocaleString('en-US', { month: 'short', year: 'numeric' });
    try {
      await api.post('/progress', { month, weight_kg: Number(newWeight), notes: note });
      refetch();
      setNewWeight('');
      setNote('');
    } catch (err) {
      console.error('Update error:', err);
    }
  };

  if (loading) return <div className="loader-container"><div className="spinner"></div></div>;
  if (!profile) return <div className="error-state">Profile not found. <Link to="/intake">Set it up here</Link></div>;

  /* ===================== CALCULATIONS ===================== */

  const workoutMinutes = profile!.lifestyle_level === "active" ? 30 : 45;
  const labels = progress.map(p => p.month);
  const heightMeters = profile!.height_cm / 100;
  const bmiData: number[] = progress.map(p =>
    Number((p.weight_kg / (heightMeters * heightMeters)).toFixed(1))
  );

  const idealBMI = 22;
  const idealWeightKg = Number((idealBMI * heightMeters * heightMeters).toFixed(1));
  const deltaKg = Number((profile!.weight_kg - idealWeightKg).toFixed(1));
  const deltaAbs = Math.abs(deltaKg);
  const needsChange = deltaAbs > 0.5;
  const deltaText = needsChange ? (deltaKg > 0 ? `Lose ${deltaAbs} kg` : `Gain ${deltaAbs} kg`) : 'At ideal weight';

  const chartData: ChartData<'line'> = {
    labels,
    datasets: [
      {
        label: 'Weight (kg)',
        data: progress.map(p => p.weight_kg),
        borderColor: '#6366f1',
        backgroundColor: 'rgba(99, 102, 241, 0.1)',
        borderWidth: 4,
        tension: 0.4,
        yAxisID: 'y',
        fill: true,
        pointBackgroundColor: '#6366f1',
        pointRadius: 4,
      },
      {
        label: 'BMI Score',
        data: bmiData,
        borderColor: '#10b981',
        borderDash: [5, 5],
        borderWidth: 2,
        tension: 0.4,
        yAxisID: 'y1',
        pointRadius: 3,
      }
    ]
  };

  const chartOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { 
      legend: { 
        position: 'top',
        align: 'end',
        labels: { 
          font: { 
            family: "'Plus Jakarta Sans'", 
            weight: 600 // Fixed: Changed from string "600" to number 600
          }, 
          boxWidth: 8, 
          usePointStyle: true 
        } 
      } 
    },
    scales: {
      y: { position: 'left', grid: { color: '#f1f5f9' } },
      y1: { position: 'right', grid: { display: false } },
      x: { grid: { display: false } }
    }
  };

  return (
    <div className="dashboard-wrapper">
      <style dangerouslySetInnerHTML={{ __html: cssStyles }} />
      
      <header className="dash-header">
        <div>
          <h1>Welcome back, {profile!.name}!</h1>
          <p>Tracking your Weight and BMI trends over time.</p>
        </div>
        <div className="bmi-badge">
          <span className="bmi-val">{profile!.bmi.toFixed(1)}</span>
          <span className="bmi-cat">{profile!.bmi_category}</span>
        </div>
      </header>

      {quote && (
        <div className="quote-container">
          <div className="quote-card standout">
            <div className="quote-content">
              <div className="quote-main">
                <span className="quote-icon-large">✨</span>
                <div className="quote-text-group">
                  <h2 className="personal-goal">{JSON.parse(quote).personal}</h2>
                  <p className="daily-quote">"{JSON.parse(quote).daily}"</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="stats-grid">
        {[
          { icon: '💧', label: 'Water Goal', val: rec?.water_l ? `${rec.water_l}L` : '—' },
          { icon: '🔥', label: 'Est. Burn', val: `${Math.round(profile.weight_kg * 5.5)} kcal` },
          { icon: '⏱️', label: 'Workout', val: `${workoutMinutes}m` },
          { icon: '⚖️', label: 'Weight', val: `${profile.weight_kg}kg`, sub: deltaText, subColor: needsChange ? '#ef4444' : '#10b981' },
          { icon: '🍎', label: 'Calories', val: rec?.daily_calories ? `${Math.round(rec.daily_calories)} kcal` : '—' }
        ].map((s, i) => (
          <div key={i} className="stat-card">
            <span className="stat-icon">{s.icon}</span>
            <div className="stat-info">
              <h4>{s.label}</h4>
              <p>{s.val}</p>
              {s.sub && <small style={{ color: s.subColor, fontWeight: 800 }}>{s.sub}</small>}
            </div>
          </div>
        ))}
      </div>

      <div className="main-content">
        <section className="chart-section card">
          <div className="card-header">
            <h3>Health Progression</h3>
            <span className="badge">Dual Metric View</span>
          </div>
          <div className="chart-container">
            {progress.length > 0 ? (
              <Line data={chartData} options={chartOptions} />
            ) : (
              <div className="empty-chart">No data points yet</div>
            )}
          </div>
        </section>

        <section className="macro-section card">
          <div className="card-header">
            <h3>Macronutrients</h3>
            <span className="badge">Daily Tracking</span>
          </div>
          <MacroDonutChart 
            consumed={macroData?.consumed || { protein: 85, carbs: 220, fats: 65 }}
            target={macroData?.target || { protein: 120, carbs: 250, fats: 75 }}
          />
        </section>

        <section className="update-section card">
          <h3>Log Daily Stats</h3>
          <form onSubmit={handleWeightSubmit}>
            <div className="input-group">
              <label>Weight (kg)</label>
              <input 
                type="number" 
                step="0.1" 
                value={newWeight} 
                onChange={e => setNewWeight(e.target.value === '' ? '' : Number(e.target.value))} 
                required 
              />
            </div>
            <div className="input-group">
              <label>Notes</label>
              <textarea 
                value={note} 
                onChange={e => setNote(e.target.value)} 
                placeholder="How's your energy?"
                rows={4}
              />
            </div>
            <button type="submit" className="btn-primary">Sync Progress</button>
          </form>
        </section>
      </div>
    </div>
  );
}

const cssStyles = `
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');

:root {
  --primary: #6366f1;
  --bg-color: #f8fafc;
  --text-main: #1e293b;
  --text-muted: #64748b;
}

.dashboard-wrapper {
  width: 100%;
  max-width: 1400px;
  margin: 0 auto;
  padding: 40px 24px;
  font-family: 'Plus Jakarta Sans', sans-serif;
  background-color: var(--bg-color);
  min-height: 100vh;
  box-sizing: border-box;
}

.dash-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 40px;
}

.dash-header h1 {
  font-size: 2.5rem;
  font-weight: 800;
  letter-spacing: -1.5px;
  margin: 0;
  color: var(--text-main);
}

.dash-header p {
  color: var(--text-muted);
  font-weight: 500;
}

.bmi-badge {
  background: white;
  padding: 15px 30px;
  border-radius: 24px;
  box-shadow: 0 10px 25px rgba(0,0,0,0.05);
  display: flex;
  flex-direction: column;
  align-items: center;
}

.bmi-val { font-size: 2rem; font-weight: 800; color: var(--primary); }
.bmi-cat { font-size: 0.8rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; }

.quote-card.standout {
  background: linear-gradient(135deg, #6366f1, #a855f7);
  border-radius: 35px;
  padding: 40px;
  color: white;
  margin-bottom: 30px;
  box-shadow: 0 20px 40px rgba(99,102,241,0.2);
}

.personal-goal { font-size: 1.8rem; font-weight: 800; margin-bottom: 12px; }
.daily-quote { font-size: 1.1rem; opacity: 0.9; font-style: italic; font-weight: 500; }

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 20px;
  margin-bottom: 30px;
}

.stat-card {
  background: white;
  border-radius: 28px;
  padding: 24px;
  display: flex;
  align-items: center;
  gap: 18px;
  border: 1px solid #f1f5f9;
  transition: transform 0.3s ease;
}

.stat-card:hover { transform: translateY(-5px); }

.stat-icon {
  font-size: 1.8rem;
  background: #f1f5f9;
  width: 60px;
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 20px;
}

.stat-info h4 { margin: 0; font-size: 0.85rem; color: var(--text-muted); font-weight: 700; }
.stat-info p { margin: 4px 0 0; font-size: 1.4rem; font-weight: 800; color: var(--text-main); }

.main-content {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 30px;
}

.macro-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 25px;
}

.macro-section .card-header {
  width: 100%;
  margin-bottom: 20px;
}

.card {
  background: white;
  border-radius: 32px;
  padding: 35px;
  border: 1px solid #f1f5f9;
  box-shadow: 0 4px 6px -1px rgba(0,0,0,0.02);
}

.card-header h3 { font-weight: 800; margin: 0; }

.badge {
  background: #ecfdf5;
  color: #065f46;
  padding: 6px 14px;
  border-radius: 100px;
  font-size: 0.75rem;
  font-weight: 800;
}

.chart-container { height: 400px; margin-top: 20px; }

.input-group { margin-bottom: 20px; }
.input-group label { font-size: 0.9rem; font-weight: 700; margin-bottom: 8px; display: block; color: var(--text-main); }
.input-group input, .input-group textarea {
  width: 100%;
  padding: 16px;
  border-radius: 18px;
  border: 1px solid #e2e8f0;
  font-family: inherit;
  font-size: 1rem;
  background: #f8fafc;
  box-sizing: border-box;
}

.btn-primary {
  width: 100%;
  padding: 18px;
  border-radius: 20px;
  border: none;
  background: var(--primary);
  color: white;
  font-weight: 800;
  font-size: 1.1rem;
  cursor: pointer;
  box-shadow: 0 10px 20px rgba(99,102,241,0.2);
  transition: 0.3s;
}

.btn-primary:hover { transform: scale(1.02); background: #4f46e5; }

.loader-container { height: 100vh; display: flex; align-items: center; justify-content: center; }
.spinner {
  width: 40px; height: 40px; border: 4px solid #f1f5f9; border-top: 4px solid var(--primary);
  border-radius: 50%; animation: spin 1s linear infinite;
}

@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

@media (max-width: 1000px) {
  .main-content { grid-template-columns: 1fr; }
  .dash-header { flex-direction: column; align-items: flex-start; gap: 20px; }
}
`;