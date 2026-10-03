const ENDINGS = /(입니다|입니까|합니다|합니까|됩니다|됩니까|한다|된다|이다)$/u;

const YES_ANSWERS = new Set(["예", "네", "맞다", "맞아요", "맞습니다", "맞음", "그렇다", "그래요", "그렇습니다", "그렇죠", "그렇지요", "yes", "true", "참", "o"]);
const NO_ANSWERS = new Set(["아니오", "아니요", "아니다", "아니에요", "아닙니다", "아님", "그렇지않다", "그렇지않아요", "그렇지않습니다", "맞지않다", "맞지않아요", "틀리다", "틀립니다", "no", "false", "거짓", "x"]);

/** 조사가 붙은 경계는 명시해, '효과' 같은 용어 속 글자를 조사로 지우지 않습니다. */
const TERM_GROUPS: Record<string, string[]> = {
  "매매차익과 배당금": ["매매차익", "배당금"],
  "폰지·친근감 사기": ["폰지", "친근감 사기"],
  "음의 상관관계": ["음", "상관관계"],
  "시장과 비슷하다": ["시장", "비슷하다"],
  "72의 법칙": ["72", "법칙"],
  "화폐의 시간가치": ["화폐", "시간가치"],
};

const SYNONYMS: Array<[RegExp, string]> = [
  [/(상장지수펀드|이티에프|etf)/gu, "etf"],
  [/(시세차익|자본이득|매매차익)/gu, "매매차익"],
  [/(배당금|배당)/gu, "배당"],
  [/(떨어짐|떨어진다|내려감|내려간다|하락)/gu, "하락"],
  [/(오름|오른다|올라감|올라간다|상승)/gu, "상승"],
  [/(낮아진다|낮아집니다|작아진다|작아집니다|감소한다|감소합니다|줄어든다|줄어듭니다)/gu, "감소"],
  [/(높아진다|높아집니다|커진다|커집니다|증가한다|증가합니다|늘어난다|늘어납니다)/gu, "증가"],
  [/(재조정|비중조정|자산재배분|리밸런싱)/gu, "리밸런싱"],
  [/(분산투자|위험분산)/gu, "분산투자"],
  [/(주식보유자|기업의일부소유자|기업소유자|주주)/gu, "주주"],
  [/(채권보유자|돈을빌려준사람|채권자)/gu, "채권자"],
];

export function normalizeAnswer(value: string) {
  let normalized = value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/퍼센트/gu, "%")
    .replace(/[\s,·'"“”‘’()\[\]{}!?。]/gu, "")
    // 소수점은 보존하고, 문장 부호로 쓰인 마침표만 제외합니다.
    .replace(/(?<!\d)\.|\.(?!\d)/gu, "")
    .replace(/[−–]/gu, "-")
    .replace(/^약(?=[+-]?\d)/u, "")
    .replace(/^([0-9]+)원$/u, "$1")
    .replace(/(?<=[\d만억천])원$/u, "");
  for (const [pattern, replacement] of SYNONYMS) normalized = normalized.replace(pattern, replacement);
  normalized = normalized
    .replace(ENDINGS, "")
    .replace(ENDINGS, "")
    .replace(/(?<=[\d만억천])원$/u, "");
  if (YES_ANSWERS.has(normalized)) return "yes";
  if (NO_ANSWERS.has(normalized)) return "no";
  return normalized;
}

function answerTerms(answer: string) {
  const text = answer.normalize("NFKC").trim().replace(/\s+/gu, " ");
  if (TERM_GROUPS[text]) return TERM_GROUPS[text];
  // 숫자·단위·부호가 있는 정답은 용어 조합으로 분해하지 않습니다.
  if (/\d/u.test(text)) return [];
  const terms = text.split(/\s+|[,·&]/u).filter(Boolean);
  return terms.length > 1 ? terms : [];
}

const CONNECTOR = "(?:과|와|및|그리고|이랑|랑|하고|의|은|는|이|가|을|를|도|[,·/&+])*";
const TRAILING_PARTICLE = "(?:은|는|이|가|을|를|도)?";
const escapePattern = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");

/** 필요한 단어가 모두 있어야 하며, 순서·띄어쓰기·연결 조사 차이만 허용합니다. */
function matchesAllTerms(actual: string, terms: string[]) {
  const normalizedTerms = terms.map(normalizeAnswer).map(escapePattern);
  // 현재 데이터는 최대 3개 단어입니다. 긴 미래 정답은 순서를 유지합니다.
  if (normalizedTerms.length > 5) {
    return new RegExp(`^${normalizedTerms.join(CONNECTOR)}${TRAILING_PARTICLE}$`, "u").test(actual);
  }
  const match = (remaining: string[], ordered: string[]): boolean => {
    if (!remaining.length) {
      return new RegExp(`^${ordered.join(CONNECTOR)}${TRAILING_PARTICLE}$`, "u").test(actual);
    }
    return remaining.some((term, index) => match(
      remaining.filter((_, termIndex) => termIndex !== index), [...ordered, term],
    ));
  };
  return match(normalizedTerms, []);
}

export function directInputGuide(answer: string) {
  const normalized = normalizeAnswer(answer);
  if (normalized === "yes" || normalized === "no") {
    return { copy: "예 또는 아니오 중 하나를 입력하세요", placeholder: "예 / 아니오", answerLabel: normalized === "yes" ? "예" : "아니오" };
  }
  if (answerTerms(answer).length) {
    return { copy: "필요한 단어를 모두 입력하세요. 띄어쓰기와 연결 조사는 생략해도 돼요", placeholder: "정답의 핵심 단어를 모두 입력하세요", answerLabel: answer };
  }
  return { copy: "정답을 직접 입력하세요", placeholder: "정답을 입력하세요", answerLabel: answer };
}

export function isAnswerCorrect(input: string, answer: string, acceptedAnswers: string[] = []) {
  const actual = normalizeAnswer(input);
  if (!actual) return false;
  return [answer, ...acceptedAnswers].some((candidate) => {
    const expected = normalizeAnswer(candidate);
    if (!expected) return false;
    if (actual === expected) return true;
    const terms = answerTerms(candidate);
    return terms.length > 1 && matchesAllTerms(actual, terms);
  });
}
