"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Canvas from "@/components/Canvas";
import InputBar from "@/components/InputBar";
import CommandHistory from "@/components/CommandHistory";
import { applyCommand, emptyHistory, type DrawingHistory } from "@/lib/executor";
import type { DrawCommand } from "@/lib/types";

/* ── 四态定义 ── */
type PageState = "idle" | "streaming" | "success" | "error";

/* ── mock 演示命令序列:太阳 + 树 ── */
const DEMO_COMMANDS: DrawCommand[] = [
  {
    op: "draw", id: "sky", shape: "rect",
    attrs: { x: 0, y: 0, width: 1000, height: 380, fill: "#D4E8F0", stroke: "none" },
  },
  {
    op: "draw", id: "sun", shape: "circle",
    attrs: { cx: 800, cy: 150, r: 55, fill: "#F4C542", stroke: "#E0A800", "stroke-width": 2 },
  },
  {
    op: "draw", id: "ground", shape: "rect",
    attrs: { x: 0, y: 380, width: 1000, height: 370, fill: "#C8D8A0", stroke: "none" },
  },
  {
    op: "draw", id: "trunk", shape: "rect",
    attrs: { x: 160, y: 280, width: 30, height: 130, fill: "#8B6914", stroke: "#6B4F12", "stroke-width": 2 },
  },
  {
    op: "draw", id: "crown", shape: "circle",
    attrs: { cx: 175, cy: 250, r: 75, fill: "#7C9A83", stroke: "#5A7A61", "stroke-width": 2 },
  },
];

/* ── 示例指令（空态引导） ── */
const EXAMPLE_COMMANDS = [
  "画一个红色的圆",
  "在左下角画一棵绿树",
  "把天空变成浅蓝色",
];

