/**
 * 小鹤双拼编码器（构建期使用，运行时零依赖）
 *
 * 🔴 键位事实唯一真源 = 基线 spec `md/spec/A1-双拼方案层设计规格.md` §2.1 / §2.2 / §3.1 / §3.4.1
 * （Rime 官方 double_pinyin_flypy.schema.yaml@01a1328 行级取证，置信度 A）。
 * 本文件按 A1 转写，不得凭记忆修改；修改前必须回到 A1 逐行核对。
 *
 * 已关闭的待核对项（2026-10-17 主理人拍板按 A1 最新结论执行）：
 * - C-1：`er` 编码为 `ER`（零声母第一键 E + 第二键 R），er 系列字纳入素材。
 * - C-2：`ün` 归 Y 键（j/q/x/y 后 ü 按书写规范写作 un，由 un→Y 统一处理）。
 *
 * 零声母规则（A1 §3.1 / §3.2）：
 * - 单字母韵母 a/o/e：零声母 + 同字母（啊=aa 哦=oo 额=ee）
 * - 双字母韵母 ai/ei/ao/ou/an/en：α 口径保留全拼（主），β 口径（首字母+韵母键）为 acceptedCodes
 * - 三字母韵母 ang/eng：首字母 + 韵母键（昂=ah 鞥=eg）
 * - er：原样穿透 → ER
 *
 * ü 规则（A1 §3.3）：
 * - j/q/x/y + u（实际为 ü）：编码键为 V，官方 derive 同时接受原式 JU/QU/XU/YU → 作为 acceptedCodes
 * - n/l + ü：只接受 NV/LV，**拒绝** NU/LU（C-5 强制约束，避免「努/女」重码）
 */

/** 声母 → 键（A1 §2.1）。zh/ch/sh 为 V/I/U，其余同名字母键 */
const INITIAL_KEY: Record<string, string> = {
  b: 'b', p: 'p', m: 'm', f: 'f', d: 'd', t: 't', n: 'n', l: 'l', g: 'g', k: 'k', h: 'h',
  j: 'j', q: 'q', x: 'x', r: 'r', z: 'z', c: 'c', s: 's', y: 'y', w: 'w',
  zh: 'v', ch: 'i', sh: 'u',
}

/** 韵母 → 键（A1 §2.2 核心表，官方 algebra L59~L83 逐行转写） */
const FINAL_KEY: Record<string, string> = {
  iu: 'q',
  ei: 'w',
  e: 'e',
  uan: 'r',
  ue: 't', ve: 't', // ue / üe 共用 T（L62 `xform/[uv]e$/T/`）
  un: 'y', // ün 经书写规范归入 un（C-2）
  u: 'u',
  i: 'i',
  uo: 'o', o: 'o', // uo / o 共用 O
  ie: 'p',
  a: 'a',
  ong: 's', iong: 's', // ong / iong 共用 S（L69 `i?ong$`）
  ai: 'd',
  en: 'f',
  eng: 'g',
  ang: 'h',
  an: 'j',
  ing: 'k', uai: 'k', // ing / uai 共用 K（L70）
  iang: 'l', uang: 'l', // iang / uang 共用 L（L74 `[iu]ang$`）
  ou: 'z',
  ia: 'x', ua: 'x', // ia / ua 共用 X（L79 `[iu]a$`）
  ao: 'c',
  ui: 'v', v: 'v', // ui 与 ü（v）共用 V，按位置消歧（L82 + L56）
  in: 'b',
  iao: 'n',
  ian: 'm',
}

/** 双字母零声母音节的 β 口径（A1 §3.2，仅这 6 个存在双口径） */
const ZERO_DOUBLE_LETTER: Record<string, string> = {
  ai: 'd', // 爱 = AI（主）/ AD（兼容）
  ei: 'w', // 欸 = EI / EW
  ao: 'c', // 熬 = AO / AC
  ou: 'z', // 欧 = OU / OZ
  an: 'j', // 安 = AN / AJ
  en: 'f', // 恩 = EN / EF
}

/** 声母表（长的优先，保证 zh/ch/sh 先于 z/c/s 匹配） */
const INITIALS = ['zh', 'ch', 'sh', 'b', 'p', 'm', 'f', 'd', 't', 'n', 'l', 'g', 'k', 'h', 'j', 'q', 'x', 'r', 'z', 'c', 's', 'y', 'w']

export type FlypyCode = {
  /** 主口径编码（acceptedCodes[0]） */
  main: string
  /** 兼容口径（可空）；零声母双字母 β / jqxy+ü 的原式 */
  alt?: string
}

