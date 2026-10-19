/**
 * 打字模式素材注册表 —— spec-20261017-v1 / 05 DATA-05、03 §6.2
 *
 * 🔴 DATA-05-1：本文件**不得**被 `src/resources/dictionary.ts` 引用（反之亦然）。
 * 两条数据线平行，只在打字模式（TypingLearner / TypingGallery）内使用。
 *
 * 素材总计 16 张卡片（03 §6.2）：全拼 5 + 小鹤 7 + 长文 2 + 英语 2，
 * 对应 20 个词典 JSON（长文按方案各一份，DATA-04）。
 */

import type {
  TypingMaterialResource,
  TypingMaterialType,
  TypingSchemeId,
  TypingSchemeIdAll,
  TypingWordDifficulty,
} from '@/typings/typing'

/** 章节计算（DATA-06）：不得复用现有 calcChapterCount（CHAPTER_LENGTH=20 硬约束） */
export const calcTypingChapterCount = (length: number, chapterSize: number) => Math.max(1, Math.ceil(length / chapterSize))

export const typingMaterials: TypingMaterialResource[] = [
  // ── 中文 · 全拼（5）──
  {
    id: 'zh-quanpin-zi-500',
    name: '常用 500 字',
    description: '覆盖高频口语与书面语常用字',
    languageTab: 'zh',
    schemeId: 'quanpin',
    materialType: 'zi',
    category: '中文·输入法练习',
    tags: ['单字'],
    url: '/dicts/zh/quanpin-zi-500.json',
    length: 500,
    chapterSize: 10,
    chapterCount: calcTypingChapterCount(500, 10),
    source: '《通用规范汉字表》一级字表（2013，国务院发布）',
    license: 'Public Domain（官方文件，不受著作权保护）',
  },
  {
    id: 'zh-quanpin-zi-3500',
    name: '常用 3500 字',
    description: '一级字表全量，覆盖现代汉语常用汉字',
    languageTab: 'zh',
    schemeId: 'quanpin',
    materialType: 'zi',
    category: '中文·输入法练习',
    tags: ['单字'],
    url: '/dicts/zh/quanpin-zi-3500.json',
    length: 3500,
    chapterSize: 10,
    chapterCount: calcTypingChapterCount(3500, 10),
    source: '《通用规范汉字表》一级字表（2013，国务院发布）',
    license: 'Public Domain（官方文件，不受著作权保护）',
  },
  {
    id: 'zh-quanpin-ci-1000',
    name: '常用 1000 词',
    description: '高频双字词，按词语境标注读音',
    languageTab: 'zh',
    schemeId: 'quanpin',
    materialType: 'ci',
    category: '中文·输入法练习',
    tags: ['常用词'],
    url: '/dicts/zh/quanpin-ci-1000.json',
    length: 1000,
    chapterSize: 10,
    chapterCount: calcTypingChapterCount(1000, 10),
    source: '词条参考 CC-CEDICT（CC BY-SA 4.0）并人工审校多音字',
    license: 'CC BY-SA 4.0（需署名，见选择页底部说明）',
  },
  {
    id: 'zh-quanpin-ci-medical',
    name: '医学常用词',
    description: '医学、护理与药学常见术语',
    languageTab: 'zh',
    schemeId: 'quanpin',
    materialType: 'ci',
    category: '中文·输入法练习',
    tags: ['专业词'],
    url: '/dicts/zh/quanpin-ci-medical.json',
    length: 367,
    chapterSize: 10,
    chapterCount: calcTypingChapterCount(367, 10),
    source: '本项目自建（术语属事实性表达，MAT-04）',
    license: '本项目自撰，仅供个人学习使用',
  },
  {
    id: 'zh-quanpin-ci-computer',
    name: '计算机常用词',
    description: '编程、运维与网络常见中文术语',
    languageTab: 'zh',
    schemeId: 'quanpin',
    materialType: 'ci',
    category: '中文·输入法练习',
    tags: ['专业词'],
    url: '/dicts/zh/quanpin-ci-computer.json',
    length: 408,
    chapterSize: 10,
    chapterCount: calcTypingChapterCount(408, 10),
    source: '本项目自建（术语属事实性表达，MAT-04）',
    license: '本项目自撰，仅供个人学习使用',
  },
  // ── 中文 · 小鹤双拼（7）──
  {
    id: 'zh-flypy-zi-500',
    name: '常用 500 字',
    description: '覆盖高频口语与书面语常用字',
    languageTab: 'zh',
    schemeId: 'flypy',
    materialType: 'zi',
    category: '中文·输入法练习',
    tags: ['单字'],
    url: '/dicts/zh/flypy-zi-500.json',
    length: 500,
    chapterSize: 10,
    chapterCount: calcTypingChapterCount(500, 10),
    source: '《通用规范汉字表》一级字表（2013，国务院发布）',
    license: 'Public Domain（官方文件，不受著作权保护）',
  },
  {
    id: 'zh-flypy-zi-3500',
    name: '常用 3500 字',
    description: '一级字表全量，覆盖现代汉语常用汉字',
    languageTab: 'zh',
    schemeId: 'flypy',
    materialType: 'zi',
    category: '中文·输入法练习',
    tags: ['单字'],
    url: '/dicts/zh/flypy-zi-3500.json',
    length: 3500,
    chapterSize: 10,
    chapterCount: calcTypingChapterCount(3500, 10),
    source: '《通用规范汉字表》一级字表（2013，国务院发布）',
    license: 'Public Domain（官方文件，不受著作权保护）',
  },
  {
    id: 'zh-flypy-ci-1000',
    name: '常用 1000 词',
    description: '高频双字词，按词语境标注读音',
    languageTab: 'zh',
    schemeId: 'flypy',
    materialType: 'ci',
    category: '中文·输入法练习',
    tags: ['常用词'],
    url: '/dicts/zh/flypy-ci-1000.json',
    length: 1000,
    chapterSize: 10,
    chapterCount: calcTypingChapterCount(1000, 10),
    source: '词条参考 CC-CEDICT（CC BY-SA 4.0）并人工审校多音字',
    license: 'CC BY-SA 4.0（需署名，见选择页底部说明）',
  },
  {
    id: 'zh-flypy-chengyu-500',
    name: '常用 500 成语',
    description: '四字成语，练熟高频成语的编码',
    languageTab: 'zh',
    schemeId: 'flypy',
    materialType: 'chengyu',
    category: '中文·输入法练习',
    tags: ['成语'],
    url: '/dicts/zh/flypy-chengyu-500.json',
    length: 500,
    chapterSize: 8,
    chapterCount: calcTypingChapterCount(500, 8),
    source: '公版类书整理与自建（词条为事实性内容，不含释义）',
    license: '公有领域 / 本项目自撰',
  },
  {
    id: 'zh-flypy-duanju-200',
    name: '常用 200 句',
    description: '10-30 字中性短句，贴近日常办公场景',
    languageTab: 'zh',
    schemeId: 'flypy',
    materialType: 'duanju',
    category: '中文·输入法练习',
    tags: ['短句'],
    url: '/dicts/zh/flypy-duanju-200.json',
    length: 200,
    chapterSize: 8,
    chapterCount: calcTypingChapterCount(200, 8),
    source: '本项目原创（MAT-05：短句必须原创）',
    license: '本项目自撰，仅供个人学习使用',
  },
  {
    id: 'zh-flypy-ci-medical',
    name: '医学常用词',
    description: '医学、护理与药学常见术语',
    languageTab: 'zh',
    schemeId: 'flypy',
    materialType: 'ci',
    category: '中文·输入法练习',
    tags: ['专业词'],
    url: '/dicts/zh/flypy-ci-medical.json',
    length: 367,
    chapterSize: 10,
    chapterCount: calcTypingChapterCount(367, 10),
    source: '本项目自建（术语属事实性表达，MAT-04）',
    license: '本项目自撰，仅供个人学习使用',
  },
  {
    id: 'zh-flypy-ci-computer',
    name: '计算机常用词',
    description: '编程、运维与网络常见中文术语',
    languageTab: 'zh',
    schemeId: 'flypy',
    materialType: 'ci',
    category: '中文·输入法练习',
    tags: ['专业词'],
    url: '/dicts/zh/flypy-ci-computer.json',
    length: 408,
    chapterSize: 10,
    chapterCount: calcTypingChapterCount(408, 10),
    source: '本项目自建（术语属事实性表达，MAT-04）',
    license: '本项目自撰，仅供个人学习使用',
  },
  // ── 中文 · 长文（按方案各一份文件，DATA-04）──
  {
    id: 'zh-wenzhang-shi',
    name: '古诗文短篇',
    description: '唐诗宋词选段与文言短篇',
    languageTab: 'zh',
    schemeId: 'quanpin',
    materialType: 'wenzhang',
    category: '中文·输入法练习',
    tags: ['诗词'],
    url: '/dicts/zh/{scheme}-wenzhang-shi.json',
    length: 12,
    chapterSize: 1,
    chapterCount: calcTypingChapterCount(12, 1),
    difficulty: 'adv',
    chapterLabelMode: 'title',
    source: '公有领域古诗文（作者卒年逾 50 年，MAT-06）',
    license: '公有领域',
  },
  {
    id: 'zh-wenzhang-qingsong',
    name: '轻松短文',
    description: '两百字上下的公版笔记小品，适合热身',
    languageTab: 'zh',
    schemeId: 'quanpin',
    materialType: 'wenzhang',
    category: '中文·输入法练习',
    tags: ['短文'],
    url: '/dicts/zh/{scheme}-wenzhang-qingsong.json',
    length: 10,
    chapterSize: 1,
    chapterCount: calcTypingChapterCount(10, 1),
    difficulty: 'intro',
    chapterLabelMode: 'title',
    source: '张岱、苏轼、刘义庆、沈复、蒲松龄等公有领域古典小品',
    license: '公有领域',
  },
  {
    id: 'zh-wenzhang-10',
    name: '白话短文 10 篇',
    description: '现代作家公版散文，每篇 300-600 字',
    languageTab: 'zh',
    schemeId: 'quanpin',
    materialType: 'wenzhang',
    category: '中文·输入法练习',
    tags: ['短文'],
    url: '/dicts/zh/{scheme}-wenzhang-10.json',
    length: 10,
    chapterSize: 1,
    chapterCount: calcTypingChapterCount(10, 1),
    difficulty: 'mid',
    chapterLabelMode: 'title',
    source: '朱自清、鲁迅、许地山等公版作品（卒年 + 50 年判定，MAT-06）',
    license: '公有领域',
  },
  // ── 英语（2）──
  {
    id: 'en-article-para',
    name: 'English Paragraphs',
    description: '80-150 词英文段落，适合一次打完',
    languageTab: 'en',
    schemeId: 'en',
    materialType: 'paragraph',
    category: '文章练习',
    tags: ['段落'],
    url: '/dicts/en/para.json',
    length: 25,
    chapterSize: 1,
    chapterCount: calcTypingChapterCount(25, 1),
    difficulty: 'intro',
    chapterLabelMode: 'title',
    source: '本项目原创英文段落',
    license: '本项目自撰，仅供个人学习使用',
  },
  {
    id: 'en-article-essay',
    name: 'English Essays',
    description: '300-600 词英文文章，按篇练习',
    languageTab: 'en',
    schemeId: 'en',
    materialType: 'article',
    category: '文章练习',
    tags: ['文章'],
    url: '/dicts/en/essay.json',
    length: 10,
    chapterSize: 1,
    chapterCount: calcTypingChapterCount(10, 1),
    difficulty: 'mid',
    chapterLabelMode: 'title',
    source: '本项目原创英文文章',
    license: '本项目自撰，仅供个人学习使用',
  },
  {
    id: 'en-article-classic',
    name: 'English Classics',
    description: '培根、爱默生、梭罗等公版英文原文',
    languageTab: 'en',
    schemeId: 'en',
    materialType: 'classic',
    category: '文章练习',
    tags: ['经典'],
    url: '/dicts/en/classic.json',
    length: 6,
    chapterSize: 1,
    chapterCount: calcTypingChapterCount(6, 1),
    difficulty: 'adv',
    chapterLabelMode: 'title',
    source: 'Bacon / Emerson / Thoreau / Swift / Addison / Lamb，原文均为公有领域',
    license: '公有领域',
  },
]

