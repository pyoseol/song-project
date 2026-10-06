import * as ort from 'onnxruntime-web/all';

export interface VocalNote {
  pitch: string;
  midi: number;
  startStep: number;
  durationSteps: number;
  lyric: string;
}

export interface VocalRenderOptions {
  bpm: number;
  stepsPerBeat?: number;
  sampleRate?: number;
}

export interface VocalSynthProgress {
  stage:
    | 'loading'
    | 'phoneme'
    | 'duration'
    | 'pitch'
    | 'acoustic'
    | 'vocoder'
    | 'complete';
  progress: number;
  message: string;
}

export interface VocalSynthResult {
  blob: Blob;
  audioBuffer: AudioBuffer;
  sampleRate: number;
}

const MODEL_ROOT = '/models/aqua-planet';

const MODEL_PATHS = {
  acoustic: `${MODEL_ROOT}/dsmain/acoustic.onnx`,
  linguistic: `${MODEL_ROOT}/dsmain/linguistic.onnx`,
  phonemes: `${MODEL_ROOT}/dsmain/phonemes.json`,
  languages: `${MODEL_ROOT}/dsmain/languages.json`,

  duration: `${MODEL_ROOT}/dsdur/dur.onnx`,
  durationConfig: `${MODEL_ROOT}/dsdur/dsconfig.yaml`,

  pitch: `${MODEL_ROOT}/dspitch/pitch.onnx`,
  pitchConfig: `${MODEL_ROOT}/dspitch/dsconfig.yaml`,

  variance: `${MODEL_ROOT}/dsvariance/variance.onnx`,
  varianceConfig: `${MODEL_ROOT}/dsvariance/dsconfig.yaml`,

  acousticConfig: `${MODEL_ROOT}/dsmain/dsconfig.yaml`,

  vocoder: `${MODEL_ROOT}/dsvocoder/nsf_hifigan_44.1k_hop512_128bin_2024.02.onnx`,
  vocoderConfig: `${MODEL_ROOT}/dsvocoder/vocoder.yaml`,
    durationSpeaker:
    `${MODEL_ROOT}/dsmain/embeds/variance/base.emb`,
  acousticSpeaker:
    `${MODEL_ROOT}/dsmain/embeds/acoustic/base.emb`,
} as const;

const DEFAULT_SAMPLE_RATE = 44100;
const DEFAULT_HOP_SIZE = 512;
const DEFAULT_STEPS_PER_BEAT = 4;

let runtimeConfigured = false;

function configureOrt(): void {
  if (runtimeConfigured) return;

  ort.env.logLevel = 'warning';

  runtimeConfigured = true;
}
async function loadSession(
  path: string,
  executionProviders: readonly (
    | 'wasm'
    | 'webgpu'
  )[] = ['wasm'],
  freeDimensionOverrides?: Record<string, number>,
): Promise<ort.InferenceSession> {
  configureOrt();

  const response =
    await fetch(
      `${path}?v=${Date.now()}`,
      {
        cache: 'no-store',
      },
    );

  const buffer =
    await response.arrayBuffer();

  console.log(
    '[Aqua Planet] model fetched',
    {
      path,
      size: buffer.byteLength,
      contentType:
        response.headers.get(
          'content-type',
        ),
      executionProviders,
    },
  );

  return ort.InferenceSession.create(
    buffer,
    {
      executionProviders,

      graphOptimizationLevel:
        'all',

      enableMemPattern:
        executionProviders.includes(
          'webgpu',
        )
          ? false
          : true,

      freeDimensionOverrides,
    },
  );
}
async function loadSpeakerEmbedding(path: string): Promise<Float32Array> {
  const response = await fetch(`${path}?v=${Date.now()}`, {
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`speaker embedding 로드 실패: ${path}`);
  }

  const buffer = await response.arrayBuffer();

  if (buffer.byteLength % 4 !== 0) {
    throw new Error(
      `speaker embedding 크기가 float32 단위가 아닙니다: ${buffer.byteLength} bytes`
    );
  }

  const values = new Float32Array(buffer);

  console.info('[Aqua Planet] speaker embedding loaded', {
    path,
    bytes: buffer.byteLength,
    dimensions: values.length,
  });

  return values;
}

async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(path);

  if (!response.ok) {
    throw new Error(
      `파일을 불러오지 못했습니다: ${path} (${response.status})`,
    );
  }

  return response.json() as Promise<T>;
}

async function fetchText(path: string): Promise<string> {
  const response = await fetch(path);

  if (!response.ok) {
    throw new Error(
      `파일을 불러오지 못했습니다: ${path} (${response.status})`,
    );
  }

  return response.text();
}

function clamp(
  value: number,
  min: number,
  max: number,
): number {
  return Math.max(min, Math.min(max, value));
}

