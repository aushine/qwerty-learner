/**
 * useArcadeEngine —— 共享下落式街机引擎（spec-20261019-v1 / 01 REQ-03）
 *
 * 三个玩法共用的下落式游戏内核：
 * - 落字/墨滴生成（定时或玩法手动，车道避让）；
 * - 目标自动锁定（按已输入前缀匹配**最接近底线**的同前缀目标，对齐 Ink Rain）；
 * - 逐字/逐词判定（对码轨匹配 code 串，上屏轨匹配 text；一次上屏多字逐字校验）；
 * - 连击（打对累积、打错/漏打/放弃归零，不对用户羞辱展示）；
 * - 生命（挑战模式扣减，练习模式不失败）与限时；
 * - 分数（基础分 × 连击倍率 × 难度系数）与难度曲线（语料升档、不靠提速）；
 * - 结束与复盘统计（被击落目标 + 错键热图 + 评级输入）。
 *
 * 🔴 性能口径：位置存放在 ref 中，经「帧订阅」直接推给 DOM/Canvas 渲染层，
 * React state 只在离散事件（生成/清除/计分/状态变化）时更新，不做每帧重渲染。
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { EntityPosition, GameEntity, GameStats, GameSummary, UseArcadeOptions } from './types'
import { computeConsistency, computeRating } from './rating'
import { entityScore } from './scoring'
import { CHAR_TO_CODE } from '../../components/TypingKeyboard'
import type { GameTier } from '@/typings/typing'

/** 水平车道数（落字区左右分栏，避免完全重叠） */
const LANES = 5

type Vec = { x: number; y: number; vy: number }

export type ArcadeEngine = ReturnType<typeof useArcadeEngine>

