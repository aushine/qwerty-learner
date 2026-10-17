/* eslint-disable */
// 学习模式零回归探针（REG-01/08/10/12 + 控制台零错误）
const { chromium } = require('playwright')

const ROUTES = [
  { path: '/', name: 'REG-01/10 学习模式主页', expect: ['Qwerty Learner', 'CET-4'] },
  { path: '/gallery', name: 'REG-10 词典选择页', expect: ['词典'] },
  { path: '/error-book', name: 'REG-10 错词本', expect: ['单词'] },
  { path: '/friend-links', name: 'REG-10 友情链接', expect: [] },
]

;(async () => {
  const browser = await chromium.launch()
  const report = []
  const check = (name, ok, extra) => report.push(`${ok ? 'PASS' : 'FAIL'} | ${name}${extra ? ' | ' + extra : ''}`)

  // ── 桌面端：各路由可达 + 无 pageerror ──
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  const pageErrors = []
  page.on('pageerror', (e) => pageErrors.push(e.message))

  for (const route of ROUTES) {
    try {
      const resp = await page.goto('http://localhost:5199' + route.path, { waitUntil: 'load', timeout: 20000 })
      await page.waitForTimeout(1800)
      const status = resp?.status() ?? 0
      const bodyText = (await page.locator('body').textContent().catch(() => '')) || ''
      const missing = route.expect.filter((t) => !bodyText.includes(t))
      check(`${route.name}（HTTP ${status}）`, status === 200 && missing.length === 0, missing.length ? `缺少文案: ${missing.join(',')}` : '')
    } catch (e) {
      check(`${route.name}（导航异常）`, false, e.message.slice(0, 80))
    }
  }

  // ── REG-01：默认 CET4 第 1 章，可正常开始 ──
  await page.goto('http://localhost:5199/', { waitUntil: 'load', timeout: 20000 })
  await page.waitForTimeout(2500)
  const headerText = (await page.locator('header').textContent().catch(() => '')) || ''
  check('REG-01 页头显示 CET-4 + 第 1 章', headerText.includes('CET-4') && headerText.includes('第 1 章'), headerText.slice(0, 40))

  // ── REG-01：完整打完一个词（首键被开始处理器消费，与基线一致）──
  const dict = await page.evaluate(async () => {
    const r = await fetch('/dicts/CET4_T.json')
    return r.json()
  })
  const w = dict[0]
  await page.keyboard.press('x') // 开始（被消费，不计入输入）
  await page.waitForTimeout(300)
  for (let i = 0; i < w.name.length; i++) {
    await page.keyboard.press(w.name[i])
    await page.waitForTimeout(150)
  }
  await page.waitForTimeout(1500)

  const speedCard = (await page.locator('.my-card').last().textContent().catch(() => '')) || ''
  const timerRunning = /00:0[1-9]/.test(speedCard)
  const inputCount = (speedCard.match(/(\d+)输入数/) || [])[1]
  check('REG-01 按键后计时启动', timerRunning, speedCard.slice(0, 20))
  check('REG-01 输入计数与基线一致（首键消费）', inputCount === String(w.name.length), `输入数=${inputCount}，词长=${w.name.length}`)

  // ── REG-08：统计页图表（此时已有 1 条 wordRecord）──
  await page.goto('http://localhost:5199/analysis', { waitUntil: 'load', timeout: 20000 })
  await page.waitForTimeout(6000)
  const analysisBody = (await page.locator('body').textContent().catch(() => '')) || ''
  check('REG-08 统计页图表正常（有数据出热力图/趋势图）', analysisBody.includes('热力图') || analysisBody.includes('趋势图'), analysisBody.includes('暂无练习数据') ? '空态' : '有图表')

  await page.screenshot({ path: '/tmp/reg-learn-mode.png' })

  // ── REG-12：移动端 UA → /mobile ──
  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1' })
  const mobileErrors = []
  mobile.on('pageerror', (e) => mobileErrors.push(e.message))
  await mobile.goto('http://localhost:5199/', { waitUntil: 'load', timeout: 20000 })
  await mobile.waitForTimeout(2000)
  const mobileUrl = mobile.url()
  const mobileBody = (await mobile.locator('body').textContent().catch(() => '')) || ''
  check('REG-12 手机 UA 跳转 /mobile', mobileUrl.includes('/mobile') || mobileBody.includes('手机'), mobileUrl)

  check('全流程无 pageerror', pageErrors.length === 0 && mobileErrors.length === 0, pageErrors.concat(mobileErrors).slice(0, 2).join(' ; '))

  console.log(report.join('\n'))
  await browser.close()
})().catch((e) => {
  console.error('SCRIPT_ERROR', e)
  process.exit(1)
})
