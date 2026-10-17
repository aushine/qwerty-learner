/* eslint-disable */
// 深色模式走查（ACC-06-18）：/typing 与 /typing/gallery 在深色下清晰可读
const { chromium } = require('playwright')

;(async () => {
  const browser = await chromium.launch()
  const report = []
  const check = (name, ok, extra) => report.push(`${ok ? 'PASS' : 'FAIL'} | ${name}${extra ? ' | ' + extra : ''}`)

  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, colorScheme: 'dark' })
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))

  await page.addInitScript(() => {
    localStorage.setItem('typingScheme', JSON.stringify('flypy'))
    localStorage.setItem('typingMaterialId', JSON.stringify('zh-flypy-zi-500'))
  })

  // ── /typing 深色 ──
  await page.goto('http://localhost:5199/typing', { waitUntil: 'load', timeout: 30000 })
  await page.waitForTimeout(3000)
  const isDark = await page.evaluate(() => document.documentElement.classList.contains('dark'))
  check('深色类已应用', isDark)

  // 键盘卡片：深色底 + 浅色字
  const kbStyle = await page.evaluate(() => {
    const kb = document.querySelector('[role="group"][aria-label*="键盘"]')
    if (!kb) return null
    const s = getComputedStyle(kb)
    const key = kb.querySelector('div[aria-label^="Q 键"]')
    const ks = key ? getComputedStyle(key) : null
    const main = key ? key.querySelector('span') : null
    const ms = main ? getComputedStyle(main) : null
    return {
      kbBg: s.backgroundColor,
      kbColor: s.color,
      keyBg: ks ? ks.backgroundColor : null,
      mainColor: ms ? ms.color : null,
    }
  })
  // 深色下：键盘卡片应为深色（gray-800 = rgb(31,41,55)），主字母应为浅色
  const darkBg = kbStyle && /rgb\((31|55|17), /.test(kbStyle.kbBg)
  const lightText = kbStyle && kbStyle.mainColor && /rgb\(2[0-9]{2}, 2[0-9]{2}, 2[0-9]{2}\)|rgb\(255/.test(kbStyle.mainColor)
  check('深色模式键盘卡片深底浅字', !!kbStyle && darkBg && lightText, JSON.stringify(kbStyle))

  await page.screenshot({ path: '/tmp/dark-typing.png' })

  // ── /typing/gallery 深色 ──
  await page.goto('http://localhost:5199/typing/gallery', { waitUntil: 'load', timeout: 30000 })
  await page.waitForTimeout(2500)
  const galleryBodyBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor)
  check('深色模式 Gallery 页面渲染', (await page.locator('body').textContent().catch(() => '')).includes('中文'), galleryBodyBg)
  await page.screenshot({ path: '/tmp/dark-gallery.png' })

  check('深色流程无 pageerror', errors.length === 0, errors.slice(0, 2).join(' ; '))
  console.log(report.join('\n'))
  await browser.close()
})().catch((e) => {
  console.error('SCRIPT_ERROR', e)
  process.exit(1)
})
