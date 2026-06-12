// frontend/lib/executor.ts
// 命令执行器(纯函数,UI 无关):DrawCommand → 画布状态。
// undo 用快照栈实现:每条改画布的命令执行前压栈,undo = 弹栈恢复。简单且语义正确。
import type { DrawCommand } from "./types";

export interface CanvasElement {
  id: string;
  shape: NonNullable<DrawCommand["shape"]>;
  attrs: Record<string, string | number>;
}

export interface CanvasState {
  elements: CanvasElement[]; // 顺序即绘制层级(先画的在下)
}

export interface DrawingHistory {
  past: CanvasState[];   // 快照栈,容量上限防膨胀
  present: CanvasState;
}

const MAX_SNAPSHOTS = 50;

export const emptyHistory = (): DrawingHistory => ({
  past: [],
  present: { elements: [] },
});

export interface ApplyResult {
  history: DrawingHistory;
  clarify?: string; // op=clarify 时带出提示文案,UI 显示为柔和提示条
}

/** 应用一条命令,返回新历史(不可变更新,React 友好)。 */
export function applyCommand(h: DrawingHistory, cmd: DrawCommand): ApplyResult {
  switch (cmd.op) {
    case "draw": {
      if (!cmd.id || !cmd.shape) return { history: h };
      const el: CanvasElement = { id: cmd.id, shape: cmd.shape, attrs: { ...cmd.attrs } };
      const exists = h.present.elements.some((e) => e.id === el.id);
      const elements = exists
        ? h.present.elements.map((e) => (e.id === el.id ? el : e)) // 同 id 视为重画
        : [...h.present.elements, el];
      return { history: push(h, { elements }) };
    }
    case "modify": {
      if (!cmd.id) return { history: h };
      const hit = h.present.elements.some((e) => e.id === cmd.id);
      if (!hit) return { history: h }; // 引用不存在的 id:静默忽略,不崩
      const elements = h.present.elements.map((e) =>
        e.id === cmd.id ? { ...e, attrs: { ...e.attrs, ...cmd.attrs } } : e
      );
      return { history: push(h, { elements }) };
    }
    case "delete": {
      if (!cmd.id) return { history: h };
      const elements = h.present.elements.filter((e) => e.id !== cmd.id);
      if (elements.length === h.present.elements.length) return { history: h };
      return { history: push(h, { elements }) };
    }
    case "undo": {
      if (h.past.length === 0) return { history: h };
      const past = h.past.slice(0, -1);
      return { history: { past, present: h.past[h.past.length - 1] } };
    }
    case "clear": {
      if (h.present.elements.length === 0) return { history: h };
      return { history: push(h, { elements: [] }) };
    }
    case "clarify":
      return { history: h, clarify: cmd.message ?? "没太听懂,换个说法试试?" };
    default:
      return { history: h };
  }
}

function push(h: DrawingHistory, next: CanvasState): DrawingHistory {
  const past = [...h.past, h.present];
  if (past.length > MAX_SNAPSHOTS) past.shift();
  return { past, present: next };
}