export type SessionRole =
  | 'vocal'
  | 'guitar'
  | 'bass'
  | 'drums'
  | 'keys'
  | 'producer'
  | 'mix';

export type SessionRegion = 'seoul' | 'gyeonggi' | 'incheon' | 'busan' | 'online';

export type SessionStatus = 'open' | 'closing' | 'closed';

export type SessionMeetingType = '오프라인' | '온라인' | '온/오프 병행';

export interface SessionRecruitPost {
  id: string;
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
  createdAt: number;
  updatedAt: number;
  urgent: boolean;
}
