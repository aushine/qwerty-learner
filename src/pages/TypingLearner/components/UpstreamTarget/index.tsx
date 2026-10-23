/**
 * UpstreamTarget —— 上屏轨题面（spec-20261017-v2 / 02 SPEED2-09 + spec-20261020-v1 / 01 REQ-101 对照模式改版）
 *
 * 对照模式（本批次）题面结构：每个可视行渲染为**上下两行**——
 * - **原文行**：目标文本原字符（正常色）；游标位加浅色游标底（沿用现行色板）；
 * - **对照行**：与原文行**逐列同宽对齐**的输入行：
 *   - 未输入位：一条横线（border-b；可跳过位 / 英文空格位用更弱的灰）；
 *   - 已输入且正确位：字符绿色（与现行 correct 色一致），横线消失；
 *   - 已输入且错误位：字符红色，横线消失；
 *   - 游标位：横线高亮（indigo）。
 *
 * 逐列对齐方案：两行渲染**同一字符序列**、同字体同字号；对照行未输入位把真实字符
 * 以 `text-transparent` 隐形占位（宽度与原文行完全一致），横线由 border-b 提供。
 *
 * 窗口（REQ-101）：双行算一组，可视窗口约 5 组，当前组高亮、其余组淡化，单屏不滚动（LAY-06）。
 *
 * 颜色与 Letter.tsx 的三态色板同值（LAY-04 纪律：不得另造颜色）。
 */

import { useMemo } from 'react'

export type UpstreamCharState = 'normal' | 'correct' | 'wrong' | 'skipped'

export type UpstreamTargetProps = {
  /** 目标文本（含换行；换行会被渲染成段落分隔） */
  text: string
  /** 与 text 逐字符对应的状态数组 */
  states: UpstreamCharState[]
  /** 当前游标（下一个待判定字符的下标） */
  cursor: number
  /** 输入法候选回显 */
  composing?: string
  /** 字号（中文按字数、英文按词长由父层决定） */
  fontSize?: number
  /** 是否英文素材（英文用 space 断行 + 等宽字体） */
  isEnglish?: boolean
  /** 可视窗口（组数，一组 = 原文行 + 对照行） */
  windowGroups?: number
}

const CLASS: Record<UpstreamCharState, string> = {
  normal: 'text-gray-600 dark:text-gray-50',
  correct: 'text-green-600 dark:text-green-400',
  wrong: 'text-red-600 dark:text-red-400',
  skipped: 'text-gray-300 dark:text-gray-600',
}

/** 可跳过字符（换行 / 中文排版空格）：对照行横线弱化，与待输入位区分 */
const isSkippable = (ch: string): boolean => ch === '\n' || ch === ' ' || ch === '\r' || ch === '\t'

/** 字数上限：每题最多渲染的可见字符（保证单屏，LAY-06） */
const MAX_VISIBLE_CHARS = 460

export default function UpstreamTarget({
  text,
  states,
  cursor,
  composing,
  fontSize = 26,
  isEnglish = false,
  windowGroups = 5,
}: UpstreamTargetProps) {
  /** 按换行切段，段落内再按可视宽度切行（断行点即「组」的切分点，一组双行共用） */
  const lines = useMemo(() => {
    const result: { chars: { ch: string; index: number }[] }[] = []
    let current: { ch: string; index: number }[] = []
    // 每个字的估算宽度（中文按 em，英文按 0.6em）
    const unitWidth = isEnglish ? 0.6 : 1
    const maxUnits = isEnglish ? 34 / (unitWidth * 1) : 26

    for (let i = 0; i < text.length; i++) {
      const ch = text[i]
      if (ch === '\n') {
        if (current.length > 0) result.push({ chars: current })
        current = []
        continue
      }
      current.push({ ch, index: i })
      if (current.length >= maxUnits) {
        // 英文尽量在空格处断行，避免切开单词
        if (isEnglish) {
          const lastSpace = current.map((c) => c.ch).lastIndexOf(' ')
          if (lastSpace > 0 && lastSpace < current.length - 1) {
            const head = current.slice(0, lastSpace + 1)
            const tail = current.slice(lastSpace + 1)
            result.push({ chars: head })
            current = tail
            continue
          }
        }
        result.push({ chars: current })
        current = []
      }
    }
    if (current.length > 0) result.push({ chars: current })
    return result
  }, [text, isEnglish])

  /** 当前游标所在组 → 窗口基准（REQ-101：由「游标所在行」改为「游标所在组」） */
  const currentLine = useMemo(() => {
    let acc = 0
    for (let i = 0; i < lines.length; i++) {
      if (cursor < acc + lines[i].chars.length) return i
      acc += lines[i].chars.length
    }
    return Math.max(0, lines.length - 1)
  }, [lines, cursor])

  const windowStart = Math.max(0, Math.min(currentLine - 1, Math.max(0, lines.length - windowGroups)))
  const visible = lines.slice(windowStart, windowStart + windowGroups)

  return (
    <div className="flex w-full flex-col items-center justify-center" data-testid="upstream-target">
      <div
        className="flex max-w-[820px] flex-col gap-2"
        style={{ fontSize, lineHeight: 1.45 }}
      >
        {visible.map((line, li) => {
          const absoluteLine = windowStart + li
          const faded = absoluteLine !== currentLine
          return (
            <div key={absoluteLine} lang={isEnglish ? 'en' : 'zh'} className={`flex flex-col ${faded ? 'opacity-40' : ''}`}>
              {/* 原文行：正常色 + 游标位浅色游标底 */}
              <div className={`flex flex-wrap justify-center ${isEnglish ? 'font-mono' : ''}`}>
                {line.chars.slice(0, MAX_VISIBLE_CHARS).map(({ ch, index }) => {
                  const state = states[index] ?? 'normal'
                  const isCursor = index === cursor
                  return (
                    <span
                      key={index}
                      className={`whitespace-pre duration-0 ${CLASS[state]} ${
                        isCursor ? 'rounded-sm bg-indigo-50 dark:bg-indigo-900/40' : ''
                      }`}
                    >
                      {ch}
                    </span>
                  )
                })}
              </div>
              {/* 对照行：未输入横线 / 正确绿 / 错误红 / 游标横线高亮；未输入位以透明真实字符占位保证逐列同宽 */}
              <div className={`flex flex-wrap justify-center ${isEnglish ? 'font-mono' : ''}`}>
                {line.chars.slice(0, MAX_VISIBLE_CHARS).map(({ ch, index }) => {
                  const state = states[index] ?? 'normal'
                  const isCursor = index === cursor
                  const skippable = isSkippable(ch)
                  const underline = isCursor
                    ? 'border-b-2 border-indigo-400 dark:border-indigo-300'
                    : state === 'normal'
                      ? skippable
                        ? 'border-b border-gray-300 dark:border-gray-600'
                        : 'border-b border-gray-400 dark:border-gray-500'
                      : 'border-b border-transparent'
                  const color =
                    state === 'correct'
                      ? 'text-green-600 dark:text-green-400'
                      : state === 'wrong'
                        ? 'text-red-600 dark:text-red-400'
                        : 'text-transparent'
                  return (
                    <span key={index} className={`whitespace-pre ${underline} ${color}`}>
                      {ch}
                    </span>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {/* 候选回显：仅展示输入法正在拼的内容（SPEED2-09），不校验 */}
      <div className="mt-3 h-6 font-mono text-sm text-gray-400 dark:text-gray-500" aria-hidden>
        {composing}
      </div>
    </div>
  )
}
