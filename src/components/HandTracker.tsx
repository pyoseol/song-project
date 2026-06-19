import { useEffect, useRef } from 'react'
import {
  FilesetResolver,
  HandLandmarker,
} from '@mediapipe/tasks-vision'

// 기존 프로젝트 기타 사운드 import
import { 
  acousticGuitarSynth,
  strokePlayer,
  pianoSynth,
 } from '../audio/instruments'

 import {
  playDrumPreview,
} from '../audio/engine'



export default function HandTracker() {
  const videoRef =
    useRef<HTMLVideoElement | null>(null)

  const canvasRef =
    useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    let handLandmarker: HandLandmarker
    let animationId: number
    let strumMode = true

    type InstrumentMode =
  | 'guitar'
  | 'drum'
  | 'piano'

    let instrumentMode: InstrumentMode =
      'guitar'

    const instrumentLabels: Record<InstrumentMode, string> = {
      guitar: '기타',
      drum: '드럼',
      piano: '피아노',
    }

    // =========================
    // 기타 줄 설정
    // =========================

    const stringsTop = 160

    const stringGap = 30

    const stringsPaddingX = 100
    const stringsStartX = 330;
    const stringsEndX = 50



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

    const CHORDS: Record<string, string[]> = {
  A: ['E4', 'C#4', 'A3', 'E3', 'A2', 'A2'],

  B: ['F#4', 'D#4', 'B3', 'F#3', 'B2', 'B2'],

  C: ['E4', 'C4', 'G3', 'E3', 'C3', 'C2'],

  D: ['F#4', 'D4', 'A3', 'D3', 'A2', 'D2'],

  E: ['G#4', 'E4', 'B3', 'E3', 'B2', 'E2'],

  F: ['F4', 'C4', 'A3', 'F3', 'C3', 'F2'],

  G: ['G4', 'D4', 'B3', 'G3', 'D3', 'G2'],
}

const drumPads = [
  {
    name: 'Kick',
    row: 0,
    x: 450,
    y: 420,
    radius: 60,
  },

  {
    name: 'Snare',
    row: 1,
    x: 450,
    y: 280,
    radius: 60,
  },

  {
    name: 'HiHat',
    row: 2,
    x: 300,
    y: 220,
    radius: 55,
  },

  {
    name: 'Clap',
    row: 3,
    x: 600,
    y: 220,
    radius: 55,
  },

  {
    name: 'Perc',
    row: 4,
    x: 450,
    y: 120,
    radius: 55,
  },
]
const whiteNotes = [
  'C4',
  'D4',
  'E4',
  'F4',
  'G4',
  'A4',
  'B4',
  'C5'
]

const whiteKeyWidth = 50
const whiteKeyHeight = 220

const pianoStartX = 0

const pianoY = 380

const pianoKeys = whiteNotes.map(
  (note, index) => ({
    note,
    x:
      pianoStartX +
      index * (whiteKeyWidth + 20),
    y: pianoY,
    width: whiteKeyWidth,
    height: whiteKeyHeight,
  })
)

const blackKeyWidth = 32
const blackKeyHeight = 120

const blackNotes = [
  { note: 'C#4', whiteIndex: 0 },
  { note: 'D#4', whiteIndex: 1 },
  { note: 'F#4', whiteIndex: 3 },
  { note: 'G#4', whiteIndex: 4 },
  { note: 'A#4', whiteIndex: 5 },
]
  
const blackKeys = blackNotes.map(
  ({ note, whiteIndex }) => ({
    note,

    x:
      pianoStartX +
      (whiteIndex + 1) *
        (whiteKeyWidth + 20) -
      blackKeyWidth / 2 - 3,

    y: pianoY,

    width: blackKeyWidth,

    height: blackKeyHeight,
  })
)

    // =========================
    // 코드 박스 설정
    // =========================

    const chordStartX = 10

    const chordStartY = 300

    const chordWidth = 60

    const chordHeight = 40

    const chordGap = 0

   const chordNames = [
    'A',
    'B',
    'C',
    'D',
    'E',
    'F',
    'G',
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
    let lastStrumTime = 0
    let previousStrumY = 0
    let previousPianoY = 0

    let padStates: Record<string, boolean> = {}

    let pianoKeyStates: Record<string, boolean> = {}

    let lastStrumDirection:
      'up' | 'down' | null = null

    let hoverChord = ''
    let hoverStart = 0

    const strumZone = {
      x: 380,
      y: 120,
      width: 180,
      height: 260,
    }

    function playStroke(
  chord: string,
  direction: 'up' | 'down'
) {
  try {
    const key =
      `${chord}_${direction.toUpperCase()}`

    const player =
      strokePlayer.player(key)

    player.stop()

    player.start()
  } catch (err) {
    console.warn(
      '스트로크 없음:',
      chord
    )
  }
}

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

      if (
          instrumentMode === 'guitar' &&
          !strumMode
        ) {
        strings.forEach(stringY => {
          ctx.beginPath()

          ctx.moveTo(
            stringsStartX,
            stringY
          )

          ctx.lineTo(
            canvas.width - stringsEndX,
            stringY
          )

          ctx.strokeStyle = 'white'
          ctx.lineWidth = 3
          ctx.stroke()
        })
      }

      if (
  instrumentMode === 'drum'
) {
  drumPads.forEach(pad => {
    ctx.beginPath()

    ctx.arc(
      pad.x,
      pad.y,
      pad.radius,
      0,
      Math.PI * 2
    )

    ctx.fillStyle =
      'rgba(255,140,0,0.7)'

    ctx.fill()

    ctx.strokeStyle =
      'white'

    ctx.lineWidth = 3

    ctx.stroke()

    ctx.fillStyle =
      'white'

    ctx.font =
      '18px Arial'

    ctx.textAlign =
      'center'

    ctx.fillText(
      pad.name,
      pad.x,
      pad.y + 6
    )
  })
}


if (instrumentMode === 'piano') {
  pianoKeys.forEach(key => {
    ctx.fillStyle = 'white'

    ctx.fillRect(
      key.x,
      key.y,
      key.width,
      key.height
    )

    ctx.strokeStyle = 'black'

    ctx.strokeRect(
      key.x,
      key.y,
      key.width,
      key.height
    )

    ctx.fillStyle = 'black'

    ctx.fillText(
      key.note,
      key.x + 20,
      key.y + 30
    )
  })


  blackKeys.forEach(key => {
              ctx.fillStyle = 'black'

              ctx.fillRect(
                key.x,
                key.y,
                key.width,
                key.height
              )

              ctx.strokeStyle = 'white'

              ctx.strokeRect(
                key.x,
                key.y,
                key.width,
                key.height
              )
            })
  
}

      // ====
      // =====================
      // 코드 박스 그리기
      // =========================

      if (
        instrumentMode === 'guitar'
      ) {
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

        ctx.font = '18px Arial'

        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'

        ctx.fillText(
          zone.name,
          zone.x + zone.width / 2,
          zone.y + zone.height / 2
        )
      })

      if (instrumentMode === 'guitar' && strumMode) {
      ctx.fillStyle =
        'rgba(255,0,0,0.1)'

      if (strumMode) {
  ctx.fillStyle =
    'rgba(255,0,0,0.12)'

  ctx.fillRect(
      strumZone.x,
      strumZone.y,
      strumZone.width,
      strumZone.height
    )

    ctx.strokeStyle = 'red'
    ctx.lineWidth = 3

    ctx.strokeRect(
      strumZone.x,
      strumZone.y,
      strumZone.width,
      strumZone.height
    )

    ctx.fillStyle = 'white'
    ctx.font = '20px Arial'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    ctx.fillText(
      '스트럼',
      strumZone.x +
        strumZone.width / 2,
      strumZone.y + 30
    )
  }

      ctx.strokeStyle = 'red'
      ctx.lineWidth = 2


      ctx.fillStyle = 'white'
      ctx.font = '22px Arial'

    }

  }
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

          if (instrumentMode === 'drum') {
            drumPads.forEach(async pad => {
              const dx = fingerX - pad.x
              const dy = fingerY - pad.y

              const distance = Math.sqrt(
                dx * dx + dy * dy
              )

              const inside = distance < pad.radius

              const wasInside =
                padStates[pad.name] ?? false

              if (
                  inside &&
                  !wasInside
                ) {
                  console.log(
                    'DRUM HIT:',
                    pad.name
                  )

                  try {
                    await playDrumPreview(
                      pad.row
                    )
                  } catch (err) {
                    console.error(err)
                  }
                }


              padStates[pad.name] = inside
            })
          }

              if (
                  instrumentMode === 'piano' &&
                  isRightHand
                ) {
                  
                  const deltaY =
                    fingerY - previousPianoY

              pianoKeys.forEach(key => {
                const inside =
                  fingerX > key.x &&
                  fingerX < key.x + key.width &&
                  fingerY > key.y &&
                  fingerY < key.y + key.height

                const wasInside =
                  pianoKeyStates[key.note] ??
                  false

                if (
                  inside &&
                  !wasInside &&
                   deltaY > 8
                ) {
                  pianoSynth
                    .triggerAttackRelease(
                      key.note,
                      '8n'
                    )
                }

                pianoKeyStates[key.note] =
                  inside
              })


              blackKeys.forEach(key => {
              const inside =
                fingerX > key.x &&
                fingerX < key.x + key.width &&
                fingerY > key.y &&
                fingerY < key.y + key.height

              const wasInside =
                pianoKeyStates[key.note] ?? false

              if (inside && !wasInside) {
                pianoSynth.triggerAttackRelease(
                  key.note,
                  '8n'
                )
              }

              pianoKeyStates[key.note] = inside
            })
            previousPianoY = fingerY
                          
            }

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

            if (instrumentMode === 'guitar' && isLeftHand) {
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
                  if (
                    hoverChord !== zone.name
                  ) {
                    hoverChord = zone.name
                    hoverStart = Date.now()
                  }

                  if (
                    Date.now() -
                      hoverStart >
                    200
                  ) {
                    currentChord =
                      zone.name
                  }
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

                if (
                  instrumentMode === 'guitar' &&
                  isRightHand) {
                const deltaY =
                  fingerY - previousStrumY

                const insideStrumZone =
                fingerX >
                  strumZone.x &&
                fingerX <
                  strumZone.x +
                    strumZone.width &&
                fingerY >
                  strumZone.y &&
                fingerY <
                  strumZone.y +
                    strumZone.height

                if (
                  strumMode &&
                  insideStrumZone &&
                  Date.now() -
                    lastStrumTime >
                    150
                ) {
                  if (
                        deltaY > 40 &&
                        lastStrumDirection !==
                          'down'
                      ) {
                        playStroke(
                          currentChord,
                          'down'
                        )

                        lastStrumDirection =
                          'down'

                        lastStrumTime =
                          Date.now()
                      }

                  if (
                      deltaY < -40 &&
                      lastStrumDirection !== 'up'
                    ) {
                      playStroke(currentChord, 'up')

                      lastStrumDirection = 'up'
                      lastStrumTime = Date.now()
                    }
                }

                previousStrumY =
                  fingerY
              }

            // =========================
            // 오른손 스트럼
            // =========================
        if (instrumentMode === 'guitar') {
          if (!strumMode) {
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
                fingerX > stringsStartX &&
                fingerX <
                  canvas.width -
                    stringsEndX

              if (
                  !strumMode &&
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
        }
      }
            // =========================
            // 이전 위치 저장
            // =========================

            if (
              instrumentMode === 'guitar' &&
              isRightHand) {
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
        `에어 악기: ${instrumentLabels[instrumentMode]}`,
        20,
        40
      )

      if (instrumentMode === 'guitar') {
        ctx.fillText(
          `연주 방식: ${strumMode ? '스트럼' : '줄 연주'}`,
          20,
          80
        )

        ctx.fillText(
          `코드: ${currentChord}`,
          20,
          120
        )
      }

      if (instrumentMode === 'drum') {
        ctx.fillText(
          '드럼 모드',
          20,
          80
        )
      }

      if (instrumentMode === 'piano') {
        ctx.fillText(
          '피아노 모드',
          20,
          80
        )
      }      ctx.font = '24px Arial'

    if (instrumentMode === 'guitar')
    {
      ctx.fillText(
              'M 키로 스트럼/줄 연주 전환',
              40,
              canvas.height - 120
            )
    }
      

      // 다음 프레임
      animationId =
        requestAnimationFrame(predict)
    }

    setupHandTracking()

  const handleKeyDown = (
  e: KeyboardEvent

  
) => {
  if (
    (e.key === 'm' ||
    e.key === 'M') &&
  instrumentMode === 'guitar'
  ) {
    strumMode =
      !strumMode

    console.log(
      '연주 방식:',
      strumMode
        ? '스트럼'
        : '줄 연주'
    )

    
  }

 if (e.key === '1') {
  instrumentMode = 'guitar'
  console.log('기타')
}

if (e.key === '2') {
  instrumentMode = 'drum'
  console.log('드럼')
}

if (e.key === '3') {
  instrumentMode = 'piano'
  console.log('피아노')
}

}

window.addEventListener(
  'keydown',
  handleKeyDown
)

    return () => {
      cancelAnimationFrame(
        animationId
      )

      window.removeEventListener(
        'keydown',
        handleKeyDown
      )
    }
  }, [])

  return (
    <div className="air-hand-tracker">
      <video
        ref={videoRef}
        style={{
          display: 'none',
        }}
      />

      <canvas
        ref={canvasRef}
        className="air-hand-tracker-canvas"
      />
    </div>
  )
}
