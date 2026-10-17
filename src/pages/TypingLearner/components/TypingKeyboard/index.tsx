/**
 * TypingKeyboard —— 打字模式常驻输入键盘（spec-20261017-v1 / 04）
 *
 * 形态：完整 QWERTY（数字行 / 字母三行 / 空格行），键位与实物一致（KB-03）。
 * 标注：仅小鹤双拼显示三区（声母角标 + 主字母 + 韵母）；全拼/英语只显示主字母（KB-10）。
 * 高亮：待按 indigo-500 实心 + 底部 2px 条 + 微放大（非仅颜色，KB-09-1）；
 *       按错抖动 + 红（KB-09-2，颜色与动画并存）；
 *       卡住 3 秒自闪 / Ctrl+J 重放 → hintTrigger / cursor 不变 3s 自动触发（KB-12）。
 * 🔴 键位事实（声母/韵母归属）唯一真源 = 基线 A1 §2.2，经 src/resources/flypyKeyLabels.ts 抄录。
 */

import { FLYPY_KEY_LABELS, flypyKeyTooltip } from '@/resources/flypyKeyLabels'
import Tooltip from '@/components/Tooltip'
import { classNames } from '@/utils'
import useWindowSize from '@/hooks/useWindowSize'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Fragment } from 'react'
import IconChevronDown from '~icons/tabler/chevron-down'

export type TypingKeyboardScheme = 'quanpin' | 'flypy' | 'en'

/** 显式的 字符 → 物理键 code 映射（KB-19：不得用字符串拼接） */
export const CHAR_TO_CODE: Record<string, string> = {
  a: 'KeyA', b: 'KeyB', c: 'KeyC', d: 'KeyD', e: 'KeyE', f: 'KeyF', g: 'KeyG', h: 'KeyH', i: 'KeyI', j: 'KeyJ',
  k: 'KeyK', l: 'KeyL', m: 'KeyM', n: 'KeyN', o: 'KeyO', p: 'KeyP', q: 'KeyQ', r: 'KeyR', s: 'KeyS', t: 'KeyT',
  u: 'KeyU', v: 'KeyV', w: 'KeyW', x: 'KeyX', y: 'KeyY', z: 'KeyZ',
  ' ': 'Space',
  '`': 'Backquote', '~': 'Backquote',
  '1': 'Digit1', '2': 'Digit2', '3': 'Digit3', '4': 'Digit4', '5': 'Digit5',
  '6': 'Digit6', '7': 'Digit7', '8': 'Digit8', '9': 'Digit9', '0': 'Digit0',
  '-': 'Minus', '_': 'Minus', '=': 'Equal', '+': 'Equal',
  '[': 'BracketLeft', '{': 'BracketLeft', ']': 'BracketRight', '}': 'BracketRight',
  '\\': 'Backslash', '|': 'Backslash',
  ';': 'Semicolon', ':': 'Semicolon', "'": 'Quote', '"': 'Quote',
  ',': 'Comma', '<': 'Comma', '.': 'Period', '>': 'Period', '/': 'Slash', '?': 'Slash',
}

export type TypingKeyboardProps = {
  scheme: TypingKeyboardScheme
  /** 当前题的目标编码（如 'vs'，已做 ␣ 替换） */
  targetCode: string
  /** 已正确击键数（= 当前应按的下标） */
  cursor: number
  /** 最近一次按错的物理键 code（如 'KeyX'），300ms 后由父组件置 undefined */
  wrongKeyCode?: string
  /** 重放提示计数器（Ctrl+J 时 +1，触发当前键闪一次，KB-12） */
  hintTrigger?: number
  /** 题面行数较多时缩小键高（KB-06 高度预算） */
  density?: 'normal' | 'compact' | 'mini'
  /** 练习是否进行中（卡住自闪仅在练习中启用） */
  active: boolean
  collapsed: boolean
  onToggleCollapsed: () => void
  /** 点击键帽产生等价击键（KB-14，可选）：传入该键对应的字符 */
  onKeyClick?: (char: string) => void
}

type KeyDef = {
  code: string
  label: string
  /** 宽度（u 的倍数） */
  units: number
  /** 点击时产生的字符（功能键不产生） */
  char?: string
}

const letter = (ch: string): KeyDef => ({ code: `Key${ch.toUpperCase()}`, label: ch.toUpperCase(), units: 1, char: ch })
const fn = (code: string, label: string, units: number): KeyDef => ({ code, label, units })
const sym = (code: string, label: string, char: string, units = 1): KeyDef => ({ code, label, units, char })

