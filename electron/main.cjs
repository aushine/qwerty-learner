/**
 * Electron 主进程（CommonJS，无需编译，直接由 Electron 运行）。
 *
 * 与静态包方案共存：
 * - 生产模式：通过自定义 app:// 协议加载 Vite 产物 build/（yarn build 的输出）
 * - 开发模式：设置 ELECTRON_START_URL 后加载 Vite dev server（见 electron/dev.cjs）
 *
 * 为什么生产模式不用 file:// 直接打开 index.html：
 * Vite 产物是 ES Module（<script type="module" crossorigin>），Chromium 在 file:// 下
 * 会因跨域策略拒绝加载这类脚本，表现为窗口打开但整页白屏（控制台无输出）。
 * 自定义 app:// 协议拥有正常的源（origin），模块脚本、IndexedDB、fetch 等都能正常工作。
 *
 * 运行：yarn electron   （需先 yarn build）
 * 打包：yarn dist:electron
 */

/**
 * 解析 Electron 内置模块。
 *
 * 注意：当工作目录的 node_modules 里存在 `electron` 这个 npm 包时，Node 的模块解析
 * 会优先命中它，而该包导出的是「electron.exe 的路径字符串」，并不是真正的 API。
 * 这里显式兜底：拿不到 API 对象时给出明确提示，避免出现难以定位的
 * "Cannot read properties of undefined" 之类错误。
 */
function loadElectron() {
  const mod = require('electron')
  if (mod && typeof mod === 'object' && typeof mod.app === 'object') return mod

  const detail = typeof mod === 'string' ? `路径字符串：${mod}` : typeof mod
  console.error('[electron] 未能获取 Electron API，require("electron") 返回了 ' + detail)
  return null
}

const electronApi = loadElectron()
const { app, BrowserWindow, Menu, dialog, shell, protocol, session, ipcMain } = electronApi || {}
const fs = require('node:fs')
const path = require('node:path')

const APP_SCHEME = 'app'
const APP_HOST = 'qwerty-learner'

/** 常见静态资源的 Content-Type，ES Module 必须返回正确的 JS MIME 才能执行 */
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.txt': 'text/plain; charset=utf-8',
  '.pdf': 'application/pdf',
  '.map': 'application/json; charset=utf-8',
}

function contentTypeFor(filePath) {
  return MIME_TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream'
}

// 必须在 app ready 之前注册 scheme 权限，否则不会被视为安全上下文
if (electronApi) {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: APP_SCHEME,
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        corsEnabled: true,
        stream: true,
      },
    },
  ])
}

/**
 * 启动诊断日志。
 * - 默认写到用户数据目录下的 logs/main.log（仅在本进程写，不会污染项目）
 * - 设置 ELECTRON_LOG_FILE 可覆盖路径；设置 ELECTRON_DISABLE_LOG=1 可完全关闭
 */
function resolveLogFile() {
  if (process.env.ELECTRON_DISABLE_LOG === '1') return null
  if (process.env.ELECTRON_LOG_FILE) return process.env.ELECTRON_LOG_FILE
  try {
    return path.join(electronApi.app.getPath('userData'), 'logs', 'main.log')
  } catch {
    return null
  }
}
const logFile = resolveLogFile()
function trace(message) {
  if (!logFile) return
  try {
    fs.mkdirSync(path.dirname(logFile), { recursive: true })
    fs.appendFileSync(logFile, `[${new Date().toISOString()}] ${message}\n`)
  } catch {
    /* 日志失败不影响主流程 */
  }
}

const isDev = Boolean(process.env.ELECTRON_START_URL)
const devUrl = process.env.ELECTRON_START_URL || 'http://localhost:5173'
// Vite 产物目录：开发时在主进程同级，打包后位于 asar 内的 /build
const buildDir = path.join(__dirname, '..', 'build')
const indexPath = path.join(buildDir, 'index.html')

/**
 * 窗口图标：
 * - 打包后 Windows 任务栏图标由 exe 资源提供，无需额外设置
 * - 开发/直接运行时用仓库里的 src-tauri/icons/icon.png；文件不存在时省略该参数
 */
function resolveIcon() {
  const candidates = [path.join(__dirname, '..', 'src-tauri', 'icons', 'icon.png')]
  for (const file of candidates) {
    try {
      if (fs.existsSync(file)) return file
    } catch {
      /* 忽略，继续尝试下一个 */
    }
  }
  return undefined
}

