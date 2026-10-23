/**
 * GameShell —— 玩法内页共用外壳（spec-20261019-v1 / 01 §三 玩法内页共用布局）
 *
 * 装配：上方状态条（分数/连击/生命/倒计时或纸数）、中央游戏区（children）、
 * 底部复用 TypingKeyboard 键位图（可选显示，高亮当前目标键）、输入捕获（双轨复用）。
 * 开始前展示设置条（难度/模式/输入轨 + 玩法说明 + 本地最佳）。
 */

import { memo, useCallback, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '@/components/Layout'
import classNames from 'classnames'
import GameHeader from './GameHeader'
import GameResultScreen from './GameResultScreen'
import TypingInputHandler from '../../components/TypingInputHandler'
import TypingKeyboard from '../../components/TypingKeyboard'
import UpstreamInputHandler from '../../components/UpstreamInputHandler'
import { GAME_TIER_FACTOR, GAME_TIER_LABELS } from '../config'
import { useGameBest } from '../hooks/useGameRecords'
import type { GameBest } from '../hooks/useGameRecords'
import type { ArcadeEngine } from '../engine/useArcadeEngine'
import type { GameSummary } from '../engine/types'
import type { GameId, GameMode, GameTier, TypingInputTrack } from '@/typings/typing'
import IconHeart from '~icons/tabler/heart'
import IconPlayerPlay from '~icons/tabler/player-play'
import IconRotate from '~icons/tabler/rotate'
import IconSquare from '~icons/tabler/square'

const MemoKeyboard = memo(TypingKeyboard)

const TIERS: GameTier[] = ['intro', 'mid', 'adv']

function Pill({
  active,
  onClick,
  children,
  disabled,
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={classNames(
        'rounded-[3rem] px-3.5 py-1.5 text-sm transition-colors',
        disabled
          ? 'cursor-not-allowed bg-gray-100 text-gray-300 dark:bg-gray-700 dark:text-gray-500'
          : active
          ? 'bg-indigo-400 text-white'
          : 'bg-white text-gray-600 hover:bg-indigo-100 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-600',
      )}
    >
      {children}
    </button>
  )
}

function useGameBestState(gameId: GameId, track: TypingInputTrack) {
  const load = useGameBest(gameId, track)
  const [best, setBest] = useState<GameBest>({ bestScore: 0, bestRating: null, bestCombo: 0, playCount: 0 })
  useEffect(() => {
    let alive = true
    load().then((b: GameBest) => {
      if (alive) setBest(b)
    })
    return () => {
      alive = false
    }
  }, [load])
  return best
}

export type GameShellProps = {
  gameId: GameId
  title: string
  /** 键盘显示方案 */
  keyboardScheme: 'quanpin' | 'flypy' | 'en'
  languageTab: 'zh' | 'en'
  engine: ArcadeEngine
  summary: GameSummary | null
  mode: GameMode
  onModeChange: (m: GameMode) => void
  tier: GameTier
  onTierChange: (t: GameTier) => void
  track: TypingInputTrack
  onTrackChange: (t: TypingInputTrack) => void
  hasPracticeMode: boolean
  /** 玩法说明（开始前展示） */
  howto: string[]
  /** 状态条附加信息（墨雨成画进度 / 诗句进度 / 接龙长度） */
  statusExtra?: ReactNode
  /** 游戏区（画布 / 战场 / 接龙轨道） */
  children: ReactNode
}

export default function GameShell({
  gameId,
  title,
  keyboardScheme,
  languageTab,
  engine,
  summary,
  mode,
  onModeChange,
  tier,
  onTierChange,
  track,
  onTrackChange,
  hasPracticeMode,
  howto,
  statusExtra,
  children,
}: GameShellProps) {
  const navigate = useNavigate()
  const best = useGameBestState(gameId, track)
  /** 上屏轨输入框重挂载计数（重开时清空 composition 游标） */
  const [session, setSession] = useState(0)

  const restart = useCallback(() => {
    setSession((s) => s + 1)
    engine.start()
  }, [engine])

  // Backspace / Esc 放弃当前锁定目标（MOYU-05：不扣分、断连击）
  useEffect(() => {
    if (!engine.running) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Backspace' || e.key === 'Escape') {
        e.preventDefault()
        engine.abandon()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [engine])

  // 未开始时按任意字母/空格/回车开局（与打字模式「按任意键开始」同口径）
  useEffect(() => {
    if (engine.running || engine.status !== 'idle') return
    const onKeyDown = (e: KeyboardEvent) => {
      // 模式切换按钮（2026-10-21 改版后为单个按钮，原 hover 浮层已删除）聚焦时，
      // Enter/Space 会激活该按钮完成模式切换，不应再误触发开局（避免一键双动作）。
      if (e.key === 'Enter' || e.key === ' ') {
        const active = document.activeElement as HTMLElement | null
        if (active?.closest('[data-testid="mode-toggle"]')) return
      }
      if (/^[a-zA-Z ]$/.test(e.key) || e.key === 'Enter') {
        e.preventDefault()
        engine.start()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [engine])

  const lockedEntity = engine.lockedId != null ? engine.entities.find((e: { id: number }) => e.id === engine.lockedId) : undefined

  return (
    <Layout>
      <GameHeader title={title} onBack={() => navigate('/typing/game')} backLabel="游戏中心">
        <button
          type="button"
          className="flex items-center gap-1 rounded-lg px-2 py-1 text-sm text-gray-600 transition-colors hover:bg-indigo-50 hover:text-indigo-500 dark:text-gray-200 dark:hover:bg-gray-700"
          onClick={restart}
          title="重新开始一局"
        >
          <IconRotate className="h-4 w-4" />
          重开
        </button>
      </GameHeader>

      <div className="container mx-auto flex h-full flex-1 flex-col px-10 pb-4">
        {/* ── 状态条（进行中）── */}
        {engine.running && (
          <div className="my-card mb-3 flex items-center gap-6 rounded-xl bg-white px-5 py-3 dark:bg-gray-800">
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-bold text-indigo-500">{engine.score}</span>
              <span className="text-xs text-gray-400">分</span>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-lg font-bold text-amber-500">{engine.combo}</span>
              <span className="text-xs text-gray-400">连击（×{(1 + Math.min(engine.combo, 100) * 0.01).toFixed(2)}）</span>
            </div>
            {mode === 'challenge' && (
              <div className="flex items-center gap-1.5">
                <IconHeart className="h-4 w-4 text-rose-500" />
                <span className="text-lg font-bold text-rose-500">{engine.lives}</span>
                <span className="text-xs text-gray-400">生命</span>
              </div>
            )}
            {mode === 'challenge' && engine.timeLeft > 0 && (
              <div className="flex items-baseline gap-1.5">
                <span className="text-lg font-bold text-gray-700 dark:text-gray-200">{Math.ceil(engine.timeLeft)}</span>
                <span className="text-xs text-gray-400">秒</span>
              </div>
            )}
            <div className="ml-auto flex items-center gap-4">
              {statusExtra}
              {mode === 'practice' && (
                <button
                  type="button"
                  className="flex items-center gap-1 rounded-lg bg-gray-100 px-3 py-1.5 text-xs text-gray-600 transition-colors hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200"
                  onClick={() => engine.endPractice()}
                >
                  <IconSquare className="h-3.5 w-3.5" />
                  结束练习并复盘
                </button>
              )}
            </div>
          </div>
        )}

        {/* ── 游戏区 ── */}
        <div className="relative flex-1 overflow-hidden rounded-2xl">{children}</div>

        {/* ── 键盘（对码轨显示并高亮当前目标键；上屏轨隐藏，SPEED2-09 同口径）── */}
        {track === 'code' && (
          <div className="mt-3 w-full">
            <MemoKeyboard
              scheme={keyboardScheme}
              targetCode={lockedEntity?.code ?? ''}
              cursor={engine.input.length}
              density="compact"
              active={engine.running}
              collapsed={false}
              onToggleCollapsed={() => undefined}
              onKeyClick={(char) => {
                if (engine.running) engine.handleChar(char)
              }}
            />
          </div>
        )}

        {/* ── 输入捕获（双轨复用：对码轨 password+keydown / 上屏轨 textarea+compositionend）── */}
        {track === 'code' ? (
          <TypingInputHandler scheme={keyboardScheme} active={engine.running} onChar={engine.handleChar} />
        ) : (
          <UpstreamInputHandler
            key={session}
            active={engine.running}
            onCommit={engine.handleCommit}
            isEnglish={languageTab === 'en'}
          />
        )}

        {/* ── 开始前：设置条 + 玩法说明 ── */}
        {!engine.running && (
          <div className="my-card mt-3 flex flex-col gap-4 rounded-xl bg-white p-5 dark:bg-gray-800">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
              {/* 难度（复用语料难度 tier） */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400">难度</span>
                {TIERS.map((t) => (
                  <Pill key={t} active={tier === t} onClick={() => onTierChange(t)}>
                    {GAME_TIER_LABELS[t]}
                    <span className="ml-1 text-[10px] opacity-70">×{GAME_TIER_FACTOR[t]}</span>
                  </Pill>
                ))}
              </div>
              {/* 模式（练习/挑战） */}
              {hasPracticeMode && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">模式</span>
                  <Pill active={mode === 'practice'} onClick={() => onModeChange('practice')}>
                    练习（不失败）
                  </Pill>
                  <Pill active={mode === 'challenge'} onClick={() => onModeChange('challenge')}>
                    挑战
                  </Pill>
                </div>
              )}
              {/* 输入轨（01 REQ-04：默认对码轨） */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400">输入轨</span>
                <Pill active={track === 'code'} onClick={() => onTrackChange('code')}>
                  对码轨
                </Pill>
                <Pill active={track === 'ime'} onClick={() => onTrackChange('ime')}>
                  上屏轨
                </Pill>
              </div>
              <button type="button" className="my-btn-primary ml-auto flex items-center gap-1.5 px-5 py-2" onClick={engine.start}>
                <IconPlayerPlay className="h-4 w-4" />
                开始游戏
              </button>
            </div>

            <div className="flex flex-col gap-1.5 border-t border-gray-100 pt-3 dark:border-gray-700">
              {howto.map((line) => (
                <p key={line} className="text-xs leading-relaxed text-gray-500 dark:text-gray-400">
                  · {line}
                </p>
              ))}
              <p className="text-xs text-gray-400">
                本地最佳（{track === 'code' ? '对码轨' : '上屏轨'}）：
                {best.playCount > 0 ? `${best.bestScore} 分 · 评级 ${best.bestRating} · 最高连击 ${best.bestCombo}（共 ${best.playCount} 局）` : '暂无成绩'}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ── 复盘页（失败=复盘；09 §2.5）── */}
      {summary && engine.status === 'over' && (
        <GameResultScreen summary={summary} mode={mode} onRestart={restart} onBackToCenter={() => navigate('/typing/game')} />
      )}
    </Layout>
  )
}
