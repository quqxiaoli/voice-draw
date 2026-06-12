// backend/internal/service/llm/client.go
// OpenAI 兼容流式客户端。零第三方依赖(net/http + bufio)。
// 供应商切换只动 .env(D5/D12):LLM_BASE_URL / LLM_API_KEY / LLM_MODEL。
package llm

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"
)

type Message struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type Config struct {
	BaseURL string
	APIKey  string
	Model   string
}

// FromEnv 缺 key 直接报错(constitution §2:启动期暴露,不准带病运行)。
func FromEnv() (Config, error) {
	cfg := Config{
		BaseURL: os.Getenv("LLM_BASE_URL"),
		APIKey:  os.Getenv("LLM_API_KEY"),
		Model:   os.Getenv("LLM_MODEL"),
	}
	if cfg.BaseURL == "" {
		cfg.BaseURL = "https://api.deepseek.com" // D12:主选 DeepSeek 官方
	}
	if cfg.Model == "" {
		cfg.Model = "deepseek-chat"
	}
	if cfg.APIKey == "" {
		return cfg, fmt.Errorf("LLM_API_KEY 未设置,请配置 .env(参照 .env.example)")
	}
	return cfg, nil
}

type Client struct {
	cfg  Config
	http *http.Client
}

func NewClient(cfg Config) *Client {
	return &Client{
		cfg: cfg,
		// 不设全局 Timeout(流式连接长);连接期超时由 ctx 与下方 header 超时控制
		http: &http.Client{Transport: &http.Transport{ResponseHeaderTimeout: 15 * time.Second}},
	}
}

type chatRequest struct {
	Model       string    `json:"model"`
	Messages    []Message `json:"messages"`
	Stream      bool      `json:"stream"`
	Temperature float64   `json:"temperature"`
}

type chatChunk struct {
	Choices []struct {
		Delta struct {
			Content string `json:"content"`
		} `json:"delta"`
	} `json:"choices"`
}

// StreamChat 返回增量文本通道与错误通道。
// 约定:出错时先发 errs(容量1),随后关闭 tokens;正常结束只关闭 tokens。
func (c *Client) StreamChat(ctx context.Context, messages []Message) (<-chan string, <-chan error) {
	tokens := make(chan string, 16)
	errs := make(chan error, 1)

	go func() {
		defer close(tokens)

		body, err := json.Marshal(chatRequest{
			Model: c.cfg.Model, Messages: messages, Stream: true, Temperature: 0.3,
		})
		if err != nil {
			errs <- fmt.Errorf("marshal request: %w", err)
			return
		}
		url := strings.TrimRight(c.cfg.BaseURL, "/") + "/v1/chat/completions"
		req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(body))
		if err != nil {
			errs <- fmt.Errorf("build request: %w", err)
			return
		}
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+c.cfg.APIKey)

		resp, err := c.http.Do(req)
		if err != nil {
			errs <- fmt.Errorf("llm request failed: %w", err)
			return
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusOK {
			b, _ := io.ReadAll(io.LimitReader(resp.Body, 2048))
			// 细节只进日志侧(由调用方记录),不外泄给客户端
			errs <- fmt.Errorf("llm status %d: %s", resp.StatusCode, string(b))
			return
		}

		scanner := bufio.NewScanner(resp.Body)
		scanner.Buffer(make([]byte, 0, 64*1024), 1024*1024)
		for scanner.Scan() {
			line := scanner.Text()
			if !strings.HasPrefix(line, "data:") {
				continue
			}
			data := strings.TrimSpace(strings.TrimPrefix(line, "data:"))
			if data == "" || data == "[DONE]" {
				continue
			}
			var chunk chatChunk
			if err := json.Unmarshal([]byte(data), &chunk); err != nil {
				continue // 单块解析失败跳过,不断流
			}
			if len(chunk.Choices) == 0 || chunk.Choices[0].Delta.Content == "" {
				continue
			}
			select {
			case tokens <- chunk.Choices[0].Delta.Content:
			case <-ctx.Done():
				return
			}
		}
		if err := scanner.Err(); err != nil && ctx.Err() == nil {
			errs <- fmt.Errorf("llm stream read: %w", err)
		}
	}()

	return tokens, errs
}
