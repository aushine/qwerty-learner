/**
 * TypingMaterialCard —— 打字模式素材卡片（spec-20261017-v1 / 03 §6 MAT-01/02）
 *
 * 结构照搬 Gallery-N/DictionaryWithoutCover（白卡、my-card、hover、选中态）；
 * 内容替换为：标题（素材名）+ 规格徽标（素材类型）+ 描述 + 元信息行。
 * GAL-12：当前方案下无词典文件的素材仍显示，徽标「仅 {另一方案名}」，点击自动切方案。
 */

import {
  DIFFICULTY_LABELS,
  MATERIAL_TYPE_LABELS,
  MATERIAL_UNIT_LABELS,
  SCHEME_NAME_MAP,
  materialHasSchemeFile,
} from '@/resources/typingMaterials'
import type { TypingMaterialResource, TypingSchemeId, TypingWordDifficulty } from '@/typings/typing'
import classNames from 'classnames'

/** 难度徽标配色（GAL2-12：客观档位标识，非对用户的评价） */
const DIFFICULTY_CLASS: Record<TypingWordDifficulty, string> = {
  intro: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300',
  mid: 'bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-300',
  adv: 'bg-rose-100 text-rose-600 dark:bg-rose-900/40 dark:text-rose-300',
}

export default function TypingMaterialCard({
  material,
  scheme,
  selected,
  onSelect,
}: {
  material: TypingMaterialResource
  scheme: TypingSchemeId
  selected: boolean
  onSelect: (material: TypingMaterialResource) => void
}) {
  const hasFile = materialHasSchemeFile(material, scheme)
  const unit = MATERIAL_UNIT_LABELS[material.materialType]
  const schemeName = material.schemeId === 'en' ? '英语' : SCHEME_NAME_MAP[material.schemeId]

  return (
    <div
      role="button"
      tabIndex={0}
      title={hasFile ? '选择素材' : `该素材仅支持${schemeName}，点击将自动切换`}
      className={classNames(
        'group my-card flex h-36 w-80 cursor-pointer items-center justify-center overflow-hidden rounded-lg p-4 text-left shadow-lg focus:outline-none',
        selected ? 'ring-2 ring-indigo-500' : 'hover:bg-white dark:hover:bg-gray-700',
        'bg-zinc-50 dark:bg-gray-800',
      )}
      onClick={() => onSelect(material)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSelect(material)
        }
      }}
    >
      <div className="relative ml-1 mt-2 flex h-full w-full flex-col items-start justify-start">
        <div className="flex w-full items-start justify-between">
          <h1
            className={classNames(
              'mb-1.5 text-xl font-normal',
              selected ? 'text-indigo-500' : 'text-gray-800 group-hover:text-indigo-400 dark:text-gray-200',
            )}
          >
            {material.name}
          </h1>
          {/* 徽标：难度（仅文章类，GAL2-12）+ 素材类型 */}
          <span className="ml-2 flex shrink-0 items-center gap-1">
            {material.difficulty && (
              <span className={classNames('rounded px-2 py-0.5 text-xs', DIFFICULTY_CLASS[material.difficulty])}>
                {DIFFICULTY_LABELS[material.difficulty]}
              </span>
            )}
            <span className="rounded bg-indigo-100 px-2 py-0.5 text-xs text-indigo-500 dark:bg-indigo-900/40 dark:text-indigo-300">
              {MATERIAL_TYPE_LABELS[material.materialType]}
            </span>
          </span>
        </div>
        {!hasFile && <span className="mb-1 text-xs text-gray-400">仅 {schemeName}</span>}
        <p className="mb-1 max-w-full truncate whitespace-nowrap text-gray-600 dark:text-gray-200">{material.description}</p>
        <p className="mb-0.5 font-bold text-gray-600 dark:text-gray-200">{`${material.length} ${unit} · ${material.chapterCount} 章 · ${schemeName}`}</p>
      </div>
    </div>
  )
}