export const typingMaterialMap: Record<string, TypingMaterialResource> = Object.fromEntries(
  typingMaterials.map((m) => [m.id, m]),
)

/** 默认素材（MODE-03 / MODE-08 / ACC-03-14 的回落目标） */
export const DEFAULT_TYPING_MATERIAL_ID = 'zh-quanpin-zi-500'

const warnedMaterialIds = new Set<string>()

/** 按 id 取素材；不存在时回落默认值并 warn（MODE-08 / ACC-03-14） */
export const findMaterial = (id: string): TypingMaterialResource => {
  const material = typingMaterialMap[id]
  if (material) return material
  if (!warnedMaterialIds.has(id)) {
    warnedMaterialIds.add(id)
    console.warn(`[typing] 素材 id 不存在：${id}，已回落 ${DEFAULT_TYPING_MATERIAL_ID}`)
  }
  return typingMaterialMap[DEFAULT_TYPING_MATERIAL_ID]
}

/** 方案中文名（UI 展示用） */
export const SCHEME_NAME_MAP: Record<TypingSchemeId, string> = {
  quanpin: '全拼',
  flypy: '小鹤双拼',
}

/** 语言中文名（UI 展示用） */
export const LANGUAGE_NAME_MAP = {
  zh: '中文',
  en: '英语',
} as const

