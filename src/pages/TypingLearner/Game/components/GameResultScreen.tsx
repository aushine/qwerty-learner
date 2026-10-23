/**
 * GameResultScreen —— 单局复盘页（spec-20261019-v1 / 01 REQ-03 结束与复盘）
 *
 * 对齐 09 §2.5「不做失败惩罚性展示」：失败不显示「你太弱了」，
 * 而是展示「本局被击落的词 + 错键热图 + 单局评级 S/A/B/C/D/F（准确率一票否决）」，
 * 并提供「一键进入弱键强化」入口（前往打字模式选用出错键位相关语料练习）。
 */

import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import TypingKeyboard from '../../components/TypingKeyboard'
import { RATING_EXPLAIN } from '../engine/rating'
import type { GameSummary } from '../engine/types'
import type { GameMode } from '@/typings/typing'
import IconRotate from '~icons/tabler/rotate'
import IconGrid from '~icons/tabler/grid-dots'
import IconTarget from '~icons/tabler/target-arrow'

const RATING_COLOR: Record<string, string> = {
  S: 'bg-amber-400 text-white',
  A: 'bg-indigo-500 text-white',
  B: 'bg-sky-500 text-white',
  C: 'bg-emerald-500 text-white',
  D: 'bg-gray-400 text-white',
  F: 'bg-gray-500 text-white',
}

export default function GameResultScreen({
  summary,
  mode,
  onRestart,
  onBackToCenter,
}: {
  summary: GameSummary
  mode: GameMode
  onRestart: () => void
  onBackToCenter: () => void
}) {
  const navigate = useNavigate()

  const wrongKeys = useMemo(() => {
    const entries = Object.entries(summary.wrongKeyCounts).sort((a, b) => b[1] - a[1])
    return entries.slice(0, 5)
  }, [summary.wrongKeyCounts])

  const accPercent = Math.round(summary.accuracy * 100)

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center overflow-y-auto bg-white/85 backdrop-blur-sm dark:bg-gray-900/85">
      <div className="my-card m-6 flex w-full max-w-2xl flex-col gap-5 rounded-2xl bg-white p-7 dark:bg-gray-800">
        {/* 标题 + 评级 */}
        <div className="flex items-center gap-4">
          <div className={`flex h-16 w-16 items-center justify-center rounded-2xl text-3xl font-black shadow-sm ${RATING_COLOR[summary.rating]}`}>
            {summary.rating}
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">本局复盘</h2>
            <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">{RATING_EXPLAIN[summary.rating]}</p>
          </div>
        </div>

        {mode === 'practice' && (
          <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
            练习模式永不失败——这一局没有输赢，只有数据。
          </p>
        )}

        {/* 成绩面板 */}
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: '分数', value: String(summary.score) },
            { label: '字准确率', value: `${accPercent}%` },
            { label: '击键', value: `${summary.kps.toFixed(1)}/秒` },
            { label: '一致性', value: `${summary.consistency}%` },
            { label: '最高连击', value: String(summary.maxCombo) },
            { label: '清除', value: String(summary.hits) },
            { label: '漏打', value: String(summary.misses) },
            { label: '时长', value: `${summary.time}s` },
          ].map((item) => (
            <div key={item.label} className="rounded-xl bg-gray-50 px-3 py-2.5 text-center dark:bg-gray-700/50">
              <div className="text-lg font-bold text-gray-800 dark:text-gray-100">{item.value}</div>
              <div className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{item.label}</div>
            </div>
          ))}
        </div>

        {/* 本局被击落的词（失败→诊断数据，09 §3.4 差异化第 4 条） */}
        {summary.missedEntities.length > 0 && (
          <div>
            <h3 className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-200">本局被击落的词（漏打）</h3>
            <div className="flex flex-wrap gap-2">
              {summary.missedEntities.map((e, i) => (
                <span key={`${e.id}-${i}`} className="rounded-lg bg-rose-50 px-2.5 py-1 text-sm text-rose-600 dark:bg-rose-900/30 dark:text-rose-300">
                  {e.text}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* 错键热图（复用键盘组件，按错误次数分级着色） */}
        {Object.keys(summary.wrongKeyCounts).length > 0 && (
          <div>
            <h3 className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-200">
              错键热图
              {wrongKeys.length > 0 && (
                <span className="ml-2 font-normal text-gray-400">
                  最薄弱：
                  {wrongKeys.map(([code, n]) => `${code.replace('Key', '')}×${n}`).join('、')}
                </span>
              )}
            </h3>
            <div className="overflow-hidden rounded-xl">
              <TypingKeyboard
                scheme="quanpin"
                targetCode=""
                cursor={0}
                density="mini"
                active={false}
                collapsed={false}
                onToggleCollapsed={() => undefined}
                errorCounts={summary.wrongKeyCounts}
              />
            </div>
          </div>
        )}

        {/* 操作：再来一局 / 返回中心 / 一键弱键强化 */}
        <div className="flex flex-wrap items-center gap-3 border-t border-gray-100 pt-4 dark:border-gray-700">
          <button type="button" className="my-btn-primary flex items-center gap-1.5 px-5 py-2" onClick={onRestart}>
            <IconRotate className="h-4 w-4" />
            再来一局
          </button>
          <button
            type="button"
            className="flex items-center gap-1.5 rounded-lg bg-gray-100 px-5 py-2 text-gray-700 transition-colors hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
            onClick={onBackToCenter}
          >
            <IconGrid className="h-4 w-4" />
            返回游戏中心
          </button>
          <button
            type="button"
            className="flex items-center gap-1.5 rounded-lg px-5 py-2 text-indigo-500 transition-colors hover:bg-indigo-50 dark:hover:bg-gray-700"
            onClick={() => navigate('/typing/gallery')}
            title="前往打字模式，选用包含出错键位的语料进行弱键强化练习"
          >
            <IconTarget className="h-4 w-4" />
            一键弱键强化
          </button>
        </div>
      </div>
    </div>
  )
}
