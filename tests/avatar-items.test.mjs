import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import test from "node:test";

import {
  AVATAR_ITEMS,
  AVATAR_SLOTS,
  CONTENT_BOX,
  DEFAULT_CUSTOMIZATION,
  LAYER_ORDER,
  SLOT_ANCHOR,
  assetPath,
  avatarStatsFrom,
  bagStrapColor,
  findItem,
  isItemUnlocked,
  itemsForSlot,
  normalizeCustomization,
  placementFor,
  SPRITE_ANCHOR,
  remainingLabel,
  requirementLabel,
  requirementProgress,
  wornPreview,
} from "../app/avatar-items.ts";

const pageSource = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
const avatarSource = await readFile(new URL("../app/turini-avatar.tsx", import.meta.url), "utf8");
const rigSource = await readFile(new URL("../app/turini-rig.tsx", import.meta.url), "utf8");
const rigStyle = await readFile(new URL("../app/turini-rig.css", import.meta.url), "utf8");
const spriteSource = await readFile(new URL("../app/turini-sprite.tsx", import.meta.url), "utf8");
const spriteStyle = await readFile(new URL("../app/turini-sprite.css", import.meta.url), "utf8");

const publicPath = (url) => new URL(`../public${url}`, import.meta.url);

const emptyStats = avatarStatsFrom({ xp: 0, level: 1, streak: 0, solved: 0, categoryLessons: {} });
const fullStats = avatarStatsFrom({
  xp: 5000,
  level: 12,
  streak: 40,
  solved: 720,
  categoryLessons: {
    주식: 12, 채권: 12, "펀드/ETF": 12, "위험 관리": 12, "분산 투자": 12, "수익률 계산": 12,
  },
});

/* ── 슬롯 ─────────────────────────────────────────────── */

test("영구 꾸미기 슬롯은 다섯 개이고 손소품은 없다", () => {
  assert.deepEqual(
    AVATAR_SLOTS.map((slot) => slot.key),
    ["hat", "glasses", "neck", "bag", "background"],
  );
  assert.ok(!AVATAR_SLOTS.some((slot) => slot.key === "handProp"));
  assert.ok(!AVATAR_ITEMS.some((item) => item.slot === "handProp"));
  assert.ok(!("handProp" in DEFAULT_CUSTOMIZATION));
  for (const { key } of AVATAR_SLOTS) {
    assert.ok(itemsForSlot(key).length > 0, `${key} 슬롯에 아이템이 없습니다`);
  }
  const ids = AVATAR_ITEMS.map((item) => item.id);
  assert.equal(new Set(ids).size, ids.length, "아이템 id 가 중복됩니다");
});

test("옛 저장값에 손소품이 남아 있어도 오류 없이 무시한다", () => {
  const legacy = {
    hat: "hat:green_cap",
    glasses: null,
    neck: null,
    bag: null,
    handProp: "handProp:gold_coin",
    scene: "scene-night",
    background: "background:study_room_day",
  };
  const safe = normalizeCustomization(legacy, fullStats);
  assert.equal(safe.hat, "hat:green_cap");
  assert.ok(!("handProp" in safe));
  assert.ok(!("scene" in safe));
  assert.equal(safe.background, "background:study_room_day");
});

test("저장값이 깨져도 기본값으로 안전하게 되돌린다", () => {
  const dirty = { hat: "hat:wizard_hat", glasses: "없는-아이템", neck: 42, bag: "hat:green_cap" };
  const safe = normalizeCustomization(dirty, emptyStats);
  assert.equal(safe.hat, null, "아직 잠긴 모자가 들어왔습니다");
  assert.equal(safe.glasses, null);
  assert.equal(safe.neck, null);
  assert.equal(safe.bag, null, "슬롯이 다른 아이템이 들어왔습니다");
  assert.equal(safe.background, DEFAULT_CUSTOMIZATION.background);
  assert.deepEqual(normalizeCustomization(undefined), DEFAULT_CUSTOMIZATION);
  assert.deepEqual(normalizeCustomization(null), DEFAULT_CUSTOMIZATION);
  assert.deepEqual(normalizeCustomization("이상한 값"), DEFAULT_CUSTOMIZATION);
});

/* ── 해제 조건 ─────────────────────────────────────────── */

test("모든 슬롯에 처음부터 쓸 수 있는 아이템이 있다", () => {
  for (const { key } of AVATAR_SLOTS) {
    const free = itemsForSlot(key).filter((item) => isItemUnlocked(item, emptyStats));
    assert.ok(free.length >= 1, `${key} 슬롯에 기본 해제 아이템이 없습니다`);
  }
});

