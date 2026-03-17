import type { Post } from '../types/community'; // 아까 만든 타입 가져오기

export const DUMMY_POSTS: Post[] = [
  {
    id: '1',
    title: '피아노 멜로디 피드백 부탁드립니다!',
    content: 'C메이저로 시작하는데 중간 전조가 어색한 것 같아요. 들어보고 조언 부탁드려요.',
    authorId: 'user1',
    authorName: '베토벤',
    createdAt: Date.now(),
    likeCount: 5,
  },
  {
    id: '2',
    title: '이번에 만든 힙합 비트 공유합니다.',
    content: '드럼 룹은 로직 프로 기본 샘플을 썼습니다. 붐뱁 스타일입니다.',
    authorId: 'user2',
    authorName: '쇼팽',
    createdAt: Date.now() - 1000000,
    likeCount: 12,
  },
  {
    id: '3',
    title: '작곡할 때 화성학 꼭 배워야 하나요?',
    content: '그냥 감으로 찍는데 한계가 느껴지네요. 추천하는 책 있나요?',
    authorId: 'user3',
    authorName: '모차르트',
    createdAt: Date.now() - 5000000,
    likeCount: 2,
  },
];