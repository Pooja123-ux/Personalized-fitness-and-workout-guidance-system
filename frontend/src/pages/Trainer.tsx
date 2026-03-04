import { useRef, useEffect, useState, useCallback } from 'react'
import { useLocation } from 'react-router-dom'
import { Pose, POSE_CONNECTIONS, Results } from '@mediapipe/pose'
import '@tensorflow/tfjs'
import axios from 'axios'

type ExerciseConfig = {
  pj: string; mn: number; mx: number;
  sj: string; sm: number; sx: number;
  cv: string; rd: string;
  rs: string; re: string;
  ar: string; cf: string;
  ii: boolean; hs: number; sy: string;
}

type WorkoutPlanItem = {
  name: string
  repetitions?: string
  gif_url?: string
  gifUrl?: string
  target?: string
  sets?: number | string
  reps?: string | number
  calories_burned?: number
}

type VoicePriority = 'low' | 'medium' | 'high'
type DailyFormStat = { date: string; avgForm: number | null; reps: number; sessions: number }
type StoredFormSession = { date: string; exercise: string; avgForm: number; reps: number; ts: number }

const DEMO_FALLBACK_TARGET = '20 reps'
const BODYWEIGHT_SQUATS_FALLBACK_TARGET = '5 reps'
const COOLDOWN_MS          = 600
const NO_POSE_THRESHOLD    = 10
const SMOOTHING_FRAMES     = 5
const MIN_VIS              = 0.5
const KEYPOINT_VIS         = 0.3
const FAULT_REPEAT_MS      = 5000   // min ms between repeating same fault cue
const FEEDBACK_REPEAT_MS   = 3000   // min ms between repeating same feedback template
const FORM_HISTORY_KEY     = 'trainer_form_history_v1'
const POSITIVE_PHRASES     = [
  'Great rep! Keep it up!',
  'Perfect form! Nice work!',
  'That\'s it! Strong rep!',
  'Yes! Keep going!',
  'Beautiful! One more!',
  'Excellent! You\'re on fire!',
]

const LM = {
  nose:0, l_shoulder:11, r_shoulder:12,
  l_elbow:13, r_elbow:14, l_wrist:15, r_wrist:16,
  l_index:19, r_index:20,
  l_hip:23, r_hip:24, l_knee:25, r_knee:26,
  l_ankle:27, r_ankle:28, l_foot:31, r_foot:32,
}

const TRIPLET_L: Record<string, [number,number,number]> = {
  elbow:    [LM.l_shoulder, LM.l_elbow,    LM.l_wrist],
  knee:     [LM.l_hip,      LM.l_knee,     LM.l_ankle],
  hip:      [LM.l_shoulder, LM.l_hip,      LM.l_knee],
  shoulder: [LM.l_elbow,    LM.l_shoulder, LM.l_hip],
  spine:    [LM.l_shoulder, LM.l_hip,      LM.l_knee],
  ankle:    [LM.l_knee,     LM.l_ankle,    LM.l_foot],
  wrist:    [LM.l_elbow,    LM.l_wrist,    LM.l_index],
  cervical: [LM.l_shoulder, LM.nose,       LM.r_shoulder],
}
const TRIPLET_R: Record<string, [number,number,number]> = {
  elbow:    [LM.r_shoulder, LM.r_elbow,    LM.r_wrist],
  knee:     [LM.r_hip,      LM.r_knee,     LM.r_ankle],
  hip:      [LM.r_shoulder, LM.r_hip,      LM.r_knee],
  shoulder: [LM.r_elbow,    LM.r_shoulder, LM.r_hip],
  spine:    [LM.r_shoulder, LM.r_hip,      LM.r_knee],
  ankle:    [LM.r_knee,     LM.r_ankle,    LM.r_foot],
  wrist:    [LM.r_elbow,    LM.r_wrist,    LM.r_index],
  cervical: [LM.l_shoulder, LM.nose,       LM.r_shoulder],
}
const IMPORTANT_JOINTS = [LM.l_hip, LM.r_hip, LM.l_knee, LM.r_knee, LM.l_shoulder, LM.r_shoulder]

function toDateKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function getLastNDates(n: number): string[] {
  const out: string[] = []
  const now = new Date()
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(now.getDate() - i)
    out.push(toDateKey(d))
  }
  return out
}

function formatDateDayMonth(dateKey: string): string {
  const parts = (dateKey || '').split('-')
  if (parts.length !== 3) return dateKey
  const dd = parts[2]
  const mm = parts[1]
  return `${dd}-${mm}`
}

