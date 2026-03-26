import type {
  Comment as CommunityComment,
  CommunityTrack,
  Post,
} from '../types/community';

const toTimestamp = (value: string) => new Date(value).getTime();

export const TRENDING_TRACKS: CommunityTrack[] = [
  {
    id: 'trend-1',
    title: '새벽 네온 루프',
    progression: 'I - iii - vi - IV',
    mood: '지금 뜨는 음악',
    palette:
      'radial-gradient(circle at top left, rgba(255,255,255,0.14), transparent 35%), linear-gradient(145deg, #585858 0%, #262626 100%)',
  },
  {
    id: 'trend-2',
    title: '시티팝 리프',
    progression: 'I - bVII - bIII - bVII',
    mood: '리메이크 많은 진행',
    palette:
      'radial-gradient(circle at top right, rgba(140, 179, 255, 0.14), transparent 30%), linear-gradient(145deg, #51545b 0%, #24262a 100%)',
  },
  {
    id: 'trend-3',
    title: '감성 브릿지',
    progression: 'I - IV - I - V',
    mood: '반복감 좋은 구조',
    palette:
      'radial-gradient(circle at center, rgba(255, 214, 102, 0.12), transparent 26%), linear-gradient(145deg, #54514d 0%, #242321 100%)',
  },
  {
    id: 'trend-4',
    title: '미드나잇 훅',
    progression: 'vi - V - IV - V',
    mood: '후렴 임팩트 강조',
    palette:
      'radial-gradient(circle at 75% 20%, rgba(250, 129, 129, 0.14), transparent 30%), linear-gradient(145deg, #5a5454 0%, #242121 100%)',
  },
  {
    id: 'trend-5',
    title: '??? ?? ???',
    progression: 'i - VI - III - VII',
    mood: '? ?? ???',
    palette:
      'radial-gradient(circle at 20% 18%, rgba(126, 214, 255, 0.16), transparent 32%), linear-gradient(145deg, #4f5961 0%, #22272d 100%)',
  },
  {
    id: 'trend-6',
    title: '?? OST ??',
    progression: 'vi - IV - I - V',
    mood: '?? ?? ???',
    palette:
      'radial-gradient(circle at 72% 18%, rgba(255, 218, 121, 0.15), transparent 30%), linear-gradient(145deg, #57524b 0%, #23211d 100%)',
  },
  {
    id: 'trend-7',
    title: '??? ??',
    progression: 'I - V - ii - vi',
    mood: '??? ?? ??',
    palette:
      'radial-gradient(circle at 30% 18%, rgba(162, 145, 255, 0.16), transparent 32%), linear-gradient(145deg, #545064 0%, #232330 100%)',
  },
  {
    id: 'trend-8',
    title: '???? ????',
    progression: 'IV - I - V - vi',
    mood: '??? ? ??',
    palette:
      'radial-gradient(circle at 78% 22%, rgba(116, 240, 210, 0.14), transparent 28%), linear-gradient(145deg, #4d5b59 0%, #212726 100%)',
  },
];

export const LATEST_TRACKS: CommunityTrack[] = [
  {
    id: 'latest-1',
    title: '포크 감성 스케치',
    progression: 'I - IV - vi - V',
    mood: '최근 추가된 음악',
    palette:
      'radial-gradient(circle at top left, rgba(255,255,255,0.1), transparent 32%), linear-gradient(145deg, #575757 0%, #252525 100%)',
  },
  {
    id: 'latest-2',
    title: '청량 밴드 스냅',
    progression: 'vi - IV - I - V',
    mood: '밴드 작곡용 루프',
    palette:
      'radial-gradient(circle at 25% 15%, rgba(117, 234, 213, 0.14), transparent 28%), linear-gradient(145deg, #50585a 0%, #232628 100%)',
  },
  {
    id: 'latest-3',
    title: '발라드 베이스 아이디어',
    progression: 'I - bVII - IV - I',
    mood: '입문자용 진행 추천',
    palette:
      'radial-gradient(circle at 70% 20%, rgba(196, 181, 253, 0.14), transparent 32%), linear-gradient(145deg, #54525c 0%, #232228 100%)',
  },
  {
    id: 'latest-4',
    title: '모던 재즈 훅',
    progression: 'I - V - IV - V',
    mood: '리듬 변주형 진행',
    palette:
      'radial-gradient(circle at top left, rgba(251, 191, 36, 0.12), transparent 28%), linear-gradient(145deg, #5c5649 0%, #25231d 100%)',
  },
];

