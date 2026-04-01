export type LessonId =
  | 'songwriting-basics'
  | 'motif-elements'
  | 'piano-roll-basic'
  | 'basic-beat'
  | 'eight-beat'
  | 'clap-groove'
  | 'triad'
  | 'major-progression'
  | 'money-code'
  | 'melody-shape'
  | 'rhythm-melody'
  | 'arrangement';

export type LessonSectionTitle =
  | '기초'
  | '리듬'
  | '코드'
  | '멜로디'
  | '완성하기';

export type LessonTone = 'cyan' | 'orange' | 'lime' | 'gold' | 'rose';

export type Lesson = {
  id: LessonId;
  label: string;
  section: LessonSectionTitle;
  title: string;
  summary: string;
  examples: Array<{ progression: string; reference: string }>;
  focusTitle: string;
  focusBody: string;
  tempo: number;
  grid: boolean[][];
};

export type LessonSection = {
  title: LessonSectionTitle;
  lessons: LessonId[];
};

export const NOTE_ROWS = ['B', 'A', 'G', 'F', 'E', 'D', 'C'];

export const LESSON_LIBRARY: Record<LessonId, Lesson> = {
  'songwriting-basics': {
    id: 'songwriting-basics',
    label: '작곡의 정의',
    section: '기초',
    title: '작곡은 어디서부터 시작할까?',
    summary:
      '작곡은 영감을 기다리는 일보다 반복 가능한 선택을 쌓는 과정에 더 가깝습니다. 리듬, 화성, 멜로디 중 무엇을 먼저 고르느냐에 따라 곡의 방향이 달라집니다.',
    examples: [
      { progression: '리듬 → 코드 → 멜로디', reference: '가장 빠르게 틀을 만드는 방식' },
      { progression: '멜로디 → 코드 → 편곡', reference: '후렴이 먼저 떠오를 때 유리' },
      { progression: '코드 → 리듬 → 멜로디', reference: '발라드와 팝에서 자주 쓰는 순서' },
    ],
    focusTitle: '짧은 구간을 먼저 완성하기',
    focusBody:
      '8마디나 후렴 한 덩어리처럼 짧은 단위를 먼저 끝내면 전체 곡도 훨씬 쉽게 연결됩니다. 학습 단계에서는 완벽한 한 곡보다 반복 가능한 한 패턴을 먼저 익히는 것이 더 중요합니다.',
    tempo: 112,
    grid: [
      [false, true, false, true],
      [false, false, true, false],
      [true, false, true, false],
      [true, true, false, true],
      [false, true, false, true],
      [false, false, true, false],
      [true, false, true, true],
    ],
  },
  'motif-elements': {
    id: 'motif-elements',
    label: '소재의 3요소',
    section: '기초',
    title: '좋은 소재는 무엇으로 이루어질까?',
    summary:
      '짧은 훅 하나도 리듬, 음정, 반복 구조라는 세 가지 요소로 나눠 볼 수 있습니다. 이 세 개를 따로 조절하면 아이디어를 훨씬 오래 끌고 갈 수 있습니다.',
    examples: [
      { progression: '리듬', reference: '같은 음이어도 박자가 달라지면 완전히 다른 훅이 됩니다.' },
      { progression: '음정', reference: '큰 도약보다 순차 진행이 더 쉽게 기억됩니다.' },
      { progression: '반복', reference: '두 번 반복 후 한 번만 바꿔도 안정감이 생깁니다.' },
    ],
    focusTitle: '반복 후 변주가 가장 안전하다',
    focusBody:
      '처음부터 새로운 아이디어를 계속 추가하기보다 같은 동기를 반복하고 마지막 한 부분만 바꾸는 방식이 완성도를 높여줍니다. 대중적인 멜로디 대부분이 이 원리를 사용합니다.',
    tempo: 100,
    grid: [
      [true, false, false, true],
      [false, true, false, false],
      [true, false, true, false],
      [false, true, false, true],
      [false, false, true, false],
      [true, false, false, true],
      [false, true, true, false],
    ],
  },
  'piano-roll-basic': {
    id: 'piano-roll-basic',
    label: '피아노 롤 기초',
    section: '기초',
    title: '피아노 롤은 악보보다 단순하다',
    summary:
      '가로축은 시간, 세로축은 음 높이입니다. 이 두 축만 이해하면 코드 배치와 멜로디 편집을 훨씬 직관적으로 볼 수 있습니다.',
    examples: [
      { progression: '가로로 길다', reference: '길게 유지되는 음입니다.' },
      { progression: '세로로 쌓인다', reference: '동시에 눌리는 코드입니다.' },
      { progression: '짧게 반복된다', reference: '리듬감 있는 아르페지오나 베이스 패턴입니다.' },
    ],
    focusTitle: '시간과 음높이를 분리해서 보기',
    focusBody:
      '처음엔 음 이름보다 모양을 먼저 읽는 편이 쉽습니다. 먼저 배치 패턴을 익히고, 그다음 화성 이름과 연결하면 훨씬 빠르게 적응할 수 있습니다.',
    tempo: 118,
    grid: [
      [false, true, true, false],
      [false, true, false, true],
      [true, false, true, false],
      [true, false, false, true],
      [false, true, true, false],
      [true, false, false, true],
      [false, true, false, true],
    ],
  },
  'basic-beat': {
    id: 'basic-beat',
    label: '기본 비트',
    section: '리듬',
    title: '기본 비트만으로도 곡의 인상이 달라진다',
    summary:
      '킥과 스네어의 위치만 바꿔도 같은 코드 진행이 전혀 다르게 느껴집니다. 리듬을 먼저 정하면 장르 선택이 쉬워집니다.',
    examples: [
      { progression: '킥 1, 3 / 스네어 2, 4', reference: '가장 안정적인 팝 비트' },
      { progression: '킥 1, 2&, 3 / 스네어 2, 4', reference: '더 밀어붙이는 인상' },
      { progression: '스네어를 뒤로 미루기', reference: '느긋하고 묵직한 분위기' },
    ],
    focusTitle: '코드보다 먼저 박을 고르기',
    focusBody:
      '리듬이 정해지면 악기 배치와 보이싱도 자연스럽게 따라옵니다. 초반에는 네 박자 골격만 잡아도 곡의 성격이 생각보다 분명하게 드러납니다.',
    tempo: 124,
    grid: [
      [false, false, true, false],
      [false, true, false, true],
      [true, false, true, false],
      [false, true, false, true],
      [true, false, false, false],
      [false, true, true, false],
      [true, false, false, true],
    ],
  },
  'eight-beat': {
    id: 'eight-beat',
    label: '8비트 리듬',
    section: '리듬',
    title: '8비트는 가장 익숙한 기본 그루브다',
    summary:
      '8비트 리듬은 대부분의 팝과 록에서 기본 뼈대로 쓰입니다. 악센트를 어디에 두느냐만으로도 활기와 무게가 달라집니다.',
    examples: [
      { progression: '모든 박을 균등하게', reference: '가장 담백한 전개' },
      { progression: '2와 4를 강조', reference: '몸이 먼저 반응하는 형태' },
      { progression: '업비트 살리기', reference: '좀 더 경쾌한 흐름' },
    ],
    focusTitle: '강세를 하나만 바꿔도 충분하다',
    focusBody:
      '처음부터 복잡한 셔플이나 싱코페이션을 쓰기보다, 8비트 안에서 한 박만 강하게 주는 편이 훨씬 안정적입니다. 리듬의 선명함이 곡의 집중도를 결정합니다.',
    tempo: 123,
    grid: [
      [true, false, true, false],
      [false, true, false, true],
      [true, true, false, false],
      [false, true, true, false],
      [true, false, false, true],
      [false, true, false, true],
      [true, false, true, false],
    ],
  },
  'clap-groove': {
    id: 'clap-groove',
    label: '클랩과 리듬',
    section: '리듬',
    title: '클랩은 리듬의 중심을 잡아준다',
    summary:
      '하이햇보다 클랩이 먼저 들리는 순간 청자는 곡의 중심 박을 더 쉽게 느낍니다. 후렴으로 넘어갈수록 클랩의 존재감이 중요해집니다.',
    examples: [
      { progression: '2, 4 박 고정', reference: '가장 익숙한 손뼉 위치' },
      { progression: '후렴에서만 추가', reference: '다이내믹 차이를 만들기 쉬움' },
      { progression: '리버브를 길게', reference: '공간감이 필요한 장르에 유리' },
    ],
    focusTitle: '보컬과 겹치지 않는 위치에 두기',
    focusBody:
      '클랩은 존재감이 강해서 보컬 중심 구간에 과하게 겹치면 산만해질 수 있습니다. 벌스보다 프리코러스나 후렴에서 살짝 올리는 편이 더 효과적입니다.',
    tempo: 126,
    grid: [
      [false, true, false, true],
      [true, false, true, false],
      [false, true, true, false],
      [true, false, false, true],
      [false, true, false, true],
      [true, false, true, false],
      [false, true, false, true],
    ],
  },
  triad: {
    id: 'triad',
    label: '3화음',
    section: '코드',
    title: '3화음은 모든 코드 학습의 시작점이다',
    summary:
      '루트, 3도, 5도만으로 이루어진 3화음은 가장 기본적인 코드 구조입니다. 메이저와 마이너의 성격 차이도 여기서 시작됩니다.',
    examples: [
      { progression: 'C-E-G', reference: '메이저 3화음의 가장 기본형' },
      { progression: 'A-C-E', reference: '마이너 3화음의 대표 예시' },
      { progression: '전위형 활용', reference: '베이스를 바꾸면 흐름이 부드러워짐' },
    ],
    focusTitle: '코드는 모양으로 먼저 외우기',
    focusBody:
      '이론 용어에 매달리기보다 피아노 롤에서 일정한 간격으로 쌓이는 모양을 먼저 익히는 편이 훨씬 빠릅니다. 익숙해지면 이름은 자연스럽게 따라옵니다.',
    tempo: 115,
    grid: [
      [true, false, false, true],
      [false, false, true, false],
      [true, false, false, true],
      [false, true, false, false],
      [true, false, true, false],
      [false, true, false, true],
      [true, false, false, true],
    ],
  },
  'major-progression': {
    id: 'major-progression',
    label: '메이저 코드 진행',
    section: '코드',
    title: '메이저 코드 진행은 익숙함을 만든다',
    summary:
      'I, IV, V를 중심으로 한 메이저 진행은 가장 대중적인 안정감을 줍니다. 여기에 vi나 ii를 추가하면 감정의 폭이 넓어집니다.',
    examples: [
      { progression: 'I - IV - V - I', reference: '가장 전통적인 종지감' },
      { progression: 'I - V - vi - IV', reference: '현대 팝에서 가장 자주 들리는 흐름' },
      { progression: 'I - vi - IV - V', reference: '더 서정적인 느낌' },
    ],
    focusTitle: '중심이 되는 자리는 항상 I이다',
    focusBody:
      '코드가 아무리 돌아다녀도 청자가 다시 안착하는 자리가 있어야 곡이 편안하게 들립니다. 메이저 진행을 공부할 때는 항상 I로 돌아오는 감각을 먼저 익혀보세요.',
    tempo: 121,
    grid: [
      [false, false, true, false],
      [true, false, false, true],
      [false, true, false, false],
      [true, false, true, false],
      [false, true, false, true],
      [true, false, false, true],
      [false, true, true, false],
    ],
  },
  'money-code': {
    id: 'money-code',
    label: '머니 코드',
    section: '코드',
    title: '머니 코드란?',
    summary:
      '수많은 히트곡을 탄생시켜 돈이 되는 코드라 불리는 검증된 진행입니다. 이 공식 위에 멜로디를 얹기만 해도, 실패 없는 근사한 곡이 완성됩니다.',
    examples: [
      { progression: 'I - V - vi - iii', reference: 'Johann Pachelbel - Canon' },
      { progression: 'I - V - vi - IV', reference: 'The Beatles - Let It Be' },
      { progression: 'I - vi - IV - V', reference: 'Ben E. King - Stand By Me' },
    ],
    focusTitle: 'I-V-vi-iii',
    focusBody:
      '"캐논형"에서 유래한 진행으로, 마룬5의 Memories나 너에게 난, 나에게 넌 같은 곡에서도 익숙하게 들립니다. C - G - Am - Em 순이며 서정적이면서도 안정적인 감정을 만들어줍니다.',
    tempo: 123,
    grid: [
      [false, true, false, true],
      [false, false, true, false],
      [true, true, false, true],
      [false, false, false, false],
      [true, false, false, true],
      [true, false, true, false],
      [false, true, false, false],
    ],
  },
  'melody-shape': {
    id: 'melody-shape',
    label: '멜로디 만들기',
    section: '멜로디',
    title: '좋은 멜로디는 움직임이 선명하다',
    summary:
      '멜로디는 높은 음을 많이 쓰는 것이 아니라 긴장과 해소의 방향이 분명할 때 더 잘 기억됩니다. 한 구절 안에서도 시작과 도착 지점을 의식해 보세요.',
    examples: [
      { progression: '상행 후 하행', reference: '가장 자연스러운 긴장-해소 패턴' },
      { progression: '반복 후 한 번 도약', reference: '후렴에 자주 쓰이는 구조' },
      { progression: '짧게 끊고 길게 마무리', reference: '가사 전달이 쉬워짐' },
    ],
    focusTitle: '후렴은 도착감이 중요하다',
    focusBody:
      '벌스에서 모아둔 긴장을 후렴 첫 음에서 풀어주면 멜로디가 훨씬 시원하게 들립니다. 높은 음보다 도착 위치를 분명히 잡는 편이 더 중요합니다.',
    tempo: 118,
    grid: [
      [false, true, false, false],
      [true, false, false, true],
      [false, true, true, false],
      [true, false, false, true],
      [false, false, true, false],
      [true, false, false, true],
      [false, true, false, false],
    ],
  },
  'rhythm-melody': {
    id: 'rhythm-melody',
    label: '리듬과 멜로디',
    section: '멜로디',
    title: '멜로디보다 먼저 귀에 남는 것은 리듬이다',
    summary:
      '멜로디의 높낮이보다 리듬 패턴이 먼저 기억되는 경우가 많습니다. 음은 비슷해도 리듬만 바꾸면 완전히 다른 훅처럼 느껴질 수 있습니다.',
    examples: [
      { progression: '짧게-짧게-길게', reference: '가장 기억하기 쉬운 패턴' },
      { progression: '쉼표 활용', reference: '가사가 더 또렷하게 들림' },
      { progression: '업비트 진입', reference: '더 세련된 인상을 줌' },
    ],
    focusTitle: '한 마디 안에서 박자 중심 잡기',
    focusBody:
      '아무리 좋은 음정도 박에 안착하지 못하면 불안하게 들릴 수 있습니다. 특히 초보 단계에서는 음의 개수를 줄이고 리듬의 중심을 먼저 세우는 편이 더 효과적입니다.',
    tempo: 127,
    grid: [
      [true, false, true, false],
      [false, false, true, true],
      [true, false, false, true],
      [false, true, false, false],
      [true, false, true, false],
      [false, true, false, true],
      [true, false, false, false],
    ],
  },
  arrangement: {
    id: 'arrangement',
    label: '폼과 구조',
    section: '완성하기',
    title: '곡을 끝까지 가게 만드는 것은 구조다',
    summary:
      '좋은 아이디어가 있어도 벌스, 프리코러스, 후렴의 밀도 차이가 없으면 곡이 평면적으로 느껴질 수 있습니다. 섹션별 역할을 나누는 것이 완성의 핵심입니다.',
    examples: [
      { progression: '벌스는 비우기', reference: '후렴 대비를 만들기 쉬움' },
      { progression: '프리코러스는 긴장 축적', reference: '후렴 진입을 기대하게 만듦' },
      { progression: '후렴은 반복과 확장', reference: '가장 기억에 남는 구간' },
    ],
    focusTitle: '비우는 구간이 있어야 채우는 구간이 산다',
    focusBody:
      '모든 섹션을 세게 만들면 오히려 후렴의 존재감이 약해집니다. 악기 수, 리듬 밀도, 음역을 나눠서 섹션별 차이를 분명하게 만드는 것이 완성도를 높입니다.',
    tempo: 116,
    grid: [
      [false, false, true, false],
      [true, false, false, false],
      [false, true, false, true],
      [true, false, true, false],
      [false, true, false, false],
      [true, false, false, true],
      [false, true, true, false],
    ],
  },
};

