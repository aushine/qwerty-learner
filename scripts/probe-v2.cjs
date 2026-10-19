/* eslint-disable */
const { chromium } = require('playwright')
const BASE = process.env.BASE || 'http://127.0.0.1:5174'
;(async () => {
  const browser = await chromium.launch()
  const report = []
  const check = (n, ok, extra) => report.push(`${ok ? 'PASS' : 'FAIL'} | ${n}${extra ? ' | ' + extra : ''}`)

  // 1) 入口：hover 整块标题 + 标题切换 + 中文标签
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.addInitScript(() => {
    localStorage.setItem('typingScheme', JSON.stringify('flypy'))
    localStorage.setItem('typingMaterialId', JSON.stringify('zh-flypy-zi-500'))
    localStorage.setItem('typingInputTrack', JSON.stringify('code'))
  })
  await page.goto(BASE + '/', { waitUntil: 'load' })
  await page.waitForTimeout(1200)
  const title0 = await page.textContent('header span span')
  check('默认标题 = Qwerty Learner', title0.trim() === 'Qwerty Learner', title0)
  const block = page.locator('header > div > div').first()
  const boxBefore = await page.evaluate(() => {
    const h = document.querySelector('header')
    const t = document.querySelector('header h1, header span span')
    return { header: h.getBoundingClientRect().height, title: t.getBoundingClientRect().left + ',' + t.getBoundingClientRect().top }
  })
  await block.hover()
  await page.waitForTimeout(400)
  const menuCount = await page.locator('[role="menu"]').count()
  check('hover 展开浮层', menuCount > 0)
  const bg = await block.evaluate((el) => getComputedStyle(el).backgroundColor)
  check('整块有背景色', bg !== 'rgba(0, 0, 0, 0)', bg)
  const boxAfter = await page.evaluate(() => {
    const h = document.querySelector('header')
    const t = document.querySelector('header h1, header span span')
    return { header: h.getBoundingClientRect().height, title: t.getBoundingClientRect().left + ',' + t.getBoundingClientRect().top }
  })
  check('页头高度不变', Math.abs(boxBefore.header - boxAfter.header) <= 1, `${boxBefore.header} vs ${boxAfter.header}`)
  check('标题位置不变', boxBefore.title === boxAfter.title, `${boxBefore.title} vs ${boxAfter.title}`)
  const label = await page.textContent('[data-testid="mode-label"]')
  check('hover 时出现中文标签', label && label.trim() === '学习模式', label)

  // hover 到 Typing Learner 项 → 标题切换
  const items = page.locator('[role="menuitem"]')
  await items.nth(1).hover()
  await page.waitForTimeout(250)
  const titleHover = await page.textContent('header span span')
  const labelHover = await page.textContent('[data-testid="mode-label"]')
  check('hover Typing 项 → 标题切换', titleHover.trim() === 'Typing Learner', titleHover)
  check('标签切换为打字模式', labelHover.trim() === '打字模式', labelHover)

  // 点击进入 typing
  await items.nth(1).click()
  await page.waitForTimeout(1500)
  check('进入 /typing', page.url().endsWith('/typing'), page.url())

  // 2) 键盘溢出检测（三档密度不易触发，先测当前）
  const overflow = await page.evaluate(() => {
    const out = []
    document.querySelectorAll('[data-keycap]').forEach((el) => {
      const ox = el.scrollWidth - el.clientWidth
      const oy = el.scrollHeight - el.clientHeight
      if (ox > 1 || oy > 1) out.push(`${el.dataset.keycap}:${ox}x${oy}`)
    })
    return out
  })
  check('键帽无溢出', overflow.length === 0, overflow.join(', '))

  // L 键两行
  const lKey = await page.evaluate(() => {
    const el = document.querySelector('[data-keycap="KeyL"]')
    if (!el) return null
    return el.innerText.replace(/\n/g, '|')
  })
  check('L 键韵母完整（含 iang/uang）', lKey && lKey.includes('iang') && lKey.includes('uang'), lKey)

  // Win 键：四色方块而非 ⊞
  const winKey = await page.evaluate(() => {
    const el = document.querySelector('[data-keycap="MetaLeft"]')
    if (!el) return null
    const spans = [...el.querySelectorAll('span')].filter((s) => {
      const bg = getComputedStyle(s).backgroundColor
      return bg && bg !== 'rgba(0, 0, 0, 0)'
    })
    return { text: el.innerText.trim(), colored: spans.length }
  })
  check('Win 键为四色图标', winKey && winKey.colored >= 4 && !winKey.text.includes('⊞'), JSON.stringify(winKey))

  // Backspace 不溢出
  const bs = await page.evaluate(() => {
    const el = document.querySelector('[data-keycap="Backspace"]')
    return el ? { ox: el.scrollWidth - el.clientWidth, text: el.innerText.trim() } : null
  })
  check('Backspace 不溢出', bs && bs.ox <= 1, JSON.stringify(bs))

  await page.screenshot({ path: '/tmp/v2-typing.png' })

  // 3) Gallery：Tab 无副文案 + 打字测速 + 难度子胶囊
  await page.goto(BASE + '/typing/gallery', { waitUntil: 'load' })
  await page.waitForTimeout(1200)
  const tabText = await page.locator('[role="radiogroup"]').first().innerText()
  check('Tab 只有中文/英语（无副文案）', tabText.replace(/\s/g, '') === '中文英语', tabText)
  const pills = await page.locator('button').allInnerTexts()
  check('存在「打字测速」', pills.includes('打字测速'), pills.slice(0, 8).join('/'))

  // 点文章胶囊 → 难度子胶囊
  await page.getByText('文章', { exact: true }).first().click()
  await page.waitForTimeout(600)
  const bodyText = await page.locator('body').innerText()
  check('出现难度子胶囊', /入门/.test(bodyText) && /进阶/.test(bodyText) && /挑战/.test(bodyText))
  await page.screenshot({ path: '/tmp/v2-gallery.png' })

  // 4) 章节按钮显示篇名
  await page.addInitScript(() => {
    localStorage.setItem('typingMaterialId', JSON.stringify('zh-wenzhang-shi'))
    localStorage.setItem('typingChapter', JSON.stringify(0))
  })
  await page.goto(BASE + '/typing', { waitUntil: 'load' })
  await page.waitForTimeout(2000)
  const chapterText = await page.evaluate(() => {
    const el = document.querySelector('header [aria-haspopup="listbox"]')
    return el ? el.innerText.trim() : ''
  })
  check('章节按钮显示篇名（静夜思 · 李白）', chapterText.includes('静夜思') && chapterText.includes('李白'), chapterText)
  await page.screenshot({ path: '/tmp/v2-article.png' })

  check('无页面异常', errors.length === 0, errors.join(' | '))
  console.log(report.join('\n'))
  await browser.close()
})()
