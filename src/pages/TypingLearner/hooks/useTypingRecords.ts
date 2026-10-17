/**
 * 打字模式练习记录 —— spec-20261017-v1 / 05 DATA-16 / DATA-17
 *
 * 沿用现有 `wordRecords` / `chapterRecords` 表，**零 schema 变更、零迁移**：
 * - `dict` 写**素材 id**（如 `zh-flypy-zi-500`）——这本来就是它的「词典」；
 * - `chapter` 写打字模式独立章节（typingChapterAtom，GAL-13）；
 * - Analysis 侧据此做只读筛选（isTypingDictId）。
 *
 * 🔴 为什么不复用 `useSaveChapterRecord` / `useSaveWordRecord`：
 * 那两个 hook 读学习模式的 `currentDictIdAtom` / `currentChapterAtom`，
 * 而打字模式**绝不写**学习模式 atom（GAL-13 / MODE-11）。故在此平行实现，
 * 现有 db hook 一行不改。
 */

import type { IChapterRecord, IWordRecord, LetterMistakes } from '@/utils/db/record'
import { ChapterRecord, WordRecord } from '@/utils/db/record'
import { db } from '@/utils/db'
import { TypingContext, TypingStateActionType } from '@/pages/Typing/store'
import type { TypingState } from '@/pages/Typing/store/type'
import { typingChapterAtom, typingMaterialIdAtom } from '@/store/typingMode'
import { useAtomValue } from 'jotai'
import { useCallback, useContext } from 'react'

export function useSaveTypingChapterRecord() {
  const materialId = useAtomValue(typingMaterialIdAtom)
  const typingChapter = useAtomValue(typingChapterAtom)

  const saveChapterRecord = useCallback(
    (typingState: TypingState) => {
      const {
        chapterData: { correctCount, wrongCount, userInputLogs, wordCount, words, wordRecordIds },
        timerData: { time },
      } = typingState
      const correctWordIndexes = userInputLogs.filter((log) => log.correctCount > 0 && log.wrongCount === 0).map((log) => log.index)

      const chapterRecord = new ChapterRecord(
        materialId,
        typingChapter,
        time,
        correctCount,
        wrongCount,
        wordCount,
        correctWordIndexes,
        words.length,
        wordRecordIds ?? [],
      )
      db.chapterRecords.add(chapterRecord)
    },
    [materialId, typingChapter],
  )

  return saveChapterRecord
}

export function useSaveWordRecord() {
  const materialId = useAtomValue(typingMaterialIdAtom)
  const typingChapter = useAtomValue(typingChapterAtom)

  const { dispatch } = useContext(TypingContext) ?? {}

  const saveWordRecord = useCallback(
    async ({
      word,
      wrongCount,
      letterTimeArray,
      letterMistake,
    }: {
      word: string
      wrongCount: number
      letterTimeArray: number[]
      letterMistake: LetterMistakes
    }) => {
      const timing: number[] = []
      for (let i = 1; i < letterTimeArray.length; i++) {
        timing.push(letterTimeArray[i] - letterTimeArray[i - 1])
      }

      const wordRecord = new WordRecord(word, materialId, typingChapter, timing, wrongCount, letterMistake)

      let dbID = -1
      try {
        dbID = await db.wordRecords.add(wordRecord)
      } catch (e) {
        console.error(e)
      }
      if (dispatch) {
        dbID > 0 && dispatch({ type: TypingStateActionType.ADD_WORD_RECORD_ID, payload: dbID })
        dispatch({ type: TypingStateActionType.SET_IS_SAVING_RECORD, payload: false })
      }
    },
    [materialId, typingChapter, dispatch],
  )

  return saveWordRecord
}

export type { IChapterRecord, IWordRecord }
