/**
 * 打字模式词典构建脚本（spec-20261017-v1 / 05 DATA-10 ~ DATA-13）
 *
 * 用法：
 *   yarn build:typing-dicts            # 生成全部素材 JSON
 *   yarn build:typing-dicts --verify   # 20 个探针字编码抽检（人工对照 基线 A1 §3.5）
 *
 * 设计要点：
 * - 编码在构建期离线预计算并烘进 `name`，运行时零拼音库（D3）
 * - `pinyin-pro` 只在本脚本（devDependency）使用，产物不依赖它（DATA-11）
 * - 幂等：同一输入 → 同一输出（按语料文件顺序，无隐式排序）
 * - 任一拼音无法编码 → 抛错并列出全部问题行，不静默跳过（DATA-13）
 */

import fs from 'node:fs'
import path from 'node:path'
import { pinyin } from 'pinyin-pro'
import { encodeFlypySyllable, encodeFlypyWord, encodeQuanpinWord, normalizePinyin } from './schemes/flypy'

const ROOT = path.resolve(__dirname, '..')
const CORPUS_DIR = path.join(ROOT, 'src/corpus')
const OUT_DIR = path.join(ROOT, 'public/dicts')

/** 与 src/typings/index.ts 的 Word 兼容；acceptedCodes / units 为本批次新增字段（打字模式专用） */
type TypingUnit = { char: string; code: string }

type DictEntry = {
  name: string
  trans: string[]
  usphone: string
  ukphone: string
  notation: string
  acceptedCodes?: string[]
  units?: TypingUnit[]
  /** 🆕 v2 文章元数据（DATA2-01） */
  title?: string
  author?: string
  difficulty?: 'intro' | 'mid' | 'adv'
}

type Scheme = 'quanpin' | 'flypy'
type MaterialKind = 'zi' | 'ci' | 'chengyu' | 'duanju' | 'wenzhang' | 'en-para' | 'en-essay' | 'en-classic'

type MaterialDef = {
  /** 素材 id（zh-<scheme>-<type>[-<variant>] / en-<type>[-<variant>]） */
  id: string
  /** 语料文件（相对 src/corpus） */
  corpus: string
  kind: MaterialKind
  scheme: Scheme | 'en'
  /** 输出文件（相对 public/dicts） */
  out: string
}

