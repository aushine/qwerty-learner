/**
 * InkCanvas —— 墨雨「纸面 + 水墨画布」（spec-20261019-v1 / 02 MOYU-02 / MOYU-03）
 *
 * 全部程序化绘制（Canvas 2D），**零外部图片素材**（A2 §2.3 美术须自绘）：
 * - 纸面：米白底 + 确定性算法生成的纸纤维噪点；
 * - 墨滴：实体下落对象（深墨圆点 + 纸色字），锁定目标画 indigo 环；
 * - 一笔 = 一条贝塞尔笔触：起点由画位坐标与笔顺随机性推导，宽度 4~12px，
 *   三段收锋 + 两层低透明度宽描边模拟宣纸渗墨（晕染）；
 * - 连击越高墨色越深、生长越快（MOYU-02 §三 动效）；
 * - 成画收尾：右下角程序化绘制朱红方印（「墨雨」）。
 */

import { useEffect, useRef } from 'react'
import type { ArcadeEngine } from '../engine/useArcadeEngine'
import type { InkCoord } from '../data/inkPaintings'
import type { GameTier } from '@/typings/typing'

const PAPER = '#f6f1e5'
const INK = '20, 20, 20'
const SEAL_RED = '178, 34, 34'

type ActiveStroke = { coord: InkCoord; born: number; key: number }

