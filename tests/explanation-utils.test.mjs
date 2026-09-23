import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { friendlyizeExplanation } from "../app/explanation-utils.ts";

const questions = JSON.parse(
  await readFile(new URL("../public/data/quizData_864_FINAL.json", import.meta.url), "utf8"),
);
const diagnosticQuestions = JSON.parse(
  await readFile(new URL("../public/data/diagnostic_quiz.json", import.meta.url), "utf8"),
);

test("해설의 평서형과 격식체를 투린이 해요체로 바꾼다", () => {
  assert.equal(
    friendlyizeExplanation("채권은 발행자에게 돈을 빌려주고 이자를 받는 금융상품이다."),
    "채권은 발행자에게 돈을 빌려주고 이자를 받는 금융상품이에요.",
  );
  assert.equal(friendlyizeExplanation("두 개념은 다릅니다. 미래 수익을 보장하지 않습니다."), "두 개념은 달라요. 미래 수익을 보장하지 않아요.");
});

test("이미 친근한 해설과 숫자는 그대로 둔다", () => {
  assert.equal(friendlyizeExplanation("복리 계산 결과는 10.82%예요."), "복리 계산 결과는 10.82%예요.");
});

test("실제 학습·진단 문항 화면에 반말과 격식체가 남지 않는다", () => {
  const allExplanations = [
    ...questions.map((question) => ({ id: question.id, explanation: question.explanation })),
    ...diagnosticQuestions.map((question) => ({ id: `DIAG_${question.diagnostic_quiz_id}`, explanation: question.explanation })),
  ];
  for (const question of allExplanations) {
    const rendered = friendlyizeExplanation(question.explanation);
    const sentences = rendered.split(/(?<=\.)\s*/u);
    for (const sentence of sentences) {
      const declarative = sentence.match(/([가-힣]+다)\.$/u)?.[1];
      assert.ok(!declarative || declarative.endsWith("니다"), `${question.id}: ${sentence}`);
      assert.doesNotMatch(sentence, /니다/u, `${question.id}: ${sentence}`);
    }
  }
});

test("원본 학습·진단 데이터 자체도 투린이 해요체로 저장돼 있다", () => {
  const allExplanations = [
    ...questions.map((question) => ({ id: question.id, explanation: question.explanation })),
    ...diagnosticQuestions.map((question) => ({ id: `DIAG_${question.diagnostic_quiz_id}`, explanation: question.explanation })),
  ];
  for (const question of allExplanations) {
    assert.equal(friendlyizeExplanation(question.explanation), question.explanation, `${question.id}: 원본 해설 말투`);
    assert.doesNotMatch(question.explanation, /니다/u, `${question.id}: 격식체 잔존`);
    assert.doesNotMatch(question.explanation, /[가-힣A-Za-z0-9%)]다\./u, `${question.id}: 반말 종결 잔존`);
  }
});