function midiToHz(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function stepToSeconds(
  step: number,
  bpm: number,
  stepsPerBeat: number,
): number {
  return step * ((60 / bpm) / stepsPerBeat);
}

function normalizeNotes(
  notes: VocalNote[],
): VocalNote[] {
  return [...notes]
    .filter(
      (note) =>
        Number.isFinite(note.midi) &&
        Number.isFinite(note.startStep) &&
        Number.isFinite(note.durationSteps) &&
        note.durationSteps > 0,
    )
    .sort((a, b) => a.startStep - b.startStep);
}

/* -------------------------------------------------------------------------- */
/* Korean Hangul                                                             */
/* -------------------------------------------------------------------------- */

const INITIALS = [
  'ㄱ',
  'ㄲ',
  'ㄴ',
  'ㄷ',
  'ㄸ',
  'ㄹ',
  'ㅁ',
  'ㅂ',
  'ㅃ',
  'ㅅ',
  'ㅆ',
  'ㅇ',
  'ㅈ',
  'ㅉ',
  'ㅊ',
  'ㅋ',
  'ㅌ',
  'ㅍ',
  'ㅎ',
];

const MEDIALS = [
  'ㅏ',
  'ㅐ',
  'ㅑ',
  'ㅒ',
  'ㅓ',
  'ㅔ',
  'ㅕ',
  'ㅖ',
  'ㅗ',
  'ㅘ',
  'ㅙ',
  'ㅚ',
  'ㅛ',
  'ㅜ',
  'ㅝ',
  'ㅞ',
  'ㅟ',
  'ㅠ',
  'ㅡ',
  'ㅢ',
  'ㅣ',
];

const FINALS = [
  '',
  'ㄱ',
  'ㄲ',
  'ㄳ',
  'ㄴ',
  'ㄵ',
  'ㄶ',
  'ㄷ',
  'ㄹ',
  'ㄺ',
  'ㄻ',
  'ㄼ',
  'ㄽ',
  'ㄾ',
  'ㄿ',
  'ㅀ',
  'ㅁ',
  'ㅂ',
  'ㅄ',
  'ㅅ',
  'ㅆ',
  'ㅇ',
  'ㅈ',
  'ㅊ',
  'ㅋ',
  'ㅌ',
  'ㅍ',
  'ㅎ',
];

const KO_INITIAL: Record<string, string[]> = {
  ㄱ: ['g'], ㄲ: ['kk'], ㄴ: ['n'], ㄷ: ['d'], ㄸ: ['tt'],
  ㄹ: ['r'], ㅁ: ['m'], ㅂ: ['b'], ㅃ: ['pp'], ㅅ: ['s'],
  ㅆ: ['ss'], ㅇ: [], ㅈ: ['j'], ㅉ: ['jj'], ㅊ: ['ch'],
  ㅋ: ['k'], ㅌ: ['t'], ㅍ: ['p'], ㅎ: ['h'],
};

const KO_MEDIAL: Record<string, string[]> = {
  ㅏ: ['a'], ㅐ: ['e'], ㅑ: ['y', 'a'], ㅒ: ['y', 'e'],
  ㅓ: ['eo'], ㅔ: ['e'], ㅕ: ['y', 'eo'], ㅖ: ['y', 'e'],
  ㅗ: ['o'], ㅘ: ['w', 'a'], ㅙ: ['w', 'e'], ㅚ: ['w', 'e'],
  ㅛ: ['y', 'o'], ㅜ: ['u'], ㅝ: ['w', 'eo'], ㅞ: ['w', 'e'],
  ㅟ: ['w', 'i'], ㅠ: ['y', 'u'], ㅡ: ['eu'], ㅢ: ['eu', 'i'],
  ㅣ: ['i'],
};

const KO_FINAL: Record<string, string[]> = {
  '': [],
  ㄱ: ['K'], ㄲ: ['K'], ㄳ: ['K'], ㅋ: ['K'], ㄺ: ['K'],
  ㄴ: ['N'], ㄵ: ['N'], ㄶ: ['N'],
  ㄷ: ['T'], ㅅ: ['T'], ㅆ: ['T'], ㅈ: ['T'], ㅊ: ['T'], ㅌ: ['T'], ㅎ: ['T'],
  ㄹ: ['L'], ㄼ: ['L'], ㄽ: ['L'], ㄾ: ['L'], ㅀ: ['L'],
  ㅁ: ['M'], ㄻ: ['M'],
  ㅂ: ['P'], ㅄ: ['P'], ㅍ: ['P'], ㄿ: ['P'],
  ㅇ: ['NG'],
};

function decomposeHangul(
  char: string,
): {
  initial: string;
  medial: string;
  final: string;
} | null {
  const code = char.charCodeAt(0);

  if (code < 0xac00 || code > 0xd7a3) {
    return null;
  }

  const index = code - 0xac00;

  const initialIndex = Math.floor(
    index / (21 * 28),
  );

  const medialIndex = Math.floor(
    (index % (21 * 28)) / 28,
  );

  const finalIndex = index % 28;

  return {
    initial: INITIALS[initialIndex],
    medial: MEDIALS[medialIndex],
    final: FINALS[finalIndex],
  };
}

/* -------------------------------------------------------------------------- */
/* Phoneme loading                                                           */
/* -------------------------------------------------------------------------- */

type PhonemeMap = Record<string, number>;

function normalizePhonemeMap(
  value: unknown,
): PhonemeMap {
  if (Array.isArray(value)) {
    const result: PhonemeMap = {};

    value.forEach((phoneme, index) => {
      if (typeof phoneme === 'string') {
        result[phoneme] = index;
      }
    });

    return result;
  }

  if (
    value &&
    typeof value === 'object'
  ) {
    const result: PhonemeMap = {};

    for (const [key, rawValue] of Object.entries(
      value as Record<string, unknown>,
    )) {
      if (typeof rawValue === 'number') {
        result[key] = rawValue;
      }
    }

    return result;
  }

  throw new Error(
    'phonemes.json 형식을 해석할 수 없습니다.',
  );
}

async function loadPhonemeMap(): Promise<PhonemeMap> {
  const json = await fetchJson<unknown>(
    MODEL_PATHS.phonemes,
  );

  return normalizePhonemeMap(json);
}

type LanguageMap = Record<string, number>;

function normalizeLanguageMap(
  value: unknown,
): LanguageMap {
  if (
    value &&
    typeof value === 'object'
  ) {
    const result: LanguageMap = {};

    for (const [key, rawValue] of Object.entries(
      value as Record<string, unknown>,
    )) {
      if (typeof rawValue === 'number') {
        result[key] = rawValue;
      }
    }

    return result;
  }

  return {};
}

async function loadLanguageMap(): Promise<LanguageMap> {
  try {
    const json = await fetchJson<unknown>(
      MODEL_PATHS.languages,
    );

    return normalizeLanguageMap(json);
  } catch {
    return {};
  }
}

/* -------------------------------------------------------------------------- */
/* Korean phoneme fallback                                                    */
/* -------------------------------------------------------------------------- */

function lyricToFallbackPhonemes(lyric: string): string[] {
  const result: string[] = [];

  for (const char of lyric.trim()) {
    const d = decomposeHangul(char);
    if (!d) continue;

    const parts = [
      ...(KO_INITIAL[d.initial] ?? []),
      ...(KO_MEDIAL[d.medial] ?? []),
      ...(KO_FINAL[d.final] ?? []),
    ];

    for (const p of parts) result.push(`ko/${p}`);
  }

  return result;
}

/**
 * dsdict-ko.yaml을 브라우저에서 사용할 수 있도록
 * 아주 제한적으로 읽는다.
 *
 * 현재는 다음과 같은 일반적인 dictionary entry를 지원한다.
 *
 * 안:
 *   - a n
 *
 * 안: a n
 *
 * 복잡한 YAML 구조는 fallback phonemizer를 사용한다.
 */
function parseKoreanDictionary(
  yaml: string,
): Map<string, string[]> {
  const dictionary =
    new Map<string, string[]>();

  const lines = yaml.split(/\r?\n/);

  let currentKey: string | null = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line || line.startsWith('#')) {
      continue;
    }

    const keyMatch = line.match(
      /^["']?([^:"']+)["']?\s*:/,
    );

    if (keyMatch) {
      currentKey = keyMatch[1].trim();

      const inline =
        line.slice(
          keyMatch[0].length,
        ).trim();

      const phonemes =
        parseDictionaryValue(inline);

      if (phonemes.length > 0) {
        dictionary.set(
          currentKey,
          phonemes,
        );
      }

      continue;
    }

    if (
      currentKey &&
      line.startsWith('-')
    ) {
      const phonemes =
        parseDictionaryValue(
          line.slice(1).trim(),
        );

      if (phonemes.length > 0) {
        dictionary.set(
          currentKey,
          phonemes,
        );
      }
    }
  }

  return dictionary;
}

