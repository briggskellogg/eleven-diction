import express from 'express'
import cors from 'cors'
import multer from 'multer'

const app = express()
const upload = multer({ storage: multer.memoryStorage() })

app.use(cors())
app.use(express.json({ limit: '50mb' }))

const ELEVENLABS_BASE = 'https://api.elevenlabs.io/v1'

function getApiKey(req: express.Request): string {
  const key = req.headers['x-api-key'] as string
  if (!key) throw new Error('Missing API key')
  return key
}

function writeWavHeader(pcmData: Buffer, sampleRate: number, channels: number, bitsPerSample: number): Buffer {
  const byteRate = sampleRate * channels * (bitsPerSample / 8)
  const blockAlign = channels * (bitsPerSample / 8)
  const header = Buffer.alloc(44)

  header.write('RIFF', 0)
  header.writeUInt32LE(36 + pcmData.length, 4)
  header.write('WAVE', 8)
  header.write('fmt ', 12)
  header.writeUInt32LE(16, 16)
  header.writeUInt16LE(1, 20)
  header.writeUInt16LE(channels, 22)
  header.writeUInt32LE(sampleRate, 24)
  header.writeUInt32LE(byteRate, 28)
  header.writeUInt16LE(blockAlign, 32)
  header.writeUInt16LE(bitsPerSample, 34)
  header.write('data', 36)
  header.writeUInt32LE(pcmData.length, 40)

  return Buffer.concat([header, pcmData])
}

function trimPcm(
  pcmBuffer: Buffer,
  startSeconds: number,
  endSeconds: number,
  sampleRate: number,
  bytesPerSample: number
): Buffer {
  const bytesPerSecond = sampleRate * bytesPerSample
  const startByte = Math.max(0, Math.floor(startSeconds * bytesPerSecond))
  const endByte = Math.min(pcmBuffer.length, Math.ceil(endSeconds * bytesPerSecond))

  const aligned = (byte: number) => byte - (byte % bytesPerSample)
  return pcmBuffer.subarray(aligned(startByte), aligned(endByte))
}

function applyFade(pcm: Buffer, fadeInSamples: number, fadeOutSamples: number, bytesPerSample: number): void {
  for (let i = 0; i < fadeInSamples; i++) {
    const offset = i * bytesPerSample
    if (offset + 1 >= pcm.length) break
    const sample = pcm.readInt16LE(offset)
    pcm.writeInt16LE(Math.round(sample * (i / fadeInSamples)), offset)
  }
  for (let i = 0; i < fadeOutSamples; i++) {
    const offset = pcm.length - (i + 1) * bytesPerSample
    if (offset < 0) break
    const sample = pcm.readInt16LE(offset)
    pcm.writeInt16LE(Math.round(sample * (i / fadeOutSamples)), offset)
  }
}

function computeRms(pcm: Buffer, bytesPerSample: number): number {
  let sum = 0
  const count = Math.floor(pcm.length / bytesPerSample)
  if (count === 0) return 0
  for (let i = 0; i < pcm.length - 1; i += bytesPerSample) {
    const s = pcm.readInt16LE(i)
    sum += s * s
  }
  return Math.sqrt(sum / count)
}

function scaleAmplitude(pcm: Buffer, factor: number, bytesPerSample: number): Buffer {
  const result = Buffer.from(pcm)
  for (let i = 0; i < result.length - 1; i += bytesPerSample) {
    const s = result.readInt16LE(i)
    result.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(s * factor))), i)
  }
  return result
}

// Standard TTS — returns raw audio
app.post('/api/tts/:voiceId', async (req, res) => {
  try {
    const apiKey = getApiKey(req)
    const { voiceId } = req.params
    const { text, model_id, voice_settings, output_format } = req.body

    const format = output_format || 'mp3_44100_128'
    const response = await fetch(
      `${ELEVENLABS_BASE}/text-to-speech/${voiceId}?output_format=${format}`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text, model_id, voice_settings }),
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      res.status(response.status).json({ error: errorText })
      return
    }

    const arrayBuffer = await response.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    res.set({ 'Content-Type': 'audio/mpeg', 'Content-Length': buffer.length.toString() })
    res.send(buffer)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    res.status(500).json({ error: message })
  }
})

