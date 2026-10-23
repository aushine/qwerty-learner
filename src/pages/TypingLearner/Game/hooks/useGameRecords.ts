/**
 * 游戏成绩存取（spec-20261019-v1 / 01 REQ-06）
 *
 * - 单局成绩写入现有 Dexie 的 `gameRecords` 表（v4 新增，纯本地、零上传）；
 * - 本地最佳：按 gameId + track 取最高分（中心页卡片展示，无服务端排行榜）；
 * - 幽灵数据（逐目标时间戳）随记录落库，本批次只存不展示（09 §3.5 覆盖层待后续批次）。
 */

import { useCallback } from 'react'
import { GameRecord } from '@/utils/db/record'
import { db } from '@/utils/db'
import type { GameId, GameRating, GameTier, GameMode, TypingInputTrack } from '@/typings/typing'

export type GameBest = {
  bestScore: number
  bestRating: GameRating | null
  bestCombo: number
  playCount: number
}

const EMPTY_BEST: GameBest = { bestScore: 0, bestRating: null, bestCombo: 0, playCount: 0 }

/** 写入一局成绩 */
export function useSaveGameRecord() {
  return useCallback(
    async (data: {
      gameId: GameId
      track: TypingInputTrack
      language: 'zh' | 'en'
      tier: GameTier
      mode: GameMode
      score: number
      accuracy: number
      kps: number
      maxCombo: number
      rating: GameRating
      time: number
      ghost?: number[]
      strokes?: number
      poemsCleared?: number
      chainLength?: number
    }) => {
      try {
        await db.gameRecords.add(new GameRecord(data))
      } catch (e) {
        console.error('[game] 保存成绩失败', e)
      }
    },
    [],
  )
}

/** 查询某玩法某轨的本地最佳（中心页卡片 + 玩法内页展示） */
export function useGameBest(gameId: GameId | undefined, track: TypingInputTrack) {
  const load = useCallback(async (): Promise<GameBest> => {
    if (!gameId) return EMPTY_BEST
    try {
      const rows = await db.gameRecords.where({ gameId, track }).toArray()
      if (rows.length === 0) return EMPTY_BEST
      const order: GameRating[] = ['S', 'A', 'B', 'C', 'D', 'F']
      return {
        bestScore: Math.max(...rows.map((r) => r.score)),
        bestRating: rows.reduce((a, b) => (order.indexOf(a.rating) <= order.indexOf(b.rating) ? a : b)).rating,
        bestCombo: Math.max(...rows.map((r) => r.maxCombo)),
        playCount: rows.length,
      }
    } catch (e) {
      console.error('[game] 查询本地最佳失败', e)
      return EMPTY_BEST
    }
  }, [gameId, track])

  return load
}
