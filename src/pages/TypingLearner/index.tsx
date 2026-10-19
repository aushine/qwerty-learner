/**
 * TypingLearner —— 打字模式主页（spec-20261017-v1 / 02 §3.1）
 *
 * 与学习模式 Typing/index.tsx 的平行关系（REG-15：学习模式页面一行不改）：
 * - 同一套 TypingContext + typingReducer（统计口径一致）；
 * - 词表走 useWordList 参数化（DATA-09 方案 A）：url / chapter / chapterLength 由打字模式 atom 提供；
 * - 读写只碰打字模式 atom（GAL-13），绝不写 currentDictInfoAtom / currentChapterAtom。
 *
 * 🔴 MODE-06：练习中被模式切换确认条暂停 → SET_IS_TYPING false；
 *    确认条消失且 pausedBySwitcher → 自动恢复练习（ACC-06-11）。
 * 🔴 MODE-07：切走不触发 FINISH_CHAPTER（未打完不算成绩）。
 */

import Layout from '@/components/Layout'
import Header from '@/components/Header'
import { DonateCard } from '@/components/DonateCard'
import { useConfetti } from '@/pages/Typing/hooks/useConfetti'
import { useWordList } from '@/pages/Typing/hooks/useWordList'
import StartButton from '@/pages/Typing/components/StartButton'
import { TypingContext, TypingStateActionType, initialState, typingReducer } from '@/pages/Typing/store'
import { findMaterial, resolveMaterialId, resolveMaterialUrl } from '@/resources/typingMaterials'
import {
  pendingModeSwitchAtom,
  typingChapterAtom,
  typingInputTrackAtom,
  typingMaterialIdAtom,
  typingPausedBySwitcherAtom,
  typingPracticeActiveAtom,
  typingSchemeAtom,
} from '@/store/typingMode'
import { randomConfigAtom } from '@/store'
import { IsDesktop, isLegal } from '@/utils'
import { useSaveTypingChapterRecord } from './hooks/useTypingRecords'
import TypingMaterialButton from './components/TypingMaterialButton'
import TypingPanel from './components/TypingPanel'
import TypingResultScreen from './components/TypingResultScreen'
import TypingSpeed from './components/TypingSpeed'
import TypingSwitcher from './components/TypingSwitcher'
import UpstreamPanel from './components/UpstreamPanel'
import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import type React from 'react'
import { useCallback, useEffect, useState } from 'react'
import { useImmerReducer } from 'use-immer'
import { useNavigate } from 'react-router-dom'