/** 确定性 PRNG（纸纤维噪点用） */
function rng(seed: number): () => number {
  let s = seed
  return () => {
    s |= 0
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export default function InkCanvas({
  engine,
  tier,
  paintingIndex,
  paintingStrokes,
  doneStrokes,
  activeStrokes,
  seals,
  combo,
}: {
  engine: ArcadeEngine
  tier: GameTier
  /** 当前画位总笔数 */
  paintingStrokes: number
  /** 第几幅（0 起） */
  paintingIndex: number
  /** 已完成的笔触坐标 */
  doneStrokes: InkCoord[]
  /** 生长中的笔触 */
  activeStrokes: ActiveStroke[]
  /** 已成画的印章 */
  seals: { x: number; y: number }[]
  combo: number
}) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const texRef = useRef<HTMLCanvasElement | null>(null)
  const propsRef = useRef({ engine, tier, paintingStrokes, paintingIndex, doneStrokes, activeStrokes, seals, combo })
  propsRef.current = { engine, tier, paintingStrokes, paintingIndex, doneStrokes, activeStrokes, seals, combo }

  // 画布尺寸（devicePixelRatio 适配 + 纸纤维底纹缓存）
  useEffect(() => {
    const wrap = wrapRef.current
    const canvas = canvasRef.current
    if (!wrap || !canvas) return
    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      const w = wrap.clientWidth
      const h = wrap.clientHeight
      canvas.width = Math.max(1, Math.round(w * dpr))
      canvas.height = Math.max(1, Math.round(h * dpr))
      canvas.style.width = `${w}px`
      canvas.style.height = `${h}px`
      // 纸纤维噪点（确定性）
      const tex = document.createElement('canvas')
      tex.width = canvas.width
      tex.height = canvas.height
      const tctx = tex.getContext('2d')
      if (tctx) {
        tctx.fillStyle = PAPER
        tctx.fillRect(0, 0, tex.width, tex.height)
        const rand = rng(20261019)
        tctx.fillStyle = '120, 105, 80'
        for (let i = 0; i < tex.width * tex.height * 0.004; i++) {
          tctx.globalAlpha = 0.02 + rand() * 0.05
          tctx.fillRect(rand() * tex.width, rand() * tex.height, 1, 1)
        }
        tctx.globalAlpha = 0.05
        tctx.strokeStyle = '110, 95, 70'
        for (let i = 0; i < 40; i++) {
          const x = rand() * tex.width
          const y = rand() * tex.height
          tctx.beginPath()
          tctx.moveTo(x, y)
          tctx.quadraticCurveTo(x + 20 - rand() * 40, y + 10 - rand() * 20, x + 40 - rand() * 80, y + 20 - rand() * 40)
          tctx.stroke()
        }
        tctx.globalAlpha = 1
      }
      texRef.current = tex
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(wrap)
    return () => ro.disconnect()
  }, [])

  // 帧绘制（订阅引擎帧循环：一个循环画完墨滴 + 笔触 + 印章）
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const drawStroke = (coord: InkCoord, progress: number, alpha: number) => {
      const W = canvas.width
      const H = canvas.height
      const pad = Math.min(W, H) * 0.1
      const to = { x: pad + coord.x * (W - pad * 2), y: pad + coord.y * (H - pad * 2) }
      // 起笔点：终点沿 curve 方向回退（带轻微向下偏置，模拟落墨）
      const angle = coord.curve * Math.PI + Math.PI / 2
      const back = Math.min(W, H) * (0.06 + ((coord.w / 12) * 0.05))
      const from = { x: to.x - Math.cos(angle) * back, y: to.y - Math.sin(angle) * back }
      const mx = (from.x + to.x) / 2
      const my = (from.y + to.y) / 2
      const dx = to.x - from.x
      const dy = to.y - from.y
      const dist = Math.hypot(dx, dy) || 1
      const cx = mx + (-dy / dist) * coord.curve * dist * 0.3
      const cy = my + (dx / dist) * coord.curve * dist * 0.3

      const pt = (t: number) => ({
        x: (1 - t) * (1 - t) * from.x + 2 * (1 - t) * t * cx + t * t * to.x,
        y: (1 - t) * (1 - t) * from.y + 2 * (1 - t) * t * cy + t * t * to.y,
      })

      // 晕染：两层低透明度宽描边（宣纸渗墨）
      for (const [wMul, aMul] of [
        [2.4, 0.16],
        [1.7, 0.12],
      ] as const) {
        ctx.globalAlpha = alpha * aMul
        ctx.lineWidth = coord.w * wMul
        ctx.lineCap = 'round'
        ctx.beginPath()
        ctx.moveTo(from.x, from.y)
        ctx.quadraticCurveTo(cx, cy, to.x, to.y)
        ctx.stroke()
      }

      // 主笔触：分段收锋（两端细、中段粗）
      const segs = 8
      const clamped = Math.max(0.001, Math.min(1, progress))
      for (let i = 0; i < segs; i++) {
        const t0 = (i / segs) * clamped
        const t1 = ((i + 1) / segs) * clamped
        if (t1 <= 0) continue
        const p0 = pt(t0)
        const p1 = pt(t1)
        // 两端收锋：sin 包络
        const env = Math.sin(Math.PI * ((t0 + t1) / 2))
        ctx.globalAlpha = alpha
        ctx.lineWidth = Math.max(0.8, coord.w * (0.35 + 0.65 * env))
        ctx.beginPath()
        ctx.moveTo(p0.x, p0.y)
        ctx.lineTo(p1.x, p1.y)
        ctx.stroke()
      }
      ctx.globalAlpha = 1
    }

    const drawSeal = (x: number, y: number) => {
      const W = canvas.width
      const H = canvas.height
      const size = Math.min(W, H) * 0.11
      const cx = pad0(W) + x * (W - pad0(W) * 2) - size / 2
      const cy = pad0(H) + y * (H - pad0(H) * 2) - size / 2
      ctx.save()
      ctx.translate(cx + size / 2, cy + size / 2)
      ctx.rotate(-0.06)
      ctx.globalAlpha = 0.88
      ctx.fillStyle = `rgba(${SEAL_RED}, 0.88)`
      ctx.fillRect(-size / 2, -size / 2, size, size)
      ctx.globalAlpha = 1
      ctx.strokeStyle = 'rgba(246, 241, 229, 0.9)'
      ctx.lineWidth = Math.max(1.5, size * 0.04)
      ctx.strokeRect(-size / 2 + size * 0.12, -size / 2 + size * 0.12, size * 0.76, size * 0.76)
      ctx.fillStyle = PAPER
      ctx.font = `600 ${Math.round(size * 0.34)}px "Kaiti SC","KaiTi","STKaiti","Noto Serif SC",serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('墨', 0, -size * 0.18)
      ctx.fillText('雨', 0, size * 0.2)
      ctx.restore()
    }
    const pad0 = (v: number) => v * 0.1

    return engine.subscribeFrame((positions) => {
      const p = propsRef.current
      const W = canvas.width
      const H = canvas.height
      // 纸面
      if (texRef.current) ctx.drawImage(texRef.current, 0, 0)
      else {
        ctx.fillStyle = PAPER
        ctx.fillRect(0, 0, W, H)
      }

      // 连击越深墨色越深（MOYU-02 §三）
      const depth = 0.5 + Math.min(p.combo, 50) / 50 * 0.28

      // 已完成笔触
      ctx.strokeStyle = `rgba(${INK}, 1)`
      for (const coord of p.doneStrokes) drawStroke(coord, 1, depth)

      // 生长中的笔触（~180ms 一笔；连击高略加快）
      const now = performance.now()
      const growMs = 180 / (1 + Math.min(p.combo, 30) * 0.02)
      for (const s of p.activeStrokes) {
        const t = Math.min(1, (now - s.born) / growMs)
        drawStroke(s.coord, t, depth * (0.4 + 0.6 * t))
      }

      // 墨滴（下落对象）
      const posMap = new Map(positions.map((q) => [q.id, q]))
      const padX = Math.min(W, H) * 0.1
      const padY = Math.min(W, H) * 0.1
      const dropR = Math.max(18, Math.min(W, H) * 0.045)
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      for (const e of p.engine.entities) {
        const pos = posMap.get(e.id)
        if (!pos) continue
        const cx = padX + pos.x * (W - padX * 2)
        const cy = padY + pos.y * (H - padY * 2)
        // 墨滴：深墨圆 + 柔和边缘
        const g = ctx.createRadialGradient(cx, cy, dropR * 0.2, cx, cy, dropR)
        g.addColorStop(0, 'rgba(35, 32, 30, 0.95)')
        g.addColorStop(0.75, 'rgba(28, 26, 24, 0.92)')
        g.addColorStop(1, 'rgba(28, 26, 24, 0.55)')
        ctx.fillStyle = g
        ctx.beginPath()
        ctx.arc(cx, cy, dropR, 0, Math.PI * 2)
        ctx.fill()
        // 字（纸色）
        ctx.fillStyle = PAPER
        const fs = Math.round(dropR * 0.82)
        ctx.font = `600 ${fs}px "Kaiti SC","KaiTi","STKaiti","Noto Serif SC",serif`
        const typed = p.engine.lockedId === e.id ? p.engine.input : ''
        if (typed.length > 0) {
          ctx.fillStyle = 'rgba(165, 180, 252, 0.95)'
          ctx.fillText(typed.slice(-1), cx, cy)
        } else {
          ctx.fillText(e.text.slice(-2), cx, cy)
        }
        // 锁定环
        if (p.engine.lockedId === e.id) {
          ctx.strokeStyle = 'rgba(99, 102, 241, 0.95)'
          ctx.lineWidth = 3
          ctx.beginPath()
          ctx.arc(cx, cy, dropR + 6, 0, Math.PI * 2)
          ctx.stroke()
        }
      }

      // 印章（已成画）
      for (const s of p.seals) drawSeal(s.x, s.y)

      // 成画进度（画布角落）
      ctx.fillStyle = 'rgba(90, 84, 74, 0.85)'
      ctx.font = `${Math.max(12, Math.round(Math.min(W, H) * 0.026))}px system-ui, sans-serif`
      ctx.textAlign = 'left'
      ctx.fillText(`第 ${p.paintingIndex + 1} 幅 · ${p.doneStrokes.length}/${p.paintingStrokes} 笔`, padX * 0.6, H - padY * 0.5)
    })
  }, [engine])

  return (
    <div ref={wrapRef} className="my-card relative h-full w-full overflow-hidden rounded-2xl" style={{ backgroundColor: PAPER }}>
      <canvas ref={canvasRef} className="block h-full w-full" />
    </div>
  )
}
