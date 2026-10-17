/**
 * TypingGallery —— 打字模式素材选择页（spec-20261017-v1 / 03）
 *
 * 四级结构（复用 /gallery 视觉，只换语义）：
 *   语言 Tab（中文/英语）→ 输入方式（全拼/双拼二级，仅中文）→ 素材类型胶囊 → 素材卡片
 *
 * GAL-01：容器类名直接照搬 Gallery-N/index.tsx，不新写容器。
 * GAL-02：右上 X 与 Enter/Esc 返回 /typing。
 * G5：每次选择实时回写 atom + URL 参数；G6：任何一级变更清除章节 index。
 * §8：URL 回填（?tab=&scheme=&material=），URL 为准，非法值一律忽略。
 */

import Layout from '@/components/Layout'
import MaterialGroup from './MaterialGroup'
import TypingLanguageTabSwitcher from './TypingLanguageTabSwitcher'
import TypingSchemeSwitcher from './TypingSchemeSwitcher'
import {
  SCHEME_NAME_MAP,
  materialHasSchemeFile,
  typingMaterialMap,
  typingMaterials,
} from '@/resources/typingMaterials'
import {
  typingChapterAtom,
  typingLanguageTabAtom,
  typingMaterialIdAtom,
  typingSchemeAtom,
} from '@/store/typingMode'
import type { TypingLanguageTab, TypingMaterialResource, TypingSchemeId } from '@/typings/typing'
import groupBy from '@/utils/groupBy'
import * as ScrollArea from '@radix-ui/react-scroll-area'
import { useAtom, useSetAtom } from 'jotai'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useHotkeys } from 'react-hotkeys-hook'
import { useNavigate, useSearchParams } from 'react-router-dom'
import IconInfo from '~icons/ic/outline-info'
import IconX from '~icons/tabler/x'

/** 内容键：剥离方案前缀，用于判断「同内容另一方案是否已有原生卡片」 */
const contentKey = (id: string): string => id.replace(/^zh-(quanpin|flypy)-/, 'zh-')

/** 各 Tab 上次选择的素材（会话内记忆；持久化由 typingMaterialIdAtom 承担） */
const lastMaterialByTab: Record<TypingLanguageTab, string> = {
  zh: 'zh-quanpin-zi-500',
  en: 'en-article-para',
}

