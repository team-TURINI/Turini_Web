/**
 * 나만의 투리니 꾸미기 — 아이템 목록, 배치 기준, 해제 조건
 *
 * 화면과 분리된 순수 계산 모듈입니다. 상태가 없고, 해제 여부는 이미 저장 중인
 * 학습 기록(XP·레벨·연속 학습·카테고리 진도)에서 그때그때 계산합니다.
 * 해제 목록을 따로 저장하지 않으므로 기록이 어긋날 일이 없습니다.
 *
 * 이미지는 전달받은 자산팩(`public/assets/turini/`)을 그대로 씁니다.
 */

export type AvatarSlot = "hat" | "glasses" | "neck" | "bag" | "background";

/** 자산팩 폴더 이름 */
const FOLDER: Record<AvatarSlot, string> = {
  hat: "customization/hats",
  glasses: "customization/glasses",
  neck: "customization/neck",
  bag: "customization/bags",
  background: "backgrounds",
};

export const ASSET_ROOT = "/assets/turini";

/** 원본 이미지 경로 (전달받은 그대로) */
export function assetPath(slot: AvatarSlot, file: string) {
  return `${ASSET_ROOT}/${FOLDER[slot]}/${file}.png`;
}

/** 가볍게 줄인 webp 경로. 원본은 그대로 두고 화면에서만 먼저 씁니다. */
export function assetPathWebp(slot: AvatarSlot, file: string) {
  return `${ASSET_ROOT}/optimized/${FOLDER[slot]}/${file}.webp`;
}

/**
 * 가방이 없는 기본 캐릭터.
 * 이 파일이 있으면 그대로 쓰고, 없으면 기존 스프라이트로 자동 대체합니다.
 * (자산팩이 잘려 들어와 아직 없는 상태 — 파일만 넣으면 코드 수정 없이 적용됩니다)
 */
export const BASE_NO_BACKPACK = `${ASSET_ROOT}/character/base/turini-base-no-backpack.png`;

/**
 * 착용 완성본 — 캐릭터가 그 아이템 하나를 실제로 착용한 상태로 다시 렌더링한 그림입니다.
 * **목록 썸네일과 "이 아이템 하나만" 미리보기에만** 씁니다.
 * 여러 장을 겹쳐 조합하면 조명·각도가 어긋나므로 절대 겹치지 않습니다.
 * 여러 아이템을 함께 입은 모습은 리그(TuriniRig)로 합성합니다.
 */
const WORN_FOLDER: Record<string, string> = {
  hat: "hats",
  glasses: "glasses",
  neck: "neck",
  bag: "bags",
};

export function wornPreview(item: { slot: AvatarSlot; file: string }) {
  const folder = WORN_FOLDER[item.slot];
  if (!folder) return null;
  return {
    webp: `${ASSET_ROOT}/optimized/worn/${folder}/${item.file}-worn.webp`,
    thumb: `${ASSET_ROOT}/optimized/worn-thumb/${folder}/${item.file}-worn.webp`,
    png: `${ASSET_ROOT}/worn/${folder}/${item.file}-worn.png`,
  };
}

/** 회전 미리보기용 기본 캐릭터 3종 */
export type TurniView = "front" | "three-quarter-rear" | "back";
export const TURNAROUND: Record<TurniView, string> = {
  front: `${ASSET_ROOT}/turnaround/turini-front.png`,
  "three-quarter-rear": `${ASSET_ROOT}/turnaround/turini-three-quarter-rear.png`,
  back: `${ASSET_ROOT}/turnaround/turini-back.png`,
};
export const TURNAROUND_WEBP: Record<TurniView, string> = {
  front: `${ASSET_ROOT}/optimized/turnaround/turini-front.webp`,
  "three-quarter-rear": `${ASSET_ROOT}/optimized/turnaround/turini-three-quarter-rear.webp`,
  back: `${ASSET_ROOT}/optimized/turnaround/turini-back.webp`,
};
export const VIEW_LABEL: Record<TurniView, string> = {
  front: "정면",
  "three-quarter-rear": "뒤쪽 3/4",
  back: "뒷면",
};

export const AVATAR_SLOTS: { key: AvatarSlot; name: string }[] = [
  { key: "hat", name: "모자" },
  { key: "glasses", name: "안경" },
  { key: "neck", name: "목 액세서리" },
  { key: "bag", name: "가방" },
  { key: "background", name: "배경" },
];

