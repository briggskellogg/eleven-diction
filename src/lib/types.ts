export type PronunciationGuideType = 'ipa' | 'cmu' | 'alias'

export interface PronunciationGuide {
  id: string
  type: PronunciationGuideType
  value: string
}

export type TargetCount = number

export interface VoiceSettings {
  stability: number
  similarity_boost: number
}

export type SettingsVariant = 'default' | 'low_stability' | 'high_stability'

export const SETTINGS_VARIANTS: Record<SettingsVariant, VoiceSettings> = {
  default: { stability: 0.5, similarity_boost: 0.75 },
  low_stability: { stability: 0.3, similarity_boost: 0.75 },
  high_stability: { stability: 0.75, similarity_boost: 0.85 },
}

export const SETTINGS_VARIANT_LABELS: Record<SettingsVariant, string> = {
  default: 'Default',
  low_stability: 'Low Stability',
  high_stability: 'High Stability',
}

export type ModelId =
  | 'eleven_multilingual_v2'
  | 'eleven_flash_v2_5'
  | 'eleven_turbo_v2_5'

export const MODELS: ModelId[] = [
  'eleven_multilingual_v2',
  'eleven_flash_v2_5',
  'eleven_turbo_v2_5',
]

export const MODEL_LABELS: Record<ModelId, string> = {
  eleven_multilingual_v2: 'Multilingual v2',
  eleven_flash_v2_5: 'Flash v2.5',
  eleven_turbo_v2_5: 'Turbo v2.5',
}

export type FramingType =
  | 'isolated'
  | 'primer'
  | 'instructional'
  | 'ipa'
  | 'cmu'
  | 'alias'

export interface Take {
  id: string
  audioBlob: Blob
  audioUrl: string
  trimmedBlob: Blob | null
  framing: FramingType
  framingLabel: string
  model: ModelId
  settings: SettingsVariant
  selected: boolean
  dismissed: boolean
}

export interface WordSession {
  word: string
  guides: PronunciationGuide[]
  takes: Take[]
  selectedTakeIds: Set<string>
}

export interface AppConfig {
  apiKey: string
  voiceId: string
  voiceName: string
}

export type CloneType = 'ivc' | 'pvc'

export type AppStep = 'setup' | 'curate' | 'review'

export interface AmplificationConfig {
  sentenceSplices: number
  repetitionFiles: number
  repsPerFile: number
  corpusPassages: number
  stsVariations: number
  guidedSentences: number
}

// ~30 min total: ~10 min repetition, ~10 min sentences, ~10 min corpus
export const AMPLIFICATION_CONFIG: AmplificationConfig = {
  sentenceSplices: 65,
  guidedSentences: 15,
  repetitionFiles: 5,
  repsPerFile: 130,
  corpusPassages: 35,
  stsVariations: 5,
}

export const CLONE_TYPE_CONFIG: Record<CloneType, {
  label: string
  description: string
  minGoldenClips: number
}> = {
  ivc: {
    label: 'Instant Voice Clone',
    description: 'Fast cloning from selected pronunciations. Voice is usable immediately.',
    minGoldenClips: 1,
  },
  pvc: {
    label: 'Professional Voice Clone',
    description: 'Higher quality clone with a larger training corpus for better fidelity.',
    minGoldenClips: 1,
  },
}

export interface AmplifiedFile {
  blob: Blob
  name: string
  category: 'repetition' | 'splice' | 'corpus'
}

export interface CorpusClip {
  id: string
  passage: string
  audioBlob: Blob
  audioUrl: string
}
