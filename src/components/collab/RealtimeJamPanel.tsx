import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  addDoc,
  collection,
  deleteDoc,
  onSnapshot,
  query,
  where,
  type DocumentData,
} from 'firebase/firestore';
import { db } from '../../firebase';
import { COLLAB_SESSION_ID, type CollabPresence } from '../../store/collabStore';
import './RealtimeJamPanel.css';

type JamParticipant = Pick<CollabPresence, 'sessionId' | 'email' | 'name' | 'lastSeenAt'>;
type JamSignalType = 'offer' | 'answer' | 'candidate';

type JamSignal = {
  projectId: string;
  fromSessionId: string;
  toSessionId: string;
  fromEmail: string;
  fromName: string;
  type: JamSignalType;
  payload: RTCSessionDescriptionInit | RTCIceCandidateInit;
  createdAt: number;
};

type NetworkStats = {
  jitterMs: number | null;
  packetLossPct: number | null;
  rttMs: number | null;
};

type RemoteStreamState = {
  sessionId: string;
  name: string;
  stream: MediaStream;
  connectionState: RTCPeerConnectionState;
  latencyMs: number | null;
  stats: NetworkStats;
};

type PeerBundle = {
  pc: RTCPeerConnection;
  pendingCandidates: RTCIceCandidateInit[];
  dataChannel: RTCDataChannel | null;
  latencyMs: number | null;
};

type RecordingResult = {
  audioUrl: string;
  manifestUrl: string;
  fileName: string;
  offsetMs: number;
};

type RealtimeJamPanelProps = {
  projectId: string;
  participants: JamParticipant[];
  localUser: { email: string; name: string } | null;
  bpm: number;
  disabled?: boolean;
};

const DEFAULT_STATS: NetworkStats = {
  jitterMs: null,
  packetLossPct: null,
  rttMs: null,
};

function parseTurnServers(): RTCIceServer[] {
  const turnUrls = String(import.meta.env.VITE_JAM_TURN_URLS ?? '');
  const urls = turnUrls
    .split(',')
    .map((url: string) => url.trim())
    .filter(Boolean);

  if (!urls.length) {
    return [];
  }

  const username = (import.meta.env.VITE_JAM_TURN_USERNAME ?? '').trim();
  const credential = (import.meta.env.VITE_JAM_TURN_CREDENTIAL ?? '').trim();
  return [
    {
      urls,
      ...(username && credential ? { username, credential } : {}),
    },
  ];
}

const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  ...parseTurnServers(),
];

const PEER_CONNECTION_CONFIG: RTCConfiguration = {
  iceServers: ICE_SERVERS,
  bundlePolicy: 'max-bundle',
  iceCandidatePoolSize: 4,
  rtcpMuxPolicy: 'require',
};

function getSignalPayload(data: DocumentData): JamSignal | null {
  if (
    typeof data.projectId !== 'string' ||
    typeof data.fromSessionId !== 'string' ||
    typeof data.toSessionId !== 'string' ||
    typeof data.type !== 'string' ||
    typeof data.createdAt !== 'number'
  ) {
    return null;
  }

  if (data.type !== 'offer' && data.type !== 'answer' && data.type !== 'candidate') {
    return null;
  }

  return {
    projectId: data.projectId,
    fromSessionId: data.fromSessionId,
    toSessionId: data.toSessionId,
    fromEmail: typeof data.fromEmail === 'string' ? data.fromEmail : '',
    fromName: typeof data.fromName === 'string' ? data.fromName : 'Guest',
    type: data.type,
    payload: data.payload as RTCSessionDescriptionInit | RTCIceCandidateInit,
    createdAt: data.createdAt,
  };
}

function getAudioConstraints(deviceId: string): MediaStreamConstraints {
  const audio: MediaTrackConstraints & { latency?: number } = {
    echoCancellation: false,
    noiseSuppression: false,
    autoGainControl: false,
    channelCount: 1,
    sampleRate: 48_000,
    latency: 0,
    ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
  };

  return { audio, video: false };
}

