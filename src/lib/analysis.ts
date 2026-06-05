import type { AudioMetrics, Difficulty, Issue, Scenario, TurnAnalysis, TurnScores } from "../types";
import { average, clamp, createId, tokenize } from "./utils";

interface AnalyzeInput {
  text: string;
  scenario: Scenario;
  difficulty: Difficulty;
  confidence: number | null;
  durationSec: number;
  customVocabulary: string[];
  audioUrl?: string;
}

interface VoiceOnlyInput {
  scenario: Scenario;
  difficulty: Difficulty;
  audioMetrics: AudioMetrics | null;
  audioUrl?: string;
  recognitionUnavailable?: boolean;
}

interface Rule {
  title: string;
  pattern: RegExp;
  replacement: string | ((...args: string[]) => string);
  reason: string;
  type: Issue["type"];
  severity: Issue["severity"];
  scenarios?: string[];
}

const grammarRules: Rule[] = [
  {
    title: "agree 不和 be 搭配",
    pattern: /\bi am agree\b/gi,
    replacement: "I agree",
    reason: "agree 是动词，直接说 I agree。",
    type: "grammar",
    severity: "high"
  },
  {
    title: "like 前不要用 very",
    pattern: /\bi very like\b/gi,
    replacement: "I really like",
    reason: "表达喜欢程度时，really like 更自然。",
    type: "expression",
    severity: "medium"
  },
  {
    title: "discuss 后面不加 about",
    pattern: /\bdiscuss about\b/gi,
    replacement: "discuss",
    reason: "discuss 本身就是及物动词。",
    type: "grammar",
    severity: "medium"
  },
  {
    title: "explain 的宾语顺序",
    pattern: /\bexplain me\b/gi,
    replacement: "explain it to me",
    reason: "常用结构是 explain something to someone。",
    type: "grammar",
    severity: "medium"
  },
  {
    title: "固定搭配 depend on",
    pattern: /\bdepend of\b|\bdepends of\b/gi,
    replacement: "depends on",
    reason: "固定搭配是 depend on。",
    type: "grammar",
    severity: "medium"
  },
  {
    title: "information 不可数",
    pattern: /\binformations\b/gi,
    replacement: "information",
    reason: "information 是不可数名词。",
    type: "grammar",
    severity: "medium"
  },
  {
    title: "advice 不可数",
    pattern: /\badvices\b/gi,
    replacement: "advice",
    reason: "advice 是不可数名词。",
    type: "grammar",
    severity: "medium"
  },
  {
    title: "better 不叠加 more",
    pattern: /\bmore better\b/gi,
    replacement: "better",
    reason: "better 已经是比较级。",
    type: "grammar",
    severity: "medium"
  },
  {
    title: "make a decision",
    pattern: /\bdo a decision\b/gi,
    replacement: "make a decision",
    reason: "decision 常和 make 搭配。",
    type: "expression",
    severity: "medium"
  },
  {
    title: "职业身份加冠词",
    pattern: /\bi am ([aeiou]?[a-z]+ )?(engineer|designer|teacher|manager|developer)\b/gi,
    replacement: (_match, modifier = "", job = "professional") =>
      `I am ${/^[aeiou]/i.test(modifier || job) ? "an" : "a"} ${modifier}${job}`,
    reason: "说明职业身份时，单数可数名词前通常需要 a/an。",
    type: "grammar",
    severity: "medium"
  },
  {
    title: "过去时间使用过去式",
    pattern: /\blast (year|month|week),? i (go|work|finish|lead|make)\b/gi,
    replacement: (_match, time, verb) => {
      const past: Record<string, string> = {
        go: "went",
        work: "worked",
        finish: "finished",
        lead: "led",
        make: "made"
      };
      return `Last ${time}, I ${past[verb.toLowerCase()] ?? verb}`;
    },
    reason: "last year/month/week 指过去时间，主句动词要用过去式。",
    type: "grammar",
    severity: "high"
  },
  {
    title: "服务场景更礼貌",
    pattern: /\bi want\b/gi,
    replacement: "I'd like",
    reason: "点餐或旅行服务场景中，I'd like 更礼貌自然。",
    type: "expression",
    severity: "low",
    scenarios: ["dining", "travel"]
  },
  {
    title: "表达负责更具体",
    pattern: /\bi do\b/gi,
    replacement: "I led / I handled / I was responsible for",
    reason: "描述工作贡献时，动词越明确越好。",
    type: "expression",
    severity: "low",
    scenarios: ["interview", "meeting"]
  },
  {
    title: "把 good 说具体",
    pattern: /\bgood\b/gi,
    replacement: "effective / reliable / valuable",
    reason: "面试和会议中，具体形容词更有说服力。",
    type: "expression",
    severity: "low",
    scenarios: ["interview", "meeting"]
  }
];

