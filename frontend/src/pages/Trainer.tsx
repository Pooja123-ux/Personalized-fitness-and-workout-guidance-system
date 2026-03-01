import { useRef, useEffect, useState, useCallback } from 'react'
import { useLocation } from 'react-router-dom'
import { Pose, POSE_CONNECTIONS, Results } from '@mediapipe/pose'
import '@tensorflow/tfjs'
import axios from 'axios'

// ============================================================
// DATASET-DRIVEN POSE CONFIG
// Lookup maps exercise name (lowercase) → pose detection params
// Keys are abbreviated: pj=primaryJoint, mn=angleMin, mx=angleMax,
//   sj=secondaryJoint, sm=secAngleMin, sx=secAngleMax,
//   cv=cameraView, rd=repDirection, rs=repStart, re=repEnd,
//   ar=alignmentRules, cf=commonFaults, ii=isIsometric,
//   hs=holdSeconds, sy=symmetry (b|u|a)
// ============================================================
type ExerciseConfig = {
  pj: string; mn: number; mx: number;
  sj: string; sm: number; sx: number;
  cv: string; rd: string;
  rs: string; re: string;
  ar: string; cf: string;
  ii: boolean; hs: number; sy: string;
}

// MediaPipe landmark indices
const LM = {
  nose:0, l_shoulder:11, r_shoulder:12,
  l_elbow:13, r_elbow:14, l_wrist:15, r_wrist:16,
  l_index:19, r_index:20,
  l_hip:23, r_hip:24, l_knee:25, r_knee:26,
  l_ankle:27, r_ankle:28, l_foot:31, r_foot:32,
}

// joint → [A, vertex, B] index triplets for angle calculation
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

// ── constants ──
const MIN_VIS            = 0.5
const KEYPOINT_VIS       = 0.3
const COOLDOWN_MS        = 600
const NO_POSE_THRESHOLD  = 10
const SMOOTHING_FRAMES   = 5    // moving average window for angles
const FORM_FAULT_ANGLE   = 15   // degrees off before flagging fault
const SECONDARY_FAULT    = 20   // degrees off on secondary joint

const IMPORTANT_JOINTS = [LM.l_hip, LM.r_hip, LM.l_knee, LM.r_knee, LM.l_shoulder, LM.r_shoulder]

