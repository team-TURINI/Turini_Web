/**
 * 꾸미기 저장 경로를 한 곳으로 모은 모듈.
 *
 * 지금 앱은 로그인 계정이 있고 학습 기록을 `PUT /api/account` 로 서버에 저장하므로
 * **서버가 원본**입니다. 이 파일은 그 위에 브라우저 캐시를 한 겹 더 둡니다.
 *
 * - 서버 저장: page.tsx 가 progress 와 함께 보냅니다 (DB·API 변경 없음)
 * - 브라우저 캐시: 사용자 아이디별 localStorage. 새로고침 직후 서버 응답이 오기 전에도
 *   꾸민 모습이 바로 보이고, 서버가 잠깐 느리거나 실패해도 선택이 날아가지 않습니다.
 *
 * 나중에 저장소를 바꾸려면 `CustomizationStore` 를 구현한 객체를 하나 더 만들어
 * `customizationStore` 만 교체하면 됩니다. 화면 코드는 건드리지 않아도 됩니다.
 */

import {
  normalizeCustomization,
  type AvatarStats,
  type TuriniCustomization,
} from "./avatar-items";

export interface CustomizationStore {
  load(userId: string, stats?: AvatarStats): TuriniCustomization | null;
  save(userId: string, value: TuriniCustomization): void;
  clear(userId: string): void;
}

const KEY_PREFIX = "turini-customization-v1:";

function keyFor(userId: string) {
  return `${KEY_PREFIX}${userId}`;
}

/** 브라우저 localStorage 구현. 어떤 이유로든 실패하면 조용히 없는 셈 칩니다. */
export const localCustomizationStore: CustomizationStore = {
  load(userId, stats) {
    if (typeof window === "undefined" || !userId) return null;
    try {
      const raw = window.localStorage.getItem(keyFor(userId));
      if (!raw) return null;
      // 손상된 JSON 이나 모르는 아이템이 들어 있어도 normalize 가 안전한 값으로 돌려줍니다.
      return normalizeCustomization(JSON.parse(raw), stats);
    } catch {
      // 값이 깨졌으면 지워서 다음부터 다시 시도하지 않게 합니다.
      try {
        window.localStorage.removeItem(keyFor(userId));
      } catch {
        /* 비공개 모드 등에서 삭제도 막힐 수 있습니다 */
      }
      return null;
    }
  },

  save(userId, value) {
    if (typeof window === "undefined" || !userId) return;
    try {
      window.localStorage.setItem(keyFor(userId), JSON.stringify(value));
    } catch {
      /* 용량 초과·비공개 모드 — 서버 저장이 원본이므로 무시해도 됩니다 */
    }
  },

  clear(userId) {
    if (typeof window === "undefined" || !userId) return;
    try {
      window.localStorage.removeItem(keyFor(userId));
    } catch {
      /* 무시 */
    }
  },
};

/** 화면 코드가 쓰는 저장소. 나중에 다른 구현으로 갈아 끼우면 됩니다. */
export const customizationStore: CustomizationStore = localCustomizationStore;

export function loadCustomizationCache(userId: string, stats?: AvatarStats) {
  return customizationStore.load(userId, stats);
}

export function saveCustomizationCache(userId: string, value: TuriniCustomization) {
  customizationStore.save(userId, value);
}

export function clearCustomizationCache(userId: string) {
  customizationStore.clear(userId);
}
