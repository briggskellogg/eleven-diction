# ElevenDiction

Pronunciation-corrected voice cloning. Generates a training corpus that bakes correct pronunciation of a target word into a voice clone — supports both Instant Voice Clones (IVC) and Professional Voice Clones (PVC).

## What It Does

1. **Setup** — Enter an API key, source voice ID, a problem word (e.g. "Semaglutide"), and optional pronunciation guides (IPA, CMU Arpabet, or phonetic alias).
2. **Curate** — The tool generates dozens of pronunciation takes across multiple models, framings, and stability presets. You listen and select the ones where the word sounds correct ("golden clips").
3. **Build** — Your golden clips are amplified into a ~30-minute training corpus split evenly across word repetition, spliced sentences, and industry-themed general speech. For IVC, the voice is created via the API immediately. For PVC, the corpus is packaged as a ZIP to upload through the platform.
4. **Review** (IVC only) — Before/after comparison: the target word spoken 10× on the original voice vs. the new clone, plus in-context industry sentences.

## Quick Start

**Prerequisites:** Node.js 20+

```bash
git clone https://github.com/briggskellogg/eleven-diction.git
cd eleven-diction
npm install
npm run dev
```

This starts both the Vite frontend (http://localhost:5173) and the Express API proxy (port 3001). Open http://localhost:5173 in your browser.

You'll need:
- An **ElevenLabs API key** (entered in the browser, passed per-request, never stored)
- A **source voice ID** — the voice you want to clone with corrected pronunciation

## IVC vs PVC

| | Instant (IVC) | Professional (PVC) |
|---|---|---|
| **Output** | Voice created via API, usable immediately | ZIP download for upload to [Voice Lab](https://elevenlabs.io/voice-lab) |
| **Training time** | Instant | ~4 hours after platform upload |
| **Quality** | Good | Higher fidelity |
| **Validation** | Built-in before/after + in-context review | Manual testing after platform training |

## How the Corpus Is Built

The amplification pipeline takes your selected golden clips and produces ~30 minutes of training audio:

- **Word repetition (~10 min)** — The golden pronunciation is run through DSP variations (playback rate) and speech-to-speech re-synthesis to build a pool of natural variants. These are assembled into repetition files with varied gap timing.
- **Spliced sentences (~10 min)** — Full sentences are generated via TTS with timestamps. The word's audio segment is surgically replaced with a golden clip (amplitude-matched, crossfaded). If pronunciation guides exist, additional SSML-guided sentences are generated. All are consolidated into files ≥30s each.
- **Industry corpus (~10 min)** — General conversational speech in your chosen industry vertical (medical, legal, finance, etc.), generated from the source voice. Preserves timbre and natural cadence in the clone. Consolidated into files ≥30s each.

## Architecture

```
Browser (React 19 + Vite + Tailwind v4)
    ↓ /api/*
Express proxy (port 3001)
    ↓
ElevenLabs API (TTS, TTS+timestamps, STS, voices)
```

The Express server proxies all ElevenLabs API calls and handles server-side audio processing (PCM trimming, amplitude matching, crossfade splicing). The API key is forwarded from the browser via `x-api-key` header — nothing is persisted.

## Project Structure

```
src/
  App.tsx              # Main 3-step wizard orchestration
  components/
    ConfigStep.tsx     # Setup form (clone type, connection, word, guides, industry)
    TakeCard.tsx       # Audio card for a single pronunciation take
    ValidateStep.tsx   # Post-creation review with before/after comparison
    Stepper.tsx        # Header step indicator
  lib/
    api.ts             # Client-side API helpers (TTS, STS, splice, voice creation)
    amplify.ts         # Amplification pipeline (DSP, STS, splicing, corpus)
    snippets.ts        # Industry corpus text + splice sentence templates
    types.ts           # Shared types and config
server/
  index.ts             # Express API proxy + audio processing
```

## Tech Stack

- **Frontend:** React 19, TypeScript, Vite 7, Tailwind CSS v4, Lucide icons
- **Backend:** Express 5, Multer (multipart uploads)
- **Build/Dev:** concurrently, tsx, ESLint 9

## Tips

- **Pronunciation guides help a lot.** IPA or CMU Arpabet guides enable SSML-based generation which tends to produce more consistent results. You can find IPA for most words on [Wiktionary](https://en.wiktionary.org).
- **Select 1–3 golden clips** that sound clearly correct. More isn't always better — quality over quantity.
- **Industry selection matters for PVC.** The corpus makes up a third of the training data, so pick the vertical closest to how the voice will actually be used.
