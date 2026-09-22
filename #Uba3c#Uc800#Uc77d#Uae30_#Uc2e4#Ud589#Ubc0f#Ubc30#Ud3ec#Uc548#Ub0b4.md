# 투리니 파일을 받은 뒤 가장 먼저 할 일

이 폴더는 현재 투리니 앱의 전체 소스입니다. `app`, `public`, `tests`, `scripts` 폴더와 `package.json`, `package-lock.json`을 함께 보관해야 합니다. `app/page.tsx`만 따로 보내면 앱이 정상 작동하지 않습니다.

## 바로 실행하기

1. Node.js 22.13 이상을 설치합니다.
2. ZIP 파일의 압축을 풉니다.
3. 압축을 푼 폴더에서 터미널을 엽니다.
4. `npm ci`를 입력합니다.
5. 설치가 끝나면 `npm run dev`를 입력합니다.
6. 터미널에 나온 주소를 브라우저에서 엽니다.

## 다른 사람이 접속할 수 있게 공개 배포하기

이 ZIP을 ChatGPT Work에 첨부한 뒤 아래 문장을 그대로 보내면 됩니다.

> 이 ZIP의 투리니 앱 전체 소스로 새 Sites 프로젝트를 만들어줘. 기존 사이트를 수정하지 말고 새 프로젝트로 만들고, 배포 전에 자동 검사를 실행한 다음 누구나 접속할 수 있게 공개 배포해줘. `.openai/hosting.json`의 기존 project_id는 재사용하지 말고 새 프로젝트의 값으로 교체해줘.

## 꼭 알아둘 점

- 계정과 진도 저장에는 PostgreSQL `DATABASE_URL`이 필요합니다. Neon의 pooled connection string을 권장합니다.
- GPT 포트폴리오 코칭을 사용하려면 서버 환경에 `OPENAI_API_KEY`가 필요합니다. 키가 없을 때도 규칙 분석은 표시됩니다.
- 환경변수 예시는 `.env.example`을 확인하고, 실제 키는 GitHub에 올리지 않습니다.
- 사용자 진도는 로그인 아이디에 연결되므로 다른 기기에서도 같은 아이디로 이어서 학습할 수 있습니다.
- 배포 전 `npm test`, `npm run lint`, `npm run build`를 모두 실행합니다.

자세한 파일 설명과 검사 방법은 `README.md`에 있습니다.