export function analyzeUtterance(input: AnalyzeInput): TurnAnalysis {
  const text = normalizeSpacing(input.text);
  const words = tokenize(text);
  const wordCount = words.length;
  const durationSec = Math.max(input.durationSec || estimateSpeakingDuration(text), 1);
  const confidence = input.confidence ?? estimateConfidence(text);
  const wpm = wordCount ? Math.round((wordCount / durationSec) * 60) : 0;
  const fillerCount = countFillers(text);
  const issues = detectIssues(text, input.scenario, input.customVocabulary);
  const correctedSentence = buildCorrectedSentence(text, input.scenario);
  const keywordHits = input.scenario.keywords.filter((keyword) => words.includes(keyword)).length;
  const minimumWords = { a2: 8, b1: 15, b2: 24 }[input.difficulty];
  const lengthRatio = clamp((wordCount / minimumWords) * 100, 0, 125);
  const uniqueRatio = wordCount ? new Set(words).size / wordCount : 0;
  const pronunciationTargets = getPronunciationTargets(words, confidence, input.customVocabulary);

  const grammarIssueCount = issues.filter((issue) => issue.type === "grammar").length;
  const expressionIssueCount = issues.filter((issue) => issue.type === "expression").length;
  const pronunciationIssueCount = issues.filter((issue) => issue.type === "pronunciation").length;

  const pronunciation = clamp(confidence * 95 + Math.min(8, wordCount) - fillerCount * 4 - pronunciationIssueCount * 8, 28, 99);
  const fluency = clamp(96 - Math.abs(wpm - 125) * 0.34 - fillerCount * 8 + Math.min(10, lengthRatio / 12), 30, 99);
  const grammar = clamp(100 - grammarIssueCount * 15 - (wordCount < 4 ? 20 : 0), 25, 100);
  const expression = clamp(
    56 + uniqueRatio * 24 + keywordHits * 7 + Math.min(12, lengthRatio / 10) - expressionIssueCount * 7,
    32,
    100
  );
  const interaction = clamp(52 + Math.min(30, wordCount * 1.35) + keywordHits * 6 - (wordCount < minimumWords ? 8 : 0), 35, 100);
  const scores: TurnScores = {
    pronunciation: Math.round(pronunciation),
    fluency: Math.round(fluency),
    grammar: Math.round(grammar),
    expression: Math.round(expression),
    interaction: Math.round(interaction),
    overall: Math.round(pronunciation * 0.24 + fluency * 0.22 + grammar * 0.22 + expression * 0.18 + interaction * 0.14)
  };

  return {
    id: createId("analysis"),
    text,
    wordCount,
    wpm,
    confidence,
    fillerCount,
    keywordHits,
    scores,
    issues,
    correctedSentence,
    pronunciationTargets,
    audioUrl: input.audioUrl,
    createdAt: Date.now()
  };
}

