import { isOpenDarkModeAtom } from '@/store'
import { useAtomValue } from 'jotai'
import { Minus, Square, X } from 'lucide-react'
import { useEffect, useState } from 'react'

/** preload 注入的窗口控制能力，仅在 Electron 打包/桌面端存在 */
type DesktopWindowApi = {
  isDesktop: true
  minimize: () => void
  toggleMaximize: () => void
  close: () => void
  isMaximized: () => Promise<boolean>
  onMaximizedChange: (callback: (maximized: boolean) => void) => () => void
  setBackgroundColor: (color: string) => void
}

declare global {
  interface Window {
    desktopWindow?: DesktopWindowApi
  }
}

export function isDesktopShell() {
  return typeof window !== 'undefined' && Boolean(window.desktopWindow?.isDesktop)
}

/**
 * 桌面端标记：给 <html> 加上 desktop-shell 类，
 * 供全局 CSS 切换为「纵向 flex 根容器」布局（见 index.css）。
 * Web 端不会执行任何操作。
 */
function applyDesktopShellClass() {
  if (typeof document === 'undefined') return
  if (isDesktopShell()) document.documentElement.classList.add('desktop-shell')
}

applyDesktopShellClass()

// 按钮：48×28 的可见热区，四周留间隙形成独立圆角块（标题栏总高 36px）
const BUTTON_BASE =
  'app-titlebar-button mx-[2px] my-[4px] h-[28px] w-[48px] rounded-[8px] text-gray-400/90 ' +
  'transition-colors duration-150 hover:text-gray-700 dark:text-gray-500 dark:hover:text-gray-200 ' +
  'hover:bg-black/[0.055] dark:hover:bg-white/[0.08]'

/**
 * 自绘窗口标题栏。
 *
 * 只在 Electron 桌面端渲染（通过 window.desktopWindow 判断）；
 * 静态 Web 部署时组件直接返回 null，页面上不会出现任何窗口操作按钮。
 *
 * 高度 36px，与 index.css 中 .desktop-shell 的纵向 flex 布局配合。
 */
export default function DesktopTitlebar() {
  const darkMode = useAtomValue(isOpenDarkModeAtom)
  const [maximized, setMaximized] = useState(false)
  const api = typeof window !== 'undefined' ? window.desktopWindow : undefined

  useEffect(() => {
    if (!api) return
    api.isMaximized().then(setMaximized)
    return api.onMaximizedChange(setMaximized)
  }, [api])

  // 最大化时去掉根容器圆角（否则边缘会露出一圈缝隙）
  useEffect(() => {
    if (typeof document === 'undefined') return
    document.documentElement.classList.toggle('is-maximized', maximized)
  }, [maximized])

  // 同步窗口底色与当前主题一致，避免原生圆角处露出异色缺口
  useEffect(() => {
    if (!api) return
    // 与 index.css 中 body 的浅色/深色背景保持一致
    api.setBackgroundColor(darkMode ? '#111827' : '#faf9ff')
  }, [api, darkMode])

  if (!api) return null

  return (
    // 不加 border-b，使用与页面一致的透明背景，避免出现明显的标题栏分界线
    <div
      className="app-titlebar flex h-9 w-full shrink-0 select-none items-center justify-end bg-transparent pr-[6px]"
      onDoubleClick={() => api.toggleMaximize()}
    >
      <button type="button" aria-label="最小化" title="最小化" className={BUTTON_BASE} onClick={() => api.minimize()}>
        <Minus size={17} strokeWidth={1.7} />
      </button>

      <button
        type="button"
        aria-label={maximized ? '还原' : '最大化'}
        title={maximized ? '还原' : '最大化'}
        className={BUTTON_BASE}
        onClick={() => api.toggleMaximize()}
      >
        {maximized ? (
          // 还原：两个叠放的方框
          <svg width="15" height="15" viewBox="0 0 13 13" fill="none" aria-hidden>
            <rect x="1.3" y="3.6" width="7.9" height="7.9" rx="1.2" stroke="currentColor" strokeWidth="1.2" />
            <path
              d="M3.9 3.4V2.6a1.1 1.1 0 0 1 1.1-1.1h5.4a1.1 1.1 0 0 1 1.1 1.1v5.4a1.1 1.1 0 0 1-1.1 1.1h-.8"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinecap="round"
            />
          </svg>
        ) : (
          <Square size={14} strokeWidth={1.7} />
        )}
      </button>

      <button
        type="button"
        aria-label="关闭"
        title="关闭"
        className={
          BUTTON_BASE + ' hover:bg-[#e81123] hover:text-white dark:hover:bg-[#e81123] dark:hover:text-white'
        }
        onClick={() => api.close()}
      >
        <X size={18} strokeWidth={1.8} />
      </button>

      <span className="sr-only">{darkMode ? '深色模式' : '浅色模式'}</span>
    </div>
  )
}
