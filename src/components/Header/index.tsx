/**
 * 页头 —— spec-20261017-v2 / 01 ENTRY2-01
 *
 * 左侧标题区（logo + 标题 + 模式切换箭头）整体交由 `ModeSwitcher` 渲染：
 * 整块作为 hover 热区（ENTRY2-01），标题文字随浮层内 hover 的模式切换（ENTRY2-03），
 * 中文模式名仅在浮层展开时追加在英文标题后（ENTRY2-04）。
 * 学习模式与打字模式共用本组件，因此两种模式的页头结构完全一致。
 */

import ModeSwitcher from '@/components/ModeSwitcher'
import type { PropsWithChildren } from 'react'
import type React from 'react'

const Header: React.FC<PropsWithChildren> = ({ children }) => {
  return (
    <header className="container z-20 mx-auto w-full px-10 py-6">
      <div className="flex w-full flex-col items-center justify-between space-y-3 lg:flex-row lg:space-y-0">
        <ModeSwitcher />
        <nav className="my-card on element flex w-auto content-center items-center justify-end space-x-3 rounded-xl bg-white p-4 transition-colors duration-300 dark:bg-gray-800">
          {children}
        </nav>
      </div>
    </header>
  )
}

export default Header
