import { useState, useCallback, useRef } from 'react'
import ConfigStep from './components/ConfigStep'
import type { SetupConfig } from './components/ConfigStep'
import TakeCard from './components/TakeCard'
import ValidateStep from './components/ValidateStep'
import type { ValidationSentence } from './components/ValidateStep'
import Stepper from './components/Stepper'
import {
  Loader2,
  RotateCw,
  Zap,
  Sparkles,
  Upload,
  X,
  FileAudio,
  ArrowRight,
  Repeat,
  Scissors,
  Mic,
  Wand2,
  Download,
} from 'lucide-react'
import JSZip from 'jszip'
import {
  generateTTS,
  generateTTSTrimmed,
  buildJobMatrix,
  createVoice,
  getVoiceName,
} from './lib/api'
import { runAmplification } from './lib/amplify'
import type { AmplifyProgress, AmplifyResult } from './lib/amplify'
import type {
  AppStep,
  Take,
  AmplifiedFile,
  PronunciationGuide,
  CloneType,
  FramingType,
  ModelId,
  SettingsVariant,
} from './lib/types'
import { SETTINGS_VARIANTS, AMPLIFICATION_CONFIG, CLONE_TYPE_CONFIG } from './lib/types'
import { getValidationSentences, INDUSTRIES, type Industry } from './lib/snippets'

async function concatAudioBlobs(blobs: Blob[]): Promise<Blob> {
  const buffers = await Promise.all(blobs.map((b) => b.arrayBuffer()))
  const totalLen = buffers.reduce((sum, b) => sum + b.byteLength, 0)
  const combined = new Uint8Array(totalLen)
  let offset = 0
  for (const buf of buffers) {
    combined.set(new Uint8Array(buf), offset)
    offset += buf.byteLength
  }
  return new Blob([combined], { type: 'audio/mpeg' })
}

type BuildPhase = 'idle' | 'amplifying' | 'creating' | 'done'

