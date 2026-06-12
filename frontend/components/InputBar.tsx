"use client";

import { Mic, Send } from "lucide-react";
import { Button } from "@/components/ui/button";

interface InputBarProps {
  disabled?: boolean;
}

export default function InputBar({ disabled = false }: InputBarProps) {
  return (
    <div className="flex items-center gap-4 rounded-[10px] border border-border bg-card px-5 py-4">
      {/* 麦克风按钮 — 纯样式,呼吸光圈不接 Web Speech */}
      <div className="relative shrink-0">
        {/* 呼吸光圈 */}
        <span
          className="animate-mic-breathe absolute inset-0 rounded-full bg-primary/20"
          aria-hidden="true"
        />
        <button
          type="button"
          aria-label="录音"
          disabled={disabled}
          className="relative z-10 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground transition-transform hover:scale-105 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Mic className="size-6" aria-hidden="true" />
        </button>
      </div>

      {/* 文本输入 */}
      <div className="flex flex-1 items-center gap-3">
        <input
          type="text"
          placeholder="输入想画的内容,或用麦克风说出来"
          disabled={disabled}
          className="h-11 flex-1 rounded-[10px] border border-border bg-secondary px-4 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-50"
        />
        <Button
          type="button"
          aria-label="发送"
          disabled={disabled}
          size="lg"
          className="gap-2"
        >
          <Send className="size-4" aria-hidden="true" />
          发送
        </Button>
      </div>
    </div>
  );
}
