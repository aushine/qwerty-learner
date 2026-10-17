/* eslint-disable */
// E2E 冒烟测试：打字模式主流程（spec-20261017-v1 / 06 ACC-06-02/03/05/06/07）
const { chromium } = require('playwright')

;(async () => {
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  const errors = []
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text())
  })
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message))

  const report = []
  const check = (name, ok, extra) => {
    report.push(`${ok ? 'PASS' : 'FAIL'} | ${name}${extra ? ' | ' + extra : ''}`)
  }

  // ── 1. /typing 主页渲染 ──
  await page.goto('http://localhost:5199/typing', { waitUntil: 'load', timeout: 30000 })
  await page.waitForTimeout(3000)

  const headerEntry = await page.locator('header nav a[href="/typing/gallery"]').textContent().catch(() => null)
  check('ACC-06-02 页头首个按钮为「中文 · 全拼」', headerEntry?.includes('中文') && headerEntry?.includes('全拼'), headerEntry)

  const keyboard = page.locator('[role="group"][aria-label*="键盘"]')
  check('键盘渲染（role=group）', (await keyboard.count()) > 0)

  const speedCard = await page.locator('.my-card').filter({ hasText: '字/分' }).count()
  check('Speed 卡片含「字/分」标签', speedCard > 0)

  const target = page.locator('[data-testid="typing-target-code"]')
  check('题面区渲染', (await target.count()) > 0)

  // 读取目标编码
  const targetText = (await target.textContent().catch(() => '')) || ''
  check('题面显示目标编码', targetText.trim().length > 0, JSON.stringify(targetText.slice(0, 40)))

  // 「按任意键开始」覆盖层
  const overlay = await page.getByText('按任意键').count()
  check('未开始时显示「按任意键开始」', overlay > 0)

  // ── 2. 输入正确编码 ──
  // 从词典 JSON 推导当前题编码（默认素材 zh-quanpin-zi-500 第 1 章前 10 字）
  const dict = await page.evaluate(async () => {
    const r = await fetch('/dicts/zh/quanpin-zi-500.json')
    return r.json()
  })
  const firstWord = dict[0]
  check('默认素材首个编码可读取', typeof firstWord.name === 'string' && firstWord.name.length > 0, `${firstWord.notation} -> ${firstWord.name}`)

  // 按任意键开始：首个按键仅启动计时（被「按任意键开始」处理器 preventDefault 消费，
  // 不计入输入——与学习模式同口径，spec 02 §5.4「沿用」+ ACC-06-06 键盘首键仍高亮）
  await page.keyboard.press(firstWord.name[0])
  await page.waitForTimeout(400)

  // 输入后：覆盖层消失（isTyping=true）
  const overlayAfter = await page.getByText('按任意键').count()
  check('按键后覆盖层消失（计时启动）', overlayAfter === 0)

  // 逐字输入完整编码（首字母需重新输入：开始那一击不计入）
  for (let i = 0; i < firstWord.name.length - 1; i++) {
    await page.keyboard.press(firstWord.name[i])
    await page.waitForTimeout(120)
  }
  await page.waitForTimeout(300)

  // 完成前：已输入字母应为绿色正确态（最后一个字母尚未输入）
  const greenCount = await page.locator('[data-testid="typing-target-code"] span.text-green-600, [data-testid="typing-target-code"] span.dark\\:text-green-400').count()
  check('正确字母渲染绿色态', greenCount === firstWord.name.length - 1, `green=${greenCount}/${firstWord.name.length - 1}`)

  // 输入最后一个字母 → 打完自动进入下一题
  await page.keyboard.press(firstWord.name[firstWord.name.length - 1])
  await page.waitForTimeout(800)

  const targetText2 = (await target.textContent().catch(() => '')) || ''
  check('打完自动进入下一题', targetText2 !== targetText, `before=${targetText.slice(0, 12)} after=${targetText2.slice(0, 12)}`)

  // ── 3. 键盘高亮（当前键 indigo） ──
  const highlighted = await page.locator('[role="group"][aria-label*="键盘"] .bg-indigo-500').count()
  check('键盘当前键高亮（indigo-500 实心）', highlighted >= 1, `highlighted=${highlighted}`)

  // ── 4. /typing/gallery 选择页 ──
  await page.goto('http://localhost:5199/typing/gallery', { waitUntil: 'load', timeout: 30000 })
  await page.waitForTimeout(1500)

  const tabs = await page.locator('header, main').getByText('中文', { exact: true }).count()
  check('GAL-03 语言 Tab「中文」存在', tabs > 0)
  const enTab = await page.getByText('英语', { exact: true }).count()
  check('语言 Tab「英语」存在', enTab > 0)

  const schemeBtn = await page.getByText('全拼', { exact: true }).count()
  check('输入方式「全拼」按钮存在', schemeBtn > 0)
  const flypyBtn = await page.getByText('双拼', { exact: true }).count()
  check('输入方式「双拼」按钮存在', flypyBtn > 0)

  const cardCount = await page.locator('[role="button"][title]').count()
  check('素材卡片渲染', cardCount > 0, `cards=${cardCount}`)

  const copyright = await page.getByText('中文练习素材来源').count()
  check('GAL-11-1 版权署名句存在', copyright > 0)

  await page.screenshot({ path: '/tmp/typing-gallery.png', fullPage: false })
  await page.goto('http://localhost:5199/typing', { waitUntil: 'load', timeout: 30000 })
  await page.waitForTimeout(2000)
  await page.screenshot({ path: '/tmp/typing-main.png', fullPage: false })

  console.log(report.join('\n'))
  console.log('CONSOLE_ERRORS:', errors.length ? JSON.stringify(errors.slice(0, 8), null, 1) : 'none')
  await browser.close()
})().catch((e) => {
  console.error('SCRIPT_ERROR', e)
  process.exit(1)
})
