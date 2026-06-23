import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import HandTracker from '../components/HandTracker';
import SiteHeader from '../components/layout/SiteHeader';
import { useSongStore } from '../store/songStore';
import { createAirInstrumentProject } from '../utils/songSketchDna';
import './AirGuitar.css';

type AirInstrumentMode = 'guitar' | 'drum' | 'piano';

type AirInstrumentStateEvent = CustomEvent<{
  instrumentMode: AirInstrumentMode;
  strumMode: boolean;
}>;

const modeButtons: Array<{ key: AirInstrumentMode; label: string; eventKey: string }> = [
  { key: 'guitar', label: '기타', eventKey: '1' },
  { key: 'drum', label: '드럼', eventKey: '2' },
  { key: 'piano', label: '피아노', eventKey: '3' },
];

function sendAirInstrumentKey(key: string) {
  window.dispatchEvent(new KeyboardEvent('keydown', { key }));
}

export default function AirGuitar() {
  const navigate = useNavigate();
  const loadProject = useSongStore((state) => state.loadProject);
  const [activeMode, setActiveMode] = useState<AirInstrumentMode>('guitar');
  const [isStrumMode, setIsStrumMode] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [recordedMode, setRecordedMode] = useState<AirInstrumentMode | null>(null);

  useEffect(() => {
    const handleStateChange = (event: Event) => {
      const { instrumentMode, strumMode } = (event as AirInstrumentStateEvent).detail;

      setActiveMode(instrumentMode);
      setIsStrumMode(strumMode);
    };

    window.addEventListener('air-instrument-state-change', handleStateChange);
    return () => {
      window.removeEventListener('air-instrument-state-change', handleStateChange);
    };
  }, []);

  const handleToggleRecording = () => {
    setIsRecording((current) => {
      if (current) {
        setRecordedMode(activeMode);
        return false;
      }

      setRecordedMode(null);
      return true;
    });
  };

  const handleApplyRecording = () => {
    const mode = recordedMode ?? activeMode;

    loadProject(createAirInstrumentProject(mode));
    navigate('/composer?source=air-instrument');
  };

  return (
    <div className="air-instrument-page">
      <SiteHeader activeSection="composer" />

      <main className="air-instrument-shell">
        <div className="air-instrument-toolbar">
          <button
            type="button"
            className="air-instrument-back-button"
            onClick={() => navigate('/composer')}
          >
            작곡으로
          </button>

          <div className="air-instrument-title">
            <span>카메라 연주 모드</span>
            <strong>에어 악기</strong>
          </div>

          <div className="air-instrument-controls" aria-label="에어 악기 모드">
            <div className="air-instrument-segmented">
              {modeButtons.map((mode) => (
                <button
                  key={mode.key}
                  type="button"
                  className={activeMode === mode.key ? 'is-active' : ''}
                  onClick={() => sendAirInstrumentKey(mode.eventKey)}
                >
                  {mode.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              className={`air-instrument-strum-button${isStrumMode ? ' is-active' : ''}`}
              disabled={activeMode !== 'guitar'}
              onClick={() => sendAirInstrumentKey('m')}
            >
              {isStrumMode ? '스트럼' : '줄 연주'}
            </button>
            <button
              type="button"
              className={`air-instrument-record-button${isRecording ? ' is-recording' : ''}`}
              onClick={handleToggleRecording}
            >
              {isRecording ? '녹음 중지' : '에어 녹음'}
            </button>
            <button
              type="button"
              className="air-instrument-apply-button"
              onClick={handleApplyRecording}
              disabled={!recordedMode && !isRecording}
            >
              작곡 화면에 찍기
            </button>
          </div>
        </div>

        <section className="air-instrument-stage" aria-label="에어 악기 연주 화면">
          <HandTracker />
        </section>
      </main>
    </div>
  );
}
