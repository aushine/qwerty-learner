/**
 * 墨雨 · 落字成画（spec-20261019-v1 / 02 MOYU-01 ~ MOYU-07）
 *
 * 招牌新玩法（基线 09 完全没有，参考 Ink Rain 范式本土化）：
 * - 字/词如墨滴从「纸面」上方落下；用户直接打字，按前缀**自动锁定**最危险目标；
 * - 每打对一个目标 → Canvas 程序化生成一笔水墨笔触（贝塞尔 + 收锋 + 晕染）；
 * - 集满一幅画的笔数 → 成画奖励 + 朱红印章；
 * - 练习模式不失败；挑战模式 90 秒 + 生命（按难度 5/4/3）；
 * - Backspace/Esc 放弃当前目标（断连击、不扣分）。
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAtom, useAtomValue } from 'jotai'
import GameShell from '../components/GameShell'
import InkCanvas from '../components/InkCanvas'
import { getInkPaintings } from '../data/inkPaintings'
import type { InkCoord } from '../data/inkPaintings'
import { GAME_TIER_LIVES, GAME_TIER_PACE, MOYU_CHALLENGE_SEC } from '../config'
import { useMoyuPool } from '../corpus'
import { useSaveGameRecord } from '../hooks/useGameRecords'
import { paintingBonus } from '../engine/scoring'
import { useArcadeEngine } from '../engine/useArcadeEngine'
import type { GameSummary } from '../engine/types'
import type { GameMode, GameTier } from '@/typings/typing'
import { typingGameTrackAtom, typingLanguageTabAtom, typingSchemeAtom } from '@/store/typingMode'
import useKeySounds from '@/hooks/useKeySounds'

type ActiveStroke = { coord: InkCoord; born: number; key: number }

export default function MoyuGamePage() {
  const languageTab = useAtomValue(typingLanguageTabAtom)
  const scheme = useAtomValue(typingSchemeAtom)
  const [track, setTrack] = useAtom(typingGameTrackAtom)
  const [tier, setTier] = useState<GameTier>('intro')
  const [mode, setMode] = useState<GameMode>('practice')

  const { pool, isLoading } = useMoyuPool({ language: languageTab, tier, scheme })
  const saveRecord = useSaveGameRecord()
  const [playWrong, , playCorrect] = useKeySounds()

  const [summary, setSummary] = useState<GameSummary | null>(null)

  // ── 画作状态（成画进度持久显示在画布角落，MOYU-03）──
  const [paintingIndex, setPaintingIndex] = useState(0)
  const [strokeCount, setStrokeCount] = useState(0)
  const strokeCountRef = useRef(0)
  const paintingIdxRef = useRef(0)
  const strokeKeyRef = useRef(0)
  const [doneStrokes, setDoneStrokes] = useState<InkCoord[]>([])
  const [activeStrokes, setActiveStrokes] = useState<ActiveStroke[]>([])
  const [seals, setSeals] = useState<{ x: number; y: number }[]>([])

  const currentPainting = useMemo(() => getInkPaintings(tier)[paintingIndex % 3], [tier, paintingIndex])
  const paintingRef = useRef(currentPainting)
  paintingRef.current = currentPainting

  const handleCleared = useCallback(() => {
    playCorrect()
    const painting = paintingRef.current
    const slot = painting.composition[strokeCountRef.current % painting.composition.length]
    strokeCountRef.current += 1
    setStrokeCount(strokeCountRef.current)
    setActiveStrokes((prev) => [...prev, { coord: slot, born: performance.now(), key: ++strokeKeyRef.current }])
  }, [playCorrect])

  const engine = useArcadeEngine({
    enabled: true,
    gameId: 'moyu',
    tier,
    track,
    lives: mode === 'challenge' ? GAME_TIER_LIVES[tier] : 0,
    practice: mode === 'practice',
    durationSec: mode === 'challenge' ? MOYU_CHALLENGE_SEC : 0,
    pace: GAME_TIER_PACE[tier],
    pool,
    timerSpawn: true,
    spawn: ({ entities }) => {
      if (pool.length === 0) return null
      const onScreen = new Set(entities.map((e) => e.text))
      const candidates = pool.filter((w) => !onScreen.has(w.text))
      if (candidates.length === 0) return null
      const w = candidates[Math.floor(Math.random() * candidates.length)]
      return { text: w.text, code: w.code, kind: 'normal' }
    },
    onCleared: handleCleared,
    onMissed: () => playWrong(),
    onWrong: () => playWrong(),
    onGameOver: (s) => {
      setSummary(s)
      void saveRecord({
        gameId: 'moyu',
        track,
        language: languageTab,
        tier,
        mode,
        score: s.score,
        accuracy: s.accuracy,
        kps: s.kps,
        maxCombo: s.maxCombo,
        rating: s.rating,
        time: s.time,
        ghost: s.ghost,
        strokes: doneStrokes.length,
      })
    },
  })

  // 笔触生长动画收尾：完成的笔落入 doneStrokes；满足笔数 → 成画
  useEffect(() => {
    if (activeStrokes.length === 0) return
    const timer = window.setTimeout(() => {
      const now = performance.now()
      setActiveStrokes((prev) => {
        const finished = prev.filter((s) => now - s.born >= 200)
        if (finished.length === 0) return prev
        const rest = prev.filter((s) => now - s.born < 200)
        setDoneStrokes((d) => [...d, ...finished.map((s) => s.coord)])
        if (rest.length === 0 && strokeCountRef.current >= paintingRef.current.composition.length) {
          strokeCountRef.current = 0
          setStrokeCount(0)
          paintingIdxRef.current += 1
          setPaintingIndex(paintingIdxRef.current)
          setSeals((s) => [...s, { x: 0.82, y: 0.78 }])
          engine.addBonus(paintingBonus(tier))
        }
        return rest
      })
    }, 210)
    return () => window.clearTimeout(timer)
  }, [activeStrokes, engine, tier])

  // 新局重置画作
  useEffect(() => {
    if (engine.status !== 'running') return
    paintingIdxRef.current = 0
    strokeCountRef.current = 0
    setPaintingIndex(0)
    setStrokeCount(0)
    setDoneStrokes([])
    setActiveStrokes([])
    setSeals([])
    setSummary(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine.status])

  return (
    <GameShell
      gameId="moyu"
      title="墨雨 · 落字成画"
      keyboardScheme={languageTab === 'en' ? 'en' : scheme}
      languageTab={languageTab}
      engine={engine}
      summary={summary}
      mode={mode}
      onModeChange={setMode}
      tier={tier}
      onTierChange={setTier}
      track={track}
      onTrackChange={setTrack}
      hasPracticeMode
      howto={[
        '字词如墨滴从纸面上方落下——直接开始打字，匹配的目标会自动锁定（多个同前缀时锁最接近底线的）。',
        '每打对一个目标化成一笔水墨；集满一幅画的笔数即成画，获得奖励分，并在右下角钤一枚朱红印。',
        '打错、漏打、或按 Backspace/Esc 放弃当前目标会断连击；练习模式永不失败，挑战模式限时 90 秒、生命随难度 5/4/3。',
        '对码轨绕过输入法校验键位（默认）；上屏轨用你自己的输入法，汉字上屏即算打对。',
      ]}
      statusExtra={
        <span className="text-xs text-gray-500 dark:text-gray-400">
          第 {paintingIndex + 1} 幅 · {strokeCount}/{currentPainting.composition.length} 笔
        </span>
      }
    >
      {isLoading ? (
        <div className="flex h-full items-center justify-center text-gray-400">语料加载中…</div>
      ) : (
        <InkCanvas
          engine={engine}
          tier={tier}
          paintingStrokes={currentPainting.composition.length}
          paintingIndex={paintingIndex}
          doneStrokes={doneStrokes}
          activeStrokes={activeStrokes}
          seals={seals}
          combo={engine.combo}
        />
      )}
    </GameShell>
  )
}
