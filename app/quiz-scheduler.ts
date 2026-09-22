export type ReviewKind = "scheduled" | "retry";

export type SchedulableQuestion = {
  id: string;
  base_id: string;
  type: string;
  category?: string;
  difficulty?: string;
  /** 문항이 다루는 취약 개념 태그 */
  weakness_tag?: string;
  /** 사용자 화면과 맞춤 추천에 쓰는 20개 상위 태그 */
  parent_tag?: string;
  choices?: string[];
  answer?: string;
  reviewKind?: ReviewKind;
};

/**
 * 추천에 쓰는 사용자 상태.
 * 없으면 예전과 똑같이 동작하므로, 기존 호출부를 바꾸지 않아도 됩니다.
 */
export type RecommendationContext = {
  /** 진단·오답에서 모인 취약 태그 */
  weakTags?: string[];
  /** 지금 난이도 (초급·중급·고급) */
  level?: string;
  /** 지금까지 실제로 완료한 학습 문항 id — 새로 추가된 문항을 먼저 보여 줍니다 */
  completedIds?: string[];
  /** 너무 최근에 푼 문항 id — 바로 다시 내지 않습니다 */
  recentIds?: string[];
};

/** 개념 묶음 하나의 추천 점수. 클수록 먼저 나옵니다. */
export function conceptPriority<T extends SchedulableQuestion>(
  variants: T[],
  context: RecommendationContext | undefined,
  review?: ConceptReview,
) {
  if (!context) return 0;
  let score = 0;
  const weak = new Set(context.weakTags || []);
  if (weak.size && variants.some((item) =>
    (item.parent_tag && weak.has(item.parent_tag))
    || (item.weakness_tag && weak.has(item.weakness_tag)),
  )) score += 4;
  if (context.level && variants.some((item) => item.difficulty === context.level)) score += 2;
  const completed = new Set(context.completedIds || []);
  if (completed.size) {
    const completedCount = variants.filter((item) => completed.has(item.id)).length;
    // 기존 720문항을 이미 학습한 계정도 864 확장 문항을 먼저 만날 수 있게 합니다.
    if (completedCount === 0) score += 3;
    else if (completedCount < variants.length) score += 1;
  }
  // 이미 충분히 익힌 개념은 뒤로 미룹니다.
  if (review && review.correctStreak >= 3) score -= 3;
  // 너무 최근에 푼 문제만 있는 개념도 뒤로 미룹니다.
  const recent = new Set(context.recentIds || []);
  if (recent.size && variants.every((item) => recent.has(item.id))) score -= 4;
  return score;
}

export type ConceptReview = {
  seen: number;
  correctStreak: number;
  nextDueSession: number;
  lastType: string;
};

export type SchedulerProgress = {
  studySessions: number;
  conceptReviews: Record<string, ConceptReview>;
  pendingRetries: PendingRetry[];
};

export type PendingRetry = {
  key: string;
  sourceId: string;
  category?: string;
  difficulty?: string;
  lastType: string;
  dueIndex: number;
};

export const CONCEPT_ALIASES: Record<string, string> = {
  RET_A_008: "BND_I_001",
};

export const REVIEW_INTERVALS = [1, 3, 7, 14, 30];
const QUESTION_TYPE_ORDER = ["4지선다", "OX", "빈칸선택", "빈칸직접입력"];

