"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { bandEntryLesson, categoryDifficultyForLesson } from "./category-progress";

export { bandEntryLesson };

/**
 * 투리니 금융 성장 로드맵
 *
 * 화면만 바꾸는 컴포넌트입니다. 레벨 계산·완료 판정·난이도 연결·문제 시작은
 * 전부 바깥(page.tsx, category-progress.ts)에서 그대로 내려받아 씁니다.
 * 이 파일은 받은 값을 어떻게 그릴지만 결정합니다.
 *
 * 생김새: 위에서 아래로 한 줄로 내려오는 **세로 타임라인**입니다.
 * 각 단계는 직사각형 카드이고, 왼쪽 레일의 표시가 완료·진행·잠금을 나타냅니다.
 * 동그란 번호가 좌우로 번갈아 나오는 징검다리 방식은 쓰지 않습니다.
 */

/** page.tsx의 finishSession이 정답 1개당 주는 XP. 화면 표시용으로만 씁니다. */
const XP_PER_CORRECT_ANSWER = 10;

type LessonState = "done" | "current" | "locked";
type LessonKind = "lesson" | "checkpoint" | "summit";

type RoadStep = {
  level: number;
  state: LessonState;
  kind: LessonKind;
  difficulty: string;
};

type RoadBand = {
  difficulty: string;
  from: number;
  to: number;
  steps: RoadStep[];
};

/** 난이도 구간을 그대로 여정의 장(章)으로 씁니다. */
const TERRAIN: Record<string, { key: string; name: string; note: string }> = {
  초급: { key: "seed", name: "씨앗 들판", note: "개념의 씨앗을 심어요" },
  중급: { key: "growth", name: "성장 언덕", note: "굴리는 방법을 익혀요" },
  고급: { key: "harvest", name: "결실 고원", note: "스스로 판단해요" },
};

export type LearningMapProps = {
  categoryName: string;
  /** CATEGORY_COLORS의 키 (green/purple/orange/red/teal/blue) */
  theme: string;
  categoryIcon: string;
  totalLessons: number;
  questionsPerLesson: number;
  /** 이 카테고리에서 푼 고유 문항 수 */
  solvedQuestions: number;
  /** 완료한 레슨 수 (바깥에서 계산해 내려줍니다) */
  completedLessons: number;
  /** 지금 학습할 레슨 번호. 모두 끝냈으면 null (바깥에서 계산해 내려줍니다) */
  currentLesson: number | null;
  /** 난이도 선택 화면에서 고른 난이도 — 그 구간으로 자동 이동하고 강조합니다 */
  focusDifficulty?: string | null;
  onStartLesson: (lesson: number) => void;
};

