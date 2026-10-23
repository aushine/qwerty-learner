/**
 * UpstreamPanel —— 上屏轨练习区（打字测速）
 * （spec-20261017-v2 / 02 SPEED2-05 ~ SPEED2-09）
 *
 * 判定模型：
 * - 单位 = **字符**；对比源是目标文本（`notation`）；
 * - 一次上屏多字时**逐字全部校验**（基线 02 §3.5 B3：现有实现只校验末位字符）；
 * - 错误策略 = `markOnly`（SPEED2-06）：错字标红、游标继续前进，**不回滚不清空**；
 * - 换行与中文排版空格**自动跳过**，不要求用户输入（SPEED2-05-2）；
 * - 中文占位符与全角标点：全角正确、半角判错并归「标点格式」（SPEED2-05-1）。
 *
 * 指标口径（SPEED2-07）：
 * - 计时从**首个按键**开始（SPEED2-08），由页面层 TICK_TIMER 驱动；
 * - 字/分 = 正确字数 / 用时(分)，由页面层按 `onProgress` 上报的计数派生。
 */

import Progress from '@/pages/Typing/components/Progress'
import { TypingContext, TypingStateActionType } from '@/pages/Typing/store'
import { isIgnoreCaseAtom } from '@/store'
import useKeySounds from '@/hooks/useKeySounds'
import { useAtomValue } from 'jotai'
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import UpstreamInputHandler from '../UpstreamInputHandler'
import UpstreamTarget from '../UpstreamTarget'
import type { UpstreamCharState } from '../UpstreamTarget'

/** 中文标点集合（用于「全角/半角」归类，基线 02 §3.3） */
const CJK_PUNCT = /[，。、；：？！“”‘’（）《》【】—…]/

/** 可跳过的字符：换行、中文排版空格（不要求用户输入，SPEED2-05-2） */
const isSkippable = (ch: string) => ch === '\n' || ch === '\r'

export type UpstreamPanelProps = {
  /** 目标文本（notation） */
  text: string
  /** 是否英文素材（走 input 兜底路径） */
  isEnglish: boolean
  /** 提交进度：正确字数 / 已提交字数（供页面派生字/分） */
  onProgress?: (correct: number, submitted: number) => void
  /** 何时算完成（已到文本末尾） */
  onFinished?: () => void
  /** 首次按键（SPEED2-08：从这里开始计时） */
  onFirstKey?: () => void
  /** 标点格式错误回调（首次出现时提示一次） */
  onPunctError?: () => void
  /** 一命模式整章重开信号（spec-20261020-v1 / 02 REQ-205）：变化即重建面板内部状态 */
  restartNonce?: number
  /** 一命模式开启时本次提交出现错字的回调（页面层执行 REPEAT_CHAPTER；REQ-104：提交即既成事实） */
  onOneLifeViolation?: () => void
}