/**
 * 아이템마다 그림이 512×512 칸 안에서 차지하는 자리(투명 여백 제외)입니다.
 * [왼쪽, 위, 오른쪽, 아래] — 칸 크기에 대한 비율이고, 실제 PNG 를 재서 넣었습니다.
 *
 * 칸 여백이 아이템마다 다르기 때문에, 칸을 그대로 얹으면 어떤 안경은 눈에,
 * 어떤 안경은 입에 걸립니다. 그래서 칸이 아니라 **그림 자체**를 기준점에 맞춥니다.
 */
export const CONTENT_BOX: Record<string, [number, number, number, number]> = {
  "hat:chef_hat": [0.1016, 0.1406, 0.8789, 0.7363],
  "hat:explorer_hat": [0.1289, 0.3398, 0.873, 0.7871],
  "hat:gold_crown": [0.1172, 0.2793, 0.8145, 0.7363],
  "hat:graduation_cap": [0.1016, 0.25, 0.8965, 0.7402],
  "hat:green_cap": [0.1895, 0.3145, 0.8691, 0.8457],
  "hat:red_beanie": [0.1445, 0.1641, 0.8633, 0.793],
  "hat:straw_hat": [0.125, 0.3301, 0.8965, 0.7402],
  "hat:wizard_hat": [0.127, 0.1602, 0.873, 0.7266],
  "hat:yellow_bucket": [0.1172, 0.3398, 0.877, 0.8262],
  "glasses:black_square": [0.1426, 0.4707, 0.8594, 0.7617],
  "glasses:blue_sport": [0.1426, 0.373, 0.8691, 0.6582],
  "glasses:gold_round": [0.1211, 0.4414, 0.875, 0.7676],
  "glasses:green_round": [0.1406, 0.4414, 0.8965, 0.7812],
  "glasses:heart_sunglasses": [0.127, 0.3594, 0.8809, 0.6777],
  "glasses:monocle": [0.2891, 0.127, 0.8965, 0.6719],
  "glasses:red_reading": [0.1426, 0.2793, 0.8965, 0.5547],
  "glasses:safety_goggles": [0.1133, 0.252, 0.875, 0.5898],
  "glasses:star_glasses": [0.1309, 0.3184, 0.8574, 0.6875],
  "neck:blue_scarf": [0.1543, 0.2305, 0.8457, 0.873],
  "neck:camera": [0.2246, 0.0801, 0.8438, 0.7422],
  "neck:flower_lei": [0.123, 0.1172, 0.8789, 0.791],
  "neck:gold_medal": [0.1914, 0.1289, 0.8008, 0.7539],
  "neck:green_bow": [0.1855, 0.3145, 0.8887, 0.6953],
  "neck:pearl_necklace": [0.1016, 0.1523, 0.8398, 0.918],
  "neck:red_tie": [0.2637, 0.1562, 0.7695, 0.8848],
  "neck:white_green_collar": [0.1523, 0.1582, 0.8438, 0.7129],
  "neck:yellow_bandana": [0.1855, 0.1523, 0.8965, 0.918],
  "bag:black_business": [0.1016, 0.0898, 0.8926, 0.8164],
  "bag:green_original": [0.1348, 0.1172, 0.8789, 0.8711],
  "bag:mint_bubble": [0.1484, 0.125, 0.8984, 0.8594],
  "bag:navy_school": [0.1406, 0.1172, 0.8691, 0.8691],
  "bag:pink_heart": [0.1465, 0.1289, 0.877, 0.8555],
  "bag:purple_star": [0.1152, 0.1367, 0.8789, 0.918],
  "bag:red_hiking": [0.1348, 0.0996, 0.8809, 0.918],
  "bag:tan_explorer": [0.1582, 0.1094, 0.8984, 0.9082],
  "bag:yellow_giraffe": [0.1113, 0.1426, 0.8828, 0.875],
  "background:finance_city": [0, 0, 1, 1],
  "background:forest_class": [0, 0, 1, 1],
  "background:goal_room_night": [0, 0, 1, 1],
  "background:study_room_day": [0, 0, 1, 1],
};

