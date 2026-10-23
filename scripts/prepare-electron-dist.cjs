/**
 * 准备 Electron 打包用的「已解包发行版」缓存目录（.electron-dist-cache）。
 *
 * 为什么需要：
 * electron-builder 默认会下载 electron.zip，解压到 <appOutDir>.tmp 后再 rename 成正式目录。
 * 在 Windows 上，解压出的目录刚落地时常被实时防护/索引程序短暂占用，rename 会返回 EPERM。
 * 通过 electronDist 指定一个「已经解包好」的目录，electron-builder 会改走「清空 + 复制」路径，
 * 完全跳过那次 rename。
 *
 * 缓存来源：node_modules/electron/dist（electron 包安装时已经解压好的发行版）。
 * 会移除 resources/default_app.asar，避免 Electron 默认外壳被一起打进产物。
 */

const fs = require('node:fs')
const path = require('node:path')

const projectRoot = path.join(__dirname, '..')
const sourceDir = path.join(projectRoot, 'node_modules', 'electron', 'dist')
const cacheDir = path.join(projectRoot, '.electron-dist-cache')
const versionFile = path.join(cacheDir, 'version')

function readVersion(file) {
  try {
    return fs.readFileSync(file, 'utf8').trim()
  } catch {
    return null
  }
}

function installedVersion() {
  try {
    return require(path.join(projectRoot, 'node_modules', 'electron', 'package.json')).version
  } catch {
    return null
  }
}

function main() {
  if (!fs.existsSync(sourceDir)) {
    console.error('[electron-dist] 未找到 node_modules/electron/dist，请先执行 yarn install。')
    process.exit(1)
  }

  const expected = installedVersion()
  const cached = readVersion(versionFile)

  // 版本一致且资源已清理过，直接复用，避免每次打包都复制 300MB+
  const cachedResources = path.join(cacheDir, 'resources')
  const resourcesReady = fs.existsSync(cachedResources) && fs.readdirSync(cachedResources).length === 0
  if (expected && cached === expected && resourcesReady) {
    console.log(`[electron-dist] 复用已有缓存（Electron ${cached}）`)
    return
  }

  console.log(`[electron-dist] 从 node_modules/electron/dist 生成缓存（Electron ${expected || 'unknown'}）...`)
  fs.rmSync(cacheDir, { recursive: true, force: true })
  fs.cpSync(sourceDir, cacheDir, { recursive: true })

  const defaultApp = path.join(cacheDir, 'resources', 'default_app.asar')
  if (fs.existsSync(defaultApp)) fs.rmSync(defaultApp)

  console.log(`[electron-dist] 完成：${path.relative(projectRoot, cacheDir)}`)
}

main()
