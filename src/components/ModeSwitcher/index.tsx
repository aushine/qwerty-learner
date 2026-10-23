/**
 * 模式切换入口（ModeSwitcher）—— spec-20261017-v2 / 01 基线 + 2026-10-21 用户改版
 *
 * 2026-10-21 改版（用户指令，覆盖 spec-20261020-v1 / 07 的浮层面板形态）：
 * - **形态参考学习模式 Start/Pause 按钮**（src/pages/Typing/components/StartButton）：
 *   单个 rounded-lg + shadow-lg 实心按钮，font-medium 文字标签；
 *   状态色沿用其口径——indigo-500（学习态，可执行的主操作）⇄ gray-400（打字态，运行中），
 *   **不引入新色调**（用户明确要求「不要改色调」）。
 * - **标签 = 点击后的目标模式**（与 Start/Pause 的「标签即动作」同语义）：
 *   学习态显示「打字模式」（点击进入），打字态显示「学习模式」（点击返回）。
 * - 删除：hover 浮层、标题下指示器、指针几何判定、floating-ui 定位、面板键盘导航
 *   （role=menu / menuitem 相关 DOM 与探针同步更新）。
 *
 * 保留项（不得回归）：
 * - MODE-04：当前模式按路由判断（location.pathname.startsWith('/typing')）；
 * - MODE-05：切换即时写入 appModeAtom（localStorage 持久化）；
 * - MODE-06：打字练习中切走 → 先弹非阻塞确认条（5 秒自动收起、继续练习自动恢复）；
 * - ENTRY2-06：点击标题文字跳官网；
 * - ENTRY2-07：原生 <button>，Tab 可聚焦、Enter/Space 可激活；
 * - 深色模式全套适配。
 */

import logo from '@/assets/logo.svg'
import { appModeAtom, pendingModeSwitchAtom, typingPausedBySwitcherAtom, typingPracticeActiveAtom } from '@/store/typingMode'
import type { AppMode } from '@/typings/typing'
import classNames from 'classnames'
import Tooltip from '@/components/Tooltip'
import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import { useCallback, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

/** 两种模式的展示信息 */
const MODES: { id: AppMode; title: string; label: string }[] = [
  { id: 'learn', title: 'Qwerty Learner', label: '学习模式' },
  { id: 'typing', title: 'Typing Learner', label: '打字模式' },
]

export default function ModeSwitcher() {
  const location = useLocation()
  const navigate = useNavigate()
  // MODE-04：当前模式基于路由判断（而非仅 atom），保证前进/后退不错位
  const currentMode: AppMode = location.pathname.startsWith('/typing') ? 'typing' : 'learn'
  const targetMode: AppMode = currentMode === 'typing' ? 'learn' : 'typing'

  const setAppMode = useSetAtom(appModeAtom)
  const isPracticeActive = useAtomValue(typingPracticeActiveAtom)
  const [pendingMode, setPendingMode] = useAtom(pendingModeSwitchAtom)
  const setPausedBySwitcher = useSetAtom(typingPausedBySwitcherAtom)

  const commit = useCallback(
    (mode: AppMode) => {
      // MODE-05：写入时机 = 用户点击切换按钮之后（onClick 第一行）
      setAppMode(mode)
      navigate(mode === 'typing' ? '/typing' : '/')
    },
    [navigate, setAppMode],
  )

  /** 点击切换按钮（Start/Pause 同构：一次点击完成状态转换） */
  const onToggle = useCallback(() => {
    // MODE-06：打字模式正在练习时切走 → 先弹非阻塞确认条（禁止 alert/confirm）
    if (targetMode === 'learn' && isPracticeActive) {
      setPendingMode(targetMode)
      return
    }
    commit(targetMode)
  }, [targetMode, isPracticeActive, setPendingMode, commit])

  /** 确认条点「切换」：执行待定的模式切换 */
  const onConfirmSwitch = useCallback(() => {
    const target = pendingMode
    setPausedBySwitcher(false)
    setPendingMode(null)
    if (target) commit(target)
  }, [pendingMode, setPausedBySwitcher, setPendingMode, commit])

  const onContinuePractice = useCallback(() => {
    setPendingMode(null)
  }, [setPendingMode])

  // MODE-06：确认条 5 秒无操作自动收起（视为「继续练习」）
  useEffect(() => {
    if (!pendingMode) return
    const timer = window.setTimeout(() => setPendingMode(null), 5000)
    return () => window.clearTimeout(timer)
  }, [pendingMode, setPendingMode])

  const display = MODES.find((m) => m.id === currentMode) ?? MODES[0]
  const target = MODES.find((m) => m.id === targetMode) ?? MODES[1]

  return (
    <>
      <div className="flex items-center">
        {/* ENTRY2-06：点击标题文字跳官网 */}
        <a
          className="flex items-center text-2xl font-bold text-indigo-500 no-underline hover:no-underline lg:text-4xl"
          href="https://qwerty.kaiyi.cool/"
        >
          <img src={logo} className="mr-3 h-16 w-16" alt="Qwerty Learner Logo" />
          <span>{display.title}</span>
        </a>

        {/*
          模式切换按钮（2026-10-21 改版）：形态复刻 Start/Pause——
          rounded-lg + shadow-lg 实心钮，状态色 indigo-500（学习态）/ gray-400（打字态），
          标签为目标模式名；Tooltip 说明动作，与 StartButton 的「开始/暂停（Enter）」同形式。
        */}
        <Tooltip content={`切换到${target.label}`} placement="bottom">
          <button
            type="button"
            data-testid="mode-toggle"
            aria-label={`切换到${target.label}`}
            onClick={onToggle}
            onKeyDown={(e) => {
              // 学习模式首页有 document 级 Enter 热键（StartButton 的 preventDefault），
              // 会抑制原生 <button> 的 Enter→click；这里显式处理 Enter/Space，
              // 与旧浮层「指示器键盘可达」（ENTRY2-07）保持同等可达性。
              if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
                e.preventDefault()
                e.stopPropagation()
                onToggle()
              }
            }}
            className={classNames(
              'ml-4 flex h-10 shrink-0 items-center rounded-lg px-5 text-base font-medium shadow-lg transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300',
              currentMode === 'learn'
                ? 'bg-indigo-500 text-white shadow-indigo-300 hover:bg-indigo-400 dark:shadow-indigo-500/60'
                : 'bg-gray-400 text-white shadow-gray-200 hover:bg-gray-500 dark:bg-gray-600 dark:shadow-none',
            )}
          >
            {target.label}
          </button>
        </Tooltip>
      </div>

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
