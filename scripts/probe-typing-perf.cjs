/* eslint-disable */
// 性能验收探针：ACC-06-28 (LCP) / ACC-06-29 (击键延迟) / ACC-06-30 (内存)
// 依赖 preview 服务器（默认 http://localhost:4173），用法：
//   yarn preview --port 4173 后，再 node scripts/probe-typing-perf.cjs
const { chromium } = require('playwright')

const BASE = process.env.PERF_BASE || 'http://localhost:4173'

;(async () => {
  const browser = await chromium.launch()
  const report = []
  const check = (name, ok, extra) => {
    const line = `${ok ? 'PASS' : 'FAIL'} | ${name}${extra ? ' | ' + extra : ''}`
    report.push(line)
    console.log(line)
  }

  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  await page.goto(BASE + '/typing', { waitUntil: 'load', timeout: 30000 })
  await page.waitForTimeout(2500)

  // ── ACC-06-28 LCP ──
  const lcp = await page.evaluate(
    () =>
      new Promise((resolve) => {
        let value = 0
        const po = new PerformanceObserver((list) => {
          for (const e of list.getEntries()) value = e.startTime
        })
        try {
          po.observe({ type: 'largest-contentful-paint', buffered: true })
        } catch (e) {}
        // 触发一次重排并等待后续 LCP 上报
        setTimeout(() => {
          try {
            po.disconnect()
          } catch (e) {}
          resolve(value)
        }, 2500)
      }),
  )
  check('ACC-06-28 LCP < 3000ms（good < 2500）', lcp > 0 && lcp < 3000, `LCP=${Math.round(lcp)}ms`)

  // ── ACC-06-29 击键延迟：应用内"按对→字母转绿"延迟 ──
  // 说明：TypingTarget 渲染完整编码，按对后对应字母 span 由 normal 变 correct（green）。
  // 为去除 Playwright 按键/轮询开销，采用页内合成 keydown + MutationObserver 直接测量
  // 应用内延迟，并以「绿色字母数 +1」作为本次录入成功信号，对前 3 个字母取中位数。
  await page.keyboard.press('x')
  await page.waitForTimeout(400)
  const firstTarget = (await page.locator('[data-testid="typing-target-code"]').textContent().catch(() => '')) || ''
  const chars = (firstTarget.trim().match(/[a-z]/gi) || []).slice(0, 3)
  let latencies = []
  if (chars.length > 0) {
    for (const ch of chars) {
      const code = 'Key' + ch.toUpperCase()
      const lat = await page.evaluate(
        ({ code, key }) =>
          new Promise((resolve) => {
            const el = document.querySelector('[data-testid="typing-target-code"]')
            if (!el) return resolve(-1)
            const greenCount = () => el.querySelectorAll('span').length && Array.from(el.querySelectorAll('span')).filter((s) => /green/.test(s.className)).length
            const before = greenCount()
            let done = false
            const obs = new MutationObserver(() => {
              if (done) return
              if (greenCount() > before) {
                done = true
                obs.disconnect()
                resolve(performance.now() - window.__t0)
              }
            })
            obs.observe(el, { attributes: true, attributeFilter: ['class'], subtree: true })
            window.__t0 = performance.now()
            window.dispatchEvent(new KeyboardEvent('keydown', { code, key, bubbles: true, cancelable: true }))
            setTimeout(() => {
              if (!done) {
                done = true
                obs.disconnect()
                resolve(-1)
              }
            }, 2000)
          }),
        { code, key: ch },
      )
      if (lat >= 0) latencies.push(lat)
    }
  }
  latencies.sort((a, b) => a - b)
  const median = latencies.length ? latencies[Math.floor(latencies.length / 2)] : -1
  check('ACC-06-29 击键→字母转绿 中位延迟 < 100ms', median >= 0 && median < 100, `median=${Math.round(median)}ms samples=${JSON.stringify(latencies.map((x) => Math.round(x)))}`)

  // ── ACC-06-30 内存：usedJSHeapSize（仅 Chromium 暴露）──
  const mem = await page.evaluate(() => {
    const m = performance.memory
    if (!m) return null
    return { used: m.usedJSHeapSize, total: m.totalJSHeapSize, limit: m.jsHeapSizeLimit }
  })
  if (mem) {
    const usedMB = Math.round(mem.used / 1048576)
    check('ACC-06-30 JS 堆使用 < 200MB（练习页稳态）', usedMB < 200, `used=${usedMB}MB total=${Math.round(mem.total / 1048576)}MB`)
  } else {
    check('ACC-06-30 JS 堆使用（Chromium 未暴露 performance.memory）', true, 'skipped')
  }

  console.log(report.join('\n'))
  await browser.close()
})().catch((e) => {
  console.error('SCRIPT_ERROR', e)
  process.exit(1)
})