export function analyzeVoiceOnlyTurn(input: VoiceOnlyInput): TurnAnalysis {
  const metrics = input.audioMetrics;
  const durationSec = Math.max(metrics?.durationSec ?? 0, 0.6);
  const speechRatio = metrics?.speechRatio ?? 0;
  const averageVolume = metrics?.averageVolume ?? 0;
  const peakVolume = metrics?.peakVolume ?? 0;
  const clippingRate = metrics?.sampleCount ? metrics.clippingEvents / metrics.sampleCount : 0;

  const durationScore =
    durationSec < 2
      ? 38 + durationSec * 8
      : durationSec < 8
        ? 56 + durationSec * 4
        : durationSec <= 45
          ? 88
          : durationSec <= 75
            ? 78
            : 68;
  const ratioScore = metrics ? clamp(100 - Math.abs(speechRatio - 0.68) * 105, 35, 98) : 45;
  const volumeScore = metrics
    ? averageVolume < 0.012
      ? 42
      : averageVolume < 0.035
        ? 62 + averageVolume * 500
        : averageVolume < 0.18
          ? 86
          : 78
    : 45;
  const clippingPenalty = clippingRate > 0.04 ? 16 : clippingRate > 0.015 ? 8 : 0;
  const pronunciation = clamp(volumeScore * 0.7 + durationScore * 0.3 - clippingPenalty, 30, 92);
  const fluency = clamp(ratioScore * 0.65 + durationScore * 0.35, 30, 92);
  const grammar = 62;
  const expression = 62;
  const interaction = clamp(durationScore * 0.75 + ratioScore * 0.25, 35, 92);
  const scores: TurnScores = {
    pronunciation: Math.round(pronunciation),
    fluency: Math.round(fluency),
    grammar,
    expression,
    interaction: Math.round(interaction),
    overall: Math.round(pronunciation * 0.24 + fluency * 0.22 + grammar * 0.22 + expression * 0.18 + interaction * 0.14)
  };

  const issues: Issue[] = [];
  if (!metrics) {
    issues.push({
      id: createId("issue"),
      type: "pronunciation",
      title: "录音反馈有限",
      original: "audio metrics unavailable",
      replacement: "try one more recording",
      reason: "浏览器没有返回足够的音频采样数据，本轮只能保留录音并继续对话。",
      severity: "medium"
    });
  } else {
    if (durationSec < 2.5) {
      issues.push({
        id: createId("issue"),
        type: "expression",
        title: "回答过短",
        original: `${durationSec.toFixed(1)}s`,
        replacement: "8-20s answer",
        reason: "真实口语训练建议至少给出一句观点和一个原因，太短会影响互动评分。",
        severity: "medium"
      });
    }
    if (speechRatio < 0.38) {
      issues.push({
        id: createId("issue"),
        type: "pronunciation",
        title: "有效说话占比偏低",
        original: `${Math.round(speechRatio * 100)}% speaking`,
        replacement: "speak closer to the mic",
        reason: "录音中静音比例较高，可能是停顿过长、声音太小或麦克风距离过远。",
        severity: "medium"
      });
    }
    if (averageVolume < 0.015 || peakVolume < 0.06) {
      issues.push({
        id: createId("issue"),
        type: "pronunciation",
        title: "音量偏低",
        original: "low volume",
        replacement: "clearer volume",
        reason: "请靠近麦克风或提高一点音量，系统才能更稳定地捕捉发音细节。",
        severity: "medium"
      });
    }
    if (clippingRate > 0.03) {
      issues.push({
        id: createId("issue"),
        type: "pronunciation",
        title: "音量过大或爆音",
        original: "clipping peaks",
        replacement: "steady volume",
        reason: "录音峰值过高会造成爆音，建议离麦克风稍远并保持稳定音量。",
        severity: "low"
      });
    }
  }

  issues.push({
    id: createId("issue"),
    type: "expression",
    title: "无文本转写",
    original: "Transcript unavailable",
    replacement: "Audio-only feedback generated",
    reason: input.recognitionUnavailable
      ? "实时转写服务不可用，本轮已改用音频特征生成即时反馈；语法和表达纠错会在有文本时更精准。"
      : "本轮没有识别到可用文本，系统已先给出语音层面的即时反馈并继续对话。",
    severity: "low"
  });

  return {
    id: createId("analysis"),
    text: "Voice answer recorded. Transcript unavailable.",
    wordCount: 0,
    wpm: 0,
    confidence: Math.round(pronunciation) / 100,
    fillerCount: 0,
    keywordHits: 0,
    scores,
    issues: issues.slice(0, 5),
    correctedSentence: "Transcript unavailable. Audio-only feedback was generated from the recording.",
    pronunciationTargets: input.scenario.keywords.slice(0, 3),
    audioUrl: input.audioUrl,
    audioMetrics: metrics ?? undefined,
    createdAt: Date.now()
  };
}

