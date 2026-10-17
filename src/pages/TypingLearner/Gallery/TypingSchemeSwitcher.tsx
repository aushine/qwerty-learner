/**
 * TypingSchemeSwitcher —— 输入方式选择（全拼 / 双拼二级）（spec-20261017-v1 / 03 §4）
 *
 * GAL-06：「双拼」既是按钮（点击 = 选中上次用过的双拼方案）又是触发区（hover 展开二级）。
 * GAL-07：置灰项必须可见但不可选中（含 URL 注入，由 atom 校验兜底）。
 * GAL-08：typingSchemeAtom 被外部写入非法值时页面回落 flypy（由 atom 层保证）。
 *
 * 视觉：一级按钮复用 DictTagSwitcher 胶囊样式；二级容器复用 listbox-options。
 */

import type { TypingSchemeId, TypingSchemeIdAll } from '@/typings/typing'
import { TYPING_SCHEME_OPTIONS } from '@/resources/typingMaterials'
import { autoUpdate, flip, offset, shift, useClick, useFloating, useHover, useInteractions } from '@floating-ui/react'
import classNames from 'classnames'
import { useCallback, useEffect, useRef, useState } from 'react'
import IconCheck from '~icons/tabler/check'
import IconChevronDown from '~icons/tabler/chevron-down'

const PILL_BASE = 'whitespace-nowrap rounded-[3rem] px-4 py-2'
const PILL_ON = 'bg-indigo-400 text-white'
const PILL_OFF = 'bg-white text-gray-600 dark:bg-gray-800 dark:text-gray-200 hover:bg-indigo-100 dark:hover:bg-gray-600'

export default function TypingSchemeSwitcher({
  scheme,
  onChange,
}: {
  scheme: TypingSchemeId
  onChange: (scheme: TypingSchemeId) => void
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [focusIndex, setFocusIndex] = useState(0)
  const listRef = useRef<HTMLDivElement | null>(null)

  const { refs, context, x, y } = useFloating({
    open: isOpen,
    onOpenChange: setIsOpen,
    whileElementsMounted: autoUpdate,
    middleware: [offset(6), flip(), shift()],
    placement: 'bottom-start',
  })
  const hover = useHover(context, { delay: { open: 80, close: 200 } })
  const click = useClick(context)
  const { getReferenceProps, getFloatingProps } = useInteractions([hover, click])
  const floatingProps = getFloatingProps()

  // 打开时聚焦当前方案项
  useEffect(() => {
    if (!isOpen) return
    const index = Math.max(0, TYPING_SCHEME_OPTIONS.findIndex((o) => o.id === scheme))
    setFocusIndex(index)
    const timer = window.setTimeout(() => {
      listRef.current?.querySelectorAll<HTMLButtonElement>('[role="option"]')[index]?.focus()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [isOpen, scheme])

  const onSelect = useCallback(
    (id: TypingSchemeIdAll) => {
      const option = TYPING_SCHEME_OPTIONS.find((o) => o.id === id)
      // GAL-07/08：置灰项不得选中（含键盘/URL 注入路径）
      if (!option || !option.available || id !== 'flypy') return
      onChange(id)
      setIsOpen(false)
    },
    [onChange],
  )

  const onListKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    const items = TYPING_SCHEME_OPTIONS
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      const dir = e.key === 'ArrowDown' ? 1 : -1
      const next = (focusIndex + dir + items.length) % items.length
      setFocusIndex(next)
      listRef.current?.querySelectorAll<HTMLButtonElement>('[role="option"]')[next]?.focus()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setIsOpen(false)
    }
  }, [focusIndex])

  return (
    <div className="flex items-center space-x-2 pt-6">
      {/* 全拼：无二级 */}
      <button
        type="button"
        className={classNames(PILL_BASE, scheme === 'quanpin' ? PILL_ON : PILL_OFF)}
        onClick={() => onChange('quanpin')}
        aria-pressed={scheme === 'quanpin'}
      >
        全拼
      </button>

      {/* 双拼：按钮 + hover 二级（GAL-06） */}
      <div ref={refs.setReference} {...getReferenceProps()}>
        <button
          type="button"
          className={classNames(PILL_BASE, 'flex items-center', scheme === 'flypy' ? PILL_ON : PILL_OFF)}
          onClick={() => onChange('flypy')}
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          aria-pressed={scheme === 'flypy'}
        >
          双拼
          <IconChevronDown className={`ml-1 h-4 w-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {isOpen && (
        <div
          ref={(node) => {
            refs.setFloating(node)
            listRef.current = node
          }}
          {...floatingProps}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            transform: `translate(${Math.round(x ?? 0)}px, ${Math.round(y ?? 0)}px)`,
            ...((floatingProps.style as React.CSSProperties) || {}),
          }}
          role="listbox"
          aria-label="双拼方案"
          className="listbox-options z-30 w-56"
          onKeyDown={onListKeyDown}
        >
          {TYPING_SCHEME_OPTIONS.map((option, index) => {
            const selected = option.id === scheme
            return (
              <button
                key={option.id}
                role="option"
                aria-selected={selected}
                aria-disabled={!option.available}
                tabIndex={focusIndex === index ? 0 : -1}
                className={classNames(
                  'group flex w-full cursor-pointer items-center justify-between px-3 py-2 text-left',
                  option.available ? 'hover:bg-indigo-100 dark:hover:bg-gray-600' : 'cursor-not-allowed opacity-40',
                )}
                onClick={() => onSelect(option.id)}
                onMouseEnter={() => setFocusIndex(index)}
                title={option.available ? undefined : '第一版暂只支持小鹤双拼'}
              >
                <span className="flex items-center">
                  {selected && option.available ? (
                    <span className="listbox-options-icon">
                      <IconCheck className="focus:outline-none" />
                    </span>
                  ) : null}
                  <span className="text-gray-700 dark:text-gray-200">{option.name}</span>
                </span>
                {option.available ? (
                  <span className="text-xs text-gray-400">{option.id}</span>
                ) : (
                  <span className="text-xs text-gray-400">敬请期待</span>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
