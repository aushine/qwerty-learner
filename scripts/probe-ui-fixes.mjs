// 综合验证探针（2026-10-21 用户三项调整）：
//  A. TypingGallery 盒模型：页面不滚动 + 方案行固定 + 类型胶囊 sticky + 空间够时无滚动
//  B. 模式缓存：appMode=typing 重开落地 /typing 且真的渲染打字模式（而非仅改 URL）
//  C. ModeSwitcher 新形态：start/pause 形式按钮（标签=目标模式、indigo/gray 状态色、点击/键盘切换、深色适配）
import { chromium } from '@playwright/test'

const BASE = process.env.BASE || 'http://localhost:5173'
const results = []
const check = (name, ok, extra) => {
  results.push(`${ok ? 'PASS' : 'FAIL'} | ${name}${extra !== undefined && extra !== '' ? ' | ' + extra : ''}`)
}

/** 取「素材类型胶囊」rect（字/词/成语/短句/文章；排除语言 Tab 的中文/英语 radio） */
const TYPE_PILLS_FN = `(() => {
  const radios = [...document.querySelectorAll('[role="radio"]')]
  const el = radios.find((r) => ['字','词','成语','短句','文章','段落','经典'].includes((r.textContent||'').trim()))
  if (!el) return null
  const r = el.getBoundingClientRect()
  return { top: Math.round(r.top), bottom: Math.round(r.bottom) }
})()`

