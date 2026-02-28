import React from 'react';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  ChartData,
  ChartOptions
} from 'chart.js';
import { Doughnut } from 'react-chartjs-2';

ChartJS.register(ArcElement, Tooltip, Legend);

type FoodSlice = {
  name: string;
  calories: number;
  meal_type?: string;
  protein?: number;
  carbs?: number;
  fats?: number;
  item_count?: number;
  foods?: string[];
};

interface DailyFoodPieChartProps {
  foods: FoodSlice[];
  loading?: boolean;
}

const COLORS = [
  '#0f766e', '#0ea5e9', '#f59e0b', '#ef4444', '#8b5cf6',
  '#22c55e', '#f97316', '#3b82f6', '#ec4899', '#14b8a6',
];

const DailyFoodPieChart: React.FC<DailyFoodPieChartProps> = ({ foods, loading = false }) => {
  const cleanFoods = (foods || []).filter((f) => Number(f.calories || 0) > 0);
  const total = cleanFoods.reduce((sum, f) => sum + Number(f.calories || 0), 0);

  const chartData: ChartData<'doughnut'> = {
    labels: cleanFoods.map((f) => f.name),
    datasets: [
      {
        data: cleanFoods.map((f) => Number(f.calories || 0)),
        backgroundColor: cleanFoods.map((_, i) => COLORS[i % COLORS.length]),
        borderColor: '#ffffff',
        borderWidth: 2,
      }
    ]
  };

  const chartOptions: ChartOptions<'doughnut'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx) => {
            const val = Number(ctx.parsed || 0);
            const pct = total > 0 ? Math.round((val / total) * 100) : 0;
            const source = cleanFoods[ctx.dataIndex];
            const p = Number(source?.protein || 0).toFixed(1);
            const c = Number(source?.carbs || 0).toFixed(1);
            const f = Number(source?.fats || 0).toFixed(1);
            return `${ctx.label}: ${val} kcal (${pct}%) | P:${p} C:${c} F:${f}`;
          }
        }
      }
    },
    cutout: '62%'
  };

  if (loading) {
    return <div style={{ padding: 20, textAlign: 'center', color: '#94a3b8', fontWeight: 700 }}>Loading today's foods...</div>;
  }

  if (cleanFoods.length === 0) {
    return <div style={{ padding: 20, textAlign: 'center', color: '#94a3b8', fontWeight: 700 }}>No foods available for today's plan.</div>;
  }

  return (
    <div style={{ width: '100%', display: 'grid', gap: 14 }}>
      <style>{`
        .pie-chart-legend::-webkit-scrollbar {
          display: none;
        }
      `}</style>
      <div style={{ position: 'relative', width: '100%', height: 340 }}>
        <Doughnut data={chartData} options={chartOptions} />
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            textAlign: 'center'
          }}
        >
          <div style={{ fontSize: '2.2rem', fontWeight: 800, color: '#10b981' }}>{Math.round(total)}</div>
          <div style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' }}>KCAL</div>
        </div>
      </div>
    </div>
  );
};

export default DailyFoodPieChart;
