/**
 * TypingPanel —— 打字模式练习区（spec-20261017-v1 / 02 §3.1、LAY-01 ~ LAY-06）
 *
 * 结构（等价替换学习模式 WordPanel，位置不动、容器不动）：
 *   目录预览带（h-3 置空保节奏，LAY-02 不保留分支 / KEEP-09）
 *   ├ 题面（TypingTarget：目标编码 + 汉字提示行）
 *   ├ 输入捕获（TypingInputHandler：对码轨 / 英语轨）
 *   ├ 键盘（TypingKeyboard，mt-6，KB-06）
 *   └ Progress（mb-3 mt-auto）
 *
 * 🔴 状态归属：题面判定状态（inputWord / letterStates / hasWrong …）上移到本组件，
 * 与键盘点击（KB-14）共用同一输入入口 appendChar；TypingTarget 为纯展示组件。
 * 判定逻辑逐行对齐学习模式 `WordPanel/components/Word`（保证统计口径一致）。
 *
 * 🔴 单屏不滚动（LAY-06）：任何素材都在 h-screen 内显示完，
 * 长文靠「6 行窗口 + 上下淡出」分段推进，不加 overflow-y-auto。
 */

import Progress from '@/pages/Typing/components/Progress'
import { TypingContext, TypingStateActionType } from '@/pages/Typing/store'
import type { TypingMaterialResource } from '@/typings/typing'
import { EXPLICIT_SPACE } from '@/constants'
import { typingChapterAtom, typingIsShowHanziAtom, typingKeyboardCollapsedAtom } from '@/store/typingMode'
import { isIgnoreCaseAtom, loopWordConfigAtom } from '@/store'
import useKeySounds from '@/hooks/useKeySounds'
import type { LetterMistakes } from '@/utils/db/record'
import { useAtomValue, useSetAtom } from 'jotai'
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useHotkeys } from 'react-hotkeys-hook'
import TypingInputHandler from '../TypingInputHandler'
import TypingKeyboard from '../TypingKeyboard'
import { CHAR_TO_CODE } from '../TypingKeyboard'
import TypingTarget from '../TypingTarget'
import type { TargetLetterState } from '../TypingTarget'
import { TypingTipAlert } from '../TypingTipAlert'
import { useSaveWordRecord } from '../../hooks/useTypingRecords'

/** 布局参数（LAY-03 / LAY-05） */
function layoutFor(materialType: TypingMaterialResource['materialType']): { charsPerLine: number; codeFontSize: number; hanziHintMax: number; windowLines: number } {
  switch (materialType) {
    case 'wenzhang':
      // 文章：拼音/汉字交替渲染，每组占 2 视觉行。
      // 字号下调以容纳「拼音行 + 汉字行」×3 组，保证单屏不滚动（LAY-06 优先）。
      return { charsPerLine: 30, codeFontSize: 22, hanziHintMax: 35, windowLines: 6 }
    case 'duanju':
      // 短句：26px / 24 键每行；交替布局下 6 视觉行 = 3 组
      return { charsPerLine: 24, codeFontSize: 26, hanziHintMax: 0, windowLines: 6 }
    case 'article':
    case 'paragraph':
      // 英语长文：无汉字行，仍是「一行编码」布局，按原口径 24px / 48 键、4 行
      return { charsPerLine: 48, codeFontSize: 24, hanziHintMax: 0, windowLines: 4 }
    default:
      // 单字 / 词 / 成语：一行
      return { charsPerLine: 0, codeFontSize: 40, hanziHintMax: 0, windowLines: 6 }
  }
}

/**
 * 完成一题的计量单位数（LAY-09 / §5.3）：
 * - 中文：按 notation 的汉字计数（不含标点）；
 * - 英语：按空格分词计数。
 */
function countUnits(word: { name: string; notation?: string }, scheme: 'quanpin' | 'flypy' | 'en'): number {
  if (scheme === 'en') {
    const trimmed = word.name.trim()
    return trimmed.length === 0 ? 0 : trimmed.split(/\s+/).length
  }
  const hanzi = (word.notation ?? '').match(/[\u4e00-\u9fff]/g)
  return hanzi ? hanzi.length : 0
}

