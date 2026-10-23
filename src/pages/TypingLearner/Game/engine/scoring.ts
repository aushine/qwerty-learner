/**
 * 计分公式（spec-20261019-v1 / 01 REQ-03 分数与难度曲线）
 *
 * 分数 = Σ（基础分 × 连击倍率 × 难度系数）
 * - 基础分 = 10 × 目标文本长度（单字 10，成语 40，诗句片段 20……）；
 * - 连击倍率 = 1 + min(combo, 100) × 1%（上限 2×，combo 封顶 100）；
 * - 难度系数 = 入门 1.0 / 进阶 1.25 / 挑战 1.5。
 *
 * ⭐ 打错、漏打、放弃当前目标 → 连击归零（01 REQ-03），
 * 但不对用户做羞辱性展示（09 §2.5：失败=复盘）。
 */

import { BASE_SCORE_PER_CHAR, COMBO_CAP, GAME_TIER_FACTOR, PAINTING_BONUS } from '../config'
import type { GameTier } from '@/typings/typing'

/** 连击倍率（1.0 ~ 2.0） */
export function comboMultiplier(combo: number): number {
  return 1 + Math.min(combo, COMBO_CAP) * 0.01
}

/** 清除一个目标的得分（combo 为**清除前**的连击数） */
export function entityScore(textLength: number, combo: number, tier: GameTier): number {
  const base = BASE_SCORE_PER_CHAR * Math.max(1, textLength)
  return Math.round(base * comboMultiplier(combo) * GAME_TIER_FACTOR[tier])
}

/** 成画奖励（墨雨 MOYU-03：集满一幅画的笔数） */
export function paintingBonus(tier: GameTier): number {
  return PAINTING_BONUS * GAME_TIER_FACTOR[tier]
}
