import { collection, getDocs, getDoc, doc, setDoc, deleteDoc, query, limit, orderBy } from 'firebase/firestore';
import { db } from '../firebase'; // ★ 주의: 실제 firebase.ts 경로에 맞게 수정하세요!
import { isLocalDevelopmentHost } from './localEnvironment';
import { fetchServerJson } from './serverApi';
import type {
  SessionMeetingType,
  SessionRecruitApplicant,
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
  collabProjectId?: string | null;
};

export type UpdateSessionRecruitPayload = CreateSessionRecruitPayload & {
  postId: string;
  userEmail: string;
};

export type ApplySessionRecruitPayload = {
  postId: string;
  email: string;
  name: string;
  role: SessionRole;
  message: string;
};

export type ReviewSessionRecruitApplicationPayload = {
  postId: string;
  applicantId: string;
  userEmail: string;
  status: 'approved' | 'rejected';
};

export type LinkSessionRecruitCollabPayload = {
  postId: string;
  userEmail: string;
  collabProjectId: string;
};

export type SetSessionRecruitStatusPayload = {
  postId: string;
  userEmail: string;
  status: SessionStatus;
};

const SESSION_ROLE_COMPATIBILITY: Record<string, SessionRole> = {
  lyrics: 'lyrics',
  melody: 'melody',
  arrangement: 'arrangement',
  vocal: 'vocal',
  bass: 'bass',
  drums: 'drums',
  instrument: 'instrument',
  mix: 'mix',
  producer: 'melody',
  guitar: 'instrument',
  keys: 'arrangement',
};

function normalizeSessionRecruitPost(post: SessionRecruitPost): SessionRecruitPost {
  return {
    ...post,
    wantedRoles: post.wantedRoles
      .map((role) => SESSION_ROLE_COMPATIBILITY[String(role)])
      .filter((role): role is SessionRole => Boolean(role)),
    applicants: post.applicants?.map((applicant) => ({
      ...applicant,
      role: SESSION_ROLE_COMPATIBILITY[String(applicant.role)] ?? 'melody',
    })),
  };
}

// ============================================================================
// 🔥 파이어베이스 세션 모집 API
// ============================================================================

export async function fetchSessionRecruitBootstrap(): Promise<SessionRecruitSnapshot> {
  if (isLocalDevelopmentHost()) {
    const snapshot = await fetchServerJson<SessionRecruitSnapshot>('/api/sessions/bootstrap');
    return { posts: snapshot.posts.map(normalizeSessionRecruitPost) };
  }

  // 파이어베이스에서 세션 모집 글 목록을 모두 가져옵니다.
  const q = query(collection(db, 'session_recruit_posts'), orderBy('createdAt', 'desc'), limit(20));
  const snap = await getDocs(q);
  const posts = snap.docs.map(docSnap => normalizeSessionRecruitPost({
    id: docSnap.id,
    ...docSnap.data()
  } as SessionRecruitPost));
  
  // (선택) 최신 글이 위로 오게 정렬하고 싶다면 아래 주석을 푸세요!
  // posts.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  return { posts };
}

