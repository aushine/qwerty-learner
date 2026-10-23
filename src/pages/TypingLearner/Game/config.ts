/**
 * 游戏中心配置（spec-20261019-v1 / 01 §四 GameConfig）
 *
 * 三条已定稿决策（00 §TL;DR，需求提出人确认）：
 * 1. 模块范围 = 墨雨 + 诗词射击 + 成语接龙整合交付；
 * 2. 入口 = 打字模式二级「游戏」，不新增顶层模式；
 * 3. 墨雨素材 = 程序化水墨笔触（Canvas 算法生成，零外部素材）。
 */

import type { GameConfig, GameId, GameTier } from '@/typings/typing'

/** 玩法注册表（中心页卡片顺序 = 数组顺序；墨雨 featured 置顶） */
export const GAME_CONFIGS: GameConfig[] = [
  {
    id: 'moyu',
    name: '墨雨 · 落字成画',
    kind: 'moyu',
    languageTab: 'both',
    defaultTrack: 'code',
    summary: '字词如墨滴洒落，在沾染纸面前逐字打出，每打对一个化成一笔水墨，集满一幅成画得奖励。',
    featured: true,
    hasPracticeMode: true,
  },
  {
    id: 'shoot',
    name: '诗词射击',
    kind: 'shoot',
    languageTab: 'zh',
    defaultTrack: 'code',
    summary: '敌舰带着诗句中的词俯冲而来，打完即击毁；每击毁一个词，诗句便显现一字，通关呈现全诗。',
    hasPracticeMode: false,
  },
  {
    id: 'idiom',
    name: '成语接龙',
    kind: 'idiom',
    languageTab: 'zh',
    defaultTrack: 'code',
    summary: '系统出一个成语，你打出以它的末字开头的成语续接；三档提示随时降级，卡住可跳过。',
    hasPracticeMode: true,
  },
]

export const GAME_CONFIG_MAP: Record<GameId, GameConfig> = Object.fromEntries(GAME_CONFIGS.map((g) => [g.id, g])) as Record<
  GameId,
  GameConfig
>

/** 难度档标签（05 DATA-02：入门/进阶/挑战） */
export const GAME_TIER_LABELS: Record<GameTier, string> = {
  intro: '入门',
  mid: '进阶',
  adv: '挑战',
}

/** 难度系数（分数公式第三因子，本批次定稿值） */
export const GAME_TIER_FACTOR: Record<GameTier, number> = {
  intro: 1,
  mid: 1.25,
  adv: 1.5,
}

/**
 * 难度曲线参数（01 REQ-03）：
 * ⭐ 难度靠「语料级别升档」加压，**不靠提速**（09 §1.2 第一原则：
 * 提速会诱导牺牲准确率，提难度不会）。下落时长仅随档位平缓变化。
 */
export const GAME_TIER_PACE: Record<GameTier, { fallSec: number; spawnIntervalSec: number; maxConcurrent: number }> = {
  intro: { fallSec: 9, spawnIntervalSec: 2.4, maxConcurrent: 4 },
  mid: { fallSec: 8, spawnIntervalSec: 2, maxConcurrent: 6 },
  adv: { fallSec: 7, spawnIntervalSec: 1.7, maxConcurrent: 8 },
}

/** 初始生命（挑战模式；按难度 5/4/3，01 REQ-03「如 3~5，按难度」定稿值） */
export const GAME_TIER_LIVES: Record<GameTier, number> = {
  intro: 5,
  mid: 4,
  adv: 3,
}

/** 墨雨挑战模式限时（秒，对齐 Ink Rain 90 秒；MOYU-04 定稿值） */
export const MOYU_CHALLENGE_SEC = 90

/** 连击倍率上限（combo 达到 100 时封顶 2×） */
export const COMBO_CAP = 100
/** 单目标基础分 = 10 × 文本长度（分数公式定稿值） */
export const BASE_SCORE_PER_CHAR = 10
/** 成画奖励 = 200 × 难度系数（MOYU-03 定稿值） */
export const PAINTING_BONUS = 200
