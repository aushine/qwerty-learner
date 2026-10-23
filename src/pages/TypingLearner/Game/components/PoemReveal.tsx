/**
 * PoemReveal —— 诗词射击「诗句逐字显现」条（spec-20261019-v1 / 03 SHOOT-01）
 *
 * 敌舰（诗句中的词）被击毁后，对应诗句逐字显现；整关完成后呈现全诗 + 作者 + 朝代。
 * 呼应 06 §4.3 H-4「练打字顺便背完唐诗三百首」，全部篇目为公版（A2 §3.5）。
 */

import classNames from 'classnames'
import type { Poem } from '../corpus'

export default function PoemReveal({
  poem,
  revealedCount,
  completed,
}: {
  poem: Poem
  /** 已显现字数 */
  revealedCount: number
  /** 本关是否已完成（展示全诗 + 作者 + 朝代） */
  completed: boolean
}) {
  const chars = poem.chunks.map((c) => c.text).join('')
  let shown = 0

  return (
    <div className="my-card flex w-full flex-col gap-3 rounded-2xl bg-white/95 p-5 dark:bg-gray-800/95">
      <div className="flex items-baseline justify-between">
        <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100">
          {poem.title || '本关文本'}
          {completed && poem.author && <span className="ml-2 text-sm font-normal text-gray-500 dark:text-gray-400">〔{poem.author}〕</span>}
        </h3>
        {completed && poem.dynasty && (
          <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
            {poem.dynasty}
          </span>
        )}
      </div>

      {/* 逐字显现：已击毁的字为墨色，未显现的为浅灰占位 */}
      <div className="flex flex-wrap gap-x-1 gap-y-2 text-2xl leading-relaxed" style={{ fontFamily: '"Kaiti SC","KaiTi","STKaiti","Noto Serif SC",serif' }}>
        {chars.split('').map((ch, i) => {
          const isRevealed = i < revealedCount
          if (isRevealed) shown += 1
          return (
            <span
              key={`${ch}-${i}`}
              className={classNames(
                'transition-colors duration-300',
                isRevealed ? 'text-gray-800 dark:text-gray-100' : 'text-gray-300 dark:text-gray-600',
              )}
            >
              {isRevealed ? ch : '□'}
            </span>
          )
        })}
      </div>

      {completed && (
        <p className="text-xs text-indigo-500 dark:text-indigo-300">
          通关！全诗已呈现——这一关的字，你都打过了。
        </p>
      )}
    </div>
  )
}
