// frontend/hooks/useSpeech.ts
// Web Speech 语音识别 hook:
// - 基于 webkitSpeechRecognition / SpeechRecognition(浏览器内置 API)
// - lang: zh-CN, interimResults 实时回显
// - final 结果通过 onFinalResult 回调自动触发提交
// - 不支持的浏览器 isSupported=false,隐藏麦克风按钮
"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/* ── 最小类型声明(兼容浏览器 API,不依赖 lib.dom 中可能缺失的声明) ── */
interface SpeechRecognitionInstance {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionResultEvent) => void) | null;
  onerror: ((event: SpeechRecognitionError) => void) | null;
  onend: (() => void) | null;
}

interface SpeechRecognitionResultEvent {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: {
      isFinal: boolean;
      length: number;
      [index: number]: { transcript: string };
    };
  };
}

interface SpeechRecognitionError {
  error: string;
  message?: string;
}

type SpeechCtor = new () => SpeechRecognitionInstance;

function getSpeechCtor(): SpeechCtor | null {
  if (typeof window === "undefined") return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = window as any;
  return (
    (w.SpeechRecognition as SpeechCtor | undefined) ??
    (w.webkitSpeechRecognition as SpeechCtor | undefined) ??
    null
  );
}

export interface UseSpeechReturn {
  isSupported: boolean;
  isListening: boolean;
  interimText: string;
  startListening: () => void;
  stopListening: () => void;
}

export function useSpeech(
  onFinalResult: (text: string) => void,
): UseSpeechReturn {
  const [isSupported, setIsSupported] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [interimText, setInterimText] = useState("");
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const onFinalRef = useRef(onFinalResult);
  onFinalRef.current = onFinalResult;

  useEffect(() => {
    const Ctor = getSpeechCtor();
    if (!Ctor) {
      setIsSupported(false);
      return;
    }

    setIsSupported(true);

    const recognition = new Ctor();
    recognition.lang = "zh-CN";
    recognition.interimResults = true;
    recognition.continuous = false;

    recognition.onresult = (event: SpeechRecognitionResultEvent) => {
      let final = "";
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (!result) continue;
        if (result.isFinal) {
          final += result[0]?.transcript ?? "";
        } else {
          interim += result[0]?.transcript ?? "";
        }
      }

      setInterimText(interim);

      if (final.trim()) {
        setInterimText("");
        onFinalRef.current(final.trim());
      }
    };

    recognition.onerror = (event: SpeechRecognitionError) => {
      if (event.error === "aborted" || event.error === "no-speech") {
        return;
      }
      console.warn("[speech] recognition error:", event.error, event.message);
      setIsListening(false);
      setInterimText("");
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;

    return () => {
      try { recognition.abort(); } catch { /* ignore */ }
    };
  }, []);

  const startListening = useCallback(() => {
    const rec = recognitionRef.current;
    if (!rec || isListening) return;
    setInterimText("");
    try {
      rec.start();
      setIsListening(true);
    } catch {
      // 已在运行中,忽略
    }
  }, [isListening]);

  const stopListening = useCallback(() => {
    const rec = recognitionRef.current;
    if (!rec) return;
    try { rec.stop(); } catch { /* ignore */ }
    setIsListening(false);
  }, []);

  return { isSupported, isListening, interimText, startListening, stopListening };
}
