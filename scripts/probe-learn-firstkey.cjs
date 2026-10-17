/* eslint-disable */
// 探针：学习模式下第一个按键是否被「按任意键开始」消费
const { chromium } = require('playwright')

;(async () => {
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  const errors = []
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message))

  await page.goto('http://localhost:5199/', { waitUntil: 'load', timeout: 30000 })
  await page.waitForTimeout(3000)

  const dict = await page.evaluate(async () => {
    const r = await fetch('/dicts/CET4_T.json')
    return r.json()
  })
  const firstWord = dict[0]
  console.log('first word:', firstWord.name)

  const wordBox = page.locator('.tooltip-info').first()
  const targetBefore = (await wordBox.textContent().catch(() => '')) || ''
  console.log('word display before:', JSON.stringify(targetBefore.slice(0, 40)))

  // 逐字输入完整单词（含第 1 个字母）
  for (let i = 0; i < firstWord.name.length; i++) {
    await page.keyboard.press(firstWord.name[i])
    await page.waitForTimeout(150)
  }
  await page.waitForTimeout(1200)

  const green = await page.locator('span.text-green-600').count()
  const red = await page.locator('span.text-red-500, span.text-red-600').count()
  console.log('green letters:', green, '| red letters:', red)

  const targetAfter = (await wordBox.textContent().catch(() => '')) || ''
  console.log('word display after:', JSON.stringify(targetAfter.slice(0, 40)))
  console.log('word advanced:', targetBefore !== targetAfter)

  // 计时器是否启动（Speed 卡片显示用时）
  const speedText = await page.locator('.my-card').first().textContent().catch(() => '')
  console.log('speed card:', JSON.stringify(speedText.slice(0, 60)))

  await page.screenshot({ path: '/tmp/learn-mode-probe.png' })
  console.log('PAGEERRORS:', errors.length ? JSON.stringify(errors.slice(0, 3)) : 'none')
  await browser.close()
})().catch((e) => {
  console.error('SCRIPT_ERROR', e)
  process.exit(1)
})
