import { useEffect, useState } from 'react';
import SiteHeader from '../components/layout/SiteHeader';
import { LESSON_QUIZZES } from '../dummy/learnQuizData';
import {
  LESSON_LIBRARY,
  LESSON_SECTIONS,
  NOTE_ROWS,
  SECTION_META,
  type LessonId,
} from '../dummy/learnData';
import { useAuthStore } from '../store/authStore';
import { useLearnProgressStore } from '../store/learnProgressStore';
import './LearnPage.css';

function countActiveCells(grid: boolean[][]) {
  return grid.reduce((count, row) => count + row.filter((cell) => cell).length, 0);
}

export default function LearnPage() {
  const user = useAuthStore((state) => state.user);
  const completedByUser = useLearnProgressStore((state) => state.completedByUser);
  const favoriteByUser = useLearnProgressStore((state) => state.favoriteByUser);
  const quizAnswersByUser = useLearnProgressStore((state) => state.quizAnswersByUser);
  const seedLearnProgress = useLearnProgressStore((state) => state.seedLearnProgress);
  const toggleCompleted = useLearnProgressStore((state) => state.toggleCompleted);
  const toggleFavorite = useLearnProgressStore((state) => state.toggleFavorite);
  const answerQuiz = useLearnProgressStore((state) => state.answerQuiz);
  const [selectedLessonId, setSelectedLessonId] = useState<LessonId>('money-code');
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  const progressKey = user?.email ?? 'guest';
  const completedLessons = completedByUser[progressKey] ?? [];
  const favoriteLessons = favoriteByUser[progressKey] ?? [];
  const quizAnswers = quizAnswersByUser[progressKey] ?? {};
  const lessonOrder = LESSON_SECTIONS.flatMap((section) => section.lessons);
  const selectedLesson = LESSON_LIBRARY[selectedLessonId];
  const selectedSectionMeta = SECTION_META[selectedLesson.section];
  const totalSteps = selectedLesson.grid[0]?.length ?? 0;
  const activeCellCount = countActiveCells(selectedLesson.grid);
  const quiz = LESSON_QUIZZES[selectedLessonId];
  const quizAnswer = quizAnswers[selectedLessonId];
  const nextLessonId =
    lessonOrder.find((lessonId) => !completedLessons.includes(lessonId)) ?? selectedLessonId;
  const nextLesson = LESSON_LIBRARY[nextLessonId];

  useEffect(() => {
    void seedLearnProgress(progressKey).catch((error) => {
      console.error(error);
    });
  }, [progressKey, seedLearnProgress]);

  useEffect(() => {
    if (!isPlaying || totalSteps === 0) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setCurrentStep((step) => (step + 1) % totalSteps);
    }, 520);

    return () => window.clearInterval(intervalId);
  }, [isPlaying, totalSteps]);

  return (
    <div className={`learn-page learn-page--${selectedSectionMeta.tone}`}>
      <SiteHeader activeSection="composer" />

      <main className="learn-shell">
        <aside className="learn-sidebar">
          <div className="learn-sidebar-intro">
            <span className="learn-sidebar-eyebrow">COURSE MAP</span>
            <strong>학습 로드맵</strong>
            <p>기초부터 코드, 멜로디, 완성까지 한 흐름으로 이어서 볼 수 있어요.</p>
          </div>

          {LESSON_SECTIONS.map((section) => (
            <section key={section.title} className="learn-sidebar-section">
              <div className="learn-sidebar-heading">
                <strong>{section.title}</strong>
                <span aria-hidden="true">{section.lessons.length}</span>
              </div>

              <div className="learn-sidebar-list">
                {section.lessons.map((lessonId) => {
                  const lesson = LESSON_LIBRARY[lessonId];
                  const isCompleted = completedLessons.includes(lesson.id);
                  const isFavorite = favoriteLessons.includes(lesson.id);

                  return (
                    <button
                      key={lesson.id}
                      type="button"
                      className={`learn-sidebar-button${
                        selectedLessonId === lesson.id ? ' is-active' : ''
                      }${isCompleted ? ' is-complete' : ''}`}
                      onClick={() => {
                        setSelectedLessonId(lesson.id);
                        setIsPlaying(false);
                        setCurrentStep(0);
                      }}
                    >
                      <span className="learn-sidebar-button-label">{lesson.label}</span>
                      <span className="learn-sidebar-button-arrow" aria-hidden="true">
                        {isFavorite ? '★' : isCompleted ? '✓' : '/'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          ))}

          <div className="learn-sidebar-foot">
            <span>지금 보고 있는 레슨</span>
            <strong>{selectedLesson.label}</strong>
          </div>
        </aside>

        <section className="learn-content">
          <div className="learn-hero-card">
            <div className="learn-hero-copy">
              <div className="learn-hero-badges">
                <span className="learn-section-chip">{selectedLesson.section}</span>
                <span className="learn-lesson-chip">{selectedSectionMeta.eyebrow}</span>
              </div>
              <h1 className="learn-title">{selectedLesson.title}</h1>
              <p className="learn-summary">{selectedLesson.summary}</p>

              <div className="learn-action-row">
                <button
                  type="button"
                  className={`learn-action-button${
                    completedLessons.includes(selectedLesson.id) ? ' is-active' : ''
                  }`}
                  onClick={() => {
                    void toggleCompleted(progressKey, selectedLesson.id).catch((error) => {
                      console.error(error);
                    });
                  }}
                >
                  {completedLessons.includes(selectedLesson.id) ? '완료됨' : '완료 체크'}
                </button>
                <button
                  type="button"
                  className={`learn-action-button${
                    favoriteLessons.includes(selectedLesson.id) ? ' is-active' : ''
                  }`}
                  onClick={() => {
                    void toggleFavorite(progressKey, selectedLesson.id).catch((error) => {
                      console.error(error);
                    });
                  }}
                >
                  {favoriteLessons.includes(selectedLesson.id) ? '즐겨찾기됨' : '즐겨찾기'}
                </button>
              </div>
            </div>

            <div className="learn-hero-stats">
              <article className="learn-stat-card">
                <span>완료 레슨</span>
                <strong>{completedLessons.length}개</strong>
                <small>끝까지 본 학습 흐름</small>
              </article>
              <article className="learn-stat-card">
                <span>즐겨찾기</span>
                <strong>{favoriteLessons.length}개</strong>
                <small>자주 다시 보는 레슨</small>
              </article>
              <article className="learn-stat-card">
                <span>퀴즈 진행</span>
                <strong>{Object.keys(quizAnswers).length}개</strong>
                <small>체크한 이해도</small>
              </article>
            </div>
          </div>

          <div className="learn-progress-strip">
            <article className="learn-progress-card">
              <span>추천 다음 레슨</span>
              <strong>{nextLesson.label}</strong>
              <button type="button" onClick={() => setSelectedLessonId(nextLesson.id)}>
                바로 보기
              </button>
            </article>
            <article className="learn-progress-card">
              <span>현재 레슨 템포</span>
              <strong>{selectedLesson.tempo} BPM</strong>
              <small>지금 미리보기 기준</small>
            </article>
            <article className="learn-progress-card">
              <span>활성 패턴 수</span>
              <strong>{activeCellCount}개</strong>
              <small>그리드에서 확인되는 포인트</small>
            </article>
          </div>

          <div className="learn-body-grid">
            <section className="learn-panel learn-panel--examples">
              <div className="learn-panel-head">
                <span className="learn-panel-kicker">Verified Patterns</span>
                <h2>대표 진행 예시</h2>
              </div>

              <div className="learn-example-card-grid">
                {selectedLesson.examples.map((example, index) => (
                  <article
                    key={`${selectedLesson.id}-${example.progression}`}
                    className="learn-example-card"
                  >
                    <span className="learn-example-index">0{index + 1}</span>
                    <strong className="learn-example-progression">
                      {example.progression}
                    </strong>
                    <span className="learn-example-reference">{example.reference}</span>
                  </article>
                ))}
              </div>
            </section>

            <aside className="learn-panel learn-panel--focus">
              <span className="learn-panel-kicker">Today's Focus</span>
              <h2 className="learn-focus-title">{selectedLesson.focusTitle}</h2>
              <p className="learn-focus-body">{selectedLesson.focusBody}</p>

              <div className="learn-pointer-list">
                {selectedSectionMeta.pointers.map((pointer) => (
                  <div key={pointer} className="learn-pointer-item">
                    <span className="learn-pointer-dot" aria-hidden="true" />
                    <span>{pointer}</span>
                  </div>
                ))}
              </div>

              <div className="learn-focus-note">
                <span className="learn-focus-note-label">LESSON NOTE</span>
                <p>{selectedSectionMeta.description}</p>
              </div>
            </aside>
          </div>

          <div className="learn-bottom-grid">
            <section className="learn-demo-panel">
              <div className="learn-demo-head">
                <div className="learn-demo-copy">
                  <span className="learn-panel-kicker">Pattern Preview</span>
                  <h2>코드 흐름 미리보기</h2>
                  <p>
                    아래 그리드는 현재 레슨의 패턴 감각을 단순화해서 보여줍니다. 초록
                    패턴의 위치와 이동 방향만 봐도 강의 인상을 빠르게 읽을 수 있어요.
                  </p>
                </div>

                <div className="learn-demo-controls">
                  <span className="learn-bpm-chip">{selectedLesson.tempo} BPM</span>
                  <span className="learn-bpm-chip is-muted">{totalSteps} Steps</span>
                  <button
                    type="button"
                    className={`learn-play-button${isPlaying ? ' is-playing' : ''}`}
                    onClick={() => setIsPlaying((playing) => !playing)}
                    aria-label={isPlaying ? '정지' : '재생'}
                  >
                    {isPlaying ? 'II' : '>'}
                  </button>
                </div>
              </div>

              <div className="learn-grid-frame">
                <div className="learn-grid-legend">
                  <span>현재 레슨: {selectedLesson.label}</span>
                  <span>섹션: {selectedLesson.section}</span>
                  <span>활성 수: {activeCellCount}</span>
                </div>

                <div className="learn-grid">
                  {NOTE_ROWS.map((note, rowIndex) => (
                    <div key={`${selectedLesson.id}-${note}`} className="learn-grid-row">
                      <span className="learn-grid-label">{note}</span>

                      {selectedLesson.grid[rowIndex].map((active, stepIndex) => (
                        <span
                          key={`${selectedLesson.id}-${note}-${stepIndex}`}
                          className={`learn-grid-cell${active ? ' is-active' : ''}${
                            isPlaying && currentStep === stepIndex ? ' is-current' : ''
                          }`}
                        />
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <aside className="learn-quiz-card">
              <div className="learn-panel-head">
                <span className="learn-panel-kicker">Quick Quiz</span>
                <h2>이해도 체크</h2>
              </div>

              <strong className="learn-quiz-question">{quiz.question}</strong>

              <div className="learn-quiz-options">
                {quiz.options.map((option, index) => {
                  const isSelected = quizAnswer?.selectedIndex === index;
                  const isCorrect = quiz.correctIndex === index;

                  return (
                    <button
                      key={`${selectedLesson.id}-quiz-${option}`}
                      type="button"
                      className={`learn-quiz-option${
                        isSelected ? ' is-selected' : ''
                      }${quizAnswer && isCorrect ? ' is-correct' : ''}`}
                      onClick={() => {
                        void answerQuiz(
                          progressKey,
                          selectedLesson.id,
                          index,
                          index === quiz.correctIndex
                        ).catch((error) => {
                          console.error(error);
                        });
                      }}
                    >
                      {option}
                    </button>
                  );
                })}
              </div>

              <div className={`learn-quiz-feedback${quizAnswer ? ' is-visible' : ''}`}>
                {quizAnswer ? (
                  <>
                    <strong>{quizAnswer.isCorrect ? '정답입니다.' : '한 번 더 볼까요?'}</strong>
                    <p>{quiz.explanation}</p>
                  </>
                ) : (
                  <>
                    <strong>아직 답을 고르지 않았어요.</strong>
                    <p>레슨 핵심을 한 번 더 읽고 가장 맞는 보기를 골라 보세요.</p>
                  </>
                )}
              </div>
            </aside>
          </div>
        </section>
      </main>
    </div>
  );
}
