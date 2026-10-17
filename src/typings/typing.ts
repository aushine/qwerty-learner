/**
 * 打字模式（Typing Learner）专用类型 —— spec-20261017-v1
 * 来源：01 §2.1（模式枚举）、05 DATA-01（数据模型）
 *
 * 🔴 DATA-01：本文件是**独立类型线**，不得与 `src/typings/index.ts` 的
 * `Dictionary` / `DictionaryResource` / `Word` 混用或互相加字段。
 * 理由：后者被 Gallery-N / store / WordPanel / Analysis 等 20+ 处消费，
 * 加字段的回归面远大于新建类型的成本。
 */

/** 模式枚举（01 §2.1）。注意：渲染分支由**路由**决定，atom 只用于入口高亮与记忆（MODE-04） */
export type AppMode = 'learn' | 'typing'

/** 语言 Tab（03 §3）：第一版仅中文 / 英语 */
export type TypingLanguageTab = 'zh' | 'en'

/** 输入方式（方案）。第一版仅 quanpin / flypy 可用（GAL-07） */
export type TypingSchemeId = 'quanpin' | 'flypy'

/** 保留未来方案（mspy / zrm / sogou 第一版置灰「敬请期待」） */
export type TypingSchemeIdAll = 'quanpin' | 'flypy' | 'mspy' | 'zrm' | 'sogou'

/** 素材类型（决定落在哪个胶囊下，03 §5） */
export type TypingMaterialType = 'zi' | 'ci' | 'chengyu' | 'duanju' | 'wenzhang' | 'paragraph' | 'article'

/**
 * 词条 JSON 形状（05 §2.2）：沿用现有 `Word` 结构，但语义整体替换。
 * 构建产物见 `public/dicts/zh/*.json` 与 `public/dicts/en/*.json`。
 */
export type TypingWord = {
  /** 目标编码串（全拼为字母串；双拼为每字 2 键拼接）。🔴 判定与高亮的唯一依据 */
  name: string
  /** 与 `notation` 相同的单元素数组——占位，为了让现有组件不报错；UI 不得显示（DATA-02） */
  trans: string[]
  usphone: string
  ukphone: string
  /** 汉字原文（中文素材）/ 英文原文（英语素材） */
  notation: string
  /** 兼容编码集合，`acceptedCodes[0]` 为主口径；仅在零声母双字母与 jqxy+ü 原式等场景出现 */
  acceptedCodes?: string[]
}

/** 素材注册表条目（05 DATA-05） */
export type TypingMaterialResource = {
  /** 唯一 id，命名规范 `zh-<scheme>-<type>[-<variant>]` / `en-<type>[-<variant>]`（DATA-03） */
  id: string
  /** 卡片标题，如「常用 500 字」 */
  name: string
  /** 一行描述，我方自撰（不得抄词典释义，MAT-01） */
  description: string
  /** 语言 Tab */
  languageTab: TypingLanguageTab
  /** 编码方案；英语素材为 'en' */
  schemeId: TypingSchemeId | 'en'
  /** 素材类型（决定落在哪个胶囊下） */
  materialType: TypingMaterialType
  /** 分组标题（中文 Tab：`中文·输入法练习`；英语 Tab：`文章练习`，GAL-11） */
  category: string
  /** 胶囊标签（用于分组内的 tag 切换） */
  tags: string[]
  /**
   * 词典 JSON 路径。
   * 长文类（wenzhang）按方案各一份文件，路径中的 `{scheme}` 占位符在运行时替换为
   * 当前方案（DATA-04）；其余素材为字面路径。
   */
  url: string
  /** 条目数（字/词/句/篇） */
  length: number
  /** 每章条目数（中文默认 10，成语 8，句 8；文章为 1） */
  chapterSize: number
  /** 章节数（= calcTypingChapterCount(length, chapterSize)，写入时固化以便 UI 直接读） */
  chapterCount: number
  /** 语料来源（合规举证，DATA-18 / 基线 A2） */
  source: string
  /** 许可标识 */
  license: string
  /** 若该素材只在其他方案下有文件，指向可用方案（GAL-12 回落）。本批次 16 个素材的两方案文件均已构建，故不触发 */
  fallbackSchemeId?: TypingSchemeId
}