;(async () => {
  const browser = await chromium.launch()

  // ═══ A. Gallery 盒模型 ═══
  {
    // 900px 常规视口：内容应装下（幻影滚动已消除）
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
    const errors = []
    page.on('pageerror', (e) => errors.push(e.message))
    await page.goto(`${BASE}/typing/gallery`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(700)

    const fit = await page.evaluate(() => {
      const scrollers = []
      document.querySelectorAll('*').forEach((el) => {
        const s = getComputedStyle(el)
        if (el.scrollHeight > el.clientHeight + 1 && (s.overflowY === 'auto' || s.overflowY === 'scroll')) {
          scrollers.push((el.className?.toString?.() ?? '').slice(0, 60))
        }
      })
      return {
        scrollers,
        docNoScroll: document.documentElement.scrollHeight <= window.innerHeight + 1,
      }
    })
    check('A1 页面本身不滚动', fit.docNoScroll)
    check('A2 常规视口无溢出滚动容器（幻影滚动已消除）', fit.scrollers.length === 0, JSON.stringify(fit.scrollers))
    await page.close()
  }

  {
    // 620px 矮视口：列表区必须可滚，且方案行固定 / 类型胶囊 sticky
    const page = await browser.newPage({ viewport: { width: 1440, height: 620 } })
    await page.goto(`${BASE}/typing/gallery`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(700)

    const layout = await page.evaluate((pillsExpr) => {
      const scrollers = []
      document.querySelectorAll('*').forEach((el) => {
        const s = getComputedStyle(el)
        if (el.scrollHeight > el.clientHeight + 1 && (s.overflowY === 'auto' || s.overflowY === 'scroll')) {
          scrollers.push({
            cls: (el.className?.toString?.() ?? '').slice(0, 60),
            inMaterialArea: !!el.closest('[data-radix-scroll-area-viewport]') || !!el.querySelector('[role="radio"]'),
            clientH: el.clientHeight,
            scrollH: el.scrollHeight,
          })
        }
      })
      const rect = (sel) => {
        const el = document.querySelector(sel)
        if (!el) return null
        const r = el.getBoundingClientRect()
        return { top: Math.round(r.top), bottom: Math.round(r.bottom) }
      }
      return {
        scrollers,
        docNoScroll: document.documentElement.scrollHeight <= window.innerHeight + 1,
        schemeRow: rect('button[aria-pressed]'),
        typePills: eval(pillsExpr),
      }
    }, TYPE_PILLS_FN)
    check('A3 矮视口下页面本身仍不滚动（只有列表区滚）', layout.docNoScroll && layout.scrollers.every((s) => s.inMaterialArea), JSON.stringify(layout.scrollers))
    check('A4 列表区可滚动且胶囊在方案行下方', layout.scrollers.length >= 1 && layout.schemeRow.bottom < layout.typePills.top, `${JSON.stringify(layout.scrollers)} pills=${JSON.stringify(layout.typePills)}`)

    const cardBox = await page.locator('h2').first().boundingBox()
    await page.mouse.move(cardBox.x + 300, cardBox.y + 200)
    await page.mouse.wheel(0, 400)
    await page.waitForTimeout(350)

    const afterScroll = await page.evaluate((pillsExpr) => {
      const viewport = document.querySelector('[data-radix-scroll-area-viewport]')
      const rect = (sel) => {
        const el = document.querySelector(sel)
        if (!el) return null
        const r = el.getBoundingClientRect()
        return { top: Math.round(r.top), bottom: Math.round(r.bottom) }
      }
      return {
        scrollTop: viewport ? Math.round(viewport.scrollTop) : -1,
        schemeRow: rect('button[aria-pressed]'),
        typePills: eval(pillsExpr),
        pillsVisible: (() => {
          const radios = [...document.querySelectorAll('[role="radio"]')]
          const el = radios.find((r) => ['字', '词', '成语', '短句', '文章', '段落', '经典'].includes((r.textContent || '').trim()))
          if (!el) return false
          const r = el.getBoundingClientRect()
          return r.top >= -1 && r.bottom <= window.innerHeight
        })(),
      }
    }, TYPE_PILLS_FN)
    check('A5 列表区确实滚动了', afterScroll.scrollTop > 100, `scrollTop=${afterScroll.scrollTop}`)
    check('A6 滚动后方案行位置不变（固定）', layout.schemeRow.top === afterScroll.schemeRow.top, `${layout.schemeRow.top} -> ${afterScroll.schemeRow.top}`)
    check('A7 滚动后类型胶囊位置不变（sticky 吸顶）', layout.typePills.top === afterScroll.typePills.top && afterScroll.pillsVisible, `${layout.typePills.top} -> ${afterScroll.typePills.top} visible=${afterScroll.pillsVisible}`)
    await page.close()
  }

  // ═══ B. 模式缓存 ═══
  {
    // B1: 上次在打字模式 → 重开落地 /typing 且渲染打字模式（标题 + 切换按钮双向验证）
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
    await page.addInitScript(() => {
      window.localStorage.setItem('appMode', JSON.stringify('typing'))
    })
    await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(1200)
    const restored = await page.evaluate(() => ({
      url: window.location.pathname,
      title: (document.querySelector('header a span') || {}).textContent || '',
      toggle: (document.querySelector('[data-testid="mode-toggle"]') || {}).textContent || '',
    }))
    check('B1 URL 落地 /typing', restored.url.endsWith('/typing'), restored.url)
    check('B2 渲染的是打字模式（标题 Typing Learner）', restored.title.trim() === 'Typing Learner', restored.title)
    check('B3 打字态切换按钮显示「学习模式」', restored.toggle.trim() === '学习模式', restored.toggle)

    // B4: 点击切回学习模式 → 落 '/'；缓存写入 learn（双向缓存生效）
    await page.click('[data-testid="mode-toggle"]')
    await page.waitForTimeout(900)
    const back = await page.evaluate(() => ({
      url: window.location.pathname,
      title: (document.querySelector('header a span') || {}).textContent || '',
      toggle: (document.querySelector('[data-testid="mode-toggle"]') || {}).textContent || '',
      stored: window.localStorage.getItem('appMode'),
    }))
    check('B4 点击切换回学习模式（URL=/ 且标题回退）', back.url === '/' && back.title.trim() === 'Qwerty Learner', `${back.url} ${back.title}`)
    check('B5 切换后缓存写入 learn', back.stored === '"learn"', back.stored)
    check('B6 学习态切换按钮显示「打字模式」', back.toggle.trim() === '打字模式', back.toggle)
    await page.close()
  }

  // B7: 直开书签 /typing 并刷新 → 停留（restore 不干扰非 / 入口）
  {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
    await page.addInitScript(() => {
      window.localStorage.setItem('appMode', JSON.stringify('typing'))
    })
    await page.goto(`${BASE}/typing`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(800)
    await page.reload({ waitUntil: 'networkidle' })
    await page.waitForTimeout(900)
    const stay = await page.evaluate(() => ({
      url: window.location.pathname,
      title: (document.querySelector('header a span') || {}).textContent || '',
    }))
    check('B7 直开 /typing 刷新后停留打字模式', stay.url.endsWith('/typing') && stay.title.trim() === 'Typing Learner', `${stay.url} ${stay.title}`)
    await page.close()
  }

  // B8: 上次在学习模式 → 重开停留在学习模式（不误弹）
  {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
    await page.addInitScript(() => {
      window.localStorage.setItem('appMode', JSON.stringify('learn'))
    })
    await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(900)
    const stay = await page.evaluate(() => ({
      url: window.location.pathname,
      title: (document.querySelector('header a span') || {}).textContent || '',
    }))
    check('B8 appMode=learn 重开停留在学习模式', stay.url === '/' && stay.title.trim() === 'Qwerty Learner', `${stay.url} ${stay.title}`)
    await page.close()
  }

  // ═══ C. ModeSwitcher 新形态 ═══
  {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
    const errors = []
    page.on('pageerror', (e) => errors.push(e.message))
    await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(900)

    const form = await page.evaluate(() => {
      const btn = document.querySelector('[data-testid="mode-toggle"]')
      if (!btn) return null
      const s = getComputedStyle(btn)
      const link = document.querySelector('header a')
      return {
        text: (btn.textContent || '').trim(),
        bg: s.backgroundColor,
        radius: s.borderRadius,
        shadow: s.boxShadow !== 'none',
        weight: s.fontWeight,
        linkHref: link ? link.getAttribute('href') : null,
        oldMenuGone: document.querySelectorAll('[role="menu"],[role="menuitem"],[data-testid="mode-switcher-indicator"]').length,
      }
    })
    check('C1 学习态：indigo-500 实心 + 圆角 + 阴影（start/pause 形式）', form && form.bg === 'rgb(99, 102, 241)' && form.radius === '8px' && form.shadow && form.weight === '500', JSON.stringify(form))
    check('C2 标题仍为官网链接（ENTRY2-06 不回归）', form && form.linkHref === 'https://qwerty.kaiyi.cool/', form && form.linkHref)
    check('C3 旧浮层 DOM 已全部移除', form && form.oldMenuGone === 0, form && String(form.oldMenuGone))

    // C4: 键盘可达——聚焦按钮按 Enter 切换（绕过首页 document 级 Enter 热键）
    await page.focus('[data-testid="mode-toggle"]')
    await page.keyboard.press('Enter')
    await page.waitForTimeout(900)
    const kbSwitch = await page.evaluate(() => ({
      url: window.location.pathname,
      toggle: (document.querySelector('[data-testid="mode-toggle"]') || {}).textContent || '',
      bg: (() => {
        const b = document.querySelector('[data-testid="mode-toggle"]')
        return b ? getComputedStyle(b).backgroundColor : ''
      })(),
    }))
    check('C4 键盘 Enter 可切换模式', kbSwitch.url.endsWith('/typing'), kbSwitch.url)
    check('C5 打字态：gray-400 实心 + 标签「学习模式」', kbSwitch.bg === 'rgb(156, 163, 175)' && kbSwitch.toggle.trim() === '学习模式', `${kbSwitch.bg} ${kbSwitch.toggle}`)

    // C6: 深色模式适配（atomWithStorage key = isOpenDarkModeAtom）
    await page.evaluate(() => window.localStorage.setItem('isOpenDarkModeAtom', JSON.stringify(true)))
    await page.reload({ waitUntil: 'networkidle' })
    await page.waitForTimeout(900)
    const dark = await page.evaluate(() => {
      const b = document.querySelector('[data-testid="mode-toggle"]')
      return { bg: b ? getComputedStyle(b).backgroundColor : '', html: document.documentElement.className }
    })
    check('C6 深色模式按钮仍有实心底色（gray-600）', dark.bg === 'rgb(75, 85, 99)' && dark.html.includes('dark'), JSON.stringify(dark))
    check('C7 全程无页面异常', errors.length === 0, errors.join(' | '))
    await page.close()
  }

  await browser.close()
  console.log(results.join('\n'))
  const failed = results.filter((r) => r.startsWith('FAIL'))
  console.log(`\n${results.length - failed.length}/${results.length} passed`)
  process.exit(failed.length > 0 ? 1 : 0)
})().catch((e) => {
  console.error(e)
  process.exit(1)
})
