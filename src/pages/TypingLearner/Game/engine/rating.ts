/**
 * 评级计算（spec-20261019-v1 / 01 REQ-03 结束与复盘）
 *
 * 复用基线 `09` §4.2 的单局评级表 S/A/B/C/D/F：
 * - 多维加权（准确率 / 击键 KPS / 一致性 consistency）；
 * - ⭐ **准确率是一票否决项**：< 85% 直接 F，无论多快；
 * - ⚠️ 分数线为 09 §4.2 建议初值（待内测校准 G-5），本模块不另立标准。
 *
 * consistency 口径：取本局**正确击键间隔**的变异系数倒数映射
 * （cv = stdev/mean，consistency = 100 × (1 - cv)，钳制 0~100）。
 * 与 monkeytype 的 consistency 同族：肌肉记忆成熟的标志不是快，而是稳。
 */

import type { GameRating } from '@/typings/typing'

export type RatingInput = {
  /** 字准确率 0~1 */
  accuracy: number
  /** 击键/秒 */
  kps: number
  /** 一致性 0~100 */
  consistency: number
}

/** 由正确击键的时间戳数组计算 consistency（0~100） */
export function computeConsistency(correctKeyTimes: number[]): number {
  if (correctKeyTimes.length < 3) return 0
  const intervals: number[] = []
  for (let i = 1; i < correctKeyTimes.length; i++) {
    const d = correctKeyTimes[i] - correctKeyTimes[i - 1]
    if (d > 0) intervals.push(d)
  }
  if (intervals.length < 2) return 0
  const mean = intervals.reduce((a, b) => a + b, 0) / intervals.length
  if (mean <= 0) return 0
  const variance = intervals.reduce((a, b) => a + (b - mean) ** 2, 0) / intervals.length
  const cv = Math.sqrt(variance) / mean
  return Math.max(0, Math.min(100, Math.round(100 * (1 - cv))))
}

/** S/A/B/C/D/F 多维评级（09 §4.2 原表；准确率一票否决） */
export function computeRating({ accuracy, kps, consistency }: RatingInput): GameRating {
  const acc = accuracy * 100
  if (acc < 85) return 'F'
  if (acc >= 99 && kps >= 8 && consistency >= 90) return 'S'
  if (acc >= 97 && kps >= 6 && consistency >= 80) return 'A'
  if (acc >= 95 && kps >= 5 && consistency >= 70) return 'B'
  if (acc >= 90 && kps >= 4 && consistency >= 60) return 'C'
  return 'D'
}

/** 评级说明文案（复盘页展示；把规则本身变成教学内容，09 §4.2 决策 1） */
export const RATING_EXPLAIN: Record<GameRating, string> = {
  S: '准确率、击键、一致性三项全部拉满——这就是肌肉记忆的样子。',
  A: '三项全部达标，距离 S 只差一口气。',
  B: '整体达标，稳住准确率再求快。',
  C: '准确率达标；速度或波动还有提升空间。',
  D: '准确率 85% 以上。慢一点没关系，打对更重要。',
  F: '本局准确率不足 85%——速度再快也是 F，因为错误的肌肉记忆比慢更危险。',
}
