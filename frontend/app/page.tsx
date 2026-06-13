"use client";

import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import Canvas from "@/components/Canvas";
import InputBar from "@/components/InputBar";
import CommandHistory from "@/components/CommandHistory";
import { useDrawing } from "@/hooks/useDrawing";
import { genId } from "@/lib/id";

const SUCCESS_TOAST_MS = 3000;

/* ── session_id:浏览器会话级唯一标识 ── */
function getSessionId(): string {
  if (typeof window === "undefined") return "";
  const stored = sessionStorage.getItem("voice_draw_session_id");
  if (stored) return stored;
  const id = genId();
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
    dismissClarify,
    dismissError,
  } = useDrawing(sessionId);

  const isStreaming = pageState === "streaming";
  const isIdle = pageState === "idle";
  const showEmpty = isIdle && history.present.elements.length === 0;

  // success 提示条:进入 success 即显,3s 后淡出(150ms 过渡);clarify/error 由用户手动 ×
  const [successToastVisible, setSuccessToastVisible] = useState(false);
  useEffect(() => {
    // setState 同步赋值是这里的本意:每次进入 success 都要立刻显示,然后由 timer 触发淡出
    /* eslint-disable react-hooks/set-state-in-effect */
    if (pageState !== "success") {
      setSuccessToastVisible(false);
      return;
    }
    setSuccessToastVisible(true);
    const t = window.setTimeout(() => setSuccessToastVisible(false), SUCCESS_TOAST_MS);
    return () => window.clearTimeout(t);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [pageState]);

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

            {/* 画布主区:空态/Canvas 同容器叠放,opacity 切换;SVG slice 铺满,无空白边 */}
            <div className="relative flex-1 min-h-0">
              {/* 空态 */}
              <div
                className={`absolute inset-0 flex flex-col items-center justify-center gap-6 rounded-[10px] border border-dashed border-border bg-secondary transition-opacity duration-150 ${showEmpty ? "opacity-100" : "pointer-events-none opacity-0"}`}
              >
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

              {/* Canvas:与空态同容器叠放、同背景,opacity 切换消除尺寸跳变 */}
              <div
                className={`absolute inset-0 rounded-[10px] overflow-hidden bg-secondary transition-opacity duration-150 ${showEmpty ? "pointer-events-none opacity-0" : "opacity-100"}`}
              >
                <Canvas
                  state={history.present}
                  animateIds={animateIds}
                  onAnimationDone={notifyAnimationDone}
                />
              </div>

              {/* 提示条 overlay:画布顶部浮动,pointer-events-none 容器 + auto 子项,不拦截画布点击 */}
              <div className="pointer-events-none absolute inset-x-2 top-2 z-10 flex flex-col gap-2">
                {pageState === "error" && (
                  <div
                    className="pointer-events-auto flex items-start gap-3 rounded-[10px] px-4 py-3 text-sm shadow-sm"
                    style={{ background: "var(--danger-soft)", color: "var(--danger)" }}
                  >
                    <span className="mt-0.5 text-base leading-none" aria-hidden="true">
                      ⚠
                    </span>
                    <span className="flex-1">
                      {errorMessage || "发生了一个错误,请重试"}
                    </span>
                    <button
                      type="button"
                      onClick={dismissError}
                      aria-label="关闭提示"
                      className="-mr-1 -mt-1 shrink-0 rounded-[10px] p-1 opacity-70 transition-opacity hover:opacity-100"
                    >
                      <X className="size-4" aria-hidden="true" />
                    </button>
                  </div>
                )}
                {clarifyMessage && pageState !== "error" && (
                  <div
                    className="pointer-events-auto flex items-start gap-3 rounded-[10px] px-4 py-3 text-sm shadow-sm"
                    style={{ background: "var(--accent-soft)", color: "var(--brand)" }}
                  >
                    <span className="mt-0.5 text-base leading-none" aria-hidden="true">
                      💡
                    </span>
                    <span className="flex-1">{clarifyMessage}</span>
                    <button
                      type="button"
                      onClick={dismissClarify}
                      aria-label="关闭提示"
                      className="-mr-1 -mt-1 shrink-0 rounded-[10px] p-1 opacity-70 transition-opacity hover:opacity-100"
                    >
                      <X className="size-4" aria-hidden="true" />
                    </button>
                  </div>
                )}
                {pageState === "success" && !clarifyMessage && (
                  <div
                    className={`pointer-events-auto flex items-center gap-3 rounded-[10px] px-4 py-3 text-sm shadow-sm transition-opacity duration-150 ${successToastVisible ? "opacity-100" : "opacity-0"}`}
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
              </div>
            </div>
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
