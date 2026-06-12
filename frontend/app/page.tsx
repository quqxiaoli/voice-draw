"use client";

import { useMemo } from "react";
import Canvas from "@/components/Canvas";
import InputBar from "@/components/InputBar";
import CommandHistory from "@/components/CommandHistory";
import { useDrawing } from "@/hooks/useDrawing";

/* ── session_id:浏览器会话级唯一标识 ── */
function getSessionId(): string {
  if (typeof window === "undefined") return "";
  const stored = sessionStorage.getItem("voice_draw_session_id");
  if (stored) return stored;
  const id = crypto.randomUUID();
  sessionStorage.setItem("voice_draw_session_id", id);
  return id;
}

export default function Page() {
  const sessionId = useMemo(() => getSessionId(), []);

  const {
    pageState,
    history,
    animateIds,
    errorMessage,
    clarifyMessage,
    commandHistory,
    submitInstruction,
    stop,
    notifyAnimationDone,
  } = useDrawing(sessionId);

  const isStreaming = pageState === "streaming";
  const isIdle = pageState === "idle";

  return (
    <main className="flex h-screen flex-col bg-background">
      {/* ── Header ── */}
      <header className="shrink-0 flex items-center justify-between border-b border-border px-8 py-5">
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-[10px] bg-primary text-primary-foreground">
            <span className="text-sm font-semibold">声</span>
          </div>
          <div>
            <h1 className="text-base font-semibold tracking-tight text-foreground">
              声绘
            </h1>
            <p className="text-xs text-muted-foreground">AI 语音绘图工具</p>
          </div>
        </div>
        <span className="rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
          测试版
        </span>
      </header>

      {/* ── 错误提示条 ── */}
      {pageState === "error" && (
        <div
          className="shrink-0 mx-6 mt-4 flex items-center gap-3 rounded-[10px] px-4 py-3 text-sm"
          style={{ background: "var(--danger-soft)", color: "var(--danger)" }}
        >
          <span className="text-base leading-none" aria-hidden="true">
            ⚠
          </span>
          <span className="flex-1">{errorMessage || "发生了一个错误,请重试"}</span>
        </div>
      )}

      {/* ── Clarify 提示条(柔和,不动画布) ── */}
      {clarifyMessage && pageState !== "error" && (
        <div
          className="shrink-0 mx-6 mt-4 flex items-center gap-3 rounded-[10px] px-4 py-3 text-sm"
          style={{ background: "var(--accent-soft)", color: "var(--brand)" }}
        >
          <span className="text-base leading-none" aria-hidden="true">
            💡
          </span>
          <span className="flex-1">{clarifyMessage}</span>
        </div>
      )}

      {/* ── 成功提示条 ── */}
      {pageState === "success" && !clarifyMessage && (
        <div
          className="shrink-0 mx-6 mt-4 flex items-center gap-3 rounded-[10px] px-4 py-3 text-sm"
          style={{ background: "var(--accent-soft)", color: "var(--brand)" }}
        >
          <span className="text-base leading-none" aria-hidden="true">
            ✓
          </span>
          <span className="flex-1">
            {history.present.elements.length === 0
              ? '已清空,说"撤销"可以找回'
              : "绘制完成！你可以继续用语音或文字修改画面"}
          </span>
        </div>
      )}

      {/* ── 主区域:左70% 画布 / 右30% 历史 ── */}
      <div className="flex-1 min-h-0 flex flex-col gap-6 p-6 lg:flex-row">
        {/* 画布区 */}
        <div className="flex flex-1 min-h-0 flex-col lg:w-[70%]">
          <section
            aria-label="绘图画布"
            className="flex h-full flex-col rounded-[10px] border border-border bg-card p-4"
          >
            <header className="shrink-0 mb-3 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-medium text-foreground">画布</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  用语音或文字绘制的内容会显示在这里
                </p>
              </div>
              {/* 流式指示 */}
              {isStreaming && (
                <span className="rounded-[10px] border border-border px-3 py-1 text-xs text-muted-foreground animate-pulse">
                  生成中…
                </span>
              )}
            </header>

            {/* 空态 */}
            {isIdle && history.present.elements.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-6 rounded-[10px] border border-dashed border-border bg-secondary">
                <p className="text-center text-sm text-muted-foreground">
                  试着说一句「画一个橙色的太阳,再在左边画一棵树」吧
                </p>
                <div className="flex flex-wrap justify-center gap-2">
                  {["画一个红色的圆", "在左下角画一棵绿树", "把天空变成浅蓝色"].map(
                    (cmd) => (
                      <button
                        key={cmd}
                        type="button"
                        disabled={isStreaming}
                        onClick={() => submitInstruction(cmd)}
                        className="rounded-[10px] border border-border bg-card px-3 py-1.5 text-xs text-foreground transition-colors hover:bg-secondary disabled:opacity-50"
                      >
                        {cmd}
                      </button>
                    ),
                  )}
                </div>
              </div>
            ) : (
              /* 非空态:挂载 Canvas */
              <div className="flex-1 min-h-0 rounded-[10px] overflow-hidden">
                <Canvas
                  state={history.present}
                  animateIds={animateIds}
                  onAnimationDone={notifyAnimationDone}
                />
              </div>
            )}
          </section>
        </div>

        {/* 指令历史 */}
        <div className="lg:w-[30%] min-h-0">
          <CommandHistory
            items={commandHistory.map((item) => ({
              id: item.id,
              instruction: item.instruction,
              status: item.status,
              summary: item.summary,
            }))}
          />
        </div>
      </div>

      {/* ── 底部输入栏 ── */}
      <div className="shrink-0 px-6 pb-6">
        <InputBar
          onSubmit={submitInstruction}
          isStreaming={isStreaming}
          onStop={stop}
          pageState={pageState}
        />
      </div>
    </main>
  );
}
