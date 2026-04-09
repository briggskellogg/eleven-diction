import type { AmplificationConfig, AmplifiedFile, Take, PronunciationGuide } from './types'
import { generateTTS, generateSTS, spliceSentence } from './api'
import { getSpliceTemplates, getCorpusPassages } from './snippets'
import type { Industry } from './snippets'

const SAMPLE_RATE = 44100

// Playback rates for DSP variations — creates pitch/speed variations
// that simulate natural speech variation without API calls
const DSP_RATES = [0.92, 0.95, 0.97, 1.03, 1.05, 1.08]

// STS stability values — each produces a different re-synthesis
const STS_STABILITIES = [0.25, 0.35, 0.45, 0.55, 0.65, 0.75, 0.85, 0.9]

// --- Audio conversion utilities ---

export async function blobToPcmData(blob: Blob): Promise<Int16Array> {
  const audioCtx = new AudioContext({ sampleRate: SAMPLE_RATE })
  try {
    const arrayBuffer = await blob.arrayBuffer()
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer)
    const float32 = audioBuffer.getChannelData(0)
    const int16 = new Int16Array(float32.length)
    for (let i = 0; i < float32.length; i++) {
      const s = Math.max(-1, Math.min(1, float32[i]))
      int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF
    }
    return int16
  } finally {
    await audioCtx.close()
  }
}

export function int16ToBase64(int16: Int16Array): string {
  const bytes = new Uint8Array(int16.buffer)
  const chunks: string[] = []
  const CHUNK = 8192
  for (let i = 0; i < bytes.length; i += CHUNK) {
    chunks.push(String.fromCharCode(...bytes.subarray(i, Math.min(i + CHUNK, bytes.length))))
  }
  return btoa(chunks.join(''))
}

function createWavBuffer(pcm: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(44 + pcm.length)
  const view = new DataView(buffer)
  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i))
  }

  writeStr(0, 'RIFF')
  view.setUint32(4, 36 + pcm.length, true)
  writeStr(8, 'WAVE')
  writeStr(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, SAMPLE_RATE, true)
  view.setUint32(28, SAMPLE_RATE * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  writeStr(36, 'data')
  view.setUint32(40, pcm.length, true)
  new Uint8Array(buffer, 44).set(pcm)
  return buffer
}

// --- DSP Variation via OfflineAudioContext ---

async function createPlaybackVariation(pcm: Int16Array, rate: number): Promise<Int16Array> {
  const outputLength = Math.ceil(pcm.length / rate) + 512
  const offlineCtx = new OfflineAudioContext(1, outputLength, SAMPLE_RATE)
  const inputBuffer = offlineCtx.createBuffer(1, pcm.length, SAMPLE_RATE)
  const channelData = inputBuffer.getChannelData(0)
  for (let i = 0; i < pcm.length; i++) {
    channelData[i] = pcm[i] / 32768.0
  }

  const source = offlineCtx.createBufferSource()
  source.buffer = inputBuffer
  source.playbackRate.value = rate
  source.connect(offlineCtx.destination)
  source.start()

  const rendered = await offlineCtx.startRendering()
  const outputFloat = rendered.getChannelData(0)
  const outputInt16 = new Int16Array(outputFloat.length)
  for (let i = 0; i < outputFloat.length; i++) {
    const s = Math.max(-1, Math.min(1, outputFloat[i]))
    outputInt16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF
  }
  return outputInt16
}

// --- Repetition file builder (uses variation pool) ---

function buildRepetitionFromPool(
  variationPool: Int16Array[],
  reps: number,
  gapMinMs: number,
  gapMaxMs: number,
): Blob {
  const segments: Int16Array[] = []
  for (let i = 0; i < reps; i++) {
    const variation = variationPool[i % variationPool.length]
    segments.push(variation)
    if (i < reps - 1) {
      const gapMs = gapMinMs + Math.random() * (gapMaxMs - gapMinMs)
      const gapSamples = Math.floor((gapMs / 1000) * SAMPLE_RATE)
      segments.push(new Int16Array(gapSamples))
    }
  }

  const totalSamples = segments.reduce((sum, s) => sum + s.length, 0)
  const combined = new Int16Array(totalSamples)
  let offset = 0
  for (const seg of segments) {
    combined.set(seg, offset)
    offset += seg.length
  }

  const pcmBytes = new Uint8Array(combined.buffer)
  return new Blob([createWavBuffer(pcmBytes)], { type: 'audio/wav' })
}

// --- SSML guided sentence builder ---

