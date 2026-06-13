// frontend/hooks/useDrawing.ts
// 绘图主 hook:管理四态(pageState) + 画布历史 + 命令队列(逐笔节奏) + 指令历史。
// 核心设计:收到的 DrawCommand 先入队,按固定节拍出队执行,
// draw 类型等描边动画完成后 + 间隙再出队下一条,
// 非 draw 类型延迟 150ms 出队。解决 React 18 自动批处理 + SSE 批量到达
// 导致所有元素同帧挂载、描边动画同时开跑的问题。
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
  status: "processing" | "done" | "error" | "hint";
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
  /** Canvas 描完一笔后回调,从动画集移除该 id 并推进命令队列 */
  notifyAnimationDone: (id: string) => void;
  /** 关闭 clarify 提示条(用户点 ×) */
  dismissClarify: () => void;
  /** 关闭 error 提示条:清错误信息并回到 idle,允许重新提交 */
  dismissError: () => void;
}

/** 非 draw 命令的出队间隙(ms) */
const NON_DRAW_GAP = 150;
/** draw 命令动画完成后的间隙(ms) */
const DRAW_GAP = 100;
/** 指令最大字符数,与 backend handler binding:"max=500" 对齐(api-contract.md) */
const MAX_INSTRUCTION_LENGTH = 500;

