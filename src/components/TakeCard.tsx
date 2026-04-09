import { useRef, useState, useCallback, memo } from 'react'
import { Play, Pause, Check, X } from 'lucide-react'
import type { Take } from '../lib/types'
import { MODEL_LABELS, SETTINGS_VARIANT_LABELS } from '../lib/types'

export interface TakeCardProps {
  take: Take
  onToggleSelect: (id: string) => void
  onDismiss: (id: string) => void
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

const TakeCard = memo(function TakeCard({ take, onToggleSelect, onDismiss }: TakeCardProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const rafRef = useRef<number>(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0

  const ensureAudio = useCallback(() => {
    if (audioRef.current) return audioRef.current
    const audio = new Audio(take.audioUrl)
    audio.preload = 'metadata'
    audioRef.current = audio

    audio.addEventListener('loadedmetadata', () => setDuration(audio.duration))
    audio.addEventListener('ended', () => {
      setIsPlaying(false)
      setCurrentTime(0)
      cancelAnimationFrame(rafRef.current)
    })
    audio.addEventListener('pause', () => {
      setIsPlaying(false)
      cancelAnimationFrame(rafRef.current)
    })

    return audio
  }, [take.audioUrl])

  const tick = useCallback(() => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime)
      rafRef.current = requestAnimationFrame(tick)
    }
  }, [])

  const toggle = useCallback(() => {
    const audio = ensureAudio()
    if (isPlaying) {
      audio.pause()
    } else {
      audio.play()
      setIsPlaying(true)
      rafRef.current = requestAnimationFrame(tick)
    }
  }, [isPlaying, ensureAudio, tick])

  const handleSelect = useCallback(() => onToggleSelect(take.id), [onToggleSelect, take.id])
  const handleDismiss = useCallback(() => onDismiss(take.id), [onDismiss, take.id])

  return (
    <div
      className={`group relative rounded-2xl border transition-all ${
        take.selected
          ? 'border-el-accent bg-el-accent-light shadow-sm'
          : 'border-el-border bg-white hover:border-el-border hover:shadow-sm'
      }`}
    >
      <div className="p-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={toggle}
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-all ${
              isPlaying
                ? 'bg-el-graphite text-white'
                : 'bg-el-surface-alt text-el-text hover:bg-el-border-light'
            }`}
          >
            {isPlaying ? (
              <Pause className="h-4 w-4" fill="currentColor" />
            ) : (
              <Play className="h-4 w-4 ml-0.5" fill="currentColor" />
            )}
          </button>

          <div className="flex-1 min-w-0">
            <div className="h-1.5 w-full rounded-full bg-el-border-light overflow-hidden">
              <div
                className="h-full bg-el-graphite rounded-full transition-[width] duration-75"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          <span className="shrink-0 text-xs text-el-text-muted tabular-nums">
            {formatTime(currentTime)}
          </span>
        </div>

        <div className="mt-3 flex flex-wrap gap-1">
          <span className="px-2 py-0.5 text-[11px] font-medium rounded-md bg-el-surface-alt text-el-text-secondary">
            {take.framingLabel}
          </span>
          <span className="px-2 py-0.5 text-[11px] font-medium rounded-md bg-el-surface-alt text-el-text-secondary">
            {MODEL_LABELS[take.model]}
          </span>
          <span className="px-2 py-0.5 text-[11px] font-medium rounded-md bg-el-surface-alt text-el-text-secondary">
            {SETTINGS_VARIANT_LABELS[take.settings]}
          </span>
        </div>
      </div>

      <div className="flex border-t border-el-border-light">
        <button
          type="button"
          onClick={handleSelect}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium rounded-bl-2xl transition-colors ${
            take.selected
              ? 'text-el-accent bg-el-accent-light hover:bg-el-accent/10'
              : 'text-el-text-muted hover:text-el-accent hover:bg-el-accent-light'
          }`}
        >
          <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
          {take.selected ? 'Selected' : 'Correct'}
        </button>
        <div className="w-px bg-el-border-light" />
        <button
          type="button"
          onClick={handleDismiss}
          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium text-el-text-muted hover:text-el-danger hover:bg-el-danger-light rounded-br-2xl transition-colors"
        >
          <X className="h-3.5 w-3.5" strokeWidth={2.5} />
          Dismiss
        </button>
      </div>
    </div>
  )
})

export default TakeCard