/** 기본 그림 — 칸 여백을 알 수 없는 아이템이 들어왔을 때 쓰는 평균값 */
const FALLBACK_BOX: [number, number, number, number] = [0.13, 0.22, 0.87, 0.8];

export function contentBox(id: string): [number, number, number, number] {
  return CONTENT_BOX[id] ?? FALLBACK_BOX;
}

/**
 * 슬롯마다 "그림의 어느 지점"을 "캐릭터의 어느 지점"에 맞출지 정합니다.
 * 좌표는 **리그 캔버스(1200×1200)** 대비 % 입니다. 리그 파츠와 액세서리가
 * 같은 좌표계를 쓰므로, 고개가 기울면 모자·안경·목장식이 함께 기울어집니다.
 *
 * 값은 리그를 합성해 눈·코·입·귀·목·어깨 픽셀 위치를 직접 재서 잡았습니다.
 * (눈 426–767 / 393–529, 입 545–647 / 523–554, 목 시작 y≈622, 어깨 y≈700)
 *
 * - x, y   : 캐릭터 쪽 기준점
 * - gx, gy : 그림에서 그 기준점에 닿을 지점 (0=왼쪽/위, 1=오른쪽/아래)
 * - span   : 그림이 차지할 크기(%). fit 이 "width" 면 가로, "max" 면 긴 쪽 기준
 * - spanY  : 세로 최대치(%). 세로로 큰 그림이 얼굴을 덮지 않도록 제한합니다
 */
export type SlotAnchor = {
  x: number;
  y: number;
  gx: number;
  gy: number;
  span: number;
  fit: "width" | "max";
  spanY?: number;
};

/**
 * 12프레임 스프라이트(아틀라스) 위에 붙일 때 쓰는 기준점입니다.
 * 좌표는 **아틀라스 한 칸(256px) 대비 %** 이고, idle 0번 프레임의 그림에서
 * 이마 선·두 눈·목 시작점을 직접 재서 잡았습니다.
 *
 * 리그 그림과 아틀라스 그림은 머리·몸 비율이 서로 조금 달라서, 같은 기준점을
 * 그대로 쓰면 모자가 눈까지 내려옵니다. 그래서 표를 따로 둡니다.
 * 가방은 몸통에 붙는 물건이라 머리 추적만으로는 자리를 잡을 수 없어 제외합니다.
 */
export const SPRITE_ANCHOR: Record<"hat" | "glasses" | "neck", SlotAnchor> = {
  hat: { x: 50.2, y: 29.8, gx: 0.5, gy: 1, span: 37, fit: "width" },
  glasses: { x: 50.2, y: 37.9, gx: 0.5, gy: 0.5, span: 30, fit: "width", spanY: 13 },
  neck: { x: 50.2, y: 56, gx: 0.5, gy: 0, span: 34, fit: "width", spanY: 32 },
};

/** 스프라이트 위에서 액세서리가 붙는 슬롯 */
export const SPRITE_SLOTS = ["neck", "glasses", "hat"] as const;
export type SpriteSlot = (typeof SPRITE_SLOTS)[number];

export const SLOT_ANCHOR: Record<AvatarSlot, SlotAnchor> = {
  // 이마 선(눈 위)에 모자 아래쪽 가운데를 맞춥니다.
  hat: { x: 49.7, y: 32.1, gx: 0.5, gy: 1, span: 39.2, fit: "width" },
  // 두 눈 한가운데에 안경 한가운데를 맞추고, 세로는 12% 로 묶어 입을 덮지 않게 합니다.
  glasses: { x: 49.7, y: 37.55, gx: 0.5, gy: 0.5, span: 28, fit: "width", spanY: 12 },
  // 목이 시작하는 곳에 목장식 위쪽 가운데를 맞춥니다. 넥타이가 무릎까지 내려오지 않게 세로 제한.
  neck: { x: 49.7, y: 51.8, gx: 0.5, gy: 0, span: 29.2, fit: "width", spanY: 30 },
  // 등 뒤 — 몸통 레이어보다 아래에 그리므로 절대 몸 앞으로 나오지 않습니다.
  bag: { x: 49.8, y: 62, gx: 0.5, gy: 0.5, span: 36, fit: "max" },
  background: { x: 50, y: 50, gx: 0.5, gy: 0.5, span: 100, fit: "width" },
};

