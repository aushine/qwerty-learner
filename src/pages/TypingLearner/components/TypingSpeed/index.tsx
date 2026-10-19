/**
 * TypingSpeed —— 打字模式底部数据条（spec-20261017-v1 / 02 §3.1、§5.3 LAY-09）
 *
 * 复用现有 Speed 的卡片结构与 InfoBox；差异：
 * - LAY-09：速度指标为派生值 `typingCharsPerMinute`（已完成字数 / 用时 × 60），
 *   中文素材标签「字/分」，英语素材标签「WPM」（按空格分词）；
 * - 不修改学习模式 wpm getter，不重写 ChapterRecord.wpm。
 */

import InfoBox from '@/pages/Typing/components/Speed/InfoBox'
import { TypingContext } from '@/pages/Typing/store'
import { useContext } from 'react'

export default function TypingSpeed({
  isChinese,
  unitsDone,
  inputTrack = 'code',
}: {
  isChinese: boolean
  unitsDone: number
  /** 上屏轨（打字测速）时，输入数/正确数改由页面按上屏字符统计（SPEED2-07） */
  inputTrack?: 'code' | 'ime'
}) {
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const { state } = useContext(TypingContext)!
  const seconds = state.timerData.time % 60
  const minutes = Math.floor(state.timerData.time / 60)
  const secondsString = seconds < 10 ? '0' + seconds : seconds + ''
  const minutesString = minutes < 10 ? '0' + minutes : minutes + ''
  const isIme = inputTrack === 'ime'
  const inputNumber = isIme ? unitsDone : state.chapterData.correctCount + state.chapterData.wrongCount

  // LAY-09：字/分 = 已完成字数 / 用时（秒）× 60
  const unitsPerMinute = state.timerData.time > 0 ? Math.round((unitsDone / state.timerData.time) * 60) : 0

  return (
    <div className="my-card flex w-3/5 rounded-xl bg-white p-4 py-10 opacity-50 transition-colors duration-300 dark:bg-gray-800">
      <InfoBox info={`${minutesString}:${secondsString}`} description="时间" />
      <InfoBox info={inputNumber + ''} description={isIme ? '上屏字数' : '输入数'} />
      <InfoBox info={unitsPerMinute + ''} description={isChinese ? '字/分' : 'WPM'} />
      {!isIme && <InfoBox info={state.chapterData.correctCount + ''} description="正确数" />}
      <InfoBox info={state.timerData.accuracy + ''} description="正确率" />
    </div>
  )
}
