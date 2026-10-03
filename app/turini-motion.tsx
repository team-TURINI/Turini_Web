"use client";

import { useEffect, useRef } from "react";

/**
 * 투리니 관절 애니메이션
 *
 * 정면 기본 그림(`worn-front/turini-base-front.png`)을 부위별로 잘라 둔 파츠
 * (`public/assets/turini-motion/*.webp`)를 SVG 안에서 관절마다 돌려 움직입니다.
 * 파츠는 모두 1024×1024 기준 좌표에 놓여 있어서, 그냥 겹치면 원래 그림과 같습니다.
 *
 *   머리(뿔 포함) · 귀 2 · 눈 2 · 눈썹 2 · 입 · 몸통 · 팔 2(손 포함) · 다리 2(발 포함)
 *
 * - 뿔은 머리에 붙어 있어 따로 흔들리지 않습니다.
 * - 팔은 어깨에서만 통째로 돌아갑니다(팔꿈치 없음).
 * - 표정(웃는 눈·감은 눈·벌린 입·시무룩한 입)과 O/X 팻말은 SVG로 그립니다.
 * - 프레임마다 React를 다시 그리지 않고 DOM 속성만 바꿉니다.
 * - 화면 밖에 있거나 탭이 가려지면 그리기를 쉬고, '동작 줄이기' 설정이면 한 장면으로 멈춥니다.
 */

export type TuriniMotionName =
  | "idle"
  | "greet"
  | "thinking"
  | "reading"
  | "correct"
  | "wrong"
  | "celebrate"
  | "loading";

const SRC = "/assets/turini-motion";

/** 파츠 위치(1024 기준)와 회전 중심 */
const PART = {
  earL: { x: 232, y: 184, w: 154, h: 148, pivot: [347, 262] },
  earR: { x: 652, y: 186, w: 153, h: 145, pivot: [690, 262] },
  head: { x: 297, y: 66, w: 443, h: 512, pivot: [518, 575] },
  eyeL: { x: 355, y: 350, w: 113, h: 117, pivot: [411, 408] },
  eyeR: { x: 569, y: 350, w: 113, h: 117, pivot: [625, 408] },
  browL: { x: 385, y: 298, w: 59, h: 35, pivot: [415, 316] },
  browR: { x: 592, y: 299, w: 59, h: 34, pivot: [622, 316] },
  mouth: { x: 465, y: 468, w: 107, h: 40, pivot: [518, 488] },
  armL: { x: 249, y: 602, w: 180, h: 219, pivot: [402, 628] },
  armR: { x: 609, y: 602, w: 178, h: 219, pivot: [635, 628] },
  legL: { x: 347, y: 810, w: 160, h: 189, pivot: [437, 840] },
  legR: { x: 530, y: 810, w: 160, h: 189, pivot: [597, 840] },
  body: { x: 360, y: 546, w: 318, h: 310, pivot: [518, 860] },
} as const;

type PartName = keyof typeof PART;
type Pt = readonly [number, number];

const ROOT: Pt = [518, 1000];
const TORSO: Pt = [518, 860];
/** 오른손(화면 기준) 쥐는 자리 — 팻말 막대가 여기서 위로 섭니다 */
const GRIP: Pt = [731, 770];

const DEF = {
  x: 0, y: 0, sx: 1, sy: 1, torso: 0,
  head: 0, headY: 0, headX: 0,
  earL: 0, earR: 0, armL: 0, armR: 0,
  legL: 0, legR: 0, legLY: 0, legRY: 0,
  eyeSY: 1, eyeDX: 0, eyeDY: 0, browY: 0, browL: 0, browR: 0,
  sign: 0, signTilt: 0,
};
type Pose = typeof DEF;
type PoseKey = keyof Pose;
type Partial2 = Partial<Pose>;
type Face = "normal" | "happy" | "sad" | "surprise" | "talk";
type EaseName = "linear" | "in" | "out" | "inout" | "back" | "elastic";

const EASE: Record<EaseName, (t: number) => number> = {
  linear: (t) => t,
  in: (t) => t * t * t,
  out: (t) => 1 - Math.pow(1 - t, 3),
  inout: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  back: (t) => {
    const c1 = 1.9;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },
  elastic: (t) =>
    t === 0 || t === 1 ? t : Math.pow(2, -9 * t) * Math.sin(((t * 10 - 0.75) * (2 * Math.PI)) / 3) + 1,
};

