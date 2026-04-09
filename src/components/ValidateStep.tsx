import { useRef, useState, useEffect, useCallback } from 'react'
import { Copy, Check, RotateCw, Loader2, Play, Pause, RefreshCw } from 'lucide-react'
import type { CloneType } from '../lib/types'

export interface ValidationSentence {
  sentence: string
  audioUrl: string
}

export interface ValidateStepProps {
  voiceId: string
  word: string
  cloneType: CloneType
  validationSentences: ValidationSentence[]
  isSentencesLoading: boolean
  repetitionAudioUrl: string | null
  isRepetitionLoading: boolean
  onRefreshRepetition: () => void
  beforeAudioUrl: string | null
  isBeforeLoading: boolean
  onGenerateBefore: () => void
  onStartOver: () => void
  hasGuides: boolean
}

function MiniPlayer({ src, label }: { src: string; label?: string }) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  const [time, setTime] = useState(0)
  const [dur, setDur] = useState(0)
  const raf = useRef<number | null>(null)

  const tick = useCallback(() => {
    if (audioRef.current) {
      setTime(audioRef.current.currentTime)
      raf.current = requestAnimationFrame(tick)
    }
  }, [])

  useEffect(() => {
    const a = audioRef.current
    if (!a) return
    const onMeta = () => setDur(a.duration)
    const onEnd = () => { setPlaying(false); a.currentTime = 0; setTime(0); if (raf.current) cancelAnimationFrame(raf.current) }
    const onPlay = () => { setPlaying(true); raf.current = requestAnimationFrame(tick) }
    const onPause = () => { setPlaying(false); if (raf.current) cancelAnimationFrame(raf.current) }
    a.addEventListener('loadedmetadata', onMeta)
    a.addEventListener('ended', onEnd)
    a.addEventListener('play', onPlay)
    a.addEventListener('pause', onPause)
    return () => {
      a.removeEventListener('loadedmetadata', onMeta)
      a.removeEventListener('ended', onEnd)
      a.removeEventListener('play', onPlay)
      a.removeEventListener('pause', onPause)
      if (raf.current) cancelAnimationFrame(raf.current)
    }
  }, [src, tick])

  const toggle = () => {
    const a = audioRef.current
    if (!a) return
    playing ? a.pause() : a.play()
  }

  const pct = dur > 0 ? (time / dur) * 100 : 0
  const fmt = (s: number) => `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}`

  return (
    <div className="flex items-center gap-3">
      <audio ref={audioRef} src={src} preload="metadata" />
      <button
        type="button"
        onClick={toggle}
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-all ${
          playing ? 'bg-el-graphite text-white' : 'bg-el-surface-alt text-el-text hover:bg-el-border-light'
        }`}
      >
        {playing ? <Pause className="h-3.5 w-3.5" fill="currentColor" /> : <Play className="h-3.5 w-3.5 ml-0.5" fill="currentColor" />}
      </button>
      <div className="flex-1 min-w-0 space-y-1">
        {label && <p className="text-xs text-el-text leading-snug">{label}</p>}
        <div className="h-1 w-full rounded-full bg-el-border-light overflow-hidden">
          <div className="h-full bg-el-graphite rounded-full transition-[width] duration-75" style={{ width: `${pct}%` }} />
        </div>
      </div>
      <span className="shrink-0 text-[11px] text-el-text-muted tabular-nums">{fmt(time)} / {fmt(dur)}</span>
    </div>
  )
}

export default function ValidateStep({
  voiceId,
  word,
  cloneType,
  validationSentences,
  isSentencesLoading,
  repetitionAudioUrl,
  isRepetitionLoading,
  onRefreshRepetition,
  beforeAudioUrl,
  isBeforeLoading,
  onGenerateBefore,
  onStartOver,
  hasGuides,
}: ValidateStepProps) {
  const [copied, setCopied] = useState(false)

  const copyId = async () => {
    await navigator.clipboard.writeText(voiceId)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in-up">

      {/* Success banner */}
      <div className="flex items-center gap-3.5 px-5 py-4 rounded-2xl bg-el-accent-light border border-el-accent/20">
        <img src="/icons/checkmark-circle.svg" alt="" className="h-7 w-7" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-el-text">
            {cloneType === 'pvc' ? 'Professional voice clone created' : 'Instant voice clone created'}
          </p>
          <div className="flex items-center gap-2 mt-0.5">
            <code className="text-xs font-mono text-el-text-secondary truncate">{voiceId}</code>
            <button onClick={copyId} className="shrink-0 text-el-accent hover:text-el-accent-hover transition-colors">
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Before / After */}
      <section className="bg-white rounded-2xl border border-el-border overflow-hidden">
        <div className="px-6 py-4 border-b border-el-border-light">
          <h2 className="text-sm font-bold uppercase tracking-wider text-el-text-muted">
            Before &amp; After
          </h2>
          <p className="text-xs text-el-text-muted mt-0.5">
            &ldquo;{word}&rdquo; spoken 10 times, each generated independently
          </p>
          {hasGuides && (
            <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-purple-50 border border-purple-200">
              <span className="text-[10px] font-semibold text-purple-700 uppercase tracking-wider">SSML Guided</span>
              <span className="text-[10px] text-purple-600">Active on After outputs</span>
            </div>
          )}
        </div>

        <div className="divide-y divide-el-border-light">
          <div className="px-6 py-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest rounded-md bg-el-surface-alt text-el-text-muted border border-el-border-light">
                  Before
                </span>
                <span className="text-xs text-el-text-secondary">Original voice</span>
              </div>
              <button
                type="button"
                onClick={onGenerateBefore}
                disabled={isBeforeLoading}
                className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-el-text-muted hover:text-el-text rounded-lg hover:bg-el-surface-alt transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`h-3 w-3 ${isBeforeLoading ? 'animate-spin' : ''}`} />
                {beforeAudioUrl ? 'Regenerate' : 'Generate'}
              </button>
            </div>
            {isBeforeLoading && !beforeAudioUrl && (
              <div className="flex items-center justify-center gap-2 py-6 rounded-xl bg-el-surface-alt">
                <Loader2 className="h-4 w-4 text-el-text-muted animate-spin" />
                <p className="text-xs text-el-text-muted">Generating...</p>
              </div>
            )}
            {beforeAudioUrl && <MiniPlayer src={beforeAudioUrl} />}
          </div>

          <div className="px-6 py-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest rounded-md bg-el-accent-light text-el-accent border border-el-accent/20">
                  After
                </span>
                <span className="text-xs text-el-text-secondary">New voice</span>
              </div>
              <button
                type="button"
                onClick={onRefreshRepetition}
                disabled={isRepetitionLoading}
                className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-el-text-muted hover:text-el-text rounded-lg hover:bg-el-surface-alt transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`h-3 w-3 ${isRepetitionLoading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>
            {isRepetitionLoading && !repetitionAudioUrl && (
              <div className="flex items-center justify-center gap-2 py-6 rounded-xl bg-el-surface-alt">
                <Loader2 className="h-4 w-4 text-el-accent animate-spin" />
                <p className="text-xs text-el-text-muted">Generating...</p>
              </div>
            )}
            {repetitionAudioUrl && <MiniPlayer src={repetitionAudioUrl} />}
          </div>
        </div>
      </section>

      {/* In-context sentences */}
      <section className="bg-white rounded-2xl border border-el-border overflow-hidden">
        <div className="px-6 py-4 border-b border-el-border-light">
          <h2 className="text-sm font-bold uppercase tracking-wider text-el-text-muted">
            In Context
          </h2>
          <p className="text-xs text-el-text-muted mt-0.5">
            &ldquo;{word}&rdquo; in industry-relevant sentences
          </p>
        </div>

        {isSentencesLoading && validationSentences.length === 0 ? (
          <div className="flex items-center justify-center gap-2 py-12">
            <Loader2 className="h-4 w-4 text-el-text-muted animate-spin" />
            <p className="text-xs text-el-text-muted">Generating test sentences...</p>
          </div>
        ) : (
          <div className="divide-y divide-el-border-light">
            {validationSentences.map((item, i) => (
              <div key={i} className="px-6 py-4">
                <MiniPlayer src={item.audioUrl} label={item.sentence} />
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Start over */}
      <button
        type="button"
        onClick={onStartOver}
        className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-el-graphite hover:bg-black text-white font-semibold text-sm rounded-2xl transition-all"
      >
        <RotateCw className="w-4 h-4" />
        Add Another Word
      </button>
    </div>
  )
}
