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
          background: linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%);
          position: relative;
        }

        .analyzer-container::before {
          content: '';
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: radial-gradient(circle at 20% 30%, rgba(16, 185, 129, 0.08) 0%, transparent 50%),
                      radial-gradient(circle at 80% 70%, rgba(99, 102, 241, 0.08) 0%, transparent 50%);
          pointer-events: none;
          z-index: 0;
        }

        .glass-card {
          background: linear-gradient(135deg, #1e293b 0%, #334155 100%);
          border-radius: 40px;
          width: 100%;
          max-width: 1100px;
          display: grid;
          grid-template-columns: 440px 1fr;
          overflow: hidden;
          box-shadow: 0 40px 100px -20px rgba(0,0,0,0.5);
          border: 1px solid #475569;
          position: relative;
          z-index: 1;
        }

        .controls {
          padding: 4rem;
          background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
          border-right: 1px solid #475569;
        }

        .controls h1 {
          font-size: 2.5rem;
          font-weight: 800;
          letter-spacing: -1.5px;
          margin: 0 0 10px 0;
          color: #f1f5f9;
        }

        .goal-tag {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 8px 16px;
          background: linear-gradient(135deg, #064e3b 0%, #065f46 100%);
          color: #a7f3d0;
          border-radius: 14px;
          font-size: 0.85rem;
          font-weight: 700;
          margin-bottom: 40px;
          border: 1px solid #10b981;
        }

        .meta-strip {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
          margin: 0 0 24px;
        }

        .meta-card {
          border: 1px solid #475569;
          background: linear-gradient(135deg, #1e293b 0%, #334155 100%);
          border-radius: 14px;
          padding: 10px 12px;
        }

        .meta-card .k {
          display: block;
          font-size: 0.7rem;
          text-transform: uppercase;
          letter-spacing: 0.4px;
          color: #cbd5e1;
          font-weight: 800;
        }

        .meta-card .v {
          display: block;
          margin-top: 4px;
          font-size: 0.95rem;
          color: #f1f5f9;
          font-weight: 800;
        }

        .input-group label {
          font-size: 0.8rem;
          font-weight: 800;
          color: #cbd5e1;
          text-transform: uppercase;
          margin-bottom: 12px;
          display: block;
          letter-spacing: 0.5px;
        }

        .input-group input {
          width: 100%;
          padding: 18px 22px;
          border: 1px solid #475569;
          border-radius: 20px;
          font-size: 1rem;
          font-family: inherit;
          font-weight: 600;
          background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
          transition: all 0.3s ease;
          box-sizing: border-box;
          color: #f1f5f9;
        }

        .input-group input:focus {
          outline: none;
          border-color: #6366f1;
          background: linear-gradient(135deg, #1e293b 0%, #334155 100%);
          box-shadow: 0 10px 20px rgba(99, 102, 241, 0.2);
        }

        .dropdown {
          position: absolute;
          top: calc(100% + 10px);
          left: 0;
          right: 0;
          background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
          border-radius: 20px;
          box-shadow: 0 20px 40px rgba(0,0,0,0.5);
          z-index: 100;
          max-height: 220px;
          overflow-y: auto;
          border: 1px solid #475569;
          padding: 10px;
        }

        .dropdown-item {
          padding: 12px 18px;
          cursor: pointer;
          border-radius: 12px;
          font-weight: 600;
          font-size: 0.95rem;
          color: #cbd5e1;
          transition: 0.2s;
        }

        .dropdown-item:hover {
          background: linear-gradient(135deg, #1e293b 0%, #334155 100%);
          color: #a78bfa;
        }

        .action-btn {
          width: 100%;
          padding: 20px;
          background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
          color: white;
          border: none;
          border-radius: 22px;
          font-weight: 800;
          font-size: 1rem;
          cursor: pointer;
          transition: all 0.3s;
          margin-top: 30px;
          box-shadow: 0 10px 25px rgba(99, 102, 241, 0.3);
        }

        .action-btn:hover {
          background: linear-gradient(135deg, #4f46e5 0%, #4338ca 100%);
          transform: translateY(-2px);
          box-shadow: 0 15px 30px rgba(99, 102, 241, 0.4);
        }

        .display {
          padding: 4rem;
          background: linear-gradient(135deg, #1e293b 0%, #334155 100%);
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
          color: #f1f5f9;
          font-weight: 800;
          letter-spacing: -0.2px;
        }

        .kcal-circle {
          width: 280px;
          height: 280px;
          border-radius: 50%;
          background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          margin-bottom: 50px;
          position: relative;
          box-shadow: 0 40px 80px rgba(0,0,0,0.4);
          border: 2px solid #475569;
        }

        .kcal-circle h2 {
          font-size: 5rem;
          margin: 0;
          font-weight: 900;
          color: #f1f5f9;
          letter-spacing: -2px;
        }

        .kcal-label {
          color: #cbd5e1;
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
          color: #cbd5e1;
        }

        @media (max-width: 950px) {
          .glass-card { grid-template-columns: 1fr; border-radius: 30px; }
          .controls { border-right: none; border-bottom: 1px solid #475569; padding: 2.5rem; }
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

