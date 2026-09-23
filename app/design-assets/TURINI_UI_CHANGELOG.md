# 투리니 UI 개선 기록

원본: `Turini_App_V10_3` (2026-09 업로드본)
바꾼 것은 **화면(렌더링과 스타일)뿐**이고, 학습·진단·포트폴리오·자산 계산과 계정/API/DB는 건드리지 않았습니다.

---

## 1단계 — 캐릭터 애니메이션

### 새로 만든 파일
| 파일 | 내용 |
| --- | --- |
| `app/turini-character.tsx` | 6가지 상태 + 불규칙 눈 깜박임 스케줄러 |
| `app/turini-character.css` | 동작·접지 그림자·화면별 배치 |
| `public/assets/turini-atlas-v2.png` / `.json` | 다시 포장한 프레임 시트 (4칸 × 6줄, 288px 정사각) |
| `tests/turini-character.test.mjs` | 회귀 테스트 8개 |
| `design-assets/turini-animation-v1/` | 받은 원본 + 재포장 스크립트 + 필요한 레이어 목록 |

### 고친 파일
- `app/layout.tsx` — CSS import 1줄
- `app/page.tsx` — 캐릭터 호출부 16곳 교체 (`CharacterArt` 15 + `Mascot` 1)

### 구현한 상태
기본(호흡 + 3~6초 불규칙 깜박임) / 생각 중(고개 기울임) / 정답(초록 체크 팻말) /
오답(빨간 X 팻말) / 학습 완료(두 번 뛰며 축하) / 책 읽기(시선 이동 + 페이지 넘김) /
상태 전환·결과 등장 시 짧은 반응 동작.

### 못 한 것
프레임 방식이라 신체 부위를 따로 움직일 수 없습니다.
임의 시점 깜박임, 말하는 입 모양, 고개 좌우 돌리기, 팔 임의 각도, 걷기, 시선 추적.
필요한 레이어는 `design-assets/turini-animation-v1/NEEDED_LAYERS.md` 참고.

---

## 2단계 — 학습 지도

### 새로 만든 파일
| 파일 | 내용 |
| --- | --- |
| `app/learning-map.tsx` | 금융 성장 지도 렌더링 (계산 없음, 받은 값만 그림) |
| `app/learning-map.css` | 카테고리 6종 테마, 노드 3상태, 반응형 |
| `tests/learning-map.test.mjs` | 로직 보존 검증 11개 |

### 고친 파일
- `app/layout.tsx` — CSS import 1줄
- `app/page.tsx` — `learning-path` 렌더 블록 → `<LearningMap>` 교체,
  `data-map-theme` 추가, `activeCategoryCurrentLesson` 파생값 1줄 추가

### 그대로 둔 것
- `app/category-progress.ts` — 손대지 않음. 지도는 이 파일의 함수만 import 합니다.
- `startLesson(category, lesson)` — 호출 방식·인자 동일
- 완료/현재/잠금 판정식 — `page.tsx` 에 그대로 남아 있고 지도는 결과만 받습니다
- 난이도 연결 (`categoryDifficultyForLesson`) — 지도가 표시에만 사용
- XP 지급 규칙 (`finished.correct * 10`) — 변경 없음. 지도는 최대 XP 표시만

---

## 3단계 — 나만의 투리니 꾸미기

### 새로 만든 파일
| 파일 | 내용 |
| --- | --- |
| `app/avatar-items.ts` | 공통 기준점(5곳), 6슬롯 아이템 20개, 해제 조건 순수 함수 |
| `app/turini-avatar.tsx` | 캐릭터 무대 + 꾸미기 화면 |
| `app/turini-avatar.css` | 무대·슬롯·아이템·저장 UI |
| `tests/avatar-items.test.mjs` | 해제 규칙·저장 안전성·가림 검사 12개 |
| `design-assets/turini-avatar/NEEDED_ITEM_ASSETS.md` | 실제 액세서리 자산 규격서 |

### 고친 파일
- `app/layout.tsx` — CSS import 1줄
- `app/turini-character.tsx` · `.css` — `frozen` 옵션 추가(꾸미기 화면에서 한 프레임 고정)
- `app/page.tsx` — `Progress.avatar` 추가, 기본값·정규화, 마이페이지에 꾸미기 화면 연결

### 저장 구조
`turini_users.progress` JSONB 안에 `avatar` 한 필드를 더 넣었습니다.
**DB 마이그레이션 없음, API 변경 없음.** 저장은 기존 `PUT /api/account` 경로를 그대로 탑니다.
해제 목록은 저장하지 않고 XP·레벨·연속 학습·카테고리 진도에서 매번 계산합니다.

### 실제 그림이 없어 남겨 둔 것
모자·안경·목·가방·손 소품은 **위치 확인용 임시 도형**이며 화면에 `개발 확인용` 으로 표시됩니다.
배경은 색만 쓰므로 지금이 최종본입니다. 규격은 위 자산 규격서 참고.

---

## 한 번도 건드리지 않은 파일

`app/quiz-scheduler.ts` · `app/answer-utils.ts` · `app/portfolio-rules.ts` ·
`app/wealth-planner.ts` · `app/category-progress.ts` · `app/diagnosis-utils.ts` ·
`app/auth-utils.ts` · `app/chatgpt-auth.ts` · `app/server/**` · `app/api/**` ·
`public/data/**` · `reference-data/**` · **`app/globals.css`**

`globals.css` 는 84KB 안에 같은 선택자가 2~5번씩 중복 정의돼 있어, 직접 고치는 대신
새 CSS 두 개를 `layout.tsx` 에서 그 뒤에 불러와 필요한 부분만 덮어쓰는 방식을 썼습니다.

---

## 검사

```
npm test    80 passed / 0 failed   (원래 49 + 캐릭터 8 + 지도 11 + 꾸미기 12)
npm run lint  통과
npm run build 통과
```

실제 브라우저(Chromium)로 320 / 360 / 390 / 768 / 1280px에서
6가지 진도 상태(0·1·3·6·11·12 완료)를 렌더해
노드·글자·캐릭터·카드의 상호 겹침과 화면 밖 이탈을 측정했습니다. **0건.**
