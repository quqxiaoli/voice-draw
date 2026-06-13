// backend/internal/model/error.go
// 统一错误响应结构,constitution §10 单一来源。handler / middleware 共用。
package model

// ErrorResponse 失败响应的统一结构。Details 仅用于字段级校验等可选场景。
type ErrorResponse struct {
	Error   string `json:"error"`
	Message string `json:"message"`
	Details any    `json:"details,omitempty"`
}
