# Tasks · 任务拆解

> 每个任务**对应一个 PR**(constitution PR 规范),feature 分支 → PR → merge,不直推 main。
> AI 写完一块就来这里勾掉,并更新 progress.md。
> 标级别(A/B/C)决定用谁写、是否要 Claude review(见 constitution 分级)。

## 图例
- 级别:**A**=核心(Claude review) / **B**=样板(自审+肉眼过) / **C**=边角
- 写码:DS=DeepSeek / 手=自己 / Claude骨架=铁律9首发后DS接手
- 状态:☐ 未开始 / ◐ 进行中 / ☑ 完成

## 阶段 0:开赛第 1 小时(手动,不假手 AI)
- [x] [手] 读题,官方议题原文贴进 spec.md(已完成于赛前推演,核对原文一致)
- [x] [手] 建 **public** 仓库(开题后建,自始公开,比赛硬规则)
- [x] [手] 仓库设置开启 main 分支保护(require pull request),物理杜绝直推
- [x] [手] 官网【提交作品】入口提交仓库地址(T+24h 物理墙,建完立刻交)
- [x] [手] PR #1:导入赛前模板(/docs 全套 + Go 脚手架 + 前端脚手架 + 全局错误中间件 + docker-compose + .env.example)。**PR 描述声明:"复用自本人赛前准备的模板,原创"**
- [ ] [手] **go/no-go 实测 ①**:Web Speech API 走 localhost(python3 -m http.server),10 句指令(画一个红色的圆/在左上角画一个蓝色的矩形/画一棵树/画一个雪人/把它改成绿色/大一点/往右移/撤销/清空画布/写上"你好世界"),≥8 句语义可辨 → 锁定;否则启用备胎契约变更 — **D12 取消**,事后实测 OK,见 decisions D12 补记
- [ ] [手] **go/no-go 实测 ②**:七牛云开通 AI 推理拿 key,LLM 生成 5 个 SVG path(猫/树/房子/五角星/波浪线),≥3 个一眼可辨 → 指令集分支 A;否则分支 B — **D12 取消**,事后实测 5/5,见 decisions D12 补记
- [ ] [手] **go/no-go 实测 ③**:同一 curl 加 stream=true,验证七牛流式吐 chunk 稳定;不稳 → 主选切 DeepSeek(.env 两行) — **D12 取消**,直接锁 DeepSeek,事后流式稳定,见 decisions D12 补记
- [x] [手] 实测结果记 decisions.md 附录,然后睡觉,醒来最清醒时进阶段 1(D12 补记承接此条)

## 阶段 1:spec + 架构 + 契约(赛前推演已完成大部,开赛核对即可)
- [x] [手] spec.md / api-contract.md / decisions.md 按实测结果核对回填(分支 A/B 落定),粘进仓库,docs: PR
- [x] [A] 架构对抗 review:GM/DS 攻击,Claude 收敛,**最多 2 轮硬止损**(可选,赛前推演已收敛多轮,无新攻击点可跳过)
- [x] [B] ui-spec.md 页面部分填空(设计 token 已定稿,只填页面/流程:画布区/按住说话/回显区/历史侧栏/四态)

## 阶段 2:核心闭环

