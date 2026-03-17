// src/types/community.ts

export interface Post {
  id: string;
  title: string;
  content: string; // 혹은 에디터 데이터
  authorId: string;
  authorName: string;
  createdAt: number; // Timestamp
  likeCount: number;
}

export interface Comment {
  id: string;
  postId: string;
  content: string;
  authorName: string;
  createdAt: number;
}