const MATERIALS: MaterialDef[] = [
  // ── 中文 · 全拼（5）──
  { id: 'zh-quanpin-zi-500', corpus: 'zh/zi-500.txt', kind: 'zi', scheme: 'quanpin', out: 'zh/quanpin-zi-500.json' },
  { id: 'zh-quanpin-zi-1000', corpus: 'zh/zi-1000.txt', kind: 'zi', scheme: 'quanpin', out: 'zh/quanpin-zi-1000.json' },
  { id: 'zh-quanpin-zi-3500', corpus: 'zh/zi-3500.txt', kind: 'zi', scheme: 'quanpin', out: 'zh/quanpin-zi-3500.json' },
  { id: 'zh-quanpin-zi-3000-erji', corpus: 'zh/zi-3000-erji.txt', kind: 'zi', scheme: 'quanpin', out: 'zh/quanpin-zi-3000-erji.json' },
  { id: 'zh-quanpin-ci-1000', corpus: 'zh/ci-1000.txt', kind: 'ci', scheme: 'quanpin', out: 'zh/quanpin-ci-1000.json' },
  { id: 'zh-quanpin-ci-3000', corpus: 'zh/ci-3000.txt', kind: 'ci', scheme: 'quanpin', out: 'zh/quanpin-ci-3000.json' },
  { id: 'zh-quanpin-ci-medical', corpus: 'zh/ci-medical.txt', kind: 'ci', scheme: 'quanpin', out: 'zh/quanpin-ci-medical.json' },
  { id: 'zh-quanpin-ci-computer', corpus: 'zh/ci-computer.txt', kind: 'ci', scheme: 'quanpin', out: 'zh/quanpin-ci-computer.json' },
  { id: 'zh-quanpin-chengyu-500', corpus: 'zh/chengyu-500.txt', kind: 'chengyu', scheme: 'quanpin', out: 'zh/quanpin-chengyu-500.json' },
  { id: 'zh-quanpin-chengyu-1000', corpus: 'zh/chengyu-1000.txt', kind: 'chengyu', scheme: 'quanpin', out: 'zh/quanpin-chengyu-1000.json' },
  // ── 中文 · 小鹤双拼（7 + 长文/专业词双方案）──
  { id: 'zh-flypy-zi-500', corpus: 'zh/zi-500.txt', kind: 'zi', scheme: 'flypy', out: 'zh/flypy-zi-500.json' },
  { id: 'zh-flypy-zi-1000', corpus: 'zh/zi-1000.txt', kind: 'zi', scheme: 'flypy', out: 'zh/flypy-zi-1000.json' },
  { id: 'zh-flypy-zi-3500', corpus: 'zh/zi-3500.txt', kind: 'zi', scheme: 'flypy', out: 'zh/flypy-zi-3500.json' },
  { id: 'zh-flypy-zi-3000-erji', corpus: 'zh/zi-3000-erji.txt', kind: 'zi', scheme: 'flypy', out: 'zh/flypy-zi-3000-erji.json' },
  { id: 'zh-flypy-ci-1000', corpus: 'zh/ci-1000.txt', kind: 'ci', scheme: 'flypy', out: 'zh/flypy-ci-1000.json' },
  { id: 'zh-flypy-ci-3000', corpus: 'zh/ci-3000.txt', kind: 'ci', scheme: 'flypy', out: 'zh/flypy-ci-3000.json' },
  { id: 'zh-flypy-chengyu-500', corpus: 'zh/chengyu-500.txt', kind: 'chengyu', scheme: 'flypy', out: 'zh/flypy-chengyu-500.json' },
  { id: 'zh-flypy-chengyu-1000', corpus: 'zh/chengyu-1000.txt', kind: 'chengyu', scheme: 'flypy', out: 'zh/flypy-chengyu-1000.json' },
  { id: 'zh-flypy-duanju-200', corpus: 'zh/duanju-200.txt', kind: 'duanju', scheme: 'flypy', out: 'zh/flypy-duanju-200.json' },
  { id: 'zh-flypy-ci-medical', corpus: 'zh/ci-medical.txt', kind: 'ci', scheme: 'flypy', out: 'zh/flypy-ci-medical.json' },
  { id: 'zh-flypy-ci-computer', corpus: 'zh/ci-computer.txt', kind: 'ci', scheme: 'flypy', out: 'zh/flypy-ci-computer.json' },
  { id: 'zh-quanpin-duanju-200', corpus: 'zh/duanju-200.txt', kind: 'duanju', scheme: 'quanpin', out: 'zh/quanpin-duanju-200.json' },
  // ── 中文 · 长文（按方案各一份，DATA-04）──
  { id: 'zh-wenzhang-shi', corpus: 'zh/wenzhang-shi.txt', kind: 'wenzhang', scheme: 'quanpin', out: 'zh/quanpin-wenzhang-shi.json' },
  { id: 'zh-wenzhang-shi', corpus: 'zh/wenzhang-shi.txt', kind: 'wenzhang', scheme: 'flypy', out: 'zh/flypy-wenzhang-shi.json' },
  { id: 'zh-wenzhang-10', corpus: 'zh/wenzhang-baihua.txt', kind: 'wenzhang', scheme: 'quanpin', out: 'zh/quanpin-wenzhang-10.json' },
  { id: 'zh-wenzhang-10', corpus: 'zh/wenzhang-baihua.txt', kind: 'wenzhang', scheme: 'flypy', out: 'zh/flypy-wenzhang-10.json' },
  // 🆕 v2：入门档短文（GAL2-10 / MAT2-03）
  { id: 'zh-wenzhang-qingsong', corpus: 'zh/wenzhang-qingsong.txt', kind: 'wenzhang', scheme: 'quanpin', out: 'zh/quanpin-wenzhang-qingsong.json' },
  { id: 'zh-wenzhang-qingsong', corpus: 'zh/wenzhang-qingsong.txt', kind: 'wenzhang', scheme: 'flypy', out: 'zh/flypy-wenzhang-qingsong.json' },
  // ── 英语（2）──
  { id: 'en-article-para', corpus: 'en/para.txt', kind: 'en-para', scheme: 'en', out: 'en/para.json' },
  { id: 'en-article-essay', corpus: 'en/essay.txt', kind: 'en-essay', scheme: 'en', out: 'en/essay.json' },
  // 🆕 v2：公版英文经典（MAT2-04）
  { id: 'en-article-classic', corpus: 'en/classic.txt', kind: 'en-classic', scheme: 'en', out: 'en/classic.json' },
]

