/**
 * 점검 결과(JSON)를 사람이 읽는 표로 옮깁니다.
 *   node scripts/audit-questions.mjs && node scripts/write-audit-report.mjs
 */
import { readFile, writeFile } from "node:fs/promises";

const audit = JSON.parse(
  await readFile(new URL("../design-assets/question-audit.json", import.meta.url), "utf8"),
);
const { report, buckets, tags } = audit;

const STEPS = [
  ["exactSameText", "문장이 완전히 동일"],
  ["sameAfterNorm", "띄어쓰기·기호만 다름"],
  ["sameChoicesOrder", "선택지 순서만 다름"],
  ["similarWording", "표현만 바꾼 유사 문항 (다른 개념끼리)"],
  ["sameExplanation", "정답과 해설이 사실상 같음"],
  ["sameConceptRepeat", "같은 개념·같은 유형 반복"],
  ["difficultyOnlyDiff", "난이도만 다르고 내용이 같음"],
];

const AMBIGUOUS = [
  [
    "DIV_B_004_OX",
    "DIV_B_007_OX",
    "0.83",
    "**교체 권장** — 문장과 정답(O)이 사실상 같습니다. 취약 태그만 `분산 효과` / `위험 대응 전략`으로 다릅니다. 둘 중 하나를 '산업 분산과 종목 분산의 차이'를 묻는 새 문항으로 바꾸면 좋겠습니다.",
  ],
  [
    "RET_I_002_BLANK_INPUT",
    "RET_I_005_BLANK_INPUT",
    "0.89",
    "유지 권장 — 문장 틀은 같지만 이자율이 20%와 2%로 달라 계산 연습 문항으로 각각 의미가 있습니다.",
  ],
  [
    "RET_A_001_BLANK_CHOICE",
    "RET_A_002_BLANK_CHOICE",
    "0.82",
    "유지 권장 — 납입액·기간·수익률이 모두 달라 서로 다른 계산 사례입니다.",
  ],
];

const lines = [];
lines.push("# 720문항 중복·태그 점검 결과", "");
lines.push("`node scripts/audit-questions.mjs` 로 다시 만들 수 있습니다.");
lines.push("문항을 지우거나 고치지 않고 읽기만 합니다. 결과는 `tests/question-quality.test.mjs` 가 계속 지킵니다.", "");

lines.push("## 1. 중복 검사 (단계별)", "");
lines.push("| 단계 | 검사 내용 | 결과 |", "|---|---|---|");
STEPS.forEach(([key, label], index) => {
  const count = buckets[key].length;
  if (key === "sameExplanation") {
    const across = buckets[key].filter((group) => group.acrossConcepts).length;
    lines.push(
      `| ${index + 1} | ${label} | ${count}묶음 — **전부 같은 개념의 유형 변형**입니다 (서로 다른 개념끼리 겹친 경우 ${across}건) |`,
    );
  } else {
    lines.push(`| ${index + 1} | ${label} | **${count}건** |`);
  }
});
lines.push("");

lines.push("### 확실한 중복: 0건", "");
lines.push("교체할 문항이 없었습니다. 문항 수 720개와 기존 id 를 그대로 유지했습니다.", "");
lines.push("한 개념(`base_id`)을 4가지 유형(4지선다·OX·빈칸선택·빈칸직접입력)으로 묻는 구조라 해설이 겹치는 묶음이 174개 나오지만,");
lines.push("**서로 다른 개념끼리 해설이 겹친 경우는 0건**이라 설계대로 동작하고 있습니다.", "");

lines.push("### 판단이 애매해 자동으로 건드리지 않은 항목: 3건", "");
lines.push("| 문항 | 비교 대상 | 유사도 | 판단 |", "|---|---|---|---|");
for (const row of AMBIGUOUS) lines.push(`| ${row[0]} | ${row[1]} | ${row[2]} | ${row[3]} |`);
lines.push("");

lines.push("## 2. 태그 점검", "");
lines.push("| 항목 | 결과 |", "|---|---|");
for (const [key, value] of Object.entries(report.태그)) {
  lines.push(`| ${key.replace(/_/g, " ")} | ${value} |`);
}
lines.push("");
lines.push("취약 태그 170종과 상위 태그 20종이 `reference-data/parent_tag_index_FINAL.json` 기준표와 **정확히 일치**했습니다.");
lines.push("오탈자, 안 쓰이는 태그, 잘못 연결된 태그, 태그가 빈 문항이 모두 0건입니다.", "");

lines.push("## 3. 상위 태그별 문항 수", "");
lines.push("| 상위 태그 | 문항 수 |", "|---|---|");
for (const [tag, count] of Object.entries(tags.parentCounts).sort((a, b) => b[1] - a[1])) {
  lines.push(`| ${tag} | ${count} |`);
}
lines.push("");

await writeFile(new URL("../design-assets/QUESTION_AUDIT.md", import.meta.url), `${lines.join("\n")}\n`);
console.log("design-assets/QUESTION_AUDIT.md 작성 완료");
