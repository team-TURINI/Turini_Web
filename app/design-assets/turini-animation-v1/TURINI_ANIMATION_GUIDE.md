# 투리니 애니메이션 자산 V1

## 포함 파일

- `turini-animation-atlas-v1.png`: 실제 투명 배경의 1024×1536 PNG
- `turini-animation-atlas-v1.json`: 프레임 크기와 동작별 행 정보
- `turini-animation-atlas-v1.css`: 바로 사용할 수 있는 CSS 프레임 애니메이션

## 프레임 구성

각 프레임은 256×256이며 한 동작당 4프레임입니다.

| 행 | 클래스 | 동작 |
|---|---|---|
| 1 | `turini-idle` | 기본·호흡·눈 깜박임 |
| 2 | `turini-thinking` | 생각·전구·표정 변화 |
| 3 | `turini-correct` | 체크 팻말·기쁨 |
| 4 | `turini-wrong` | X 팻말·아쉬움 |
| 5 | `turini-celebrate` | 점프·축하 |
| 6 | `turini-reading` | 독서·눈 깜박임·페이지 동작 |

## 사용 예시

```html
<link rel="stylesheet" href="/assets/turini-animation-atlas-v1.css" />
<span class="turini-animated turini-idle" role="img" aria-label="투리니"></span>
```

React에서는 상태에 따라 두 번째 클래스만 바꾸면 됩니다.

```tsx
<span className={`turini-animated turini-${state}`} role="img" aria-label="투리니" />
```

정답·오답·축하 동작을 다시 실행할 때는 요소의 `key`를 결과마다 변경하거나 클래스를 제거한 다음 다시 추가합니다.

## 클로드 작업 지시사항

1. 기존 정답 체크 팻말과 오답 X 팻말의 의미를 바꾸지 않습니다.
2. 캐릭터 영역은 정사각형으로 유지하고 부모 요소는 `overflow: visible`로 둡니다.
3. 모바일에서 귀와 팻말이 잘리지 않는지 320px과 390px 너비에서 확인합니다.
4. 기존 퀴즈 판정·문항·포트폴리오·자산관리 로직은 수정하지 않습니다.
5. 이 시트는 연속 프레임 방식입니다. 신체 부위를 실시간으로 자유롭게 조작하는 Rive 리깅 파일은 아닙니다.
