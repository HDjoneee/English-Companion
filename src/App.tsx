import { useEffect, useMemo, useRef, useState } from "react";
import {
  BookMarked,
  Check,
  ClipboardList,
  Download,
  History,
  Keyboard,
  Mic,
  MicOff,
  Play,
  Plus,
  RefreshCcw,
  RotateCcw,
  Save,
  Send,
  Settings2,
  Sparkles,
  Star,
  Trash2,
  Volume2,
  X
} from "lucide-react";
import { AbilityRadar, TrendChart } from "./components/Charts";
import { ToastStack } from "./components/ToastStack";
import { TopNav } from "./components/TopNav";
import { Waveform } from "./components/Waveform";
import { Badge } from "./components/ui/badge";
import { Button } from "./components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./components/ui/card";
import { Input } from "./components/ui/input";
import { Progress } from "./components/ui/progress";
import { Select } from "./components/ui/select";
import { Slider } from "./components/ui/slider";
import { Switch } from "./components/ui/switch";
import { Textarea } from "./components/ui/textarea";
import { useSpeechInput } from "./hooks/useSpeechInput";
import { useSpeechSynthesis } from "./hooks/useSpeechSynthesis";
import {
  aggregateScores,
  analyzeUtterance,
  buildCoachResponse,
  buildSessionReport,
  groupIssues
} from "./lib/analysis";
import { getScenario, scenarios } from "./lib/scenarios";
import {
  addMistakes,
  clearMistakes,
  deleteSession,
  loadFavorites,
  loadMistakes,
  loadSessions,
  saveFavorites,
  saveSession
} from "./lib/storage";
import {
  cn,
  createId,
  downloadTextFile,
  escapeHtml,
  formatElapsed,
  isTypingTarget,
  scoreTextColor
} from "./lib/utils";
import type {
  DialogueMessage,
  Difficulty,
  Issue,
  Scenario,
  ScenarioId,
  StoredSession,
  ToastMessage,
  TurnAnalysis,
  TurnScores,
  VoiceAccent
} from "./types";

const abilityLabels: Record<keyof Omit<TurnScores, "overall">, string> = {
  pronunciation: "发音",
  fluency: "流利度",
  grammar: "语法",
  expression: "表达",
  interaction: "互动"
};

const difficultyLabels: Record<Difficulty, string> = {
  a2: "A2 基础表达",
  b1: "B1 独立交流",
  b2: "B2 进阶表达"
};

const accentLabels: Record<VoiceAccent, string> = {
  "en-US": "美式英语",
  "en-GB": "英式英语",
  "en-AU": "澳式英语"
};