test("해제 조건은 학습 기록에서만 계산한다", () => {
  const locked = AVATAR_ITEMS.filter((item) => !isItemUnlocked(item, emptyStats));
  assert.ok(locked.length > 0, "잠긴 아이템이 하나도 없습니다");
  for (const item of locked) {
    assert.ok(isItemUnlocked(item, fullStats), `${item.id} 은 끝까지 학습해도 열리지 않습니다`);
  }
  const xpItem = AVATAR_ITEMS.find((item) => item.requirement.kind === "xp");
  const need = xpItem.requirement.value;
  const just = avatarStatsFrom({ xp: need, level: 1, streak: 0, solved: 0, categoryLessons: {} });
  const short = avatarStatsFrom({ xp: need - 1, level: 1, streak: 0, solved: 0, categoryLessons: {} });
  assert.equal(isItemUnlocked(xpItem, just), true);
  assert.equal(isItemUnlocked(xpItem, short), false);
});

test("해제 진행도와 안내 문구가 조건과 맞는다", () => {
  for (const item of AVATAR_ITEMS) {
    const { current, target } = requirementProgress(item.requirement, emptyStats);
    assert.ok(Number.isFinite(current) && Number.isFinite(target));
    assert.ok(target >= 1);
    assert.ok(requirementLabel(item.requirement).length > 0);
    if (item.requirement.kind !== "always") {
      assert.ok(remainingLabel(item.requirement, emptyStats).length > 0);
    }
  }
});

test("기본 착용은 처음부터 열려 있는 아이템만 쓴다", () => {
  for (const { key } of AVATAR_SLOTS) {
    const id = DEFAULT_CUSTOMIZATION[key];
    if (id === null) continue;
    const item = findItem(id);
    assert.ok(item, `${id} 를 찾을 수 없습니다`);
    assert.equal(item.slot, key);
    assert.equal(isItemUnlocked(item, emptyStats), true);
  }
});

/* ── 그림 파일 ─────────────────────────────────────────── */

test("모든 아이템의 그림 파일이 실제로 있다", () => {
  for (const item of AVATAR_ITEMS) {
    assert.ok(existsSync(publicPath(assetPath(item.slot, item.file))), `${item.id} 그림 없음`);
  }
});

test("착용 완성본은 목록·단일 미리보기에만 쓰고 겹쳐 조합하지 않는다", () => {
  for (const item of AVATAR_ITEMS) {
    const worn = wornPreview(item);
    if (item.slot === "background") {
      assert.equal(worn, null);
      continue;
    }
    assert.ok(existsSync(publicPath(worn.png)), `${item.id} 착용 완성본 없음`);
  }
  // 완성본을 여러 장 겹치는 코드가 없어야 합니다.
  assert.doesNotMatch(rigSource, /wornPreview/);
  // 여러 아이템을 함께 입은 모습은 리그로만 만듭니다.
  assert.match(avatarSource, /TuriniRig/);
});

/* ── 배치 (리그 앵커) ──────────────────────────────────── */

test("액세서리는 머리 그룹 안에 있어 고개 움직임을 따라간다", () => {
  // 모자·안경·목장식은 머리 레이어와 같은 묶음 안에서 그립니다.
  assert.match(rigSource, /turini-rig__head/);
  assert.match(rigSource, /headPieces\.map/);
  // 가방 본체는 몸통보다 아래 층입니다 → 몸 앞으로 나올 수 없습니다.
  assert.ok(LAYER_ORDER.bag < LAYER_ORDER.base);
  assert.match(rigStyle, /\.turini-rig__bag\s*\{[^}]*z-index: 1/s);
  assert.match(rigStyle, /\.turini-rig__body\s*\{[^}]*z-index: 2/s);
  // 어깨끈은 몸통 위·팔 아래
  assert.match(rigStyle, /\.turini-rig__straps\s*\{[^}]*z-index: 3/s);
  assert.match(rigStyle, /\.turini-rig__arm\s*\{[^}]*z-index: 4/s);
  // 관절 좌표는 rig.json 값을 그대로 씁니다.
  assert.match(rigSource, /transformOrigin/);
});

test("아이템은 칸이 아니라 그림 자체를 기준점에 맞춘다", () => {
  for (const item of AVATAR_ITEMS) {
    if (item.slot === "background") continue;
    assert.ok(CONTENT_BOX[item.id], `${item.id} 그림 범위 정보 없음`);
  }
  // 칸 여백이 서로 다른 두 모자도 같은 자리에 옵니다.
  const hats = itemsForSlot("hat").map((item) => ({ item, place: placementFor(item) }));
  const bottoms = hats.map(({ item, place }) => {
    const [, , , y1] = CONTENT_BOX[item.id];
    return Math.round((place.top + y1 * place.size) * 100) / 100;
  });
  const spread = Math.max(...bottoms) - Math.min(...bottoms);
  assert.ok(spread < 0.2, `모자 아랫선이 ${spread}%p 나 어긋납니다`);

  const widths = hats.map(({ item, place }) => {
    const [x0, , x1] = CONTENT_BOX[item.id];
    return Math.round((x1 - x0) * place.size * 100) / 100;
  });
  assert.ok(Math.max(...widths) - Math.min(...widths) < 0.2, "모자 너비가 제각각입니다");
});

