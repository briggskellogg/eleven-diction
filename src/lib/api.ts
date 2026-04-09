import type {
  ModelId,
  SettingsVariant,
  SETTINGS_VARIANTS,
  PronunciationGuide,
  FramingType,
} from './types'

interface TTSRequest {
  voiceId: string
  apiKey: string
  text: string
  modelId: ModelId
  voiceSettings: { stability: number; similarity_boost: number }
}

export async function generateTTS(req: TTSRequest): Promise<Blob> {
  const response = await fetch(`/api/tts/${req.voiceId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': req.apiKey,
    },
    body: JSON.stringify({
      text: req.text,
      model_id: req.modelId,
      voice_settings: req.voiceSettings,
      output_format: 'mp3_44100_128',
    }),
  })

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'TTS generation failed' }))
    throw new Error(err.error || `TTS failed with status ${response.status}`)
  }

  return response.blob()
}

function base64ToBlob(base64: string, mime: string): Blob {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new Blob([bytes], { type: mime })
}

export interface TrimmedTTSResult {
  fullBlob: Blob
  trimmedBlob: Blob | null
}

export async function generateTTSTrimmed(
  req: TTSRequest & { word: string }
): Promise<TrimmedTTSResult> {
  const response = await fetch(`/api/tts-trimmed/${req.voiceId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': req.apiKey,
    },
    body: JSON.stringify({
      text: req.text,
      model_id: req.modelId,
      voice_settings: req.voiceSettings,
      word: req.word,
    }),
  })

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'TTS generation failed' }))
    throw new Error(err.error || `TTS failed with status ${response.status}`)
  }

  const data = await response.json() as {
    full_audio_base64: string
    trimmed_audio_base64: string | null
  }

  return {
    fullBlob: base64ToBlob(data.full_audio_base64, 'audio/wav'),
    trimmedBlob: data.trimmed_audio_base64
      ? base64ToBlob(data.trimmed_audio_base64, 'audio/wav')
      : null,
  }
}

export async function generateSTS(req: {
  apiKey: string
  voiceId: string
  audioBlob: Blob
  stability: number
  similarityBoost: number
}): Promise<Blob> {
  const formData = new FormData()
  formData.append('audio', req.audioBlob, 'golden.wav')
  formData.append('stability', String(req.stability))
  formData.append('similarity_boost', String(req.similarityBoost))

  const response = await fetch(`/api/sts/${req.voiceId}`, {
    method: 'POST',
    headers: { 'x-api-key': req.apiKey },
    body: formData,
  })

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'STS failed' }))
    throw new Error(err.error || `STS failed with status ${response.status}`)
  }

  return response.blob()
}

export async function spliceSentence(req: {
  apiKey: string
  voiceId: string
  sentence: string
  word: string
  goldenPcmBase64: string
  modelId?: ModelId
}): Promise<{ audioBase64: string; spliced: boolean }> {
  const response = await fetch('/api/splice', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': req.apiKey,
    },
    body: JSON.stringify({
      golden_pcm_base64: req.goldenPcmBase64,
      sentence: req.sentence,
      voice_id: req.voiceId,
      word: req.word,
      model_id: req.modelId || 'eleven_flash_v2_5',
    }),
  })

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Splice failed' }))
    throw new Error(err.error || `Splice failed with status ${response.status}`)
  }

  const data = await response.json() as { audio_base64: string; spliced: boolean }
  return { audioBase64: data.audio_base64, spliced: data.spliced }
}

export function buildFramings(
  word: string,
  guides: PronunciationGuide[],
  model: ModelId
): { type: FramingType; label: string; text: string }[] {
  const framings: { type: FramingType; label: string; text: string }[] = [
    { type: 'isolated', label: 'Isolated', text: word },
    { type: 'primer', label: 'Primer', text: `The word is ${word}.` },
    {
      type: 'instructional',
      label: 'Instructional',
      text: `Please say ${word} clearly.`,
    },
  ]

  for (const guide of guides) {
    switch (guide.type) {
      case 'ipa': {
        const isV2 = model.includes('v2')
        if (isV2) {
          framings.push({
            type: 'ipa',
            label: `IPA (SSML)`,
            text: `<speak><phoneme alphabet="ipa" ph="${guide.value}">${word}</phoneme></speak>`,
          })
        } else {
          framings.push({
            type: 'ipa',
            label: `IPA (inline)`,
            text: `${word} (${guide.value})`,
          })
        }
        break
      }
      case 'cmu': {
        const isV2 = model.includes('v2')
        if (isV2) {
          framings.push({
            type: 'cmu',
            label: `CMU Arpabet`,
            text: `<speak><phoneme alphabet="cmu-arpabet" ph="${guide.value}">${word}</phoneme></speak>`,
          })
        }
        break
      }
      case 'alias':
        framings.push({
          type: 'alias',
          label: `Alias`,
          text: guide.value,
        })
        break
    }
  }

  return framings
}

export interface GenerationJob {
  framing: { type: FramingType; label: string; text: string }
  model: ModelId
  settings: SettingsVariant
  voiceSettings: { stability: number; similarity_boost: number }
}

export function buildJobMatrix(
  word: string,
  guides: PronunciationGuide[],
  settingsVariants: typeof SETTINGS_VARIANTS
): GenerationJob[] {
  const models: ModelId[] = [
    'eleven_multilingual_v2',
    'eleven_flash_v2_5',
    'eleven_turbo_v2_5',
  ]
  const settingsKeys = Object.keys(settingsVariants) as SettingsVariant[]

  const jobs: GenerationJob[] = []

  for (const model of models) {
    const framings = buildFramings(word, guides, model)
    for (const framing of framings) {
      for (const settingsKey of settingsKeys) {
        jobs.push({
          framing,
          model,
          settings: settingsKey,
          voiceSettings: settingsVariants[settingsKey],
        })
      }
    }
  }

  return jobs
}

export async function createVoice(
  apiKey: string,
  name: string,
  description: string,
  audioFiles: { blob: Blob; name: string }[]
): Promise<{ voice_id: string }> {
  const formData = new FormData()
  formData.append('name', name)
  formData.append('description', description)

  for (const file of audioFiles) {
    formData.append('files', file.blob, file.name)
  }

  const response = await fetch('/api/voices/add', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
    },
    body: formData,
  })

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Voice creation failed' }))
    throw new Error(err.error || `Voice creation failed with status ${response.status}`)
  }

  return response.json()
}

export async function getVoiceName(
  apiKey: string,
  voiceId: string
): Promise<string> {
  const response = await fetch(`/api/voices/${voiceId}`, {
    headers: { 'x-api-key': apiKey },
  })

  if (!response.ok) {
    return 'Unknown Voice'
  }

  const data = await response.json()
  return data.name || 'Unknown Voice'
}
