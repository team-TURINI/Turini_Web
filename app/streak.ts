/**
 * 연속 학습(스트릭) 계산
 *
 * 화면과 분리된 순수 계산 모듈입니다. 날짜만 넣으면 결과가 정해지므로
 * 자정 전후·시간대·잘못된 저장값을 테스트로 그대로 확인할 수 있습니다.
 *
 * 규칙
 *  - 날짜는 **한국 시간(KST, UTC+9)** 기준 하루로 셉니다.
 *  - 같은 날 여러 번 학습해도 1회만 올라갑니다.
 *  - 어제 학습했고 오늘 학습하면 1 늘어납니다.
 *  - 하루 이상 건너뛰면 1부터 다시 시작합니다.
 *  - 저장값이 비었거나 형식이 이상하거나 미래 날짜면 안전하게 1부터 시작합니다.
 */

const KST_OFFSET_MINUTES = 9 * 60;
const DAY_MS = 24 * 60 * 60 * 1000;
const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

/** 그 시각이 한국에서 며칠인지 'YYYY-MM-DD' 로 돌려줍니다. */
export function kstDateKey(at: Date | number = new Date()): string {
  const ms = typeof at === "number" ? at : at.getTime();
  if (!Number.isFinite(ms)) return kstDateKey(Date.now());
  const shifted = new Date(ms + KST_OFFSET_MINUTES * 60 * 1000);
  const year = shifted.getUTCFullYear();
  const month = `${shifted.getUTCMonth() + 1}`.padStart(2, "0");
  const day = `${shifted.getUTCDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** 'YYYY-MM-DD' 를 그 날 한국 자정의 시각(ms)으로 바꿉니다. 형식이 틀리면 null. */
export function dateKeyToUtcMs(key: string): number | null {
  if (typeof key !== "string" || !DATE_KEY.test(key)) return null;
  const [year, month, day] = key.split("-").map(Number);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const ms = Date.UTC(year, month - 1, day) - KST_OFFSET_MINUTES * 60 * 1000;
  // 2월 30일 같은 값이 다른 날짜로 넘어가지 않았는지 확인합니다.
  return kstDateKey(ms) === key ? ms : null;
}

/** 두 날짜가 한국 기준으로 며칠 차이인지 (b - a). 하나라도 이상하면 null. */
export function daysBetween(a: string, b: string): number | null {
  const left = dateKeyToUtcMs(a);
  const right = dateKeyToUtcMs(b);
  if (left === null || right === null) return null;
  return Math.round((right - left) / DAY_MS);
}

export type StreakState = {
  streak: number;
  /** 마지막으로 학습한 날 (KST 'YYYY-MM-DD'). 아직 없으면 null */
  lastStudyDate: string | null;
};

/** 저장된 값이 깨졌어도 계산이 멈추지 않도록 다듬습니다. */
export function normalizeStreak(value: unknown, today = kstDateKey()): StreakState {
  const source = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  const rawStreak = Number(source.streak);
  const rawDate = typeof source.lastStudyDate === "string" ? source.lastStudyDate : null;

  const gap = rawDate ? daysBetween(rawDate, today) : null;
  // 형식이 틀렸거나 미래 날짜면 기록이 없는 것으로 봅니다.
  if (rawDate && (gap === null || gap < 0)) return { streak: 0, lastStudyDate: null };

  const streak = Number.isFinite(rawStreak) ? Math.max(0, Math.min(3650, Math.floor(rawStreak))) : 0;
  if (!rawDate) return { streak: 0, lastStudyDate: null };
  // 하루 이상 쉬었으면 화면에 보이는 값도 0 으로 내려갑니다.
  if (gap !== null && gap >= 2) return { streak: 0, lastStudyDate: rawDate };
  return { streak: Math.max(1, streak), lastStudyDate: rawDate };
}

/**
 * 학습을 한 번 끝냈을 때의 다음 상태.
 * 같은 날 다시 불러도 값이 그대로라서, 새로고침하거나 여러 번 풀어도 안전합니다.
 */
export function advanceStreak(previous: unknown, at: Date | number = new Date()): StreakState {
  const today = kstDateKey(at);
  const safe = normalizeStreak(previous, today);

  if (!safe.lastStudyDate) return { streak: 1, lastStudyDate: today };

  const gap = daysBetween(safe.lastStudyDate, today);
  if (gap === null || gap < 0) return { streak: 1, lastStudyDate: today };
  if (gap === 0) return { streak: Math.max(1, safe.streak), lastStudyDate: today };
  if (gap === 1) return { streak: Math.max(1, safe.streak) + 1, lastStudyDate: today };
  return { streak: 1, lastStudyDate: today };
}

/** 화면에 보여 줄 현재 연속 일수 (오늘 아직 안 했어도 어제까지 이어졌으면 유지) */
export function displayStreak(state: unknown, at: Date | number = new Date()): number {
  return normalizeStreak(state, kstDateKey(at)).streak;
}
