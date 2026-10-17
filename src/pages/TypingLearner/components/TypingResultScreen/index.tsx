/**
 * TypingResultScreen —— 打字模式结算页（spec-20261017-v1 / 02 §6 KEEP-17）
 *
 * 复用现有 ResultScreen 的视觉构件（RemarkRing / ConclusionBar / WordChip）；
 * 文案差异（KEEP-17）：
 * - 「WPM」→「字/分」（中文素材；英语素材仍为 WPM）；
 * - 「第 N 章」→「第 N 章 / 第 N 段」（短素材用「章」，长文章用「段」，随素材类型）；
 * - 去掉「默写本章节」按钮（KEEP-07）。
 * 🔴 不修改现有 ResultScreen（REG-15 白名单），故在此平行实现。
 */

import ConclusionBar from '@/pages/Typing/components/ResultScreen/ConclusionBar'
import RemarkRing from '@/pages/Typing/components/ResultScreen/RemarkRing'
import WordChip from '@/pages/Typing/components/ResultScreen/WordChip'
import { TypingContext, TypingStateActionType } from '@/pages/Typing/store'
import {
  MATERIAL_CHAPTER_LABELS,
  findMaterial,
} from '@/resources/typingMaterials'
import { typingChapterAtom, typingMaterialIdAtom } from '@/store/typingMode'
import { randomConfigAtom } from '@/store'
import Tooltip from '@/components/Tooltip'
import { Transition } from '@headlessui/react'
import { useAtomValue, useSetAtom } from 'jotai'
import { useCallback, useContext, useEffect, useMemo } from 'react'
import { useHotkeys } from 'react-hotkeys-hook'
import { useNavigate } from 'react-router-dom'
import IexportWords from '~icons/icon-park-outline/excel'
import IconX from '~icons/tabler/x'

