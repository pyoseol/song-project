import { BASS_NOTES, MELODY_NOTES } from '../constants/composer.ts';

const GITHUB_TOKEN = import.meta.env.VITE_API_KEY;;
const GITHUB_ENDPOINT = 'https://models.inference.ai.azure.com/chat/completions';

export async function fetchAiMusic(prompt: string) {
  if (!GITHUB_TOKEN.trim()) {
    throw new Error('GitHub Models token is not configured.');
  }

  const systemPrompt = `
You are a music pattern generator.
Return only one raw JSON object with no markdown and no explanation.

Rules:
1. "version" must be 1.
2. "steps" must be 32.
3. "bpm" must be a number between 80 and 150.
4. "melody" must be a ${MELODY_NOTES.length} x 32 boolean matrix.
   Melody note order from row 0 to last row:
   ${MELODY_NOTES.join(', ')}
5. "drums" must be a 4 x 32 boolean matrix.
   Drum rows are: Kick, Snare, HiHatClosed, HiHatOpen.
6. "bass" must be a ${BASS_NOTES.length} x 32 boolean matrix.
   Bass note order from row 0 to last row:
   ${BASS_NOTES.join(', ')}
7. Use musical repetition and variation. Avoid random noise.
8. Output JSON only.
  `;

  const response = await fetch(GITHUB_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${GITHUB_TOKEN}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
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
