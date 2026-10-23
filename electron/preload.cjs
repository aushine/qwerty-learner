/**
 * Preload 脚本：向页面暴露最小的窗口控制 API。
 *
 * 仅在 Electron 中注入（通过 webPreferences.preload），
 * 普通浏览器 / 静态 Web 部署下页面里不存在 window.desktopWindow，
 * 前端据此判断是否渲染自绘标题栏。
 */

const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('desktopWindow', {
  /** 当前是否为桌面端（固定为 true，仅用于前端做能力判断） */
  isDesktop: true,
  minimize: () => ipcRenderer.send('window:minimize'),
  toggleMaximize: () => ipcRenderer.send('window:toggle-maximize'),
  close: () => ipcRenderer.send('window:close'),
  /** 查询当前是否最大化，用于同步按钮图标 */
  isMaximized: () => ipcRenderer.invoke('window:is-maximized'),
  /** 订阅最大化状态变化，返回取消订阅函数 */
  onMaximizedChange: (callback) => {
    const listener = (_event, maximized) => callback(maximized)
    ipcRenderer.on('window:maximized-changed', listener)
    return () => ipcRenderer.removeListener('window:maximized-changed', listener)
  },
  /** 同步窗口底色，避免圆角处露出与主题不符的颜色 */
  setBackgroundColor: (color) => ipcRenderer.send('window:set-background', color),
})
