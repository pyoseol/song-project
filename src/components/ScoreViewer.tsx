import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  BASS_NOTES,
  CHICAGO_STREET_NOTES,
  GLOCKENSPIEL_NOTES,
  GUITAR_TRACK_LABELS,
  MELODY_NOTES,
  PICCOLO_NOTES,
  SAXOPHONE_NOTES,
  STUDIO_ALTO_SAX_NOTES,
  SUPPORTING_PIANO_NOTES,
  VIOLIN_NOTES,
} from '../constants/composer';
import {
  LYRICS_MELODY_TRACK_ID,
  type ExtraInstrumentTrack,
  type InstrumentKey,
  useSongStore,
} from '../store/songStore';
import { buildMusicXml, hasTrackNotes, type MusicXmlTrack } from '../utils/musicXml';
import './ScoreViewer.css';

type ScoreViewerProps = {
  open: boolean;
  title: string;
  onClose: () => void;
  parts: Array<{
    id: string;
    trackId?: string;
    instrument: InstrumentKey;
    name: string;
  }>;
};

type ScoreRenderer = {
  Zoom: number;
  clear: () => void;
  load: (content: string) => Promise<unknown>;
  render: () => void;
};

type ScoreTrackOption = {
  id: string;
  name: string;
  track: MusicXmlTrack | null;
};

type ScoreRendererModule = typeof import('opensheetmusicdisplay');
let scoreRendererModulePromise: Promise<ScoreRendererModule> | null = null;

function loadScoreRendererModule() {
  if (!scoreRendererModulePromise) {
    scoreRendererModulePromise = import('opensheetmusicdisplay').catch((error) => {
      scoreRendererModulePromise = null;
      throw error;
    });
  }
  return scoreRendererModulePromise;
}

void loadScoreRendererModule();

const instrumentPitches: Record<Exclude<InstrumentKey, 'drums'>, readonly string[]> = {
  melody: MELODY_NOTES,
  violin: VIOLIN_NOTES,
  saxophone: SAXOPHONE_NOTES,
  guitar: GUITAR_TRACK_LABELS,
  bass: BASS_NOTES,
  glockenspiel: GLOCKENSPIEL_NOTES,
  piccolo: PICCOLO_NOTES,
  supportingPiano: SUPPORTING_PIANO_NOTES,
  chicagoStreet: CHICAGO_STREET_NOTES,
  studioAltoSax: STUDIO_ALTO_SAX_NOTES,
};

function extraTrackToScoreTrack(
  track: ExtraInstrumentTrack,
  noteLyrics: Record<string, string>
): MusicXmlTrack | null {
  if (track.instrument === 'drums') return null;
  return {
    id: track.id,
    name: track.label,
    grid: track.grid,
    lengths: track.melodyLengths,
    pitches: instrumentPitches[track.instrument],
    lyrics: track.id === LYRICS_MELODY_TRACK_ID ? noteLyrics : undefined,
  };
}

function ScoreIcon({ name }: { name: 'close' | 'download' | 'minus' | 'plus' }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      {name === 'close' ? <path d="m6 6 12 12M18 6 6 18" /> : null}
      {name === 'download' ? <path d="M12 3v12m0 0 5-5m-5 5-5-5M4 19h16" /> : null}
      {name === 'minus' ? <path d="M5 12h14" /> : null}
      {name === 'plus' ? <path d="M5 12h14M12 5v14" /> : null}
    </svg>
  );
}

