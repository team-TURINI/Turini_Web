import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { planSessionQuestions } from "../app/quiz-scheduler.ts";
import {
  categoryDifficultyForLesson,
  categoryLessonPool,
  categoryLevelForSolved,
  completedCategoryLessonsForSolved,
  completedCategoryLessons,
  MAX_CATEGORY_LEVEL,
  QUESTIONS_PER_CATEGORY_LEVEL,
} from "../app/category-progress.ts";

const quizData = JSON.parse(readFileSync(new URL("../public/data/quizData_864_FINAL.json", import.meta.url), "utf8"));

test("each category starts at level 1 and gains a level per 10 unique solved questions", () => {
  assert.equal(categoryLevelForSolved(0), 1);
  assert.equal(categoryLevelForSolved(9), 1);
  assert.equal(categoryLevelForSolved(10), 2);
  assert.equal(categoryLevelForSolved(20), 3);
});

test("category level is bounded to the 120-question, 12-level path", () => {
  assert.equal(categoryLevelForSolved(110), 12);
  assert.equal(categoryLevelForSolved(120), 12);
  assert.equal(categoryLevelForSolved(999), 12);
  assert.equal(categoryLevelForSolved(-1), 1);
});

test("the learning path derives completed lessons only from the active category's solved count", () => {
  assert.equal(completedCategoryLessonsForSolved(0), 0);
  assert.equal(completedCategoryLessonsForSolved(9), 0);
  assert.equal(completedCategoryLessonsForSolved(10), 1);
  assert.equal(completedCategoryLessonsForSolved(119), 11);
  assert.equal(completedCategoryLessonsForSolved(120), MAX_CATEGORY_LEVEL);
});

test("each category's 12 lessons map to four lessons per difficulty", () => {
  assert.equal(categoryDifficultyForLesson(1), "초급");
  assert.equal(categoryDifficultyForLesson(4), "초급");
  assert.equal(categoryDifficultyForLesson(5), "중급");
  assert.equal(categoryDifficultyForLesson(8), "중급");
  assert.equal(categoryDifficultyForLesson(9), "고급");
  assert.equal(categoryDifficultyForLesson(12), "고급");
});

test("finishing stock lesson 7 unlocks lesson 8 even when all ten questions were repeats", () => {
  assert.equal(completedCategoryLessons(65, 0), 6);
  assert.equal(completedCategoryLessons(65, 7), 7);
  assert.equal(completedCategoryLessons(70, 0), 7);
  assert.equal(completedCategoryLessons(65, 7.9), 7);
  assert.equal(completedCategoryLessons(65, Number.NaN), 6);
});

test("every category lesson offers all four types for twelve distinct concepts", () => {
  const categories = [...new Set(quizData.map((question) => question.category))];
  for (const category of categories) {
    const ids = new Set();
    for (let lesson = 1; lesson <= MAX_CATEGORY_LEVEL; lesson += 1) {
      const pool = categoryLessonPool(quizData, category, lesson);
      // 칸(카테고리×난이도)마다 개념 12개. 레슨은 이 중 10문항만 내고, 나머지는 자유 학습에서 나온다.
      assert.equal(pool.length, 48, `${category} level ${lesson}`);
      assert.ok(pool.length >= QUESTIONS_PER_CATEGORY_LEVEL, `${category} level ${lesson}`);
      assert.equal(new Set(pool.map((question) => question.base_id)).size, 12, `${category} level ${lesson}`);
      for (const baseId of new Set(pool.map((question) => question.base_id))) {
        assert.deepEqual(new Set(pool.filter((question) => question.base_id === baseId).map((question) => question.type)),
          new Set(["4지선다", "OX", "빈칸선택", "빈칸직접입력"]), `${category} level ${lesson} ${baseId}`);
      }
      pool.forEach((question) => ids.add(question.id));
    }
    assert.equal(ids.size, 144, category);
  }
});

test("actual ten-question category sessions interleave all four types", () => {
  const categories = [...new Set(quizData.map((question) => question.category))];
  for (const category of categories) {
    for (let lesson = 1; lesson <= MAX_CATEGORY_LEVEL; lesson += 1) {
      const pool = categoryLessonPool(quizData, category, lesson);
      for (const seed of [1, 17, 97]) {
        const session = planSessionQuestions(pool, 10, seed, {}, 0, []);
        const counts = Object.values(Object.groupBy(session, (question) => question.type)).map((items) => items.length).sort();
        assert.deepEqual(counts, [2, 2, 3, 3], `${category} level ${lesson} seed ${seed}`);
        assert.equal(new Set(session.map((question) => question.base_id)).size, 10);
      }
    }
  }
});

test("the category header uses its own level and the waiting speech bubble fits its copy", () => {
  const page = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
  const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(page, /Lv\. \{activeCategoryLevel\}/);
  assert.match(page, /Lv\. \{categoryLevel\}/);
  assert.match(page, /\{activeCategory\.name\} 레벨/);
  assert.match(page, /activeCategoryCompletedLessons < MAX_CATEGORY_LEVEL/);
  assert.doesNotMatch(page, /전체 레벨/);
  assert.doesNotMatch(page, /const category = CATEGORIES\[\(level - 1\) % CATEGORIES\.length\]/);
  assert.match(css, /\.quiz-mascot\.waiting \.speech \{[^}]*width:max-content;[^}]*justify-self:start;/s);
});
