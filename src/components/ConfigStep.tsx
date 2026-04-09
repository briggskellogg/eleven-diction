import { useState } from 'react'
import { Plus, X, ArrowRight, Zap, Sparkles } from 'lucide-react'
import type {
  PronunciationGuide,
  PronunciationGuideType,
  CloneType,
} from '../lib/types'
import { CLONE_TYPE_CONFIG } from '../lib/types'
import { INDUSTRIES, type Industry } from '../lib/snippets'

const GUIDE_PLACEHOLDERS: Record<PronunciationGuideType, string> = {
  ipa: '/sɛməˈɡluːtaɪd/',
  cmu: 'S EH0 M AH0 G L UW1 T AY2 D',
  alias: 'Sem-ah-GLOO-tide',
}

const GUIDE_LABELS: Record<PronunciationGuideType, string> = {
  ipa: 'IPA',
  cmu: 'CMU',
  alias: 'Alias',
}

export interface SetupConfig {
  apiKey: string
  voiceId: string
  word: string
  guides: PronunciationGuide[]
  industry: Industry
  cloneType: CloneType
}

export interface ConfigStepProps {
  onSubmit: (config: SetupConfig) => void
  initialApiKey?: string
  initialVoiceId?: string
}

function uid() {
  return crypto.randomUUID?.() ?? `g-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export default function ConfigStep({ onSubmit, initialApiKey, initialVoiceId }: ConfigStepProps) {
  const [apiKey, setApiKey] = useState(initialApiKey || '')
  const [voiceId, setVoiceId] = useState(initialVoiceId || '')
  const [word, setWord] = useState('')
  const [guides, setGuides] = useState<PronunciationGuide[]>([])
  const [cloneType, setCloneType] = useState<CloneType>('ivc')
  const [industry, setIndustry] = useState<Industry>('general')

  const isValid = apiKey.trim() && voiceId.trim() && word.trim()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!isValid) return
    onSubmit({
      apiKey: apiKey.trim(),
      voiceId: voiceId.trim(),
      word: word.trim(),
      guides: guides.filter((g) => g.value.trim()),
      industry,
      cloneType,
    })
  }

  return (
    <div className="max-w-2xl mx-auto animate-fade-in-up">
      <form onSubmit={handleSubmit} className="space-y-6">

        {/* Clone type selector */}
        <section className="bg-white rounded-2xl border border-el-border p-6 space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-el-text-muted">
            Clone Type
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {(['ivc', 'pvc'] as const).map((type) => {
              const config = CLONE_TYPE_CONFIG[type]
              const active = cloneType === type
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => setCloneType(type)}
                  className={`relative flex items-start gap-3.5 p-4 rounded-2xl border-2 transition-all text-left ${
                    active
                      ? 'border-el-graphite bg-el-surface-alt shadow-sm'
                      : 'border-el-border-light bg-white hover:border-el-border hover:bg-el-surface-alt'
                  }`}
                >
                  <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors ${
                    active ? 'bg-el-graphite text-white' : 'bg-el-surface-alt text-el-text-muted'
                  }`}>
                    {type === 'ivc'
                      ? <Zap className="h-4 w-4" />
                      : <Sparkles className="h-4 w-4" />
                    }
                  </div>
                  <div className="min-w-0">
                    <span className={`text-sm font-semibold block ${active ? 'text-el-text' : 'text-el-text-secondary'}`}>
                      {config.label}
                    </span>
                    <span className="text-[11px] text-el-text-muted leading-snug block mt-0.5">
                      {config.description}
                    </span>
                  </div>
                  {active && (
                    <div className="absolute top-3 right-3 h-2 w-2 rounded-full bg-el-accent" />
                  )}
                </button>
              )
            })}
          </div>
        </section>

        {/* Connection */}
        <section className="bg-white rounded-2xl border border-el-border p-6 space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-el-text-muted">
            Connection
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="apiKey" className="block text-xs font-medium text-el-text mb-1.5">
                API Key
              </label>
              <input
                id="apiKey"
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk_..."
                className="w-full px-3.5 py-2.5 bg-el-surface-alt border border-el-border rounded-xl text-el-text placeholder-el-text-muted text-sm focus:outline-none focus:ring-2 focus:ring-el-accent/30 focus:border-el-accent transition-all"
                autoComplete="off"
              />
            </div>
            <div>
              <label htmlFor="voiceId" className="block text-xs font-medium text-el-text mb-1.5">
                Source Voice ID
              </label>
              <input
                id="voiceId"
                type="text"
                value={voiceId}
                onChange={(e) => setVoiceId(e.target.value)}
                placeholder="e.g. 21m00Tcm4TlvDq8ikWAM"
                className="w-full px-3.5 py-2.5 bg-el-surface-alt border border-el-border rounded-xl text-el-text placeholder-el-text-muted text-sm focus:outline-none focus:ring-2 focus:ring-el-accent/30 focus:border-el-accent transition-all"
              />
            </div>
          </div>
        </section>

        {/* Word + Guides */}
        <section className="bg-white rounded-2xl border border-el-border p-6 space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-el-text-muted">
            Pronunciation
          </h2>

          <div>
            <label htmlFor="word" className="block text-xs font-medium text-el-text mb-1.5">
              Target Word
            </label>
            <input
              id="word"
              type="text"
              value={word}
              onChange={(e) => setWord(e.target.value)}
              placeholder="e.g. Semaglutide"
              className="w-full px-3.5 py-2.5 bg-el-surface-alt border border-el-border rounded-xl text-el-text placeholder-el-text-muted text-sm focus:outline-none focus:ring-2 focus:ring-el-accent/30 focus:border-el-accent transition-all"
            />
          </div>

          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-el-text">Guides</label>
              <button
                type="button"
                onClick={() => setGuides((p) => [...p, { id: uid(), type: 'ipa', value: '' }])}
                className="flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-el-accent hover:bg-el-accent-light rounded-lg transition-colors"
              >
                <Plus className="w-3 h-3" />
                Add
              </button>
            </div>

            {guides.length === 0 && (
              <p className="text-[11px] text-el-text-muted py-2 px-3 rounded-lg bg-el-surface-alt border border-dashed border-el-border">
                Optional — add IPA, CMU, or alias guides for targeted pronunciation
              </p>
            )}

            {guides.map((guide) => (
              <div key={guide.id} className="flex gap-2 items-center">
                <select
                  value={guide.type}
                  onChange={(e) =>
                    setGuides((p) =>
                      p.map((g) =>
                        g.id === guide.id
                          ? { ...g, type: e.target.value as PronunciationGuideType }
                          : g
                      )
                    )
                  }
                  className="shrink-0 w-20 px-2.5 py-2 bg-el-surface-alt border border-el-border rounded-xl text-el-text text-xs font-medium focus:outline-none focus:ring-2 focus:ring-el-accent/30"
                >
                  {(['ipa', 'cmu', 'alias'] as const).map((t) => (
                    <option key={t} value={t}>{GUIDE_LABELS[t]}</option>
                  ))}
                </select>
                <input
                  type="text"
                  value={guide.value}
                  onChange={(e) =>
                    setGuides((p) =>
                      p.map((g) =>
                        g.id === guide.id ? { ...g, value: e.target.value } : g
                      )
                    )
                  }
                  placeholder={GUIDE_PLACEHOLDERS[guide.type]}
                  className="flex-1 min-w-0 px-3 py-2 bg-el-surface-alt border border-el-border rounded-xl text-el-text placeholder-el-text-muted text-xs focus:outline-none focus:ring-2 focus:ring-el-accent/30"
                />
                <button
                  type="button"
                  onClick={() => setGuides((p) => p.filter((g) => g.id !== guide.id))}
                  className="p-1.5 text-el-text-muted hover:text-el-danger rounded-lg transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* Corpus industry */}
        <section className="bg-white rounded-2xl border border-el-border p-6 space-y-3">
          <h2 className="text-sm font-bold uppercase tracking-wider text-el-text-muted">
            Corpus Industry
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {INDUSTRIES.map((ind) => (
              <button
                key={ind.id}
                type="button"
                onClick={() => setIndustry(ind.id)}
                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border transition-all ${
                  industry === ind.id
                    ? 'border-el-graphite bg-el-surface-alt'
                    : 'border-el-border-light bg-white hover:bg-el-surface-alt hover:border-el-border'
                }`}
              >
                <img src={`/icons/${ind.icon}.svg`} alt="" className="h-7 w-7 rounded-lg" />
                <span className={`text-xs font-medium ${
                  industry === ind.id ? 'text-el-text' : 'text-el-text-secondary'
                }`}>
                  {ind.label}
                </span>
              </button>
            ))}
          </div>
        </section>

        {/* Submit */}
        <button
          type="submit"
          disabled={!isValid}
          className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-el-graphite hover:bg-black text-white font-semibold text-sm rounded-2xl transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Start Generating Takes
          <ArrowRight className="w-4 h-4" />
        </button>
      </form>
    </div>
  )
}