// TTS with timestamps + word trimming — returns JSON with full audio + trimmed word audio
app.post('/api/tts-trimmed/:voiceId', async (req, res) => {
  try {
    const apiKey = getApiKey(req)
    const { voiceId } = req.params
    const { text, model_id, voice_settings, word } = req.body

    const SAMPLE_RATE = 44100
    const BYTES_PER_SAMPLE = 2 // 16-bit PCM

    const response = await fetch(
      `${ELEVENLABS_BASE}/text-to-speech/${voiceId}/with-timestamps?output_format=pcm_${SAMPLE_RATE}`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text, model_id, voice_settings }),
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      res.status(response.status).json({ error: errorText })
      return
    }

    const data = await response.json() as {
      audio_base64: string
      alignment?: {
        characters: string[]
        character_start_times_seconds: number[]
        character_end_times_seconds: number[]
      }
    }

    const pcmBuffer = Buffer.from(data.audio_base64, 'base64')
    const fullWav = writeWavHeader(pcmBuffer, SAMPLE_RATE, 1, BYTES_PER_SAMPLE * 8)

    let trimmedWavBase64: string | null = null

    if (data.alignment && word) {
      const { characters, character_start_times_seconds, character_end_times_seconds } = data.alignment
      const fullText = characters.join('')
      const wordLower = word.toLowerCase()
      const textLower = fullText.toLowerCase()
      const wordIndex = textLower.indexOf(wordLower)

      if (wordIndex !== -1) {
        const wordEnd = wordIndex + word.length
        const startTime = character_start_times_seconds[wordIndex]
        const endTime = character_end_times_seconds[Math.min(wordEnd - 1, characters.length - 1)]

        const padding = 0.05
        const trimmedPcm = trimPcm(
          pcmBuffer,
          Math.max(0, startTime - padding),
          endTime + padding,
          SAMPLE_RATE,
          BYTES_PER_SAMPLE
        )
        const trimmedWav = writeWavHeader(trimmedPcm, SAMPLE_RATE, 1, BYTES_PER_SAMPLE * 8)
        trimmedWavBase64 = trimmedWav.toString('base64')
      }
    }

    res.json({
      full_audio_base64: fullWav.toString('base64'),
      trimmed_audio_base64: trimmedWavBase64,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    res.status(500).json({ error: message })
  }
})

// Splice a golden pronunciation clip into a TTS-generated sentence
app.post('/api/splice', async (req, res) => {
  try {
    const apiKey = getApiKey(req)
    const { golden_pcm_base64, sentence, voice_id, word, model_id } = req.body

    const SAMPLE_RATE = 44100
    const BYTES_PER_SAMPLE = 2

    const response = await fetch(
      `${ELEVENLABS_BASE}/text-to-speech/${voice_id}/with-timestamps?output_format=pcm_${SAMPLE_RATE}`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: sentence,
          model_id: model_id || 'eleven_multilingual_v2',
          voice_settings: { stability: 0.5, similarity_boost: 0.75 },
        }),
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      res.status(response.status).json({ error: errorText })
      return
    }

    const data = await response.json() as {
      audio_base64: string
      alignment?: {
        characters: string[]
        character_start_times_seconds: number[]
        character_end_times_seconds: number[]
      }
    }

    const sentencePcm = Buffer.from(data.audio_base64, 'base64')
    const goldenPcm = Buffer.from(golden_pcm_base64, 'base64')

    if (!data.alignment || !word) {
      const wav = writeWavHeader(sentencePcm, SAMPLE_RATE, 1, BYTES_PER_SAMPLE * 8)
      res.json({ audio_base64: wav.toString('base64'), spliced: false })
      return
    }

    const { characters, character_start_times_seconds, character_end_times_seconds } = data.alignment
    const fullText = characters.join('')
    const wordLower = word.toLowerCase()
    const textLower = fullText.toLowerCase()
    const wordIndex = textLower.indexOf(wordLower)

    if (wordIndex === -1) {
      const wav = writeWavHeader(sentencePcm, SAMPLE_RATE, 1, BYTES_PER_SAMPLE * 8)
      res.json({ audio_base64: wav.toString('base64'), spliced: false })
      return
    }

    const wordEnd = wordIndex + word.length
    const startTime = character_start_times_seconds[wordIndex]
    const endTime = character_end_times_seconds[Math.min(wordEnd - 1, characters.length - 1)]

    const wordStartByte = Math.floor(startTime * SAMPLE_RATE * BYTES_PER_SAMPLE)
    const wordEndByte = Math.ceil(endTime * SAMPLE_RATE * BYTES_PER_SAMPLE)
    const alignedStart = wordStartByte - (wordStartByte % BYTES_PER_SAMPLE)
    const alignedEnd = Math.min(wordEndByte - (wordEndByte % BYTES_PER_SAMPLE), sentencePcm.length)

    const before = Buffer.from(sentencePcm.subarray(0, alignedStart))
    const after = Buffer.from(sentencePcm.subarray(alignedEnd))

    // Amplitude-match the golden clip to the word it replaces
    const wordSegment = sentencePcm.subarray(alignedStart, alignedEnd)
    const wordRms = computeRms(wordSegment, BYTES_PER_SAMPLE)
    const goldenRms = computeRms(goldenPcm, BYTES_PER_SAMPLE)
    const scaleFactor = (wordRms > 0 && goldenRms > 0) ? wordRms / goldenRms : 1
    const clampedScale = Math.max(0.5, Math.min(2.0, scaleFactor))
    const golden = scaleAmplitude(goldenPcm, clampedScale, BYTES_PER_SAMPLE)

    // 5ms crossfade at splice boundaries for smooth transitions
    const FADE_SAMPLES = Math.floor(0.005 * SAMPLE_RATE)
    applyFade(before, 0, FADE_SAMPLES, BYTES_PER_SAMPLE)
    applyFade(golden, FADE_SAMPLES, FADE_SAMPLES, BYTES_PER_SAMPLE)
    applyFade(after, FADE_SAMPLES, 0, BYTES_PER_SAMPLE)

    const spliced = Buffer.concat([before, golden, after])
    const wav = writeWavHeader(spliced, SAMPLE_RATE, 1, BYTES_PER_SAMPLE * 8)
    res.json({ audio_base64: wav.toString('base64'), spliced: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    res.status(500).json({ error: message })
  }
})

