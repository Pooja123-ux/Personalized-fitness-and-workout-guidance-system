import { useEffect, useState } from 'react'
import api, { setToken } from '../api'
import { useNavigate } from 'react-router-dom'
import { useProfile } from '../context/ProfileContext'

/* ===================== TYPES ===================== */

type IntakeFormState = {
  name: string
  age: string
  gender: string
  height_cm: string
  weight_kg: string
  lifestyle_level: 'sedentary' | 'lightly active' | 'moderately active' | 'very active'
  diet_type: 'vegetarian' | 'non vegetarian' | 'vegan'
  water_consumption_l: string
  junk_food_consumption: 'low' | 'moderate' | 'high'
  healthy_food_consumption: 'low' | 'moderate' | 'high'

  target_area: string

  breakfast: string
  lunch: string
  snacks: string
  dinner: string

  motive: 'weight loss' | 'weight gain' | 'build muscle' | 'remain fit and healthy'
  duration_weeks: string
  food_allergies: string
  health_diseases: string
}

function IntakeForm() {
  const { updateProfile, refetch } = useProfile()
  const [form, setForm] = useState<IntakeFormState>({
    name: '',
    age: '',
    gender: '',
    height_cm: '',
    weight_kg: '',
    lifestyle_level: 'sedentary',
    diet_type: 'vegetarian',
    water_consumption_l: '',
    junk_food_consumption: 'low',
    healthy_food_consumption: 'moderate',

    target_area: 'full body',

    breakfast: '',
    lunch: '',
    snacks: '',
    dinner: '',

    motive: 'remain fit and healthy',
    duration_weeks: '',
    food_allergies: '',
    health_diseases: ''
  })

  const [error, setError] = useState('')
  const [currentBMI, setCurrentBMI] = useState<number | null>(null)
  const [currentCalories, setCurrentCalories] = useState<number | null>(null)
  const navigate = useNavigate()

  /* ===================== LOAD PROFILE ===================== */

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (token) setToken(token)

    api.get('/profile')
      .then(r => {
        const p = r.data
        setForm({
          name: p.name || '',
          age: p.age ? String(p.age) : '',
          gender: p.gender || '',
          height_cm: p.height_cm ? String(p.height_cm) : '',
          weight_kg: p.weight_kg ? String(p.weight_kg) : '',
          lifestyle_level: p.lifestyle_level || 'sedentary',
          diet_type: p.diet_type || 'vegetarian',
          water_consumption_l: p.water_consumption_l ? String(p.water_consumption_l) : '',
          junk_food_consumption: p.junk_food_consumption || 'low',
          healthy_food_consumption: p.healthy_food_consumption || 'moderate',

          breakfast: p.breakfast || '',
          lunch: p.lunch || '',
          snacks: p.snacks || '',
          dinner: p.dinner || '',
          target_area: p.target_area || 'full body',
          motive: p.motive || 'remain fit and healthy',
          duration_weeks: p.duration_weeks ? String(p.duration_weeks) : '',
          food_allergies: p.food_allergies || '',
          health_diseases: p.health_diseases || ''
        })
      })
      .catch(() => {})
  }, [])

  /* ===================== HELPERS ===================== */

  function update<K extends keyof IntakeFormState>(key: K, value: any) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    const numericFields: (keyof IntakeFormState)[] = [
      'age',
      'height_cm',
      'weight_kg',
      'water_consumption_l',
      'duration_weeks'
    ]

    for (const field of numericFields) {
      if (!form[field]) {
        setError('Please fill all required numeric fields')
        return
      }
    }

    const payload = {
      ...form,
      age: Number(form.age),
      height_cm: Number(form.height_cm),
      weight_kg: Number(form.weight_kg),
      water_consumption_l: Number(form.water_consumption_l),
      duration_weeks: Number(form.duration_weeks)
    }

    try {
      await api.post('/profile', payload)
      refetch()
      navigate('/dashboard')
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Failed to save profile')
    }
  }

  /* ===================== UI ===================== */

  return (
    <div className="card">
      <div className="title">💪 Health Profile</div>
      <div className="subtitle">Provide details to personalize your fitness plan</div>

      {currentBMI !== null && currentCalories !== null && (
        <div className="current-stats">
          <div className="stat">Current BMI: {currentBMI.toFixed(1)} ({form.weight_kg}kg)</div>
          <div className="stat">Daily Calories: {Math.round(currentCalories)} kcal</div>
        </div>
      )}

      {error && <div className="status">{error}</div>}

      <form onSubmit={submit}>

        {/* BASIC INFO */}
        <div className="grid">
          <div className="field">
            <div className="label">👤 Name</div>
            <input className="input" value={form.name} onChange={e => update('name', e.target.value)} />
          </div>

          <div className="field">
            <div className="label">🎂 Age</div>
            <input className="input" type="number" value={form.age} onChange={e => update('age', e.target.value)} />
          </div>

          <div className="field">
            <div className="label">🚻 Gender</div>
            <input className="input" value={form.gender} onChange={e => update('gender', e.target.value)} />
          </div>

          <div className="field">
            <div className="label">📏 Height (cm)</div>
            <input className="input" type="number" value={form.height_cm} onChange={e => update('height_cm', e.target.value)} />
          </div>

          <div className="field">
            <div className="label">⚖️ Weight (kg)</div>
            <input className="input" type="number" value={form.weight_kg} onChange={e => update('weight_kg', e.target.value)} />
          </div>

          <div className="field">
            <div className="label">🏃 Lifestyle</div>
            <select className="select" value={form.lifestyle_level} onChange={e => update('lifestyle_level', e.target.value)}>
              <option value="sedentary">Sedentary</option>
              <option value="lightly active">Lightly Active</option>
              <option value="moderately active">Moderately Active</option>
              <option value="very active">Very Active</option>
            </select>
          </div>

          <div className="field">
            <div className="label">🥗 Diet Type</div>
            <select className="select" value={form.diet_type} onChange={e => update('diet_type', e.target.value)}>
              <option value="vegetarian">Vegetarian</option>
              <option value="non vegetarian">Non Vegetarian</option>
              <option value="vegan">Vegan</option>
            </select>
          </div>

          <div className="field">
            <div className="label">💧 Water (L/day)</div>
            <input className="input" type="number" value={form.water_consumption_l} onChange={e => update('water_consumption_l', e.target.value)} />
          </div>
        </div>

        {/* FOOD HABITS */}
        <div className="grid section">
          <div className="field">
            <div className="label">🍔 Junk Food</div>
            <select className="select" value={form.junk_food_consumption} onChange={e => update('junk_food_consumption', e.target.value)}>
              <option value="low">Low</option>
              <option value="moderate">Moderate</option>
              <option value="high">High</option>
            </select>
          </div>

          <div className="field">
            <div className="label">🥦 Healthy Food</div>
            <select className="select" value={form.healthy_food_consumption} onChange={e => update('healthy_food_consumption', e.target.value)}>
              <option value="low">Low</option>
              <option value="moderate">Moderate</option>
              <option value="high">High</option>
            </select>
          </div>
        </div>

        {/* MEALS */}
        <div className="section">
          <div className="title">🍽️ Regular Meals</div>

          <div className="field">
            <div className="label">🍳 Breakfast</div>
            <textarea className="textarea" value={form.breakfast} onChange={e => update('breakfast', e.target.value)} />
          </div>

          <div className="field">
            <div className="label">🍛 Lunch</div>
            <textarea className="textarea" value={form.lunch} onChange={e => update('lunch', e.target.value)} />
          </div>

          <div className="field">
            <div className="label">🍪 Snacks</div>
            <textarea className="textarea" value={form.snacks} onChange={e => update('snacks', e.target.value)} />
          </div>

          <div className="field">
            <div className="label">🍲 Dinner</div>
            <textarea className="textarea" value={form.dinner} onChange={e => update('dinner', e.target.value)} />
          </div>
        </div>

        {/* GOALS */}
        <div className="grid section">
          <div className="field">
            <div className="label">🎯 Motive</div>
            <select className="select" value={form.motive} onChange={e => update('motive', e.target.value)}>
              <option value="weight loss">Weight Loss</option>
              <option value="weight gain">Weight Gain</option>
              <option value="build muscle">Build Muscle</option>
              <option value="remain fit and healthy">Remain Fit & Healthy</option>
            </select>
          </div>

          <div className="field">
            <div className="label">🎯 Target Area</div>
            <select className="select" value={form.target_area} onChange={e => update('target_area', e.target.value)}>
              <option value="full body">Full Body</option>
              <option value="upper body">Upper Body</option>
              <option value="lower body">Lower Body</option>
              <option value="core">Core</option>
              <option value="arms">Arms</option>
              <option value="legs">Legs</option>
              <option value="back">Back</option>
              <option value="chest">Chest</option>
              <option value="shoulders">Shoulders</option>
            </select>
          </div>

          <div className="field">
            <div className="label">⏱️ Duration (weeks)</div>
            <input className="input" type="number" value={form.duration_weeks} onChange={e => update('duration_weeks', e.target.value)} />
          </div>

          <div className="field">
            <div className="label">⚠️ Food Allergies</div>
            <input className="input" value={form.food_allergies} onChange={e => update('food_allergies', e.target.value)} />
          </div>

          <div className="field">
            <div className="label">🩺 Health Diseases</div>
            <input className="input" value={form.health_diseases} onChange={e => update('health_diseases', e.target.value)} />
          </div>
        </div>

        <div className="section" style={{ textAlign: 'center' }}>
          <button className="button" type="submit">✅ Save Profile</button>
        </div>

      </form>

      <style>{`
        .current-stats {
          display: flex;
          justify-content: space-around;
          margin-bottom: 20px;
          padding: 10px;
          background: #f0f9ff;
          border-radius: 8px;
        }
        .stat {
          font-weight: bold;
          color: #0369a1;
        }
      `}</style>
    </div>
  )
}

export default IntakeForm
