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
  attrs?: Record<string, string | number>;
  message?: string;
}

// 对齐 constitution ErrorResponse
export interface ApiError {
  error: string;
  message: string;
  details?: unknown;
}