/**
 * 小鹤双拼键盘标注表 —— TypingKeyboard 显示用
 *
 * 🔴 键位事实唯一真源 = 基线 spec `md/spec/A1-双拼方案层设计规格.md` §2.1 / §2.2
 * （Rime 官方 double_pinyin_flypy.schema.yaml@01a1328 行级取证，置信度 A）。
 * 本文件按 A1 转写，不得凭记忆修改；修改前必须回到 A1 逐行核对。
 *
 * 已关闭的待核对项（2026-10-17 主理人拍板按 A1 最新结论执行）：
 * - C-1：`er` 编码为 `ER`（零声母第一键 E + 第二键 R），er 系列字纳入素材。
 * - C-2：`ün` 归 Y 键（j/q/x/y 后 ü 按书写规范写作 un，由 un→Y 统一处理）。
 *
 * 本文件同时被 `scripts/schemes/flypy.ts` 转出（构建脚本 --verify 用），
 * 与应用侧 `TypingKeyboard` 导入——**键位事实只有这一份**。
 */

/** key: 物理键（大写）；initials: 该键承载的声母；finals: 该键承载的韵母（双韵母按 A1 顺序） */
export const FLYPY_KEY_LABELS: Record<string, { initials: string[]; finals: string[] }> = {
  Q: { initials: [], finals: ['iu'] },
  W: { initials: [], finals: ['ei'] },
  E: { initials: [], finals: ['e'] },
  R: { initials: [], finals: ['uan', 'er'] },
  T: { initials: [], finals: ['ue', 'üe'] },
  Y: { initials: [], finals: ['un', 'ün'] },
  U: { initials: ['sh'], finals: ['u'] },
  I: { initials: ['ch'], finals: ['i'] },
  O: { initials: [], finals: ['uo', 'o'] },
  P: { initials: [], finals: ['ie'] },
  A: { initials: [], finals: ['a'] },
  S: { initials: [], finals: ['ong', 'iong'] },
  D: { initials: [], finals: ['ai'] },
  F: { initials: [], finals: ['en'] },
  G: { initials: [], finals: ['eng'] },
  H: { initials: [], finals: ['ang'] },
  J: { initials: [], finals: ['an'] },
  K: { initials: [], finals: ['ing', 'uai'] },
  L: { initials: [], finals: ['iang', 'uang'] },
  ';': { initials: [], finals: [] }, // 小鹤 alphabet 不含分号键（A1 §2.2 / L52）
  Z: { initials: [], finals: ['ou'] },
  X: { initials: [], finals: ['ia', 'ua'] },
  C: { initials: [], finals: ['ao'] },
  V: { initials: ['zh'], finals: ['ui', 'ü'] },
  B: { initials: [], finals: ['in'] },
  N: { initials: [], finals: ['iao'] },
  M: { initials: [], finals: ['ian'] },
}

/** 悬停 tooltip 用的完整映射文本，如「V 键：声母 zh / 韵母 ui、ü」 */
export function flypyKeyTooltip(key: string): string {
  const label = FLYPY_KEY_LABELS[key]
  if (!label) return `${key} 键`
  const parts: string[] = []
  if (label.initials.length > 0) parts.push(`声母 ${label.initials.join('、')}`)
  if (label.finals.length > 0) parts.push(`韵母 ${label.finals.join('、')}`)
  if (parts.length === 0) return `${key} 键`
  return `${key} 键：${parts.join(' / ')}`
}
