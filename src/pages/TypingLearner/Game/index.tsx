/**
 * 游戏中心卡片页（spec-20261019-v1 / 01 REQ-02）
 *
 * 路由 `/typing/game`：卡片网格呈现三个玩法，墨雨 ★ 招牌置顶；
 * 每张卡片含玩法名、一句话简介、难度标识（入门/进阶/挑战，复用语料难度 tier）、
 * 本地最佳成绩（纯本地，不显示服务端排行榜）；点击卡片进入玩法内页。
 * 异步幽灵（09 §3.5）为各玩法内覆盖层，不在中心页单独成卡。
 */

import Layout from '@/components/Layout'
import classNames from 'classnames'
import { useAtomValue, useSetAtom } from 'jotai'
import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import GameHeader from './components/GameHeader'
import TypingLanguageTabSwitcher from '../Gallery/TypingLanguageTabSwitcher'
import { GAME_CONFIGS, GAME_TIER_LABELS } from './config'
import { useGameBest } from './hooks/useGameRecords'
import { typingLanguageTabAtom } from '@/store/typingMode'
import type { GameBest } from './hooks/useGameRecords'
import type { GameConfig, GameTier, TypingInputTrack, TypingLanguageTab } from '@/typings/typing'
import IconStar from '~icons/tabler/star'
import IconChevronRight from '~icons/tabler/chevron-right'

const TIERS: GameTier[] = ['intro', 'mid', 'adv']
const EMPTY_BEST: GameBest = { bestScore: 0, bestRating: null, bestCombo: 0, playCount: 0 }

/** 本地最佳（按玩法默认轨；纯本地 Dexie 查询） */
function useGameBestState(gameId: GameConfig['id'], track: TypingInputTrack) {
  const load = useGameBest(gameId, track)
  const [best, setBest] = useState<GameBest>(EMPTY_BEST)
  useEffect(() => {
    let alive = true
    load().then((b) => {
      if (alive) setBest(b)
    })
    return () => {
      alive = false
    }
  }, [load])
  return best
}

function GameCard({ config, languageTab }: { config: GameConfig; languageTab: TypingLanguageTab }) {
  const navigate = useNavigate()
  const disabled = config.languageTab === 'zh' && languageTab === 'en'
  const best = useGameBestState(config.id, config.defaultTrack)

  const onEnter = useCallback(() => {
    if (disabled) return
    navigate(`/typing/game/${config.id}`)
  }, [config.id, disabled, navigate])

  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled}
      onClick={onEnter}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onEnter()
        }
      }}
      className={classNames(
        'my-card group relative flex w-full flex-col gap-3 rounded-2xl bg-white p-6 text-left transition-all duration-300 dark:bg-gray-800',
        disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:-translate-y-1 hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300',
      )}
    >
      {/* 招牌标识（00 §5：墨雨置顶 ★） */}
      {config.featured && (
        <span className="absolute right-4 top-4 flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
          <IconStar className="h-3.5 w-3.5" />
          招牌新玩法
        </span>
      )}

      <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100">{config.name}</h3>
      <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-300">{config.summary}</p>

      {/* 难度标识（复用语料难度 tier） */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-400">难度</span>
        {TIERS.map((t) => (
          <span key={t} className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-300">
            {GAME_TIER_LABELS[t]}
          </span>
        ))}
      </div>

      {/* 本地最佳（纯本地；无服务端排行榜，ACC-07） */}
      <div className="mt-auto flex items-end justify-between border-t border-gray-100 pt-3 dark:border-gray-700">
        <div className="text-xs text-gray-500 dark:text-gray-400">
          {disabled ? (
            <span>成语接龙为中文专属玩法</span>
          ) : best.playCount > 0 ? (
            <span>
              本地最佳 · {config.defaultTrack === 'code' ? '对码轨' : '上屏轨'}：
              <b className="text-indigo-500">{best.bestScore}</b> 分 · 评级 <b className="text-indigo-500">{best.bestRating}</b> · 最高连击{' '}
              <b className="text-indigo-500">{best.bestCombo}</b>
            </span>
          ) : (
            <span>暂无本地成绩，来打第一局吧</span>
          )}
        </div>
        {!disabled && (
          <span className="flex items-center text-sm text-indigo-500 transition-transform group-hover:translate-x-1">
            进入
            <IconChevronRight className="h-4 w-4" />
          </span>
        )}
      </div>
    </div>
  )
}

const GameCenterPage: React.FC = () => {
  const navigate = useNavigate()
  const languageTab = useAtomValue(typingLanguageTabAtom)
  const setLanguageTab = useSetAtom(typingLanguageTabAtom)

  return (
    <Layout>
      <GameHeader title="游戏中心" onBack={() => navigate('/typing')} backLabel="返回" />
      <div className="container mx-auto flex h-full flex-1 flex-col items-center px-10 pb-10">
        <div className="flex w-full max-w-5xl flex-col gap-8">
          {/* 语言 Tab（中文/英语；成语接龙在英语下置灰） */}
          <div className="flex items-center justify-between">
            <TypingLanguageTabSwitcher
              value={languageTab}
              onChange={(next) => {
                if (next !== languageTab) setLanguageTab(next)
              }}
            />
            <p className="text-xs text-gray-400">全部玩法免费 · 无广告 · 成绩仅保存在本地浏览器</p>
          </div>

          {/* 玩法卡片网格（墨雨 featured 置顶） */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {GAME_CONFIGS.map((config) => (
              <GameCard key={config.id} config={config} languageTab={languageTab} />
            ))}
          </div>
        </div>
      </div>
    </Layout>
  )
}

export default GameCenterPage
