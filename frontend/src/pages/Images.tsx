import React, { useEffect, useState, useRef } from 'react'
import api from '../api'

function Images() {
  const [food, setFood] = useState<string>('')
  const [grams, setGrams] = useState<number>(100)
  const [kcal, setKcal] = useState<number>(0)
  const [motive, setMotive] = useState<string>('remain fit and healthy')
  const [foods, setFoods] = useState<string[]>([])
  const [filteredFoods, setFilteredFoods] = useState<string[]>([])
  const [per100, setPer100] = useState<number>(0)
  const [nutriRow, setNutriRow] = useState<Record<string, any> | null>(null)
  const [showDropdown, setShowDropdown] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    api.get('/profile').then(r => setMotive(r.data.motive || 'remain fit and healthy'))
    api.get('/images/foods').then(r => {
      const list = Array.isArray(r.data) ? r.data : []
      setFoods(list)
      setFilteredFoods(list)
    })

    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  async function fetchNutrition(foodName: string) {
    try {
      const r = await api.get('/images/nutrition', { params: { food: foodName } })
      if (r.data) {
        setNutriRow(r.data)
        setPer100(Number(r.data.calories_per_100g || 0))
      }
    } catch {
      setNutriRow(null); setPer100(0)
    }
  }

  const handleInputChange = (val: string) => {
    setFood(val); 
    setFilteredFoods(foods.filter(f => f.toLowerCase().includes(val.toLowerCase())))
    setShowDropdown(true)
  }

  const selectFood = (val: string) => {
    setFood(val); setShowDropdown(false); fetchNutrition(val)
  }

  const compute = () => setKcal(Math.round((per100 * grams) / 100))

  const getNutrient = (keys: string[]) => {
    if (!nutriRow) return 0
    const foundKey = Object.keys(nutriRow).find(k => keys.some(s => k.toLowerCase().includes(s.toLowerCase())))
    return (Number(nutriRow[foundKey || ''] || 0) * grams) / 100
  }

  return (
    <div className="analyzer-container">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');

        .analyzer-container {
          padding: 3rem 1.5rem;
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: calc(100vh - 80px);
          font-family: 'Plus Jakarta Sans', sans-serif;
          background:
            radial-gradient(circle at 15% 0%, #e8f7ef 0%, transparent 35%),
            radial-gradient(circle at 100% 100%, #ecf4ff 0%, transparent 45%),
            #f8fafc;
        }

        .glass-card {
          background: white;
          border-radius: 40px;
          width: 100%;
          max-width: 1100px;
          display: grid;
          grid-template-columns: 440px 1fr;
          overflow: hidden;
          box-shadow: 0 40px 100px -20px rgba(0,0,0,0.06);
          border: 1px solid #f1f5f9;
        }

        .controls {
          padding: 4rem;
          background: #ffffff;
          border-right: 1px solid #f1f5f9;
        }

        .controls h1 {
          font-size: 2.5rem;
          font-weight: 800;
          letter-spacing: -1.5px;
          margin: 0 0 10px 0;
          color: #1e293b;
        }

        .goal-tag {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 8px 16px;
          background: #f0fdf4;
          color: #16a34a;
          border-radius: 14px;
          font-size: 0.85rem;
          font-weight: 700;
          margin-bottom: 40px;
          border: 1px solid #dcfce7;
        }

        .meta-strip {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
          margin: 0 0 24px;
        }

        .meta-card {
          border: 1px solid #e2e8f0;
          background: #f8fafc;
          border-radius: 14px;
          padding: 10px 12px;
        }

        .meta-card .k {
          display: block;
          font-size: 0.7rem;
          text-transform: uppercase;
          letter-spacing: 0.4px;
          color: #64748b;
          font-weight: 800;
        }

        .meta-card .v {
          display: block;
          margin-top: 4px;
          font-size: 0.95rem;
          color: #0f172a;
          font-weight: 800;
        }

        .input-group label {
          font-size: 0.8rem;
          font-weight: 800;
          color: #94a3b8;
          text-transform: uppercase;
          margin-bottom: 12px;
          display: block;
          letter-spacing: 0.5px;
        }

        .input-group input {
          width: 100%;
          padding: 18px 22px;
          border: 1px solid #e2e8f0;
          border-radius: 20px;
          font-size: 1rem;
          font-family: inherit;
          font-weight: 600;
          background: #f8fafc;
          transition: all 0.3s ease;
          box-sizing: border-box;
          color: #1e293b;
        }

        .input-group input:focus {
          outline: none;
          border-color: #6366f1;
          background: white;
          box-shadow: 0 10px 20px rgba(99, 102, 241, 0.05);
        }

        .dropdown {
          position: absolute;
          top: calc(100% + 10px);
          left: 0;
          right: 0;
          background: white;
          border-radius: 20px;
          box-shadow: 0 20px 40px rgba(0,0,0,0.1);
          z-index: 100;
          max-height: 220px;
          overflow-y: auto;
          border: 1px solid #f1f5f9;
          padding: 10px;
        }

        .dropdown-item {
          padding: 12px 18px;
          cursor: pointer;
          border-radius: 12px;
          font-weight: 600;
          font-size: 0.95rem;
          color: #475569;
          transition: 0.2s;
        }

        .dropdown-item:hover {
          background: #f1f5f9;
          color: #6366f1;
        }

        .action-btn {
          width: 100%;
          padding: 20px;
          background: #1e293b;
          color: white;
          border: none;
          border-radius: 22px;
          font-weight: 800;
          font-size: 1rem;
          cursor: pointer;
          transition: all 0.3s;
          margin-top: 30px;
          box-shadow: 0 10px 25px rgba(30, 41, 59, 0.2);
        }

        .action-btn:hover {
          background: #000;
          transform: translateY(-2px);
          box-shadow: 0 15px 30px rgba(0,0,0,0.2);
        }

        .display {
          padding: 4rem;
          background: #fcfcfd;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          position: relative;
        }

        .display-title {
          width: 100%;
          max-width: 480px;
          margin-bottom: 16px;
          color: #334155;
          font-weight: 800;
          letter-spacing: -0.2px;
        }

        .kcal-circle {
          width: 280px;
          height: 280px;
          border-radius: 50%;
          background: white;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          margin-bottom: 50px;
          position: relative;
          box-shadow: 0 40px 80px rgba(0,0,0,0.06);
          border: 2px solid #f1f5f9;
        }

        .kcal-circle h2 {
          font-size: 5rem;
          margin: 0;
          font-weight: 900;
          color: #1e293b;
          letter-spacing: -2px;
        }

        .kcal-label {
          color: #94a3b8;
          font-weight: 800;
          text-transform: uppercase;
          font-size: 0.85rem;
          letter-spacing: 1.5px;
        }

        .macro-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 16px;
          width: 100%;
          max-width: 480px;
        }

        .macro-pill {
          padding: 24px;
          border-radius: 28px;
          text-align: left;
          color: white;
          transition: 0.3s ease;
          position: relative;
          overflow: hidden;
        }

        .macro-pill:hover { 
          transform: translateY(-5px);
        }

        .macro-pill .label {
          font-size: 0.75rem;
          text-transform: uppercase;
          opacity: 0.9;
          display: block;
          margin-bottom: 6px;
          font-weight: 800;
          letter-spacing: 0.5px;
        }

        .macro-pill .value {
          font-size: 1.5rem;
          font-weight: 800;
        }

        .empty-state {
          text-align: center;
          color: #94a3b8;
        }

        @media (max-width: 950px) {
          .glass-card { grid-template-columns: 1fr; border-radius: 30px; }
          .controls { border-right: none; border-bottom: 1px solid #f1f5f9; padding: 2.5rem; }
          .display { padding: 3rem; }
          .meta-strip { grid-template-columns: 1fr; }
        }
      `}</style>

      <div className="glass-card">
        <section className="controls">
          <h1>Nutrition Analyzer</h1>
          <div className="goal-tag">Goal: {motive}</div>

          <div className="meta-strip">
            <div className="meta-card">
              <span className="k">Per 100g</span>
              <span className="v">{per100 ? `${per100.toFixed(0)} kcal` : 'Not selected'}</span>
            </div>
            <div className="meta-card">
              <span className="k">Selected Qty</span>
              <span className="v">{grams} g</span>
            </div>
          </div>

          <div className="input-group" ref={dropdownRef} style={{ position: 'relative' }}>
            <label>Nutrition Source</label>
            <input
              type="text"
              value={food}
              placeholder="Search eg: Chicken..."
              onFocus={() => setShowDropdown(true)}
              onChange={(e) => handleInputChange(e.target.value)}
            />
            {showDropdown && filteredFoods.length > 0 && (
              <div className="dropdown">
                {filteredFoods.map(f => (
                  <div key={f} className="dropdown-item" onClick={() => selectFood(f)}>{f}</div>
                ))}
              </div>
            )}
          </div>

          <div className="input-group" style={{ marginTop: '24px' }}>
            <label>Quantity (Grams)</label>
            <input 
              type="number" 
              value={grams} 
              onChange={e => setGrams(Number(e.target.value))} 
            />
          </div>

          <button className="action-btn" onClick={compute}>
            Generate Insights
          </button>
        </section>

        <section className="display">
          <div className="display-title">Nutrition Breakdown</div>
          {kcal > 0 ? (
            <>
              <div className="kcal-circle">
                <h2>{kcal}</h2>
                <span className="kcal-label">Calories</span>
              </div>

              <div className="macro-grid">
                <div className="macro-pill" style={{ background: 'linear-gradient(135deg, #f43f5e, #e11d48)' }}>
                  <span className="label">Protein</span>
                  <div className="value">{getNutrient(['protein']).toFixed(1)}g</div>
                </div>
                <div className="macro-pill" style={{ background: 'linear-gradient(135deg, #3b82f6, #2563eb)' }}>
                  <span className="label">Carbs</span>
                  <div className="value">{getNutrient(['carb']).toFixed(1)}g</div>
                </div>
                <div className="macro-pill" style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}>
                  <span className="label">Fats</span>
                  <div className="value">{getNutrient(['fat']).toFixed(1)}g</div>
                </div>
                <div className="macro-pill" style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}>
                  <span className="label">Fiber</span>
                  <div className="value">{getNutrient(['fiber','fibre']).toFixed(1)}g</div>
                </div>
              </div>
            </>
          ) : (
            <div className="empty-state">
              <div style={{ fontSize: '2.2rem', marginBottom: '1rem', fontWeight: 900 }}>NUTRI</div>
              <p style={{ fontWeight: 700, fontSize: '1.1rem', color: '#64748b' }}>Enter details to analyze nutrition</p>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

export default Images

