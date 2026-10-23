/**
 * 成语接龙（spec-20261019-v1 / 04 IDIOM-01 ~ IDIOM-03，继承 09 §3.3 落地）
 *
 * - 系统出一个成语，用户打出以它的**末字**开头的成语续接——接龙的字必须
 *   「打出」而非「选择」（它是打字练习，不是成语测验）；
 * - 三档提示降级：① 无提示（纯回忆）② 首字提示 ③ 拼音 + 候选成语列表；
 *   卡住允许跳过（不计连击、不惩罚）；
 * - 多音字按原调标注（拼音取自 quanpin 版 units，双拼编码不含声调，无影响）；
 * - 不显示商业词典释义（A2 §4.3 合规）；
 * - 死链处理（末字无开头成语）：自动开新链，不惩罚。
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useAtom, useAtomValue } from 'jotai'
import classNames from 'classnames'
import GameShell from '../components/GameShell'
import FallingTargets from '../components/FallingTargets'
import { GAME_TIER_LIVES, GAME_TIER_PACE } from '../config'
import { useIdiomPool } from '../corpus'
import { useSaveGameRecord } from '../hooks/useGameRecords'
import type { GameWord } from '../engine/types'
import type { GameSummary } from '../engine/types'
import { useArcadeEngine } from '../engine/useArcadeEngine'
import type { GameMode, GameTier } from '@/typings/typing'
import { typingGameTrackAtom, typingLanguageTabAtom, typingSchemeAtom } from '@/store/typingMode'
import useKeySounds from '@/hooks/useKeySounds'
import IconPlayerSkipForward from '~icons/tabler/player-skip-forward'

/** 提示档位（04 IDIOM-01 三档降级） */
const PROMPT_LEVELS = [
  { key: 0, label: '无提示' },
  { key: 1, label: '首字提示' },
  { key: 2, label: '拼音 + 候选' },
] as const

