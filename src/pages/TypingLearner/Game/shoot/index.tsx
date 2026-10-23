/**
 * 诗词射击（spec-20261019-v1 / 03 SHOOT-01 ~ SHOOT-03，继承 09 §3.4 提级整合）
 *
 * ztype 式射击落地形态：
 * - 敌舰带「诗句中的词」标签，落地前打完即击毁；每击毁一词，诗句逐字显现；
 * - 三类敌人：常规舰（词语，练速度）/ 护盾舰（含易错韵母 in/ing、iang/uang 等，练精度）/
 *   BOSS（零声母与 ü 密集，练最难点）——难度轴 = 语料级别，不靠提速；
 * - 通关呈现全诗 + 作者 + 朝代（篇目均为公版，A2 §3.5）；
 * - 失败 = 复盘（被击落词 + 错键热图），无羞辱文案（09 §2.5）。
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useAtom, useAtomValue } from 'jotai'
import GameShell from '../components/GameShell'
import FallingTargets from '../components/FallingTargets'
import PoemReveal from '../components/PoemReveal'
import { GAME_TIER_LIVES, GAME_TIER_PACE } from '../config'
import { useShootCorpus } from '../corpus'
import { useSaveGameRecord } from '../hooks/useGameRecords'
import type { Poem } from '../corpus'
import type { GameWord } from '../engine/types'
import type { GameEntity, GameSummary } from '../engine/types'
import { useArcadeEngine } from '../engine/useArcadeEngine'
import type { GameTier } from '@/typings/typing'
import { typingGameTrackAtom, typingLanguageTabAtom, typingSchemeAtom } from '@/store/typingMode'
import useKeySounds from '@/hooks/useKeySounds'

/** 诗句切分队列构建：每 5 个词插入一个 BOSS 额外目标（波次加压） */
function buildQueue(poem: Poem, bossPool: GameWord[]): Omit<GameEntity, 'id'>[] {
  const list: Omit<GameEntity, 'id'>[] = []
  poem.chunks.forEach((c, i) => {
    if (i > 0 && i % 5 === 4 && bossPool.length > 0) {
      const b = bossPool[Math.floor(Math.random() * bossPool.length)]
      list.push({ text: b.text, code: b.code, kind: 'boss', meta: { extra: true } })
    }
    list.push({ text: c.text, code: c.code, kind: c.kind })
  })
  return list
}

