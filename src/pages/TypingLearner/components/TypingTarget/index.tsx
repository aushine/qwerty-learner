/**
 * TypingTarget —— 打字模式题面（展示组件，spec-20261017-v1 / 02 LAY-03 ~ LAY-07）
 *
 * 纯展示：判定与状态在 TypingPanel（与键盘点击共用同一输入入口）。
 * 颜色纪律（LAY-04）：三态色板与 `Letter.tsx` 的 `stateClassNameMap` 逐值一致
 * （该 map 未导出且 Letter.tsx 不在本批次改动白名单内，故在此按同值复制并注释溯源）。
 *
 * 🔴 2026-10-17 改版（用户需求）：「拼音行 / 汉字行」**交替且逐字对齐**。
 *   ┌ 拼音行：jing ye si  li bai
 *   └ 汉字行：静   夜  思   李  白
 *
 * 对齐方式：每个字是一个**等宽列**，拼音与汉字在同一列内各自居中，
 * 因此天然一一对应（不依赖字符宽度）。列宽由本组内最长的编码决定。
 *
 * 进度以「字」为单位推进：某字编码全部打对后，该字的拼音与汉字**同时转绿**。
 * 标点 / 空白显示但不参与输入（用户拍板「标点可省略不打」）。
 */

import { EXPLICIT_SPACE } from '@/constants'
import { useMemo } from 'react'

export type TypingTargetScheme = 'quanpin' | 'flypy' | 'en'
export type TargetLetterState = 'normal' | 'correct' | 'wrong'

/** 逐字对齐单元（与词条 JSON 的 `units` 同构） */
export type TargetUnit = { char: string; code: string }

/** 与 Letter.tsx 的 stateClassNameMap 同值（LAY-04：不得另造颜色） */
const stateClassNameMap: Record<string, Record<TargetLetterState, string>> = {
  true: {
    normal: 'text-gray-400',
    correct: 'text-green-400 dark:text-green-700',
    wrong: 'text-red-400 dark:text-red-600',
  },
  false: {
    normal: 'text-gray-600 dark:text-gray-50',
    correct: 'text-green-600 dark:text-green-400',
    wrong: 'text-red-600 dark:text-red-400',
  },
}

export type TypingTargetProps = {
  /** 目标编码（已做 ␣ 替换） */
  displayWord: string
  letterStates: TargetLetterState[]
  /** 已正确击键数（= 当前应按的下标），用于行窗口定位 */
  cursor: number
  scheme: TypingTargetScheme
  /** 汉字提示行显隐（KEEP-13） */
  isShowHanzi: boolean
  /** 汉字原文（notation，超长素材由父层截断） */
  hanzi: string
  /** 每行最大字符数（LAY-05：短句 24、文章 32、英语约 48；0 = 不折行） */
  charsPerLine: number
  /** 题面字号 px（LAY-03 / LAY-05） */
  codeFontSize: number
  /** 视觉行窗口上限（空格分隔的组数 × 2 行；LAY-05：文章 6 行） */
  windowLines?: number
  /** 逐字对齐单元；为空时退化为「编码行 + 整段汉字」的旧渲染（英语素材走此分支） */
  units?: TargetUnit[]
}

/** 一组 = 一行拼音 + 一行汉字 */
type TargetGroup = {
  start: number
  end: number
  units: TargetUnit[]
}

/** 一个可视列（字 / 标点 / 词间空格） */
type TargetCell = {
  unit: TargetUnit
  index: number
  /** 该列对应的编码是否已全部打对 */
  done: boolean
  /** 是否正在输入（当前字） */
  active: boolean
}

/**
 * 按「累积编码宽度」切组，保证每组拼音在一行内放得下。
 *
 * 为什么按编码宽度而非字数：一个汉字对应 2~6 个字母，若按字数切，
 * 长句的拼音行会溢出容器。标点（code=''）不占宽度，与前后汉字同组。
 * `\n` 强制断组（文章分段）。
 */
function groupByWidth(units: TargetUnit[], maxWidth: number): TargetGroup[] {
  if (units.length === 0) return []
  const limit = maxWidth > 0 ? maxWidth : Number.MAX_SAFE_INTEGER
  const groups: TargetGroup[] = []
  let start = 0
  let width = 0

  for (let i = 0; i < units.length; i++) {
    const unit = units[i]
    if (unit.char === '\n') {
      groups.push({ start, end: i, units: units.slice(start, i) })
      start = i + 1
      width = 0
      continue
    }
    const w = unit.code.length
    if (width + w > limit && i > start) {
      groups.push({ start, end: i, units: units.slice(start, i) })
      start = i
      width = 0
    }
    width += w
  }
  if (start < units.length) {
    groups.push({ start, end: units.length, units: units.slice(start) })
  }
  return groups.filter((g) => g.units.length > 0)
}