export default function TypingPanel({
  material,
  scheme,
  onWordCompleted,
}: {
  material: TypingMaterialResource
  scheme: 'quanpin' | 'flypy' | 'en'
  /** 完成一题时上报计量单位数（LAY-09：中文=汉字数，英语=单词数） */
  onWordCompleted?: (units: number) => void
}) {
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const { state, dispatch } = useContext(TypingContext)!
  const isShowHanzi = useAtomValue(typingIsShowHanziAtom)
  const setIsShowHanzi = useSetAtom(typingIsShowHanziAtom)
  const collapsed = useAtomValue(typingKeyboardCollapsedAtom)
  const setCollapsed = useSetAtom(typingKeyboardCollapsedAtom)
  const { times: loopWordTimes } = useAtomValue(loopWordConfigAtom)
  const isIgnoreCase = useAtomValue(isIgnoreCaseAtom)
  const typingChapter = useAtomValue(typingChapterAtom)
  const saveWordRecord = useSaveWordRecord()
  const [playKeySound, playBeepSound, playHintSound] = useKeySounds()

  // ---------- 题面状态（上移自 WordComponent，与键盘点击共用） ----------
  const [inputWord, setInputWord] = useState('')
  const [letterStates, setLetterStates] = useState<TargetLetterState[]>([])
  const [hasWrong, setHasWrong] = useState(false)
  const [isFinished, setIsFinished] = useState(false)
  const [wrongKeyCode, setWrongKeyCode] = useState<string | undefined>(undefined)
  const [hintTrigger, setHintTrigger] = useState(0)
  const [currentWordExerciseCount, setCurrentWordExerciseCount] = useState(0)
  const [showTipAlert, setShowTipAlert] = useState(false)

  // 热路径 ref（避免闭帽过期；与 learning 模式 WordState 字段一一对应）
  const wrongCountRef = useRef(0)
  const letterTimeArrayRef = useRef<number[]>([])
  const letterMistakeRef = useRef<LetterMistakes>({})

  const currentWord = state.chapterData.words[state.chapterData.index]
  const layout = useMemo(() => layoutFor(material.materialType), [material.materialType])

  /** 目标编码（与 WordComponent 的 headword 处理一致：' '→␣、'…'→'..'） */
  const displayWord = useMemo(() => {
    if (!currentWord) return ''
    return currentWord.name.replace(/ /g, EXPLICIT_SPACE).replace(/…/g, '..')
  }, [currentWord])

  /** 换题 / 循环时重置（对齐 WordComponent 的 [word] effect：letterStates 按目标长度重建） */
  const resetWordState = useCallback((length: number) => {
    setInputWord('')
    setLetterStates(new Array(length).fill('normal'))
    setHasWrong(false)
    setIsFinished(false)
    wrongCountRef.current = 0
    letterTimeArrayRef.current = []
    letterMistakeRef.current = {}
    setWrongKeyCode(undefined)
  }, [])

  useEffect(() => {
    resetWordState(displayWord.length)
  }, [displayWord, resetWordState])

  // ---------- 输入入口（InputHandler 与键盘点击共用） ----------
  const appendChar = useCallback(
    (char: string) => {
      setInputWord((old) => {
        if (hasWrong) return old
        return old + (char === ' ' ? EXPLICIT_SPACE : char)
      })
    },
    [hasWrong],
  )

  // ---------- onFinish：循环次数 → 下一题 → 本章完成（同学习模式 WordPanel 逻辑） ----------
  const onFinish = useCallback(() => {
    if (state.chapterData.index < state.chapterData.words.length - 1 || currentWordExerciseCount < loopWordTimes - 1) {
      if (currentWordExerciseCount < loopWordTimes - 1) {
        setCurrentWordExerciseCount((old) => old + 1)
        dispatch({ type: TypingStateActionType.LOOP_CURRENT_WORD })
        resetWordState(displayWord.length)
      } else {
        setCurrentWordExerciseCount(0)
        dispatch({ type: TypingStateActionType.NEXT_WORD })
      }
    } else {
      dispatch({ type: TypingStateActionType.FINISH_CHAPTER })
    }
  }, [state.chapterData.index, state.chapterData.words.length, currentWordExerciseCount, loopWordTimes, dispatch, resetWordState, displayWord.length])

  // ---------- 判定 effect（逐行对齐 WordComponent 的 [inputWord] effect） ----------
  useEffect(() => {
    if (hasWrong || inputWord.length === 0 || displayWord.length === 0) return

    const inputLength = inputWord.length
    const inputChar = inputWord[inputLength - 1]
    const correctChar = displayWord[inputLength - 1]
    let isEqual = false
    if (inputChar != undefined && correctChar != undefined) {
      isEqual = isIgnoreCase ? inputChar.toLowerCase() === correctChar.toLowerCase() : inputChar === correctChar
    }

    if (isEqual) {
      // 输入正确时
      letterTimeArrayRef.current = [...letterTimeArrayRef.current, Date.now()]

      if (inputLength >= displayWord.length) {
        setLetterStates((old) => old.map((s, i) => (i === inputLength - 1 ? 'correct' : s)))
        setIsFinished(true)
        playHintSound()
      } else {
        setLetterStates((old) => old.map((s, i) => (i === inputLength - 1 ? 'correct' : s)))
        playKeySound()
      }

      dispatch({ type: TypingStateActionType.REPORT_CORRECT_WORD })
    } else {
      // 出错时
      playBeepSound()
      setLetterStates((old) => old.map((s, i) => (i === inputLength - 1 ? 'wrong' : s)))
      setHasWrong(true)
      setWrongKeyCode(CHAR_TO_CODE[inputChar])
      wrongCountRef.current += 1
      letterTimeArrayRef.current = []

      if (letterMistakeRef.current[inputLength - 1]) {
        letterMistakeRef.current[inputLength - 1] = [...letterMistakeRef.current[inputLength - 1], inputChar]
      } else {
        letterMistakeRef.current[inputLength - 1] = [inputChar]
      }
      dispatch({
        type: TypingStateActionType.REPORT_WRONG_WORD,
        payload: { letterMistake: JSON.parse(JSON.stringify(letterMistakeRef.current)) },
      })

      if (typingChapter === 0 && state.chapterData.index === 0 && wrongCountRef.current >= 3) {
        setShowTipAlert(true)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputWord])

  // ---------- 300ms 回滚（对齐 WordComponent） ----------
  useEffect(() => {
    if (!hasWrong) return
    const timer = setTimeout(() => {
      setInputWord('')
      setLetterStates((old) => old.map(() => 'normal' as TargetLetterState))
      setHasWrong(false)
      setWrongKeyCode(undefined)
    }, 300)
    return () => clearTimeout(timer)
  }, [hasWrong])

  // ---------- 完成本题：存档 + 推进（对齐 WordComponent 的 [isFinished] effect） ----------
  useEffect(() => {
    if (!isFinished || !currentWord) return
    dispatch({ type: TypingStateActionType.SET_IS_SAVING_RECORD, payload: true })
    saveWordRecord({
      word: currentWord.name,
      wrongCount: wrongCountRef.current,
      letterTimeArray: letterTimeArrayRef.current,
      letterMistake: letterMistakeRef.current,
    })
    onWordCompleted?.(countUnits(currentWord, scheme))
    onFinish()
    setIsFinished(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFinished])

  // ---------- 快捷键 ----------
  // Tab：切换汉字提示行（仅练习中拦截，保留焦点遍历保无障碍，ACC-06-32）
  useHotkeys(
    'tab',
    () => {
      if (state.isTyping) setIsShowHanzi(!isShowHanzi)
    },
    { enableOnFormTags: true, preventDefault: true, enabled: state.isTyping },
    [isShowHanzi, setIsShowHanzi, state.isTyping],
  )

  // Ctrl+J：重放编码提示（键盘闪当前键一次，无声音；KEEP-14）
  useHotkeys(
    'ctrl+j',
    () => {
      if (state.isTyping) setHintTrigger((n) => n + 1)
    },
    { enableOnFormTags: true, preventDefault: true },
  )

  // Ctrl+Shift+←/→：跳题（ACC-06-17：与学习模式一致）
  const onSkipWord = useCallback(
    (type: 'prev' | 'next') => {
      const newIndex = type === 'prev' ? state.chapterData.index - 1 : state.chapterData.index + 1
      if (newIndex < 0 || newIndex >= state.chapterData.words.length) return
      dispatch({ type: TypingStateActionType.SKIP_2_WORD_INDEX, newIndex })
    },
    [dispatch, state.chapterData.index, state.chapterData.words.length],
  )
  useHotkeys('Ctrl + Shift + ArrowLeft', (e) => { e.preventDefault(); onSkipWord('prev') }, { preventDefault: true })
  useHotkeys('Ctrl + Shift + ArrowRight', (e) => { e.preventDefault(); onSkipWord('next') }, { preventDefault: true })

  // ---------- 键盘参数 ----------
  const codeLength = currentWord?.name.length ?? 0
  const lineCount = layout.charsPerLine > 0 ? Math.ceil(codeLength / layout.charsPerLine) : 1
  // KB-06 密度分档：题面行数多时逐档压缩键高（「行数完整 > 键高」），保证单屏不滚动（LAY-06）
  const density: 'normal' | 'compact' | 'mini' = lineCount >= 3 ? 'mini' : lineCount === 2 ? 'compact' : 'normal'

  const hanzi = useMemo(() => {
    const notation = currentWord?.notation ?? ''
    if (layout.hanziHintMax > 0 && notation.length > layout.hanziHintMax) {
      return notation.slice(0, layout.hanziHintMax) + '…'
    }
    return notation
  }, [currentWord?.notation, layout.hanziHintMax])

  /** 逐字对齐单元（中文素材才有；英语素材不输出，走旧渲染） */
  const units = (currentWord as { units?: { char: string; code: string }[] } | undefined)?.units

  return (
    <div className="container flex h-full w-full flex-col items-center justify-center">
      {/* 目录预览带：KEEP-09 默认关闭，置空但保留 12px 高度维持垂直节奏（LAY-02 不保留分支） */}
      <div className="container flex h-3 w-full shrink-0 grow-0 justify-between px-12 pt-2" />

      <div className="container flex flex-grow flex-col items-center justify-center">
        {currentWord && (
          <div className="relative flex w-full justify-center">
            {!state.isTyping && (
              <div className="absolute flex h-full w-full justify-center">
                <div className="z-10 flex w-full items-center backdrop-blur-sm">
                  <p className="w-full select-none text-center text-xl text-gray-600 dark:text-gray-50">
                    按任意键{state.timerData.time ? '继续' : '开始'}
                  </p>
                </div>
              </div>
            )}
            <div className="relative flex flex-col items-center">
              <TypingInputHandler
                scheme={scheme}
                onChar={(char) => {
                  if (hasWrong) return
                  appendChar(char)
                }}
              />
              <TypingTarget
                displayWord={displayWord}
                letterStates={letterStates}
                cursor={inputWord.length}
                scheme={scheme}
                isShowHanzi={isShowHanzi}
                hanzi={hanzi}
                charsPerLine={layout.charsPerLine}
                codeFontSize={layout.codeFontSize}
                windowLines={layout.windowLines}
                units={units}
              />
              {/* 键盘（KB-06：与题面 mt-6；全拼/英语也渲染，仅无标注，KB-10） */}
              <div className="mt-6 w-full">
                <TypingKeyboard
                  scheme={scheme}
                  targetCode={displayWord}
                  cursor={inputWord.length}
                  wrongKeyCode={wrongKeyCode}
                  hintTrigger={hintTrigger}
                  density={density}
                  active={state.isTyping}
                  collapsed={collapsed}
                  onToggleCollapsed={() => setCollapsed(!collapsed)}
                  onKeyClick={(char) => {
                    if (!state.isTyping) return
                    if (hasWrong) return
                    appendChar(char)
                  }}
                />
              </div>
            </div>
          </div>
        )}
      </div>
      <Progress className={`mb-3 mt-auto ${state.isTyping ? 'opacity-100' : 'opacity-0'}`} />
      <TypingTipAlert className="fixed bottom-10 right-3" show={showTipAlert} setShow={setShowTipAlert} />
    </div>
  )
}