export const DUMMY_POSTS: Post[] = [
  {
    id: '1',
    title: '코드 진행 질문',
    content:
      '안녕하세요! 요즘 작곡을 처음 시작한 뉴비입니다.\n\nC메이저 코드 진행을 바탕으로 곡을 쓰다가, 아래 진행이 가장 자연스럽게 들릴지 고민되고 있어요.\n\n- C - G - Am - F (I-V-vi-IV)\n- C - Am - F - G (I-vi-IV-V)\n- C - F - G - C (I-IV-V-I)\n\n세 버전 다 비슷하게는 들리는데, 첫 번째가 힘 있게 전개되고 두 번째는 조금 더 따라 부르기 쉬운 느낌이라 계속 고민됩니다.\n\n코러스에서 피아노 보이싱을 더 넓게 잡으면 괜찮아질지도 궁금합니다. 비슷한 상황 겪으신 분들 의견 부탁드릴게요!',
    authorId: 'musicnew92',
    authorName: 'musicnew92',
    createdAt: toTimestamp('2026-03-19T21:49:00+09:00'),
    likeCount: 128,
    category: '질문',
    commentCount: 47,
    viewCount: 1842,
    isHot: true,
    tags: ['코드진행', '작곡질문', '화성학', '후렴구성'],
  },
  {
    id: '2',
    title: '작곡 파트너 받고 싶어요. 각자 한 소절씩 이어가볼까요?',
    content:
      '혼자 작업하다 보면 아이디어가 금방 닳아서, 한 소절씩 주고받는 방식으로 짧게 협업해보고 싶습니다. 비슷하게 해보신 분 있으면 흐름 잡는 팁도 알려주세요.',
    authorId: 'rhythmloop',
    authorName: '리듬조각가',
    createdAt: toTimestamp('2026-03-19T20:20:00+09:00'),
    likeCount: 112,
    category: '피드백',
    commentCount: 44,
    viewCount: 641,
    tags: ['협업', '아이디어', '작곡'],
  },
  {
    id: '3',
    title: '작곡 팁 모음: 멜로디 먼저일까 코드부터일까',
    content:
      '멜로디를 먼저 쓰는 경우와 코드를 먼저 잡는 경우의 장단점을 간단히 정리해봤습니다. 장르에 따라 출발점을 다르게 잡으면 훨씬 편하더라고요.',
    authorId: 'notewriter',
    authorName: '작곡노트',
    createdAt: toTimestamp('2026-03-19T18:10:00+09:00'),
    likeCount: 95,
    category: '작곡',
    commentCount: 38,
    viewCount: 1530,
    isHot: true,
    tags: ['작곡팁', '멜로디', '코드'],
  },
  {
    id: '4',
    title: '음악 이론 정리: 스케일과 코드 변환 방식',
    content:
      '자주 쓰는 다이아토닉 코드 진행과 모달 인터체인지 예시를 간단히 적어봤습니다. 처음 공부하시는 분들이 보기 편하도록 최대한 짧게 정리했습니다.',
    authorId: 'theorymap',
    authorName: '스케일지도',
    createdAt: toTimestamp('2026-03-19T14:40:00+09:00'),
    likeCount: 88,
    category: '팁&정보',
    commentCount: 21,
    viewCount: 874,
    tags: ['이론정리', '스케일', '화성학'],
  },
  {
    id: '5',
    title: '베이스 라인 만들 때 리듬 먼저 잡는 팁 공유해요',
    content:
      '음정부터 정하려고 하면 루프가 금방 평면적으로 들려서, 저는 먼저 킥과 어울리는 리듬을 정하고 뒤에 음을 채웁니다. 짧지만 꽤 체감되는 방법이라 공유합니다.',
    authorId: 'looplab',
    authorName: '루프연구소',
    createdAt: toTimestamp('2026-03-18T23:10:00+09:00'),
    likeCount: 74,
    category: '작곡',
    commentCount: 29,
    viewCount: 1204,
    tags: ['베이스', '리듬', '루프'],
  },
  {
    id: '6',
    title: '미디 컨트롤러 추천 부탁드려요',
    content:
      '입문용으로 25건반 정도 생각하고 있습니다. 패드 감도랑 노브 활용도가 좋은 모델이 있으면 추천 부탁드립니다.',
    authorId: 'recordhome',
    authorName: '홈레코딩러',
    createdAt: toTimestamp('2026-03-18T20:00:00+09:00'),
    likeCount: 61,
    category: '장비',
    commentCount: 20,
    viewCount: 986,
    tags: ['미디컨트롤러', '장비추천'],
  },
  {
    id: '7',
    title: '기타 코드 톤을 얇게 만들려면 어떤 페달이 좋을까요',
    content:
      '믹스에서 보컬 자리와 겹치지 않게 톤을 정리하고 싶은데, EQ만으로는 애매합니다. 컴프나 프리앰프 계열 페달도 같이 써보신 분 있나요?',
    authorId: 'tonemaker',
    authorName: '톤메이커',
    createdAt: toTimestamp('2026-03-18T17:25:00+09:00'),
    likeCount: 61,
    category: '장비',
    commentCount: 32,
    viewCount: 962,
    tags: ['기타', '페달', '톤메이킹'],
  },
  {
    id: '8',
    title: 'DAW 처음 시작하는데 뭐가 좋을까요?',
    content:
      '작곡 입문 단계이고 미디 작업 위주로 해보려 합니다. 인터페이스가 너무 어렵지 않으면서 기본 기능이 탄탄한 프로그램을 찾고 있어요.',
    authorId: 'firsttrack',
    authorName: '첫트랙',
    createdAt: toTimestamp('2026-03-18T13:55:00+09:00'),
    likeCount: 56,
    category: '질문',
    commentCount: 31,
    viewCount: 489,
    tags: ['DAW', '입문', '프로그램추천'],
  },
  {
    id: '9',
    title: '녹음용 마이크 추천받습니다. 예산은 20만 원 정도예요',
    content:
      '방에서 가이드 보컬 녹음할 용도로 찾고 있습니다. 노이즈가 너무 심하지 않고 목소리가 답답하게 들리지 않는 제품이면 좋겠어요.',
    authorId: 'vocalmemo',
    authorName: '보컬메모',
    createdAt: toTimestamp('2026-03-17T23:05:00+09:00'),
    likeCount: 54,
    category: '질문',
    commentCount: 35,
    viewCount: 762,
    tags: ['마이크', '장비추천', '보컬녹음'],
  },
  {
    id: '10',
    title: '작곡 막힐 때는 리듬부터 바꾸는 편이 가장 효과적이더라고요',
    content:
      '코드나 멜로디를 계속 붙잡고 있으면 오히려 답이 안 나올 때가 많았습니다. 드럼 패턴이나 악센트 위치만 바꿔도 같은 진행이 전혀 다르게 들릴 수 있더라고요.',
    authorId: 'beatpencil',
    authorName: '비트연필',
    createdAt: toTimestamp('2026-03-17T19:40:00+09:00'),
    likeCount: 49,
    category: '피드백',
    commentCount: 20,
    viewCount: 298,
    tags: ['리듬', '아이디어', '작곡막힘'],
  },
  {
    id: '11',
    title: '브리지에서 텐션 코드 넣는 타이밍이 항상 어렵네요',
    content:
      '후렴과 대비를 만들고 싶어서 텐션을 넣어보는데 자꾸 과하게 들립니다. 너무 튀지 않게 쓰는 방법이나 추천 진행이 있을까요?',
    authorId: 'bridgeprac',
    authorName: '브리지연습',
    createdAt: toTimestamp('2026-03-17T15:20:00+09:00'),
    likeCount: 45,
    category: '질문',
    commentCount: 20,
    viewCount: 268,
    tags: ['브리지', '텐션코드', '화성'],
  },
  {
    id: '12',
    title: '편곡 방법 팁: 오케스트라 편곡 어디서부터 시작하나요',
    content:
      '스트링 패드를 깔아보는 수준에서 한 단계 더 나아가고 싶은데, 파트 분배를 어디서부터 잡아야 할지 막막합니다. 공부 순서 추천 부탁드립니다.',
    authorId: 'layerer',
    authorName: '레이어러',
    createdAt: toTimestamp('2026-03-16T22:10:00+09:00'),
    likeCount: 43,
    category: '팁&정보',
    commentCount: 18,
    viewCount: 523,
    tags: ['편곡', '오케스트라', '스트링'],
  },
];

