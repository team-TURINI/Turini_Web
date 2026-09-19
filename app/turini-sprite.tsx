"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import {
  SPRITE_SLOTS,
  assetPath,
  assetPathWebp,
  findItem,
  placementFor,
  type AvatarItem,
  type TuriniCustomization,
} from "./avatar-items";

/**
 * 투리니 12프레임 스프라이트
 *
 * 자산: `public/assets/turini/animations/turini-animation-atlas-12f.png`
 *       3072×1536 = 12프레임 × 6동작, 한 칸 256×256.
 *
 * - 프레임은 자바스크립트로 넘깁니다. 한 번에 하나의 타이머만 돌기 때문에
 *   버튼을 빠르게 여러 번 눌러도 동작이 겹쳐 재생되지 않습니다.
 * - 1회 재생 동작(정답·오답·축하)은 끝나면 스스로 idle 로 돌아옵니다.
 * - 화면을 떠나면 타이머를 정리합니다.
 * - 아틀라스를 미리 받아 두어 첫 재생에서 빈 화면이 보이지 않습니다.
 */

export type TuriniMotion = "idle" | "thinking" | "correct" | "wrong" | "celebrate" | "reading";

const ATLAS = "/assets/turini/animations/turini-animation-atlas-12f.png";
const FRAME_ANCHORS = "/assets/turini/animations/turini-frame-anchors.json";
const ATLAS_WEBP = "/assets/turini/optimized/animations/turini-animation-atlas-12f.webp";

const FRAMES = 12;
const ROWS = 6;
/** 한 바퀴 길이(ms). 12프레임 기준 한 프레임 110ms — 너무 빠르지도 느리지도 않습니다. */
const DURATION: Record<TuriniMotion, number> = {
  idle: 1440,
  thinking: 1440,
  reading: 1560,
  correct: 1200,
  wrong: 1320,
  celebrate: 1200,
};

const ROW: Record<TuriniMotion, number> = {
  idle: 0,
  thinking: 1,
  correct: 2,
  wrong: 3,
  celebrate: 4,
  reading: 5,
};

const LOOPS: Record<TuriniMotion, boolean> = {
  idle: true,
  thinking: true,
  reading: true,
  correct: false,
  wrong: false,
  celebrate: false,
};

/** 애니메이션을 줄이는 설정일 때 보여 줄 대표 프레임 (정답·오답은 팻말을 든 0번) */
const STILL: Record<TuriniMotion, number> = {
  idle: 0,
  thinking: 0,
  correct: 0,
  wrong: 0,
  celebrate: 0,
  reading: 0,
};

/**
 * 동작마다 붙일 수 있는 액세서리.
 * 정답·오답·읽기는 가슴 앞에 팻말이나 책을 들고 있어서, 목 액세서리를 얹으면
 * 팻말을 가립니다. 그래서 이 세 동작에서는 머리 쪽만 붙입니다.
 */
const SLOTS_FOR_MOTION: Record<TuriniMotion, readonly string[]> = {
  idle: SPRITE_SLOTS,
  thinking: SPRITE_SLOTS,
  celebrate: SPRITE_SLOTS,
  correct: ["glasses", "hat"],
  wrong: ["glasses", "hat"],
  reading: ["glasses", "hat"],
};

const LABEL: Record<TuriniMotion, string> = {
  idle: "투리니 기린 캐릭터",
  thinking: "생각하는 투리니",
  correct: "초록색 체크 팻말을 든 투리니",
  wrong: "빨간색 X 팻말을 든 투리니",
  celebrate: "축하하는 투리니",
  reading: "책을 읽는 투리니",
};

/**
 * 아틀라스를 한 번만 미리 받아 둡니다.
 * 가벼운 webp 를 먼저 쓰고, 못 읽으면 원본 png 로 내려갑니다.
 */
let atlasPromise: Promise<string | null> | null = null;
export function preloadTuriniAtlas(): Promise<string | null> {
  if (typeof window === "undefined") return Promise.resolve(ATLAS);
  if (!atlasPromise) {
    atlasPromise = new Promise<string | null>((resolve) => {
      const tryLoad = (url: string, fallback?: string) => {
        const image = new window.Image();
        image.onload = () => resolve(url);
        // 둘 다 못 읽으면 null 을 돌려줍니다. 그래야 바깥에서 리그 캐릭터로
        // 바꿔 끼울 수 있습니다. (예전에는 주소만 돌려줘서 캐릭터가 통째로
        // 보이지 않고 그림자만 남았습니다)
        image.onerror = () => (fallback ? tryLoad(fallback) : resolve(null));
        image.src = url;
      };
      tryLoad(ATLAS_WEBP, ATLAS);
    });
  }
  return atlasPromise;
}

