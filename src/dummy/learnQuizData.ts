import type { LessonId } from './learnData';

export type LessonQuiz = {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
};

export const LESSON_QUIZZES: Record<LessonId, LessonQuiz> = {
  'songwriting-basics': {
    question: '작곡을 시작할 때 가장 먼저 정하면 좋은 것은 무엇인가요?',
    options: ['곡 전체 믹싱', '작업 범위와 방향', '마스터링 체인'],
    correctIndex: 1,
    explanation: '처음에는 8마디 정도의 작업 범위와 방향을 먼저 정해야 곡이 덜 흔들립니다.',
  },
  'motif-elements': {
    question: '모티프를 오래 기억되게 만드는 핵심 조합은 무엇인가요?',
    options: ['반복과 작은 변화', '항상 높은 음역', '복잡한 코드만 사용'],
    correctIndex: 0,
    explanation: '반복 속에 한두 군데만 바꾸는 방식이 가장 기억에 오래 남습니다.',
  },
  'piano-roll-basic': {
    question: '피아노 롤에서 세로축이 의미하는 것은 무엇인가요?',
    options: ['볼륨', '음높이', '리버브 양'],
    correctIndex: 1,
    explanation: '가로축은 시간, 세로축은 음높이입니다.',
  },
  'basic-beat': {
    question: '기본 비트에서 가장 먼저 고정하면 좋은 요소는 무엇인가요?',
    options: ['스네어 위치', '마스터 EQ', '코드 보이싱'],
    correctIndex: 0,
    explanation: '킥과 스네어의 기본 위치를 먼저 고정하면 리듬 방향이 빨리 잡힙니다.',
  },
  'eight-beat': {
    question: '8비트 리듬에서 분위기를 가장 크게 바꾸는 요소는 무엇인가요?',
    options: ['강세 위치', '곡 제목', '모니터 스피커'],
    correctIndex: 0,
    explanation: '같은 8비트라도 어느 박을 강조하느냐에 따라 인상이 크게 달라집니다.',
  },
  'clap-groove': {
    question: '클랩 리듬을 쓸 때 먼저 확인해야 하는 것은 무엇인가요?',
    options: ['보컬과 겹치는지', '템포가 200인지', '모든 박마다 들어가는지'],
    correctIndex: 0,
    explanation: '클랩이 보컬 중단 구간과 겹치지 않게 자리를 찾는 것이 중요합니다.',
  },
  triad: {
    question: '3화음의 기본 구성은 무엇인가요?',
    options: ['루트, 3도, 5도', '루트, 2도, 6도', '루트, 4도, 7도'],
    correctIndex: 0,
    explanation: '루트, 3도, 5도가 가장 기본적인 3화음 구조입니다.',
  },
  'major-progression': {
    question: '메이저 진행에서 안정감을 만드는 중심 코드는 보통 무엇인가요?',
    options: ['iii', 'V', 'I'],
    correctIndex: 2,
    explanation: '메이저 진행은 다시 I로 돌아올 때 안정감이 생깁니다.',
  },
  'money-code': {
    question: '머니 코드로 가장 널리 알려진 진행은 무엇인가요?',
    options: ['I - V - vi - IV', 'ii - V - I', 'I - IV - ii - V'],
    correctIndex: 0,
    explanation: '대중음악에서 가장 자주 쓰이는 대표 진행 중 하나가 I-V-vi-IV입니다.',
  },
  'melody-shape': {
    question: '좋은 멜로디를 만들 때 특히 중요한 것은 무엇인가요?',
    options: ['이펙트 양', '상행과 하행의 방향', '항상 빠른 템포'],
    correctIndex: 1,
    explanation: '멜로디는 음 개수보다 방향과 흐름이 더 중요하게 들립니다.',
  },
  'rhythm-melody': {
    question: '멜로디를 기억하게 만드는 데 더 먼저 잡으면 좋은 것은 무엇인가요?',
    options: ['리듬 패턴', '코러스 이펙트', '악기 수'],
    correctIndex: 0,
    explanation: '음 높이보다 리듬 패턴이 먼저 기억되는 경우가 많습니다.',
  },
  arrangement: {
    question: '편곡에서 섹션 차이를 만드는 가장 쉬운 방법은 무엇인가요?',
    options: ['모든 섹션을 꽉 채우기', '비우는 구간 만들기', '템포를 계속 바꾸기'],
    correctIndex: 1,
    explanation: '비우는 구간이 있어야 채우는 구간이 더 크게 느껴집니다.',
  },
};
