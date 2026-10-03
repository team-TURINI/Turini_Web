"use client";

import Image from "next/image";
import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { TuriniMotion } from "./turini-sprite";
import {
  AVATAR_ITEMS,
  approvedHatAsset,
  BAG_BASE,
  DEFAULT_CUSTOMIZATION,
  AVATAR_SLOTS,
  VIEW_LABEL,
  assetPath,
  assetPathWebp,
  findItem,
  isItemUnlocked,
  itemsForSlot,
  placementFor,
  remainingLabel,
  requirementLabel,
  requirementProgress,
  wornBackPreview,
  wornFrontPreview,
  wornPreview,
  type AvatarItem,
  type AvatarSlot,
  type AvatarStats,
  type TurniView,
  type TuriniCustomization,
} from "./avatar-items";

/** 일반 화면은 꾸미기에서 쓰는 정면 기본 이미지 한 장을 공유합니다. */

/**
 * 저장된 꾸미기 상태를 앱 전체가 공유합니다.
 * 화면마다 따로 넘기지 않아도 같은 값을 보게 되므로, 어떤 화면도
 * 혼자만 기본 캐릭터로 돌아가는 일이 없습니다.
 */
const CustomizationContext = createContext<TuriniCustomization>(DEFAULT_CUSTOMIZATION);

export function TuriniAvatarProvider({
  customization,
  children,
}: {
  customization: TuriniCustomization;
  children: ReactNode;
}) {
  return (
    <CustomizationContext.Provider value={customization}>{children}</CustomizationContext.Provider>
  );
}

export function useCustomization() {
  return useContext(CustomizationContext);
}

export type TuriniAvatarProps = {
  /** 생략하면 공통 저장소(Provider)의 값을 씁니다 */
  customization?: TuriniCustomization;
  motion?: TuriniMotion;
  /** 값이 바뀌면 같은 동작이라도 처음부터 다시 재생합니다 */
  replayKey?: string | number;
  /** 1회 재생이 끝나도 마지막 프레임을 유지합니다 (정답·오답 팻말) */
  holdLast?: boolean;
  className?: string;
  label?: string;
  decorative?: boolean;
  /** 배경 그림까지 함께 보여 줄지 (홈·마이페이지·꾸미기에서만 켭니다) */
  scene?: boolean;
  /** 숨쉬기·깜박임 */
  animated?: boolean;
};

export default function TuriniAvatar({
  motion = "idle",
  className = "",
  label = "나의 투리니",
  decorative = false,
  animated = true,
}: TuriniAvatarProps) {
  return (
    <span className={`turini-avatar turini-avatar--base ${className}`.trim()}
      data-motion={motion} data-animated={animated ? "true" : "false"}
      role={decorative ? undefined : "img"} aria-label={decorative ? undefined : label}
      aria-hidden={decorative || undefined}>
      <Image className="turini-avatar__base-image" src={BAG_BASE.front} alt="" fill unoptimized
        sizes="(max-width: 600px) 150px, 180px" draggable={false} />
    </span>
  );
}

/** 학습·코칭에도 동일한 기본 정면 이미지를 씁니다. */
export function BasicReadingTurini({
  className = "",
  decorative = false,
}: {
  className?: string;
  decorative?: boolean;
}) {
  return <TuriniAvatar motion="reading" className={className} decorative={decorative} />;
}

/** 퀴즈 풀이 중에도 동일한 기본 캐릭터가 살짝 기울어집니다. */
export function QuizThinkingTurini({
  className = "",
  decorative = false,
}: {
  className?: string;
  decorative?: boolean;
}) {
  return <TuriniAvatar motion="thinking" className={className} decorative={decorative} />;
}

/* ──────────────────────────────────────────────────────────────
   이미지 한 장 — webp 를 먼저 쓰고, 없으면 원본 png, 그것도 없으면 조용히 비웁니다.
   ────────────────────────────────────────────────────────────── */

function ItemImage({
  item,
  alt = "",
  eager = false,
  className = "",
}: {
  item: AvatarItem;
  alt?: string;
  eager?: boolean;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return <span className={`turini-dress__missing ${className}`.trim()} aria-hidden="true" />;
  }
  return (
    <picture>
      <source srcSet={assetPathWebp(item.slot, item.file)} type="image/webp" />
      <img
        className={className}
        src={assetPath(item.slot, item.file)}
        alt={alt}
        loading={eager ? "eager" : "lazy"}
        decoding={eager ? "sync" : "async"}
        draggable={false}
        onError={() => setFailed(true)}
      />
    </picture>
  );
}

