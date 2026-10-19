/**
 * 模式切换入口（ModeSwitcher）—— spec-20261017-v2 / 01
 *
 * 第二批改版（取代第一批 01 ENTRY-02 / ENTRY-04 / §3.3）：
 * - 整个标题块（logo + 标题 + 箭头）作为 hover 热区，hover 时整块加浅底 + 圆角 + 轻阴影（ENTRY2-01）；
 * - 标题文字随浮层内 hover 的项**实时切换** Qwerty Learner / Typing Learner（ENTRY2-03）；
 * - 中文模式名「学习模式 / 打字模式」**仅在浮层展开时**追加在英文标题后（ENTRY2-04），
 *   绝对定位、不引起标题位移；
 * - 浮层只放英文名，`offset(8)`，参数 open 60 / close 150（ENTRY2-05 / §3）。
 * 🔴 点击标题文字跳官网，点击箭头只开合浮层（ENTRY2-06）。
 */
import logo from '@/assets/logo.svg'
import { appModeAtom, pendingModeSwitchAtom, typingPausedBySwitcherAtom, typingPracticeActiveAtom } from '@/store/typingMode'
import type { AppMode } from '@/typings/typing'
import { autoUpdate, flip, offset, shift, useFloating } from '@floating-ui/react'
import { Transition } from '@headlessui/react'
import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Fragment } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import IconChevronDown from '~icons/tabler/chevron-down'

