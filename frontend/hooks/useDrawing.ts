// frontend/hooks/useDrawing.ts
// 绘图主 hook:管理四态(pageState) + 画布历史 + 动画 id 集合 + 指令历史,
// 对外暴露 submitInstruction / stop / 各渲染所需状态。
"use client";

import { useCallback, useRef, useState } from "react";
import { streamDraw, type StreamHandle } from "@/lib/stream";
import {
  applyCommand,
  emptyHistory,
  type DrawingHistory,
} from "@/lib/executor";
import type { DrawCommand } from "@/lib/types";

/* ── 四态 ── */
export type PageState = "idle" | "streaming" | "success" | "error";

/* ── 指令历史条目 ── */
export interface HistoryItem {
  id: string;
  instruction: string;
  status: "processing" | "done" | "error";
  summary?: string;
}

export interface UseDrawingReturn {
  pageState: PageState;
  history: DrawingHistory;
  animateIds: Set<string>;
  errorMessage: string;
  clarifyMessage: string;
  commandHistory: HistoryItem[];
  submitInstruction: (text: string) => void;
  stop: () => void;
  /** 3a:Canvas 描完一笔后单元素移除,避免 animateIds 与"本轮所有 draw"混在一起 */
  notifyAnimationDone: (id: string) => void;
}

export function useDrawing(sessionId: string): UseDrawingReturn {
  const [pageState, setPageState] = useState<PageState>("idle");
  const [history, setHistory] = useState<DrawingHistory>(emptyHistory);
  const [animateIds, setAnimateIds] = useState<Set<string>>(new Set());
  const [errorMessage, setErrorMessage] = useState("");
  const [clarifyMessage, setClarifyMessage] = useState("");
  const [commandHistory, setCommandHistory] = useState<HistoryItem[]>([]);

  const streamRef = useRef<StreamHandle | null>(null);
  // 当前正在处理的指令 id(用于 done/error 时回填状态)
  const currentItemRef = useRef<string | null>(null);

  const submitInstruction = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      if (pageState === "streaming") return; // 流式中不允许新提交

      // 中断前一个流(防御)
      streamRef.current?.abort();

      // 新轮开始:重置动画集、提示信息
      setAnimateIds(new Set());
      setErrorMessage("");
      setClarifyMessage("");
      setPageState("streaming");

      // 指令历史追加 processing 条目
      const itemId = crypto.randomUUID();
      const item: HistoryItem = {
        id: itemId,
        instruction: trimmed,
        status: "processing",
      };
      setCommandHistory((prev) => [...prev, item]);
      currentItemRef.current = itemId;

      const handle = streamDraw(sessionId, trimmed, {
        onCommand(cmd: DrawCommand) {
          // 3b:setClarifyMessage / setAnimateIds 不再嵌进 setHistory updater
          //     (updater 必须纯,strict-mode 会双调,嵌套 setState 会被调两次)
          setHistory((prev) => applyCommand(prev, cmd).history);
          if (cmd.op === "clarify") {
            // executor 对 clarify 的默认文案保持一致
            setClarifyMessage(cmd.message ?? "没太听懂,换个说法试试?");
          }
          if (cmd.op === "draw" && cmd.id) {
            const id = cmd.id;
            setAnimateIds((prev) => new Set(prev).add(id));
          }
        },
        onDone(summary: string) {
          setPageState("success");
          // 3a:正常结束兜底全量清,防止已绘元素长期挂在"动画中"
          setAnimateIds(new Set());
          // 不变式:终止路径上 commandHistory 不允许留 "processing" 条目
          //  - 当前轮(currentItemRef)→ "done" + summary
          //  - 任何残留 processing 孤儿(ref 失配的边角)→ 兜底 "error",绝不让转圈
          setCommandHistory((prev) =>
            prev.map((it) => {
              if (it.id === currentItemRef.current) {
                return { ...it, status: "done" as const, summary: summary || undefined };
              }
              if (it.status === "processing") {
                return { ...it, status: "error" as const };
              }
              return it;
            }),
          );
          currentItemRef.current = null;
        },
        onError(err: { code: string; message: string }) {
          setPageState("error");
          setErrorMessage(err.message);
          // 3a:错误同样全量清,半描元素不再卡在动画态
          setAnimateIds(new Set());
          // 不变式:当前轮 + 任何残留 processing 条目,全部转 "error",离开 pending 态
          setCommandHistory((prev) =>
            prev.map((it) =>
              it.id === currentItemRef.current || it.status === "processing"
                ? { ...it, status: "error" as const }
                : it,
            ),
          );
          currentItemRef.current = null;
        },
      });

      streamRef.current = handle;
    },
    // TODO(useDrawing): deps 含 pageState → 每次状态切换 submit 引用都变,InputBar/page 跟着重建子树。后续用 pageStateRef 解耦。
    [sessionId, pageState],
  );

  const stop = useCallback(() => {
    streamRef.current?.abort();
    streamRef.current = null;
    setPageState("idle");
    // 1b:中断后清掉上一轮残留的提示与动画集,避免错误条/半描元素跨轮显示
    setErrorMessage("");
    setClarifyMessage("");
    setAnimateIds(new Set());
    // 不变式:中断路径同样不允许留 processing
    //  - 当前轮 → "error" + summary "已中断"(HistoryItem 无 "stopped" 枚举,沿用 error)
    //  - 残留 processing 孤儿 → 兜底 "error"
    setCommandHistory((prev) =>
      prev.map((it) => {
        if (it.id === currentItemRef.current) {
          return { ...it, status: "error" as const, summary: "已中断" };
        }
        if (it.status === "processing") {
          return { ...it, status: "error" as const };
        }
        return it;
      }),
    );
    currentItemRef.current = null;
  }, []);

  // 3a:Canvas 完成单个元素描边后调用,从动画集中移除该 id
  const notifyAnimationDone = useCallback((id: string) => {
    setAnimateIds((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  return {
    pageState,
    history,
    animateIds,
    errorMessage,
    clarifyMessage,
    commandHistory,
    submitInstruction,
    stop,
    notifyAnimationDone,
  };
}
