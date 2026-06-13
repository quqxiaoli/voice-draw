// backend/cmd/main.go
// 接线层。TODO(DS): 与脚手架既有 main/中间件(全局错误、Recovery、日志)合并,以脚手架为底。
package main

import (
	"log"
	"net/http"
	"os"

	"github.com/gin-gonic/gin"

	"github.com/joho/godotenv"
	"github.com/quqxiaoli/voice-draw/backend/internal/handler"
	"github.com/quqxiaoli/voice-draw/backend/internal/middleware"
	"github.com/quqxiaoli/voice-draw/backend/internal/repository/session"
	"github.com/quqxiaoli/voice-draw/backend/internal/service/draw"
	"github.com/quqxiaoli/voice-draw/backend/internal/service/llm"
)

func main() {
	_ = godotenv.Load("../.env", ".env")
	cfg, err := llm.FromEnv()
	if err != nil {
		log.Fatalf("启动失败: %v", err) // 缺 key 启动即死,constitution §2
	}

	store := session.NewMemoryStore()
	svc := draw.NewService(llm.NewClient(cfg), store)
	drawHandler := handler.NewDrawHandler(svc)

	r := gin.New()
	r.Use(gin.Logger(), middleware.CustomRecovery()) // panic 走统一 ErrorResponse,堆栈只进日志

	// 前端直连后端(decisions:流式页面直连),跨域必须放行,否则联调必炸
	// TODO(DS, B级): 收敛为白名单中间件(env FRONTEND_ORIGIN),现为最小可用版
	r.Use(func(c *gin.Context) {
		origin := os.Getenv("FRONTEND_ORIGIN")
		if origin == "" {
			origin = "*"
		}
		c.Header("Access-Control-Allow-Origin", origin)
		c.Header("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
		c.Header("Access-Control-Allow-Headers", "Content-Type")
		if c.Request.Method == http.MethodOptions {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}
		c.Next()
	})

	r.GET("/api/health", func(c *gin.Context) { c.JSON(200, gin.H{"status": "ok"}) })
	r.POST("/api/draw", drawHandler.Stream)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	log.Printf("listening on :%s", port)
	if err := r.Run(":" + port); err != nil {
		log.Fatalf("server: %v", err)
	}
}
