import { useCallback, useEffect, useMemo, useState } from "react";
import type { VoiceAccent } from "../types";

export function useSpeechSynthesis() {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [isSpeaking, setIsSpeaking] = useState(false);

  useEffect(() => {
    if (!("speechSynthesis" in window)) return;
    const loadVoices = () => setVoices(window.speechSynthesis.getVoices());
    loadVoices();
    window.speechSynthesis.addEventListener("voiceschanged", loadVoices);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", loadVoices);
  }, []);

  const groupedVoices = useMemo(
    () => ({
      "en-US": voices.filter((voice) => voice.lang.toLowerCase().startsWith("en-us")),
      "en-GB": voices.filter((voice) => voice.lang.toLowerCase().startsWith("en-gb")),
      "en-AU": voices.filter((voice) => voice.lang.toLowerCase().startsWith("en-au"))
    }),
    [voices]
  );

  const speak = useCallback(
    (text: string, options: { accent: VoiceAccent; rate: number; voiceURI?: string; onEnd?: () => void }) => {
      if (!("speechSynthesis" in window)) {
        options.onEnd?.();
        return;
      }
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      const selectedVoice =
        voices.find((voice) => voice.voiceURI === options.voiceURI) ??
        groupedVoices[options.accent][0] ??
        voices.find((voice) => voice.lang.toLowerCase().startsWith("en"));
      utterance.voice = selectedVoice ?? null;
      utterance.lang = options.accent;
      utterance.rate = options.rate;
      utterance.pitch = 1;
      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => {
        setIsSpeaking(false);
        options.onEnd?.();
      };
      utterance.onerror = () => {
        setIsSpeaking(false);
        options.onEnd?.();
      };
      window.speechSynthesis.speak(utterance);
    },
    [groupedVoices, voices]
  );

  const stopSpeaking = useCallback(() => {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  }, []);

  return {
    voices,
    groupedVoices,
    isSpeaking,
    speak,
    stopSpeaking
  };
}
