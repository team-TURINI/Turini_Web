"use client";

import { useEffect } from "react";

/**
 * 화면을 그리다 문제가 생겨도 흰 화면이 나오지 않도록 받아 주는 자리입니다.
 * (Next.js 가 이 파일을 자동으로 씁니다)
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[turini]", error);
  }, [error]);

  return (
    <main className="app-error">
      <div>
        <p className="eyebrow">잠시 문제가 생겼어요</p>
        <h1>화면을 불러오지 못했어요</h1>
        <p className="app-error__copy">
          학습 기록은 계정에 그대로 저장돼 있어요. 다시 시도해도 같은 화면이 나오면 잠시 뒤에 열어 주세요.
        </p>
        <button className="primary-button" onClick={reset}>
          다시 시도
        </button>
      </div>
    </main>
  );
}
