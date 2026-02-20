import { useRef, useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Pose, POSE_CONNECTIONS, Results } from '@mediapipe/pose'
import '@tensorflow/tfjs'
import axios from 'axios'

function Trainer() {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [ready, setReady] = useState(false)
  const [reps, setReps] = useState(0)
  const [stage, setStage] = useState<'up' | 'down' | 'none'>('none')
  const [feedback, setFeedback] = useState('Position yourself in view')
  const [sessionTime, setSessionTime] = useState(0)
  const [caloriesBurned, setCaloriesBurned] = useState(0)
  const [formScore, setFormScore] = useState(100)
  const [poseMatchScore, setPoseMatchScore] = useState(100)
  const [isResting, setIsResting] = useState(false)
  const [restTimer, setRestTimer] = useState(0)
  
  const location = useLocation()
  const params = new URLSearchParams(location.search)
  const exerciseName = (params.get('name') || 'Bodyweight Squats').toString()
  const targetReps = (params.get('reps') || '').toString()
  const fallbackGif = (params.get('gif') || '').toString()
  const idx = parseInt((params.get('idx') || '0').toString(), 10)
  const [gifSrc, setGifSrc] = useState<string>('')
  const [targetTotal, setTargetTotal] = useState<number | null>(null)
  const [plan, setPlan] = useState<Array<{name:string; repetitions:string; gif_url:string}>>([])
  const [angles, setAngles] = useState<Record<string, number>>({})
  const [referenceAngles, setReferenceAngles] = useState<Record<string, number>>({})
  const gifPoseRef = useRef<Pose | null>(null)
  const [instructions, setInstructions] = useState<string[]>([])
  const [poseHints, setPoseHints] = useState<any>(null)
  const [exerciseMetadata, setExerciseMetadata] = useState<any>(null)
  
  const localGifAliases: Record<string, string> = {
      '3/4 sit-up': '34-sit-up',
      'bench dip (knees bent)': 'bench-dip-knees-bent',
      'left hook. boxing': 'left-hook-boxing',
      'archer push up': 'archer-push-ups',
      'archer pull up': 'archer-pull-up',
      'astride jumps (male)': 'astride-jumps-male',
      'all fours squad stretch': 'all-fours-squad-stretch',
      'ankle circles': 'ankle-circles',
      'bear crawl': 'bear-crawl.',
      'back and forth step': 'back-and-forth-step.'
  }

  // ENHANCED: Session timer
  useEffect(() => {
    const interval = setInterval(() => setSessionTime(t => t + 1), 1000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    async function loadExerciseData() {
      try {
        const base = import.meta.env.VITE_API_BASE || ''
        console.log('Loading exercise data for:', exerciseName)
        console.log('API base URL:', base)
        
        // Load instructions and metadata
        const res = await axios.get(`${base}/exercises/instructions`, { params: { name: exerciseName } })
        console.log('Instructions API response:', res.data)
        
        const list = Array.isArray(res.data?.instructions) ? res.data.instructions : []
        console.log('Setting instructions:', list)
        setInstructions(list)
        setExerciseMetadata(res.data)
        
        // Load pose hints
        try {
          const hintsRes = await axios.get(`${base}/exercises/pose-hints/${encodeURIComponent(exerciseName)}`)
          console.log('Pose hints API response:', hintsRes.data)
          setPoseHints(hintsRes.data.pose_hints)
        } catch (error) {
          console.error('Error loading pose hints:', error)
          setPoseHints(null)
        }
      } catch (error: any) {
        console.error('Error loading exercise data:', error)
        console.error('Error response:', error.response?.data || error.message)
        setInstructions(['Failed to load instructions. Please try again.'])
        setExerciseMetadata(null)
        setPoseHints(null)
      }
    }
    loadExerciseData()
  }, [exerciseName])

  // ENHANCED: Rest timer between sets
  useEffect(() => {
    if (!isResting) return
    if (restTimer <= 0) {
      setIsResting(false)
      speak('Rest complete, let\'s go!')
      return
    }
    const interval = setInterval(() => setRestTimer(t => t - 1), 1000)
    return () => clearInterval(interval)
  }, [isResting, restTimer])

  // ENHANCED: Calculate calories burned
  useEffect(() => {
    const exerciseCalories: Record<string, number> = {
      'squat': 0.32,
      'push': 0.29,
      'plank': 0.15,
      'jump': 0.4,
      'burpee': 0.5,
      'lunge': 0.25
    }
    let calsPerRep = 0
    for (const [key, val] of Object.entries(exerciseCalories)) {
      if (exerciseName.toLowerCase().includes(key)) {
        calsPerRep = val
        break
      }
    }
    setCaloriesBurned(Math.round(reps * calsPerRep * 10) / 10)
  }, [reps])

  // Enhanced Voice Feedback with intelligent queuing and error handling
  const voiceQueue = useRef<string[]>([])
  const isSpeaking = useRef(false)
  
  function speak(text: string) {
    console.log('=== SPEAK FUNCTION CALLED ===')
    console.log('Text to speak:', text)
    
    if (!text || !text.trim()) {
      console.log('Empty speech text, skipping')
      return
    }
    
    // Check if speech synthesis is available
    if (!window.speechSynthesis) {
      console.error('Speech synthesis not supported in this browser')
      setFeedback('⚠️ Voice feedback not supported in this browser')
      return
    }
    
    console.log('Speech synthesis available, checking if speaking...')
    
    // Add to queue if currently speaking
    if (isSpeaking.current) {
      console.log('Currently speaking, adding to queue')
      voiceQueue.current.push(text)
      return
    }
    
    console.log('Starting speech synthesis...')
    isSpeaking.current = true
    const synth = window.speechSynthesis
    
    // Get available voices
    const voices = synth.getVoices()
    console.log('Available voices:', voices.length)
    
    const utter = new SpeechSynthesisUtterance(text)
    utter.rate = 0.9
    utter.pitch = 1
    utter.volume = 0.8
    
    // Try to use a female voice if available
    if (voices.length > 0) {
      const femaleVoice = voices.find(voice => voice.name.includes('Female') || voice.name.includes('Samantha') || voice.name.includes('Karen'))
      if (femaleVoice) {
        utter.voice = femaleVoice
        console.log('Using voice:', femaleVoice.name)
      }
    }
    
    utter.onstart = () => {
      console.log('Speech started')
    }
    
    utter.onend = () => {
      console.log('Speech ended')
      isSpeaking.current = false
      // Process next in queue
      if (voiceQueue.current.length > 0) {
        const next = voiceQueue.current.shift()
        if (next) {
          console.log('Processing next in queue:', next)
          setTimeout(() => speak(next), 500)
        }
      }
    }
    
    utter.onerror = (event) => {
      console.error('Speech error:', event)
      console.error('Error details:', event.error)
      isSpeaking.current = false
      setFeedback('⚠️ Voice feedback error occurred')
    }
    
    // Cancel any ongoing speech and speak new text
    synth.cancel()
    synth.speak(utter)
    console.log('Speech command sent')
  }
  
  // Initialize voices
  useEffect(() => {
    console.log('Initializing speech synthesis voices...')
    if (window.speechSynthesis) {
      const loadVoices = () => {
        const voices = window.speechSynthesis.getVoices()
        console.log('Voices loaded:', voices.length)
        voices.forEach((voice, index) => {
          console.log(`Voice ${index}: ${voice.name} (${voice.lang})`)
        })
      }
      
      // Load voices immediately
      loadVoices()
      
      // Also load when voices are ready (some browsers need this)
      window.speechSynthesis.onvoiceschanged = loadVoices
    } else {
      console.error('Speech synthesis not available')
    }
  }, [])

  function goToIndex(i: number, p: Array<{name:string; repetitions:string; gif_url:string}>) {
    const next = p[i]
    if (!next) return
    setReps(0)
    setStage('none')
    window.location.href = `/trainer?name=${encodeURIComponent(next.name)}&reps=${encodeURIComponent(next.repetitions || '')}&gif=${encodeURIComponent(next.gif_url || '')}&idx=${i}`
  }

  function parseTarget(text: string): number | null {
    const t = (text || '').toLowerCase().trim()
    const m = t.match(/^(\d+)\s*x\s*(\d+)$/)
    if (m) {
      const sets = parseInt(m[1], 10)
      const reps = parseInt(m[2], 10)
      if (!isNaN(sets) && !isNaN(reps)) return sets * reps
    }
    const n = parseInt(t, 10)
    if (!isNaN(n)) return n
    return null
  }

  function advanceNext() {
    if (!plan.length) return
    const nextIdx = idx + 1
    if (nextIdx >= plan.length) {
      speak('Workout complete. Great job!')
      setFeedback('✅ Workout complete!')
      setTimeout(() => window.history.back(), 3000)
      return
    }
    const next = plan[nextIdx]
    setReps(0)
    setStage('none')
    setIsResting(true)
    setRestTimer(30)
    speak(`Rest for 30 seconds. Next: ${next.name}`)
    setTimeout(() => {
      window.location.href = `/trainer?name=${encodeURIComponent(next.name)}&reps=${encodeURIComponent(next.repetitions || '')}&gif=${encodeURIComponent(next.gif_url || '')}&idx=${nextIdx}`
    }, 31000)
  }

  useEffect(() => {
    setTargetTotal(parseTarget(targetReps))
    try {
      const raw = sessionStorage.getItem('workoutPlan') || '[]'
      const arr = JSON.parse(raw)
      const p = Array.isArray(arr) ? arr : []
      setPlan(p)
      if (!params.get('name') && p.length > 0) {
        const first = p[0]
        window.location.replace(`/trainer?name=${encodeURIComponent(first.name)}&reps=${encodeURIComponent(first.repetitions || '')}&gif=${encodeURIComponent(first.gif_url || '')}&idx=0`)
      }
    } catch {
      setPlan([])
    }
  }, [])

  useEffect(() => {
    if (targetTotal !== null && reps >= targetTotal) {
      speak('Exercise complete')
      advanceNext()
    }
  }, [reps, targetTotal])

  function drawLandmarks(results: Results) {
    const canvas = canvasRef.current
    const video = videoRef.current
    if (!canvas || !video) return
    const ctx = canvas.getContext('2d')!
    
    if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
    }

    ctx.save()
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.scale(-1, 1);
    ctx.drawImage(video, -canvas.width, 0, canvas.width, canvas.height);
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    const landmarks = results.poseLandmarks
    if (!landmarks) {
      ctx.restore()
      return
    }

    ctx.lineWidth = 3
    ctx.strokeStyle = '#10b981'
    ctx.lineCap = 'round'

    for (const [a, b] of (POSE_CONNECTIONS as any)) {
      const p1 = landmarks[a]
      const p2 = landmarks[b]
      if ((p1?.visibility ?? 0) > 0.5 && (p2?.visibility ?? 0) > 0.5) {
        ctx.beginPath()
        ctx.moveTo((1 - p1.x) * canvas.width, p1.y * canvas.height)
        ctx.lineTo((1 - p2.x) * canvas.width, p2.y * canvas.height)
        ctx.stroke()
      }
    }

    landmarks.forEach((lm) => {
      if ((lm?.visibility ?? 0) > 0.5) {
        ctx.beginPath()
        ctx.arc((1 - lm.x) * canvas.width, lm.y * canvas.height, 4, 0, 2 * Math.PI)
        ctx.fillStyle = '#ffffff'
        ctx.fill()
      }
    })
    ctx.restore()
  }

  function slugify(text: string) {
    return (text || '').toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-')
  }

  useEffect(() => {
    const nameLower = exerciseName.toLowerCase()
    const alias = localGifAliases[nameLower]
    const aliasUrl = alias ? `/gifs/${alias}.gif` : null
    const slugUrl = `/gifs/${slugify(exerciseName)}.gif`
    const tryLoad = (url: string, onFail: () => void) => {
      const img = new Image()
      img.onload = () => setGifSrc(url)
      img.onerror = onFail
      img.src = url
    }
    const trySlug = () => {
      tryLoad(slugUrl, () => {
        setGifSrc('')
        setFeedback('GIF not found - using live guidance')
      })
    }
    const tryAliasThenSlug = () => {
      if (aliasUrl) {
        tryLoad(aliasUrl, () => {
          trySlug()
        })
      } else {
        trySlug()
      }
    }
    if (fallbackGif) {
      tryLoad(fallbackGif, () => {
        tryAliasThenSlug()
      })
    } else {
      tryAliasThenSlug()
    }
  }, [exerciseName, fallbackGif])

  function angle(a: any, b: any, c: any) {
    const ab = { x: a.x - b.x, y: a.y - b.y }
    const cb = { x: c.x - b.x, y: c.y - b.y }
    const dot = ab.x * cb.x + ab.y * cb.y
    const mag1 = Math.sqrt(ab.x ** 2 + ab.y ** 2)
    const mag2 = Math.sqrt(cb.x ** 2 + cb.y ** 2)
    const cos = dot / (mag1 * mag2)
    const ang = Math.acos(Math.min(1, Math.max(-1, cos)))
    return (ang * 180) / Math.PI
  }

  // Process GIF for reference angles
  useEffect(() => {
    if (!gifSrc) {
      console.log('No GIF source provided')
      return
    }
    
    console.log('Processing GIF for reference angles:', gifSrc)
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = async () => {
      console.log('GIF loaded, processing for pose detection')
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')!
      canvas.width = img.width
      canvas.height = img.height
      ctx.drawImage(img, 0, 0)

      if (!gifPoseRef.current) {
        console.log('Creating new pose detector for GIF')
        gifPoseRef.current = new Pose({
          locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`,
        })
        gifPoseRef.current.setOptions({ 
          modelComplexity: 1, 
          smoothLandmarks: true, 
          enableSegmentation: false,
          minDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5
        })
      }

      gifPoseRef.current.onResults((results: Results) => {
        const lm = results.poseLandmarks
        if (!lm) {
          console.log('No pose detected in GIF')
          return
        }
        
        console.log('GIF pose detected, extracting reference angles')
        const name = exerciseName.toLowerCase()
        const L = { hip: lm[23], knee: lm[25], ankle: lm[27], shoulder: lm[11], elbow: lm[13], wrist: lm[15], ear: lm[7] }
        const R = { hip: lm[24], knee: lm[26], ankle: lm[28], shoulder: lm[12], elbow: lm[14], wrist: lm[16], ear: lm[8] }

        const refs: Record<string, number> = {}

        if (name.includes('squat')) {
          refs.knee = Math.round(angle(L.hip, L.knee, L.ankle))
          refs.back = Math.round(angle(L.ear, L.shoulder, L.hip))
          console.log('Squat reference angles:', refs)
        } else if (name.includes('push') || name.includes('press-up')) {
          refs.elbow = Math.round(angle(L.shoulder, L.elbow, L.wrist))
          refs.hip = Math.round(angle(L.shoulder, L.hip, L.ankle))
          console.log('Push-up reference angles:', refs)
        } else if (name.includes('astride') || name.includes('jump')) {
          refs.spread = Math.round(Math.abs(L.ankle.x - R.ankle.x) * 100)
          refs.kneeL = Math.round(angle(L.hip, L.knee, L.ankle))
          refs.kneeR = Math.round(angle(R.hip, R.knee, R.ankle))
          console.log('Jump reference angles:', refs)
        } else {
          refs.shoulders = Math.round(Math.abs(L.shoulder.y - R.shoulder.y) * 100)
          console.log('General reference angles:', refs)
        }

        console.log('Setting reference angles:', refs)
        setReferenceAngles(refs)
      })

      try {
        await gifPoseRef.current.send({ image: canvas })
      } catch (error) {
        console.error('Error processing GIF for pose detection:', error)
      }
    }
    
    img.onerror = () => {
      console.error('Failed to load GIF:', gifSrc)
    }
    
    img.src = gifSrc
  }, [gifSrc, exerciseName])

  // Enhanced pose matching with real-time feedback
  function analyzeForm(results: Results) {
    console.log('=== ANALYZE FORM CALLED ===')
    const lm = results.poseLandmarks
    if (!lm) {
      console.log('No pose landmarks detected')
      setFeedback('⚠️ No pose detected - position yourself in view')
      return
    }
    
    console.log('Pose landmarks detected! Count:', lm.length)
    console.log('Analyzing pose for:', exerciseName)
    const name = exerciseName.toLowerCase()
    const L = { hip: lm[23], knee: lm[25], ankle: lm[27], shoulder: lm[11], elbow: lm[13], wrist: lm[15], ear: lm[7] }
    const R = { hip: lm[24], knee: lm[26], ankle: lm[28], shoulder: lm[12], elbow: lm[14], wrist: lm[16], ear: lm[8] }
    const isCardio = name.includes('jump') || name.includes('run') || name.includes('jog') || name.includes('sprint') || name.includes('step')

    let score = 100
    let feedbackMessage = ''
    let voiceMessage = ''
    
    // Always calculate basic angles for pose matching
    const kneeAngle = angle(L.hip, L.knee, L.ankle)
    const elbowAngle = angle(L.shoulder, L.elbow, L.wrist)
    const backAngle = angle(L.ear, L.shoulder, L.hip)
    const hipAngle = angle(L.shoulder, L.hip, L.ankle)
    
    console.log('Calculated angles:', { kneeAngle, elbowAngle, backAngle, hipAngle })
    console.log('Reference angles:', referenceAngles)
    console.log('Exercise instructions available:', instructions.length)

    // Enhanced squat analysis with better pose matching
    if (name.includes('squat')) {
      const refKnee = referenceAngles.knee || 90
      const refBack = referenceAngles.back || 150
      
      console.log('Squat analysis - refKnee:', refKnee, 'refBack:', refBack)
      
      // Check depth
      if (kneeAngle < refKnee + 15) {
        if (stage !== 'down') { 
          setStage('down')
          feedbackMessage = '✅ Great depth!'
          // Use exercise instruction if available
          voiceMessage = instructions[0] || 'Good depth'
        }
        score -= Math.abs(kneeAngle - refKnee) * 0.3
      } else if (kneeAngle > refKnee + 70) {
        if (stage === 'down') { 
          setStage('up')
          setReps(r => r + 1)
          feedbackMessage = '💪 Good rep!'
          // Use exercise instruction if available
          voiceMessage = instructions[1] || 'Nice rep'
        } else if (stage !== 'up') {
          setStage('up')
        }
      }
      
      // Enhanced form checks with pose hints
      if (backAngle < refBack - 15) {
        feedbackMessage = '⚠️ Keep your back straight'
        // Use pose hints first, then exercise instructions
        const voiceCues = poseHints?.voice_cues || []
        voiceMessage = voiceCues.find((cue: string) => 
          cue.toLowerCase().includes('back') || cue.toLowerCase().includes('chest')
        ) || instructions[2] || 'Keep your back straight'
        score -= 15
      }
      
      setAngles({ knee: Math.round(kneeAngle), back: Math.round(backAngle) })
    }
    // Enhanced push-up analysis
    else if (name.includes('push') || name.includes('press-up')) {
      const refElbow = referenceAngles.elbow || 60
      const refHip = referenceAngles.hip || 150
      
      console.log('Push-up analysis - refElbow:', refElbow, 'refHip:', refHip)
      
      if (elbowAngle < refElbow + 15) {
        if (stage !== 'down') { 
          setStage('down')
          feedbackMessage = '✅ Good depth!'
          // Use exercise instruction if available
          voiceMessage = instructions[0] || 'Lower down controlled'
        }
        score -= Math.abs(elbowAngle - refElbow) * 0.3
      } else if (elbowAngle > refElbow + 90) {
        if (stage === 'down') { 
          setStage('up')
          setReps(r => r + 1)
          feedbackMessage = '💪 Strong lockout!'
          // Use exercise instruction if available
          voiceMessage = instructions[1] || 'Nice rep'
        } else if (stage !== 'up') {
          setStage('up')
        }
      }
      
      // Body alignment check
      if (hipAngle < refHip - 15) {
        feedbackMessage = '⚠️ Keep your body straight'
        // Use exercise instruction if available
        voiceMessage = instructions[2] || 'Maintain plank position'
        score -= 15
      }
      
      setAngles({ elbow: Math.round(elbowAngle), hip: Math.round(hipAngle) })
    }
    // General exercise analysis
    else {
      const shouldersLevel = Math.abs(L.shoulder.y - R.shoulder.y)
      setAngles({ shoulders: Math.round(shouldersLevel * 100) })
      
      // Always use exercise instructions from dataset
      if (instructions.length > 0) {
        // Use the first instruction as general feedback
        feedbackMessage = instructions[0]
        voiceMessage = instructions[0] // Use same instruction for voice
      } else {
        // Fallback only if no instructions available
        feedbackMessage = '✓ Good form'
        voiceMessage = 'Continue with good form'
      }
    }
    
    // Update feedback and voice
    if (feedbackMessage) {
      setFeedback(feedbackMessage)
    }
    
    // Always speak voice messages (remove random restriction)
    if (voiceMessage) {
      console.log('Speaking voice message:', voiceMessage)
      speak(voiceMessage)
    }
    
    // Calculate pose matching score - ALWAYS calculate this
    let poseMatch = 100
    
    // Always calculate pose match based on exercise type
    if (name.includes('squat')) {
      if (referenceAngles.knee) {
        const kneeDiff = Math.abs(kneeAngle - referenceAngles.knee)
        poseMatch = Math.max(0, 100 - kneeDiff * 2)
        console.log('Squat pose match - kneeDiff:', kneeDiff, 'poseMatch:', poseMatch)
      } else {
        // Fallback: use ideal squat angle of 90 degrees
        const idealKnee = 90
        const kneeDiff = Math.abs(kneeAngle - idealKnee)
        poseMatch = Math.max(0, 100 - kneeDiff * 2)
        console.log('Squat pose match (fallback) - kneeDiff:', kneeDiff, 'poseMatch:', poseMatch)
      }
    } else if (name.includes('push') || name.includes('press-up')) {
      if (referenceAngles.elbow) {
        const elbowDiff = Math.abs(elbowAngle - referenceAngles.elbow)
        poseMatch = Math.max(0, 100 - elbowDiff * 2)
        console.log('Push-up pose match - elbowDiff:', elbowDiff, 'poseMatch:', poseMatch)
      } else {
        // Fallback: use ideal push-up angle of 60 degrees
        const idealElbow = 60
        const elbowDiff = Math.abs(elbowAngle - idealElbow)
        poseMatch = Math.max(0, 100 - elbowDiff * 2)
        console.log('Push-up pose match (fallback) - elbowDiff:', elbowDiff, 'poseMatch:', poseMatch)
      }
    } else if (name.includes('jump') || name.includes('astride')) {
      // For jumps, use knee angles
      const idealJumpKnee = 170
      const kneeDiff = Math.abs(kneeAngle - idealJumpKnee)
      poseMatch = Math.max(0, 100 - kneeDiff * 1.5)
      console.log('Jump pose match - kneeDiff:', kneeDiff, 'poseMatch:', poseMatch)
    } else {
      // For any other exercise, use general form metrics
      // Use back angle and shoulder level for general form
      const idealBack = 160
      const backDiff = Math.abs(backAngle - idealBack)
      poseMatch = Math.max(0, 100 - backDiff * 1.5)
      console.log('General pose match - backDiff:', backDiff, 'poseMatch:', poseMatch)
    }
    
    console.log('Final scores - form:', score, 'poseMatch:', poseMatch)
    setPoseMatchScore(Math.round(poseMatch))
    setFormScore(Math.max(0, Math.round(score)))
    
    // Remove generic voice feedback - only use exercise-specific instructions
    // The voice feedback is already handled in the exercise-specific sections above
  }

  useEffect(() => {
    const v = videoRef.current
    if (!v) {
      console.log('Video ref not found')
      return
    }
    
    console.log('Requesting camera access...')
    
    navigator.mediaDevices.getUserMedia({ 
      video: { 
        width: 640, 
        height: 480,
        facingMode: 'user'
      } 
    })
    .then(stream => {
      console.log('Camera access granted')
      v.srcObject = stream
      v.play().then(() => {
        console.log('Video playing, setting ready to true')
        setReady(true)
      }).catch(error => {
        console.error('Error playing video:', error)
      })
    })
    .catch(error => {
      console.error('Camera access denied:', error)
      setFeedback('⚠️ Camera access required for pose detection')
    })
  }, [])

  useEffect(() => {
    if (!ready || !videoRef.current) return
    
    console.log('Initializing pose detection...')
    
    const pose = new Pose({
      locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`,
    })
    
    pose.setOptions({ 
      modelComplexity: 1, 
      smoothLandmarks: true, 
      enableSegmentation: false,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5
    })
    
    pose.onResults((res: Results) => {
      try {
        console.log('Pose results received:', res.poseLandmarks ? 'Landmarks detected' : 'No landmarks')
        drawLandmarks(res)
        analyzeForm(res)
      } catch (error) {
        console.error('Error processing pose results:', error)
        setFeedback('⚠️ Error processing pose')
      }
    })

    let id = 0
    async function frame() {
      if (!videoRef.current) {
        console.log('Video ref not available, stopping pose detection')
        cancelAnimationFrame(id)
        return
      }
      
      // Check if video is still playing
      if (videoRef.current.paused || videoRef.current.ended) {
        console.log('Video is paused or ended, attempting to restart')
        try {
          await videoRef.current.play()
        } catch (error) {
          console.error('Error restarting video:', error)
        }
      }
      
      try {
        await pose.send({ image: videoRef.current })
      } catch (error) {
        console.error('Pose detection error:', error)
        // Don't stop the loop, just continue
      }
      
      id = requestAnimationFrame(frame)
    }
    
    console.log('Starting pose detection frame loop')
    frame()
    
    return () => {
      console.log('Cleaning up pose detection')
      cancelAnimationFrame(id)
    }
  }, [ready])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div className="trainer-page">
      <style>{`
        .trainer-page {
          min-height: 100vh;
          background: #0f172a;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          color: white;
          font-family: 'Inter', system-ui, sans-serif;
          padding: 20px;
        }

        .main-workspace {
          display: flex;
          flex-direction: row;
          align-items: flex-start;
          gap: 24px;
          max-width: 1100px;
          width: 100%;
          justify-content: center;
        }

        .hud-container {
          position: relative;
          width: 640px;
          height: 480px;
          border-radius: 24px;
          overflow: hidden;
          box-shadow: 0 20px 50px rgba(0,0,0,0.5);
          border: 1px solid #334155;
          background: #000;
        }

        .gif-panel {
          width: 320px;
          background: #1e293b;
          border: 1px solid #334155;
          border-radius: 24px;
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 16px;
          box-shadow: 0 10px 30px rgba(0,0,0,0.3);
        }

        .gif-panel img { 
          width: 100%; 
          border-radius: 12px; 
          background: #0f172a;
          aspect-ratio: 1/1;
          object-fit: cover;
        }

        .gif-info h4 { margin: 0; font-size: 1.1rem; color: #f8fafc; }
        .gif-info p { margin: 8px 0 0 0; font-size: 0.9rem; color: #94a3b8; }

        .plan-list { display: flex; flex-direction: column; gap: 10px; max-height: 200px; overflow-y: auto; }
        .plan-item { 
          display: flex; align-items: center; justify-content: space-between;
          background: #0f172a; border: 1px solid #334155; color: #e2e8f0;
          padding: 10px 12px; border-radius: 12px; cursor: pointer; font-weight: 700;
        }
        .plan-item.active { border-color: #10b981; color: #10b981; }
        .plan-item .secondary { font-size: 0.75rem; color: #94a3b8; font-weight: 800; }
        .instructions { display: flex; flex-direction: column; gap: 8px; margin-top: 12px; }
        .instruction-item { background: #0b1220; border: 1px solid #334155; color: #e2e8f0; padding: 8px 10px; border-radius: 10px; font-size: 0.8rem; }
        .panel-controls { display: none; }

        .rep-counter {
          position: absolute;
          top: 20px;
          left: 20px;
          background: #10b981;
          padding: 10px 20px;
          border-radius: 16px;
          text-align: center;
          z-index: 10;
        }

        .rep-count { font-size: 2rem; font-weight: 900; line-height: 1; display: block; }
        .rep-label { font-size: 0.7rem; text-transform: uppercase; font-weight: 700; }

        .feedback-pill {
          position: absolute;
          bottom: 20px;
          left: 50%;
          transform: translateX(-50%);
          background: rgba(15, 23, 42, 0.95);
          padding: 12px 24px;
          border-radius: 100px;
          font-weight: 600;
          color: #10b981;
          border: 1px solid rgba(16, 185, 129, 0.3);
          z-index: 10;
          max-width: 85%;
          text-align: center;
        }

        .status-badge {
          position: absolute;
          top: 20px;
          right: 20px;
          background: rgba(0, 0, 0, 0.5);
          padding: 6px 12px;
          border-radius: 8px;
          font-size: 0.7rem;
          display: flex;
          align-items: center;
          gap: 6px;
          z-index: 10;
        }

        .dot { 
          width: 6px; 
          height: 6px; 
          border-radius: 50%; 
          animation: blink 1s infinite; 
        }
        .dot.active { 
          background: #10b981; 
        }
        .dot.inactive { 
          background: #ef4444; 
        }
        @keyframes blink { 
          0%, 100% { opacity: 1; } 
          50% { opacity: 0.4; } 
        }

        .angle-panel {
          position: absolute;
          top: 80px;
          left: 20px;
          background: rgba(2, 6, 23, 0.75);
          border: 1px solid rgba(16,185,129,0.3);
          padding: 10px 12px;
          border-radius: 12px;
          display: grid;
          grid-template-columns: auto auto;
          gap: 8px 12px;
          font-size: 0.8rem;
          color: #e2e8f0;
          z-index: 10;
        }
        .angle-item { display: contents; }
        .angle-label { color: #10b981; font-weight: 800; }
        .angle-value { font-weight: 700; }

        .metrics-panel {
          position: absolute;
          top: 20px;
          left: 50%;
          transform: translateX(-50%);
          background: rgba(2, 6, 23, 0.9);
          border: 1px solid rgba(16, 185, 129, 0.3);
          padding: 12px 20px;
          border-radius: 12px;
          display: flex;
          gap: 30px;
          font-size: 0.85rem;
          z-index: 10;
        }

        .metric-item { display: flex; flex-direction: column; align-items: center; }
        .metric-label { color: #94a3b8; font-size: 0.7rem; }
        .metric-value { color: #10b981; font-weight: 800; font-size: 1rem; }

        .form-score {
          position: absolute;
          bottom: 80px;
          right: 20px;
          background: rgba(2, 6, 23, 0.9);
          border: 1px solid rgba(16, 185, 129, 0.3);
          padding: 12px 16px;
          border-radius: 12px;
          text-align: center;
          z-index: 10;
        }

        .form-score-value { font-size: 1.5rem; font-weight: 900; color: #10b981; }
        .form-score-label { font-size: 0.65rem; color: #94a3b8; text-transform: uppercase; }

        .pose-match-indicator {
          position: absolute;
          bottom: 160px;
          right: 20px;
          background: rgba(2, 6, 23, 0.9);
          border: 1px solid rgba(16, 185, 129, 0.3);
          padding: 12px 16px;
          border-radius: 12px;
          text-align: center;
          z-index: 10;
        }

        .pose-match-value { 
          font-size: 1.2rem; 
          font-weight: 800; 
          color: #10b981;
        }
        .pose-match-label { 
          font-size: 0.6rem; 
          color: #94a3b8; 
          text-transform: uppercase;
        }

        .exercise-metadata {
          background: #0b1220;
          border: 1px solid #334155;
          border-radius: 12px;
          padding: 12px;
          margin-top: 12px;
        }
        .metadata-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 4px 0;
          font-size: 0.8rem;
        }
        .metadata-label {
          color: #94a3b8;
          font-weight: 600;
        }
        .metadata-value {
          color: #e2e8f0;
          font-weight: 700;
        }
        .muscle-tags {
          display: flex;
          flex-wrap: wrap;
          gap: 4px;
          margin-top: 4px;
        }
        .muscle-tag {
          background: rgba(16, 185, 129, 0.2);
          color: #10b981;
          padding: 2px 6px;
          border-radius: 4px;
          font-size: 0.7rem;
          font-weight: 600;
        }

        .rest-overlay {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.7);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-direction: column;
          z-index: 100;
          border-radius: 24px;
        }

        .rest-timer { font-size: 4rem; font-weight: 900; color: #fbbf24; }
        .rest-text { font-size: 1rem; color: #e2e8f0; margin-top: 10px; }

        .controls { margin-top: 32px; }
        .exit-btn {
          background: #ef4444;
          color: white;
          border: none;
          padding: 12px 40px;
          border-radius: 12px;
          font-weight: 700;
          cursor: pointer;
          transition: 0.3s;
        }
        .exit-btn:hover { background: #dc2626; }

        .instructions-panel {
          position: absolute;
          top: 100px;
          right: 20px;
          background: rgba(2, 6, 23, 0.9);
          border: 1px solid rgba(16, 185, 129, 0.3);
          padding: 15px;
          border-radius: 12px;
          max-width: 300px;
          z-index: 10;
        }
        .instructions-title {
          color: #10b981;
          font-weight: 700;
          font-size: 0.9rem;
          margin-bottom: 10px;
        }
        .instructions-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .instruction-item {
          display: flex;
          align-items: flex-start;
          gap: 8px;
          font-size: 0.8rem;
          line-height: 1.4;
        }
        .instruction-number {
          color: #10b981;
          font-weight: 600;
          min-width: 20px;
        }
        .instruction-text {
          color: #e2e8f0;
          flex: 1;
        }

        .instructions-panel-bottom {
          position: absolute;
          bottom: 20px;
          left: 50%;
          transform: translateX(-50%);
          background: rgba(2, 6, 23, 0.95);
          border: 2px solid rgba(16, 185, 129, 0.5);
          padding: 20px;
          border-radius: 16px;
          max-width: 600px;
          width: 90%;
          z-index: 15;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
        }
        .instructions-header {
          color: #10b981;
          font-weight: 700;
          font-size: 1.1rem;
          margin-bottom: 15px;
          text-align: center;
          text-transform: uppercase;
          letter-spacing: 1px;
        }
        .instructions-carousel {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .instruction-slide {
          display: flex;
          align-items: center;
          gap: 15px;
          padding: 12px 15px;
          background: rgba(16, 185, 129, 0.1);
          border-left: 4px solid #10b981;
          border-radius: 8px;
          transition: all 0.3s ease;
        }
        .instruction-slide:hover {
          background: rgba(16, 185, 129, 0.2);
          transform: translateX(5px);
        }
        .instruction-step {
          color: #10b981;
          font-weight: 700;
          font-size: 0.9rem;
          min-width: 60px;
          background: rgba(16, 185, 129, 0.2);
          padding: 5px 10px;
          border-radius: 20px;
          text-align: center;
        }
        .instruction-content {
          color: #e2e8f0;
          font-size: 1rem;
          line-height: 1.5;
          font-weight: 500;
        }

        .exercise-metadata {
          position: absolute;
          top: 100px;
          left: 20px;
          background: rgba(2, 6, 23, 0.9);
          border: 1px solid rgba(16, 185, 129, 0.3);
          padding: 15px;
          border-radius: 12px;
          max-width: 250px;
          z-index: 10;
        }
        .metadata-title {
          color: #10b981;
          font-weight: 700;
          font-size: 0.9rem;
          margin-bottom: 10px;
        }
        .metadata-grid {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .metadata-item {
          display: flex;
          justify-content: space-between;
          font-size: 0.8rem;
        }
        .metadata-label {
          color: #94a3b8;
          font-weight: 600;
        }
        .metadata-value {
          color: #e2e8f0;
          font-weight: 500;
        }

        .exercise-metadata-compact {
          position: absolute;
          top: 20px;
          left: 20px;
          background: rgba(2, 6, 23, 0.9);
          border: 1px solid rgba(16, 185, 129, 0.3);
          padding: 10px 15px;
          border-radius: 8px;
          z-index: 10;
          display: flex;
          gap: 20px;
        }
        .exercise-metadata-compact .metadata-item {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 0.8rem;
        }
        .exercise-metadata-compact .metadata-label {
          color: #94a3b8;
          font-weight: 600;
        }
        .exercise-metadata-compact .metadata-value {
          color: #e2e8f0;
          font-weight: 500;
        }

        @media (max-width: 1000px) {
          .main-workspace { flex-direction: column; align-items: center; }
          .hud-container, .gif-panel { width: 100%; max-width: 640px; }
        }
      `}</style>

      <div className="main-workspace">
        <div className="hud-container">
          <video ref={videoRef} width={640} height={480} style={{ display: 'none' }} />
          <canvas ref={canvasRef} />
          
          <div className="rep-counter">
            <span className="rep-count">{reps}</span>
            <span className="rep-label">Reps</span>
          </div>

          <div className="status-badge">
            <div className={`dot ${ready ? 'active' : 'inactive'}`}></div> 
            {ready ? 'POSE DETECTED' : 'INITIALIZING...'}
          </div>

          <div className="metrics-panel">
            <div className="metric-item">
              <span className="metric-label">Time</span>
              <span className="metric-value">{formatTime(sessionTime)}</span>
            </div>
            <div className="metric-item">
              <span className="metric-label">Calories</span>
              <span className="metric-value">{caloriesBurned}</span>
            </div>
            <div className="metric-item">
              <span className="metric-label">Target</span>
              <span className="metric-value">{targetReps}</span>
            </div>
          </div>

          <div className="feedback-pill">{feedback}</div>

          {instructions.length > 0 && (
            <div className="instructions-panel-bottom">
              <div className="instructions-header">Exercise Instructions</div>
              <div className="instructions-carousel">
                {instructions.map((instruction, index) => (
                  <div key={index} className="instruction-slide">
                    <span className="instruction-step">Step {index + 1}</span>
                    <span className="instruction-content">{instruction}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="form-score">
            <div className="form-score-value">{formScore}%</div>
            <div className="form-score-label">Form Score</div>
          </div>

          <div className="pose-match-indicator">
            <div className="pose-match-value">{poseMatchScore}%</div>
            <div className="pose-match-label">Pose Match</div>
          </div>

          {exerciseMetadata && (
            <div className="exercise-metadata-compact">
              <div className="metadata-item">
                <span className="metadata-label">Type:</span>
                <span className="metadata-value">{exerciseMetadata.exercise_type}</span>
              </div>
              <div className="metadata-item">
                <span className="metadata-label">Target:</span>
                <span className="metadata-value">{exerciseMetadata.target}</span>
              </div>
            </div>
          )}

          <div className="angle-panel">
            {Object.entries(angles).map(([k, v]) => (
              <div key={k} className="angle-item">
                <span className="angle-label">{k.toUpperCase()}</span>
                <span className="angle-value">{v}°</span>
              </div>
            ))}
          </div>

          {isResting && (
            <div className="rest-overlay">
              <div className="rest-timer">{restTimer}</div>
              <div className="rest-text">Rest Time</div>
            </div>
          )}
        </div>

        <div className="gif-panel">
          {gifSrc && (
            <img
              src={gifSrc}
              alt={exerciseName}
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none'
                setFeedback('GIF not found - using live guidance')
              }}
            />
          )}
          <div className="gif-info">
            <h4>{exerciseName}</h4>
            <p>Target: <strong>{targetReps || 'N/A'}</strong></p>
            {Object.keys(referenceAngles).length > 0 && (
              <div className="reference-angles">
                <p>Reference Angles:</p>
                {Object.entries(referenceAngles).map(([k, v]) => (
                  <span key={k} className="ref-angle">{k.toUpperCase()}: {v}° </span>
                ))}
              </div>
            )}
            {exerciseMetadata && (
              <div className="exercise-metadata">
                <div className="metadata-item">
                  <span className="metadata-label">Type:</span>
                  <span className="metadata-value">{exerciseMetadata.exercise_type || 'N/A'}</span>
                </div>
                <div className="metadata-item">
                  <span className="metadata-label">Target:</span>
                  <span className="metadata-value">{exerciseMetadata.target || 'N/A'}</span>
                </div>
                <div className="metadata-item">
                  <span className="metadata-label">Equipment:</span>
                  <span className="metadata-value">{exerciseMetadata.equipment || 'N/A'}</span>
                </div>
                {exerciseMetadata.muscle_groups && exerciseMetadata.muscle_groups.length > 0 && (
                  <div className="metadata-item">
                    <span className="metadata-label">Muscles:</span>
                    <div className="muscle-tags">
                      {exerciseMetadata.muscle_groups.map((muscle: string, i: number) => (
                        <span key={i} className="muscle-tag">{muscle}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
            {instructions.length > 0 && (
              <div className="instructions">
                {instructions.slice(0, 6).map((ins, i) => (
                  <div key={i} className="instruction-item">{ins}</div>
                ))}
              </div>
            )}
          </div>
          <div className="plan-list">
            {plan.map((x, i) => (
              <div
                key={`${x.name}-${i}`}
                className={`plan-item ${i === idx ? 'active' : ''}`}
                onClick={() => goToIndex(i, plan)}
              >
                <span>{x.name}</span>
                <span className="secondary">{x.repetitions || 'N/A'}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="controls">
        <button className="exit-btn" onClick={() => window.history.back()}>Finish Session</button>
        <div style={{marginTop: '10px', display: 'flex', gap: '10px', flexWrap: 'wrap'}}>
          <button 
            onClick={() => speak('Test voice feedback is working')}
            style={{background: '#10b981', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer'}}
          >
            Test Voice
          </button>
          <button 
            onClick={() => {
              console.log('=== CURRENT STATE DEBUG ===')
              console.log('ready:', ready)
              console.log('reps:', reps)
              console.log('stage:', stage)
              console.log('feedback:', feedback)
              console.log('formScore:', formScore)
              console.log('poseMatchScore:', poseMatchScore)
              console.log('instructions length:', instructions.length)
              console.log('instructions:', instructions)
              console.log('poseHints:', poseHints ? 'loaded' : 'not loaded')
              console.log('referenceAngles:', referenceAngles)
              console.log('angles:', angles)
              console.log('exerciseName:', exerciseName)
              console.log('gifSrc:', gifSrc)
              console.log('speechSynthesis available:', !!window.speechSynthesis)
              if (window.speechSynthesis) {
                console.log('voices:', window.speechSynthesis.getVoices().length)
              }
            }}
            style={{background: '#6366f1', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer'}}
          >
            Debug State
          </button>
          <button 
            onClick={() => {
              console.log('=== TESTING INSTRUCTIONS LOADING ===')
              console.log('Current instructions:', instructions)
              console.log('Instructions length:', instructions.length)
              
              // Test with sample instructions if empty
              if (instructions.length === 0) {
                const sampleInstructions = [
                  'Lie flat on your back with your knees bent',
                  'Place your hands behind your head',
                  'Engaging your abs, slowly lift your upper body',
                  'Pause for a moment at the top',
                  'Slowly lower your upper body back down',
                  'Repeat for the desired number of repetitions'
                ]
                console.log('Setting sample instructions:', sampleInstructions)
                setInstructions(sampleInstructions)
                speak('Testing with sample instructions: Lie flat on your back with your knees bent')
              } else {
                console.log('Speaking first instruction:', instructions[0])
                speak(instructions[0])
              }
            }}
            style={{background: '#8b5cf6', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer'}}
          >
            Test Instructions
          </button>
          <button 
            onClick={() => {
              console.log('=== RESTARTING VIDEO ===')
              if (videoRef.current) {
                console.log('Restarting video stream...')
                setReady(false)
                setFeedback('🔄 Restarting camera...')
                
                // Stop current stream
                if (videoRef.current.srcObject) {
                  const stream = videoRef.current.srcObject as MediaStream
                  stream.getTracks().forEach(track => track.stop())
                }
                
                // Restart camera
                navigator.mediaDevices.getUserMedia({ 
                  video: { 
                    width: 640, 
                    height: 480,
                    facingMode: 'user'
                  } 
                })
                .then(stream => {
                  console.log('Camera restarted successfully')
                  videoRef.current!.srcObject = stream
                  videoRef.current!.play().then(() => {
                    console.log('Video playing after restart')
                    setReady(true)
                    setFeedback('✅ Camera restarted')
                  }).catch(error => {
                    console.error('Error playing video after restart:', error)
                    setFeedback('⚠️ Error playing video')
                  })
                })
                .catch(error => {
                  console.error('Error restarting camera:', error)
                  setFeedback('⚠️ Camera restart failed')
                })
              }
            }}
            style={{background: '#f59e0b', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer'}}
          >
            Restart Camera
          </button>
          <button 
            onClick={() => {
              console.log('=== TESTING POSE DETECTION ===')
              if (videoRef.current) {
                console.log('Video element exists')
                console.log('Video ready state:', videoRef.current.readyState)
                console.log('Video dimensions:', videoRef.current.videoWidth, 'x', videoRef.current.videoHeight)
                console.log('Canvas element exists:', !!canvasRef.current)
                if (canvasRef.current) {
                  console.log('Canvas dimensions:', canvasRef.current.width, 'x', canvasRef.current.height)
                }
              } else {
                console.log('Video element does not exist')
              }
              
              // Test pose detection manually
              if (canvasRef.current && videoRef.current) {
                const ctx = canvasRef.current.getContext('2d')
                if (ctx) {
                  console.log('Canvas context exists')
                  ctx.drawImage(videoRef.current, 0, 0, canvasRef.current.width, canvasRef.current.height)
                  console.log('Drew video frame to canvas')
                }
              }
            }}
            style={{background: '#f59e0b', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer'}}
          >
            Test Pose
          </button>
          <button 
            onClick={() => {
              console.log('=== TESTING SPEECH SYNTHESIS ===')
              if ('speechSynthesis' in window) {
                console.log('Speech synthesis supported')
                const synth = window.speechSynthesis
                console.log('Speaking:', synth.speaking)
                console.log('Pending:', synth.pending)
                console.log('Paused:', synth.paused)
                const voices = synth.getVoices()
                console.log('Available voices:', voices.length)
                voices.forEach((voice, i) => {
                  console.log(`Voice ${i}: ${voice.name} (${voice.lang})`)
                })
                
                // Test speech
                const utter = new SpeechSynthesisUtterance('Testing speech synthesis')
                utter.onstart = () => console.log('Test speech started')
                utter.onend = () => console.log('Test speech ended')
                utter.onerror = (e) => console.error('Test speech error:', e)
                synth.speak(utter)
              } else {
                console.error('Speech synthesis not supported')
              }
            }}
            style={{background: '#ef4444', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer'}}
          >
            Test Speech API
          </button>
        </div>
      </div>
    </div>
  )
}

export default Trainer
