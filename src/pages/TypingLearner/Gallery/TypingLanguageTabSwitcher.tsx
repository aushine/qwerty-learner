/**
 * TypingLanguageTabSwitcher —— 打字模式选择页语言 Tab（spec-20261017-v1 / 03 §3）
 *
 * 照搬 Gallery-N/LanguageTabSwitcher 的 RadioGroup 下划线结构；
 * 差异：仅 2 个 Tab（中文 / 英语），且**两个 Tab 都不显示图标**
 * （GAL-03 降级方案：项目无 zh.png 国旗资源，保持成对一致，避免「一个有旗一个没旗」）。
 */

import type { TypingLanguageTab } from '@/typings/typing'
import { RadioGroup } from '@headlessui/react'
import { useCallback } from 'react'

export type TypingLanguageTabOption = {
  id: TypingLanguageTab
  name: string
  sub: string
}

const options: TypingLanguageTabOption[] = [
  { id: 'zh', name: '中文', sub: '拼音输入法' },
  { id: 'en', name: '英语', sub: '文章打字' },
]

export default function TypingLanguageTabSwitcher({
  value,
  onChange,
}: {
  value: TypingLanguageTab
  onChange: (tab: TypingLanguageTab) => void
}) {
  const onChangeTab = useCallback(
    (tab: string) => {
      onChange(tab as TypingLanguageTab)
    },
    [onChange],
  )

  return (
    <RadioGroup value={value} onChange={onChangeTab}>
      <div className="flex items-center space-x-4">
        {options.map((option) => (
          <RadioGroup.Option key={option.id} value={option.id} className="cursor-pointer">
            {({ checked }) => (
              <div className={`flex items-center border-b-2 px-2 pb-1 ${checked ? 'border-indigo-500' : 'border-transparent'}`}>
                <div className="flex flex-col">
                  <p className={`text-lg font-medium text-gray-700 dark:text-gray-200`}>{option.name}</p>
                  <p className="text-xs text-gray-400">{option.sub}</p>
                </div>
              </div>
            )}
          </RadioGroup.Option>
        ))}
      </div>
    </RadioGroup>
  )
}
