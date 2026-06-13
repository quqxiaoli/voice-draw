// backend/internal/handler/draw.go
// SSE 接口:POST /api/draw。只做 解析请求→调 service→写响应。
// 契约:流开始(首事件)前出错 → 普通 HTTP 错误;流中出错 → error 事件后关流。
package handler

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/quqxiaoli/voice-draw/backend/internal/model" // TODO(DS): 对齐 go.mod 实际 module 名
	"github.com/quqxiaoli/voice-draw/backend/internal/service/draw"
)

type DrawHandler struct {
	svc *draw.Service
}

func NewDrawHandler(s *draw.Service) *DrawHandler { return &DrawHandler{svc: s} }

type drawRequest struct {
	SessionID   string `json:"session_id" binding:"required,max=64"`
	Instruction string `json:"instruction" binding:"required,max=500"`
}

// ErrorResponse 对齐 constitution §10。
// TODO(DS): 若脚手架已有同名结构/全局错误中间件,合并为一处定义,删掉这里。
type ErrorResponse struct {
	Error   string `json:"error"`
	Message string `json:"message"`
	Details any    `json:"details,omitempty"`
}

func (h *DrawHandler) Stream(c *gin.Context) {
	var req drawRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Error: "INVALID_INPUT", Message: "请输入一条绘图指令(不超过 500 字)",
		})
		return
	}

	ctx := c.Request.Context()
	cmds, errs := h.svc.StreamDraw(ctx, req.SessionID, req.Instruction)

	// —— 等待首事件再定响应形态(契约:流开始前出错走 HTTP 错误)——
	var first model.DrawCommand
	var ok bool
	select {
	case first, ok = <-cmds:
		if !ok { // cmds 关闭无命令:正常路径 errs 必有值;ctx 取消竞态下可能无值,双路守避免 goroutine 永久阻塞
			select {
			case err := <-errs:
				log.Printf("[handler] pre-stream llm error: %v", err)
				c.JSON(http.StatusBadGateway, ErrorResponse{
					Error: "UPSTREAM_ERROR", Message: "AI 服务暂时不可用,请稍后重试",
				})
			case <-ctx.Done():
			}
			return
		}
	case err := <-errs:
		log.Printf("[handler] pre-stream llm error: %v", err)
		c.JSON(http.StatusBadGateway, ErrorResponse{
			Error: "UPSTREAM_ERROR", Message: "AI 服务暂时不可用,请稍后重试",
		})
		return
	case <-ctx.Done():
		return
	}

	// —— 进入 SSE ——
	w := c.Writer
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Accel-Buffering", "no") // 反代关缓冲(部署模板已配,双保险)
	flusher, canFlush := w.(http.Flusher)
	if !canFlush {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error: "STREAM_UNSUPPORTED", Message: "服务暂不可用",
		})
		return
	}

	writeEvent := func(event string, data any) {
		b, err := json.Marshal(data)
		if err != nil {
			log.Printf("[handler] marshal event failed: %v", err)
			return
		}
		fmt.Fprintf(w, "event: %s\ndata: %s\n\n", event, b)
		flusher.Flush() // 每事件即时 flush(constitution SSE 约定)
	}

	writeEvent("token", first)
	for cmd := range cmds {
		writeEvent("token", cmd)
	}

	select {
	case err := <-errs: // 流中出错 → error 事件后关流
		log.Printf("[handler] mid-stream llm error: %v", err)
		writeEvent("error", ErrorResponse{
			Error: "UPSTREAM_ERROR", Message: "生成中断,请重试这条指令",
		})
	default:
		writeEvent("done", struct{}{})
	}
}
