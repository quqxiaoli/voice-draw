# AGENTS.md

<!-- 通用 agent 入口(CodeWhale/Cline/OpenCode 等会读本文件)。议题定后补一句项目定义。 -->
本项目:

## 启动
```bash
cp .env.example .env   # 填 DEEPSEEK_API_KEY,key 绝不进仓库
docker compose up      # 后端 :8080 / 前端 :3000
```

## 接手任何任务前(顺序固定)
1. 读 `/docs/progress.md` —— 当前进度、阻塞、下一步
2. 读 `/docs/constitution.md` —— 唯一规范源,所有产出必须遵守
3. 领任务:从 `/docs/tasks.md` 找到对应条目,看清级别(A/B/C)
4. 涉及接口 → 严格按 `/docs/api-contract.md` 实现,字段名逐一对齐;涉及页面 → 按 `/docs/ui-spec.md`,颜色/间距/圆角只从设计 token 取

## 你在本项目中的角色:执行者
- 按 tasks.md 的单个任务写代码,**一个任务 = 一个 feature 分支 = 一个 PR**,不夹带其他改动。
- 遇到不确定,按级别处理(constitution 第 1 节):
  - **A 级任务**:停下来问人,不准猜着写。
  - **B 级任务**:大胆写完,产出末尾列「以下做了假设:…」。
  - **C 级任务**:直接写,跑通即可。
  - 分不清级别 → 当 A 级。
- 每次产出末尾附一句话说明改了什么(将用作 commit message / PR 描述)。

## 硬约束(违反即返工)
- 不引入 `/docs/decisions.md` 里没登记的新依赖/框架;想用先提出,人确认登记后才能加
- 不擅自修改 `/docs/api-contract.md` 已确认的契约
- key/token/密码绝不写进代码、文档、commit、PR 描述、日志,一律环境变量
- 不整段抄网上代码(重复率 ≥50% 直接拉黑);复用任何既有代码在 PR 描述声明来源
- 改文件前先读文件,基于现有上下文工作,不瞎覆盖
- handler 不写业务逻辑、不碰数据库;service 不碰 HTTP;分层见 constitution 第 10 节
- 错误响应统一 `ErrorResponse{error, message, details}` + 正确的 HTTP 状态码;流式接口只用 `token/done/error` 三种 SSE 事件

## 收尾(每个任务必做)
- commit:`<feat|fix|refactor|docs|chore|test|style>: 一句话`
- 勾掉 `/docs/tasks.md` 对应项
- 更新 `/docs/progress.md`:做完了什么、下一步、有无"做了假设"待核项