/**
 * 多音词校正表（MAT-04：多音字必须按词读音）。
 * pinyin-pro 的词语级上下文已覆盖绝大多数情况，此表只兜底已知会出错的词。
 */
const PY_CORRECTIONS: Record<string, string[]> = {
  给予: ['ji', 'yu'],
  行长: ['hang', 'zhang'],
  大夫: ['dai', 'fu'],
  重复: ['chong', 'fu'],
  重庆: ['chong', 'qing'],
  重新: ['chong', 'xin'],
  种子: ['zhong', 'zi'],
  种植: ['zhong', 'zhi'],
  重量: ['zhong', 'liang'],
  重要: ['zhong', 'yao'],
  成长: ['cheng', 'zhang'],
  校长: ['xiao', 'zhang'],
  长城: ['chang', 'cheng'],
  长期: ['chang', 'qi'],
  调整: ['tiao', 'zheng'],
  空调: ['kong', 'tiao'],
  调查: ['diao', 'cha'],
  音乐: ['yin', 'yue'],
  快乐: ['kuai', 'le'],
  乐器: ['yue', 'qi'],
  银行: ['yin', 'hang'],
  行业: ['hang', 'ye'],
  同行: ['tong', 'hang'],
  会计: ['kuai', 'ji'],
  头发: ['tou', 'fa'],
  所长: ['suo', 'zhang'],
  重命名: ['chong', 'ming', 'ming'],
  发现: ['fa', 'xian'],
  都会: ['du', 'hui'],
  大意: ['da', 'yi'],
  大量: ['da', 'liang'],
  大连: ['da', 'lian'],
  大王: ['da', 'wang'],
  大夫: ['dai', 'fu'],
  大学: ['da', 'xue'],
  目的: ['mu', 'di'],
  沐浴: ['mu', 'yu'],
  模样: ['mu', 'yang'],
  比赛: ['bi', 'sai'],
  数不胜数: ['shu', 'bu', 'sheng', 'shu'],
}

const MAX_ACCEPTED = 8

/**
 * CJK 判定（含扩展 A U+3400-4DBF、URO、兼容区与扩展 B~H U+20000-3134A：
 * 《通用规范汉字表》二级字表含 3 个扩展 B/C 汉字，pinyin-pro 可正常编码，
 * 早期正则漏掉它们会导致 units 对齐失败）。
 */
const CJK_RE = /[\u3400-\u9fff\uf900-\ufaff\u{20000}-\u{3134a}]/u
const PY_SYLLABLE_RE = /^[a-z]+$/

function isCjk(ch: string): boolean {
  return CJK_RE.test(ch)
}

function readLines(file: string): string[] {
  return fs
    .readFileSync(path.join(CORPUS_DIR, file), 'utf8')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
}

/** 段落块（空行分隔） */
function readBlocks(file: string): string[] {
  return fs
    .readFileSync(path.join(CORPUS_DIR, file), 'utf8')
    .split(/\r?\n/)
    .reduce<string[]>((acc, raw) => {
      const line = raw.trim()
      if (!line || line.startsWith('#')) return acc
      acc.push(line)
      return acc
    }, [])
}