export function seededShuffle<T>(items: T[], seed: number) {
  const result = [...items];
  let value = seed || 1;
  const random = () => {
    value = (value * 9301 + 49297) % 233280;
    return value / 233280;
  };
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function conceptKey(question: SchedulableQuestion) {
  const base = question.base_id || question.id;
  return CONCEPT_ALIASES[base] || base;
}

function stringSeed(value: string) {
  return [...value].reduce((sum, char) => (sum * 31 + char.charCodeAt(0)) % 1000003, 7);
}

function chooseVariant<T extends SchedulableQuestion>(variants: T[], seed: number, lastType?: string, preferredType?: string) {
  const preferred = variants.filter((question) => question.type === preferredType && question.type !== lastType);
  if (preferred.length) return seededShuffle(preferred, seed + stringSeed(preferredType || ""))[0];
  const alternativeTypes = QUESTION_TYPE_ORDER.filter((type) => type !== lastType);
  const start = alternativeTypes.length ? Math.abs(seed) % alternativeTypes.length : 0;
  const orderedTypes = alternativeTypes.map((_, index) => alternativeTypes[(start + index) % alternativeTypes.length]);
  for (const type of orderedTypes) {
    if (type === lastType) continue;
    const candidates = variants.filter((question) => question.type === type);
    if (candidates.length) return seededShuffle(candidates, seed + stringSeed(type))[0];
  }
  return seededShuffle(variants, seed)[0];
}

function typeTargets(count: number, seed: number) {
  const order = seededShuffle(QUESTION_TYPE_ORDER, seed + 53);
  const base = Math.floor(count / QUESTION_TYPE_ORDER.length);
  const extra = count % QUESTION_TYPE_ORDER.length;
  return Object.fromEntries(order.map((type, index) => [type, base + (index < extra ? 1 : 0)])) as Record<string, number>;
}

function prepareChoices<T extends SchedulableQuestion>(question: T, seed: number) {
  if (!question.choices || question.choices.length <= 2) return question;
  const answer = question.answer;
  if (!answer || !question.choices.includes(answer)) {
    return { ...question, choices: seededShuffle(question.choices, seed + 101) } as T;
  }
  const distractors = seededShuffle(question.choices.filter((choice) => choice !== answer), seed + 101);
  const answerIndex = Math.abs(seed) % question.choices.length;
  const choices = [...distractors];
  choices.splice(answerIndex, 0, answer);
  return { ...question, choices } as T;
}

export function planLearningQuestions<T extends SchedulableQuestion>(
  pool: T[],
  count: number,
  seed: number,
  reviews: Record<string, ConceptReview>,
  studySessions: number,
  context?: RecommendationContext,
  typePlan?: { targets: Record<string, number>; used: Record<string, number> },
) {
  const groups = new Map<string, T[]>();
  seededShuffle(pool, seed).forEach((question) => {
    const key = conceptKey(question);
    groups.set(key, [...(groups.get(key) || []), question]);
  });
  const entries = [...groups.entries()];
  // 취약 태그·난이도·최근 학습을 반영해 순서를 정합니다.
  // (섞은 뒤 점수로 다시 정렬하므로, 점수가 같으면 예전과 같은 순서입니다.)
  const rank = (pair: [string, T[]]) => conceptPriority(pair[1], context, reviews[pair[0]]);
  const byPriority = (list: [string, T[]][]) =>
    context ? [...list].sort((a, b) => rank(b) - rank(a)) : list;

  const newConcepts = byPriority(seededShuffle(entries.filter(([key]) => !reviews[key]), seed + 11));
  const dueReviews = entries
    .filter(([key]) => reviews[key] && reviews[key].nextDueSession <= studySessions)
    .sort(([a], [b]) => reviews[a].correctStreak - reviews[b].correctStreak || reviews[a].nextDueSession - reviews[b].nextDueSession);
  const rankedDue = byPriority(dueReviews);
  const futureReviews = seededShuffle(entries.filter(([key]) => reviews[key] && reviews[key].nextDueSession > studySessions), seed + 23);
  const reviewTarget = newConcepts.length ? Math.min(dueReviews.length, dueReviews.length >= 3 ? 3 : 2, count) : count;
  const selected: [string, T[]][] = [];
  selected.push(...newConcepts.slice(0, Math.max(0, count - reviewTarget)));
  selected.push(...rankedDue.slice(0, reviewTarget));
  const selectedKeys = new Set(selected.map(([key]) => key));
  const fill = [...newConcepts, ...rankedDue, ...byPriority(futureReviews)].filter(([key]) => !selectedKeys.has(key));
  selected.push(...fill.slice(0, count - selected.length));

  // 너무 최근에 푼 문항은 같은 개념의 다른 변형으로 바꿔 냅니다.
  // (변형이 하나뿐이면 그대로 냅니다 — 개념을 통째로 빼지는 않습니다)
  const recent = new Set(context?.recentIds || []);
  const completed = new Set(context?.completedIds || []);
  const freshVariants = (variants: T[]) => {
    const notCompleted = completed.size ? variants.filter((question) => !completed.has(question.id)) : variants;
    const completionFiltered = notCompleted.length ? notCompleted : variants;
    if (!recent.size) return completionFiltered;
    const notRecent = completionFiltered.filter((question) => !recent.has(question.id));
    return notRecent.length ? notRecent : completionFiltered;
  };

  const chosenGroups = seededShuffle(selected, seed + 37).slice(0, count);
  const targets = typePlan?.targets || typeTargets(chosenGroups.length, seed);
  const used = typePlan
    ? { ...typePlan.used }
    : Object.fromEntries(QUESTION_TYPE_ORDER.map((type) => [type, 0])) as Record<string, number>;

  return chosenGroups.map(([key, group], index) => {
    const review = reviews[key];
    const variants = freshVariants(group);
    const availableTypes = QUESTION_TYPE_ORDER.filter((type) =>
      variants.some((question) => question.type === type && question.type !== review?.lastType),
    );
    const fallbackTypes = QUESTION_TYPE_ORDER.filter((type) => variants.some((question) => question.type === type));
    const preferredType = [...(availableTypes.length ? availableTypes : fallbackTypes)].sort((left, right) =>
      (targets[right] - used[right]) - (targets[left] - used[left])
      || used[left] - used[right]
      || QUESTION_TYPE_ORDER.indexOf(left) - QUESTION_TYPE_ORDER.indexOf(right),
    )[0];
    const question = chooseVariant(variants, seed + index * 13, review?.lastType, preferredType);
    used[question.type] = (used[question.type] || 0) + 1;
    const prepared = prepareChoices(question, seed + index * 29);
    return review ? ({ ...prepared, reviewKind: "scheduled" } as T) : prepared;
  });
}

export function recordConceptReview<T extends SchedulerProgress>(
  progress: T,
  question: SchedulableQuestion,
  correct: boolean,
) {
  const key = conceptKey(question);
  const previous = progress.conceptReviews[key] || { seen: 0, correctStreak: 0, nextDueSession: 0, lastType: "" };
  const correctStreak = correct ? previous.correctStreak + 1 : 0;
  const interval = correct ? REVIEW_INTERVALS[Math.min(correctStreak - 1, REVIEW_INTERVALS.length - 1)] : 0;
  return {
    ...progress,
    pendingRetries: question.reviewKind === "retry"
      ? progress.pendingRetries.filter((item) => item.key !== key)
      : progress.pendingRetries,
    conceptReviews: {
      ...progress.conceptReviews,
      [key]: {
        seen: previous.seen + 1,
        correctStreak,
        nextDueSession: progress.studySessions + interval,
        lastType: question.type,
      },
    },
  } as T;
}

function retryVariants<T extends SchedulableQuestion>(question: T, allQuestions: T[]) {
  const sameConcept = allQuestions.filter((item) => conceptKey(item) === conceptKey(question));
  const sameCategory = question.category
    ? sameConcept.filter((item) => item.category === question.category)
    : sameConcept;
  const sameDifficulty = question.difficulty
    ? sameCategory.filter((item) => item.difficulty === question.difficulty)
    : sameCategory;
  const scoped = sameDifficulty.length ? sameDifficulty : sameCategory;
  return scoped.filter((item) => item.id !== question.id && item.type !== question.type);
}

export function scheduleRetry<T extends SchedulableQuestion, S extends { questions: T[]; index: number }>(
  session: S,
  question: T,
  allQuestions: T[],
  pendingRetries: PendingRetry[] = [],
) {
  const key = conceptKey(question);
  if (session.questions.slice(session.index + 1).some((item) => conceptKey(item) === key)) return { session, deferred: null };
  if (question.reviewKind !== "retry" && pendingRetries.some((item) => item.key === key)) return { session, deferred: null };
  const offset = 3 + (stringSeed(question.id) % 3);
  const distances = [...new Set([offset, 3, 4, 5])];
  const occupiedDeferred = new Set(pendingRetries.map((item) => item.dueIndex));
  const variants = retryVariants(question, allQuestions);
  if (!variants.length) return { session, deferred: null };
  const candidates = distances.map((distance) => {
    const targetIndex = session.index + distance;
    return targetIndex < session.questions.length
      ? { targetIndex, dueIndex: null }
      : { targetIndex: null, dueIndex: targetIndex - session.questions.length };
  });
  const available = candidates.filter((candidate) => candidate.targetIndex !== null
    ? session.questions[candidate.targetIndex].reviewKind !== "retry"
    : !occupiedDeferred.has(candidate.dueIndex!));
  // 가능하면 교체되는 자리와 같은 유형의 변형을 사용해 세션의 2·2·3·3
  // 유형 분포를 유지합니다. 같은 유형 재출제 금지와 충돌할 때만 차선 위치를 씁니다.
  const matchingPlacement = available.find((candidate) => candidate.targetIndex !== null
    && variants.some((variant) => variant.type === session.questions[candidate.targetIndex!].type));
  const naturallyDeferred = available.find((candidate) => candidate.targetIndex === null);
  const fallbackDueIndex = [1, 2, 3].find((dueIndex) => !occupiedDeferred.has(dueIndex));
  const placement = matchingPlacement
    || naturallyDeferred
    || (fallbackDueIndex === undefined ? undefined : { targetIndex: null, dueIndex: fallbackDueIndex });
  if (!placement) return { session, deferred: null };
  if (placement.targetIndex === null) {
    return {
      session,
      deferred: {
        key,
        sourceId: question.id,
        category: question.category,
        difficulty: question.difficulty,
        lastType: question.type,
        dueIndex: placement.dueIndex!,
      } satisfies PendingRetry,
    };
  }
  const targetIndex = placement.targetIndex;
  const nextQuestions = [...session.questions];
  const retry = chooseVariant(
    variants,
    stringSeed(question.id) + targetIndex,
    question.type,
    nextQuestions[targetIndex]?.type,
  );
  nextQuestions[targetIndex] = { ...prepareChoices(retry, stringSeed(question.id) + targetIndex), reviewKind: "retry" } as T;
  return { session: { ...session, questions: nextQuestions } as S, deferred: null };
}

export function insertRetry<T extends SchedulableQuestion, S extends { questions: T[]; index: number }>(
  session: S,
  question: T,
  allQuestions: T[],
) {
  return scheduleRetry(session, question, allQuestions).session;
}

export function planSessionQuestions<T extends SchedulableQuestion>(
  pool: T[],
  count: number,
  seed: number,
  reviews: Record<string, ConceptReview>,
  studySessions: number,
  pendingRetries: PendingRetry[],
  context?: RecommendationContext,
) {
  const activePending = pendingRetries.filter((pending) => pool.some((question) =>
    conceptKey(question) === pending.key
    && (!pending.category || question.category === pending.category)
    && (!pending.difficulty || question.difficulty === pending.difficulty)
    && question.type !== pending.lastType,
  )).slice(0, count);
  const pendingKeys = new Set(activePending.map((item) => item.key));
  const slots: Array<T | undefined> = Array.from({ length: count });
  const occupied = new Set<number>();
  const targets = typeTargets(count, seed);
  const used = Object.fromEntries(QUESTION_TYPE_ORDER.map((type) => [type, 0])) as Record<string, number>;

  activePending.forEach((pending, pendingIndex) => {
    const candidates = pool.filter((question) =>
      conceptKey(question) === pending.key
      && (!pending.category || question.category === pending.category)
      && (!pending.difficulty || question.difficulty === pending.difficulty)
      && question.type !== pending.lastType,
    );
    if (!candidates.length) return;
    const preferred = Math.min(count - 1, Math.max(0, pending.dueIndex));
    const target = [preferred, preferred + 1, preferred - 1, preferred + 2, preferred - 2]
      .find((index) => index >= 0 && index < count && !occupied.has(index));
    if (target === undefined) return;
    const preferredType = QUESTION_TYPE_ORDER
      .filter((type) => candidates.some((question) => question.type === type))
      .sort((left, right) =>
        (targets[right] - used[right]) - (targets[left] - used[left])
        || QUESTION_TYPE_ORDER.indexOf(left) - QUESTION_TYPE_ORDER.indexOf(right),
      )[0];
    const retry = chooseVariant(candidates, seed + pendingIndex * 43, pending.lastType, preferredType);
    slots[target] = { ...prepareChoices(retry, seed + target * 17), reviewKind: "retry" } as T;
    used[retry.type] = (used[retry.type] || 0) + 1;
    occupied.add(target);
  });

  const normalQuestions = planLearningQuestions(
    pool.filter((question) => !pendingKeys.has(conceptKey(question))),
    Math.max(0, count - activePending.length),
    seed,
    reviews,
    studySessions,
    context,
    { targets, used },
  );

  let normalIndex = 0;
  for (let index = 0; index < slots.length; index += 1) {
    if (!slots[index]) slots[index] = normalQuestions[normalIndex++];
  }
  return slots.filter((question): question is T => Boolean(question));
}