/** 6 行键位（每行合计 15u，与 ANSI 104 键位置关系一致；KB-03） */
const ROWS: KeyDef[][] = [
  // 行 0：数字行（不标注声韵母）
  [
    sym('Backquote', '`', '`'),
    sym('Digit1', '1', '1'), sym('Digit2', '2', '2'), sym('Digit3', '3', '3'), sym('Digit4', '4', '4'),
    sym('Digit5', '5', '5'), sym('Digit6', '6', '6'), sym('Digit7', '7', '7'), sym('Digit8', '8', '8'),
    sym('Digit9', '9', '9'), sym('Digit0', '0', '0'),
    sym('Minus', '-', '-'), sym('Equal', '=', '='),
    fn('Backspace', 'Backspace', 2),
  ],
  // 行 1：Tab + Q~P + [ ] \
  [
    fn('Tab', 'Tab', 1.5),
    letter('q'), letter('w'), letter('e'), letter('r'), letter('t'), letter('y'), letter('u'), letter('i'),
    letter('o'), letter('p'),
    sym('BracketLeft', '[', '['),
    sym('BracketRight', ']', ']'),
    sym('Backslash', '\\', '\\', 1.5),
  ],
  // 行 2：Caps + A~L + ; ' Enter
  [
    fn('CapsLock', 'Caps', 1.75),
    letter('a'), letter('s'), letter('d'), letter('f'), letter('g'), letter('h'), letter('j'), letter('k'), letter('l'),
    sym('Semicolon', ';', ';'),
    sym('Quote', "'", "'"),
    fn('Enter', 'Enter', 2.25),
  ],
  // 行 3：Shift + Z~M + , . / Shift
  [
    fn('ShiftLeft', 'Shift', 2.5),
    letter('z'), letter('x'), letter('c'), letter('v'), letter('b'), letter('n'), letter('m'),
    sym('Comma', ',', ','),
    sym('Period', '.', '.'),
    sym('Slash', '/', '/'),
    fn('ShiftRight', 'Shift', 2.5),
  ],
  // 行 4：Ctrl Win Alt Space Alt Win Ctrl（空格可点击，英语轨需要）
  [
    fn('ControlLeft', 'Ctrl', 1.5),
    fn('MetaLeft', '⊞', 1.5),
    fn('AltLeft', 'Alt', 1.5),
    sym('Space', '', ' ', 6),
    fn('AltRight', 'Alt', 1.5),
    fn('MetaRight', '⊞', 1.5),
    fn('ControlRight', 'Ctrl', 1.5),
  ],
]

/**
 * 键面韵母过滤（KB-01 / ACC-06-22）：
 * - ü 家族（ü / üe）只在 tooltip 展示，不上键面；
 * - `er` 不上 R 键面——A1 §2.2 权威「承载韵母」R 仅 `uan`，er 是 E+R 穿透编码
 *   （C-1 已关闭：er=ER），非 R 键承载；er 事实在 tooltip 中说明。
 */
function faceFinal(finals: string[]): string | undefined {
  const shown = finals.filter((f) => !f.startsWith('ü') && f !== 'er')
  return shown.length > 0 ? shown.join('/') : undefined
}

/** 闪烁持续时长（KB-12） */
const FLASH_MS = 800
/** 卡住自闪阈值（KB-12） */
const STUCK_MS = 3000

