import { useEffect, useRef } from 'react'
import {
  FilesetResolver,
  HandLandmarker,
} from '@mediapipe/tasks-vision'

// 기존 프로젝트 기타 사운드 import
import { acousticGuitarSynth } from '../audio/instruments'

export default function HandTracker() {
  const videoRef =
    useRef<HTMLVideoElement | null>(null)

  const canvasRef =
    useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    let handLandmarker: HandLandmarker
    let animationId: number

    // =========================
    // 기타 줄 설정
    // =========================

    const stringsTop = 160

    const stringGap = 30

    const stringsPaddingX = 140

    const stringCount = 6

    const strings = Array.from(
      { length: stringCount },
      (_, i) =>
        stringsTop + i * stringGap
    )

    // =========================
    // 코드 설정
    // =========================

    let currentChord = 'C'

    const CHORDS: Record<
      string,
      string[]
    > = {
      C: [
        'E4',
        'C4',
        'G3',
        'E3',
        'C3',
        'C2',
      ],

      G: [
        'G4',
        'D4',
        'B3',
        'G3',
        'D3',
        'G2',
      ],

      Am: [
        'E4',
        'C4',
        'A3',
        'E3',
        'A2',
        'A2',
      ],

      F: [
        'F4',
        'C4',
        'A3',
        'F3',
        'C3',
        'F2',
      ],
    }

    // =========================
    // 코드 박스 설정
    // =========================

    const chordStartX = 40

    const chordStartY = 40

    const chordWidth = 110

    const chordHeight = 70

    const chordGap = 20

    const chordNames = [
      'C',
      'G',
      'Am',
      'F',
    ]

    const chordZones =
      chordNames.map(
        (name, index) => ({
          name,

          x:
            chordStartX +
            index *
              (chordWidth +
                chordGap),

          y: chordStartY,

          width: chordWidth,

          height: chordHeight,
        })
      )

    // =========================
    // 손별 이전 위치
    // =========================

    let leftPreviousY = 0

    let rightPreviousY = 0

    // 중복 입력 방지
    let lastPlayed = 0

    // =========================
    // 초기화
    // =========================

    async function setupHandTracking() {
      const vision =
        await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
        )

      handLandmarker =
        await HandLandmarker.createFromOptions(
          vision,
          {
            baseOptions: {
              modelAssetPath:
                'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
            },

            runningMode: 'VIDEO',

            numHands: 2,
          }
        )

      const stream =
        await navigator.mediaDevices.getUserMedia({
          video: true,
        })

      if (!videoRef.current) return

      videoRef.current.srcObject = stream

      videoRef.current.onloadedmetadata =
        () => {
          videoRef.current?.play()

          predict()
        }
    }

    // =========================
    // 메인 루프
    // =========================

    async function predict() {
      const video = videoRef.current

      const canvas = canvasRef.current

      if (!video || !canvas) return

      const ctx = canvas.getContext('2d')

      if (!ctx) return

      // =========================
      // 캔버스 크기
      // =========================

      canvas.width = video.videoWidth

      canvas.height =
        video.videoHeight

      // =========================
      // 화면 초기화
      // =========================

      ctx.clearRect(
        0,
        0,
        canvas.width,
        canvas.height
      )

      // =========================
      // 좌우 반전 카메라
      // =========================

      ctx.save()

      ctx.scale(-1, 1)

      ctx.drawImage(
        video,
        -canvas.width,
        0,
        canvas.width,
        canvas.height
      )

      ctx.restore()

      // =========================
      // 기타 줄 그리기
      // =========================

      strings.forEach(stringY => {
        ctx.beginPath()

        ctx.moveTo(
          stringsPaddingX,
          stringY
        )

        ctx.lineTo(
          canvas.width -
            stringsPaddingX,
          stringY
        )

        ctx.strokeStyle = 'white'

        ctx.lineWidth = 3

        ctx.stroke()
      })

      // =========================
      // 코드 박스 그리기
      // =========================

      chordZones.forEach(zone => {
        ctx.fillStyle =
          currentChord === zone.name
            ? 'rgba(255,255,0,0.7)'
            : 'rgba(0,0,0,0.5)'

        ctx.fillRect(
          zone.x,
          zone.y,
          zone.width,
          zone.height
        )

        ctx.strokeStyle = 'white'

        ctx.lineWidth = 2

        ctx.strokeRect(
          zone.x,
          zone.y,
          zone.width,
          zone.height
        )

        ctx.fillStyle = 'white'

        ctx.font = '32px Arial'

        ctx.fillText(
          zone.name,
          zone.x + 25,
          zone.y + 45
        )
      })

      // =========================
      // 손 추적
      // =========================

      const results =
        handLandmarker.detectForVideo(
          video,
          performance.now()
        )

      if (results.landmarks) {
        results.landmarks.forEach(
          (landmarks, handIndex) => {
            const handedness =
              results.handednesses?.[
                handIndex
              ]?.[0]?.categoryName

            const isLeftHand =
              handedness === 'Left'

            const isRightHand =
              handedness === 'Right'

            // =========================
            // 검지 끝
            // =========================

            const indexFinger =
              landmarks[8]

            const fingerX =
              canvas.width -
              indexFinger.x *
                canvas.width

            // 수정된 부분
            const fingerY =
              indexFinger.y *
              video.videoHeight

            // =========================
            // 검지 표시
            // =========================

            ctx.beginPath()

            ctx.arc(
              fingerX,
              fingerY,
              12,
              0,
              2 * Math.PI
            )

            ctx.fillStyle = isLeftHand
              ? 'cyan'
              : 'lime'

            ctx.fill()

            // =========================
            // 왼손 → 코드 선택
            // =========================

            if (isLeftHand) {
              chordZones.forEach(zone => {
                const insideZone =
                  fingerX > zone.x &&
                  fingerX <
                    zone.x +
                      zone.width &&
                  fingerY > zone.y &&
                  fingerY <
                    zone.y +
                      zone.height

                if (insideZone) {
                  currentChord =
                    zone.name
                }
              })
            }

            // =========================
            // 손별 previousY
            // =========================

            const previousY =
              isRightHand
                ? rightPreviousY
                : leftPreviousY

            // =========================
            // 오른손 스트럼
            // =========================

          strings.forEach(
            (
              stringY,
              stringIndex
            ) => {
              const minY = Math.min(
                previousY,
                fingerY
              )

              const maxY = Math.max(
                previousY,
                fingerY
              )

              // 선 충돌 방식
              const crossed =
                stringY >= minY &&
                stringY <= maxY

              const insideStrings =
                fingerX >
                  stringsPaddingX &&
                fingerX <
                  canvas.width -
                    stringsPaddingX

              if (
                isRightHand &&
                insideStrings &&
                crossed &&
                Date.now() -
                  lastPlayed >
                  35
              ) {
                lastPlayed =
                  Date.now()

                // 줄별 음 선택
                const notes =
                  CHORDS[currentChord]

                const note =
                  notes[stringIndex]

                acousticGuitarSynth.triggerAttackRelease(
                  note,
                  '8n'
                )

                // 줄 반응 효과
                ctx.beginPath()

                ctx.moveTo(
                  stringsPaddingX,
                  stringY
                )

                ctx.lineTo(
                  canvas.width -
                    stringsPaddingX,
                  stringY
                )

                ctx.strokeStyle =
                  'yellow'

                ctx.lineWidth = 6

                ctx.stroke()
              }
            }
          )

            // =========================
            // 이전 위치 저장
            // =========================

            if (isRightHand) {
              rightPreviousY =
                fingerY
            }

            if (isLeftHand) {
              leftPreviousY =
                fingerY
            }

            // =========================
            // 손 랜드마크 표시
            // =========================

            landmarks.forEach(
              landmark => {
                const x =
                  canvas.width -
                  landmark.x *
                    canvas.width

                // 수정된 부분
                const y =
                  landmark.y *
                  video.videoHeight

                ctx.beginPath()

                ctx.arc(
                  x,
                  y,
                  5,
                  0,
                  2 * Math.PI
                )

                ctx.fillStyle =
                  'red'

                ctx.fill()
              }
            )
          }
        )
      }

      // =========================
      // 현재 코드 표시
      // =========================

      ctx.fillStyle = 'white'

      ctx.font = '48px Arial'

      ctx.fillText(
        `Chord: ${currentChord}`,
        40,
        canvas.height - 40
      )

      // 다음 프레임
      animationId =
        requestAnimationFrame(predict)
    }

    setupHandTracking()

    return () => {
      cancelAnimationFrame(animationId)
    }
  }, [])

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
      }}
    >
      <video
        ref={videoRef}
        style={{
          display: 'none',
        }}
      />

      <canvas
        ref={canvasRef}
        style={{
          width: '100%',
          maxWidth: '1200px',
          height: '700px',
          border:
            '2px solid white',
        }}
      />
    </div>
  )
}