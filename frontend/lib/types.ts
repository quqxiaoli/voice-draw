// frontend/lib/types.ts
// 与 backend/internal/model/command.go 逐字段对齐,改任何一边必须同步另一边。
export type Op = "draw" | "modify" | "delete" | "undo" | "clear" | "clarify";

export type Shape =
  | "circle" | "rect" | "ellipse" | "line"
  | "polyline" | "polygon" | "path" | "text";

export interface DrawCommand {
  op: Op;
  id?: string;
  shape?: Shape;
  // 与后端 map[string]any 对齐:LLM 可能吐 bool/嵌套,用 unknown 不撒谎,渲染层按需收窄
  attrs?: Record<string, unknown>;
  message?: string;
}

// 对齐 constitution ErrorResponse
export interface ApiError {
  error: string;
  message: string;
  details?: unknown;
}