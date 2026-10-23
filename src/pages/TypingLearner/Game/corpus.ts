/**
 * 游戏语料选取（spec-20261019-v1 / 05 DATA-01）
 *
 * 🔴 三个玩法**全部从现有六级语料取词，不新建词库**：
 * - 墨雨：字层（L1）+ 词层（L2），按 tier 选取（入门 zi-500 / 进阶 ci-1000 / 挑战 zi-3500）；
 * - 诗词射击：词层（L2 敌舰词）+ 诗句层（L5 古诗文短篇 12 首，公版）；
 * - 成语接龙：成语层（L3，chengyu-500）；
 * - 英语 Tab：墨雨/诗词射击复用英文段落/文章语料（对码轨纯字母）。
 *
 * 🔴 三类敌人（03 SHOOT-02）**运行时从现有语料筛选**，零新素材：
 * - 护盾舰 = 含易错韵母的词（A1 §4.3 的 8 组高频易错对照：in/ing、iang/uang、iao/ai、ao/ou）；
 * - Boss = 零声母音节密集（爱/安/昂/欧/恩，拼音以 a/e/o/y 开头）或 ü 系列（女/绿/局/学/卷/云，拼音含 v）。
 * 分类依据全拼编码（与方案无关），故一律加载 quanpin 版本做分类、scheme 版本做游玩。
 */

import { useMemo } from 'react'
import useSWR from 'swr'
import type { EntityKind, GameWord } from './engine/types'
import type { TypingSchemeId, TypingWord } from '@/typings/typing'
import { wordListFetcher } from '@/utils/wordListFetcher'

/** SWR 拉取单份词典 JSON（复用现有 fetcher，含 pages 部署前缀处理） */
function useDict(url: string | undefined) {
  const { data, error, isLoading } = useSWR(url, wordListFetcher)
  return { words: (data as TypingWord[] | undefined) ?? [], error, isLoading }
}

/** 墨雨 tier → 中文素材 id（05 DATA-01 + 难度 tier 映射定稿值） */
const MOYU_ZH_MATERIAL: Record<'intro' | 'mid' | 'adv', string> = {
  intro: 'zi-500',
  mid: 'ci-1000',
  adv: 'zi-3500',
}