test("어떤 아이템도 무대 밖으로 나가지 않는다", () => {
  // 리그 캔버스는 무대 안쪽 3% 여백에 들어 있습니다.
  const toStage = (value) => 4 + 0.92 * (3 + 0.94 * value);
  for (const item of AVATAR_ITEMS) {
    if (item.slot === "background") continue;
    const place = placementFor(item);
    const [x0, y0, x1, y1] = CONTENT_BOX[item.id];
    const left = toStage(place.left + x0 * place.size);
    const right = toStage(place.left + x1 * place.size);
    const top = toStage(place.top + y0 * place.size);
    const bottom = toStage(place.top + y1 * place.size);
    assert.ok(left >= 0 && right <= 100, `${item.id} 가로가 무대를 벗어납니다 (${left}~${right})`);
    assert.ok(top >= 0 && bottom <= 100, `${item.id} 세로가 무대를 벗어납니다 (${top}~${bottom})`);
  }
});

test("안경은 두 눈 위에 오고 어떤 아이템도 입을 덮지 않는다", () => {
  // 리그 캔버스(1200) 기준 실측 좌표
  const EYES = { top: 393 / 1200 * 100, bottom: 529 / 1200 * 100 };
  const MOUTH_TOP = 523 / 1200 * 100;
  for (const item of AVATAR_ITEMS) {
    if (item.slot === "background") continue;
    const place = placementFor(item);
    const [, y0, , y1] = CONTENT_BOX[item.id];
    const top = place.top + y0 * place.size;
    const bottom = place.top + y1 * place.size;
    if (item.slot === "hat") {
      assert.ok(bottom <= EYES.top + 0.5, `${item.id} 가 눈을 덮습니다`);
    }
    if (item.slot === "glasses") {
      assert.ok(top <= EYES.top + 3, `${item.id} 가 눈보다 너무 아래에 있습니다`);
      assert.ok(bottom <= MOUTH_TOP, `${item.id} 가 입까지 내려옵니다`);
    }
    if (item.slot === "neck") {
      assert.ok(top >= MOUTH_TOP, `${item.id} 가 턱 위로 올라옵니다`);
    }
  }
  assert.ok(SLOT_ANCHOR.glasses.spanY, "안경 세로 제한이 없습니다");
});

