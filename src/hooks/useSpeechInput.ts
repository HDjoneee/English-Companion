import { useCallback, useEffect, useRef, useState } from "react";
import type {
  AudioMetrics,
  SpeechRecognitionErrorEventLike,
  SpeechRecognitionEventLike,
  SpeechRecognitionLike,
  TranscriptionMode,
  VoiceState
} from "../types";

interface CompletionPayload {
  transcript: string;
  confidence: number | null;
  audioUrl: string | null;
  durationSec: number;
  recognitionUnavailable: boolean;
  audioMetrics: AudioMetrics | null;
}

interface UseSpeechInputOptions {
  transcriptionMode: TranscriptionMode;
}

interface MeterStats {
  clippingEvents: number;
  peakVolume: number;
  sampleCount: number;
  silenceFrames: number;
  speechFrames: number;
  volumeSum: number;
}

type TranscriptionProvider = Exclude<TranscriptionMode, "auto">;

const CHUNK_INTERVAL_MS = 5000;
const SPEECH_RMS_THRESHOLD = 0.018;
const CLIPPING_PEAK_THRESHOLD = 0.92;
const isSecureSpeechContext =
  window.isSecureContext || location.hostname === "localhost" || location.hostname === "127.0.0.1";

const initialState: VoiceState = {
  isSupported: Boolean(window.SpeechRecognition || window.webkitSpeechRecognition),
  isSecureContext: isSecureSpeechContext,
  isListening: false,
  isRecording: false,
  transcriptionProvider: "browser",
  cloudAvailable: null,
  status: "待机",
  interimTranscript: "",
  finalTranscript: "",
  confidence: null,
  audioUrl: null,
  durationSec: 0,
  audioMetrics: null,
  error: null
};

