/**
 * TypingInputHandler —— 打字模式输入捕获（spec-20261017-v1 / 05 DATA-15、02 §5.2）
 *
 * 双轨分发（DATA-15）：
 * - 中文（quanpin / flypy）：**对码轨**——`<input type="password">` 强制关 IME +
 *   window keydown 取 `e.code`，仅接受 KeyA~KeyZ；其余键忽略且不报错。
 * - 英语（en）：复用现有 `KeyEventHandler`（e.key + isLegal，空格可用）。
 *
 * 🔴 IME 误入（`e.key === 'Process'` / `compositionstart`）→ 非阻塞提示，禁止 alert（02 §5.2）。
 * 现有 `InputHandler` 一行不改（DATA-15-1）。
 */

import type { WordUpdateAction } from '@/pages/Typing/components/WordPanel/components/InputHandler'
import KeyEventHandler from '@/pages/Typing/components/WordPanel/components/KeyEventHandler'
import { TypingContext } from '@/pages/Typing/store'
import { useCallback, useContext, useEffect, useRef, useState } from 'react'

/** 显式的 物理键 code → 字符 表（KB-19 同款纪律：仅 KeyA~KeyZ） */
const CODE_TO_CHAR: Record<string, string> = {
  KeyA: 'a', KeyB: 'b', KeyC: 'c', KeyD: 'd', KeyE: 'e', KeyF: 'f', KeyG: 'g', KeyH: 'h', KeyI: 'i', KeyJ: 'j',
  KeyK: 'k', KeyL: 'l', KeyM: 'm', KeyN: 'n', KeyO: 'o', KeyP: 'p', KeyQ: 'q', KeyR: 'r', KeyS: 's', KeyT: 't',
  KeyU: 'u', KeyV: 'v', KeyW: 'w', KeyX: 'x', KeyY: 'y', KeyZ: 'z',
}

export type TypingInputHandlerScheme = 'quanpin' | 'flypy' | 'en'

export default function TypingInputHandler({
  scheme,
  onChar,
}: {
  scheme: TypingInputHandlerScheme
  /** 捕获到一个字符（对码轨恒为 a~z；英语轨为 e.key 原值） */
  onChar: (char: string) => void
}) {
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const { state } = useContext(TypingContext)!
  const [imeHintVisible, setImeHintVisible] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const isCodeTrack = scheme !== 'en'

  // 焦点管理：isTyping 时 focus，换题后重新夺回（同 TextAreaHandler 的管理模式）
  useEffect(() => {
    if (!isCodeTrack) return
    if (state.isTyping) {
      inputRef.current?.focus()
    }
  }, [isCodeTrack, state.isTyping, state.chapterData.index])

  // IME 提示 3 秒自动消失（非阻塞）
  useEffect(() => {
    if (!imeHintVisible) return
    const timer = window.setTimeout(() => setImeHintVisible(false), 3000)
    return () => window.clearTimeout(timer)
  }, [imeHintVisible])

  const onKeydown = useCallback(
    (e: KeyboardEvent) => {
      // IME 误入：非阻塞提示（02 §5.2）
      if (e.key === 'Process' || e.isComposing) {
        e.preventDefault()
        setImeHintVisible(true)
        return
      }
      const char = CODE_TO_CHAR[e.code]
      // 仅 KeyA~KeyZ；其余键忽略且不报错（小鹤不使用分号键）
      if (!char) return
      if (e.altKey || e.ctrlKey || e.metaKey) return
      e.preventDefault()
      onChar(char)
    },
    [onChar],
  )

  useEffect(() => {
    if (!isCodeTrack) return
    if (!state.isTyping) return
    window.addEventListener('keydown', onKeydown, { capture: true })
    return () => window.removeEventListener('keydown', onKeydown, { capture: true })
  }, [isCodeTrack, onKeydown, state.isTyping])

  if (!isCodeTrack) {
    // 英语轨：复用现有 handler（e.key + isLegal，空格可用；DATA-15）
    // 空格 preventDefault 与学习模式 InputHandler 的 'add' 分支一致（防止页面滚动）
    const updateInput = (action: WordUpdateAction) => {
      if (action.type === 'add') {
        if (action.value === ' ') action.event.preventDefault()
        onChar(action.value)
      }
    }
    return <KeyEventHandler updateInput={updateInput} />
  }

  return (
    <>
      {/* 对码轨：password 强制关闭系统 IME；隐藏但可聚焦 */}
      <input
        ref={inputRef}
        type="password"
        autoComplete="new-password"
        className="pointer-events-none absolute h-0 w-0 opacity-0"
        tabIndex={-1}
        aria-hidden="true"
        onChange={() => undefined}
        onCompositionStart={() => setImeHintVisible(true)}
        onBlur={() => {
          if (state.isTyping) inputRef.current?.focus()
        }}
      />
      {imeHintVisible && (
        <div className="fixed bottom-24 left-1/2 z-40 -translate-x-1/2" role="status">
          <div className="my-card flex items-center rounded-lg bg-white px-4 py-2 text-sm text-gray-600 shadow-md dark:bg-gray-800 dark:text-gray-200">
            检测到输入法，请切换到英文输入法
            <button
              type="button"
              className="ml-3 text-indigo-500 hover:text-indigo-400 focus:outline-none"
              onClick={() => setImeHintVisible(false)}
            >
              知道了
            </button>
          </div>
        </div>
      )}
    </>
  )
}