function sanitizeFileName(value: string) {
  return value.trim().replace(/[\\/:*?"<>|]/g, '-').replace(/\s+/g, ' ') || 'score';
}

const PDF_KOREAN_FONT_FILE = 'NanumGothic-Regular.ttf';
const PDF_KOREAN_FONT_NAME = 'NanumGothic';
const KOREAN_TEXT_PATTERN = /[ㄱ-ㅎㅏ-ㅣ가-힣]/;
let pdfKoreanFontPromise: Promise<string> | null = null;

function loadPdfKoreanFont() {
  if (!pdfKoreanFontPromise) {
    pdfKoreanFontPromise = fetch(`/fonts/${PDF_KOREAN_FONT_FILE}`)
      .then((response) => {
        if (!response.ok) throw new Error('PDF 한글 폰트를 불러오지 못했습니다.');
        return response.arrayBuffer();
      })
      .then((buffer) => {
        const bytes = new Uint8Array(buffer);
        let binary = '';
        const chunkSize = 0x8000;
        for (let index = 0; index < bytes.length; index += chunkSize) {
          binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
        }
        return btoa(binary);
      })
      .catch((error) => {
        pdfKoreanFontPromise = null;
        throw error;
      });
  }
  return pdfKoreanFontPromise;
}

function applyKoreanFontToSvg(svg: SVGSVGElement) {
  svg.querySelectorAll<SVGElement>('text, tspan').forEach((element) => {
    if (!KOREAN_TEXT_PATTERN.test(element.textContent ?? '')) return;
    element.setAttribute('font-family', PDF_KOREAN_FONT_NAME);
    element.style.fontFamily = PDF_KOREAN_FONT_NAME;
  });
}

function getStaffLabelPosition(element: SVGTextElement) {
  const staffLine = element.closest('g.staffline');
  const measure = staffLine?.querySelector('g.vf-measure');
  if (!measure) return null;

  const staffSegments = [...measure.querySelectorAll<SVGPathElement>(':scope > path')]
    .flatMap((path) => {
      const match = path.getAttribute('d')?.match(
        /^M(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)L(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)$/
      );
      if (!match) return [];
      const [, startX, startY, endX, endY] = match.map(Number);
      if (Math.abs(startY - endY) > 0.1 || Math.abs(endX - startX) < 20) return [];
      return [{ left: Math.min(startX, endX), top: startY }];
    });
  if (!staffSegments.length) return null;

  const x = Math.min(...staffSegments.map((segment) => segment.left)) + 2;
  const staffTop = Math.min(...staffSegments.map((segment) => segment.top));
  const labelRight = x + element.getComputedTextLength();
  const overlappingGlyphTop = [
    ...measure.querySelectorAll<SVGGraphicsElement>('.vf-clef, .vf-timesignature, .vf-stavenote'),
  ].flatMap((glyph) => {
      const bounds = glyph.getBBox();
      const overlapsLabel = bounds.x < labelRight + 4 && bounds.x + bounds.width > x - 2;
      return overlapsLabel ? [bounds.y] : [];
    });

  return {
    x,
    y: Math.min(
      staffTop - 8,
      overlappingGlyphTop.length ? Math.min(...overlappingGlyphTop) - 3 : Number.POSITIVE_INFINITY
    ),
  };
}

function styleInstrumentLabels(container: ParentNode, instrumentNames: string[]) {
  const names = new Set(instrumentNames);
  container.querySelectorAll<SVGSVGElement>('svg').forEach((svg) => {
    svg.querySelectorAll<SVGTextElement>('text').forEach((element) => {
      if (!names.has(element.textContent?.trim() ?? '')) return;
      element.setAttribute('text-anchor', 'start');
      element.setAttribute('font-family', PDF_KOREAN_FONT_NAME);
      element.setAttribute('font-size', '7px');
      element.setAttribute('font-weight', '400');
      element.setAttribute('fill', '#000000');
      element.style.fontFamily = PDF_KOREAN_FONT_NAME;
      const position = getStaffLabelPosition(element);
      if (position) {
        element.setAttribute('x', String(position.x));
        element.setAttribute('y', String(position.y));
      }
    });
  });
}

function addPdfSystemBreaks(xml: string, measuresPerSystem = 4) {
  const documentNode = new DOMParser().parseFromString(xml, 'application/xml');
  if (documentNode.querySelector('parsererror')) return xml;

  const firstPart = documentNode.querySelector('part');
  if (!firstPart) return xml;

  const measures = [...firstPart.querySelectorAll(':scope > measure')];
  measures.forEach((measure, index) => {
    if (index === 0 || index % measuresPerSystem !== 0) return;
    const print = documentNode.createElement('print');
    print.setAttribute('new-system', 'yes');
    measure.insertBefore(print, measure.firstChild);
  });

  return new XMLSerializer().serializeToString(documentNode);
}

export function ScoreViewer({ open, title, onClose, parts }: ScoreViewerProps) {
  const bpm = useSongStore((state) => state.bpm);
  const melody = useSongStore((state) => state.melody);
  const melodyLengths = useSongStore((state) => state.melodyLengths);
  const violin = useSongStore((state) => state.violin);
  const violinLengths = useSongStore((state) => state.violinLengths);
  const saxophone = useSongStore((state) => state.saxophone);
  const saxophoneLengths = useSongStore((state) => state.saxophoneLengths);
  const guitar = useSongStore((state) => state.guitar);
  const guitarLengths = useSongStore((state) => state.guitarLengths);
  const bass = useSongStore((state) => state.bass);
  const bassLengths = useSongStore((state) => state.bassLengths);
  const extraTracks = useSongStore((state) => state.extraTracks);
  const noteLyrics = useSongStore((state) => state.noteLyrics);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<ScoreRenderer | null>(null);
  const zoomRef = useRef(0.9);
  const [selectedTrackId, setSelectedTrackId] = useState('all');
  const [zoom, setZoom] = useState(0.9);
  const [isLoading, setIsLoading] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [renderError, setRenderError] = useState('');

  const trackOptions = useMemo(() => {
    return parts.map((part): ScoreTrackOption => {
      const displayName = part.instrument === 'supportingPiano'
        ? '서포팅 캐스트 피아노'
        : part.name;
      const usesImplicitExtraTrack = [
        'glockenspiel',
        'piccolo',
        'supportingPiano',
        'chicagoStreet',
        'studioAltoSax',
      ].includes(part.instrument);
      const extraTrack = part.trackId
        ? extraTracks.find((track) => track.id === part.trackId)
        : usesImplicitExtraTrack
          ? extraTracks.find((track) => track.instrument === part.instrument)
          : undefined;
      const extraScoreTrack = extraTrack ? extraTrackToScoreTrack(extraTrack, noteLyrics) : null;
      if (extraScoreTrack) {
        return {
          id: part.id,
          name: displayName,
          track: { ...extraScoreTrack, id: part.id, name: displayName },
        };
      }

      let track: MusicXmlTrack | null = null;
      switch (part.instrument) {
        case 'melody':
          track = { id: part.id, name: displayName, grid: melody, lengths: melodyLengths, pitches: MELODY_NOTES };
          break;
        case 'violin':
          track = { id: part.id, name: displayName, grid: violin, lengths: violinLengths, pitches: VIOLIN_NOTES };
          break;
        case 'saxophone':
          track = { id: part.id, name: displayName, grid: saxophone, lengths: saxophoneLengths, pitches: SAXOPHONE_NOTES };
          break;
        case 'guitar':
          track = { id: part.id, name: displayName, grid: guitar, lengths: guitarLengths, pitches: GUITAR_TRACK_LABELS };
          break;
        case 'bass':
          track = { id: part.id, name: displayName, grid: bass, lengths: bassLengths, pitches: BASS_NOTES };
          break;
        default:
          break;
      }

      return { id: part.id, name: displayName, track };
    });
  }, [
    bass,
    bassLengths,
    extraTracks,
    guitar,
    guitarLengths,
    melody,
    melodyLengths,
    noteLyrics,
    parts,
    saxophone,
    saxophoneLengths,
    violin,
    violinLengths,
  ]);

  const availableTracks = useMemo(
    () => trackOptions.flatMap((option) => option.track && hasTrackNotes(option.track) ? [option.track] : []),
    [trackOptions]
  );

  const selectedTracks = useMemo(
    () => selectedTrackId === 'all'
      ? availableTracks
      : availableTracks.filter((track) => track.id === selectedTrackId),
    [availableTracks, selectedTrackId]
  );
  const musicXml = useMemo(
    () => buildMusicXml({
      title,
      bpm,
      tracks: selectedTracks,
      showInstrumentLabels: selectedTrackId === 'all',
    }),
    [bpm, selectedTrackId, selectedTracks, title]
  );

  useEffect(() => {
    if (selectedTrackId !== 'all' && !trackOptions.some((option) => option.id === selectedTrackId)) {
      setSelectedTrackId('all');
    }
  }, [selectedTrackId, trackOptions]);

  useEffect(() => {
    if (!open) return undefined;
    const previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousBodyOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose, open]);

  useEffect(() => {
    if (!open || !containerRef.current || !selectedTracks.length) return undefined;
    let cancelled = false;
    const container = containerRef.current;
    setIsLoading(true);
    setRenderError('');

    const renderScore = async () => {
      try {
        const { OpenSheetMusicDisplay } = await loadScoreRendererModule();
        if (cancelled) return;
        container.replaceChildren();
        const renderer = new OpenSheetMusicDisplay(container, {
          autoResize: true,
          backend: 'svg',
          drawingParameters: 'compacttight',
          drawPartNames: false,
          drawPartAbbreviations: false,
        });
        await renderer.load(musicXml);
        if (cancelled) return;
        renderer.Zoom = zoomRef.current;
        renderer.render();
        styleInstrumentLabels(container, selectedTracks.map((track) => track.name));
        rendererRef.current = renderer;
      } catch (error) {
        console.error('Score rendering failed:', error);
        if (!cancelled) setRenderError('악보를 표시하지 못했습니다.');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    void renderScore();

    return () => {
      cancelled = true;
      rendererRef.current?.clear();
      rendererRef.current = null;
      container.replaceChildren();
    };
  }, [musicXml, open, selectedTracks]);

  useEffect(() => {
    zoomRef.current = zoom;
    const renderer = rendererRef.current;
    if (!renderer) return;
    renderer.Zoom = zoom;
    renderer.render();
    if (containerRef.current) {
      styleInstrumentLabels(containerRef.current, selectedTracks.map((track) => track.name));
    }
  }, [selectedTracks, zoom]);

  if (!open) return null;

  const downloadMusicXml = () => {
    const blob = new Blob([musicXml], { type: 'application/vnd.recordare.musicxml+xml' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${sanitizeFileName(title)}.musicxml`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const exportPdf = async () => {
    if (!selectedTracks.length || isExportingPdf) return;

    setIsExportingPdf(true);
    let exportContainer: HTMLDivElement | null = null;
    let exportRenderer: ScoreRenderer | null = null;
    try {
      const [{ jsPDF }, { OpenSheetMusicDisplay }] = await Promise.all([
        import('jspdf'),
        import('opensheetmusicdisplay'),
        import('svg2pdf.js'),
      ]);
      exportContainer = document.createElement('div');
      exportContainer.style.cssText = [
        'position:fixed',
        'left:-10000px',
        'top:0',
        'width:794px',
        'background:#fff',
        'pointer-events:none',
      ].join(';');
      document.body.appendChild(exportContainer);

      exportRenderer = new OpenSheetMusicDisplay(exportContainer, {
        autoResize: false,
        backend: 'svg',
        drawingParameters: 'default',
        drawPartNames: false,
        drawPartAbbreviations: false,
        pageFormat: 'A4_P',
        newSystemFromXML: true,
        pageBackgroundColor: '#FFFFFF',
      });
      await exportRenderer.load(addPdfSystemBreaks(musicXml));
      exportRenderer.Zoom = 1;
      exportRenderer.render();
      styleInstrumentLabels(exportContainer, selectedTracks.map((track) => track.name));

      const scoreSvgs = [...exportContainer.querySelectorAll('svg')];
      if (!scoreSvgs.length) throw new Error('PDF로 변환할 악보가 없습니다.');

      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const koreanFont = await loadPdfKoreanFont();
      pdf.addFileToVFS(PDF_KOREAN_FONT_FILE, koreanFont);
      pdf.addFont(PDF_KOREAN_FONT_FILE, PDF_KOREAN_FONT_NAME, 'normal');
      pdf.addFont(PDF_KOREAN_FONT_FILE, PDF_KOREAN_FONT_NAME, 'bold');
      const pageWidth = 210;
      const pageHeight = 297;
      const margin = 10;
      const contentWidth = pageWidth - margin * 2;
      const contentHeight = pageHeight - margin * 2;
      let hasPageContent = false;

      for (const sourceSvg of scoreSvgs) {
        const viewBox = sourceSvg.viewBox.baseVal;
        const sourceWidth = viewBox.width || sourceSvg.clientWidth;
        const sourceHeight = viewBox.height || sourceSvg.clientHeight;
        if (!sourceWidth || !sourceHeight) continue;

        const sourcePageHeight = sourceWidth * (contentHeight / contentWidth);
        for (let sourceY = 0; sourceY < sourceHeight; sourceY += sourcePageHeight) {
          if (hasPageContent) pdf.addPage('a4', 'portrait');
          const visibleHeight = Math.min(sourcePageHeight, sourceHeight - sourceY);
          const drawHeight = visibleHeight * (contentWidth / sourceWidth);
          const pageSvg = sourceSvg.cloneNode(true) as SVGSVGElement;
          pageSvg.setAttribute(
            'viewBox',
            `${viewBox.x} ${viewBox.y + sourceY} ${sourceWidth} ${visibleHeight}`
          );
          pageSvg.setAttribute('width', String(sourceWidth));
          pageSvg.setAttribute('height', String(visibleHeight));
          applyKoreanFontToSvg(pageSvg);
          await pdf.svg(pageSvg, {
            x: margin,
            y: margin,
            width: contentWidth,
            height: drawHeight,
          });
          hasPageContent = true;
        }
      }

      if (!hasPageContent) throw new Error('PDF로 변환할 악보가 없습니다.');
      pdf.save(`${sanitizeFileName(title)}.pdf`);
    } catch (error) {
      console.error('PDF export failed:', error);
      alert('PDF 파일을 만들지 못했습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      exportRenderer?.clear();
      exportContainer?.remove();
      setIsExportingPdf(false);
    }
  };

  return createPortal(
    <div className="score-viewer-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="score-viewer"
        role="dialog"
        aria-modal="true"
        aria-label="읽기 전용 악보"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="score-viewer-header">
          <div className="score-viewer-title">
            <span>READ ONLY</span>
            <strong>{title.trim() || '제목 없는 곡'}</strong>
            <p>현재 피아노롤을 기준으로 생성된 악보입니다.</p>
          </div>
          <button type="button" className="score-viewer-icon-button" onClick={onClose} aria-label="악보 닫기">
            <ScoreIcon name="close" />
          </button>
        </header>

        <div className="score-viewer-toolbar">
          <label className="score-viewer-track-select">
            <span>파트</span>
            <select value={selectedTrackId} onChange={(event) => setSelectedTrackId(event.target.value)}>
              <option value="all">전체 악기</option>
              {trackOptions.map((option) => (
                <option key={option.id} value={option.id} disabled={!option.track}>
                  {option.name}
                </option>
              ))}
            </select>
          </label>
          <div className="score-viewer-zoom" aria-label="악보 확대 축소">
            <button type="button" onClick={() => setZoom((value) => Math.max(0.5, value - 0.1))} aria-label="축소"><ScoreIcon name="minus" /></button>
            <span>{Math.round(zoom * 100)}%</span>
            <button type="button" onClick={() => setZoom((value) => Math.min(1.5, value + 0.1))} aria-label="확대"><ScoreIcon name="plus" /></button>
          </div>
          <div className="score-viewer-actions">
            <button type="button" onClick={downloadMusicXml} disabled={!selectedTracks.length}>
              <ScoreIcon name="download" /> MusicXML
            </button>
            <button
              type="button"
              className="is-primary"
              onClick={() => void exportPdf()}
              disabled={!selectedTracks.length || isExportingPdf}
              aria-label="악보를 PDF로 저장"
              title="PDF로 저장"
            >
              {isExportingPdf ? 'PDF 저장 중...' : 'PDF'}
            </button>
          </div>
        </div>

        <div className="score-viewer-paper-shell">
          {!selectedTracks.length ? (
            <div className="score-viewer-empty"><strong>선택한 파트에 표시할 노트가 없습니다.</strong><span>피아노롤에 노트를 입력한 뒤 다시 열어주세요.</span></div>
          ) : null}
          {isLoading ? <div className="score-viewer-loading">악보를 만드는 중...</div> : null}
          {renderError ? <div className="score-viewer-empty"><strong>{renderError}</strong></div> : null}
          <div ref={containerRef} className="score-viewer-canvas" />
        </div>
      </section>
    </div>,
    document.body
  );
}