/** 英文段落/文章 → 单词池（按空格切分，去重，过滤过长/过短） */
function splitEnglishWords(words: TypingWord[]): GameWord[] {
  const set = new Set<string>()
  const pool: GameWord[] = []
  for (const w of words) {
    for (const raw of (w.notation ?? w.name).split(/\s+/)) {
      const word = raw.replace(/[^a-zA-Z'-]/g, '')
      if (word.length < 2 || word.length > 12) continue
      const lower = word.toLowerCase()
      if (set.has(lower)) continue
      set.add(lower)
      pool.push({ text: word, code: lower, kind: 'normal' })
    }
  }
  return pool
}

/** 中文词条 → GameWord（code 用 name 编码串） */
function zhWords(words: TypingWord[]): GameWord[] {
  return words
    .filter((w) => w.notation && w.name)
    .map((w) => ({ text: w.notation as string, code: w.name, kind: 'normal' as EntityKind }))
}

/**
 * 易错韵母判定（A1 §4.3 八组高频易错对照）：
 * in/ing、iang/uang、iao/ai、ao/ou（en 两方案同键，不计入）。
 */
const CONFUSABLE_FINALS = ['in', 'ing', 'iang', 'uang', 'iao', 'ai', 'ao', 'ou']
function hasConfusableFinal(pinyin: string | undefined): boolean {
  if (!pinyin) return false
  return CONFUSABLE_FINALS.some((f) => pinyin.endsWith(f))
}

/** 零声母 / ü 系列判定（A1 §3.3：爱/安/昂/欧/恩 + 女/绿/局/学/卷/云） */
function isZeroInitialOrV(pinyin: string | undefined): boolean {
  if (!pinyin) return false
  return /^[aeo]/.test(pinyin) || /^y/.test(pinyin) || pinyin.includes('v')
}

/**
 * 古诗文短篇解析：notation 首行为「篇名 作者」，其余为正文。
 * 朝代为事实性信息（A2 §3.5 公版清单），内置映射。
 */
const POEM_DYNASTY: Record<string, string> = {
  静夜思: '唐',
  春晓: '唐',
  登鹳雀楼: '唐',
  相思: '唐',
  绝句: '唐',
  望庐山瀑布: '唐',
  江雪: '唐',
  陋室铭: '唐',
  题西林壁: '宋',
  小池: '宋',
  游园不值: '宋',
  爱莲说: '宋',
}

export type PoemChunk = { text: string; code: string; kind: EntityKind }

export type Poem = {
  title: string
  author: string
  dynasty: string
  /** 正文纯汉字（去标点）按 2 字切分的敌舰词 */
  chunks: PoemChunk[]
}

/** 从词典条目解析篇名/作者/正文 */
function parsePoemEntry(entry: TypingWord): { title: string; author: string; body: string } {
  const lines = (entry.notation ?? '').split('\n')
  const head = (lines[0] ?? '').trim()
  const parts = head.split(/\s+/)
  const title = parts[0] ?? ''
  const author = parts[1] ?? ''
  const body = lines.slice(1).join('')
  return { title, author, body }
}

/** 正文去标点后按 2 字切分（末段可剩 1 字） */
function chunkHanzi(body: string): string[] {
  const pure = body.replace(/[^\u4e00-\u9fff]/g, '')
  const chunks: string[] = []
  for (let i = 0; i < pure.length; i += 2) chunks.push(pure.slice(i, i + 2))
  return chunks
}

/**
 * 墨雨语料池（字/词层；英语为段落单词）。
 * 05 DATA-01：入门=字层、进阶=词层、挑战=zi-3500。
 */
export function useMoyuPool(opts: { language: 'zh' | 'en'; tier: 'intro' | 'mid' | 'adv'; scheme: TypingSchemeId }) {
  const url =
    opts.language === 'en'
      ? '/dicts/en/para.json'
      : `/dicts/zh/${opts.scheme === 'flypy' ? 'flypy' : 'quanpin'}-${MOYU_ZH_MATERIAL[opts.tier]}.json`
  const { words, isLoading, error } = useDict(url)
  const pool = opts.language === 'en' ? splitEnglishWords(words) : zhWords(words)
  return { pool, isLoading, error }
}

/**
 * 诗词射击语料：敌舰词池（词层，运行时分类）+ 12 首公版古诗的切分词。
 * 加载三份：scheme 版诗文（游玩编码）、quanpin 版诗文与词表（分类用拼音）。
 */
export function useShootCorpus(opts: { language: 'zh' | 'en'; scheme: TypingSchemeId }) {
  const schemeDir = opts.scheme === 'flypy' ? 'flypy' : 'quanpin'
  const shi = useDict(opts.language === 'en' ? undefined : `/dicts/zh/${schemeDir}-wenzhang-shi.json`)
  const shiQuanpin = useDict(opts.language === 'en' ? undefined : '/dicts/zh/quanpin-wenzhang-shi.json')
  const ciQuanpin = useDict(opts.language === 'en' ? '/dicts/en/essay.json' : '/dicts/zh/quanpin-ci-1000.json')
  const ciScheme = useDict(opts.language === 'en' ? undefined : `/dicts/zh/${schemeDir}-ci-1000.json`)

  // 汉字 → 全拼（分类依据；来自 quanpin 版 units）
  const pinyinMap = useMemo(() => {
    const m = new Map<string, string>()
    for (const w of [...shiQuanpin.words, ...ciQuanpin.words]) {
      for (const u of w.units ?? []) {
        if (u.char && u.code && !m.has(u.char)) m.set(u.char, u.code)
      }
    }
    return m
  }, [shiQuanpin.words, ciQuanpin.words])

  /** 英语：文章即「关」，按 2 词切分 */
  if (opts.language === 'en') {
    const poems: Poem[] = ciQuanpin.words.map((w) => {
      const lines = (w.notation ?? w.name).split('\n')
      const title = (lines[0] ?? '').trim() || (w.title ?? 'English Text')
      const bodyWords = (lines.slice(1).join(' ') || lines[0] || '')
        .split(/\s+/)
        .map((s) => s.replace(/[^a-zA-Z'-]/g, ''))
        .filter((s) => s.length > 0)
      const chunks: PoemChunk[] = []
      for (let i = 0; i < bodyWords.length; i += 2) {
        const text = bodyWords.slice(i, i + 2).join(' ')
        chunks.push({ text, code: text.toLowerCase(), kind: 'normal' })
      }
      return { title, author: w.author ?? '', dynasty: '', chunks }
    })
    const enemyPool: GameWord[] = poems.flatMap((p) => p.chunks.map((c) => ({ text: c.text, code: c.code, kind: c.kind })))
    return { enemyPool, poems, isLoading: ciQuanpin.isLoading, error: ciQuanpin.error }
  }

  // 中文：诗文切分 + 分类
  const poems: Poem[] = shi.words.map((entry) => {
    const { title, author, body } = parsePoemEntry(entry)
    const units = entry.units ?? []
    const chunks: PoemChunk[] = []
    for (const text of chunkHanzi(body)) {
      let code = ''
      let zeroCount = 0
      let shield = false
      for (const ch of text) {
        const u = units.find((x) => x.char === ch)
        const py = pinyinMap.get(ch) ?? u?.code
        code += u?.code ?? ''
        if (isZeroInitialOrV(py)) zeroCount += 1
        if (hasConfusableFinal(py)) shield = true
      }
      chunks.push({ text, code, kind: zeroCount >= 2 ? 'boss' : shield ? 'shield' : 'normal' })
    }
    return { title, author, dynasty: POEM_DYNASTY[title] ?? '', chunks }
  })

  // 词层敌舰池（分类）；Boss 候选不足时降阈值为 ≥1，保证每局都有 Boss 出现
  const classifyCi = (threshold: number): GameWord[] =>
    ciScheme.words
      .map((w) => {
        let zeroCount = 0
        let shield = false
        for (const u of w.units ?? []) {
          const py = pinyinMap.get(u.char) ?? u.code
          if (isZeroInitialOrV(py)) zeroCount += 1
          if (hasConfusableFinal(py)) shield = true
        }
        const kind: EntityKind = zeroCount >= threshold ? 'boss' : shield ? 'shield' : 'normal'
        return { text: w.notation ?? '', code: w.name, kind }
      })
      .filter((w) => w.text)

  let enemyPool = classifyCi(2)
  if (enemyPool.filter((w) => w.kind === 'boss').length < 4) {
    enemyPool = classifyCi(1)
  }

  return { enemyPool, poems, isLoading: shi.isLoading || ciScheme.isLoading, error: shi.error ?? ciScheme.error }
}

export type IdiomIndex = {
  idioms: GameWord[]
  /** 首字 → 成语列表 */
  byFirst: Map<string, GameWord[]>
  /** 末字 → 成语列表 */
  byLast: Map<string, GameWord[]>
}

/** 成语接龙语料：chengyu-500 + 首/末字索引（04 IDIOM-01）；逐字拼音取 quanpin 版 units 供提示 */
export function useIdiomPool(opts: { scheme: TypingSchemeId }): { index: IdiomIndex; isLoading: boolean; error: Error | undefined } {
  const schemeDir = opts.scheme === 'flypy' ? 'flypy' : 'quanpin'
  const { words, isLoading, error } = useDict(`/dicts/zh/${schemeDir}-chengyu-500.json`)
  const quanpin = useDict('/dicts/zh/quanpin-chengyu-500.json')
  const index = useMemo<IdiomIndex>(() => {
    // 拼音按成语文本对齐（两版条目顺序一致，均为 chengyu-500.txt 构建产物）
    const pinyinByText = new Map<string, string[]>()
    for (const w of quanpin.words) {
      const py = (w.units ?? []).map((u) => u.code)
      if (w.notation && py.length > 0 && !pinyinByText.has(w.notation)) pinyinByText.set(w.notation, py)
    }
    const idioms = zhWords(words).map((w) => ({ ...w, pinyins: pinyinByText.get(w.text) }))
    const byFirst = new Map<string, GameWord[]>()
    const byLast = new Map<string, GameWord[]>()
    for (const it of idioms) {
      const first = it.text[0]
      const last = it.text[it.text.length - 1]
      if (!byFirst.has(first)) byFirst.set(first, [])
      byFirst.get(first)!.push(it)
      if (!byLast.has(last)) byLast.set(last, [])
      byLast.get(last)!.push(it)
    }
    return { idioms, byFirst, byLast }
  }, [words, quanpin.words])
  return { index, isLoading: isLoading || quanpin.isLoading, error: error ?? quanpin.error }
}
