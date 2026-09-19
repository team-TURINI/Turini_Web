"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import Turini from "./turini-character";
import {
  LAYER_ORDER,
  bagStrapColor,
  findItem,
  placementFor,
  assetPath,
  assetPathWebp,
  type AvatarItem,
  type TuriniCustomization,
} from "./avatar-items";

/**
 * 투리니 레이어 리그
 *
 * `public/assets/turini/character/rig/` 의 분리 파츠(그림자·몸통·다리·팔·머리)를
 * `rig.json` 의 관절 좌표를 중심으로 각각 돌려서 움직입니다.
 * 캔버스는 모두 1200×1200 로 같아서, 파츠를 그냥 겹쳐 놓기만 해도 원래 캐릭터가 됩니다.
 *
 * 액세서리를 화면 위에 따로 띄우지 않는 이유:
 *   모자·안경·목장식은 **머리 그룹 안에** 들어 있습니다. 머리가 기울면 같은
 *   transform 을 함께 받으므로 어긋나지 않습니다.
 *   가방 본체는 몸통 레이어보다 아래에 있어 절대 몸 앞으로 나오지 않고,
 *   어깨끈만 몸통 위에 그립니다.
 *
 * 좌표는 전부 % 라서 40px 아이콘부터 320px 미리보기까지 같은 비율로 움직입니다.
 */

const RIG = "/assets/turini/character/rig";
const RIG_WEBP = "/assets/turini/optimized/character/rig";

/** rig.json 의 관절 좌표(1200 기준)를 % 로 바꾼 값 */
const PIVOT = {
  head: { x: 50, y: 51.42 },
  armLeft: { x: 36.83, y: 54 },
  armRight: { x: 63.25, y: 54 },
  legLeft: { x: 44.67, y: 77.5 },
  legRight: { x: 55.33, y: 77.5 },
  body: { x: 50, y: 62.5 },
} as const;

/** 눈 깜박임에 쓰는 머리 그림 3종 (감은 눈은 전달받은 face 파츠로 만들었습니다) */
const HEAD_FRAME = {
  open: "turini-head",
  half: "turini-head-blink-half",
  closed: "turini-head-blink",
} as const;

type Blink = keyof typeof HEAD_FRAME;

export type TuriniRigProps = {
  customization: TuriniCustomization;
  /** 숨쉬기·고개 기울임·팔 흔들림을 켭니다 */
  animated?: boolean;
  className?: string;
  label?: string;
  decorative?: boolean;
};

function Layer({
  part,
  className,
  style,
  onMissing,
}: {
  part: string;
  className?: string;
  style?: CSSProperties;
  /** 그림을 못 읽었을 때 알려 줍니다 (몸통·머리만 씁니다) */
  onMissing?: () => void;
}) {
  return (
    <picture className={`turini-rig__layer ${className ?? ""}`.trim()} style={style}>
      <source srcSet={`${RIG_WEBP}/${part}.webp`} type="image/webp" />
      <img
        src={`${RIG}/${part}.png`}
        alt=""
        draggable={false}
        decoding="async"
        onError={onMissing}
      />
    </picture>
  );
}

function Piece({ item }: { item: AvatarItem }) {
  const [failed, setFailed] = useState(false);
  const place = placementFor(item);
  if (failed) return null;
  return (
    <span
      className="turini-rig__piece"
      data-slot={item.slot}
      style={{
        left: `${place.left}%`,
        top: `${place.top}%`,
        width: `${place.size}%`,
        zIndex: LAYER_ORDER[item.slot],
      }}
    >
      <picture>
        <source srcSet={assetPathWebp(item.slot, item.file)} type="image/webp" />
        <img
          src={assetPath(item.slot, item.file)}
          alt=""
          draggable={false}
          decoding="async"
          onError={() => setFailed(true)}
        />
      </picture>
    </span>
  );
}

