/**
 * 模式切换入口（ModeSwitcher）—— spec-20261017-v1 / 01 §3
 *
 * 位置：标题文字正下方居中（ENTRY-01），绝对定位由页头 py-6 内边距吸收，
 * 不增加页头高度（ENTRY-03 / ACC-01-09）。
 * 交互：useFloating + useHover（delay 80/200、offset 5、flip + shift），
 * 与 StartButton 的 Restart 浮层同范式（ENTRY-05）。
 * 🔴 ENTRY-06：箭头点击只切换面板开合，不跳转官网（preventDefault + stopPropagation）。
 */

import { appModeAtom, pendingModeSwitchAtom, typingPausedBySwitcherAtom, typingPracticeActiveAtom } from '@/store/typingMode'
import type { AppMode } from '@/typings/typing'
import { autoUpdate, flip, offset, shift, useFloating, useHover, useInteractions } from '@floating-ui/react'
import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Transition } from '@headlessui/react'
import { Fragment } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import IconChevronDown from '~icons/tabler/chevron-down'

const MODES: { id: AppMode; name: string; sub: string }[] = [
  { id: 'learn', name: '学习模式', sub: 'Qwerty Learner' },
  { id: 'typing', name: '打字模式', sub: 'Typing Learner' },
]

export default function ModeSwitcher() {
  const location = useLocation()
  const navigate = useNavigate()
  // MODE-04：当前模式基于路由判断（而非仅 atom），保证前进/后退不错位
  const currentMode: AppMode = location.pathname.startsWith('/typing') ? 'typing' : 'learn'

  const setAppMode = useSetAtom(appModeAtom)
  const isPracticeActive = useAtomValue(typingPracticeActiveAtom)
  const [pendingMode, setPendingMode] = useAtom(pendingModeSwitchAtom)
  const setPausedBySwitcher = useSetAtom(typingPausedBySwitcherAtom)

  const [isOpen, setIsOpen] = useState(false)
  const [focusIndex, setFocusIndex] = useState(() => MODES.findIndex((m) => m.id === currentMode))
  const arrowRef = useRef<HTMLButtonElement | null>(null)
  const panelRef = useRef<HTMLDivElement | null>(null)

  const { refs, context } = useFloating({
    open: isOpen,
    onOpenChange: setIsOpen,
    whileElementsMounted: autoUpdate,
    middleware: [offset(5), flip(), shift()],
    placement: 'bottom-start',
  })
  const hover = useHover(context, { move: false, delay: { open: 80, close: 200 } })
  const { getReferenceProps, getFloatingProps } = useInteractions([hover])

  const commit = useCallback(
    (mode: AppMode) => {
      // MODE-05：写入时机 = 用户点击下拉项之后（onClick 第一行）
      setAppMode(mode)
      navigate(mode === 'typing' ? '/typing' : '/')
    },
    [navigate, setAppMode],
  )

  const onSelect = useCallback(
    (mode: AppMode) => {
      if (mode === currentMode) {
        setIsOpen(false)
        return
      }
      // MODE-06：打字模式正在练习时切走 → 先弹非阻塞确认条（禁止 alert/confirm）
      if (mode === 'learn' && isPracticeActive) {
        setPendingMode(mode)
        setIsOpen(false)
        return
      }
      setIsOpen(false)
      commit(mode)
    },
    [commit, currentMode, isPracticeActive, setPendingMode],
  )

  // 面板打开时把焦点放到当前模式项（ENTRY-07）
  useEffect(() => {
    if (!isOpen) return
    setFocusIndex(MODES.findIndex((m) => m.id === currentMode))
    const timer = window.setTimeout(() => {
      panelRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')[Math.max(0, focusIndex)]?.focus()
    }, 0)
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, currentMode])

  const onArrowKeyDown: React.KeyboardEventHandler<HTMLButtonElement> = (e) => {
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
      // ENTRY-07：Tab+Enter / 空格 也能展开。这里直接打开并 preventDefault，
      // 既覆盖「按钮嵌在页头 <a> 内导致原生 Enter→click 异常」的情况，
      // 又阻止合成 click 与 onClick 的二次翻转（等价 Gallery 里的经验）。
      e.preventDefault()
      if (!isOpen) setIsOpen(true)
      return
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      if (!isOpen) {
        setIsOpen(true)
        return
      }
      const dir = e.key === 'ArrowDown' ? 1 : -1
      const next = (focusIndex + dir + MODES.length) % MODES.length
      setFocusIndex(next)
      panelRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')[next]?.focus()
    } else if (e.key === 'Escape') {
      setIsOpen(false)
      arrowRef.current?.focus()
    }
  }

  const onItemKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, mode: AppMode) => {
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
      e.preventDefault()
      onSelect(mode)
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      // ENTRY-07：菜单项间用 ↑/↓ 移动焦点（schedule 1.6）
      e.preventDefault()
      const dir = e.key === 'ArrowDown' ? 1 : -1
      const idx = MODES.findIndex((m) => m.id === mode.id)
      const next = (idx + dir + MODES.length) % MODES.length
      setFocusIndex(next)
      panelRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')[next]?.focus()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setIsOpen(false)
      arrowRef.current?.focus()
    }
  }

  // MODE-06：确认条 5 秒无操作自动收起（视为「继续练习」）
  useEffect(() => {
    if (!pendingMode) return
    const timer = window.setTimeout(() => setPendingMode(null), 5000)
    return () => window.clearTimeout(timer)
  }, [pendingMode, setPendingMode])

  const onConfirmSwitch = () => {
    const target = pendingMode
    // 先解除「由确认条暂停」标记，避免 TypingLearner 的恢复效果抢跑
    setPausedBySwitcher(false)
    setPendingMode(null)
    if (target) commit(target)
  }

  const onContinuePractice = () => {
    setPendingMode(null)
  }

  const referenceProps = getReferenceProps()

  return (
    <>
      <button
        ref={(node) => {
          arrowRef.current = node
          refs.setReference(node)
        }}
        {...referenceProps}
        type="button"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-label="切换模式"
        className="absolute left-1/2 top-full flex h-4 w-4 -translate-x-1/2 items-center justify-center rounded text-indigo-500 transition-transform duration-200 hover:bg-indigo-100 focus:outline-none dark:hover:bg-gray-700"
        onKeyDown={onArrowKeyDown}
        onClick={(e) => {
          // ENTRY-06：点击箭头只切换面板开合，不跳转官网
          e.preventDefault()
          e.stopPropagation()
          setIsOpen((o) => !o)
        }}
      >
        <IconChevronDown className={`h-4 w-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      <Transition
        show={isOpen}
        as={Fragment}
        enter="transition ease-out duration-100"
        enterFrom="opacity-0"
        enterTo="opacity-100"
        leave="transition ease-in duration-100"
        leaveFrom="opacity-100"
        leaveTo="opacity-0"
      >
        <div
          ref={(node) => {
            panelRef.current = node
            refs.setFloating(node)
          }}
          {...getFloatingProps()}
          role="menu"
          aria-label="模式切换"
          className="my-card z-30 w-56 rounded-xl bg-white p-1 dark:bg-gray-800"
        >
          {MODES.map((mode, index) => {
            const isCurrent = mode.id === currentMode
            return (
              <button
                key={mode.id}
                role="menuitem"
                tabIndex={focusIndex === index ? 0 : -1}
                className={`group flex w-full items-center justify-between rounded-lg px-3 py-2 text-left transition-colors duration-300 focus:outline-none ${
                  isCurrent ? 'bg-indigo-50 dark:bg-gray-700' : ''
                } hover:bg-indigo-400 hover:text-white`}
                onClick={(e) => {
                  // ENTRY-06：整个 ModeSwitcher 挂在页头官网 NavLink 内，
                  // 菜单项点击必须阻止冒泡，否则触发 <a> 的默认导航跳到官网
                  e.preventDefault()
                  e.stopPropagation()
                  onSelect(mode.id)
                }}
                onKeyDown={(e) => onItemKeyDown(e, mode.id)}
                onMouseEnter={() => setFocusIndex(index)}
              >
                <span className="flex items-center">
                  {isCurrent ? (
                    <span className="mr-2 h-2 w-2 rounded-full bg-indigo-500 group-hover:bg-white" />
                  ) : (
                    <span className="mr-2 h-2 w-2 rounded-full border border-gray-400 group-hover:border-white" />
                  )}
                  <span className={`text-lg ${isCurrent ? 'text-indigo-500 group-hover:text-white' : 'text-gray-600 dark:text-gray-200'}`}>
                    {mode.name}
                  </span>
                </span>
                <span className="text-xs text-gray-400 group-hover:text-white">{mode.sub}</span>
              </button>
            )
          })}
        </div>
      </Transition>

      {pendingMode && (
        <div
          role="alertdialog"
          aria-label="切换模式确认"
          className="fixed left-1/2 top-32 z-30 -translate-x-1/2"
          data-testid="mode-switch-confirm"
        >
          <div className="my-card flex items-center gap-3 rounded-lg bg-white px-4 py-2 text-sm shadow-md dark:bg-gray-800">
            <span className="whitespace-nowrap text-gray-600 dark:text-gray-200">正在练习中，切换后将暂停本章。是否切换？</span>
            <button type="button" className="my-btn-primary px-3 py-1 text-sm" onClick={(e) => { e.preventDefault(); e.stopPropagation(); onConfirmSwitch() }}>
              切换
            </button>
            <button
              type="button"
              className="rounded-lg px-3 py-1 text-sm text-gray-600 transition-colors duration-300 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onContinuePractice() }}
            >
              继续练习
            </button>
          </div>
        </div>
      )}
    </>
  )
}
