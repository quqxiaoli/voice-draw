// backend/internal/service/draw/service.go
// 编排层:会话上下文 → LLM 流式 → 解析 → 逐命令产出。不碰 HTTP(constitution 分层铁律)。
package draw

import (
	"context"
	"log"

	"github.com/quqxiaoli/voice-draw/backend/internal/model"
	"github.com/quqxiaoli/voice-draw/backend/internal/repository/session"
	"github.com/quqxiaoli/voice-draw/backend/internal/service/llm"
	"github.com/quqxiaoli/voice-draw/backend/internal/service/parser"
)

type Service struct {
	llm      *llm.Client
	sessions session.Store
}

func NewService(c *llm.Client, s session.Store) *Service {
	return &Service{llm: c, sessions: s}
}

// StreamDraw 返回命令通道与错误通道。
// 约定:错误发生 → errs(容量1)收到错误,cmds 随即关闭;正常结束只关闭 cmds。
// 调用方(handler)负责区分"首事件前出错"(转 HTTP 错误)与"流中出错"(转 SSE error 事件)。
func (s *Service) StreamDraw(ctx context.Context, sessionID, instruction string) (<-chan model.DrawCommand, <-chan error) {
	cmds := make(chan model.DrawCommand, 8)
	errs := make(chan error, 1)

	go func() {
		defer close(cmds)

		history := s.sessions.Recent(sessionID)
		tokens, llmErrs := s.llm.StreamChat(ctx, llm.BuildMessages(history, instruction))

		p := parser.New()
		var emitted []model.DrawCommand
		// D13:已 emit 给前端的命令照常入会话上下文,不以整流成功为条件
		// (流中错误 / 用户停止 / 正常结束 三路收口统一交给 defer)
		defer func() {
			if len(emitted) > 0 {
				s.sessions.Append(sessionID, emitted)
			}
		}()

		send := func(c model.DrawCommand) bool {
			select {
			case cmds <- c:
				emitted = append(emitted, c)
				return true
			case <-ctx.Done():
				return false
			}
		}

		for tok := range tokens {
			for _, c := range p.Feed(tok) {
				if !send(c) {
					return // 客户端断开,停止上游消费(constitution SSE 约定)
				}
			}
		}

		// tokens 已关闭:先查上游是否以错误收场
		select {
		case err := <-llmErrs:
			log.Printf("[draw] llm stream error: %v", err) // 细节只进日志
			errs <- err
			return
		default:
		}

		for _, c := range p.Finish() {
			if !send(c) {
				return
			}
		}

		// 一条有效命令都没产出 → 兜底 clarify(用户侧永远有反馈,不白屏)
		if len(emitted) == 0 {
			send(model.DrawCommand{
				Op:      model.OpClarify,
				Message: "没太听懂这条指令,试试「画一只猫」或「把它改成蓝色」?",
			})
		}
		// 注:上下文只追加命令流(含 undo/clear 原样记录),不做画布状态重放。
		// TODO(DS): 不要在这里加画布重建逻辑,指代消解交给 prompt 的 [最近命令] 语义。
	}()

	return cmds, errs
}