### 后端(backend/)
- [x] [A][Claude骨架→DS接手] LLM client:OpenAI 兼容流式调用,base_url/key 走 env,七牛/DS 可切
- [x] [A][Claude骨架→DS接手] DSL 定义 + 命令解析器:从 LLM 流式输出中切出完整命令、struct 校验(配表驱动测试)— parser 实现已落,**表驱动测试未写**(B 级杂务,未阻塞)
- [x] [A][Claude骨架→DS接手] POST /api/draw SSE handler:三事件、Flush、客户端断开停上游
- [x] [A][Claude骨架] prompt 工程:系统 prompt(DSL 说明 + few-shot 雪人示例)+ 会话上下文拼装
- [x] [B][DS] SessionStore 接口 + 内存实现(最近 N=20 条命令上下文)+ TTL 惰性清理(PR#12)
- [x] [B][DS] /api/health + 入参校验(validator)+ 接入预制全局错误中间件(CustomRecovery,PR#12)
- [ ] [B][DS] scripts/smoke.sh:healthz + draw(合法/非法入参)断言状态码 — **未落地**,联调阶段直接手工 curl 跑通,demo 录制前可补

### 前端(frontend/)
- [x] [B][v0生成→DS落地] 页面骨架:画布区 + 按住说话按钮 + 识别文字回显区 + 命令历史侧栏(四态:空/录音中/绘制中/错误)
- [x] [A][DS+人验收] ASR 模块:Web Speech 封装(累积式 + 静默去抖,PR#9),中间结果回显,错误态(非 Chrome/拒权提示)
- [x] [A][Claude骨架→DS接手] SSE 消费 + 命令执行器:fetch + ReadableStream 手解 → 入命令队列 → 增量渲染 SVG
- [x] [A][DS] 描边动画:add 命令 stroke-dasharray 600ms(克制单一动效,实测 300–500 偏短);modify/delete 即时生效
- [x] [B][DS] undo/clear/clarify 三个 op 的前端语义 + 导出 PNG/SVG 按钮 — undo/clear/clarify 全部已实;**导出按钮未做**(D7 已澄清"成果带走"由命令历史侧栏覆盖,demo 不演,可砍)
- [x] [B][DS] 输入校验(1–500 字符,前端本地校验,PR#14)+ 空态引导文案

## 打磨池(随时入,排队出)
<!-- 铁律:任何新想法/皱眉点/亮点灵感,先来这里加一行(10秒),不准当场动手改。
     入池前先过闸:评委在 5 分钟演示里会经过这里吗?不会 → 改写进设计文档砍掉清单。
     攒到 3-5 条后按"用户可见的主题"归组成 PR,从池子领出去执行。
     亮点功能动到接口的 → 先走契约变更流程再实现。 -->
- [x] 打磨批次 1(PR#8):clarify 一句话约束、画布与历史固定高度独立滚动、收紧 clear 触发语义
- [x] 打磨批次 2(PR#9):语音累积式 + 提示条 overlay + 提交竞态收口
- [x] 打磨批次 3(PR#11):提示条自动淡出与关闭、识别态布局、token 对齐
- [x] SSE 链路硬化(PR#10):首事件阻塞泄漏、base_url 拼接、流空闲超时、D13 会话上下文按实际 emit
- [x] P5 修复(PR#12):CustomRecovery、TTL 惰性清理
- [x] 收尾打磨(PR#13/15):prompt 配色低饱和、空态/绘制态画布尺寸一致、SVG 铺满容器
- [x] P2 清理(PR#14):attrs 类型对齐、processQueue 节奏修复、500 字本地校验、过期 TODO 删除

## 阶段 3:联调 + 收口
- [x] [A] 前后端联调,跑通主链路(最易爆雷,弹药 1.5–2 在这)— PR#7 接通,后续 PR 持续硬化
- [x] [A] 边界情况测试:超长语音 / 静音 / 无法解析(clarify)/ 连续快速指令 / LLM 超时 — 命令队列、流空闲超时、500 字本地校验、clarify 兜底全部覆盖
- [x] [B] 细节打磨(审美质感,对照 ui-spec token 逐项查)— 打磨批次 1-3 + 收尾两 PR 已逐项查

## 阶段 4:部署 + demo + 设计文档(最后 ~12h 锁死,不管开发到哪都进收口)
- [x] [手] 部署公网(PR#17 部署补全 + 2e67b81 公网兼容修复;http://115.159.64.53:3000)
- [x] [手] **官方要求的设计文档**(`设计文档.md`):① 指令集 V1 全表(13 条)vs 实现(11✅/1◐/1✗)+ 未完成原因(导出砍掉、填充描边并入 modify、立项即砍清单、公网裸 IP 麦克风限制、smoke/parser test 工程遗留);② 成本控制四主线:ASR 零成本(Web Speech)、零数据库、LLM 上下文截断(N=20 + 2h TTL)、OpenAI 协议兼容(供应商两行切换);③ 架构章节(四段式编译器 + DSL 乘法叙事 + SessionStore 插座);④ 容错七层 + 真实例子
- [x] [手] README:公网链接 + demo 视频链接置顶;`docker compose up` 一条命令复现;依赖清单;产品思考段(目标用户、砍掉清单);声明桌面 Chrome 环境;**显式说明公网裸 IP 非安全上下文麦克风禁用,fallback 走文本输入框,完整语音演示见 demo 视频**
- [x] [手] demo 视频:已发 B 站 https://www.bilibili.com/video/BV1yNJc64EnV(录制于本机 localhost,安全上下文,语音 100% 可用)
- [ ] [手] **fix/public-ip-compat 分支开 PR 合 main**(commit 2e67b81 当前未合)
- [ ] [手] git 历史总复核:无密钥、无 .env、commit 分布连续
- [ ] [手] 确认仓库公开可访问、README 顶部链接全部点得开
- [ ] [手] 部署 + LLM API 余额保持存活至评审结果公布(评审在赛后 1–2 周)
