import DesktopTitlebar, { isDesktopShell } from './DesktopTitlebar'
import Footer from './Footer'
import type React from 'react'

export default function Layout({ children }: { children: React.ReactNode }) {
  const desktopShell = isDesktopShell()

  // 桌面端：外层 #root 是纵向 flex 容器（见 index.css 的 .desktop-shell），
  // 标题栏固定高度，内容区用 flex-1 + min-h-0 吃掉剩余高度；
  // overflow-y-auto 让内容超出时可滚动，避免被 #root 的 overflow:hidden 直接裁掉。
  // Web 端：保持原来的 h-screen 布局不变。
  const mainClassName = desktopShell
    ? 'flex w-full min-h-0 flex-1 flex-col items-center overflow-y-auto pb-4'
    : 'flex h-screen w-full flex-col items-center pb-4'

  return (
    <>
      {/* 桌面端：自绘标题栏；Web 端该组件直接返回 null，不渲染任何按钮 */}
      <DesktopTitlebar />
      <main className={mainClassName}>
        {children}
        <Footer />
      </main>
    </>
  )
}
