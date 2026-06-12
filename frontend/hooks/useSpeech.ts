// frontend/hooks/useSpeech.ts
// Web Speech 语音识别 hook(累积 + 静默检测 + 主动结束):
// - lang: zh-CN, interimResults 实时回显;continuous=true,引擎不自动 end,由本 hook 主导停止时机
// - final 不再"一段一发":累积到 finalText,任何新 interim/final 都重置 SILENCE_MS 静默计时器
// - 静默满 SILENCE_MS → 自动提交累积文本 + 停止识别
// - 用户主动结束(toggle 第二次点击)→ stopAndSubmit:立即提交累积 + 停止,不等静默
// - 暴露 liveText = finalText + interimText,UI 直接绑到输入框做实时回显
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
  /** 已 final 的累积 + 当前 interim,UI 用作识别期间输入框回显内容 */
  liveText: string;
  startListening: () => void;
  /** 用户主动结束:立即提交累积文本并停止识别(不等静默) */
  stopAndSubmit: () => void;
}

export function useSpeech(
  onFinalResult: (text: string) => void,
  silenceMs: number = 1200,
): UseSpeechReturn {
  const [isSupported, setIsSupported] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [finalText, setFinalText] = useState("");
  const [interimText, setInterimText] = useState("");
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const onFinalRef = useRef(onFinalResult);
  onFinalRef.current = onFinalResult;

  // 累积缓冲(refs 给 timer / stopAndSubmit / onresult 同步访问;state 仅驱动 UI 渲染)
  const finalTextRef = useRef("");
  const interimTextRef = useRef("");
  const silenceTimerRef = useRef<number | null>(null);
  const silenceMsRef = useRef(silenceMs);
  silenceMsRef.current = silenceMs;
  // flushAndStop 之后到 onend 之间可能仍有残响 onresult,gate 之
  const acceptingRef = useRef(false);

  // 收尾路径(silence timer 触发 / stopAndSubmit 共用):提交累积 + 清状态 + 停识别
  const flushAndStop = useCallback(() => {
    if (!acceptingRef.current && silenceTimerRef.current == null) return; // 已收尾,幂等
    acceptingRef.current = false;
    if (silenceTimerRef.current != null) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    const rec = recognitionRef.current;
    try { rec?.stop(); } catch { /* ignore */ }
    const text = (finalTextRef.current + interimTextRef.current).trim();
    finalTextRef.current = "";
    interimTextRef.current = "";
    setFinalText("");
    setInterimText("");
    setIsListening(false);
    if (text) onFinalRef.current(text);
  }, []);

  // 任何 interim/final 到达 → 重置 1.2s 静默计时器
  const armSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current != null) clearTimeout(silenceTimerRef.current);
    silenceTimerRef.current = window.setTimeout(() => {
      silenceTimerRef.current = null;
      flushAndStop();
    }, silenceMsRef.current);
  }, [flushAndStop]);

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
    // continuous=true:引擎跨多次静默持续监听,何时停由本 hook 的静默计时器/用户 toggle 决定
    recognition.continuous = true;

    recognition.onresult = (event: SpeechRecognitionResultEvent) => {
      if (!acceptingRef.current) return; // 收尾后到 onend 间的残响:丢弃,避免二次提交

      let newFinal = "";
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (!result) continue;
        if (result.isFinal) {
          newFinal += result[0]?.transcript ?? "";
        } else {
          interim += result[0]?.transcript ?? "";
        }
      }

      if (newFinal) {
        finalTextRef.current += newFinal;
        setFinalText(finalTextRef.current);
      }
      interimTextRef.current = interim;
      setInterimText(interim);

      if (newFinal || interim) {
        armSilenceTimer();
      }
    };

    recognition.onerror = (event: SpeechRecognitionError) => {
      if (event.error === "aborted" || event.error === "no-speech") return;
      console.warn("[speech] recognition error:", event.error, event.message);
      // 错误路径:不强行提交残文(可能是噪声),清掉累积 + 停止
      acceptingRef.current = false;
      if (silenceTimerRef.current != null) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }
      finalTextRef.current = "";
      interimTextRef.current = "";
      setFinalText("");
      setInterimText("");
      setIsListening(false);
    };

    recognition.onend = () => {
      // 引擎自然结束 / abort / 我们 stop 之后:若静默计时器仍排队中,让它自己跑完 flushAndStop;
      // 否则直接收尾(无 result 进入就 end 的情况)
      if (silenceTimerRef.current != null) return;
      acceptingRef.current = false;
      interimTextRef.current = "";
      setInterimText("");
      setIsListening(false);
    };

    recognitionRef.current = recognition;

    return () => {
      if (silenceTimerRef.current != null) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }
      acceptingRef.current = false;
      try { recognition.abort(); } catch { /* ignore */ }
    };
  }, [armSilenceTimer]);

  const startListening = useCallback(() => {
    const rec = recognitionRef.current;
    if (!rec || isListening) return;
    // 新一轮:清上一轮可能残留的累积与计时器
    finalTextRef.current = "";
    interimTextRef.current = "";
    setFinalText("");
    setInterimText("");
    if (silenceTimerRef.current != null) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    try {
      rec.start();
      acceptingRef.current = true;
      setIsListening(true);
    } catch {
      // 已在运行中,忽略
    }
  }, [isListening]);

  const stopAndSubmit = useCallback(() => {
    flushAndStop();
  }, [flushAndStop]);

  const liveText = finalText + interimText;

  return { isSupported, isListening, liveText, startListening, stopAndSubmit };
}