function preferOpus(transceiver: RTCRtpTransceiver) {
  if (!('setCodecPreferences' in transceiver) || !RTCRtpSender.getCapabilities) {
    return;
  }

  const codecs = RTCRtpSender.getCapabilities('audio')?.codecs ?? [];
  const opus = codecs.filter((codec) => codec.mimeType.toLowerCase() === 'audio/opus');
  const rest = codecs.filter((codec) => codec.mimeType.toLowerCase() !== 'audio/opus');

  if (opus.length) {
    transceiver.setCodecPreferences([...opus, ...rest]);
  }
}

function tuneOpusForLowLatency(description: RTCSessionDescriptionInit): RTCSessionDescriptionInit {
  if (!description.sdp) {
    return description;
  }

  const lines = description.sdp.split('\r\n');
  const opusRtpMap = lines.find((line) => /^a=rtpmap:\d+ opus\/48000/i.test(line));
  const opusPayload = opusRtpMap?.match(/^a=rtpmap:(\d+)/)?.[1];

  if (!opusPayload) {
    return description;
  }

  const fmtpPrefix = `a=fmtp:${opusPayload}`;
  const lowLatencyParams = [
    'minptime=10',
    'useinbandfec=0',
    'usedtx=0',
    'stereo=0',
    'sprop-stereo=0',
    'maxaveragebitrate=128000',
  ];

  const nextLines = lines.map((line) => {
    if (!line.startsWith(fmtpPrefix)) {
      return line;
    }

    const existing = new Set(
      line
        .slice(fmtpPrefix.length)
        .replace(/^ /, '')
        .split(';')
        .map((part) => part.trim())
        .filter(Boolean)
        .map((part) => part.split('=')[0])
    );
    const additions = lowLatencyParams.filter((param) => !existing.has(param.split('=')[0]));
    return additions.length ? `${line};${additions.join(';')}` : line;
  });

  if (!nextLines.some((line) => line.startsWith(fmtpPrefix))) {
    const insertAt = lines.findIndex((line) => line === opusRtpMap);
    nextLines.splice(insertAt + 1, 0, `${fmtpPrefix} ${lowLatencyParams.join(';')}`);
  }

  return {
    ...description,
    sdp: nextLines.join('\r\n'),
  };
}

function getAverageLatency(streams: RemoteStreamState[]) {
  const latencies = streams
    .map((stream) => stream.latencyMs)
    .filter((value): value is number => typeof value === 'number');

  if (!latencies.length) {
    return 0;
  }

  return Math.round(latencies.reduce((sum, value) => sum + value, 0) / latencies.length);
}

function getQualityLabel(stats: NetworkStats, latencyMs: number | null) {
  const packetLoss = stats.packetLossPct ?? 0;
  const jitter = stats.jitterMs ?? 0;
  const latency = latencyMs ?? stats.rttMs ?? 0;

  if (packetLoss > 4 || jitter > 35 || latency > 90) {
    return 'weak';
  }

  if (packetLoss > 1 || jitter > 18 || latency > 55) {
    return 'ok';
  }

  return 'good';
}

function getQualityText(quality: 'good' | 'ok' | 'weak') {
  if (quality === 'good') {
    return '좋음';
  }

  if (quality === 'ok') {
    return '보통';
  }

  return '불안정';
}

function getConnectionText(state: RTCPeerConnectionState) {
  switch (state) {
    case 'new':
      return '대기';
    case 'connecting':
      return '연결 중';
    case 'connected':
      return '연결됨';
    case 'disconnected':
      return '끊김';
    case 'failed':
      return '실패';
    case 'closed':
      return '종료됨';
    default:
      return state;
  }
}

