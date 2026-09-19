export const QUESTIONS_PER_CATEGORY_LEVEL = 10;
export const MAX_CATEGORY_LEVEL = 12;
export const QUESTIONS_PER_CATEGORY = QUESTIONS_PER_CATEGORY_LEVEL * MAX_CATEGORY_LEVEL;

export function categoryLevelForSolved(solved: number) {
  const completed = Number.isFinite(solved) ? Math.max(0, Math.floor(solved)) : 0;
  return Math.min(MAX_CATEGORY_LEVEL, Math.floor(completed / QUESTIONS_PER_CATEGORY_LEVEL) + 1);
}

export function completedCategoryLessonsForSolved(solved: number) {
  const completed = Number.isFinite(solved) ? Math.max(0, Math.floor(solved)) : 0;
  return Math.min(MAX_CATEGORY_LEVEL, Math.floor(completed / QUESTIONS_PER_CATEGORY_LEVEL));
}

export function categoryDifficultyForLesson(lesson: number) {
  const safeLesson = Math.min(MAX_CATEGORY_LEVEL, Math.max(1, Math.floor(lesson)));
  if (safeLesson <= 4) return "초급" as const;
  if (safeLesson <= 8) return "중급" as const;
  return "고급" as const;
}

export function categoryLessonPool<
  T extends { id: string; base_id: string; category: string; difficulty: string },
>(questions: T[], category: string, lesson: number) {
  const difficulty = categoryDifficultyForLesson(lesson);
  const safeLesson = Math.min(MAX_CATEGORY_LEVEL, Math.max(1, Math.floor(lesson)));
  const variantIndex = (safeLesson - 1) % 4;
  const byConcept = new Map<string, T[]>();

  questions
    .filter((question) => question.category === category && question.difficulty === difficulty)
    .forEach((question) => {
      const variants = byConcept.get(question.base_id) || [];
      variants.push(question);
      byConcept.set(question.base_id, variants);
    });

  return [...byConcept.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([, variants]) => variants.sort((left, right) => left.id.localeCompare(right.id))[variantIndex])
    .filter((question): question is T => Boolean(question));
}

/** 난이도 구간의 첫 레슨 번호 (1-4 초급 · 5-8 중급 · 9-12 고급) */
export const BAND_START: Record<string, number> = { 초급: 1, 중급: 5, 고급: 9 };
export const BAND_SIZE = 4;

/**
 * 그 난이도 구간에서 지금 들어가면 좋은 레슨 번호.
 * 이미 지난 레슨은 건너뛰고, 구간을 벗어나지 않습니다.
 */
export function bandEntryLesson(difficulty: string, completedLessons: number, totalLessons = MAX_CATEGORY_LEVEL) {
  const from = BAND_START[difficulty] ?? 1;
  const to = Math.min(totalLessons, from + BAND_SIZE - 1);
  const done = Number.isFinite(completedLessons) ? Math.max(0, Math.floor(completedLessons)) : 0;
  return Math.min(to, Math.max(from, done + 1));
}