export function buildCoachResponse(params: {
  analysis: TurnAnalysis;
  scenario: Scenario;
  difficulty: Difficulty;
  turnIndex: number;
}) {
  const { analysis, scenario, difficulty, turnIndex } = params;
  const words = tokenize(analysis.text);
  const nextPrompt = scenario.prompts[difficulty][turnIndex % scenario.prompts[difficulty].length];
  const keyword = scenario.keywords.find((item) => words.includes(item));
  const acknowledgement =
    analysis.wordCount < 5
      ? "Thanks. Let's stretch that answer with one clear reason."
      : analysis.scores.overall >= 86
        ? "That was clear and natural."
        : analysis.issues.length
          ? "I understood your point, and we can make the wording sharper."
          : "Good, let's keep the conversation moving.";
  const bridge = keyword
    ? `You mentioned "${keyword}", so I want to go one level deeper.`
    : analysis.scores.expression < 66
      ? "Try adding one concrete detail or example."
      : "Answer the next question as naturally as you can.";

  return `${acknowledgement} ${bridge} ${nextPrompt}`;
}

export function aggregateScores(analyses: TurnAnalysis[]): TurnScores {
  if (!analyses.length) {
    return {
      pronunciation: 0,
      fluency: 0,
      grammar: 0,
      expression: 0,
      interaction: 0,
      overall: 0
    };
  }
  return {
    pronunciation: average(analyses.map((item) => item.scores.pronunciation)),
    fluency: average(analyses.map((item) => item.scores.fluency)),
    grammar: average(analyses.map((item) => item.scores.grammar)),
    expression: average(analyses.map((item) => item.scores.expression)),
    interaction: average(analyses.map((item) => item.scores.interaction)),
    overall: average(analyses.map((item) => item.scores.overall))
  };
}

export function groupIssues(issues: Issue[]) {
  const map = new Map<string, { title: string; count: number; reason: string; type: Issue["type"] }>();
  issues.forEach((issue) => {
    const item = map.get(issue.title) ?? {
      title: issue.title,
      count: 0,
      reason: issue.reason,
      type: issue.type
    };
    item.count += 1;
    map.set(issue.title, item);
  });
  return Array.from(map.values()).sort((a, b) => b.count - a.count);
}

export function buildSessionReport(params: {
  scenario: Scenario;
  difficulty: Difficulty;
  durationSec: number;
  analyses: TurnAnalysis[];
}) {
  const aggregate = aggregateScores(params.analyses);
  const totalWords = params.analyses.reduce((sum, item) => sum + item.wordCount, 0);
  const avgWpm = average(params.analyses.map((item) => item.wpm));
  const repeatedIssues = groupIssues(params.analyses.flatMap((item) => item.issues));
  const weakest = Object.entries({
    pronunciation: aggregate.pronunciation,
    fluency: aggregate.fluency,
    grammar: aggregate.grammar,
    expression: aggregate.expression,
    interaction: aggregate.interaction
  }).sort((a, b) => a[1] - b[1])[0];

  const highlights = [
    aggregate.pronunciation >= 78 ? "发音识别稳定，系统能较准确捕捉你的回答。" : "",
    aggregate.fluency >= 78 ? "语速与停顿控制较好，对话推进自然。" : "",
    aggregate.grammar >= 78 ? "基础语法错误较少，可以继续提升表达层次。" : "",
    aggregate.expression >= 78 ? "场景表达使用充分，回答更贴近真实语境。" : "",
    totalWords >= 80 ? "输出词数充足，有利于形成口语肌肉记忆。" : ""
  ].filter(Boolean);

  const advice = [
    weakest?.[0] === "pronunciation" ? "下次跟读本场景高频表达，每句慢速 2 遍、自然语速 3 遍。" : "",
    weakest?.[0] === "fluency" ? "用 20 秒回答同一问题，目标是少停顿、不重启句子。" : "",
    weakest?.[0] === "grammar" ? "把错题本中的句子改写成 3 个新句，重点检查时态与动词搭配。" : "",
    weakest?.[0] === "expression" ? `至少主动使用 3 个场景句型：${params.scenario.phrases.slice(0, 3).join(" / ")}。` : "",
    repeatedIssues[0] ? `优先修正「${repeatedIssues[0].title}」，先说正确版本，再放回完整回答里。` : "",
    "每轮回答补一个原因和一个具体例子，避免只给短答案。"
  ].filter(Boolean);

  return {
    scenarioTitle: params.scenario.title,
    difficulty: params.difficulty.toUpperCase(),
    durationSec: params.durationSec,
    turns: params.analyses.length,
    totalWords,
    avgWpm,
    aggregate,
    repeatedIssues,
    highlights: highlights.length ? highlights : ["已经完成有效开口练习，下一轮重点放在完整句和场景关键词。"],
    advice: advice.slice(0, 5),
    vocabulary: Array.from(
      new Set(params.analyses.flatMap((item) => [...item.pronunciationTargets, ...params.scenario.keywords]))
    ).slice(0, 10)
  };
}