export default function TypingGalleryPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const [tab, setTab] = useAtom(typingLanguageTabAtom)
  const [scheme, setScheme] = useAtom(typingSchemeAtom)
  const [materialId, setMaterialId] = useAtom(typingMaterialIdAtom)
  const setChapter = useSetAtom(typingChapterAtom)

  const [notice, setNotice] = useState<string | undefined>(undefined)

  // 提示 3 秒自动消失（非阻塞）
  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(undefined), 3000)
    return () => window.clearTimeout(timer)
  }, [notice])

  // ── URL 回填（§8：URL 为准，非法值一律忽略） ──
  useEffect(() => {
    const urlTab = searchParams.get('tab')
    const urlScheme = searchParams.get('scheme')
    const urlMaterial = searchParams.get('material')
    let changed = false

    if (urlTab === 'zh' || urlTab === 'en') {
      if (urlTab !== tab) {
        setTab(urlTab)
        changed = true
      }
    }
    if (urlScheme === 'quanpin' || urlScheme === 'flypy') {
      if (urlScheme !== scheme) {
        setScheme(urlScheme)
        changed = true
      }
    }
    if (urlMaterial && typingMaterialMap[urlMaterial]) {
      if (urlMaterial !== materialId) {
        setMaterialId(urlMaterial)
        changed = true
      }
    }
    if (changed) {
      // 回写后清掉 query，避免刷新时反复抢占（atom 已成为真源）
      setSearchParams({}, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── GAL-05：当前素材与 Tab 不一致时回落 ──
  useEffect(() => {
    const current = typingMaterialMap[materialId]
    if (current && current.languageTab === tab) return
    const fallback = typingMaterialMap[lastMaterialByTab[tab]]
    if (fallback && fallback.id !== materialId) {
      setMaterialId(fallback.id)
      setChapter(0)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab])

  const syncUrl = useCallback(
    (params: { tab: TypingLanguageTab; scheme: TypingSchemeId; material: string }) => {
      setSearchParams(params, { replace: true })
    },
    [setSearchParams],
  )

  const onChangeTab = useCallback(
    (next: TypingLanguageTab) => {
      if (next === tab) return
      setTab(next)
      setChapter(0)
      const fallback = typingMaterialMap[lastMaterialByTab[next]]
      if (fallback && fallback.id !== materialId) {
        setMaterialId(fallback.id)
      }
      syncUrl({ tab: next, scheme, material: fallback?.id ?? materialId })
    },
    [tab, scheme, materialId, setTab, setChapter, setMaterialId, syncUrl],
  )

  const onChangeScheme = useCallback(
    (next: TypingSchemeId) => {
      if (next === scheme) return
      setScheme(next)
      setChapter(0)
      // 方案切换：同内容素材换 id（GAL-13 章节重置已由上层 setChapter(0) 保证）
      const current = typingMaterialMap[materialId]
      if (current && current.languageTab === 'zh' && current.schemeId !== 'en' && current.schemeId !== next) {
        const swapped = materialId.replace(/^zh-(quanpin|flypy)-/, `zh-${next}-`)
        const target = typingMaterialMap[swapped] ?? typingMaterialMap[lastMaterialByTab.zh]
        if (target) {
          setMaterialId(target.id)
          syncUrl({ tab, scheme: next, material: target.id })
          return
        }
      }
      syncUrl({ tab, scheme: next, material: materialId })
    },
    [tab, scheme, materialId, setScheme, setChapter, setMaterialId, syncUrl],
  )

  const onSelectMaterial = useCallback(
    (material: TypingMaterialResource) => {
      setChapter(0)
      lastMaterialByTab[tab] = material.id
      // GAL-12-3：当前方案无词典文件 → 自动切到有该素材的方案
      if (!materialHasSchemeFile(material, scheme)) {
        const target = material.schemeId === 'en' ? scheme : material.schemeId
        setScheme(target)
        setNotice(`已切换到${SCHEME_NAME_MAP[target]}`)
        syncUrl({ tab, scheme: target, material: material.id })
      } else {
        syncUrl({ tab, scheme, material: material.id })
      }
      setMaterialId(material.id)
      navigate('/typing')
    },
    [tab, scheme, setChapter, setScheme, setMaterialId, navigate, syncUrl],
  )

  const onBack = useCallback(() => {
    navigate('/typing')
  }, [navigate])

  // GAL-02：Enter/Esc 返回 /typing；但焦点落在可交互控件（卡片 / 方案按钮 / 语言 radio /
  // 方案选项）上时，Enter/Esc 应交由该控件自身处理（否则会抢掉卡片的 Enter 选中，
  // 破坏 ACC-06-32 的全键盘闭环）。仅在焦点在页面空白处时才返回。
  // 注意：不得用 react-hotkeys-hook 的 `preventDefault: true` 选项——它会在 document 级
  // 对 keydown 调 preventDefault，从而抑制原生 <button> 的 Enter→click，导致方案/卡片
  // 无法用键盘选中。只在确实要返回时才手动 preventDefault。
  const onBackHotkey = useCallback(
    (e: KeyboardEvent) => {
      const el = document.activeElement as HTMLElement | null
      if (el) {
        const tag = el.tagName
        const role = el.getAttribute('role')
        const isInteractive =
          tag === 'BUTTON' ||
          tag === 'A' ||
          tag === 'INPUT' ||
          role === 'button' ||
          role === 'radio' ||
          role === 'option'
        if (isInteractive) return
      }
      e.preventDefault()
      onBack()
    },
    [onBack],
  )

  useHotkeys('enter,esc', onBackHotkey)

  // ── 可见素材（GAL-12：无当前方案文件的素材仍显示，但同内容有原生卡片时不重复） ──
  const visibleMaterials = useMemo(() => {
    const all = typingMaterials.filter((m) => m.languageTab === tab)
    if (tab === 'en') return all
    const nativeKeys = new Set(all.filter((m) => materialHasSchemeFile(m, scheme)).map((m) => contentKey(m.id)))
    return all.filter((m) => materialHasSchemeFile(m, scheme) || !nativeKeys.has(contentKey(m.id)))
  }, [tab, scheme])

  // 按「分类 → 素材类型」两级分组（GAL-10：胶囊 value/onChange 直接映射素材类型）
  const groupedByCategory = useMemo(() => {
    const entries = Object.entries(groupBy(visibleMaterials, (m) => m.category))
    return entries.map(
      ([category, list]) => [category, groupBy(list, (m) => m.materialType)] as [string, Record<string, TypingMaterialResource[]>],
    )
  }, [visibleMaterials])

  return (
    <Layout>
      <div className="relative mb-auto mt-auto flex w-full flex-1 flex-col overflow-y-auto pl-20">
        <IconX className="absolute right-20 top-10 mr-2 h-7 w-7 cursor-pointer text-gray-400" onClick={onBack} />
        <div className="mt-20 flex w-full flex-1 flex-col items-center justify-center overflow-y-auto">
          <div className="flex h-full flex-col overflow-y-auto">
            {/* 第 ① 级：语言 Tab */}
            <div className="flex h-20 w-full items-center justify-between pb-6 pr-20">
              <TypingLanguageTabSwitcher value={tab} onChange={onChangeTab} />
              {/* 右侧留空（DictRequest 在打字模式无处可去，隐藏） */}
            </div>

            {/* 第 ② 级：输入方式（仅中文） */}
            {tab === 'zh' && <TypingSchemeSwitcher scheme={scheme} onChange={onChangeScheme} />}

            {/* 第 ③ + ④ 级：素材分组 + 卡片 */}
            <ScrollArea.Root className="flex-1 overflow-y-auto">
              <ScrollArea.Viewport className="h-full w-full ">
                <div className="mr-4 flex flex-1 flex-col items-start justify-start gap-14 overflow-y-auto">
                  {groupedByCategory.map(([category, groupedByType]) => (
                    <MaterialGroup
                      key={category}
                      title={category}
                      groupedMaterialsByType={groupedByType}
                      scheme={scheme}
                      currentMaterialId={materialId}
                      onSelect={onSelectMaterial}
                    />
                  ))}
                </div>
                {/* GAL-11-1：底部版权说明（复用现有文案 + 中文素材署名） */}
                <div className="flex items-center justify-center pb-10 pt-[20rem] text-gray-500">
                  <IconInfo className="mr-1 h-5 w-5" />
                  <p className="mr-5 w-10/12 text-xs">
                    本项目的词典数据来自多个开源项目以及社区贡献者的无偿提供。我们深感感激并尊重每一位贡献者的知识产权。
                    这些数据仅供个人学习和研究使用，严禁用于任何商业目的。如果你是数据的版权所有者，并且认为我们的使用方式侵犯了你的权利，请通过网站底部的电子邮件与我们联系。一旦收到有效的版权投诉，我们将在最短的时间内删除相关内容或寻求必要的许可。
                    同时，我们也鼓励所有使用这些数据的人尊重版权所有者的权利，并且在使用这些数据时遵守所有相关的法律和规定。
                    请注意，虽然我们尽力确保所有数据的合法性和准确性，但我们不能对任何数据的准确性、完整性、合法性或可靠性做出任何保证。使用这些数据的风险完全由用户自己承担。
                    <br />
                    中文练习素材来源：字表取自《通用规范汉字表》（官方文件）；词组部分参考 CC-CEDICT（CC BY-SA 4.0）；短句与部分术语为本项目自撰；古诗文为公有领域作品。
                  </p>
                </div>
              </ScrollArea.Viewport>
              <ScrollArea.Scrollbar className="flex touch-none select-none bg-transparent " orientation="vertical"></ScrollArea.Scrollbar>
            </ScrollArea.Root>
          </div>
        </div>
      </div>

      {/* 方案自动切换提示（GAL-12-3，非阻塞） */}
      {notice && (
        <div className="fixed bottom-24 left-1/2 z-40 -translate-x-1/2" role="status">
          <div className="my-card flex items-center rounded-lg bg-white px-4 py-2 text-sm text-gray-600 shadow-md dark:bg-gray-800 dark:text-gray-200">
            {notice}
          </div>
        </div>
      )}
    </Layout>
  )
}