export default function App() {
  // --- Step state ---
  const [step, setStep] = useState<AppStep>('setup')

  // --- Setup config ---
  const [apiKey, setApiKey] = useState('')
  const [voiceId, setVoiceId] = useState('')
  const [voiceName, setVoiceName] = useState('')
  const [word, setWord] = useState('')
  const [guides, setGuides] = useState<PronunciationGuide[]>([])
  const [industry, setIndustry] = useState<Industry>('general')
  const [cloneType, setCloneType] = useState<CloneType>('ivc')

  // --- Generation state (inline in curate) ---
  const [takes, setTakes] = useState<Take[]>([])
  const [generating, setGenerating] = useState(false)
  const [genProgress, setGenProgress] = useState({ done: 0, total: 0 })
  const cancelRef = useRef(false)
  const pendingTakesRef = useRef<Take[]>([])
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // --- Build state (amplify + create voice, inline in curate) ---
  const [buildPhase, setBuildPhase] = useState<BuildPhase>('idle')
  const [amplifyProgress, setAmplifyProgress] = useState<AmplifyProgress | null>(null)
  const [amplifyResult, setAmplifyResult] = useState<AmplifyResult | null>(null)
  const [amplifiedFiles, setAmplifiedFiles] = useState<AmplifiedFile[]>([])
  const [newVoiceName, setNewVoiceName] = useState('')
  const [baseFiles, setBaseFiles] = useState<File[]>([])
  const [isDragging, setIsDragging] = useState(false)

  // --- Review state ---
  const [newVoiceId, setNewVoiceId] = useState('')
  const [validationSentences, setValidationSentences] = useState<ValidationSentence[]>([])
  const [sentencesLoading, setSentencesLoading] = useState(false)
  const [repetitionUrl, setRepetitionUrl] = useState<string | null>(null)
  const [repetitionLoading, setRepetitionLoading] = useState(false)
  const [beforeUrl, setBeforeUrl] = useState<string | null>(null)
  const [beforeLoading, setBeforeLoading] = useState(false)
  const [wordCount, setWordCount] = useState(0)

  // --- Computed ---
  const selectedTakes = takes.filter((t) => t.selected && !t.dismissed)
  const visibleTakes = takes.filter((t) => !t.dismissed)
  const industryLabel = INDUSTRIES.find((i) => i.id === industry)?.label || 'General'
  const cloneConfig = CLONE_TYPE_CONFIG[cloneType]

  // --- Take buffering ---
  const flushPendingTakes = useCallback(() => {
    if (pendingTakesRef.current.length > 0) {
      const batch = pendingTakesRef.current
      pendingTakesRef.current = []
      setTakes((prev) => [...prev, ...batch])
    }
    flushTimerRef.current = null
  }, [])

  const enqueueTake = useCallback((take: Take) => {
    pendingTakesRef.current.push(take)
    if (!flushTimerRef.current) {
      flushTimerRef.current = setTimeout(flushPendingTakes, 400)
    }
  }, [flushPendingTakes])

  // --- Step 1: Setup ---
  const handleSetup = useCallback(async (config: SetupConfig) => {
    setApiKey(config.apiKey)
    setVoiceId(config.voiceId)
    setWord(config.word)
    setGuides(config.guides)
    setIndustry(config.industry)
    setCloneType(config.cloneType)

    const name = await getVoiceName(config.apiKey, config.voiceId)
    setVoiceName(name)
    setNewVoiceName(`${name} + ${config.word}`)

    setStep('curate')
    runGeneration(config.apiKey, config.voiceId, config.word, config.guides)
  }, [])

  // --- Generation (runs inline in curate step) ---
  const runGeneration = useCallback(
    async (key: string, vId: string, w: string, g: PronunciationGuide[]) => {
      setGenerating(true)
      cancelRef.current = false
      const jobs = buildJobMatrix(w, g, SETTINGS_VARIANTS)
      setGenProgress({ done: 0, total: jobs.length })

      let completed = 0
      const queue = [...jobs]
      const workers = Array.from({ length: 3 }, async () => {
        while (queue.length > 0 && !cancelRef.current) {
          const job = queue.shift()
          if (!job) break
          try {
            const needsTrim = job.framing.type !== 'isolated' && job.framing.type !== 'alias'
            let audioBlob: Blob
            let trimmedBlob: Blob | null = null

            if (needsTrim) {
              const result = await generateTTSTrimmed({
                voiceId: vId, apiKey: key, text: job.framing.text,
                modelId: job.model, voiceSettings: job.voiceSettings, word: w,
              })
              audioBlob = result.fullBlob
              trimmedBlob = result.trimmedBlob
            } else {
              audioBlob = await generateTTS({
                voiceId: vId, apiKey: key, text: job.framing.text,
                modelId: job.model, voiceSettings: job.voiceSettings,
              })
            }

            const take: Take = {
              id: crypto.randomUUID(),
              audioBlob, audioUrl: URL.createObjectURL(audioBlob),
              trimmedBlob,
              framing: job.framing.type as FramingType,
              framingLabel: job.framing.label,
              model: job.model as ModelId,
              settings: job.settings as SettingsVariant,
              selected: false, dismissed: false,
            }
            enqueueTake(take)
          } catch (err) { console.error('TTS failed:', err) }
          completed++
          setGenProgress({ done: completed, total: jobs.length })
        }
      })
      await Promise.all(workers)
      flushPendingTakes()
      setGenerating(false)
    },
    [enqueueTake, flushPendingTakes]
  )

  const handleToggleSelect = useCallback((id: string) => {
    setTakes((prev) => prev.map((t) => t.id === id ? { ...t, selected: !t.selected } : t))
  }, [])

  const handleDismiss = useCallback((id: string) => {
    setTakes((prev) => prev.map((t) => {
      if (t.id === id) { URL.revokeObjectURL(t.audioUrl); return { ...t, dismissed: true, selected: false } }
      return t
    }))
  }, [])

  const handleGenerateMore = useCallback(() => {
    runGeneration(apiKey, voiceId, word, guides)
  }, [apiKey, voiceId, word, guides, runGeneration])

  // --- Build voice (amplify → create IVC or package PVC ZIP) ---
  const handleBuildVoice = useCallback(async () => {
    setBuildPhase('amplifying')
    setAmplifyProgress(null)
    setAmplifyResult(null)
    setAmplifiedFiles([])
    cancelRef.current = false

    const config = AMPLIFICATION_CONFIG
    try {
      const result = await runAmplification({
        goldenTakes: selectedTakes,
        word, apiKey, voiceId, industry, guides, config,
        onProgress: (p) => setAmplifyProgress(p),
        cancelRef,
      })
      setAmplifyResult(result)
      setAmplifiedFiles(result.files)

      if (cloneType === 'pvc') {
        // PVC: corpus is ready for download — no API voice creation
        setBuildPhase('done')
        return
      }

      // IVC: auto-advance to voice creation via API
      setBuildPhase('creating')

      const audioFiles: { blob: Blob; name: string }[] = result.files.map((af) => ({
        blob: af.blob,
        name: af.name,
      }))
      for (const f of baseFiles) {
        audioFiles.push({ blob: f, name: f.name })
      }

      const desc = `Pronunciation-corrected IVC (${industryLabel}). Trained for: ${word}`
      const voiceResult = await createVoice(apiKey, newVoiceName.trim() || `${voiceName} + ${word}`, desc, audioFiles)
      setNewVoiceId(voiceResult.voice_id)
      setWordCount((prev) => prev + 1)
      setBuildPhase('done')

      setTimeout(() => {
        setStep('review')
        runValidation(voiceResult.voice_id, word)
      }, 1200)
    } catch (err) {
      console.error('Build failed:', err)
      alert(`Build failed: ${err instanceof Error ? err.message : 'Unknown error'}`)
      setBuildPhase('idle')
    }
  }, [selectedTakes, word, apiKey, voiceId, industry, guides, cloneType, cloneConfig, baseFiles, newVoiceName, voiceName, industryLabel])

  // --- PVC: download corpus as ZIP ---
  const handleDownloadZip = useCallback(async () => {
    if (amplifiedFiles.length === 0) return
    const zip = new JSZip()
    const folder = zip.folder('training-corpus')!

    for (const af of amplifiedFiles) {
      const buf = await af.blob.arrayBuffer()
      folder.file(af.name, buf)
    }
    for (const f of baseFiles) {
      const buf = await f.arrayBuffer()
      folder.file(`additional/${f.name}`, buf)
    }

    const zipBlob = await zip.generateAsync({ type: 'blob' })
    const safeName = (newVoiceName.trim() || `${voiceName}-${word}`).replace(/[^a-zA-Z0-9_-]/g, '_')
    const url = URL.createObjectURL(zipBlob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${safeName}_pvc_corpus.zip`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, [amplifiedFiles, baseFiles, newVoiceName, voiceName, word])

  // --- File upload helpers ---
  const addFiles = useCallback((files: FileList | null) => {
    if (!files) return
    const valid = Array.from(files).filter(
      (f) => f.name.endsWith('.mp3') || f.name.endsWith('.wav')
    )
    setBaseFiles((prev) => [...prev, ...valid].slice(0, 3))
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    addFiles(e.dataTransfer.files)
  }, [addFiles])

  // --- SSML guide wrapper ---
  const applyGuide = useCallback((text: string, w: string): string => {
    const ipa = guides.find((g) => g.type === 'ipa')
    const cmu = guides.find((g) => g.type === 'cmu')
    if (ipa) {
      const val = ipa.value.replace(/^\/|\/$/g, '')
      const phoneme = `<phoneme alphabet="ipa" ph="${val}">${w}</phoneme>`
      const escaped = w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      return `<speak>${text.replace(new RegExp(escaped, 'g'), phoneme)}</speak>`
    }
    if (cmu) {
      const phoneme = `<phoneme alphabet="cmu-arpabet" ph="${cmu.value}">${w}</phoneme>`
      const escaped = w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      return `<speak>${text.replace(new RegExp(escaped, 'g'), phoneme)}</speak>`
    }
    return text
  }, [guides])

  // --- Validation (runs in review step) ---
  const runValidation = useCallback(
    async (vId: string, w: string) => {
      setSentencesLoading(true)
      setValidationSentences([])
      setRepetitionUrl(null)
      setBeforeUrl(null)

      const sentences = getValidationSentences(w, industry)
      for (const sentence of sentences) {
        try {
          const guided = applyGuide(sentence, w)
          const blob = await generateTTS({
            voiceId: vId, apiKey, text: guided,
            modelId: 'eleven_multilingual_v2',
            voiceSettings: { stability: 0.5, similarity_boost: 0.75 },
          })
          setValidationSentences((prev) => [...prev, { sentence, audioUrl: URL.createObjectURL(blob) }])
        } catch (err) { console.error('Validation sentence failed:', err) }
      }
      setSentencesLoading(false)
      generateRepetition(vId, w)
      generateBefore(w)
    },
    [apiKey, industry, applyGuide]
  )

  const generateRepetition = useCallback(
    async (vId: string, w: string) => {
      setRepetitionLoading(true)
      if (repetitionUrl) URL.revokeObjectURL(repetitionUrl)
      setRepetitionUrl(null)
      const guided = applyGuide(w, w)
      const blobs: Blob[] = []
      for (let i = 0; i < 10; i++) {
        try {
          const blob = await generateTTS({
            voiceId: vId, apiKey, text: guided,
            modelId: 'eleven_multilingual_v2',
            voiceSettings: { stability: 0.5, similarity_boost: 0.75 },
          })
          blobs.push(blob)
        } catch (err) { console.error(`Repetition ${i} failed:`, err) }
      }
      if (blobs.length > 0) {
        const combined = await concatAudioBlobs(blobs)
        setRepetitionUrl(URL.createObjectURL(combined))
      }
      setRepetitionLoading(false)
    },
    [apiKey, repetitionUrl, applyGuide]
  )

  const generateBefore = useCallback(
    async (w: string) => {
      setBeforeLoading(true)
      if (beforeUrl) URL.revokeObjectURL(beforeUrl)
      setBeforeUrl(null)
      const blobs: Blob[] = []
      for (let i = 0; i < 10; i++) {
        try {
          const blob = await generateTTS({
            voiceId, apiKey, text: w,
            modelId: 'eleven_multilingual_v2',
            voiceSettings: { stability: 0.5, similarity_boost: 0.75 },
          })
          blobs.push(blob)
        } catch (err) { console.error(`Before ${i} failed:`, err) }
      }
      if (blobs.length > 0) {
        const combined = await concatAudioBlobs(blobs)
        setBeforeUrl(URL.createObjectURL(combined))
      }
      setBeforeLoading(false)
    },
    [apiKey, voiceId, beforeUrl]
  )

  const handleRefreshRepetition = useCallback(() => {
    if (newVoiceId && word) generateRepetition(newVoiceId, word)
  }, [newVoiceId, word, generateRepetition])

  const handleRefreshBefore = useCallback(() => {
    if (word) generateBefore(word)
  }, [word, generateBefore])

  const handleStartOver = useCallback(() => {
    if (wordCount >= 5 && !confirm('Quality may degrade beyond 4-5 words per voice. Continue?')) return
    for (const t of takes) URL.revokeObjectURL(t.audioUrl)
    for (const s of validationSentences) URL.revokeObjectURL(s.audioUrl)
    if (repetitionUrl) URL.revokeObjectURL(repetitionUrl)
    if (beforeUrl) URL.revokeObjectURL(beforeUrl)
    setTakes([]); setWord(''); setGuides([]); setValidationSentences([])
    setRepetitionUrl(null); setBeforeUrl(null); setNewVoiceId('')
    setAmplifyProgress(null); setAmplifyResult(null); setAmplifiedFiles([])
    setBuildPhase('idle'); setBaseFiles([])
    setStep('setup')
  }, [takes, validationSentences, repetitionUrl, beforeUrl, wordCount])

  const isBuilding = buildPhase !== 'idle'
  const canBuild = selectedTakes.length >= cloneConfig.minGoldenClips && !isBuilding && !generating

  return (
    <div className="min-h-screen bg-el-page">
      {/* Header */}
      <header className="border-b border-el-border bg-white/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img src="/icons/sparkles-multiple.svg" alt="" className="h-8 w-8" />
              <div>
                <h1 className="text-base font-bold text-el-text tracking-tight leading-none">
                  ElevenDiction
                </h1>
                <p className="text-[11px] text-el-text-muted hidden sm:block mt-0.5">
                  Pronunciation-corrected voice cloning
                </p>
              </div>
            </div>
            <Stepper currentStep={step} />
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">

        {/* ============= STEP 1: SETUP ============= */}
        {step === 'setup' && (
          <ConfigStep onSubmit={handleSetup} initialApiKey={apiKey} initialVoiceId={voiceId} />
        )}

        {/* ============= STEP 2: CURATE ============= */}
        {step === 'curate' && (
          <div className="space-y-6 animate-fade-in">

            {/* Generation progress bar (inline, not a separate step) */}
            {generating && (
              <div className="flex items-center gap-4 px-5 py-3.5 bg-white rounded-2xl border border-el-border animate-fade-in">
                <Loader2 className="h-4 w-4 text-el-accent animate-spin shrink-0" />
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-el-text-secondary font-medium">
                      Generating takes for &ldquo;{word}&rdquo;
                    </span>
                    <span className="text-el-text-muted tabular-nums">
                      {genProgress.done} / {genProgress.total}
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-el-border-light overflow-hidden">
                    <div
                      className="h-full bg-el-accent rounded-full transition-all duration-300 progress-striped"
                      style={{ width: `${genProgress.total > 0 ? (genProgress.done / genProgress.total) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Header + actions */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-el-text">
                  Curate pronunciations
                </h2>
                <p className="text-sm text-el-text-muted mt-0.5">
                  Select takes where &ldquo;{word}&rdquo; sounds correct — these become the foundation for your {cloneType.toUpperCase()}.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <div className={`px-3 py-1.5 rounded-full text-xs font-semibold tabular-nums ${
                  selectedTakes.length >= cloneConfig.minGoldenClips
                    ? 'bg-el-accent-light text-el-accent border border-el-accent/20'
                    : 'bg-el-surface-alt text-el-text-secondary border border-el-border'
                }`}>
                  {selectedTakes.length} selected
                </div>
                <button onClick={handleGenerateMore} disabled={generating || isBuilding}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full border border-el-border text-el-text-secondary hover:bg-el-surface-alt transition-colors disabled:opacity-50">
                  <RotateCw className={`h-3 w-3 ${generating ? 'animate-spin' : ''}`} />
                  More
                </button>
              </div>
            </div>

            {/* Take grid */}
            {visibleTakes.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {visibleTakes.map((take) => (
                  <div key={take.id} className="animate-fade-in">
                    <TakeCard take={take} onToggleSelect={handleToggleSelect} onDismiss={handleDismiss} />
                  </div>
                ))}
              </div>
            )}

            {visibleTakes.length === 0 && !generating && (
              <div className="text-center py-16 text-el-text-muted text-sm">
                All takes dismissed. Generate more to continue.
              </div>
            )}

            {/* Build voice section (appears when golden clips selected) */}
            {selectedTakes.length >= cloneConfig.minGoldenClips && !isBuilding && (
              <div className="space-y-4 animate-fade-in">
                <div className="h-px bg-el-border" />

                {/* Info banner */}
                <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-el-accent-light border border-el-accent/10 text-xs text-el-text-secondary">
                  {cloneType === 'ivc'
                    ? <Zap className="h-4 w-4 text-el-accent shrink-0" />
                    : <Sparkles className="h-4 w-4 text-el-accent shrink-0" />
                  }
                  <span>
                    <span className="font-semibold text-el-accent">{selectedTakes.length} golden clip{selectedTakes.length > 1 ? 's' : ''}</span>
                    {cloneType === 'pvc'
                      ? ' will be amplified into a training corpus packaged as a ZIP for upload to ElevenLabs.'
                      : ' will be amplified into a training corpus and used to create your instant voice clone.'
                    }
                  </span>
                </div>

                {/* Voice name + optional uploads (IVC only needs name; PVC uses name for ZIP filename) */}
                <div className="bg-white rounded-2xl border border-el-border p-5 space-y-4">
                  <div className={`grid gap-4 ${cloneType === 'ivc' ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'}`}>
                    <div>
                      <label htmlFor="voiceNameInput" className="block text-xs font-medium text-el-text mb-1.5">
                        {cloneType === 'pvc' ? 'Corpus Name' : 'Voice Name'}
                      </label>
                      <input
                        id="voiceNameInput"
                        type="text"
                        value={newVoiceName}
                        onChange={(e) => setNewVoiceName(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-el-surface-alt border border-el-border rounded-xl text-el-text text-sm focus:outline-none focus:ring-2 focus:ring-el-accent/30 focus:border-el-accent transition-all"
                      />
                    </div>
                    {cloneType === 'ivc' && (
                      <div>
                        <label className="block text-xs font-medium text-el-text mb-1.5">
                          Additional Samples <span className="text-el-text-muted font-normal">(optional)</span>
                        </label>
                        <div
                          onDrop={handleDrop}
                          onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
                          onDragLeave={(e) => { e.preventDefault(); setIsDragging(false) }}
                          className={`flex items-center justify-center gap-2 py-2.5 px-3 border-2 border-dashed rounded-xl transition-all text-xs ${
                            isDragging ? 'border-el-accent bg-el-accent-light' : 'border-el-border bg-el-surface-alt'
                          }`}
                        >
                          <Upload className="w-3.5 h-3.5 text-el-text-muted" />
                          <span className="text-el-text-muted">
                            Drop mp3/wav or{' '}
                            <label className="text-el-accent font-medium cursor-pointer hover:underline">
                              browse
                              <input type="file" accept=".mp3,.wav" multiple onChange={(e) => addFiles(e.target.files)} className="sr-only" />
                            </label>
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  {baseFiles.length > 0 && cloneType === 'ivc' && (
                    <div className="flex flex-wrap gap-2">
                      {baseFiles.map((file, i) => (
                        <div key={`${file.name}-${i}`} className="flex items-center gap-1.5 px-2.5 py-1.5 bg-el-surface-alt border border-el-border rounded-lg text-xs">
                          <FileAudio className="w-3 h-3 text-el-text-muted" />
                          <span className="truncate max-w-[120px] text-el-text">{file.name}</span>
                          <button type="button" onClick={() => setBaseFiles((p) => p.filter((_, j) => j !== i))} className="text-el-text-muted hover:text-el-danger">
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Build button */}
                <button
                  onClick={handleBuildVoice}
                  disabled={!canBuild}
                  className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-el-graphite hover:bg-black text-white font-semibold text-sm rounded-2xl transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {cloneType === 'ivc'
                    ? <><Zap className="h-4 w-4" /> Build Instant Voice Clone <ArrowRight className="w-4 h-4" /></>
                    : <><Sparkles className="h-4 w-4" /> Build Training Corpus <ArrowRight className="w-4 h-4" /></>
                  }
                </button>
              </div>
            )}

            {/* Build progress (shown inline when building) */}
            {isBuilding && (
              <div className="space-y-4 animate-fade-in">
                <div className="h-px bg-el-border" />

                <div className="bg-white rounded-2xl border border-el-border p-6 space-y-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-el-text">
                        {buildPhase === 'amplifying' && 'Building training corpus...'}
                        {buildPhase === 'creating' && 'Creating voice...'}
                        {buildPhase === 'done' && cloneType === 'pvc' && 'Training corpus ready'}
                        {buildPhase === 'done' && cloneType === 'ivc' && 'Voice created!'}
                      </h3>
                      <p className="text-xs text-el-text-muted mt-0.5">
                        {buildPhase === 'done' && cloneType === 'ivc' && 'Preparing review...'}
                        {buildPhase === 'done' && cloneType === 'pvc' && 'Download and upload to ElevenLabs to create your Professional Voice Clone.'}
                        {buildPhase !== 'done' && `From ${selectedTakes.length} golden clip${selectedTakes.length > 1 ? 's' : ''}`}
                      </p>
                    </div>
                    {buildPhase !== 'done' && (
                      <Loader2 className="h-5 w-5 text-el-accent animate-spin" />
                    )}
                    {buildPhase === 'done' && (
                      <img src="/icons/checkmark-circle.svg" alt="" className="h-6 w-6" />
                    )}
                  </div>

                  {amplifyProgress && (
                    <div className="space-y-3">
                      <ProgressRow
                        icon={<Wand2 className="h-3.5 w-3.5" />}
                        label="Pronunciation variations"
                        done={amplifyProgress.variationsDone}
                        total={amplifyProgress.variationsTotal}
                        active={amplifyProgress.phase === 'variations'}
                      />
                      <ProgressRow
                        icon={<Scissors className="h-3.5 w-3.5" />}
                        label="Sentence splicing"
                        done={amplifyProgress.sentencesDone}
                        total={amplifyProgress.sentencesTotal}
                        active={amplifyProgress.phase === 'sentences'}
                      />
                      <ProgressRow
                        icon={<Repeat className="h-3.5 w-3.5" />}
                        label="Repetition files"
                        done={amplifyProgress.repetitionDone}
                        total={amplifyProgress.repetitionTotal}
                        active={amplifyProgress.phase === 'repetition'}
                      />
                      <ProgressRow
                        icon={<Mic className="h-3.5 w-3.5" />}
                        label={`${industryLabel} corpus`}
                        done={amplifyProgress.corpusDone}
                        total={amplifyProgress.corpusTotal}
                        active={amplifyProgress.phase === 'corpus'}
                      />

                      {buildPhase === 'creating' && (
                        <div className="flex items-center gap-2 pt-1">
                          <Loader2 className="h-3 w-3 text-el-accent animate-spin" />
                          <span className="text-xs text-el-text-secondary">Uploading to ElevenLabs...</span>
                        </div>
                      )}

                      {buildPhase === 'done' && amplifyResult && (
                        <div className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl bg-el-accent-light border border-el-accent/20 mt-1">
                          <div>
                            <p className="text-xs font-semibold text-el-text">
                              {cloneType === 'pvc' ? 'Corpus packaged' : 'Corpus complete'}
                            </p>
                            <p className="text-[11px] text-el-text-secondary">
                              {amplifyResult.files.length} files &middot;
                              ~{Math.round(amplifyResult.totalDurationEstimate / 60)} min audio &middot;
                              {amplifyResult.variationCount} variants
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* PVC: Download ZIP + instructions */}
                {buildPhase === 'done' && cloneType === 'pvc' && (
                  <div className="space-y-4 animate-fade-in">
                    <button
                      onClick={handleDownloadZip}
                      className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-el-graphite hover:bg-black text-white font-semibold text-sm rounded-2xl transition-all"
                    >
                      <Download className="h-4 w-4" />
                      Download Training Corpus ZIP
                    </button>

                    <div className="bg-white rounded-2xl border border-el-border p-5 space-y-3">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-el-text-muted">Next Steps</h3>
                      <ol className="space-y-2 text-xs text-el-text-secondary">
                        <li className="flex gap-2.5">
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-el-surface-alt text-[10px] font-bold text-el-text-muted">1</span>
                          <span>Go to <a href="https://elevenlabs.io/voice-lab" target="_blank" rel="noopener noreferrer" className="text-el-accent font-medium hover:underline">ElevenLabs Voice Lab</a> and select &ldquo;Add Professional Voice Clone&rdquo;</span>
                        </li>
                        <li className="flex gap-2.5">
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-el-surface-alt text-[10px] font-bold text-el-text-muted">2</span>
                          <span>Upload all files from the downloaded ZIP as your training samples</span>
                        </li>
                        <li className="flex gap-2.5">
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-el-surface-alt text-[10px] font-bold text-el-text-muted">3</span>
                          <span>Complete the verification process and wait for training (~4 hours)</span>
                        </li>
                      </ol>
                    </div>

                    <button
                      type="button"
                      onClick={handleStartOver}
                      className="w-full flex items-center justify-center gap-2 px-6 py-3.5 border border-el-border text-el-text-secondary font-medium text-sm rounded-2xl hover:bg-el-surface-alt transition-all"
                    >
                      <RotateCw className="w-3.5 h-3.5" />
                      Start Over
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ============= STEP 3: REVIEW ============= */}
        {step === 'review' && (
          <ValidateStep
            voiceId={newVoiceId}
            word={word}
            cloneType={cloneType}
            validationSentences={validationSentences}
            isSentencesLoading={sentencesLoading}
            repetitionAudioUrl={repetitionUrl}
            isRepetitionLoading={repetitionLoading}
            onRefreshRepetition={handleRefreshRepetition}
            beforeAudioUrl={beforeUrl}
            isBeforeLoading={beforeLoading}
            onGenerateBefore={handleRefreshBefore}
            onStartOver={handleStartOver}
            hasGuides={guides.some((g) => g.type === 'ipa' || g.type === 'cmu')}
          />
        )}
      </main>
    </div>
  )
}

function ProgressRow({
  icon,
  label,
  done,
  total,
  active,
}: {
  icon: React.ReactNode
  label: string
  done: number
  total: number
  active: boolean
}) {
  const pct = total > 0 ? (done / total) * 100 : 0
  const finished = done >= total && total > 0

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={active || finished ? 'text-el-accent' : 'text-el-text-muted'}>
            {icon}
          </span>
          <span className={`text-xs font-medium ${active ? 'text-el-text' : 'text-el-text-secondary'}`}>
            {label}
          </span>
        </div>
        <span className="text-xs text-el-text-muted tabular-nums">
          {done} / {total}
        </span>
      </div>
      <div className="h-1 rounded-full bg-el-border-light overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ${
            active ? 'bg-el-accent progress-striped' : finished ? 'bg-el-accent' : 'bg-el-border'
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