export async function createSessionRecruitPostOnServer(payload: CreateSessionRecruitPayload): Promise<{ postId: string; snapshot: SessionRecruitSnapshot }> {
  if (isLocalDevelopmentHost()) {
    return fetchServerJson<{ postId: string; snapshot: SessionRecruitSnapshot }>('/api/sessions', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  // 새 글을 위한 ID 생성
  const postRef = doc(collection(db, 'session_recruit_posts'));
  
  const newPost = {
    ...payload,
    id: postRef.id,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    applicants: [],
  };

  await setDoc(postRef, newPost);
  
  // 글 작성 후 화면을 갱신하기 위해 전체 목록을 다시 불러서 리턴
  return { 
    postId: postRef.id, 
    snapshot: await fetchSessionRecruitBootstrap() 
  };
}

export async function updateSessionRecruitPostOnServer(payload: UpdateSessionRecruitPayload): Promise<{ snapshot: SessionRecruitSnapshot }> {
  if (isLocalDevelopmentHost()) {
    return fetchServerJson<{ snapshot: SessionRecruitSnapshot }>(`/api/sessions/${encodeURIComponent(payload.postId)}/update`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  const postRef = doc(db, 'session_recruit_posts', payload.postId);
  
  // 기존 글에 수정된 내용만 덮어쓰기 (merge: true)
  await setDoc(postRef, {
    ...payload,
    updatedAt: Date.now(),
  }, { merge: true });

  return { snapshot: await fetchSessionRecruitBootstrap() };
}

export async function deleteSessionRecruitPostOnServer(payload: { postId: string; userEmail: string }): Promise<{ snapshot: SessionRecruitSnapshot }> {
  if (isLocalDevelopmentHost()) {
    return fetchServerJson<{ snapshot: SessionRecruitSnapshot }>(`/api/sessions/${encodeURIComponent(payload.postId)}/delete`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  // 파이어베이스에서 해당 글 삭제
  await deleteDoc(doc(db, 'session_recruit_posts', payload.postId));
  
  return { snapshot: await fetchSessionRecruitBootstrap() };
}

export async function applySessionRecruitPostOnServer(payload: ApplySessionRecruitPayload): Promise<{ snapshot: SessionRecruitSnapshot }> {
  if (isLocalDevelopmentHost()) {
    return fetchServerJson<{ snapshot: SessionRecruitSnapshot }>(`/api/sessions/${encodeURIComponent(payload.postId)}/apply`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  const postRef = doc(db, 'session_recruit_posts', payload.postId);
  const snap = await getDoc(postRef);

  if (!snap.exists()) {
    throw new Error('모집글을 찾을 수 없습니다.');
  }

  const post = { id: snap.id, ...snap.data() } as SessionRecruitPost;

  if (post.hostEmail === payload.email) {
    throw new Error('내 모집글에는 지원할 수 없습니다.');
  }

  const applicants = post.applicants ?? [];
  const alreadyApplied = applicants.some(
    (applicant) => applicant.email === payload.email && applicant.status !== 'rejected'
  );

  if (alreadyApplied) {
    throw new Error('이미 지원한 모집글입니다.');
  }

  const now = Date.now();
  const applicant: SessionRecruitApplicant = {
    id: `applicant-${now}-${Math.random().toString(36).slice(2, 8)}`,
    email: payload.email,
    name: payload.name,
    role: payload.role,
    message: payload.message,
    status: 'pending',
    createdAt: now,
    updatedAt: now,
  };

  await setDoc(
    postRef,
    {
      applicants: [...applicants, applicant],
      updatedAt: now,
    },
    { merge: true }
  );

  return { snapshot: await fetchSessionRecruitBootstrap() };
}

export async function reviewSessionRecruitApplicationOnServer(payload: ReviewSessionRecruitApplicationPayload): Promise<{ snapshot: SessionRecruitSnapshot }> {
  if (isLocalDevelopmentHost()) {
    return fetchServerJson<{ snapshot: SessionRecruitSnapshot }>(`/api/sessions/${encodeURIComponent(payload.postId)}/review`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  const postRef = doc(db, 'session_recruit_posts', payload.postId);
  const snap = await getDoc(postRef);

  if (!snap.exists()) {
    throw new Error('모집글을 찾을 수 없습니다.');
  }

  const post = { id: snap.id, ...snap.data() } as SessionRecruitPost;

  if (post.hostEmail !== payload.userEmail) {
    throw new Error('모집글 작성자만 지원자를 관리할 수 있습니다.');
  }

  const now = Date.now();
  const applicants = post.applicants ?? [];
  const target = applicants.find((applicant) => applicant.id === payload.applicantId);

  if (!target) {
    throw new Error('지원자를 찾을 수 없습니다.');
  }

  const wasApproved = target.status === 'approved';
  const willApprove = payload.status === 'approved';
  const nextApplicants = applicants.map((applicant) =>
    applicant.id === payload.applicantId
      ? { ...applicant, status: payload.status, updatedAt: now }
      : applicant
  );

  const nextMembers = Math.min(
    post.maxMembers,
    Math.max(1, post.currentMembers + (willApprove && !wasApproved ? 1 : 0))
  );
  const nextStatus = nextMembers >= post.maxMembers ? 'closed' : post.status;

  await setDoc(
    postRef,
    {
      applicants: nextApplicants,
      currentMembers: nextMembers,
      status: nextStatus,
      updatedAt: now,
    },
    { merge: true }
  );

  return { snapshot: await fetchSessionRecruitBootstrap() };
}

export async function linkSessionRecruitCollabOnServer(payload: LinkSessionRecruitCollabPayload): Promise<{ snapshot: SessionRecruitSnapshot }> {
  if (isLocalDevelopmentHost()) {
    return fetchServerJson<{ snapshot: SessionRecruitSnapshot }>(`/api/sessions/${encodeURIComponent(payload.postId)}/link-collab`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  const postRef = doc(db, 'session_recruit_posts', payload.postId);
  const snap = await getDoc(postRef);

  if (!snap.exists()) {
    throw new Error('모집글을 찾을 수 없습니다.');
  }

  const post = { id: snap.id, ...snap.data() } as SessionRecruitPost;

  if (post.hostEmail !== payload.userEmail) {
    throw new Error('모집글 작성자만 협업 작업실을 연결할 수 있습니다.');
  }

  await setDoc(
    postRef,
    {
      collabProjectId: payload.collabProjectId,
      updatedAt: Date.now(),
    },
    { merge: true }
  );

  return { snapshot: await fetchSessionRecruitBootstrap() };
}

export async function setSessionRecruitStatusOnServer(payload: SetSessionRecruitStatusPayload): Promise<{ snapshot: SessionRecruitSnapshot }> {
  if (isLocalDevelopmentHost()) {
    return fetchServerJson<{ snapshot: SessionRecruitSnapshot }>(`/api/sessions/${encodeURIComponent(payload.postId)}/status`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  const postRef = doc(db, 'session_recruit_posts', payload.postId);
  const snap = await getDoc(postRef);

  if (!snap.exists()) {
    throw new Error('모집글을 찾을 수 없습니다.');
  }

  const post = { id: snap.id, ...snap.data() } as SessionRecruitPost;

  if (post.hostEmail !== payload.userEmail) {
    throw new Error('모집글 작성자만 모집 상태를 바꿀 수 있습니다.');
  }

  await setDoc(
    postRef,
    {
      status: payload.status,
      updatedAt: Date.now(),
    },
    { merge: true }
  );

  return { snapshot: await fetchSessionRecruitBootstrap() };
}
