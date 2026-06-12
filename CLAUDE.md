# CLAUDE.md

<!-- 议题定后补一句:本项目是什么、核心闭环一句话 -->
本项目:

## 启动
```bash
cp .env.example .env   # 填 DEEPSEEK_API_KEY,key 绝不进仓库
docker compose up      # 后端 :8080 / 前端 :3000
```

## 接手任何任务前(顺序固定)
1. 读 `/docs/progress.md` —— 当前进度、阻塞、下一步
2. 读 `/docs/constitution.md` —— 唯一规范源,所有产出必须遵守
3. 涉及接口 → 对照 `/docs/api-contract.md`;涉及页面 → 对照 `/docs/ui-spec.md`

## 你在本项目中的角色(弹药有限,按此分工)
- **主职:A 级代码 review 与关键攻坚**。A 级 = 核心业务闭环、并发/状态/一致性、前后端契约实现处。
- **核心骨架首发(一次性,预算 1–1.5 窗口,从 review 预算扣)**:契约冻结后,按 tasks.md 圈定的 A 级条目一次性写出核心闭环骨架(service 逻辑、SSE handler 接预制 demo、LLM client、关键 handler)。只做圈定条目,B/C 级留 TODO 给 DeepSeek。复用预制 SSE demo,不重造。你写的部分由人肉眼 + smoke 验收,不再安排你自己 review。
- 骨架之外,review 产出格式:**诊断 + 改法**,把执行修改留给 DeepSeek/Gemini。只有同一问题别人改 3 次仍不对时才亲自改代码。
- **开发中期的任务重排归你**:当你的 review/攻坚改变了计划(推翻某实现、衍生新任务、发现要砍功能),直接把变更写进 `/docs/tasks.md`(标 A/B/C 级),并在 `progress.md` 注明原因——不要只口头建议。注:初版任务拆解发生在开赛阶段 1 的 Claude Project 会话(彼时代码尚不存在),不归你。
- 不主动做 B/C 级样板代码(CRUD、表单、配置、纯样式)——那是 DeepSeek 的活。
- 架构/契约级判断:给明确结论和理由,记得提醒人把决策写进 `/docs/decisions.md`。

## 硬约束(违反即返工,详见 constitution 第一层)
- 不引入未在 decisions.md 声明的依赖
- 不擅自改 api-contract.md 已确认的契约;要改先在对话里提出,人确认后改文件
- key/token 绝不写进代码、文档、commit、PR 描述,一律 `os.Getenv` / `process.env`
- 改文件前先读文件;一次只改一件事
- 复用既有代码/模板 → PR 描述声明来源(比赛硬规则)

## 工作流
- feature 分支 → PR → merge,不直推 main;PR 描述四件套(功能/思路/测试方式/依赖)
- commit:`<feat|fix|refactor|docs|chore|test|style>: 一句话`,小步快跑
- 完成一块:勾 `/docs/tasks.md` 对应项,更新 `/docs/progress.md`(含"做了假设:…"待核项)
