/**
 * 共享下落式街机引擎 —— 类型定义（spec-20261019-v1 / 01 REQ-03）
 *
 * 三个玩法（墨雨 / 诗词射击 / 成语接龙）共用本引擎的：
 * 落字生成、目标自动锁定、逐字/逐词判定、连击、生命、分数、难度曲线、
 * 结束与复盘统计。玩法差异通过 options 的 spawn / onCleared / onMissed 注入。
 */

import type { GameId, GameRating, GameTier, TypingInputTrack } from '@/typings/typing'

/** 下落对象类型（诗词射击三类敌人；其余玩法恒 normal） */
export type EntityKind = 'normal' | 'shield' | 'boss'

/** 下落对象（墨滴 / 敌舰 / 待接成语） */
export type GameEntity = {
  id: number
  /** 展示文本（汉字 / 英文单词） */
  text: string
  /** 对码轨匹配串（编码）；上屏轨匹配 text */
  code: string
  kind: EntityKind
  /** 玩法附加元数据（如诗句显现进度、接龙链） */
  meta?: Record<string, unknown>
}

/** 帧位置快照（由帧订阅推给 DOM/Canvas 渲染层，不走 React state） */
export type EntityPosition = { id: number; x: number; y: number }

/** 逐键统计（复盘 + 错键热图 + 评级） */
export type GameStats = {
  /** 清除的目标数 */
  hits: number
  /** 漏打（触碰底线）数 */
  misses: number
  /** 总击键数 */
  keystrokes: number
  /** 正确击键数 */
  correctKeys: number
  /** 错误击键数 */
  wrongKeys: number
  /** 物理键 → 错误次数（错键热图；KeyX 口径，对齐 TypingKeyboard） */
  wrongKeyCounts: Record<string, number>
}

/** 单局总结（复盘页 + gameRecords） */
export type GameSummary = {
  gameId: GameId
  score: number
  /** 字准确率 0~1 */
  accuracy: number
  kps: number
  consistency: number
  maxCombo: number
  hits: number
  misses: number
  rating: GameRating
  /** 时长（秒） */
  time: number
  /** 本局被击落（漏打）的目标 */
  missedEntities: GameEntity[]
  wrongKeyCounts: Record<string, number>
  /** 幽灵数据：每个被清除目标的时间戳（ms，相对开局） */
  ghost: number[]
}

export type EngineStatus = 'idle' | 'running' | 'over'

/** 玩法注入的生成上下文 */
export type SpawnCtx = {
  /** 当前场上实体（只读） */
  entities: GameEntity[]
  /** 当前连击 */
  combo: number
}

/** useArcadeEngine 配置 */
export type UseArcadeOptions = {
  /** 引擎开关（页面级 false 时循环停止） */
  enabled: boolean
  /** 玩法 id（复盘/存档用） */
  gameId: GameId
  /** 难度 tier（计分难度系数） */
  tier: GameTier
  /** 输入轨（01 REQ-04） */
  track: TypingInputTrack
  /** 挑战模式生命数；练习模式不消耗生命（传 0 表示不消耗） */
  lives: number
  /** 是否练习模式（不失败、不计时） */
  practice: boolean
  /** 挑战模式限时（秒）；0 = 不限时（诗词射击/成语接龙仅生命） */
  durationSec: number
  /** 难度曲线参数（语料升档、不靠提速；由 config.ts GAME_TIER_PACE 提供） */
  pace: { fallSec: number; spawnIntervalSec: number; maxConcurrent: number }
  /** 语料池（已按 tier/语言备好） */
  pool: GameWord[]
  /** 生成下一个目标（实体 id 由引擎统一分配）；返回 null = 本帧不出。timerSpawn=false 时由玩法手动调 spawnOne */
  spawn: (ctx: SpawnCtx) => Omit<GameEntity, 'id'> | null
  /** 是否按间隔自动生成（墨雨/诗词射击=true；成语接龙=false，链式手动生成） */
  timerSpawn: boolean
  /** 清除目标时的玩法特效（音效、诗句显现、接龙推进、成画……） */
  onCleared?: (entity: GameEntity) => void
  /** 漏打时的玩法特效 */
  onMissed?: (entity: GameEntity) => void
  /** 错误击键时的玩法特效（音效） */
  onWrong?: (keyCode: string) => void
  /** 正确击键时的玩法特效（音效） */
  onCorrect?: () => void
  /** 跳过目标（成语接龙）：不计连击、不惩罚 */
  onSkipped?: (entity: GameEntity) => void
  /** 游戏结束（生命耗尽 / 计时耗尽 / 练习模式手动结束） */
  onGameOver: (summary: GameSummary) => void
}

/** 语料池条目（由 corpus.ts 产出） */
export type GameWord = {
  /** 展示文本（汉字或英文单词） */
  text: string
  /** 对码轨匹配串 */
  code: string
  kind: EntityKind
  /** 逐字拼音（仅成语接龙提示用；来自 quanpin 版 units） */
  pinyins?: string[]
}
