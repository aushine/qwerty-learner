/* eslint-disable */
const { chromium } = require('playwright')
;(async () => {
  const b = await chromium.launch()
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } })
  await p.goto('http://127.0.0.1:5174/', { waitUntil: 'load' })
  await p.waitForTimeout(1500)
  const ref = p.locator('header div.relative > div').first()
  const r = await ref.boundingBox()
  await p.mouse.move(r.x + 30, r.y + r.height / 2)
  await p.waitForTimeout(400)
  console.log('menu', await p.locator('[role="menu"]').count())
  const m = await p.locator('[role="menu"]').boundingBox().catch(() => null)
  console.log('menu box', JSON.stringify(m))
  if (m) {
    await p.mouse.move(r.x + 30, m.y + 40)
    await p.waitForTimeout(400)
    console.log('after into menu', await p.locator('[role="menu"]').count())
    const attrs = await p.evaluate(() => {
      const menu = document.querySelector('[role="menu"]')
      return menu ? Object.keys(menu).filter((k) => k.startsWith('__reactProps')).map((k) => Object.keys(menu[k])) : []
    })
    console.log('react props keys', JSON.stringify(attrs))
  }
  await b.close()
})()