type Difficulty = 'intro' | 'mid' | 'adv'
type WenzhangPiece = { title: string; author?: string; body: string; difficulty?: Difficulty }

const DIFFICULTY_SET = new Set<string>(['intro', 'mid', 'adv'])

/** 解析 `@intro` / `@mid` / `@adv` 标记行（DATA2-04），返回难度或 undefined */
function parseDiffMark(line: string): Difficulty | undefined {
  if (!line.startsWith('@')) return undefined
  const raw = line.slice(1).trim().toLowerCase()
  return DIFFICULTY_SET.has(raw) ? (raw as Difficulty) : undefined
}

/** 难度自动推断兜底（DATA2-05）：按汉字数分档，文言/诗词由调用方强制 adv */
function inferDifficulty(body: string): Difficulty {
  const n = [...body].filter(isCjk).length
  if (n <= 350) return 'intro'
  if (n <= 900) return 'mid'
  return 'adv'
}

/** 英文难度推断（DATA2-05 的英文版）：按词数分档 */
function inferDifficultyEn(body: string): Difficulty {
  const n = body.split(/\s+/).filter(Boolean).length
  if (n <= 180) return 'intro'
  if (n <= 420) return 'mid'
  return 'adv'
}

/** wenzhang 格式：`### 篇名` + 作者行（可省）+ `@难度`（可省）+ 正文；空行分段 */
function readWenzhang(file: string): WenzhangPiece[] {
  const lines = fs.readFileSync(path.join(CORPUS_DIR, file), 'utf8').split(/\r?\n/)
  const pieces: WenzhangPiece[] = []
  let current: WenzhangPiece | null = null
  let headerOpen = false
  for (const raw of lines) {
    const line = raw.trim()
    if (line.startsWith('### ')) {
      current = { title: line.slice(4).trim(), body: '' }
      pieces.push(current)
      headerOpen = true
      continue
    }
    if (!current || !line || line.startsWith('#')) continue

    // 头部区：作者行与难度标记可以任意顺序出现（DATA2-04）
    if (headerOpen) {
      const diff = parseDiffMark(line)
      if (diff) {
        current.difficulty = diff
        continue
      }
      if (!current.author && /^[\u4e00-\u9fff·]{2,6}$/.test(line)) {
        current.author = line
        continue
      }
      headerOpen = false
    }
    current.body += (current.body ? '\n' : '') + line
  }
  return pieces.filter((p) => p.body.length > 0)
}

/** 英文素材：`### 标题` + `@难度`（可省）+ 正文段落 */
function readEnglish(file: string): { title: string; body: string; difficulty?: Difficulty }[] {
  const lines = fs.readFileSync(path.join(CORPUS_DIR, file), 'utf8').split(/\r?\n/)
  const items: { title: string; body: string; difficulty?: Difficulty }[] = []
  let current: { title: string; body: string; difficulty?: Difficulty } | null = null
  for (const raw of lines) {
    const line = raw.trim()
    if (line.startsWith('### ')) {
      current = { title: line.slice(4).trim(), body: '' }
      items.push(current)
      continue
    }
    if (!current || !line || line.startsWith('#')) continue
    // 脚本内的 line 是 trim 后的原始行（含前导 @），parseDiffMark 依赖 `@` 前缀
    const diff = parseDiffMark(raw.trim())
    if (diff && !current.body) {
      current.difficulty = diff
      continue
    }
    current.body += (current.body ? ' ' : '') + line
  }
  return items.filter((i) => i.body.length > 0)
}

