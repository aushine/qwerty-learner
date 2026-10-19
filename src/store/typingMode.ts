/**
 * 打字模式状态原子 —— spec-20261017-v1 / 01 §2.4、05 DATA-07
 *
 * DATA-07 的 7 个持久化 atom（localStorage key 与现网无重复，DATA-08 已逐一核对）：
 *   appMode / typingLanguageTab / typingScheme / typingMaterialId / typingChapter /
 *   typingKeyboardCollapsed / typingIsShowHanzi
 *
 * 🔴 MODE-01 / GAL-13：以上 atom **只服务打字模式**，绝不承载学习模式状态；
 * 学习模式侧不新增任何 atom。
 *
 * 另加 3 个**非持久化**协调 atom（MODE-06 的切换确认条需要跨组件通信，
 * 不写入 localStorage，不与任何现网 key 冲突）：
 *   typingPracticeActiveAtom / pendingModeSwitchAtom / typingPausedBySwitcherAtom
 */

import type { AppMode, TypingInputTrack, TypingLanguageTab, TypingSchemeId } from '@/typings/typing'
import { atom } from 'jotai'

const warnedKeys = new Set<string>()

function warnOnce(key: string, message: string) {
  if (warnedKeys.has(key)) return
  warnedKeys.add(key)
  console.warn(message)
}

function readStored<T>(key: string, isValid: (v: unknown) => v is T, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key)
    if (raw === null) return fallback
    const parsed: unknown = JSON.parse(raw)
    if (isValid(parsed)) return parsed
    warnOnce(key, `[typing] localStorage ${key} 为非法值 ${raw}，已回落缺省值 ${JSON.stringify(fallback)}`)
  } catch {
    // 读取失败：回落缺省值，不阻断渲染（01 §2.4）
  }
  return fallback
}

function writeStored(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // 写入失败（隐私模式等）：仅内存态，不阻断渲染
  }
}

/**
 * 带校验的持久化 atom（ACC-06-12 / ACC-03-13 / ACC-03-14）：
 * 读取时校验合法性并 warn（每个 key 只 warn 一次），非法值回落缺省；
 * 写入时同步 localStorage。
 */
function persistedAtom<T>(key: string, fallback: T, isValid: (v: unknown) => v is T) {
  const base = atom<T>(readStored(key, isValid, fallback))
  return atom(
    (get) => get(base),
    (_get, set, newValue: T) => {
      set(base, newValue)
      writeStored(key, newValue)
    },
  )
}

const isAppMode = (v: unknown): v is AppMode => v === 'learn' || v === 'typing'
const isLanguageTab = (v: unknown): v is TypingLanguageTab => v === 'zh' || v === 'en'
const isScheme = (v: unknown): v is TypingSchemeId => v === 'quanpin' || v === 'flypy'
const isInputTrack = (v: unknown): v is TypingInputTrack => v === 'code' || v === 'ime'
const isNonEmptyString = (v: unknown): v is string => typeof v === 'string' && v.length > 0
const isChapterIndex = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0

/** 当前模式（只用于入口高亮与「记住上次模式」；渲染分支由路由决定，MODE-04） */
export const appModeAtom = persistedAtom<AppMode>('appMode', 'learn', isAppMode)

/** 语言 Tab（GAL-04：为空则 zh） */
export const typingLanguageTabAtom = persistedAtom<TypingLanguageTab>('typingLanguageTab', 'zh', isLanguageTab)

/** 输入方式（GAL-08：外部写入非法值时回落 quanpin） */
export const typingSchemeAtom = persistedAtom<TypingSchemeId>('typingScheme', 'quanpin', isScheme)

/**
 * 输入轨（spec-20261017-v2 / 02 SPEED2-01）：
 * `code` = 全拼/双拼对码轨；`ime` = 打字测速（上屏轨）。
 * 与 scheme 正交：切到 ime 时不重置 scheme，切回来仍是上次的双拼。
 */
export const typingInputTrackAtom = persistedAtom<TypingInputTrack>('typingInputTrack', 'code', isInputTrack)

/** 当前素材 id（ACC-03-14：非法值回落 zh-quanpin-zi-500） */
export const typingMaterialIdAtom = persistedAtom<string>(
  'typingMaterialId',
  'zh-quanpin-zi-500',
  isNonEmptyString,
)

/** 打字模式独立章节（🔴 GAL-13：不得复用学习模式的 currentChapterAtom） */
export const typingChapterAtom = persistedAtom<number>('typingChapter', 0, isChapterIndex)

/** 键盘折叠（KB-08：刷新后仍为折叠态） */
export const typingKeyboardCollapsedAtom = persistedAtom<boolean>('typingKeyboardCollapsed', false, (v): v is boolean => typeof v === 'boolean')

/** 汉字提示行显隐（KEEP-13：默认可见） */
export const typingIsShowHanziAtom = persistedAtom<boolean>('typingIsShowHanzi', true, (v): v is boolean => typeof v === 'boolean')

// ── 以下为非持久化协调 atom（MODE-06） ──

/** 打字模式是否正在练习中（由 TypingLearner 写入，ModeSwitcher 读取） */
export const typingPracticeActiveAtom = atom(false)

/** 待确认的模式切换目标（非空时 Header 显示确认条） */
export const pendingModeSwitchAtom = atom<AppMode | null>(null)

/** 本次暂停是否由模式切换确认条触发（用于「继续练习」后恢复） */
export const typingPausedBySwitcherAtom = atom(false)
