// 唯一 id 生成,优先 crypto.randomUUID,降级到 Math.random RFC4122 v4。
// 原因:crypto.randomUUID 仅在安全上下文(HTTPS / localhost)可用,
// 公网裸 IP 明文(http://1.2.3.4)下属性不存在,直接调用抛 TypeError 使整个
// React 树崩溃。本项目 session_id 与指令历史 id 不要求加密强度,降级 OK。
export function genId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