test("가방마다 어깨끈 색이 정해져 있다", () => {
  for (const item of itemsForSlot("bag")) {
    assert.match(bagStrapColor(item.id), /^#[0-9a-f]{6}$/i, `${item.id} 끈 색 없음`);
  }
  assert.match(bagStrapColor(null), /^#[0-9a-f]{6}$/i);
});

/* ── 저장과 화면 연결 ──────────────────────────────────── */

test("꾸미기 상태는 계정 기록에 저장되고 화면 코드는 localStorage 를 직접 쓰지 않는다", () => {
  assert.match(pageSource, /customization: TuriniCustomization/);
  assert.match(pageSource, /customization: DEFAULT_CUSTOMIZATION/);
  assert.match(pageSource, /normalizeCustomization\(/);
  assert.match(pageSource, /setProgress\(\(current\) => \(\{ \.\.\.current, customization: next \}\)\)/);
  assert.match(pageSource, /fetch\("\/api\/account"/);
  assert.doesNotMatch(pageSource, /localStorage\.setItem/);
  // 브라우저 캐시는 저장소 모듈 한 곳에서만 다룹니다.
  assert.match(pageSource, /saveCustomizationCache\(/);
});

test("앱 전체가 하나의 공통 캐릭터 컴포넌트를 쓴다", () => {
  assert.match(pageSource, /TuriniAvatarProvider/);
  assert.match(avatarSource, /useCustomization/);
  // 화면에서 캐릭터 이미지를 직접 불러오는 곳이 없어야 합니다.
  assert.doesNotMatch(pageSource, /<img[^>]*turini/i);
  assert.doesNotMatch(pageSource, /assets\/turini/);
  const uses = pageSource.match(/<TuriniAvatar/g) || [];
  assert.ok(uses.length >= 12, `공통 컴포넌트 사용처가 ${uses.length}곳뿐입니다`);
});

test("기존 프로필 정보와 계정 기능은 그대로 남아 있다", () => {
  assert.match(pageSource, /progress\.streak/);
  assert.match(pageSource, /progress\.xp/);
  assert.match(pageSource, /Lv\. \{progress\.level\}/);
  assert.match(pageSource, /투리니 배지 컬렉션/);
  assert.match(pageSource, /onClick=\{logout\}/);
  assert.match(pageSource, /계정 초기화/);
  assert.match(pageSource, /아이디와 기록 모두 삭제/);
});

test("결제 기능은 들어 있지 않다", () => {
  for (const source of [avatarSource, rigSource, pageSource]) {
    assert.doesNotMatch(source, /결제|구매하기|price|checkout|payment/i);
  }
});

/* ── 애니메이션 프레임 위의 액세서리 ──────────────────────── */

test("프레임별 머리 기준점 표가 72프레임 모두 들어 있다", async () => {
  const anchors = JSON.parse(
    await readFile(
      new URL("../public/assets/turini/animations/turini-frame-anchors.json", import.meta.url),
      "utf8",
    ),
  );
  assert.equal(anchors.cell, 256);
  assert.equal(anchors.templateCenter.length, 2);
  const motions = ["idle", "thinking", "correct", "wrong", "celebrate", "reading"];
  let total = 0;
  for (const motion of motions) {
    const frames = anchors.frames[motion];
    assert.ok(Array.isArray(frames), `${motion} 표가 없습니다`);
    assert.equal(frames.length, 12, `${motion} 프레임 수가 12가 아닙니다`);
    for (const [cx, cy, scale, rotate] of frames) {
      // 머리는 칸 안에 있어야 하고, 배율·기울기도 상식 범위여야 합니다.
      assert.ok(cx > 40 && cx < 216, `${motion} 가로중심 ${cx} 이 칸을 벗어납니다`);
      assert.ok(cy > 10 && cy < 180, `${motion} 세로중심 ${cy} 이 칸을 벗어납니다`);
      assert.ok(scale > 0.6 && scale < 1.6, `${motion} 배율 ${scale} 이 지나칩니다`);
      assert.ok(Math.abs(rotate) <= 25, `${motion} 기울기 ${rotate} 가 지나칩니다`);
      total += 1;
    }
    // 같은 동작 안에서 머리 크기가 갑자기 튀면 안 됩니다 (프레임 사이 20% 이내)
    for (let i = 0; i < frames.length; i += 1) {
      const a = frames[i][2];
      const b = frames[(i + 1) % frames.length][2];
      assert.ok(Math.abs(a - b) / a < 0.2, `${motion} ${i}→${i + 1} 프레임에서 머리 크기가 튑니다`);
    }
  }
  assert.equal(total, 72);
});

test("스프라이트용 기준점은 리그용과 따로 관리한다", () => {
  // 두 그림의 비율이 달라 같은 값을 쓰면 모자가 눈까지 내려옵니다.
  assert.ok(SPRITE_ANCHOR.hat.span !== SLOT_ANCHOR.hat.span);
  for (const slot of ["hat", "glasses", "neck"]) {
    const anchor = SPRITE_ANCHOR[slot];
    assert.ok(anchor.x > 40 && anchor.x < 60);
    assert.ok(anchor.y > 20 && anchor.y < 70);
    assert.ok(anchor.span > 10 && anchor.span < 60);
  }
  // 같은 아이템이라도 공간에 따라 다른 자리에 놓입니다.
  const cap = findItem("hat:green_cap");
  assert.notDeepEqual(placementFor(cap, "rig"), placementFor(cap, "sprite"));
});

test("정답·오답·읽기 동작에서는 팻말을 가리지 않게 목 액세서리를 뺀다", () => {
  const source = spriteSource;
  assert.match(source, /SLOTS_FOR_MOTION/);
  assert.match(source, /correct: \["glasses", "hat"\]/);
  assert.match(source, /wrong: \["glasses", "hat"\]/);
  assert.match(source, /reading: \["glasses", "hat"\]/);
  // 대기·생각·축하에서는 목 액세서리도 나옵니다.
  assert.match(source, /idle: SPRITE_SLOTS/);
  assert.match(source, /thinking: SPRITE_SLOTS/);
  assert.match(source, /celebrate: SPRITE_SLOTS/);
});

test("액세서리 묶음은 프레임 기준점을 그대로 따라간다", () => {
  // 화면에 따로 고정하지 않고, 표에서 읽은 값으로 옮기고·키우고·기울입니다.
  assert.match(spriteSource, /anchors\?\.frames\?\.\[shownMotion\]\?\.\[shownFrame\]/);
  assert.match(spriteSource, /transformOrigin/);
  assert.match(spriteSource, /rotate\(\$\{rotate\}deg\)/);
  assert.match(spriteStyle, /\.turini-sprite__head/);
});
