/**
 * 720문항 중복·태그 점검 스크립트 (1회 실행)
 *   node scripts/audit-questions.mjs
 *
 * 문항을 지우거나 고치지 않습니다. 읽기만 하고 결과를 보고합니다.
 * 단계별로 나눠 검사해서, 확실한 중복과 애매한 항목을 따로 셉니다.
 */
import { readFile, writeFile } from "node:fs/promises";

const data = JSON.parse(await readFile(new URL("../public/data/quizData_720_FINAL.json", import.meta.url), "utf8"));
const parentIndex = JSON.parse(await readFile(new URL("../reference-data/parent_tag_index_FINAL.json", import.meta.url), "utf8"));

/** 공백·기호·괄호를 없애고 비교용으로 만든 문자열 */
const norm = (v) => (v ?? "")
  .toString()
  .replace(/\s+/g, "")
  .replace(/[.,·"'’“”()\[\]{}!?~\-–—:;/\\]/g, "")
  .toLowerCase();

const choiceKey = (q) => [...(q.choices || [])].map(norm).sort().join("|");

/** 글자 단위 자카드 유사도 (2-gram) */
function similarity(a, b) {
  const grams = (s) => {
    const set = new Set();
    for (let i = 0; i < s.length - 1; i += 1) set.add(s.slice(i, i + 2));
    return set;
  };
  const ga = grams(a);
  const gb = grams(b);
  if (!ga.size || !gb.size) return 0;
  let shared = 0;
  ga.forEach((g) => { if (gb.has(g)) shared += 1; });
  return shared / (ga.size + gb.size - shared);
}

const buckets = {
  exactSameText: [],       // 1) 문장이 완전히 동일
  sameAfterNorm: [],       // 2) 띄어쓰기·기호만 다름
  sameChoicesOrder: [],    // 3) 선택지 순서만 다름
  similarWording: [],      // 4) 표현만 바꾼 유사 문항
  sameExplanation: [],     // 5) 정답과 해설이 사실상 같음
  sameConceptRepeat: [],   // 6) 같은 개념·풀이를 반복
  difficultyOnlyDiff: [],  // 7) 난이도만 다르고 내용이 같음
};

const byRawText = new Map();
const byNormText = new Map();
for (const q of data) {
  const raw = (q.question ?? "").trim();
  byRawText.set(raw, [...(byRawText.get(raw) || []), q]);
  const key = norm(q.question);
  byNormText.set(key, [...(byNormText.get(key) || []), q]);
}

for (const [text, group] of byRawText) if (group.length > 1) {
  buckets.exactSameText.push({ text: text.slice(0, 60), ids: group.map((q) => q.id) });
}
for (const [, group] of byNormText) if (group.length > 1) {
  const rawSame = new Set(group.map((q) => (q.question ?? "").trim())).size === 1;
  if (!rawSame) buckets.sameAfterNorm.push({ ids: group.map((q) => q.id), text: group[0].question.slice(0, 60) });
  // 3) 같은 문장 + 선택지 집합 동일 → 순서만 다름
  const byChoices = new Map();
  for (const q of group) byChoices.set(choiceKey(q), [...(byChoices.get(choiceKey(q)) || []), q]);
  for (const [ck, sub] of byChoices) {
    if (!ck || sub.length < 2) continue;
    const orders = new Set(sub.map((q) => (q.choices || []).join("|")));
    if (orders.size > 1) buckets.sameChoicesOrder.push({ ids: sub.map((q) => q.id) });
  }
  // 7) 같은 문장인데 난이도가 다름
  if (new Set(group.map((q) => q.difficulty)).size > 1) {
    buckets.difficultyOnlyDiff.push({ ids: group.map((q) => q.id), difficulties: group.map((q) => q.difficulty) });
  }
}

// 5) 해설이 사실상 같은 문항 (정답도 같을 때만)
const byExplain = new Map();
for (const q of data) {
  const key = `${norm(q.explanation)}#${norm(q.answer)}`;
  if (norm(q.explanation).length < 20) continue;
  byExplain.set(key, [...(byExplain.get(key) || []), q]);
}
for (const [, group] of byExplain) if (group.length > 1) {
  const differentConcept = new Set(group.map((q) => q.base_id)).size > 1;
  buckets.sameExplanation.push({ ids: group.map((q) => q.id), acrossConcepts: differentConcept });
}

// 6) 같은 개념(base_id)을 여러 변형으로 반복 — 설계상 정상이므로 개수만 셉니다
const byBase = new Map();
for (const q of data) byBase.set(q.base_id, [...(byBase.get(q.base_id) || []), q]);
for (const [base, group] of byBase) {
  const types = new Set(group.map((q) => q.type));
  if (group.length > 1 && types.size === 1) {
    buckets.sameConceptRepeat.push({ base, ids: group.map((q) => q.id), type: [...types][0] });
  }
}

// 4) 표현만 다른 유사 문항 — 다른 개념끼리만 비교 (같은 개념 변형은 정상)
const normalized = data.map((q) => ({ q, n: norm(q.question) }));
for (let i = 0; i < normalized.length; i += 1) {
  for (let j = i + 1; j < normalized.length; j += 1) {
    const a = normalized[i];
    const b = normalized[j];
    if (a.q.base_id === b.q.base_id) continue;
    if (Math.abs(a.n.length - b.n.length) > 25) continue;
    const score = similarity(a.n, b.n);
    if (score >= 0.82) {
      buckets.similarWording.push({ ids: [a.q.id, b.q.id], score: Math.round(score * 100) / 100,
        a: a.q.question.slice(0, 55), b: b.q.question.slice(0, 55) });
    }
  }
}

/* ── 태그 점검 ─────────────────────────────────────────── */
const weakCounts = new Map();
const parentCounts = new Map();
const pairs = new Map();
for (const q of data) {
  weakCounts.set(q.weakness_tag, (weakCounts.get(q.weakness_tag) || 0) + 1);
  parentCounts.set(q.parent_tag, (parentCounts.get(q.parent_tag) || 0) + 1);
  pairs.set(`${q.weakness_tag}→${q.parent_tag}`, (pairs.get(`${q.weakness_tag}→${q.parent_tag}`) || 0) + 1);
}
const missing = data.filter((q) => !q.weakness_tag || !q.parent_tag).map((q) => q.id);
// 같은 취약 태그가 서로 다른 상위 태그에 붙은 경우 = 연결이 흔들리는 태그
const multiParent = [];
const parentsOf = new Map();
for (const q of data) {
  const set = parentsOf.get(q.weakness_tag) || new Set();
  set.add(q.parent_tag);
  parentsOf.set(q.weakness_tag, set);
}
for (const [tag, set] of parentsOf) if (set.size > 1) multiParent.push({ tag, parents: [...set] });

// 기준표에 없는 상위 태그 / 기준표에만 있고 안 쓰이는 상위 태그
const indexRows = Array.isArray(parentIndex) ? parentIndex : (parentIndex.parent_tags || []);
const indexParents = new Set(indexRows.map((row) => row.tag ?? row.parent_tag ?? row.name));
// 기준표가 상위태그마다 나열한 하위(취약) 태그
const indexSubTags = new Set(indexRows.flatMap((row) => row.sub_tags || []));
const subTagOf = new Map();
for (const row of indexRows) for (const sub of row.sub_tags || []) subTagOf.set(sub, row.tag);
const unknownParents = [...parentCounts.keys()].filter((t) => indexParents.size && !indexParents.has(t));
const unusedParents = [...indexParents].filter((t) => !parentCounts.has(t));
// 기준표에 없는 취약 태그 / 기준표에만 있고 문항이 없는 취약 태그
const unknownWeak = [...weakCounts.keys()].filter((t) => indexSubTags.size && !indexSubTags.has(t));
const unusedWeak = [...indexSubTags].filter((t) => !weakCounts.has(t));
// 기준표가 말하는 상위태그와 문항이 적은 상위태그가 다른 경우
const mismatchedLink = [];
for (const q of data) {
  const expected = subTagOf.get(q.weakness_tag);
  if (expected && expected !== q.parent_tag) mismatchedLink.push({ id: q.id, tag: q.weakness_tag, 문항: q.parent_tag, 기준표: expected });
}

// 오탈자 후보: 정규화하면 같아지는 서로 다른 태그
const tagNorm = new Map();
for (const tag of [...weakCounts.keys(), ...parentCounts.keys()]) {
  const key = norm(tag);
  tagNorm.set(key, new Set([...(tagNorm.get(key) || []), tag]));
}
const typoCandidates = [...tagNorm.values()].filter((set) => set.size > 1).map((set) => [...set]);

const report = {
  총문항: data.length,
  중복: Object.fromEntries(Object.entries(buckets).map(([k, v]) => [k, v.length])),
  태그: {
    취약태그_종류: weakCounts.size,
    상위태그_종류: parentCounts.size,
    태그_비어있는_문항: missing.length,
    상위태그가_둘_이상인_취약태그: multiParent.length,
    기준표에_없는_상위태그: unknownParents.length,
    기준표에만_있고_안_쓰이는_상위태그: unusedParents.length,
    기준표에_없는_취약태그: unknownWeak.length,
    기준표에만_있고_문항이_없는_취약태그: unusedWeak.length,
    상위태그_연결이_기준표와_다른_문항: mismatchedLink.length,
    오탈자_의심_묶음: typoCandidates.length,
  },
};

console.log(JSON.stringify(report, null, 2));
await writeFile(new URL("../design-assets/question-audit.json", import.meta.url),
  JSON.stringify({ report, buckets, tags: { multiParent, unknownParents, unusedParents, unknownWeak, unusedWeak, mismatchedLink, typoCandidates, missing,
    weakCounts: Object.fromEntries(weakCounts), parentCounts: Object.fromEntries(parentCounts) } }, null, 2));
console.log("\n자세한 목록 → design-assets/question-audit.json");
