# Concilium (PitchPractice)

AI-powered presentation practice platform where users rehearse pitches with interactive LLM-driven audience personas that react in real-time and provide personalized feedback.

## Tech Stack

- **Frontend:** React 19 + TypeScript + Vite 6 + Tailwind CSS + Framer Motion
- **Backend:** Express 5 (Node 18+), deployed on Railway (Nixpacks)
- **LLM:** Anthropic Claude (Haiku for reactions/scripts, Sonnet for feedback)
- **Voice:** ElevenLabs STT (real-time WebSocket) + ElevenLabs/OpenAI TTS (streaming)
- **Audio:** Web Audio API with AudioWorklet for PCM capture, MediaRecorder for session recording

## Required Environment Variables

| Variable | Purpose |
|---|---|
| `ANTHROPIC_API_KEY` | Claude LLM — script generation, persona reactions, session feedback |
| `OPENAI_API_KEY` | OpenAI TTS fallback |
| `ELEVENLABS_API_KEY` | Premium TTS + real-time STT (single-use token minting) |
| `PORT` | Server port (default 3000) |
| `CONFIG_DATA_DIR` | Writable directory for live config (voice/character JSON). Point at a Railway volume mount (e.g. `/data-live`) to persist Settings UI changes across redeploys. Defaults to `./data` (the committed seed) when unset. |
| `VOICE_CONFIG` | *(optional)* JSON string, emergency env-var override for voice ID mappings. Last layer in the merge chain. |
| `CHARACTER_NAMES` | *(optional)* JSON string, emergency env-var override for character display names. |

App degrades gracefully if keys are missing.

### Persistent config on Railway

Voice IDs and character names use a two-tier config system (see
`server/index.ts` — "Config Persistence" section):

1. **Seed** — `data/voice-config.json` and `data/character-config.json` are
   committed to the repo and ship with every deploy. They define the starting
   state for any fresh environment.
2. **Live** — `$CONFIG_DATA_DIR/voice-config.json` and
   `$CONFIG_DATA_DIR/character-config.json` on a Railway volume. All writes
   from the Settings UI land here, so changes survive redeploys without
   needing a git commit or env var edit.

Load order on startup (each layer overrides the previous):
`hardcoded defaults → seed file → live volume file → VOICE_CONFIG / CHARACTER_NAMES env vars`

**To enable persistent live config on Railway:**
1. In the Railway service, add a Volume (e.g. mount path `/data-live`, 1 GB is plenty).
2. Add env var `CONFIG_DATA_DIR=/data-live`.
3. Redeploy. Changes made in Settings → Voice Configuration / Character Names
   now write to the volume and persist automatically.

For local dev, leave `CONFIG_DATA_DIR` unset — writes land in `./data/*.json`
so you can commit them as new seed values when desired.

## Commands

- `npm run dev` — Vite frontend dev server
- `npm run dev:server` — Backend dev server (ts-node)
- `npm run build` — Full production build (tsc + vite + server compile)
- `npm start` — Run production server (`node dist-server/index.js`)
- `npm run lint` — ESLint

## Architecture

### Key User Flow
1. Select audience personas (6 available with distinct personalities)
2. Set up script (manual input, AI-generated via Claude, or teleprompter)
3. Practice in MeetingRoom — mic captures speech via ElevenLabs STT
4. Personas react in real-time via `/api/react-batch`
5. Session ends → `/api/feedback-batch` generates detailed per-persona feedback
6. Session playback with prosody analysis (volume, pitch, energy timeline)

### Server Endpoints (`server/index.ts`)
- `GET /api/health` — Provider availability check
- `GET /api/scribe-token` — Mints ElevenLabs single-use token for client-side STT WebSocket
- `POST /api/tts/stream` — Streaming TTS (ElevenLabs preferred, OpenAI fallback)
- `POST /api/tts` — Standard TTS
- `POST /api/generate-script` — Claude Haiku script generation
- `POST /api/react` / `POST /api/react-batch` — Persona reactions
- `POST /api/feedback` / `POST /api/feedback-batch` — Session feedback (Claude Sonnet)
- `GET /api/tts/test-elevenlabs` — ElevenLabs diagnostic

