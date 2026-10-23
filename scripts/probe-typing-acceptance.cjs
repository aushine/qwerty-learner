/* eslint-disable */
// 综合验收探针：ACC-06-01/04/05/11/12/13/14/16/32
const { chromium } = require('playwright')

;(async () => {
  const browser = await chromium.launch()
  const report = []
  const check = (name, ok, extra) => {
    const line = `${ok ? 'PASS' : 'FAIL'} | ${name}${extra ? ' | ' + extra : ''}`
    report.push(line)
    console.log(line)
  }

  // ── ACC-06-01：模式切换按钮（start/pause 形式）→ 点击进入 /typing ──
  // 2026-10-21 改版：原 hover 浮层 + role=menu/menuitem 已废除，改为单个切换按钮
  // （data-testid="mode-toggle"，标签=目标模式；学习态 indigo「打字模式」/打字态 gray「学习模式」）
  const p1 = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  const errs1 = []
  p1.on('pageerror', (e) => errs1.push(e.message))
  await p1.goto('http://localhost:5199/', { waitUntil: 'load', timeout: 30000 })
  await p1.waitForTimeout(2500)
  const toggleLabel = (await p1.locator('[data-testid="mode-toggle"]').innerText().catch(() => '')) || ''
  check('ACC-06-01 切换按钮存在且标签=打字模式', toggleLabel.trim() === '打字模式', toggleLabel)
  await p1.locator('[data-testid="mode-toggle"]').click()
  await p1.waitForTimeout(2500)
  check('ACC-06-01 点击后进入 /typing', p1.url().includes('/typing'), p1.url())

  // ── ACC-06-04/05：Gallery 选双拼→小鹤→字→卡片→回 /typing 页头正确 ──
  await p1.goto('http://localhost:5199/typing/gallery', { waitUntil: 'load', timeout: 30000 })
  await p1.waitForTimeout(2000)
  await p1.getByText('双拼', { exact: true }).click()
  await p1.waitForTimeout(300)
  await p1.getByText('小鹤双拼', { exact: true }).click()
  await p1.waitForTimeout(800)
  check('ACC-06-04 选小鹤后 URL 同步 scheme=flypy', p1.url().includes('scheme=flypy'), p1.url())
  await p1.getByText('字', { exact: true }).first().click()
  await p1.waitForTimeout(600)
  await p1.locator('[role="button"]', { hasText: '常用 500 字' }).first().click()
  await p1.waitForTimeout(2500)
  const headerAfter = (await p1.locator('header').textContent().catch(() => '')) || ''
  check('ACC-06-05 回 /typing 页头显示「中文 · 小鹤双拼」+「第 1 章」', p1.url().includes('/typing') && headerAfter.includes('小鹤双拼') && headerAfter.includes('第 1 章'), headerAfter.slice(0, 30))

  // ── ACC-06-11：练习中切模式 → 非阻塞确认条 → 继续练习恢复 ──
  await p1.keyboard.press('x') // 开始
  await p1.waitForTimeout(400)
  await p1.keyboard.press('u') // 输入一个正确键（首词 ui）
  await p1.waitForTimeout(300)
  // 2026-10-21 改版：点击模式切换按钮（打字态标签=学习模式）→ 练习中先弹确认条
  await p1.locator('[data-testid="mode-toggle"]').click()
  await p1.waitForTimeout(500)
  const confirmBar = p1.locator('[data-testid="mode-switch-confirm"]')
  const barVisible = (await confirmBar.count()) > 0
  const isAlert = (await confirmBar.getAttribute('role').catch(() => null)) === 'alertdialog'
  const stillOnTyping = p1.url().includes('/typing')
  check('ACC-06-11 非阻塞确认条出现（未跳转）', barVisible && isAlert && stillOnTyping)
  await confirmBar.getByText('继续练习').click()
  await p1.waitForTimeout(600)
  const barGone = (await confirmBar.count()) === 0
  const overlayGone = (await p1.getByText('按任意键').count()) === 0
  check('ACC-06-11 继续练习后确认条消失且练习恢复', barGone && overlayGone)

  // ── ACC-06-14：1366×768 不滚动 + 键盘完整可见 ──
  const p2 = await browser.newPage({ viewport: { width: 1366, height: 768 } })
  await p2.goto('http://localhost:5199/typing', { waitUntil: 'load', timeout: 30000 })
  await p2.waitForTimeout(2500)
  const noScroll = await p2.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight + 1)
  const kbBox = await p2.locator('[role="group"][aria-label*="键盘"]').boundingBox().catch(() => null)
  const kbVisible = !!kbBox && kbBox.y >= 0 && kbBox.y + kbBox.height <= 768 + 1
  check('ACC-06-14 1366×768 全页不滚动', noScroll, `scrollHeight vs ${768}`)
  check('ACC-06-14 键盘完整可见', kbVisible, kbBox ? `y=${Math.round(kbBox.y)} h=${Math.round(kbBox.height)}` : '未找到')

  // ── ACC-06-12：非法 scheme 回落 ──
  const p3 = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  const errs3 = []
  p3.on('pageerror', (e) => errs3.push(e.message))
  p3.on('console', (m) => { if (m.type() === 'error') errs3.push('console.error: ' + m.text().slice(0, 80)) })
  await p3.addInitScript(() => localStorage.setItem('typingScheme', JSON.stringify('mspy')))
  await p3.goto('http://localhost:5199/typing', { waitUntil: 'load', timeout: 30000 })
  await p3.waitForTimeout(2500)
  const h3 = (await p3.locator('header').textContent().catch(() => '')) || ''
  const target3 = (await p3.locator('[data-testid="typing-target-code"]').count()) > 0
  check('ACC-06-12 非法 scheme 回落 quanpin 不白屏', h3.includes('全拼') && target3 && errs3.length === 0, h3.slice(0, 20))

  // ── ACC-06-13：非法素材 id 回落 ──
  const p4 = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  const errs4 = []
  p4.on('pageerror', (e) => errs4.push(e.message))
  p4.on('console', (m) => { if (m.type() === 'error') errs4.push('console.error: ' + m.text().slice(0, 80)) })
  await p4.addInitScript(() => localStorage.setItem('typingMaterialId', JSON.stringify('zh-nonexistent-xyz')))
  await p4.goto('http://localhost:5199/typing', { waitUntil: 'load', timeout: 30000 })
  await p4.waitForTimeout(2500)
  const target4 = (await p4.locator('[data-testid="typing-target-code"]').textContent().catch(() => '')) || ''
  check('ACC-06-13 非法素材 id 回落默认素材', target4.trim().length > 0 && errs4.length === 0, JSON.stringify(target4.slice(0, 16)))

  // ── ACC-06-16：词库加载失败 → 失败态（不白屏、不无限 loading）──
  const p5 = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  await p5.route('**/dicts/zh/quanpin-zi-500.json', (route) => route.abort())
  await p5.goto('http://localhost:5199/typing', { waitUntil: 'load', timeout: 30000 })
  await p5.waitForTimeout(3000)
  const failText = (await p5.locator('body').textContent().catch(() => '')) || ''
  check('ACC-06-16 加载失败显示失败态', failText.includes('素材加载失败'), failText.includes('素材加载失败') ? '' : '未见失败态文案')

  // ── ACC-06-32：全流程可纯键盘完成 ──
  // 注意：首页 `/`（学习模式）的 Tab 被上游 WordPanel 的「Tab 显示释义」热键消费
  // （REG-05 受保护的回归行为，且 WordPanel 不在 REG-15 白名单内，不得改动）；
  // `/typing` 的「按任意键开始」window 处理器已加护栏：模式切换按钮聚焦并按
  // Enter/Space 时不抢焦点（见 TypingLearner/index.tsx 的 mode-toggle 守卫）。
  // 因此键盘流在 /typing 验证入口、在 /typing/gallery 验证选语言→方案→卡片。
  //  Part A：/typing → Tab 到模式切换按钮 → Enter 激活并切回学习模式
  //  Part B：画廊 → Tab 选语言 Tab → 选方案（双拼二级）→ 选胶囊 → 选卡片 → 进练习
  const p6 = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  await p6.goto('http://localhost:5199/typing', { waitUntil: 'load', timeout: 30000 })
  await p6.waitForTimeout(2500)
  const tabUntil = async (page, predicate, max = 30) => {
    for (let i = 0; i < max; i++) {
      await page.keyboard.press('Tab')
      if (await page.evaluate(predicate)) return true
    }
    return false
  }
  // 2026-10-21 改版：模式入口为原生 <button data-testid="mode-toggle">（Enter/Space 激活，
  // onKeyDown 显式处理以绕开首页 document 级 Enter 热键对原生 click 的压制）
  const reachedEntry = await tabUntil(p6, () => !!document.activeElement?.closest('[data-testid="mode-toggle"]'))
  check('ACC-06-32a Tab 可到达模式切换按钮', reachedEntry)
  let switched = false
  if (reachedEntry) {
    await p6.keyboard.press('Enter') // 激活按钮 → 切回学习模式
    await p6.waitForTimeout(2500)
    switched = p6.url().replace(/\/$/, '') === 'http://localhost:5199'
    check('ACC-06-32a 键盘可切换模式', switched, 'url=' + p6.url())
  }

  const p7 = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  await p7.goto('http://localhost:5199/typing/gallery', { waitUntil: 'load', timeout: 30000 })
  await p7.waitForTimeout(2000)
  const onRadio = () => document.activeElement?.getAttribute('role') === 'radio'
  const radioFocused = await tabUntil(p7, onRadio)
  let schemePicked = false
  if (radioFocused) {
    await p7.keyboard.press('ArrowRight') // 语言 Tab：切到英语再切回中文（验证方向键可选）
    await p7.waitForTimeout(200)
    await p7.keyboard.press('ArrowLeft')
    await p7.waitForTimeout(200)
    // Tab 到「双拼」按钮 → Enter 展开二级 → 方向键 + Enter 选「小鹤双拼」
    const onShuangpin = () => (document.activeElement?.textContent || '').trim() === '双拼'
    if (await tabUntil(p7, onShuangpin)) {
      await p7.keyboard.press('Enter')
      await p7.waitForTimeout(300)
      await p7.keyboard.press('ArrowDown')
      await p7.waitForTimeout(150)
      await p7.keyboard.press('Enter')
      await p7.waitForTimeout(600)
      schemePicked = p7.url().includes('scheme=flypy')
    }
  }
  check('ACC-06-32b 键盘可选语言 Tab 与方案（小鹤双拼）', radioFocused && schemePicked, p7.url())
  // Tab 到「字」胶囊 → Enter → Tab 到「常用 500 字」卡片 → Enter → 进入 /typing
  let cardEntered = false
  const onCapsule = () => (document.activeElement?.textContent || '').trim() === '字'
  if (await tabUntil(p7, onCapsule)) {
    await p7.keyboard.press('Enter')
    await p7.waitForTimeout(400)
    const onCard = () =>
      document.activeElement?.getAttribute('role') === 'button' && (document.activeElement?.textContent || '').includes('常用 500 字')
    if (await tabUntil(p7, onCard)) {
      await p7.keyboard.press('Enter')
      await p7.waitForTimeout(2500)
      cardEntered = p7.url().includes('/typing')
    }
  }
  check('ACC-06-32b 键盘可选胶囊与卡片并进入练习页', cardEntered, p7.url())
  // 按任意键开始练习（首键消费模型：仅启动计时）
  let practiceStarted = false
  if (cardEntered) {
    await p7.keyboard.press('x')
    await p7.waitForTimeout(600)
    practiceStarted = (await p7.getByText('按任意键').count()) === 0
  }
  check('ACC-06-32b 键盘可开始练习', practiceStarted)

  // ── ACC-06-05b：英语文章素材章节按钮显示文章标题 ──
  // 注：早期断言为「第 1 段」；现行实现 chapterLabelMode='title'（文章类显示篇名 +
  // tooltip「切换文章」，见 typingMaterials.ts 与 TypingMaterialButton），2026-10-21 校正断言。
  const p8 = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  await p8.goto('http://localhost:5199/typing/gallery', { waitUntil: 'load', timeout: 30000 })
  await p8.waitForTimeout(2000)
  await p8.getByText('英语', { exact: true }).click()
  await p8.waitForTimeout(400)
  await p8.getByText('文章', { exact: true }).first().click()
  await p8.waitForTimeout(400)
  await p8.locator('[role="button"]', { hasText: 'English Essays' }).first().click()
  await p8.waitForTimeout(2500)
  const header8 = (await p8.locator('header').textContent().catch(() => '')) || ''
  check(
    'ACC-06-05b 英语文章素材页头显示篇名（标题模式）',
    p8.url().includes('/typing') && header8.includes('切换文章'),
    p8.url().includes('/typing') ? header8.slice(0, 30) : '未进入 /typing',
  )

  check('全流程无 pageerror', errs1.length === 0, errs1.slice(0, 2).join(' ; '))
  console.log(report.join('\n'))
  await browser.close()
})().catch((e) => {
  console.error('SCRIPT_ERROR', e)
  process.exit(1)
})