/** 词 → 音节数组（优先校正表，其次 pinyin-pro 词语级上下文） */
function wordPinyin(word: string): string[] {
  if (PY_CORRECTIONS[word]) return PY_CORRECTIONS[word]
  const arr = pinyin(word, { toneType: 'none', type: 'array' })
  const syllables = arr.map((s) => normalizePinyin(s))
  if (syllables.length !== [...word].filter(isCjk).length) {
    throw new Error(`词「${word}」拼音数量与汉字数量不一致: ${JSON.stringify(arr)}`)
  }
  for (const s of syllables) {
    if (!PY_SYLLABLE_RE.test(s)) throw new Error(`词「${word}」含非法拼音音节: ${JSON.stringify(arr)}`)
  }
  return syllables
}

/**
 * 句子 → 音节数组（按位对齐：pinyin-pro 的 type:'array' 与输入逐字符对应）
 * - 标点 / 拉丁字母等非汉字字符：跳过（不产生音节）
 * - CJK 字符但无法拼音化（生僻字等）：抛错列出，不静默跳过（DATA-13）
 */
function sentencePinyin(sentence: string): string[] {
  const chars = [...sentence]
  const arr = pinyin(sentence, { toneType: 'none', type: 'array' })
  if (arr.length !== chars.length) {
    throw new Error(`pinyin 返回数组长度与字符数不一致: 「${sentence.slice(0, 30)}…」`)
  }
  const syllables: string[] = []
  for (let i = 0; i < chars.length; i++) {
    if (!isCjk(chars[i])) continue
    const py = normalizePinyin(arr[i])
    if (!PY_SYLLABLE_RE.test(py)) {
      throw new Error(`句子含无法拼音化的汉字「${chars[i]}」: 「${sentence.slice(0, 30)}…」`)
    }
    syllables.push(py)
  }
  return syllables
}

/**
 * 生成 acceptedCodes：
 * - 短条目：全组合（主口径在前），总数 ≤ MAX_ACCEPTED 时逐个列出
 * - 长条目：组合数爆炸时降级为「主口径 + 单音节替换」（上限 MAX_ACCEPTED 条）
 *
 * 🔴 mains 必须是**每音节**的主编码数组（不是整词拼接）：
 * 早期版本误传整词 main，导致长条目分支的组合码 = 整词码 × 音节数（单条 80 万字符），
 * 使 flypy 文章 JSON 膨胀到 98MB。
 */
function buildAccepted(mains: string[], perSyllableAlts: (string[] | null)[]): string[] {
  // 每音节展开为 [主口径, 兼容口径?]
  const lists = mains.map((m, i) => {
    const alts = perSyllableAlts[i]
    return alts && alts.length > 0 ? [m, alts[0]] : [m]
  })
  const main = mains.join('')
  const total = lists.reduce((acc, l) => acc * l.length, 1)
  const accepted: string[] = [main]
  if (total <= 1) return accepted
  if (total <= MAX_ACCEPTED) {
    for (let mask = 1; mask < total; mask++) {
      let m = mask
      const combo: string[] = []
      for (const list of lists) {
        combo.push(list[m % list.length])
        m = Math.floor(m / list.length)
      }
      const code = combo.join('')
      if (code !== main && !accepted.includes(code)) accepted.push(code)
    }
  } else {
    // 单音节替换：每个带兼容口径的音节各生成一条
    for (let i = 0; i < lists.length; i++) {
      if (lists[i].length < 2) continue
      const combo = lists.map((l, j) => (j === i ? l[1] : l[0]))
      const code = combo.join('')
      if (code !== main && !accepted.includes(code)) accepted.push(code)
      if (accepted.length >= MAX_ACCEPTED) break
    }
  }
  return accepted
}

/** 单音节编码：返回主编码与兼容编码（小鹤）；全拼无兼容 */
function encodeSyllable(scheme: Scheme, py: string): { main: string; alt: string | null } {
  if (scheme === 'quanpin') return { main: normalizePinyin(py), alt: null }
  const code = encodeFlypySyllable(py)
  return { main: code.main, alt: code.alt ?? null }
}