### ElevenLabs STT Architecture (IMPORTANT — hard-won knowledge)

The STT uses a **direct client-to-ElevenLabs WebSocket** via single-use tokens. This replaced a server-side WebSocket proxy that had intractable race conditions.

**How it works:**
1. Server mints a single-use token: `POST https://api.elevenlabs.io/v1/single-use-token/realtime_scribe`
2. Client connects directly: `wss://api.elevenlabs.io/v1/speech-to-text/realtime?model_id=scribe_v2_realtime&token=<token>`
3. AudioWorklet captures mic → buffers 4800 samples (100ms at 48kHz) → downsamples to 16kHz PCM16 → base64 encodes → sends as JSON `{ message_type: "input_audio_chunk", audio_base_64, commit: false, sample_rate: 16000 }`

**Critical: Do NOT revert to a server-side WebSocket proxy.** We spent 10+ iterations debugging proxy-based approaches that all failed due to:
- Race conditions: audio pipeline ready before WS open, but proxy not connected to ElevenLabs yet
- Silent chunk dropping: proxy forwarding `if (readyState === OPEN)` silently drops pre-connection audio
- Double-hop latency making ElevenLabs close sessions before receiving enough audio

**Audio pipeline must be set up BEFORE opening the WebSocket** so buffered chunks flush immediately on connect.

### Key Components (`src/components/`)
- `MeetingRoom.tsx` — Main session view (1300+ LOC), orchestrates STT, TTS, reactions, camera
- `FeedbackView.tsx` — Post-session feedback display with per-persona scores
- `SessionPlayback.tsx` — Recorded session playback with canvas waveform and coaching cards
- `PersonaSelector.tsx` — Audience persona picker
- `ScriptSetup.tsx` — Script input/generation
- `QuestionQueue.tsx` — Audience questions/interruptions display
- `Teleprompter.tsx` — Script display during performance
- `ThemedBackground.tsx` / `ThemedLayout.tsx` — Animated themed environments
- `practice/` — Duolingo-style skill progression (PracticeDashboard, ExerciseView, LandingPage)

### Key Hooks (`src/hooks/`)
- `useElevenLabsSTT.ts` — Real-time STT via ElevenLabs WebSocket (AudioWorklet + ScriptProcessor fallback)
- `useTTS.ts` — Multi-provider TTS with streaming (ElevenLabs > OpenAI > browser)
- `useProsody.ts` — Real-time volume/pitch/energy analysis
- `useVAD.ts` — Voice activity detection with silence threshold
- `useAudioRecorder.ts` — MediaRecorder for session recording (WebM/Opus)
- `useCamera.ts` — Webcam stream management
- `useSpeechRecognition.ts` — Browser Web Speech API (fallback STT)
- `useSpeechMetrics.ts` — Derived speech metrics from prosody data

### Data Layer (`src/data/`)
- `personas.ts` — 6 audience personas with distinct expertise/personalities
- `prosodyAnalysis.ts` — Science-backed prosody analysis (CV, upspeak detection, research-cited thresholds from Titze 1994, Goldman-Eisler 1968, etc.)
- `themes.ts` — Session environment themes
- `feedbackEngine.ts` — Feedback aggregation

## Deployment

Railway with Nixpacks. Config in `railway.json`:
- Build: `npm run build`
- Start: `node dist-server/index.js`
- Static SPA served from `/dist` via Express, with SPA fallback route

## Known Considerations / Future Work

- Mobile: auto-interrupt (user starts talking while TTS plays) needed special handling — mic pauses during TTS, resumes after
- Mobile: audience questions should auto-trigger without manual click
- The prosody analysis uses research-backed thresholds but could benefit from calibration per-user
- Practice mode (Duolingo-style) exists but may need further content/exercise expansion
- Camera feature has had intermittent issues on some browsers
- `useSpeechRecognition.ts` (Web Speech API) is the fallback if ElevenLabs is unavailable
