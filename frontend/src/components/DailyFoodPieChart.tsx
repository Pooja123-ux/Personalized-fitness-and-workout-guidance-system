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
    return <div style={{ padding: 20, textAlign: 'center', color: '#64748b', fontWeight: 700 }}>Loading today's foods...</div>;
  }

  if (cleanFoods.length === 0) {
    return <div style={{ padding: 20, textAlign: 'center', color: '#64748b', fontWeight: 700 }}>No foods available for today's plan.</div>;
  }

  return (
    <div style={{ width: '100%', display: 'grid', gap: 14 }}>
      <div style={{ position: 'relative', width: '100%', height: 260 }}>
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
          <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0f172a' }}>{Math.round(total)}</div>
          <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 700 }}>KCAL TODAY</div>
        </div>
      </div>

      <div style={{ display: 'grid', gap: 8, maxHeight: 190, overflowY: 'auto' }}>
        {cleanFoods.map((f, idx) => {
          const pct = total > 0 ? Math.round((Number(f.calories || 0) / total) * 100) : 0;
          return (
            <div
              key={`${f.name}-${idx}`}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: 10,
                padding: '8px 10px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                <span style={{ width: 10, height: 10, borderRadius: 999, background: COLORS[idx % COLORS.length], flexShrink: 0 }} />
                <span style={{ fontSize: '0.83rem', color: '#334155', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {f.name}
                </span>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.8rem', color: '#0f172a', fontWeight: 800 }}>{Math.round(f.calories)} kcal ({pct}%)</div>
                <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 700 }}>
                  P:{Number(f.protein || 0).toFixed(1)} C:{Number(f.carbs || 0).toFixed(1)} F:{Number(f.fats || 0).toFixed(1)}
                  {typeof f.item_count === 'number' ? ` • ${f.item_count} item${f.item_count === 1 ? '' : 's'}` : ''}
                </div>
                {Array.isArray(f.foods) && f.foods.length > 0 && (
                  <div style={{ fontSize: '0.72rem', color: '#475569', fontWeight: 600, maxWidth: 360, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    Foods: {f.foods.join(', ')}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default DailyFoodPieChart;