/** 一组音节 → 每音节主编码数组 + 每音节兼容编码 */
function encodeSyllables(scheme: Scheme, syllables: string[]): { mains: string[]; alts: (string[] | null)[] } {
  const mains: string[] = []
  const alts: (string[] | null)[] = []
  for (const py of syllables) {
    const { main, alt } = encodeSyllable(scheme, py)
    mains.push(main)
    alts.push(alt ? [alt] : null)
  }
  return { mains, alts }
}

function makeEntry(hanzi: string, code: string, accepted: string[], units?: TypingUnit[]): DictEntry {
  const entry: DictEntry = {
    name: code,
    trans: [hanzi],
    usphone: '',
    ukphone: '',
    notation: hanzi,
  }
  if (accepted.length > 1) entry.acceptedCodes = accepted
  if (units && units.length > 0) entry.units = units
  return entry
}

/**
 * 生成逐字对齐单元：`units.length === [...notation].length`。
 *
 * 规则（用户拍板「标点显示但不打」）：
 * - 汉字 → 消耗一个主编码片段（来自 mains 队列），记为它的 code
 * - 非汉字（标点 / 空白 / 换行）→ code = ''，仅用于显示占位
 *
 * 🔴 `mains` 必须是按汉字顺序排列的每字主编码；长度须与 notation 中汉字数相等，
 * 否则抛错（宁可构建失败，也不产出错位数据）。
 */
function buildUnits(notation: string, mains: string[]): TypingUnit[] {
  const chars = [...notation]
  const hanziCount = chars.filter(isCjk).length
  if (hanziCount !== mains.length) {
    throw new Error(`对齐失败：汉字数 ${hanziCount} ≠ 编码片段数 ${mains.length}：「${notation.slice(0, 24)}…」`)
  }
  let cursor = 0
  return chars.map((char) => ({
    char,
    code: isCjk(char) ? mains[cursor++] : '',
  }))
}

type BuildResult = { entries: DictEntry[]; excluded: string[] }

/** 汉字串（可能含标点）→ 编码条目（附带每字主编码，供构建 units） */
function encodeHanziText(scheme: Scheme, hanzi: string, syllables: string[]): { code: string; accepted: string[]; mains: string[] } {
  const { mains, alts } = encodeSyllables(scheme, syllables)
  return { code: mains.join(''), accepted: buildAccepted(mains, alts), mains }
}

function buildMaterial(def: MaterialDef): BuildResult {
  switch (def.kind) {
    case 'zi': {
      const chars = readLines(def.corpus)
      const entries = chars.map((ch) => {
        const py = pinyin(ch, { toneType: 'none' })
        const { code, accepted, mains } = encodeHanziText(def.scheme as Scheme, ch, [normalizePinyin(py)])
        return makeEntry(ch, code, accepted, buildUnits(ch, mains))
      })
      return { entries, excluded: [] }
    }
    case 'ci':
    case 'chengyu': {
      const words = readLines(def.corpus)
      const entries = words.map((w) => {
        const syllables = wordPinyin(w)
        const { code, accepted, mains } = encodeHanziText(def.scheme as Scheme, w, syllables)
        return makeEntry(w, code, accepted, buildUnits(w, mains))
      })
      return { entries, excluded: [] }
    }
    case 'duanju': {
      const sentences = readLines(def.corpus)
      const entries = sentences.map((s) => {
        const syllables = sentencePinyin(s)
        const { code, accepted, mains } = encodeHanziText(def.scheme as Scheme, s, syllables)
        return makeEntry(s, code, accepted, buildUnits(s, mains))
      })
      return { entries, excluded: [] }
    }
    case 'wenzhang': {
      const pieces = readWenzhang(def.corpus)
      const entries = pieces.map((piece) => {
        // 篇名 + 作者 + 正文 一起作为展示文本；编码只取汉字部分
        const display = (piece.author ? `${piece.title} ${piece.author}\n` : `${piece.title}\n`) + piece.body
        const syllables = sentencePinyin(display)
        const { code, accepted, mains } = encodeHanziText(def.scheme as Scheme, display, syllables)
        // DATA2-01：篇名/作者/难度（难度优先取显式标记，缺省按篇幅推断）
        const difficulty = piece.difficulty ?? inferDifficulty(piece.body)
        return { ...makeEntry(display, code, accepted, buildUnits(display, mains)), title: piece.title, author: piece.author, difficulty }
      })
      return { entries, excluded: [] }
    }
    case 'en-para': {
      // 段落语料带 `### 标题` 与 `@难度`（v2 起）
      const items = readEnglish(def.corpus)
      if (items.length === 0) {
        // 兼容老格式：无标题的纯段落
        const paras = readBlocks(def.corpus)
        const entries = paras.map((p) => makeEntry(p, p, [p]))
        return { entries, excluded: [] }
      }
      const entries = items.map((item) => ({
        ...makeEntry(item.body, item.body, [item.body]),
        title: item.title,
        difficulty: item.difficulty ?? inferDifficultyEn(item.body),
      }))
      return { entries, excluded: [] }
    }
    case 'en-essay':
    case 'en-classic': {
      const items = readEnglish(def.corpus)
      const entries = items.map((item) => {
        const text = `${item.title}. ${item.body}`
        return {
          ...makeEntry(text, text, [text]),
          title: item.title,
          difficulty: item.difficulty ?? inferDifficultyEn(item.body),
        }
      })
      return { entries, excluded: [] }
    }
  }
}

