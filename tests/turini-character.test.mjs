import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const componentSource = await readFile(new URL("../app/turini-character.tsx", import.meta.url), "utf8");
const styleSource = await readFile(new URL("../app/turini-character.css", import.meta.url), "utf8");
const layoutSource = await readFile(new URL("../app/layout.tsx", import.meta.url), "utf8");
const pageSource = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
const atlasMeta = JSON.parse(
  await readFile(new URL("../public/assets/turini-atlas-v2.json", import.meta.url), "utf8"),
);

test("캐릭터 아틀라스는 4칸 6줄 정사각형 격자다", () => {
  assert.equal(atlasMeta.grid.columns, 4);
  assert.equal(atlasMeta.grid.rows, 6);
  assert.equal(atlasMeta.frame.width, atlasMeta.frame.height);
  assert.equal(atlasMeta.canvas.width, atlasMeta.frame.width * atlasMeta.grid.columns);
  assert.equal(atlasMeta.canvas.height, atlasMeta.frame.height * atlasMeta.grid.rows);
});

test("여섯 가지 상태가 아틀라스 줄에 그대로 연결된다", () => {
  assert.deepEqual(atlasMeta.rows, {
    idle: 0,
    thinking: 1,
    correct: 2,
    wrong: 3,
    celebrate: 4,
    reading: 5,
  });
  for (const [state, row] of Object.entries(atlasMeta.rows)) {
    assert.match(componentSource, new RegExp(`${state}:\\s*${row}`));
  }
});

test("정답은 체크 팻말 줄, 오답은 X 팻말 줄을 쓰고 다른 캐릭터로 바뀌지 않는다", () => {
  assert.match(componentSource, /correct:\s*2/);
  assert.match(componentSource, /wrong:\s*3/);
  assert.match(componentSource, /초록색 체크 팻말을 든 투리니/);
  assert.match(componentSource, /빨간색 X 팻말을 든 투리니/);
  assert.match(pageSource, /motion=\{answerCorrect \? "correct" : "wrong"\}/);
});

test("기본 상태는 3~6초 간격의 불규칙한 눈 깜박임을 쓴다", () => {
  assert.match(componentSource, /between\(3000,\s*6000\)/);
  assert.match(componentSource, /Math\.random\(\)/);
});

test("애니메이션을 줄이는 시스템 설정을 코드와 스타일 양쪽에서 지원한다", () => {
  assert.match(componentSource, /prefers-reduced-motion: reduce/);
  assert.match(componentSource, /STILL_FRAME\[state\]/);
  assert.match(styleSource, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(styleSource, /animation: none !important/);
});

test("캐릭터 칸은 정사각형 contain 방식이고 잘리지 않는다", () => {
  assert.match(styleSource, /aspect-ratio:\s*1\s*\/\s*1/);
  assert.match(styleSource, /background-size:\s*400%\s*600%/);
  assert.match(styleSource, /overflow:\s*visible/);
  for (const holder of [
    "\\.hero-mascot",
    "\\.learning-banner",
    "\\.portfolio-intro",
    "\\.profile-hero",
    "\\.result-card-page",
    "\\.coach-nudge",
  ]) {
    assert.match(styleSource, new RegExp(holder));
  }
});

test("캐릭터 스타일은 globals.css 다음에 불려 온다", () => {
  const globals = layoutSource.indexOf('import "./globals.css"');
  const character = layoutSource.indexOf('import "./turini-character.css"');
  assert.ok(globals >= 0 && character > globals);
});

test("옛 스프라이트 시트와 낱장 PNG는 더 이상 화면에서 쓰지 않는다", () => {
  assert.doesNotMatch(pageSource, /CharacterArt|<Mascot/);
  assert.doesNotMatch(styleSource, /turini-mascot-sheet\.png/);
  assert.match(styleSource, /turini-atlas-v2\.png/);
});
