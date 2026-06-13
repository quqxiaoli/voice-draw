# Progress · 进度快照

> **任何 AI 接手任务,第一件事读这里**(constitution 同步机制核心)。
> 每次交接 / 完成一块 / 切换工具前,更新本文件。保持简短,只写"现在到哪了"。

## 本地如何跑起来(常驻,变了就更新)
```bash
cp env.example .env    # 填入 DEEPSEEK_API_KEY,key 绝不进仓库
docker compose up      # 后端 :8080 / 前端 :3000
```
单独起服务(联调常用):
- 后端: cd backend && go run ./cmd(main 已集成 godotenv,本地自动读 .env)
- 前端: cd frontend && npm run dev
- 后端冒烟: curl localhost:8080/api/health → {"status":"ok"}

## 当前状态
- **阶段**:阶段 4 · 收口期(核心闭环已通,公网部署已上线,剩 demo 录制 + README 终稿)
- **最后更新**:2026-06-13
- **更新人/工具**:Claude(T+ 部署修复回扫)
- **公网地址**:http://115.159.64.53:3000

## 正在做
- 无;等待人手推进 demo 录制 + README 终稿

## 已完成里程碑(按 PR 时序)
- **PR#1** 模板导入(/docs 全套 + 脚手架 + compose + env.example)
- **PR#2** 后端编译链:DSL(model/command.go)+ 系统 prompt + LLM 流式 client(OpenAI 兼容)+ NDJSON 增量解析器
- **PR#3** /api/draw SSE 接口:SessionStore 内存版(最近 20 条)+ draw service 编排 + handler 三事件 + main 接线 + CORS 最小版 + godotenv
- **PR#4** 前端绘图引擎:types.ts(契约)/ stream.ts(fetch 手解 SSE,带中断)/ executor.ts(快照栈 undo)/ Canvas.tsx(描边动画)
- **PR#5** docs:回填 D12 假设化决策、更新骨架三 PR 进度快照
- **PR#6** v0 静态壳落库:globals.css 替换为 ui-spec 设计 token;page.tsx 四态 + mock 描边演示;InputBar / CommandHistory / layout
- **PR#7** 接通主链路:useDrawing hook(streamDraw → applyCommand → animateIds 命令队列定节拍)+ useSpeech(Web Speech 累积式 + 静默去抖)+ 文本/语音同链路 + 停止按钮 + session_id 入 sessionStorage;附 review 修正:流式中断竞态、animateIds 生命周期、Canvas onAnimationDone 回调、SVG 属性 kebab→camel、终止路径状态收尾
- **PR#8** 打磨批次 1:clarify 一句话约束、画布与历史固定高度独立滚动、收紧 clear 触发语义
- **PR#9** 打磨批次 2:语音重写为"累积 + 静默去抖" + 麦克风开关式提交、提示条 overlay 化消除布局跳变、提交竞态收口(单一入口 + pageStateRef 守卫)
- **PR#10** SSE 链路硬化:首事件阻塞泄漏修复、base_url 智能拼接、流空闲超时;**D13** 会话上下文按"实际 emit"追加(部分成功不丢上下文)
- **PR#11** 打磨批次 3:提示条 3s 自动淡出 + 手动 × 关闭、识别态布局稳定、token 对齐
- **PR#12** P5 修复:CustomRecovery 统一 panic 响应;SessionStore TTL(2h)+ 惰性 sweep(5min throttle)
- **PR#13** prompt 配色指引偏低饱和柔和;空态与绘制态画布尺寸一致
- **PR#14** P2 清理:`DrawCommand.attrs` 前端类型对齐后端 `map[string]any` → `Record<string, unknown>`;processQueue 非 draw 间隙修复(间隙期入队等待);前端 500 字本地校验(避免后端 400);删除 5 处过期 module 名 TODO
- **PR#15** 画布 SVG 铺满容器(preserveAspectRatio: slice),消除背景空白边
- **PR#16** 部署补全(T+):补 backend/frontend Dockerfile(原计划 distroless,改 alpine 避国内 gcr.io 不可达;GOPROXY=goproxy.cn / npm registry=npmmirror);docker-compose.yml 移除 frontend NEXT_PUBLIC_API_BASE(改运行时拼接,见 PR#17);env.example 解开 LLM_API_KEY/BASE_URL/MODEL 必填项 + 删除无用 DEEPSEEK_API_KEY 行

## review 修复状态
- 全量 review(`docs/reviews/review-t23-full.md` 历史快照)P0/P1/P2/P5 全部修复并 merge
- 主链路 SSE 三事件、命令队列节拍、四态切换、提示条、TTL 惰性清理全部对齐契约

## 下一步(严格按序,阶段 4 收口)
1. [x] 公网部署(`docker compose up` 一条命令拉起 → http://115.159.64.53:3000)
2. [手] 主链路回归实跑:键盘 + 语音各跑一遍"画一个房子→把它改成蓝色→撤销" + 雪人 demo
3. [手] demo 视频:**T+66h 前开录**,演示词参 tasks.md 阶段 4 "主链路演示词"
4. [手] 官方设计文档定稿:指令集 V1 计划 vs 最终实现 + 砍掉清单原因 + 成本控制章节 + 编译器架构叙事
5. [手] README:公网链接 + demo 视频链接顶部;`docker compose up` 复现说明;声明桌面 Chrome 环境
6. [手] git 历史复核(无密钥/无 .env/commit 分布连续)+ 仓库公开终查
7. [手] LLM API 余额保持存活至评审结果公布

## 当前阻塞 / 待人确认
- 无阻塞

## Claude 弹药余量
- 已用:架构+契约 ≈1.5,骨架首发 ≈1.5,review/修复批次(打磨 1-3 + SSE 硬化 + P5 + P2) ≈3,文档回扫 ≈0.5
- 剩余:应急储备 1–2 发,只接契约变更 / 架构冲突 / 联调爆雷
