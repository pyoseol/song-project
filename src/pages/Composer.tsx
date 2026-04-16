import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import SiteHeader from '../components/layout/SiteHeader';
import { PianoRoll } from '../components/PianoRoll.tsx';
import { TransportBar } from '../components/TransportBar.tsx';
import {
  initTransport,
  playBassPreview,
  playDrumPreview,
  playGuitarPreview,
} from '../audio/engine.ts';
import {
  COMPOSER_GUIDE_STEPS,
  type ComposerGuideFocus,
} from '../constants/composerGuide.ts';
import {
  COMPOSER_TUTORIAL_BASS_TARGETS,
  COMPOSER_TUTORIAL_CHORD_TARGETS,
  COMPOSER_TUTORIAL_DRUM_TARGETS,
  COMPOSER_TUTORIAL_MELODY_TARGETS,
  type ComposerTutorialCellTarget,
  type ComposerTutorialChordTarget,
  type ComposerTutorialNoteTarget,
} from '../constants/composerTutorialGame.ts';
import { BASS_CHORD_MAP, BASS_NOTES, DRUM_STEP_WIDTH } from '../constants/composer.ts';
import { useAuthStore } from '../store/authStore.ts';
import {
  COLLAB_PRESENCE_PING_INTERVAL_MS,
  CollabRequestError,
  COLLAB_SESSION_ID,
  type CollabComposerHistoryEntry,
  type CollabComposerInstrument,
  type CollabComposerOperation,
  useCollabStore,
} from '../store/collabStore.ts';
import {
  DRUM_ROWS,
  buildSongProjectSnapshot,
  type InstrumentKey,
  useSongStore,
} from '../store/songStore.ts';
import {
  useUIStore,
  type ComposerTabKey,
  type MelodyInstrument,
} from '../store/uiStore.ts';
import './Composer.css';

type ComposerTab = ComposerTabKey;

const chordOptions = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const;

const tabLabels: Record<ComposerTab, string> = {
  melody: 'MELODY',
  guitar: 'GUITAR',
  drums: 'DRUMS',
  bass: 'BASS',
};

const tabPickerLabels: Record<ComposerTab, string> = {
  melody: '피아노',
  guitar: '통기타',
  drums: '드럼',
  bass: '베이스',
};

const tabOrder: ComposerTab[] = ['melody', 'guitar', 'drums', 'bass'];
const COLLAB_BAR_LENGTH = 16;

function getCollabInstrumentForTab(tab: ComposerTab): CollabComposerInstrument {
  return tab;
}

function getVolumeInstrumentForTab(tab: ComposerTab): InstrumentKey {
  return tab === 'guitar' ? 'melody' : tab;
}

function getMelodyInstrumentForTab(tab: ComposerTab): MelodyInstrument | null {
  if (tab === 'melody') {
    return 'piano';
  }

  if (tab === 'guitar') {
    return 'acousticGuitar';
  }

  return null;
}

function clampGuideStepIndex(value: number) {
  const safeValue = Number.isFinite(value) ? Math.floor(value) : 0;
  return Math.min(COMPOSER_GUIDE_STEPS.length - 1, Math.max(0, safeValue));
}

function findMelodyNoteForTutorial(
  melodyRow: boolean[],
  melodyLengthRow: number[],
  col: number
) {
  for (let start = 0; start <= col; start += 1) {
    if (!melodyRow[start]) {
      continue;
    }

    const length = Math.max(1, melodyLengthRow[start] ?? 1);
    if (col < start + length) {
      return { start, length };
    }
  }

  return null;
}

function countMatchedChordTargets(
  melody: boolean[][],
  targets: ComposerTutorialChordTarget[]
) {
  return targets.filter((target) => target.rows.every((row) => melody[row]?.[target.col])).length;
}

function countMatchedMelodyTargets(
  melody: boolean[][],
  melodyLengths: number[][],
  targets: ComposerTutorialNoteTarget[]
) {
  return targets.filter((target) => {
    const noteInfo = findMelodyNoteForTutorial(
      melody[target.row] ?? [],
      melodyLengths[target.row] ?? [],
      target.col
    );

    return Boolean(noteInfo && noteInfo.start === target.col && noteInfo.length >= target.length);
  }).length;
}

function countMatchedCellTargets(grid: boolean[][], targets: ComposerTutorialCellTarget[]) {
  return targets.filter((target) => grid[target.row]?.[target.col]).length;
}

const chordMeta = {
  melody: {
    label: 'Piano Chords',
    description: '코드를 드래그해서 피아노 롤 위에 바로 올려보세요.',
  },
  bass: {
    label: 'Bass Roots',
    description: '루트 음을 베이스 라인처럼 빠르게 찍어볼 수 있습니다.',
  },
} as const;

const drumTracks = [
  { name: 'Kick', hint: 'Low-end pulse', tone: 'kick' },
  { name: 'Snare', hint: 'Backbeat snap', tone: 'snare' },
  { name: 'Hi-Hat', hint: 'Fast groove', tone: 'hat' },
  { name: 'Clap', hint: 'Accent layer', tone: 'clap' },
  { name: 'Percussion', hint: 'Extra groove', tone: 'perc' },
] as const;

const bassLaneColors = [
  '#fb7185',
  '#f59e0b',
  '#4ade80',
  '#22d3ee',
  '#818cf8',
  '#c084fc',
  '#38bdf8',
  '#f97316',
  '#34d399',
  '#facc15',
] as const;

const guitarLaneColors = ['#f59e0b', '#fb923c', '#fbbf24', '#fdba74', '#f97316', '#fcd34d'] as const;

const guitarGridLanes = [
  { label: 'High E', hint: '1st string', note: 'E5' },
  { label: 'B', hint: '2nd string', note: 'B4' },
  { label: 'G', hint: '3rd string', note: 'G4' },
  { label: 'D', hint: '4th string', note: 'D4' },
  { label: 'A', hint: '5th string', note: 'A3' },
  { label: 'Low E', hint: '6th string', note: 'E4' },
] as const;

function getSubdivisionClassName(col: number) {
  return `${col % 2 === 0 ? ' is-eighth' : ''}${col % 4 === 0 ? ' is-quarter' : ''}${
    col % 8 === 0 ? ' is-half' : ''
  }${col % 16 === 0 ? ' is-bar' : ''}`;
}

