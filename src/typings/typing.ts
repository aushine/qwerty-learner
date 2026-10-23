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
export type TypingMaterialType = 'zi' | 'ci' | 'chengyu' | 'duanju' | 'wenzhang' | 'paragraph' | 'article' | 'classic'

/**
 * 输入轨（spec-20261017-v2 / 02 SPEED2-01）
 * - `code`：对码轨（全拼 / 双拼），校验击键序列
 * - `ime`：上屏轨（打字测速），校验最终上屏文本
 * 🔴 与 `schemeId` 正交，不得合并为同一个枚举（SPEED2-01-1）。
 */
export type TypingInputTrack = 'code' | 'ime'

/** 素材内容难度（`03` GAL2-09：人工定级，仅文章类） */
export type TypingWordDifficulty = 'intro' | 'mid' | 'adv'

/**
 * ─────────────────────────────────────────────────────────────
 * 打字游戏模块（spec-20261019-v1「游戏中心与共享引擎」）
 * 🔴 与上方学习/打字模式类型同文件但独立成区，前缀 Game 避免混淆。
 * ─────────────────────────────────────────────────────────────
 */

/** 玩法 id（01 §四 GameConfig.kind） */
export type GameId = 'moyu' | 'shoot' | 'idiom'

/** 难度 tier（05 DATA-02：入门/进阶/挑战，沿用文章难度分组口径） */
export type GameTier = 'intro' | 'mid' | 'adv'

/** 游戏模式：练习（不失败）/ 挑战（生命或计时，01 REQ-03） */
export type GameMode = 'practice' | 'challenge'

/** 单局评级（09 §4.2：S/A/B/C/D/F 多维加权，准确率一票否决） */
export type GameRating = 'S' | 'A' | 'B' | 'C' | 'D' | 'F'

/** 游戏配置（01 §四，运行期） */
export type GameConfig = {
  id: GameId
  /** 玩法名（卡片标题） */
  name: string
  kind: GameId
  /** 语言 Tab：zh=仅中文；both=中英皆可（成语接龙中文专属） */
  languageTab: TypingLanguageTab | 'both'
  /** 默认输入轨（01 REQ-04：默认对码轨） */
  defaultTrack: TypingInputTrack
  /** 一句话简介（卡片） */
  summary: string
  /** 招牌玩法置顶（00 §5：墨雨 ★） */
  featured?: boolean
  /** 是否提供练习模式（MOYU-04 / IDIOM-03；诗词射击仅挑战） */
  hasPracticeMode: boolean
}

/** 成绩记录结构（01 REQ-06：纯本地、零上传） */
export type GameRecordData = {
  id?: number
  gameId: GameId
  track: TypingInputTrack
  language: TypingLanguageTab
  tier: GameTier
  mode: GameMode
  score: number
  /** 字准确率 0~1 */
  accuracy: number
  /** 击键/秒 */
  kps: number
  maxCombo: number
  rating: GameRating
  /** 时长（秒） */
  time: number
  timestamp: number
  /**
   * 幽灵数据：每个被清除目标的时间戳（ms，相对开局）。
   * ⚠️ 本批次只存不展示（09 §3.5 可视覆盖层待后续批次，schedule 已备注）。
   */
  ghost?: number[]
  /** 墨雨：本局完成笔画数 */
  strokes?: number
  /** 诗词射击：通关篇目数 */
  poemsCleared?: number
  /** 成语接龙：本局接龙长度 */
  chainLength?: number
}

/**
 * 逐字对齐单元（打字模式题面「拼音行 / 汉字行」一一对应的数据来源）。
 *
 * 一个 unit 对应 `notation` 中的**一个字符**（汉字或标点），因此
 * `notation` 逐字符切分后的数组长度与 `units.length` 严格相等，
 * 前端可按 index 直接配对渲染。
 *
 * - 汉字：`code` 为它对应的编码片段（全拼=拼音字母，双拼=1~2 键），可被打字推进
 * - 标点/空白/换行：`code` 为 `''`，显示但不参与输入（用户拍板「标点可省略不打」）
 */
export type TypingUnit = {
  /** 与 notation 同位置的原始字符 */
  char: string
  /** 该字符对应的编码片段；非汉字为 '' */
  code: string
}

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
  /**
   * 逐字对齐信息（中文素材才有；英语素材不输出）。
   * `units.length === notation.length`，用于「拼音行 / 汉字行」交替渲染与逐字进度。
   */
  units?: TypingUnit[]
  /** 🆕 篇名（仅文章类，DATA2-01） */
  title?: string
  /** 🆕 作者（仅文章类，可缺省） */
  author?: string
  /** 🆕 难度档（仅文章类） */
  difficulty?: TypingWordDifficulty
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
  /** 🆕 素材难度档（仅文章类，DATA2-03） */
  difficulty?: TypingWordDifficulty
  /** 🆕 章节标签模式：`title` = 显示篇名（文章类），`chapter` = 第 N 章（其余） */
  chapterLabelMode?: 'chapter' | 'title'
}
