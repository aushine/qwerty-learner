/* eslint-disable */
const { chromium } = require('playwright')
const BASE = process.env.BASE || 'http://127.0.0.1:5174'
;(async () => {
  const b = await chromium.launch()
  const report = []
  const check = (n, ok, extra) => report.push(`${ok ? 'PASS' : 'FAIL'} | ${n}${extra ? ' | ' + extra : ''}`)
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } })
  const errors = []
  p.on('pageerror', (e) => errors.push(e.message))

  await p.addInitScript(() => {
    localStorage.setItem('typingMaterialId', JSON.stringify('zh-flypy-chengyu-500'))
    localStorage.setItem('typingInputTrack', JSON.stringify('ime'))
  })
  await p.goto(BASE + '/typing', { waitUntil: 'load' })
  await p.waitForTimeout(2500)

  check('上屏轨不显示键盘', (await p.locator('[data-keycap]').count()) === 0)
  check('上屏轨显示 UpstreamTarget', (await p.locator('[data-testid="upstream-target"]').count()) === 1)

  // 从题面 DOM 读真实目标（素材章节可能被随机化，不能假设是第 0 条）
  const first = await p.evaluate(() => {
    const spans = [...document.querySelectorAll('[data-testid="upstream-target"] .whitespace-pre')]
    return spans.map((s) => s.textContent).join('')
  })
  console.log('target sample:', first.slice(0, 20))

  // 点击覆盖层开始（上屏轨下按任意字母会被对码轨残留 handler 抢先判定，故先用鼠标）
  // 直接点击题面区域中心（覆盖层 z-10 在题面之上，点它即可触发 keydown 前先聚焦）
  await p.locator('[aria-label="开始练习"], [aria-label="继续练习"]').first().click({ force: true })
  await p.waitForTimeout(500)
  const typingStarted = await p.evaluate(() => !!document.querySelector('textarea[aria-label="打字测速输入"]'))
  console.log('typing started:', typingStarted)

  // 模拟 composition 上屏前 6 个字符（一次上屏多字，验证 B3：全部校验）
  const chunk = first.slice(0, 4)
  // 模拟真实输入法：compositionstart → input(isComposing) → compositionend（必须 bubbles）
  await p.evaluate((text) => {
    const ta = document.querySelector('textarea[aria-label="打字测速输入"]')
    ta.focus()
    ta.dispatchEvent(new KeyboardEvent('keydown', { key: 'y', bubbles: true }))
    ta.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true, data: '' }))
    ta.value = 'y'
    ta.dispatchEvent(new InputEvent('input', { bubbles: true, isComposing: true, data: 'y' }))
    ta.value = ''
    ta.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: text }))
  }, chunk)
  await p.waitForTimeout(600)

  const state = await p.evaluate(() => {
    const spans = [...document.querySelectorAll('[data-testid="upstream-target"] .whitespace-pre')]
    return { green: spans.filter((s) => /text-green/.test(s.className)).length, red: spans.filter((s) => /text-red/.test(s.className)).length, total: spans.length }
  })
  check('一次上屏多字全部校验（4 字全绿）', state.green === 4, JSON.stringify(state))

  // markOnly：再上屏一段错误内容不应清空已正确部分
  await p.evaluate(() => {
    const ta = document.querySelector('textarea[aria-label="打字测速输入"]')
    ta.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true, data: '' }))
    ta.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: '错错' }))
  })
  await p.waitForTimeout(500)
  const state2 = await p.evaluate(() => {
    const spans = [...document.querySelectorAll('[data-testid="upstream-target"] .whitespace-pre')]
    return {
      green: spans.filter((s) => /text-green/.test(s.className)).length,
      red: spans.filter((s) => /text-red/.test(s.className)).length,
    }
  })
  check('markOnly：错字标红但已正确部分保留', state2.green >= 4 && state2.red >= 1, JSON.stringify(state2))

  const meter = await p.locator('body').innerText()
  check('指标条显示「上屏字数」', /上屏字数/.test(meter), meter.slice(-120).replace(/\n/g, '|'))

  await p.screenshot({ path: '/tmp/v2-ime.png' })
  check('无页面异常', errors.length === 0, errors.join(' | '))
  console.log(report.join('\n'))
  await b.close()
})()
