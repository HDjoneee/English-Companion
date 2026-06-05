import { useCallback, useEffect, useRef, useState } from "react";
import type {
  SpeechRecognitionErrorEventLike,
  SpeechRecognitionEventLike,
  SpeechRecognitionLike,
  VoiceState
} from "../types";

interface CompletionPayload {
  transcript: string;
  confidence: number | null;
  audioUrl: string | null;
  durationSec: number;
}

const initialState: VoiceState = {
  isSupported: Boolean(window.SpeechRecognition || window.webkitSpeechRecognition),
  isSecureContext: window.isSecureContext || location.hostname === "localhost" || location.hostname === "127.0.0.1",
  isListening: false,
  isRecording: false,
  status: "待机",
  interimTranscript: "",
  finalTranscript: "",
  confidence: null,
  audioUrl: null,
  durationSec: 0,
  error: null
};

export function useSpeechInput() {
  const [voiceState, setVoiceState] = useState<VoiceState>(initialState);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const startedAtRef = useRef(0);
  const transcriptRef = useRef("");
  const confidenceRef = useRef<number | null>(null);
  const completionRef = useRef<((payload: CompletionPayload) => void) | null>(null);

  const cleanupStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const resetTranscript = useCallback(() => {
    transcriptRef.current = "";
    confidenceRef.current = null;
    setVoiceState((prev) => ({
      ...prev,
      interimTranscript: "",
      finalTranscript: "",
      confidence: null,
      error: null
    }));
  }, []);

  const stop = useCallback(() => {
    try {
      recognitionRef.current?.stop();
    } catch {
      // Some browsers throw if recognition already ended.
    }

    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    } else {
      cleanupStream();
      setVoiceState((prev) => ({
        ...prev,
        isListening: false,
        isRecording: false,
        status: "待机"
      }));
    }
  }, [cleanupStream]);

  const abort = useCallback(() => {
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

      if (!initialState.isSecureContext) {
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

        const recorder = new MediaRecorder(stream);
        recorderRef.current = recorder;
        recorder.ondataavailable = (event) => {
          if (event.data.size > 0) chunksRef.current.push(event.data);
        };
        recorder.onstop = () => {
          const durationSec = Math.max(0.6, (performance.now() - startedAtRef.current) / 1000);
          const audioBlob = chunksRef.current.length ? new Blob(chunksRef.current, { type: "audio/webm" }) : null;
          const audioUrl = audioBlob ? URL.createObjectURL(audioBlob) : null;
          cleanupStream();
          setVoiceState((prev) => ({
            ...prev,
            isListening: false,
            isRecording: false,
            audioUrl,
            durationSec,
            status: transcriptRef.current ? "识别完成" : "录音完成，可回放",
            finalTranscript: transcriptRef.current,
            confidence: confidenceRef.current
          }));
          completionRef.current?.({
            transcript: transcriptRef.current,
            confidence: confidenceRef.current,
            audioUrl,
            durationSec
          });
          completionRef.current = null;
        };
        recorder.start();

        const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!Recognition) {
          setVoiceState((prev) => ({
            ...prev,
            isRecording: true,
            isListening: false,
            status: "正在录音；此浏览器不支持实时转写",
            error: "Web Speech API 不可用，录音回放仍可使用。"
          }));
          return true;
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
            isRecording: true,
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
          let finalText = transcriptRef.current;
          let interimText = "";
          let confidence = confidenceRef.current;

          for (let index = event.resultIndex; index < event.results.length; index += 1) {
            const result = event.results[index];
            const item = result[0];
            if (!item?.transcript) continue;
            if (result.isFinal) {
              finalText = `${finalText} ${item.transcript}`.replace(/\s+/g, " ").trim();
              confidence = item.confidence || confidence;
            } else {
              interimText = `${interimText} ${item.transcript}`.trim();
            }
          }

          transcriptRef.current = finalText;
          confidenceRef.current = confidence;
          setVoiceState((prev) => ({
            ...prev,
            finalTranscript: finalText,
            interimTranscript: interimText,
            confidence,
            status: interimText ? "正在识别..." : "继续说，我在听"
          }));
        };

        recognition.onerror = (event: SpeechRecognitionErrorEventLike) => {
          const message = mapSpeechError(event.error);
          setVoiceState((prev) => ({
            ...prev,
            error: message,
            status: "识别异常，录音仍在"
          }));
        };

        recognition.onend = () => {
          setVoiceState((prev) => ({
            ...prev,
            isListening: false,
            status: prev.isRecording ? "识别暂停，仍在录音" : "待机"
          }));
        };

        recognition.start();
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
    [cleanupStream, resetTranscript]
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
    network: "浏览器语音识别服务暂时不可用，可先使用文本输入。",
    "audio-capture": "没有检测到麦克风输入。",
    aborted: "语音识别已停止。"
  };
  return map[error] ?? `语音识别错误：${error}`;
}
