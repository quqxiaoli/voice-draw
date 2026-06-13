// backend/internal/service/parser/parser.go
// 增量 NDJSON 解析器:攒 LLM 文本增量,凑齐整行才产出 DrawCommand(D9 事件原子性)。
// 容错:剥 markdown 围栏、跳过空行与非法行,单行坏不影响整流。
package parser

import (
	"encoding/json"
	"log"
	"strings"

	"github.com/quqxiaoli/voice-draw/backend/internal/model"
)

type Parser struct {
	buf strings.Builder
}

func New() *Parser { return &Parser{} }

// Feed 喂入一段增量文本,返回本次新凑齐的完整命令(可能为空)。
func (p *Parser) Feed(delta string) []model.DrawCommand {
	p.buf.WriteString(delta)
	s := p.buf.String()

	var out []model.DrawCommand
	for {
		i := strings.IndexByte(s, '\n')
		if i < 0 {
			break
		}
		line := s[:i]
		s = s[i+1:]
		if cmd, ok := parseLine(line); ok {
			out = append(out, cmd)
		}
	}
	p.buf.Reset()
	p.buf.WriteString(s) // 留下未完成的半行
	return out
}

// Finish 流结束时调用,处理最后一行(LLM 末行常无换行符)。
func (p *Parser) Finish() []model.DrawCommand {
	line := p.buf.String()
	p.buf.Reset()
	if cmd, ok := parseLine(line); ok {
		return []model.DrawCommand{cmd}
	}
	return nil
}

func parseLine(line string) (model.DrawCommand, bool) {
	line = strings.TrimSpace(line)
	if line == "" || strings.HasPrefix(line, "```") {
		return model.DrawCommand{}, false
	}
	var cmd model.DrawCommand
	if err := json.Unmarshal([]byte(line), &cmd); err != nil {
		log.Printf("[parser] skip invalid line: %.120s err=%v", line, err)
		return model.DrawCommand{}, false
	}
	if err := cmd.Validate(); err != nil {
		log.Printf("[parser] skip invalid command: %v", err)
		return model.DrawCommand{}, false
	}
	return cmd, true
}
