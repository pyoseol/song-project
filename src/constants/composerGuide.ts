export type ComposerGuideFocus =
  | 'tabs'
  | 'mixer'
  | 'melody-chords'
  | 'melody-roll'
  | 'drums-grid'
  | 'bass-grid'
  | 'transport';

export type ComposerGuideStep = {
  id: string;
  title: string;
  focusLabel: string;
  summary: string;
  detail: string;
  tip: string;
  tab?: 'melody' | 'drums' | 'bass';
  focus: ComposerGuideFocus;
};

export const COMPOSER_GUIDE_STEPS: ComposerGuideStep[] = [
  {
    id: 'tabs',
    title: '탭부터 고르기',
    focusLabel: '상단 탭',
    summary:
      '작곡 화면은 멜로디, 드럼, 베이스를 나눠서 만듭니다. 먼저 어떤 파트부터 만질지 탭부터 고르면 화면이 덜 복잡하게 느껴집니다.',
    detail:
      '위쪽 MELODY / DRUMS / BASS 탭을 눌러 파트를 바꾸세요. 멜로디부터 시작하고, 그다음 리듬과 저음을 채우는 순서가 초보자에게 가장 편합니다.',
    tip: '처음엔 MELODY에서 4마디만 만들고 다음 탭으로 넘어가면 훨씬 덜 막힙니다.',
    tab: 'melody',
    focus: 'tabs',
  },
  {
    id: 'melody-chords',
    title: '코드부터 잡기',
    focusLabel: '코드 칩',
    summary:
      '코드를 먼저 깔아두면 어떤 곡이 어울리는지 눈에 띄게 쉬워집니다. 초보자는 멜로디를 바로 찍기보다 코드 진행부터 잡는 게 좋습니다.',
    detail:
      'C, D, E, F, G, A, B 칩을 드래그해서 피아노 롤에 올려보세요. 칩 하나가 현재 박자 안에 어울리는 기본 음들을 빠르게 채워줍니다.',
    tip: '처음에는 C -> G -> A -> F 같은 익숙한 흐름만 써도 충분합니다.',
    tab: 'melody',
    focus: 'melody-chords',
  },
  {
    id: 'melody-roll',
    title: '멜로디 따라 찍기',
    focusLabel: '피아노 롤',
    summary:
      '가로는 시간, 세로는 음 높이입니다. 빈 칸을 찍으면 음이 들어가고 오른쪽으로 늘리면 길이도 함께 길어집니다.',
    detail:
      '빈 칸을 클릭하면 음이 들어가고 드래그하면 길이를 조절할 수 있습니다. 1/16, 1/8, 1/4, 1/2, 1 Bar 길이를 먼저 고른 뒤 찍으면 박자가 더 안정적으로 맞습니다.',
    tip: '처음 멜로디는 한 옥타브 안에서 3~4개 음만 써도 충분히 자연스럽습니다.',
    tab: 'melody',
    focus: 'melody-roll',
  },
  {
    id: 'drums-grid',
    title: '드럼으로 박자 만들기',
    focusLabel: '드럼 패턴',
    summary:
      '드럼은 곡의 뼈대입니다. 킥과 스네어만 먼저 찍어도 리듬이 잡히고, 그다음 하이햇과 클랩을 얹으면 곡이 훨씬 살아납니다.',
    detail:
      'Kick은 1, 9 같은 강박에 먼저 찍고, Snare는 5, 13처럼 중간 박자에 배치해보세요. Hi-Hat은 일정하게 채우면 리듬감이 바로 생깁니다.',
    tip: '드럼은 한 번에 복잡하게 찍지 말고 Kick -> Snare -> Hi-Hat 순서로 추가해보세요.',
    tab: 'drums',
    focus: 'drums-grid',
  },
  {
    id: 'bass-grid',
    title: '베이스로 루트 넣기',
    focusLabel: '베이스 라인',
    summary:
      '베이스는 코드의 바닥을 잡아주는 역할입니다. 복잡한 라인보다 코드 루트만 잘 찍어도 곡이 안정적으로 들립니다.',
    detail:
      '베이스 탭에서는 코드 칩을 드래그해 루트음을 빠르게 깔 수 있고, 칸을 직접 눌러 단순한 반복 패턴도 만들 수 있습니다. 드럼 킥과 같이 가는 음부터 시작해보세요.',
    tip: '처음에는 한 마디에 1~2개 음만 넣어도 충분히 베이스 역할을 합니다.',
    tab: 'bass',
    focus: 'bass-grid',
  },
  {
    id: 'transport',
    title: '재생하고 저장하기',
    focusLabel: '하단 컨트롤',
    summary:
      '마지막으로 곡을 들어보면서 정리해야 합니다. 재생, BPM, 반복, 저장과 공유를 한 줄에서 바로 하면 작업 흐름이 끊기지 않습니다.',
    detail:
      '하단에서 재생 버튼으로 들어보고, Tempo를 조절해 곡 분위기를 맞춰보세요. 마음에 들면 저장하기나 공유하기로 바로 이어갈 수 있습니다.',
    tip: '초보자는 완벽하게 만들기보다 저장을 자주 하면서 버전을 쌓는 습관이 더 중요합니다.',
    focus: 'transport',
  },
]; 
