// backend/internal/repository/session/store.go
// D8:后端唯一状态。接口化是为保留 Redis/SQLite 插座,service 零改动。
package session

import (
	"sync"

	"github.com/quqxiaoli/voice-draw/backend/internal/model" // TODO(DS): 对齐 go.mod 实际 module 名
)

const maxRecent = 20 // D8:最近 N=20 条命令

type Store interface {
	Recent(sessionID string) []model.DrawCommand
	Append(sessionID string, cmds []model.DrawCommand)
}

type memoryStore struct {
	mu   sync.RWMutex
	data map[string][]model.DrawCommand
}

func NewMemoryStore() Store {
	return &memoryStore{data: make(map[string][]model.DrawCommand)}
}

func (m *memoryStore) Recent(sessionID string) []model.DrawCommand {
	m.mu.RLock()
	defer m.mu.RUnlock()
	src := m.data[sessionID]
	out := make([]model.DrawCommand, len(src))
	copy(out, src) // 返回副本,避免调用方与写入竞争
	return out
}

func (m *memoryStore) Append(sessionID string, cmds []model.DrawCommand) {
	if len(cmds) == 0 {
		return
	}
	m.mu.Lock()
	defer m.mu.Unlock()
	merged := append(m.data[sessionID], cmds...)
	if n := len(merged); n > maxRecent {
		merged = merged[n-maxRecent:]
	}
	m.data[sessionID] = merged
	// TODO(DS, B级): 会话 TTL 清理(time.AfterFunc 或惰性清理均可),防长期运行内存增长
}
