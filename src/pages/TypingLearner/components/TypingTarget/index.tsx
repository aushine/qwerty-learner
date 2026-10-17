/**
 * TypingTarget —— 打字模式题面（展示组件，spec-20261017-v1 / 02 LAY-03 ~ LAY-07）
 *
 * 纯展示：判定与状态在 TypingPanel（与键盘点击共用同一输入入口）。
 * 颜色纪律（LAY-04）：三态色板与 `Letter.tsx` 的 `stateClassNameMap` 逐值一致
 * （该 map 未导出且 Letter.tsx 不在本批次改动白名单内，故在此按同值复制并注释溯源）。
 */

import { EXPLICIT_SPACE } from '@/constants'
import { useMemo } from 'react'

export type TypingTargetScheme = 'quanpin' | 'flypy' | 'en'
export type TargetLetterState = 'normal' | 'correct' | 'wrong'

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
  /** 行窗口上限（LAY-05：文章 6 行；长素材按 h-screen 预算收紧，见 TypingPanel.layoutFor） */
  windowLines?: number
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
}: TypingTargetProps) {
  const step = charsPerLine > 0 ? charsPerLine : 0

  // LAY-05：按行切分（带绝对索引）+ 最多 6 行窗口（不滚动，分段推进）
  const lines = useMemo(() => {
    const chars = displayWord.split('')
    const lineSize = step > 0 ? step : chars.length || 1
    const result: { char: string; index: number }[][] = []
    for (let i = 0; i < chars.length; i += lineSize) {
      result.push(chars.slice(i, i + lineSize).map((char, j) => ({ char, index: i + j })))
    }
    return result.length > 0 ? result : [[]]
  }, [displayWord, step])

  const currentLine = Math.min(
    lines.length - 1,
    Math.floor(cursor / (step > 0 ? step : displayWord.length || 1)),
  )
  const windowStart = Math.max(0, Math.min(currentLine - 2, Math.max(0, lines.length - windowLines)))
  const visibleLines = lines.slice(windowStart, windowStart + windowLines)

  const renderLetter = (ch: string, index: number) => {
    const letterState = letterStates[index] ?? 'normal'
    return (
      <span
        key={`${index}-${ch}`}
        lang="en"
        className={`m-0 p-0 font-mono font-normal duration-0 ${
          stateClassNameMap[(ch === EXPLICIT_SPACE) as unknown as string][letterState]
        }`}
        style={{ fontSize: codeFontSize }}
      >
        {ch}
      </span>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center">
      {/* 目标编码（LAY-03：font-mono 40px tracking；文章降为 28px） */}
      <div className="flex max-w-[640px] flex-col items-center leading-[1.35]" style={{ letterSpacing: '0.08em' }} data-testid="typing-target-code">
        {visibleLines.map((lineChars, lineIdx) => {
          const absoluteLine = windowStart + lineIdx
          const faded = absoluteLine !== currentLine
          return (
            <div key={absoluteLine} className={`flex justify-center ${faded ? 'opacity-40' : ''}`}>
              {lineChars.map(({ char, index }) => renderLetter(char, index))}
            </div>
          )
        })}
      </div>

      {/* 汉字原文行（KEEP-13：复用 Notation 的位置；英语素材不显示） */}
      {scheme !== 'en' && isShowHanzi && hanzi && (
        <div lang="zh" className="mt-2 max-w-[640px] text-center text-lg leading-relaxed text-gray-400 dark:text-gray-50">
          {hanzi}
        </div>
      )}
    </div>
  )
}
