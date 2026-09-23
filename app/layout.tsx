import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
// turini-sprite.css 를 먼저 두면, 자리별 크기를 정하는 turini-character.css 의
// `.turini-quiz` 같은 규칙이 스프라이트의 기본 폭보다 우선합니다.
import "./turini-sprite.css";
import "./turini-rig.css";
import "./turini-character.css";
import "./learning-map.css";
import "./turini-avatar.css";
import "./difficulty-select.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Turini | 배우고 설계하는 금융 습관",
  description: "검증한 864문항, 포트폴리오 AI 코칭, 미래 자산 시뮬레이션을 제공하는 금융 학습 앱",
  other: {
    "codex-preview": "development",
    // 한국어 금융 용어를 브라우저 자동 번역이 다시 번역해
    // '채권→처벌', '학습→연극 학습'처럼 바꾸지 못하게 합니다.
    google: "notranslate",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" translate="no" className="notranslate" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased notranslate`}
      >
        {children}
      </body>
    </html>
  );
}
