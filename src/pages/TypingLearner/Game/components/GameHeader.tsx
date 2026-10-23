/**
 * GameHeader —— 游戏模块共用页头（spec-20261019-v1 / 01 §三）
 *
 * 复用全局 Header（ModeSwitcher 在左，右侧 nav 放返回 + 标题 + 页面级操作）。
 * 与学习/打字模式页头结构一致，不新增顶层导航。
 */

import Header from '@/components/Header'
import type { PropsWithChildren } from 'react'
import type React from 'react'
import IconChevronLeft from '~icons/tabler/chevron-left'

const GameHeader: React.FC<
  PropsWithChildren<{
    /** 页标题（如「游戏中心」「墨雨 · 落字成画」） */
    title: string
    /** 返回目标（默认 /typing） */
    onBack: () => void
    /** 返回按钮文案 */
    backLabel?: string
  }>
> = ({ title, onBack, backLabel = '返回打字模式', children }) => {
  return (
    <Header>
      <button
        type="button"
        className="flex items-center gap-1 rounded-lg px-2 py-1 text-sm text-gray-600 transition-colors hover:bg-indigo-50 hover:text-indigo-500 dark:text-gray-200 dark:hover:bg-gray-700"
        onClick={onBack}
      >
        <IconChevronLeft className="h-4 w-4" />
        {backLabel}
      </button>
      <span className="text-base font-medium text-gray-700 dark:text-gray-100">{title}</span>
      {children}
    </Header>
  )
}

export default GameHeader