export function useSpeechInput({ transcriptionMode }: UseSpeechInputOptions) {
  const [voiceState, setVoiceState] = useState<VoiceState>(initialState);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const startedAtRef = useRef(0);
  const transcriptRef = useRef("");
  const confidenceRef = useRef<number | null>(null);
  const providerRef = useRef<TranscriptionProvider>("browser");
  const cloudUnavailableRef = useRef(false);
  const browserUnavailableRef = useRef(!initialState.isSupported);
  const completionRef = useRef<((payload: CompletionPayload) => void) | null>(null);
  const transcriptionQueueRef = useRef(Promise.resolve());
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const meterFrameRef = useRef<number | null>(null);
  const meterStatsRef = useRef<MeterStats>(createEmptyMeterStats());

  const stopAudioMeter = useCallback(() => {
    if (meterFrameRef.current !== null) {
      window.cancelAnimationFrame(meterFrameRef.current);
      meterFrameRef.current = null;
    }
    try {
      audioSourceRef.current?.disconnect();
      analyserRef.current?.disconnect();
    } catch {
      // Disconnect can throw when the graph has already been torn down.
    }
    audioSourceRef.current = null;
    analyserRef.current = null;

    const audioContext = audioContextRef.current;
    audioContextRef.current = null;
    if (audioContext && audioContext.state !== "closed") {
      void audioContext.close().catch(() => undefined);
    }
  }, []);

  const cleanupStream = useCallback(() => {
    stopAudioMeter();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, [stopAudioMeter]);

  const resetTranscript = useCallback(() => {
    transcriptRef.current = "";
    confidenceRef.current = null;
    transcriptionQueueRef.current = Promise.resolve();
    meterStatsRef.current = createEmptyMeterStats();
    setVoiceState((prev) => ({
      ...prev,
      interimTranscript: "",
      finalTranscript: "",
      confidence: null,
      audioMetrics: null,
      error: null
    }));
  }, []);

  const startAudioMeter = useCallback(
    (stream: MediaStream) => {
      stopAudioMeter();
      meterStatsRef.current = createEmptyMeterStats();
      const AudioContextConstructor =
        window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextConstructor) return;

      try {
        const audioContext = new AudioContextConstructor();
        const source = audioContext.createMediaStreamSource(stream);
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 1024;
        source.connect(analyser);
        audioContextRef.current = audioContext;
        audioSourceRef.current = source;
        analyserRef.current = analyser;

        const samples = new Uint8Array(analyser.fftSize);
        const sample = () => {
          analyser.getByteTimeDomainData(samples);
          let sumSquares = 0;
          let peak = 0;
          for (const sampleValue of samples) {
            const normalized = (sampleValue - 128) / 128;
            const absolute = Math.abs(normalized);
            peak = Math.max(peak, absolute);
            sumSquares += normalized * normalized;
          }

          const rms = Math.sqrt(sumSquares / samples.length);
          const stats = meterStatsRef.current;
          stats.sampleCount += 1;
          stats.volumeSum += rms;
          stats.peakVolume = Math.max(stats.peakVolume, peak);
          if (rms >= SPEECH_RMS_THRESHOLD) {
            stats.speechFrames += 1;
          } else {
            stats.silenceFrames += 1;
          }
          if (peak >= CLIPPING_PEAK_THRESHOLD) {
            stats.clippingEvents += 1;
          }

          meterFrameRef.current = window.requestAnimationFrame(sample);
        };
        sample();
      } catch {
        stopAudioMeter();
      }
    },
    [stopAudioMeter]
  );

  const buildAudioMetrics = useCallback((durationSec: number): AudioMetrics | null => {
    const stats = meterStatsRef.current;
    if (!stats.sampleCount) return null;
    const frameCount = Math.max(1, stats.speechFrames + stats.silenceFrames);
    const speechRatio = clampNumber(stats.speechFrames / frameCount, 0, 1);
    const speakingSec = durationSec * speechRatio;
    return {
      durationSec,
      speakingSec,
      silenceSec: Math.max(0, durationSec - speakingSec),
      speechRatio,
      averageVolume: stats.volumeSum / stats.sampleCount,
      peakVolume: stats.peakVolume,
      clippingEvents: stats.clippingEvents,
      sampleCount: stats.sampleCount
    };
  }, []);

  const appendTranscript = useCallback((text: string, confidence: number | null) => {
    const normalized = normalizeTranscript(text);
    if (!normalized) return;
    const current = transcriptRef.current;
    if (current.toLowerCase().includes(normalized.toLowerCase())) return;
    transcriptRef.current = `${current} ${normalized}`.replace(/\s+/g, " ").trim();
    confidenceRef.current = confidence ?? confidenceRef.current;
    setVoiceState((prev) => ({
      ...prev,
      finalTranscript: transcriptRef.current,
      interimTranscript: "",
      confidence: confidenceRef.current,
      status: providerRef.current === "cloud" ? "稳定转写中..." : "继续说，我在听"
    }));
  }, []);

  const enqueueCloudTranscription = useCallback(
    (audioBlob: Blob) => {
      transcriptionQueueRef.current = transcriptionQueueRef.current
        .then(async () => {
          setVoiceState((prev) => ({
            ...prev,
            status: "稳定转写中..."
          }));
          const result = await transcribeChunk(audioBlob);
          if (!result.text) return;
          appendTranscript(result.text, 0.9);
        })
        .catch((error) => {
          cloudUnavailableRef.current = true;
          providerRef.current = "recording";
          setVoiceState((prev) => ({
            ...prev,
            transcriptionProvider: "recording",
            cloudAvailable: false,
            status: "云端转写不可用，停止后仍会生成语音反馈",
            error: error instanceof Error ? error.message : "云端转写失败"
          }));
        });
    },
    [appendTranscript]
  );

  const startBrowserRecognition = useCallback(() => {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) {
      browserUnavailableRef.current = true;
      providerRef.current = "recording";
      setVoiceState((prev) => ({
        ...prev,
        isListening: false,
        transcriptionProvider: "recording",
        status: "录音模式：停止后将生成语音反馈",
        error: null
      }));
      return;
    }

    const recognition = new Recognition();
    recognitionRef.current = recognition;
    recognition.lang = "en-US";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setVoiceState((prev) => ({
        ...prev,
        isListening: true,
        status: "正在识别...",
        error: null
      }));
    };

    recognition.onspeechstart = () => {
      setVoiceState((prev) => ({
        ...prev,
        status: "捕捉到语音，正在转写..."
      }));
    };

    recognition.onresult = (event: SpeechRecognitionEventLike) => {
      let interimText = "";
      let confidence = confidenceRef.current;

      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        const item = result[0];
        if (!item?.transcript) continue;
        if (result.isFinal) {
          appendTranscript(item.transcript, item.confidence || confidence);
          confidence = item.confidence || confidence;
        } else {
          interimText = `${interimText} ${item.transcript}`.trim();
        }
      }

      setVoiceState((prev) => ({
        ...prev,
        interimTranscript: interimText,
        confidence,
        status: interimText ? "正在识别..." : "继续说，我在听"
      }));
    };

    recognition.onerror = (event: SpeechRecognitionErrorEventLike) => {
      if (isRecoverableSpeechError(event.error)) {
        browserUnavailableRef.current = true;
        providerRef.current = "recording";
        try {
          recognition.abort();
        } catch {
          // No-op.
        }
        setVoiceState((prev) => ({
          ...prev,
          isListening: false,
          transcriptionProvider: "recording",
          interimTranscript: "",
          status: "浏览器实时转写不稳定，已切换为录音反馈模式",
          error: null
        }));
        return;
      }

      setVoiceState((prev) => ({
        ...prev,
        error: mapSpeechError(event.error),
        status: "识别异常，录音仍在继续"
      }));
    };

    recognition.onend = () => {
      setVoiceState((prev) => ({
        ...prev,
        isListening: false,
        status: prev.isRecording
          ? providerRef.current === "recording"
            ? "录音模式：停止后将生成语音反馈"
            : "识别暂停，录音仍在继续"
          : "待机"
      }));
    };

    try {
      recognition.start();
    } catch {
      browserUnavailableRef.current = true;
      providerRef.current = "recording";
      setVoiceState((prev) => ({
        ...prev,
        isListening: false,
        transcriptionProvider: "recording",
        status: "浏览器实时转写启动失败，已保留录音反馈",
        error: null
      }));
    }
  }, [appendTranscript]);

  const stop = useCallback(() => {
    try {
      recognitionRef.current?.stop();
    } catch {
      // Some browsers throw if recognition already ended.
    }

    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
      return;
    }

    cleanupStream();
    setVoiceState((prev) => ({
      ...prev,
      isListening: false,
      isRecording: false,
      status: "待机"
    }));
  }, [cleanupStream]);

  const abort = useCallback(() => {
    completionRef.current = null;
    try {
      recognitionRef.current?.abort();
    } catch {
      // No-op.
    }
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    }
    cleanupStream();
    setVoiceState((prev) => ({
      ...prev,
      isListening: false,
      isRecording: false,
      status: "已停止"
    }));
  }, [cleanupStream]);

  const start = useCallback(
    async (onComplete: (payload: CompletionPayload) => void) => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setVoiceState((prev) => ({
          ...prev,
          error: "当前浏览器没有开放麦克风 API。请使用最新版 Chrome 或 Edge。",
          status: "麦克风不可用"
        }));
        return false;
      }

      if (!("MediaRecorder" in window)) {
        setVoiceState((prev) => ({
          ...prev,
          error: "当前浏览器不支持录音回放。请使用最新版 Chrome 或 Edge。",
          status: "录音不可用"
        }));
        return false;
      }

      if (!isSecureSpeechContext) {
        setVoiceState((prev) => ({
          ...prev,
          error: "麦克风需要 HTTPS 或 localhost。请通过 npm run dev 的本地地址访问。",
          status: "非安全上下文"
        }));
        return false;
      }

      resetTranscript();
      completionRef.current = onComplete;
      chunksRef.current = [];
      startedAtRef.current = performance.now();

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        });
        streamRef.current = stream;
        startAudioMeter(stream);

        const provider = await chooseProvider(transcriptionMode, browserUnavailableRef.current, cloudUnavailableRef.current);
        providerRef.current = provider;

        const recorder = new MediaRecorder(stream);
        recorderRef.current = recorder;
        recorder.ondataavailable = (event) => {
          if (event.data.size <= 0) return;
          chunksRef.current.push(event.data);
          if (providerRef.current === "cloud") {
            enqueueCloudTranscription(event.data);
          }
        };
        recorder.onstop = async () => {
          await transcriptionQueueRef.current.catch(() => undefined);
          const durationSec = Math.max(0.6, (performance.now() - startedAtRef.current) / 1000);
          const audioMetrics = buildAudioMetrics(durationSec);
          const audioBlob = chunksRef.current.length ? new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" }) : null;
          const audioUrl = audioBlob ? URL.createObjectURL(audioBlob) : null;
          cleanupStream();
          setVoiceState((prev) => ({
            ...prev,
            isListening: false,
            isRecording: false,
            audioUrl,
            durationSec,
            audioMetrics,
            status: transcriptRef.current ? "转写完成" : "录音完成，已生成语音反馈",
            finalTranscript: transcriptRef.current,
            confidence: confidenceRef.current,
            error: null
          }));
          completionRef.current?.({
            transcript: transcriptRef.current,
            confidence: confidenceRef.current,
            audioUrl,
            durationSec,
            recognitionUnavailable: providerRef.current !== "browser",
            audioMetrics
          });
          completionRef.current = null;
        };

        recorder.start(provider === "cloud" ? CHUNK_INTERVAL_MS : undefined);

        setVoiceState((prev) => ({
          ...prev,
          isRecording: true,
          transcriptionProvider: provider,
          cloudAvailable:
            provider === "cloud" ? true : transcriptionMode === "auto" || transcriptionMode === "cloud" ? false : prev.cloudAvailable,
          status: providerStatus(provider),
          error: null
        }));

        if (provider === "browser") {
          startBrowserRecognition();
        }

        return true;
      } catch (error) {
        cleanupStream();
        setVoiceState((prev) => ({
          ...prev,
          isListening: false,
          isRecording: false,
          error: mapMicrophoneError(error),
          status: "麦克风启动失败"
        }));
        return false;
      }
    },
    [
      buildAudioMetrics,
      cleanupStream,
      enqueueCloudTranscription,
      resetTranscript,
      startAudioMeter,
      startBrowserRecognition,
      transcriptionMode
    ]
  );

  useEffect(() => {
    return () => {
      abort();
      if (voiceState.audioUrl) URL.revokeObjectURL(voiceState.audioUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    voiceState,
    start,
    stop,
    abort,
    resetTranscript
  };
}

function createEmptyMeterStats(): MeterStats {
  return {
    clippingEvents: 0,
    peakVolume: 0,
    sampleCount: 0,
    silenceFrames: 0,
    speechFrames: 0,
    volumeSum: 0
  };
}

async function chooseProvider(
  mode: TranscriptionMode,
  browserUnavailable: boolean,
  cloudUnavailable: boolean
): Promise<TranscriptionProvider> {
  if (mode === "recording") return "recording";
  if (mode === "browser") return browserUnavailable ? "recording" : "browser";
  if (mode === "cloud") return cloudUnavailable ? "recording" : (await isCloudTranscriptionReady()) ? "cloud" : "recording";
  if (!cloudUnavailable && (await isCloudTranscriptionReady())) return "cloud";
  return browserUnavailable ? "recording" : "browser";
}

async function isCloudTranscriptionReady() {
  try {
    const response = await fetch("/api/transcribe/health", { method: "GET" });
    if (!response.ok) return false;
    const payload = (await response.json()) as { configured?: boolean };
    return Boolean(payload.configured);
  } catch {
    return false;
  }
}

async function transcribeChunk(audioBlob: Blob) {
  const response = await fetch("/api/transcribe", {
    method: "POST",
    headers: {
      "Content-Type": audioBlob.type || "audio/webm"
    },
    body: audioBlob
  });

  const payload = (await response.json().catch(() => ({}))) as { text?: string; error?: string };
  if (!response.ok) {
    throw new Error(payload.error || "云端转写请求失败");
  }
  return { text: normalizeTranscript(payload.text || "") };
}

function providerStatus(provider: TranscriptionProvider) {
  if (provider === "cloud") return "稳定转写中...";
  if (provider === "browser") return "正在识别...";
  return "录音模式：停止后将生成语音反馈";
}

function normalizeTranscript(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

function isRecoverableSpeechError(error: string) {
  return error === "network" || error === "service-not-allowed" || error === "language-not-supported";
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function mapMicrophoneError(error: unknown) {
  if (!(error instanceof DOMException)) return "麦克风调用失败，请检查浏览器权限。";
  if (error.name === "NotAllowedError" || error.name === "PermissionDeniedError") {
    return "麦克风权限被拒绝。请在地址栏右侧允许麦克风权限后重试。";
  }
  if (error.name === "NotFoundError" || error.name === "DevicesNotFoundError") {
    return "没有检测到可用麦克风，请确认设备已连接。";
  }
  if (error.name === "NotReadableError") {
    return "麦克风正被其他应用占用，请关闭占用麦克风的软件后重试。";
  }
  if (error.name === "SecurityError") {
    return "浏览器安全策略阻止了麦克风，请使用 localhost 或 HTTPS 地址访问。";
  }
  return `${error.name}: ${error.message}`;
}

function mapSpeechError(error: string) {
  const map: Record<string, string> = {
    "not-allowed": "语音识别权限被拒绝。请允许麦克风权限后重试。",
    "no-speech": "没有捕捉到语音，请靠近麦克风再试。",
    "audio-capture": "没有检测到麦克风输入。",
    aborted: "语音识别已停止。"
  };
  return map[error] ?? `语音识别错误：${error}`;
}