export default function Page() {
  const [pageState, setPageState] = useState<PageState>("idle");
  const [history, setHistory] = useState<DrawingHistory>(emptyHistory);
  const [animateIds, setAnimateIds] = useState<Set<string>>(new Set());
  const [errorMessage, setErrorMessage] = useState<string>("");
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stepRef = useRef(0);

  /* ── 清理 timer ── */
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  /* ── 执行 mock 演示 ── */
  const runDemo = useCallback(() => {
    // 重置
    stepRef.current = 0;
    setHistory(emptyHistory());
    setAnimateIds(new Set());
    setPageState("streaming");
    setErrorMessage("");

    timerRef.current = setInterval(() => {
      stepRef.current += 1;
      const idx = stepRef.current - 1;

      if (idx >= DEMO_COMMANDS.length) {
        // 全部执行完毕 → 成功态
        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = null;
        setPageState("success");
        return;
      }

      const cmd = DEMO_COMMANDS[idx];
      setHistory((prev) => {
        const result = applyCommand(prev, cmd);
        if (result.clarify) {
          // clarify 走错误态（柔和提示）
          setErrorMessage(result.clarify);
          setPageState("error");
          if (timerRef.current) clearInterval(timerRef.current);
          timerRef.current = null;
        }
        // 标记新元素为 animated
        if (cmd.id) {
          const elId: string = cmd.id;
          setAnimateIds((prev) => new Set(prev).add(elId));
        }
        return result.history;
      });
    }, 300);
  }, []);

  /* ── 手动切换四态（TODO:接线后删除） ── */
  const switchState = (s: PageState) => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    setPageState(s);
    if (s === "idle") {
      setHistory(emptyHistory());
      setAnimateIds(new Set());
      setErrorMessage("");
    } else if (s === "error") {
      setErrorMessage("抱歉,我没有理解你的指令,换个说法试试?");
    }
  };

  const isInputDisabled = pageState === "streaming";

  return (
    <main className="flex min-h-screen flex-col bg-background">
      {/* ── Header ── */}
      <header className="flex items-center justify-between border-b border-border px-8 py-5">
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
          className="mx-6 mt-4 flex items-center gap-3 rounded-[10px] px-4 py-3 text-sm"
          style={{ background: "var(--danger-soft)", color: "var(--danger)" }}
        >
          <span className="text-base leading-none" aria-hidden="true">⚠</span>
          <span className="flex-1">{errorMessage || "发生了一个错误,请重试"}</span>
          <button
            type="button"
            onClick={() => switchState("idle")}
            className="rounded-[10px] border px-3 py-1 text-xs transition-colors hover:opacity-80"
            style={{ borderColor: "var(--danger)", color: "var(--danger)" }}
          >
            重试
          </button>
        </div>
      )}

      {/* ── Clarify 提示条(复用同一组件,换 accent-soft 底) ── */}
      {pageState === "success" && (
        <div
          className="mx-6 mt-4 flex items-center gap-3 rounded-[10px] px-4 py-3 text-sm"
          style={{ background: "var(--accent-soft)", color: "var(--brand)" }}
        >
          <span className="text-base leading-none" aria-hidden="true">✓</span>
          <span className="flex-1">绘制完成！你可以继续用语音或文字修改画面</span>
        </div>
      )}

      {/* ── 主区域:左70% 画布 / 右30% 历史 ── */}
      <div className="flex flex-1 flex-col gap-6 p-6 lg:flex-row">
        {/* 画布区 */}
        <div className="flex flex-col lg:w-[70%]">
          <section
            aria-label="绘图画布"
            className="flex min-h-[480px] flex-1 flex-col rounded-[10px] border border-border bg-card p-6"
          >
            <header className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-medium text-foreground">画布</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  用语音或文字绘制的内容会显示在这里
                </p>
              </div>
              {/* 流式中:停止按钮占位 */}
              {pageState === "streaming" && (
                <button
                  type="button"
                  disabled
                  className="rounded-[10px] border border-border px-3 py-1 text-xs text-muted-foreground"
                >
                  停止生成
                </button>
              )}
            </header>

            {/* 空态:引导文案 + 示例入口 */}
            {pageState === "idle" ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-6 rounded-[10px] border border-dashed border-border bg-secondary">
                <p className="text-center text-sm text-muted-foreground">
                  试着说一句「画一个橙色的太阳,再在左边画一棵树」吧
                </p>
                <div className="flex flex-wrap justify-center gap-2">
                  {EXAMPLE_COMMANDS.map((cmd) => (
                    <button
                      key={cmd}
                      type="button"
                      className="rounded-[10px] border border-border bg-card px-3 py-1.5 text-xs text-foreground transition-colors hover:bg-secondary"
                    >
                      {cmd}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              /* 非空态:挂载 Canvas */
              <div className="flex-1 rounded-[10px] overflow-hidden">
                <Canvas state={history.present} animateIds={animateIds} />
              </div>
            )}
          </section>
        </div>

        {/* 指令历史 */}
        <div className="lg:w-[30%]">
          <CommandHistory />
        </div>
      </div>

      {/* ── 底部输入栏 ── */}
      <div className="px-6 pb-6">
        <InputBar disabled={isInputDisabled} />
      </div>

      {/* ── TODO:接线后删除此四态切换按钮 ── */}
      <div className="fixed bottom-4 right-4 z-50 flex gap-2 rounded-[10px] border border-border bg-card p-2 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <span className="self-center text-[10px] text-muted-foreground mr-1">
          TODO:接线后删除
        </span>
        {(["idle", "streaming", "success", "error"] as PageState[]).map(
          (s) => (
            <button
              key={s}
              type="button"
              onClick={() => switchState(s)}
              className={`rounded-[10px] border px-2 py-1 text-[11px] transition-colors ${
                pageState === s
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-foreground hover:bg-secondary"
              }`}
            >
              {s === "idle"
                ? "空态"
                : s === "streaming"
                  ? "流式中"
                  : s === "success"
                    ? "成功"
                    : "错误"}
            </button>
          )
        )}
        {/* 演示按钮 */}
        <button
          type="button"
          onClick={runDemo}
          disabled={pageState === "streaming"}
          className="rounded-[10px] border border-primary bg-primary px-2 py-1 text-[11px] text-primary-foreground transition-colors hover:opacity-90 disabled:opacity-50"
        >
          演示
        </button>
      </div>
    </main>
  );
}
