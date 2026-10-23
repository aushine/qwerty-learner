/**
 * 墨雨画位配置（spec-20261019-v1 / 05 DATA-03）
 *
 * `InkPainting { id, tier, strokes, composition }`：
 * - `composition` 为**参数化坐标系**（0~1）中的笔序槽位，定义笔触的生长顺序与位置；
 * - 由确定性种子算法生成（mulberry32），**纯数据、零外部图片素材**（A2 §2.3 美术须自绘）；
 * - 三套构图母题（山水 / 竹石 / 花鸟）× 三档 tier（入门 8 笔 / 进阶 14 笔 / 挑战 22 笔），
 *   入门=简笔、挑战=繁笔（DATA-02）。
 *
 * 每笔 InkCoord：
 * - `x` / `y`：笔触终点在画布坐标系中的位置（0~1）；
 * - `w`：笔触宽度（4~12px，对齐 MOYU-02 §三）；
 * - `curve`：起笔方向控制（-1~1，映射为起笔角 curve×π，带轻微向下偏置）。
 */

import type { GameTier } from '@/typings/typing'

export type InkCoord = { x: number; y: number; w: number; curve: number }

export type InkPainting = {
  id: string
  tier: GameTier
  /** 构图母题名（画完成后展示，如「山水」） */
  motif: string
  /** 笔数（DATA-02：入门简笔 / 挑战繁笔） */
  strokes: number
  composition: InkCoord[]
}

/** 确定性 PRNG（mulberry32）：同种子同构图，刷新不跳变 */
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

const clamp01 = (v: number) => Math.max(0.04, Math.min(0.96, v))

type Builder = (count: number, rand: () => number) => InkCoord[]

/** 山水：远山脊线 + 水面波痕 + 日轮 + 小舟 */
const landscape: Builder = (count, rand) => {
  const out: InkCoord[] = []
  // 日轮（右上，一笔弧线）
  out.push({ x: 0.74, y: 0.2, w: 5, curve: -0.55 })
  // 远山脊线：从左下向右上起伏的折线
  const ridgeCount = Math.max(3, Math.ceil(count * 0.4))
  for (let i = 0; i < ridgeCount; i++) {
    const t = i / (ridgeCount - 1)
    const x = 0.1 + t * 0.8
    const y = 0.42 - Math.sin(t * Math.PI) * 0.16 + (rand() - 0.5) * 0.03
    out.push({ x: clamp01(x), y: clamp01(y), w: 6 + rand() * 5, curve: 0.3 + rand() * 0.4 })
  }
  // 水面波痕：水平短笔，越往下越疏
  const waterCount = Math.max(3, count - out.length - 1)
  for (let i = 0; i < waterCount; i++) {
    const t = (i + 1) / (waterCount + 1)
    const x = 0.14 + rand() * 0.72
    const y = 0.6 + t * 0.3
    out.push({ x: clamp01(x), y: clamp01(y), w: 4 + rand() * 4, curve: (rand() - 0.5) * 0.5 })
  }
  // 小舟（一撇一提）
  out.push({ x: 0.6, y: 0.82, w: 5, curve: 0.7 })
  out.push({ x: 0.64, y: 0.84, w: 4, curve: -0.4 })
  return out.slice(0, count + 1)
}

/** 竹石：坡石 + 竹干 + 竹叶 */
const bamboo: Builder = (count, rand) => {
  const out: InkCoord[] = []
  // 坡石（两笔横皴）
  out.push({ x: 0.3, y: 0.86, w: 10, curve: 0.2 })
  out.push({ x: 0.42, y: 0.9, w: 8, curve: -0.15 })
  // 竹干：自下而上若干节，略带倾斜
  const stalkCount = Math.max(3, Math.ceil(count * 0.35))
  for (let i = 0; i < stalkCount; i++) {
    const t = i / (stalkCount - 1)
    out.push({ x: clamp01(0.4 + t * 0.08 + (rand() - 0.5) * 0.02), y: clamp01(0.85 - t * 0.62), w: 7 + rand() * 4, curve: -0.9 })
  }
  // 竹叶：干顶两侧斜出短笔
  const leafCount = Math.max(4, count - out.length)
  for (let i = 0; i < leafCount; i++) {
    const side = i % 2 === 0 ? 1 : -1
    const t = rand()
    out.push({
      x: clamp01(0.42 + side * (0.06 + t * 0.22)),
      y: clamp01(0.3 + rand() * 0.4),
      w: 4 + rand() * 3,
      curve: side * (0.5 + rand() * 0.4),
    })
  }
  return out.slice(0, count + 1)
}

