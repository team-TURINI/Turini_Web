import assert from "node:assert/strict";
import test from "node:test";

import fs from "node:fs";

import { directInputGuide, isAnswerCorrect, normalizeAnswer } from "../app/answer-utils.ts";

const questions = JSON.parse(fs.readFileSync(new URL("../public/data/quizData_864_FINAL.json", import.meta.url), "utf8"));

test("direct-input grading accepts natural Korean endings and common equivalents", () => {
  assert.equal(isAnswerCorrect("하락한다", "하락"), true);
  assert.equal(isAnswerCorrect("떨어진다", "하락"), true);
  assert.equal(isAnswerCorrect("주주입니다", "주주"), true);
  assert.equal(isAnswerCorrect("상장지수펀드", "ETF"), true);
  assert.equal(isAnswerCorrect("시세차익과 배당", "매매차익과 배당금"), true);
  assert.equal(isAnswerCorrect("감소합니다", "낮아진다"), true);
  assert.equal(isAnswerCorrect("증가합니다", "커진다"), true);
});

test("direct-input grading normalizes numeric finance answers without over-accepting", () => {
  assert.equal(isAnswerCorrect("0", "0원"), true);
  assert.equal(isAnswerCorrect("3퍼센트", "3%"), true);
  assert.equal(isAnswerCorrect("상승", "하락"), false);
  assert.equal(isAnswerCorrect("채권", "주식"), false);
});

test("question-specific accepted answers are honored", () => {
  assert.equal(isAnswerCorrect("주식보유자", "주주", ["기업의 일부 소유자"]), true);
});

test("all 216 direct-input official answers remain gradeable", () => {
  const directAnswers = questions.filter((question) => question.type === "빈칸직접입력");
  assert.equal(directAnswers.length, 216);
  for (const question of directAnswers) {
    assert.ok(normalizeAnswer(question.answer), question.id);
    assert.equal(isAnswerCorrect(question.answer, question.answer), true, question.id);
    assert.equal(isAnswerCorrect(`${question.answer}입니다`, question.answer), true, question.id);
    assert.equal(isAnswerCorrect([...question.answer].join(" "), question.answer), true, `${question.id}: arbitrary spaces`);
  }
});

test("all seven yes/no input questions explain both options and accept the correct polarity", () => {
  const binary = questions.filter(question => question.type === "빈칸직접입력" && ["아니다","그렇다"].includes(question.answer));
  assert.equal(binary.length,7);
  const yes = ["예","네","맞다","맞아요","그렇다","그렇습니다","YES"];
  const no = ["아니오","아니요","아니다","아닙니다","아니에요","아님","NO"];
  for (const question of binary) {
    const guide = directInputGuide(question.answer);
    assert.equal(guide.copy,"예 또는 아니오 중 하나를 입력하세요",question.id);
    assert.equal(guide.placeholder,"예 / 아니오",question.id);
    const affirmative = question.answer === "그렇다";
    assert.equal(guide.answerLabel,affirmative ? "예" : "아니오");
    for (const input of affirmative ? yes : no) assert.equal(isAnswerCorrect(input,question.answer),true,`${question.id}: ${input}`);
    for (const input of affirmative ? no : yes) assert.equal(isAnswerCorrect(input,question.answer),false,`${question.id}: ${input}`);
    for (const input of ["예 아니오","아니다 그렇다","잘 모르겠어요"]) assert.equal(isAnswerCorrect(input,question.answer),false,`${question.id}: ${input}`);
  }
});

test("multipart answers accept all terms without conjunctions, in either order and with synonym spellings", () => {
  const answer = "매매차익과 배당금";
  for (const input of ["매매차익 배당금","매매차익배당금","배당금 매매차익","배당 매매 차익","시세차익 및 배당","배당금과 자본이득","매매차익/배당금","매매차익, 배당금","매매차익과배당금입니다"]) {
    assert.equal(isAnswerCorrect(input,answer),true,input);
  }
  for (const input of ["매매차익","배당금","주식과 배당금","매매차익 주식","매매차익은 없고 배당금","매매차익 배당금 채권","매매차익 매매차익"]) {
    assert.equal(isAnswerCorrect(input,answer),false,input);
  }
  assert.equal(isAnswerCorrect("매매차익 주식","매매차익 주식"),true);
  assert.equal(isAnswerCorrect("주식과 매매차익","매매차익 주식"),true);
  assert.equal(isAnswerCorrect("폰지 친근감사기","폰지·친근감 사기"),true);
  assert.equal(isAnswerCorrect("친근감 사기 폰지","폰지·친근감 사기"),true);
  assert.equal(isAnswerCorrect("폰지사기","폰지·친근감 사기"),false);
});

test("all 38 term-combination questions require every term while permitting spaces and grammatical connectors", () => {
  const combined = questions.filter(question => question.type === "빈칸직접입력" && directInputGuide(question.answer).copy.startsWith("필요한 단어"));
  assert.equal(combined.length,38);
  for (const question of combined) {
    const tokens = question.answer.trim().split(/\s+|·/u);
    assert.equal(isAnswerCorrect(tokens.join(""),question.answer),true,question.id);
    for (let index=0;index<tokens.length;index++) {
      const incomplete = tokens.filter((_,position) => position!==index).join(" ");
      assert.equal(isAnswerCorrect(incomplete,question.answer),false,`${question.id}: incomplete ${incomplete}`);
    }
  }
  for (const [input,answer] of [["음 상관관계","음의 상관관계"],["시장 비슷하다","시장과 비슷하다"],["72 법칙","72의 법칙"],["화폐 시간가치","화폐의 시간가치"],["고이자 대출의 상환","고이자 대출 상환"]]) {
    assert.equal(isAnswerCorrect(input,answer),true,input);
  }
});

test("decimal points, signs, missing modifiers and negations never become correct through substring matching", () => {
  for (const [input,answer] of [["42","4.2"],["375","0.375"],["13%","3%"],["3%","13%"],["30%","±30%"],["343916","1,343,916원"],["상관관계","음의 상관관계"],["체계적 위험","비체계적 위험"],["비체계적 위험","체계적 위험"],["투자","분산투자"],["분산투자가 아니다","분산투자"]]) {
    assert.equal(isAnswerCorrect(input,answer),false,`${input} != ${answer}`);
  }
  assert.equal(isAnswerCorrect("4.2입니다.","4.2"),true);
  assert.equal(isAnswerCorrect("약 2.19퍼센트","약 2.19%"),true);
  assert.equal(isAnswerCorrect("세장","약세장"),false);
  assert.equal(isAnswerCorrect("자","자원"),false);
});

test("all 864 question variants keep their official answers and every wrong choice remains wrong", () => {
  for (const question of questions) {
    assert.equal(isAnswerCorrect(question.answer,question.answer),true,question.id);
    for (const choice of question.choices) {
      assert.equal(isAnswerCorrect(choice,question.answer),choice===question.answer,`${question.id}: ${choice}`);
    }
  }
});
