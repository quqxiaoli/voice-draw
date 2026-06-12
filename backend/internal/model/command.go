// backend/internal/model/command.go
// DrawCommand:全项目核心 DSL,前后端契约的真相源。
// 前端 TS 类型(frontend/lib/types.ts)逐字段对齐本文件。
package model

import "fmt"

// 操作类型
const (
	OpDraw    = "draw"    // 新增图形元素
	OpModify  = "modify"  // 修改已有元素属性(改色/改大小/移动)
	OpDelete  = "delete"  // 删除指定元素
	OpUndo    = "undo"    // 撤销上一步(前端快照栈执行)
	OpClear   = "clear"   // 清空画布
	OpClarify = "clarify" // 无法解析时的提示(不改画布)
)

// 图形原语(D12 混合策略:几何用基础原语,有机形体用 path)
const (
	ShapeCircle   = "circle"
	ShapeRect     = "rect"
	ShapeEllipse  = "ellipse"
	ShapeLine     = "line"
	ShapePolyline = "polyline"
	ShapePolygon  = "polygon"
	ShapePath     = "path"
	ShapeText     = "text"
)

var validOps = map[string]bool{
	OpDraw: true, OpModify: true, OpDelete: true,
	OpUndo: true, OpClear: true, OpClarify: true,
}

var validShapes = map[string]bool{
	ShapeCircle: true, ShapeRect: true, ShapeEllipse: true, ShapeLine: true,
	ShapePolyline: true, ShapePolygon: true, ShapePath: true, ShapeText: true,
}

// DrawCommand SSE token 事件的 data 内容(D9:每事件一条完整命令)。
// Attrs 为 SVG 属性透传(cx/cy/r/x/y/width/height/d/points/fill/stroke/transform...),
// 后端不枚举校验属性名,表达力留给 LLM,前端渲染时透传给 SVG 元素。
type DrawCommand struct {
	Op      string         `json:"op"`
	ID      string         `json:"id,omitempty"`      // draw 时由 LLM 赋语义化 id;modify/delete 时引用
	Shape   string         `json:"shape,omitempty"`   // 仅 op=draw 需要
	Attrs   map[string]any `json:"attrs,omitempty"`   // 仅 draw/modify 需要
	Message string         `json:"message,omitempty"` // 仅 op=clarify 需要
}

// Validate 结构校验:解析器对 LLM 每行输出调用,不合法即丢弃该行。
func (c *DrawCommand) Validate() error {
	if !validOps[c.Op] {
		return fmt.Errorf("unknown op: %q", c.Op)
	}
	switch c.Op {
	case OpDraw:
		if !validShapes[c.Shape] {
			return fmt.Errorf("draw: unknown shape %q", c.Shape)
		}
		if c.ID == "" {
			return fmt.Errorf("draw: missing id")
		}
		if len(c.Attrs) == 0 {
			return fmt.Errorf("draw: empty attrs")
		}
	case OpModify:
		if c.ID == "" || len(c.Attrs) == 0 {
			return fmt.Errorf("modify: requires id and attrs")
		}
	case OpDelete:
		if c.ID == "" {
			return fmt.Errorf("delete: requires id")
		}
	case OpClarify:
		if c.Message == "" {
			return fmt.Errorf("clarify: requires message")
		}
	}
	return nil
}
