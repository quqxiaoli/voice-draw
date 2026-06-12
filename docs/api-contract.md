# API Contract · 接口契约

> 前后端共同依据。改契约必须先在对话里说、人确认后才改,并同步更新本文件。
> 状态:**已冻结**(2026-06-12)。备胎接口 /api/transcribe 仅保留路径,启用需走契约变更流程。

## 通用约定
- Base URL:`http://<host>:8080`
- 认证方式:无(单用户工具,无多租户需求)
- 所有错误响应遵循 constitution 的 `ErrorResponse{error, message, details}`
- 时间格式:RFC3339(本项目实际无时间字段,保留约定)
- `session_id`:**前端生成 UUID v4**,首次请求时后端惰性创建会话上下文;无独立建会话接口

## 流式约定(SSE,全项目统一)

- Content-Type: `text/event-stream`,事件类型只有三种:

| event | data 结构 | 含义 |
|---|---|---|
| `token` | `<DrawCommand>` | **一条完整绘图命令**(本项目修订,见 decisions.md D9:data 即 DrawCommand 扁平结构,无 `content` 包装) |
| `done` | `{"summary": "已画出:一个雪人(3个圆…)"}` | 正常结束;summary 供命令历史侧栏显示,可为空串 |
| `error` | `{"error": "CODE", "message": "用户可读信息"}` | 流中出错,前端展示错误态,已执行命令保留 |

- 流**开始前**出错 → 普通 HTTP 4xx/5xx + ErrorResponse(非 SSE)。
- 流**中途**出错 → 发 `error` 事件后服务端关闭连接;**前端已收到并执行的命令不回滚**。
- 前端 EventSource onerror 兜底网络断开(与业务 error 事件区分)。
- 后端解析 LLM 流式输出,**攒齐一条完整命令即发一个 token 事件**,不透传原始 token。

## 接口列表

### 1. 绘图指令
- **Method + Path**: `POST /api/draw`
- **用途**:提交一条语音转写后的文字指令,流式返回绘图命令序列
- **请求体**:
```json
{
  "session_id": "550e8400-e29b-41d4-a716-446655440000",
  "instruction": "画一个雪人"
}
```
  - `session_id`: string,必填,UUID 格式
  - `instruction`: string,必填,1–500 字符,前后端各自校验
- **成功响应**(HTTP 200):SSE 流,按上面三事件约定。token 事件序列示例:
```
event: token
data: {"op":"draw","id":"s1","shape":"circle","attrs":{"cx":200,"cy":300,"r":60,"stroke":"#333","fill":"none"}}

event: token
data: {"op":"draw","id":"s2","shape":"circle","attrs":{"cx":200,"cy":200,"r":45,"stroke":"#333","fill":"none"}}

event: done
data: {"summary":"已画出:雪人(身体、头部…)"}
```
- **错误情况**:
  - `400 INVALID_INPUT`:instruction 为空/超 500 字符/session_id 非 UUID
  - `502 LLM_UNAVAILABLE`:上游 LLM 连接失败(流开始前)
  - `504 LLM_TIMEOUT`:上游 LLM 超时(流开始前;流中超时走 error 事件,code 同名)
  - 流中 LLM 输出无法解析为合法命令:跳过该条继续;**全部**不可解析 → error 事件 `PARSE_FAILED`
- **是否流式**:是

### 2. 健康检查
- **Method + Path**: `GET /healthz`
- **用途**:部署存活探测 + smoke.sh 首项
- **成功响应**(HTTP 200):
```json
{"status": "ok"}
```
- **错误情况**:无(进程活着就 200)
- **是否流式**:否

### 3. 语音转写(备胎位,默认不实现)
- **Method + Path**: `POST /api/transcribe`
- **用途**:仅当开赛实测 Web Speech 不可用时启用;multipart 上传音频,返回文字
- **状态**:**保留路径,不实现、不写码**。启用需走契约变更流程补全字段定义
- **是否流式**:否

## 前后端共享类型

### DrawCommand(DSL 核心,前端 TS / 后端 Go struct 逐字段对齐)

> 真相源:`backend/internal/model/command.go`;前端 `frontend/lib/types.ts` 镜像。改任一边必须同步另一边。

```typescript
type Op =
  | "draw" | "modify" | "delete"
  | "undo" | "clear" | "clarify";

type Shape =
  | "circle" | "rect" | "ellipse" | "line"
  | "polyline" | "polygon" | "path" | "text";

// 顶层扁平,SSE token 事件 data 即此结构(无包装)
interface DrawCommand {
  op: Op;
  id?: string;       // draw 时 LLM 赋语义化 id(如 "sun"/"tree-trunk");modify/delete 引用同一 id
  shape?: Shape;     // 仅 op=draw 需要
  attrs?: Record<string, string | number>; // SVG 属性透传,后端不枚举校验属性名
  message?: string;  // 仅 op=clarify 需要
}
```

**按 op 的必填组合**(后端 `Validate()` 强制,不合法不下发):

| op | 必填字段 |
|---|---|
| `draw`    | `id` + `shape` + 非空 `attrs` |
| `modify`  | `id` + 非空 `attrs` |
| `delete`  | `id` |
| `undo`    | 无 |
| `clear`   | 无 |
| `clarify` | `message` |

**attrs 透传约定**(LLM 产出参考,渲染端直接挂到 SVG 元素;新增属性零契约改动):

- 画布 viewBox:`0 0 1000 750`
- 几何(按 shape 取子集):
  - `circle`: `cx`, `cy`, `r`
  - `rect`: `x`, `y`, `width`, `height`
  - `ellipse`: `cx`, `cy`, `rx`, `ry`
  - `line`: `x1`, `y1`, `x2`, `y2`
  - `polyline` / `polygon`: `points`("x1,y1 x2,y2 …")
  - `path`: `d`
  - `text`: `x`, `y`(锚点);文本内容放 `attrs.text`
- 样式(任意 shape 通用,SVG 原生 kebab-case):`stroke`, `fill`, `stroke-width`, `font-size`, `transform`, `opacity` …

**约束**:
- 出现未知 `op` 或缺必填字段 → 前端丢弃该条并 `console.warn`,不崩
- `undo` 语义:弹出快照栈顶恢复上一态(对应一条 draw/modify/delete/clear);栈空时为 no-op
- 后端发出前 struct 校验(见 `backend/internal/model/command.go::Validate`),不合法不下发——**前端的丢弃逻辑是双保险,不是主防线**
