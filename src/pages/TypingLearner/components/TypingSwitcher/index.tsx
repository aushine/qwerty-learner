/**
 * TypingSwitcher —— 打字模式页头功能条（spec-20261017-v1 / 02 §5 KEEP-05 ~ KEEP-10）
 *
 * 与学习模式 Switcher 的差异（逐条对应 spec KEEP 表）：
 * - KEEP-05 音效开关        → 复用 SoundSwitcher（不得移除）
 * - KEEP-06 循环次数        → 复用 LoopWordSwitcher（语义变为「同一题重复 N 遍」）
 * - KEEP-07 默写模式        → 删除（遮住编码 = 失去练习目标）
 * - KEEP-08 释义显示开关    → 删除，替换为「汉字提示开关」（KEEP-13，Tab 亦可切换）
 * - KEEP-09 上一词/下一词   → 默认关闭（题面区已置空目录预览带）
 * - KEEP-10 主题/设置/统计/错词本 → 保留（Setting 直接复用现有组件）
 */

import AnalysisButton from '@/pages/Typing/components/AnalysisButton'
import ErrorBookButton from '@/pages/Typing/components/ErrorBookButton'
import HandPositionIllustration from '@/pages/Typing/components/HandPositionIllustration'
import LoopWordSwitcher from '@/pages/Typing/components/LoopWordSwitcher'
import Setting from '@/pages/Typing/components/Setting'
import SoundSwitcher from '@/pages/Typing/components/SoundSwitcher'
import Tooltip from '@/components/Tooltip'
import { isOpenDarkModeAtom } from '@/store'
import { typingIsShowHanziAtom } from '@/store/typingMode'
import { useAtom } from 'jotai'
import IconMoon from '~icons/heroicons/moon-solid'
import IconSun from '~icons/heroicons/sun-solid'
import IconLanguage from '~icons/tabler/language'
import IconLanguageOff from '~icons/tabler/language-off'

export default function TypingSwitcher() {
  const [isOpenDarkMode, setIsOpenDarkMode] = useAtom(isOpenDarkModeAtom)
  const [isShowHanzi, setIsShowHanzi] = useAtom(typingIsShowHanziAtom)

  const changeDarkModeState = () => {
    setIsOpenDarkMode((old) => !old)
  }

  return (
    <div className="flex items-center justify-center gap-2">
      <Tooltip content="音效设置">
        <SoundSwitcher />
      </Tooltip>

      <Tooltip className="h-7 w-7" content="设置同一题循环次数">
        <LoopWordSwitcher />
      </Tooltip>

      {/* KEEP-13：汉字提示开关（替代学习模式的释义显示开关；Tab 亦可切换） */}
      <Tooltip className="h-7 w-7" content="汉字提示（Tab）">
        <button
          className={`p-[2px] ${isShowHanzi ? 'text-indigo-500' : 'text-gray-500'} text-lg focus:outline-none`}
          type="button"
          onClick={(e) => {
            setIsShowHanzi(!isShowHanzi)
            e.currentTarget.blur()
          }}
          aria-label="开关汉字提示"
        >
          {isShowHanzi ? <IconLanguage /> : <IconLanguageOff />}
        </button>
      </Tooltip>

      <Tooltip content="错题本">
        <ErrorBookButton />
      </Tooltip>

      <Tooltip className="h-7 w-7" content="查看数据统计">
        <AnalysisButton />
      </Tooltip>

      <Tooltip className="h-7 w-7" content="开关深色模式">
        <button
          className={`p-[2px] text-lg text-indigo-500 focus:outline-none`}
          type="button"
          onClick={(e) => {
            changeDarkModeState()
            e.currentTarget.blur()
          }}
          aria-label="开关深色模式"
        >
          {isOpenDarkMode ? <IconMoon className="icon" /> : <IconSun className="icon" />}
        </button>
      </Tooltip>
      <Tooltip className="h-7 w-7" content="指法图示">
        <HandPositionIllustration></HandPositionIllustration>
      </Tooltip>
      <Tooltip content="设置">
        <Setting />
      </Tooltip>
    </div>
  )
}