const rot = (a: number, p: Pt) => `rotate(${a.toFixed(2)} ${p[0]} ${p[1]})`;
const scl = (sx: number, sy: number, p: Pt) =>
  `translate(${p[0]} ${p[1]}) scale(${sx.toFixed(4)} ${sy.toFixed(4)}) translate(${-p[0]} ${-p[1]})`;
const rand = (a: number, b: number) => a + Math.random() * (b - a);

function PartImage({ name }: { name: PartName }) {
  const p = PART[name];
  return <image href={`${SRC}/${name}.webp`} x={p.x} y={p.y} width={p.w} height={p.h} preserveAspectRatio="none" />;
}

export type TuriniMotionProps = {
  motion?: TuriniMotionName;
  /** 값이 바뀌면 같은 동작이라도 처음부터 다시 재생합니다 */
  replayKey?: string | number;
  /** 정답·오답 팻말을 든 채로 계속 유지합니다 */
  holdLast?: boolean;
  /** false 면 한 장면으로 멈춥니다 */
  animated?: boolean;
  className?: string;
};

export default function TuriniMotion({
  motion = "idle",
  replayKey,
  holdLast = false,
  animated = true,
  className = "",
}: TuriniMotionProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    const q = <T extends Element = SVGGElement>(sel: string) => svg.querySelector(sel) as T | null;
    const J: Record<string, SVGGElement | null> = {};
    for (const k of ["root", "torso", "head", "earL", "earR", "armL", "armR", "legL", "legR", "eyeL", "eyeR", "browL", "browR", "sign"]) {
      J[k] = q(`[data-j="${k}"]`);
    }
    const F: Record<string, SVGGElement | null> = {};
    for (const k of ["eyesHappy", "eyesClosed", "mouthSmile", "mouthOpen", "mouthTalk", "mouthSad", "mouthO", "sweat", "signO", "signX"]) {
      F[k] = q(`[data-f="${k}"]`);
    }
    const shadow = q<SVGEllipseElement>("[data-shadow]");
    const fxLayer = q<SVGGElement>("[data-fx]");

    const reduce =
      typeof window !== "undefined" && window.matchMedia
        ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
        : false;
    const live = animated && !reduce;

    // ---------------- 상태 ----------------
    const pose: Pose = { ...DEF };
    let face: Face = "normal";
    let idleT = Math.random() * 10;
    let idleW = 1;
    let blinkV = 1;
    let earTw = 0;
    let talkOpen = false;
    let alive = true;
    let token = 0;
    let visible = true;
    type Tween = { from: Partial2; p: Partial2; d: number; e: EaseName; t0: number; res: () => void; my: number };
    const tweens = new Set<Tween>();
    type Particle = { el: SVGTextElement; x: number; y: number; vx: number; vy: number; g: number; life: number; t: number; r: number; vr: number; fade: number };
    const particles: Particle[] = [];
    const timers = new Set<ReturnType<typeof setTimeout>>();

    const show = (el: Element | null, on: boolean) => {
      if (el) el.setAttribute("display", on ? "inline" : "none");
    };
    const setFace = (f: Face) => {
      face = f;
      show(F.eyesHappy, f === "happy");
      show(F.mouthSmile, f === "normal");
      show(F.mouthOpen, f === "happy");
      show(F.mouthTalk, f === "talk" && talkOpen);
      show(F.mouthSad, f === "sad");
      show(F.mouthO, f === "surprise");
      show(F.sweat, f === "sad");
      if (f === "talk" && !talkOpen) show(F.mouthSmile, true);
    };
    const setSign = (k: "O" | "X") => {
      show(F.signO, k === "O");
      show(F.signX, k === "X");
    };

    const apply = () => {
      const t = idleT;
      const w = idleW;
      const br = Math.sin(t * 2.4);
      const P: Pose = { ...pose };
      P.sy *= 1 + 0.01 * br * w;
      P.sx *= 1 - 0.006 * br * w;
      P.headY += -4 * br * w;
      P.head += 1.5 * Math.sin(t * 1.1) * w;
      P.armL += 2.5 * br * w;
      P.armR -= 2.5 * br * w;
      P.earL += (2.5 * Math.sin(t * 1.7) + earTw) * w;
      P.earR -= (2.5 * Math.sin(t * 1.7 + 1) + earTw) * w;
      P.eyeSY *= blinkV;

      J.root?.setAttribute("transform", `translate(${P.x.toFixed(1)} ${P.y.toFixed(1)}) ${scl(P.sx, P.sy, ROOT)}`);
      J.torso?.setAttribute("transform", rot(P.torso, TORSO));
      J.head?.setAttribute("transform", `translate(${P.headX.toFixed(1)} ${P.headY.toFixed(1)}) ${rot(P.head, PART.head.pivot)}`);
      J.earL?.setAttribute("transform", rot(P.earL, PART.earL.pivot));
      J.earR?.setAttribute("transform", rot(P.earR, PART.earR.pivot));
      J.armL?.setAttribute("transform", rot(P.armL, PART.armL.pivot));
      J.armR?.setAttribute("transform", rot(P.armR, PART.armR.pivot));
      J.legL?.setAttribute("transform", `translate(0 ${P.legLY.toFixed(1)}) ${rot(P.legL, PART.legL.pivot)}`);
      J.legR?.setAttribute("transform", `translate(0 ${P.legRY.toFixed(1)}) ${rot(P.legR, PART.legR.pivot)}`);
      const eyeT = `translate(${P.eyeDX.toFixed(1)} ${P.eyeDY.toFixed(1)}) `;
      J.eyeL?.setAttribute("transform", eyeT + scl(1, Math.max(0.06, P.eyeSY), PART.eyeL.pivot));
      J.eyeR?.setAttribute("transform", eyeT + scl(1, Math.max(0.06, P.eyeSY), PART.eyeR.pivot));
      J.browL?.setAttribute("transform", `translate(0 ${P.browY.toFixed(1)}) ${rot(P.browL, PART.browL.pivot)}`);
      J.browR?.setAttribute("transform", `translate(0 ${P.browY.toFixed(1)}) ${rot(P.browR, PART.browR.pivot)}`);
      const closed = P.eyeSY < 0.35;
      const eyesHidden = face === "happy" || (closed && face !== "sad" && face !== "surprise");
      J.eyeL?.setAttribute("opacity", eyesHidden ? "0" : "1");
      J.eyeR?.setAttribute("opacity", eyesHidden ? "0" : "1");
      show(F.eyesClosed, closed && face !== "happy");
      // 팻말은 팔이 돌아간 만큼 되돌려서 늘 위로 서 있습니다
      J.sign?.setAttribute("transform", `${rot(-P.armR + P.signTilt, GRIP)} ${scl(P.sign, P.sign, GRIP)}`);
      const lift = Math.max(0, -P.y);
      if (shadow) {
        const s = 1 - Math.min(lift, 300) / 600;
        shadow.setAttribute("transform", scl(s, s, [518, 996]));
        shadow.setAttribute("opacity", (1 - Math.min(lift, 300) / 700).toFixed(3));
      }
      for (const pt of particles) {
        pt.el.setAttribute("transform", `translate(${pt.x.toFixed(1)} ${pt.y.toFixed(1)}) rotate(${pt.r.toFixed(1)})`);
        pt.el.setAttribute("opacity", Math.max(0, Math.min(1, pt.fade)).toFixed(2));
      }
    };

    // ---------------- 트윈 ----------------
    const to = (p: Partial2, d: number, e: EaseName = "inout") => {
      const my = token;
      return new Promise<void>((res) => {
        const from: Partial2 = {};
        (Object.keys(p) as PoseKey[]).forEach((k) => {
          from[k] = pose[k];
        });
        tweens.add({ from, p, d, e, t0: performance.now(), res, my });
      });
    };
    const wait = (ms: number) =>
      new Promise<void>((res) => {
        const id = setTimeout(() => {
          timers.delete(id);
          res();
        }, ms);
        timers.add(id);
      });
    const ok = (my: number) => alive && my === token;

    // ---------------- 효과 (SVG 글자라 크기에 맞춰 같이 커지고 작아집니다) ----------------
    const spawn = (ch: string, x: number, y: number, vx: number, vy: number, g: number, life: number, size: number) => {
      if (!fxLayer || !live) return;
      const el = document.createElementNS("http://www.w3.org/2000/svg", "text");
      el.textContent = ch;
      el.setAttribute("font-size", String(size));
      el.setAttribute("text-anchor", "middle");
      el.setAttribute("dominant-baseline", "central");
      if (/^[?!.]+$/.test(ch)) {
        el.setAttribute("fill", "#2f8f2a");
        el.setAttribute("font-weight", "800");
        el.setAttribute("stroke", "#ffffff");
        el.setAttribute("stroke-width", "10");
        el.setAttribute("paint-order", "stroke");
      }
      fxLayer.appendChild(el);
      particles.push({ el, x, y, vx, vy, g, life, t: 0, r: rand(-30, 30), vr: rand(-120, 120), fade: 1 });
    };
    const burst = (chars: string[], n = 14) => {
      for (let i = 0; i < n; i++) {
        const a = rand(0, Math.PI * 2);
        const s = rand(380, 720);
        spawn(chars[i % chars.length], 518 + rand(-40, 40), 420, Math.cos(a) * s, Math.sin(a) * s - 380, 900, rand(1.1, 1.6), rand(85, 120));
      }
    };
    const floatUp = (chars: string[], n = 3, x = 518, y = 230) => {
      chars.slice(0, n).forEach((ch, i) => {
        const id = setTimeout(() => {
          timers.delete(id);
          spawn(ch, x + rand(-160, 160), y, rand(-40, 40), -rand(160, 240), 0, 1.5, ch === "?" ? 190 : rand(100, 130));
        }, i * 160);
        timers.add(id);
      });
    };

    // ---------------- 프레임 ----------------
    let raf = 0;
    let last = performance.now();
    const frame = (now: number) => {
      if (!alive) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      idleT += dt;
      for (const tw of [...tweens]) {
        if (tw.my !== token) {
          tweens.delete(tw);
          tw.res();
          continue;
        }
        const k = Math.min(1, (now - tw.t0) / tw.d);
        const v = EASE[tw.e](k);
        (Object.keys(tw.p) as PoseKey[]).forEach((key) => {
          const a = tw.from[key] ?? pose[key];
          const b = tw.p[key] ?? a;
          pose[key] = a + (b - a) * v;
        });
        if (k >= 1) {
          tweens.delete(tw);
          tw.res();
        }
      }
      for (let i = particles.length - 1; i >= 0; i--) {
        const pt = particles[i];
        pt.t += dt;
        pt.vy += pt.g * dt;
        pt.x += pt.vx * dt;
        pt.y += pt.vy * dt;
        pt.vx *= 0.985;
        pt.r += pt.vr * dt;
        pt.fade = pt.t < pt.life * 0.6 ? 1 : 1 - (pt.t - pt.life * 0.6) / (pt.life * 0.4);
        if (pt.t >= pt.life) {
          pt.el.remove();
          particles.splice(i, 1);
        }
      }
      if (visible) apply();
      raf = requestAnimationFrame(frame);
    };

    // 눈 깜박임 · 귀 쫑긋 · 말하는 입
    const loopTimer = (fn: () => void, min: number, max: number) => {
      const tick = () => {
        if (!alive) return;
        fn();
        const id = setTimeout(() => {
          timers.delete(id);
          tick();
        }, rand(min, max));
        timers.add(id);
      };
      const id = setTimeout(() => {
        timers.delete(id);
        tick();
      }, rand(min, max));
      timers.add(id);
    };
    const pulse = (ms: number, set: (k: number) => void) => {
      const s = performance.now();
      const step = () => {
        if (!alive) return;
        const k = (performance.now() - s) / ms;
        set(Math.min(1, k));
        if (k < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    };

    // ---------------- 동작 ----------------
    async function begin(f: Face = "normal") {
      token++;
      tweens.clear();
      const my = token;
      setFace(f);
      idleW = 0.4;
      return my;
    }

    async function jump(my: number, h = 170, armUp = 62) {
      await to({ sy: 0.84, sx: 1.1, y: 0, headY: 10, armL: -14, armR: 14, earL: -8, earR: 8, legL: 2, legR: -2 }, 190, "out");
      if (!ok(my)) return;
      to({ sy: 1.1, sx: 0.93, armL: armUp, armR: -armUp, earL: -26, earR: 26, headY: -6, legLY: -22, legRY: -22, legL: -6, legR: 6 }, 220, "out");
      await to({ y: -h }, 300, "out");
      if (!ok(my)) return;
      to({ sy: 1.04, sx: 0.97, armL: 20, armR: -20, earL: 16, earR: -16, legLY: 0, legRY: 0, legL: 3, legR: -3 }, 260, "inout");
      await to({ y: 0 }, 240, "in");
      if (!ok(my)) return;
      await to({ sy: 0.86, sx: 1.1, headY: 12, earL: -14, earR: 14, armL: -6, armR: 6 }, 95, "out");
      if (!ok(my)) return;
      await to({ sy: 1, sx: 1, headY: 0, earL: 0, earR: 0, armL: 0, armR: 0, legL: 0, legR: 0 }, 360, "elastic");
    }

    async function settle(my: number) {
      if (!ok(my)) return;
      await to({ ...DEF }, 420, "inout");
      if (ok(my)) idleW = 1;
    }

    async function wave(my: number, times = 3) {
      setFace("happy");
      await to({ armL: 118, head: 8, torso: 2, earL: -10, browY: -5 }, 420, "back");
      for (let i = 0; i < times && ok(my); i++) {
        await to({ armL: 104, head: 10 }, 190, "inout");
        await to({ armL: 130, head: 7 }, 190, "inout");
      }
      if (!ok(my)) return;
      await to({ armL: 0, head: 0, torso: 0, earL: 0, browY: 0 }, 380, "inout");
      if (ok(my)) setFace("normal");
    }

    async function idleGestures(my: number, greetSometimes: boolean) {
      while (ok(my)) {
        await wait(rand(5200, 9000));
        if (!ok(my)) return;
        const r = Math.random();
        idleW = 0.5;
        if (r < 0.25) {
          setFace("happy");
          await jump(my, 80, 30);
          if (ok(my)) setFace("normal");
        } else if (r < 0.5) {
          await to({ eyeDX: -9, head: -5 }, 320, "inout");
          await wait(700);
          if (!ok(my)) return;
          await to({ eyeDX: 9, head: 5 }, 420, "inout");
          await wait(700);
          if (!ok(my)) return;
          await to({ eyeDX: 0, head: 0 }, 320, "inout");
        } else if (r < 0.72 || !greetSometimes) {
          setFace("happy");
          await to({ head: -8, torso: -2, earL: -12, earR: 6, armL: 14 }, 320, "inout");
          await to({ head: 8, torso: 2, earL: -6, earR: 12, armL: 0, armR: -14 }, 320, "inout");
          await to({ head: 0, torso: 0, earL: 0, earR: 0, armR: 0 }, 300, "inout");
          if (ok(my)) setFace("normal");
        } else {
          await wave(my, 2);
        }
        if (ok(my)) idleW = 1;
      }
    }

    async function signUp(my: number, kind: "O" | "X", arm: number) {
      setSign(kind);
      await to({ armR: arm, sign: 1, signTilt: kind === "O" ? 12 : 0 }, 420, "back");
      return ok(my);
    }

    const scripts: Record<TuriniMotionName, (my: number) => Promise<void>> = {
      async idle(my) {
        await settle(my);
        await idleGestures(my, false);
      },

      async greet(my) {
        await settle(my);
        idleW = 0.5;
        await wave(my, 3);
        if (ok(my)) idleW = 1;
        await idleGestures(my, true);
      },

      async thinking(my) {
        await settle(my);
        let side = 1;
        while (ok(my)) {
          idleW = 0.6;
          await to({ head: 9 * side, torso: 1.5 * side, eyeDX: 8 * side, eyeDY: -7, browY: -4, browL: side > 0 ? -6 : 4, browR: side > 0 ? -4 : 6, earL: -6, earR: 6, armL: 10, armR: -6 }, 650, "inout");
          if (!ok(my)) return;
          if (Math.random() < 0.6) floatUp(["?"], 1, 518 + 120 * side, 150);
          await wait(rand(1300, 2100));
          if (!ok(my)) return;
          await to({ head: 2 * side, eyeDX: 0, eyeDY: -2, browL: 0, browR: 0 }, 420, "inout");
          await wait(rand(500, 900));
          side = -side;
        }
      },

      async reading(my) {
        await settle(my);
        idleW = 0.7;
        let open = false;
        const mouthTick = async () => {
          while (ok(my)) {
            if (face === "talk") {
              open = !open;
              talkOpen = open;
              setFace("talk");
            }
            await wait(open ? rand(120, 180) : rand(110, 200));
          }
        };
        void mouthTick();
        while (ok(my)) {
          setFace("talk");
          // 고개 끄덕이며 손짓으로 설명
          for (let i = 0; i < 3 && ok(my); i++) {
            to({ armR: -38, head: -4 }, 360, "inout");
            await to({ headY: 6, browY: -3 }, 360, "inout");
            to({ armR: -18, head: 3 }, 360, "inout");
            await to({ headY: -2, browY: 0 }, 360, "inout");
          }
          if (!ok(my)) return;
          talkOpen = false;
          setFace("normal");
          await to({ armR: 0, head: 0, headY: 0 }, 420, "inout");
          await wait(rand(900, 1600));
          if (!ok(my)) return;
          if (Math.random() < 0.35) {
            setFace("happy");
            await to({ head: 6, earL: -10, earR: 10 }, 300, "inout");
            await wait(500);
            await to({ head: 0, earL: 0, earR: 0 }, 300, "inout");
          }
        }
      },

      async correct(my) {
        setFace("happy");
        if (!(await signUp(my, "O", -110))) return;
        burst(["🎉", "✨", "⭐", "💚"]);
        to({ armL: 55, head: -6, earL: -16, earR: 16, browY: -5 }, 300, "back");
        for (let i = 0; i < 2 && ok(my); i++) {
          await to({ sy: 0.88, sx: 1.07, armL: 25 }, 130, "out");
          to({ sy: 1.07, sx: 0.95, armL: 80, legLY: -20, legRY: -20, earL: -24, earR: 24, signTilt: -10 }, 190, "out");
          await to({ y: -130 }, 240, "out");
          to({ sy: 1, sx: 1, armL: 50, legLY: 0, legRY: 0, earL: 8, earR: -8, signTilt: 12 }, 210, "inout");
          await to({ y: 0 }, 210, "in");
          await to({ sy: 0.92, sx: 1.06 }, 90, "out");
          await to({ sy: 1, sx: 1 }, 150, "out");
        }
        if (!ok(my)) return;
        if (!holdLast) {
          await wait(500);
          await to({ sign: 0, armR: 0, armL: 0, head: 0, signTilt: 0 }, 380, "inout");
          if (ok(my)) setFace("normal");
          await settle(my);
          await idleGestures(my, false);
          return;
        }
        // 팻말을 든 채로 즐겁게 흔들기
        await to({ armL: 10, head: 0, earL: 0, earR: 0 }, 400, "inout");
        idleW = 0.8;
        while (ok(my)) {
          await to({ signTilt: -8, armR: -114, head: -3 }, 520, "inout");
          await to({ signTilt: 12, armR: -106, head: 3 }, 520, "inout");
          if (Math.random() < 0.3 && ok(my)) {
            await to({ sy: 0.92, sx: 1.05 }, 120, "out");
            await to({ y: -60, sy: 1.04, sx: 0.97 }, 170, "out");
            await to({ y: 0, sy: 1, sx: 1 }, 170, "in");
          }
        }
      },

      async wrong(my) {
        setFace("sad");
        to({ browL: -14, browR: 14, browY: 4, earL: -28, earR: 28, sy: 0.96, headY: 8, armL: -8, eyeDY: 6 }, 400, "out");
        if (!(await signUp(my, "X", -100))) return;
        for (let i = 0; i < 3 && ok(my); i++) {
          to({ signTilt: -12 }, 140, "inout");
          await to({ head: -11, torso: -2, eyeDX: -6 }, 140, "inout");
          to({ signTilt: 12 }, 140, "inout");
          await to({ head: 11, torso: 2, eyeDX: 6 }, 140, "inout");
        }
        if (!ok(my)) return;
        await to({ head: 0, torso: 0, eyeDX: 0, signTilt: 0, sy: 0.92, sx: 1.03, headY: 14, eyeSY: 0.75 }, 500, "inout");
        if (!ok(my)) return;
        if (!holdLast) {
          await wait(500);
          await to({ sign: 0, armR: 0, sy: 1, sx: 1, headY: 0, eyeSY: 1 }, 420, "inout");
          if (ok(my)) setFace("normal");
          await settle(my);
          await idleGestures(my, false);
          return;
        }
        await to({ sy: 0.97, sx: 1.01, headY: 8, eyeSY: 1 }, 500, "inout");
        idleW = 0.8;
        while (ok(my)) {
          await wait(rand(1800, 2800));
          if (!ok(my)) return;
          to({ signTilt: -8 }, 260, "inout");
          await to({ head: -6 }, 260, "inout");
          to({ signTilt: 8 }, 260, "inout");
          await to({ head: 6 }, 260, "inout");
          await to({ head: 0, signTilt: 0 }, 260, "inout");
        }
      },

      async celebrate(my) {
        setFace("happy");
        burst(["🎉", "✨", "⭐", "💛"], 16);
        for (let i = 0; i < 4 && ok(my); i++) {
          const d = i % 2 ? 1 : -1;
          to({ x: 32 * d, torso: 7 * d, head: -10 * d, armL: d > 0 ? 110 : 30, armR: d > 0 ? -30 : -110, legL: d > 0 ? 9 : -3, legR: d > 0 ? 3 : -9, legLY: d > 0 ? -16 : 0, legRY: d > 0 ? 0 : -16, earL: -14 * d, earR: -14 * d }, 250, "inout");
          await to({ y: -55, sy: 1.05, sx: 0.96 }, 125, "out");
          await to({ y: 0, sy: 0.93, sx: 1.05 }, 125, "in");
        }
        if (!ok(my)) return;
        await to({ x: 0, torso: 0, head: 0, armL: 0, armR: 0, legL: 0, legR: 0, legLY: 0, legRY: 0, sy: 1, sx: 1, earL: 0, earR: 0 }, 260, "inout");
        await jump(my, 180, 75);
        while (ok(my)) {
          await wait(rand(2400, 3600));
          if (!ok(my)) return;
          if (Math.random() < 0.5) {
            burst(["✨", "⭐", "💛"], 8);
            await jump(my, 130, 70);
          } else {
            floatUp(["🎵", "✨"], 2);
            for (let i = 0; i < 2 && ok(my); i++) {
              const d = i % 2 ? 1 : -1;
              await to({ torso: 6 * d, head: -8 * d, armL: d > 0 ? 70 : 10, armR: d > 0 ? -10 : -70, earL: -10 * d, earR: -10 * d }, 300, "inout");
            }
            await to({ torso: 0, head: 0, armL: 0, armR: 0, earL: 0, earR: 0 }, 300, "inout");
          }
        }
      },

      async loading(my) {
        await settle(my);
        setFace("happy");
        let n = 0;
        while (ok(my)) {
          idleW = 0.3;
          const d = n % 2 ? 1 : -1;
          await to({ sy: 0.9, sx: 1.06, head: 4 * d }, 120, "out");
          to({ sy: 1.05, sx: 0.97, armL: d > 0 ? 40 : 15, armR: d > 0 ? -15 : -40, earL: -16, earR: 16, legLY: -10, legRY: -10 }, 160, "out");
          await to({ y: -70 }, 200, "out");
          to({ sy: 1, sx: 1, armL: 5, armR: -5, earL: 8, earR: -8, legLY: 0, legRY: 0 }, 180, "inout");
          await to({ y: 0 }, 180, "in");
          n++;
          if (n % 4 === 0) {
            setFace("normal");
            await to({ sy: 1, sx: 1, head: 0, eyeDX: -8 }, 300, "inout");
            await wait(380);
            await to({ eyeDX: 8 }, 360, "inout");
            await wait(380);
            await to({ eyeDX: 0 }, 260, "inout");
            if (ok(my)) setFace("happy");
          }
        }
      },
    };

    // ---------------- 정지 화면(동작 줄이기) ----------------
    const still = () => {
      const P: Partial2 = {};
      if (motion === "correct") {
        setFace("happy");
        setSign("O");
        Object.assign(P, { armR: -110, sign: 1, signTilt: 6 });
      } else if (motion === "wrong") {
        setFace("sad");
        setSign("X");
        Object.assign(P, { armR: -100, sign: 1, browL: -14, browR: 14, earL: -24, earR: 24 });
      } else if (motion === "celebrate" || motion === "greet" || motion === "loading") {
        setFace("happy");
      } else {
        setFace("normal");
      }
      Object.assign(pose, DEF, P);
      idleW = 0;
      apply();
    };

    if (!live) {
      still();
      return () => {
        alive = false;
      };
    }

    // 화면 밖이면 그리기를 쉽니다
    let io: IntersectionObserver | null = null;
    if (typeof IntersectionObserver !== "undefined") {
      io = new IntersectionObserver((entries) => {
        visible = entries.some((e) => e.isIntersecting);
      });
      io.observe(svg);
    }

    loopTimer(() => {
      const twice = Math.random() < 0.22;
      pulse(150, (k) => {
        blinkV = k < 0.5 ? 1 - k * 1.9 : Math.min(1, 0.05 + (k - 0.5) * 1.9);
        if (k >= 1 && twice) {
          const id = setTimeout(() => {
            timers.delete(id);
            pulse(140, (k2) => {
              blinkV = k2 < 0.5 ? 1 - k2 * 1.9 : Math.min(1, 0.05 + (k2 - 0.5) * 1.9);
            });
          }, 90);
          timers.add(id);
        }
      });
    }, 2200, 4800);
    loopTimer(() => {
      pulse(500, (k) => {
        earTw = k < 1 ? 13 * Math.sin(k * Math.PI * 3) * (1 - k) : 0;
      });
    }, 3800, 7600);

    setFace("normal");
    apply();
    raf = requestAnimationFrame(frame);
    void (async () => {
      const my = await begin(face);
      await scripts[motion](my);
    })();

    return () => {
      alive = false;
      token++;
      cancelAnimationFrame(raf);
      timers.forEach((id) => clearTimeout(id));
      timers.clear();
      tweens.clear();
      particles.forEach((p) => p.el.remove());
      io?.disconnect();
    };
  }, [motion, replayKey, holdLast, animated]);

  return (
    <svg
      ref={svgRef}
      className={`turini-motion ${className}`.trim()}
      viewBox="0 0 1024 1024"
      aria-hidden="true"
      focusable="false"
    >
      <ellipse data-shadow cx="518" cy="996" rx="170" ry="24" fill="rgba(60, 45, 20, 0.16)" />
      <g data-j="root">
        <g data-j="legL"><PartImage name="legL" /></g>
        <g data-j="legR"><PartImage name="legR" /></g>
        <g data-j="torso">
          <PartImage name="body" />
          <g data-j="armL"><PartImage name="armL" /></g>
          <g data-j="armR">
            <g data-j="sign" transform="scale(0)">
              <rect x="722" y="430" width="18" height="355" rx="9" fill="#A86F3E" />
              <rect x="726" y="430" width="5" height="355" rx="2.5" fill="#C98E57" />
              <rect x="611" y="250" width="240" height="200" rx="34" fill="#E6CFA3" />
              <rect x="621" y="258" width="220" height="182" rx="28" fill="#ffffff" />
              <g data-f="signO">
                <circle cx="731" cy="349" r="62" fill="none" stroke="#58CC02" strokeWidth="28" />
              </g>
              <g data-f="signX" display="none">
                <path d="M676 294 L786 404 M786 294 L676 404" stroke="#FF4B4B" strokeWidth="30" strokeLinecap="round" />
              </g>
            </g>
            <PartImage name="armR" />
          </g>
          <g data-j="head">
            <g data-j="earL"><PartImage name="earL" /></g>
            <g data-j="earR"><PartImage name="earR" /></g>
            <PartImage name="head" />
            <g data-j="browL"><PartImage name="browL" /></g>
            <g data-j="browR"><PartImage name="browR" /></g>
            <g data-j="eyeL"><PartImage name="eyeL" /></g>
            <g data-j="eyeR"><PartImage name="eyeR" /></g>
            <g data-f="eyesHappy" display="none" stroke="#3a2314" strokeWidth="13" fill="none" strokeLinecap="round">
              <path d="M364 428 Q411 360 458 428" />
              <path d="M578 428 Q625 360 672 428" />
            </g>
            <g data-f="eyesClosed" display="none" stroke="#3a2314" strokeWidth="10" fill="none" strokeLinecap="round">
              <path d="M362 406 Q411 438 460 406" />
              <path d="M576 406 Q625 438 674 406" />
            </g>
            <g data-f="mouthSmile"><PartImage name="mouth" /></g>
            <g data-f="mouthOpen" display="none">
              <path d="M466 472 Q518 482 570 472 Q564 545 518 547 Q472 545 466 472 Z" fill="#8E1C22" />
              <path d="M488 528 Q518 512 548 528 Q540 545 518 546 Q496 545 488 528 Z" fill="#F07A80" />
              <path d="M474 476 Q518 484 562 476 L560 486 Q518 494 476 486 Z" fill="#fff" opacity=".9" />
            </g>
            <g data-f="mouthTalk" display="none">
              <path d="M484 476 Q518 482 552 476 Q548 516 518 518 Q488 516 484 476 Z" fill="#8E1C22" />
              <path d="M498 506 Q518 498 538 506 Q532 517 518 517 Q504 517 498 506 Z" fill="#F07A80" />
            </g>
            <g data-f="mouthSad" display="none">
              <path d="M480 504 Q518 470 556 504" stroke="#8E1C22" strokeWidth="11" fill="none" strokeLinecap="round" />
            </g>
            <g data-f="mouthO" display="none">
              <ellipse cx="518" cy="492" rx="20" ry="24" fill="#8E1C22" />
            </g>
            <g data-f="sweat" display="none">
              <path d="M712 236 Q740 286 740 304 A28 28 0 1 1 684 304 Q684 286 712 236 Z" fill="#7CC8FF" stroke="#fff" strokeWidth="6" />
            </g>
          </g>
        </g>
      </g>
      <g data-fx />
    </svg>
  );
}
