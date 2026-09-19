/**
 * 그림 파일이 전부 제자리에 있는지 확인합니다.
 *
 *   node scripts/check-assets.mjs
 *
 * 압축을 풀다가 일부 파일이 빠지면 캐릭터나 배경이 보이지 않습니다.
 * 그럴 때 무엇이 없는지 한 번에 알려 줍니다.
 */
import { existsSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const publicDir = path.join(root, "public");

/** [폴더, 있어야 하는 파일 수, 설명] */
const EXPECTED = [
  ["assets/turini/character/rig", 10, "캐릭터 분리 파츠 (홈·마이페이지 캐릭터)"],
  ["assets/turini/optimized/character/rig", 9, "캐릭터 분리 파츠 (가벼운 사본)"],
  ["assets/turini/animations", 3, "12프레임 애니메이션 + 프레임 기준점"],
  ["assets/turini/optimized/animations", 1, "애니메이션 (가벼운 사본)"],
  ["assets/turini/customization/hats", 9, "모자"],
  ["assets/turini/customization/glasses", 9, "안경"],
  ["assets/turini/customization/neck", 9, "목 액세서리"],
  ["assets/turini/customization/bags", 9, "가방"],
  ["assets/turini/backgrounds", 4, "배경"],
  ["assets/turini/optimized/backgrounds", 4, "배경 (가벼운 사본)"],
  ["assets/turini/worn/hats", 9, "모자 착용 미리보기"],
  ["assets/turini/worn/glasses", 9, "안경 착용 미리보기"],
  ["assets/turini/worn/neck", 9, "목 액세서리 착용 미리보기"],
  ["assets/turini/worn/bags", 9, "가방 착용 미리보기"],
  ["assets/turini/optimized/worn-thumb/hats", 9, "모자 목록 썸네일"],
  ["assets/turini/optimized/worn-thumb/glasses", 9, "안경 목록 썸네일"],
  ["assets/turini/optimized/worn-thumb/neck", 9, "목 액세서리 목록 썸네일"],
  ["assets/turini/optimized/worn-thumb/bags", 9, "가방 목록 썸네일"],
  ["assets/turini/turnaround", 3, "정면·3/4·뒷면 캐릭터"],
  ["data", 2, "문제 데이터"],
];

let problems = 0;
console.log("투리니 그림 파일 확인\n");

for (const [relative, expected, label] of EXPECTED) {
  const dir = path.join(publicDir, relative);
  if (!existsSync(dir)) {
    console.log(`  [없음]   ${label}\n           폴더가 아예 없습니다 → public/${relative}`);
    problems += 1;
    continue;
  }
  const files = (await readdir(dir)).filter((name) => !name.startsWith("."));
  if (files.length < expected) {
    console.log(`  [모자람] ${label}\n           ${files.length}개 / 있어야 할 ${expected}개 → public/${relative}`);
    problems += 1;
  } else {
    console.log(`  [정상]   ${label} (${files.length}개)`);
  }
}

console.log("");
if (problems === 0) {
  console.log("그림 파일이 모두 제자리에 있습니다.");
  console.log("그래도 캐릭터가 보이지 않으면 .next 폴더를 지우고 npm run dev 를 다시 실행해 주세요.");
} else {
  console.log(`${problems}곳에 문제가 있습니다.`);
  console.log("압축을 풀 때 일부 파일이 빠진 것으로 보입니다.");
  console.log("빈 폴더를 새로 만들고 zip 을 다시 풀어 주세요. (기존 폴더에 덮어쓰지 마세요)");
  process.exitCode = 1;
}