export function Composer() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const user = useAuthStore((state) => state.user);
  const tutorialCompletedByEmail = useAuthStore(
    (state) => state.profilesByEmail[user?.email ?? '']?.composerTutorialCompleted ?? false
  );
  const markComposerTutorialCompleted = useAuthStore((state) => state.markComposerTutorialCompleted);
  const {
    bpm,
    steps,
    melody,
    melodyLengths,
    guitar,
    drums,
    bass,
    volumes,
    setInstrumentVolume,
    toggleGuitar,
    toggleDrum,
    toggleBass,
    applyChord,
    currentStep,
    setCurrentStep,
    loopRange,
    setLoopRange,
    loadProject,
    applyRemoteProject,
  } = useSongStore();
  const { activeTab, setActiveTab, setInstrument } = useUIStore();
  const projects = useCollabStore((state) => state.projects);
  const connectionStatus = useCollabStore((state) => state.connectionStatus);
  const connectionError = useCollabStore((state) => state.connectionError);
  const initializeRealtime = useCollabStore((state) => state.initializeRealtime);
  const updateComposerSnapshot = useCollabStore((state) => state.updateComposerSnapshot);
  const applyComposerOperation = useCollabStore((state) => state.applyComposerOperation);
  const setComposerLock = useCollabStore((state) => state.setComposerLock);
  const touchPresence = useCollabStore((state) => state.touchPresence);
  const leavePresence = useCollabStore((state) => state.leavePresence);
  const presenceByProject = useCollabStore((state) => state.presenceByProject);
  const composerLocksByProject = useCollabStore((state) => state.composerLocksByProject);
  const composerHistoryByProject = useCollabStore((state) => state.composerHistoryByProject);
  const collabId = searchParams.get('collab');
  const tutorialRequested = false;
  const requestedGuideStep = Number(searchParams.get('guideStep') ?? '0');
  const collabProject = useMemo(
    () => (collabId ? projects.find((project) => project.id === collabId) ?? null : null),
    [collabId, projects]
  );
  const collabMember = useMemo(
    () =>
      collabProject && user
        ? collabProject.members.find((member) => member.email === user.email) ?? null
        : null,
    [collabProject, user]
  );
  const canSyncCollab = Boolean(collabMember && collabMember.role !== 'viewer');
  const lastAppliedRevisionRef = useRef(0);
  const lastSentSignatureRef = useRef('');
  const hasLoadedCollabRef = useRef(false);
  const isApplyingRemoteRef = useRef(false);
  const syncTimeoutRef = useRef<number | null>(null);
  const conflictTimeoutRef = useRef<number | null>(null);
  const pendingOperationSignatureRef = useRef<string | null>(null);
  const operationQueueRef = useRef<Promise<void>>(Promise.resolve());
  const heldBarLocksRef = useRef(new Set<string>());
  const [conflictNotice, setConflictNotice] = useState('');
  const [collabSyncTick, setCollabSyncTick] = useState(0);
  const tutorialCompleted = Boolean(user?.email && tutorialCompletedByEmail);
  const isGuideOpen = tutorialRequested && !tutorialCompleted;
  const guideStepIndex = clampGuideStepIndex(
    Number.isFinite(requestedGuideStep) ? requestedGuideStep : 0
  );
  const [visitedTabs, setVisitedTabs] = useState<ComposerTab[]>(() => [activeTab]);
  const [openTabsState, setOpenTabsState] = useState<ComposerTab[]>(['melody']);
  const [isTabPickerOpen, setIsTabPickerOpen] = useState(false);
  const [playedTutorialOnce, setPlayedTutorialOnce] = useState(false);
  const [tabPickerMenuPosition, setTabPickerMenuPosition] = useState<{
    top: number;
    left: number;
    minWidth: number;
  } | null>(null);
  const tutorialAdvanceTimeoutRef = useRef<number | null>(null);
  const lastAutoAdvancedStepRef = useRef<number | null>(null);
  const tutorialCameraTimeoutRef = useRef<number | null>(null);
  const tabStripRef = useRef<HTMLDivElement | null>(null);
  const tabPickerRef = useRef<HTMLDivElement | null>(null);
  const tabAddButtonRef = useRef<HTMLButtonElement | null>(null);
  const mixerStripRef = useRef<HTMLDivElement | null>(null);
  const mainViewportRef = useRef<HTMLElement | null>(null);
  const melodyChordBarRef = useRef<HTMLElement | null>(null);
  const melodyRollRef = useRef<HTMLElement | null>(null);
  const drumShellRef = useRef<HTMLElement | null>(null);
  const bassShellRef = useRef<HTMLElement | null>(null);
  const footerRef = useRef<HTMLElement | null>(null);
  const openTabs = useMemo(() => {
    if (tutorialRequested) {
      return [...tabOrder];
    }

    return tabOrder.filter((tab) => openTabsState.includes(tab) || tab === activeTab);
  }, [activeTab, openTabsState, tutorialRequested]);
  const tabPickerOptions = useMemo(() => tabOrder, []);
  const guitarLanes = useMemo(
    () =>
      guitarGridLanes.map((lane, row) => ({
        ...lane,
        row,
      })),
    []
  );

  const projectSnapshot = useMemo(
    () =>
      buildSongProjectSnapshot({
        bpm,
        steps,
        volumes,
        melody,
        melodyLengths,
        guitar,
        drums,
        bass,
      }),
    [bass, bpm, drums, guitar, melody, melodyLengths, steps, volumes]
  );
  const projectSignature = useMemo(() => JSON.stringify(projectSnapshot), [projectSnapshot]);

  const collabStatusLabel = useMemo(() => {
    if (!collabId) {
      return '';
    }

    if (connectionStatus === 'connected') {
      return canSyncCollab ? '실시간 공동 편집 연결됨' : '작업방 읽기 전용으로 연결됨';
    }

    if (connectionStatus === 'connecting') {
      return '실시간 작업 서버에 연결 중입니다.';
    }

    if (connectionStatus === 'error') {
      return connectionError || '작업 서버 연결을 확인해 주세요.';
    }

    return '작업방 연결을 준비하고 있습니다.';
  }, [canSyncCollab, collabId, connectionError, connectionStatus]);
  const activeEditorsLabel = useMemo(() => {
    if (!collabId || !user) {
      return '';
    }

    const entries = presenceByProject[collabId] ?? [];
    const activeEditors = entries
      .filter((entry) => entry.email !== user.email && entry.focus)
      .map((entry) => `${entry.name} - ${entry.focus}`);

    return activeEditors.join(', ');
  }, [collabId, presenceByProject, user]);
  const activeComposerLocks = useMemo(
    () => (collabId ? composerLocksByProject[collabId] ?? [] : []),
    [collabId, composerLocksByProject]
  );
  const currentTabLockMap = useMemo(() => {
    const currentCollabInstrument = getCollabInstrumentForTab(activeTab);

    return activeComposerLocks.reduce<Record<number, { mine: boolean; name: string }>>(
      (map, lock) => {
        if (lock.instrument !== currentCollabInstrument) {
          return map;
        }

        map[lock.barIndex] = {
          mine: lock.sessionId === COLLAB_SESSION_ID,
          name: lock.name,
        };
        return map;
      },
      {}
    );
  }, [activeComposerLocks, activeTab]);
  const visibleComposerLocks = useMemo(
    () =>
      activeComposerLocks
        .filter((lock) => lock.sessionId !== COLLAB_SESSION_ID)
        .slice(0, 4),
    [activeComposerLocks]
  );
  const recentComposerHistory = useMemo<CollabComposerHistoryEntry[]>(
    () => (collabId ? (composerHistoryByProject[collabId] ?? []).slice(0, 4) : []),
    [collabId, composerHistoryByProject]
  );
  const activeGuideStep = COMPOSER_GUIDE_STEPS[guideStepIndex];
  const matchedChordTargets = useMemo(
    () => countMatchedChordTargets(melody, COMPOSER_TUTORIAL_CHORD_TARGETS),
    [melody]
  );
  const matchedMelodyTargets = useMemo(
    () => countMatchedMelodyTargets(melody, melodyLengths, COMPOSER_TUTORIAL_MELODY_TARGETS),
    [melody, melodyLengths]
  );
  const matchedDrumTargets = useMemo(
    () => countMatchedCellTargets(drums, COMPOSER_TUTORIAL_DRUM_TARGETS),
    [drums]
  );
  const matchedBassTargets = useMemo(
    () => countMatchedCellTargets(bass, COMPOSER_TUTORIAL_BASS_TARGETS),
    [bass]
  );
  const melodyNoteCount = useMemo(
    () => melody.reduce((sum, row) => sum + row.filter(Boolean).length, 0),
    [melody]
  );
  const melodyLongNoteCount = useMemo(
    () =>
      melodyLengths.reduce(
        (sum, row) => sum + row.filter((length) => Number(length) > 1).length,
        0
      ),
    [melodyLengths]
  );
  const melodyChordColumnCount = useMemo(() => {
    const columns = new Set<number>();

    for (let col = 0; col < steps; col += 1) {
      let activeInColumn = 0;

      for (let row = 0; row < melody.length; row += 1) {
        if (melody[row]?.[col]) {
          activeInColumn += 1;
        }
      }

      if (activeInColumn >= 3) {
        columns.add(col);
      }
    }

    return columns.size;
  }, [melody, steps]);
  const drumHitCount = useMemo(
    () => drums.reduce((sum, row) => sum + row.filter(Boolean).length, 0),
    [drums]
  );
  const kickHitCount = drums[0]?.filter(Boolean).length ?? 0;
  const snareHitCount = drums[1]?.filter(Boolean).length ?? 0;
  const bassHitCount = useMemo(
    () => bass.reduce((sum, row) => sum + row.filter(Boolean).length, 0),
    [bass]
  );
  const tutorialQuests = useMemo(
    () => [
      {
        id: 'tabs',
        stepIndex: 0,
        title: '탭 둘러보기',
        goal: '멜로디, 드럼, 베이스 탭을 한 번씩 열어보세요.',
        done: visitedTabs.length >= 3,
        progress: `${visitedTabs.length}/3 탭 확인`,
      },
      {
        id: 'melody-chords',
        stepIndex: 1,
        title: '코드 놓기',
        goal: '코드 칩으로 멜로디 영역에 첫 진행을 만들어보세요.',
        done: melodyChordColumnCount >= 1,
        progress:
          melodyChordColumnCount >= 1
            ? `${melodyChordColumnCount}개 코드 시작점 생성`
            : '아직 코드 음이 없습니다.',
      },
      {
        id: 'melody-roll',
        stepIndex: 2,
        title: '멜로디 만들기',
        goal: '멜로디 음을 4개 이상 찍고, 긴 음도 1개 이상 만들어보세요.',
        done: melodyNoteCount >= 4 && melodyLongNoteCount >= 1,
        progress: `음 ${melodyNoteCount}개 · 긴 음 ${melodyLongNoteCount}개`,
      },
      {
        id: 'drums-grid',
        stepIndex: 3,
        title: '드럼 채우기',
        goal: '킥과 스네어를 포함해서 드럼 히트를 6개 이상 넣어보세요.',
        done: drumHitCount >= 6 && kickHitCount >= 1 && snareHitCount >= 1,
        progress: `전체 ${drumHitCount}개 · 킥 ${kickHitCount}개 · 스네어 ${snareHitCount}개`,
      },
      {
        id: 'bass-grid',
        stepIndex: 4,
        title: '베이스 루트 넣기',
        goal: '베이스 음을 2개 이상 넣어서 곡의 바닥을 만들어보세요.',
        done: bassHitCount >= 2,
        progress: `베이스 음 ${bassHitCount}개`,
      },
      {
        id: 'transport',
        stepIndex: 5,
        title: '곡 들어보기',
        goal: '재생 버튼을 눌러 지금 만든 곡을 직접 들어보세요.',
        done: playedTutorialOnce,
        progress: playedTutorialOnce ? '재생 확인 완료' : '아직 재생 전입니다.',
      },
    ],
    [
      bassHitCount,
      drumHitCount,
      kickHitCount,
      melodyChordColumnCount,
      melodyLongNoteCount,
      melodyNoteCount,
      playedTutorialOnce,
      snareHitCount,
      visitedTabs.length,
    ]
  );
  const liveTutorialQuests = useMemo(
    () => [
      {
        id: 'tabs',
        stepIndex: 0,
        title: '탭부터 둘러보기',
        goal: '위 탭에서 MELODY, DRUMS, BASS를 한 번씩 눌러보세요.',
        done: visitedTabs.length >= 3,
        progress: `${visitedTabs.length}/3 탭 확인`,
        pattern: ['MELODY 탭 누르기', 'DRUMS 탭 누르기', 'BASS 탭 누르기'],
      },
      {
        id: 'melody-chords',
        stepIndex: 1,
        title: '코드 뼈대 놓기',
        goal: '코드 칩을 드래그해서 1마디 진행을 먼저 맞춰보세요.',
        done: matchedChordTargets === COMPOSER_TUTORIAL_CHORD_TARGETS.length,
        progress: `${matchedChordTargets}/${COMPOSER_TUTORIAL_CHORD_TARGETS.length} 코드 위치 맞춤`,
        pattern: COMPOSER_TUTORIAL_CHORD_TARGETS.map((target) => target.label),
      },
      {
        id: 'melody-roll',
        stepIndex: 2,
        title: '멜로디 따라 찍기',
        goal: '보이는 가이드 블록대로 첫 1마디 멜로디를 찍어보세요.',
        done: matchedMelodyTargets === COMPOSER_TUTORIAL_MELODY_TARGETS.length,
        progress: `${matchedMelodyTargets}/${COMPOSER_TUTORIAL_MELODY_TARGETS.length} 멜로디 맞춤`,
        pattern: COMPOSER_TUTORIAL_MELODY_TARGETS.map((target) => target.label),
      },
      {
        id: 'drums-grid',
        stepIndex: 3,
        title: '드럼 박자 복사하기',
        goal: '킥, 스네어, 하이햇 위치를 그대로 채워서 리듬을 완성해보세요.',
        done: matchedDrumTargets === COMPOSER_TUTORIAL_DRUM_TARGETS.length,
        progress: `${matchedDrumTargets}/${COMPOSER_TUTORIAL_DRUM_TARGETS.length} 드럼 칸 맞춤`,
        pattern: [
          'Kick: 1칸, 9칸',
          'Snare: 5칸, 13칸',
          'Hi-Hat: 1, 3, 5, 7, 9, 11, 13, 15칸',
        ],
      },
      {
        id: 'bass-grid',
        stepIndex: 4,
        title: '베이스 루트 넣기',
        goal: '코드 아래에 맞는 루트 음을 찍어 곡의 바닥을 완성해보세요.',
        done: matchedBassTargets === COMPOSER_TUTORIAL_BASS_TARGETS.length,
        progress: `${matchedBassTargets}/${COMPOSER_TUTORIAL_BASS_TARGETS.length} 베이스 칸 맞춤`,
        pattern: COMPOSER_TUTORIAL_BASS_TARGETS.map((target) => target.label),
      },
      {
        id: 'transport',
        stepIndex: 5,
        title: '곡 들어보기',
        goal: '재생 버튼을 눌러 방금 만든 1마디 곡이 실제로 들리는지 확인해보세요.',
        done: playedTutorialOnce,
        progress: playedTutorialOnce ? '재생 확인 완료' : '아직 재생 전입니다.',
        pattern: ['하단 재생 버튼 누르기', '소리 확인하기'],
      },
    ],
    [
      matchedBassTargets,
      matchedChordTargets,
      matchedDrumTargets,
      matchedMelodyTargets,
      playedTutorialOnce,
      visitedTabs.length,
    ]
  );
  const liveCompletedQuestCount = liveTutorialQuests.filter((quest) => quest.done).length;
  const liveTutorialProgress = Math.round((liveCompletedQuestCount / tutorialQuests.length) * 100);
  const activeGuideQuest = liveTutorialQuests[guideStepIndex] ?? liveTutorialQuests[0];
  const nextChordTutorialTarget = useMemo(
    () =>
      COMPOSER_TUTORIAL_CHORD_TARGETS.find(
        (target) => !target.rows.every((row) => Boolean(melody[row]?.[target.col]))
      ) ?? null,
    [melody]
  );
  const nextMelodyTutorialTarget = useMemo(
    () =>
      COMPOSER_TUTORIAL_MELODY_TARGETS.find((target) => {
        const noteInfo = findMelodyNoteForTutorial(
          melody[target.row] ?? [],
          melodyLengths[target.row] ?? [],
          target.col
        );

        return !(noteInfo && noteInfo.start === target.col && noteInfo.length >= target.length);
      }) ?? null,
    [melody, melodyLengths]
  );
  const nextDrumTutorialTarget = useMemo(
    () => COMPOSER_TUTORIAL_DRUM_TARGETS.find((target) => !drums[target.row]?.[target.col]) ?? null,
    [drums]
  );
  const nextBassTutorialTarget = useMemo(
    () => COMPOSER_TUTORIAL_BASS_TARGETS.find((target) => !bass[target.row]?.[target.col]) ?? null,
    [bass]
  );
  const melodyTutorialGhostNotes = useMemo(() => {
    if (!isGuideOpen || activeTab !== 'melody') {
      return [];
    }

    if (guideStepIndex === 1) {
      return COMPOSER_TUTORIAL_CHORD_TARGETS.flatMap((target) =>
        target.rows.map((row, index) => ({
          row,
          col: target.col,
          length: 1,
          completed: Boolean(melody[row]?.[target.col]),
          highlight: nextChordTutorialTarget?.chord === target.chord && nextChordTutorialTarget.col === target.col,
          label:
            nextChordTutorialTarget?.chord === target.chord &&
            nextChordTutorialTarget.col === target.col &&
            index === 0
              ? `${target.chord} 코드 놓기`
              : undefined,
        }))
      );
    }

    if (guideStepIndex === 2) {
      return COMPOSER_TUTORIAL_MELODY_TARGETS.map((target) => {
        const noteInfo = findMelodyNoteForTutorial(
          melody[target.row] ?? [],
          melodyLengths[target.row] ?? [],
          target.col
        );

        return {
          row: target.row,
          col: target.col,
          length: target.length,
          completed: Boolean(
            noteInfo && noteInfo.start === target.col && noteInfo.length >= target.length
          ),
          highlight:
            nextMelodyTutorialTarget?.row === target.row &&
            nextMelodyTutorialTarget.col === target.col,
          label:
            nextMelodyTutorialTarget?.row === target.row &&
            nextMelodyTutorialTarget.col === target.col
              ? '멜로디 찍기'
              : undefined,
        };
      });
    }

    return [];
  }, [
    activeTab,
    guideStepIndex,
    isGuideOpen,
    melody,
    melodyLengths,
    nextChordTutorialTarget,
    nextMelodyTutorialTarget,
  ]);
  const drumTutorialTargetMap = useMemo(
    () =>
      guideStepIndex === 3 && isGuideOpen
        ? COMPOSER_TUTORIAL_DRUM_TARGETS.reduce<Record<string, boolean>>((map, target) => {
            map[`${target.row}-${target.col}`] = Boolean(drums[target.row]?.[target.col]);
            return map;
          }, {})
        : {},
    [drums, guideStepIndex, isGuideOpen]
  );
  const bassTutorialTargetMap = useMemo(
    () =>
      guideStepIndex === 4 && isGuideOpen
        ? COMPOSER_TUTORIAL_BASS_TARGETS.reduce<Record<string, boolean>>((map, target) => {
            map[`${target.row}-${target.col}`] = Boolean(bass[target.row]?.[target.col]);
            return map;
          }, {})
        : {},
    [bass, guideStepIndex, isGuideOpen]
  );
  const getGuideHighlightClass = (...focuses: ComposerGuideFocus[]) =>
    isGuideOpen && activeGuideStep && focuses.includes(activeGuideStep.focus)
      ? ' composer-guide-highlight'
      : '';
  const getGuideFocusElement = useCallback(() => {
    if (!isGuideOpen || !activeGuideStep) {
      return null;
    }

    switch (activeGuideStep.focus) {
      case 'tabs':
        return tabStripRef.current;
      case 'mixer':
        return mixerStripRef.current;
      case 'melody-chords':
        return melodyChordBarRef.current;
      case 'melody-roll':
        return melodyRollRef.current;
      case 'drums-grid':
        return drumShellRef.current;
      case 'bass-grid':
        return bassShellRef.current;
      case 'transport':
        return footerRef.current;
      default:
        return null;
    }
  }, [activeGuideStep, isGuideOpen]);

  const showCollabNotice = (message: string) => {
    setConflictNotice(message);

    if (conflictTimeoutRef.current) {
      window.clearTimeout(conflictTimeoutRef.current);
    }

    conflictTimeoutRef.current = window.setTimeout(() => {
      setConflictNotice('');
      conflictTimeoutRef.current = null;
    }, 4000);
  };

  const markVisitedTab = useCallback((tab: ComposerTab) => {
    setVisitedTabs((current) => (current.includes(tab) ? current : [...current, tab]));
  }, []);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!tabPickerRef.current) {
        return;
      }

      if (!tabPickerRef.current.contains(event.target as Node)) {
        setIsTabPickerOpen(false);
      }
    };

    window.addEventListener('mousedown', handlePointerDown);
    return () => {
      window.removeEventListener('mousedown', handlePointerDown);
    };
  }, []);

  useEffect(() => {
    if (!isTabPickerOpen || !tabAddButtonRef.current) {
      if (!isTabPickerOpen) {
        setTabPickerMenuPosition(null);
      }
      return;
    }

    const updateTabPickerPosition = () => {
      if (!tabAddButtonRef.current) {
        return;
      }

      const rect = tabAddButtonRef.current.getBoundingClientRect();
      const minWidth = 188;
      const viewportPadding = 12;
      const maxLeft = Math.max(viewportPadding, window.innerWidth - minWidth - viewportPadding);

      setTabPickerMenuPosition({
        top: rect.bottom + 8,
        left: Math.min(Math.max(viewportPadding, rect.left), maxLeft),
        minWidth: minWidth,
      });
    };

    updateTabPickerPosition();
    window.addEventListener('resize', updateTabPickerPosition);
    window.addEventListener('scroll', updateTabPickerPosition, true);

    return () => {
      window.removeEventListener('resize', updateTabPickerPosition);
      window.removeEventListener('scroll', updateTabPickerPosition, true);
    };
  }, [isTabPickerOpen]);

  useEffect(() => {
    const nextInstrument = getMelodyInstrumentForTab(activeTab);
    if (!nextInstrument) {
      return;
    }

    setInstrument(nextInstrument);
  }, [activeTab, setInstrument]);

  const syncGuideQuery = useCallback(
    (open: boolean, stepIndex = guideStepIndex) => {
      const nextParams = new URLSearchParams(searchParams);

      if (open) {
        nextParams.set('tutorial', '1');
        nextParams.set('guideStep', String(clampGuideStepIndex(stepIndex)));
      } else {
        nextParams.delete('tutorial');
        nextParams.delete('guideStep');
      }

      navigate(
        {
          pathname: '/composer',
          search: nextParams.toString() ? `?${nextParams.toString()}` : '',
        },
        { replace: true }
      );
    },
    [guideStepIndex, navigate, searchParams]
  );

  const openGuideAt = useCallback(
    (stepIndex: number) => {
      const nextStepIndex = clampGuideStepIndex(stepIndex);
      const stepTab = COMPOSER_GUIDE_STEPS[nextStepIndex]?.tab;
      if (stepTab) {
        markVisitedTab(stepTab);
        setActiveTab(stepTab);
      }
      syncGuideQuery(true, nextStepIndex);
    },
    [markVisitedTab, setActiveTab, syncGuideQuery]
  );

  useEffect(() => {
    if (!tutorialCompleted || !tutorialRequested) {
      return;
    }

    syncGuideQuery(false);
  }, [syncGuideQuery, tutorialCompleted, tutorialRequested]);

  const handleTabPickerToggle = useCallback(() => {
    setIsTabPickerOpen((current) => !current);
  }, []);

  const handleOpenTab = useCallback(
    (tab: ComposerTab) => {
      setOpenTabsState((current) =>
        tabOrder.filter((candidate) => candidate === tab || current.includes(candidate))
      );
      markVisitedTab(tab);
      setActiveTab(tab);
      const nextInstrument = getMelodyInstrumentForTab(tab);
      if (nextInstrument) {
        setInstrument(nextInstrument);
      }
      setIsTabPickerOpen(false);
    },
    [markVisitedTab, setActiveTab, setInstrument]
  );

  const handleCloseTab = useCallback(
    (tab: ComposerTab) => {
      if (tab === 'melody') {
        return;
      }

      const remainingTabs = tabOrder.filter(
        (candidate) => candidate !== tab && (openTabsState.includes(candidate) || candidate === 'melody')
      );

      setOpenTabsState(remainingTabs);
      setIsTabPickerOpen(false);

      if (activeTab === tab) {
        const fallbackTab = [...remainingTabs].reverse().find((candidate) => candidate !== tab) ?? 'melody';
        setActiveTab(fallbackTab);
        const nextInstrument = getMelodyInstrumentForTab(fallbackTab);
        if (nextInstrument) {
          setInstrument(nextInstrument);
        }
      }
    },
    [activeTab, openTabsState, setActiveTab, setInstrument]
  );

  const handleStepLoopSelect = useCallback(
    (col: number) => {
      const sameLoop = loopRange?.start === 0 && loopRange.end === col;
      setLoopRange(sameLoop ? null : { start: 0, end: col });
      setCurrentStep(0);
    },
    [loopRange, setCurrentStep, setLoopRange]
  );

  const getDrumTutorialCellClass = (row: number, col: number) => {
    if (!isGuideOpen || guideStepIndex !== 3) {
      return '';
    }

    if (
      nextDrumTutorialTarget &&
      nextDrumTutorialTarget.row === row &&
      nextDrumTutorialTarget.col === col
    ) {
      return ' is-tutorial-next';
    }

    const targetState = drumTutorialTargetMap[`${row}-${col}`];

    if (typeof targetState !== 'boolean') {
      return '';
    }

    return targetState ? ' is-tutorial-complete' : ' is-tutorial-target';
  };

  const getBassTutorialCellClass = (row: number, col: number) => {
    if (!isGuideOpen || guideStepIndex !== 4) {
      return '';
    }

    if (
      nextBassTutorialTarget &&
      nextBassTutorialTarget.row === row &&
      nextBassTutorialTarget.col === col
    ) {
      return ' is-tutorial-next';
    }

    const targetState = bassTutorialTargetMap[`${row}-${col}`];

    if (typeof targetState !== 'boolean') {
      return '';
    }

    return targetState ? ' is-tutorial-complete' : ' is-tutorial-target';
  };

  const getDrumTutorialCellGuideLabel = (row: number, col: number) =>
    isGuideOpen &&
    guideStepIndex === 3 &&
    nextDrumTutorialTarget &&
    nextDrumTutorialTarget.row === row &&
    nextDrumTutorialTarget.col === col
      ? '여기'
      : '';

  const getBassTutorialCellGuideLabel = (row: number, col: number) =>
    isGuideOpen &&
    guideStepIndex === 4 &&
    nextBassTutorialTarget &&
    nextBassTutorialTarget.row === row &&
    nextBassTutorialTarget.col === col
      ? '여기'
      : '';

  const getTutorialTabClass = (tab: ComposerTab) => {
    if (!isGuideOpen || guideStepIndex !== 0) {
      return '';
    }

    if (!visitedTabs.includes(tab)) {
      return ' is-tutorial-target';
    }

    return ' is-tutorial-complete';
  };

  const getProjectSignatureFromStore = () =>
    JSON.stringify(
      buildSongProjectSnapshot({
        bpm: useSongStore.getState().bpm,
        steps: useSongStore.getState().steps,
        volumes: useSongStore.getState().volumes,
        melody: useSongStore.getState().melody,
        melodyLengths: useSongStore.getState().melodyLengths,
        guitar: useSongStore.getState().guitar,
        drums: useSongStore.getState().drums,
        bass: useSongStore.getState().bass,
      })
    );

  const getLockKey = (instrument: CollabComposerInstrument, barIndex: number) =>
    `${instrument}:${barIndex}`;

  const requestComposerBarLock = async (
    instrument: CollabComposerInstrument,
    barIndex: number
  ) => {
    if (!collabId || !user || !canSyncCollab) {
      return !collabId;
    }

    const key = getLockKey(instrument, barIndex);
    if (heldBarLocksRef.current.has(key)) {
      return true;
    }

    const existingLock = activeComposerLocks.find(
      (lock) =>
        lock.instrument === instrument &&
        lock.barIndex === barIndex &&
        lock.sessionId !== COLLAB_SESSION_ID
    );

    if (existingLock) {
      showCollabNotice(
        `${existingLock.name}님이 ${
          instrument === 'melody'
            ? '멜로디'
            : instrument === 'guitar'
              ? '기타'
              : instrument === 'drums'
                ? '드럼'
                : '베이스'
        } ${barIndex + 1}마디를 편집 중입니다.`
      );
      return false;
    }

    try {
      await setComposerLock(collabId, {
        instrument,
        barIndex,
        email: user.email,
        name: user.name,
        sessionId: COLLAB_SESSION_ID,
        lock: true,
      });
      heldBarLocksRef.current.add(key);
      return true;
    } catch (error) {
      if (error instanceof Error) {
        showCollabNotice(error.message);
      }
      return false;
    }
  };

  const releaseComposerBarLock = (instrument: CollabComposerInstrument, barIndex: number) => {
    if (!collabId) {
      return;
    }

    const key = getLockKey(instrument, barIndex);
    if (!heldBarLocksRef.current.has(key)) {
      return;
    }

    heldBarLocksRef.current.delete(key);
    void setComposerLock(collabId, {
      instrument,
      barIndex,
      sessionId: COLLAB_SESSION_ID,
      lock: false,
    }).catch((error) => {
      console.error(error);
    });
  };

  const queueComposerOperation = (operation: CollabComposerOperation) => {
    if (!collabId || !user || !canSyncCollab) {
      return;
    }

    pendingOperationSignatureRef.current = getProjectSignatureFromStore();

    operationQueueRef.current = operationQueueRef.current
      .catch(() => undefined)
      .then(async () => {
        try {
          const revision = await applyComposerOperation(collabId, {
            operation,
            email: user.email,
            name: user.name,
            sessionId: COLLAB_SESSION_ID,
            baseRevision: lastAppliedRevisionRef.current,
          });
          lastAppliedRevisionRef.current = Math.max(lastAppliedRevisionRef.current, revision);
          setConflictNotice('');
        } catch (error) {
          console.error(error);
          pendingOperationSignatureRef.current = null;

          if (error instanceof CollabRequestError && error.statusCode === 409) {
            showCollabNotice(error.message);
          } else if (error instanceof Error) {
            showCollabNotice(error.message);
          }

          setCollabSyncTick((tick) => tick + 1);
          throw error;
        }
      });
  };

  useEffect(() => {
    initTransport();
  }, []);

  useEffect(() => {
    if (!isGuideOpen || !activeGuideStep?.tab || activeTab === activeGuideStep.tab) {
      return;
    }

    setActiveTab(activeGuideStep.tab);
  }, [activeGuideStep, activeTab, isGuideOpen, setActiveTab]);

  useEffect(() => {
    if (tutorialCameraTimeoutRef.current) {
      window.clearTimeout(tutorialCameraTimeoutRef.current);
      tutorialCameraTimeoutRef.current = null;
    }

    if (!isGuideOpen) {
      return;
    }

    tutorialCameraTimeoutRef.current = window.setTimeout(() => {
      const target = getGuideFocusElement();
      const mainViewport = mainViewportRef.current;

      if (
        target &&
        mainViewport &&
        mainViewport.contains(target) &&
        activeGuideStep?.focus !== 'transport'
      ) {
        const targetRect = target.getBoundingClientRect();
        const mainRect = mainViewport.getBoundingClientRect();
        const nextTop = mainViewport.scrollTop + (targetRect.top - mainRect.top) - 12;

        mainViewport.scrollTo({
          top: Math.max(0, nextTop),
          behavior: 'smooth',
        });
      } else {
        target?.scrollIntoView({
          behavior: 'smooth',
          block: activeGuideStep?.focus === 'transport' ? 'end' : 'nearest',
          inline: 'center',
        });
      }
      tutorialCameraTimeoutRef.current = null;
    }, 180);

    return () => {
      if (tutorialCameraTimeoutRef.current) {
        window.clearTimeout(tutorialCameraTimeoutRef.current);
        tutorialCameraTimeoutRef.current = null;
      }
    };
  }, [activeGuideStep?.focus, activeTab, getGuideFocusElement, isGuideOpen]);

  useEffect(() => {
    if (tutorialAdvanceTimeoutRef.current) {
      window.clearTimeout(tutorialAdvanceTimeoutRef.current);
      tutorialAdvanceTimeoutRef.current = null;
    }

    if (!isGuideOpen || !activeGuideQuest?.done) {
      return;
    }

    if (guideStepIndex >= liveTutorialQuests.length - 1) {
      return;
    }

    if (lastAutoAdvancedStepRef.current === guideStepIndex) {
      return;
    }

    lastAutoAdvancedStepRef.current = guideStepIndex;
    tutorialAdvanceTimeoutRef.current = window.setTimeout(() => {
      openGuideAt(guideStepIndex + 1);
      tutorialAdvanceTimeoutRef.current = null;
    }, 850);

    return () => {
      if (tutorialAdvanceTimeoutRef.current) {
        window.clearTimeout(tutorialAdvanceTimeoutRef.current);
        tutorialAdvanceTimeoutRef.current = null;
      }
    };
  }, [activeGuideQuest?.done, guideStepIndex, isGuideOpen, liveTutorialQuests.length, openGuideAt]);

  useEffect(() => {
    if (!user?.email || tutorialCompleted || liveTutorialProgress < 100) {
      return;
    }

    markComposerTutorialCompleted(user.email);
    syncGuideQuery(false);
  }, [
    liveTutorialProgress,
    markComposerTutorialCompleted,
    syncGuideQuery,
    tutorialCompleted,
    user?.email,
  ]);

  useEffect(() => {
    if (!collabId) {
      hasLoadedCollabRef.current = false;
      lastAppliedRevisionRef.current = 0;
      lastSentSignatureRef.current = '';
      pendingOperationSignatureRef.current = null;
      if (syncTimeoutRef.current) {
        window.clearTimeout(syncTimeoutRef.current);
        syncTimeoutRef.current = null;
      }
      return;
    }

    void initializeRealtime().catch((error) => {
      console.error(error);
    });
  }, [collabId, initializeRealtime]);

  useEffect(() => {
    if (!collabId || !collabProject?.snapshot) {
      return;
    }

    const incomingRevision = collabProject.snapshotRevision ?? 0;
    const incomingSignature = JSON.stringify(collabProject.snapshot);

    if (!hasLoadedCollabRef.current) {
      hasLoadedCollabRef.current = true;
      lastAppliedRevisionRef.current = incomingRevision;
      lastSentSignatureRef.current = incomingSignature;
      isApplyingRemoteRef.current = true;
      loadProject(collabProject.snapshot);
      window.setTimeout(() => {
        isApplyingRemoteRef.current = false;
      }, 0);
      return;
    }

    if (incomingRevision <= lastAppliedRevisionRef.current) {
      return;
    }

    lastAppliedRevisionRef.current = incomingRevision;
    lastSentSignatureRef.current = incomingSignature;
    if (pendingOperationSignatureRef.current === incomingSignature) {
      pendingOperationSignatureRef.current = null;
    }

    if (collabProject.snapshotUpdatedBySessionId === COLLAB_SESSION_ID) {
      return;
    }

    isApplyingRemoteRef.current = true;
    applyRemoteProject(collabProject.snapshot);
    window.setTimeout(() => {
      isApplyingRemoteRef.current = false;
    }, 0);
  }, [applyRemoteProject, collabId, collabProject, loadProject]);

  useEffect(() => {
    if (!collabId || !collabProject || !user || !canSyncCollab || !hasLoadedCollabRef.current) {
      return;
    }

    if (
      isApplyingRemoteRef.current ||
      projectSignature === lastSentSignatureRef.current ||
      pendingOperationSignatureRef.current === projectSignature
    ) {
      return;
    }

    if (syncTimeoutRef.current) {
      window.clearTimeout(syncTimeoutRef.current);
    }

    syncTimeoutRef.current = window.setTimeout(() => {
      void updateComposerSnapshot(collabId, {
        snapshot: projectSnapshot,
        email: user.email,
        name: user.name,
        sessionId: COLLAB_SESSION_ID,
        baseRevision: lastAppliedRevisionRef.current,
      })
        .then((revision) => {
          lastAppliedRevisionRef.current = Math.max(lastAppliedRevisionRef.current, revision);
          lastSentSignatureRef.current = projectSignature;
          setConflictNotice('');
        })
        .catch((error) => {
          console.error(error);
          if (error instanceof CollabRequestError && error.statusCode === 409) {
            setConflictNotice(
              '다른 사용자의 최신 변경이 먼저 저장되어 최신 버전으로 다시 맞췄습니다.'
            );

            if (conflictTimeoutRef.current) {
              window.clearTimeout(conflictTimeoutRef.current);
            }

            conflictTimeoutRef.current = window.setTimeout(() => {
              setConflictNotice('');
              conflictTimeoutRef.current = null;
            }, 4000);
          }
        });
    }, 400);

    return () => {
      if (syncTimeoutRef.current) {
        window.clearTimeout(syncTimeoutRef.current);
        syncTimeoutRef.current = null;
      }
    };
  }, [
    canSyncCollab,
    collabId,
    collabProject,
    projectSignature,
    projectSnapshot,
    updateComposerSnapshot,
    user,
    collabSyncTick,
  ]);

  useEffect(
    () => () => {
      if (syncTimeoutRef.current) {
        window.clearTimeout(syncTimeoutRef.current);
      }
      if (conflictTimeoutRef.current) {
        window.clearTimeout(conflictTimeoutRef.current);
      }
    },
    []
  );

  useEffect(
    () => () => {
      if (!collabId || !heldBarLocksRef.current.size) {
        return;
      }

      const heldLocks = [...heldBarLocksRef.current];
      heldBarLocksRef.current.clear();

      heldLocks.forEach((entry) => {
        const [instrument, barIndexValue] = entry.split(':');
        void setComposerLock(collabId, {
          instrument: instrument as CollabComposerInstrument,
          barIndex: Number(barIndexValue),
          sessionId: COLLAB_SESSION_ID,
          lock: false,
        }).catch((error) => {
          console.error(error);
        });
      });
    },
    [collabId, setComposerLock]
  );

  useEffect(() => {
    if (!collabId || !user) {
      return;
    }

    const focus = `composer:${getCollabInstrumentForTab(activeTab)}`;

    void touchPresence(collabId, {
      email: user.email,
      name: user.name,
      focus,
    }).catch((error) => {
      console.error(error);
    });

    const timer = window.setInterval(() => {
      void touchPresence(collabId, {
        email: user.email,
        name: user.name,
        focus,
      }).catch((error) => {
        console.error(error);
      });
    }, COLLAB_PRESENCE_PING_INTERVAL_MS);

    return () => {
      window.clearInterval(timer);
      void leavePresence(collabId).catch((error) => {
        console.error(error);
      });
    };
  }, [activeTab, collabId, leavePresence, touchPresence, user]);

  const handleMixerChange = (tab: ComposerTab, volume: number) => {
    const instrument = getVolumeInstrumentForTab(tab);

    setInstrumentVolume(instrument, volume);

    if (!collabId || !canSyncCollab) {
      return;
    }

    queueComposerOperation({
      type: 'set-volume',
      instrument,
      volume,
    });
  };

  const handleMelodyOperationCommit = (payload: {
    row: number;
    col: number;
    length: number;
    barIndex: number;
  }) => {
    queueComposerOperation({
      type: 'set-melody-note',
      ...payload,
    });
  };

  const handleChordOperationCommit = (payload: {
    chord: string;
    col: number;
    isBass: boolean;
    rows: number[];
    barIndex: number;
  }) => {
    if (!payload.chord) {
      return;
    }

    queueComposerOperation({
      type: 'apply-chord',
      ...payload,
    });
  };

  const handleBassCellToggle = async (row: number, col: number) => {
    const barIndex = Math.floor(col / COLLAB_BAR_LENGTH);
    if (!(await requestComposerBarLock('bass', barIndex))) {
      return;
    }

    const nextValue = !(useSongStore.getState().bass[row]?.[col] ?? false);
    toggleBass(row, col);
    void playBassPreview(row);
    queueComposerOperation({
      type: 'toggle-bass-step',
      row,
      col,
      nextValue,
      barIndex,
    });
    releaseComposerBarLock('bass', barIndex);
  };

  const handleGuitarCellToggle = async (row: number, col: number) => {
    const barIndex = Math.floor(col / COLLAB_BAR_LENGTH);
    if (!(await requestComposerBarLock('guitar', barIndex))) {
      return;
    }

    const nextValue = !(useSongStore.getState().guitar[row]?.[col] ?? false);
    toggleGuitar(row, col);

    if (nextValue) {
      void playGuitarPreview(row);
    }

    queueComposerOperation({
      type: 'toggle-guitar-step',
      row,
      col,
      nextValue,
      barIndex,
    });
    releaseComposerBarLock('guitar', barIndex);
  };

  const handleBassChordDrop = async (chord: string, col: number) => {
    const barIndex = Math.floor(col / COLLAB_BAR_LENGTH);
    if (!(await requestComposerBarLock('bass', barIndex))) {
      return;
    }

    applyChord(chord, col, true);
    queueComposerOperation({
      type: 'apply-chord',
      chord,
      col,
      isBass: true,
      rows: [...(BASS_CHORD_MAP[chord] ?? [])],
      barIndex,
    });
    releaseComposerBarLock('bass', barIndex);
  };

  const handleDrumCellToggle = async (row: number, col: number) => {
    const barIndex = Math.floor(col / COLLAB_BAR_LENGTH);
    if (!(await requestComposerBarLock('drums', barIndex))) {
      return;
    }

    const nextValue = !(useSongStore.getState().drums[row]?.[col] ?? false);
    toggleDrum(row, col);
    void playDrumPreview(row);
    queueComposerOperation({
      type: 'toggle-drum-step',
      row,
      col,
      nextValue,
      barIndex,
    });
    releaseComposerBarLock('drums', barIndex);
  };

  const getTabVolume = (tab: ComposerTab) => volumes[getVolumeInstrumentForTab(tab)];

  return (
    <div
      className={`composer-page composer-page--${activeTab}${
        isGuideOpen ? ' composer-page--guide-open' : ''
      }`}
    >
      <SiteHeader activeSection="composer" />

      <div className="composer-workbar">
        <div className="composer-workbar-controls">
          <div
            ref={mixerStripRef}
            className={`composer-tab-stack${getGuideHighlightClass('mixer')}`}
          >
            <div
              ref={tabStripRef}
              className={`composer-tab-strip${getGuideHighlightClass('tabs')}`}
              role="tablist"
              aria-label="악기 탭"
            >
              {openTabs.map((tab) => (
                <div
                  key={tab}
                  className={`composer-tab-card is-${tab}${
                    activeTab === tab ? ' is-active' : ''
                  }${getTutorialTabClass(tab)}`}
                  style={{ ['--composer-tab-volume' as string]: `${getTabVolume(tab)}%` }}
                >
                  <button
                    type="button"
                    className="composer-tab-button"
                    onClick={() => {
                      markVisitedTab(tab);
                      setActiveTab(tab);
                      const nextInstrument = getMelodyInstrumentForTab(tab);
                      if (nextInstrument) {
                        setInstrument(nextInstrument);
                      }
                    }}
                    aria-pressed={activeTab === tab}
                  >
                    <span className="composer-tab-button-inner">
                      <span className="composer-tab-label">{tabLabels[tab]}</span>
                      {tab !== 'melody' && !tutorialRequested ? (
                        <span
                          role="button"
                          tabIndex={0}
                          className="composer-tab-close"
                          aria-label={`${tabLabels[tab]} 닫기`}
                          onClick={(event) => {
                            event.stopPropagation();
                            handleCloseTab(tab);
                          }}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault();
                              event.stopPropagation();
                              handleCloseTab(tab);
                            }
                          }}
                        >
                          ×
                        </span>
                      ) : null}
                    </span>
                  </button>

                  <label className="composer-tab-volume">
                    <span className="sr-only">{`${tabLabels[tab]} volume`}</span>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={getTabVolume(tab)}
                      onChange={(event) => handleMixerChange(tab, Number(event.target.value))}
                    />
                  </label>
                </div>
              ))}

              <div ref={tabPickerRef} className="composer-tab-picker">
                <button
                  ref={tabAddButtonRef}
                  type="button"
                  className={`composer-tab-add-button${isTabPickerOpen ? ' is-open' : ''}`}
                  onClick={handleTabPickerToggle}
                  aria-label="악기 선택"
                  aria-expanded={isTabPickerOpen}
                  aria-haspopup="menu"
                >
                  +
                </button>

                {isTabPickerOpen ? (
                  <div
                    className="composer-tab-picker-menu"
                    role="menu"
                    aria-label="선택 가능한 악기"
                    style={
                      tabPickerMenuPosition
                        ? {
                            top: `${tabPickerMenuPosition.top}px`,
                            left: `${tabPickerMenuPosition.left}px`,
                            minWidth: `${tabPickerMenuPosition.minWidth}px`,
                          }
                        : undefined
                    }
                  >
                    {tabPickerOptions.map((tab) => {
                      const isOpen = openTabs.includes(tab);
                      const isActive = activeTab === tab;

                      return (
                        <button
                          key={tab}
                          type="button"
                          className={`composer-tab-picker-item is-${tab}${
                            isActive ? ' is-active' : ''
                          }${isOpen ? ' is-opened' : ''}`}
                          onClick={() => handleOpenTab(tab)}
                        >
                          <span>{tabPickerLabels[tab]}</span>
                          <small>{isActive ? '현재 악기' : isOpen ? '열려 있음' : '추가'}</small>
                        </button>
                      );
                    })}
                  </div>
                ) : null}
              </div>

            </div>

          </div>
        </div>
      </div>

      {collabId ? (
        <section className={`composer-collab-banner is-${connectionStatus}`}>
          <div className="composer-collab-copy">
            <strong>{collabProject?.title ?? '작업 프로젝트 불러오는 중'}</strong>
            <span>{collabStatusLabel}</span>
          </div>

          <div className="composer-collab-side">
            <div className="composer-collab-actions">
            <span className="composer-collab-chip">
              {canSyncCollab ? '공동 편집' : '읽기 전용'}
            </span>
            {activeEditorsLabel ? (
              <span className="composer-collab-chip">{activeEditorsLabel}</span>
            ) : null}
            {visibleComposerLocks.map((lock) => (
              <span
                key={`${lock.instrument}-${lock.barIndex}-${lock.sessionId}`}
                className="composer-collab-chip composer-collab-chip--lock"
              >
                {lock.name} -{' '}
                {lock.instrument === 'melody'
                  ? '멜로디'
                  : lock.instrument === 'guitar'
                    ? '기타'
                  : lock.instrument === 'drums'
                    ? '드럼'
                    : '베이스'}{' '}
                {lock.barIndex + 1}마디
              </span>
            ))}
            {conflictNotice ? (
              <span className="composer-collab-chip composer-collab-chip--warning">
                {conflictNotice}
              </span>
            ) : null}
            <button
              type="button"
              className="composer-collab-button"
              onClick={() => navigate(collabProject ? `/collab/${collabProject.id}` : '/collab')}
            >
              작업방으로
            </button>
          </div>
            {recentComposerHistory.length ? (
              <div className="composer-collab-history">
                {recentComposerHistory.map((entry) => (
                  <span key={entry.id} className="composer-collab-history-item">
                    <strong>{entry.authorName}</strong>
                    <span>{entry.summary}</span>
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      <main ref={mainViewportRef} className={`composer-main composer-main--${activeTab}`}>
        {activeTab === 'melody' && (
          <>
            <section
              ref={melodyRollRef}
              className={`composer-roll-shell composer-roll-shell--melody${getGuideHighlightClass(
                'melody-roll'
              )}`}
            >
              <PianoRoll
                loopRange={loopRange}
                onStepHeaderSelect={handleStepLoopSelect}
                collabBarLocks={currentTabLockMap}
                canEditCollab={!collabId || canSyncCollab}
                requestCollabBarLock={requestComposerBarLock}
                releaseCollabBarLock={releaseComposerBarLock}
                onCommitMelodyOperation={handleMelodyOperationCommit}
                onCommitChordOperation={handleChordOperationCommit}
                tutorialGhostNotes={melodyTutorialGhostNotes}
              />
            </section>
          </>
        )}

        {activeTab === 'guitar' && (
          <section className="composer-bass-shell">
            <div className="composer-drum-panel composer-drum-panel--bass">
              <div className="composer-drums-wrap">
                <div className="composer-sequencer-body">
                  <div className="composer-sequencer-header composer-sequencer-header--bass">
                    <div className="composer-drum-step-spacer">Guitar String</div>

                    <div
                      className="composer-step-grid composer-step-grid--bass"
                      style={{
                        gridTemplateColumns: `repeat(${steps}, ${DRUM_STEP_WIDTH}px)`,
                        ['--sequencer-step-span' as string]: `calc(${DRUM_STEP_WIDTH}px + 10px)`,
                      }}
                    >
                      {Array.from({ length: steps }).map((_, col) => (
                        <button
                          key={`guitar-header-${col}`}
                          type="button"
                          className={`composer-drum-step-number composer-drum-step-number--bass${
                            col === currentStep ? ' is-current' : ''
                          }${getSubdivisionClassName(col)}${
                            loopRange && col >= loopRange.start && col <= loopRange.end
                              ? ' is-loop-active'
                              : ''
                          }${loopRange?.end === col ? ' is-loop-end' : ''}`}
                          onClick={() => handleStepLoopSelect(col)}
                          aria-label={`${col + 1}번 위치까지 반복`}
                          title={`${col + 1}번 위치까지 반복`}
                        >
                          <span className="sr-only">{col + 1}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="composer-sequencer-rows">
                    {guitarLanes.map((lane, index) => {
                      const guitarAccent = guitarLaneColors[index % guitarLaneColors.length];
                      const guitarAccentStyle = {
                        '--bass-accent': guitarAccent,
                      } as CSSProperties;

                      return (
                        <div key={lane.label} className="composer-drum-row composer-drum-row--bass">
                          <div
                            className="composer-drum-track composer-drum-track--bass"
                            style={guitarAccentStyle}
                          >
                            <strong>{lane.label}</strong>
                            <span>{lane.hint}</span>
                          </div>

                          <div
                            className="composer-drum-row-grid composer-drum-row-grid--bass"
                            style={{
                              gridTemplateColumns: `repeat(${steps}, ${DRUM_STEP_WIDTH}px)`,
                              ['--sequencer-step-span' as string]: `calc(${DRUM_STEP_WIDTH}px + 10px)`,
                            }}
                          >
                            {Array.from({ length: steps }).map((_, col) => {
                              const active = guitar[lane.row]?.[col];
                              const isCurrent = col === currentStep;

                              return (
                                <button
                                  key={`${lane.label}-${col}`}
                                  type="button"
                                  className={`composer-drum-cell composer-drum-cell--bass${
                                    active ? ' is-active' : ''
                                  }${isCurrent ? ' is-current' : ''}${getSubdivisionClassName(
                                    col
                                  )}${
                                    currentTabLockMap[Math.floor(col / COLLAB_BAR_LENGTH)]?.mine
                                      ? ' is-own-locked'
                                      : currentTabLockMap[Math.floor(col / COLLAB_BAR_LENGTH)]
                                        ? ' is-locked'
                                        : ''
                                  }`}
                                  style={guitarAccentStyle}
                                  onClick={() => {
                                    void handleGuitarCellToggle(lane.row, col);
                                  }}
                                  disabled={
                                    Boolean(
                                      currentTabLockMap[Math.floor(col / COLLAB_BAR_LENGTH)] &&
                                        !currentTabLockMap[Math.floor(col / COLLAB_BAR_LENGTH)].mine
                                    ) || Boolean(collabId && !canSyncCollab)
                                  }
                                />
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {activeTab === 'bass' && (
          <>
            <section
              className={`composer-chord-bar composer-chord-bar--bass${getGuideHighlightClass(
                'bass-grid'
              )}`}
            >
              <div className="composer-chord-copy">
                <span className="composer-chord-label">{chordMeta.bass.label}</span>
                <p className="composer-chord-description">{chordMeta.bass.description}</p>
              </div>

              <div className="composer-chord-list">
                {chordOptions.map((chord) => (
                  <div
                    key={chord}
                    className="composer-chord-chip"
                    draggable
                    onDragStart={(event) => {
                      event.dataTransfer.setData('text/plain', chord);
                    }}
                  >
                    {chord}
                  </div>
                ))}
              </div>
            </section>

            <section
              ref={bassShellRef}
              className={`composer-bass-shell${getGuideHighlightClass('bass-grid')}`}
            >
              <div className="composer-drum-panel composer-drum-panel--bass">
                <div className="composer-drums-wrap">
                  <div className="composer-sequencer-body">
                    <div className="composer-sequencer-header composer-sequencer-header--bass">
                      <div className="composer-drum-step-spacer">Bass Note</div>

                      <div
                        className="composer-step-grid composer-step-grid--bass"
                        style={{
                          gridTemplateColumns: `repeat(${steps}, ${DRUM_STEP_WIDTH}px)`,
                          ['--sequencer-step-span' as string]: `calc(${DRUM_STEP_WIDTH}px + 10px)`,
                        }}
                        >
                          {Array.from({ length: steps }).map((_, col) => (
                          <button
                            key={`bass-header-${col}`}
                            type="button"
                          className={`composer-drum-step-number composer-drum-step-number--bass${
                              col === currentStep ? ' is-current' : ''
                            }${getSubdivisionClassName(col)}${
                              loopRange && col >= loopRange.start && col <= loopRange.end
                                ? ' is-loop-active'
                                : ''
                            }${loopRange?.end === col ? ' is-loop-end' : ''}`}
                            onClick={() => handleStepLoopSelect(col)}
                            aria-label={`${col + 1}번 위치까지 반복`}
                            title={`${col + 1}번 위치까지 반복`}
                          >
                            <span className="sr-only">{col + 1}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="composer-sequencer-rows">
                      {BASS_NOTES.map((note, row) => {
                        const bassAccent = bassLaneColors[row % bassLaneColors.length];
                        const bassAccentStyle = {
                          '--bass-accent': bassAccent,
                        } as CSSProperties;

                        return (
                          <div key={note} className="composer-drum-row composer-drum-row--bass">
                            <div
                              className="composer-drum-track composer-drum-track--bass"
                              style={bassAccentStyle}
                            >
                              <strong>{note}</strong>
                              <span>Bass lane</span>
                            </div>

                            <div
                              className="composer-drum-row-grid composer-drum-row-grid--bass"
                              style={{
                                gridTemplateColumns: `repeat(${steps}, ${DRUM_STEP_WIDTH}px)`,
                                ['--sequencer-step-span' as string]: `calc(${DRUM_STEP_WIDTH}px + 10px)`,
                              }}
                            >
                              {Array.from({ length: steps }).map((_, col) => {
                                const active = bass[row]?.[col];
                                const isCurrent = col === currentStep;

                                return (
                                  <button
                                    key={`${note}-${col}`}
                                    type="button"
                                    className={`composer-drum-cell composer-drum-cell--bass${
                                      active ? ' is-active' : ''
                                    }${isCurrent ? ' is-current' : ''}${
                                      getSubdivisionClassName(col)
                                    }${getBassTutorialCellClass(row, col)}${
                                      currentTabLockMap[Math.floor(col / COLLAB_BAR_LENGTH)]?.mine
                                        ? ' is-own-locked'
                                        : currentTabLockMap[Math.floor(col / COLLAB_BAR_LENGTH)]
                                          ? ' is-locked'
                                          : ''
                                    }`}
                                    style={bassAccentStyle}
                                    onClick={() => {
                                      void handleBassCellToggle(row, col);
                                    }}
                                    onDragOver={(event) => event.preventDefault()}
                                    onDrop={async (event) => {
                                      event.preventDefault();
                                      const chord = event.dataTransfer.getData('text/plain');
                                      if (chord) {
                                        await handleBassChordDrop(chord, col);
                                      }
                                    }}
                                    disabled={
                                      Boolean(
                                        currentTabLockMap[Math.floor(col / COLLAB_BAR_LENGTH)] &&
                                          !currentTabLockMap[Math.floor(col / COLLAB_BAR_LENGTH)]
                                            .mine
                                      ) || Boolean(collabId && !canSyncCollab)
                                    }
                                  >
                                    {getBassTutorialCellGuideLabel(row, col) ? (
                                      <span className="composer-cell-guide-pill">
                                        {getBassTutorialCellGuideLabel(row, col)}
                                      </span>
                                    ) : null}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </>
        )}

        {activeTab === 'drums' && (
          <section
            ref={drumShellRef}
            className={`composer-drum-shell${getGuideHighlightClass('drums-grid')}`}
          >
            <div className="composer-drum-panel">
              <div className="composer-drums-wrap">
                <div className="composer-sequencer-body">
                  <div className="composer-sequencer-header">
                    <div className="composer-drum-step-spacer">Pattern</div>

                    <div
                      className="composer-step-grid"
                      style={{
                        gridTemplateColumns: `repeat(${steps}, ${DRUM_STEP_WIDTH}px)`,
                        ['--sequencer-step-span' as string]: `calc(${DRUM_STEP_WIDTH}px + 10px)`,
                      }}
                      >
                        {Array.from({ length: steps }).map((_, col) => (
                        <button
                          key={`drum-header-${col}`}
                          type="button"
                          className={`composer-drum-step-number${
                            col === currentStep ? ' is-current' : ''
                          }${getSubdivisionClassName(col)}${
                            loopRange && col >= loopRange.start && col <= loopRange.end
                              ? ' is-loop-active'
                              : ''
                          }${loopRange?.end === col ? ' is-loop-end' : ''}`}
                          onClick={() => handleStepLoopSelect(col)}
                          aria-label={`${col + 1}번 위치까지 반복`}
                          title={`${col + 1}번 위치까지 반복`}
                        >
                          <span className="sr-only">{col + 1}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="composer-sequencer-rows">
                    {drumTracks.slice(0, DRUM_ROWS).map((track, row) => (
                      <div key={track.name} className="composer-drum-row">
                        <div className={`composer-drum-track is-${track.tone}`}>
                          <strong>{track.name}</strong>
                          <span>{track.hint}</span>
                        </div>

                        <div
                          className="composer-drum-row-grid"
                          style={{
                            gridTemplateColumns: `repeat(${steps}, ${DRUM_STEP_WIDTH}px)`,
                            ['--sequencer-step-span' as string]: `calc(${DRUM_STEP_WIDTH}px + 10px)`,
                          }}
                        >
                          {Array.from({ length: steps }).map((_, col) => {
                            const active = drums[row]?.[col];
                            const isCurrent = col === currentStep;

                            return (
                              <button
                                key={`${track.name}-${col}`}
                                type="button"
                                className={`composer-drum-cell is-${track.tone}${
                                  active ? ' is-active' : ''
                                }${isCurrent ? ' is-current' : ''}${getSubdivisionClassName(
                                  col
                                )}${getDrumTutorialCellClass(row, col)}${
                                  currentTabLockMap[Math.floor(col / COLLAB_BAR_LENGTH)]?.mine
                                    ? ' is-own-locked'
                                    : currentTabLockMap[Math.floor(col / COLLAB_BAR_LENGTH)]
                                      ? ' is-locked'
                                      : ''
                                }`}
                                onClick={() => {
                                  void handleDrumCellToggle(row, col);
                                }}
                                disabled={
                                  Boolean(
                                    currentTabLockMap[Math.floor(col / COLLAB_BAR_LENGTH)] &&
                                      !currentTabLockMap[Math.floor(col / COLLAB_BAR_LENGTH)].mine
                                  ) || Boolean(collabId && !canSyncCollab)
                                }
                              >
                                {getDrumTutorialCellGuideLabel(row, col) ? (
                                  <span className="composer-cell-guide-pill">
                                    {getDrumTutorialCellGuideLabel(row, col)}
                                  </span>
                                ) : null}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}
      </main>

      <footer ref={footerRef} className={`composer-footer${getGuideHighlightClass('transport')}`}>
        <TransportBar onPlayStarted={() => setPlayedTutorialOnce(true)} />
      </footer>
    </div>
  );
}