/** 목록 썸네일 — 그 아이템 하나를 실제로 착용한 완성본을 씁니다 */
function WornThumb({ item }: { item: AvatarItem }) {
  const [failed, setFailed] = useState(false);
  const approvedWorn = item.slot === "hat" ? approvedHatAsset(item.file, "worn") : null;
  if (approvedWorn) return <img src={approvedWorn} alt="" loading="lazy" decoding="async" draggable={false} />;
  if (item.slot === "bag" && !failed) {
    return (
      <img
        src={`/assets/worn-front-thumb/bags/${item.file}-worn-front.webp`}
        alt=""
        loading="lazy"
        decoding="async"
        draggable={false}
        onError={() => setFailed(true)}
      />
    );
  }
  const worn = wornPreview(item);
  if (!worn || failed) return <ItemImage item={item} />;
  return (
    <picture>
      <source srcSet={worn.thumb} type="image/webp" />
      <img src={worn.png} alt="" loading="lazy" decoding="async" draggable={false} onError={() => setFailed(true)} />
    </picture>
  );
}

/* 뒷면 그림 위에 머리·목 장식만 얹습니다. 안경은 얼굴 뒤에서 보이지 않습니다. */
function PreviewAccessory({ item, view }: { item: AvatarItem; view: TurniView }) {
  const place = placementFor(item, view === "front" ? "editor-front" : "editor-back");
  return (
    <span className={`turini-dress__accessory turini-dress__accessory--${item.slot}`}
      style={{ left: `${place.left}%`, top: `${place.top}%`, width: `${place.size}%` }}>
      <ItemImage item={item} eager />
    </span>
  );
}

function TurnaroundView({ customization, view }: { customization: TuriniCustomization; view: TurniView }) {
  const bag = findItem(customization.bag);
  const worn = bag ? (view === "front" ? wornFrontPreview(bag) : wornBackPreview(bag)) : null;
  const slots: readonly ("neck" | "glasses" | "hat")[] =
    view === "front" ? ["neck", "glasses", "hat"] : ["neck", "hat"];
  const selected = slots
    .map((slot) => findItem(customization[slot]))
    .filter((item): item is AvatarItem => Boolean(item));
  const hat = findItem(customization.hat);
  const approvedHat = hat ? approvedHatAsset(hat.file, "overlay") : null;
  return (
    <span className="turini-dress__turn" data-view={view} aria-hidden="true">
      <Image className="turini-dress__base" src={BAG_BASE[view]} alt="" fill unoptimized
        sizes="(max-width: 768px) 66vw, 211px" draggable={false} />
      {worn ? view === "front" ? (
        (["left", "right"] as const).map((side) => (
          <Image key={`${worn}-${side}`} className={`turini-dress__bag-front turini-dress__bag-front--${side}`}
            src={worn} alt="" fill unoptimized sizes="(max-width: 768px) 66vw, 211px" draggable={false} />
        ))
      ) : (
        <Image key={worn} className="turini-dress__bag-back" src={worn} alt="" fill unoptimized
          sizes="(max-width: 768px) 66vw, 211px" draggable={false} />
      ) : null}
      {selected.filter((item) => item.slot !== "hat" || !approvedHat).map((item) =>
        <PreviewAccessory key={item.id} item={item} view={view} />)}
      {view === "front" && approvedHat ? (
        <span className={`turini-dress__hat-canvas${hat?.file === "chef_hat" ? " turini-dress__hat-canvas--chef" : ""}`}>
          <Image className="turini-dress__approved-hat" src={approvedHat} alt="" fill unoptimized
            sizes="(max-width: 768px) 66vw, 211px" draggable={false} />
        </span>
      ) : null}
    </span>
  );
}

/* ──────────────────────────────────────────────────────────────
   꾸미기 화면
   ────────────────────────────────────────────────────────────── */