// Speech-to-Speech — re-synthesize audio through a voice model
app.post('/api/sts/:voiceId', upload.single('audio'), async (req, res) => {
  try {
    const apiKey = getApiKey(req)
    const { voiceId } = req.params
    const file = req.file

    if (!file) {
      res.status(400).json({ error: 'No audio file provided' })
      return
    }

    const { model_id, stability, similarity_boost } = req.body

    const formData = new FormData()
    formData.append(
      'audio',
      new Blob([file.buffer], { type: file.mimetype }),
      file.originalname || 'audio.wav'
    )
    formData.append('model_id', model_id || 'eleven_english_sts_v2')
    formData.append(
      'voice_settings',
      JSON.stringify({
        stability: parseFloat(stability) || 0.5,
        similarity_boost: parseFloat(similarity_boost) || 0.75,
      })
    )

    const response = await fetch(
      `${ELEVENLABS_BASE}/speech-to-speech/${voiceId}?output_format=pcm_44100`,
      {
        method: 'POST',
        headers: { 'xi-api-key': apiKey },
        body: formData,
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      res.status(response.status).json({ error: errorText })
      return
    }

    const arrayBuffer = await response.arrayBuffer()
    const pcmBuffer = Buffer.from(arrayBuffer)
    const wav = writeWavHeader(pcmBuffer, 44100, 1, 16)
    res.set({ 'Content-Type': 'audio/wav', 'Content-Length': wav.length.toString() })
    res.send(wav)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    res.status(500).json({ error: message })
  }
})

app.post('/api/voices/add', upload.array('files', 150), async (req, res) => {
  try {
    const apiKey = getApiKey(req)
    const { name, description } = req.body
    const files = req.files as Express.Multer.File[]

    if (!files || files.length === 0) {
      res.status(400).json({ error: 'No audio files provided' })
      return
    }

    const formData = new FormData()
    formData.append('name', name)
    if (description) formData.append('description', description)

    for (const file of files) {
      const blob = new Blob([file.buffer], { type: file.mimetype })
      formData.append('files', blob, file.originalname)
    }

    const response = await fetch(`${ELEVENLABS_BASE}/voices/add`, {
      method: 'POST',
      headers: { 'xi-api-key': apiKey },
      body: formData,
    })

    if (!response.ok) {
      const errorText = await response.text()
      res.status(response.status).json({ error: errorText })
      return
    }

    const responseData = await response.json()
    res.json(responseData)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    res.status(500).json({ error: message })
  }
})

app.get('/api/voices/:voiceId', async (req, res) => {
  try {
    const apiKey = getApiKey(req)
    const { voiceId } = req.params

    const response = await fetch(`${ELEVENLABS_BASE}/voices/${voiceId}`, {
      headers: { 'xi-api-key': apiKey },
    })

    if (!response.ok) {
      const errorText = await response.text()
      res.status(response.status).json({ error: errorText })
      return
    }

    const responseData = await response.json()
    res.json(responseData)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    res.status(500).json({ error: message })
  }
})

const PORT = process.env.PORT || 3001
app.listen(PORT, () => {
  console.log(`ElevenDiction API server running on port ${PORT}`)
})
