// backend/internal/middleware/recovery.go
// panic 兜底:返回 500 + 统一 ErrorResponse;完整堆栈只进日志,不外泄给客户端(constitution §10)。
package middleware

import (
	"log"
	"net/http"
	"runtime/debug"

	"github.com/gin-gonic/gin"

	"github.com/quqxiaoli/voice-draw/backend/internal/model"
)

// CustomRecovery 用于替换 gin.Default 里的默认 Recovery。
// 已开始写响应(如 SSE 流中途 panic)时不再尝试覆盖响应体,只记日志后中断。
func CustomRecovery() gin.HandlerFunc {
	return gin.CustomRecovery(func(c *gin.Context, recovered any) {
		log.Printf("[panic] %s %s recovered: %v\n%s",
			c.Request.Method, c.Request.URL.Path, recovered, debug.Stack())

		if c.Writer.Written() {
			c.Abort()
			return
		}
		c.AbortWithStatusJSON(http.StatusInternalServerError, model.ErrorResponse{
			Error:   "INTERNAL_ERROR",
			Message: "服务器开小差了,请稍后重试",
		})
	})
}
