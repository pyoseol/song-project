import type { SongProject } from '../../store/songStore';
import './TrackWaveform.css';

type TrackWaveformProps = {
  project?: SongProject;
  seed: string;
  className?: string;
  bars?: number;
};

function hashSeed(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededNoise(seed: number, index: number) {
  let value = (seed + Math.imul(index + 1, 374761393)) >>> 0;
  value = Math.imul(value ^ (value >>> 13), 1274126177);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967295;
}

function getProjectEvents(project?: SongProject) {
  if (!project || !project.tracks || typeof project.tracks !== 'object') {
    return [];
  }

  const baseEvents = Object.values(project.tracks).flatMap((events) =>
    Array.isArray(events) ? events : []
  );
  const extraEvents = Array.isArray(project.extraTracks)
    ? project.extraTracks.flatMap((track) => (Array.isArray(track?.events) ? track.events : []))
    : [];

  return [...baseEvents, ...extraEvents].filter(
    (event) => event && typeof event === 'object' && Number.isFinite(Number(event.start))
  );
}

function createWaveform(project: SongProject | undefined, seedValue: string, count: number) {
  const seed = hashSeed(seedValue);
  const events = getProjectEvents(project);
  const steps = Math.max(1, project?.steps ?? 64);
  const activity = Array.from({ length: count }, () => 0);

  events.forEach((event) => {
    const start = Math.max(0, Math.min(steps - 1, event.start));
    const duration = Math.max(1, event.duration ?? 1);
    const firstBar = Math.min(count - 1, Math.floor((start / steps) * count));
    const lastBar = Math.min(count - 1, Math.floor(((start + duration - 1) / steps) * count));

    for (let bar = firstBar; bar <= lastBar; bar += 1) {
      activity[bar] += event.type ? 1.15 : 1;
    }
  });

  const maxActivity = Math.max(1, ...activity);
  return activity.map((value, index) => {
    const noise = seededNoise(seed, index);
    const neighbor = (activity[index - 1] ?? value) + (activity[index + 1] ?? value);
    const density = events.length ? (value * 2 + neighbor * 0.35) / (maxActivity * 2.7) : noise;
    return Math.round(Math.min(94, 20 + density * 62 + noise * 16));
  });
}

export default function TrackWaveform({
  project,
  seed,
  className = '',
  bars = 42,
}: TrackWaveformProps) {
  const waveform = createWaveform(project, seed, bars);

  return (
    <div className={`track-waveform ${className}`.trim()} aria-label="곡 파형 미리보기">
      {waveform.map((height, index) => (
        <span key={`${seed}-${index}`} style={{ height: `${height}%` }} />
      ))}
    </div>
  );
}