export function useDrawing(sessionId: string): UseDrawingReturn {
  const [pageState, setPageState] = useState<PageState>("idle");
  const [history, setHistory] = useState<DrawingHistory>(emptyHistory);
  const [animateIds, setAnimateIds] = useState<Set<string>>(new Set());
  const [errorMessage, setErrorMessage] = useState("");
  const [clarifyMessage, setClarifyMessage] = useState("");
  const [commandHistory, setCommandHistory] = useState<HistoryItem[]>([]);

  // pageStateRef:供 submitInstruction 同步守卫使用,避免把 pageState 放进 useCallback 依赖
  // 导致每次态切换 submit 引用变 → InputBar/page 子树重建。
  const pageStateRef = useRef<PageState>("idle");
  useEffect(() => {
    pageStateRef.current = pageState;
  }, [pageState]);

  // ── 命令队列(逐笔节奏控制) ──
  const queueRef = useRef<DrawCommand[]>([]);
  const processingRef = useRef(false); // 是否正在执行一条命令
  const waitingDrawRef = useRef(false); // 是否在等 draw 动画完成
  const phaseRef = useRef(0); // 递增以取消旧定时器
  const historyRef = useRef<DrawingHistory>(emptyHistory()); // 与 setHistory 同步的最新快照
  const streamRef = useRef<StreamHandle | null>(null);
  const currentItemRef = useRef<string | null>(null);
  // 本轮是否执行过真实绘图命令(非 clarify),用于 onDone 区分 hint/done
  const hasDrawCommandRef = useRef(false);

  // ── processQueue:从队列取一条执行,按命令类型控制节奏 ──
  const processQueue = useCallback(() => {
    if (processingRef.current || waitingDrawRef.current) return;
    if (queueRef.current.length === 0) return;

    const cmd = queueRef.current.shift()!;
    processingRef.current = true;

    // clarify 提示条——与画布无关,可提前设
    if (cmd.op === "clarify") {
      setClarifyMessage(cmd.message ?? "没太听懂,换个说法试试?");
    }

    // draw 命令:提前将 id 加入 animateIds,渲染时进入动画态
    if (cmd.op === "draw" && cmd.id) {
      const id = cmd.id;
      setAnimateIds((prev) => new Set(prev).add(id));
    }

    // 执行命令(用 historyRef 保持最新,不依赖闭包中的 history state)
    const result = applyCommand(historyRef.current, cmd);
    historyRef.current = result.history;
    setHistory(result.history);

    // 标记本轮有真实绘图命令(非 clarify),用于 onDone 区分 hint/done
    if (cmd.op !== "clarify") {
      hasDrawCommandRef.current = true;
    }

    // executor 层 clarify 兜底
    if (result.clarify) {
      setClarifyMessage(result.clarify);
    }

    // 根据命令类型决定下一步节奏
    if (cmd.op === "draw") {
      // draw:等描边动画完成,由 notifyAnimationDone 推进
      waitingDrawRef.current = true;
      processingRef.current = false;
    } else {
      // 非 draw:间隙期保持 processingRef=true,让间隙内 onCommand 到达的命令也入队等待,
      // 避免连发 modify/delete 时新命令绕过节奏立即执行(节奏塌缩)。
      const phase = ++phaseRef.current;
      setTimeout(() => {
        if (phase !== phaseRef.current) return;
        processingRef.current = false;
        processQueue();
      }, NON_DRAW_GAP);
    }
  }, []);

  // ── notifyAnimationDone:单笔描边完成后,移除 id 并推进队列 ──
  const notifyAnimationDone = useCallback(
    (_id: string) => {
      setAnimateIds((prev) => {
        if (!prev.has(_id)) return prev;
        const next = new Set(prev);
        next.delete(_id);
        return next;
      });

      // 如果正在等动画完成,推进队列处理下一条
      if (waitingDrawRef.current) {
        waitingDrawRef.current = false;
        const phase = ++phaseRef.current;
        setTimeout(() => {
          if (phase === phaseRef.current) processQueue();
        }, DRAW_GAP);
      }
    },
    [processQueue],
  );

  // ── submitInstruction ──
  const submitInstruction = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      if (pageStateRef.current === "streaming") return;
      // 本地长度校验:超 500 字符不发请求,本地柔和提示,避免触发后端 400 INVALID_INPUT。
      // 字符数按 rune(代码点)计,与后端 go-playground/validator max 语义对齐
      if ([...trimmed].length > MAX_INSTRUCTION_LENGTH) {
        setClarifyMessage("指令过长请精简");
        return;
      }
      // 同步占位,挡住同事件循环内的二次提交(setPageState 异步,光靠 React state 来不及)
      pageStateRef.current = "streaming";

      // 中断前一个流
      streamRef.current?.abort();

      // 清空队列与处理状态,递增 phase 取消旧定时器
      queueRef.current = [];
      processingRef.current = false;
      waitingDrawRef.current = false;
      hasDrawCommandRef.current = false;
      ++phaseRef.current;

      // 新轮开始:重置动画集与提示信息(history 保留,画布不清空)
      setAnimateIds(new Set());
      setErrorMessage("");
      setClarifyMessage("");
      setPageState("streaming");

      // 指令历史
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
          // 入队而非直接执行,由 processQueue 按节拍出队
          queueRef.current.push(cmd);
          processQueue();
        },
        onDone(summary: string) {
          setPageState("success");
          // 不再全量清 animateIds:让队列自然排空,最后一笔动画播完自动清
          const itemId = currentItemRef.current;
          const finalStatus = hasDrawCommandRef.current ? ("done" as const) : ("hint" as const);
          setCommandHistory((prev) =>
            prev.map((it) =>
              it.id === itemId
                ? {
                    ...it,
                    status: finalStatus,
                    summary: summary || undefined,
                  }
                : it,
            ),
          );
          currentItemRef.current = null;
        },
        onError(err: { code: string; message: string }) {
          setPageState("error");
          setErrorMessage(err.message);
          setClarifyMessage("");
          // 清空队列:错误后不再执行未处理的命令(已执行的保留)
          queueRef.current = [];
          processingRef.current = false;
          waitingDrawRef.current = false;
          ++phaseRef.current;
          setAnimateIds(new Set());
          const itemId = currentItemRef.current;
          setCommandHistory((prev) =>
            prev.map((it) =>
              it.id === itemId ? { ...it, status: "error" as const } : it,
            ),
          );
          currentItemRef.current = null;
        },
      });

      streamRef.current = handle;
    },
    [sessionId, processQueue],
  );

  // ── stop(用户主动中断) ──
  const stop = useCallback(() => {
    streamRef.current?.abort();
    streamRef.current = null;
    setPageState("idle");
    setErrorMessage("");
    setClarifyMessage("");
    setAnimateIds(new Set());
    // 清空队列
    queueRef.current = [];
    processingRef.current = false;
    waitingDrawRef.current = false;
    ++phaseRef.current;

    const itemId = currentItemRef.current;
    setCommandHistory((prev) =>
      prev.map((it) =>
        it.id === itemId
          ? { ...it, status: "error" as const, summary: "已中断" }
          : it,
      ),
    );
    currentItemRef.current = null;
  }, []);

  const dismissClarify = useCallback(() => {
    setClarifyMessage("");
  }, []);

  const dismissError = useCallback(() => {
    setErrorMessage("");
    setPageState((prev) => (prev === "error" ? "idle" : prev));
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
    dismissClarify,
    dismissError,
  };
}
