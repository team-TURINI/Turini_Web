"use client";

import type { CSSProperties } from "react";

/**
 * 학습 카테고리를 고른 뒤 나오는 난이도 선택 화면.
 *
 * 계산은 전부 바깥(page.tsx)에서 기존 함수로 해서 내려줍니다.
 * 이 파일은 받은 값을 어떻게 보여 줄지만 정합니다.
 */

export type DifficultyKey = "초급" | "중급" | "고급";

export type DifficultyCard = {
  key: DifficultyKey;
  /** 한 줄 설명 */
  copy: string;
  /** 이 난이도의 전체 문제 수 */
  total: number;
  /** 완료한 문제 수 */
  done: number;
  /** 잠겨 있는지 */
  locked: boolean;
  /** 잠긴 이유 한 줄 */
  lockHint: string;
  /** 이 난이도의 첫 레슨 번호 */
  firstLesson: number;
};

export const DIFFICULTY_COPY: Record<DifficultyKey, string> = {
  초급: "핵심 개념부터 차근차근",
  중급: "실전 판단과 계산 연습",
  고급: "복합 상황과 응용 문제",
};

const TONE: Record<DifficultyKey, { tint: string; dark: string; soft: string; icon: string }> = {
  초급: { tint: "#3fae63", dark: "#1f7a42", soft: "#e9f8ee", icon: "🌱" },
  중급: { tint: "#e79a1f", dark: "#b26f06", soft: "#fff3dd", icon: "🧭" },
  고급: { tint: "#7a5bd6", dark: "#523a9e", soft: "#f0ebff", icon: "🏔" },
};

export default function DifficultySelect({
  categoryName,
  categoryIcon,
  cards,
  onSelect,
  onBack,
}: {
  categoryName: string;
  categoryIcon: string;
  cards: DifficultyCard[];
  onSelect: (card: DifficultyCard) => void;
  onBack: () => void;
}) {
  return (
    <div className="difficulty-screen">
      <div className="difficulty-head">
        <button type="button" className="difficulty-back" onClick={onBack} aria-label="카테고리 목록으로 돌아가기">
          ‹ 카테고리
        </button>
        <div className="difficulty-title">
          <span className="difficulty-crest" aria-hidden="true">
            {categoryIcon}
          </span>
          <div>
            <p className="eyebrow">난이도 선택</p>
            <h1>{categoryName}</h1>
          </div>
        </div>
        <p className="difficulty-lead">
          세 난이도는 하나로 이어진 학습 경로예요. 고른 구간부터 로드맵을 이어서 올라가면 됩니다.
        </p>
      </div>

      <ul className="difficulty-list">
        {cards.map((card) => {
          const tone = TONE[card.key];
          const empty = card.total === 0;
          const percent = card.total > 0 ? Math.min(100, Math.round((card.done / card.total) * 100)) : 0;
          const started = card.done > 0;
          const disabled = card.locked || empty;
          return (
            <li key={card.key}>
              <article
                className="difficulty-card"
                data-state={disabled ? "locked" : started ? "started" : "ready"}
                style={
                  {
                    ["--tone" as string]: tone.tint,
                    ["--tone-dark" as string]: tone.dark,
                    ["--tone-soft" as string]: tone.soft,
                  } as CSSProperties
                }
              >
                <div className="difficulty-card__top">
                  <span className="difficulty-card__icon" aria-hidden="true">
                    {tone.icon}
                  </span>
                  <div className="difficulty-card__name">
                    <h2>{card.key}</h2>
                    <p>{card.copy}</p>
                  </div>
                  {disabled ? (
                    <span className="difficulty-card__lock" aria-hidden="true">
                      <svg viewBox="0 0 24 24">
                        <path
                          d="M7 10V7.5a5 5 0 0 1 10 0V10"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.4"
                          strokeLinecap="round"
                        />
                        <rect x="4.5" y="10" width="15" height="10.5" rx="3" fill="currentColor" />
                      </svg>
                    </span>
                  ) : null}
                </div>

                <div className="difficulty-card__meter">
                  <div className="progress-track">
                    <span style={{ width: `${percent}%` }} />
                  </div>
                  <div className="difficulty-card__numbers">
                    <b>
                      {card.done} / {card.total}문항
                    </b>
                    <span>{percent}%</span>
                  </div>
                </div>

                {empty ? (
                  <p className="difficulty-card__hint">준비된 문제가 아직 없어요.</p>
                ) : card.locked ? (
                  <p className="difficulty-card__hint">{card.lockHint}</p>
                ) : null}

                <button
                  type="button"
                  className="primary-button difficulty-card__start"
                  onClick={() => onSelect(card)}
                  disabled={disabled}
                >
                  {started ? "이어서 학습" : "학습 시작"}
                </button>
              </article>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