export const DUMMY_COMMENTS: CommunityComment[] = [
  {
    id: 'comment-1',
    postId: '1',
    authorName: 'theorymaster',
    createdAt: toTimestamp('2026-03-19T22:13:00+09:00'),
    content:
      '브리지에서 vi-IV-I-V 진행의 힘을 빌릴 땐 서브도미넌트 전에 ii-V를 잠깐 넣어보면 조금 더 자연스럽습니다.',
    likeCount: 24,
  },
  {
    id: 'comment-2',
    postId: '1',
    authorName: 'composerK',
    createdAt: toTimestamp('2026-03-19T22:09:00+09:00'),
    content:
      'C - G - Am - F 진행은 발라드에서 정말 자주 쓰이긴 합니다. 대신 후렴 첫 코드에서 보이싱을 넓게 벌리면 답답함이 조금 줄어요.',
    likeCount: 18,
  },
  {
    id: 'comment-3',
    postId: '1',
    authorName: 'pianoman',
    createdAt: toTimestamp('2026-03-19T21:58:00+09:00'),
    content:
      '마디 초반 멜로디를 V에서 시작하면 훅이 약간 사라질 수 있어요. 대리코드보다 리듬 액센트를 먼저 조정해 보셔도 좋겠습니다.',
    likeCount: 15,
  },
  {
    id: 'comment-4',
    postId: '1',
    authorName: 'guitorboy',
    createdAt: toTimestamp('2026-03-19T21:37:00+09:00'),
    content:
      '기타 기준이면 프리코러스 끝에 C-G-Am-F를 쓰더라도 후렴에선 F부터 시작하는 식으로 미세하게만 틀어도 확 바뀝니다.',
    likeCount: 12,
  },
  {
    id: 'comment-5',
    postId: '2',
    authorName: 'loopframe',
    createdAt: toTimestamp('2026-03-19T20:51:00+09:00'),
    content:
      '두 마디씩 끊어서 주고받으면 부담이 덜하더라고요. 처음부터 완성하려고 하지 않는 게 포인트였습니다.',
    likeCount: 8,
  },
  {
    id: 'comment-6',
    postId: '3',
    authorName: 'melodystart',
    createdAt: toTimestamp('2026-03-19T19:01:00+09:00'),
    content:
      '저는 후렴이 먼저 떠오르면 멜로디부터, 벌스 중심이면 코드부터 가는 편입니다. 장르별로 다르게 출발하는 게 훨씬 편했어요.',
    likeCount: 11,
  },
];
