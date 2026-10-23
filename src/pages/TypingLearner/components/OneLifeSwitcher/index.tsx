/**
 * OneLifeSwitcher —— 一命模式开关（spec-20261020-v1 / 02 REQ-201/202）
 *
 * - 位置：打字模式页头功能栏，StartButton 左侧（仅打字模式显示，学习模式无此开关）；
 * - 语义：开 = 打错一次从当前章节开头重新开始（整章重开）；关 = 维持既有错误处理策略；
 * - 默认值由素材类型决定（defaultOneLife），用户切换后写 typingOneLifeOverrideAtom 持久化；
 * - 本组件只反映生效值（override ?? default），不感知素材类型。
 */

import Tooltip from '@/components/Tooltip'

export default function OneLifeSwitcher({
  value,
  onChange,
}: {
  value: boolean
  onChange: (value: boolean) => void
}) {
  return (
    <Tooltip content="一命模式：打错后从本章开头重新开始">
      <div className="my-card flex h-8 items-center gap-2 rounded-lg bg-white px-2 text-sm dark:bg-gray-800">
        <span className="whitespace-nowrap text-gray-600 dark:text-gray-200">一命模式</span>
        <button
          type="button"
          role="switch"
          aria-checked={value}
          aria-label="一命模式"
          className={`relative h-5 w-9 shrink-0 rounded-full transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 ${
            value ? 'bg-indigo-500' : 'bg-gray-300 dark:bg-gray-600'
          }`}
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            onChange(!value)
            e.currentTarget.blur()
          }}
        >
          <span
            className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all duration-200 ${
              value ? 'left-[18px]' : 'left-0.5'
            }`}
          />
        </button>
      </div>
    </Tooltip>
  )
}