export default function TuriniRig({
  customization,
  animated = true,
  className = "",
  label = "나의 투리니",
  decorative = false,
}: TuriniRigProps) {
  const [blink, setBlink] = useState<Blink>("open");
  /** 리그 그림을 못 읽으면 1단계 스프라이트 캐릭터로 대신합니다 (흰 화면 방지) */
  const [rigMissing, setRigMissing] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduceMotion(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  // 3~6초 간격의 불규칙한 눈 깜박임. 타이머는 항상 하나뿐이라 겹치지 않습니다.
  useEffect(() => {
    if (!animated || reduceMotion) return;
    let alive = true;
    const step = (next: Blink, wait: number) => {
      timer.current = setTimeout(() => {
        if (!alive) return;
        setBlink(next);
        if (next === "open") step("half", 3000 + Math.random() * 3000);
        else if (next === "half") step("closed", 70);
        else step("open", 90);
      }, wait);
    };
    step("half", 1600 + Math.random() * 2600);
    return () => {
      alive = false;
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
    };
  }, [animated, reduceMotion]);

  const hat = findItem(customization.hat);
  const glasses = findItem(customization.glasses);
  const neck = findItem(customization.neck);
  const bag = findItem(customization.bag);
  const headPieces = [neck, glasses, hat].filter((entry): entry is AvatarItem => Boolean(entry));

  const live = animated && !reduceMotion;
  const labelProps = decorative
    ? ({ "aria-hidden": true } as const)
    : ({ role: "img", "aria-label": label } as const);

  // 리그 파츠가 하나라도 없으면 액세서리 위치를 믿을 수 없으므로,
  // 1단계에서 쓰던 통짜 캐릭터로 통째로 대체합니다.
  if (rigMissing) {
    return (
      <span className={`turini-rig turini-rig--fallback ${className}`.trim()} {...labelProps}>
        <Turini state="idle" className="turini-rig__fallback" frozen={!live} decorative />
      </span>
    );
  }

  return (
    <div
      className={`turini-rig ${className}`.trim()}
      data-live={live ? "true" : undefined}
      {...labelProps}
    >
      <div className="turini-rig__canvas">
        <Layer part="turini-shadow" className="turini-rig__shadow" />

        {/* 가방 본체 — 몸통보다 아래. 여기 있는 한 몸 앞으로 떠오를 수 없습니다. */}
        {bag ? (
          <div className="turini-rig__bag">
            <Piece item={bag} />
          </div>
        ) : null}

        <div
          className="turini-rig__body"
          style={{ transformOrigin: `${PIVOT.body.x}% ${PIVOT.body.y}%` }}
        >
          <Layer part="turini-body" onMissing={() => setRigMissing(true)} />
          <Layer
            part="turini-leg_left"
            className="turini-rig__leg turini-rig__leg--left"
            style={{ transformOrigin: `${PIVOT.legLeft.x}% ${PIVOT.legLeft.y}%` }}
          />
          <Layer
            part="turini-leg_right"
            className="turini-rig__leg turini-rig__leg--right"
            style={{ transformOrigin: `${PIVOT.legRight.x}% ${PIVOT.legRight.y}%` }}
          />

          {/* 어깨끈 — 몸통 위, 팔 아래. 가방을 실제로 메고 있는 것처럼 보이게 합니다. */}
          {bag ? (
            <span
              className="turini-rig__straps"
              style={{ ["--strap" as string]: bagStrapColor(bag.id) } as CSSProperties}
              aria-hidden="true"
            >
              <i />
              <i />
            </span>
          ) : null}

          <Layer
            part="turini-arm_left"
            className="turini-rig__arm turini-rig__arm--left"
            style={{ transformOrigin: `${PIVOT.armLeft.x}% ${PIVOT.armLeft.y}%` }}
          />
          <Layer
            part="turini-arm_right"
            className="turini-rig__arm turini-rig__arm--right"
            style={{ transformOrigin: `${PIVOT.armRight.x}% ${PIVOT.armRight.y}%` }}
          />
        </div>

        {/* 머리 그룹 — 모자·안경·목장식이 이 안에 있어 고개와 함께 움직입니다 */}
        <div
          className="turini-rig__head"
          style={{ transformOrigin: `${PIVOT.head.x}% ${PIVOT.head.y}%` }}
        >
          <Layer part={HEAD_FRAME[live ? blink : "open"]} onMissing={() => setRigMissing(true)} />
          {headPieces.map((entry) => (
            <Piece key={entry.id} item={entry} />
          ))}
        </div>
      </div>
    </div>
  );
}