// ─────────────────────────────────────────────
// Utility: fuzzy match exercise name → config
// ─────────────────────────────────────────────
function getExerciseConfig(name: string, lookup: Record<string, ExerciseConfig>): ExerciseConfig | null {
  const key = name.toLowerCase().trim()
  if (lookup[key]) return lookup[key]
  // partial match - longest matching key
  let best: ExerciseConfig | null = null
  let bestLen = 0
  for (const [k, v] of Object.entries(lookup)) {
    if (key.includes(k) || k.includes(key)) {
      if (k.length > bestLen) { best = v; bestLen = k.length }
    }
  }
  if (best) return best
  // fallback: keyword match
  const keywords: Record<string, Partial<ExerciseConfig>> = {
    'squat':     { pj:'knee',     mn:70,  mx:170, sj:'hip',      sm:45,  sx:160, cv:'side', rd:'flex_extend', ar:'Knees over toes; chest up; heels flat',                  cf:'Knee valgus; heel rise; forward lean' },
    'push':      { pj:'shoulder', mn:70,  mx:170, sj:'spine',    sm:160, sx:180, cv:'side', rd:'flex_extend', ar:'Body straight; elbows 45° from body; core braced',        cf:'Hips sagging; flared elbows; partial ROM' },
    'curl':      { pj:'elbow',    mn:30,  mx:165, sj:'shoulder', sm:0,   sx:20,  cv:'side', rd:'flex_extend', ar:'Upper arm pinned; no shoulder swing; wrist neutral',      cf:'Shoulder cheating; wrist bending; partial extension' },
    'press':     { pj:'shoulder', mn:70,  mx:175, sj:'spine',    sm:160, sx:180, cv:'side', rd:'flex_extend', ar:'Core braced; wrists over elbows; no lower back arch',     cf:'Elbow flare; wrist deviation; back arch' },
    'row':       { pj:'elbow',    mn:40,  mx:160, sj:'spine',    sm:155, sx:180, cv:'side', rd:'flex_extend', ar:'Lead with elbow; retract scapula; chest up',              cf:'Shoulder shrug; rounding back; momentum' },
    'lunge':     { pj:'knee',     mn:80,  mx:170, sj:'hip',      sm:80,  sx:170, cv:'side', rd:'flex_extend', ar:'Front knee over ankle; torso upright; no knee drift',     cf:'Knee caving; torso lean; heel lifting' },
    'deadlift':  { pj:'hip',      mn:45,  mx:170, sj:'knee',     sm:150, sx:175, cv:'side', rd:'flex_extend', ar:'Neutral spine; bar close to body; shoulder blades back',  cf:'Back rounding; bar drifting; early knee extension' },
    'plank':     { pj:'spine',    mn:160, mx:180, sj:'hip',      sm:160, sx:180, cv:'side', rd:'flex_extend', ar:'Hips level; shoulders over wrists; head neutral',         cf:'Hips sagging/piking; shoulder shrug; breath holding', ii:true, hs:30 },
    'sit-up':    { pj:'spine',    mn:20,  mx:85,  sj:'hip',      sm:85,  sx:130, cv:'side', rd:'flex_extend', ar:'Lower back on floor; chin tucked; no neck pulling',       cf:'Pulling neck; hip flexors dominating; bouncing' },
    'crunch':    { pj:'spine',    mn:30,  mx:80,  sj:'hip',      sm:90,  sx:110, cv:'side', rd:'flex_extend', ar:'Small controlled motion; exhale on way up; lower back flat', cf:'Pulling neck; full sit-up motion; breath holding' },
    'raise':     { pj:'shoulder', mn:10,  mx:90,  sj:'elbow',    sm:150, sx:180, cv:'front', rd:'abduct_adduct', ar:'Lead with elbow; no shrug; control descent',          cf:'Shrugging; swinging; above 90°' },
    'fly':       { pj:'shoulder', mn:140, mx:170, sj:'elbow',    sm:150, sx:180, cv:'front', rd:'abduct_adduct', ar:'Maintain slight elbow bend; arc motion; squeeze at top', cf:'Bending elbows too much; no squeeze; excessive weight' },
    'dip':       { pj:'elbow',    mn:70,  mx:165, sj:'shoulder', sm:80,  sx:180, cv:'side', rd:'flex_extend', ar:'Elbows close; full ROM; controlled descent',              cf:'Partial ROM; dropping fast; shoulder impingement' },
    'extension': { pj:'elbow',    mn:20,  mx:150, sj:'shoulder', sm:150, sx:180, cv:'side', rd:'flex_extend', ar:'Upper arm still; only forearm moves; lock out',           cf:'Upper arm moving; using shoulder; partial ROM' },
    'calf':      { pj:'ankle',    mn:70,  mx:110, sj:'knee',     sm:155, sx:180, cv:'side', rd:'flex_extend', ar:'Full ROM; slow descent; legs straight',                  cf:'Bouncing; partial ROM; ankle rolling' },
    'jump':      { pj:'knee',     mn:70,  mx:170, sj:'hip',      sm:70,  sx:170, cv:'side', rd:'flex_extend', ar:'Soft landing; knees over toes; use arms',                cf:'Stiff landing; knee valgus; no arm swing' },
    'run':       { pj:'knee',     mn:60,  mx:170, sj:'hip',      sm:60,  sx:170, cv:'side', rd:'flex_extend', ar:'Forward lean; high knee drive; arms at 90°',             cf:'Overstriding; upright; low knee drive' },
    'bridge':    { pj:'hip',      mn:90,  mx:170, sj:'knee',     sm:80,  sx:100, cv:'side', rd:'flex_extend', ar:'Push through heels; squeeze glutes; no lumbar hyperextension', cf:'Lumbar hyperextension; knees caving; incomplete ROM' },
    'pull-up':   { pj:'elbow',    mn:40,  mx:170, sj:'shoulder', sm:90,  sx:180, cv:'front', rd:'flex_extend', ar:'Depress scapula first; full extension; no kipping',    cf:'Kipping; not reaching full extension; shoulder shrug' },
    'twist':     { pj:'spine',    mn:30,  mx:90,  sj:'hip',      sm:155, sx:180, cv:'front', rd:'rotate',       ar:'Hips fixed; rotate thoracic spine; controlled',        cf:'Hips rotating; insufficient ROM; speed over control' },
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
  // absolute fallback
  return { pj:'knee', mn:70, mx:170, sj:'hip', sm:60, sx:170, cv:'side', rd:'flex_extend', rs:'', re:'', ar:'Maintain good form throughout', cf:'Ensure full range of motion', ii:false, hs:30, sy:'b' }
}

function Trainer() {
  const videoRef    = useRef<HTMLVideoElement | null>(null)
  const canvasRef   = useRef<HTMLCanvasElement | null>(null)
  const [ready, setReady]                       = useState(false)
  const [cameraError, setCameraError]           = useState<string | null>(null)
  const [cameraStatus, setCameraStatus]         = useState<'idle'|'requesting'|'ready'|'error'>('idle')
  const [cameraRetryToken, setCameraRetryToken] = useState(0)
  const [reps, setReps]                         = useState(0)
  const [stage, setStage]                       = useState<'UP'|'DOWN'|'NONE'>('NONE')
  const [feedback, setFeedback]                 = useState('Position yourself in view')
  const [sessionTime, setSessionTime]           = useState(0)
  const [caloriesBurned, setCaloriesBurned]     = useState(0)
  const [formScore, setFormScore]               = useState(100)
  const [poseMatchScore, setPoseMatchScore]     = useState(100)
  const [poseDetected, setPoseDetected]         = useState(false)
  const [isResting, setIsResting]               = useState(false)
  const [restTimer, setRestTimer]               = useState(0)
  const [liveAngles, setLiveAngles]             = useState<Record<string,number>>({})
  const [referenceAngles, setReferenceAngles]   = useState<Record<string,number>>({})
  const [currentFault, setCurrentFault]         = useState('')
  const [exerciseConfig, setExerciseConfig]     = useState<ExerciseConfig | null>(null)
  const [configLoaded, setConfigLoaded]         = useState(false)

  // Angle smoothing buffers
  const angleBufferL = useRef<Record<string, number[]>>({})
  const angleBufferR = useRef<Record<string, number[]>>({})

  // Rep counting state
  const lastRepTime      = useRef(0)
  const lastStageRef     = useRef<'UP'|'DOWN'|'NONE'>('NONE')
  const repPhase         = useRef<'up'|'down'>('up')  // current phase
  const consecutiveDown  = useRef(0)  // frames in down position
  const consecutiveUp    = useRef(0)  // frames in up position

  const location = useLocation()
  const params        = new URLSearchParams(location.search)
  const exerciseName  = (params.get('name') || 'Bodyweight Squats').toString()
  const targetReps    = (params.get('reps') || '').toString()
  const fallbackGif   = (params.get('gif') || '').toString()
  const idx           = parseInt((params.get('idx') || '0').toString(), 10)
  const [gifSrc, setGifSrc]                     = useState<string>('')
  const [apiGifSrc, setApiGifSrc]               = useState<string>('')
  const [targetTotal, setTargetTotal]           = useState<number | null>(null)
  const [targetDurationSec, setTargetDurationSec] = useState<number | null>(null)
  const [holdElapsedSec, setHoldElapsedSec]     = useState(0)
  const [voiceEnabled, setVoiceEnabled]         = useState(false)
  const [plan, setPlan]                         = useState<Array<{name:string;repetitions:string;gif_url:string}>>([])
  const [instructions, setInstructions]         = useState<string[]>([])
  const [poseHints, setPoseHints]               = useState<any>(null)
  const [exerciseMetadata, setExerciseMetadata] = useState<any>(null)

  const gifPoseRef              = useRef<Pose | null>(null)
  const poseStableFrames        = useRef(0)
  const lastAnglesRef           = useRef<Record<string,number>>({})
  const isPoseStableRef         = useRef(false)
  const lastVoiceTime           = useRef(0)
  const noPoseFrames            = useRef(0)
  const lastLandmarksRef        = useRef<any | null>(null)
  const [instructionIndex, setInstructionIndex] = useState(0)
  const instructionsContainerRef = useRef<HTMLDivElement | null>(null)
  const advancingRef             = useRef(false)
  const lastRepSpokenRef         = useRef(0)
  const voiceAnnouncedRef        = useRef(false)
  const lastInstructionVoiceAtRef = useRef(0)
  const exerciseLookup           = useRef<Record<string, ExerciseConfig>>({})
  const configRef                = useRef<ExerciseConfig | null>(null)

  const streamRef = useRef<MediaStream | null>(null)
  const poseRef   = useRef<Pose | null>(null)

  // ──────────────────────────────────────────────────
  // Load the exercise dataset lookup on mount
  // ──────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      try {
        const base = import.meta.env.VITE_API_BASE || ''
        const res = await fetch(`${base}/exercises/pose-config`)
        if (res.ok) {
          const json = await res.json()
          exerciseLookup.current = json
        }
      } catch {
        // fallback: lookup stays empty, keyword matching will handle it
      }
      // Resolve config for current exercise
      const cfg = getExerciseConfig(exerciseName, exerciseLookup.current)
      configRef.current = cfg
      setExerciseConfig(cfg)
      setConfigLoaded(true)
      if (cfg) {
        const tDur = cfg.ii ? cfg.hs : null
        if (tDur) { setTargetDurationSec(tDur); setTargetTotal(null) }
      }
    }
    load()
  }, [exerciseName])

  // ──────────────────────────────────────────────────
  // HELPER FUNCTIONS
  // ──────────────────────────────────────────────────
  function toAbsoluteApiUrl(base: string, url: string): string {
    if (!url) return ''
    if (url.startsWith('http://') || url.startsWith('https://')) return url
    const trimmedBase = base.endsWith('/') ? base.slice(0, -1) : base
    const trimmedPath = url.startsWith('/') ? url : `/${url}`
    return `${trimmedBase}${trimmedPath}`
  }

  const localGifAliases: Record<string, string> = {
    '3/4 sit-up': '34-sit-up',
    'bench dip (knees bent)': 'bench-dip-knees-bent',
    'archer push up': 'archer-push-ups',
    'archer pull up': 'archer-pull-up',
    'astride jumps (male)': 'astride-jumps-male',
    'all fours squad stretch': 'all-fours-squad-stretch',
    'ankle circles': 'ankle-circles',
    'bear crawl': 'bear-crawl.',
    'back and forth step': 'back-and-forth-step.',
  }

  function buildCameraErrorMessage(err: unknown): string {
    const e = err as { name?: string; message?: string }
    const name = String(e?.name || '')
    const host = window.location.hostname
    const isSecure = window.location.protocol === 'https:' || host === 'localhost' || host === '127.0.0.1'
    if (!isSecure) return 'Camera blocked: open on https:// or localhost.'
    if (name === 'NotAllowedError' || name === 'SecurityError') return 'Camera permission denied. Allow in browser settings and retry.'
    if (name === 'NotFoundError' || name === 'DevicesNotFoundError') return 'No camera found on this device.'
    if (name === 'NotReadableError' || name === 'TrackStartError') return 'Camera in use by another app. Close it and retry.'
    if (name === 'OverconstrainedError') return 'Camera constraints unsupported. Retry.'
    return `Unable to start camera${e?.message ? `: ${e.message}` : '.'}`
  }

  // ──────────────────────────────────────────────────
  // ANGLE CALCULATION — 3 landmark indices
  // ──────────────────────────────────────────────────
  function calculateAngle(lm: any[], a: number, b: number, c: number): number {
    const pa = lm[a], pb = lm[b], pc = lm[c]
    if (!pa || !pb || !pc) return 0
    if ((pa.visibility ?? 0) < KEYPOINT_VIS || (pb.visibility ?? 0) < KEYPOINT_VIS || (pc.visibility ?? 0) < KEYPOINT_VIS) return -1
    const ab = { x: pa.x - pb.x, y: pa.y - pb.y }
    const cb = { x: pc.x - pb.x, y: pc.y - pb.y }
    const dot = ab.x * cb.x + ab.y * cb.y
    const mag1 = Math.sqrt(ab.x ** 2 + ab.y ** 2)
    const mag2 = Math.sqrt(cb.x ** 2 + cb.y ** 2)
    if (mag1 === 0 || mag2 === 0) return 0
    const cos = dot / (mag1 * mag2)
    return (Math.acos(Math.min(1, Math.max(-1, cos))) * 180) / Math.PI
  }

  // ──────────────────────────────────────────────────
  // SMOOTHED ANGLE — exponential moving average
  // ──────────────────────────────────────────────────
  function smoothAngle(buffer: Record<string, number[]>, joint: string, raw: number): number {
    if (raw < 0) return buffer[joint]?.[buffer[joint].length - 1] ?? 0
    if (!buffer[joint]) buffer[joint] = []
    buffer[joint].push(raw)
    if (buffer[joint].length > SMOOTHING_FRAMES) buffer[joint].shift()
    return buffer[joint].reduce((a, b) => a + b, 0) / buffer[joint].length
  }

  // ──────────────────────────────────────────────────
  // POSE VALIDATION
  // ──────────────────────────────────────────────────
  function validatePose(lm: any[]): { isValid: boolean; avgConfidence: number } {
    if (!lm?.length) return { isValid: false, avgConfidence: 0 }
    const confs = IMPORTANT_JOINTS.map(i => lm[i]?.visibility ?? 0).filter(v => v > 0)
    if (!confs.length) return { isValid: false, avgConfidence: 0 }
    const avg = confs.reduce((a, b) => a + b, 0) / confs.length
    return { isValid: confs.every(c => c >= KEYPOINT_VIS) && avg >= MIN_VIS, avgConfidence: avg }
  }

  const resetPoseState = useCallback(() => {
    setPoseDetected(false)
    setFormScore(0)
    setPoseMatchScore(0)
    setLiveAngles({})
    setCurrentFault('')
  }, [])

  // ──────────────────────────────────────────────────
  // SESSION TIMER
  // ──────────────────────────────────────────────────
  useEffect(() => {
    const interval = setInterval(() => setSessionTime(t => t + 1), 1000)
    return () => clearInterval(interval)
  }, [])

  // ──────────────────────────────────────────────────
  // LOAD EXERCISE DATA FROM API
  // ──────────────────────────────────────────────────
  useEffect(() => {
    async function loadExerciseData() {
      try {
        const base = import.meta.env.VITE_API_BASE || ''
        const res = await axios.get(`${base}/exercises/instructions`, { params: { name: exerciseName } })
        const list = Array.isArray(res.data?.instructions) ? res.data.instructions : []
        setInstructions(list)
        setExerciseMetadata(res.data)
        const resolvedGif = String(res.data?.resolvedGifUrl || res.data?.localGifUrl || '')
        setApiGifSrc(toAbsoluteApiUrl(base, resolvedGif))
        if (list.length > 0) { setFeedback(list[0]); speak(list[0], 'high') }
        try {
          const hintsRes = await axios.get(`${base}/exercises/pose-hints/${encodeURIComponent(exerciseName)}`)
          setPoseHints(hintsRes.data.pose_hints)
        } catch { setPoseHints(null) }
      } catch {
        setInstructions([])
        setExerciseMetadata(null)
        setPoseHints(null)
      }
    }
    loadExerciseData()
  }, [exerciseName])

  // ──────────────────────────────────────────────────
  // REST TIMER
  // ──────────────────────────────────────────────────
  useEffect(() => {
    if (!isResting) return
    if (restTimer <= 0) { setIsResting(false); speak("Rest complete, let's go!"); return }
    const interval = setInterval(() => setRestTimer(t => t - 1), 1000)
    return () => clearInterval(interval)
  }, [isResting, restTimer])

  // ──────────────────────────────────────────────────
  // CALORIES
  // ──────────────────────────────────────────────────
  useEffect(() => {
    const calMap: Record<string, number> = { squat:0.32, push:0.29, plank:0.15, jump:0.4, burpee:0.5, lunge:0.25, curl:0.22, press:0.28, row:0.27, deadlift:0.35 }
    let cpr = 0.2
    for (const [k, v] of Object.entries(calMap)) {
      if (exerciseName.toLowerCase().includes(k)) { cpr = v; break }
    }
    setCaloriesBurned(Math.round(reps * cpr * 10) / 10)
  }, [reps, exerciseName])

  // ──────────────────────────────────────────────────
  // VOICE FEEDBACK
  // ──────────────────────────────────────────────────
  const voiceQueue   = useRef<string[]>([])
  const isSpeaking   = useRef(false)

  function speak(text: string, priority: 'low'|'medium'|'high' = 'medium') {
    if (!text?.trim() || !voiceEnabled) return
    const now = Date.now()
    if (priority === 'low'    && now - lastVoiceTime.current < 4000) return
    if (priority === 'medium' && now - lastVoiceTime.current < 2000) return
    if (!window.speechSynthesis) return
    if (isSpeaking.current) { if (priority === 'high') voiceQueue.current.unshift(text); else voiceQueue.current.push(text); return }
    isSpeaking.current = true
    lastVoiceTime.current = now
    const synth = window.speechSynthesis
    const utter = new SpeechSynthesisUtterance(text)
    utter.rate = 0.95; utter.pitch = 1.05; utter.volume = 0.9
    const voices = synth.getVoices()
    if (voices.length > 0) {
      const v = voices.find(v => v.name.includes('Samantha') || v.name.includes('Karen') || v.name.includes('Female') || v.lang.startsWith('en'))
      if (v) utter.voice = v
    }
    utter.onend = () => {
      isSpeaking.current = false
      if (voiceQueue.current.length > 0) {
        const next = voiceQueue.current.shift()
        if (next) setTimeout(() => speak(next, 'medium'), 300)
      }
    }
    utter.onerror = () => { isSpeaking.current = false }
    synth.cancel()
    synth.speak(utter)
  }

  useEffect(() => {
    if (window.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = () => { window.speechSynthesis.getVoices() }
      window.speechSynthesis.getVoices()
    }
  }, [])

  useEffect(() => {
    const enable = () => { setVoiceEnabled(true); window.removeEventListener('pointerdown', enable) }
    window.addEventListener('pointerdown', enable, { once: true })
    return () => window.removeEventListener('pointerdown', enable)
  }, [])

  useEffect(() => {
    if (!voiceEnabled || voiceAnnouncedRef.current) return
    voiceAnnouncedRef.current = true
    speak('Voice coaching enabled', 'high')
    if (exerciseConfig?.ar) setTimeout(() => speak(exerciseConfig.ar.split(';')[0], 'medium'), 2000)
  }, [voiceEnabled, exerciseConfig])

  useEffect(() => {
    if (!voiceEnabled || !instructions.length) return
    const now = Date.now()
    if (now - lastInstructionVoiceAtRef.current < 8000) return
    const active = instructions[Math.max(0, Math.min(instructionIndex, instructions.length - 1))]
    if (!active) return
    lastInstructionVoiceAtRef.current = now
    speak(active, 'low')
  }, [instructionIndex, instructions, voiceEnabled])

  // ──────────────────────────────────────────────────
  // NAVIGATION
  // ──────────────────────────────────────────────────
  function goToIndex(i: number, p: Array<{name:string;repetitions:string;gif_url:string}>) {
    const next = p[i]
    if (!next) return
    advancingRef.current = false
    setReps(0); setHoldElapsedSec(0); setStage('NONE')
    window.location.href = `/trainer?name=${encodeURIComponent(next.name)}&reps=${encodeURIComponent(next.repetitions||'')}&gif=${encodeURIComponent(next.gif_url||'')}&idx=${i}`
  }

  function parseTarget(text: string): number | null {
    const t = (text||'').toLowerCase().trim()
    if (!t) return null
    const sr = t.match(/(\d+)\s*x\s*(\d+)/)
    if (sr) { const s=parseInt(sr[1],10), r=parseInt(sr[2],10); if (!isNaN(s)&&!isNaN(r)) return s*r }
    const range = t.match(/(\d+)\s*(?:-|to)\s*(\d+)/)
    if (range) { const l=parseInt(range[1],10), h=parseInt(range[2],10); if (!isNaN(l)&&!isNaN(h)) return Math.max(l,h) }
    const ro = t.match(/(\d+)\s*(rep|reps|repetition|repetitions)\b/)
    if (ro) { const v=parseInt(ro[1],10); if (!isNaN(v)) return v }
    const n = t.match(/\b(\d+)\b/)
    if (n) { const v=parseInt(n[1],10); if (!isNaN(v)) return v }
    return null
  }

  function parseDurationSeconds(text: string): number | null {
    const t = (text||'').toLowerCase().trim()
    if (!t) return null
    const sec = t.match(/(\d+)\s*(s|sec|secs|second|seconds)\b/)
    if (sec) { const v=parseInt(sec[1],10); return isNaN(v)?null:v }
    const min = t.match(/(\d+)\s*(m|min|mins|minute|minutes)\b/)
    if (min) { const v=parseInt(min[1],10); return isNaN(v)?null:v*60 }
    return null
  }

  function isHoldExercise(name: string): boolean {
    const t = name.toLowerCase()
    if (exerciseConfig?.ii) return true
    return t.includes('plank')||t.includes('hold')||t.includes('wall sit')||t.includes('bridge pose')
  }

  function advanceNext() {
    if (advancingRef.current) return
    advancingRef.current = true
    if (!plan.length) { advancingRef.current = false; return }
    const nextIdx = idx + 1
    if (nextIdx >= plan.length) {
      speak('Workout complete. Great job!')
      setFeedback('Workout complete!')
      setTimeout(() => { advancingRef.current = false; window.history.back() }, 3000)
      return
    }
    const next = plan[nextIdx]
    setReps(0); setHoldElapsedSec(0); setStage('NONE')
    setIsResting(true); setRestTimer(30)
    speak(`Rest for 30 seconds. Next: ${next.name}`)
    setTimeout(() => {
      window.location.href = `/trainer?name=${encodeURIComponent(next.name)}&reps=${encodeURIComponent(next.repetitions||'')}&gif=${encodeURIComponent(next.gif_url||'')}&idx=${nextIdx}`
    }, 31000)
  }

  useEffect(() => {
    const targetByReps     = parseTarget(targetReps)
    const targetByDuration = parseDurationSeconds(targetReps)
    if (isHoldExercise(exerciseName) && targetByDuration) {
      setTargetTotal(null); setTargetDurationSec(targetByDuration)
    } else {
      setTargetTotal(targetByReps); setTargetDurationSec(exerciseConfig?.ii ? (exerciseConfig.hs ?? null) : null)
    }
    setHoldElapsedSec(0)
    advancingRef.current = false
    lastRepSpokenRef.current = 0
    try {
      const raw = sessionStorage.getItem('workoutPlan') || '[]'
      const arr = JSON.parse(raw)
      const p = Array.isArray(arr) ? arr : []
      setPlan(p)
      if (!params.get('name') && p.length > 0) {
        const first = p[0]
        window.location.replace(`/trainer?name=${encodeURIComponent(first.name)}&reps=${encodeURIComponent(first.repetitions||'')}&gif=${encodeURIComponent(first.gif_url||'')}&idx=0`)
      }
    } catch { setPlan([]) }
  }, [exerciseName, targetReps, exerciseConfig])

  useEffect(() => {
    if (advancingRef.current) return
    if (targetTotal !== null && reps >= targetTotal) { speak('Exercise complete!'); advanceNext() }
  }, [reps, targetTotal])

  useEffect(() => {
    if (reps <= 0 || reps === lastRepSpokenRef.current) return
    lastRepSpokenRef.current = reps
    const cfg = configRef.current
    // Voice: every rep with dynamic motivation
    const motivations = ['Good rep!', 'Keep going!', 'Nice!', 'Strong!', 'Great form!']
    const mot = motivations[reps % motivations.length]
    if (targetTotal && targetTotal > 0) {
      const remaining = targetTotal - reps
      setFeedback(`Rep ${reps} / ${targetTotal} ✓`)
      if (remaining === 0) speak(`${reps} reps done! Exercise complete!`, 'high')
      else if (remaining <= 3) speak(`${remaining} more to go!`, 'high')
      else speak(`Rep ${reps}. ${mot}`, 'low')
      // update instruction index
      if (instructions.length > 0) {
        setInstructionIndex(Math.min(instructions.length-1, Math.floor((reps/targetTotal)*instructions.length)))
      }
    } else {
      setFeedback(`Rep ${reps} ✓`)
      speak(`Rep ${reps}. ${mot}`, 'low')
    }
    // Speak alignment reminder every 5 reps
    if (cfg?.ar && reps > 0 && reps % 5 === 0) {
      const rule = cfg.ar.split(';')[0]
      setTimeout(() => speak(rule, 'medium'), 1200)
    }
  }, [reps, targetTotal, instructions.length, exerciseConfig])

  useEffect(() => {
    if (advancingRef.current) return
    if (targetDurationSec !== null && holdElapsedSec >= targetDurationSec) { speak('Hold complete!'); advanceNext() }
  }, [holdElapsedSec, targetDurationSec])

  useEffect(() => {
    if (!ready || targetDurationSec === null || isResting) return
    const timer = setInterval(() => { if (isPoseStableRef.current) setHoldElapsedSec(s => s + 1) }, 1000)
    return () => clearInterval(timer)
  }, [ready, targetDurationSec, isResting])

  // ──────────────────────────────────────────────────
  // DRAWING — landmarks on canvas
  // ──────────────────────────────────────────────────
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
    const primaryJoint = cfg?.pj ?? ''

    // Draw skeleton connections
    ctx.lineWidth = 3
    ctx.lineCap = 'round'
    for (const [a, b] of (POSE_CONNECTIONS as any)) {
      const p1 = lm[a], p2 = lm[b]
      if ((p1?.visibility ?? 0) > 0.5 && (p2?.visibility ?? 0) > 0.5) {
        ctx.strokeStyle = '#10b981'
        ctx.beginPath()
        ctx.moveTo((1 - p1.x) * canvas.width, p1.y * canvas.height)
        ctx.lineTo((1 - p2.x) * canvas.width, p2.y * canvas.height)
        ctx.stroke()
      }
    }

    // Draw keypoints — highlight primary joint's triplet
    const highlightIndices = new Set<number>()
    if (primaryJoint && TRIPLET_L[primaryJoint]) {
      TRIPLET_L[primaryJoint].forEach(i => highlightIndices.add(i))
      TRIPLET_R[primaryJoint].forEach(i => highlightIndices.add(i))
    }

    lm.forEach((landmark, i) => {
      if ((landmark?.visibility ?? 0) > 0.5) {
        const x = (1 - landmark.x) * canvas.width
        const y = landmark.y * canvas.height
        ctx.beginPath()
        if (highlightIndices.has(i)) {
          ctx.arc(x, y, 7, 0, 2 * Math.PI)
          ctx.fillStyle = formScore > 70 ? '#facc15' : '#ef4444'
          ctx.shadowColor = formScore > 70 ? '#facc15' : '#ef4444'
          ctx.shadowBlur = 12
        } else {
          ctx.arc(x, y, 4, 0, 2 * Math.PI)
          ctx.fillStyle = '#ffffff'
          ctx.shadowBlur = 0
        }
        ctx.fill()
        ctx.shadowBlur = 0
      }
    })

    // Draw angle arc on primary joint vertex
    if (primaryJoint && TRIPLET_L[primaryJoint]) {
      const [, vIdx] = TRIPLET_L[primaryJoint]
      const v = lm[vIdx]
      if (v && (v.visibility ?? 0) > 0.5) {
        const x = (1 - v.x) * canvas.width
        const y = v.y * canvas.height
        const angle = liveAngles[`${primaryJoint}_L`] ?? liveAngles[primaryJoint] ?? 0
        // Draw angle label
        ctx.fillStyle = formScore > 70 ? '#facc15' : '#ef4444'
        ctx.font = 'bold 14px monospace'
        ctx.fillText(`${Math.round(angle)}°`, x + 10, y - 10)
        // Draw arc indicator
        ctx.beginPath()
        ctx.strokeStyle = formScore > 70 ? 'rgba(250,204,21,0.6)' : 'rgba(239,68,68,0.6)'
        ctx.lineWidth = 2
        ctx.arc(x, y, 22, 0, (angle / 180) * Math.PI)
        ctx.stroke()
      }
    }

    ctx.restore()
  }

  // ──────────────────────────────────────────────────
  // POSE STABILITY DETECTION
  // ──────────────────────────────────────────────────
  function detectPoseStability(newAngles: Record<string, number>): boolean {
    const threshold = 12
    if (Object.keys(lastAnglesRef.current).length === 0) {
      lastAnglesRef.current = newAngles
      poseStableFrames.current = 1
      isPoseStableRef.current = false
      return false
    }
    let stable = true
    for (const [joint, angle] of Object.entries(newAngles)) {
      const last = lastAnglesRef.current[joint]
      if (last !== undefined && Math.abs(angle - last) > threshold) { stable = false; break }
    }
    poseStableFrames.current = stable ? poseStableFrames.current + 1 : 0
    isPoseStableRef.current = poseStableFrames.current >= 1
    lastAnglesRef.current = newAngles
    return isPoseStableRef.current
  }

  // ──────────────────────────────────────────────────
  // CORE: ANALYZE FORM — dataset-driven
  // ──────────────────────────────────────────────────
  function analyzeForm(results: Results) {
    const currentLm = results.poseLandmarks
    const lm = currentLm || lastLandmarksRef.current
    if (!lm) {
      noPoseFrames.current += 1
      if (noPoseFrames.current > NO_POSE_THRESHOLD) {
        resetPoseState()
        setFeedback('⚠️ No pose detected — step back so your full body is visible')
      }
      return
    }

    const validation = validatePose(lm)
    if (!validation.isValid) {
      noPoseFrames.current += 1
      if (noPoseFrames.current > NO_POSE_THRESHOLD) {
        resetPoseState()
        setFeedback('⚠️ Pose unclear — ensure good lighting and back away from camera')
      }
      return
    }

    noPoseFrames.current = 0
    setPoseDetected(true)
    lastLandmarksRef.current = lm

    const cfg = configRef.current
    if (!cfg) return

    // ── Compute smoothed angles for primary joint (both sides) ──
    const pj = cfg.pj
    const tripL = TRIPLET_L[pj]
    const tripR = TRIPLET_R[pj]
    let angleL = -1, angleR = -1

    if (tripL) {
      const raw = calculateAngle(lm, tripL[0], tripL[1], tripL[2])
      angleL = smoothAngle(angleBufferL.current, pj, raw)
    }
    if (tripR) {
      const raw = calculateAngle(lm, tripR[0], tripR[1], tripR[2])
      angleR = smoothAngle(angleBufferR.current, pj, raw)
    }

    // Use the "better" side (higher visibility or average)
    const primaryAngle = (angleL >= 0 && angleR >= 0) ? (angleL + angleR) / 2 : (angleL >= 0 ? angleL : angleR)

    // ── Secondary joint ──
    let secondaryAngle = -1
    if (cfg.sj && TRIPLET_L[cfg.sj]) {
      const sTripL = TRIPLET_L[cfg.sj]
      const rawS = calculateAngle(lm, sTripL[0], sTripL[1], sTripL[2])
      secondaryAngle = smoothAngle(angleBufferL.current, cfg.sj, rawS)
    }

    // ── Update displayed angles ──
    const newAngles: Record<string, number> = {}
    if (angleL >= 0) newAngles[`${pj}_L`] = Math.round(angleL)
    if (angleR >= 0) newAngles[`${pj}_R`] = Math.round(angleR)
    if (secondaryAngle >= 0 && cfg.sj) newAngles[cfg.sj] = Math.round(secondaryAngle)
    setLiveAngles(newAngles)

    // ── Rep counting: dataset-driven state machine ──
    let repCounted = false
    let feedbackMessage = ''
    let voiceMessage = ''
    let voicePriority: 'low'|'medium'|'high' = 'medium'
    let formPenalty = 0

    if (!cfg.ii && primaryAngle >= 0) {
      const midPoint = (cfg.mn + cfg.mx) / 2
      const isInDownPhase = primaryAngle < midPoint  // toward min = "down/contracted"
      const isInUpPhase   = primaryAngle > midPoint  // toward max = "up/extended"

      if (isInDownPhase) {
        consecutiveDown.current += 1
        consecutiveUp.current = 0
        if (consecutiveDown.current >= 2 && repPhase.current === 'up') {
          repPhase.current = 'down'
          lastStageRef.current = 'DOWN'
          setStage('DOWN')
          feedbackMessage = cfg.rd === 'abduct_adduct' ? '↔ Good spread!' : '⬇ Good depth!'
        }
      } else if (isInUpPhase) {
        consecutiveUp.current += 1
        consecutiveDown.current = 0
        if (consecutiveUp.current >= 2 && repPhase.current === 'down') {
          // ✅ Rep counted: DOWN → UP transition with cooldown
          const now = Date.now()
          if (now - lastRepTime.current > COOLDOWN_MS) {
            lastRepTime.current = now
            repPhase.current = 'up'
            lastStageRef.current = 'UP'
            setStage('UP')
            setReps(r => r + 1)
            repCounted = true
            feedbackMessage = '✅ Rep complete!'
          }
        }
      }
    }

    // ── Isometric hold detection ──
    if (cfg.ii && primaryAngle >= 0) {
      const inHoldRange = primaryAngle >= cfg.mn && primaryAngle <= cfg.mx
      isPoseStableRef.current = inHoldRange
      if (!inHoldRange) {
        feedbackMessage = `⚠️ Get into position (${cfg.mn}°–${cfg.mx}°)`
        voiceMessage = `Hold between ${cfg.mn} and ${cfg.mx} degrees`
        voicePriority = 'medium'
      }
    }

    // ── Form checking: secondary joint ──
    if (cfg.sj && secondaryAngle >= 0 && cfg.sm > 0 && cfg.sx > 0) {
      const inRange = secondaryAngle >= cfg.sm && secondaryAngle <= cfg.sx
      if (!inRange) {
        const fault = cfg.cf.split(';')[0] || cfg.ar.split(';')[0]
        formPenalty += 20
        if (fault) {
          setCurrentFault(fault)
          if (!repCounted) {
            feedbackMessage = `⚠️ ${fault}`
            voiceMessage = fault
            voicePriority = 'high'
          }
          // Speak form fault every ~5 sec
          const now = Date.now()
          if (now - lastVoiceTime.current > 5000) {
            speak(fault, 'high')
          }
        }
      } else {
        if (currentFault) setCurrentFault('')
      }
    }

    // ── Pose match score: how close is angle to ideal range midpoint ──
    const isStable = detectPoseStability(newAngles)
    if (isStable && primaryAngle >= 0) {
      const midRef = referenceAngles[pj] ?? (cfg.mn + cfg.mx) / 2
      const diff = Math.abs(primaryAngle - midRef)
      const matchPct = Math.max(0, 100 - diff * 1.8)
      setPoseMatchScore(Math.round(matchPct))
      setFormScore(Math.max(0, Math.round(100 - formPenalty - diff * 0.5)))
    }

    // ── Feedback messaging ──
    if (!feedbackMessage && !repCounted) {
      const inRange = primaryAngle >= cfg.mn && primaryAngle <= cfg.mx
      if (primaryAngle < cfg.mn - 5) feedbackMessage = `Go deeper — target ${cfg.mn}°`
      else if (primaryAngle > cfg.mx + 5) feedbackMessage = `Engage fully — target ${cfg.mx}°`
      else if (inRange) feedbackMessage = `✓ Good range (${Math.round(primaryAngle)}°)`
    }

    if (feedbackMessage) setFeedback(feedbackMessage)
    if (voiceMessage) speak(voiceMessage, voicePriority)
  }

  // ──────────────────────────────────────────────────
  // GIF source loading
  // ──────────────────────────────────────────────────
  function slugify(text: string) {
    return (text||'').toLowerCase().replace(/[^a-z0-9\s-]/g,'').trim().replace(/\s+/g,'-')
  }

  useEffect(() => {
    const nameLower = exerciseName.toLowerCase()
    const alias = localGifAliases[nameLower]
    const aliasUrl = alias ? `/gifs/${alias}.gif` : null
    const slugUrl = `/gifs/${slugify(exerciseName)}.gif`
    const squatVideoUrl = nameLower.includes('squat') ? '/gifs/squat.mp4' : null

    const tryLoad = (url: string, onFail: () => void) => {
      const img = new Image(); img.onload = () => setGifSrc(url); img.onerror = onFail; img.src = url
    }
    const trySlug = () => {
      if (squatVideoUrl) { setGifSrc(squatVideoUrl) }
      else tryLoad(slugUrl, () => { setGifSrc(''); setFeedback('GIF not found — using live guidance') })
    }
    const tryAlias = () => aliasUrl ? tryLoad(aliasUrl, trySlug) : trySlug()

    if (apiGifSrc) {
      apiGifSrc.endsWith('.mp4') ? setGifSrc(apiGifSrc) : tryLoad(apiGifSrc, () => fallbackGif ? tryLoad(fallbackGif, tryAlias) : tryAlias())
    } else if (fallbackGif) {
      fallbackGif.endsWith('.mp4') ? setGifSrc(fallbackGif) : tryLoad(fallbackGif, tryAlias)
    } else tryAlias()
  }, [exerciseName, fallbackGif, apiGifSrc])

  // ──────────────────────────────────────────────────
  // GIF → reference angles
  // ──────────────────────────────────────────────────
  useEffect(() => {
    if (!gifSrc || gifSrc.endsWith('.mp4')) return
    const img = new Image(); img.crossOrigin = 'anonymous'
    img.onload = async () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.width; canvas.height = img.height
      canvas.getContext('2d')!.drawImage(img, 0, 0)
      if (!gifPoseRef.current) {
        gifPoseRef.current = new Pose({ locateFile: f => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${f}` })
        gifPoseRef.current.setOptions({ modelComplexity:1, smoothLandmarks:true, enableSegmentation:false, minDetectionConfidence:0.5, minTrackingConfidence:0.5 })
      }
      gifPoseRef.current.onResults((res: Results) => {
        const lm = res.poseLandmarks; if (!lm) return
        const cfg = configRef.current; if (!cfg) return
        const pj = cfg.pj
        const trip = TRIPLET_L[pj]
        if (trip) {
          const angle = calculateAngle(lm, trip[0], trip[1], trip[2])
          if (angle > 0) setReferenceAngles({ [pj]: Math.round(angle) })
        }
      })
      try { await gifPoseRef.current.send({ image: canvas }) } catch { /* ignore */ }
    }
    img.src = gifSrc
  }, [gifSrc, exerciseName, exerciseConfig])

  // ──────────────────────────────────────────────────
  // Instructions auto-scroll
  // ──────────────────────────────────────────────────
  useEffect(() => {
    if (!instructions.length) return
    setInstructionIndex(0)
    const interval = setInterval(() => setInstructionIndex(prev => (prev + 1) % instructions.length), 5000)
    return () => clearInterval(interval)
  }, [instructions])

  useEffect(() => {
    if (!instructionsContainerRef.current || !instructions.length) return
    const container = instructionsContainerRef.current
    const items = container.querySelectorAll('.instruction-slide')
    const active = items[instructionIndex] as HTMLElement | undefined
    if (active) container.scrollTo({ top: active.offsetTop - container.offsetTop, behavior: 'smooth' })
  }, [instructionIndex, instructions])

  function scrollInstructions(direction: 'up'|'down') {
    instructionsContainerRef.current?.scrollBy({ top: direction === 'up' ? -80 : 80, behavior: 'smooth' })
  }

  // ──────────────────────────────────────────────────
  // CAMERA SETUP
  // ──────────────────────────────────────────────────
  useEffect(() => {
    const v = videoRef.current; if (!v) return
    let cancelled = false, restartAttempts = 0
    let restartTimer: ReturnType<typeof setTimeout> | null = null

    const stopStream = (s: MediaStream | null) => s?.getTracks().forEach(t => t.stop())
    const clearTimer = () => { if (restartTimer) { clearTimeout(restartTimer); restartTimer = null } }

    const requestStream = async (): Promise<MediaStream> => {
      const attempts: MediaStreamConstraints[] = [
        { video: { facingMode: { ideal: 'user' }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false },
        { video: { facingMode: 'user' }, audio: false },
        { video: true, audio: false },
      ]
      let last: unknown = null
      for (const c of attempts) { try { return await navigator.mediaDevices.getUserMedia(c) } catch (e) { last = e } }
      throw last || new Error('Cannot start camera')
    }

    const startCamera = async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('getUserMedia not supported')
        const existing = v.srcObject as MediaStream | null
        if (existing) { stopStream(existing); v.srcObject = null }
        if (streamRef.current) { stopStream(streamRef.current); streamRef.current = null }
        setFeedback('Requesting camera...'); setCameraStatus('requesting'); setReady(false); setCameraError(null)

        const stream = await requestStream()
        if (cancelled) { stopStream(stream); return }
        streamRef.current = stream

        const scheduleRestart = (reason: string) => {
          if (cancelled) return
          if (restartAttempts >= 5) {
            const msg = `Camera interrupted. ${reason} Please tap Retry.`
            setCameraStatus('error'); setCameraError(msg); setFeedback(msg); setReady(false); return
          }
          restartAttempts += 1; setReady(false); setCameraStatus('requesting')
          setFeedback(`Camera interrupted (${reason}). Reconnecting...`)
          clearTimer()
          restartTimer = setTimeout(() => { void startCamera() }, 750)
        }

        stream.getTracks().forEach(t => { t.onended = () => scheduleRestart('track ended') });
        (stream as any).oninactive = () => scheduleRestart('stream inactive')
        v.srcObject = stream; v.muted = true; v.playsInline = true; v.autoplay = true
        v.setAttribute('playsinline','true'); v.setAttribute('autoplay','true'); v.setAttribute('muted','true')

        const tryPlay = async () => {
          try {
            await v.play()
            if (!cancelled) { restartAttempts=0; clearTimer(); setReady(true); setCameraStatus('ready'); setCameraError(null); setFeedback('Position yourself in view') }
          } catch (e) {
            if (!cancelled) { setReady(false); setCameraStatus('error'); const msg=buildCameraErrorMessage(e); setCameraError(msg); setFeedback(msg) }
          }
        }
        v.onpause = () => { if (!cancelled) { if (v.ended) scheduleRestart('video ended'); else v.play().catch(() => scheduleRestart('video paused')) } }
        if (v.readyState >= 1) await tryPlay()
        else { v.onloadedmetadata = () => { void tryPlay() }; v.oncanplay = () => { void tryPlay() } }
      } catch (e) {
        if (!cancelled) { setReady(false); setCameraStatus('error'); const msg=buildCameraErrorMessage(e); setCameraError(msg); setFeedback(msg) }
      }
    }

    void startCamera()
    const onVisibility = () => {
      if (cancelled) return
      if (document.visibilityState !== 'visible') return
      const cur = v.srcObject as MediaStream | null
      if (!cur || v.paused || v.readyState < 2) void startCamera()
      else v.play().catch(() => void startCamera())
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      cancelled = true; clearTimer(); setReady(false); setCameraStatus('idle')
      v.onloadedmetadata = null; v.oncanplay = null; v.onpause = null
      document.removeEventListener('visibilitychange', onVisibility)
      const cur = v.srcObject as MediaStream | null
      if (cur) { stopStream(cur); v.srcObject = null }
      stopStream(streamRef.current)
    }
  }, [cameraRetryToken])

  // ──────────────────────────────────────────────────
  // POSE DETECTION LOOP
  // ──────────────────────────────────────────────────
  useEffect(() => {
    if (!ready || !videoRef.current) return
    const pose = new Pose({ locateFile: f => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${f}` })
    pose.setOptions({
      modelComplexity: 1, smoothLandmarks: true, enableSegmentation: false,
      minDetectionConfidence: MIN_VIS, minTrackingConfidence: MIN_VIS,
    })
    pose.onResults((res: Results) => {
      try { drawLandmarks(res); analyzeForm(res) }
      catch { setFeedback('Error processing pose') }
    })
    poseRef.current = pose

    let id = 0
    async function frame() {
      if (!videoRef.current) { cancelAnimationFrame(id); return }
      if (videoRef.current.paused || videoRef.current.ended) {
        try { await videoRef.current.play() } catch { /* ignore */ }
      }
      try { await pose.send({ image: videoRef.current }) } catch { /* ignore */ }
      id = requestAnimationFrame(frame)
    }
    frame()
    return () => { cancelAnimationFrame(id); if (poseRef.current) { poseRef.current.close(); poseRef.current = null } }
  }, [ready])

  const formatTime = (s: number) => `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`
  const isVideoSource = gifSrc.endsWith('.mp4')

  // ──────────────────────────────────────────────────
  // FORM SCORE COLOR
  // ──────────────────────────────────────────────────
  const formColor = formScore >= 80 ? '#10b981' : formScore >= 60 ? '#f59e0b' : '#ef4444'
  const cfg = exerciseConfig

  // ──────────────────────────────────────────────────
  // RENDER
  // ──────────────────────────────────────────────────
  return (
    <div className="trainer-page">
      <style>{`
        .trainer-page {
          min-height: 100vh;
          background: radial-gradient(circle at 10% 10%, rgba(56,189,248,.18), transparent 36%),
                      radial-gradient(circle at 90% 90%, rgba(16,185,129,.2), transparent 34%),
                      linear-gradient(155deg, #020617 0%, #0f172a 52%, #111827 100%);
          display: flex; flex-direction: column; align-items: center;
          color: white; font-family: 'Inter', system-ui, sans-serif; padding: 20px;
        }
        .trainer-header {
          width: 100%; max-width: 1100px;
          display: flex; align-items: center; justify-content: space-between;
          margin-bottom: 16px; padding: 0 4px;
        }
        .exercise-title { font-size: 1.4rem; font-weight: 800; color: #f8fafc; }
        .exercise-subtitle { font-size: 0.85rem; color: #94a3b8; margin-top: 2px; }
        .header-badges { display: flex; gap: 8px; }
        .badge {
          padding: 5px 12px; border-radius: 999px; font-size: 0.72rem;
          font-weight: 700; text-transform: uppercase; letter-spacing: .5px;
        }
        .badge-joint { background: rgba(56,189,248,.15); border: 1px solid rgba(56,189,248,.4); color: #38bdf8; }
        .badge-cam   { background: rgba(16,185,129,.15); border: 1px solid rgba(16,185,129,.4); color: #10b981; }
        .badge-sym   { background: rgba(168,85,247,.15); border: 1px solid rgba(168,85,247,.4); color: #c084fc; }

        .main-workspace {
          display: flex; flex-direction: row; align-items: flex-start;
          gap: 20px; max-width: 1100px; width: 100%; justify-content: center;
        }
        .reference-panel {
          order: 1; width: 300px; min-width: 260px;
          background: #1e293b; border: 1px solid #334155; border-radius: 20px;
          padding: 16px; display: flex; flex-direction: column; gap: 12px;
          box-shadow: 0 10px 30px rgba(0,0,0,.3);
        }
        .webcam-panel {
          order: 2; position: relative; flex: 1; max-width: 720px;
          height: 520px; border-radius: 20px; overflow: hidden;
          box-shadow: 0 24px 64px rgba(2,6,23,.65);
          border: 1px solid rgba(148,163,184,.28); background: #000;
        }
        .webcam-panel canvas { width: 100%; height: 100%; object-fit: cover; display: block; }

        /* dataset config panel */
        .config-panel {
          background: #0b1220; border: 1px solid #1e3a4a; border-radius: 14px;
          padding: 12px 14px;
        }
        .config-title { font-size: .7rem; text-transform: uppercase; color: #38bdf8; font-weight: 700; letter-spacing: .5px; margin-bottom: 8px; }
        .config-row { display: flex; justify-content: space-between; font-size: .78rem; padding: 3px 0; border-bottom: 1px solid #1e2d3a; }
        .config-row:last-child { border-bottom: none; }
        .config-key { color: #64748b; }
        .config-val { color: #e2e8f0; font-weight: 600; font-family: monospace; font-size: .76rem; }

        /* angle range bar */
        .angle-range-bar { margin-top: 6px; }
        .angle-bar-label { font-size: .7rem; color: #64748b; display: flex; justify-content: space-between; }
        .angle-bar-track {
          position: relative; height: 6px; border-radius: 3px;
          background: #1e293b; border: 1px solid #334155; margin: 4px 0; overflow: visible;
        }
        .angle-bar-range {
          position: absolute; top: 0; height: 100%; border-radius: 3px;
          background: linear-gradient(90deg, #10b981, #38bdf8);
        }
        .angle-bar-cursor {
          position: absolute; top: -4px; width: 14px; height: 14px;
          border-radius: 50%; background: #facc15; border: 2px solid #000;
          transform: translateX(-50%); transition: left 0.1s;
          box-shadow: 0 0 8px rgba(250,204,21,.8);
        }

        /* reference media */
        .reference-media, .reference-video {
          width: 100%; border-radius: 10px; background: #0f172a;
          aspect-ratio: 1/1; object-fit: cover;
        }
        .gif-info h4 { margin: 0; font-size: 1rem; color: #f8fafc; font-weight: 700; }
        .gif-info p { margin: 6px 0 0; font-size: .85rem; color: #94a3b8; }
        .plan-list { display: flex; flex-direction: column; gap: 8px; max-height: 180px; overflow-y: auto; }
        .plan-item {
          display: flex; align-items: center; justify-content: space-between;
          background: #0f172a; border: 1px solid #334155; color: #e2e8f0;
          padding: 9px 12px; border-radius: 10px; cursor: pointer; font-weight: 700; font-size: .85rem;
        }
        .plan-item.active { border-color: #10b981; color: #10b981; }
        .plan-item .secondary { font-size: .72rem; color: #94a3b8; }

        /* webcam overlays */
        .rep-counter {
          position: absolute; top: 16px; left: 16px; z-index: 10;
          background: linear-gradient(135deg, #10b981, #059669);
          padding: 10px 18px; border-radius: 14px; text-align: center;
          box-shadow: 0 4px 20px rgba(16,185,129,.4);
        }
        .rep-count { font-size: 2.2rem; font-weight: 900; line-height: 1; display: block; }
        .rep-label { font-size: .65rem; text-transform: uppercase; font-weight: 700; opacity: .9; }

        .rep-target {
          position: absolute; top: 16px; left: 110px; z-index: 10;
          background: rgba(2,6,23,.85); border: 1px solid rgba(16,185,129,.3);
          padding: 8px 14px; border-radius: 12px; text-align: center;
        }
        .rep-target-val { font-size: 1rem; font-weight: 800; color: #94a3b8; }
        .rep-target-label { font-size: .62rem; color: #64748b; }

        /* Stage indicator */
        .stage-badge {
          position: absolute; top: 16px; right: 100px; z-index: 10;
          padding: 5px 12px; border-radius: 8px; font-size: .72rem; font-weight: 800;
          text-transform: uppercase; letter-spacing: .5px;
          transition: all .2s;
        }
        .stage-DOWN { background: rgba(239,68,68,.2); border: 1px solid #ef4444; color: #fca5a5; }
        .stage-UP   { background: rgba(16,185,129,.2); border: 1px solid #10b981; color: #6ee7b7; }
        .stage-NONE { background: rgba(100,116,139,.15); border: 1px solid #475569; color: #94a3b8; }

        .status-badge {
          position: absolute; top: 16px; right: 16px; z-index: 10;
          background: rgba(2,6,23,.88); padding: 6px 12px; border-radius: 8px;
          font-size: .68rem; display: flex; align-items: center; gap: 6px;
        }
        .dot { width: 6px; height: 6px; border-radius: 50%; animation: blink 1.2s infinite; }
        .dot.active   { background: #10b981; }
        .dot.inactive { background: #ef4444; }
        @keyframes blink { 0%,100%{opacity:1}50%{opacity:.3} }

        .pose-indicator {
          position: absolute; top: 56px; right: 16px; z-index: 10;
          background: rgba(2,6,23,.9); border: 1px solid rgba(16,185,129,.3);
          padding: 7px 12px; border-radius: 8px; font-size: .72rem;
          display: flex; align-items: center; gap: 6px;
        }
        .pose-indicator.detected     { border-color: #10b981; color: #10b981; }
        .pose-indicator.not-detected { border-color: #f59e0b; color: #f59e0b; }

        /* Angles panel */
        .angle-panel {
          position: absolute; top: 100px; left: 16px; z-index: 10;
          background: rgba(2,6,23,.82); border: 1px solid rgba(16,185,129,.3);
          padding: 10px 14px; border-radius: 12px; min-width: 100px;
        }
        .angle-panel-title { font-size: .62rem; color: #38bdf8; font-weight: 700; text-transform: uppercase; margin-bottom: 6px; letter-spacing: .5px; }
        .angle-item   { display: flex; justify-content: space-between; gap: 16px; font-size: .78rem; padding: 2px 0; }
        .angle-label  { color: #10b981; font-weight: 700; }
        .angle-value  { font-weight: 700; font-family: monospace; color: #facc15; }

        /* Metrics */
        .metrics-panel {
          position: absolute; top: 16px; left: 50%; transform: translateX(-50%);
          background: rgba(2,6,23,.9); border: 1px solid rgba(16,185,129,.3);
          padding: 10px 20px; border-radius: 12px; display: flex; gap: 28px; z-index: 10;
        }
        .metric-item { display: flex; flex-direction: column; align-items: center; }
        .metric-label { color: #94a3b8; font-size: .65rem; }
        .metric-value { color: #10b981; font-weight: 800; font-size: .95rem; }

        /* Form + pose match */
        .score-stack {
          position: absolute; bottom: 100px; right: 16px; z-index: 10;
          display: flex; flex-direction: column; gap: 8px;
        }
        .score-box {
          background: rgba(2,6,23,.9); border: 1px solid rgba(16,185,129,.3);
          padding: 10px 14px; border-radius: 12px; text-align: center; min-width: 70px;
        }
        .score-value { font-size: 1.4rem; font-weight: 900; }
        .score-label { font-size: .6rem; color: #94a3b8; text-transform: uppercase; }

        /* Fault banner */
        .fault-banner {
          position: absolute; top: 96px; right: 16px; z-index: 11;
          background: rgba(239,68,68,.18); border: 1px solid rgba(239,68,68,.5);
          padding: 8px 14px; border-radius: 10px; font-size: .78rem;
          color: #fca5a5; max-width: 200px; line-height: 1.4;
          animation: fadeInRight .3s ease;
        }
        @keyframes fadeInRight { from{opacity:0;transform:translateX(8px)} to{opacity:1;transform:translateX(0)} }

        /* Feedback pill */
        .feedback-pill {
          position: absolute; bottom: 16px; left: 50%; transform: translateX(-50%);
          background: rgba(2,6,23,.92); padding: 11px 22px; border-radius: 100px;
          font-weight: 600; color: #d1fae5; border: 1px solid rgba(16,185,129,.4);
          backdrop-filter: blur(6px); z-index: 10; max-width: 88%; text-align: center;
          font-size: .9rem;
        }

        /* Voice */
        .voice-enable-btn {
          position: absolute; bottom: 64px; left: 50%; transform: translateX(-50%);
          border: 1px solid rgba(56,189,248,.55); background: rgba(14,116,144,.85);
          color: #f0f9ff; font-weight: 800; padding: 10px 18px; border-radius: 999px;
          cursor: pointer; z-index: 12; box-shadow: 0 6px 18px rgba(14,116,144,.35); font-size: .85rem;
        }
        .voice-enable-btn:hover { background: rgba(2,132,199,.92); }

        /* Camera error */
        .camera-error-overlay {
          position: absolute; inset: 0; background: rgba(2,6,23,.84); z-index: 30;
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          gap: 14px; padding: 24px; text-align: center;
        }
        .camera-error-text { color: #fca5a5; font-weight: 700; max-width: 420px; line-height: 1.4; margin: 0; }
        .camera-retry-btn {
          background: #10b981; color: #052e16; border: none; border-radius: 10px;
          padding: 10px 18px; font-weight: 800; cursor: pointer;
        }
        .camera-retry-btn:hover { background: #34d399; }

        /* Instructions */
        .instructions-panel-bottom {
          position: absolute; bottom: 68px; left: 50%; transform: translateX(-50%);
          background: rgba(2,6,23,.95); border: 2px solid rgba(16,185,129,.45);
          padding: 16px; border-radius: 14px; max-width: 580px; width: 90%; z-index: 15;
          box-shadow: 0 10px 30px rgba(0,0,0,.5);
        }
        .instructions-header {
          color: #10b981; font-weight: 700; font-size: .95rem; margin-bottom: 12px;
          text-align: center; text-transform: uppercase; letter-spacing: 1px;
        }
        .instructions-carousel {
          display: flex; flex-direction: column; gap: 10px;
          max-height: 140px; overflow-y: auto;
        }
        .instructions-scroll-controls { margin-top: 8px; display: flex; justify-content: center; gap: 10px; }
        .scroll-btn {
          border: 1px solid rgba(16,185,129,.4); background: rgba(16,185,129,.12);
          color: #d1fae5; border-radius: 8px; font-weight: 700; font-size: .75rem;
          padding: 5px 10px; cursor: pointer;
        }
        .instruction-slide {
          display: flex; align-items: center; gap: 12px; padding: 10px 12px;
          background: rgba(16,185,129,.08); border-left: 3px solid #10b981;
          border-radius: 8px; transition: all .3s;
        }
        .instruction-slide.active {
          background: rgba(250,204,21,.12); border-left-color: #facc15;
          transform: translateX(3px);
        }
        .instruction-step {
          color: #10b981; font-weight: 700; font-size: .82rem; min-width: 52px;
          background: rgba(16,185,129,.18); padding: 4px 8px; border-radius: 16px; text-align: center;
        }
        .instruction-content { color: #e2e8f0; font-size: .88rem; line-height: 1.4; font-weight: 500; }

        /* Rest overlay */
        .rest-overlay {
          position: absolute; inset: 0; background: rgba(0,0,0,.75);
          display: flex; align-items: center; justify-content: center;
          flex-direction: column; z-index: 100; border-radius: 20px;
        }
        .rest-timer { font-size: 5rem; font-weight: 900; color: #fbbf24; }
        .rest-text  { font-size: 1rem; color: #e2e8f0; margin-top: 8px; }

        /* Controls */
        .controls { margin-top: 24px; display: flex; gap: 12px; align-items: center; }
        .exit-btn {
          background: #ef4444; color: white; border: none;
          padding: 11px 36px; border-radius: 12px; font-weight: 700; cursor: pointer;
        }
        .exit-btn:hover { background: #dc2626; }
        .voice-toggle-btn {
          background: rgba(56,189,248,.15); border: 1px solid rgba(56,189,248,.4);
          color: #38bdf8; padding: 10px 20px; border-radius: 12px; font-weight: 700; cursor: pointer;
          font-size: .85rem;
        }

        /* metadata */
        .reference-angles { margin-top: 8px; }
        .ref-angle { font-size: .72rem; background: rgba(16,185,129,.15); color: #10b981; padding: 2px 7px; border-radius: 4px; margin-right: 4px; font-family: monospace; }
        .muscle-tags { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 4px; }
        .muscle-tag { background: rgba(16,185,129,.18); color: #10b981; padding: 2px 7px; border-radius: 4px; font-size: .7rem; font-weight: 600; }

        @media (max-width: 1000px) {
          .main-workspace { flex-direction: column; align-items: center; }
          .reference-panel { order: 2; width: 100%; max-width: 640px; }
          .webcam-panel { order: 1; width: 100%; max-width: 640px; height: 420px; }
          .voice-enable-btn { bottom: 80px; width: calc(100% - 40px); }
          .trainer-header { flex-direction: column; align-items: flex-start; gap: 8px; }
        }
      `}</style>

      {/* ── Header ── */}
      <div className="trainer-header">
        <div>
          <div className="exercise-title">{exerciseName}</div>
          <div className="exercise-subtitle">
            {cfg ? `${cfg.pj.charAt(0).toUpperCase()+cfg.pj.slice(1)} Joint · ${cfg.mn}°–${cfg.mx}° · ${cfg.cv} view` : 'Loading config...'}
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
        {/* ── Left: Reference panel ── */}
        <div className="reference-panel">
          {gifSrc && (
            isVideoSource
              ? <video className="reference-video" src={gifSrc} autoPlay loop muted playsInline onError={e => { (e.target as HTMLVideoElement).style.display='none' }} />
              : <img className="reference-media" src={gifSrc} alt={exerciseName} onError={e => { (e.target as HTMLImageElement).style.display='none' }} />
          )}

          <div className="gif-info">
            <h4>{exerciseName}</h4>
            <p>Target: <strong>{targetReps || 'N/A'}</strong></p>
            {Object.keys(referenceAngles).length > 0 && (
              <div className="reference-angles">
                {Object.entries(referenceAngles).map(([k,v]) => (
                  <span key={k} className="ref-angle">{k.toUpperCase()}: {v}°</span>
                ))}
              </div>
            )}
          </div>

          {/* Dataset config panel */}
          {cfg && (
            <div className="config-panel">
              <div className="config-title">📊 Pose Config (Dataset)</div>
              <div className="config-row">
                <span className="config-key">Joint</span>
                <span className="config-val">{cfg.pj}</span>
              </div>
              <div className="config-row">
                <span className="config-key">Range</span>
                <span className="config-val">{cfg.mn}°–{cfg.mx}°</span>
              </div>
              {cfg.sj && (
                <div className="config-row">
                  <span className="config-key">Secondary</span>
                  <span className="config-val">{cfg.sj} {cfg.sm}°–{cfg.sx}°</span>
                </div>
              )}
              <div className="config-row">
                <span className="config-key">Camera</span>
                <span className="config-val">{cfg.cv} view</span>
              </div>
              <div className="config-row">
                <span className="config-key">Mode</span>
                <span className="config-val">{cfg.ii ? `Hold ${cfg.hs}s` : cfg.rd.replace('_',' ')}</span>
              </div>
              {/* Live angle range bar */}
              {Object.keys(liveAngles).length > 0 && (() => {
                const primaryKey = Object.keys(liveAngles).find(k => k.endsWith('_L') || k === cfg.pj) ?? ''
                const liveVal = liveAngles[primaryKey] ?? 0
                const pct = Math.max(0, Math.min(100, ((liveVal - cfg.mn) / (cfg.mx - cfg.mn)) * 100))
                const rangePct = ((cfg.mx - cfg.mn) / 180) * 100
                const startPct = (cfg.mn / 180) * 100
                return (
                  <div className="angle-range-bar">
                    <div className="angle-bar-label"><span>{cfg.mn}°</span><span>{cfg.mx}°</span></div>
                    <div className="angle-bar-track">
                      <div className="angle-bar-range" style={{ left:`${startPct}%`, width:`${rangePct}%` }} />
                      <div className="angle-bar-cursor" style={{ left:`${(liveVal/180)*100}%` }} />
                    </div>
                    <div style={{fontSize:'.7rem',color:'#64748b',textAlign:'center',marginTop:2}}>
                      Current: <span style={{color:'#facc15',fontWeight:700}}>{Math.round(liveVal)}°</span>
                    </div>
                  </div>
                )
              })()}
              {/* Alignment rule */}
              {cfg.ar && (
                <div style={{marginTop:8,padding:'8px 10px',background:'rgba(16,185,129,.08)',border:'1px solid rgba(16,185,129,.2)',borderRadius:8,fontSize:'.75rem',color:'#94a3b8',lineHeight:1.4}}>
                  <span style={{color:'#10b981',fontWeight:700}}>✓ Form: </span>{cfg.ar.split(';')[0]}
                </div>
              )}
            </div>
          )}

          {exerciseMetadata && (
            <div style={{display:'flex',flexDirection:'column',gap:8}}>
              {exerciseMetadata.muscle_groups?.length > 0 && (
                <div className="muscle-tags">
                  {exerciseMetadata.muscle_groups.map((m:string, i:number) => (
                    <span key={i} className="muscle-tag">{m}</span>
                  ))}
                </div>
              )}
            </div>
          )}

          {instructions.length > 0 && (
            <div style={{display:'flex',flexDirection:'column',gap:6}}>
              {instructions.slice(0,5).map((ins,i) => (
                <div key={i} style={{background:'#0b1220',border:'1px solid #334155',color:'#e2e8f0',padding:'7px 10px',borderRadius:8,fontSize:'.78rem',lineHeight:1.4}}>
                  {ins}
                </div>
              ))}
            </div>
          )}

          <div className="plan-list">
            {plan.map((x,i) => (
              <div key={`${x.name}-${i}`} className={`plan-item ${i===idx?'active':''}`} onClick={() => goToIndex(i, plan)}>
                <span>{x.name}</span>
                <span className="secondary">{x.repetitions || 'N/A'}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Right: Webcam panel ── */}
        <div className="webcam-panel">
          <video ref={videoRef} width={640} height={480} style={{ display:'none' }} />
          <canvas ref={canvasRef} style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }} />

          {/* Rep counter */}
          <div className="rep-counter">
            <span className="rep-count">{cfg?.ii ? holdElapsedSec : reps}</span>
            <span className="rep-label">{cfg?.ii ? 'Sec Hold' : 'Reps'}</span>
          </div>

          {/* Target */}
          {(targetTotal || targetDurationSec) && (
            <div className="rep-target">
              <div className="rep-target-val">/ {targetDurationSec ?? targetTotal}</div>
              <div className="rep-target-label">{cfg?.ii ? 'sec' : 'target'}</div>
            </div>
          )}

          {/* Stage badge */}
          <div className={`stage-badge stage-${stage}`}>
            {stage === 'DOWN' ? '⬇ DOWN' : stage === 'UP' ? '⬆ UP' : '— READY'}
          </div>

          {/* Status */}
          <div className="status-badge">
            <div className={`dot ${ready ? 'active' : 'inactive'}`} />
            {cameraStatus === 'requesting' ? 'CAMERA' : ready ? 'LIVE' : 'INIT'}
          </div>

          {/* Pose detected */}
          <div className={`pose-indicator ${poseDetected ? 'detected' : 'not-detected'}`}>
            {poseDetected ? '✓ Pose' : '○ No Pose'}
          </div>

          {/* Form fault banner */}
          {currentFault && poseDetected && (
            <div className="fault-banner">⚠️ {currentFault}</div>
          )}

          {/* Live angles panel */}
          {Object.keys(liveAngles).length > 0 && (
            <div className="angle-panel">
              <div className="angle-panel-title">Live Angles</div>
              {Object.entries(liveAngles).map(([k,v]) => (
                <div key={k} className="angle-item">
                  <span className="angle-label">{k.toUpperCase()}</span>
                  <span className="angle-value">{v}°</span>
                </div>
              ))}
            </div>
          )}

          {/* Metrics bar */}
          <div className="metrics-panel">
            <div className="metric-item">
              <span className="metric-label">Time</span>
              <span className="metric-value">{formatTime(sessionTime)}</span>
            </div>
            <div className="metric-item">
              <span className="metric-label">Cal</span>
              <span className="metric-value">{caloriesBurned}</span>
            </div>
            <div className="metric-item">
              <span className="metric-label">Target</span>
              <span className="metric-value">{cfg?.ii ? `${targetDurationSec}s` : (targetReps || '—')}</span>
            </div>
          </div>

          {/* Form + pose match scores */}
          <div className="score-stack">
            <div className="score-box">
              <div className="score-value" style={{ color: formColor }}>{formScore}%</div>
              <div className="score-label">Form</div>
            </div>
            <div className="score-box">
              <div className="score-value" style={{ color: poseMatchScore > 70 ? '#10b981' : '#f59e0b' }}>{poseMatchScore}%</div>
              <div className="score-label">Match</div>
            </div>
          </div>

          {/* Voice button */}
          {!voiceEnabled && (
            <button type="button" className="voice-enable-btn"
              onClick={() => { setVoiceEnabled(true); setFeedback('Voice coaching enabled') }}>
              🔊 Enable Voice Coaching
            </button>
          )}

          {/* Feedback pill */}
          <div className="feedback-pill">{feedback}</div>

          {/* Camera error */}
          {!ready && cameraError && (
            <div className="camera-error-overlay">
              <p className="camera-error-text">{cameraError}</p>
              <button type="button" className="camera-retry-btn" onClick={() => setCameraRetryToken(t => t+1)}>
                Retry Camera
              </button>
            </div>
          )}

          {/* Instructions carousel */}
          {instructions.length > 0 && (
            <div className="instructions-panel-bottom">
              <div className="instructions-header">Exercise Instructions</div>
              <div className="instructions-carousel" ref={instructionsContainerRef}>
                {instructions.map((ins, index) => (
                  <div key={index} className={`instruction-slide ${instructionIndex===index ? 'active' : ''}`}>
                    <span className="instruction-step">Step {index+1}</span>
                    <span className="instruction-content">{ins}</span>
                  </div>
                ))}
              </div>
              <div className="instructions-scroll-controls">
                <button className="scroll-btn" type="button" onClick={() => scrollInstructions('up')}>▲</button>
                <button className="scroll-btn" type="button" onClick={() => scrollInstructions('down')}>▼</button>
              </div>
            </div>
          )}

          {/* Rest overlay */}
          {isResting && (
            <div className="rest-overlay">
              <div className="rest-timer">{restTimer}</div>
              <div className="rest-text">Rest Time — Get Ready</div>
            </div>
          )}
        </div>
      </div>

      {/* ── Controls ── */}
      <div className="controls">
        <button className="exit-btn" onClick={() => window.history.back()}>Finish Session</button>
        {voiceEnabled && (
          <button className="voice-toggle-btn" onClick={() => { setVoiceEnabled(false); window.speechSynthesis?.cancel() }}>
            🔇 Mute Voice
          </button>
        )}
      </div>
    </div>
  )
}

export default Trainer