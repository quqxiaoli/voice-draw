"use client";

import { useState, useCallback, useEffect, useRef, type FormEvent } from "react";
import { Mic, Send, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSpeech } from "@/hooks/useSpeech";

interface InputBarProps {
  onSubmit: (text: string) => void;
  isStreaming: boolean;
  onStop: () => void;
  /** #2 迟清:由 page 透传当前页面态,success 时才清输入框,error/idle 留住文本便于重试 */
  pageState: "idle" | "streaming" | "success" | "error";
}

export default function InputBar({
  onSubmit,
  isStreaming,
  onStop,
  pageState,
}: InputBarProps) {
  const [inputValue, setInputValue] = useState("");
  // 上次成功提交的文本:挡住静默定时器/isFinal/手动点击 同事件循环或紧邻两次相同提交;
  // pageState 离开 streaming 时清,允许后续重提交相同指令。
  const lastSubmittedRef = useRef("");

  // 单一提交入口:trim + isStreaming 守卫 + 同文本去重,所有路径(手动/语音)都走这里
  const submit = useCallback(
    (text: string) => {
      if (isStreaming) return;
      const t = text.trim();
      if (!t) return;
      if (t === lastSubmittedRef.current) return;
      lastSubmittedRef.current = t;
      onSubmit(t);
    },
    [isStreaming, onSubmit],
  );

  const handleFinalResult = useCallback(
    (text: string) => {
      // 流式期间禁止语音 final 写回输入框/提交,丢弃 interim 残留,避免覆盖正在流式渲染的内容
      if (isStreaming) return;
      // 语音 final:把识别文本写回输入框(替换旧内容),提交后由迟清 effect 处理清空
      setInputValue(text);
      submit(text);
    },
    [isStreaming, submit],
  );

  const { isSupported, isListening, liveText, startListening, stopAndSubmit } =
    useSpeech(handleFinalResult);

  // 识别期间:输入框显示 hook 的 liveText(已 final 累积 + 当前 interim);
  // 流式期间锁定 inputValue,即使 liveText 仍有残留也不显示,防止覆盖用户上下文
  const displayValue = isStreaming ? inputValue : isListening ? liveText : inputValue;

  const handleSubmit = useCallback(
    (e?: FormEvent) => {
      e?.preventDefault();
      submit(inputValue);
    },
    [inputValue, submit],
  );

  // #2 迟清:pageState → success 时清空输入框
  useEffect(() => {
    if (pageState === "success") {
      setInputValue("");
    }
    // 离开 streaming(success/error/idle):放开同文本去重,允许重试或再次提交相同指令
    if (pageState !== "streaming") {
      lastSubmittedRef.current = "";
    }
  }, [pageState]);

  // 麦克风 toggle:未录则开始;已录则立即提交并停止(用户主动结束,免等 1.2s 静默)
  const handleMicClick = useCallback(() => {
    if (isListening) {
      stopAndSubmit();
    } else {
      startListening();
    }
  }, [isListening, startListening, stopAndSubmit]);

  return (
    <form
      onSubmit={handleSubmit}
      className="flex min-h-[5.5rem] items-center gap-4 rounded-[10px] border border-border bg-card px-5 py-4"
    >
      {/* 麦克风按钮 — 不支持则隐藏。wrapper 显式 size-14 锁定,防止 isListening 时呼吸圈/状态切换引发任何尺寸抖动 */}
      {isSupported && (
        <div className="relative size-14 shrink-0">
          {/* 呼吸光圈(仅录音时显示):absolute + transform-only,不挤占布局 */}
          {isListening && (
            <span
              className="animate-mic-breathe pointer-events-none absolute inset-0 rounded-full bg-primary/20"
              aria-hidden="true"
            />
          )}
          <button
            type="button"
            aria-label={isListening ? "结束录音并提交" : "开始录音"}
            disabled={isStreaming}
            onClick={handleMicClick}
            className={`relative z-10 flex size-14 items-center justify-center rounded-full transition-transform hover:scale-105 disabled:cursor-not-allowed disabled:opacity-50 ${
              isListening
                ? "bg-[var(--danger)] text-white"
                : "bg-primary text-primary-foreground"
            }`}
          >
            <Mic className="size-6" aria-hidden="true" />
          </button>
        </div>
      )}

      {/* 文本输入 */}
      <div className="flex flex-1 items-center gap-3">
        <input
          type="text"
          value={displayValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="输入想画的内容,或用麦克风说出来"
          disabled={isStreaming}
          className="h-11 flex-1 rounded-[10px] border border-border bg-secondary px-4 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-50"
        />

        {/* 流式中 → 停止按钮;否则 → 发送按钮 */}
        {isStreaming ? (
          <Button
            type="button"
            aria-label="停止生成"
            onClick={onStop}
            size="lg"
            variant="destructive"
            className="gap-2"
          >
            <Square className="size-4" aria-hidden="true" />
            停止
          </Button>
        ) : (
          <Button
            type="submit"
            aria-label="发送"
            disabled={!inputValue.trim() && !isListening}
            size="lg"
            className="gap-2"
          >
            <Send className="size-4" aria-hidden="true" />
            发送
          </Button>
        )}
      </div>
    </form>
  );
}
