/**
 * MaterialGroup —— 素材分组（spec-20261017-v1 / 03 §5 GAL-10/11）
 *
 * 照搬 Gallery-N/CategoryDicts 结构：分组标题（category）+ DictTagSwitcher 胶囊行 + 卡片网格。
 * 🔴 DictTagSwitcher 直接复用现有组件（GAL-10），不复制不改写。
 * 🔴 胶囊按 `materialType` 分（GAL-10：RadioGroup 的 value/onChange 直接映射到「素材类型」）：
 *    中文 = 字 / 词 / 成语 / 短句 / 文章（spec §5.1），英语 = 段落 / 文章（spec §5.2）。
 *    `tags` 仅是素材元数据，不作胶囊维度——spec §5 明确打字模式的维度是
 *    「文本长度与认知负荷」递进（1 字 → 2-4 字 → 4 字 → 10-30 字 → 300+ 字）。
 */

import DictTagSwitcher from '@/pages/Gallery-N/DictTagSwitcher'
import { MATERIAL_TYPE_LABELS } from '@/resources/typingMaterials'
import type { TypingMaterialResource, TypingMaterialType } from '@/typings/typing'
import { useCallback, useEffect, useMemo, useState } from 'react'
import TypingMaterialCard from './TypingMaterialCard'

/** 胶囊展示顺序（spec 03 §5.1 / §5.2） */
const TYPE_ORDER: TypingMaterialType[] = ['zi', 'ci', 'chengyu', 'duanju', 'wenzhang', 'paragraph', 'article']

const labelOf = (type: string): string => MATERIAL_TYPE_LABELS[type as TypingMaterialType] ?? type

export default function MaterialGroup({
  title,
  groupedMaterialsByType,
  scheme,
  currentMaterialId,
  onSelect,
}: {
  title: string
  groupedMaterialsByType: Record<string, TypingMaterialResource[]>
  scheme: 'quanpin' | 'flypy'
  currentMaterialId: string
  onSelect: (material: TypingMaterialResource) => void
}) {
  const typeList = useMemo(
    () => Object.keys(groupedMaterialsByType).sort((a, b) => {
      const ia = TYPE_ORDER.indexOf(a as TypingMaterialType)
      const ib = TYPE_ORDER.indexOf(b as TypingMaterialType)
      return (ia < 0 ? TYPE_ORDER.length : ia) - (ib < 0 ? TYPE_ORDER.length : ib)
    }),
    [groupedMaterialsByType],
  )
  const [currentType, setCurrentType] = useState(typeList.length > 0 ? typeList[0] : '')

  const onChangeCurrentType = useCallback(
    (label: string) => {
      const found = typeList.find((t) => labelOf(t) === label)
      if (found) setCurrentType(found)
    },
    [typeList],
  )

  // 当前素材所在类型优先展示（与 CategoryDicts 同行为）
  useEffect(() => {
    const current = Object.entries(groupedMaterialsByType).find(([, list]) => list.some((m) => m.id === currentMaterialId))
    if (current) setCurrentType(current[0])
  }, [currentMaterialId, groupedMaterialsByType])

  return (
    <div>
      <h2 className="mb-2 text-xl font-normal text-gray-700 dark:text-gray-200">{title}</h2>
      <DictTagSwitcher
        tagList={typeList.map(labelOf)}
        currentTag={currentType ? labelOf(currentType) : ''}
        onChangeCurrentTag={onChangeCurrentType}
      />
      <div className="mt-8 grid gap-x-5 gap-y-10 px-1 pb-4 sm:grid-cols-1 md:grid-cols-2 dic3:grid-cols-3 dic4:grid-cols-4">
        {currentType && groupedMaterialsByType[currentType] ? (
          groupedMaterialsByType[currentType].map((material) => (
            <TypingMaterialCard
              key={material.id}
              material={material}
              scheme={scheme}
              selected={material.id === currentMaterialId}
              onSelect={onSelect}
            />
          ))
        ) : (
          <div className="col-span-full text-center text-gray-500">当前分类下没有可用的素材</div>
        )}
      </div>
    </div>
  )
}
