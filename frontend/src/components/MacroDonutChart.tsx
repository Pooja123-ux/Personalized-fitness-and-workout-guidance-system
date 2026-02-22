import React from 'react';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  ChartOptions,
  ChartData
} from 'chart.js';
import { Doughnut } from 'react-chartjs-2';

ChartJS.register(ArcElement, Tooltip, Legend);

interface MacroData {
  protein: number;
  carbs: number;
  fats: number;
}

interface MacroDonutChartProps {
  consumed: MacroData;
  target: MacroData;
  calories?: number;
  loading?: boolean;
}

const MacroDonutChart: React.FC<MacroDonutChartProps> = ({ consumed, target, calories, loading = false }) => {
  const fmt = (n: number) => Number(n || 0).toFixed(1);
  const totalConsumed = consumed.protein + consumed.carbs + consumed.fats;
  const proteinPercentage = totalConsumed > 0 ? Math.round((consumed.protein / totalConsumed) * 100) : 0;
  const carbsPercentage = totalConsumed > 0 ? Math.round((consumed.carbs / totalConsumed) * 100) : 0;
  const fatsPercentage = totalConsumed > 0 ? Math.round((consumed.fats / totalConsumed) * 100) : 0;
  const estimatedCalories = Math.round(consumed.protein * 4 + consumed.carbs * 4 + consumed.fats * 9);
  const totalCalories = typeof calories === 'number' && !Number.isNaN(calories) ? Math.round(calories) : estimatedCalories;

  const deltas = {
    protein: consumed.protein - target.protein,
    carbs: consumed.carbs - target.carbs,
    fats: consumed.fats - target.fats
  };

  const chartData: ChartData<'doughnut'> = {
    labels: ['Protein', 'Carbs', 'Fats'],
    datasets: [
      {
        data: [consumed.protein, consumed.carbs, consumed.fats],
        backgroundColor: ['#ef4444', '#3b82f6', '#f59e0b'],
        borderColor: ['#ffffff', '#ffffff', '#ffffff'],
        borderWidth: 3,
        hoverOffset: 4
      }
    ]
  };

  const chartOptions: ChartOptions<'doughnut'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          padding: 20,
          font: {
            family: "'Plus Jakarta Sans', sans-serif",
            size: 12,
            weight: 600
          },
          usePointStyle: true,
          pointStyle: 'circle'
        }
      },
      tooltip: {
        callbacks: {
          label: function (context) {
            const label = context.label || '';
            const value = context.parsed || 0;
            const percentage = context.dataIndex === 0 ? proteinPercentage : context.dataIndex === 1 ? carbsPercentage : fatsPercentage;
            return `${label}: ${value}g (${percentage}%)`;
          }
        }
      }
    },
    cutout: '70%'
  };

  if (loading) {
    return <div style={{ padding: 20, textAlign: 'center', color: '#64748b', fontWeight: 700 }}>Loading macro data...</div>;
  }

  return (
    <div className="macro-chart-container">
      <style>{`
        .macro-chart-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          height: 100%;
        }
        .chart-wrapper {
          position: relative;
          width: 200px;
          height: 200px;
          margin-bottom: 20px;
        }
        .chart-center-text {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          text-align: center;
          pointer-events: none;
        }
        .total-calories {
          font-size: 1.5rem;
          font-weight: 800;
          color: #1e293b;
          margin: 0;
        }
        .calories-label {
          font-size: 0.75rem;
          color: #64748b;
          font-weight: 600;
          margin: 0;
        }
        .macro-stats {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 15px;
          width: 100%;
        }
        .macro-stat {
          text-align: center;
          padding: 12px 8px;
          background: #f8fafc;
          border-radius: 12px;
          border: 1px solid #e2e8f0;
        }
        .macro-stat.protein { border-left: 3px solid #ef4444; }
        .macro-stat.carbs { border-left: 3px solid #3b82f6; }
        .macro-stat.fats { border-left: 3px solid #f59e0b; }
        .macro-name {
          font-size: 0.75rem;
          color: #64748b;
          font-weight: 600;
          margin: 0 0 4px 0;
          text-transform: uppercase;
        }
        .macro-values {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .consumed-value {
          font-size: 1rem;
          font-weight: 800;
          color: #1e293b;
          margin: 0;
        }
        .remaining-value {
          font-size: 0.75rem;
          color: #10b981;
          font-weight: 600;
          margin: 0;
        }
        .remaining-value.zero { color: #ef4444; }
      `}</style>

      <div className="chart-wrapper">
        <Doughnut data={chartData} options={chartOptions} />
        <div className="chart-center-text">
          <p className="total-calories">{totalCalories}</p>
          <p className="calories-label">CALORIES</p>
        </div>
      </div>

      <div className="macro-stats">
        <div className="macro-stat protein">
          <p className="macro-name">Protein</p>
          <div className="macro-values">
            <p className="consumed-value">{fmt(consumed.protein)}g</p>
            <p className={`remaining-value ${deltas.protein >= 0 ? 'zero' : ''}`}>
              {`${fmt(consumed.protein)} / ${fmt(target.protein)}g`}
              {` • `}
              {deltas.protein >= 0 ? `${Math.abs(deltas.protein).toFixed(1)}g over target` : `${Math.abs(deltas.protein).toFixed(1)}g remaining`}
            </p>
          </div>
        </div>

        <div className="macro-stat carbs">
          <p className="macro-name">Carbs</p>
          <div className="macro-values">
            <p className="consumed-value">{fmt(consumed.carbs)}g</p>
            <p className={`remaining-value ${deltas.carbs >= 0 ? 'zero' : ''}`}>
              {`${fmt(consumed.carbs)} / ${fmt(target.carbs)}g`}
              {` • `}
              {deltas.carbs >= 0 ? `${Math.abs(deltas.carbs).toFixed(1)}g over target` : `${Math.abs(deltas.carbs).toFixed(1)}g remaining`}
            </p>
          </div>
        </div>

        <div className="macro-stat fats">
          <p className="macro-name">Fats</p>
          <div className="macro-values">
            <p className="consumed-value">{fmt(consumed.fats)}g</p>
            <p className={`remaining-value ${deltas.fats >= 0 ? 'zero' : ''}`}>
              {`${fmt(consumed.fats)} / ${fmt(target.fats)}g`}
              {` • `}
              {deltas.fats >= 0 ? `${Math.abs(deltas.fats).toFixed(1)}g over target` : `${Math.abs(deltas.fats).toFixed(1)}g remaining`}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MacroDonutChart;
