import { BASS_NOTES, MELODY_NOTES } from '../constants/composer.ts';

const GITHUB_TOKEN = import.meta.env.VITE_API_KEY;;
const GITHUB_ENDPOINT = 'https://models.inference.ai.azure.com/chat/completions';

export async function fetchAiMusic(prompt: string) {
  if (!GITHUB_TOKEN.trim()) {
    throw new Error('GitHub Models token is not configured.');
  }

  const systemPrompt = `
You are an expert music producer and beatmaker.
Return ONLY a raw JSON object. No markdown, no explanations.

Rules:
1. "version" must be 1.
2. "steps" must be 32 (representing 4 bars of 8 steps each).
3. "bpm" must be a number between 80 and 150.
4. "melody": A ${MELODY_NOTES.length} x 32 boolean matrix.
   - Rows represent notes from high to low: ${MELODY_NOTES.join(', ')}.
   - CRITICAL: DO NOT play all notes in a sequential scale. DO NOT make diagonal or staircase patterns.
   - Play realistic musical phrases. Use rests (empty columns), repeated notes, and proper chord intervals.
   - Max 1 or 2 true values per column to avoid messy chords.
5. "drums": A 4 x 32 boolean matrix (Kick, Snare, HiHatClosed, HiHatOpen).
   - Create a realistic drum groove.
   - Example groove: Kick on steps 0, 8, 16, 24. Snare on steps 4, 12, 20, 28. Hi-hats on every even step.
6. "bass": A ${BASS_NOTES.length} x 32 boolean matrix.
   - Rows: ${BASS_NOTES.join(', ')}.
   - DO NOT make diagonal lines.
   - Bass should groove with the Kick drum and play only 1 note per column. Outline a 4-bar chord progression (e.g., change the bass note every 8 steps).
7. Output MUST be valid JSON ONLY, strictly matching this structure:
   { "version": 1, "steps": 32, "bpm": 120, "melody": [[...]], "drums": [[...]], "bass": [[...]] }
  `;

  const response = await fetch(GITHUB_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${GITHUB_TOKEN}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ],
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    console.error('API error:', errorData);
    throw new Error(`API request failed: ${response.status}`);
  }

  const data = await response.json();
  let aiOutput = data.choices[0].message.content as string;
  aiOutput = aiOutput.replace(/```json/g, '').replace(/```/g, '').trim();

  return JSON.parse(aiOutput);
}