/**
 * 프레임마다 머리가 어디에 얼마나 크게 그려졌는지 적어 둔 표입니다.
 * idle 0번 프레임을 기준(1.0)으로 템플릿 정합해서 구했습니다.
 * `[가로중심, 세로중심, 배율, 기울기(도)]` — 단위는 한 칸(256px) 픽셀입니다.
 */
type FrameAnchor = [number, number, number, number];
type AnchorFile = {
  cell: number;
  templateCenter: [number, number];
  frames: Record<string, FrameAnchor[]>;
};

let anchorPromise: Promise<AnchorFile | null> | null = null;
export function loadFrameAnchors(): Promise<AnchorFile | null> {
  if (typeof window === "undefined") return Promise.resolve(null);
  if (!anchorPromise) {
    anchorPromise = fetch(FRAME_ANCHORS)
      .then((response) => (response.ok ? response.json() : null))
      .catch(() => null);
  }
  return anchorPromise;
}

/** 액세서리 한 개 — 프레임 좌표계(한 칸 256px) 안에 놓습니다 */
function SpritePiece({ item }: { item: AvatarItem }) {
  const [failed, setFailed] = useState(false);
  const place = placementFor(item, "sprite");
  if (failed) return null;
  return (
    <span
      className="turini-sprite__piece"
      data-slot={item.slot}
      style={{ left: `${place.left}%`, top: `${place.top}%`, width: `${place.size}%` }}
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

function framePosition(motion: TuriniMotion, frame: number) {
  const x = (frame * 100) / (FRAMES - 1);
  const y = (ROW[motion] * 100) / (ROWS - 1);
  return `${x}% ${y}%`;
}

export type TuriniSpriteProps = {
  motion?: TuriniMotion;
  /** 값이 바뀌면 같은 동작이라도 처음부터 다시 재생합니다 */
  replayKey?: string | number;
  className?: string;
  /** 같은 뜻의 글이 화면에 이미 있으면 true */
  decorative?: boolean;
  /** 1회 재생이 끝난 뒤 돌아갈 동작 */
  restMotion?: TuriniMotion;
  /**
   * 1회 재생이 끝나면 쉬는 동작으로 돌아가지 않고 마지막 프레임에서 멈춥니다.
   * 퀴즈 정답·오답처럼 해설을 읽는 동안 팻말이 계속 보여야 하는 자리에서 씁니다.
   */
  holdLast?: boolean;
  /**
   * 1회 재생이 끝나 쉬는 동작으로 돌아가는 순간 한 번 불립니다.
   * 바깥(TuriniAvatar)에서 착용 상태가 반영된 리그 캐릭터로 바꿔 끼울 때 씁니다.
   */
  onRest?: () => void;
  /** 착용 중인 아이템. 넘기면 프레임마다 머리를 따라 함께 움직입니다. */
  customization?: TuriniCustomization;
  /** 아틀라스를 못 읽었을 때 알려 줍니다 (바깥에서 리그 캐릭터로 바꿔 끼웁니다) */
  onAtlasMissing?: () => void;
};

export default function TuriniSprite({
  motion = "idle",
  replayKey,
  className = "",
  decorative = false,
  restMotion = "idle",
  holdLast = false,
  onRest,
  customization,
  onAtlasMissing,
}: TuriniSpriteProps) {
  const [atlasUrl, setAtlasUrl] = useState<string | null>(null);
  const [anchors, setAnchors] = useState<AnchorFile | null>(null);
  const [reduceMotion, setReduceMotion] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 콜백을 ref 에 담아 둡니다. 매 렌더마다 새 함수가 와도 재생이 끊기지 않습니다.
  const restRef = useRef(onRest);
  const missingRef = useRef(onAtlasMissing);
  useEffect(() => {
    restRef.current = onRest;
    missingRef.current = onAtlasMissing;
  }, [onRest, onAtlasMissing]);

  // 한 번의 재생 = 하나의 cycle. 요청이 바뀌면 렌더 중에 곧바로 처음으로 되돌립니다.
  // (React 가 권하는 "렌더 중 상태 맞추기" — 화면이 한 번 잘못 그려졌다가 고쳐지지 않습니다.)
  const cycleKey = `${motion}|${replayKey ?? ""}`;
  const [cycle, setCycle] = useState({ key: cycleKey, motion, frame: 0 });
  if (cycle.key !== cycleKey) setCycle({ key: cycleKey, motion, frame: 0 });
  const active = cycle.key === cycleKey ? cycle.motion : motion;
  const frame = cycle.key === cycleKey ? cycle.frame : 0;

  useEffect(() => {
    let alive = true;
    preloadTuriniAtlas().then((url) => {
      if (!alive) return;
      if (url) setAtlasUrl(url);
      else missingRef.current?.();
    });
    return () => {
      alive = false;
    };
  }, []);

  // 액세서리를 쓸 때만 프레임 표를 받아 옵니다.
  const wantsPieces = Boolean(customization);
  useEffect(() => {
    if (!wantsPieces) return;
    let alive = true;
    loadFrameAnchors().then((data) => {
      if (alive) setAnchors(data);
    });
    return () => {
      alive = false;
    };
  }, [wantsPieces]);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduceMotion(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  // 요청된 동작이 바뀌면 처음부터 다시 시작합니다.
  // 타이머는 항상 하나뿐이라 이전 동작이 겹쳐 남지 않습니다.
  useEffect(() => {
    if (reduceMotion) return;

    let running = true;
    let current: TuriniMotion = motion;
    let index = 0;

    const step = () => {
      if (!running) return;
      index += 1;
      if (index >= FRAMES) {
        if (LOOPS[current]) {
          index = 0; // 마지막 프레임 다음이 첫 프레임이라 반복이 자연스럽게 이어집니다
        } else if (holdLast) {
          // 마지막 프레임에서 멈춥니다. 정답·오답 팻말이 그대로 남습니다.
          running = false;
          setCycle({ key: cycleKey, motion: current, frame: FRAMES - 1 });
          return;
        } else {
          // 1회 재생이 끝나면 쉬는 동작으로 돌아갑니다.
          // 계속 그리면서 바깥에도 알려 주기 때문에, 바꿔 끼는 순간에도 빈 화면이 없습니다.
          current = restMotion;
          index = 0;
          restRef.current?.();
        }
      }
      setCycle({ key: cycleKey, motion: current, frame: index });
      timer.current = setTimeout(step, DURATION[current] / FRAMES);
    };

    timer.current = setTimeout(step, DURATION[current] / FRAMES);

    return () => {
      running = false;
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
    };
  }, [cycleKey, motion, reduceMotion, restMotion, holdLast]);

  const shownMotion = reduceMotion ? motion : active;
  const shownFrame = reduceMotion ? STILL[motion] : frame;

  const labelProps = decorative
    ? ({ "aria-hidden": true } as const)
    : ({ role: "img", "aria-label": LABEL[shownMotion] } as const);

  // 이 프레임에서 머리가 놓인 자리. 액세서리를 통째로 같은 자리로 옮겨 붙입니다.
  const anchor = anchors?.frames?.[shownMotion]?.[shownFrame];
  const allowed = SLOTS_FOR_MOTION[shownMotion];
  const worn = customization
    ? SPRITE_SLOTS.filter((slot) => allowed.includes(slot))
        .map((slot) => findItem(customization[slot]))
        .filter((entry): entry is AvatarItem => Boolean(entry))
    : [];

  let headStyle: CSSProperties | undefined;
  if (anchor && anchors) {
    const cell = anchors.cell || 256;
    const [originX, originY] = anchors.templateCenter;
    const [cx, cy, scale, rotate] = anchor;
    headStyle = {
      left: `${((cx - scale * originX) / cell) * 100}%`,
      top: `${((cy - scale * originY) / cell) * 100}%`,
      width: `${scale * 100}%`,
      transformOrigin: `${(originX / cell) * 100}% ${(originY / cell) * 100}%`,
      transform: rotate ? `rotate(${rotate}deg)` : undefined,
    };
  }

  return (
    <span
      className={`turini-sprite ${className}`.trim()}
      data-motion={shownMotion}
      data-ready={atlasUrl ? "true" : undefined}
      {...labelProps}
    >
      <span
        className="turini-sprite__frame"
        style={
          {
            backgroundImage: atlasUrl ? `url("${atlasUrl}")` : undefined,
            backgroundPosition: framePosition(shownMotion, shownFrame),
          } as CSSProperties
        }
      />
      {worn.length && headStyle ? (
        <span className="turini-sprite__worn" aria-hidden="true">
          <span className="turini-sprite__head" style={headStyle}>
            {worn.map((entry) => (
              <SpritePiece key={entry.id} item={entry} />
            ))}
          </span>
        </span>
      ) : null}
    </span>
  );
}
