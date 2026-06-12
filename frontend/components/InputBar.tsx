"use client";

import { useState, useCallback, useEffect, type FormEvent } from "react";
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

  const handleFinalResult = useCallback(
    (text: string) => {
      // 语音 final:把识别文本写回输入框(替换旧内容),提交后由迟清 effect 处理清空
      setInputValue(text);
      onSubmit(text);
    },
    [onSubmit],
  );

  const { isSupported, isListening, interimText, startListening } =
    useSpeech(handleFinalResult);

  // 语音中间结果实时回显到输入框
  const displayValue = isListening && interimText ? interimText : inputValue;

  const handleSubmit = useCallback(
    (e?: FormEvent) => {
      e?.preventDefault();
      if (isStreaming) return;
      const text = inputValue.trim();
      if (!text) return;
      // 不在此处清空:错误态保留文本便于直接重试,只在 success 时由 effect 清
      onSubmit(text);
    },
    [inputValue, isStreaming, onSubmit],
  );

  // #2 迟清:pageState → success 时清空输入框
  useEffect(() => {
    if (pageState === "success") {
      setInputValue("");
    }
  }, [pageState]);

  const handleMicClick = useCallback(() => {
    if (isListening) return; // 已在录音中
    startListening();
  }, [isListening, startListening]);

  return (
    <form
      onSubmit={handleSubmit}
      className="flex items-center gap-4 rounded-[10px] border border-border bg-card px-5 py-4"
    >
      {/* 麦克风按钮 — 不支持则隐藏 */}
      {isSupported && (
        <div className="relative shrink-0">
          {/* 呼吸光圈(仅录音时显示) */}
          {isListening && (
            <span
              className="animate-mic-breathe absolute inset-0 rounded-full bg-primary/20"
              aria-hidden="true"
            />
          )}
          <button
            type="button"
            aria-label={isListening ? "录音中" : "开始录音"}
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
