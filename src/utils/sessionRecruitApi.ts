import { collection, getDocs, doc, setDoc, deleteDoc, query, limit, orderBy } from 'firebase/firestore';
import { db } from '../firebase'; // ★ 주의: 실제 firebase.ts 경로에 맞게 수정하세요!
import type {
  SessionMeetingType,
  SessionRecruitPost,
  SessionRegion,
  SessionRole,
  SessionStatus,
} from '../types/sessionRecruit';

export type SessionRecruitSnapshot = {
  posts: SessionRecruitPost[];
};

export type CreateSessionRecruitPayload = {
  title: string;
  genre: string;
  hostName: string;
  hostEmail: string;
  summary: string;
  location: string;
  region: SessionRegion;
  meetingType: SessionMeetingType;
  status: SessionStatus;
  wantedRoles: SessionRole[];
  tags: string[];
  currentMembers: number;
  maxMembers: number;
  schedule: string;
  urgent: boolean;
};

export type UpdateSessionRecruitPayload = CreateSessionRecruitPayload & {
  postId: string;
  userEmail: string;
};

// ============================================================================
// 🔥 파이어베이스 세션 모집 API
// ============================================================================

export async function fetchSessionRecruitBootstrap(): Promise<SessionRecruitSnapshot> {
  // 파이어베이스에서 세션 모집 글 목록을 모두 가져옵니다.
  const q = query(collection(db, 'session_recruit_posts'), orderBy('createdAt', 'desc'), limit(20));
  const snap = await getDocs(q);
  const posts = snap.docs.map(docSnap => ({
    id: docSnap.id, // 파이어베이스 문서 ID를 글 ID로 사용
    ...docSnap.data()
  })) as SessionRecruitPost[];
  
  // (선택) 최신 글이 위로 오게 정렬하고 싶다면 아래 주석을 푸세요!
  // posts.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  return { posts };
}

export async function createSessionRecruitPostOnServer(payload: CreateSessionRecruitPayload): Promise<{ postId: string; snapshot: SessionRecruitSnapshot }> {
  // 새 글을 위한 ID 생성
  const postRef = doc(collection(db, 'session_recruit_posts'));
  
  const newPost = {
    ...payload,
    id: postRef.id,
    createdAt: Date.now(),
  };

  await setDoc(postRef, newPost);
  
  // 글 작성 후 화면을 갱신하기 위해 전체 목록을 다시 불러서 리턴
  return { 
    postId: postRef.id, 
    snapshot: await fetchSessionRecruitBootstrap() 
  };
}

export async function updateSessionRecruitPostOnServer(payload: UpdateSessionRecruitPayload): Promise<{ snapshot: SessionRecruitSnapshot }> {
  const postRef = doc(db, 'session_recruit_posts', payload.postId);
  
  // 기존 글에 수정된 내용만 덮어쓰기 (merge: true)
  await setDoc(postRef, {
    ...payload,
    updatedAt: Date.now(),
  }, { merge: true });

  return { snapshot: await fetchSessionRecruitBootstrap() };
}

export async function deleteSessionRecruitPostOnServer(payload: { postId: string; userEmail: string }): Promise<{ snapshot: SessionRecruitSnapshot }> {
  // 파이어베이스에서 해당 글 삭제
  await deleteDoc(doc(db, 'session_recruit_posts', payload.postId));
  
  return { snapshot: await fetchSessionRecruitBootstrap() };
}