/** 가방 어깨끈 색 — 각 가방 그림에서 가장 많이 쓰인 색을 재서 넣었습니다. */
export const BAG_STRAP_COLOR: Record<string, string> = {
  "bag:black_business": "#1f1f1f",
  "bag:green_original": "#378f26",
  "bag:mint_bubble": "#74c6b2",
  "bag:navy_school": "#1c3164",
  "bag:pink_heart": "#f9a3c2",
  "bag:purple_star": "#7835c5",
  "bag:red_hiking": "#bc1f1b",
  "bag:tan_explorer": "#dbae76",
  "bag:yellow_giraffe": "#fcd82f",
};

export function bagStrapColor(id: string | null | undefined) {
  return (id && BAG_STRAP_COLOR[id]) || "#8a8f8c";
}

export type Placement = { left: number; top: number; size: number };

/**
 * 아이템 한 개의 실제 배치를 구합니다.
 * 그림 자체를 기준점에 맞추므로, 칸 여백이 서로 다른 아이템도 같은 자리에 옵니다.
 */
export function placementFor(
  item: { id: string; slot: AvatarSlot },
  /** "rig" = 분리 파츠 캐릭터, "sprite" = 12프레임 아틀라스 */
  space: "rig" | "sprite" = "rig",
): Placement {
  if (item.slot === "background") return { left: 0, top: 0, size: 100 };
  const anchor =
    space === "sprite" && item.slot in SPRITE_ANCHOR
      ? SPRITE_ANCHOR[item.slot as SpriteSlot]
      : SLOT_ANCHOR[item.slot];

  const [x0, y0, x1, y1] = contentBox(item.id);
  const boxWidth = Math.max(0.01, x1 - x0);
  const boxHeight = Math.max(0.01, y1 - y0);
  const basis = anchor.fit === "width" ? boxWidth : Math.max(boxWidth, boxHeight);
  // 세로 제한이 있으면 둘 중 작은 쪽을 따라갑니다 — 그래야 얼굴을 덮지 않습니다.
  const size = anchor.spanY
    ? Math.min(anchor.span / basis, anchor.spanY / boxHeight)
    : anchor.span / basis;

  return {
    left: anchor.x - (x0 + anchor.gx * boxWidth) * size,
    top: anchor.y - (y0 + anchor.gy * boxHeight) * size,
    size,
  };
}

/** 겹치는 순서. 숫자가 클수록 위에 옵니다. */
export const LAYER_ORDER: Record<AvatarSlot | "base", number> = {
  background: 0,
  bag: 1,
  base: 2,
  neck: 3,
  glasses: 4,
  hat: 5,
};

export type AvatarRequirement =
  | { kind: "always" }
  | { kind: "xp"; value: number }
  | { kind: "level"; value: number }
  | { kind: "streak"; value: number }
  | { kind: "solved"; value: number }
  | { kind: "category"; category: string; lessons: number }
  | { kind: "everyCategory"; lessons: number };

export type AvatarItem = {
  id: string;
  slot: AvatarSlot;
  /** 자산팩 파일 이름 (확장자 제외) */
  file: string;
  name: string;
  requirement: AvatarRequirement;
};

/** 해제 판정에 쓰는 학습 기록. 전부 이미 저장 중인 값에서 계산합니다. */
export type AvatarStats = {
  xp: number;
  level: number;
  streak: number;
  solved: number;
  categoryLessons: Record<string, number>;
};

function item(
  slot: AvatarSlot,
  file: string,
  name: string,
  requirement: AvatarRequirement,
): AvatarItem {
  return { id: `${slot}:${file}`, slot, file, name, requirement };
}