export default function RealtimeJamPanel({
  projectId,
  participants,
  localUser,
  bpm,
  disabled = false,
}: RealtimeJamPanelProps) {
  const [isLive, setIsLive] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [statusText, setStatusText] = useState('대기 중');
  const [remoteStreams, setRemoteStreams] = useState<RemoteStreamState[]>([]);
  const [metronomeOn, setMetronomeOn] = useState(false);
  const [beatIndex, setBeatIndex] = useState(0);
  const [errorText, setErrorText] = useState('');
  const [inputDevices, setInputDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingResult, setRecordingResult] = useState<RecordingResult | null>(null);

  const localStreamRef = useRef<MediaStream | null>(null);
  const peersRef = useRef(new Map<string, PeerBundle>());
  const joinedAtRef = useRef(0);
  const metronomeAudioRef = useRef<AudioContext | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);
  const recordingStartedAtRef = useRef(0);

  const hasTurnServer = ICE_SERVERS.length > 1;

  const activeParticipants = useMemo(
    () =>
      participants
        .filter((participant) => participant.sessionId !== COLLAB_SESSION_ID)
        .sort((left, right) => left.sessionId.localeCompare(right.sessionId)),
    [participants]
  );

  const refreshInputDevices = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) {
      return;
    }

    const devices = await navigator.mediaDevices.enumerateDevices();
    const audioInputs = devices.filter((device) => device.kind === 'audioinput');
    setInputDevices(audioInputs);

    if (!selectedDeviceId && audioInputs[0]?.deviceId) {
      setSelectedDeviceId(audioInputs[0].deviceId);
    }
  }, [selectedDeviceId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refreshInputDevices().catch(console.error);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [refreshInputDevices]);

  useEffect(() => {
    if (!navigator.mediaDevices?.addEventListener) {
      return undefined;
    }

    navigator.mediaDevices.addEventListener('devicechange', refreshInputDevices);
    return () => navigator.mediaDevices.removeEventListener('devicechange', refreshInputDevices);
  }, [refreshInputDevices]);

  const sendSignal = useCallback(
    async (
      toSessionId: string,
      type: JamSignalType,
      payload: RTCSessionDescriptionInit | RTCIceCandidateInit
    ) => {
      if (!localUser) {
        return;
      }

      await addDoc(collection(db, 'collab_jam_signals'), {
        projectId,
        fromSessionId: COLLAB_SESSION_ID,
        toSessionId,
        fromEmail: localUser.email,
        fromName: localUser.name,
        type,
        payload,
        createdAt: Date.now(),
      });
    },
    [localUser, projectId]
  );

  const updateRemoteState = useCallback(
    (sessionId: string, patch: Partial<Omit<RemoteStreamState, 'sessionId'>>) => {
      setRemoteStreams((current) =>
        current.map((entry) => (entry.sessionId === sessionId ? { ...entry, ...patch } : entry))
      );
    },
    []
  );

  const attachDataChannel = useCallback(
    (sessionId: string, channel: RTCDataChannel) => {
      const peer = peersRef.current.get(sessionId);
      if (peer) {
        peer.dataChannel = channel;
      }

      channel.onmessage = (event) => {
        try {
          const message = JSON.parse(String(event.data)) as { kind: string; sentAt?: number };
          if (message.kind === 'ping' && typeof message.sentAt === 'number') {
            channel.send(JSON.stringify({ kind: 'pong', sentAt: message.sentAt }));
          }
          if (message.kind === 'pong' && typeof message.sentAt === 'number') {
            const latencyMs = Math.max(1, Math.round((Date.now() - message.sentAt) / 2));
            const currentPeer = peersRef.current.get(sessionId);
            if (currentPeer) {
              currentPeer.latencyMs = latencyMs;
            }
            updateRemoteState(sessionId, { latencyMs });
          }
        } catch {
          return;
        }
      };
    },
    [updateRemoteState]
  );

  const createPeer = useCallback(
    (participant: JamParticipant, shouldOffer: boolean) => {
      const existing = peersRef.current.get(participant.sessionId);
      if (existing) {
        return existing;
      }

      const pc = new RTCPeerConnection(PEER_CONNECTION_CONFIG);
      const bundle: PeerBundle = {
        pc,
        pendingCandidates: [],
        dataChannel: null,
        latencyMs: null,
      };
      peersRef.current.set(participant.sessionId, bundle);

      localStreamRef.current?.getTracks().forEach((track) => {
        const stream = localStreamRef.current;
        if (stream) {
          const sender = pc.addTrack(track, stream);
          const parameters = sender.getParameters();
          sender
            .setParameters({
              ...parameters,
              encodings: [
                {
                  ...(parameters.encodings?.[0] ?? {}),
                  maxBitrate: 128_000,
                  priority: 'high',
                  networkPriority: 'high',
                },
              ],
            })
            .catch(console.error);
        }
      });

      pc.getTransceivers()
        .filter((transceiver) => transceiver.sender.track?.kind === 'audio')
        .forEach(preferOpus);

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          void sendSignal(participant.sessionId, 'candidate', event.candidate.toJSON()).catch(
            console.error
          );
        }
      };

      pc.ontrack = (event) => {
        const stream = event.streams[0];
        if (!stream) {
          return;
        }

        setRemoteStreams((current) => {
          const existingStream = current.find((entry) => entry.sessionId === participant.sessionId);
          if (existingStream) {
            return current.map((entry) =>
              entry.sessionId === participant.sessionId ? { ...entry, stream } : entry
            );
          }

          return [
            ...current,
            {
              sessionId: participant.sessionId,
              name: participant.name,
              stream,
              connectionState: pc.connectionState,
              latencyMs: bundle.latencyMs,
              stats: DEFAULT_STATS,
            },
          ];
        });
      };

      pc.onconnectionstatechange = () => {
        updateRemoteState(participant.sessionId, { connectionState: pc.connectionState });
      };

      pc.ondatachannel = (event) => {
        attachDataChannel(participant.sessionId, event.channel);
      };

      if (shouldOffer) {
        const channel = pc.createDataChannel('latency', { ordered: false, maxRetransmits: 0 });
        attachDataChannel(participant.sessionId, channel);
        void pc
          .createOffer({ offerToReceiveAudio: true })
          .then(tuneOpusForLowLatency)
          .then((offer) => pc.setLocalDescription(offer).then(() => offer))
          .then((offer) => sendSignal(participant.sessionId, 'offer', offer))
          .catch((error) => {
            console.error(error);
            setErrorText('합주 연결 제안을 만들지 못했습니다.');
          });
      }

      return bundle;
    },
    [attachDataChannel, sendSignal, updateRemoteState]
  );

  const closePeer = useCallback((sessionId: string) => {
    const peer = peersRef.current.get(sessionId);
    if (!peer) {
      return;
    }

    peer.dataChannel?.close();
    peer.pc.close();
    peersRef.current.delete(sessionId);
    setRemoteStreams((current) => current.filter((entry) => entry.sessionId !== sessionId));
  }, []);

  const stopRecording = useCallback(() => {
    recorderRef.current?.stop();
  }, []);

  const stopJam = useCallback(() => {
    stopRecording();
    peersRef.current.forEach((_, sessionId) => closePeer(sessionId));
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;
    setRemoteStreams([]);
    setIsLive(false);
    setMetronomeOn(false);
    setStatusText('대기 중');
  }, [closePeer, stopRecording]);

  const startJam = useCallback(async () => {
    if (!localUser || disabled) {
      return;
    }

    try {
      setErrorText('');
      setStatusText('마이크 확인 중');
      joinedAtRef.current = Date.now();
      const stream = await navigator.mediaDevices.getUserMedia(getAudioConstraints(selectedDeviceId));
      stream.getAudioTracks().forEach((track) => {
        track.enabled = !isMuted;
        track.contentHint = 'music';
      });
      localStreamRef.current = stream;
      setIsLive(true);
      setStatusText('연결 중');
      void refreshInputDevices().catch(console.error);
    } catch (error) {
      console.error(error);
      setStatusText('마이크 실패');
      setErrorText('실시간 합주에 들어가려면 마이크 권한을 허용해야 합니다.');
    }
  }, [disabled, isMuted, localUser, refreshInputDevices, selectedDeviceId]);

  const handleSignal = useCallback(
    async (signal: JamSignal) => {
      const participant: JamParticipant = {
        sessionId: signal.fromSessionId,
        email: signal.fromEmail,
        name: signal.fromName,
        lastSeenAt: Date.now(),
      };
      const peer = createPeer(participant, false);

      if (signal.type === 'offer') {
        await peer.pc.setRemoteDescription(signal.payload as RTCSessionDescriptionInit);
        await Promise.all(
          peer.pendingCandidates.splice(0).map((candidate) => peer.pc.addIceCandidate(candidate))
        );
        const answer = tuneOpusForLowLatency(await peer.pc.createAnswer());
        await peer.pc.setLocalDescription(answer);
        await sendSignal(signal.fromSessionId, 'answer', answer);
        return;
      }

      if (signal.type === 'answer') {
        if (peer.pc.signalingState === 'have-local-offer') {
          await peer.pc.setRemoteDescription(signal.payload as RTCSessionDescriptionInit);
          await Promise.all(
            peer.pendingCandidates.splice(0).map((candidate) => peer.pc.addIceCandidate(candidate))
          );
        }
        return;
      }

      const candidate = signal.payload as RTCIceCandidateInit;
      if (peer.pc.remoteDescription) {
        await peer.pc.addIceCandidate(candidate);
      } else {
        peer.pendingCandidates.push(candidate);
      }
    },
    [createPeer, sendSignal]
  );

  const startRecording = useCallback(() => {
    if (!localStreamRef.current || !MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
      setErrorText('이 브라우저에서는 녹음을 지원하지 않습니다.');
      return;
    }

    recordingChunksRef.current = [];
    recordingStartedAtRef.current = Date.now();
    const recorder = new MediaRecorder(localStreamRef.current, {
      mimeType: 'audio/webm;codecs=opus',
      audioBitsPerSecond: 128_000,
    });

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        recordingChunksRef.current.push(event.data);
      }
    };

    recorder.onstop = () => {
      const audioBlob = new Blob(recordingChunksRef.current, { type: 'audio/webm;codecs=opus' });
      const audioUrl = URL.createObjectURL(audioBlob);
      const averageLatencyMs = getAverageLatency(remoteStreams);
      const fileName = `jam-${projectId}-${recordingStartedAtRef.current}`;
      const manifest = {
        projectId,
        fileName: `${fileName}.webm`,
        recorderSessionId: COLLAB_SESSION_ID,
        recorderName: localUser?.name ?? 'Guest',
        startedAt: recordingStartedAtRef.current,
        endedAt: Date.now(),
        bpm,
        averagePeerLatencyMs: averageLatencyMs,
        suggestedShiftMs: -averageLatencyMs,
        note: '후처리 싱크를 맞출 때 이 로컬 트랙을 suggestedShiftMs 값만큼 이동하세요.',
      };
      const manifestUrl = URL.createObjectURL(
        new Blob([JSON.stringify(manifest, null, 2)], { type: 'application/json' })
      );

      setRecordingResult({
        audioUrl,
        manifestUrl,
        fileName,
        offsetMs: -averageLatencyMs,
      });
      setIsRecording(false);
    };

    recorderRef.current = recorder;
    recorder.start(250);
    setRecordingResult(null);
    setIsRecording(true);
  }, [bpm, localUser?.name, projectId, remoteStreams]);

  useEffect(() => {
    if (!isLive) {
      return undefined;
    }

    activeParticipants.forEach((participant) => {
      const shouldOffer = COLLAB_SESSION_ID.localeCompare(participant.sessionId) < 0;
      createPeer(participant, shouldOffer);
    });

    peersRef.current.forEach((_, sessionId) => {
      if (!activeParticipants.some((participant) => participant.sessionId === sessionId)) {
        closePeer(sessionId);
      }
    });

    return undefined;
  }, [activeParticipants, closePeer, createPeer, isLive]);

  useEffect(() => {
    if (!isLive) {
      return undefined;
    }

    const signalsQuery = query(
      collection(db, 'collab_jam_signals'),
      where('toSessionId', '==', COLLAB_SESSION_ID)
    );

    const unsubscribe = onSnapshot(signalsQuery, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type !== 'added') {
          return;
        }

        const signal = getSignalPayload(change.doc.data());
        if (
          !signal ||
          signal.projectId !== projectId ||
          signal.fromSessionId === COLLAB_SESSION_ID ||
          signal.createdAt < joinedAtRef.current - 5_000
        ) {
          return;
        }

        void handleSignal(signal)
          .catch((error) => {
            console.error(error);
            setErrorText('합주 연결 신호를 처리하지 못했습니다.');
          })
          .finally(() => {
            void deleteDoc(change.doc.ref).catch(console.error);
          });
      });
    });

    return () => unsubscribe();
  }, [handleSignal, isLive, projectId]);

  useEffect(() => {
    if (!isLive) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      peersRef.current.forEach((peer) => {
        if (peer.dataChannel?.readyState === 'open') {
          peer.dataChannel.send(JSON.stringify({ kind: 'ping', sentAt: Date.now() }));
        }
      });
    }, 1_000);

    return () => window.clearInterval(timer);
  }, [isLive]);

  useEffect(() => {
    if (!isLive) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      peersRef.current.forEach((peer, sessionId) => {
        void peer.pc.getStats().then((report) => {
          let nextStats: NetworkStats = DEFAULT_STATS;
          report.forEach((stat) => {
            if (stat.type === 'inbound-rtp' && stat.kind === 'audio') {
              const received = Number(stat.packetsReceived ?? 0);
              const lost = Number(stat.packetsLost ?? 0);
              nextStats = {
                ...nextStats,
                jitterMs: Math.round(Number(stat.jitter ?? 0) * 1000),
                packetLossPct:
                  received + lost > 0 ? Math.round((lost / (received + lost)) * 1000) / 10 : 0,
              };
            }

            if (stat.type === 'candidate-pair' && stat.state === 'succeeded') {
              nextStats = {
                ...nextStats,
                rttMs:
                  typeof stat.currentRoundTripTime === 'number'
                    ? Math.round(stat.currentRoundTripTime * 1000)
                    : nextStats.rttMs,
              };
            }
          });
          updateRemoteState(sessionId, { stats: nextStats });
        });
      });
    }, 2_000);

    return () => window.clearInterval(timer);
  }, [isLive, updateRemoteState]);

  useEffect(() => {
    localStreamRef.current?.getAudioTracks().forEach((track) => {
      track.enabled = !isMuted;
    });
  }, [isMuted]);

  useEffect(() => () => stopJam(), [stopJam]);

  useEffect(() => {
    if (!metronomeOn || !isLive) {
      return undefined;
    }

    const context = metronomeAudioRef.current ?? new AudioContext({ latencyHint: 'interactive' });
    metronomeAudioRef.current = context;
    const intervalMs = 60_000 / Math.max(1, bpm);

    const playTick = () => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.frequency.value = beatIndex % 4 === 0 ? 1_100 : 760;
      gain.gain.setValueAtTime(0.001, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.18, context.currentTime + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.055);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + 0.06);
      setBeatIndex((current) => (current + 1) % 4);
    };

    playTick();
    const timer = window.setInterval(playTick, intervalMs);
    return () => window.clearInterval(timer);
  }, [beatIndex, bpm, isLive, metronomeOn]);

  const remoteCount = remoteStreams.filter(
    (stream) => stream.connectionState === 'connected'
  ).length;
  const displayStatus = isLive
    ? activeParticipants.length
      ? '합주 중'
      : '멤버 대기 중'
    : statusText;
  const averageLatencyMs = getAverageLatency(remoteStreams);

  return (
    <article className="collab-room-panel realtime-jam-panel">
      <div className="collab-room-panel-head realtime-jam-head">
        <div>
          <strong>실시간 합주</strong>
          <span>저지연 마이크 전송, 네트워크 진단, 녹음 후 싱크 보정을 지원합니다.</span>
        </div>
        <em className={`realtime-jam-status${isLive ? ' is-live' : ''}`}>{displayStatus}</em>
      </div>

      <div className="realtime-jam-device-row">
        <label>
          <span>입력 장치</span>
          <select
            value={selectedDeviceId}
            onChange={(event) => setSelectedDeviceId(event.target.value)}
            disabled={isLive}
          >
            {inputDevices.length ? (
              inputDevices.map((device, index) => (
                <option key={device.deviceId || `input-${index}`} value={device.deviceId}>
                  {device.label || `입력 ${index + 1}`}
                </option>
              ))
            ) : (
              <option value="">기본 마이크</option>
            )}
          </select>
        </label>
        <button
          type="button"
          className="collab-secondary-button"
          onClick={() => void refreshInputDevices().catch(console.error)}
          disabled={isLive}
        >
          입력 새로고침
        </button>
      </div>

      <div className="realtime-jam-meter">
        <div>
          <span>연결 멤버</span>
          <strong>
            {remoteCount}/{activeParticipants.length}
          </strong>
        </div>
        <div>
          <span>BPM</span>
          <strong>{bpm}</strong>
        </div>
        <div>
          <span>평균 지연</span>
          <strong>{averageLatencyMs ? `${averageLatencyMs}ms` : '-'}</strong>
        </div>
        <div>
          <span>릴레이 서버</span>
          <strong>{hasTurnServer ? 'TURN 준비됨' : 'P2P/STUN'}</strong>
        </div>
        <div>
          <span>오디오 드라이버</span>
          <strong>브라우저 모드</strong>
        </div>
        <div>
          <span>후처리 보정</span>
          <strong>{averageLatencyMs ? `${-averageLatencyMs}ms` : '준비됨'}</strong>
        </div>
      </div>

      <div className="realtime-jam-actions">
        {!isLive ? (
          <button
            type="button"
            className="collab-primary-button"
            onClick={() => void startJam()}
            disabled={disabled || !localUser}
          >
            합주 들어가기
          </button>
        ) : (
          <button type="button" className="collab-secondary-button" onClick={stopJam}>
            합주 나가기
          </button>
        )}

        <button
          type="button"
          className="collab-secondary-button"
          onClick={() => setIsMuted((current) => !current)}
          disabled={!isLive}
        >
          {isMuted ? '마이크 켜기' : '마이크 끄기'}
        </button>

        <button
          type="button"
          className="collab-secondary-button"
          onClick={() => {
            setBeatIndex(0);
            setMetronomeOn((current) => !current);
          }}
          disabled={!isLive}
        >
          {metronomeOn ? '메트로놈 끄기' : '메트로놈 켜기'}
        </button>

        {!isRecording ? (
          <button
            type="button"
            className="collab-secondary-button"
            onClick={startRecording}
            disabled={!isLive}
          >
            트랙 녹음
          </button>
        ) : (
          <button type="button" className="collab-secondary-button" onClick={stopRecording}>
            녹음 중지
          </button>
        )}
      </div>

      <div className="realtime-jam-hints">
        <span>실제 지연을 가장 낮추려면 유선 헤드폰과 오디오 인터페이스를 권장합니다.</span>
      </div>

      {errorText ? <p className="realtime-jam-error">{errorText}</p> : null}

      {recordingResult ? (
        <div className="realtime-jam-recording">
          <strong>트랙 녹음 완료</strong>
          <span>권장 싱크 보정값: {recordingResult.offsetMs}ms</span>
          <a href={recordingResult.audioUrl} download={`${recordingResult.fileName}.webm`}>
            오디오 다운로드
          </a>
          <a href={recordingResult.manifestUrl} download={`${recordingResult.fileName}.sync.json`}>
            싱크 JSON 다운로드
          </a>
        </div>
      ) : null}

      <div className="realtime-jam-peer-list">
        {remoteStreams.length ? (
          remoteStreams.map((remote) => {
            const quality = getQualityLabel(remote.stats, remote.latencyMs);
            return (
              <div key={remote.sessionId} className="realtime-jam-peer">
                <div>
                  <strong>{remote.name}</strong>
                  <span>
                    {getConnectionText(remote.connectionState)}
                    {remote.latencyMs ? ` · 지연 ${remote.latencyMs}ms` : ''}
                  </span>
                  <span>
                    지터 {remote.stats.jitterMs ?? '-'}ms · 손실{' '}
                    {remote.stats.packetLossPct ?? '-'}% · 왕복 {remote.stats.rttMs ?? '-'}ms
                  </span>
                </div>
                <em className={`realtime-jam-quality is-${quality}`}>{getQualityText(quality)}</em>
                <audio
                  autoPlay
                  playsInline
                  ref={(node) => {
                    if (node && node.srcObject !== remote.stream) {
                      node.srcObject = remote.stream;
                    }
                  }}
                />
              </div>
            );
          })
        ) : (
          <div className="realtime-jam-empty">
            합주에 들어가면 같은 방의 멤버와 자동으로 연결됩니다.
          </div>
        )}
      </div>
    </article>
  );
}