export function TuriniDressUp({
  customization,
  stats,
  saving,
  onChange,
}: {
  customization: TuriniCustomization;
  stats: AvatarStats;
  saving: boolean;
  onChange: (next: TuriniCustomization) => void;
}) {
  const [slot, setSlot] = useState<AvatarSlot>("hat");
  const [showLocked, setShowLocked] = useState(true);
  const [view, setView] = useState<TurniView>("front");

  const unlockedIds = useMemo(() => {
    const set = new Set<string>();
    AVATAR_ITEMS.forEach((entry) => {
      if (isItemUnlocked(entry, stats)) set.add(entry.id);
    });
    return set;
  }, [stats]);

  const slotItems = itemsForSlot(slot);
  const visible = showLocked ? slotItems : slotItems.filter((entry) => unlockedIds.has(entry.id));
  const slotName = AVATAR_SLOTS.find((entry) => entry.key === slot)?.name ?? "";
  const background = findItem(customization.background);

  const choose = (entry: AvatarItem) => {
    if (!unlockedIds.has(entry.id)) return;
    if (customization[entry.slot] === entry.id) return;
    onChange({ ...customization, [entry.slot]: entry.id });
  };

  const clearSlot = () => {
    if (customization[slot] === null) return;
    onChange({ ...customization, [slot]: null });
  };

  return (
    <section className="card-block turini-dress" aria-label="캐릭터 꾸미기">
      <div className="turini-dress__head">
        <div>
          <p className="eyebrow">MY TURINI</p>
          <h2>캐릭터 꾸미기</h2>
        </div>
        <span className="turini-dress__count" aria-live="polite">
          {saving ? "저장 중…" : `보유 ${unlockedIds.size} / ${AVATAR_ITEMS.length}`}
        </span>
      </div>

      <div className="turini-dress__stage">
          <div className="turini-avatar turini-avatar--scene turini-avatar--editor turini-avatar--turn"
            role="img" aria-label={`꾸미는 중인 나의 투리니 ${view === "front" ? "정면" : "뒷면"}`}>
            {background ? (
              <span className="turini-avatar__background" aria-hidden="true">
                <ItemImage item={background} eager />
              </span>
            ) : null}
            {view === "front" ? <TurnaroundView customization={customization} view={view} /> : (
              <span className="turini-dress__back-pending">뒷면은 아직 업데이트되지 않았어요.</span>
            )}
          </div>

        <div className="turini-dress__views" role="group" aria-label="보는 방향">
          {(["front", "back"] as TurniView[]).map((entry) => (
            <button
              key={entry}
              type="button"
              className="turini-dress__view"
              data-active={view === entry ? "true" : undefined}
              aria-pressed={view === entry}
              onClick={() => setView(entry)}
            >
              {VIEW_LABEL[entry]}
            </button>
          ))}
        </div>
      </div>

      <div className="turini-dress__tabs" role="tablist" aria-label="꾸미기 카테고리">
        {AVATAR_SLOTS.map(({ key, name }) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={slot === key}
            className="turini-dress__tab"
            data-active={slot === key ? "true" : undefined}
            onClick={() => setSlot(key)}
          >
            {name}
          </button>
        ))}
      </div>

      <div className="turini-dress__toolbar">
        <span>
          {slotName} · {visible.length}종
        </span>
        <label className="turini-dress__toggle">
          <input
            type="checkbox"
            checked={showLocked}
            onChange={(event) => setShowLocked(event.target.checked)}
          />
          잠긴 항목 보기
        </label>
      </div>

      <ul className="turini-dress__grid">
        {slot !== "background" ? (
          <li>
            <button
              type="button"
              className="turini-dress__item turini-dress__item--none"
              data-state={customization[slot] === null ? "selected" : "owned"}
              onClick={clearSlot}
              aria-pressed={customization[slot] === null}
            >
              <span className="turini-dress__item-art">
                <svg viewBox="0 0 24 24" aria-hidden="true" className="turini-dress__none-icon">
                  <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2" />
                  <path d="M6 18 18 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
                {customization[slot] === null ? <CheckBadge /> : null}
              </span>
              <b>착용 해제</b>
            </button>
          </li>
        ) : null}

        {visible.map((entry) => {
          const unlocked = unlockedIds.has(entry.id);
          const selected = customization[entry.slot] === entry.id;
          const { current, target } = requirementProgress(entry.requirement, stats);
          return (
            <li key={entry.id}>
              <button
                type="button"
                className="turini-dress__item"
                data-state={selected ? "selected" : unlocked ? "owned" : "locked"}
                onClick={() => choose(entry)}
                disabled={!unlocked}
                aria-pressed={selected}
                aria-label={
                  unlocked
                    ? `${entry.name}${selected ? " · 착용 중" : ""}`
                    : `${entry.name} · 잠김 · ${requirementLabel(entry.requirement)}`
                }
              >
                <span className="turini-dress__item-art">
                  {entry.slot === "background" ? <ItemImage item={entry} /> : <WornThumb item={entry} />}
                  {selected ? <CheckBadge /> : null}
                  {!unlocked ? <LockBadge /> : null}
                </span>
                <b>{entry.name}</b>
                {unlocked ? null : (
                  <small className="turini-dress__need">
                    {requirementLabel(entry.requirement)}
                    <i>
                      {remainingLabel(entry.requirement, stats)} ({Math.min(current, target)}/{target})
                    </i>
                  </small>
                )}
              </button>
            </li>
          );
        })}
      </ul>

      {visible.length === 0 ? (
        <p className="turini-dress__empty">이 카테고리에 아직 열린 아이템이 없어요.</p>
      ) : null}

      <p className="turini-dress__notice">
        고른 아이템은 바로 저장돼서 새로고침하거나 다시 로그인해도 그대로예요. 홈·학습·마이페이지의 투리니에도 함께 반영돼요.
      </p>
    </section>
  );
}

function CheckBadge() {
  return (
    <span className="turini-dress__check" aria-hidden="true">
      <svg viewBox="0 0 24 24">
        <path
          d="m5 12.5 4.5 4.5L19 7.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

function LockBadge() {
  return (
    <span className="turini-dress__lock" aria-hidden="true">
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
  );
}
