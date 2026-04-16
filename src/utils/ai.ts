import { BASS_NOTES, MELODY_NOTES } from '../constants/composer.ts';

const GITHUB_TOKEN = import.meta.env.VITE_API_KEY;
const GITHUB_ENDPOINT = 'https://models.inference.ai.azure.com/chat/completions';

const TOTAL_STEPS = 640;
const DRUM_TYPES = ['Kick', 'Snare', 'HiHatClosed', 'HiHatOpen'];

/**
 * 공통 모델 호출 함수
 */
async function callModel(messages: any[], temperature = 0.8) {
  const response = await fetch(GITHUB_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${GITHUB_TOKEN}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages,
      temperature,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    console.error(err);
    throw new Error('AI request failed');
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

/**
 * 1단계 — 실제 작곡 (JSON 절대 금지)
 */
async function composeMusicText(prompt: string): Promise<string> {
  return await callModel(
    [
      {
        role: 'system',
        content: `
You are a professional music producer.

Create an 8-bar loop for the user's genre.

Think like a real composer:
- Choose a chord progression
- Describe the drum groove
- Describe the bass rhythm and relationship with drums
- Describe the melody phrasing and note lengths
- Explain repetition and variation across 8 bars
- The loop must feel full, energetic, and continuously moving. Avoid minimalism.

Do NOT use JSON.
Explain the music like you are talking to another producer.
`,
      },
      { role: 'user', content: prompt },
    ],
    0.9
  );
}

/**
 * 2단계 — 시퀀서 JSON 변환
 */
async function convertToSequencer(musicDescription: string) {
  const jsonText = await callModel(
    [
      {
        role: 'system',
        content: `
You are an expert MIDI programmer and step sequencer engineer.

Your job is NOT to simplify the music.
Your job is to faithfully translate the musical description into a rich, dense 128-step sequence.

CRITICAL RULES:

- Fill the sequence like a real produced loop.
- Do NOT leave empty space unless the music description clearly implies silence.
- Use MANY notes.
- Use varied durations (2,4,8,16,32).
- Create rhythmic patterns, not sparse hits.
- Drums must have continuous groove (especially hi-hats).
- Bass must create rhythm, not single hits.
- Melody must form phrases across bars.

Technical limits:
- 128 steps (0~127), 16 steps per bar.
- Melody notes: ${MELODY_NOTES.join(', ')}
- Bass notes: ${BASS_NOTES.join(', ')}
- Drums: ${DRUM_TYPES.join(', ')}

Output ONLY valid JSON:

{
  "bpm": number,
  "tracks": {
    "melody": [{ "note": "", "start": 0, "duration": 0 }],
    "drums": [{ "type": "", "start": 0 }],
    "bass": [{ "note": "", "start": 0, "duration": 0 }]
  }
}
`,
      },
      { role: 'user', content: musicDescription },
    ],
    0.2
  );

  try {
    return JSON.parse(jsonText);
  } catch (e) {
    console.error('Invalid JSON from AI:', jsonText);
    throw new Error('AI generated invalid JSON');
  }
}

/**
 * 최종 외부 호출 함수 (기존 함수 교체)
 */
export async function fetchAiMusic(prompt: string) {
  if (!GITHUB_TOKEN?.trim()) {
    throw new Error('GitHub Models token is not configured.');
  }

  // 1️⃣ 진짜 작곡
  const musicText = await composeMusicText(prompt);

  // 2️⃣ JSON 변환
  const parsedData = await convertToSequencer(musicText);

  // 프론트엔드 포맷 유지
  return {
    version: 2,
    steps: TOTAL_STEPS,
    bpm: parsedData.bpm || 100,
    volumes: { melody: 82, drums: 78, bass: 84 },
    tracks: parsedData.tracks || { melody: [], drums: [], bass: [] },
  };
}