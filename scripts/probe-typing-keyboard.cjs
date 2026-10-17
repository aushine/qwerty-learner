/* eslint-disable */
// 键盘专项探针（ACC-06-19 ~ 27）：小鹤双拼键位标注 / 高亮 / 抖动 / 折叠 / tooltip
const { chromium } = require('playwright')

;(async () => {
  const browser = await chromium.launch()
  const report = []
  const check = (name, ok, extra) => report.push(`${ok ? 'PASS' : 'FAIL'} | ${name}${extra ? ' | ' + extra : ''}`)

  // ── 小鹤双拼模式（localStorage 预置）──
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.addInitScript(() => {
    localStorage.setItem('typingScheme', JSON.stringify('flypy'))
    localStorage.setItem('typingMaterialId', JSON.stringify('zh-flypy-zi-500'))
  })
  await page.goto('http://localhost:5199/typing', { waitUntil: 'load', timeout: 30000 })
  await page.waitForTimeout(3000)

  const kb = page.locator('[role="group"][aria-label*="键盘"]')
  check('键盘渲染（flypy）', (await kb.count()) > 0)

  // 目标编码（用于高亮/按错测试）
  const dict = await page.evaluate(async () => {
    const r = await fetch('/dicts/zh/flypy-zi-500.json')
    return r.json()
  })
  const firstWord = dict[0]
  const target0 = firstWord.name[0]

  // ── ACC-06-19：Q=iu / W=ei，大字居中 + 正下方 ──
  for (const [key, final] of [['Q', 'iu'], ['W', 'ei']]) {
    const box = await page.evaluate(
      ([k, f]) => {
        const el = document.querySelector(`[aria-label="${k} 键，韵母 ${f}"]`)
        if (!el) return null
        const spans = el.querySelectorAll('span')
        const main = spans[0] // 主字母
        const fin = spans[1] // 韵母
        if (!main || !fin) return null
        const mb = main.getBoundingClientRect()
        const fb = fin.getBoundingClientRect()
        return { mainText: main.textContent, finText: fin.textContent, below: fb.top >= mb.bottom - 2, centered: Math.abs(mb.left + mb.width / 2 - (el.getBoundingClientRect().left + el.getBoundingClientRect().width / 2)) < 6 }
      },
      [key, final],
    )
    check(`ACC-06-19 ${key} 键大字居中 + 正下方 ${final}`, !!box && box.mainText === key && box.finText === final && box.below && box.centered, box ? JSON.stringify(box) : '未找到')
  }

  // ── ACC-06-20：V = zh（左上角）+ V + ui，三者可见不重叠（矩形相交判定）──
  const vBox = await page.evaluate(() => {
    const el = document.querySelector('[aria-label="V 键，声母 zh，韵母 ui"]')
    if (!el) return null
    const spans = el.querySelectorAll('span')
    if (spans.length < 3) return null
    const rects = [spans[0], spans[1], spans[2]].map((s) => ({ text: s.textContent, r: s.getBoundingClientRect() }))
    const inter = (a, b) => {
      const x = Math.min(a.right, b.right) - Math.max(a.left, b.left)
      const y = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)
      return x > 1 && y > 1
    }
    return {
      texts: rects.map((x) => x.text),
      zhV: inter(rects[0].r, rects[1].r),
      Vui: inter(rects[1].r, rects[2].r),
      zhUi: inter(rects[0].r, rects[2].r),
    }
  })
  check('ACC-06-20 V 键 zh+V+ui 三者可见不重叠', !!vBox && vBox.texts.join(',') === 'zh,V,ui' && !vBox.zhV && !vBox.Vui && !vBox.zhUi, vBox ? JSON.stringify(vBox) : '未找到')

  // ── ACC-06-21：双韵母键全部显示 ──
  for (const [key, face] of [['S', 'ong/iong'], ['K', 'ing/uai'], ['L', 'iang/uang'], ['X', 'ia/ua']]) {
    const found = await page.evaluate(
      ([k, f]) => {
        const el = document.querySelector(`[aria-label^="${k} 键"]`)
        return el ? el.textContent.includes(f) : false
      },
      [key, face],
    )
    check(`ACC-06-21 ${key} 键面显示 ${face}`, found)
  }

  // ── ACC-06-22：; 无标注；R 面不标 er（tooltip 有）；Y 面不标 ün（tooltip 有）──
  const semi = await page.evaluate(() => {
    const els = [...document.querySelectorAll('[role="group"][aria-label*="键盘"] div[aria-hidden="true"]')]
    return els.some((el) => el.textContent === ';')
  })
  check('ACC-06-22 ; 键无标注（aria-hidden）', semi)

  const rFace = await page.evaluate(() => {
    const el = document.querySelector('[aria-label^="R 键"]')
    const wrapper = el && el.parentElement.parentElement
    const tip = wrapper ? wrapper.querySelector('span.tooltip') : null
    return { face: el ? el.textContent : null, tip: tip ? tip.textContent : null }
  })
  check('ACC-06-22 R 键面仅 uan（er 在 tooltip）', !!rFace && rFace.face === 'Ruan' && !!rFace.tip && rFace.tip.includes('er'), JSON.stringify(rFace))

  const yFace = await page.evaluate(() => {
    const el = document.querySelector('[aria-label^="Y 键"]')
    const wrapper = el && el.parentElement.parentElement
    const tip = wrapper ? wrapper.querySelector('span.tooltip') : null
    return { face: el ? el.textContent : null, tip: tip ? tip.textContent : null }
  })
  check('ACC-06-22 Y 键面仅 un（ün 在 tooltip）', !!yFace && yFace.face === 'Yun' && !!yFace.tip && yFace.tip.includes('ün'), JSON.stringify(yFace))

  // ── ACC-06-27：tooltip 文案格式 ──
  const vTip = await page.evaluate(() => {
    const el = document.querySelector('[aria-label="V 键，声母 zh，韵母 ui"]')
    const wrapper = el && el.parentElement.parentElement
    const tip = wrapper ? wrapper.querySelector('span.tooltip') : null
    return tip ? tip.textContent : null
  })
  check('ACC-06-27 V 键 tooltip 文案正确', vTip === 'V 键：声母 zh / 韵母 ui、ü', vTip)

  // ── ACC-06-24：当前键高亮（indigo 实心 + 放大 + 底部 2px 条）──
  await page.keyboard.press('x') // 开始（被消费）
  await page.waitForTimeout(500)
  const dbgOverlay1 = await page.evaluate(() => !!document.querySelector('[data-testid="typing-target-code"]') && !!document.querySelector('.backdrop-blur-sm'))
  console.log('DEBUG overlay(after start):', dbgOverlay1)
  const hi = await page.evaluate((t) => {
    const els = [...document.querySelectorAll('[role="group"][aria-label*="键盘"] .bg-indigo-500')]
    const key = els.find((el) => el.textContent.includes(t.toUpperCase()))
    if (!key) return { found: false }
    return {
      found: true,
      scaled: key.className.includes('scale-[1.03]'),
      solid: key.className.includes('bg-indigo-500'),
      bottomBar: !!key.querySelector('span.h-0\\.5'),
    }
  }, target0)
  check('ACC-06-24 当前键 indigo 实心 + 放大 + 底部条', !!hi.found && hi.scaled && hi.solid && hi.bottomBar, JSON.stringify(hi))

  // 诊断：截图前的题面与高亮键
  const dbgTarget = (await page.locator('[data-testid="typing-target-code"]').textContent().catch(() => '')) || ''
  const dbgHi = await page.evaluate(() =>
    [...document.querySelectorAll('[role="group"][aria-label*="键盘"] .bg-indigo-500')].map((el) => el.textContent),
  )
  console.log('DEBUG target at screenshot:', JSON.stringify(dbgTarget.slice(0, 20)), '| indigo keys:', JSON.stringify(dbgHi))

  // 键盘截图（视觉复核用：开始后无毛玻璃覆盖）
  await page.locator('[role="group"][aria-label*="键盘"]').screenshot({ path: '/tmp/flypy-keyboard.png' })

  // ── ACC-06-25：按错抖动 + 红 ──
  // 注意：抖动持续 300ms（与 300ms 回滚同窗），前置截图步骤耗时不稳，
  // 等待窗口放到 2000ms 避免漏检（功能本身已由针对性调试验证：A 键 shake + border-red-400）
  const wrongChar = target0 === 'a' ? 'b' : 'a'
  await page.keyboard.press(wrongChar)
  const dbgOverlay2 = await page.evaluate(() => !!document.querySelector('.backdrop-blur-sm'))
  console.log('DEBUG overlay(after wrong key):', dbgOverlay2)
  const shook = await page.waitForSelector('.animate-\\[shake_0\\.3s\\]', { timeout: 2000 }).then(
    () => page.evaluate(() => !!document.querySelector('.animate-\\[shake_0\\.3s\\].border-red-400')),
    () => false,
  )
  const dbgOverlay3 = await page.evaluate(() => !!document.querySelector('.backdrop-blur-sm'))
  console.log('DEBUG overlay(after shake check):', dbgOverlay3)
  check('ACC-06-25 按错键抖动 + 红框', shook)

  // ── ACC-06-26：折叠 + 刷新保持 + 展开回位 ──
  try {
    await page.getByText('折叠', { exact: true }).click({ timeout: 5000 })
  } catch (e) {
    console.log('DEBUG click failed:', e.message.slice(0, 100))
    console.log('DEBUG overlay at click:', await page.evaluate(() => !!document.querySelector('.backdrop-blur-sm')))
    await page.screenshot({ path: '/tmp/keyboard-click-blocked.png' })
    // 兜底：先按任意键恢复练习再点
    await page.keyboard.press('x')
    await page.waitForTimeout(400)
    await page.getByText('折叠', { exact: true }).click({ timeout: 5000 })
  }
  await page.waitForTimeout(300)
  const collapsedGone = (await kb.count()) === 0
  const titleKept = (await page.getByText('键位提示').count()) > 0
  check('ACC-06-26 折叠后仅剩标题栏', collapsedGone && titleKept)

  await page.reload({ waitUntil: 'load' })
  await page.waitForTimeout(2500)
  const stillCollapsed = (await kb.count()) === 0
  check('ACC-06-26 刷新后仍是折叠态', stillCollapsed)

  // 刷新后练习未开始，「按任意键开始」覆盖层会挡住标题栏——先按键开始再点展开（真实用户同路径）
  await page.keyboard.press('x')
  await page.waitForTimeout(400)
  await page.getByText('展开', { exact: true }).click()
  await page.waitForTimeout(300)
  check('ACC-06-26 展开后键盘回位', (await kb.count()) === 1)

  // ── ACC-06-23：全拼模式无标注（新上下文，无 localStorage）──
  const qp = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  await qp.goto('http://localhost:5199/typing', { waitUntil: 'load', timeout: 30000 })
  await qp.waitForTimeout(3000)
  const qpAnnotated = await qp.evaluate(() =>
    [...document.querySelectorAll('[role="group"][aria-label*="键盘"] [aria-label]')].filter((el) =>
      /声母|韵母/.test(el.getAttribute('aria-label') || ''),
    ).length,
  )
  const qpHasIu = await qp.evaluate(() =>
    [...document.querySelectorAll('[role="group"][aria-label*="键盘"] span')].some((s) => s.textContent === 'iu'),
  )
  check('ACC-06-23 全拼模式全部键无标注', qpAnnotated === 0 && !qpHasIu, `标注键=${qpAnnotated}`)

  check('全流程无 pageerror', errors.length === 0, errors.slice(0, 2).join(' ; '))
  console.log(report.join('\n'))
  await browser.close()
})().catch((e) => {
  console.error('SCRIPT_ERROR', e)
  process.exit(1)
})