export default function UpstreamPanel({
  text,
  isEnglish,
  onProgress,
  onFinished,
  onFirstKey,
  onPunctError,
  restartNonce,
  onOneLifeViolation,
}: UpstreamPanelProps) {
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const { state, dispatch } = useContext(TypingContext)!
  const isIgnoreCase = useAtomValue(isIgnoreCaseAtom)
  const [playKeySound, playBeepSound, playHintSound] = useKeySounds()

  const [states, setStates] = useState<UpstreamCharState[]>([])
  const [cursor, setCursor] = useState(0)
  const [composing, setComposing] = useState('')
  const [hasStartedKey, setHasStartedKey] = useState(false)
  const punctWarnedRef = useRef(false)
  /** 完成判定去重（spec-20261020-v1 / 01 REQ-103）：仅首次到达末尾时触发 onFinished */
  const finishedRef = useRef(false)

  /** 逐字符状态（换题 / 一命整章重开时重建） */
  useEffect(() => {
    setStates(new Array(text.length).fill('normal') as UpstreamCharState[])
    setCursor(0)
    setComposing('')
    setHasStartedKey(false)
    punctWarnedRef.current = false
    finishedRef.current = false
  }, [text, restartNonce])

  /** 跳到下一个非跳过字符（换行 / 空行） */
  const skipAhead = useCallback(
    (from: number, target: string) => {
      let i = from
      while (i < target.length && isSkippable(target[i])) i++
      return i
    },
    [],
  )

  /**
   * SPEED2-05 文本 diff：一次上屏可能是多个字，必须**逐字全部校验**。
   * 返回新的状态数组与推进后的游标。
   */
  const applyCommit = useCallback(
    (raw: string) => {
      const target = text
      let cur = skipAhead(cursor, target)
      const next = [...states]
      let punctHit = false
      let wrongInCommit = false

      for (const ch of Array.from(raw)) {
        if (cur >= target.length) break // 长度溢出：多余部分丢弃（SPEED2-05 第 4 条）

        cur = skipAhead(cur, target)
        if (cur >= target.length) break

        const expected = target[cur]
        const equal = isEnglish
          ? expected === ch || (isIgnoreCase && expected.toLowerCase() === ch.toLowerCase())
          : expected === ch

        if (equal) {
          next[cur] = 'correct'
          playKeySound()
        } else {
          next[cur] = 'wrong'
          wrongInCommit = true
          // SPEED2-05-1：全角/半角标点不匹配 → 归「标点格式」，单独提示一次
          if (CJK_PUNCT.test(expected) || CJK_PUNCT.test(ch)) punctHit = true
          playBeepSound()
        }
        cur += 1
      }

      const nextCursor = skipAhead(cur, target)
      setStates(next)
      setCursor(nextCursor)

      if (punctHit && !punctWarnedRef.current) {
        punctWarnedRef.current = true
        onPunctError?.()
      }

      const correctCount = next.filter((s) => s === 'correct').length
      const submitted = next.filter((s) => s === 'correct' || s === 'wrong').length
      onProgress?.(correctCount, submitted)
      dispatch({ type: TypingStateActionType.REPORT_CORRECT_WORD })

      // 一命模式（spec-20261020-v1 / 02 REQ-202/204 + REQ-104）：本次提交出现错字即整章重开；
      // 提交是既成事实（退格不可撤销），不进入完成判定。
      if (wrongInCommit && onOneLifeViolation) {
        onOneLifeViolation()
        return
      }

      if (nextCursor >= target.length && !finishedRef.current) {
        finishedRef.current = true
        playHintSound()
        onFinished?.()
      }
    },
    [
      cursor,
      states,
      text,
      isEnglish,
      isIgnoreCase,
      skipAhead,
      playKeySound,
      playBeepSound,
      playHintSound,
      onProgress,
      onPunctError,
      onFinished,
      onOneLifeViolation,
      dispatch,
    ],
  )

  /**
   * 退格（spec-20261020-v1 / 01 REQ-102）：删除最近一个**已提交**字符——
   * 状态 correct/wrong 回退 normal（横线重现）、游标左移、计数同步回退并重新上报；
   * 可一路退到题首，题首再退为无操作。一次上屏多字时每次只退 1 个字符。
   */
  const applyBackspace = useCallback(() => {
    let i = cursor - 1
    while (i >= 0 && (states[i] === 'normal' || states[i] === 'skipped')) i--
    if (i < 0) return

    const next = [...states]
    next[i] = 'normal'
    setStates(next)
    setCursor(i)

    const correctCount = next.filter((s) => s === 'correct').length
    const submitted = next.filter((s) => s === 'correct' || s === 'wrong').length
    onProgress?.(correctCount, submitted)
  }, [cursor, states, onProgress])

  const handleFirstKey = useCallback(() => {
    if (hasStartedKey) return
    setHasStartedKey(true)
    onFirstKey?.()
  }, [hasStartedKey, onFirstKey])

  const fontSize = useMemo(() => (isEnglish ? 22 : text.length > 200 ? 22 : text.length > 80 ? 24 : 28), [isEnglish, text.length])

  return (
    <div className="container flex h-full w-full flex-col items-center justify-center">
      <div className="container flex h-3 w-full shrink-0 grow-0 px-12 pt-2" />

      <div className="container flex flex-grow flex-col items-center justify-center">
        <div className="relative flex w-full items-center justify-center">
          {!state.isTyping && (
            <div className="absolute flex h-full w-full justify-center">
              <div
                className="z-10 flex w-full cursor-pointer items-center backdrop-blur-sm"
                role="button"
                tabIndex={-1}
                aria-label={state.timerData.time ? '继续练习' : '开始练习'}
                onClick={() => dispatch({ type: TypingStateActionType.SET_IS_TYPING, payload: true })}
              >
                <p className="w-full select-none text-center text-xl text-gray-600 dark:text-gray-50">
                  按任意键{state.timerData.time ? '继续' : '开始'}
                </p>
              </div>
            </div>
          )}
          <div className="relative flex w-full flex-col items-center">
            <UpstreamInputHandler
              isEnglish={isEnglish}
              onCommit={applyCommit}
              onCompositionUpdate={setComposing}
              onFirstKey={handleFirstKey}
              onBackspace={applyBackspace}
            />
            <UpstreamTarget
              text={text}
              states={states}
              cursor={cursor}
              composing={composing}
              fontSize={fontSize}
              isEnglish={isEnglish}
              windowGroups={5}
            />
          </div>
        </div>
      </div>
      <Progress className={`mb-3 mt-auto ${state.isTyping ? 'opacity-100' : 'opacity-0'}`} />
    </div>
  )
}
