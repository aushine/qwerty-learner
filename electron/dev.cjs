/**
 * 开发模式联动脚本：一条命令同时拉起 Vite dev server 和 Electron。
 *   yarn electron:dev
 * 无第三方依赖：用 node 内置 net 轮询端口，Vite 就绪后再启动 Electron。
 * 退出时（Ctrl+C 或任一子进程结束）会一并收掉另一个进程。
 */

const { spawn } = require('node:child_process')
const net = require('node:net')

const port = Number(process.env.PORT || 5173)
const startUrl = `http://localhost:${port}`
const children = []

function shutdown(code = 0) {
  for (const child of children) {
    if (child.exitCode === null && child.pid !== undefined) {
      try {
        child.kill()
      } catch {
        /* 进程可能已退出，忽略 */
      }
    }
  }
  process.exit(code)
}

function waitForPort(targetPort, timeout = 60000) {
  const startedAt = Date.now()
  return new Promise((resolve, reject) => {
    const attempt = () => {
      const socket = net.connect({ host: '127.0.0.1', port: targetPort })
      socket.once('connect', () => {
        socket.destroy()
        resolve()
      })
      socket.once('error', () => {
        socket.destroy()
        if (Date.now() - startedAt > timeout) {
          reject(new Error(`等待 Vite 服务超时（${timeout / 1000}s）：${startUrl}`))
          return
        }
        setTimeout(attempt, 300)
      })
    }
    attempt()
  })
}

async function main() {
  console.log(`[electron:dev] 启动 Vite dev server（端口 ${port}）...`)
  const vite = spawn('yarn', ['start'], { stdio: 'inherit', shell: true, env: process.env })
  children.push(vite)
  vite.on('exit', (code) => {
    console.error(`[electron:dev] Vite 已退出（code=${code}）。若端口被占用，请先结束已运行的 dev server。`)
    shutdown(code ?? 0)
  })

  await waitForPort(port)
  console.log(`[electron:dev] Vite 就绪，启动 Electron 并加载 ${startUrl}`)

  const electron = spawn('electron', ['.'], {
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, ELECTRON_START_URL: startUrl, NODE_ENV: 'development' },
  })
  children.push(electron)
  electron.on('exit', (code) => shutdown(code ?? 0))
}

process.on('SIGINT', () => shutdown(0))
process.on('SIGTERM', () => shutdown(0))

main().catch((err) => {
  console.error(`[electron:dev] ${err.message}`)
  shutdown(1)
})