export default function TypingKeyboard({
  scheme,
  targetCode,
  cursor,
  wrongKeyCode,
  hintTrigger,
  density = 'normal',
  active,
  collapsed,
  onToggleCollapsed,
  onKeyClick,
}: TypingKeyboardProps) {
  const { width } = useWindowSize()

  // KB-04：三档尺度过流（≥1280: 40px；1024–1280: 38px；768–1024: 36px；更窄按 92vw 收缩）
  // KB-06：总高预算 200~220px → 基准取 40px（5 行 × 40 + 4 × 5 = 220）；
  // 题面行数多时逐档压缩键高（compact -4 / mini -8，「行数完整 > 键高」）。
  const keyU = useMemo(() => {
    const base = width >= 1280 ? 40 : width >= 1024 ? 38 : 36
    const shrunk = base - (density === 'compact' ? 4 : density === 'mini' ? 8 : 0)
    const gap = shrunk >= 40 ? 5 : 4
    const maxByWidth = Math.floor((width * 0.92 - 14 * gap) / 15)
    return Math.max(20, Math.min(shrunk, maxByWidth))
  }, [width, density])
  const gap = keyU >= 44 ? 6 : keyU >= 40 ? 5 : 4

  const nextChar = cursor < targetCode.length ? targetCode[cursor] : undefined
  const nextCode = nextChar !== undefined ? CHAR_TO_CODE[nextChar] : undefined
  // V/I/U 双语义：第一键位（cursor 偶数）高亮声母角标，第二键位高亮韵母（KB-02）
  const nextZone: 'all' | 'initial' | 'final' =
    scheme === 'flypy' && nextCode && ['KeyV', 'KeyI', 'KeyU'].includes(nextCode)
      ? cursor % 2 === 0
        ? 'initial'
        : 'final'
      : 'all'

  const doneCodes = useMemo(() => {
    const set = new Set<string>()
    for (let i = 0; i < cursor && i < targetCode.length; i++) {
      const code = CHAR_TO_CODE[targetCode[i]]
      if (code) set.add(code)
    }
    return set
  }, [cursor, targetCode])

  // ---------- 闪烁（KB-12）：hintTrigger 变化或卡住 3 秒 → 当前键闪 800ms ----------
  const [flashOn, setFlashOn] = useState(false)
  // 用计数器而非布尔量，保证连续两次触发都能重新点燃 800ms
  const [flashSeq, setFlashSeq] = useState(0)
  const lastCursorRef = useRef(cursor)

  useEffect(() => {
    lastCursorRef.current = cursor
  }, [cursor])

  // Ctrl+J 重放
  useEffect(() => {
    if (hintTrigger && hintTrigger > 0) setFlashSeq((n) => n + 1)
  }, [hintTrigger])

  // 卡住自闪：cursor 连续 3 秒未变且练习进行中
  useEffect(() => {
    if (!active || nextCode === undefined) return
    const timer = setTimeout(() => {
      if (lastCursorRef.current === cursor) setFlashSeq((n) => n + 1)
    }, STUCK_MS)
    return () => clearTimeout(timer)
  }, [active, cursor, nextCode])

  // 闪烁 800ms 后熄灭（KB-12：闪两下 —— 800ms 亮 + 800ms 灭 + 800ms 亮）
  useEffect(() => {
    if (flashSeq === 0) return
    setFlashOn(true)
    const t1 = window.setTimeout(() => setFlashOn(false), FLASH_MS)
    const t2 = window.setTimeout(() => setFlashOn(true), FLASH_MS * 2)
    const t3 = window.setTimeout(() => setFlashOn(false), FLASH_MS * 3)
    return () => {
      window.clearTimeout(t1)
      window.clearTimeout(t2)
      window.clearTimeout(t3)
    }
  }, [flashSeq])

  const annotatedCount = useMemo(
    () => (scheme === 'flypy' ? Object.values(FLYPY_KEY_LABELS).filter((l) => l.initials.length + l.finals.length > 0).length : 0),
    [scheme],
  )

  const schemeName = scheme === 'en' ? '英语' : scheme === 'flypy' ? '小鹤双拼' : '全拼'
  const schemeTitle = scheme === 'en' ? '键盘' : scheme === 'flypy' ? '小鹤双拼 · 键位提示' : '全拼 · 键盘'

  return (
    <div className="mx-auto w-fit max-w-[92vw]">
      {/* 标题栏（KB-08） */}
      <div className="mb-2 flex h-6 items-center justify-between">
        <span className="text-xs text-gray-400">{schemeTitle}</span>
        <button
          type="button"
          className="flex items-center gap-1 text-xs text-gray-400 transition-colors duration-300 hover:text-indigo-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
          onClick={onToggleCollapsed}
          aria-expanded={!collapsed}
        >
          <IconChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${collapsed ? '-rotate-90' : ''}`} />
          {collapsed ? '展开' : '折叠'}
        </button>
      </div>

      {!collapsed && (
        <div
          role="group"
          aria-label={`${schemeName} 键盘，${annotatedCount} 个键标注了韵母`}
          className="my-card mx-auto w-fit rounded-xl bg-white px-4 py-3 dark:bg-gray-800"
        >
          <div className="flex flex-col" style={{ gap }}>
            {ROWS.map((row, rowIndex) => (
              <div key={rowIndex} className="flex justify-center" style={{ gap }}>
                {row.map((def) => {
                  const label = FLYPY_KEY_LABELS[def.label]
                  const annotated = scheme === 'flypy' && label !== undefined && (label.initials.length > 0 || label.finals.length > 0)
                  const initial = annotated ? label.initials[0] : undefined
                  const finalText = annotated ? faceFinal(label.finals) : undefined
                  const isNext = def.code === nextCode
                  const isDone = doneCodes.has(def.code)
                  const isWrong = def.code === wrongKeyCode
                  const isHint = isNext && flashOn
                  const zone: 'all' | 'initial' | 'final' = isNext ? nextZone : 'all'

                  const keyBody = (
                    <div
                      style={{ width: keyU * def.units, height: keyU }}
                      className={classNames(
                        'relative flex select-none items-center justify-center rounded-lg border shadow-sm',
                        isWrong
                          ? 'animate-[shake_0.3s] border-red-400 bg-red-50 dark:bg-red-900/30'
                          : isNext
                            ? 'scale-[1.03] border-indigo-500 bg-indigo-500 text-white ring-2 ring-indigo-300 ring-offset-1'
                            : isDone
                              ? 'border-gray-200 bg-indigo-100 dark:border-gray-600 dark:bg-indigo-900/40'
                              : 'border-gray-200 bg-white dark:border-gray-600 dark:bg-gray-700',
                        isHint ? 'animate-pulse' : undefined,
                        def.char && onKeyClick ? 'cursor-pointer hover:bg-indigo-50 dark:hover:bg-gray-600' : '',
                      )}
                      onClick={def.char && onKeyClick ? () => onKeyClick(def.char as string) : undefined}
                      onKeyDown={
                        def.char && onKeyClick
                          ? (e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault()
                                onKeyClick(def.char as string)
                              }
                            }
                          : undefined
                      }
                      tabIndex={annotated ? 0 : undefined}
                      role={annotated ? 'button' : undefined}
                      aria-label={
                        annotated
                          ? `${def.label} 键${initial ? `，声母 ${initial}` : ''}${finalText ? `，韵母 ${finalText.replace('/', '、')}` : ''}`
                          : undefined
                      }
                      aria-hidden={annotated ? undefined : true}
                    >
                      {/* 区 ①：声母角标（左上角） */}
                      {initial && (
                        <span
                          className={classNames(
                            'absolute left-1 top-0.5 font-mono text-[10px]',
                            zone === 'initial'
                              ? 'rounded bg-indigo-500 px-0.5 text-white'
                              : isNext
                                ? 'text-white/80'
                                : 'text-gray-400 dark:text-gray-500',
                          )}
                        >
                          {initial}
                        </span>
                      )}
                      {/* 区 ② + ③：主字母（居中偏上）与韵母（紧贴其下） */}
                      <div className="flex flex-col items-center justify-center pb-1">
                        <span
                          className={classNames(
                            'font-mono text-lg font-medium leading-none',
                            isNext ? 'text-white' : isDone ? 'text-indigo-500' : 'text-gray-600 dark:text-gray-200',
                          )}
                        >
                          {def.label}
                        </span>
                        {finalText && (
                          <span
                            className={classNames(
                              'font-mono text-[11px] leading-none',
                              zone === 'final'
                                ? 'rounded bg-indigo-500 px-1 text-white'
                                : isNext
                                  ? 'text-white/80'
                                  : 'text-indigo-500 dark:text-indigo-300',
                            )}
                          >
                            {finalText}
                          </span>
                        )}
                      </div>
                      {/* 待按：底部 2px 实心条（非颜色标记，KB-09；V/I/U 区高亮是附加提示，不替换底部条） */}
                      {isNext && (
                        <span className="absolute bottom-0 left-1/2 h-0.5 w-6 -translate-x-1/2 rounded bg-white/80" />
                      )}
                    </div>
                  )

                  return annotated ? (
                    <Tooltip key={def.code} content={flypyKeyTooltip(def.label)}>
                      {keyBody}
                    </Tooltip>
                  ) : (
                    <Fragment key={def.code}>{keyBody}</Fragment>
                  )
                })}
              </div>
            ))}
          </div>
          {/* 当前键播报（KB-18-3：仅在键变化时播报） */}
          <span className="sr-only" aria-live="polite">
            {nextCode ? `请按 ${nextChar?.toUpperCase()} 键` : ''}
          </span>
        </div>
      )}
    </div>
  )
}