function readFormHistory(): StoredFormSession[] {
  try {
    const raw = localStorage.getItem(FORM_HISTORY_KEY)
    const arr = raw ? JSON.parse(raw) : []
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
}

function writeFormHistory(rows: StoredFormSession[]) {
  try { localStorage.setItem(FORM_HISTORY_KEY, JSON.stringify(rows.slice(-500))) } catch { /* ignore */ }
}

function canonicalExerciseName(name: string): string {
  return (name || '').toLowerCase().replace(/[^a-z0-9]/g, '')
}

function buildLast7DayStats(exercise: string): DailyFormStat[] {
  const ex = canonicalExerciseName(exercise)
  const all = readFormHistory().filter(x => canonicalExerciseName(x.exercise || '') === ex)
  const days = getLastNDates(7)
  return days.map((date) => {
    const rows = all.filter(r => r.date === date)
    const reps = rows.reduce((a, b) => a + Math.max(0, b.reps || 0), 0)
    const weighted = rows.reduce((a, b) => a + (b.avgForm * Math.max(1, b.reps || 0)), 0)
    const denom = rows.reduce((a, b) => a + Math.max(1, b.reps || 0), 0)
    return { date, avgForm: denom > 0 ? Math.round(weighted / denom) : null, reps, sessions: rows.length }
  })
}

function getExerciseConfig(name: string, lookup: Record<string, ExerciseConfig>): ExerciseConfig | null {
  const key = name.toLowerCase().trim()
  if (lookup[key]) return lookup[key]
  let best: ExerciseConfig | null = null; let bestLen = 0
  for (const [k, v] of Object.entries(lookup)) {
    if (key.includes(k) || k.includes(key)) { if (k.length > bestLen) { best = v; bestLen = k.length } }
  }
  if (best) return best
  const keywords: Record<string, Partial<ExerciseConfig>> = {
    'squat':     { pj:'knee',     mn:70,  mx:170, sj:'hip',      sm:45,  sx:160, cv:'side', rd:'flex_extend', ar:'Knees over toes; chest up; heels flat',                 cf:'Knee valgus; heel rise; forward lean' },
    'push':      { pj:'shoulder', mn:70,  mx:170, sj:'spine',    sm:160, sx:180, cv:'side', rd:'flex_extend', ar:'Body straight; elbows 45 from body; core braced',       cf:'Hips sagging; flared elbows; partial ROM' },
    'curl':      { pj:'elbow',    mn:30,  mx:165, sj:'shoulder', sm:0,   sx:20,  cv:'side', rd:'flex_extend', ar:'Upper arm pinned; no shoulder swing; wrist neutral',     cf:'Shoulder cheating; wrist bending; partial extension' },
    'press':     { pj:'shoulder', mn:70,  mx:175, sj:'spine',    sm:160, sx:180, cv:'side', rd:'flex_extend', ar:'Core braced; wrists over elbows; no lower back arch',    cf:'Elbow flare; wrist deviation; back arch' },
    'row':       { pj:'elbow',    mn:40,  mx:160, sj:'spine',    sm:155, sx:180, cv:'side', rd:'flex_extend', ar:'Lead with elbow; retract scapula; chest up',             cf:'Shoulder shrug; rounding back; momentum' },
    'lunge':     { pj:'knee',     mn:80,  mx:170, sj:'hip',      sm:80,  sx:170, cv:'side', rd:'flex_extend', ar:'Front knee over ankle; torso upright; no knee drift',    cf:'Knee caving; torso lean; heel lifting' },
    'deadlift':  { pj:'hip',      mn:45,  mx:170, sj:'knee',     sm:150, sx:175, cv:'side', rd:'flex_extend', ar:'Neutral spine; bar close to body; shoulder blades back', cf:'Back rounding; bar drifting; early knee extension' },
    'plank':     { pj:'spine',    mn:160, mx:180, sj:'hip',      sm:160, sx:180, cv:'side', rd:'flex_extend', ar:'Hips level; shoulders over wrists; head neutral',        cf:'Hips sagging/piking; shoulder shrug; breath holding', ii:true, hs:30 },
    'sit-up':    { pj:'spine',    mn:20,  mx:85,  sj:'hip',      sm:85,  sx:130, cv:'side', rd:'flex_extend', ar:'Lower back on floor; chin tucked; no neck pulling',      cf:'Pulling neck; hip flexors dominating; bouncing' },
    'crunch':    { pj:'spine',    mn:30,  mx:80,  sj:'hip',      sm:90,  sx:110, cv:'side', rd:'flex_extend', ar:'Small controlled motion; exhale on way up; lower back flat', cf:'Pulling neck; full sit-up motion; breath holding' },
    'raise':     { pj:'shoulder', mn:10,  mx:90,  sj:'elbow',    sm:150, sx:180, cv:'front', rd:'abduct_adduct', ar:'Lead with elbow; no shrug; control descent',         cf:'Shrugging; swinging; above 90' },
    'fly':       { pj:'shoulder', mn:140, mx:170, sj:'elbow',    sm:150, sx:180, cv:'front', rd:'abduct_adduct', ar:'Maintain slight elbow bend; arc motion; squeeze at top', cf:'Bending elbows too much; no squeeze; excessive weight' },
    'dip':       { pj:'elbow',    mn:70,  mx:165, sj:'shoulder', sm:80,  sx:180, cv:'side', rd:'flex_extend', ar:'Elbows close; full ROM; controlled descent',             cf:'Partial ROM; dropping fast; shoulder impingement' },
    'extension': { pj:'elbow',    mn:20,  mx:150, sj:'shoulder', sm:150, sx:180, cv:'side', rd:'flex_extend', ar:'Upper arm still; only forearm moves; lock out',          cf:'Upper arm moving; using shoulder; partial ROM' },
    'calf':      { pj:'ankle',    mn:70,  mx:110, sj:'knee',     sm:155, sx:180, cv:'side', rd:'flex_extend', ar:'Full ROM; slow descent; legs straight',                 cf:'Bouncing; partial ROM; ankle rolling' },
    'jump':      { pj:'knee',     mn:70,  mx:170, sj:'hip',      sm:70,  sx:170, cv:'side', rd:'flex_extend', ar:'Soft landing; knees over toes; use arms',               cf:'Stiff landing; knee valgus; no arm swing' },
    'run':       { pj:'knee',     mn:60,  mx:170, sj:'hip',      sm:60,  sx:170, cv:'side', rd:'flex_extend', ar:'Forward lean; high knee drive; arms at 90',            cf:'Overstriding; upright; low knee drive' },
    'bridge':    { pj:'hip',      mn:90,  mx:170, sj:'knee',     sm:80,  sx:100, cv:'side', rd:'flex_extend', ar:'Push through heels; squeeze glutes; no lumbar hyperextension', cf:'Lumbar hyperextension; knees caving; incomplete ROM' },
    'pull-up':   { pj:'elbow',    mn:40,  mx:170, sj:'shoulder', sm:90,  sx:180, cv:'front', rd:'flex_extend', ar:'Depress scapula first; full extension; no kipping',   cf:'Kipping; not reaching full extension; shoulder shrug' },
    'twist':     { pj:'spine',    mn:30,  mx:90,  sj:'hip',      sm:155, sx:180, cv:'front', rd:'rotate',       ar:'Hips fixed; rotate thoracic spine; controlled',       cf:'Hips rotating; insufficient ROM; speed over control' },
  }
  for (const [kw, partial] of Object.entries(keywords)) {
    if (key.includes(kw)) {
      return {
        pj: partial.pj ?? 'spine', mn: partial.mn ?? 90, mx: partial.mx ?? 170,
        sj: partial.sj ?? '', sm: partial.sm ?? 0, sx: partial.sx ?? 0,
        cv: partial.cv ?? 'side', rd: partial.rd ?? 'flex_extend',
        rs: '', re: '', ar: partial.ar ?? '', cf: partial.cf ?? '',
        ii: partial.ii ?? false, hs: partial.hs ?? 30, sy: 'b',
      }
    }
  }
  return { pj:'knee', mn:70, mx:170, sj:'hip', sm:60, sx:170, cv:'side', rd:'flex_extend', rs:'', re:'', ar:'Maintain good form throughout', cf:'Ensure full range of motion', ii:false, hs:30, sy:'b' }
}

// Build a specific correction message based on what angle is wrong and why
function buildAngleCorrectionCue(
  joint: string, angle: number, min: number, max: number,
  direction: 'too_low' | 'too_high', faultLabel: string
): string {
  const rounded = Math.round(angle)
  const target  = direction === 'too_low' ? min : max
  const diff    = Math.abs(target - rounded)

  if (direction === 'too_low') {
    const cues: Record<string, string> = {
      knee:     `Your knee angle is ${rounded}. You need to bend more  aim for ${min} or lower. Go deeper into the squat.`,
      elbow:    `Your elbow is at ${rounded}. Curl more  get it down to ${min}. Squeeze that bicep.`,
      hip:      `Your hip angle is ${rounded}. Hinge further forward  reach ${min}.`,
      shoulder: `Your shoulder is at ${rounded}. Lower the weight more, target is ${min}.`,
      spine:    `Your spine angle is ${rounded}. You need to bend more  reach ${min}.`,
      ankle:    `Your ankle is at ${rounded}. Push further  target ${min}.`,
    }
    return cues[joint] ?? `Your ${joint} angle is ${rounded}, which is too shallow. Aim for ${min}  bend ${diff} more.`
  } else {
    const cues: Record<string, string> = {
      knee:     `Your knee is at ${rounded}. You are not going deep enough  bend to ${max} at least.`,
      elbow:    `Your elbow is at ${rounded}. Don't swing  control the movement and lower to ${max}.`,
      hip:      `Your hip is at ${rounded}. Stand taller  reach ${max}.`,
      shoulder: `Your shoulder is at ${rounded}. Raise higher  target is ${max}.`,
      spine:    `Your spine is at ${rounded}. Over-extending  keep it under ${max}.`,
      ankle:    `Your ankle is at ${rounded}. Too much  keep it within ${max}.`,
    }
    return cues[joint] ?? `Your ${joint} angle is ${rounded}. Target is ${max}  adjust by ${diff}.`
  }
}

// Map secondary fault keywords  actionable correction
const FAULT_CUE_MAP: Record<string, string> = {
  'knee valgus':           'Your knees are caving in. Push them out to track over your toes.',
  'heel rise':             'Your heels are lifting. Keep them flat on the ground.',
  'forward lean':          'You are leaning too far forward. Chest up  stay upright.',
  'hips sagging':          'Your hips are dropping. Squeeze your core and lift your hips level.',
  'hips piking':           'Your hips are too high. Lower them to form a straight line.',
  'flared elbows':         'Your elbows are flaring out. Bring them in closer to your body.',
  'partial rom':           'You are not going through full range. Go all the way down and all the way up.',
  'shoulder cheating':     'Your shoulder is swinging. Pin your upper arm and only move your forearm.',
  'wrist bending':         'Your wrist is bending. Keep it straight and neutral throughout.',
  'partial extension':     'You are not fully extending. Lock out at the bottom of each rep.',
  'shoulder shrug':        'Your shoulders are shrugging. Relax and pull them down and back.',
  'rounding back':         'Your back is rounding. Straighten up  neutral spine.',
  'momentum':              'You are using momentum. Slow down and control both directions.',
  'back rounding':         'Your back is rounding. Hinge at the hips and keep your spine flat.',
  'bar drifting':          'The bar is drifting away from your body. Keep it close throughout.',
  'early knee extension':  'You are straightening your knees too early. Hips back first, then stand.',
  'pulling neck':          'Stop pulling your neck. Use your core to lift  not your hands.',
  'hip flexors dominating':'Your hip flexors are taking over. Focus on squeezing your abs.',
  'bouncing':              'Stop bouncing off the floor. Slow down and control each rep.',
  'shrugging':             'Your shoulders are shrugging. Keep them down and lead with your elbow.',
  'swinging':              'You are swinging. Control the movement  no momentum.',
  'above 90':              'Stop at shoulder height. Do not raise above 90 degrees.',
  'upper arm moving':      'Your upper arm is moving. Lock it in place  only your forearm moves.',
  'using shoulder':        'Your shoulder is engaging. Keep it out of it  isolation movement.',
  'kipping':               'No kipping. Strict form  controlled pull only.',
  'not reaching full extension': 'You are not reaching full extension. Lower all the way down.',
  'hips rotating':         'Your hips are rotating. Keep them square  only rotate your torso.',
  'insufficient rom':      'You are not rotating enough. Get full range through your thoracic spine.',
  'speed over control':    'Slow down. Control always beats speed.',
  'knee caving':           'Your knee is caving in. Push it out in line with your foot.',
  'torso lean':            'You are leaning forward. Keep your torso upright.',
  'heel lifting':          'Your heel is lifting. Drive through it  keep it planted.',
  'stiff landing':         'You are landing stiff. Bend your knees to absorb the impact.',
  'no arm swing':          'Use your arms. They help with power and balance.',
  'breath holding':        'Keep breathing. Exhale on the effort, inhale on the return.',
  'elbow flare':           'Your elbows are flaring. Tuck them in under your wrists.',
  'wrist deviation':       'Your wrist is deviating. Keep it straight under load.',
  'back arch':             'You are arching your lower back. Brace your core and flatten it.',
  'lumbar hyperextension': 'You are over-arching your lower back. Squeeze your glutes instead.',
  'knees caving':          'Your knees are caving. Push them out over your second toe.',
  'incomplete rom':        'Drive your hips all the way up. Full extension at the top.',
  'ankle rolling':         'Your ankles are rolling. Keep weight centred  don\'t let them roll.',
  'no squeeze':            'Squeeze at the top. Get that contraction.',
  'shoulder impingement':  'Do not lock your elbows at the top. Keep a slight bend.',
  'lock out':              'Fully lock out at the top of the movement.',
  'dropping fast':         'You are dropping too fast. Two seconds down, one second up.',
}

function getFaultCue(fault: string): string {
  const lower = fault.toLowerCase()
  for (const [key, cue] of Object.entries(FAULT_CUE_MAP)) {
    if (lower.includes(key)) return cue
  }
  return `Check your form: ${fault}.`
}

function parseFaults(cfString: string): string[] {
  return cfString.split(';').map(s => s.trim()).filter(Boolean)
}
function parseAlignmentRules(arString: string): string[] {
  return arString.split(';').map(s => s.trim()).filter(Boolean)
}

function Trainer() {
  const videoRef  = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  const [ready, setReady]                         = useState(false)
  const [cameraError, setCameraError]             = useState<string | null>(null)
  const [cameraStatus, setCameraStatus]           = useState<'idle'|'requesting'|'ready'|'error'>('idle')
  const [cameraRetryToken, setCameraRetryToken]   = useState(0)
  const [reps, setReps]                           = useState(0)
  const [stage, setStage]                         = useState<'UP'|'DOWN'|'NONE'>('NONE')
  const [feedback, setFeedback]                   = useState('Position yourself in view')
  const [sessionTime, setSessionTime]             = useState(0)
  const [caloriesBurned, setCaloriesBurned]       = useState(0)
  const [formScore, setFormScore]                 = useState(100)
  const [, setPoseMatchScore]                     = useState(100)
  const [poseDetected, setPoseDetected]           = useState(false)
  const [isResting, setIsResting]                 = useState(false)
  const [restTimer, setRestTimer]                 = useState(0)
  const [liveAngles, setLiveAngles]               = useState<Record<string,number>>({})
  const [referenceAngles, setReferenceAngles]     = useState<Record<string,number>>({})
  const [currentFault, setCurrentFault]           = useState('')
  const [exerciseConfig, setExerciseConfig]       = useState<ExerciseConfig | null>(null)
  const [voiceEnabled, setVoiceEnabled]           = useState(false)
  const [plan, setPlan]                           = useState<WorkoutPlanItem[]>([])
  const [instructions, setInstructions]           = useState<string[]>([])
  const [exerciseMetadata, setExerciseMetadata]   = useState<any>(null)
  const [gifSrc, setGifSrc]                       = useState<string>('')
  const [apiGifSrc, setApiGifSrc]                 = useState<string>('')
  const [targetTotal, setTargetTotal]             = useState<number | null>(null)
  const [targetDurationSec, setTargetDurationSec] = useState<number | null>(null)
  const [holdElapsedSec, setHoldElapsedSec]       = useState(0)
  const [exerciseAvgRepForm, setExerciseAvgRepForm] = useState<number | null>(null)
  const [exerciseRepSamples, setExerciseRepSamples] = useState(0)
  const [last7DayForm, setLast7DayForm]             = useState<DailyFormStat[]>([])

  // Refs
  const planRef          = useRef<WorkoutPlanItem[]>([])
  const configRef        = useRef<ExerciseConfig | null>(null)
  const instructionsRef  = useRef<string[]>([])
  const repsRef          = useRef(0)
  const voiceEnabledRef  = useRef(false)
  const streamRef        = useRef<MediaStream | null>(null)
  const poseRef          = useRef<Pose | null>(null)
  const gifPoseRef       = useRef<Pose | null>(null)

  // Rep counting
  const lastRepTime     = useRef(0)
  const lastStageRef    = useRef<'UP'|'DOWN'|'NONE'>('NONE')
  const repPhase        = useRef<'up'|'down'>('up')
  const consecutiveDown = useRef(0)
  const consecutiveUp   = useRef(0)
  const repEligibleThisCycle = useRef(false)
  const repSeekExtreme = useRef<'low' | 'high' | null>(null)
  const halfCycleCount = useRef(0)

  // Angle smoothing
  const angleBufferL = useRef<Record<string, number[]>>({})
  const angleBufferR = useRef<Record<string, number[]>>({})

  // Pose state
  const lastAnglesRef   = useRef<Record<string,number>>({})
  const poseStableFrames = useRef(0)
  const isPoseStableRef = useRef(false)
  const lastLandmarksRef = useRef<any | null>(null)
  const noPoseFrames    = useRef(0)

  // Voice
  const voiceQueue   = useRef<string[]>([])
  const isSpeaking   = useRef(false)
  const lastVoiceTime = useRef(0)
  const lastFaultSpoken = useRef('')
  const lastFaultTime   = useRef(0)
  const lastRepSpokenRef = useRef(0)
  const voiceAnnouncedRef = useRef(false)
  const lastFeedbackVoiceKey = useRef('')
  const lastFeedbackVoiceAt  = useRef(0)
  const lastSpokenTextRef = useRef('')
  const lastSpokenTextAtRef = useRef(0)
  const formScoreSumRef = useRef(0)
  const formScoreSamplesRef = useRef(0)
  const repFormScoreSumRef = useRef(0)
  const repFormScoreCountRef = useRef(0)
  const historySavedRef = useRef(false)

  // Navigation
  const advancingRef   = useRef(false)
  const pendingNextRef = useRef<{ href: string } | null>(null)

  // Misc
  const exerciseLookup = useRef<Record<string, ExerciseConfig>>({})

  const location = useLocation()
  const params       = new URLSearchParams(location.search)
  const exerciseName = (params.get('name') || 'Bodyweight Squats').toString()
  const targetReps   = (params.get('reps') || '').toString()
  const fallbackGif  = (params.get('gif') || '').toString()
  const idx          = parseInt((params.get('idx') || '0').toString(), 10)

  const currentPlanItem = plan[idx] || plan.find(p => p.name === exerciseName)

  const enableVoice = useCallback((announce: boolean) => {
    voiceEnabledRef.current = true
    setVoiceEnabled(true)
    const synth = window.speechSynthesis
    if (!synth) return
    if (synth.paused) synth.resume()
    synth.getVoices()
    if (announce) {
      const u = new SpeechSynthesisUtterance('Voice coaching enabled.')
      u.rate = 1
      u.pitch = 1
      u.volume = 1
      synth.cancel()
      synth.speak(u)
    }
  }, [])

  const persistExerciseHistory = useCallback(() => {
    if (historySavedRef.current) return
    const avgFormScore = repFormScoreCountRef.current > 0
      ? Math.round(repFormScoreSumRef.current / repFormScoreCountRef.current)
      : (formScoreSamplesRef.current > 0 ? Math.round(formScoreSumRef.current / formScoreSamplesRef.current) : formScore)
    if (avgFormScore <= 0) return
    const repSamples = repFormScoreCountRef.current
    const history = readFormHistory()
    history.push({
      date: toDateKey(new Date()),
      exercise: exerciseName,
      avgForm: avgFormScore,
      reps: Math.max(0, repSamples),
      ts: Date.now(),
    })
    writeFormHistory(history)
    setLast7DayForm(buildLast7DayStats(exerciseName))
    historySavedRef.current = true
  }, [exerciseName, formScore])

  const finishSession = useCallback(() => {
    persistExerciseHistory()
    if (window.history.length > 1) {
      window.history.back()
      return
    }
    window.location.href = '/dashboard'
  }, [persistExerciseHistory])

  // 
  // VOICE ENGINE
  // 
  const speak = useCallback((text: string, priority: VoicePriority = 'medium') => {
    if (!text?.trim() || !voiceEnabledRef.current) return
    const now = Date.now()
    const normalized = text.trim().toLowerCase().replace(/\d+/g, '#')
    if (normalized === lastSpokenTextRef.current && now - lastSpokenTextAtRef.current < 1500) return
    if (priority === 'low'    && now - lastVoiceTime.current < 5000) return
    if (priority === 'medium' && now - lastVoiceTime.current < 2000) return
    if (!window.speechSynthesis) return
    lastSpokenTextRef.current = normalized
    lastSpokenTextAtRef.current = now
    if (priority === 'high') {
      voiceQueue.current = [text]
      if (isSpeaking.current) { window.speechSynthesis.cancel(); isSpeaking.current = false }
    } else {
      if (isSpeaking.current) { voiceQueue.current.push(text); return }
    }
    const fire = (t: string) => {
      isSpeaking.current = true
      lastVoiceTime.current = Date.now()
      const synth = window.speechSynthesis
      const utter = new SpeechSynthesisUtterance(t)
      utter.rate = 0.95; utter.pitch = 1.05; utter.volume = 1.0
      const voices = synth.getVoices()
      const v = voices.find(v => v.name.includes('Samantha') || v.name.includes('Karen') || v.lang.startsWith('en'))
      if (v) utter.voice = v
      utter.onend = () => {
        isSpeaking.current = false
        if (voiceQueue.current.length > 0) {
          const next = voiceQueue.current.shift()
          if (next) setTimeout(() => fire(next), 200)
        }
      }
      utter.onerror = () => { isSpeaking.current = false }
      if (synth.paused) synth.resume()
      synth.speak(utter)
    }
    fire(text)
  }, [])

  // 
  // CONFIG LOAD
  // 
  useEffect(() => {
    const load = async () => {
      try {
        const base = import.meta.env.VITE_API_BASE || ''
        const res = await fetch(`${base}/exercises/pose-config`)
        if (res.ok) { const json = await res.json(); exerciseLookup.current = json }
      } catch { /* fallback */ }
      const cfg = getExerciseConfig(exerciseName, exerciseLookup.current)
      configRef.current = cfg
      setExerciseConfig(cfg)
      if (cfg?.ii) { setTargetDurationSec(cfg.hs ?? null); setTargetTotal(null) }
    }
    load()
  }, [exerciseName])

  useEffect(() => {
    async function load() {
      const normalize = (s: string) => (s || '').toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').replace(/\s+/g, ' ').trim()
      const cleanInstructions = (arr: unknown): string[] =>
        (Array.isArray(arr) ? arr : [])
          .map(x => String(x ?? '').replace(/^"+|"+$/g, '').trim())
          .filter(Boolean)

      const loadFromLocalDataset = async () => {
        const r = await fetch('/exercises.json')
        if (!r.ok) return []
        const all = await r.json()
        if (!Array.isArray(all)) return []
        const n = normalize(exerciseName)
        const row =
          all.find((x: any) => normalize(String(x?.name || '')) === n) ||
          all.find((x: any) => normalize(String(x?.name || '')).includes(n) || n.includes(normalize(String(x?.name || ''))))
        return cleanInstructions(row?.instructions)
      }

      try {
        const base = import.meta.env.VITE_API_BASE || ''
        const res = await axios.get(`${base}/exercises/instructions`, { params: { name: exerciseName } })
        let list = cleanInstructions(res.data?.instructions)
        if (list.length === 0) list = await loadFromLocalDataset()
        setInstructions(list); instructionsRef.current = list
        setExerciseMetadata(res.data)
        const gif = String(res.data?.resolvedGifUrl || res.data?.localGifUrl || '')
        setApiGifSrc(toAbsoluteApiUrl(import.meta.env.VITE_API_BASE || '', gif))
      } catch {
        const list = await loadFromLocalDataset()
        setInstructions(list)
        instructionsRef.current = list
      }
    }
    load()
  }, [exerciseName])

  useEffect(() => { instructionsRef.current = instructions }, [instructions])
  useEffect(() => { planRef.current = plan }, [plan])
  useEffect(() => { voiceEnabledRef.current = voiceEnabled }, [voiceEnabled])

  // 
  // VOICE ENABLE
  // 
  useEffect(() => {
    const enable = () => {
      enableVoice(false)
      window.removeEventListener('pointerdown', enable)
    }
    window.addEventListener('pointerdown', enable, { once: true })
    return () => window.removeEventListener('pointerdown', enable)
  }, [enableVoice])

  useEffect(() => {
    if (window.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices()
      window.speechSynthesis.getVoices()
    }
  }, [])

  useEffect(() => {
    if (!voiceEnabled || voiceAnnouncedRef.current) return
    voiceAnnouncedRef.current = true
    setTimeout(() => speak(`Let's do ${exerciseName}. I will guide your form as you go.`, 'high'), 400)
  }, [voiceEnabled, speak])

  // Speak anything shown in the bottom feedback pill.
  // Uses a normalized key so angle-number jitter doesn't spam speech every frame.
  useEffect(() => {
    if (!feedback?.trim() || !voiceEnabledRef.current) return
    const cleaned = feedback
      .replace(/[^a-zA-Z0-9\s:%.,!?'"\-_/()]/g, '')
      .replace(/-+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    if (!cleaned) return
    const key = cleaned.toLowerCase().replace(/\d+/g, '#')
    const now = Date.now()
    if (key === lastFeedbackVoiceKey.current && now - lastFeedbackVoiceAt.current < FEEDBACK_REPEAT_MS) return
    lastFeedbackVoiceKey.current = key
    lastFeedbackVoiceAt.current = now
    speak(cleaned, 'medium')
  }, [feedback, speak])

  // 
  // REP FEEDBACK
  // 
  useEffect(() => {
    repsRef.current = reps
    if (reps <= 0 || reps === lastRepSpokenRef.current) return
    lastRepSpokenRef.current = reps
    const cfg = configRef.current
    const phrase = POSITIVE_PHRASES[(reps - 1) % POSITIVE_PHRASES.length]

    if (targetTotal && targetTotal > 0) {
      const remaining = targetTotal - reps
      setFeedback(`Rep ${reps} / ${targetTotal}`)
      if (remaining === 0) { /* advanceNext handles */ }
      else if (remaining <= 3) speak(`${remaining} more to go! ${phrase}`, 'high')
      else speak(`Rep ${reps}. ${phrase}`, 'medium')
    } else {
      setFeedback(`Rep ${reps} done`)
      speak(`Rep ${reps}. ${phrase}`, 'medium')
    }

    // Every 5 reps give alignment reminder
    if (cfg?.ar && reps % 5 === 0) {
      const rule = parseAlignmentRules(cfg.ar)[0]
      if (rule) setTimeout(() => speak(rule, 'medium'), 1500)
    }
  }, [reps, targetTotal, speak])

  // 
  // TIMERS
  // 
  useEffect(() => {
    const i = setInterval(() => setSessionTime(t => t + 1), 1000)
    return () => clearInterval(i)
  }, [])

  useEffect(() => {
    const calMap: Record<string, number> = { squat:0.32, push:0.29, plank:0.15, jump:0.4, burpee:0.5, lunge:0.25, curl:0.22, press:0.28, row:0.27, deadlift:0.35 }
    let cpr = 0.2
    for (const [k, v] of Object.entries(calMap)) { if (exerciseName.toLowerCase().includes(k)) { cpr = v; break } }
    setCaloriesBurned(Math.round(reps * cpr * 10) / 10)
  }, [reps, exerciseName])

  useEffect(() => {
    if (!isResting) return
    if (restTimer <= 0) {
      setIsResting(false)
      const dest = pendingNextRef.current
      if (dest) { pendingNextRef.current = null; speak("Rest complete. Let's go!", 'high'); setTimeout(() => { window.location.href = dest.href }, 800) }
      else speak("Rest complete. Let's go!", 'medium')
      return
    }
    const i = setInterval(() => setRestTimer(t => t - 1), 1000)
    return () => clearInterval(i)
  }, [isResting, restTimer, speak])

  useEffect(() => {
    if (!ready || targetDurationSec === null || isResting) return
    const t = setInterval(() => { if (isPoseStableRef.current) setHoldElapsedSec(s => s + 1) }, 1000)
    return () => clearInterval(t)
  }, [ready, targetDurationSec, isResting])

  // 
  // HELPERS
  // 
  function toAbsoluteApiUrl(base: string, url: string): string {
    if (!url) return ''
    if (url.startsWith('http://') || url.startsWith('https://')) return url
    const b = base.endsWith('/') ? base.slice(0, -1) : base
    const p = url.startsWith('/') ? url : `/${url}`
    return `${b}${p}`
  }

  function buildCameraErrorMessage(err: unknown): string {
    const e = err as { name?: string; message?: string }
    const n = String(e?.name || '')
    const host = window.location.hostname
    const isSecure = window.location.protocol === 'https:' || host === 'localhost' || host === '127.0.0.1'
    if (!isSecure) return 'Camera blocked: open on https:// or localhost.'
    if (n === 'NotAllowedError' || n === 'SecurityError') return 'Camera permission denied. Allow in browser settings and retry.'
    if (n === 'NotFoundError') return 'No camera found on this device.'
    if (n === 'NotReadableError') return 'Camera in use by another app. Close it and retry.'
    return `Unable to start camera${e?.message ? `: ${e.message}` : '.'}`
  }

  function calculateAngle(lm: any[], a: number, b: number, c: number): number {
    const pa = lm[a], pb = lm[b], pc = lm[c]
    if (!pa || !pb || !pc) return 0
    if ((pa.visibility ?? 0) < KEYPOINT_VIS || (pb.visibility ?? 0) < KEYPOINT_VIS || (pc.visibility ?? 0) < KEYPOINT_VIS) return -1
    const ab = { x: pa.x - pb.x, y: pa.y - pb.y }
    const cb = { x: pc.x - pb.x, y: pc.y - pb.y }
    const dot = ab.x * cb.x + ab.y * cb.y
    const m1 = Math.sqrt(ab.x ** 2 + ab.y ** 2), m2 = Math.sqrt(cb.x ** 2 + cb.y ** 2)
    if (m1 === 0 || m2 === 0) return 0
    return (Math.acos(Math.min(1, Math.max(-1, dot / (m1 * m2)))) * 180) / Math.PI
  }

  function smoothAngle(buf: Record<string, number[]>, joint: string, raw: number): number {
    if (raw < 0) return buf[joint]?.[buf[joint].length - 1] ?? 0
    if (!buf[joint]) buf[joint] = []
    buf[joint].push(raw)
    if (buf[joint].length > SMOOTHING_FRAMES) buf[joint].shift()
    return buf[joint].reduce((a, b) => a + b, 0) / buf[joint].length
  }

  function validatePose(lm: any[]): boolean {
    if (!lm?.length) return false
    const confs = IMPORTANT_JOINTS.map(i => lm[i]?.visibility ?? 0).filter(v => v > 0)
    if (!confs.length) return false
    const avg = confs.reduce((a, b) => a + b, 0) / confs.length
    return confs.every(c => c >= KEYPOINT_VIS) && avg >= MIN_VIS
  }

  const resetPoseState = useCallback(() => {
    setPoseDetected(false); setFormScore(0); setPoseMatchScore(0); setLiveAngles({}); setCurrentFault('')
  }, [])

  function detectPoseStability(newAngles: Record<string, number>): boolean {
    if (!Object.keys(lastAnglesRef.current).length) {
      lastAnglesRef.current = newAngles; poseStableFrames.current = 1; isPoseStableRef.current = false; return false
    }
    let stable = true
    for (const [j, a] of Object.entries(newAngles)) {
      const last = lastAnglesRef.current[j]
      if (last !== undefined && Math.abs(a - last) > 12) { stable = false; break }
    }
    poseStableFrames.current = stable ? poseStableFrames.current + 1 : 0
    isPoseStableRef.current = poseStableFrames.current >= 1
    lastAnglesRef.current = newAngles
    return isPoseStableRef.current
  }

  // 
  // NAVIGATION
  // 
  function getPlanRepetitions(item: WorkoutPlanItem): string {
    if (item.repetitions) return item.repetitions
    const s = String(item.sets ?? '').trim(), r = String(item.reps ?? '').trim()
    return s && r ? `${s}x${r}` : ''
  }
  function getPlanGif(item: WorkoutPlanItem): string { return item.gif_url || item.gifUrl || '' }

  function parseSetCount(v: string | number | undefined): number | null {
    const n = parseInt(String(v ?? '').trim(), 10)
    return Number.isFinite(n) && n > 0 ? n : null
  }
  function parseRepCount(v: string | number | undefined): number | null {
    const t = String(v ?? '').toLowerCase().trim()
    if (!t) return null
    const r = t.match(/(\d+)\s*(?:-|to)\s*(\d+)/)
    if (r) { const hi = parseInt(r[2], 10); return Number.isFinite(hi) ? hi : null }
    const f = t.match(/(\d+)/); if (!f) return null
    const n = parseInt(f[1], 10); return Number.isFinite(n) ? n : null
  }

  function goToIndex(i: number, p: WorkoutPlanItem[]) {
    const next = p[i]; if (!next) return
    advancingRef.current = false; setReps(0); setHoldElapsedSec(0); setStage('NONE')
    window.location.href = `/trainer?name=${encodeURIComponent(next.name)}&reps=${encodeURIComponent(getPlanRepetitions(next))}&gif=${encodeURIComponent(getPlanGif(next))}&idx=${i}`
  }

  function parseTarget(text: string): number | null {
    const t = (text || '').toLowerCase().trim(); if (!t) return null
    const sr = t.match(/(\d+)\s*x\s*(\d+)/)
    if (sr) { const s = parseInt(sr[1], 10), r = parseInt(sr[2], 10); if (!isNaN(s) && !isNaN(r)) return s * r }
    const rn = t.match(/(\d+)\s*(?:rep|reps|repetition|repetitions)\b/)
    if (rn) { const v = parseInt(rn[1], 10); if (!isNaN(v)) return v }
    const n = t.match(/\b(\d+)\b/)
    if (n) { const v = parseInt(n[1], 10); if (!isNaN(v)) return v }
    return null
  }

  function parseDurationSeconds(text: string): number | null {
    const t = (text || '').toLowerCase().trim(); if (!t) return null
    const s = t.match(/(\d+)\s*(?:s|sec|secs|second|seconds)\b/)
    if (s) { const v = parseInt(s[1], 10); return isNaN(v) ? null : v }
    const m = t.match(/(\d+)\s*(?:m|min|mins|minute|minutes)\b/)
    if (m) { const v = parseInt(m[1], 10); return isNaN(v) ? null : v * 60 }
    return null
  }

  function isHoldExercise(name: string): boolean {
    const t = name.toLowerCase()
    if (exerciseConfig?.ii) return true
    return t.includes('plank') || t.includes('hold') || t.includes('wall sit') || t.includes('bridge pose')
  }

  function advanceNext() {
    if (advancingRef.current) return
    advancingRef.current = true
    const avgFormScore = repFormScoreCountRef.current > 0
      ? Math.round(repFormScoreSumRef.current / repFormScoreCountRef.current)
      : (formScoreSamplesRef.current > 0 ? Math.round(formScoreSumRef.current / formScoreSamplesRef.current) : formScore)
    persistExerciseHistory()
    const cp = planRef.current
    if (!cp.length || idx + 1 >= cp.length) {
      const isLast = cp.length > 0 && idx + 1 >= cp.length
      speak(
        isLast
          ? `Workout complete. Amazing job today! Your average form score was ${avgFormScore} percent.`
          : `Exercise complete. Well done! Your average form score was ${avgFormScore} percent.`,
        'high'
      )
      setFeedback(isLast ? `Workout complete! Avg form: ${avgFormScore}%` : `Exercise complete! Avg form: ${avgFormScore}%`)
      setTimeout(() => { advancingRef.current = false; window.history.back() }, 4000)
      return
    }
    const ni = idx + 1, next = cp[ni]
    setReps(0); setHoldElapsedSec(0); setStage('NONE')
    setIsResting(true); setRestTimer(30)
    setFeedback(`Rest - Next: ${next.name}. Avg form: ${avgFormScore}%`)
    speak(`Great work! Average form score ${avgFormScore} percent. Rest for 30 seconds. Next up: ${next.name}.`, 'high')
    pendingNextRef.current = {
      href: `/trainer?name=${encodeURIComponent(next.name)}&reps=${encodeURIComponent(getPlanRepetitions(next))}&gif=${encodeURIComponent(getPlanGif(next))}&idx=${ni}`
    }
  }

  const defaultTargetText = exerciseName.toLowerCase().trim() === 'bodyweight squats'
    ? BODYWEIGHT_SQUATS_FALLBACK_TARGET
    : DEMO_FALLBACK_TARGET
  const resolvedTargetInput = currentPlanItem ? getPlanRepetitions(currentPlanItem) : (targetReps || defaultTargetText)

  useEffect(() => {
    const byReps = parseTarget(resolvedTargetInput)
    const byDur  = parseDurationSeconds(resolvedTargetInput)
    if (isHoldExercise(exerciseName) && byDur) {
      setTargetTotal(null); setTargetDurationSec(byDur)
    } else {
      setTargetTotal(byReps); setTargetDurationSec(exerciseConfig?.ii ? (exerciseConfig.hs ?? null) : null)
    }
    setHoldElapsedSec(0); advancingRef.current = false; lastRepSpokenRef.current = 0
    formScoreSumRef.current = 0
    formScoreSamplesRef.current = 0
    repFormScoreSumRef.current = 0
    repFormScoreCountRef.current = 0
    historySavedRef.current = false
    setExerciseAvgRepForm(null)
    setExerciseRepSamples(0)
    lastFaultSpoken.current = ''; lastFaultTime.current = 0
    repPhase.current = 'up'; consecutiveDown.current = 0; consecutiveUp.current = 0; repEligibleThisCycle.current = false
    repSeekExtreme.current = null; halfCycleCount.current = 0
    try {
      const p = JSON.parse(sessionStorage.getItem('workoutPlan') || '[]')
      const arr = Array.isArray(p) ? p : []
      planRef.current = arr; setPlan(arr)
      if (!params.get('name') && arr.length > 0) {
        const first = arr[0]
        window.location.replace(`/trainer?name=${encodeURIComponent(first.name)}&reps=${encodeURIComponent(getPlanRepetitions(first))}&gif=${encodeURIComponent(getPlanGif(first))}&idx=0`)
      }
    } catch { setPlan([]) }
  }, [exerciseName, resolvedTargetInput, exerciseConfig])

  useEffect(() => {
    setLast7DayForm(buildLast7DayStats(exerciseName))
  }, [exerciseName])

  useEffect(() => {
    if (advancingRef.current) return
    if (targetTotal !== null && reps >= targetTotal) { speak('Exercise complete!', 'high'); advanceNext() }
  }, [reps, targetTotal])

  useEffect(() => {
    if (advancingRef.current) return
    if (targetDurationSec !== null && holdElapsedSec >= targetDurationSec) { speak('Hold complete! Well done!', 'high'); advanceNext() }
  }, [holdElapsedSec, targetDurationSec])

  // 
  // DRAW LANDMARKS
  // 
  function drawLandmarks(results: Results) {
    const canvas = canvasRef.current, video = videoRef.current
    if (!canvas || !video) return
    const ctx = canvas.getContext('2d')!
    if (canvas.width !== video.videoWidth) canvas.width = video.videoWidth
    if (canvas.height !== video.videoHeight) canvas.height = video.videoHeight
    ctx.save()
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.scale(-1, 1)
    ctx.drawImage(video, -canvas.width, 0, canvas.width, canvas.height)
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    const lm = results.poseLandmarks
    if (!lm) { ctx.restore(); return }
    const cfg = configRef.current
    const pj  = cfg?.pj ?? ''
    ctx.lineWidth = 3; ctx.lineCap = 'round'
    for (const [a, b] of (POSE_CONNECTIONS as any)) {
      const p1 = lm[a], p2 = lm[b]
      if ((p1?.visibility ?? 0) > 0.5 && (p2?.visibility ?? 0) > 0.5) {
        ctx.strokeStyle = currentFault ? '#ef4444' : '#10b981'
        ctx.beginPath()
        ctx.moveTo((1 - p1.x) * canvas.width, p1.y * canvas.height)
        ctx.lineTo((1 - p2.x) * canvas.width, p2.y * canvas.height)
        ctx.stroke()
      }
    }
    const hi = new Set<number>()
    if (pj && TRIPLET_L[pj]) { TRIPLET_L[pj].forEach(i => hi.add(i)); TRIPLET_R[pj].forEach(i => hi.add(i)) }
    lm.forEach((lmk, i) => {
      if ((lmk?.visibility ?? 0) > 0.5) {
        const x = (1 - lmk.x) * canvas.width, y = lmk.y * canvas.height
        ctx.beginPath()
        if (hi.has(i)) {
          ctx.arc(x, y, 7, 0, 2 * Math.PI)
          ctx.fillStyle = formScore > 70 ? '#facc15' : '#ef4444'
          ctx.shadowColor = formScore > 70 ? '#facc15' : '#ef4444'; ctx.shadowBlur = 12
        } else {
          ctx.arc(x, y, 4, 0, 2 * Math.PI)
          ctx.fillStyle = '#fff'; ctx.shadowBlur = 0
        }
        ctx.fill(); ctx.shadowBlur = 0
      }
    })
    if (pj && TRIPLET_L[pj]) {
      const [, vIdx] = TRIPLET_L[pj]; const v = lm[vIdx]
      if (v && (v.visibility ?? 0) > 0.5) {
        const x = (1 - v.x) * canvas.width, y = v.y * canvas.height
        const angle = liveAngles[`${pj}_L`] ?? liveAngles[pj] ?? 0
        ctx.fillStyle = formScore > 70 ? '#facc15' : '#ef4444'
        ctx.font = 'bold 16px monospace'
        ctx.fillText(`${Math.round(angle)}`, x + 10, y - 10)
        ctx.beginPath()
        ctx.strokeStyle = formScore > 70 ? 'rgba(250,204,21,0.7)' : 'rgba(239,68,68,0.7)'
        ctx.lineWidth = 2
        ctx.arc(x, y, 24, 0, (angle / 180) * Math.PI)
        ctx.stroke()
      }
    }
    ctx.restore()
  }

  // 
  // ANALYZE FORM  pure rep counting + angle voice coaching
  // 
  function analyzeForm(results: Results) {
    const currentLm = results.poseLandmarks
    const lm = currentLm || lastLandmarksRef.current
    if (!lm) {
      noPoseFrames.current += 1
      if (noPoseFrames.current > NO_POSE_THRESHOLD) {
        resetPoseState()
        setFeedback(' No pose detected  step back so your full body is visible')
        if (noPoseFrames.current === NO_POSE_THRESHOLD + 1) speak('Step back so your full body is visible.', 'high')
      }
      return
    }
    if (!validatePose(lm)) {
      noPoseFrames.current += 1
      if (noPoseFrames.current > NO_POSE_THRESHOLD) {
        resetPoseState()
        setFeedback(' Pose unclear  ensure good lighting')
        if (noPoseFrames.current === NO_POSE_THRESHOLD + 1) speak('Ensure good lighting and back away from the camera.', 'high')
      }
      return
    }
    noPoseFrames.current = 0
    setPoseDetected(true)
    lastLandmarksRef.current = lm

    const cfg = configRef.current
    if (!cfg) return

    //  Compute angles 
    const pj = cfg.pj
    let angleL = -1, angleR = -1
    const tripL = TRIPLET_L[pj], tripR = TRIPLET_R[pj]
    if (tripL) { const raw = calculateAngle(lm, tripL[0], tripL[1], tripL[2]); angleL = smoothAngle(angleBufferL.current, pj, raw) }
    if (tripR) { const raw = calculateAngle(lm, tripR[0], tripR[1], tripR[2]); angleR = smoothAngle(angleBufferR.current, pj, raw) }
    const primaryAngle = (angleL >= 0 && angleR >= 0) ? (angleL + angleR) / 2 : (angleL >= 0 ? angleL : angleR)

    let secondaryAngle = -1
    if (cfg.sj && TRIPLET_L[cfg.sj]) {
      const st = TRIPLET_L[cfg.sj]
      const rawS = calculateAngle(lm, st[0], st[1], st[2])
      secondaryAngle = smoothAngle(angleBufferL.current, cfg.sj, rawS)
    }

    const newAngles: Record<string, number> = {}
    if (angleL >= 0) newAngles[`${pj}_L`] = Math.round(angleL)
    if (angleR >= 0) newAngles[`${pj}_R`] = Math.round(angleR)
    if (secondaryAngle >= 0 && cfg.sj) newAngles[cfg.sj] = Math.round(secondaryAngle)
    setLiveAngles(newAngles)

    const now = Date.now()
    let formPenalty = 0
    let repCounted  = false
    const primaryInRange = primaryAngle >= cfg.mn && primaryAngle <= cfg.mx
    const secondaryConfigured = !!(cfg.sj && cfg.sm > 0 && cfg.sx > 0)
    const secondaryInRangeForRep =
      !secondaryConfigured || secondaryAngle < 0 || (secondaryAngle >= cfg.sm && secondaryAngle <= cfg.sx)
    if (!cfg.ii && primaryAngle >= 0 && primaryInRange && secondaryInRangeForRep) repEligibleThisCycle.current = true
    // Rep counting (generic extreme-to-extreme cycle)
    if (!cfg.ii && primaryAngle >= 0) {
      const lowHit = primaryAngle <= (cfg.mn + 4)
      const highHit = primaryAngle >= (cfg.mx - 4)
      const mid = (cfg.mn + cfg.mx) / 2
      setStage(primaryAngle < mid ? 'DOWN' : 'UP')

      // Initialize by whichever extreme is farther from current angle.
      if (!repSeekExtreme.current) {
        const dLow = Math.abs(primaryAngle - cfg.mn)
        const dHigh = Math.abs(primaryAngle - cfg.mx)
        repSeekExtreme.current = dLow < dHigh ? 'high' : 'low'
      }

      let transitionHappened = false
      if (repSeekExtreme.current === 'low' && lowHit) {
        repSeekExtreme.current = 'high'
        halfCycleCount.current += 1
        transitionHappened = true
      } else if (repSeekExtreme.current === 'high' && highHit) {
        repSeekExtreme.current = 'low'
        halfCycleCount.current += 1
        transitionHappened = true
      }

      // One rep = two extreme transitions (e.g., high->low->high).
      if (transitionHappened && halfCycleCount.current % 2 === 0) {
        if (now - lastRepTime.current > COOLDOWN_MS) {
          lastRepTime.current = now
          if (repEligibleThisCycle.current && secondaryInRangeForRep) {
            setReps(r => r + 1)
            repCounted = true
          } else {
            const msg = `Rep not counted. Reach target angle ${cfg.mn} to ${cfg.mx} with correct form.`
            setFeedback(msg)
            speak(msg, 'high')
          }
          repEligibleThisCycle.current = false
        }
      }
    }

    //  Isometric hold 
    if (cfg.ii && primaryAngle >= 0) {
      const inRange = primaryAngle >= cfg.mn && primaryAngle <= cfg.mx
      isPoseStableRef.current = inRange
      if (!inRange) {
        const msg = `Get into position. Target: ${cfg.mn}deg to ${cfg.mx}deg.`
        setFeedback(msg); speak(msg, 'medium')
      }
    }

    //  Voice fault coaching 
    // Priority 1: Secondary joint fault (e.g. knee valgus during squat)
    if (cfg.sj && secondaryAngle >= 0 && cfg.sm > 0 && cfg.sx > 0) {
      const inRange = secondaryAngle >= cfg.sm && secondaryAngle <= cfg.sx
      if (!inRange) {
        formPenalty += 20
        const fault = parseFaults(cfg.cf)[0] ?? ''
        const cue   = getFaultCue(fault)
        setCurrentFault(fault)
        if (!repCounted) {
          const key = cue
          if (key !== lastFaultSpoken.current || now - lastFaultTime.current > FAULT_REPEAT_MS) {
            lastFaultSpoken.current = key; lastFaultTime.current = now
            setFeedback(`WARNING ${cue}`)
            speak(cue, 'high')
          }
        }
      } else {
        if (lastFaultSpoken.current && now - lastFaultTime.current > 2000) {
          setCurrentFault(''); lastFaultSpoken.current = ''
        }
      }
    }

    // Priority 2: Primary angle out of valid range  tell user exactly what angle is wrong
    if (!repCounted && primaryAngle >= 0 && !currentFault) {
      if (primaryAngle < cfg.mn - 8) {
        // Angle too low (e.g. over-flexed)
        const cue = buildAngleCorrectionCue(pj, primaryAngle, cfg.mn, cfg.mx, 'too_low', '')
        if (cue !== lastFaultSpoken.current || now - lastFaultTime.current > FAULT_REPEAT_MS) {
          lastFaultSpoken.current = cue; lastFaultTime.current = now
          setFeedback(`ANGLE ${cue}`)
          speak(cue, 'high')
        }
        formPenalty += 10
      } else if (primaryAngle > cfg.mx + 8) {
        // Angle too high (e.g. not bending enough)
        const cue = buildAngleCorrectionCue(pj, primaryAngle, cfg.mn, cfg.mx, 'too_high', '')
        if (cue !== lastFaultSpoken.current || now - lastFaultTime.current > FAULT_REPEAT_MS) {
          lastFaultSpoken.current = cue; lastFaultTime.current = now
          setFeedback(`ANGLE ${cue}`)
          speak(cue, 'high')
        }
        formPenalty += 10
      } else if (primaryAngle >= cfg.mn && primaryAngle <= cfg.mx && !repCounted) {
        setFeedback(`Good form - ${Math.round(primaryAngle)}deg`)
        if (lastFaultSpoken.current && now - lastFaultTime.current > 2000) lastFaultSpoken.current = ''
      }
    }

    //  Form score 
    detectPoseStability(newAngles)
    if (primaryAngle >= 0) {
      const midRef = referenceAngles[pj] ?? (cfg.mn + cfg.mx) / 2
      const diff   = Math.abs(primaryAngle - midRef)
      setPoseMatchScore(Math.round(Math.max(0, 100 - diff * 1.8)))
      const liveFormScore = Math.max(0, Math.round(100 - formPenalty - diff * 0.4))
      setFormScore(liveFormScore)
      formScoreSumRef.current += liveFormScore
      formScoreSamplesRef.current += 1
      if (repCounted) {
        repFormScoreSumRef.current += liveFormScore
        repFormScoreCountRef.current += 1
        setExerciseRepSamples(repFormScoreCountRef.current)
        setExerciseAvgRepForm(Math.round(repFormScoreSumRef.current / repFormScoreCountRef.current))
      }
    }
  }

  // 
  // GIF LOADING
  // 
  const localGifAliases: Record<string, string> = {
    '3/4 sit-up': '34-sit-up', 'bench dip (knees bent)': 'bench-dip-knees-bent',
    'archer push up': 'archer-push-ups', 'archer pull up': 'archer-pull-up',
  }

  function slugify(text: string) {
    return (text || '').toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-')
  }

  useEffect(() => {
    const nl = exerciseName.toLowerCase()
    const alias = localGifAliases[nl]
    const aliasUrl = alias ? `/gifs/${alias}.gif` : null
    const slugUrl  = `/gifs/${slugify(exerciseName)}.gif`
    const squat    = nl === 'bodyweight squats' ? '/gifs/squats.mp4' : null
    const tryLoad  = (url: string, onFail: () => void) => { const img = new Image(); img.onload = () => setGifSrc(url); img.onerror = onFail; img.src = url }
    const tryVideo = (url: string, onFail: () => void) => { const v = document.createElement('video'); v.preload = 'metadata'; v.onloadeddata = () => setGifSrc(url); v.onerror = onFail; v.src = url }
    const trySlug  = () => squat ? tryVideo(squat, () => tryLoad(slugUrl, () => setGifSrc(''))) : tryLoad(slugUrl, () => setGifSrc(''))
    const tryAlias = () => aliasUrl ? tryLoad(aliasUrl, trySlug) : trySlug()
    if (apiGifSrc) { apiGifSrc.endsWith('.mp4') ? setGifSrc(apiGifSrc) : tryLoad(apiGifSrc, () => fallbackGif ? tryLoad(fallbackGif, tryAlias) : tryAlias()) }
    else if (fallbackGif) { fallbackGif.endsWith('.mp4') ? setGifSrc(fallbackGif) : tryLoad(fallbackGif, tryAlias) }
    else tryAlias()
  }, [exerciseName, fallbackGif, apiGifSrc])

  useEffect(() => {
    if (!gifSrc || gifSrc.endsWith('.mp4')) return
    const img = new Image(); img.crossOrigin = 'anonymous'
    img.onload = async () => {
      const c = document.createElement('canvas'); c.width = img.width; c.height = img.height
      c.getContext('2d')!.drawImage(img, 0, 0)
      if (!gifPoseRef.current) {
        gifPoseRef.current = new Pose({ locateFile: f => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${f}` })
        gifPoseRef.current.setOptions({ modelComplexity:1, smoothLandmarks:true, enableSegmentation:false, minDetectionConfidence:0.5, minTrackingConfidence:0.5 })
      }
      gifPoseRef.current.onResults((res: Results) => {
        const lm = res.poseLandmarks; if (!lm) return
        const cfg = configRef.current; if (!cfg) return
        const trip = TRIPLET_L[cfg.pj]
        if (trip) { const a = calculateAngle(lm, trip[0], trip[1], trip[2]); if (a > 0) setReferenceAngles({ [cfg.pj]: Math.round(a) }) }
      })
      try { await gifPoseRef.current.send({ image: c }) } catch { /* ignore */ }
    }
    img.src = gifSrc
  }, [gifSrc, exerciseName, exerciseConfig])

  // 
  // CAMERA
  // 
  useEffect(() => {
    const v = videoRef.current; if (!v) return
    let cancelled = false, attempts = 0
    let restartTimer: ReturnType<typeof setTimeout> | null = null
    const stopStream = (s: MediaStream | null) => s?.getTracks().forEach(t => t.stop())
    const clearT = () => { if (restartTimer) { clearTimeout(restartTimer); restartTimer = null } }
    const getStream = async (): Promise<MediaStream> => {
      const cs: MediaStreamConstraints[] = [
        { video: { facingMode: { ideal:'user' }, width:{ideal:1280}, height:{ideal:720} }, audio: false },
        { video: { facingMode:'user' }, audio: false },
        { video: true, audio: false },
      ]
      let last: unknown = null
      for (const c of cs) { try { return await navigator.mediaDevices.getUserMedia(c) } catch (e) { last = e } }
      throw last || new Error('Cannot start camera')
    }
    const startCamera = async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('getUserMedia not supported')
        const ex = v.srcObject as MediaStream | null
        if (ex) { stopStream(ex); v.srcObject = null }
        if (streamRef.current) { stopStream(streamRef.current); streamRef.current = null }
        setFeedback('Requesting camera...'); setCameraStatus('requesting'); setReady(false); setCameraError(null)
        const stream = await getStream()
        if (cancelled) { stopStream(stream); return }
        streamRef.current = stream
        const sched = (reason: string) => {
          if (cancelled) return
          if (attempts >= 5) { const m = `Camera error: ${reason}. Tap Retry.`; setCameraStatus('error'); setCameraError(m); setFeedback(m); setReady(false); return }
          attempts++; setReady(false); setCameraStatus('requesting'); setFeedback(`Camera interrupted. Reconnecting...`); clearT()
          restartTimer = setTimeout(() => void startCamera(), 750)
        }
        stream.getTracks().forEach(t => { t.onended = () => sched('track ended') });
        (stream as any).oninactive = () => sched('stream inactive')
        v.srcObject = stream; v.muted = true; v.playsInline = true; v.autoplay = true
        v.setAttribute('playsinline','true'); v.setAttribute('autoplay','true'); v.setAttribute('muted','true')
        const tryPlay = async () => {
          try {
            await v.play()
            if (!cancelled) { attempts = 0; clearT(); setReady(true); setCameraStatus('ready'); setCameraError(null); setFeedback('Position yourself in view') }
          } catch (e) {
            if (!cancelled) { setReady(false); setCameraStatus('error'); const m = buildCameraErrorMessage(e); setCameraError(m); setFeedback(m) }
          }
        }
        v.onpause = () => { if (!cancelled) { if (v.ended) sched('video ended'); else v.play().catch(() => sched('video paused')) } }
        if (v.readyState >= 1) await tryPlay()
        else { v.onloadedmetadata = () => void tryPlay(); v.oncanplay = () => void tryPlay() }
      } catch (e) {
        if (!cancelled) { setReady(false); setCameraStatus('error'); const m = buildCameraErrorMessage(e); setCameraError(m); setFeedback(m) }
      }
    }
    void startCamera()
    const onVis = () => {
      if (cancelled || document.visibilityState !== 'visible') return
      const cur = v.srcObject as MediaStream | null
      if (!cur || v.paused || v.readyState < 2) void startCamera()
      else v.play().catch(() => void startCamera())
    }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      cancelled = true; clearT(); setReady(false); setCameraStatus('idle')
      v.onloadedmetadata = null; v.oncanplay = null; v.onpause = null
      document.removeEventListener('visibilitychange', onVis)
      const cur = v.srcObject as MediaStream | null
      if (cur) { stopStream(cur); v.srcObject = null }
      stopStream(streamRef.current)
    }
  }, [cameraRetryToken])

  // 
  // POSE DETECTION LOOP
  // 
  useEffect(() => {
    if (!ready || !videoRef.current) return
    const pose = new Pose({ locateFile: f => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${f}` })
    pose.setOptions({ modelComplexity:1, smoothLandmarks:true, enableSegmentation:false, minDetectionConfidence:MIN_VIS, minTrackingConfidence:MIN_VIS })
    pose.onResults((res: Results) => {
      try { drawLandmarks(res); analyzeForm(res) } catch { setFeedback('Error processing pose') }
    })
    poseRef.current = pose
    let id = 0
    async function frame() {
      if (!videoRef.current) { cancelAnimationFrame(id); return }
      if (videoRef.current.paused || videoRef.current.ended) { try { await videoRef.current.play() } catch { /* ignore */ } }
      try { await pose.send({ image: videoRef.current }) } catch { /* ignore */ }
      id = requestAnimationFrame(frame)
    }
    frame()
    return () => { cancelAnimationFrame(id); if (poseRef.current) { poseRef.current.close(); poseRef.current = null } }
  }, [ready])

  // 
  // COMPUTED VALUES
  // 
  const formatTime  = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
  const isVideoSrc  = gifSrc.endsWith('.mp4')
  const formColor   = formScore >= 80 ? '#10b981' : formScore >= 60 ? '#f59e0b' : '#ef4444'
  const cfg         = exerciseConfig
  const workoutTargetText = currentPlanItem
    ? (() => { const s = parseSetCount(currentPlanItem.sets), r = parseRepCount(currentPlanItem.reps); return s && r ? `${s} x ${r}` : getPlanRepetitions(currentPlanItem) || targetReps || defaultTargetText })()
    : (targetReps || defaultTargetText)
  const totalPlannedReps = currentPlanItem
    ? (() => { const s = parseSetCount(currentPlanItem.sets), r = parseRepCount(currentPlanItem.reps); return s && r ? s * r : parseTarget(getPlanRepetitions(currentPlanItem)) })()
    : parseTarget(targetReps || defaultTargetText)
  const plannedCal    = Number(currentPlanItem?.calories_burned)
  const displayCal    = Number.isFinite(plannedCal) && plannedCal > 0 ? plannedCal : caloriesBurned
  const last7Available = last7DayForm.filter(d => d.avgForm !== null)
  const last7Avg = last7Available.length > 0
    ? Math.round(last7Available.reduce((a, b) => a + (b.avgForm ?? 0), 0) / last7Available.length)
    : null

  // 
  // RENDER
  // 
  return (
    <div className="trainer-page">
      <style>{`
        * { box-sizing: border-box; }
        .trainer-page { min-height:100vh; background:radial-gradient(circle at 10% 10%,rgba(56,189,248,.18),transparent 36%),radial-gradient(circle at 90% 90%,rgba(16,185,129,.2),transparent 34%),linear-gradient(155deg,#020617 0%,#0f172a 52%,#111827 100%); display:flex; flex-direction:column; align-items:center; color:white; font-family:'Inter',system-ui,sans-serif; padding:16px 20px; }
        .trainer-header { width:100%; max-width:1300px; display:flex; align-items:center; justify-content:space-between; margin-bottom:14px; }
        .exercise-title { font-size:1.35rem; font-weight:800; color:#f8fafc; }
        .exercise-subtitle { font-size:0.82rem; color:#94a3b8; margin-top:2px; }
        .header-badges { display:flex; gap:7px; flex-wrap:wrap; }
        .badge { padding:4px 11px; border-radius:999px; font-size:0.7rem; font-weight:700; text-transform:uppercase; letter-spacing:.5px; }
        .badge-joint { background:rgba(56,189,248,.15); border:1px solid rgba(56,189,248,.4); color:#38bdf8; }
        .badge-cam { background:rgba(16,185,129,.15); border:1px solid rgba(16,185,129,.4); color:#10b981; }
        .badge-sym { background:rgba(168,85,247,.15); border:1px solid rgba(168,85,247,.4); color:#c084fc; }

        /* 3-column layout: left ref | center video | right instructions */
        .main-workspace { display:flex; flex-direction:row; align-items:flex-start; gap:16px; max-width:1300px; width:100%; }

        /* LEFT: reference panel */
        .reference-panel { width:240px; min-width:220px; flex-shrink:0; background:#1e293b; border:1px solid #334155; border-radius:18px; padding:14px; display:flex; flex-direction:column; gap:10px; }
        .reference-media,.reference-video { width:100%; border-radius:10px; background:#0f172a; aspect-ratio:1/1; object-fit:cover; }
        .gif-info h4 { margin:0; font-size:.95rem; color:#f8fafc; font-weight:700; }
        .gif-info p { margin:4px 0 0; font-size:.8rem; color:#94a3b8; }
        .ref-angle { font-size:.7rem; background:rgba(16,185,129,.15); color:#10b981; padding:2px 6px; border-radius:4px; margin-right:4px; font-family:monospace; }
        .config-panel { background:#0b1220; border:1px solid #1e3a4a; border-radius:12px; padding:10px 12px; }
        .config-title { font-size:.68rem; text-transform:uppercase; color:#38bdf8; font-weight:700; letter-spacing:.5px; margin-bottom:7px; }
        .config-row { display:flex; justify-content:space-between; font-size:.75rem; padding:2px 0; border-bottom:1px solid #1e2d3a; }
        .config-row:last-child { border-bottom:none; }
        .config-key { color:#64748b; }
        .config-val { color:#e2e8f0; font-weight:600; font-family:monospace; }
        .angle-range-bar { margin-top:5px; }
        .angle-bar-label { font-size:.68rem; color:#64748b; display:flex; justify-content:space-between; }
        .angle-bar-track { position:relative; height:6px; border-radius:3px; background:#1e293b; border:1px solid #334155; margin:3px 0; overflow:visible; }
        .angle-bar-fill { position:absolute; top:0; height:100%; border-radius:3px; background:linear-gradient(90deg,#10b981,#38bdf8); }
        .angle-bar-cursor { position:absolute; top:-4px; width:13px; height:13px; border-radius:50%; background:#facc15; border:2px solid #000; transform:translateX(-50%); transition:left 0.1s; box-shadow:0 0 7px rgba(250,204,21,.8); }
        .muscle-tags { display:flex; flex-wrap:wrap; gap:4px; }
        .muscle-tag { background:rgba(16,185,129,.18); color:#10b981; padding:2px 6px; border-radius:4px; font-size:.68rem; font-weight:600; }
        .plan-list { display:flex; flex-direction:column; gap:6px; max-height:160px; overflow-y:auto; }
        .plan-item { display:flex; align-items:center; justify-content:space-between; background:#0f172a; border:1px solid #334155; color:#e2e8f0; padding:8px 10px; border-radius:9px; cursor:pointer; font-weight:700; font-size:.8rem; }
        .plan-item.active { border-color:#10b981; color:#10b981; }
        .plan-item .sec { font-size:.7rem; color:#94a3b8; }

        /* CENTER: webcam */
        .webcam-panel { flex:1; position:relative; min-width:0; height:520px; border-radius:20px; overflow:hidden; box-shadow:0 24px 64px rgba(2,6,23,.65); border:1px solid rgba(148,163,184,.28); background:#000; }
        .webcam-panel canvas { width:100%; height:100%; object-fit:cover; display:block; }

        /* Overlays */
        .rep-counter { position:absolute; top:14px; left:14px; z-index:10; background:linear-gradient(135deg,#10b981,#059669); padding:10px 16px; border-radius:13px; text-align:center; box-shadow:0 4px 18px rgba(16,185,129,.4); }
        .rep-count { font-size:2.2rem; font-weight:900; line-height:1; display:block; }
        .rep-label { font-size:.62rem; text-transform:uppercase; font-weight:700; opacity:.9; }
        .rep-target { position:absolute; top:14px; left:106px; z-index:10; background:rgba(2,6,23,.85); border:1px solid rgba(16,185,129,.3); padding:7px 12px; border-radius:11px; text-align:center; }
        .rep-target-val { font-size:1rem; font-weight:800; color:#94a3b8; }
        .rep-target-label { font-size:.6rem; color:#64748b; }
        .stage-badge { position:absolute; top:14px; right:100px; z-index:10; padding:5px 11px; border-radius:8px; font-size:.7rem; font-weight:800; text-transform:uppercase; letter-spacing:.5px; transition:all .2s; }
        .stage-DOWN { background:rgba(239,68,68,.2); border:1px solid #ef4444; color:#fca5a5; }
        .stage-UP   { background:rgba(16,185,129,.2); border:1px solid #10b981; color:#6ee7b7; }
        .stage-NONE { background:rgba(100,116,139,.15); border:1px solid #475569; color:#94a3b8; }
        .status-badge { position:absolute; top:14px; right:14px; z-index:10; background:rgba(2,6,23,.88); padding:5px 11px; border-radius:8px; font-size:.67rem; display:flex; align-items:center; gap:5px; }
        .dot { width:6px; height:6px; border-radius:50%; animation:blink 1.2s infinite; }
        .dot.active { background:#10b981; } .dot.inactive { background:#ef4444; }
        @keyframes blink { 0%,100%{opacity:1}50%{opacity:.3} }
        .pose-indicator { position:absolute; top:52px; right:14px; z-index:10; background:rgba(2,6,23,.9); border:1px solid rgba(16,185,129,.3); padding:6px 11px; border-radius:8px; font-size:.7rem; display:flex; align-items:center; gap:5px; }
        .pose-indicator.detected { border-color:#10b981; color:#10b981; }
        .pose-indicator.not-detected { border-color:#f59e0b; color:#f59e0b; }
        .angle-panel { position:absolute; top:96px; left:14px; z-index:10; background:rgba(2,6,23,.85); border:1px solid rgba(16,185,129,.3); padding:9px 12px; border-radius:11px; min-width:96px; }
        .angle-panel-title { font-size:.6rem; color:#38bdf8; font-weight:700; text-transform:uppercase; margin-bottom:5px; letter-spacing:.5px; }
        .angle-item { display:flex; justify-content:space-between; gap:14px; font-size:.75rem; padding:2px 0; }
        .angle-label { color:#10b981; font-weight:700; }
        .angle-value { font-weight:700; font-family:monospace; color:#facc15; }
        .metrics-panel { position:absolute; top:14px; left:50%; transform:translateX(-50%); background:rgba(2,6,23,.9); border:1px solid rgba(16,185,129,.3); padding:9px 18px; border-radius:11px; display:flex; gap:24px; z-index:10; }
        .metric-item { display:flex; flex-direction:column; align-items:center; }
        .metric-label { color:#94a3b8; font-size:.62rem; }
        .metric-value { color:#10b981; font-weight:800; font-size:.9rem; }
        .score-stack { position:absolute; bottom:90px; right:14px; z-index:10; display:flex; flex-direction:column; gap:7px; }
        .score-box { background:rgba(2,6,23,.9); border:1px solid rgba(16,185,129,.3); padding:9px 12px; border-radius:11px; text-align:center; min-width:66px; }
        .score-value { font-size:1.35rem; font-weight:900; }
        .score-label { font-size:.58rem; color:#94a3b8; text-transform:uppercase; }
        .feedback-pill { position:absolute; bottom:14px; left:50%; transform:translateX(-50%); background:rgba(2,6,23,.92); padding:10px 20px; border-radius:100px; font-weight:600; color:#d1fae5; border:1px solid rgba(16,185,129,.4); backdrop-filter:blur(6px); z-index:10; max-width:90%; text-align:center; font-size:.88rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .voice-enable-btn { position:absolute; bottom:58px; left:50%; transform:translateX(-50%); border:1px solid rgba(56,189,248,.55); background:rgba(14,116,144,.85); color:#f0f9ff; font-weight:800; padding:9px 17px; border-radius:999px; cursor:pointer; z-index:12; font-size:.82rem; }
        .voice-enable-btn:hover { background:rgba(2,132,199,.92); }
        .camera-error-overlay { position:absolute; inset:0; background:rgba(2,6,23,.84); z-index:30; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:12px; padding:22px; text-align:center; }
        .camera-error-text { color:#fca5a5; font-weight:700; max-width:380px; line-height:1.4; margin:0; }
        .camera-retry-btn { background:#10b981; color:#052e16; border:none; border-radius:10px; padding:9px 16px; font-weight:800; cursor:pointer; }
        .rest-overlay { position:absolute; inset:0; background:rgba(0,0,0,.78); display:flex; align-items:center; justify-content:center; flex-direction:column; z-index:100; border-radius:20px; }
        .rest-timer { font-size:5rem; font-weight:900; color:#fbbf24; }
        .rest-text { font-size:1rem; color:#e2e8f0; margin-top:8px; }

        /* RIGHT: instructions panel */
        .instructions-panel { width:280px; min-width:250px; flex-shrink:0; background:#1e293b; border:1px solid #334155; border-radius:18px; padding:16px; display:flex; flex-direction:column; gap:10px; height:520px; overflow-y:auto; }
        .instr-header { font-size:.78rem; text-transform:uppercase; color:#38bdf8; font-weight:700; letter-spacing:.6px; padding-bottom:8px; border-bottom:1px solid #334155; }
        .instr-step { display:flex; gap:10px; align-items:flex-start; padding:10px; border-radius:10px; border:1px solid #1e293b; background:#0f172a; transition:all .2s; }
        .instr-step.active-step { background:rgba(250,204,21,.08); border-color:#facc15; }
        .instr-num { min-width:24px; height:24px; border-radius:50%; background:rgba(16,185,129,.2); border:1px solid rgba(16,185,129,.5); color:#10b981; font-weight:800; font-size:.72rem; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
        .instr-num.active-num { background:rgba(250,204,21,.2); border-color:#facc15; color:#facc15; }
        .instr-text { font-size:.8rem; color:#cbd5e1; line-height:1.5; }
        .form-tip-box { background:rgba(16,185,129,.07); border:1px solid rgba(16,185,129,.2); border-radius:10px; padding:10px 12px; }
        .form-tip-title { font-size:.68rem; text-transform:uppercase; color:#10b981; font-weight:700; margin-bottom:6px; }
        .form-tip-text { font-size:.76rem; color:#94a3b8; line-height:1.5; }
        .fault-highlight { background:rgba(239,68,68,.1); border:1px solid rgba(239,68,68,.4); border-radius:10px; padding:9px 12px; animation:pulseRed 1.5s ease-in-out infinite; }
        @keyframes pulseRed { 0%,100%{border-color:rgba(239,68,68,.4)}50%{border-color:rgba(239,68,68,.9)} }
        .fault-title { font-size:.68rem; text-transform:uppercase; color:#ef4444; font-weight:700; margin-bottom:4px; }
        .fault-text { font-size:.76rem; color:#fca5a5; line-height:1.5; }

        .controls { margin-top:20px; display:flex; gap:12px; align-items:center; }
        .exit-btn { background:#ef4444; color:white; border:none; padding:10px 34px; border-radius:12px; font-weight:700; cursor:pointer; }
        .exit-btn:hover { background:#dc2626; }
        .voice-toggle-btn { background:rgba(56,189,248,.15); border:1px solid rgba(56,189,248,.4); color:#38bdf8; padding:10px 18px; border-radius:12px; font-weight:700; cursor:pointer; font-size:.83rem; }
        .form-history-wrap { width:100%; max-width:1300px; margin-top:12px; background:rgba(2,6,23,.72); border:1px solid rgba(16,185,129,.28); border-radius:14px; padding:12px 14px; }
        .form-history-head { display:flex; align-items:center; justify-content:space-between; gap:10px; flex-wrap:wrap; margin-bottom:8px; }
        .form-history-title { color:#d1fae5; font-size:.86rem; font-weight:800; letter-spacing:.2px; }
        .form-history-meta { color:#93c5fd; font-size:.78rem; }
        .form-history-grid { display:grid; grid-template-columns:repeat(7, minmax(0, 1fr)); gap:8px; }
        .form-day { background:#0b1220; border:1px solid #1f2937; border-radius:10px; padding:8px; text-align:center; }
        .form-day-date { color:#94a3b8; font-size:.65rem; margin-bottom:3px; }
        .form-day-score { color:#e2e8f0; font-size:.9rem; font-weight:800; }
        .form-day-reps { color:#64748b; font-size:.66rem; margin-top:2px; }

        @media (max-width:1100px) {
          .main-workspace { flex-direction:column; align-items:center; }
          .reference-panel { width:100%; max-width:700px; flex-direction:row; flex-wrap:wrap; }
          .webcam-panel { width:100%; max-width:700px; height:440px; }
          .instructions-panel { width:100%; max-width:700px; height:auto; max-height:300px; }
          .trainer-header { flex-direction:column; align-items:flex-start; gap:8px; }
          .form-history-grid { grid-template-columns:repeat(4, minmax(0, 1fr)); }
        }
      `}</style>

      {/* HEADER */}
      <div className="trainer-header">
        <div>
          <div className="exercise-title">{exerciseName}</div>
          <div className="exercise-subtitle">
            {cfg ? `${cfg.pj.charAt(0).toUpperCase() + cfg.pj.slice(1)} joint  ${cfg.mn}deg-${cfg.mx}deg  ${cfg.cv} view` : 'Loading config...'}
          </div>
        </div>
        <div className="header-badges">
          {cfg && <span className="badge badge-joint">{cfg.pj}</span>}
          {cfg && <span className="badge badge-cam">{cfg.cv}</span>}
          {cfg && <span className="badge badge-sym">{cfg.sy === 'b' ? 'Bilateral' : cfg.sy === 'u' ? 'Unilateral' : 'Alternating'}</span>}
          {cfg?.ii && <span className="badge badge-cam">Hold {cfg.hs}s</span>}
        </div>
      </div>

      <div className="main-workspace">

        {/*  LEFT: Reference panel  */}
        <div className="reference-panel">
          {gifSrc && (isVideoSrc
            ? <video key={gifSrc} className="reference-video" src={gifSrc} autoPlay loop muted playsInline />
            : <img key={gifSrc} className="reference-media" src={gifSrc} alt={exerciseName} />
          )}
          <div className="gif-info">
            <h4>{exerciseName}</h4>
            <p>Target: <strong>{workoutTargetText || 'N/A'}</strong></p>
            {Object.keys(referenceAngles).length > 0 && (
              <div style={{ marginTop: 4 }}>
                {Object.entries(referenceAngles).map(([k, v]) => (
                  <span key={k} className="ref-angle">{k.toUpperCase()}: {v}deg</span>
                ))}
              </div>
            )}
          </div>

          {cfg && (
            <div className="config-panel">
              <div className="config-title"> Pose Config</div>
              <div className="config-row"><span className="config-key">Joint</span><span className="config-val">{cfg.pj}</span></div>
              <div className="config-row"><span className="config-key">Range</span><span className="config-val">{cfg.mn}deg-{cfg.mx}deg</span></div>
              {cfg.sj && <div className="config-row"><span className="config-key">Secondary</span><span className="config-val">{cfg.sj} {cfg.sm}deg-{cfg.sx}deg</span></div>}
              <div className="config-row"><span className="config-key">Camera</span><span className="config-val">{cfg.cv} view</span></div>
              <div className="config-row"><span className="config-key">Mode</span><span className="config-val">{cfg.ii ? `Hold ${cfg.hs}s` : cfg.rd.replace('_',' ')}</span></div>
              {Object.keys(liveAngles).length > 0 && (() => {
                const pk = Object.keys(liveAngles).find(k => k.endsWith('_L') || k === cfg.pj) ?? ''
                const lv = liveAngles[pk] ?? 0
                const rp = ((cfg.mx - cfg.mn) / 180) * 100
                const sp = (cfg.mn / 180) * 100
                return (
                  <div className="angle-range-bar">
                    <div className="angle-bar-label"><span>{cfg.mn}deg</span><span>{cfg.mx}deg</span></div>
                    <div className="angle-bar-track">
                      <div className="angle-bar-fill" style={{ left:`${sp}%`, width:`${rp}%` }} />
                      <div className="angle-bar-cursor" style={{ left:`${(lv / 180) * 100}%` }} />
                    </div>
                    <div style={{ fontSize:'.68rem', color:'#64748b', textAlign:'center', marginTop:2 }}>
                      Current: <span style={{ color:'#facc15', fontWeight:700 }}>{Math.round(lv)}deg</span>
                    </div>
                  </div>
                )
              })()}
            </div>
          )}

          {exerciseMetadata?.muscle_groups?.length > 0 && (
            <div className="muscle-tags">
              {exerciseMetadata.muscle_groups.map((m: string, i: number) => (
                <span key={i} className="muscle-tag">{m}</span>
              ))}
            </div>
          )}

          <div className="plan-list">
            {plan.map((x, i) => (
              <div key={`${x.name}-${i}`} className={`plan-item ${i === idx ? 'active' : ''}`} onClick={() => goToIndex(i, plan)}>
                <span>{x.name}</span>
                <span className="sec">{getPlanRepetitions(x) || 'N/A'}</span>
              </div>
            ))}
          </div>
        </div>

        {/*  CENTER: Webcam  */}
        <div className="webcam-panel">
          <video ref={videoRef} width={640} height={480} style={{ display:'none' }} />
          <canvas ref={canvasRef} style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }} />

          <div className="rep-counter">
            <span className="rep-count">{cfg?.ii ? holdElapsedSec : reps}</span>
            <span className="rep-label">{cfg?.ii ? 'Sec Hold' : 'Reps'}</span>
          </div>

          {(targetTotal || targetDurationSec) && (
            <div className="rep-target">
              <div className="rep-target-val">/ {targetDurationSec ?? targetTotal}</div>
              <div className="rep-target-label">{cfg?.ii ? 'sec' : 'target'}</div>
            </div>
          )}

          <div className={`stage-badge stage-${stage}`}>
            {stage === 'DOWN' ? 'DOWN' : stage === 'UP' ? 'UP' : 'READY'}
          </div>

          <div className="status-badge">
            <div className={`dot ${ready ? 'active' : 'inactive'}`} />
            {cameraStatus === 'requesting' ? 'CAMERA' : ready ? 'LIVE' : 'INIT'}
          </div>

          <div className={`pose-indicator ${poseDetected ? 'detected' : 'not-detected'}`}>
            {poseDetected ? 'Pose' : 'No Pose'}
          </div>

          {Object.keys(liveAngles).length > 0 && (
            <div className="angle-panel">
              <div className="angle-panel-title">Live Angles</div>
              {Object.entries(liveAngles).map(([k, v]) => (
                <div key={k} className="angle-item">
                  <span className="angle-label">{k.toUpperCase()}</span>
                  <span className="angle-value">{v}deg</span>
                </div>
              ))}
            </div>
          )}

          <div className="metrics-panel">
            <div className="metric-item"><span className="metric-label">Time</span><span className="metric-value">{formatTime(sessionTime)}</span></div>
            <div className="metric-item"><span className="metric-label">Calories</span><span className="metric-value">{displayCal}</span></div>
            <div className="metric-item"><span className="metric-label">Target</span><span className="metric-value">{cfg?.ii ? `${targetDurationSec}s` : workoutTargetText}</span></div>
            <div className="metric-item"><span className="metric-label">Total</span><span className="metric-value">{totalPlannedReps ?? ''}</span></div>
          </div>

          <div className="score-stack">
            <div className="score-box">
              <div className="score-value" style={{ color:formColor }}>{formScore}%</div>
              <div className="score-label">Form</div>
            </div>
          </div>

          {!voiceEnabled && (
            <button type="button" className="voice-enable-btn"
              onClick={() => enableVoice(true)}>
               Enable Voice Coaching
            </button>
          )}

          <div className="feedback-pill">{feedback}</div>

          {!ready && cameraError && (
            <div className="camera-error-overlay">
              <p className="camera-error-text">{cameraError}</p>
              <button type="button" className="camera-retry-btn" onClick={() => setCameraRetryToken(t => t + 1)}>Retry Camera</button>
            </div>
          )}

          {isResting && (
            <div className="rest-overlay">
              <div className="rest-timer">{restTimer}</div>
              <div className="rest-text">Rest Time  Get Ready</div>
            </div>
          )}
        </div>

        {/*  RIGHT: Instructions panel  */}
        <div className="instructions-panel">
          <div className="instr-header"> How to do it</div>

          {/* Active fault callout at top */}
          {currentFault && (
            <div className="fault-highlight">
              <div className="fault-title"> Form Correction</div>
              <div className="fault-text">{getFaultCue(currentFault)}</div>
            </div>
          )}

          {/* Step-by-step instructions */}
          {instructions.length > 0 ? (
            instructions.map((ins, i) => (
              <div key={i} className={`instr-step ${i === (reps % instructions.length) ? 'active-step' : ''}`}>
                <div className={`instr-num ${i === (reps % instructions.length) ? 'active-num' : ''}`}>{i + 1}</div>
                <div className="instr-text">{ins}</div>
              </div>
            ))
          ) : (
            // Fallback tips when no API instructions
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {cfg?.ar && cfg.ar.split(';').map((tip, i) => (
                <div key={i} className="instr-step">
                  <div className="instr-num">{i + 1}</div>
                  <div className="instr-text">{tip.trim()}</div>
                </div>
              ))}
            </div>
          )}

          {/* Form tips from config */}
          {cfg?.ar && (
            <div className="form-tip-box">
              <div className="form-tip-title"> Key Form Tips</div>
              {cfg.ar.split(';').map((rule, i) => (
                <div key={i} className="form-tip-text"> {rule.trim()}</div>
              ))}
            </div>
          )}

          {/* Common faults */}
          {cfg?.cf && (
            <div style={{ background:'rgba(239,68,68,.06)', border:'1px solid rgba(239,68,68,.2)', borderRadius:10, padding:'9px 12px' }}>
              <div style={{ fontSize:'.68rem', textTransform:'uppercase', color:'#f87171', fontWeight:700, marginBottom:5 }}> Watch Out For</div>
              {cfg.cf.split(';').map((fault, i) => (
                <div key={i} style={{ fontSize:'.75rem', color:'#fca5a5', lineHeight:1.5 }}> {fault.trim()}</div>
              ))}
            </div>
          )}
        </div>

      </div>

      <div className="controls">
        <button className="exit-btn" onClick={finishSession}>Finish Session</button>
        {voiceEnabled && (
          <button className="voice-toggle-btn" onClick={() => { setVoiceEnabled(false); window.speechSynthesis?.cancel() }}>
             Mute Voice
          </button>
        )}
      </div>
      <div className="form-history-wrap">
        <div className="form-history-head">
          <div className="form-history-title">
            Exercise Avg Form: {exerciseAvgRepForm !== null ? `${exerciseAvgRepForm}%` : '--'} ({exerciseRepSamples} reps)
          </div>
          <div className="form-history-meta">
            Last 7 days avg ({exerciseName}): {last7Avg !== null ? `${last7Avg}%` : '--'}
          </div>
        </div>
        <div className="form-history-grid">
          {last7DayForm.map((d) => (
            <div key={d.date} className="form-day">
              <div className="form-day-date">{formatDateDayMonth(d.date)}</div>
              <div className="form-day-score">{d.avgForm !== null ? `${d.avgForm}%` : '--'}</div>
              <div className="form-day-reps">{d.reps} reps</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default Trainer




