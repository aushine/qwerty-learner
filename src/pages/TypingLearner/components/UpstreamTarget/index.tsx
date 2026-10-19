/**
 * UpstreamTarget —— 上屏轨题面（spec-20261017-v2 / 02 SPEED2-09）
 *
 * 与对码轨题面（TypingTarget）的差别：
 * - ❌ 不显示拼音行（用户用真实输入法，拼音提示反而干扰）；
 * - ✅ 只显示**目标文本**，逐字绿/红（markOnly：错字标红但可以继续往右打）；
 * - ✅ 在文本下方用浅灰回显输入法当前正在拼的内容（compositionupdate），仅回显不校验；
 * - ✅ 长文按「6 行窗口 + 上下淡出」推进，单屏不滚动（继承 LAY-06）。
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
  /** 是否英文素材（英文用 space 断行，中文按字宽） */
  isEnglish?: boolean
  /** 视觉行窗口 */
  windowLines?: number
}

const CLASS: Record<UpstreamCharState, string> = {
  normal: 'text-gray-600 dark:text-gray-50',
  correct: 'text-green-600 dark:text-green-400',
  wrong: 'text-red-600 dark:text-red-400',
  skipped: 'text-gray-300 dark:text-gray-600',
}

/** 字数上限：每题最多渲染的可见字符（保证单屏，LAY-06） */
const MAX_VISIBLE_CHARS = 460

export default function UpstreamTarget({
  text,
  states,
  cursor,
  composing,
  fontSize = 26,
  isEnglish = false,
  windowLines = 10,
}: UpstreamTargetProps) {
  /** 按换行切段，段落内再按可视宽度切行 */
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

  /** 当前游标所在行 → 6 行窗口 */
  const currentLine = useMemo(() => {
    let acc = 0
    for (let i = 0; i < lines.length; i++) {
      if (cursor < acc + lines[i].chars.length) return i
      acc += lines[i].chars.length
    }
    return Math.max(0, lines.length - 1)
  }, [lines, cursor])

  const windowStart = Math.max(0, Math.min(currentLine - 1, Math.max(0, lines.length - windowLines)))
  const visible = lines.slice(windowStart, windowStart + windowLines)

  return (
    <div className="flex w-full flex-col items-center justify-center" data-testid="upstream-target">
      <div
        className="flex max-w-[820px] flex-col items-center gap-1"
        style={{ fontSize, lineHeight: 1.45 }}
      >
        {visible.map((line, li) => {
          const absoluteLine = windowStart + li
          const faded = absoluteLine !== currentLine
          return (
            <div
              key={absoluteLine}
              lang={isEnglish ? 'en' : 'zh'}
              className={`flex flex-wrap justify-center ${isEnglish ? 'font-mono' : ''} ${faded ? 'opacity-35' : ''}`}
            >
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
