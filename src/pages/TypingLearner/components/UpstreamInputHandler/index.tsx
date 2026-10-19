/**
 * UpstreamInputHandler —— 上屏轨输入捕获（spec-20261017-v2 / 02 SPEED2-03 ~ SPEED2-04）
 *
 * 打字测速的核心：**不管用户用什么输入法，只看最终上屏的字**。
 *
 * 🔴 硬约束（基线 02 §3.1 / §3.5 B1~B2）：
 * - 直接监听 `compositionend` 取 `e.data` 作为**唯一可信数据源**；
 * - **不得**在 `input` 事件里用 `isComposing` 做判定（Chrome 会补发 isComposing:false 的 input，
 *   Safari 的 compositionend 又在最后一个 input 之后）；
 * - `compositionstart` 不 alert、不 return（与现有 TextAreaHandler 相反）。
 *
 * 英文轨（SPEED2-10-1）：英文通常不触发 composition，靠 `input` 事件兜底取增量；
 * 两条路径用同一个「已提交长度」游标去重，避免重复追加。
 */

import { useCallback, useContext, useEffect, useRef, useState } from 'react'
import { TypingContext } from '@/pages/Typing/store'

export type UpstreamInputHandlerProps = {
  /** 本次上屏的完整文本（已去重、已过滤换行） */
  onCommit: (text: string) => void
  /** 候选回显（当前输入法正在拼但还没上屏的内容），用于题面对照 */
  onCompositionUpdate?: (text: string) => void
  /** 首次按键（用于 SPEED2-08：从第一个键开始计时） */
  onFirstKey?: () => void
  /** 是否处于英文素材（英文走 input 兜底路径） */
  isEnglish?: boolean
  /** 外部暂停（模式切换确认条等）时不接收输入 */
  disabled?: boolean
}

export default function UpstreamInputHandler({
  onCommit,
  onCompositionUpdate,
  onFirstKey,
  isEnglish = false,
  disabled = false,
}: UpstreamInputHandlerProps) {
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const { state } = useContext(TypingContext)!
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const composingRef = useRef(false)
  /** 已从 textarea.value 取走的长度（用于 input 兜底路径去重） */
  const consumedRef = useRef(0)
  const [imeHintVisible, setImeHintVisible] = useState(false)

  // 焦点管理：练习中保持聚焦，失焦自动夺回（同 TextAreaHandler 的模式）
  useEffect(() => {
    if (state.isTyping && !disabled) inputRef.current?.focus()
  }, [state.isTyping, state.chapterData.index, disabled])

  // 换题时重置游标
  useEffect(() => {
    consumedRef.current = 0
    if (inputRef.current) inputRef.current.value = ''
  }, [state.chapterData.index])

  // 输入法处于英文态的提示 3 秒后消失（SPEED2-04 非阻塞）
  const showLatinHint = useCallback(() => {
    setImeHintVisible(true)
    window.setTimeout(() => setImeHintVisible(false), 3000)
  }, [])

  const commitText = useCallback(
    (raw: string, isComposition: boolean) => {
      if (!raw) return
      // SPEED2-04：目标为中文但上屏是纯拉丁字符 → 用户处于英文态，不判错、不提交
      if (!isEnglish && isComposition === false && /^[\x20-\x7e]*$/.test(raw) && /[a-zA-Z]/.test(raw)) {
        showLatinHint()
        return
      }
      onCommit(raw)
    },
    [isEnglish, onCommit, showLatinHint],
  )

  const onCompositionStart = useCallback(() => {
    composingRef.current = true
  }, [])

  const onCompositionUpdateCb = useCallback(
    (e: React.CompositionEvent<HTMLTextAreaElement>) => {
      // 仅回显，不校验（基线 02 §3.1）
      onCompositionUpdate?.(e.data ?? '')
    },
    [onCompositionUpdate],
  )

  const onCompositionEnd = useCallback(
    (e: React.CompositionEvent<HTMLTextAreaElement>) => {
      composingRef.current = false
      const data = e.data ?? ''
      // 清空 textarea，避免下次 input 事件把旧内容当成增量
      if (inputRef.current) inputRef.current.value = ''
      consumedRef.current = 0
      onCompositionUpdate?.('')
      commitText(data, true)
    },
    [commitText, onCompositionUpdate],
  )

  const onInput = useCallback(
    (e: React.FormEvent<HTMLTextAreaElement>) => {
      // 组合期内的 input 不处理（等 compositionend），这是浏览器差异的兜底而非主路径
      if (composingRef.current) return
      const value = e.currentTarget.value
      const delta = value.slice(consumedRef.current)
      consumedRef.current = value.length
      if (!delta) return
      commitText(delta, false)
      // 英文轨：提交后清空，保持游标语义一致
      if (inputRef.current) {
        inputRef.current.value = ''
        consumedRef.current = 0
      }
    },
    [commitText],
  )

  const onKeyDown = useCallback(() => {
    // SPEED2-08：计时从第一个按键开始（不是第一次上屏）
    onFirstKey?.()
  }, [onFirstKey])

  return (
    <>
      <textarea
        ref={inputRef}
        // 普通 textarea（SPEED2-04-1：不得用 contenteditable）
        className="pointer-events-none absolute h-0 w-0 resize-none opacity-0"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        aria-label="打字测速输入"
        onCompositionStart={onCompositionStart}
        onCompositionUpdate={onCompositionUpdateCb}
        onCompositionEnd={onCompositionEnd}
        onInput={onInput}
        onKeyDown={onKeyDown}
        onBlur={() => {
          if (state.isTyping && !disabled) inputRef.current?.focus()
        }}
        onChange={() => undefined}
      />
      {imeHintVisible && (
        <div className="fixed bottom-24 left-1/2 z-40 -translate-x-1/2" role="status">
          <div className="my-card flex items-center rounded-lg bg-white px-4 py-2 text-sm text-gray-600 shadow-md dark:bg-gray-800 dark:text-gray-200">
            检测到英文输入，请切换到中文输入法
          </div>
        </div>
      )}
    </>
  )
}