export const AVATAR_ITEMS: AvatarItem[] = [
  // ── 모자 9 ──────────────────────────────────────────────
  item("hat", "green_cap", "초록 캡", { kind: "always" }),
  item("hat", "yellow_bucket", "노랑 버킷햇", { kind: "always" }),
  item("hat", "red_beanie", "빨강 비니", { kind: "xp", value: 200 }),
  item("hat", "straw_hat", "밀짚모자", { kind: "xp", value: 500 }),
  item("hat", "explorer_hat", "탐험가 모자", { kind: "streak", value: 5 }),
  item("hat", "chef_hat", "요리사 모자", { kind: "solved", value: 80 }),
  item("hat", "graduation_cap", "졸업 모자", { kind: "category", category: "주식", lessons: 12 }),
  item("hat", "wizard_hat", "마법사 모자", { kind: "level", value: 8 }),
  item("hat", "gold_crown", "황금 왕관", { kind: "everyCategory", lessons: 6 }),

  // ── 안경 9 ──────────────────────────────────────────────
  item("glasses", "green_round", "초록 동그란 안경", { kind: "always" }),
  item("glasses", "black_square", "검정 사각 안경", { kind: "always" }),
  item("glasses", "red_reading", "빨강 독서 안경", { kind: "solved", value: 40 }),
  item("glasses", "blue_sport", "파랑 스포츠 고글", { kind: "xp", value: 400 }),
  item("glasses", "star_glasses", "별 안경", { kind: "streak", value: 3 }),
  item("glasses", "heart_sunglasses", "하트 선글라스", { kind: "xp", value: 900 }),
  item("glasses", "safety_goggles", "안전 고글", { kind: "category", category: "위험 관리", lessons: 6 }),
  item("glasses", "gold_round", "금테 안경", { kind: "level", value: 6 }),
  item("glasses", "monocle", "모노클", { kind: "everyCategory", lessons: 4 }),

  // ── 목 액세서리 9 ───────────────────────────────────────
  item("neck", "green_bow", "초록 나비넥타이", { kind: "always" }),
  item("neck", "blue_scarf", "파랑 목도리", { kind: "always" }),
  item("neck", "yellow_bandana", "노랑 반다나", { kind: "xp", value: 300 }),
  item("neck", "red_tie", "빨강 넥타이", { kind: "xp", value: 700 }),
  item("neck", "white_green_collar", "교복 칼라", { kind: "solved", value: 120 }),
  item("neck", "flower_lei", "꽃 목걸이", { kind: "streak", value: 10 }),
  item("neck", "camera", "목걸이 카메라", { kind: "category", category: "분산 투자", lessons: 6 }),
  item("neck", "pearl_necklace", "진주 목걸이", { kind: "level", value: 7 }),
  item("neck", "gold_medal", "금메달", { kind: "everyCategory", lessons: 8 }),

  // ── 가방 9 ──────────────────────────────────────────────
  item("bag", "green_original", "기본 초록 가방", { kind: "always" }),
  item("bag", "navy_school", "남색 책가방", { kind: "always" }),
  item("bag", "yellow_giraffe", "기린 가방", { kind: "xp", value: 250 }),
  item("bag", "red_hiking", "빨강 등산가방", { kind: "solved", value: 100 }),
  item("bag", "pink_heart", "하트 가방", { kind: "streak", value: 7 }),
  item("bag", "mint_bubble", "민트 버블백", { kind: "xp", value: 1200 }),
  item("bag", "purple_star", "별 가방", { kind: "level", value: 5 }),
  item("bag", "tan_explorer", "탐험가 배낭", { kind: "category", category: "펀드/ETF", lessons: 8 }),
  item("bag", "black_business", "비즈니스 백", { kind: "everyCategory", lessons: 10 }),

  // ── 배경 4 ──────────────────────────────────────────────
  item("background", "study_room_day", "낮 공부방", { kind: "always" }),
  item("background", "forest_class", "숲속 교실", { kind: "level", value: 3 }),
  item("background", "finance_city", "금융 도시", { kind: "solved", value: 200 }),
  item("background", "goal_room_night", "밤 목표방", { kind: "everyCategory", lessons: 6 }),
];

export function itemsForSlot(slot: AvatarSlot) {
  return AVATAR_ITEMS.filter((entry) => entry.slot === slot);
}

export function findItem(id: string | null | undefined) {
  if (!id) return null;
  return AVATAR_ITEMS.find((entry) => entry.id === id) ?? null;
}

/** 조건 달성 정도 — 화면에 '3/7일' 처럼 보여 주려고 씁니다. */
export function requirementProgress(requirement: AvatarRequirement, stats: AvatarStats) {
  switch (requirement.kind) {
    case "always":
      return { current: 1, target: 1 };
    case "xp":
      return { current: stats.xp, target: requirement.value };
    case "level":
      return { current: stats.level, target: requirement.value };
    case "streak":
      return { current: stats.streak, target: requirement.value };
    case "solved":
      return { current: stats.solved, target: requirement.value };
    case "category":
      return {
        current: stats.categoryLessons[requirement.category] ?? 0,
        target: requirement.lessons,
      };
    case "everyCategory": {
      const values = Object.values(stats.categoryLessons);
      const reached = values.filter((lessons) => lessons >= requirement.lessons).length;
      return { current: reached, target: Math.max(1, values.length) };
    }
  }
}