function detectIssues(text: string, scenario: Scenario, customVocabulary: string[]) {
  const issues: Issue[] = [];
  grammarRules.forEach((rule) => {
    if (rule.scenarios && !rule.scenarios.includes(scenario.id)) return;
    const pattern = new RegExp(rule.pattern.source, rule.pattern.flags);
    const match = pattern.exec(text);
    if (!match) return;
    const replacement =
      typeof rule.replacement === "function"
        ? rule.replacement(...match)
        : text.replace(new RegExp(rule.pattern.source, rule.pattern.flags), rule.replacement);
    issues.push({
      id: createId("issue"),
      type: rule.type,
      title: rule.title,
      original: match[0],
      replacement,
      reason: rule.reason,
      severity: rule.severity,
      target: match[0]
    });
  });

  if (/^\s*i\b/.test(text)) {
    issues.push({
      id: createId("issue"),
      type: "grammar",
      title: "I 要大写",
      original: "i",
      replacement: "I",
      reason: "英文中第一人称 I 始终大写。",
      severity: "low",
      target: "i"
    });
  }

  const words = tokenize(text);
  const usedKeyword = scenario.keywords.some((keyword) => words.includes(keyword));
  if (!usedKeyword && words.length >= 8) {
    issues.push({
      id: createId("issue"),
      type: "expression",
      title: "加入场景关键词",
      original: text,
      replacement: scenario.phrases[0],
      reason: "使用场景词能让回答更贴近真实语境。",
      severity: "low"
    });
  }

  if (words.length > 0 && words.length < 5) {
    issues.push({
      id: createId("issue"),
      type: "expression",
      title: "回答太短",
      original: text,
      replacement: `${text}. ${scenario.phrases[0]}`,
      reason: "真实对话里可以补充原因、例子或下一步。",
      severity: "medium"
    });
  }

  const hardWords = getPronunciationTargets(words, estimateConfidence(text), customVocabulary);
  hardWords.slice(0, 2).forEach((word) => {
    issues.push({
      id: createId("issue"),
      type: "pronunciation",
      title: "建议复读重点词",
      original: word,
      replacement: word,
      reason: "该词较长或不在常用场景词中，建议回放自己的录音并跟读。",
      severity: "low",
      target: word
    });
  });

  return issues.slice(0, 7);
}

function buildCorrectedSentence(text: string, scenario: Scenario) {
  let corrected = text;
  grammarRules.forEach((rule) => {
    if (rule.scenarios && !rule.scenarios.includes(scenario.id)) return;
    corrected = corrected.replace(new RegExp(rule.pattern.source, rule.pattern.flags), rule.replacement as string);
  });
  corrected = corrected.replace(/\bi\b/g, "I").replace(/\s+/g, " ").trim();
  if (corrected && !/[.!?]$/.test(corrected)) corrected += ".";
  return corrected;
}

function getPronunciationTargets(words: string[], confidence: number, customVocabulary: string[]) {
  const customSet = new Set(customVocabulary.map((word) => word.toLowerCase()));
  return Array.from(
    new Set(
      words.filter((word) => {
        if (customSet.has(word)) return false;
        return word.length >= 8 || (confidence < 0.72 && word.length >= 5);
      })
    )
  ).slice(0, 5);
}

function countFillers(text: string) {
  return text.toLowerCase().match(/\b(um|uh|er|ah|you know|kind of|sort of)\b/g)?.length ?? 0;
}

function estimateSpeakingDuration(text: string) {
  const words = tokenize(text).length;
  return Math.max(1.6, (words / 120) * 60);
}

function estimateConfidence(text: string) {
  const words = tokenize(text);
  if (words.length <= 3) return 0.62;
  const longWordBonus = words.filter((word) => word.length >= 7).length * 0.01;
  const fillerPenalty = countFillers(text) * 0.035;
  return clamp(0.72 + longWordBonus - fillerPenalty, 0.55, 0.9);
}

function normalizeSpacing(text: string) {
  return text.replace(/\s+/g, " ").trim();
}