export const LESSON_SECTIONS: LessonSection[] = [
  {
    title: '기초',
    lessons: ['songwriting-basics', 'motif-elements', 'piano-roll-basic'],
  },
  {
    title: '리듬',
    lessons: ['basic-beat', 'eight-beat', 'clap-groove'],
  },
  {
    title: '코드',
    lessons: ['triad', 'major-progression', 'money-code'],
  },
  {
    title: '멜로디',
    lessons: ['melody-shape', 'rhythm-melody'],
  },
  {
    title: '완성하기',
    lessons: ['arrangement'],
  },
];

export const SECTION_META: Record<
  LessonSectionTitle,
  {
    tone: LessonTone;
    eyebrow: string;
    description: string;
    pointers: string[];
  }
> = {
  기초: {
    tone: 'cyan',
    eyebrow: 'Starter Lab',
    description: '작곡을 시작할 때 필요한 감각을 먼저 다지는 단계입니다.',
    pointers: ['작은 단위부터 끝내기', '모양으로 이해하기', '반복 구조 익히기'],
  },
  리듬: {
    tone: 'orange',
    eyebrow: 'Groove Builder',
    description: '박자와 악센트만으로도 곡의 성격이 달라지는 흐름을 익힙니다.',
    pointers: ['킥과 스네어의 중심 찾기', '강세는 적게 바꾸기', '후렴에 밀도 올리기'],
  },
  코드: {
    tone: 'lime',
    eyebrow: 'Harmony Toolkit',
    description: '검증된 코드 진행과 보이싱 감각을 자연스럽게 익히는 구간입니다.',
    pointers: ['기본 진행 먼저 익히기', '도착감이 있는 코드 보기', '전위형으로 부드럽게 잇기'],
  },
  멜로디: {
    tone: 'gold',
    eyebrow: 'Hook Design',
    description: '음의 높낮이와 리듬을 묶어 기억에 남는 훅을 만드는 방법을 다룹니다.',
    pointers: ['도착 지점 먼저 잡기', '짧은 패턴 반복하기', '리듬으로 먼저 기억시키기'],
  },
  완성하기: {
    tone: 'rose',
    eyebrow: 'Finish Line',
    description: '섹션을 나누고 곡을 끝까지 가져가는 구조 감각을 정리합니다.',
    pointers: ['비우는 구간 만들기', '후렴 대비 키우기', '폼을 먼저 설계하기'],
  },
};
