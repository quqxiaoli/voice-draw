// backend/internal/repository/session/store.go
// D8:后端唯一状态。接口化是为保留 Redis/SQLite 插座,service 零改动。
package session

import (
	"sync"
	"time"

	"github.com/quqxiaoli/voice-draw/backend/internal/model"
)

const (
	maxRecent     = 20              // D8:最近 N=20 条命令
	sessionTTL    = 2 * time.Hour   // 超过这个时长未访问的 session 被惰性清理
	sweepInterval = 5 * time.Minute // 两次清理之间的最小间隔,避免每次调用都全表扫描
)

type Store interface {
	Recent(sessionID string) []model.DrawCommand
	Append(sessionID string, cmds []model.DrawCommand)
}

type sessionEntry struct {
	cmds       []model.DrawCommand
	lastAccess time.Time
}

type memoryStore struct {
	mu        sync.Mutex // Recent/Append 都要更新 lastAccess,统一写锁更简单
	data      map[string]*sessionEntry
	lastSweep time.Time
	now       func() time.Time // 注入便于测试,默认 time.Now
}

func NewMemoryStore() Store {
	return &memoryStore{
		data: make(map[string]*sessionEntry),
		now:  time.Now,
	}
}

// sweepLocked 必须在持有 mu 时调用。throttle 避免每次请求都 O(N) 扫描。
func (m *memoryStore) sweepLocked(now time.Time) {
	if !m.lastSweep.IsZero() && now.Sub(m.lastSweep) < sweepInterval {
		return
	}
	for sid, e := range m.data {
		if now.Sub(e.lastAccess) > sessionTTL {
			delete(m.data, sid)
		}
	}
	m.lastSweep = now
}

func (m *memoryStore) Recent(sessionID string) []model.DrawCommand {
	m.mu.Lock()
	defer m.mu.Unlock()
	now := m.now()
	m.sweepLocked(now)

	e, ok := m.data[sessionID]
	if !ok {
		return nil
	}
	e.lastAccess = now
	out := make([]model.DrawCommand, len(e.cmds))
	copy(out, e.cmds) // 返回副本,避免调用方与写入竞争
	return out
}

func (m *memoryStore) Append(sessionID string, cmds []model.DrawCommand) {
	if len(cmds) == 0 {
		return
	}
	m.mu.Lock()
	defer m.mu.Unlock()
	now := m.now()
	m.sweepLocked(now)

	e, ok := m.data[sessionID]
	if !ok {
		e = &sessionEntry{}
		m.data[sessionID] = e
	}
	merged := append(e.cmds, cmds...)
	if n := len(merged); n > maxRecent {
		merged = merged[n-maxRecent:]
	}
	e.cmds = merged
	e.lastAccess = now
}
