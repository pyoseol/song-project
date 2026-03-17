
// 💡 발급받은 GitHub API 키(Personal Access Token 등)를 여기에 넣으세요.
const GITHUB_TOKEN = "";

// GitHub Models 엔드포인트 주소
const GITHUB_ENDPOINT = "https://models.inference.ai.azure.com/chat/completions";

export async function fetchAiMusic(prompt: string) {
  // AI에게 내릴 강력한 지시사항 (시스템 프롬프트)
  const systemPrompt = `
    당신은 전문적인 음악 시퀀서 데이터 생성기입니다.
    사용자의 요청에 따라 아래 규칙에 맞는 JSON 구조만 출력하세요.

    [규칙]
    1. "version"은 1, "steps"는 32 고정.
    2. "bpm"은 분위기에 맞는 80~150 사이 숫자.
    3. "melody": 12행 x 32열의 2차원 배열. 요소는 boolean(true/false).
    4. "drums": 4행 x 32열의 2차원 배열. (행 순서: 0번줄 Kick, 1번줄 Snare, 2번줄 Hihat-Closed, 3번줄 Hihat-Open). 요소는 boolean(true/false).
    5. "bass": 12행 x 32열의 2차원 배열. 요소는 boolean(true/false). 
    6. 절대 다른 설명이나 마크다운(\`\`\`json 등) 없이 오직 순수한 JSON 객체만 출력하세요.
  `;

  const response = await fetch(GITHUB_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${GITHUB_TOKEN}`, // GitHub 토큰 사용
    },
    body: JSON.stringify({
      // 💡 사용할 모델명을 적습니다. (gpt-4o, gpt-4o-mini, Meta-Llama-3.1-8B-Instruct 등 가능)
      // JSON을 가장 정확하게 뽑아주는 gpt-4o 또는 gpt-4o-mini를 추천합니다.
      model: "gpt-4o-mini", 
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt },
      ],
      temperature: 0.7, // 창의성 (0~1 사이, 너무 높으면 JSON 형식이 망가질 수 있음)
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    console.error("API Error:", errorData);
    throw new Error(`API 호출 실패: ${response.status}`);
  }

  const data = await response.json();
  let aiOutput = data.choices[0].message.content;
  
  // 가끔 AI가 말대꾸나 마크다운(```json)을 붙이는 경우를 대비해 깔끔하게 텍스트만 파싱
  aiOutput = aiOutput.replace(/```json/g, "").replace(/```/g, "").trim();
  
  return JSON.parse(aiOutput);
}