/** 双拼二级菜单（GAL-07：置灰项必须可见但不可选中） */
export const TYPING_SCHEME_OPTIONS: { id: TypingSchemeIdAll; name: string; available: boolean }[] = [
  { id: 'flypy', name: '小鹤双拼', available: true },
  { id: 'mspy', name: '微软双拼', available: false },
  { id: 'zrm', name: '自然码', available: false },
  { id: 'sogou', name: '搜狗双拼', available: false },
]

/** 素材类型 → 胶囊文案（03 §5.1 / §5.2） */
export const MATERIAL_TYPE_LABELS: Record<TypingMaterialType, string> = {
  zi: '字',
  ci: '词',
  chengyu: '成语',
  duanju: '短句',
  wenzhang: '文章',
  paragraph: '段落',
  article: '文章',
  classic: '经典',
}

/** 难度档 → 中文标签（03 GAL2-09） */
export const DIFFICULTY_LABELS: Record<TypingWordDifficulty, string> = {
  intro: '入门',
  mid: '进阶',
  adv: '挑战',
}

/** 难度档 → 胶囊顺序（03 GAL2-13：按难度升序） */
export const DIFFICULTY_ORDER: TypingWordDifficulty[] = ['intro', 'mid', 'adv']

/** 素材类型 → 数量单位（MAT-01 元信息行用，如「500 字 · 50 章 · 全拼」） */
export const MATERIAL_UNIT_LABELS: Record<TypingMaterialType, string> = {
  zi: '字',
  ci: '词',
  chengyu: '条',
  duanju: '句',
  wenzhang: '篇',
  paragraph: '段',
  article: '篇',
  classic: '篇',
}

