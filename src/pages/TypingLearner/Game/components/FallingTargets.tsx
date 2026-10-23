/**
 * FallingTargets —— DOM 落字轨（诗词射击 / 成语接龙共用）
 *
 * 位置由引擎帧订阅直接写 transform（不走 React state，避免每帧重渲染）。
 * 诗词射击的敌舰类型（常规/护盾/Boss）用 CSS 几何区分，**不引外部美术素材**（A2 §2.3）。
 */

import { useEffect, useRef } from 'react'
import classNames from 'classnames'
import type { ArcadeEngine } from '../engine/useArcadeEngine'
import type { EntityKind } from '../engine/types'

/** 敌舰视觉（CSS 几何区分三类；无任何外部素材） */
const KIND_STYLE: Record<EntityKind, string> = {
  normal: 'border-gray-300 bg-white text-gray-700 dark:border-gray-500 dark:bg-gray-700 dark:text-gray-100',
  shield: 'border-sky-400 bg-sky-50 text-sky-700 dark:border-sky-500 dark:bg-sky-900/40 dark:text-sky-200',
  boss: 'border-rose-400 bg-rose-50 text-rose-700 dark:border-rose-500 dark:bg-rose-900/40 dark:text-rose-200',
}

const KIND_BADGE: Record<EntityKind, string | null> = {
  normal: null,
  shield: '盾',
  boss: 'BOSS',
}

export default function FallingTargets({
  engine,
  renderText,
}: {
  engine: ArcadeEngine
  /** 自定义实体展示（成语接龙用掩码显示答案；默认直接展示文本） */
  renderText?: (entity: { text: string }) => string
}) {
  const nodesRef = useRef(new Map<number, HTMLDivElement>())

  useEffect(() => {
    return engine.subscribeFrame((ps) => {
      for (const p of ps) {
        const el = nodesRef.current.get(p.id)
        if (el) el.style.transform = `translate(${p.x * 100}%, ${p.y * 100}%) translate(-50%, -50%)`
      }
    })
  }, [engine])

  return (
    <div className="relative h-full w-full overflow-hidden">
      {/* 底线（墨滴/敌舰触碰即漏打） */}
      <div className="absolute bottom-0 left-0 h-1 w-full bg-gradient-to-r from-transparent via-indigo-300 to-transparent dark:via-indigo-600" />
      {engine.entities.map((e) => {
        const locked = engine.lockedId === e.id
        const typed = locked ? engine.input : ''
        const display = renderText ? renderText(e) : e.text
        const typedDisplay = typed.length > 0 ? display.slice(0, typed.length) : ''
        const restDisplay = display.slice(typed.length)
        return (
          <div
            key={e.id}
            ref={(el) => {
              if (el) nodesRef.current.set(e.id, el)
              else nodesRef.current.delete(e.id)
            }}
            className={classNames(
              'absolute left-0 top-0 flex items-center gap-1.5 rounded-xl border-2 px-3 py-1.5 shadow-sm transition-shadow',
              KIND_STYLE[e.kind],
              locked && 'ring-2 ring-indigo-400 ring-offset-1 dark:ring-offset-gray-900',
            )}
          >
            <span className="whitespace-nowrap text-lg font-medium tracking-wide">
              {typedDisplay.length > 0 ? (
                <>
                  <span className="text-indigo-500 dark:text-indigo-300">{typedDisplay}</span>
                  <span>{restDisplay}</span>
                </>
              ) : (
                display
              )}
            </span>
            {KIND_BADGE[e.kind] && (
              <span
                className={classNames(
                  'rounded px-1 text-[10px] font-bold',
                  e.kind === 'shield' ? 'bg-sky-200 text-sky-800 dark:bg-sky-700 dark:text-sky-100' : 'bg-rose-200 text-rose-800 dark:bg-rose-700 dark:text-rose-100',
                )}
              >
                {KIND_BADGE[e.kind]}
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}