function buildGuidedSsml(
  sentenceTemplate: string,
  word: string,
  guide: PronunciationGuide
): string | null {
  if (guide.type === 'ipa') {
    const val = guide.value.replace(/^\/|\/$/g, '')
    const phoneme = `<phoneme alphabet="ipa" ph="${val}">${word}</phoneme>`
    return `<speak>${sentenceTemplate.replace(/\{word\}/g, phoneme)}</speak>`
  }
  if (guide.type === 'cmu') {
    const phoneme = `<phoneme alphabet="cmu-arpabet" ph="${guide.value}">${word}</phoneme>`
    return `<speak>${sentenceTemplate.replace(/\{word\}/g, phoneme)}</speak>`
  }
  return null
}

// --- Main amplification orchestrator ---

export interface AmplifyProgress {
  phase: 'variations' | 'sentences' | 'repetition' | 'corpus' | 'done'
  variationsDone: number
  variationsTotal: number
  sentencesDone: number
  sentencesTotal: number
  repetitionDone: number
  repetitionTotal: number
  corpusDone: number
  corpusTotal: number
}

export interface AmplifyResult {
  files: AmplifiedFile[]
  totalDurationEstimate: number
  variationCount: number
}

export async function runAmplification(opts: {
  goldenTakes: Take[]
  word: string
  apiKey: string
  voiceId: string
  industry: Industry
  guides: PronunciationGuide[]
  config: AmplificationConfig
  onProgress: (progress: AmplifyProgress) => void
  cancelRef: { current: boolean }
}): Promise<AmplifyResult> {
  const { goldenTakes, word, apiKey, voiceId, industry, guides, config, onProgress, cancelRef } = opts
  const files: AmplifiedFile[] = []
  let totalDuration = 0

  const ssmlGuides = guides.filter((g) => g.type === 'ipa' || g.type === 'cmu')
  const guidedCount = ssmlGuides.length > 0 ? config.guidedSentences : 0

  const progress: AmplifyProgress = {
    phase: 'variations',
    variationsDone: 0,
    variationsTotal: DSP_RATES.length + config.stsVariations,
    sentencesDone: 0,
    sentencesTotal: config.sentenceSplices + guidedCount,
    repetitionDone: 0,
    repetitionTotal: config.repetitionFiles,
    corpusDone: 0,
    corpusTotal: config.corpusPassages,
  }
  onProgress({ ...progress })

  // ======================================================================
  // PHASE 1: Build variation pool (DSP + STS)
  // ======================================================================

  // Convert golden clips to PCM
  const goldenPcms: Int16Array[] = []
  const goldenBlobs: Blob[] = []
  for (const take of goldenTakes) {
    const sourceBlob = take.trimmedBlob || take.audioBlob
    goldenBlobs.push(sourceBlob)
    const pcm = await blobToPcmData(sourceBlob)
    goldenPcms.push(pcm)
  }

  // Start with originals in the pool
  const variationPool: Int16Array[] = [...goldenPcms]

  // DSP variations via playback rate (instant, no API calls)
  for (const rate of DSP_RATES) {
    if (cancelRef.current) break
    try {
      const primaryPcm = goldenPcms[0]
      const variant = await createPlaybackVariation(primaryPcm, rate)
      variationPool.push(variant)
    } catch (err) {
      console.error(`DSP variation at rate ${rate} failed:`, err)
    }
    progress.variationsDone++
    onProgress({ ...progress })
  }

  // STS re-synthesis — sends golden clip through the voice model
  // to produce natural variations preserving pronunciation
  const stsCount = Math.min(config.stsVariations, STS_STABILITIES.length)
  const stsStabilities = STS_STABILITIES.slice(0, stsCount)
  for (const stability of stsStabilities) {
    if (cancelRef.current) break
    try {
      const goldenBlob = goldenBlobs[0]
      const stsBlob = await generateSTS({
        apiKey,
        voiceId,
        audioBlob: goldenBlob,
        stability,
        similarityBoost: 0.75,
      })
      const stsPcm = await blobToPcmData(stsBlob)
      variationPool.push(stsPcm)
    } catch (err) {
      console.error(`STS variation at stability ${stability} failed:`, err)
    }
    progress.variationsDone++
    onProgress({ ...progress })
  }

  // Shuffle the variation pool for randomness
  for (let i = variationPool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [variationPool[i], variationPool[j]] = [variationPool[j], variationPool[i]]
  }

  // Pre-encode all variations as base64 for splice requests
  const variationBase64s = variationPool.map((pcm) => int16ToBase64(pcm))

  // ======================================================================
  // PHASE 2: Sentence generation (splicing + SSML-guided)
  // ======================================================================
  progress.phase = 'sentences'
  onProgress({ ...progress })

  const splicedWavs: { blob: Blob; name: string }[] = []

  // 2a. Sentence splicing — each splice uses a random variation from the pool
  const templates = getSpliceTemplates(word, config.sentenceSplices)
  const spliceQueue = [...templates]
  let spliceCompleted = 0
  const SPLICE_CONCURRENCY = 4
  const spliceWorkers = Array.from({ length: SPLICE_CONCURRENCY }, async () => {
    while (spliceQueue.length > 0 && !cancelRef.current) {
      const sentence = spliceQueue.shift()
      if (!sentence) break
      try {
        const variationIdx = spliceCompleted % variationBase64s.length
        const result = await spliceSentence({
          apiKey, voiceId, sentence, word,
          goldenPcmBase64: variationBase64s[variationIdx],
        })
        const binary = atob(result.audioBase64)
        const bytes = new Uint8Array(binary.length)
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
        splicedWavs.push({
          blob: new Blob([bytes], { type: 'audio/wav' }),
          name: `splice_${spliceCompleted + 1}.wav`,
        })
      } catch (err) {
        console.error('Splice failed:', err)
      }
      spliceCompleted++
      progress.sentencesDone = spliceCompleted
      onProgress({ ...progress })
    }
  })
  await Promise.all(spliceWorkers)

  // 2b. SSML-guided full sentences — clean audio with no splice artifacts
  if (ssmlGuides.length > 0 && guidedCount > 0) {
    const guidedTemplates = getSpliceTemplates(word, guidedCount)
    const guide = ssmlGuides[0]

    const guidedQueue = [...guidedTemplates]
    let guidedCompleted = 0
    const guidedWorkers = Array.from({ length: 3 }, async () => {
      while (guidedQueue.length > 0 && !cancelRef.current) {
        const template = guidedQueue.shift()
        if (!template) break

        const rawTemplate = template.replace(new RegExp(word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), '{word}')
        const ssml = buildGuidedSsml(rawTemplate, word, guide)
        if (!ssml) { guidedCompleted++; continue }

        try {
          const blob = await generateTTS({
            voiceId, apiKey,
            text: ssml,
            modelId: 'eleven_multilingual_v2',
            voiceSettings: { stability: 0.5, similarity_boost: 0.75 },
          })
          splicedWavs.push({
            blob,
            name: `guided_${guidedCompleted + 1}.mp3`,
          })
        } catch (err) {
          console.error('Guided sentence failed:', err)
        }
        guidedCompleted++
        progress.sentencesDone = spliceCompleted + guidedCompleted
        onProgress({ ...progress })
      }
    })
    await Promise.all(guidedWorkers)
  }

  // Consolidate all sentence audio (spliced WAVs + guided MP3s) into ≥30s files
  const WAV_HEADER_SIZE = 44
  const SILENCE_GAP = new Uint8Array(SAMPLE_RATE * 2) // 0.5s silence
  const MIN_FILE_BYTES = 30 * SAMPLE_RATE * 2 // 30 seconds of 16-bit mono PCM

  const allSentencePcm: Uint8Array[] = []

  for (const s of splicedWavs) {
    try {
      if (s.name.endsWith('.wav')) {
        const buf = await s.blob.arrayBuffer()
        if (buf.byteLength > WAV_HEADER_SIZE) {
          allSentencePcm.push(new Uint8Array(buf, WAV_HEADER_SIZE))
        }
      } else {
        const int16 = await blobToPcmData(s.blob)
        allSentencePcm.push(new Uint8Array(int16.buffer))
      }
    } catch (err) {
      console.error('PCM conversion failed:', err)
    }
  }

  {
    let currentChunks: Uint8Array[] = []
    let currentBytes = 0
    let fileIdx = 1
    for (const chunk of allSentencePcm) {
      currentChunks.push(chunk)
      currentChunks.push(SILENCE_GAP)
      currentBytes += chunk.length + SILENCE_GAP.length
      if (currentBytes >= MIN_FILE_BYTES) {
        const combined = new Uint8Array(currentBytes)
        let off = 0
        for (const c of currentChunks) { combined.set(c, off); off += c.length }
        files.push({
          blob: new Blob([createWavBuffer(combined)], { type: 'audio/wav' }),
          name: `sentences_${fileIdx}.wav`,
          category: 'splice',
        })
        totalDuration += currentBytes / (SAMPLE_RATE * 2)
        fileIdx++
        currentChunks = []
        currentBytes = 0
      }
    }
    if (currentChunks.length > 0) {
      const combined = new Uint8Array(currentBytes)
      let off = 0
      for (const c of currentChunks) { combined.set(c, off); off += c.length }
      if (fileIdx > 1 && files.length > 0) {
        // Append remainder to the last file to keep it above 30s
        const lastFile = files[files.length - 1]
        const lastBuf = await lastFile.blob.arrayBuffer()
        const lastPcm = new Uint8Array(lastBuf, WAV_HEADER_SIZE)
        const merged = new Uint8Array(lastPcm.length + combined.length)
        merged.set(lastPcm, 0)
        merged.set(combined, lastPcm.length)
        files[files.length - 1] = {
          ...lastFile,
          blob: new Blob([createWavBuffer(merged)], { type: 'audio/wav' }),
        }
        totalDuration += currentBytes / (SAMPLE_RATE * 2)
      } else {
        files.push({
          blob: new Blob([createWavBuffer(combined)], { type: 'audio/wav' }),
          name: `sentences_${fileIdx}.wav`,
          category: 'splice',
        })
        totalDuration += currentBytes / (SAMPLE_RATE * 2)
      }
    }
  }

  // ======================================================================
  // PHASE 3: Repetition files — cycle through all variations
  // ======================================================================
  progress.phase = 'repetition'
  onProgress({ ...progress })

  for (let i = 0; i < config.repetitionFiles && !cancelRef.current; i++) {
    // Shuffle the pool differently for each repetition file
    const shuffled = [...variationPool].sort(() => Math.random() - 0.5)
    const gapMin = 200 + (i * 50)
    const gapMax = 600 + (i * 80)
    const blob = buildRepetitionFromPool(shuffled, config.repsPerFile, gapMin, gapMax)

    const avgDuration = variationPool.reduce((sum, v) => sum + v.length, 0) / variationPool.length / SAMPLE_RATE
    totalDuration += avgDuration * config.repsPerFile + (config.repsPerFile * ((gapMin + gapMax) / 2) / 1000)

    files.push({ blob, name: `word_repetition_${i + 1}.wav`, category: 'repetition' })
    progress.repetitionDone = i + 1
    onProgress({ ...progress })
  }

  // ======================================================================
  // PHASE 4: Corpus passages — general speech for voice character
  // Consolidate into ≥30s files
  // ======================================================================
  progress.phase = 'corpus'
  onProgress({ ...progress })

  const passages = getCorpusPassages(industry, config.corpusPassages)
  const corpusPcmChunks: Uint8Array[] = []
  for (let i = 0; i < passages.length && !cancelRef.current; i++) {
    try {
      const blob = await generateTTS({
        voiceId, apiKey, text: passages[i],
        modelId: 'eleven_multilingual_v2',
        voiceSettings: { stability: 0.5, similarity_boost: 0.75 },
      })
      const int16 = await blobToPcmData(blob)
      corpusPcmChunks.push(new Uint8Array(int16.buffer))
    } catch (err) {
      console.error('Corpus TTS failed:', err)
    }
    progress.corpusDone = i + 1
    onProgress({ ...progress })
  }

  {
    let currentChunks: Uint8Array[] = []
    let currentBytes = 0
    let fileIdx = 1
    for (const chunk of corpusPcmChunks) {
      currentChunks.push(chunk)
      currentChunks.push(SILENCE_GAP)
      currentBytes += chunk.length + SILENCE_GAP.length
      if (currentBytes >= MIN_FILE_BYTES) {
        const combined = new Uint8Array(currentBytes)
        let off = 0
        for (const c of currentChunks) { combined.set(c, off); off += c.length }
        files.push({
          blob: new Blob([createWavBuffer(combined)], { type: 'audio/wav' }),
          name: `corpus_${fileIdx}.wav`,
          category: 'corpus',
        })
        totalDuration += currentBytes / (SAMPLE_RATE * 2)
        fileIdx++
        currentChunks = []
        currentBytes = 0
      }
    }
    if (currentChunks.length > 0) {
      const combined = new Uint8Array(currentBytes)
      let off = 0
      for (const c of currentChunks) { combined.set(c, off); off += c.length }
      if (fileIdx > 1 && files.length > 0) {
        const lastCorpusIdx = files.length - 1
        const lastFile = files[lastCorpusIdx]
        const lastBuf = await lastFile.blob.arrayBuffer()
        const lastPcm = new Uint8Array(lastBuf, WAV_HEADER_SIZE)
        const merged = new Uint8Array(lastPcm.length + combined.length)
        merged.set(lastPcm, 0)
        merged.set(combined, lastPcm.length)
        files[lastCorpusIdx] = {
          ...lastFile,
          blob: new Blob([createWavBuffer(merged)], { type: 'audio/wav' }),
        }
        totalDuration += currentBytes / (SAMPLE_RATE * 2)
      } else {
        files.push({
          blob: new Blob([createWavBuffer(combined)], { type: 'audio/wav' }),
          name: `corpus_${fileIdx}.wav`,
          category: 'corpus',
        })
        totalDuration += currentBytes / (SAMPLE_RATE * 2)
      }
    }
  }

  progress.phase = 'done'
  onProgress({ ...progress })

  return { files, totalDurationEstimate: totalDuration, variationCount: variationPool.length }
}