/** 两种模式的展示信息（ENTRY2-03 / ENTRY2-04） */
const MODES: { id: AppMode; title: string; label: string }[] = [
  { id: 'learn', title: 'Qwerty Learner', label: '学习模式' },
  { id: 'typing', title: 'Typing Learner', label: '打字模式' },
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
  /** 浮层内被 hover / 聚焦的模式 → 驱动标题预览（ENTRY2-03 / ENTRY2-08） */
  const [previewMode, setPreviewMode] = useState<AppMode | null>(null)
  const [focusIndex, setFocusIndex] = useState(() => MODES.findIndex((m) => m.id === currentMode))
  const arrowRef = useRef<HTMLButtonElement | null>(null)
  const pointerRef = useRef({ x: 0, y: 0 })
  const openTimerRef = useRef(0)
  const closeTimerRef = useRef(0)
  /** 外层交互容器（含浮层，保证 hover 从标题移到面板时不收起） */
  const wrapperRef = useRef<HTMLDivElement | null>(null)
  const panelRef = useRef<HTMLDivElement | null>(null)

  const { refs, x, y } = useFloating({
    open: isOpen,
    onOpenChange: setIsOpen,
    whileElementsMounted: autoUpdate,
    // §3 ENTRY2-05：视觉间距 8px 用 translate-y 实现（浮动层仍与触发区贴合），
    // 否则 8px 的空白会形成「鼠标穿越 gap → 判定离开 → 面板收起」的死区。
    middleware: [offset(0), flip(), shift()],
    placement: 'bottom-start',
  })
  // §3：open 60 / close 150（比第一批更快跟手）
  /**
   * hover 判定（ENTRY2-01 / ENTRY2-07）：
   * 不用 `useHover`——它把关闭绑定在 reference 的原生 mouseleave 上，
   * 而浮层经 Transition 挂载在 portal 里，鼠标穿越 header 内边距时会被判为离开并收起。
   * 这里改用「指针是否落在标题区或浮层矩形内」的几何判定：
   * - 鼠标进入标题区 → 开（延迟 60ms，与需求一致的手感）
   * - 鼠标同时离开两个矩形 → 关（延迟 150ms，留出斜穿时间）
   * 键盘路径（Tab/Enter/↓）不受影响，由 onKeyDown 单独处理。
   */

  // 浮层收起时清掉预览，标题回到当前模式（ENTRY2-01-05）
  useEffect(() => {
    if (!isOpen) setPreviewMode(null)
  }, [isOpen])

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

  // 面板打开时把焦点放到当前模式项（ENTRY2-08）
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
      e.preventDefault()
      const dir = e.key === 'ArrowDown' ? 1 : -1
      const idx = MODES.findIndex((m) => m.id === mode)
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
    setPausedBySwitcher(false)
    setPendingMode(null)
    if (target) commit(target)
  }

  const onContinuePractice = () => {
    setPendingMode(null)
  }

  // 标题预览：浮层内 hover/聚焦优先，否则显示当前模式（ENTRY2-03）
  const displayMode = previewMode ?? currentMode
  const display = MODES.find((m) => m.id === displayMode) ?? MODES[0]

  /** 指针是否落在标题区或浮层内（几何判定，见上方注释） */
  const isPointerInside = useCallback(() => {
    const el = document.elementFromPoint(pointerRef.current.x, pointerRef.current.y)
    if (!el) return false
    return !!el.closest('[data-mode-switcher-anchor]') || !!el.closest('[data-mode-switcher-panel]')
  }, [])

  const openWithDelay = useCallback(() => {
    window.clearTimeout(closeTimerRef.current)
    window.clearTimeout(openTimerRef.current)
    openTimerRef.current = window.setTimeout(() => setIsOpen(true), 60)
  }, [])

  const closeWithDelay = useCallback(() => {
    window.clearTimeout(openTimerRef.current)
    window.clearTimeout(closeTimerRef.current)
    closeTimerRef.current = window.setTimeout(() => {
      if (!isPointerInside()) setIsOpen(false)
    }, 150)
  }, [isPointerInside])

  /** 指针离开标题区/浮层 → 延迟关闭；进入 → 保持展开 */
  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      pointerRef.current = { x: e.clientX, y: e.clientY }
      if (isOpen) {
        if (!isPointerInside()) closeWithDelay()
      }
    },
    [isOpen, isPointerInside, closeWithDelay],
  )

  // 挂到 document：浮层在 portal 里，普通冒泡收不到它的 pointermove
  useEffect(() => {
    if (!isOpen) return
    const onMove = (e: PointerEvent) => {
      pointerRef.current = { x: e.clientX, y: e.clientY }
    }
    document.addEventListener('pointermove', onMove)
    return () => document.removeEventListener('pointermove', onMove)
  }, [isOpen])

  useEffect(
    () => () => {
      window.clearTimeout(openTimerRef.current)
      window.clearTimeout(closeTimerRef.current)
    },
    [],
  )

  return (
    <>
      {/*
        整块标题 hover 容器（ENTRY2-01）：
        - 同时是 useFloating 的 reference 与 hover 判定锚点（data-mode-switcher-anchor）；
        - -mx-3 -my-2 + px-3 py-2 抵消内边距，保证 hover 前后 logo/标题像素位置不变（ENTRY2-02）。
      */}
      <div
        ref={(node) => {
          refs.setReference(node)
          wrapperRef.current = node
        }}
        data-mode-switcher-anchor=""
        className={`relative -mx-3 -my-2 flex items-center rounded-xl px-3 py-2 transition-colors duration-300 ease-in-out ${
          isOpen ? 'bg-indigo-50 shadow-sm dark:bg-gray-700 dark:shadow-none' : ''
        }`}
        onPointerEnter={openWithDelay}
        onPointerMove={onPointerMove}
        onPointerLeave={closeWithDelay}
      >
        <a
          className="flex items-center text-2xl font-bold text-indigo-500 no-underline hover:no-underline lg:text-4xl"
          href="https://qwerty.kaiyi.cool/"
          // 点击标题文字跳官网；箭头是兄弟节点，单独处理（ENTRY2-06）
          onClick={(e) => {
            // 浮层展开时点击标题：先收起，不跳转（避免「想看模式却跳走」）
            if (isOpen) {
              e.preventDefault()
              setIsOpen(false)
            }
          }}
        >
          <img src={logo} className="mr-3 h-16 w-16" alt="Qwerty Learner Logo" />
          <span className="relative flex flex-col">
            {/* 标题文字随 hover 的模式实时切换（ENTRY2-03） */}
            <span>{display.title}</span>
            {/* 中文模式名：仅浮层展开时出现，绝对定位不占位（ENTRY2-04-1） */}
            <span
              className={`absolute left-full top-1/2 ml-2 -translate-y-1/2 whitespace-nowrap text-sm font-normal text-gray-400 transition-opacity duration-200 lg:text-base ${
                isOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
              }`}
              aria-hidden={!isOpen}
              data-testid="mode-label"
            >
              {display.label}
            </span>
          </span>
        </a>

        {/* 箭头：热区放大到 h-8 w-8，点击只开合浮层（ENTRY2-06） */}
        <button
          ref={arrowRef}
          type="button"
          aria-haspopup="menu"
          aria-expanded={isOpen}
          aria-label="切换模式"
          className="ml-1 flex h-8 w-8 items-center justify-center rounded-lg text-indigo-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 dark:text-indigo-400"
          onKeyDown={onArrowKeyDown}
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            setIsOpen((o) => !o)
          }}
        >
          <IconChevronDown className={`h-5 w-5 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
        </button>
      </div>

      <Transition
        show={isOpen}
        as={Fragment}
        enter="transition ease-out duration-150"
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
          data-mode-switcher-panel=""
          onPointerEnter={() => window.clearTimeout(closeTimerRef.current)}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            transform: `translate(${Math.round(x ?? 0)}px, ${Math.round((y ?? 0) + 8)}px)`,
            marginTop: 0,
          }}
          role="menu"
          aria-label="模式切换"
          className="my-card relative z-30 w-52 rounded-xl bg-white p-1 dark:bg-gray-800"
        >
          {/*
            hover 桥（ENTRY2-05）：浮层与标题块之间的 8px 视觉间隙是**透明**的，
            鼠标斜穿时会落到页头的 padding 容器上被判为「离开」→ 面板收起。
            这里铺一条透明带填满该间隙（pointer-events 默认 auto，参与 hover 判定）。
          */}
          <span aria-hidden className="absolute -top-2 left-0 h-2 w-full" />
          {MODES.map((mode, index) => {
            const isCurrent = mode.id === currentMode
            return (
              <button
                key={mode.id}
                role="menuitem"
                aria-label={`${mode.title} ${mode.label}`}
                tabIndex={focusIndex === index ? 0 : -1}
                className="group flex w-full items-center justify-between rounded-lg px-3 py-2 text-left transition-colors duration-300 hover:bg-indigo-400 hover:text-white focus:bg-indigo-400 focus:text-white focus:outline-none"
                onClick={(e) => {
                  // ENTRY-06：整块挂在页头内，菜单项点击必须阻止冒泡
                  e.preventDefault()
                  e.stopPropagation()
                  onSelect(mode.id)
                }}
                onKeyDown={(e) => onItemKeyDown(e, mode.id)}
                onMouseEnter={() => {
                  setFocusIndex(index)
                  setPreviewMode(mode.id)
                }}
                onMouseLeave={() => setPreviewMode(null)}
                onFocus={() => {
                  setFocusIndex(index)
                  setPreviewMode(mode.id)
                }}
                onBlur={() => setPreviewMode(null)}
              >
                <span className={`text-lg ${isCurrent ? 'text-indigo-500 group-hover:text-white' : 'text-gray-600 dark:text-gray-200'}`}>
                  {mode.title}
                </span>
                {isCurrent && <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 group-hover:bg-white" />}
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
            <button
              type="button"
              className="my-btn-primary px-3 py-1 text-sm"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                onConfirmSwitch()
              }}
            >
              切换
            </button>
            <button
              type="button"
              className="rounded-lg px-3 py-1 text-sm text-gray-600 transition-colors duration-300 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                onContinuePractice()
              }}
            >
              继续练习
            </button>
          </div>
        </div>
      )}
    </>
  )
}
