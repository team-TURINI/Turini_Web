"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";

/**
 * 투리니 캐릭터 애니메이션 (1단계)
 *
 * 프레임 자료는 `public/assets/turini-atlas-v2.png` 한 장이며 4칸 × 6줄 구조입니다.
 * 줄 = 상태, 칸 = 프레임이고 모든 칸이 정사각형이라 어떤 화면 폭에서도 비율이 깨지지 않습니다.
 *
 * 캐릭터의 얼굴과 원래 디자인, 정답 체크 팻말과 오답 X 팻말은 그대로 두고
 * 프레임 순서와 CSS 변형만으로 살아 있는 느낌을 만듭니다.
 */

export type TuriniState = "idle" | "thinking" | "correct" | "wrong" | "celebrate" | "reading";

const ATLAS_COLUMNS = 4;
const ATLAS_ROWS = 6;

const ATLAS_ROW: Record<TuriniState, number> = {
  idle: 0,
  thinking: 1,
  correct: 2,
  wrong: 3,
  celebrate: 4,
  reading: 5,
};

/** 애니메이션을 줄이는 시스템 설정일 때 상태별로 고정해서 보여줄 프레임 */
const STILL_FRAME: Record<TuriniState, number> = {
  idle: 0,
  thinking: 0,
  correct: 0,
  wrong: 0,
  celebrate: 3,
  reading: 0,
};

const LABEL: Record<TuriniState, string> = {
  idle: "투리니 기린 캐릭터",
  thinking: "생각하는 투리니",
  correct: "초록색 체크 팻말을 든 투리니",
  wrong: "빨간색 X 팻말을 든 투리니",
  celebrate: "축하하는 투리니",
  reading: "책을 읽는 투리니",
};

type Beat = { frame: number; ms: number };

function between(min: number, max: number) {
  return min + Math.random() * (max - min);
}

/** 상태에 들어갈 때 한 번만 재생하는 도입 동작 */
const INTRO: Partial<Record<TuriniState, Beat[]>> = {
  correct: [
    { frame: 0, ms: 70 },
    { frame: 1, ms: 150 },
    { frame: 2, ms: 300 },
    { frame: 1, ms: 150 },
  ],
  wrong: [
    { frame: 0, ms: 150 },
    { frame: 1, ms: 300 },
    { frame: 2, ms: 340 },
    { frame: 1, ms: 220 },
  ],
  celebrate: [
    { frame: 0, ms: 90 },
    { frame: 1, ms: 150 },
    { frame: 2, ms: 300 },
    { frame: 3, ms: 220 },
    { frame: 1, ms: 150 },
    { frame: 2, ms: 300 },
  ],
};

/**
 * 도입 동작이 끝난 뒤 계속 반복하는 구간.
 * 호출할 때마다 길이와 프레임이 조금씩 달라져서 기계적인 반복으로 보이지 않습니다.
 */