function parseDictionaryValue(
  value: string,
): string[] {
  if (!value) {
    return [];
  }

  const withoutComment =
    value.split('#')[0].trim();

  if (!withoutComment) {
    return [];
  }

  const cleaned =
    withoutComment
      .replace(/^\[/, '')
      .replace(/\]$/, '')
      .replace(/^['"]/, '')
      .replace(/['"]$/, '')
      .trim();

  return cleaned
    .split(/[\s,]+/)
    .map((item) =>
      item
        .replace(/^['"]/, '')
        .replace(/['"]$/, '')
        .trim(),
    )
    .filter(Boolean);
}

async function loadKoreanDictionary(): Promise<
  Map<string, string[]>
> {
  const dictionaryPath =
    `${MODEL_ROOT}/dsdur/dsdict-ko.yaml`;

  try {
    const yaml =
      await fetchText(dictionaryPath);

    return parseKoreanDictionary(yaml);
  } catch (error) {
    console.warn(
      '[Aqua Planet] Korean dictionary load failed',
      error,
    );

    return new Map();
  }
}

async function lyricToPhonemes(
  lyric: string,
  dictionary: Map<string, string[]>,
  phonemeMap: PhonemeMap,
): Promise<string[]> {
  const normalized =
    lyric.trim();

  if (!normalized) {
    return ['SP'];
  }

  const dictionaryResult =
    dictionary.get(normalized) ??
    dictionary.get(
      normalized.toLowerCase(),
    );

  if (dictionaryResult) {
    return dictionaryResult.filter(
      (phoneme) =>
        phonemeMap[phoneme] !== undefined,
    );
  }

  const fallback =
    lyricToFallbackPhonemes(
      normalized,
    );

  const supportedFallback =
    fallback.filter(
      (phoneme) =>
        phonemeMap[phoneme] !== undefined,
    );

  if (supportedFallback.length > 0) {
    return supportedFallback;
  }

  /*
   * Aqua Planet 모델이 SP를 제공한다면
   * 인식할 수 없는 가사는 pause로 처리한다.
   */
  if (phonemeMap.SP !== undefined) {
    return ['SP'];
  }

  throw new Error(
    `가사 "${lyric}"에 대응하는 Aqua Planet 음소를 찾지 못했습니다.`,
  );
}

/* -------------------------------------------------------------------------- */
/* Tensor helpers                                                             */
/* -------------------------------------------------------------------------- */

function makeInt64Tensor(
  values: number[],
): ort.Tensor {
  const data =
    BigInt64Array.from(
      values.map((value) =>
        BigInt(Math.trunc(value)),
      ),
    );

  return new ort.Tensor(
    'int64',
    data,
    [1, values.length],
  );
}

function makeFloatTensor(
  values: number[],
): ort.Tensor {
  return new ort.Tensor(
    'float32',
    Float32Array.from(values),
    [1, values.length],
  );
}

function getOutputTensor(
  result: Record<string, ort.Tensor>,
  preferredNames: string[],
): ort.Tensor {
  for (const name of preferredNames) {
    const tensor = result[name];

    if (tensor) {
      return tensor;
    }
  }

  const first =
    Object.values(result)[0];

  if (!first) {
    throw new Error(
      'ONNX 모델의 출력 Tensor를 찾지 못했습니다.',
    );
  }

  return first;
}

function tensorToNumbers(
  tensor: ort.Tensor,
): number[] {
  const data =
    tensor.data as
      | Float32Array
      | Float64Array
      | Int32Array
      | BigInt64Array
      | Int16Array
      | Uint8Array;

  return Array.from(
    data as ArrayLike<number | bigint>,
  ).map((value) =>
    typeof value === 'bigint'
      ? Number(value)
      : Number(value),
  );
}

function tensorShape(
  tensor: ort.Tensor,
): number[] {
  return [...tensor.dims];
}

/* -------------------------------------------------------------------------- */
/* Timing                                                                     */
/* -------------------------------------------------------------------------- */

interface InternalPhoneme {
  symbol: string;
  token: number;
  midi: number;
  startSec: number;
  durationSec: number;
  noteIndex: number;
  languageId: number;
}

interface RenderFrameData {
  durations: number[];
  f0: number[];
  totalFrames: number;
}

function secondsToFrames(
  seconds: number,
  sampleRate: number,
  hopSize: number,
): number {
  return Math.max(
    1,
    Math.round(
      (seconds * sampleRate) /
        hopSize,
    ),
  );
}

function buildPhonemes(
  notes: VocalNote[],
  phonemesPerNote: string[][],
  phonemeMap: PhonemeMap,
  languageMap: LanguageMap,
  bpm: number,
  stepsPerBeat: number,
): InternalPhoneme[] {
  const result: InternalPhoneme[] = [];

  notes.forEach((note, noteIndex) => {
    const startSec =
      stepToSeconds(
        note.startStep,
        bpm,
        stepsPerBeat,
      );

    const durationSec =
      stepToSeconds(
        note.durationSteps,
        bpm,
        stepsPerBeat,
      );

    const phonemes =
      phonemesPerNote[noteIndex];

    if (!phonemes.length) {
      return;
    }

    const eachDuration =
      durationSec / phonemes.length;

    phonemes.forEach(
      (symbol, phonemeIndex) => {
        const token =
          phonemeMap[symbol];

        if (token === undefined) {
          throw new Error(
            `지원하지 않는 음소입니다: ${symbol}`,
          );
        }

        const languageKey =
          getLanguageKey(symbol);

        result.push({
          symbol,
          token,
          midi: note.midi,
          startSec:
            startSec +
            eachDuration *
              phonemeIndex,
          durationSec:
            eachDuration,
          noteIndex,
          languageId:
            languageMap[languageKey] ?? 0,
        });
      },
    );
  });

  return result;
}

function getLanguageKey(
  phoneme: string,
): string {
  /*
   * DiffSinger의 language ID는 보통
   * phoneme의 language prefix를 사용한다.
   *
   * Aqua Planet KO 모델에서는 대부분
   * 단일 한국어 language ID가 사용되므로
   * 기본값 0을 안전하게 사용한다.
   */
  const slash =
    phoneme.indexOf('/');

  if (slash > 0) {
    return phoneme.slice(
      0,
      slash,
    );
  }

  return 'ko';
}

function buildFrameData(
  notes: VocalNote[],
  phonemes: InternalPhoneme[],
  sampleRate: number,
  hopSize: number,
  bpm: number,
  stepsPerBeat: number,
): RenderFrameData {
  const lastNote =
    notes[notes.length - 1];

  const endSec =
    stepToSeconds(
      lastNote.startStep +
        lastNote.durationSteps,
        bpm,
        stepsPerBeat,   
    );

  /*
   * 위 계산은 BPM에 의존하므로 실제 frame 수는
   * phoneme의 마지막 위치를 기준으로 다시 계산한다.
   */
  const actualEndSec =
    phonemes.length > 0
      ? phonemes[
          phonemes.length - 1
        ].startSec +
        phonemes[
          phonemes.length - 1
        ].durationSec
      : endSec;

  const totalFrames =
    Math.max(
      1,
      Math.ceil(
        (actualEndSec *
          sampleRate) /
          hopSize,
      ),
    );

  const durations =
    phonemes.map((phoneme) =>
      secondsToFrames(
        phoneme.durationSec,
        sampleRate,
        hopSize,
      ),
    );

  let durationFrameSum =
    durations.reduce(
      (sum, value) =>
        sum + value,
      0,
    );

  if (
    durationFrameSum <
    totalFrames
  ) {
    durations[
      durations.length - 1
    ] +=
      totalFrames -
      durationFrameSum;

    durationFrameSum =
      totalFrames;
  }

  const f0 =
    new Array<number>(
      durationFrameSum,
    ).fill(0);

  let frameCursor = 0;

  for (
    let i = 0;
    i < phonemes.length;
    i++
  ) {
    const phoneme =
      phonemes[i];

    const frames =
      durations[i];

    const hz =
      midiToHz(
        phoneme.midi,
      );

    for (
      let frame = 0;
      frame < frames &&
      frameCursor + frame <
        f0.length;
      frame++
    ) {
      /*
       * 자음은 무성 구간일 수 있지만
       * 직접 MIDI F0를 공급하는 현재 구현에서는
       * 음표의 기본 F0를 유지한다.
       *
       * 실제 pitch.onnx를 연결할 경우 이 부분을
       * pitch predictor 출력으로 교체한다.
       */
      f0[
        frameCursor + frame
      ] = hz;
    }

    frameCursor += frames;
  }

  durationFrameSum =
    Math.min(
      durationFrameSum,
      f0.length,
    );

  return {
    durations,
    f0,
    totalFrames:
      durationFrameSum,
  };
}

/* -------------------------------------------------------------------------- */
/* WAV / Audio                                                                */
/* -------------------------------------------------------------------------- */

function float32ToWavBlob(
  samples: Float32Array,
  sampleRate: number,
): Blob {
  const buffer =
    new ArrayBuffer(
      44 +
        samples.length * 2,
    );

  const view =
    new DataView(buffer);

  const writeString = (
    offset: number,
    value: string,
  ) => {
    for (
      let i = 0;
      i < value.length;
      i++
    ) {
      view.setUint8(
        offset + i,
        value.charCodeAt(i),
      );
    }
  };

  writeString(0, 'RIFF');

  view.setUint32(
    4,
    36 +
      samples.length * 2,
    true,
  );

  writeString(8, 'WAVE');
  writeString(12, 'fmt ');

  view.setUint32(
    16,
    16,
    true,
  );

  view.setUint16(
    20,
    1,
    true,
  );

  view.setUint16(
    22,
    1,
    true,
  );

  view.setUint32(
    24,
    sampleRate,
    true,
  );

  view.setUint32(
    28,
    sampleRate * 2,
    true,
  );

  view.setUint16(
    32,
    2,
    true,
  );

  view.setUint16(
    34,
    16,
    true,
  );

  writeString(36, 'data');

  view.setUint32(
    40,
    samples.length * 2,
    true,
  );

  let offset = 44;

  for (
    let i = 0;
    i < samples.length;
    i++
  ) {
    const sample =
      clamp(
        samples[i],
        -1,
        1,
      );

    view.setInt16(
      offset,
      sample < 0
        ? sample * 0x8000
        : sample * 0x7fff,
      true,
    );

    offset += 2;
  }

  return new Blob(
    [buffer],
    {
      type: 'audio/wav',
    },
  );
}

function createAudioBuffer(
  samples: Float32Array,
  sampleRate: number,
): AudioBuffer {
  const context =
    new AudioContext({
      sampleRate,
    });

  const audioBuffer =
    context.createBuffer(
      1,
      samples.length,
      sampleRate,
    );

  const channelData =
    new Float32Array(
      samples.length,
    );

  channelData.set(samples);

  audioBuffer.copyToChannel(
    channelData,
    0,
  );

  void context.close();

  return audioBuffer;
}

/* -------------------------------------------------------------------------- */
/* Model inspection                                                           */
/* -------------------------------------------------------------------------- */

export interface OnnxModelInfo {
  name: string;
  inputs: readonly string[];
  outputs: readonly string[];
}

export async function inspectAquaPlanetModels(): Promise<
  Record<string, OnnxModelInfo>
> {
  const models = {
    linguistic:
      MODEL_PATHS.linguistic,
    duration:
      MODEL_PATHS.duration,
    pitch:
      MODEL_PATHS.pitch,
    variance:
      MODEL_PATHS.variance,
    acoustic:
      MODEL_PATHS.acoustic,
    vocoder:
      MODEL_PATHS.vocoder,
  } as const;

  const result: Record<
    string,
    OnnxModelInfo
  > = {};

  for (
    const [name, path] of Object.entries(
      models,
    )
  ) {
    const session =
      await loadSession(path);

    result[name] = {
      name,
      inputs:
        session.inputNames,
      outputs:
        session.outputNames,
    };

    await session.release();
  }

  return result;
}

/* -------------------------------------------------------------------------- */
/* Linguistic model                                                           */
/* -------------------------------------------------------------------------- */

async function runLinguisticModel(
  session: ort.InferenceSession,
  phonemes: InternalPhoneme[],
): Promise<{
  encoderOut: ort.Tensor;
  xMasks?: ort.Tensor;
}> {
  const tokens =
    phonemes.map(
      (phoneme) =>
        phoneme.token,
    );

  /*
   * OpenUtau와 동일하게
   * word_div는 음표별 phoneme 개수,
   * word_dur는 각 음표의 frame duration이다.
   */
  const wordDiv =
    new Array<number>();

  const wordDur =
    new Array<number>();

  let currentNote = -1;
  let currentStart = 0;

  phonemes.forEach(
    (phoneme, index) => {
      if (
        currentNote === -1
      ) {
        currentNote =
          phoneme.noteIndex;

        currentStart = index;
      }

      if (
        phoneme.noteIndex !==
        currentNote
      ) {
        wordDiv.push(
          index -
            currentStart,
        );

        wordDur.push(
          phonemes
            .slice(
              currentStart,
              index,
            )
            .reduce(
              (
                sum,
                item,
              ) =>
                sum +
                Math.max(
                  1,
                  Math.round(
                    item.durationSec *
                      DEFAULT_SAMPLE_RATE /
                      DEFAULT_HOP_SIZE,
                  ),
                ),
              0,
            ),
        );

        currentNote =
          phoneme.noteIndex;

        currentStart =
          index;
      }

    },
  );

  if (
    phonemes.length > 0
  ) {
    wordDiv.push(
      phonemes.length -
        currentStart,
    );

    wordDur.push(
      phonemes
        .slice(currentStart)
        .reduce(
          (
            sum,
            item,
          ) =>
            sum +
            Math.max(
              1,
              Math.round(
                item.durationSec *
                  DEFAULT_SAMPLE_RATE /
                  DEFAULT_HOP_SIZE,
              ),
            ),
          0,
        ),
    );
  }

  const inputs: Record<
    string,
    ort.Tensor
  > = {};

  if (
    session.inputNames.includes(
      'tokens',
    )
  ) {
    inputs.tokens =
      makeInt64Tensor(
        tokens,
      );
  }

  if (
    session.inputNames.includes(
      'word_div',
    )
  ) {
    inputs.word_div =
      makeInt64Tensor(
        wordDiv,
      );
  }

  if (
    session.inputNames.includes(
      'word_dur',
    )
  ) {
    inputs.word_dur =
      makeInt64Tensor(
        wordDur,
      );
  }

  if (
    session.inputNames.includes(
      'languages',
    )
  ) {
    inputs.languages =
      makeInt64Tensor(
        phonemes.map(
          (phoneme) =>
            phoneme.languageId,
        ),
      );
  }

  console.info(
    '[Aqua Planet] linguistic inputs',
    session.inputNames,
  );

  const result =
    await session.run(inputs);

  const encoderOut =
    getOutputTensor(
      result,
      ['encoder_out'],
    );

  const xMasks =
    result.x_masks;

  return {
    encoderOut,
    xMasks,
  };
}

/* -------------------------------------------------------------------------- */
/* Duration model                                                             */
/* -------------------------------------------------------------------------- */

async function runDurationModel(
  session: ort.InferenceSession,
  linguistic: {
    encoderOut: ort.Tensor;
    xMasks?: ort.Tensor;
  },
  phonemes: InternalPhoneme[],
  speakerEmbedding: Float32Array,
): Promise<number[]> {
  const inputs: Record<string, ort.Tensor> = {};

  if (session.inputNames.includes('encoder_out')) {
    inputs.encoder_out =
      linguistic.encoderOut;
  }

  if (
    session.inputNames.includes('x_masks') &&
    linguistic.xMasks
  ) {
    inputs.x_masks =
      linguistic.xMasks;
  }

  if (session.inputNames.includes('ph_midi')) {
    inputs.ph_midi =
      makeInt64Tensor(
        phonemes.map(
          (phoneme) => phoneme.midi,
        ),
      );
  }

if (session.inputNames.includes('languages')) {
  inputs.languages = makeInt64Tensor(
    phonemes.map((phoneme) => phoneme.languageId),
  );
}

  if (session.inputNames.includes('spk_embed')) {
    const phonemeCount =
      phonemes.length;

    const embedDim =
      speakerEmbedding.length;

    const data =
      new Float32Array(
        phonemeCount * embedDim,
      );

    for (
      let phoneIndex = 0;
      phoneIndex < phonemeCount;
      phoneIndex++
    ) {
      for (
        let embedIndex = 0;
        embedIndex < embedDim;
        embedIndex++
      ) {
        data[
          phoneIndex * embedDim +
          embedIndex
        ] =
          speakerEmbedding[embedIndex];
      }
    }

    inputs.spk_embed =
      new ort.Tensor(
        'float32',
        data,
        [
          1,
          phonemeCount,
          embedDim,
        ],
      );

    console.log(
      '[Aqua Planet] duration spk_embed',
      {
        shape: [
          1,
          phonemeCount,
          embedDim,
        ],
        phonemeCount,
        embedDim,
      },
    );
  }

  console.info(
    '[Aqua Planet] duration inputs',
    {
      names: session.inputNames,
      shapes: Object.fromEntries(
        Object.entries(inputs).map(
          ([name, tensor]) => [
            name,
            tensor.dims,
          ],
        ),
      ),
    },
  );

  const result =
    await session.run(inputs);

  const output =
    getOutputTensor(
      result,
      [
        'dur',
        'duration',
        'ph_dur',
        'output',
      ],
    );

  return tensorToNumbers(output);
}

/* -------------------------------------------------------------------------- */
/* Acoustic model                                                             */
/* -------------------------------------------------------------------------- */



function buildAcousticInputs(
  session: ort.InferenceSession,
  phonemes: InternalPhoneme[],
  frameData: RenderFrameData,
  speakerEmbedding: Float32Array,
): Record<string, ort.Tensor> {
  const inputs: Record<string, ort.Tensor> = {};

  const tokens = phonemes.map(
    (phoneme) => phoneme.token,
  );

  /*
   * tokens
   */
  if (session.inputNames.includes('tokens')) {
    inputs.tokens = makeInt64Tensor(tokens);
  }

  /*
   * durations
   */
  if (session.inputNames.includes('durations')) {
    inputs.durations = makeInt64Tensor(
      frameData.durations,
    );
  }

  /*
   * F0
   */
  if (session.inputNames.includes('f0')) {
    inputs.f0 = makeFloatTensor(
      frameData.f0,
    );
  }

  /*
   * language
   */
 if (session.inputNames.includes('languages')) {
  inputs.languages = makeInt64Tensor(
    phonemes.map((phoneme) => phoneme.languageId),
  );
}
/*
 * speaker embedding
 *
 * Aqua Planet acoustic 모델
 *
 * [1, totalFrames, embedDim]
 *
 * 예:
 * [1, 51, 256]
 */
if (session.inputNames.includes('spk_embed')) {
  const embedDim =
    speakerEmbedding.length;

  const totalFrames =
    frameData.totalFrames;

  const data =
    new Float32Array(
      totalFrames * embedDim,
    );

  for (
    let frame = 0;
    frame < totalFrames;
    frame++
  ) {
    for (
      let embedIndex = 0;
      embedIndex < embedDim;
      embedIndex++
    ) {
      data[
        frame * embedDim +
        embedIndex
      ] =
        speakerEmbedding[embedIndex];
    }
  }

  inputs.spk_embed =
    new ort.Tensor(
      'float32',
      data,
      [1, totalFrames, embedDim],
    );

  console.log(
    '[Aqua Planet] acoustic spk_embed',
    {
      shape: [
        1,
        totalFrames,
        embedDim,
      ],
      totalFrames,
      embedDim,
    },
  );
}
  /*
   * gender
   *
   * 현재 작곡기에는 gender curve가 없으므로
   * 기본값 0을 사용한다.
   */
  if (session.inputNames.includes('gender')) {
    inputs.gender =
      new ort.Tensor(
        'float32',
        new Float32Array(
          frameData.totalFrames,
        ),
        [1, frameData.totalFrames],
      );
  }

  /*
   * velocity
   *
   * 1.0 = 기본 속도
   */
  if (session.inputNames.includes('velocity')) {
    inputs.velocity =
      new ort.Tensor(
        'float32',
        new Float32Array(
          frameData.totalFrames,
        ).fill(1),
        [1, frameData.totalFrames],
      );
  }

  /*
   * tension
   *
   * variance predictor를 아직 연결하지 않은 상태이므로
   * 우선 기본값 0을 사용한다.
   */
  if (session.inputNames.includes('tension')) {
    inputs.tension =
      new ort.Tensor(
        'float32',
        new Float32Array(
          frameData.totalFrames,
        ),
        [1, frameData.totalFrames],
      );
  }

  /*
   * steps
   */
  if (session.inputNames.includes('steps')) {
    inputs.steps =
    new ort.Tensor(
        'int64',
        BigInt64Array.of(
        BigInt(50),
        ),
        [],
    );
  }

  /*
   * depth
   */
  if (session.inputNames.includes('depth')) {
    inputs.depth =
        new ort.Tensor(
            'float32',
            Float32Array.of(1),
            [],
        );
  }

  /*
   * speedup
   */
  if (session.inputNames.includes('speedup')) {
    inputs.speedup =
      new ort.Tensor(
        'int64',
        BigInt64Array.of(
          BigInt(20),
        ),
        [1],
      );
  }

  return inputs;
}

/* -------------------------------------------------------------------------- */
/* Vocoder                                                                    */
/* -------------------------------------------------------------------------- */

function findVocoderOutput(
  result: Record<
    string,
    ort.Tensor
  >,
): ort.Tensor {
  return getOutputTensor(
    result,
    [
      'waveform',
      'audio',
      'output',
    ],
  );
}

function tensorToAudioSamples(
  tensor: ort.Tensor,
): Float32Array {
  const numbers =
    tensorToNumbers(tensor);

  return Float32Array.from(
    numbers,
  );
}

/* -------------------------------------------------------------------------- */
/* Main renderer                                                              */
/* -------------------------------------------------------------------------- */

export async function renderAquaPlanetVocal(
  notes: VocalNote[],
  options: VocalRenderOptions,
  onProgress?: (
    progress: VocalSynthProgress,
  ) => void,
): Promise<VocalSynthResult> {
  const bpm =
    options.bpm;

  const stepsPerBeat =
    options.stepsPerBeat ??
    DEFAULT_STEPS_PER_BEAT;

  const sampleRate =
    options.sampleRate ??
    DEFAULT_SAMPLE_RATE;

  if (
    !Number.isFinite(bpm) ||
    bpm <= 0
  ) {
    throw new Error(
      `잘못된 BPM입니다: ${bpm}`,
    );
  }

  const normalizedNotes =
    normalizeNotes(notes);

  if (
    normalizedNotes.length === 0
  ) {
    throw new Error(
      '보컬로 생성할 음표가 없습니다.',
    );
  }

  /*
   * 현재 프로젝트의 grid와
   * Aqua Planet의 frame rate를 맞춘다.
   */
  const hopSize =
    DEFAULT_HOP_SIZE;

  onProgress?.({
    stage: 'loading',
    progress: 0,
    message:
      'Aqua Planet 보컬 모델을 불러오는 중...',
  });

  configureOrt();

const lastNote =
  normalizedNotes[
    normalizedNotes.length - 1
  ];

const acousticEndSec =
  stepToSeconds(
    lastNote.startStep +
      lastNote.durationSteps,
    bpm,
    stepsPerBeat,
  );

const acousticTotalFrames =
  Math.max(
    1,
    Math.ceil(
      (acousticEndSec * sampleRate) /
        DEFAULT_HOP_SIZE,
    ),
  );

console.info(
  '[Aqua Planet] acoustic fixed n_frames',
  acousticTotalFrames,
);

const linguisticSession =
  await loadSession(
    MODEL_PATHS.linguistic,
    ['wasm'],
  );

const durationSession =
  await loadSession(
    MODEL_PATHS.duration,
    ['wasm'],
  );

  

const acousticSession = await loadSession(
  MODEL_PATHS.acoustic,
  ['wasm'],   // webgpu → wasm
  // override 인자 제거
);

const vocoderSession =
  await loadSession(
    MODEL_PATHS.vocoder,
    ['wasm'],
  );

const [
  durationSpeakerEmbedding,
  acousticSpeakerEmbedding,
] = await Promise.all([
  loadSpeakerEmbedding(
    MODEL_PATHS.durationSpeaker,
  ),
  loadSpeakerEmbedding(
    MODEL_PATHS.acousticSpeaker,
  ),
]);

  try {
    /*
     * ----------------------------------------------------------------------
     * 1. 음소 준비
     * ----------------------------------------------------------------------
     */

    onProgress?.({
      stage: 'phoneme',
      progress: 0.1,
      message:
        '가사를 Aqua Planet 음소로 변환하는 중...',
    });

    const [
      phonemeMap,
      languageMap,
      dictionary,
    ] = await Promise.all([
      loadPhonemeMap(),
      loadLanguageMap(),
      loadKoreanDictionary(),
    ]);

    console.info(
    '[Aqua Planet] Korean dictionary',
    {
        size: dictionary.size,
    },
    );

    const phonemesPerNote =
      await Promise.all(
        normalizedNotes.map(
          (note) =>
            lyricToPhonemes(
              note.lyric,
              dictionary,
              phonemeMap,
            ),
        ),
      );

    const internalPhonemes =
      buildPhonemes(
        normalizedNotes,
        phonemesPerNote,
        phonemeMap,
        languageMap,
        bpm,
        stepsPerBeat,
      );

    if (
      internalPhonemes.length === 0
    ) {
      throw new Error(
        '생성할 수 있는 음소가 없습니다.',
      );
    }

    console.info(
      '[Aqua Planet] phonemes',
      internalPhonemes.map(
        (phoneme) => ({
          symbol:
            phoneme.symbol,
          token:
            phoneme.token,
          midi:
            phoneme.midi,
        }),
      ),
    );

  

    /*
     * ----------------------------------------------------------------------
     * 2. Linguistic encoder
     * ----------------------------------------------------------------------
     */

    onProgress?.({
      stage: 'duration',
      progress: 0.25,
      message:
        '언어 정보를 분석하고 음소 길이를 계산하는 중...',
    });

    const linguistic =
      await runLinguisticModel(
        linguisticSession,
        internalPhonemes,
      );

    /*
     * ----------------------------------------------------------------------
     * 3. Duration predictor
     * ----------------------------------------------------------------------
     */

    let predictedDurations: number[] =
      [];

    try {
      predictedDurations =
        await runDurationModel(
          durationSession,
          linguistic,
          internalPhonemes,
          durationSpeakerEmbedding,
        );

      console.info(
        '[Aqua Planet] predicted durations',
        predictedDurations,
      );
    } catch (error) {
      /*
       * 모델별 duration output 구조가 다를 경우
       * 작곡 grid duration을 fallback으로 사용한다.
       */
      console.warn(
        '[Aqua Planet] duration predictor failed; using composer timing.',
        error,
      );
    }

    /*
     * 현재 버전에서는 작곡 화면의 음표 길이를
     * 최종 singing timing의 기준으로 사용한다.
     *
     * 이렇게 해야 사용자가 배치한 MIDI timing과
     * 생성된 보컬 timing이 정확히 일치한다.
     */
    const frameData =
      buildFrameData(
        normalizedNotes,
        internalPhonemes,
        sampleRate,
        hopSize,
        bpm,
        stepsPerBeat,
      );

    /*
     * duration predictor가 유효한 frame 수를
     * 반환했다면 로그만 남긴다.
     *
     * 향후 OpenUtau식 phoneme alignment를 넣을 때
     * 이 값을 실제 durations에 적용한다.
     */
    if (
      predictedDurations.length > 0
    ) {
      console.info(
        '[Aqua Planet] duration prediction available:',
        predictedDurations.length,
      );
    }

    /*
     * ----------------------------------------------------------------------
     * 4. Acoustic model
     * ----------------------------------------------------------------------
     */

    onProgress?.({
      stage: 'pitch',
      progress: 0.4,
      message:
        '작곡된 MIDI 음정으로 F0 곡선을 만드는 중...',
    });

    /*
     * pitch.onnx를 직접 예측시키지 않고
     * 작곡 화면의 MIDI pitch를 F0로 변환한다.
     *
     * 사용자가 작곡한 음정을 정확하게 유지하기 위한
     * 의도적인 선택이다.
     */

    onProgress?.({
      stage: 'acoustic',
      progress: 0.6,
      message:
        'Aqua Planet 음향 모델로 보컬을 생성하는 중...',
    });

console.info(
  '[Aqua Planet] acoustic metadata raw',
  JSON.stringify(
    acousticSession.inputMetadata,
    null,
    2,
  ),
);

    const acousticInputs =
    buildAcousticInputs(
        acousticSession,
        internalPhonemes,
        frameData,
        acousticSpeakerEmbedding,
    );
    console.info(
  '[Aqua Planet] acoustic input shapes',
  Object.keys(acousticInputs).map(
    (name) => [
      name,
      acousticInputs[name].dims,
    ],
  ),
);
    /*
     * 모델이 요구하는 입력을 확인한다.
     */
    const missingAcousticInputs =
      acousticSession.inputNames.filter(
        (name) =>
          !acousticInputs[name],
      );

    if (
      missingAcousticInputs.length > 0
    ) {
      throw new Error(
        `Aqua Planet acoustic.onnx가 요구하는 입력을 만들지 못했습니다: ${missingAcousticInputs.join(', ')}`,
      );
    }

    console.info(
      '[Aqua Planet] acoustic inputs',
      acousticSession.inputNames,
      Object.fromEntries(
        Object.entries(
          acousticInputs,
        ).map(
          ([name, tensor]) => [
            name,
            tensorShape(tensor),
          ],
        ),
      ),
    );

const durationTensor =
  acousticInputs.durations;

const f0Tensor =
  acousticInputs.f0;

console.info(
  '[Aqua Planet] acoustic timing check',
  {
    durationShape:
      durationTensor?.dims,
    durationValues:
      durationTensor
        ? tensorToNumbers(durationTensor)
        : null,
    f0Shape:
      f0Tensor?.dims,
    f0Length:
      f0Tensor?.data.length,
    totalFrames:
      frameData.totalFrames,
  },
);

const dimsLog = Object.fromEntries(
  Object.entries(acousticInputs).map(([k, t]) => [k, t.dims.join('x')]),
);
console.info('[Aqua Planet] acoustic dims', JSON.stringify(dimsLog));

const durSum = tensorToNumbers(acousticInputs.durations)
  .reduce((a, b) => a + b, 0);
console.info('[Aqua Planet] durations sum vs n_frames', durSum, acousticInputs.f0.dims[1]);
    const acousticResult =
    
      await acousticSession.run(
        acousticInputs,
      );

    const mel =
      getOutputTensor(
        acousticResult,
        [
          'mel',
          'mel_out',
          'output',
        ],
      );

    console.info(
      '[Aqua Planet] acoustic output',
      mel.dims,
    );

    /*
     * ----------------------------------------------------------------------
     * 5. NSF-HiFiGAN vocoder
     * ----------------------------------------------------------------------
     */

    onProgress?.({
      stage: 'vocoder',
      progress: 0.8,
      message:
        'NSF-HiFiGAN으로 실제 음성 파형을 생성하는 중...',
    });

    const vocoderInputs: Record<
      string,
      ort.Tensor
    > = {};

    /*
     * OpenVPI NSF-HiFiGAN의 기본 입력은
     * mel + f0이다.
     */
    if (
      vocoderSession.inputNames.includes(
        'mel',
      )
    ) {
      vocoderInputs.mel =
        mel;
    }

    if (
      vocoderSession.inputNames.includes(
        'f0',
      )
    ) {
      vocoderInputs.f0 =
        makeFloatTensor(
          frameData.f0,
        );
    }

    /*
     * 혹시 모델이 다른 이름을 사용하는 경우
     * 첫 번째/두 번째 입력을 안전하게 연결한다.
     */
    const vocoderInputNames =
      vocoderSession.inputNames;

    if (
      vocoderInputNames.length >= 1 &&
      !vocoderInputs[
        vocoderInputNames[0]
      ]
    ) {
      vocoderInputs[
        vocoderInputNames[0]
      ] = mel;
    }

    if (
      vocoderInputNames.length >= 2 &&
      !vocoderInputs[
        vocoderInputNames[1]
      ]
    ) {
      vocoderInputs[
        vocoderInputNames[1]
      ] =
        makeFloatTensor(
          frameData.f0,
        );
    }

    console.info(
      '[Aqua Planet] vocoder inputs',
      vocoderSession.inputNames,
      Object.fromEntries(
        Object.entries(
          vocoderInputs,
        ).map(
          ([name, tensor]) => [
            name,
            tensorShape(tensor),
          ],
        ),
      ),
    );

    const missingVocoderInputs =
      vocoderSession.inputNames.filter(
        (name) =>
          !vocoderInputs[name],
      );

    if (
      missingVocoderInputs.length > 0
    ) {
      throw new Error(
        `NSF-HiFiGAN이 요구하는 입력을 만들지 못했습니다: ${missingVocoderInputs.join(', ')}`,
      );
    }

    const vocoderResult =
      await vocoderSession.run(
        vocoderInputs,
      );

    const waveformTensor =
      findVocoderOutput(
        vocoderResult,
      );

    const samples =
      tensorToAudioSamples(
        waveformTensor,
      );

    if (
      samples.length === 0
    ) {
      throw new Error(
        'NSF-HiFiGAN에서 음성 파형이 생성되지 않았습니다.',
      );
    }

    /*
     * 아주 큰 값이 발생할 경우 clipping을 방지한다.
     */
    let peak = 0;

    for (
      let i = 0;
      i < samples.length;
      i++
    ) {
      peak = Math.max(
        peak,
        Math.abs(
          samples[i],
        ),
      );
    }

    if (
      peak > 1
    ) {
      const scale =
        0.98 / peak;

      for (
        let i = 0;
        i < samples.length;
        i++
      ) {
        samples[i] *=
          scale;
      }
    }

    const blob =
      float32ToWavBlob(
        samples,
        sampleRate,
      );

    const audioBuffer =
      createAudioBuffer(
        samples,
        sampleRate,
      );

    onProgress?.({
      stage: 'complete',
      progress: 1,
      message:
        '보컬 생성이 완료되었습니다.',
    });

    return {
      blob,
      audioBuffer,
      sampleRate,
    };
  } finally {
    await Promise.all([
      linguisticSession.release(),
      durationSession.release(),
      acousticSession.release(),
      vocoderSession.release(),
    ]);
  }
}

/* -------------------------------------------------------------------------- */
/* Composer adapter                                                           */
/* -------------------------------------------------------------------------- */

export function notesFromComposer(
  notes: Array<{
    row: number;
    col: number;
    note: string;
    length: number;
    lyric?: string;
  }>,
  melodyNotes: readonly string[],
): VocalNote[] {
  return notes.map(
    (item) => ({
      pitch:
        item.note ||
        melodyNotes[item.row] ||
        '',
      midi: noteNameToMidi(
        item.note ||
          melodyNotes[item.row] ||
          '',
      ),
      startStep:
        item.col,
      durationSteps:
        Math.max(
          1,
          item.length,
        ),
      lyric:
        item.lyric ?? '',
    }),
  );
}

export function noteNameToMidi(
  note: string,
): number {
  const match =
    note
      .trim()
      .match(
        /^([A-Ga-g])([#b]?)(-?\d+)$/,
      );

  if (!match) {
    throw new Error(
      `알 수 없는 음 이름입니다: ${note}`,
    );
  }

  const [
    ,
    letter,
    accidental,
    octaveText,
  ] = match;

  const base: Record<
    string,
    number
  > = {
    C: 0,
    D: 2,
    E: 4,
    F: 5,
    G: 7,
    A: 9,
    B: 11,
  };

  let semitone =
    base[
      letter.toUpperCase()
    ];

  if (
    accidental === '#'
  ) {
    semitone += 1;
  } else if (
    accidental === 'b'
  ) {
    semitone -= 1;
  }

  const octave =
    Number(octaveText);

  return (
    (octave + 1) * 12 +
    semitone
  );
}

export {
  MODEL_PATHS,
  DEFAULT_SAMPLE_RATE,
  DEFAULT_HOP_SIZE,
};
