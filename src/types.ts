import type { LucideIcon } from "lucide-react";

export type Difficulty = "a2" | "b1" | "b2";
export type ScenarioId = "interview" | "dining" | "meeting" | "travel";
export type TranscriptionMode = "auto" | "cloud" | "browser" | "recording";
export type VoiceAccent = "en-US" | "en-GB" | "en-AU";
export type MessageRole = "coach" | "user" | "system";

export interface Scenario {
  id: ScenarioId;
  title: string;
  role: string;
  brief: string;
  icon: LucideIcon;
  opening: string;
  keywords: string[];
  phrases: string[];
  prompts: Record<Difficulty, string[]>;
}

export interface DialogueMessage {
  id: string;
  role: MessageRole;
  speaker: string;
  text: string;
  createdAt: number;
  score?: number;
  isFavorite?: boolean;
  audioUrl?: string;
  durationSec?: number;
}

export interface Issue {
  id: string;
  type: "grammar" | "expression" | "pronunciation";
  title: string;
  original: string;
  replacement: string;
  reason: string;
  severity: "low" | "medium" | "high";
  target?: string;
}

export interface TurnScores {
  pronunciation: number;
  fluency: number;
  grammar: number;
  expression: number;
  interaction: number;
  overall: number;
}

export interface AudioMetrics {
  durationSec: number;
  speakingSec: number;
  silenceSec: number;
  speechRatio: number;
  averageVolume: number;
  peakVolume: number;
  clippingEvents: number;
  sampleCount: number;
}

export interface TurnAnalysis {
  id: string;
  text: string;
  wordCount: number;
  wpm: number;
  confidence: number;
  fillerCount: number;
  keywordHits: number;
  scores: TurnScores;
  issues: Issue[];
  correctedSentence: string;
  pronunciationTargets: string[];
  audioUrl?: string;
  audioMetrics?: AudioMetrics;
  createdAt: number;
}

export interface StoredSession {
  id: string;
  title: string;
  scenarioId: ScenarioId;
  difficulty: Difficulty;
  createdAt: number;
  durationSec: number;
  messages: DialogueMessage[];
  analyses: TurnAnalysis[];
  averageScore: number;
}

export interface ToastMessage {
  id: string;
  title: string;
  description?: string;
  type: "success" | "error" | "warning" | "info";
}

export interface VoiceState {
  isSupported: boolean;
  isSecureContext: boolean;
  isListening: boolean;
  isRecording: boolean;
  transcriptionProvider: Exclude<TranscriptionMode, "auto">;
  cloudAvailable: boolean | null;
  status: string;
  interimTranscript: string;
  finalTranscript: string;
  confidence: number | null;
  audioUrl: string | null;
  durationSec: number;
  audioMetrics: AudioMetrics | null;
  error: string | null;
}

export interface SpeechRecognitionAlternativeLike {
  transcript: string;
  confidence: number;
}

export interface SpeechRecognitionResultLike {
  readonly isFinal: boolean;
  readonly length: number;
  item(index: number): SpeechRecognitionAlternativeLike;
  [index: number]: SpeechRecognitionAlternativeLike;
}

export interface SpeechRecognitionResultListLike {
  readonly length: number;
  item(index: number): SpeechRecognitionResultLike;
  [index: number]: SpeechRecognitionResultLike;
}

export interface SpeechRecognitionEventLike extends Event {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultListLike;
}

export interface SpeechRecognitionErrorEventLike extends Event {
  readonly error: string;
  readonly message?: string;
}

export interface SpeechRecognitionLike extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onaudiostart: ((event: Event) => void) | null;
  onspeechstart: ((event: Event) => void) | null;
  onstart: ((event: Event) => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: ((event: Event) => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

export interface SpeechRecognitionConstructor {
  new (): SpeechRecognitionLike;
}

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}
