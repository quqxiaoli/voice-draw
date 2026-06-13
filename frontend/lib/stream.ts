// frontend/lib/stream.ts
// SSE 流式客户端:POST /api/draw, fetch + ReadableStream 手动解析 SSE,
// 支持中断(AbortController)。与后端 handler/draw.go 三事件对齐。
import type { DrawCommand, ApiError } from "./types";

// 后端地址运行时按当前页面 host 拼接,决策见 docs/decisions.md D14。
// 不用 NEXT_PUBLIC_API_BASE:Next 16 Turbopack 对本项目静态注入不稳(实测烘不进产物),
// 且 build-time 注入会把后端 IP 绑死在镜像里,换部署 IP 必须重新构建。
// 运行时拼接 → 镜像与部署 IP 解耦,localhost / 公网裸 IP / 反代域名 三种部署形态零改动。
function getApiBase(): string {
  if (typeof window !== "undefined") {
    return `${window.location.protocol}//${window.location.hostname}:8080`;
  }
  // SSR 兜底:本模块仅 client 端真实使用,此分支为类型/构建期占位
  return "http://localhost:8080";
}

export interface StreamCallbacks {
  onCommand: (cmd: DrawCommand) => void;
  onDone: (summary: string) => void;
  onError: (error: { code: string; message: string }) => void;
}

export interface StreamHandle {
  abort: () => void;
}

/** 提交绘图指令,流式返回命令序列。返回中断句柄。 */
export function streamDraw(
  sessionId: string,
  instruction: string,
  cb: StreamCallbacks,
): StreamHandle {
  const controller = new AbortController();
  // 1a:abort 后任何已在途的 cb.* 都静默,防止旧流晚到的事件污染新一轮状态
  let aborted = false;
  controller.signal.addEventListener("abort", () => {
    aborted = true;
  });

  void (async () => {
    try {
      const resp = await fetch(`${getApiBase()}/api/draw`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId, instruction }),
        signal: controller.signal,
      });

      // 非 200 → 普通 HTTP 错误(流开始前),按 ApiError 解析 body
      if (!resp.ok) {
        let message = `请求失败 (${resp.status})`;
        let code = "UNKNOWN";
        try {
          const body: ApiError = await resp.json();
          message = body.message ?? message;
          code = body.error ?? code;
        } catch { /* body 非 JSON,用默认 message */ }
        if (!aborted) cb.onError({ code, message });
        return;
      }

      if (!resp.body) {
        if (!aborted) cb.onError({ code: "NO_BODY", message: "服务返回为空" });
        return;
      }

      // 解析 SSE 流
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let currentEvent = "";
      let currentData = "";

      const flushEvent = () => {
        const data = currentData.trim();
        if (!data) return;
        // 1a:abort 后即使已 buffer 的事件被同步 flush,也不再回调上层
        if (aborted) {
          currentEvent = "";
          currentData = "";
          return;
        }

        switch (currentEvent) {
          case "token": {
            try {
              const cmd: DrawCommand = JSON.parse(data);
              cb.onCommand(cmd);
            } catch {
              console.warn("[stream] skip unparseable token:", data.slice(0, 80));
            }
            break;
          }
          case "done": {
            let summary = "";
            try {
              const parsed = JSON.parse(data);
              summary = parsed.summary ?? "";
            } catch { /* done 的 data 可能为 {} */ }
            cb.onDone(summary);
            break;
          }
          case "error": {
            try {
              const parsed = JSON.parse(data);
              cb.onError({
                code: parsed.error ?? "STREAM_ERROR",
                message: parsed.message ?? "流式生成中断",
              });
            } catch {
              cb.onError({ code: "STREAM_ERROR", message: "流式生成中断" });
            }
            break;
          }
          // 未知 event 忽略
        }

        currentEvent = "";
        currentData = "";
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // 按行解析
        const lines = buffer.split("\n");
        // 最后一行可能不完整,保留回 buffer
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (line.startsWith("event: ")) {
            currentEvent = line.slice(7).trim();
          } else if (line.startsWith("data: ")) {
            // 支持多行 data(本项目单行,但标准 SSE 允许多行)
            currentData += line.slice(6);
          } else if (line === "") {
            // 空行 = 事件边界
            flushEvent();
          }
          // 注释行(:开头)忽略
        }
      }

      // TODO(stream): 流末未做 decoder.decode() 无参 flush;buffer 残留行(无终止 \n\n 的事件)亦未处理。当前后端不会这样输出,留待后续硬化。
      // 流结束,处理可能残留的事件
      flushEvent();
    } catch (err: unknown) {
      // 1c:abort 路径下,不同 runtime 可能抛 AbortError / TypeError("network error") / 其他,统一兜底
      if (controller.signal.aborted) return;
      if (err instanceof DOMException && err.name === "AbortError") {
        return; // 用户主动中断,不触发 error
      }
      if (!aborted) {
        cb.onError({
          code: "NETWORK",
          message: err instanceof Error ? err.message : "网络连接失败",
        });
      }
    }
  })();

  return {
    abort: () => controller.abort(),
  };
}