export default function TypingTarget({
  displayWord,
  letterStates,
  cursor,
  scheme,
  isShowHanzi,
  hanzi,
  charsPerLine,
  codeFontSize,
  windowLines = 6,
  units,
}: TypingTargetProps) {
  const useUnits = scheme !== 'en' && !!units && units.length > 0
  // 汉字字号略小于拼音，保证同行并排时视觉重量接近
  const hanziFontSize = Math.max(14, Math.round(codeFontSize * 0.8))

  /** 每个 unit 的编码在整串中的起始下标（映射到 letterStates） */
  const offsets = useMemo(() => {
    if (!useUnits) return []
    const result: number[] = []
    let acc = 0
    for (const u of units as TargetUnit[]) {
      result.push(acc)
      acc += u.code.length
    }
    return result
  }, [useUnits, units])

  /** 当前正在输入的 unit 下标 */
  const currentUnitIndex = useMemo(() => {
    if (!useUnits) return -1
    const list = units as TargetUnit[]
    for (let i = 0; i < list.length; i++) {
      if (list[i].code.length === 0) continue
      if (cursor < offsets[i] + list[i].code.length) return i
    }
    // 已全部打完：指向最后一个有编码的 unit
    for (let i = list.length - 1; i >= 0; i--) {
      if (list[i].code.length > 0) return i
    }
    return 0
  }, [useUnits, units, offsets, cursor])

  const groups = useMemo(() => {
    if (!useUnits) return []
    return groupByWidth(units as TargetUnit[], charsPerLine > 0 ? charsPerLine : 0)
  }, [useUnits, units, charsPerLine])

  const currentGroup = useMemo(() => {
    if (!useUnits || groups.length === 0) return 0
    const idx = groups.findIndex((g) => currentUnitIndex >= g.start && currentUnitIndex < g.end)
    return idx < 0 ? groups.length - 1 : idx
  }, [useUnits, groups, currentUnitIndex])

  // 每组渲染 2 视觉行（拼音 + 汉字）
  const groupsPerWindow = Math.max(1, Math.floor(windowLines / 2))
  const windowStart = Math.max(0, Math.min(currentGroup - 1, Math.max(0, groups.length - groupsPerWindow)))
  const visibleGroups = groups.slice(windowStart, windowStart + groupsPerWindow)

  const letterClass = (ch: string, state: TargetLetterState) =>
    stateClassNameMap[(ch === EXPLICIT_SPACE) as unknown as string][state]

  const renderCodeCell = (cell: TargetCell) => {
    const { unit, index, active } = cell
    // 标点 / 空白：显示但不参与输入
    if (unit.code.length === 0) {
      return (
        <span
          key={`c-${index}`}
          className="inline-flex items-center justify-center font-mono text-gray-200 dark:text-gray-700"
          style={{ fontSize: codeFontSize * 0.75 }}
        >
          {unit.char === ' ' ? '\u00a0' : unit.char}
        </span>
      )
    }
    const base = offsets[index] ?? 0
    return (
      <span
        key={`c-${index}`}
        className={`inline-flex items-center justify-center rounded px-0.5 font-mono transition-colors ${
          active ? 'bg-indigo-50 dark:bg-indigo-900/40' : ''
        }`}
      >
        {unit.code.split('').map((ch, i) => {
          const absIndex = base + i
          const state = letterStates[absIndex] ?? 'normal'
          return (
            <span
              key={`${absIndex}-${ch}`}
              lang="en"
              className={`duration-0 ${letterClass(ch, state)}`}
              style={{ fontSize: codeFontSize }}
            >
              {ch}
            </span>
          )
        })}
      </span>
    )
  }

  const renderHanziCell = (cell: TargetCell) => {
    const { unit, index, done, active } = cell
    // 空格 / 换行：grid 列已占位，无需渲染字符
    if (unit.char === ' ' || unit.char === '\n') {
      return <span key={`h-${index}`} aria-hidden />
    }
    // 标点：显示但淡化
    if (unit.code.length === 0) {
      return (
        <span
          key={`h-${index}`}
          lang="zh"
          className="inline-flex items-center justify-center text-gray-300 dark:text-gray-600"
          style={{ fontSize: hanziFontSize * 0.9 }}
        >
          {unit.char}
        </span>
      )
    }
    return (
      <span
        key={`h-${index}`}
        lang="zh"
        className={`inline-flex items-center justify-center rounded transition-colors ${stateClassNameMap['false'][done ? 'correct' : 'normal']} ${
          active ? 'bg-indigo-50 dark:bg-indigo-900/40' : ''
        }`}
        style={{ fontSize: hanziFontSize }}
      >
        {unit.char}
      </span>
    )
  }

  // ── 旧渲染（英语素材 / 无 units 兜底） ──
  if (!useUnits) {
    const step = charsPerLine > 0 ? charsPerLine : 0
    const chars = displayWord.split('')
    const lineSize = step > 0 ? step : chars.length || 1
    const lines: { char: string; index: number }[][] = []
    for (let i = 0; i < chars.length; i += lineSize) {
      lines.push(chars.slice(i, i + lineSize).map((char, j) => ({ char, index: i + j })))
    }
    if (lines.length === 0) lines.push([])
    const currentLine = Math.min(lines.length - 1, Math.floor(cursor / lineSize))
    const lineStart = Math.max(0, Math.min(currentLine - 2, Math.max(0, lines.length - windowLines)))
    const visible = lines.slice(lineStart, lineStart + windowLines)

    return (
      <div className="flex flex-col items-center justify-center">
        <div
          className="flex max-w-[640px] flex-col items-center leading-[1.35]"
          style={{ letterSpacing: '0.08em' }}
          data-testid="typing-target-code"
        >
          {visible.map((lineChars, lineIdx) => {
            const absoluteLine = lineStart + lineIdx
            const faded = absoluteLine !== currentLine
            return (
              <div key={absoluteLine} className={`flex justify-center ${faded ? 'opacity-40' : ''}`}>
                {lineChars.map(({ char, index }) => {
                  const letterState = letterStates[index] ?? 'normal'
                  return (
                    <span
                      key={`${index}-${char}`}
                      lang="en"
                      className={`m-0 p-0 font-mono font-normal duration-0 ${letterClass(char, letterState)}`}
                      style={{ fontSize: codeFontSize }}
                    >
                      {char}
                    </span>
                  )
                })}
              </div>
            )
          })}
        </div>

        {scheme !== 'en' && isShowHanzi && hanzi && (
          <div lang="zh" className="mt-2 max-w-[640px] text-center text-lg leading-relaxed text-gray-400 dark:text-gray-50">
            {hanzi}
          </div>
        )}
      </div>
    )
  }

  // ── 新渲染：拼音行 / 汉字行交替，用 grid 固定列宽逐字对齐 ──
  const doneChars = cursor

  /**
   * 每列的像素宽度：等于该字编码字符数 × 单字符宽。
   * 拼音行与汉字行使用**同一份** grid-template-columns，故两行严格对齐；
   * 汉字在同一列内居中，天然落在其编码正下方。
   *
   * 0.6 是等宽字体（font-mono）在常见 FontSize 下的字符宽系数；
   * 列宽再叠加 0.35em 的呼吸间距，避免相邻字粘连。
   */
  const charWidth = codeFontSize * 0.6
  const MIN_COL = hanziFontSize + 2
  const COL_PADDING = Math.round(codeFontSize * 0.16)

  return (
    <div className="flex max-w-[760px] flex-col items-center justify-center leading-none" data-testid="typing-target-code">
      {visibleGroups.map((group, gi) => {
        const absoluteGroup = windowStart + gi
        const faded = absoluteGroup !== currentGroup

        const cells: TargetCell[] = group.units.map((unit, i) => {
          const index = group.start + i
          const start = offsets[index] ?? 0
          const end = start + unit.code.length
          return {
            unit,
            index,
            done: unit.code.length > 0 && doneChars >= end,
            active: index === currentUnitIndex,
          }
        })

        // 每列宽度：取「该字编码宽度」与「汉字最小宽度」的较大者，再加呼吸间距
        const colWidths = cells.map((cell) => {
          if (cell.unit.char === ' ') return Math.round(charWidth * 0.6)
          if (cell.unit.char === '\n') return 0
          if (cell.unit.code.length === 0) return Math.round(MIN_COL * 0.6)
          return Math.max(MIN_COL, Math.round(cell.unit.code.length * charWidth)) + COL_PADDING
        })
        const template = colWidths.map((w) => `${w}px`).join(' ')

        return (
          <div
            key={`g-${absoluteGroup}`}
            className={`flex flex-col items-center py-1 ${faded ? 'opacity-35' : ''}`}
            data-testid={`typing-target-group-${absoluteGroup}`}
            style={{ rowGap: 2 }}
          >
            {/* 拼音行 */}
            <div className="grid items-end justify-items-center" style={{ gridTemplateColumns: template }}>
              {cells.map(renderCodeCell)}
            </div>

            {/* 汉字行：同一份列模板 → 与拼音逐字对齐 */}
            {isShowHanzi && (
              <div
                className="grid items-start justify-items-center"
                style={{ gridTemplateColumns: template }}
                data-testid={`typing-target-hanzi-${absoluteGroup}`}
              >
                {cells.map(renderHanziCell)}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