export default function IdiomGamePage() {
  const languageTab = useAtomValue(typingLanguageTabAtom)
  const scheme = useAtomValue(typingSchemeAtom)
  const [track, setTrack] = useAtom(typingGameTrackAtom)
  const [tier, setTier] = useState<GameTier>('intro')
  const [mode, setMode] = useState<GameMode>('practice')

  const { index, isLoading } = useIdiomPool({ scheme })
  const saveRecord = useSaveGameRecord()
  const [playWrong, , playCorrect] = useKeySounds()

  const [summary, setSummary] = useState<GameSummary | null>(null)
  const [prevIdiom, setPrevIdiom] = useState<GameWord | null>(null)
  const [target, setTarget] = useState<GameWord | null>(null)
  const [chainLength, setChainLength] = useState(0)
  const [lastCleared, setLastCleared] = useState<string | null>(null)
  const [promptLevel, setPromptLevel] = useState<0 | 1 | 2>(1)
  const [chainNotice, setChainNotice] = useState<string | null>(null)

  const prevIdiomRef = useRef<GameWord | null>(null)
  const targetRef = useRef<GameWord | null>(null)
  const chainRef = useRef(0)

  /** 取下一个目标：以 requiredChar 开头的随机成语；死链则开新链（不惩罚） */
  const pickNext = useCallback(
    (requiredChar: string): { idiom: GameWord; newChain: boolean } => {
      const list = index.byFirst.get(requiredChar) ?? []
      const filtered = list.filter((w) => w.text !== prevIdiomRef.current?.text)
      const pool = filtered.length > 0 ? filtered : list
      if (pool.length === 0) {
        const random = index.idioms[Math.floor(Math.random() * index.idioms.length)]
        return { idiom: random, newChain: true }
      }
      return { idiom: pool[Math.floor(Math.random() * pool.length)], newChain: false }
    },
    [index],
  )

  /** 推进接龙（cleared = 用户打对的成语；byUser = 是否计入接龙长度） */
  const advanceChain = useCallback(
    (cleared: GameWord | null, byUser: boolean) => {
      if (cleared) {
        prevIdiomRef.current = cleared
        setPrevIdiom(cleared)
        if (byUser) {
          chainRef.current += 1
          setChainLength(chainRef.current)
        }
      }
      const requiredChar = prevIdiomRef.current ? prevIdiomRef.current.text.slice(-1) : ''
      const { idiom, newChain } = pickNext(requiredChar)
      if (newChain && requiredChar) {
        setChainNotice(`没有找到以「${requiredChar}」开头的成语，已自动开新链`)
      } else {
        setChainNotice(null)
      }
      targetRef.current = idiom
      setTarget(idiom)
      window.setTimeout(() => {
        engine.spawnOne({ text: idiom.text, code: idiom.code, kind: 'normal' })
      }, 450)
    },
    // engine 在下方定义（闭包延迟求值，调用时已初始化）
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pickNext],
  )

  const engine = useArcadeEngine({
    enabled: true,
    gameId: 'idiom',
    tier,
    track,
    lives: mode === 'challenge' ? GAME_TIER_LIVES[tier] : 0,
    practice: mode === 'practice',
    durationSec: 0,
    // 接龙需要回忆时间，下落放慢（fallSec 12s）；不随 tier 提速
    pace: { ...GAME_TIER_PACE[tier], fallSec: 12 },
    pool: [],
    timerSpawn: false,
    spawn: () => null,
    onCleared: () => {
      playCorrect()
      const cleared = targetRef.current
      if (!cleared) return
      setLastCleared(cleared.text)
      advanceChain(cleared, true)
    },
    onSkipped: () => {
      const skipped = targetRef.current
      if (!skipped) return
      setLastCleared(`跳过：${skipped.text}`)
      advanceChain(skipped, false)
    },
    onMissed: () => {
      playWrong()
      const missed = targetRef.current
      if (missed) advanceChain(missed, false)
    },
    onWrong: () => playWrong(),
    onGameOver: (s) => {
      setSummary(s)
      void saveRecord({
        gameId: 'idiom',
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
        chainLength: chainRef.current,
      })
    },
  })

  // 新局重置（语料就绪后由 advanceChain 自动开出第一个成语）
  useEffect(() => {
    if (engine.status !== 'running') return
    prevIdiomRef.current = null
    targetRef.current = null
    chainRef.current = 0
    setPrevIdiom(null)
    setTarget(null)
    setChainLength(0)
    setLastCleared(null)
    setSummary(null)
    if (index.idioms.length > 0) advanceChain(null, false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine.status])

  const requiredChar = prevIdiom ? prevIdiom.text.slice(-1) : ''
  const candidates = requiredChar ? (index.byFirst.get(requiredChar) ?? []).slice(0, 6) : []

  return (
    <GameShell
      gameId="idiom"
      title="成语接龙"
      keyboardScheme={scheme}
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
        '系统出一个成语，你要打出以它的末字开头的成语续接（如 一心一意 → 意气风发）。',
        '三档提示可随时切换：无提示（纯回忆）/ 首字提示 / 拼音 + 候选成语；卡住了可以跳过（不计连击、不惩罚）。',
        '接龙的字必须「打出来」而不是选出来——这是打字练习，不是成语测验；多音字按原调标注拼音。',
        '练习模式永不失败；挑战模式漏接扣生命。打错会断连击，但不会有任何羞辱性提示。',
      ]}
      statusExtra={
        <span className="text-xs text-gray-500 dark:text-gray-400">
          接龙 ×{chainLength}
          {lastCleared && <span className="ml-2 text-indigo-500">{lastCleared}</span>}
        </span>
      }
    >
      {isLoading ? (
        <div className="flex h-full items-center justify-center text-gray-400">语料加载中…</div>
      ) : (
        <div className="flex h-full w-full flex-col gap-3">
          {/* 接龙轨道：上一成语 → 末字 → 待接目标 */}
          <div className="my-card flex flex-wrap items-center gap-x-4 gap-y-3 rounded-2xl bg-white/95 p-4 dark:bg-gray-800/95">
            <div className="flex items-center gap-2 text-lg">
              <span className="text-xs text-gray-400">上一成语</span>
              <span className="font-medium text-gray-700 dark:text-gray-200">{prevIdiom ? prevIdiom.text : '（开局随机）'}</span>
              {requiredChar && (
                <>
                  <span className="text-gray-400">→</span>
                  <span className="text-xs text-gray-400">末字</span>
                  <span className="text-2xl font-bold text-indigo-500">{requiredChar}</span>
                </>
              )}
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">提示</span>
              {PROMPT_LEVELS.map((lv) => (
                <button
                  key={lv.key}
                  type="button"
                  onClick={() => setPromptLevel(lv.key)}
                  className={classNames(
                    'rounded-[3rem] px-3 py-1 text-xs transition-colors',
                    promptLevel === lv.key
                      ? 'bg-indigo-400 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-indigo-100 dark:bg-gray-700 dark:text-gray-200',
                  )}
                >
                  {lv.label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => engine.skip()}
                disabled={!engine.running}
                className="flex items-center gap-1 rounded-[3rem] bg-gray-100 px-3 py-1 text-xs text-gray-600 transition-colors hover:bg-gray-200 disabled:opacity-40 dark:bg-gray-700 dark:text-gray-200"
                title="跳过当前成语（不计连击、不惩罚）"
              >
                <IconPlayerSkipForward className="h-3.5 w-3.5" />
                跳过
              </button>
            </div>

            {/* 拼音 + 候选（第三档提示） */}
            {promptLevel === 2 && target && (
              <div className="flex w-full flex-wrap items-center gap-2 border-t border-gray-100 pt-2 dark:border-gray-700">
                <span className="font-mono text-sm text-indigo-500">{(target.pinyins ?? []).join(' ')}</span>
                <span className="text-xs text-gray-400">候选：</span>
                {candidates.map((c) => (
                  <span
                    key={c.text}
                    className={classNames(
                      'rounded px-2 py-0.5 text-xs',
                      c.text === target.text
                        ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/50 dark:text-indigo-300'
                        : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400',
                    )}
                  >
                    {c.text}
                  </span>
                ))}
              </div>
            )}

            {chainNotice && (
              <p className="w-full text-xs text-amber-600 dark:text-amber-400">{chainNotice}</p>
            )}
          </div>

          {/* 落字轨（答案按提示档位掩码显示） */}
          <div className="relative flex-1">
            <FallingTargets
              engine={engine}
              renderText={(e) => {
                if (promptLevel === 0) return '□'.repeat(e.text.length)
                if (promptLevel === 1) return e.text[0] + '□'.repeat(e.text.length - 1)
                return e.text
              }}
            />
          </div>
        </div>
      )}
    </GameShell>
  )
}
