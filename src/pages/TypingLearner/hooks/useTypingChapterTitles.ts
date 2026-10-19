/**
 * useTypingChapterTitles —— 文章类素材的篇名列表（spec-20261017-v2 / 03 GAL2-07-1）
 *
 * 页头章节按钮需要显示「篇名 · 作者」，但 `TypingMaterialResource` 只有 `chapterCount`。
 * 这里用 `useSWR` 拉**同一个**词典 URL（与 TypingPanel 的 useWordList 共享缓存，不会二次请求），
 * 只取 `title` / `author` 两个字段，绝不把整篇正文塞进 atom。
 */

import { resolveMaterialUrl } from '@/resources/typingMaterials'
import type { TypingMaterialResource, TypingSchemeId } from '@/typings/typing'
import { wordListFetcher } from '@/utils/wordListFetcher'
import useSWR from 'swr'

export type ChapterTitle = { title: string; author?: string }

type TitleSource = { title?: string; author?: string; notation?: string }

/** 从 notation 首行拆出「标题 + 作者」（GAL2-06 兜底） */
function parseTitle(notation: string | undefined): ChapterTitle {
  const firstLine = (notation ?? '').split('\n')[0]?.trim() ?? ''
  if (!firstLine) return { title: '' }
  // 「春 朱自清」/「静夜思 李白」：首段为标题，其余为作者
  const [title, ...rest] = firstLine.split(/\s+/)
  return { title, author: rest.join(' ') || undefined }
}

export function useTypingChapterTitles(material: TypingMaterialResource, scheme: TypingSchemeId): ChapterTitle[] {
  const enabled = material.chapterLabelMode === 'title'
  const url = enabled ? resolveMaterialUrl(material, scheme) : null
  const { data } = useSWR(url, wordListFetcher, { revalidateOnFocus: false })

  if (!enabled || !data) return []
  return (data as TitleSource[]).map((item) => {
    if (item.title) return { title: item.title, author: item.author }
    return parseTitle(item.notation)
  })
}