export function useArcadeEngine(options: UseArcadeOptions) {
  const { enabled } = options

  // ── 可变真源（refs）──
  const optsRef = useRef(options)
  optsRef.current = options

  const entitiesRef = useRef<GameEntity[]>([])
  const posRef = useRef(new Map<number, Vec>())
  const lockedRef = useRef<number | null>(null)
  const inputRef = useRef('')
  const statsRef = useRef<GameStats>({ hits: 0, misses: 0, keystrokes: 0, correctKeys: 0, wrongKeys: 0, wrongKeyCounts: {} })
  const correctTimesRef = useRef<number[]>([])
  const ghostRef = useRef<number[]>([])
  const missedRef = useRef<GameEntity[]>([])
  const startTsRef = useRef(0)
  const idRef = useRef(1)
  const spawnAccRef = useRef(0)
  const rafRef = useRef(0)
  const lastTsRef = useRef(0)
  const lastSecRef = useRef(-1)
  const frameListenersRef = useRef(new Set<(ps: EntityPosition[]) => void>())

  const hudRef = useRef({ score: 0, combo: 0, maxCombo: 0, lives: options.lives, timeLeft: options.durationSec })
  const [hud, setHudState] = useState(hudRef.current)
  const [entities, setEntitiesState] = useState<GameEntity[]>([])
  const [lockedId, setLockedIdState] = useState<number | null>(null)
  const [input, setInputState] = useState('')
  const [status, setStatus] = useState<'idle' | 'running' | 'over'>('idle')
  const statusRef = useRef<'idle' | 'running' | 'over'>('idle')

  const setStatusBoth = useCallback((s: 'idle' | 'running' | 'over') => {
    statusRef.current = s
    setStatus(s)
  }, [])

  const setHud = useCallback((patch: Partial<typeof hudRef.current>) => {
    hudRef.current = { ...hudRef.current, ...patch }
    setHudState(hudRef.current)
  }, [])

  const setEntities = useCallback((next: GameEntity[]) => {
    entitiesRef.current = next
    setEntitiesState(next)
  }, [])

  const setLocked = useCallback((id: number | null) => {
    lockedRef.current = id
    setLockedIdState(id)
  }, [])

  const setInput = useCallback((v: string) => {
    inputRef.current = v
    setInputState(v)
  }, [])

  /** 帧订阅（DOM/Canvas 渲染层用；返回取消订阅函数） */
  const subscribeFrame = useCallback((cb: (ps: EntityPosition[]) => void) => {
    frameListenersRef.current.add(cb)
    return () => {
      frameListenersRef.current.delete(cb)
    }
  }, [])

  const emitFrame = useCallback(() => {
    if (frameListenersRef.current.size === 0) return
    const ps: EntityPosition[] = []
    posRef.current.forEach((v, id) => ps.push({ id, x: v.x, y: v.y }))
    frameListenersRef.current.forEach((cb) => cb(ps))
  }, [])

  /** 生成（含车道避让：选「该车道最靠上的实体最高」的车道；实体 id 由引擎统一分配） */
  const placeEntity = useCallback(
    (draft: Omit<GameEntity, 'id'>) => {
      const pace = optsRef.current.pace
      let bestLane = 0
      let bestScore = -Infinity
      for (let lane = 0; lane < LANES; lane++) {
        let top = 1 // 该车道最靠上的实体的 y（越小越高）
        for (const e of entitiesRef.current) {
          const p = posRef.current.get(e.id)
          if (p && Math.abs(p.x - (lane + 0.5) / LANES) < 1 / LANES) top = Math.min(top, p.y)
        }
        const score = top - Math.random() * 0.3
        if (score > bestScore) {
          bestScore = score
          bestLane = lane
        }
      }
      const x = (bestLane + 0.5) / LANES + (Math.random() - 0.5) * 0.03
      const entity: GameEntity = { ...draft, id: idRef.current++ }
      posRef.current.set(entity.id, { x: Math.max(0.06, Math.min(0.94, x)), y: -0.14, vy: 1 / pace.fallSec })
      setEntities([...entitiesRef.current, entity])
    },
    [setEntities],
  )

  const spawnOne = useCallback(
    (draft: Omit<GameEntity, 'id'>) => {
      if (statusRef.current !== 'running') return
      if (entitiesRef.current.length >= optsRef.current.pace.maxConcurrent) return
      placeEntity(draft)
    },
    [placeEntity],
  )

  /** 玩法侧奖励分（墨雨成画奖励 MOYU-03） */
  const addBonus = useCallback(
    (points: number) => {
      if (statusRef.current !== 'running') return
      setHud({ score: hudRef.current.score + points })
    },
    [setHud],
  )

  // ── 结束（生命耗尽 / 计时耗尽 / 练习模式手动结束）──
  const finish = useCallback(() => {
    if (statusRef.current !== 'running') return
    cancelAnimationFrame(rafRef.current)
    const s = statsRef.current
    const elapsed = Math.max(0.001, (performance.now() - startTsRef.current) / 1000)
    const accuracy = s.keystrokes > 0 ? s.correctKeys / s.keystrokes : 0
    const kps = s.keystrokes / elapsed
    const consistency = computeConsistency(correctTimesRef.current)
    const summary: GameSummary = {
      gameId: optsRef.current.gameId,
      score: hudRef.current.score,
      accuracy,
      kps: Math.round(kps * 100) / 100,
      consistency,
      maxCombo: hudRef.current.maxCombo,
      hits: s.hits,
      misses: s.misses,
      rating: computeRating({ accuracy, kps, consistency }),
      time: Math.round(elapsed),
      missedEntities: missedRef.current,
      wrongKeyCounts: s.wrongKeyCounts,
      ghost: ghostRef.current,
    }
    setStatusBoth('over')
    optsRef.current.onGameOver(summary)
  }, [setStatusBoth])

  // ── 清除一个目标（计分 / 连击 / 特效）──
  const clearEntity = useCallback(
    (entity: GameEntity) => {
      const s = statsRef.current
      s.hits += 1
      ghostRef.current.push(Math.round(performance.now() - startTsRef.current))
      const gained = entityScore(entity.text.length, hudRef.current.combo, optsRef.current.tier)
      const combo = hudRef.current.combo + 1
      setHud({ score: hudRef.current.score + gained, combo, maxCombo: Math.max(hudRef.current.maxCombo, combo) })
      posRef.current.delete(entity.id)
      setEntities(entitiesRef.current.filter((e) => e.id !== entity.id))
      setLocked(null)
      setInput('')
      optsRef.current.onCleared?.(entity)
    },
    [setEntities, setHud, setInput, setLocked],
  )

  // ── 错误击键（断连击、记热图；目标保留可重新打起）──
  const wrongChar = useCallback(
    (char: string) => {
      const s = statsRef.current
      s.keystrokes += 1
      s.wrongKeys += 1
      const keyCode = CHAR_TO_CODE[char] ?? CHAR_TO_CODE[char.toLowerCase()] ?? 'Unknown'
      s.wrongKeyCounts[keyCode] = (s.wrongKeyCounts[keyCode] ?? 0) + 1
      correctTimesRef.current = []
      setHud({ combo: 0 })
      setLocked(null)
      setInput('')
      optsRef.current.onWrong?.(keyCode)
    },
    [setHud, setInput, setLocked],
  )

  /**
   * 核心匹配：把一串字符按当前轨逐字匹配。
   * - 对码轨：匹配目标 code 串（如 'jing'）；
   * - 上屏轨：匹配目标 text 串（如 '静'）；
   * 未锁定时按前缀找**最接近底线**的目标自动锁定（Ink Rain 口径）。
   */
  const applyChars = useCallback(
    (chars: string) => {
      if (statusRef.current !== 'running') return
      const matchOf = (e: GameEntity) => (optsRef.current.track === 'code' ? e.code.toLowerCase() : e.text)
      for (const raw of chars) {
        const char = optsRef.current.track === 'code' ? raw.toLowerCase() : raw
        if (!char) continue
        const s = statsRef.current
        s.keystrokes += 1

        // 已锁定：严格按锁定目标判定（打错即断，不临时改锁）
        const locked = lockedRef.current != null ? entitiesRef.current.find((e) => e.id === lockedRef.current) : undefined
        const target =
          locked ??
          (() => {
            const cands = entitiesRef.current.filter((e) => matchOf(e).startsWith(inputRef.current + char))
            if (cands.length === 0) return undefined
            // 多个同前缀 → 锁定最危险（最接近底线）的一个
            return cands.reduce((a, b) => (posRef.current.get(b.id)!.y > posRef.current.get(a.id)!.y ? b : a))
          })()

        if (!target) {
          wrongChar(char)
          return
        }
        const next = inputRef.current + char
        if (!matchOf(target).startsWith(next)) {
          wrongChar(char)
          return
        }
        // 命中
        s.correctKeys += 1
        correctTimesRef.current.push(performance.now())
        optsRef.current.onCorrect?.()
        if (lockedRef.current == null) setLocked(target.id)
        if (next.length >= matchOf(target).length) {
          clearEntity(target)
        } else {
          setInput(next)
        }
      }
    },
    [clearEntity, setInput, setLocked, wrongChar],
  )

  /** 对码轨：单字符入口 */
  const handleChar = useCallback((char: string) => applyChars(char), [applyChars])

  /** 上屏轨：一次上屏可能多字，逐字校验（基线 02 §3.5 B1） */
  const handleCommit = useCallback((text: string) => applyChars(text), [applyChars])

  /** 放弃当前锁定目标（Backspace/Esc，MOYU-05）：不扣分、断连击、目标保留 */
  const abandon = useCallback(() => {
    if (lockedRef.current == null) return
    setLocked(null)
    setInput('')
    setHud({ combo: 0 })
  }, [setHud, setInput, setLocked])

  /** 跳过（成语接龙卡住时）：不计连击、不惩罚；链推进由玩法 onSkipped 处理 */
  const skip = useCallback(() => {
    const target =
      (lockedRef.current != null ? entitiesRef.current.find((e) => e.id === lockedRef.current) : undefined) ??
      (entitiesRef.current.length > 0
        ? entitiesRef.current.reduce((a, b) => (posRef.current.get(b.id)!.y > posRef.current.get(a.id)!.y ? b : a))
        : undefined)
    if (!target) return
    posRef.current.delete(target.id)
    setEntities(entitiesRef.current.filter((e) => e.id !== target.id))
    setLocked(null)
    setInput('')
    optsRef.current.onSkipped?.(target)
  }, [setEntities, setInput, setLocked])

  /** 漏打：触碰底线 */
  const missEntity = useCallback(
    (entity: GameEntity) => {
      const s = statsRef.current
      s.misses += 1
      missedRef.current.push(entity)
      posRef.current.delete(entity.id)
      setEntities(entitiesRef.current.filter((e) => e.id !== entity.id))
      if (lockedRef.current === entity.id) {
        setLocked(null)
        setInput('')
      }
      setHud({ combo: 0 })
      optsRef.current.onMissed?.(entity)
      if (!optsRef.current.practice) {
        const lives = hudRef.current.lives - 1
        setHud({ lives })
        if (lives <= 0) finish()
      }
    },
    [finish, setEntities, setHud, setInput, setLocked],
  )

  // ── 主循环（rAF：位移 / 限时 / 定时生成 / 帧订阅）──
  useEffect(() => {
    if (!enabled || statusRef.current !== 'running') return
    lastTsRef.current = performance.now()
    const loop = (ts: number) => {
      const dt = Math.min(0.1, (ts - lastTsRef.current) / 1000)
      lastTsRef.current = ts

      // 限时（挑战模式且 durationSec > 0）：ref 每帧走，state 仅按整秒刷新
      if (!optsRef.current.practice && optsRef.current.durationSec > 0) {
        const left = Math.max(0, hudRef.current.timeLeft - dt)
        hudRef.current = { ...hudRef.current, timeLeft: left }
        const sec = Math.ceil(left)
        if (sec !== lastSecRef.current) {
          lastSecRef.current = sec
          setHudState(hudRef.current)
        }
        if (left <= 0) {
          finish()
          return
        }
      }

      // 位移 + 触碰底线判定
      for (const e of [...entitiesRef.current]) {
        const p = posRef.current.get(e.id)
        if (!p) continue
        p.y += p.vy * dt
        if (p.y >= 1) missEntity(e)
      }

      // 定时生成
      if (optsRef.current.timerSpawn) {
        spawnAccRef.current += dt
        if (spawnAccRef.current >= optsRef.current.pace.spawnIntervalSec) {
          spawnAccRef.current = 0
          if (entitiesRef.current.length < optsRef.current.pace.maxConcurrent) {
            const entity = optsRef.current.spawn({ entities: entitiesRef.current, combo: hudRef.current.combo })
            if (entity) placeEntity(entity)
          }
        }
      }

      emitFrame()
      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafRef.current)
  }, [enabled, emitFrame, finish, missEntity, placeEntity, status])

  // ── 开始 / 重开 ──
  const start = useCallback(() => {
    cancelAnimationFrame(rafRef.current)
    entitiesRef.current = []
    posRef.current.clear()
    lockedRef.current = null
    inputRef.current = ''
    statsRef.current = { hits: 0, misses: 0, keystrokes: 0, correctKeys: 0, wrongKeys: 0, wrongKeyCounts: {} }
    correctTimesRef.current = []
    ghostRef.current = []
    missedRef.current = []
    idRef.current = 1
    spawnAccRef.current = 0
    lastSecRef.current = -1
    hudRef.current = { score: 0, combo: 0, maxCombo: 0, lives: optsRef.current.lives, timeLeft: optsRef.current.durationSec }
    setHudState(hudRef.current)
    setEntitiesState([])
    setLockedIdState(null)
    setInputState('')
    startTsRef.current = performance.now()
    setStatusBoth('running')
  }, [setStatusBoth])

  /** 练习模式手动结束（MOYU-04：练习永不失败，但用户可主动结束看复盘） */
  const endPractice = useCallback(() => finish(), [finish])

  const running = status === 'running'

  return useMemo(
    () => ({
      entities,
      lockedId,
      input,
      score: hud.score,
      combo: hud.combo,
      maxCombo: hud.maxCombo,
      lives: hud.lives,
      timeLeft: hud.timeLeft,
      status,
      running,
      start,
      handleChar,
      handleCommit,
      abandon,
      skip,
      endPractice,
      spawnOne,
      addBonus,
      subscribeFrame,
    }),
    [
      abandon,
      addBonus,
      endPractice,
      entities,
      handleChar,
      handleCommit,
      hud.combo,
      hud.lives,
      hud.maxCombo,
      hud.score,
      hud.timeLeft,
      input,
      lockedId,
      running,
      skip,
      spawnOne,
      start,
      status,
      subscribeFrame,
    ],
  )
}