function runVerify(): void {
  const probes = '中国人我爱你爱安昂二女绿局平亮料来老楼位卷'
  const chars = [...probes]
  console.log('\n=== --verify：20 个探针字编码抽检（人工对照 基线 A1 §3.5）===')
  console.log('字 | 全拼 | 小鹤 | 小鹤兼容')
  for (const ch of chars) {
    const py = normalizePinyin(pinyin(ch, { toneType: 'none' }))
    const quanpin = encodeQuanpinWord([py])
    const flypy = encodeFlypyWord([py])
    console.log(`${ch} | ${quanpin} | ${flypy.main} | ${flypy.accepted.slice(1).join(',') || '—'}`)
  }
  console.log('=== verify 结束 ===\n')
}

function main(): void {
  const args = process.argv.slice(2)
  if (args.includes('--verify')) {
    runVerify()
    return
  }

  const results: { def: MaterialDef; count: number; avgLen: number; acceptedCount: number }[] = []
  const failures: string[] = []

  for (const def of MATERIALS) {
    try {
      const { entries } = buildMaterial(def)
      if (entries.length === 0) throw new Error('产物为空')
      const outPath = path.join(OUT_DIR, def.out)
      fs.mkdirSync(path.dirname(outPath), { recursive: true })
      fs.writeFileSync(outPath, JSON.stringify(entries))
      const totalLen = entries.reduce((acc, e) => acc + e.name.length, 0)
      const acceptedCount = entries.filter((e) => e.acceptedCodes && e.acceptedCodes.length > 1).length
      results.push({
        def,
        count: entries.length,
        avgLen: Math.round((totalLen / entries.length) * 100) / 100,
        acceptedCount,
      })
    } catch (err) {
      failures.push(`${def.id} (${def.out}): ${(err as Error).message}`)
    }
  }

  console.log('\n=== build:typing-dicts 结果 ===')
  for (const r of results) {
    console.log(
      `[ok] ${r.def.id.padEnd(24)} → ${r.def.out.padEnd(32)} 条目 ${String(r.count).padStart(4)} | 均长 ${String(
        r.avgLen,
      ).padStart(6)} | acceptedCodes ${r.acceptedCount}`,
    )
  }
  if (failures.length > 0) {
    console.error('\n=== 失败（已列出全部问题行，未静默跳过）===')
    for (const f of failures) console.error(`[fail] ${f}`)
    process.exit(1)
  }
  console.log(`\n共生成 ${results.length} 个 JSON 文件。`)
}

main()
