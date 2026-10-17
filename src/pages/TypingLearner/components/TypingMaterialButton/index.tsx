/**
 * TypingMaterialButton —— 打字模式页头：素材入口 + 章节选择
 * （spec-20261017-v1 / 02 §3.1、GAL-04 ~ GAL-13）
 *
 * 结构照抄学习模式 DictChapterButton（Tooltip + NavLink + Listbox），但：
 * - 读写全部走打字模式 atom（GAL-13：不碰 currentDictInfoAtom / currentChapterAtom）；
 * - 入口文案 = 「语言 · 方案」，点击进 /typing/gallery；
 * - 章节单位随素材类型变化（短素材「章」/ 长文章「段」，KEEP-02）。
 */

import Tooltip from '@/components/Tooltip'
import {
  LANGUAGE_NAME_MAP,
  MATERIAL_CHAPTER_LABELS,
  SCHEME_NAME_MAP,
  findMaterial,
} from '@/resources/typingMaterials'
import { typingChapterAtom, typingLanguageTabAtom, typingMaterialIdAtom, typingSchemeAtom } from '@/store/typingMode'
import range from '@/utils/range'
import { Listbox, Transition } from '@headlessui/react'
import { useAtom, useAtomValue } from 'jotai'
import { Fragment } from 'react'
import { NavLink } from 'react-router-dom'
import IconCheck from '~icons/tabler/check'

export default function TypingMaterialButton() {
  const materialId = useAtomValue(typingMaterialIdAtom)
  const material = findMaterial(materialId)
  const languageTab = useAtomValue(typingLanguageTabAtom)
  const scheme = useAtomValue(typingSchemeAtom)
  const [currentChapter, setCurrentChapter] = useAtom(typingChapterAtom)

  const unit = MATERIAL_CHAPTER_LABELS[material.materialType]
  const entryLabel = `${LANGUAGE_NAME_MAP[languageTab]} · ${material.schemeId === 'en' ? '英语' : SCHEME_NAME_MAP[scheme]}`

  const handleKeyDown: React.KeyboardEventHandler<HTMLButtonElement> = (event) => {
    if (event.key === ' ') {
      event.preventDefault()
    }
  }

  return (
    <>
      <Tooltip content="切换语言 / 输入方式 / 素材">
        <NavLink
          className="block rounded-lg px-3 py-1 text-lg transition-colors duration-300 ease-in-out hover:bg-indigo-400 hover:text-white focus:outline-none dark:text-white dark:text-opacity-60 dark:hover:text-opacity-100"
          to="/typing/gallery"
        >
          {entryLabel}
        </NavLink>
      </Tooltip>
      <Tooltip content={`${unit}切换`}>
        <Listbox value={currentChapter} onChange={setCurrentChapter}>
          <Listbox.Button
            onKeyDown={handleKeyDown}
            className="rounded-lg px-3 py-1 text-lg transition-colors duration-300 ease-in-out hover:bg-indigo-400 hover:text-white focus:outline-none dark:text-white dark:text-opacity-60 dark:hover:text-opacity-100"
          >
            第 {currentChapter + 1} {unit}
          </Listbox.Button>
          <Transition as={Fragment} leave="transition ease-in duration-100" leaveFrom="opacity-100" leaveTo="opacity-0">
            <Listbox.Options className="listbox-options z-10 w-32">
              {range(0, material.chapterCount, 1).map((index) => (
                <Listbox.Option key={index} value={index}>
                  {({ selected }) => (
                    <div className="group flex cursor-pointer items-center justify-between">
                      {selected ? (
                        <span className="listbox-options-icon">
                          <IconCheck className="focus:outline-none" />
                        </span>
                      ) : null}
                      <span>
                        第 {index + 1} {unit}
                      </span>
                    </div>
                  )}
                </Listbox.Option>
              ))}
            </Listbox.Options>
          </Transition>
        </Listbox>
      </Tooltip>
    </>
  )
}