export default function App() {
  const [scenarioId, setScenarioId] = useState<ScenarioId>("interview");
  const [difficulty, setDifficulty] = useState<Difficulty>("b1");
  const [messages, setMessages] = useState<DialogueMessage[]>([]);
  const [analyses, setAnalyses] = useState<TurnAnalysis[]>([]);
  const [active, setActive] = useState(false);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [coachPrompt, setCoachPrompt] = useState(getScenario("interview").opening);
  const [typedCoachPrompt, setTypedCoachPrompt] = useState(getScenario("interview").opening);
  const [textValue, setTextValue] = useState("");
  const [autoSpeak, setAutoSpeak] = useState(true);
  const [autoListen, setAutoListen] = useState(false);
  const [highAccuracy, setHighAccuracy] = useState(true);
  const [voiceAccent, setVoiceAccent] = useState<VoiceAccent>("en-US");
  const [voiceRate, setVoiceRate] = useState(1);
  const [selectedVoiceURI, setSelectedVoiceURI] = useState("");
  const [customVocabularyText, setCustomVocabularyText] = useState("React, TypeScript, stakeholder, refund");
  const [showSettings, setShowSettings] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [sessions, setSessions] = useState<StoredSession[]>(() => loadSessions());
  const [favoriteIds, setFavoriteIds] = useState<string[]>(() => loadFavorites());
  const [mistakes, setMistakes] = useState<Issue[]>(() => loadMistakes());
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const sessionIdRef = useRef(createId("session"));
  const conversationEndRef = useRef<HTMLDivElement | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);

  const scenario = useMemo(() => getScenario(scenarioId), [scenarioId]);
  const customVocabulary = useMemo(
    () =>
      customVocabularyText
        .split(/[,，\n]/)
        .map((item) => item.trim())
        .filter(Boolean),
    [customVocabularyText]
  );
  const aggregate = useMemo(() => aggregateScores(analyses), [analyses]);
  const latestAnalysis = analyses[analyses.length - 1] ?? null;
  const repeatedIssues = useMemo(() => groupIssues(analyses.flatMap((item) => item.issues)), [analyses]);
  const report = useMemo(
    () =>
      buildSessionReport({
        scenario,
        difficulty,
        durationSec: elapsedSec,
        analyses
      }),
    [analyses, difficulty, elapsedSec, scenario]
  );
  const { voiceState, start: startVoiceInput, stop: stopVoiceInput } = useSpeechInput();
  const { voices, groupedVoices, isSpeaking, speak, stopSpeaking } = useSpeechSynthesis();

  useEffect(() => {
    const nextPrompt = scenario.opening;
    if (!active && messages.length === 0) {
      setCoachPrompt(nextPrompt);
      setTypedCoachPrompt(nextPrompt);
    }
  }, [active, messages.length, scenario]);

  useEffect(() => {
    if (!active || !startedAt) return;
    const timer = window.setInterval(() => {
      setElapsedSec(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [active, startedAt]);

  useEffect(() => {
    setTypedCoachPrompt("");
    let index = 0;
    const timer = window.setInterval(() => {
      index += 1;
      setTypedCoachPrompt(coachPrompt.slice(0, index));
      if (index >= coachPrompt.length) window.clearInterval(timer);
    }, 18);
    return () => window.clearInterval(timer);
  }, [coachPrompt]);

  useEffect(() => {
    conversationEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, typedCoachPrompt]);

  useEffect(() => {
    saveFavorites(favoriteIds);
  }, [favoriteIds]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.key === "Enter") {
        formRef.current?.requestSubmit();
        return;
      }
      if (event.code === "Space" && !isTypingTarget(event.target)) {
        event.preventDefault();
        if (voiceState.isRecording) {
          stopVoiceInput();
        } else if (active) {
          void handleVoiceStart();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  function pushToast(toast: Omit<ToastMessage, "id">) {
    const id = createId("toast");
    setToasts((items) => [...items, { ...toast, id }]);
    window.setTimeout(() => {
      setToasts((items) => items.filter((item) => item.id !== id));
    }, 3000);
  }

  function dismissToast(id: string) {
    setToasts((items) => items.filter((item) => item.id !== id));
  }

  function createMessage(role: DialogueMessage["role"], speaker: string, text: string, extra?: Partial<DialogueMessage>) {
    return {
      id: createId("msg"),
      role,
      speaker,
      text,
      createdAt: Date.now(),
      ...extra
    };
  }

  function startSession() {
    stopSpeaking();
    const opening = scenario.opening;
    setActive(true);
    setStartedAt(Date.now());
    setElapsedSec(0);
    setMessages([createMessage("coach", scenario.role, opening)]);
    setAnalyses([]);
    setCoachPrompt(opening);
    sessionIdRef.current = createId("session");
    if (autoSpeak) {
      speak(opening, {
        accent: voiceAccent,
        rate: voiceRate,
        voiceURI: selectedVoiceURI,
        onEnd: () => {
          if (autoListen) void handleVoiceStart();
        }
      });
    }
    pushToast({ type: "success", title: "训练已开始", description: `${scenario.title} · ${difficultyLabels[difficulty]}` });
  }

  function resetSession(showToast = true) {
    stopVoiceInput();
    stopSpeaking();
    setActive(false);
    setStartedAt(null);
    setElapsedSec(0);
    setMessages([]);
    setAnalyses([]);
    setTextValue("");
    setCoachPrompt(scenario.opening);
    setTypedCoachPrompt(scenario.opening);
    sessionIdRef.current = createId("session");
    if (showToast) pushToast({ type: "info", title: "已重置当前练习" });
  }

  function persistSession(nextMessages: DialogueMessage[], nextAnalyses: TurnAnalysis[]) {
    if (!nextAnalyses.length) return;
    const stored: StoredSession = {
      id: sessionIdRef.current,
      title: `${scenario.title} · ${new Date().toLocaleString()}`,
      scenarioId,
      difficulty,
      createdAt: Date.now(),
      durationSec: elapsedSec,
      messages: nextMessages,
      analyses: nextAnalyses,
      averageScore: aggregateScores(nextAnalyses).overall
    };
    saveSession(stored);
    setSessions(loadSessions());
  }

  function submitUserTurn(text: string, audio?: { audioUrl?: string | null; confidence?: number | null; durationSec?: number }) {
    const cleanText = text.trim();
    if (!cleanText) return;

    const sessionWasInactive = !active;
    const baseMessages = sessionWasInactive ? [createMessage("coach", scenario.role, scenario.opening)] : messages;
    if (sessionWasInactive) {
      setActive(true);
      setStartedAt(Date.now());
      setCoachPrompt(scenario.opening);
    }

    const analysis = analyzeUtterance({
      text: cleanText,
      scenario,
      difficulty,
      confidence: audio?.confidence ?? null,
      durationSec: audio?.durationSec ?? 0,
      customVocabulary: highAccuracy ? customVocabulary : [],
      audioUrl: audio?.audioUrl ?? undefined
    });
    const userMessage = createMessage("user", "You", cleanText, {
      score: analysis.scores.overall,
      audioUrl: audio?.audioUrl ?? undefined,
      durationSec: audio?.durationSec
    });
    const response = buildCoachResponse({
      analysis,
      scenario,
      difficulty,
      turnIndex: analyses.length
    });
    const coachMessage = createMessage("coach", scenario.role, response);
    const nextMessages = [...baseMessages, userMessage, coachMessage];
    const nextAnalyses = [...analyses, analysis];

    setMessages(nextMessages);
    setAnalyses(nextAnalyses);
    setCoachPrompt(response);
    setTextValue("");
    addMistakes(analysis.issues);
    setMistakes(loadMistakes());
    persistSession(nextMessages, nextAnalyses);

    if (autoSpeak) {
      speak(response, {
        accent: voiceAccent,
        rate: voiceRate,
        voiceURI: selectedVoiceURI,
        onEnd: () => {
          if (autoListen) void handleVoiceStart();
        }
      });
    }

    pushToast({
      type: analysis.scores.overall >= 82 ? "success" : analysis.scores.overall >= 66 ? "info" : "warning",
      title: `本轮评分 ${analysis.scores.overall}`,
      description: analysis.issues[0]?.title ?? "回答基本顺畅，继续保持。"
    });
  }

  async function handleVoiceStart() {
    if (!active) {
      startSession();
      return;
    }
    stopSpeaking();
    const ok = await startVoiceInput((payload) => {
      if (payload.transcript.trim()) {
        submitUserTurn(payload.transcript, {
          audioUrl: payload.audioUrl,
          confidence: payload.confidence,
          durationSec: payload.durationSec
        });
      } else if (payload.audioUrl) {
        pushToast({
          type: payload.recognitionUnavailable ? "info" : "warning",
          title: payload.recognitionUnavailable ? "已切换为录音模式" : "已录音，但未识别到文字",
          description: payload.recognitionUnavailable
            ? "浏览器实时转写服务不稳定，本次录音已保留。请在输入框补充英文文本后继续评分。"
            : "可以先回放自己的声音，再用文本框输入回答继续评分。"
        });
      }
    });
    if (!ok) {
      pushToast({
        type: "error",
        title: "麦克风启动失败",
        description: voiceState.error ?? "请检查浏览器麦克风权限。"
      });
    }
  }

  function handleTextSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    submitUserTurn(textValue);
  }

  function toggleFavorite(id: string) {
    setFavoriteIds((ids) => (ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id]));
    pushToast({ type: "success", title: favoriteIds.includes(id) ? "已取消收藏" : "已加入收藏" });
  }

  function insertPhrase(phrase: string) {
    setTextValue((value) => `${value}${value ? " " : ""}${phrase.replace("...", "")}`.trim());
    pushToast({ type: "info", title: "已插入高频表达" });
  }

  function restartFromHistory(session: StoredSession) {
    setScenarioId(session.scenarioId);
    setDifficulty(session.difficulty);
    resetSession(false);
    pushToast({ type: "info", title: "已载入历史场景", description: "点击开始对话即可重新练习。" });
  }

  function removeHistory(id: string) {
    deleteSession(id);
    setSessions(loadSessions());
    pushToast({ type: "success", title: "历史记录已删除" });
  }

  function clearMistakeBook() {
    clearMistakes();
    setMistakes([]);
    pushToast({ type: "success", title: "错题本已清空" });
  }

  function exportTextReport() {
    const content = renderPlainReport(report, messages);
    downloadTextFile(`speaking-report-${Date.now()}.txt`, content);
    pushToast({ type: "success", title: "文本报告已导出" });
  }

  function exportPdfReport() {
    const reportWindow = window.open("", "_blank", "width=960,height=720");
    if (!reportWindow) {
      pushToast({ type: "error", title: "无法打开打印窗口", description: "请允许浏览器弹窗后重试。" });
      return;
    }
    reportWindow.document.write(renderPrintableReport(report, messages));
    reportWindow.document.close();
    reportWindow.focus();
    reportWindow.print();
  }

  const liveTranscript = [voiceState.finalTranscript, voiceState.interimTranscript].filter(Boolean).join(" ");

  return (
    <div className="min-h-screen">
      <TopNav onOpenSettings={() => setShowSettings(true)} />
      <ToastStack items={toasts} onDismiss={dismissToast} />

      <main className="mx-auto grid w-[min(1480px,calc(100vw-32px))] gap-4 py-6 lg:grid-cols-[20%_55%_25%]">
        <aside className="grid content-start gap-4">
          <ScenarioPanel
            activeScenario={scenario}
            difficulty={difficulty}
            onDifficultyChange={setDifficulty}
            onScenarioChange={(id) => {
              setScenarioId(id);
              resetSession(false);
            }}
          />
          <VoiceSettings
            voiceAccent={voiceAccent}
            setVoiceAccent={setVoiceAccent}
            voiceRate={voiceRate}
            setVoiceRate={setVoiceRate}
            selectedVoiceURI={selectedVoiceURI}
            setSelectedVoiceURI={setSelectedVoiceURI}
            groupedVoices={groupedVoices}
            autoSpeak={autoSpeak}
            setAutoSpeak={setAutoSpeak}
            autoListen={autoListen}
            setAutoListen={setAutoListen}
          />
          <HistoryPanel sessions={sessions} onRestart={restartFromHistory} onDelete={removeHistory} />
        </aside>

        <section className="grid content-start gap-4">
          <SessionMetrics
            scenario={scenario}
            elapsedSec={elapsedSec}
            averageScore={aggregate.overall}
            latencyLabel={voiceState.isListening ? "实时" : latestAnalysis ? "<300ms" : "--"}
          />
          <ConversationCard
            active={active}
            scenario={scenario}
            coachPrompt={typedCoachPrompt}
            turn={analyses.length}
            isSpeaking={isSpeaking}
            isRecording={voiceState.isRecording}
            voiceStatus={voiceState.status}
            voiceError={voiceState.error}
            liveTranscript={liveTranscript}
            messages={messages}
            favoriteIds={favoriteIds}
            onStart={startSession}
            onReset={() => resetSession(true)}
            onVoiceStart={handleVoiceStart}
            onVoiceStop={stopVoiceInput}
            onSummary={() => setShowSummary(true)}
            onFavorite={toggleFavorite}
            conversationEndRef={conversationEndRef}
            canShowSummary={analyses.length > 0}
          />
          <form ref={formRef} onSubmit={handleTextSubmit} className="grid gap-2 rounded-lg border border-slate-200 bg-white p-3 shadow-soft sm:grid-cols-[1fr_auto]">
            <Input
              value={textValue}
              onChange={(event) => setTextValue(event.target.value)}
              placeholder="输入英文回答，Ctrl+Enter 发送"
              aria-label="输入英文回答"
            />
            <Button type="submit" variant="default">
              <Send className="h-4 w-4" />
              发送
            </Button>
          </form>
        </section>

        <aside className="grid content-start gap-4">
          <FeedbackPanel
            aggregate={aggregate}
            latestAnalysis={latestAnalysis}
            analyses={analyses}
            repeatedIssues={repeatedIssues}
            scenario={scenario}
            favoriteIds={favoriteIds}
            onInsertPhrase={insertPhrase}
            onFavoritePhrase={toggleFavorite}
            mistakes={mistakes}
            onClearMistakes={clearMistakeBook}
          />
        </aside>
      </main>

      {showSummary ? (
        <SummaryModal
          report={report}
          messages={messages}
          onClose={() => setShowSummary(false)}
          onExportText={exportTextReport}
          onExportPdf={exportPdfReport}
        />
      ) : null}

      {showSettings ? (
        <SettingsPanel
          onClose={() => setShowSettings(false)}
          highAccuracy={highAccuracy}
          setHighAccuracy={setHighAccuracy}
          customVocabularyText={customVocabularyText}
          setCustomVocabularyText={setCustomVocabularyText}
          speechSupported={voiceState.isSupported}
          secureContext={voiceState.isSecureContext}
          voices={voices}
        />
      ) : null}
    </div>
  );
}

function ScenarioPanel({
  activeScenario,
  difficulty,
  onDifficultyChange,
  onScenarioChange
}: {
  activeScenario: Scenario;
  difficulty: Difficulty;
  onDifficultyChange: (difficulty: Difficulty) => void;
  onScenarioChange: (id: ScenarioId) => void;
}) {
  return (
    <Card className="glass-panel">
      <CardHeader className="pb-3">
        <CardTitle>训练场景</CardTitle>
        <CardDescription>选择一个真实任务，开始情境对话。</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-2">
        {scenarios.map((item) => {
          const Icon = item.icon;
          const selected = item.id === activeScenario.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onScenarioChange(item.id)}
              className={cn(
                "group grid grid-cols-[36px_1fr] gap-3 rounded-lg border bg-white p-3 text-left transition-all hover:-translate-y-0.5 hover:shadow-soft",
                selected ? "border-2 border-sky-500 bg-sky-50 shadow-soft" : "border-slate-200"
              )}
            >
              <span className={cn("grid h-9 w-9 place-items-center rounded-full", selected ? "bg-sky-500 text-white" : "bg-slate-100 text-slate-500")}>
                <Icon className="h-4 w-4" />
              </span>
              <span>
                <strong className="block text-sm font-semibold text-slate-900">{item.title}</strong>
                <span className="mt-1 block text-xs leading-[1.4] text-slate-500">{item.brief}</span>
              </span>
            </button>
          );
        })}
        <div className="mt-2 grid gap-2">
          <label className="text-xs font-medium text-slate-500" htmlFor="difficulty">
            难度
          </label>
          <Select id="difficulty" value={difficulty} onChange={(event) => onDifficultyChange(event.target.value as Difficulty)}>
            {Object.entries(difficultyLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </div>
      </CardContent>
    </Card>
  );
}

function VoiceSettings({
  voiceAccent,
  setVoiceAccent,
  voiceRate,
  setVoiceRate,
  selectedVoiceURI,
  setSelectedVoiceURI,
  groupedVoices,
  autoSpeak,
  setAutoSpeak,
  autoListen,
  setAutoListen
}: {
  voiceAccent: VoiceAccent;
  setVoiceAccent: (accent: VoiceAccent) => void;
  voiceRate: number;
  setVoiceRate: (rate: number) => void;
  selectedVoiceURI: string;
  setSelectedVoiceURI: (voice: string) => void;
  groupedVoices: Record<VoiceAccent, SpeechSynthesisVoice[]>;
  autoSpeak: boolean;
  setAutoSpeak: (checked: boolean) => void;
  autoListen: boolean;
  setAutoListen: (checked: boolean) => void;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle>语音设置</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid gap-2">
          <label className="text-xs font-medium text-slate-500" htmlFor="accent">
            口音
          </label>
          <Select id="accent" value={voiceAccent} onChange={(event) => setVoiceAccent(event.target.value as VoiceAccent)}>
            {Object.entries(accentLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </div>
        <div className="grid gap-2">
          <label className="text-xs font-medium text-slate-500" htmlFor="voice">
            语音
          </label>
          <Select id="voice" value={selectedVoiceURI} onChange={(event) => setSelectedVoiceURI(event.target.value)}>
            <option value="">自动选择</option>
            {groupedVoices[voiceAccent].map((voice) => (
              <option key={voice.voiceURI} value={voice.voiceURI}>
                {voice.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="grid gap-2">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>语速</span>
            <span>{voiceRate.toFixed(1)}x</span>
          </div>
          <Slider min={0.5} max={2} step={0.1} value={voiceRate} onChange={(event) => setVoiceRate(Number(event.target.value))} />
        </div>
        <div className="grid gap-3">
          <ToggleLine label="语音播放" checked={autoSpeak} onChange={setAutoSpeak} />
          <ToggleLine label="自动接话" checked={autoListen} onChange={setAutoListen} />
        </div>
      </CardContent>
    </Card>
  );
}

function ToggleLine({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-slate-700">{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} label={label} />
    </div>
  );
}

function HistoryPanel({
  sessions,
  onRestart,
  onDelete
}: {
  sessions: StoredSession[];
  onRestart: (session: StoredSession) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <History className="h-4 w-4 text-sky-500" />
            历史练习
          </CardTitle>
          <Badge>{sessions.length}</Badge>
        </div>
      </CardHeader>
      <CardContent className="grid max-h-72 gap-2 overflow-auto scrollbar-thin">
        {sessions.length ? (
          sessions.map((session) => (
            <div key={session.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-800">{session.title}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {session.analyses.length} 轮 · 平均 {session.averageScore}
                  </p>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onRestart(session)}>
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={() => onDelete(session.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))
        ) : (
          <SkeletonEmpty label="完成一轮练习后自动保存历史。" />
        )}
      </CardContent>
    </Card>
  );
}

function SessionMetrics({
  scenario,
  elapsedSec,
  averageScore,
  latencyLabel
}: {
  scenario: Scenario;
  elapsedSec: number;
  averageScore: number;
  latencyLabel: string;
}) {
  const items = [
    ["场景", scenario.title],
    ["时长", formatElapsed(elapsedSec)],
    ["平均分", averageScore ? String(averageScore) : "--"],
    ["延迟", latencyLabel]
  ];
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {items.map(([label, value]) => (
        <Card key={label} className="p-4">
          <span className="text-xs font-medium leading-[1.4] text-slate-500">{label}</span>
          <strong className="mt-1 block text-xl font-semibold text-slate-900">{value}</strong>
        </Card>
      ))}
    </div>
  );
}

function ConversationCard({
  active,
  scenario,
  coachPrompt,
  turn,
  isSpeaking,
  isRecording,
  voiceStatus,
  voiceError,
  liveTranscript,
  messages,
  favoriteIds,
  onStart,
  onReset,
  onVoiceStart,
  onVoiceStop,
  onSummary,
  onFavorite,
  conversationEndRef,
  canShowSummary
}: {
  active: boolean;
  scenario: Scenario;
  coachPrompt: string;
  turn: number;
  isSpeaking: boolean;
  isRecording: boolean;
  voiceStatus: string;
  voiceError: string | null;
  liveTranscript: string;
  messages: DialogueMessage[];
  favoriteIds: string[];
  onStart: () => void;
  onReset: () => void;
  onVoiceStart: () => void;
  onVoiceStop: () => void;
  onSummary: () => void;
  onFavorite: (id: string) => void;
  conversationEndRef: React.MutableRefObject<HTMLDivElement | null>;
  canShowSummary: boolean;
}) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b border-slate-100 bg-gradient-to-r from-slate-900 to-slate-800 text-white">
        <div className="grid gap-4 sm:grid-cols-[auto_1fr]">
          <div className="grid place-items-center">
            <Waveform active={isRecording || isSpeaking} danger={isRecording} />
          </div>
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <Badge className="border-sky-400/30 bg-sky-400/10 text-sky-100">{scenario.role}</Badge>
              <Badge className="border-emerald-400/30 bg-emerald-400/10 text-emerald-100">Turn {turn}</Badge>
              <Badge className="border-white/20 bg-white/10 text-white">{voiceStatus}</Badge>
            </div>
            <p className="min-h-[72px] text-[15px] leading-6 text-slate-100">
              {coachPrompt}
              <span className="ml-0.5 inline-block h-4 w-1 translate-y-0.5 animate-pulse bg-sky-300" />
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4 p-4">
        <div className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-slate-900">实时转写</p>
              <p className="text-xs leading-[1.4] text-slate-500">{isRecording ? "正在识别..." : "点击语音回答后开始捕捉英文"}</p>
            </div>
            <Waveform active={isRecording} danger compact />
          </div>
          <p className="min-h-10 rounded-lg bg-white px-3 py-2 text-sm leading-6 text-slate-700">
            {liveTranscript || "你的英文回答会显示在这里。"}
          </p>
          {voiceError ? <p className="text-xs leading-[1.4] text-red-500">{voiceError}</p> : null}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="gradient" size="lg" onClick={onStart} disabled={active}>
            <Sparkles className="h-5 w-5" />
            开始对话
          </Button>
          <Button variant={isRecording ? "danger" : "success"} onClick={isRecording ? onVoiceStop : onVoiceStart} disabled={!active}>
            {isRecording ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            {isRecording ? "停止识别" : "语音回答"}
          </Button>
          <Button variant="secondary" onClick={onReset}>
            <RefreshCcw className="h-4 w-4" />
            重置
          </Button>
          <Button variant="outline" onClick={onSummary} disabled={!canShowSummary}>
            <ClipboardList className="h-4 w-4" />
            课后总结
          </Button>
          <Badge className="ml-auto hidden items-center gap-1 md:inline-flex">
            <Keyboard className="h-3.5 w-3.5" />
            Ctrl+Enter / Space
          </Badge>
        </div>

        <div className="max-h-[420px] space-y-3 overflow-auto pr-1 scrollbar-thin">
          {messages.length ? (
            messages.map((message) => (
              <DialogueBubble
                key={message.id}
                message={message}
                isFavorite={favoriteIds.includes(message.id)}
                onFavorite={() => onFavorite(message.id)}
              />
            ))
          ) : (
            <SkeletonEmpty label="开始后会显示 AI 提问和你的回答。" />
          )}
          <div ref={conversationEndRef} />
        </div>
      </CardContent>
    </Card>
  );
}

function DialogueBubble({
  message,
  isFavorite,
  onFavorite
}: {
  message: DialogueMessage;
  isFavorite: boolean;
  onFavorite: () => void;
}) {
  const isUser = message.role === "user";
  return (
    <article className={cn("animate-message-in flex gap-3", isUser ? "justify-end" : "justify-start")}>
      {!isUser ? <Avatar label="AI" tone="ai" /> : null}
      <div className={cn("max-w-[82%] rounded-lg border p-3 shadow-sm", isUser ? "border-sky-100 bg-sky-50" : "border-slate-200 bg-white")}>
        <div className="mb-1 flex items-center justify-between gap-3">
          <span className="text-xs font-medium text-slate-500">{message.speaker}</span>
          <div className="flex items-center gap-1">
            {typeof message.score === "number" ? <span className={cn("text-xs font-semibold", scoreTextColor(message.score))}>{message.score}</span> : null}
            <button type="button" className="text-slate-400 transition hover:text-amber-500" onClick={onFavorite} aria-label="收藏回答">
              <Star className={cn("h-4 w-4", isFavorite ? "fill-amber-400 text-amber-400" : "")} />
            </button>
          </div>
        </div>
        <p className={cn("leading-6", isUser ? "text-sm text-slate-800" : "text-[15px] text-slate-900")}>{message.text}</p>
        {message.audioUrl ? (
          <audio className="mt-2 h-8 w-full" controls src={message.audioUrl}>
            <track kind="captions" />
          </audio>
        ) : null}
      </div>
      {isUser ? <Avatar label="You" tone="user" /> : null}
    </article>
  );
}

function Avatar({ label, tone }: { label: string; tone: "ai" | "user" }) {
  return (
    <div
      className={cn(
        "grid h-9 w-9 shrink-0 place-items-center rounded-full text-xs font-semibold shadow-sm",
        tone === "ai" ? "bg-gradient-to-br from-sky-500 to-emerald-500 text-white" : "bg-slate-200 text-slate-700"
      )}
    >
      {label}
    </div>
  );
}

function FeedbackPanel({
  aggregate,
  latestAnalysis,
  analyses,
  repeatedIssues,
  scenario,
  favoriteIds,
  onInsertPhrase,
  onFavoritePhrase,
  mistakes,
  onClearMistakes
}: {
  aggregate: TurnScores;
  latestAnalysis: TurnAnalysis | null;
  analyses: TurnAnalysis[];
  repeatedIssues: ReturnType<typeof groupIssues>;
  scenario: Scenario;
  favoriteIds: string[];
  onInsertPhrase: (phrase: string) => void;
  onFavoritePhrase: (id: string) => void;
  mistakes: Issue[];
  onClearMistakes: () => void;
}) {
  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle>即时反馈</CardTitle>
            <strong className={cn("text-3xl font-semibold", scoreTextColor(aggregate.overall || 0))}>{aggregate.overall || "--"}</strong>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3">
          {Object.entries(abilityLabels).map(([key, label]) => {
            const value = aggregate[key as keyof typeof abilityLabels] || 0;
            return (
              <div key={key} className="grid gap-1.5">
                <div className="flex justify-between text-xs">
                  <span className="font-medium text-slate-600">{label}</span>
                  <span className={scoreTextColor(value)}>{value}</span>
                </div>
                <Progress value={value} />
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle>能力雷达</CardTitle>
        </CardHeader>
        <CardContent>
          <AbilityRadar scores={aggregate} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle>历史趋势</CardTitle>
        </CardHeader>
        <CardContent>
          <TrendChart analyses={analyses} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle>纠错与改写</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2">
          {latestAnalysis ? (
            latestAnalysis.issues.length ? (
              latestAnalysis.issues.slice(0, 5).map((issue) => <IssueCard key={issue.id} issue={issue} />)
            ) : (
              <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-3 text-sm text-emerald-700">
                <Check className="mr-1 inline h-4 w-4" />
                本轮表达基本顺畅，下一轮尝试加入更多细节。
              </div>
            )
          ) : (
            <SkeletonEmpty label="完成一轮回答后显示纠错。" />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle>高频表达</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2">
          {scenario.phrases.map((phrase) => {
            const id = `phrase:${scenario.id}:${phrase}`;
            return (
              <div key={phrase} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2">
                <button type="button" className="grid h-8 w-8 place-items-center rounded-full bg-sky-100 text-sky-600 hover:bg-sky-200" onClick={() => onInsertPhrase(phrase)} aria-label="插入表达">
                  <Plus className="h-4 w-4" />
                </button>
                <p className="min-w-0 flex-1 text-xs leading-[1.4] text-slate-700">{phrase}</p>
                <button type="button" className="text-slate-400 hover:text-amber-500" onClick={() => onFavoritePhrase(id)} aria-label="收藏表达">
                  <Star className={cn("h-4 w-4", favoriteIds.includes(id) ? "fill-amber-400 text-amber-400" : "")} />
                </button>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2">
              <BookMarked className="h-4 w-4 text-amber-500" />
              错题本
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={onClearMistakes} disabled={!mistakes.length}>
              清空
            </Button>
          </div>
        </CardHeader>
        <CardContent className="grid max-h-64 gap-2 overflow-auto scrollbar-thin">
          {mistakes.length ? (
            mistakes.slice(0, 10).map((issue) => <IssueCard key={`${issue.id}-${issue.original}`} issue={issue} compact />)
          ) : (
            <SkeletonEmpty label="错误表达会自动收集到这里。" />
          )}
        </CardContent>
      </Card>

      {repeatedIssues.length ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle>高频问题</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2">
            {repeatedIssues.slice(0, 4).map((issue) => (
              <div key={issue.title} className="flex items-center justify-between rounded-lg bg-slate-50 p-2 text-xs">
                <span className="font-medium text-slate-700">{issue.title}</span>
                <Badge>{issue.count} 次</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </>
  );
}

function IssueCard({ issue, compact }: { issue: Issue; compact?: boolean }) {
  return (
    <div className={cn("rounded-lg border p-3", issue.type === "pronunciation" ? "border-amber-200 bg-amber-50" : "border-slate-200 bg-slate-50")}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <strong className="text-sm font-semibold text-slate-900">{issue.title}</strong>
        <Badge className={cn(issue.type === "grammar" ? "text-red-600" : issue.type === "expression" ? "text-sky-600" : "text-amber-600")}>
          {issue.type === "grammar" ? "语法" : issue.type === "expression" ? "表达" : "发音"}
        </Badge>
      </div>
      <p className={cn("leading-6", compact ? "text-xs" : "text-sm")} title={issue.reason}>
        <del className="rounded bg-red-100 px-1 text-red-600">{issue.original}</del>
        <span className="mx-1 text-slate-400">→</span>
        <ins className="rounded bg-emerald-100 px-1 text-emerald-700 no-underline">{issue.replacement}</ins>
      </p>
      {!compact ? <p className="mt-2 text-xs leading-[1.4] text-slate-500">{issue.reason}</p> : null}
    </div>
  );
}

function SettingsPanel({
  onClose,
  highAccuracy,
  setHighAccuracy,
  customVocabularyText,
  setCustomVocabularyText,
  speechSupported,
  secureContext,
  voices
}: {
  onClose: () => void;
  highAccuracy: boolean;
  setHighAccuracy: (checked: boolean) => void;
  customVocabularyText: string;
  setCustomVocabularyText: (value: string) => void;
  speechSupported: boolean;
  secureContext: boolean;
  voices: SpeechSynthesisVoice[];
}) {
  return (
    <div className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm">
      <div className="ml-auto grid h-full w-[min(440px,100vw)] content-start gap-4 overflow-auto bg-white p-6 shadow-soft">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium leading-[1.4] text-sky-600">Settings</p>
            <h2 className="text-xl font-semibold text-slate-900">识别与评估设置</h2>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings2 className="h-4 w-4 text-sky-500" />
              语音诊断
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm">
            <DiagnosticLine label="安全上下文" ok={secureContext} help="麦克风需要 HTTPS 或 localhost。" />
            <DiagnosticLine label="实时转写 API" ok={speechSupported} help="Chrome / Edge 支持更稳定。" />
            <DiagnosticLine label="可用朗读语音" ok={voices.length > 0} help={`${voices.length} 个 voice 已加载。`} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>识别准确率增强</CardTitle>
            <CardDescription>加入专业词汇表，用于评分、重点词识别和场景表达提示。</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <ToggleLine label="启用专业词汇表" checked={highAccuracy} onChange={setHighAccuracy} />
            <Textarea
              value={customVocabularyText}
              onChange={(event) => setCustomVocabularyText(event.target.value)}
              placeholder="每行或逗号分隔：React, stakeholder, refund..."
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function DiagnosticLine({ label, ok, help }: { label: string; ok: boolean; help: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 p-3">
      <div>
        <p className="font-medium text-slate-800">{label}</p>
        <p className="text-xs leading-[1.4] text-slate-500">{help}</p>
      </div>
      <Badge className={ok ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700"}>
        {ok ? "正常" : "异常"}
      </Badge>
    </div>
  );
}

function SummaryModal({
  report,
  messages,
  onClose,
  onExportText,
  onExportPdf
}: {
  report: ReturnType<typeof buildSessionReport>;
  messages: DialogueMessage[];
  onClose: () => void;
  onExportText: () => void;
  onExportPdf: () => void;
}) {
  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-slate-900/45 p-4 backdrop-blur-sm">
      <Card className="max-h-[min(820px,calc(100vh-32px))] w-[min(980px,calc(100vw-32px))] overflow-auto">
        <CardHeader className="border-b border-slate-100">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium leading-[1.4] text-sky-600">Session Summary</p>
              <CardTitle className="text-xl">课后总结</CardTitle>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-5 w-5" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 p-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            {[
              ["场景", report.scenarioTitle],
              ["轮次", String(report.turns)],
              ["总词数", String(report.totalWords)],
              ["语速", `${report.avgWpm} wpm`],
              ["总分", String(report.aggregate.overall)]
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <span className="text-xs text-slate-500">{label}</span>
                <strong className="mt-1 block text-lg font-semibold text-slate-900">{value}</strong>
              </div>
            ))}
          </div>
          <SummaryBlock title="本次亮点" items={report.highlights} />
          <SummaryBlock title="主要问题" items={report.repeatedIssues.length ? report.repeatedIssues.map((item) => `${item.title}：${item.count} 次`) : ["没有明显高频错误。"]} />
          <SummaryBlock title="改进建议" items={report.advice} />
          <SummaryBlock title="重点词汇句型" items={report.vocabulary} />
          <div className="flex flex-wrap justify-between gap-2">
            <div className="text-xs leading-[1.4] text-slate-500">对话记录：{messages.length} 条，可导出文本或使用浏览器保存 PDF。</div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={onExportText}>
                <Download className="h-4 w-4" />
                导出文本
              </Button>
              <Button variant="default" onClick={onExportPdf}>
                <Save className="h-4 w-4" />
                导出 PDF
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryBlock({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <h3 className="mb-2 text-base font-semibold text-slate-900">{title}</h3>
      <ul className="grid gap-1 pl-5 text-sm leading-6 text-slate-700">
        {items.map((item) => (
          <li key={item} className="list-disc">
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function SkeletonEmpty({ label }: { label: string }) {
  return (
    <div className="grid gap-2 rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4">
      <div className="h-3 w-2/3 animate-pulse rounded bg-slate-200" />
      <div className="h-3 w-1/2 animate-pulse rounded bg-slate-200" />
      <p className="mt-1 text-xs leading-[1.4] text-slate-500">{label}</p>
    </div>
  );
}

function renderPlainReport(report: ReturnType<typeof buildSessionReport>, messages: DialogueMessage[]) {
  return [
    "AI 英语口语陪练课后总结",
    `场景：${report.scenarioTitle}`,
    `难度：${report.difficulty}`,
    `轮次：${report.turns}`,
    `总词数：${report.totalWords}`,
    `平均语速：${report.avgWpm} wpm`,
    `总分：${report.aggregate.overall}`,
    "",
    "本次亮点",
    ...report.highlights.map((item) => `- ${item}`),
    "",
    "主要问题",
    ...(report.repeatedIssues.length ? report.repeatedIssues.map((item) => `- ${item.title}: ${item.count} 次`) : ["- 没有明显高频错误。"]),
    "",
    "改进建议",
    ...report.advice.map((item) => `- ${item}`),
    "",
    "重点词汇句型",
    ...report.vocabulary.map((item) => `- ${item}`),
    "",
    "对话记录",
    ...messages.map((message) => `[${message.speaker}] ${message.text}`)
  ].join("\n");
}

function renderPrintableReport(report: ReturnType<typeof buildSessionReport>, messages: DialogueMessage[]) {
  const list = (items: string[]) => `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
  return `
    <!doctype html>
    <html lang="zh-CN">
      <head>
        <meta charset="utf-8" />
        <title>AI 英语口语陪练课后总结</title>
        <style>
          body { font-family: Inter, "Microsoft YaHei", sans-serif; color: #1E293B; line-height: 1.6; padding: 32px; }
          h1 { font-size: 24px; margin: 0 0 16px; }
          h2 { font-size: 16px; margin: 24px 0 8px; }
          .kpis { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; }
          .kpi, section { border: 1px solid #E2E8F0; border-radius: 8px; padding: 12px; }
          .kpi span { display: block; color: #64748B; font-size: 12px; }
          .kpi strong { display: block; font-size: 18px; margin-top: 4px; }
          li { margin-bottom: 4px; }
          .dialogue p { margin: 0 0 8px; }
        </style>
      </head>
      <body>
        <h1>AI 英语口语陪练课后总结</h1>
        <div class="kpis">
          <div class="kpi"><span>场景</span><strong>${escapeHtml(report.scenarioTitle)}</strong></div>
          <div class="kpi"><span>轮次</span><strong>${report.turns}</strong></div>
          <div class="kpi"><span>总词数</span><strong>${report.totalWords}</strong></div>
          <div class="kpi"><span>语速</span><strong>${report.avgWpm} wpm</strong></div>
          <div class="kpi"><span>总分</span><strong>${report.aggregate.overall}</strong></div>
        </div>
        <h2>本次亮点</h2><section>${list(report.highlights)}</section>
        <h2>主要问题</h2><section>${list(report.repeatedIssues.length ? report.repeatedIssues.map((item) => `${item.title}：${item.count} 次`) : ["没有明显高频错误。"])}</section>
        <h2>改进建议</h2><section>${list(report.advice)}</section>
        <h2>重点词汇句型</h2><section>${list(report.vocabulary)}</section>
        <h2>对话记录</h2><section class="dialogue">${messages.map((message) => `<p><strong>${escapeHtml(message.speaker)}:</strong> ${escapeHtml(message.text)}</p>`).join("")}</section>
      </body>
    </html>
  `;
}