export default function LearningMap({
  categoryName,
  theme,
  categoryIcon,
  totalLessons,
  questionsPerLesson,
  solvedQuestions,
  completedLessons,
  currentLesson,
  focusDifficulty = null,
  onStartLesson,
}: LearningMapProps) {
  const currentStopRef = useRef<HTMLLIElement | null>(null);
  const stepRefs = useRef<Record<number, HTMLLIElement | null>>({});
  /** 탭을 직접 눌러 고른 구간. 아무것도 누르지 않았으면 null 입니다. */
  const [pickedBand, setPickedBand] = useState<string | null>(null);

  const currentLevel = currentLesson;

  const bands = useMemo<RoadBand[]>(() => {
    const groups: RoadBand[] = [];
    for (let index = 0; index < totalLessons; index += 1) {
      const level = index + 1;
      // page.tsx가 쓰던 판정식과 같습니다.
      const isDone = level <= completedLessons;
      const isCurrent = level === currentLevel;
      const state: LessonState = isDone ? "done" : isCurrent ? "current" : "locked";
      const kind: LessonKind =
        level === totalLessons ? "summit" : level % 4 === 0 ? "checkpoint" : "lesson";
      const difficulty = categoryDifficultyForLesson(level);
      const step: RoadStep = { level, state, kind, difficulty };
      const last = groups[groups.length - 1];
      if (last && last.difficulty === difficulty) {
        last.to = level;
        last.steps.push(step);
      } else {
        groups.push({ difficulty, from: level, to: level, steps: [step] });
      }
    }
    return groups;
  }, [totalLessons, completedLessons, currentLevel]);

  // 바깥에서 난이도가 새로 정해지면 직접 고른 탭은 없던 일로 합니다.
  // (렌더 중 상태 맞추기 — React 가 권하는 방식이라 화면이 두 번 그려지지 않습니다.)
  const [seenFocus, setSeenFocus] = useState<string | null>(focusDifficulty);
  if (focusDifficulty !== seenFocus) {
    setSeenFocus(focusDifficulty);
    setPickedBand(null);
  }

  const currentBand = currentLevel ? categoryDifficultyForLesson(currentLevel) : "고급";
  const activeBand = pickedBand ?? focusDifficulty ?? currentBand;
  const allDone = completedLessons >= totalLessons;
  const maxXp = questionsPerLesson * XP_PER_CORRECT_ANSWER;

  const scrollTo = (element: HTMLElement | null) => {
    if (!element) return;
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    element.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" });
  };

  const scrollToCurrent = () => scrollTo(currentStopRef.current);

  const jumpToBand = (difficulty: string) => {
    setPickedBand(difficulty);
    scrollTo(stepRefs.current[bandEntryLesson(difficulty, completedLessons, totalLessons)]);
  };

  // 난이도 선택 화면에서 넘어왔을 때, 그 구간이 화면 가운데에 오도록 옮겨 줍니다.
  useEffect(() => {
    if (!focusDifficulty) return;
    const level = bandEntryLesson(focusDifficulty, completedLessons, totalLessons);
    const timer = window.setTimeout(() => scrollTo(stepRefs.current[level]), 140);
    return () => window.clearTimeout(timer);
  }, [focusDifficulty, categoryName, completedLessons, totalLessons]);

  const unlockHint = (level: number) => {
    const needed = (level - 1) * questionsPerLesson - solvedQuestions;
    if (needed > 0 && level === completedLessons + 2) return `${needed}문항 더 풀면 열려요`;
    return `Lv.${level - 1} 완료 시`;
  };

  const kindName = (kind: LessonKind) =>
    kind === "summit" ? "정상 도전" : kind === "checkpoint" ? "구간 점검" : "레슨";

  const stepLabel = (step: RoadStep) => {
    const base = `${categoryName} ${kindName(step.kind)} ${step.level}`;
    if (step.state === "done") return `${base} · 완료 · 다시 풀기`;
    if (step.state === "current") return `${base} · 현재 학습 · 시작하기`;
    return `${base} · 잠김 · ${unlockHint(step.level)}`;
  };

  return (
    <section className="turini-road" data-map-theme={theme} aria-label={`${categoryName} 학습 로드맵`}>
      <header className="turini-road__head">
        <div className="turini-road__crest" aria-hidden="true">
          {categoryIcon}
        </div>
        <div className="turini-road__headline">
          <p className="turini-road__eyebrow">{categoryName} 로드맵</p>
          <h2>{allDone ? "모든 구간을 정복했어요" : `${completedLessons} / ${totalLessons} 단계 완료`}</h2>
        </div>
        {currentLevel ? (
          <button type="button" className="turini-road__jump" onClick={scrollToCurrent}>
            이어서 학습
          </button>
        ) : null}
      </header>

      {/* 난이도 탭 — 화면 위에 붙어 따라다니고, 누르면 그 구간으로 이동합니다.
          세 구간은 끊어진 화면이 아니라 하나로 이어진 길 위의 표지판입니다. */}
      <ol className="turini-map__legend" aria-label="구간별 진행">
        {bands.map((band) => {
          const terrain = TERRAIN[band.difficulty] ?? TERRAIN["초급"];
          const sizeOfBand = band.to - band.from + 1;
          const doneInBand = Math.min(sizeOfBand, Math.max(0, completedLessons - (band.from - 1)));
          return (
            <li
              key={band.difficulty}
              data-terrain={terrain.key}
              data-active={band.difficulty === activeBand ? "true" : undefined}
            >
              <button
                type="button"
                className="turini-map__legend-tab"
                onClick={() => jumpToBand(band.difficulty)}
                aria-current={band.difficulty === activeBand ? "true" : undefined}
                aria-label={`${terrain.name} · ${band.difficulty} 구간으로 이동 · ${doneInBand}/${sizeOfBand} 완료`}
              >
                <b>{terrain.name}</b>
                <span>{band.difficulty}</span>
                <i aria-hidden="true" style={{ ["--fill" as string]: `${(doneInBand / sizeOfBand) * 100}%` }} />
                <small>
                  {doneInBand}/{sizeOfBand} 완료
                </small>
              </button>
            </li>
          );
        })}
      </ol>

      <div className="turini-road__track">
        {bands.map((band) => {
          const terrain = TERRAIN[band.difficulty] ?? TERRAIN["초급"];
          const sizeOfBand = band.to - band.from + 1;
          const doneInBand = Math.min(sizeOfBand, Math.max(0, completedLessons - (band.from - 1)));
          return (
            <section
              key={band.difficulty}
              className="turini-road__band"
              data-terrain={terrain.key}
              data-focus={band.difficulty === activeBand ? "true" : undefined}
              aria-label={`${terrain.name} 구간`}
            >
              <header className="turini-road__band-head">
                <div>
                  <p>
                    <b>{terrain.name}</b>
                    <span>{band.difficulty}</span>
                  </p>
                  <small>{terrain.note}</small>
                </div>
                <strong>
                  {doneInBand}/{sizeOfBand}
                </strong>
              </header>

              <ol className="turini-road__list">
                {band.steps.map((step) => {
                  const isCurrent = step.state === "current";
                  return (
                    <li
                      key={step.level}
                      className="turini-road__step"
                      data-state={step.state}
                      data-kind={step.kind}
                      ref={(element) => {
                        stepRefs.current[step.level] = element;
                        if (isCurrent) currentStopRef.current = element;
                      }}
                    >
                      <span className="turini-road__rail" aria-hidden="true">
                        <i className="turini-road__line" />
                        <span className="turini-road__marker" data-state={step.state}>
                          {step.state === "done" ? (
                            <b className="turini-map__star">★</b>
                          ) : step.state === "locked" ? (
                            <svg className="turini-map__lock" viewBox="0 0 24 24">
                              <path
                                d="M7 10V7.5a5 5 0 0 1 10 0V10"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2.4"
                                strokeLinecap="round"
                              />
                              <rect x="4.5" y="10" width="15" height="10.5" rx="3" fill="currentColor" />
                            </svg>
                          ) : (
                            <b className="turini-road__level">{step.level}</b>
                          )}
                        </span>
                      </span>

                      <article className="turini-road__card" data-state={step.state}>
                        <div className="turini-road__card-top">
                          <span className="turini-road__chip">Lv.{step.level}</span>
                          {step.kind !== "lesson" ? (
                            <span className="turini-road__chip turini-road__chip--kind">
                              {kindName(step.kind)}
                            </span>
                          ) : null}
                          <span className="turini-road__status" data-state={step.state}>
                            {step.state === "done" ? "완료" : step.state === "current" ? "지금 여기" : "잠김"}
                          </span>
                        </div>

                        <h3>
                          {categoryName} {kindName(step.kind)} {step.level}
                        </h3>

                        <ul className="turini-road__meta">
                          <li>
                            <span>문제</span>
                            <b>{questionsPerLesson}문항</b>
                          </li>
                          <li>
                            <span>받을 XP</span>
                            <b>최대 {maxXp}</b>
                          </li>
                        </ul>

                        {step.state === "locked" ? (
                          <p className="turini-road__hint">{unlockHint(step.level)}</p>
                        ) : null}

                        <button
                          type="button"
                          className={`turini-road__start ${isCurrent ? "primary-button" : ""}`.trim()}
                          onClick={() => step.state !== "locked" && onStartLesson(step.level)}
                          disabled={step.state === "locked"}
                          aria-label={stepLabel(step)}
                        >
                          {step.state === "done" ? "다시 풀기" : "시작하기"}
                        </button>
                      </article>
                    </li>
                  );
                })}
              </ol>
            </section>
          );
        })}
      </div>
    </section>
  );
}