function loopBeats(state: TuriniState): Beat[] {
  switch (state) {
    case "idle": {
      // 눈을 뜬 프레임은 0번과 3번 두 가지라 가끔 시선·고개 방향이 바뀝니다.
      const base = Math.random() < 0.72 ? 0 : 3;
      const hold = between(3000, 6000); // 3~6초 간격의 불규칙한 눈 깜박임
      const roll = Math.random();
      if (roll < 0.16) {
        return [
          { frame: base, ms: hold },
          { frame: 1, ms: 110 },
          { frame: 0, ms: 100 },
          { frame: 1, ms: 120 },
        ];
      }
      if (roll < 0.3) {
        return [
          { frame: base, ms: hold },
          { frame: 1, ms: 140 },
          { frame: 2, ms: 430 },
          { frame: 1, ms: 120 },
        ];
      }
      return [
        { frame: base, ms: hold },
        { frame: 1, ms: 130 },
      ];
    }
    case "thinking":
      return [
        { frame: 0, ms: between(1000, 1700) },
        { frame: 1, ms: 480 },
        { frame: 2, ms: between(620, 900) },
        { frame: 1, ms: 240 },
        { frame: 3, ms: between(900, 1500) },
      ];
    case "reading": {
      const look = between(1400, 2600);
      const roll = Math.random();
      if (roll < 0.2) {
        // 페이지를 넘기는 프레임
        return [
          { frame: 0, ms: look },
          { frame: 1, ms: look * 0.7 },
          { frame: 3, ms: 620 },
          { frame: 1, ms: 480 },
        ];
      }
      if (roll < 0.55) {
        return [
          { frame: 0, ms: look },
          { frame: 2, ms: 150 }, // 눈 깜박임
        ];
      }
      return [
        { frame: 0, ms: look },
        { frame: 1, ms: look }, // 시선 이동
      ];
    }
    case "correct":
      // 0번과 3번 모두 체크 팻말을 두 손으로 든 프레임입니다.
      return [
        { frame: 3, ms: between(2600, 4200) },
        { frame: 0, ms: between(1400, 2400) },
      ];
    case "wrong":
      // 0·1·3번 모두 X 팻말을 든 프레임이라 팻말이 사라지지 않습니다.
      return [
        { frame: 3, ms: between(2400, 3800) },
        { frame: 1, ms: 520 },
        { frame: 0, ms: between(1600, 2600) },
      ];
    case "celebrate":
      return [
        { frame: 3, ms: between(700, 1100) },
        { frame: 1, ms: 260 },
        { frame: 3, ms: between(700, 1100) },
        { frame: 0, ms: between(500, 900) },
      ];
  }
}

function framePosition(state: TuriniState, frame: number) {
  const x = (frame * 100) / (ATLAS_COLUMNS - 1);
  const y = (ATLAS_ROW[state] * 100) / (ATLAS_ROWS - 1);
  return `${x}% ${y}%`;
}

export type TuriniProps = {
  state?: TuriniState;
  /** 값이 바뀔 때마다 도입 동작과 등장 반응을 다시 재생합니다. */
  reactKey?: string | number;
  className?: string;
  /** 화면에 같은 뜻의 글이 이미 있을 때 장식으로만 쓰려면 true */
  decorative?: boolean;
  /**
   * 한 프레임에 멈춰 세웁니다. 꾸미기 화면처럼 액세서리를 정확한 자리에
   * 붙여야 할 때 씁니다. 프레임이 바뀌면 기준점도 같이 움직이기 때문입니다.
   */
  frozen?: boolean;
};

export default function Turini({
  state = "idle",
  reactKey,
  className = "",
  decorative = false,
  frozen = false,
}: TuriniProps) {
  const [frame, setFrame] = useState(() => STILL_FRAME[state]);
  const [reduceMotion, setReduceMotion] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 애니메이션을 줄이는 시스템 설정을 따르고, 설정이 바뀌면 바로 반영합니다.
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduceMotion(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (reduceMotion || frozen) return;
    let running = true;
    let queue: Beat[] = [...(INTRO[state] ?? [])];
    const advance = () => {
      if (!running) return;
      if (queue.length === 0) queue = loopBeats(state);
      const beat = queue.shift();
      if (!beat) return;
      setFrame(beat.frame);
      timer.current = setTimeout(advance, beat.ms);
    };
    advance();
    return () => {
      running = false;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [state, reduceMotion, frozen, reactKey]);

  // 애니메이션을 줄이는 설정에서는 상태마다 뜻이 분명한 한 장면으로 고정합니다.
  const displayFrame = reduceMotion || frozen ? STILL_FRAME[state] : frame;

  // key가 바뀌면 무대가 다시 붙으면서 등장 반응 동작이 처음부터 재생됩니다.
  const stageKey = `${state}|${reactKey ?? ""}`;
  const labelProps = decorative
    ? ({ "aria-hidden": true } as const)
    : ({ role: "img", "aria-label": LABEL[state] } as const);

  return (
    <span
      className={`turini ${className}`.trim()}
      data-state={state}
      data-frozen={frozen ? "true" : undefined}
      {...labelProps}
    >
      <span className="turini__stage" key={stageKey}>
        <span className="turini__shadow" />
        <span
          className="turini__sprite"
          style={{ backgroundPosition: framePosition(state, displayFrame) } as CSSProperties}
        />
      </span>
    </span>
  );
}
