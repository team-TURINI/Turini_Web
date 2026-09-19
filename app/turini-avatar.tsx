"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import TuriniRig from "./turini-rig";
import TuriniSprite, { type TuriniMotion } from "./turini-sprite";
import {
  AVATAR_ITEMS,
  DEFAULT_CUSTOMIZATION,
  AVATAR_SLOTS,
  TURNAROUND,
  TURNAROUND_WEBP,
  VIEW_LABEL,
  assetPath,
  assetPathWebp,
  findItem,
  isItemUnlocked,
  itemsForSlot,
  remainingLabel,
  requirementLabel,
  requirementProgress,
  wornPreview,
  type AvatarItem,
  type AvatarSlot,
  type AvatarStats,
  type TurniView,
  type TuriniCustomization,
} from "./avatar-items";

/**
 * 앱 전체가 쓰는 하나의 캐릭터 컴포넌트.
 *
 * - `motion="idle"` : 레이어 리그로 그립니다. 저장한 모자·안경·목장식·가방이
 *   모두 반영되고, 고개·몸통이 움직이면 액세서리도 함께 움직입니다.
 * - 그 밖의 동작(생각·정답·오답·축하·읽기) : 미리 만들어 둔 12프레임 스프라이트를
 *   씁니다. 프레임마다 머리가 놓인 자리를 적어 둔 표
 *   (`animations/turini-frame-anchors.json`)를 읽어, 모자·안경·목장식이
 *   고개를 그대로 따라갑니다. 손에 드는 상황 소품(체크 팻말·X 팻말·책)과
 *   자리가 겹치는 가방은 이 동작에서 빠집니다.
 *   동작이 끝나면 가방까지 모두 반영된 리그 캐릭터로 돌아옵니다.
 *
 * 화면마다 따로 이미지를 불러오지 않으므로, 꾸미기에서 저장하면 홈·마이페이지·
 * 학습 화면이 한꺼번에 바뀝니다.
 */

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
  customization: given,
  motion = "idle",
  replayKey,
  holdLast = false,
  className = "",
  label = "나의 투리니",
  decorative = false,
  scene = false,
  animated = true,
}: TuriniAvatarProps) {
  const shared = useCustomization();
  const customization = given ?? shared;
  const background = scene ? findItem(customization.background) : null;

  // 1회 재생(정답·오답·축하)이 끝나면 착용 상태가 반영된 리그 캐릭터로 돌아옵니다.
  const cycleKey = `${motion}|${replayKey ?? ""}`;
  const [rested, setRested] = useState({ key: cycleKey, done: false });
  if (rested.key !== cycleKey) setRested({ key: cycleKey, done: false });
  // 애니메이션 그림을 못 읽으면 캐릭터가 사라지는 대신 리그 캐릭터로 대신합니다.
  const [atlasMissing, setAtlasMissing] = useState(false);
  const showRig =
    atlasMissing || motion === "idle" || (rested.key === cycleKey && rested.done && !holdLast);

  const body =
    showRig ? (
      <TuriniRig
        customization={customization}
        animated={animated}
        className="turini-avatar__figure"
        label={label}
        decorative={decorative || scene}
      />
    ) : (
      <TuriniSprite
        motion={motion}
        replayKey={replayKey}
        holdLast={holdLast}
        onRest={() => setRested({ key: cycleKey, done: true })}
        onAtlasMissing={() => setAtlasMissing(true)}
        className="turini-avatar__figure"
        decorative={decorative || scene}
        customization={customization}
      />
    );

  if (!background) return <span className={`turini-avatar ${className}`.trim()}>{body}</span>;

  return (
    <div className={`turini-avatar turini-avatar--scene ${className}`.trim()} role="img" aria-label={label}>
      <span className="turini-avatar__background" aria-hidden="true">
        <ItemImage item={background} eager />
      </span>
      {body}
    </div>
  );
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
  const worn = wornPreview(item);
  if (!worn || failed) return <ItemImage item={item} />;
  return (
    <picture>
      <source srcSet={worn.thumb} type="image/webp" />
      <img src={worn.png} alt="" loading="lazy" decoding="async" draggable={false} onError={() => setFailed(true)} />
    </picture>
  );
}

/* ──────────────────────────────────────────────────────────────
   회전 미리보기 — 가방은 등 뒤라서 정면으로는 잘 보이지 않습니다.
   ────────────────────────────────────────────────────────────── */

function TurnaroundView({ view, bag }: { view: TurniView; bag: AvatarItem | null }) {
  const [failed, setFailed] = useState(false);
  // 3/4 후면은 "그 가방 하나를 멘" 완성본이 있으면 그걸 씁니다.
  const worn = view === "three-quarter-rear" && bag ? wornPreview(bag) : null;
  if (worn && !failed) {
    return (
      <picture className="turini-dress__turn">
        <source srcSet={worn.webp} type="image/webp" />
        <img src={worn.png} alt="" decoding="async" draggable={false} onError={() => setFailed(true)} />
      </picture>
    );
  }
  return (
    <span className="turini-dress__turn">
      <picture>
        <source srcSet={TURNAROUND_WEBP[view]} type="image/webp" />
        <img src={TURNAROUND[view]} alt="" decoding="async" draggable={false} />
      </picture>
      {bag && view === "back" ? (
        <span className="turini-dress__turn-bag">
          <ItemImage item={bag} eager />
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
  const bag = findItem(customization.bag);

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
        {view === "front" ? (
          <TuriniAvatar
            customization={customization}
            className="turini-avatar--editor"
            label="꾸미는 중인 나의 투리니"
            scene
          />
        ) : (
          <div className="turini-avatar turini-avatar--editor turini-avatar--turn">
            <TurnaroundView view={view} bag={bag} />
          </div>
        )}

        <div className="turini-dress__views" role="group" aria-label="보는 방향">
          {(["front", "three-quarter-rear", "back"] as TurniView[]).map((entry) => (
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
        {view !== "front" ? (
          <p className="turini-dress__view-note">
            {view === "three-quarter-rear" && bag
              ? "가방만 따로 보는 각도예요. 모자·안경까지 함께 입은 모습은 정면에서 볼 수 있어요."
              : "등이 보이는 각도예요. 전체 모습은 정면에서 볼 수 있어요."}
          </p>
        ) : null}
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
            onClick={() => {
              setSlot(key);
              // 가방은 등 뒤라 정면으로는 잘 보이지 않습니다. 탭을 열면 각도를 돌려 줍니다.
              setView(key === "bag" ? "three-quarter-rear" : "front");
            }}
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