export function isItemUnlocked(entry: AvatarItem, stats: AvatarStats) {
  const { current, target } = requirementProgress(entry.requirement, stats);
  return current >= target;
}

export function requirementLabel(requirement: AvatarRequirement) {
  switch (requirement.kind) {
    case "always":
      return "처음부터 사용 가능";
    case "xp":
      return `XP ${requirement.value} 모으기`;
    case "level":
      return `Lv.${requirement.value} 달성`;
    case "streak":
      return `연속 학습 ${requirement.value}일`;
    case "solved":
      return `문제 ${requirement.value}개 풀기`;
    case "category":
      return `${requirement.category} ${requirement.lessons}레슨 완료`;
    case "everyCategory":
      return `모든 카테고리 ${requirement.lessons}레슨 완료`;
  }
}

/** 잠금 카드에 보여 줄 '얼마나 남았는지' 한 줄 */
export function remainingLabel(requirement: AvatarRequirement, stats: AvatarStats) {
  const { current, target } = requirementProgress(requirement, stats);
  const left = Math.max(0, target - current);
  switch (requirement.kind) {
    case "xp":
      return `XP ${left} 더 필요`;
    case "level":
      return `${left}레벨 더 필요`;
    case "streak":
      return `${left}일 더 필요`;
    case "solved":
      return `${left}문제 더 필요`;
    case "category":
      return `${left}레슨 더 필요`;
    case "everyCategory":
      return `${left}개 카테고리 남음`;
    default:
      return "";
  }
}

/** 저장되는 꾸미기 상태. 값은 아이템 id 이고, 비워 두면 null 입니다. */
export type TuriniCustomization = {
  hat: string | null;
  glasses: string | null;
  neck: string | null;
  bag: string | null;
  background: string | null;
};

export const DEFAULT_CUSTOMIZATION: TuriniCustomization = {
  hat: null,
  glasses: null,
  neck: null,
  bag: null,
  background: "background:study_room_day",
};

/**
 * 저장된 값을 안전한 모양으로 맞춥니다.
 * 모르는 id, 슬롯이 다른 id, 아직 해제되지 않은 id 는 비웁니다.
 * (손상된 저장 데이터나 목록에서 사라진 아이템이 들어와도 화면이 깨지지 않습니다)
 */
export function normalizeCustomization(value: unknown, stats?: AvatarStats): TuriniCustomization {
  const source = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  const next: TuriniCustomization = { ...DEFAULT_CUSTOMIZATION };
  for (const { key } of AVATAR_SLOTS) {
    const raw = source[key];
    if (raw === null) {
      next[key] = null;
      continue;
    }
    if (typeof raw !== "string") continue;
    const entry = findItem(raw);
    if (!entry || entry.slot !== key) continue;
    if (stats && !isItemUnlocked(entry, stats)) continue;
    next[key] = entry.id;
  }
  return next;
}

export function avatarStatsFrom(input: {
  xp: number;
  level: number;
  streak: number;
  solved: number;
  categoryLessons: Record<string, number>;
}): AvatarStats {
  // 잘못 저장된 값(음수, 전체보다 큰 완료 수 등)이 들어와도 계산이 깨지지 않게 다듬습니다.
  const safe = (value: number, min: number) =>
    Number.isFinite(value) ? Math.max(min, Math.floor(value)) : min;
  const lessons: Record<string, number> = {};
  for (const [name, value] of Object.entries(input.categoryLessons || {})) {
    lessons[name] = Math.min(12, safe(value, 0));
  }
  return {
    xp: safe(input.xp, 0),
    level: safe(input.level, 1),
    streak: safe(input.streak, 0),
    solved: safe(input.solved, 0),
    categoryLessons: lessons,
  };
}

export function unlockedCount(stats: AvatarStats) {
  return AVATAR_ITEMS.filter((entry) => isItemUnlocked(entry, stats)).length;
}
