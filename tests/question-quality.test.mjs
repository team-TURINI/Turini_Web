import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

/**
 * 720문항 중복·태그 점검을 테스트로 고정해 둡니다.
 * 나중에 문항을 고치다가 중복이나 태그 오연결이 생기면 바로 걸립니다.
 * (자세한 목록은 `node scripts/audit-questions.mjs` 가 만드는 리포트에 있습니다)
 */

const data = JSON.parse(
  await readFile(new URL("../public/data/quizData_720_FINAL.json", import.meta.url), "utf8"),
);
const parentIndex = JSON.parse(
  await readFile(new URL("../reference-data/parent_tag_index_FINAL.json", import.meta.url), "utf8"),
);
const indexRows = Array.isArray(parentIndex) ? parentIndex : parentIndex.parent_tags || [];

const norm = (value) =>
  (value ?? "")
    .toString()
    .replace(/\s+/g, "")
    .replace(/[.,·"'’“”()\[\]{}!?~\-–—:;/\\]/g, "")
    .toLowerCase();

test("문항 수와 id 는 그대로 유지된다", () => {
  assert.equal(data.length, 720);
  const ids = data.map((item) => item.id);
  assert.equal(new Set(ids).size, ids.length, "문항 id 가 중복됩니다");
});

test("문장이 완전히 같은 문항이 없다", () => {
  const seen = new Map();
  for (const item of data) {
    const key = (item.question ?? "").trim();
    assert.ok(!seen.has(key), `같은 문장: ${item.id} / ${seen.get(key)}`);
    seen.set(key, item.id);
  }
});

test("띄어쓰기·기호만 다른 문항이 없다", () => {
  const seen = new Map();
  for (const item of data) {
    const key = norm(item.question);
    assert.ok(!seen.has(key), `기호만 다른 문항: ${item.id} / ${seen.get(key)}`);
    seen.set(key, item.id);
  }
});

test("선택지 순서만 다른 문항이 없다", () => {
  const seen = new Map();
  for (const item of data) {
    if (!item.choices || item.choices.length < 2) continue;
    const key = `${norm(item.question)}#${[...item.choices].map(norm).sort().join("|")}`;
    assert.ok(!seen.has(key), `선택지 순서만 다른 문항: ${item.id} / ${seen.get(key)}`);
    seen.set(key, item.id);
  }
});

test("난이도만 다르고 내용이 같은 문항이 없다", () => {
  const byText = new Map();
  for (const item of data) {
    const key = norm(item.question);
    byText.set(key, [...(byText.get(key) || []), item]);
  }
  for (const [, group] of byText) {
    if (group.length < 2) continue;
    assert.equal(new Set(group.map((item) => item.difficulty)).size, 1);
  }
});

test("해설이 같은 문항은 같은 개념의 변형일 때만 허용한다", () => {
  const byExplanation = new Map();
  for (const item of data) {
    if (norm(item.explanation).length < 20) continue;
    const key = `${norm(item.explanation)}#${norm(item.answer)}`;
    byExplanation.set(key, [...(byExplanation.get(key) || []), item]);
  }
  for (const [, group] of byExplanation) {
    if (group.length < 2) continue;
    const concepts = new Set(group.map((item) => item.base_id));
    assert.equal(
      concepts.size,
      1,
      `서로 다른 개념이 같은 해설을 씁니다: ${group.map((item) => item.id).join(", ")}`,
    );
  }
});

test("같은 개념의 변형은 서로 다른 유형을 쓴다", () => {
  const byBase = new Map();
  for (const item of data) byBase.set(item.base_id, [...(byBase.get(item.base_id) || []), item]);
  for (const [base, group] of byBase) {
    if (group.length < 2) continue;
    assert.equal(
      new Set(group.map((item) => item.type)).size,
      group.length,
      `${base} 의 변형이 같은 유형을 반복합니다`,
    );
  }
});

test("모든 문항에 취약 태그와 상위 태그가 있다", () => {
  for (const item of data) {
    assert.ok(item.weakness_tag && item.weakness_tag.trim(), `${item.id} 취약 태그 없음`);
    assert.ok(item.parent_tag && item.parent_tag.trim(), `${item.id} 상위 태그 없음`);
  }
});

test("같은 취약 태그는 항상 같은 상위 태그에 붙는다", () => {
  const parents = new Map();
  for (const item of data) {
    const known = parents.get(item.weakness_tag);
    if (known) assert.equal(known, item.parent_tag, `${item.weakness_tag} 의 상위 태그가 흔들립니다`);
    else parents.set(item.weakness_tag, item.parent_tag);
  }
});

test("태그가 기준표(parent_tag_index)와 정확히 맞물린다", () => {
  const indexParents = new Set(indexRows.map((row) => row.tag));
  const indexSubTags = new Set(indexRows.flatMap((row) => row.sub_tags || []));
  const subTagOf = new Map();
  for (const row of indexRows) for (const sub of row.sub_tags || []) subTagOf.set(sub, row.tag);

  const usedParents = new Set(data.map((item) => item.parent_tag));
  const usedWeak = new Set(data.map((item) => item.weakness_tag));

  for (const tag of usedParents) assert.ok(indexParents.has(tag), `기준표에 없는 상위 태그: ${tag}`);
  for (const tag of indexParents) assert.ok(usedParents.has(tag), `문항이 없는 상위 태그: ${tag}`);
  for (const tag of usedWeak) assert.ok(indexSubTags.has(tag), `기준표에 없는 취약 태그: ${tag}`);
  for (const tag of indexSubTags) assert.ok(usedWeak.has(tag), `문항이 없는 취약 태그: ${tag}`);
  for (const item of data) {
    assert.equal(subTagOf.get(item.weakness_tag), item.parent_tag, `${item.id} 상위 태그 연결이 기준표와 다릅니다`);
  }
});

test("태그에 띄어쓰기·기호만 다른 오탈자 짝이 없다", () => {
  const groups = new Map();
  for (const item of data) {
    for (const tag of [item.weakness_tag, item.parent_tag]) {
      const key = norm(tag);
      groups.set(key, new Set([...(groups.get(key) || []), tag]));
    }
  }
  for (const [, set] of groups) {
    assert.equal(set.size, 1, `오탈자 의심: ${[...set].join(" / ")}`);
  }
});