/**
 * 素材类型 → 章节单位（02 KEEP-02 / §6：页头章节按钮与结算页用）。
 * 短素材（字/词/成语/短句）用「章」；长文章（wenzhang/paragraph/article）用「段」。
 */
export const MATERIAL_CHAPTER_LABELS: Record<TypingMaterialType, string> = {
  zi: '章',
  ci: '章',
  chengyu: '章',
  duanju: '章',
  wenzhang: '段',
  paragraph: '段',
  article: '段',
  classic: '段',
}

/**
 * 素材 + 当前方案 → 实际加载的 JSON 路径（GAL-12 / DATA-04）。
 * - 长文类 url 含 `{scheme}` 占位符，运行时替换；
 * - 单方案素材在非匹配方案下：有 fallbackSchemeId 则回落，否则用字面路径（调用方应先过滤可见性）。
 */
export function resolveMaterialUrl(material: TypingMaterialResource, scheme: TypingSchemeId): string {
  if (material.schemeId !== 'en' && material.schemeId !== scheme) {
    if (material.fallbackSchemeId) {
      return resolveMaterialUrl({ ...material, schemeId: material.fallbackSchemeId, fallbackSchemeId: undefined }, scheme)
    }
  }
  return material.url.replace('{scheme}', scheme)
}