/**
 * 拼音归一化：去声调、ü → v、j/q/x/y + u → j/q/x/y + v
 * 输入示例：'nǚ' → 'nv'；'lǜ' → 'lv'；'jǔ' → 'jv'；'zhōng' → 'zhong'
 */
export function normalizePinyin(py: string): string {
  let s = py
    .normalize('NFD')
    .replace(/[\u0304\u0301\u030c\u0300\u0306]/g, '') // 组合声调符号
    .normalize('NFC')
  s = s.replace(/[üǖǘǚǜ]/g, 'v').replace(/Ü/g, 'v')
  s = s.toLowerCase()
  // j/q/x/y 后的 u 实际是 ü（拼音书写规范），编码按实际韵母处理（A1 §3.3）
  s = s.replace(/^([jqxy])u$/, '$1v')
  // 罕见单韵母 ê 归入 e（诶/欸 类音节，避免编码失败）
  s = s.replace(/^ê$/, 'e')
  return s
}

function splitSyllable(py: string): { initial: string; final: string } {
  for (const initial of INITIALS) {
    if (py.startsWith(initial)) {
      return { initial, final: py.slice(initial.length) }
    }
  }
  return { initial: '', final: py }
}

/** 单个音节 → 小鹤双拼编码（输入为归一化后的无声调拼音） */
export function encodeFlypySyllable(py: string): FlypyCode {
  const { initial, final } = splitSyllable(py)

  if (!initial) {
    // 零声母音节（A1 §3.1 / §3.2）
    if (py === 'a' || py === 'o' || py === 'e') return { main: py + py }
    if (py === 'er') return { main: 'er' }
    if (py === 'ang') return { main: 'ah' }
    if (py === 'eng') return { main: 'eg' }
    if (py in ZERO_DOUBLE_LETTER) {
      return { main: py, alt: py[0] + ZERO_DOUBLE_LETTER[py] }
    }
    throw new Error(`无法编码的零声母音节: ${py}`)
  }

  const initialKey = INITIAL_KEY[initial]
  if (!initialKey) throw new Error(`未知声母: ${initial} (in ${py})`)

  const finalKey = FINAL_KEY[final]
  if (!finalKey) throw new Error(`未知韵母: ${final} (in ${py})`)

  const main = initialKey + finalKey
  // j/q/x/y + ü（归一化后为 v）：官方 derive 同时接受原式 JU/QU/XU/YU（A1 §3.3）
  if (['j', 'q', 'x', 'y'].includes(initial) && final === 'v') {
    return { main, alt: initialKey + 'u' }
  }
  return { main }
}

/** 全拼编码：去声调字母（输入为归一化后的拼音亦可，全拼不需 ü→v，但兼容） */
export function encodeQuanpinSyllable(py: string): string {
  return py
}

/**
 * 词条编码：逐音节编码后拼接。
 * 返回主编码与全部兼容编码（任一音节带兼容口径时，笛卡尔积展开，主口径在前）。
 */
export function encodeFlypyWord(syllables: string[]): { main: string; accepted: string[] } {
  const perSyllable = syllables.map((py) => encodeFlypySyllable(normalizePinyin(py)))
  const main = perSyllable.map((c) => c.main).join('')

  // 兼容口径展开：仅当至少一个音节有 alt 时才需要
  const altLists = perSyllable.map((c) => (c.alt ? [c.main, c.alt] : [c.main]))
  const total = altLists.reduce((acc, list) => acc * list.length, 1)
  const accepted: string[] = []
  if (total > 1) {
    for (let mask = 0; mask < total; mask++) {
      let m = mask
      const combo: string[] = []
      for (const list of altLists) {
        combo.push(list[m % list.length])
        m = Math.floor(m / list.length)
      }
      const code = combo.join('')
      if (code !== main && !accepted.includes(code)) accepted.push(code)
    }
  }
  return { main, accepted: [main, ...accepted] }
}

/** 全拼词条编码：逐音节去调拼接 */
export function encodeQuanpinWord(syllables: string[]): string {
  return syllables.map((py) => normalizePinyin(py)).join('')
}

/**
 * 键盘标注表（TypingKeyboard 显示用）——与 A1 §2.2 韵母表一一对应。
 * 🔴 键位事实唯一真源：本表与 src/resources/flypyKeyLabels.ts 是同一份数据
 * （此处转出，供构建脚本的 --verify 使用；运行时 UI 从 src 侧导入）。
 */
export { FLYPY_KEY_LABELS, flypyKeyTooltip } from '../../src/resources/flypyKeyLabels'