const TypingResultScreen = ({ unitsDone }: { unitsDone: number }) => {
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const { state, dispatch } = useContext(TypingContext)!
  const materialId = useAtomValue(typingMaterialIdAtom)
  const material = findMaterial(materialId)
  const currentChapter = useAtomValue(typingChapterAtom)
  const setCurrentChapter = useSetAtom(typingChapterAtom)
  const randomConfig = useAtomValue(randomConfigAtom)
  const navigate = useNavigate()

  const unit = MATERIAL_CHAPTER_LABELS[material.materialType]
  const isChinese = material.languageTab === 'zh'
  const isLastChapter = currentChapter >= material.chapterCount - 1

  useEffect(() => {
    // tick a zero timer to calc the stats
    dispatch({ type: TypingStateActionType.TICK_TIMER, addTime: 0 })
  }, [dispatch])

  const exportWords = useCallback(() => {
    const { words, userInputLogs } = state.chapterData
    const exportData = userInputLogs.map((log) => {
      const word = words[log.index]
      const wordName = word.name
      return {
        ...word,
        correctCount: log.correctCount,
        wrongCount: log.wrongCount,
        wrongLetters: Object.entries(log.LetterMistakes)
          .map(([key, mistakes]) => `${wordName[Number(key)]}:${mistakes.length}`)
          .join(';'),
      }
    })

    import('xlsx')
      .then(({ utils, writeFileXLSX }) => {
        const ws = utils.json_to_sheet(exportData)
        const wb = utils.book_new()
        utils.book_append_sheet(wb, ws, 'Data')
        writeFileXLSX(wb, `${material.name}第${currentChapter + 1}${unit}.xlsx`)
      })
      .catch(() => {
        console.log('写入 xlsx 模块导入失败')
      })
  }, [currentChapter, material.name, state.chapterData, unit])

  const wrongWords = useMemo(() => {
    return state.chapterData.userInputLogs
      .filter((log) => log.wrongCount > 0)
      .map((log) => state.chapterData.words[log.index])
      .filter((word) => word !== undefined)
  }, [state.chapterData.userInputLogs, state.chapterData.words])

  const correctRate = useMemo(() => {
    const chapterLength = state.chapterData.words.length
    const correctCount = chapterLength - wrongWords.length
    return Math.floor((correctCount / chapterLength) * 100)
  }, [state.chapterData.words.length, wrongWords.length])

  const mistakeLevel = useMemo(() => {
    if (correctRate >= 85) {
      return 0
    } else if (correctRate >= 70) {
      return 1
    } else {
      return 2
    }
  }, [correctRate])

  const timeString = useMemo(() => {
    const seconds = state.timerData.time
    const minutes = Math.floor(seconds / 60)
    const minuteString = minutes < 10 ? '0' + minutes : minutes + ''
    const restSeconds = seconds % 60
    const secondString = restSeconds < 10 ? '0' + restSeconds : restSeconds + ''
    return `${minuteString}:${secondString}`
  }, [state.timerData.time])

  // LAY-09：字/分 = 已完成字数 / 用时 × 60（中文）；英语为 WPM（按空格分词）
  const unitsPerMinute = state.timerData.time > 0 ? Math.round((unitsDone / state.timerData.time) * 60) : 0

  const repeatButtonHandler = useCallback(() => {
    dispatch({ type: TypingStateActionType.REPEAT_CHAPTER, shouldShuffle: randomConfig.isOpen })
  }, [dispatch, randomConfig.isOpen])

  const nextButtonHandler = useCallback(() => {
    if (isLastChapter) return
    setCurrentChapter(currentChapter + 1)
    dispatch({ type: TypingStateActionType.NEXT_CHAPTER })
  }, [currentChapter, dispatch, isLastChapter, setCurrentChapter])

  const onNavigateToGallery = useCallback(() => {
    navigate('/typing/gallery')
  }, [navigate])

  useHotkeys('enter', nextButtonHandler, { preventDefault: true })
  useHotkeys(
    'space',
    (e) => {
      e.stopPropagation()
      repeatButtonHandler()
    },
    { preventDefault: true },
  )

  return (
    <div className="fixed inset-0 z-30 overflow-y-auto">
      <div className="absolute inset-0 bg-gray-300 opacity-80 dark:bg-gray-600"></div>
      <Transition
        show={true}
        enter="ease-in duration-300"
        enterFrom="opacity-0"
        enterTo="opacity-100"
        leave="ease-out duration-100"
        leaveFrom="opacity-100"
        leaveTo="opacity-0"
      >
        <div className="flex h-screen items-center justify-center">
          <div className="my-card fixed flex w-[90vw] max-w-6xl flex-col overflow-hidden rounded-3xl bg-white pb-14 pl-10 pr-5 pt-10 shadow-lg dark:bg-gray-800 md:w-4/5 lg:w-3/5">
            <div className="text-center font-sans text-xl font-normal text-gray-900 dark:text-gray-400 md:text-2xl">
              {`${material.name} 第${currentChapter + 1}${unit}`}
            </div>
            <button className="absolute right-7 top-5" onClick={onNavigateToGallery} title="返回素材选择">
              <IconX className="text-gray-400" />
            </button>
            <div className="mt-10 flex flex-row gap-2 overflow-hidden">
              <div className="flex flex-shrink-0 flex-grow-0 flex-col gap-3 px-4 sm:px-1 md:px-2 lg:px-4">
                <RemarkRing remark={`${state.timerData.accuracy}%`} caption="正确率" percentage={state.timerData.accuracy} />
                <RemarkRing remark={timeString} caption="本章耗时" />
                <RemarkRing remark={unitsPerMinute + ''} caption={isChinese ? '字/分' : 'WPM'} />
              </div>
              <div className="z-10 ml-6 flex-1 overflow-visible rounded-xl bg-indigo-50 dark:bg-gray-700">
                <div className="customized-scrollbar z-20 ml-8 mr-1 flex h-80 flex-row flex-wrap content-start gap-4 overflow-y-auto overflow-x-hidden pr-7 pt-9">
                  {wrongWords.map((word, index) => (
                    <WordChip key={`${index}-${word.name}`} word={word} />
                  ))}
                </div>
                <div className="align-center flex w-full flex-row justify-start rounded-b-xl bg-indigo-200 px-4 dark:bg-indigo-400">
                  <ConclusionBar mistakeLevel={mistakeLevel} mistakeCount={wrongWords.length} />
                </div>
              </div>
              <div className="ml-2 flex flex-col items-center justify-end gap-3 text-xl">
                <IexportWords fontSize={18} className="cursor-pointer text-gray-500" onClick={exportWords}></IexportWords>
                <button
                  onClick={(e) => {
                    onNavigateToGallery()
                    e.currentTarget.blur()
                  }}
                  className="cursor-pointer text-sm text-gray-500 hover:text-indigo-500 focus:outline-none"
                  type="button"
                  title="返回素材选择"
                >
                  更换素材
                </button>
              </div>
            </div>
            <div className="mt-10 flex w-full justify-center gap-5 px-5 text-xl">
              <Tooltip content="快捷键：space">
                <button
                  className="my-btn-primary h-12 border-2 border-solid border-gray-300 bg-white text-base text-gray-700 dark:border-gray-700 dark:bg-gray-600 dark:text-white dark:hover:bg-gray-700"
                  type="button"
                  onClick={repeatButtonHandler}
                  title={`重复本${unit}`}
                >
                  {`重复本${unit}`}
                </button>
              </Tooltip>
              {!isLastChapter && (
                <Tooltip content="快捷键：enter">
                  <button
                    className="my-btn-primary h-12 text-base font-bold"
                    type="button"
                    onClick={nextButtonHandler}
                    title={`下一${unit}`}
                  >
                    {`下一${unit}`}
                  </button>
                </Tooltip>
              )}
            </div>
          </div>
        </div>
      </Transition>
    </div>
  )
}

export default TypingResultScreen
