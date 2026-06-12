# Progress · 进度快照

> **任何 AI 接手任务,第一件事读这里**(constitution 同步机制核心)。
> 每次交接 / 完成一块 / 切换工具前,更新本文件。保持简短,只写"现在到哪了"。

## 本地如何跑起来(常驻,变了就更新)
```bash
cp .env.example .env   # 填入 LLM_API_KEY(DeepSeek)
docker compose up      # 后端 :8080 / 前端 :3000
```
单独起服务(联调常用):
- 后端: cd backend && go run ./cmd(main 已集成 godotenv,本地自动读 .env)
- 前端: cd frontend && npm run dev
- 后端冒烟: curl localhost:8080/api/health → {"status":"ok"}

## 当前状态
- **阶段**:阶段 2 · 核心闭环(后端主链路已通,前端缺页面壳与接线)
- **最后更新**:06-12 下午(T+15h 左右)
- **更新人/工具**:本人 + 架构窗口

## 正在做
- v0 生成静态页面壳(布局:画布 70% + 历史侧栏 30% + 底部输入栏,日系简洁)

## 已完成(最近几项)
- 骨架三 PR 已 merge,main 可编译可运行:
  - PR-A 后端编译链:DrawCommand DSL(model/command.go)、系统 prompt、LLM 流式 client(OpenAI 兼容,env 切供应商)、NDJSON 增量解析器
  - PR-B /api/draw SSE 接口:SessionStore(内存,最近20条)、draw service 编排、SSE handler(token/done/error 三事件)、main 接线 + CORS 最小版 + godotenv
  - PR-C 前端绘图引擎:types.ts(契约类型)/ stream.ts(SSE 客户端,fetch 手解,带中断)/ executor.ts(命令执行器,快照栈 undo)/ Canvas.tsx(描边动画)
- 后端主链路 curl 实测通过:"画一个红色的圆" → token 事件流 + done
- 决策 D12(取消实测,假设化推进:DeepSeek 主选 / 混合指令策略 / 文本框降级通道)已记 decisions.md

## 下一步(严格按序)
1. [手] v0 出静态壳(3–5 轮预算,只迭代到布局对),Download 取 page.tsx + 自定义组件
2. [DS·B级] 静态壳落库 PR:v0 只取布局 JSX,硬编码值换 ui-spec token;画布区挂已有 Canvas.tsx + mock 命令演示描边动画;四态(空/流式/成功/错误)+ 切换按钮
3. [DS·A级] 接线 PR:useDrawing hook(streamDraw → applyCommand → animateIds)+ Web Speech hook(zh-CN, interimResults)+ 文本框同链路 + 流式中禁用/停止按钮;session_id 用 crypto.randomUUID() 存 sessionStorage —— merge 前过一次 Claude Code review(对照 api-contract 三事件)
4. 联调:"画一个房子→把它改成蓝色→撤销"三连,键盘 + 语音各一遍
5. DS 杂务队列(不阻塞主线,穿插做):parser 表驱动测试 / session TTL / CORS 白名单化 / smoke.sh

## 当前阻塞 / 待人确认
- 无阻塞。LLM 实际画图质量未验证(D12 已兜底:原语保底 + demo 选题权在手),接线跑通后第一时间用 猫/树/房子/五角星/波浪线 五连测,结果回填 decisions 附录
- DS 落库时注意:骨架代码中 TODO(DS) 共 5 处,见 main 分支 grep "TODO(DS)"

## Claude 弹药余量
- 已用:约 3 / 8–10 满窗口(架构+契约 ≈1.5,骨架首发+流程支持 ≈1.5)
- 应急储备(1发)是否还在:☑
- 预算提醒:核心 review 剩 1.5–2 发(接线 PR 用 0.5–1),联调攻坚预留 1.5–2 发,架构窗口此后只接:契约变更/架构冲突/联调爆雷