/** 单实例锁：重复启动时聚焦已有窗口，避免多个练习进程互相抢焦点 */
function main() {
  if (!app.requestSingleInstanceLock()) {
    app.quit()
    return
  }

  trace('main: singleInstanceLock acquired')
  app.on('second-instance', () => {
    const [win] = BrowserWindow.getAllWindows()
    if (win) {
      if (win.isMinimized()) win.restore()
      win.focus()
    }
  })

  function showMissingBuildError() {
    dialog.showErrorBox(
      '未找到构建产物',
      '没有找到 build/index.html。\n请先在项目根目录执行 yarn build 生成静态产物，再启动 Electron。'
    )
    app.exit(1)
  }

  /**
   * 发音音频来自有道公开接口，其响应不带 Access-Control-Allow-Origin，
   * 在 app:// 源下会被 CORS 拦截导致桌面端没有发音。
   * 这里仅对有道音频请求放开跨域（不影响其他远程资源的默认安全策略）。
   */
  function relaxPronunciationCors() {
    const filter = { urls: ['https://dict.youdao.com/*'] }
    session.defaultSession.webRequest.onHeadersReceived(filter, (details, callback) => {
      const responseHeaders = { ...details.responseHeaders }
      // 删除可能存在的旧值，统一写入允许任意来源
      for (const key of Object.keys(responseHeaders)) {
        if (key.toLowerCase() === 'access-control-allow-origin') delete responseHeaders[key]
      }
      responseHeaders['Access-Control-Allow-Origin'] = ['*']
      callback({ responseHeaders })
    })
  }

  /**
   * 自绘标题栏的窗口控制：渲染进程通过 preload 暴露的 API 发 IPC 到这里。
   * 使用 frame:false 去掉系统标题栏和窗口外框，按钮样式完全由前端控制。
   */
  function registerWindowControls(win) {
    const sendMaximizedState = () => {
      if (!win.isDestroyed()) win.webContents.send('window:maximized-changed', win.isMaximized())
    }

    win.on('maximize', sendMaximizedState)
    win.on('unmaximize', sendMaximizedState)

    ipcMain.on('window:minimize', (event) => {
      BrowserWindow.fromWebContents(event.sender)?.minimize()
    })
    ipcMain.on('window:toggle-maximize', (event) => {
      const target = BrowserWindow.fromWebContents(event.sender)
      if (!target) return
      if (target.isMaximized()) target.unmaximize()
      else target.maximize()
    })
    ipcMain.on('window:close', (event) => {
      BrowserWindow.fromWebContents(event.sender)?.close()
    })
    ipcMain.handle('window:is-maximized', (event) => {
      return BrowserWindow.fromWebContents(event.sender)?.isMaximized() ?? false
    })

    /**
     * 渲染进程切换主题时同步窗口底色。
     * 无边框 + 原生圆角窗口在四角处会露出 BrowserWindow 的 backgroundColor，
     * 若与页面主题不一致会看到明显浅色/深色缺口。
     */
    ipcMain.on('window:set-background', (event, color) => {
      const target = BrowserWindow.fromWebContents(event.sender)
      if (!target || typeof color !== 'string') return
      // 仅接受 #rrggbb，避免异常值
      if (!/^#[0-9a-fA-F]{6}$/.test(color)) return
      target.setBackgroundColor(color)
    })
  }

  function createWindow() {
    const win = new BrowserWindow({
      width: 1280,
      height: 860,
      minWidth: 760,
      minHeight: 560,
      icon: resolveIcon(),
      // 须与页面 body 背景接近，否则圆角裁切的四角会露出明显色差
      backgroundColor: '#faf9ff',
      autoHideMenuBar: true,
      // 无边框：标题栏与窗口控制按钮全部由前端自绘
      frame: false,
      // 无边框窗口保留圆角（Windows 11 Build 22000+ 原生支持，低版本自动忽略）
      roundedCorners: true,
      // 拖动窗口时保留系统级边缘调整手感
      thickFrame: true,
      webPreferences: {
        preload: path.join(__dirname, 'preload.cjs'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        spellcheck: false,
      },
    })

    registerWindowControls(win)

    if (isDev) {
      win.loadURL(devUrl)
      if (process.env.ELECTRON_OPEN_DEVTOOLS === '1') {
        win.webContents.openDevTools({ mode: 'bottom' })
      }
    } else {
      if (!fs.existsSync(indexPath)) {
        showMissingBuildError()
        return win
      }
      win.loadURL(`${APP_SCHEME}://${APP_HOST}/index.html`)
    }

    // 页面里 target=_blank 的链接一律交给系统浏览器，不在应用内开新窗
    win.webContents.setWindowOpenHandler(({ url }) => {
      if (/^https?:\/\//.test(url)) shell.openExternal(url)
      return { action: 'deny' }
    })

    // 加载诊断：页面/资源加载失败时写入日志，避免出现白屏却无提示的情况
    win.webContents.on('did-fail-load', (_event, code, desc, url) => {
      trace(`renderer did-fail-load code=${code} desc=${desc} url=${url}`)
    })
    win.webContents.on('render-process-gone', (_event, details) => {
      trace(`renderer gone reason=${details.reason} exitCode=${details.exitCode}`)
    })
    win.webContents.on('did-finish-load', () => {
      trace('renderer did-finish-load')
    })

    // 捕获渲染进程的控制台输出与未捕获异常，写入日志便于排查白屏
    win.webContents.on('console-message', (_event, level, message, line, sourceId) => {
      trace(`console[${level}] ${message} (${sourceId}:${line})`)
    })
    win.webContents.on('preload-error', (_event, preloadPath, error) => {
      trace(`preload-error ${preloadPath}: ${error}`)
    })

    return win
  }

  function buildMenu() {
    const viewMenu = {
      label: '视图',
      submenu: [
        { role: 'reload', label: '刷新' },
        { role: 'forceReload', label: '强制刷新' },
        { role: 'toggleDevTools', label: '开发者工具' },
        { type: 'separator' },
        { role: 'zoomIn', label: '放大' },
        { role: 'zoomOut', label: '缩小' },
        { role: 'resetZoom', label: '重置缩放' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: '全屏' },
      ],
    }
    const template =
      process.platform === 'darwin'
        ? [{ role: 'appMenu' }, { label: '文件', submenu: [{ role: 'quit', label: '退出' }] }, viewMenu]
        : [{ label: '文件', submenu: [{ role: 'quit', label: '退出' }] }, viewMenu]
    Menu.setApplicationMenu(Menu.buildFromTemplate(template))
  }

  /**
   * 注册 app:// 协议处理器，把请求映射到 build/ 目录下的文件。
   * - 默认文档（/ 或空）回落到 index.html
   * - 找不到的路径同样回落 index.html，以支持前端路由的深链接
   * - 通过 path 校验防止目录穿越
   *
   * 注意：打包后 build/ 位于 app.asar 内部，net.fetch(file://) 读不到 asar 里的文件，
   * 因此统一用 fs 读取（Electron 对 asar 路径做了透明支持）再构造 Response。
   */
  function registerAppProtocol() {
    protocol.handle(APP_SCHEME, async (request) => {
      const { pathname } = new URL(request.url)
      const relativePath = decodeURIComponent(pathname === '/' ? '/index.html' : pathname)
      const target = path.resolve(buildDir, `.${relativePath}`)
      const resolvedRoot = path.resolve(buildDir)

      // 防止 ../ 越出 build 目录
      if (target !== resolvedRoot && !target.startsWith(resolvedRoot + path.sep)) {
        trace(`protocol: blocked traversal ${relativePath}`)
        return new Response('Forbidden', { status: 403 })
      }

      let filePath = target
      try {
        if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
          filePath = indexPath
        }
        const data = fs.readFileSync(filePath)
        return new Response(data, {
          status: 200,
          headers: { 'Content-Type': contentTypeFor(filePath) },
        })
      } catch (error) {
        trace(`protocol: failed to serve ${relativePath}: ${error.message}`)
        return new Response('Not Found', { status: 404 })
      }
    })
  }

  app.whenReady().then(() => {
    trace('main: whenReady')
    if (!isDev) registerAppProtocol()
    relaxPronunciationCors()
    buildMenu()
    createWindow()
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })

  app.on('window-all-closed', () => {
    trace('main: window-all-closed')
    if (process.platform !== 'darwin') app.quit()
  })
}

// 主流程入口：必须放在所有顶层 const 定义之后，避免 TDZ 问题
trace(`boot: electron=${process.versions.electron || 'none'} isPackaged=${electronApi ? electronApi.app.isPackaged : 'no-api'}`)

if (!electronApi) {
  // 无法获取 Electron API 时给出终端提示并返回非零码，而不是静默退出
  process.exitCode = 1
} else {
  main()
}
