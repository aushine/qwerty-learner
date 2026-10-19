/* eslint-disable */
const { chromium } = require('playwright')
;(async () => {
  const b = await chromium.launch()
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } })
  p.on('pageerror', (e) => console.log('ERR', e.message))
  await p.addInitScript(() => {
    localStorage.setItem('typingMaterialId', JSON.stringify('zh-flypy-chengyu-500'))
    localStorage.setItem('typingInputTrack', JSON.stringify('ime'))
  })
  await p.goto('http://127.0.0.1:5174/typing', { waitUntil: 'load' })
  await p.waitForTimeout(3000)
  console.log('overlay', await p.locator('[aria-label="开始练习"]').count())
  await p.locator('[aria-label="开始练习"]').click({ force: true })
  await p.waitForTimeout(600)
  console.log('after start: textarea?', await p.locator('textarea').count(), 'target?', await p.locator('[data-testid="upstream-target"]').count(), 'body', (await p.locator('body').innerText()).slice(0,80).replace(/\n/g,'|'))
  await b.close()
})()