export default function ShootGamePage() {
  const languageTab = useAtomValue(typingLanguageTabAtom)
  const scheme = useAtomValue(typingSchemeAtom)
  const [track, setTrack] = useAtom(typingGameTrackAtom)
  const [tier, setTier] = useState<GameTier>('intro')

  const { enemyPool, poems, isLoading } = useShootCorpus({ language: languageTab, scheme })
  const saveRecord = useSaveGameRecord()
  const [playWrong, , playCorrect] = useKeySounds()

  const [summary, setSummary] = useState<GameSummary | null>(null)
  const [poemIndex, setPoemIndex] = useState(0)
  const [revealedCount, setRevealedCount] = useState(0)
  const [poemCompleted, setPoemCompleted] = useState(false)

  const poemIndexRef = useRef(0)
  const revealedRef = useRef(0)
  const queueRef = useRef<Omit<GameEntity, 'id'>[]>([])
  const initializedRef = useRef(false)
  const completingRef = useRef(false)
  const poemsClearedRef = useRef(0)
  const bossPoolRef = useRef<GameWord[]>([])

  const poem: Poem | undefined = poems[poemIndex]
  const totalChars = poem ? poem.chunks.map((c) => c.text).join('').length : 0

  /** 本关收尾：展示全诗卡片 2.6s 后进入下一关 */
  const completePoem = useCallback(() => {
    if (completingRef.current || !poems.length) return
    completingRef.current = true
    setPoemCompleted(true)
    poemsClearedRef.current += 1
    window.setTimeout(() => {
      completingRef.current = false
      setPoemCompleted(false)
      const next = (poemIndexRef.current + 1) % poems.length
      poemIndexRef.current = next
      setPoemIndex(next)
      revealedRef.current = 0
      setRevealedCount(0)
      queueRef.current = buildQueue(poems[next], bossPoolRef.current)
      initializedRef.current = true
    }, 2600)
  }, [poems])

  const engine = useArcadeEngine({
    enabled: true,
    gameId: 'shoot',
    tier,
    track,
    lives: GAME_TIER_LIVES[tier],
    practice: false,
    durationSec: 0,
    pace: GAME_TIER_PACE[tier],
    pool: enemyPool,
    timerSpawn: true,
    spawn: ({ entities }) => {
      if (poems.length === 0) return null
      if (queueRef.current.length === 0) {
        if (entities.length > 0) return null
        // 队列空且场上无目标：未初始化则补建（语料晚于开局到达），否则本关结束
        if (!initializedRef.current) {
          queueRef.current = buildQueue(poems[poemIndexRef.current], bossPoolRef.current)
          initializedRef.current = true
          if (queueRef.current.length === 0) return null
        } else {
          completePoem()
          return null
        }
      }
      return queueRef.current.shift() ?? null
    },
    onCleared: (entity) => {
      playCorrect()
      // BOSS 额外目标不推进诗句显现
      if (entity.meta?.extra) return
      const next = revealedRef.current + entity.text.length
      revealedRef.current = next
      setRevealedCount(next)
      const remaining = engine.entities.filter((e) => e.id !== entity.id)
      if (next >= totalChars || (queueRef.current.length === 0 && remaining.length === 0)) {
        completePoem()
      }
    },
    onMissed: (entity) => {
      playWrong()
      const remaining = engine.entities.filter((e) => e.id !== entity.id)
      if (queueRef.current.length === 0 && remaining.length === 0 && revealedRef.current < totalChars) {
        completePoem()
      }
    },
    onWrong: () => playWrong(),
    onGameOver: (s) => {
      setSummary(s)
      void saveRecord({
        gameId: 'shoot',
        track,
        language: languageTab,
        tier,
        mode: 'challenge',
        score: s.score,
        accuracy: s.accuracy,
        kps: s.kps,
        maxCombo: s.maxCombo,
        rating: s.rating,
        time: s.time,
        ghost: s.ghost,
        poemsCleared: poemsClearedRef.current,
      })
    },
  })

  // BOSS 候选池（运行时从词层筛出的零声母/ü 密集词）
  useEffect(() => {
    bossPoolRef.current = enemyPool.filter((w) => w.kind === 'boss')
  }, [enemyPool])

  // 新局重置
  useEffect(() => {
    if (engine.status !== 'running') return
    poemIndexRef.current = 0
    revealedRef.current = 0
    queueRef.current = []
    initializedRef.current = false
    completingRef.current = false
    poemsClearedRef.current = 0
    setPoemIndex(0)
    setRevealedCount(0)
    setPoemCompleted(false)
    setSummary(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine.status])

  return (
    <GameShell
      gameId="shoot"
      title="诗词射击"
      keyboardScheme={languageTab === 'en' ? 'en' : scheme}
      languageTab={languageTab}
      engine={engine}
      summary={summary}
      mode="challenge"
      onModeChange={() => undefined}
      tier={tier}
      onTierChange={setTier}
      track={track}
      onTrackChange={setTrack}
      hasPracticeMode={false}
      howto={[
        '敌舰带着诗句中的词俯冲而来，在它触碰底线前打完即可击毁；漏打扣 1 点生命。',
        '每击毁一个词，上方诗句便显现一字；打完一关，呈现全诗与作者、朝代。',
        '三种敌舰：常规舰（练速度）、护盾舰（含 in/ing、iang/uang 等易错韵母，练精度）、BOSS（零声母与 ü 密集，练最难点）。',
        '难度靠语料升档而非提速——准确率永远比速度重要（打错会断连击）。',
      ]}
      statusExtra={
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {poem ? `《${poem.title}》 ${revealedCount}/${totalChars} 字` : '装载诗句中…'}
          {poemsClearedRef.current > 0 && ` · 已通关 ${poemsClearedRef.current} 关`}
        </span>
      }
    >
      {isLoading ? (
        <div className="flex h-full items-center justify-center text-gray-400">语料加载中…</div>
      ) : (
        <div className="flex h-full w-full flex-col gap-3">
          {poem && <PoemReveal poem={poem} revealedCount={revealedCount} completed={poemCompleted} />}
          <div className="relative flex-1">
            <FallingTargets engine={engine} />
          </div>
        </div>
      )}
    </GameShell>
  )
}