const TypingLearnerPage: React.FC = () => {
  const [state, dispatch] = useImmerReducer(typingReducer, structuredClone(initialState))
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [loadError, setLoadError] = useState<Error | undefined>(undefined)
  // LAY-09：字/分派生值（已完成计量单位数：中文=汉字，英语=单词）
  const [unitsDone, setUnitsDone] = useState(0)
  // SPEED2-07：上屏轨的「已提交字数」（用于指标条的「上屏字数」）
  const [, setImeSubmitted] = useState(0)
  // 非阻塞提示（SPEED2-11：标点格式错误等）
  const [notice, setNotice] = useState<string | undefined>(undefined)

  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(undefined), 4000)
    return () => window.clearTimeout(timer)
  }, [notice])

  const materialId = useAtomValue(typingMaterialIdAtom)
  const setMaterialId = useSetAtom(typingMaterialIdAtom)
  const scheme = useAtomValue(typingSchemeAtom)
  const inputTrack = useAtomValue(typingInputTrackAtom)
  const [chapter, setChapter] = useAtom(typingChapterAtom)
  const randomConfig = useAtomValue(randomConfigAtom)
  const isMobile = !IsDesktop()
  const navigate = useNavigate()

  const saveChapterRecord = useSaveTypingChapterRecord()

  // 方案与素材不一致时（如外部改写 typingScheme，ACC-06-12）解析为同内容素材并回写
  const effectiveMaterialId = resolveMaterialId(materialId, scheme)
  useEffect(() => {
    if (effectiveMaterialId !== materialId) setMaterialId(effectiveMaterialId)
  }, [effectiveMaterialId, materialId, setMaterialId])

  const material = findMaterial(effectiveMaterialId)
  /** 上屏轨的题面文本来源：当前题（文章类 1 篇 = 1 题） */
  const currentUrlWord = state.chapterData.words[state.chapterData.index] as
    | { name: string; notation?: string }
    | undefined
  // 英语素材恒为上屏轨（SPEED2-10）；中文按用户选的轨
  const effectiveTrack = material.languageTab === 'en' ? 'ime' : inputTrack

  // 章节越界重置（素材切换后章节号可能越界；只写打字模式 atom）
  useEffect(() => {
    if (chapter >= material.chapterCount) {
      setChapter(0)
    }
  }, [chapter, material.chapterCount, setChapter])

  const url = resolveMaterialUrl(material, scheme)
  const { words, error } = useWordList({ url, chapter, chapterLength: material.chapterSize })

  useEffect(() => {
    setLoadError(error)
  }, [error])

  useEffect(() => {
    state.chapterData.words?.length > 0 ? setIsLoading(false) : setIsLoading(true)
  }, [state.chapterData.words])

  // 词表就绪 → 建章（与学习模式同口径）；保留 isTyping 以便「下一章」自动开始
  useEffect(() => {
    if (words === undefined) return
    const wasTyping = state.isTyping
    dispatch({ type: TypingStateActionType.SETUP_CHAPTER, payload: { words, shouldShuffle: randomConfig.isOpen } })
    setUnitsDone(0)
    setImeSubmitted(0)
    if (wasTyping) {
      dispatch({ type: TypingStateActionType.SET_IS_TYPING, payload: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [words])

  // 失焦暂停（与学习模式一致）
  useEffect(() => {
    const onBlur = () => {
      dispatch({ type: TypingStateActionType.SET_IS_TYPING, payload: false })
    }
    window.addEventListener('blur', onBlur)
    return () => window.removeEventListener('blur', onBlur)
  }, [dispatch])

  // 按任意键开始 / 继续（与学习模式同口径）
  useEffect(() => {
    if (!state.isTyping) {
      const onKeyDown = (e: KeyboardEvent) => {
        // 模式切换菜单打开时（ENTRY-07 键盘可达），不应误触发「开始练习」把焦点抢到
        // 隐藏 input，否则键盘无法在 /typing 上完成模式切换（ACC-06-32）。
        if (document.querySelector('[role="menu"]')) return
        if (!isLoading && e.key !== 'Enter' && (isLegal(e.key) || e.key === ' ') && !e.altKey && !e.ctrlKey && !e.metaKey) {
          e.preventDefault()
          dispatch({ type: TypingStateActionType.SET_IS_TYPING, payload: true })
        }
      }
      window.addEventListener('keydown', onKeyDown)
      return () => window.removeEventListener('keydown', onKeyDown)
    }
  }, [state.isTyping, isLoading, dispatch])

  // 计时器（与学习模式一致）
  useEffect(() => {
    let intervalId: number
    if (state.isTyping) {
      intervalId = window.setInterval(() => {
        dispatch({ type: TypingStateActionType.TICK_TIMER })
      }, 1000)
    }
    return () => clearInterval(intervalId)
  }, [state.isTyping, dispatch])

  // 章末存档（与学习模式同口径；dict = 素材 id，见 DATA-16）
  useEffect(() => {
    if (state.isFinished && !state.isSavingRecord) {
      saveChapterRecord(state)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.isFinished, state.isSavingRecord])

  // ── MODE-06：模式切换确认条协作 ──
  const setPracticeActive = useSetAtom(typingPracticeActiveAtom)
  const pendingMode = useAtomValue(pendingModeSwitchAtom)
  const pausedBySwitcher = useAtomValue(typingPausedBySwitcherAtom)
  const setPausedBySwitcher = useSetAtom(typingPausedBySwitcherAtom)

  useEffect(() => {
    setPracticeActive(state.isTyping)
  }, [state.isTyping, setPracticeActive])

  // 确认条出现 → 暂停（不 finish，MODE-07）
  useEffect(() => {
    if (pendingMode) {
      dispatch({ type: TypingStateActionType.SET_IS_TYPING, payload: false })
      setPausedBySwitcher(true)
    }
  }, [pendingMode, dispatch, setPausedBySwitcher])

  // 确认条消失且本次暂停由它触发 → 恢复练习（ACC-06-11）
  useEffect(() => {
    if (!pendingMode && pausedBySwitcher) {
      setPausedBySwitcher(false)
      dispatch({ type: TypingStateActionType.SET_IS_TYPING, payload: true })
    }
  }, [pendingMode, pausedBySwitcher, dispatch, setPausedBySwitcher])

  /**
   * 上屏轨完成一篇：先存档再 FINISH_CHAPTER（与对码轨同口径，dict = 素材 id）。
   * 打字测速以「整篇」为一题，所以不存在 NEXT_WORD。
   */
  const handleUpstreamFinished = useCallback(() => {
    dispatch({ type: TypingStateActionType.SET_IS_SAVING_RECORD, payload: true })
    dispatch({ type: TypingStateActionType.FINISH_CHAPTER })
  }, [dispatch])

  // SPEED2-08：上屏轨从**第一个按键**开始计时（比「首次上屏」更贴近真实打字时长）
  const onUpstreamFirstKey = useCallback(() => {
    if (!state.isTyping) dispatch({ type: TypingStateActionType.SET_IS_TYPING, payload: true })
  }, [state.isTyping, dispatch])

  useConfetti(state.isFinished)

  const onBackToLearn = useCallback(() => {
    navigate('/')
  }, [navigate])

  // ── 移动端：说明页（02 §9：不尝试软键盘适配） ──
  if (isMobile) {
    return (
      <Layout>
        <div className="flex h-full w-full flex-col items-center justify-center gap-6 px-10">
          <h1 className="text-center text-2xl font-bold text-indigo-500">打字模式需要物理键盘</h1>
          <p className="max-w-md text-center text-lg text-gray-600 dark:text-gray-200">
            打字模式通过物理按键的键位编码进行判定，手机等触屏设备无法提供，请在桌面端浏览器访问。
          </p>
          <button type="button" className="my-btn-primary px-6 py-2" onClick={onBackToLearn}>
            返回学习模式
          </button>
        </div>
      </Layout>
    )
  }

  return (
    <TypingContext.Provider value={{ state: state, dispatch }}>
      {state.isFinished && <DonateCard />}
      {state.isFinished && <TypingResultScreen unitsDone={unitsDone} />}
      <Layout>
        <Header>
          <TypingMaterialButton />
          <StartButton isLoading={isLoading} />
          <TypingSwitcher />
        </Header>
        <div className="container mx-auto flex h-full flex-1 flex-col items-center justify-center pb-2">
          <div className="container relative mx-auto flex h-full flex-col items-center">
            <div className="container flex flex-grow items-center justify-center">
              {loadError ? (
                // ACC-06-16：加载失败态（不白屏、不无限 loading）
                <div className="flex flex-col items-center justify-center gap-4">
                  <p className="text-lg text-gray-600 dark:text-gray-200">素材加载失败，请检查网络连接。</p>
                  <button type="button" className="my-btn-primary px-6 py-2" onClick={() => window.location.reload()}>
                    重新加载
                  </button>
                </div>
              ) : isLoading ? (
                <div className="flex flex-col items-center justify-center ">
                  <div
                    className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid  border-indigo-400 border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]"
                    role="status"
                  ></div>
                </div>
              ) : (
                !state.isFinished &&
                (effectiveTrack === 'ime' ? (
                  // 上屏轨（打字测速）：不显示键盘、不显示拼音行（SPEED2-09）
                  currentUrlWord ? (
                    <UpstreamPanel
                      text={currentUrlWord.notation ?? currentUrlWord.name}
                      isEnglish={material.languageTab === 'en'}
                      onFirstKey={onUpstreamFirstKey}
                      onProgress={(correct) => {
                        setUnitsDone(correct)
                        setImeSubmitted(correct)
                      }}
                      onFinished={handleUpstreamFinished}
                      onPunctError={() => setNotice('中文标点请用全角（，。？），当前被判为标点格式错误')}
                    />
                  ) : null
                ) : (
                  <TypingPanel
                    material={material}
                    scheme={material.schemeId === 'en' ? 'en' : scheme}
                    onWordCompleted={(n) => setUnitsDone((old) => old + n)}
                  />
                ))
              )}
            </div>
            <TypingSpeed
              isChinese={material.languageTab === 'zh'}
              unitsDone={unitsDone}
              inputTrack={effectiveTrack}
            />
          </div>
        </div>
      </Layout>

      {/* 非阻塞提示（SPEED2-11） */}
      {notice && (
        <div className="fixed bottom-24 left-1/2 z-40 -translate-x-1/2" role="status">
          <div className="my-card flex items-center rounded-lg bg-white px-4 py-2 text-sm text-gray-600 shadow-md dark:bg-gray-800 dark:text-gray-200">
            {notice}
          </div>
        </div>
      )}
    </TypingContext.Provider>
  )
}

export default TypingLearnerPage