/** 花鸟：横枝 + 花朵 + 小鸟 */
const blossom: Builder = (count, rand) => {
  const out: InkCoord[] = []
  // 横枝（自左下斜向右上）
  const branchCount = Math.max(2, Math.ceil(count * 0.2))
  for (let i = 0; i < branchCount; i++) {
    const t = i / branchCount
    out.push({ x: clamp01(0.12 + t * 0.5), y: clamp01(0.72 - t * 0.3), w: 6 + rand() * 4, curve: -0.3 })
  }
  // 花朵：花心周围放射状花瓣
  const petalCount = Math.max(5, Math.ceil(count * 0.5))
  const cx = 0.66
  const cy = 0.34
  for (let i = 0; i < petalCount; i++) {
    const a = (i / petalCount) * Math.PI * 2 + rand() * 0.3
    const r = 0.06 + rand() * 0.05
    out.push({ x: clamp01(cx + Math.cos(a) * r), y: clamp01(cy + Math.sin(a) * r * 0.8), w: 5 + rand() * 4, curve: Math.sin(a) * 0.6 })
  }
  // 小鸟：身、翼、喙三笔
  out.push({ x: 0.3, y: 0.4, w: 8, curve: 0.5 })
  out.push({ x: 0.27, y: 0.35, w: 5, curve: -0.7 })
  out.push({ x: 0.34, y: 0.42, w: 4, curve: 0.8 })
  // 补笔：草丛
  while (out.length < count) {
    out.push({ x: clamp01(0.15 + rand() * 0.7), y: clamp01(0.8 + rand() * 0.14), w: 4 + rand() * 3, curve: (rand() - 0.5) })
  }
  return out.slice(0, count + 1)
}

const MOTIFS: { key: string; name: string; build: Builder }[] = [
  { key: 'landscape', name: '山水', build: landscape },
  { key: 'bamboo', name: '竹石', build: bamboo },
  { key: 'blossom', name: '花鸟', build: blossom },
]

/** tier → 笔数（DATA-02：入门 6~10 / 进阶 / 挑战 20~30） */
const TIER_STROKES: Record<GameTier, number> = { intro: 8, mid: 14, adv: 22 }

function buildPaintings(): InkPainting[] {
  const list: InkPainting[] = []
  MOTIFS.forEach((motif, mi) => {
    ;(['intro', 'mid', 'adv'] as GameTier[]).forEach((tier, ti) => {
      const count = TIER_STROKES[tier]
      // 种子 = 母题 index × 100 + tier index × 10 + 1（确定性）
      const rand = rng(mi * 100 + ti * 10 + 1)
      list.push({
        id: `${motif.key}-${tier}`,
        tier,
        motif: motif.name,
        strokes: count,
        composition: motif.build(count, rand),
      })
    })
  })
  return list
}

/** 全部画位（9 套，构建期生成，纯数据随包发布） */
export const INK_PAINTINGS: InkPainting[] = buildPaintings()

/** 按 tier 取画位序列（单局循环使用，成画后换下一套） */
export function getInkPaintings(tier: GameTier): InkPainting[] {
  return INK_PAINTINGS.filter((p) => p.tier === tier)
}

/** 成画收尾印章文字（MOYU-02 §三：右下角朱红方印，纯 Canvas 绘制） */
export const INK_SEAL_TEXT = '墨雨'