/** 该素材在当前方案下是否有对应词典文件（GAL-12 徽标与自动切换用） */
export function materialHasSchemeFile(material: TypingMaterialResource, scheme: TypingSchemeId): boolean {
  if (material.schemeId === 'en') return true
  if (material.url.includes('{scheme}')) return true
  return material.schemeId === scheme
}

/**
 * 方案切换时的素材解析（GAL-05 / ACC-06-12 的兜底）：
 * - 英语素材 / 长文（url 含 {scheme} 占位符，双方案通用，DATA-04）→ 原样返回；
 * - 单方案素材 → 换成同内容的新方案 id（`zh-flypy-zi-500` ⇄ `zh-quanpin-zi-500`）；
 * - 换不到 → 回落默认素材并 warn。
 */
export function resolveMaterialId(id: string, scheme: TypingSchemeId): string {
  const material = typingMaterialMap[id]
  if (!material) return DEFAULT_TYPING_MATERIAL_ID
  if (material.schemeId === 'en' || material.schemeId === scheme) return id
  // 长文类：url 含 {scheme} 占位符，两方案各有字典文件，与当前方案无关（DATA-04）
  if (material.url.includes('{scheme}')) return id
  const swapped = id.replace(/^zh-(quanpin|flypy)-/, `zh-${scheme}-`)
  if (swapped !== id && typingMaterialMap[swapped]) return swapped
  if (material.fallbackSchemeId) {
    const fallback = id.replace(/^zh-(quanpin|flypy)-/, `zh-${material.fallbackSchemeId}-`)
    if (typingMaterialMap[fallback]) return fallback
  }
  // 该素材在另一方案下没有同内容卡片（如「常用 200 句」只有小鹤版）：
  // 保留当前素材 id 原样返回（词典文件仍然存在，只是编码不属于当前方案），
  // 🔴 绝不能回落到默认素材——那会让用户「选了成语却看到单字」。
  if (!warnedMaterialIds.has(`resolve:${id}:${scheme}`)) {
    warnedMaterialIds.add(`resolve:${id}:${scheme}`)
    console.warn(`[typing] 素材 ${id} 在方案 ${scheme} 下没有同内容卡片，保留原素材`)
  }
  return id
}

/**
 * 判断某个 dict id 是否属于打字模式（05 DATA-17：Analysis 只读筛选用）。
 * 打字模式的章节/词记录写入时 dict = 素材 id（zh-* / en-article-*）。
 */
export const isTypingDictId = (dict: string): boolean => dict.startsWith('zh-') || dict.startsWith('en-article-')
