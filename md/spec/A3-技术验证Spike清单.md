# A3 - 技术验证 Spike 清单

- **日期**：2026-10-17
- **负责成员**：代码探查（Explore）+ 方向明汇编
- **基线**：本地 master，最近提交同步上游 PR #1111
- **文档定位**：为中文输入法打字练习功能（双轨制 `inputMode: 'code-match' | 'ime'`）列出**开工前必须完成的技术验证项**。每个 Spike 给出：目的、验证方法、验收标准、预估工作量、阻塞哪些功能、失败时的降级方案。架构背景详见 03，编码方案映射详见 A1，语料许可详见 A2，指标口径详见 05。
- **约束**：所有 Spike 均为**只读验证性质**（POC 代码放独立分支/沙箱目录，不合入主干，不修改现有代码）。
- **路径简写约定（grep 友好）**：`Word/index.tsx` 的完整路径为 `src/pages/Typing/components/WordPanel/components/Word/index.tsx`（逐字符校验核心，S2 首次出现处已给全路径）；其余 Typing 页组件简写相对 `src/pages/Typing/components/`（WordPanel 内部组件在其 `WordPanel/components/` 下），页面级简写（ErrorBook / Analysis / Gallery-N 等）相对 `src/pages/`。完整约定表见 03 文档 §0。

---

## 0. Spike 总览与执行顺序

| 编号 | 名称 | 优先级 | 预估工作量 | 阻塞对象 | 结论性质 |
|---|---|---|---|---|---|
| **S1** | 浏览器原始按键捕获可靠性（type=password 方案） | **P0（必须最先做）** | 2-3 人日 | M4 全部、对码轨全部、中文词典上线 | 生死判定 |
| S2 | name/notation 结构扩展成本验证 | P0 | 1 人日 | M2/M3、首批中文字典 | 成本校准 |
| S3 | 长文本（1000+ 字）渲染与校验性能 | P1 | 1-2 人日 | ime 轨句/文/古诗词类型 | 范围裁剪 |
| S4 | 多音字离线预处理管线正确性 | P0 | 3-4 人日 | M2 全部、所有对码轨语料 | 质量门槛 |
| S5 | 编码方案配置格式设计（keyMap/zeroMap 借鉴） | P1 | 1-2 人日 | M1、双拼支持 | 设计定型 |
| S6 | compositionend 跨浏览器事件时序验证 | P1 | 2 人日（需真机） | M5 全部、ime 轨全部 | 生死判定 |
| S7 | IME 中英文态不可程序化切换的产品化处理 | P2 | 0.5 人日（调研）+ 设计 | ime 轨体验完整性 | 交互设计输入 |
| **S8** | 零声母 α/β 口径冲突实测（A1 C-4 收口） | **P0（双拼前置）** | 1.5-2 人日 | 双拼对码轨出题、M1 zeroMap、05 主口径指标 | 事实收口 |
| S9 | 多合法编码（string[]）引擎改造成本评估 | P1 | 评估 1 人日 / 实施约 3.5 人日 | 多音字与多口径字的完整判对（增强项） | 成本决策 |

**依赖关系**：

```
S1（对码轨生死）──┐
                  ├──> S2（结构成本）──> S4（编码质量）──┐
S5（方案格式）────┴──> S8（零声母口径）──────────────────┴──> 对码轨 MVP
                                                        └──> S9（多编码引擎，增强项，可不入首发）
S6（实战轨生死）──> S3（长文性能）──> S7（状态提示）──> 实战轨 MVP
```

**排期建议**：S1 + S6 可并行（分属两轨、互不依赖）；S4 依赖 S5 的配置格式定稿；S2 最轻，随手先做以校准 03 文档中"<30 行引擎改动"的判断。S8 的 Rime algebra 离线仿真部分不依赖真机，可在等待真机批次时先行；S8 结论是 S5 zeroMap 结构与 05 主口径指标的输入，建议紧随 S5。S9 为纯评估型 Spike（不写实现），随时可做，其结论决定多编码引擎是否入首发范围。

---

## S1：浏览器原始按键捕获可靠性（type=password 方案）【P0，必须最先做】

### 目的

对码轨的技术前提：**强制拿到英文键盘原始按键**，绕过用户系统输入法的中英文状态。ShanRenMa fork 的生产验证方案是 `type=password` 输入框（OS 层面对密码框强制英文输入）+ 原始 keydown 捕获。本 Spike 验证该方案在本项目技术栈（React 18 + window keydown 监听，见 `src/pages/Typing/components/WordPanel/components/KeyEventHandler/index.tsx:29`）下的可靠性边界。

同时要回答三个衍生问题：

1. 现有上游的三条捕获路径（`KeyEventHandler` window keydown / `TextAreaHandler` 隐藏 textarea 的 input 事件（`TextAreaHandler/index.tsx:23,41-51`）/ `InputHandler` 分发器（`InputHandler/index.tsx:11-24`））哪条改造代价最小；
2. `type=password` 的副作用清单（浏览器密码管理器弹窗、自动填充、`::-ms-reveal` 小眼睛、无障碍读屏、移动端软键盘弹出"密码键盘"）实测表现；
3. 中文输入法激活时 `KeyboardEvent` 的 `key/code/isComposing` 三元组在各浏览器的实际取值（决定 `isLegal`（`src/utils/index.ts:39-42`）与启动键逻辑（`src/pages/Typing/index.tsx:80-92`）如何改）。

### 验证方法

1. 建独立 POC 页面（Vite 新路由或纯静态 html），实现三个捕获变体：
   - **变体 A**：`<input type="password">` 聚焦 + 监听其 keydown，`autocomplete="new-password"`；
   - **变体 B**：隐藏 `<textarea>`（沿用上游 `TextAreaHandler/index.tsx:41-51` 的 h-0 w-0 形态），监听 keydown + composition 事件，记录 IME 激活时的原始事件序列；
   - **变体 C**：无输入框，纯 window keydown（上游 `KeyEventHandler` 形态），验证 IME 激活时是否只能拿到 `'Process'`。
2. 兼容矩阵实测（每格记录：能否拿到原始字母 / 是否弹 IME 候选窗 / 密码管理器是否弹出 / 首键是否丢失）：

   | 浏览器 | OS | 输入法 | 变体 A | 变体 B | 变体 C |
   |---|---|---|---|---|---|
   | Chrome 最新 | Windows 11 | 微软拼音 | | | |
   | Chrome 最新 | Windows 11 | 搜狗拼音 | | | |
   | Chrome 最新 | Windows 11 | QQ 拼音 | | | |
   | Chrome 最新 | macOS | 系统拼音 | | | |
   | Safari 最新 | macOS | 系统拼音 | | | |
   | Edge 最新 | Windows 11 | 微软拼音 | | | |
   | Firefox 最新 | Windows 11 | 微软拼音 | | | |
   | Firefox 最新 | Linux (X11/Wayland) | Rime/ibus-pinyin | | | |
   | Chrome | Windows 11 | Rime（小狼毫） | | | |

   最低覆盖要求：**Chrome+Win（微软拼音/搜狗）** 与 **Safari+macOS（系统拼音）** 两条主线路必须实测通过，其余至少一条实测 + 其余以社区资料佐证。
3. password 副作用缓解实测：`autocomplete="new-password"`、CSS `::-ms-reveal { display: none }`、`aria-label`、`inputmode`/`enterkeyhint` 属性组合后，逐项复查上表"密码管理器弹窗"列。
4. 事件字段记录：每个组合下 dump `{key, code, keyCode, isComposing, nativeEvent.inputType}`，验证"`code` 字段在 IME 激活时仍为物理键位（如 `KeyJ`）"这一关键假设（它决定 `isLegal` 改造是读 `key` 还是读 `code`）。

### 验收标准

- [ ] 变体 A 在 Chrome+Win+微软拼音/搜狗、Safari+macOS 两大主线下，**IME 处于中文态时仍能拿到连续、无丢失的原始字母 keydown**（`e.key` 为字母或 `e.code` 可映射为字母）；
- [ ] 密码管理器（Chrome 内置 / Edge 内置 / macOS Safari 钥匙串）在缓解属性组合后**不弹出保存提示**；
- [ ] 输入框不显示明文（password 天然满足）且无 `::-ms-reveal` 小眼睛残留（Edge 实测）；
- [ ] 得出明确结论：三个变体中选哪个作为 M4 PasswordKeyHandler 的实现底座，并记录 `KeyboardEvent.code` 在 IME 中文态下的可靠性结论；
- [ ] 产出兼容矩阵表（上表填满），归档到本文件附录或 03 文档引用处。

### 预估工作量

2-3 人日（POC 0.5 天 + 多机多输入法实测 1-1.5 天 + 结论整理 0.5-1 天）。需要至少一台 macOS 真机（可借用/云真机）。

### 阻塞哪些功能

- **M4 PasswordKeyHandler 全部实现**；
- **对码轨（code-match）全部功能**——字/词/成语三级练习都依赖原始按键；
- 中文词典首批上线（哪怕只做对码轨 MVP 也依赖此结论）。

### 失败时的降级方案

按失败程度分级：

1. **个别浏览器失败**（如 Firefox+Rime 拿不到原始键）：M4 做浏览器能力检测（feature detection），不支持的组合下在词典选择页明示"当前浏览器不支持对码练习"，引导用 Chrome/Edge；主线路（Chrome/Safari/Edge）覆盖 95%+ 用户即视为整体成功。
2. **password 方案全线失败**（密码管理器无法抑制等）：降级到变体 B——隐藏 textarea + `compositionend` 兜底：IME 中文态下把用户实际输入的拼音串（composition 事件可拿到）当"码"校验，体验略降（用户可能看到候选窗闪动）但功能可用；此路径与 M5 共用 composition 基础设施（S6 结论复用）。
3. **连原始按键都拿不到**（极端浏览器策略）：对码轨整体降级为"教学展示模式"——只展示编码对照（A1 的 keyMap），不做实时校验；同时把资源全部转向 ime 轨。此为最坏情况，发生概率低（ShanRenMa fork 已生产验证 password 方案可行）。

---

## S2：name/notation 结构扩展成本验证【P0】

### 目的

校准 03 文档第 3 节的核心判断："ShanRenMa fork 用 **name=拉丁编码、notation=汉字展示** 的既有抽象（与日文 romaji 词典同构），引擎改动 <30 行"。本 Spike 在本地代码上验证该路径的真实改动面，确认哪些是"零改动继承"、哪些必须动。

### 验证方法

1. 手工构造一个 20 条的微型中文字典 JSON（格式对齐 `src/typings/index.ts:22-28` 的 `Word` 类型）：`name` 填全拼码（如 `nihao`）、`notation` 填汉字（如 `你好`）、`trans` 填释义；
2. 参照 `src/resources/dictionary.ts:4172-4189` 被注释的 zhtest 词典形态，在 POC 分支注册该词典（`language: 'zh'`）；
3. 走通完整链路：词典选择（Gallery-N，注意 `LanguageTabSwitcher.tsx:18-25` 需加 zh 选项）→ 章节加载（`useWordList.ts`）→ 打字 → 结算 → 落库（Dexie）→ Analysis 页统计 → 错题本回查（`useGetWord.ts:13`）；
4. 记录每一处必须改动的位置与行数，重点核对：
   - `src/typings/index.ts:5-6`：`LanguageType` 已含 `'zh'`，但 `LanguageCategoryType` 缺 `'zh'`——确认加一个成员后 `InputHandler/index.tsx:11-24` 的 switch 走哪个分支（预期 default → TextAreaHandler，与 fork 一致）；
   - `src/pages/Typing/components/WordPanel/components/Word/index.tsx:290`（后文简写为 `Word/index.tsx`）：`['romaji','hapin'].includes(currentLanguage)` 控制 notation 渲染——确认 `'zh'` 加入该数组后汉字注音显示正常；
   - `soundResource.ts:94-102`：`LANG_PRON_MAP.zh` 已存在（'普通话'），`usePronunciation.ts:21-22` 的 youdao `&le=zh` 发音链路对 `notation`（汉字）还是 `name`（拼音）取词——预期需改为对 notation 取词；
   - 校验逻辑 `Word/index.tsx:168-235`：确认对 name=拼音码逐字母校验**零改动**可用；
   - Dexie 落库：`word` 字段存的是 `name`（拼音码）——确认 Analysis/错题本按拼音码统计是否可接受，或需在 M2 阶段把展示名（notation）也写入记录（呼应 03 文档 8.2）。

### 验收标准

- [ ] POC 分支上完整走通"选词典→打字→结算→错题本"闭环，无白屏/报错；
- [ ] 产出**精确的改动清单**（文件:行号 + 改动性质 + 行数），与"<30 行引擎改动"判断对照，偏差 >50% 时需回写修正 03 文档第 3/6 节；
- [ ] 确认发音（Ctrl+J / 自动发音）对中文条目的行为并给出结论（可用/需改/降级静音）；
- [ ] 确认错题本、Analysis 对拼音码条目的展示形态可接受（或列出必须补充的 notation 透传点）。

### 预估工作量

1 人日。

### 阻塞哪些功能

- M2 构建管线的**输出 JSON 格式定稿**（name/notation/trans 字段语义）；
- M3 CorpusProvider 的词典注册形态；
- 首批中文字典（常用字/词）的制作。

### 失败时的降级方案

若发现 `language: 'zh'` 走上游既有链路存在隐藏断点（如某处硬编码 `'en'` 假设）：改为**借用 `romaji` 语言槽位**注册中文词典（notation 渲染逻辑 `Word/index.tsx:290` 对 romaji 已生效），代价是 Gallery 分类展示不准，作为过渡；同时在 M3 中正式引入 zh 类别。若发音链路不可用：中文条目发音降级为浏览器 TTS（`speechSynthesis`）或静音，不阻塞打字主链路。

---

## S3：长文本（1000+ 字）渲染与校验性能【P1】

### 目的

ime 轨的句/诗/文三级语料长度远超英文单词。验证现有逐字符渲染（`Word/index.tsx:302-304` 的 `displayWord.split('').map(<Letter>)`）与逐字符状态数组（letterStates/letterTimeArray/letterMistake）在长文本下的性能与交互可接受性，回答"单条目最大长度定多少"。

### 验证方法

1. POC 页面构造 4 档长度样本：100 字（句子）、300 字（短文）、1000 字（古文段落）、3000 字（文章），分别测：
   - 首次渲染耗时（React Profiler）与内存占用；
   - 每次按键/上屏后的重渲染耗时（重点：immer 对 letterStates 大数组的 produce 开销、`Word/index.tsx:137-166` getLetterVisible 的 useMemo 依赖数组大小）；
   - 滚动/视口表现：现有布局是单行居中展示，长文如何折行、是否需要虚拟滚动或"当前行聚焦"视图；
2. 测 ime 轨特有开销：compositionend 一次上屏 10-20 字时的批量校验循环（03 文档 7.2 [5] 的 substring 比对）耗时；
3. 测 Dexie 落库：`timing` 数组 1000+ 元素的 add 耗时与 IndexedDB 单记录大小；
4. 对照现有 CHAPTER_LENGTH=20（`src/constants/index.ts:3`）：长文场景下"一章"的定义（整篇为一章 vs 按段切分），影响 `useWordList.ts:38` 的 slice 逻辑与 05 文档指标口径。

### 验收标准

- [ ] 得出各长度档位的渲染/重渲染耗时数据表，明确"单条目 ≤ N 字时体验流畅（重渲染 < 50ms）"的 N 值；
- [ ] 给出长文展示交互方案结论（折行全显 / 当前句聚焦 / 虚拟滚动三选一），供 M9 UI 设计；
- [ ] 确认 Dexie 落库无单记录大小风险（或给出分段落库方案）；
- [ ] 若 1000+ 字不可行，给出语料分片规则（按句/段切分为多条 Word），回写 M2 管线约束。

### 预估工作量

1-2 人日。

### 阻塞哪些功能

- ime 轨的**文/文章级**语料类型（句/诗级 100-300 字大概率无碍，不被阻塞）；
- M2 管线的语料分片规则定稿；
- M9 长文视图的 UI 设计。

### 失败时的降级方案

1000+ 字档位不达标 → **语料上限裁剪**：ime 轨首发只做到"句"级（≤100 字）与"诗词"级（≤300 字），文章级语料在 M2 管线中按标点自动切分为句组（每组 ≤ N 字，N 取本 Spike 测出的流畅阈值），条目间用"下一句"衔接，体验类似现有逐词切换。该降级不影响 05 指标口径（每条仍是独立 Word 记录）。

---

## S4：多音字离线预处理管线正确性【P0】

### 目的

对码轨的核心质量前提：**离线预计算的编码必须正确**。中文多音字（如"行"hang/xing、"重"zhong/chong）在不同词境下读音不同，编码随之不同。03 文档 M2 要求"零运行时拼音依赖"——所有编码在构建期烘焙进词典 JSON 的 `name` 字段。本 Spike 验证构建管线的多音字消歧准确率能否达标。

### 验证方法

1. 搭建 POC 管线脚本（独立 node 脚本，不入 src/）：
   - 输入：汉字词条列表（字级 500 常用字样本 + 词级 2000 词样本 + 成语 500 条样本）；
   - 处理：`pinyin-pro`（或同类库）做**词级上下文消歧**（对词/成语整词取音，而非逐字取音——这是消歧准确率的关键）；
   - 输出：全拼码 + 小鹤双拼码（映射表详见 A1）；
2. 基准比对：
   - **音节全集回归**：生成的拼音音节必须落在 405 个标准音节（不含声调）集合内，越界即 bug；
   - **官方码表基准**：用《通用规范汉字表》一级字表 + 权威词典注音做抽样对照，准确率基准 **≥99.6%**（对齐 A1 中码表覆盖率 99.649% 的口径）；
   - **多音字专项集**：人工整理 200 个高频多音字词（银行/行走、重量/重复、长大/长度…），逐一核对；
3. 同音字重码率统计：全拼轨下"是/事/市/室"同码不可避免（这正是练习价值），但需统计**词级重码率**供 05 文档指标与 A1 方案对比使用；
4. 人工抽检流程验证：管线输出 5% 随机抽样人工核对的 SOP 与工时估算；
5. 发音资源核对：`usePronunciation.ts:21-22` youdao `&le=zh` 接口对多音字词返回的音频是否取词境音（如"银行"应读 yín háng）——若接口按首音返回，需评估 TTS 兜底（详见 A2 音频许可口径）。

### 验收标准

- [ ] 词级消歧准确率 ≥99.6%（对照权威注音抽样 ≥1000 词条）；
- [ ] 多音字专项集 200 条全对（错 1 条即分析根因：库能力 or 管线用法）；
- [ ] 405 音节回归测试 0 越界；
- [ ] 双拼码（小鹤）转换与 A1 映射表逐键一致（自动化断言）；
- [ ] 管线可重复执行（幂等）、有 CI 化的校验脚本雏形（length===条数、音节集合、去重——呼应 03 文档 R2/R7）；
- [ ] 发音接口对多音字的行为有明确结论（正确/错误+TTS 兜底方案）。

### 预估工作量

3-4 人日（管线搭建 1 天 + 基准集与比对 1-1.5 天 + 多音字专项与抽检 SOP 1 天 + 发音核对 0.5 天）。

### 阻塞哪些功能

- **M2 构建管线全部**；
- 所有对码轨语料（字/词/成语三级）的正式制作；
- A1 编码映射表的自动化验证（双拼转换断言依赖本管线）。

### 失败时的降级方案

1. **pinyin-pro 词级消歧不达标（<99.6%）**：叠加第二数据源交叉验证（如另一拼音库 + 开源词典 JSON 对照），分歧词条进入人工裁决队列；语料规模缩小到"分歧可全量人工核对"的量级（常用字 3500 + 高频词 1 万，人工核对成本约 2-3 人日/万条）。
2. **多音字专项仍有长尾错误**：为词典 JSON 增加可选 `pinyinOverride` 字段（M2 管线支持人工覆写），错误词条逐个钉死；同时打字页的发音播放该覆写音。
3. **发音接口取音错误且 TTS 不可接受**：中文条目发音降级为静音 + 展示 notation 拼音文本（视觉代偿），不阻塞打字练习本身。

---

## S5：编码方案配置格式设计（keyMap/zeroMap 借鉴）【P1】

### 目的

定型 M1 SchemeProvider 的配置格式：既要支撑首发的小鹤双拼，又要为未来方案（自然码、微软双拼、乃至形码/音形码）留扩展位。**合规约束（详见 A2）：只借鉴 {keyMap, zeroMap} 的结构设计思想，不复制任何开源方案的代码与数据文件，映射表内容依据公开的双拼方案规范自行录入。**

### 验证方法

1. 结构设计（POC TypeScript 类型 + JSON Schema）：
   ```ts
   interface SchemeConfig {
     id: string                    // 'xiaohe' | 'ziranma' | 'mspy' | ...
     name: string                  // 展示名
     type: 'full-pinyin' | 'double-pinyin'   // 未来扩展 'phonetic-shape' | 'shape'
     keyMap: Record<string, string[]>        // 物理键 → 可表达的韵母/声母集合
     zeroMap?: Record<string, string>        // 零声母键位映射（双拼特有：'a'→'aa' 类规则）
     specialRules?: {              // 特殊拼写规则槽位
       zeroInitial?: string        // 零声母处理策略
       vKey?: string               // ü 的键位表达
     }
     futureExtension?: unknown     // 音形码/形码预留槽（type 判别联合扩展）
   }
   ```
2. 用该格式**手工录入**小鹤双拼完整映射（对照公开方案规范），验证表达力：
   - 26 键全韵母/声母映射无遗漏；
   - 零声母音节（啊/哦/额/安/昂…）的键入规则可表达；
   - ü 键（小鹤为 v）可表达；
3. 再录入**自然码**做第二方案验证：同一格式能否无特判地承载两套方案（若出现 if-by-id 特判即格式设计失败，需迭代）；
4. 与 M2 管线联调：S4 的管线输出全拼码后，用本配置做全拼→双拼的运行时无关转换（构建期完成），验证 keyMap 反查（韵母→键位）无歧义；
5. 全拼方案自身也注册为 `type: 'full-pinyin'` 的 SchemeConfig（keyMap 为恒等映射），统一 M1 的接口面。

### 验收标准

- [ ] 小鹤 + 自然码两方案用**同一格式**完整表达，转换代码零方案特判；
- [ ] 与 S4 管线联调：2000 词样本全拼→小鹤双拼转换结果与 A1 映射表 100% 一致（自动化断言）；
- [ ] 零声母、ü、以及"双拼下仍全拼输入的兼容音节"（如 zh/ch/sh 的双击规则）三类边界有明确处理并有测试用例；
- [ ] JSON Schema 定稿并归档（作为 M1 的接口契约，A1 引用之）。

### 预估工作量

1-2 人日。

### 阻塞哪些功能

- M1 SchemeProvider 实现；
- 双拼（小鹤）词典的构建（S4 管线的输出目标格式）；
- A1 文档映射表的机读化（A1 的表要能直接生成本配置）。

### 失败时的降级方案

若双拼规则表达力不足（特殊规则塞不进声明式配置）：`specialRules` 升级为**受控转换函数注册表**（每个方案 id 注册一个 pure function，格式退化为"配置 + 少量代码"），首发仅小鹤一个双拼方案时此降级完全够用；未来方案增多再抽象。若时间不足：首发砍掉自然码验证，仅保证小鹤 + 全拼，格式中保留 type 判别联合与 futureExtension 槽即可。

---

## S6：compositionend 跨浏览器事件时序验证【P1，实战轨生死】

### 目的

ime 轨的架构铁律（team-lead 已拍板，见 03 文档 5.1/7.2）：**不依赖 input 事件的 isComposing 时序，只监听 compositionend 拿 `e.data` 作为上屏文本**。本 Spike 验证该策略在跨浏览器下的事件时序可靠性——这是上游从未处理过的领域（现有代码主动阻断 composition：`TextAreaHandler/index.tsx:48-50` 的 onCompositionStart→alert、`:23` 的 `!nativeEvent.isComposing` 丢弃）。

### 验证方法

1. POC 页面监听全事件族并打时间戳日志：`keydown / keyup / compositionstart / compositionupdate / compositionend / input / beforeinput`；
2. 实测场景矩阵（每场景记录完整事件序列）：
   - 正常拼音上屏（nihao → 你好）；
   - 上屏后立即继续输入下一词（连续上屏）；
   - 候选窗翻页（按 -/= 或数字键选词）后上屏；
   - **中途 Esc 取消** composition；
   - 直接上屏英文（IME 英文态敲字母）；
   - 中文标点上屏（，。！？——全角）；
   - 上屏过程中点击页面别处（blur，联动 `src/pages/Typing/index.tsx:65-74` 的暂停逻辑）；
   - 长句一次上屏 20+ 字；
3. 浏览器覆盖：Chrome / Edge / Safari / Firefox × Win 微软拼音 / macOS 系统拼音（与 S1 共用实测环境，可同批执行）；
4. 重点验证的时序假设：
   - compositionend 的 `e.data` 是否**总是等于最终上屏文本**（含候选词被输入法自动替换的情形，如"西安"被切成"先"）；
   - compositionend 与最后一次 input 事件的**先后顺序**（Chrome：input 在 compositionend 之前或同帧；Safari/Firefox 已知存在差异——必须以实测为准）；
   - keydown 在 composition 期间的 `key` 值（'Process' 还是实际字母，与 S1 结论互证）；
   - React 18 合成事件对 composition 事件的封装是否有丢帧（必要时用原生 addEventListener 兜底）；
5. 与现有代码冲突面确认：改造 `TextAreaHandler` 或新建 M5 时，`:23` 的 isComposing 丢弃与 `:48-50` 的 alert 阻断如何按 inputMode 分流（03 文档贯穿点 #10-#13）。

### 验收标准

- [ ] 8 个场景 × 主线路浏览器（Chrome/Win、Safari/macOS）事件序列全部记录归档；
- [ ] "compositionend.e.data === 最终上屏文本"在主线路**全部场景成立**（若 Safari 有已知差异，M5 需按浏览器分支处理并写明）；
- [ ] compositionend 与 input 的时序结论明确，M5 的状态机设计据此定稿（单事件源 or 双事件对账）；
- [ ] Esc 取消、blur 中断两个异常场景有明确的产品行为定义（清空当前输入段 or 保留）；
- [ ] 结论回写 03 文档 7.2 节（若与假设不符）。

### 预估工作量

2 人日（需真机：一台 Windows + 一台 macOS；事件日志自动化收集脚本 0.5 天 + 实测与归档 1 天 + 结论 0.5 天）。

### 阻塞哪些功能

- **M5 ImeCompositionHandler 全部实现**；
- **ime 轨（实战轨）全部功能**——句/诗/文三级语料；
- 03 文档 7.2 时序设计的最终确认。

### 失败时的降级方案

1. **Safari 时序异常且无法分支处理**：首发 ime 轨只承诺 Chrome/Edge（Chromium 系），Safari 用户引导使用对码轨（对码轨走 S1 的 password 方案，与 composition 无关）；词典选择页按浏览器能力标注推荐轨道。
2. **e.data 与实际输入框内容偶发不一致**：M5 采用"双源对账"——compositionend 的 e.data 与隐藏输入框（或受控 state）的实际文本做 diff，以输入框实测内容为准，e.data 仅作触发信号；性能开销可忽略。
3. **全浏览器 composition 都不可靠**（极端）：ime 轨降级为"整段粘贴式练习"——用户用系统任意位置输入后粘贴进练习框做 diff 校验，失去实时性但保留字级正误统计；同时把 ime 轨排期后置，资源集中对码轨。

---

## S7：IME 中英文态不可程序化切换的产品化处理【P2】

### 目的

Web 平台**没有 API** 可以读取或切换用户系统输入法的中英文状态（这是 Issue #744 "规避中英文切换问题"的本质，也是 ShanRenMa fork 用 type=password 硬绕开的原因）。两轨都会遇到状态错位：

- **对码轨**：用户 IME 处于中文态 → password 输入框虽强制英文，但部分输入法（尤其搜狗旧版）在密码框仍可能弹候选窗干扰；
- **ime 轨**：用户 IME 处于英文态 → 敲字母直接上屏 `jintian` 而非 `今天`，全部判错，体验灾难。

本 Spike 调研可行的**状态推断**手段与产品化提示设计。

### 验证方法

1. 状态推断手段实测（POC）：
   - keydown `e.key === 'Process'` 作为"IME 中文态激活"的信号（与 S1/S6 的事件日志互证），可靠性与误报率；
   - `e.isComposing` / compositionstart 触发作为中文态信号；
   - ime 轨下"上屏内容为纯拉丁且目标为汉字"的事后检测（03 文档 7.2 末段的旁路逻辑）；
2. 提示交互设计（与 04 文档 UX 规范对齐，非阻塞原则——**禁止 alert**，呼应 R3 技术债）：
   - 检测疑似英文态 → 打字区顶部常驻非阻塞 banner："检测到您可能处于英文输入状态，请切换至中文输入法（Shift）"；
   - 用户切回中文态（出现 composition 事件）→ banner 自动消失；
   - 连续 3 次纯拉丁误上屏 → 暂停计时并弹出 swal 确认（非阻塞、可点击关闭，沿用 fork 验证过的 sweetalert 模式）；
3. 首键启动逻辑适配验证：`src/pages/Typing/index.tsx:80-92` 的启动监听在 ime 轨需接受 'Process' 为合法启动键（03 文档 R5）；
4. 调研社区先例：TypeRacer 中文模式、金山打字通 Web 版、dazidian 等如何处理该问题（记录可借鉴的交互形态）。

### 验收标准

- [ ] 'Process' 信号在 Chrome/Edge/Safari + 微软拼音/搜狗/macOS 拼音下的可靠性结论（可用/误报率数据）；
- [ ] 三级提示策略（banner → 自动消失 → 暂停确认）交互稿定稿，交 04 文档收录；
- [ ] 全程零 alert()，零阻塞式原生弹窗；
- [ ] 对码轨下 password 输入框遇中文态候选窗干扰的实测结论（有/无，若有则同套 banner 复用）。

### 预估工作量

0.5 人日调研实测 + 交互设计（并入 04 文档工作量）。

### 阻塞哪些功能

- ime 轨的**体验完整性**（不阻塞功能上线——无提示也能跑通，只是错误率高）；
- 04 文档的中文练习 UX 规范章节。

### 失败时的降级方案

状态推断全部不可靠（'Process' 误报率高、composition 检测有盲区）→ 放弃自动检测，改为**固定引导**：进入 ime 轨词典时一次性展示"请确认已切换至中文输入法"的引导页（用户点击确认后开始），练习中不再检测；纯拉丁误上屏按正常错误处理但在结算页汇总提示"本章有 N 次疑似英文态输入"。此方案实现成本趋近于零。

---


## S8：零声母 α/β 口径冲突实测（C-4 收口）【P0，双拼实施前置】

### 目的

收口 A1 §3.2 / C-4 标记的**最重大信源冲突**：零声母双字母音节（爱/恩/欧/安/欸/熬）的第二键，存在两套互斥口径——

- **口径 α「双字母保留全拼」**：爱=`AI`、恩=`EN`、欧=`OU`、安=`AN`、欸=`EI`、熬=`AO`（S2 shuangpin.xyz + S3 ulpb + S4 小鹤官方 + S6 纸砚 **四信源一致**）；
- **口径 β「按韵母映射键」**：爱=`AD`（ai→D）、恩=`EF`（en→F）、欧=`OZ`（ou→Z）、安=`AJ`（an→J）、欸=`EW`（ei→W）、熬=`AC`（ao→C）（S1 Rime algebra 规则链**推导**所得，且我方仅拿到 rime-ice 的 `derive` 混输变体，未核对官方 `rime-double-pinyin` 的 `xform` 严格实现）。

A1 已给出产品决策：**「双口径兼容判定 + α 为主口径」**，但明确要求"实施前必须实测"（置信度 C 级禁止直接实施）。本 Spike 就是该实测，产出 `zeroMap` 多口径数组（A1 §6.2 要求 `zeroMap` 值必须为 `accepted: string[]`）的最终事实依据，并验证 S5 配置格式对多口径的承载能力。

> 注意：单字母（啊=`AA`）、三字母（昂=`AH`）、`er`（=`ER`）三口径一致，**不在本冲突范围**；本 Spike 只处理 6 个双字母音节。

### 验证方法

1. **构建实测用例矩阵**（6 音节 × 3 输入法环境，共 18 格；每格记录实际按键序列 + 是否上屏出目标字）：

   | 音节/字 | 环境①飞扬版小鹤（Win） | 环境②搜狗内置小鹤方案（Win/mac） | 环境③Rime **官方** `double_pinyin_flypy.schema.yaml`（非 rime-ice 变体） | α 预测 | β 预测 |
   |---|---|---|---|---|---|
   | ai 爱 | | | | AI | AD |
   | en 恩 | | | | EN | EF |
   | ou 欧 | | | | OU | OZ |
   | an 安 | | | | AN | AJ |
   | ei 欸 | | | | EI | EW |
   | ao 熬 | | | | AO | AC |

   - 环境③是关键：必须拉取 `rime/rime-double-pinyin` 官方仓库的 `double_pinyin_flypy.schema.yaml` 原文，确认零声母规则首条是 `xform`（强制变形→只认 β）还是 `derive`（额外派生→α/β 都收）。这一步可先做**静态文件核对**（不必装 Rime），若官方为 `xform/^([aoe])([ioun])$/$1$1$2/` 则官方严格实现=β，若已被社区普遍改为 `derive` 则混输环境两者皆可。
2. **Rime algebra 离线仿真**（无需真机即可先跑）：用脚本按 A1 §3.4 的规则链，对 6 个音节分别以 `xform` 和 `derive` 两种语义执行，验证 β 推导（爱→`aai`→`aⒹ`→`ad`）与 α 推导（爱→保留 `ai`）各自的输出，把"规则文本"转成"可复现的断言"。
3. **判定标准设计**（三选一决策树）：
   - 若 18 格中主流商业输入法（飞扬/搜狗）实测**全部落在 α** → 确认 α 为主口径，β 仅作 Rime 混输用户的兼容项，`zeroMap` 值为 `["AI","AD"]`（α 在前）；
   - 若某环境实测落在 β → 该环境用户按兼容口径判对，主口径仍为 α（不翻转，因四信源 + 商业输入法覆盖面更大）；
   - 若出现**第三种**未预测编码（如某输入法对 `eng` 用 `eg` 之外的键）→ 记为 A1 新待核对项，回写 A1 §3.2 表格。
4. **与 S5 联调**：把实测结论写进 S5 的 `SchemeConfig.zeroMap` 结构，验证 `accepted: string[]` + `primary` 标记（主口径）能无特判地承载"α 主、β 兼容"，并跑通"同一题两种输入都判对、但只有 α 计入主口径正确率"的判定逻辑（呼应 A1 §3.2 附加要求"统计需分离"）。
5. **探针字校准集固化**：把 A1 §3.5 的"位/卷/云/爱/昂"+ §4.2 探针字（女/绿/局/平）纳入 M1 的 `calibration` 字段，作为"5 分钟输入法校准"引导流程的数据源（A1 §6.2 原创增量）。

### 验收标准

- [ ] 18 格实测矩阵填满，每格有"实际按键 + 是否命中目标字"二元结论（真机不可得的环境以 Rime algebra 离线仿真 + 静态 schema 文件核对替代，并标注证据等级）；
- [ ] 官方 `rime-double-pinyin` 的 `double_pinyin_flypy.schema.yaml` 零声母规则首条为 `xform` 还是 `derive` 有**文件级证据**（commit hash + 原文行）；
- [ ] 主口径判定结论明确（预期 α），β 的兼容范围界定清楚（哪些环境需要兼容）；
- [ ] `zeroMap` 多口径数组结构在 S5 配置格式中跑通，"两种都判对、α 计主口径正确率"有可执行断言；
- [ ] 结论回写 A1 §3.2 与 C-4（把"待官方核对"状态改为"已实测收口"），并同步 05 文档的主口径正确率统计口径。

### 预估工作量

1.5-2 人日（Rime algebra 离线仿真 + 静态 schema 核对 0.5 天；真机/模拟器实测飞扬+搜狗 0.5-1 天；结论与 S5 联调 + 回写 A1/05 0.5 天）。**其中离线仿真部分不依赖真机，可与 S1/S6 的真机批次错峰先行。**

### 阻塞哪些功能

- **双拼（小鹤）对码轨的正式出题**——零声母字（爱/安/昂/欧/恩/啊/哦/饿/二 均为高频字）在口径未定前**不得进入出题池**（A1 C-1/C-4 明确的阻塞项）；
- M1 SchemeProvider 的 `zeroMap` 结构定稿（与 S5 强耦合）；
- 05 文档"双拼主口径正确率"指标的定义。
- **不阻塞全拼轨**（全拼无零声母补键问题，S4 管线即可覆盖）。

### 失败时的降级方案

1. **真机环境全部不可得**（借不到飞扬版小鹤/搜狗）：退化为**纯静态证据收口**——以"四信源一致支持 α"（S2/S3/S4/S6，其中 S4 为小鹤官方文档）作为 α 主口径的依据，Rime 官方 schema 文件核对确定 β 的兼容边界，跳过商业输入法真机实测。置信度标注为 B（无权威实现真机佐证），但因 α 有四信源 + 官方文档，风险可接受。
2. **实测发现 α/β 之外还有第三种编码**：`zeroMap` 的 `accepted` 数组本就是多值设计，直接扩容纳入第三口径，主口径仍取覆盖最广者；同时该音节临时移出出题池直到人工确认。
3. **口径冲突无法在首发前彻底收口**：启用 A1 §3.2 的过渡策略——**双口径全兼容判对**（α/β 都算对，不区分主口径），先保证零声母字可出题不判错；主口径分离统计作为 P1 增强项延后。此降级牺牲"个性化出题"的数据精度，但不牺牲正确性，可安全首发。

---

## S9：多合法编码（string[]）引擎改造成本评估【P1，成本决策】

### 目的

评估把校验目标从**单一字符串**改为**合法编码集合 `string[]`** 的引擎改造成本。触发场景：S4 的多音字管线在构建期**无法排除歧义**的字（如生僻多音字、S8 的零声母双口径字、A1 §5.3 提到的"27 处读音取舍差异"），其正确编码不是唯一串，而是一个集合——用户输入集合内任一编码都应判对。

现状是单一目标串比对，核心在 `Word/index.tsx`：

- 初始化 `displayWord = word.name`（:59, :67），`word.name` 为 `string`（`src/typings/index.ts:23`），且 **:59-62 对「name 是 string」有显式运行时断言**（try 包裹 `word.name.replace(...)`，catch 中 `console.error('word.name is not a string')` 且 headword 退化为空串）；
- 逐字符校验 `inputWord[len-1]` vs `displayWord[len-1]`（:180-181）；
- 完成判定 `inputLength >= displayWord.length`（:194）；
- 逐字符渲染 `displayWord.split('').map(<Letter>)`（:302-304）。

本 Spike **只做成本评估与方案设计，不实现**（产出改造点清单 + 人日估算 + 推荐数据结构），供 team-lead 决定是否纳入范围。

### 验证方法

1. **消费点全量盘点**（已初步 grep，需在 Spike 中确认每一处的改造性质）。`word.name` / `displayWord` 的下游消费点：

   | # | 位置 | 当前用法 | 多编码下的处理 | 改造性质 |
   |---|---|---|---|---|
   | 1 | `Word/index.tsx:59-62,67` | `displayWord = word.name`；**:59-62 对 name 有运行时类型断言**（try 包 `word.name.replace(...)`，catch 置 `console.error('word.name is not a string')` 且 headword 退化为空串） | 方案 A：零改动（name 保持主口径展示编码）；方案 B：**高危静默降级点**——数组型 name 在 `.replace` 抛 TypeError 走 catch，displayWord 变空串，无编译错误、无崩溃 | **高**（方案 B 下；有运行时类型断言、会走 catch 分支，非无害展示点） |
   | 2 | `Word/index.tsx:180-181` | 单串逐字符比对 | **核心改造**：改为"输入串是否为集合中某编码的前缀/全等" | 高 |
   | 3 | `Word/index.tsx:194` | `inputLength >= displayWord.length` 判完成 | 完成条件改为"匹配到集合中某完整编码" | 中 |
   | 4 | `Word/index.tsx:214,220-224` | letterStates/letterMistake 按 displayWord 索引 | 多编码长度可能不同，索引基准需锚定"展示编码" | 高 |
   | 5 | `Word/index.tsx:302-304` | `displayWord.split('')` 渲染 | 渲染仍用单一展示编码，不变 | 低 |
   | 6 | `Word/index.tsx:266` | `word: word.name` 落库 | 存展示编码 or 用户实际输入？需与 05 定口径 | 中 |
   | 7 | `WordList/WordCard.tsx:21,26`、`WordList/index.tsx:60` | `key={word.name}`、展示 name/notation | key 唯一性依赖 name，多编码需保证展示编码唯一 | 低 |
   | 8 | `ResultScreen/index.tsx:55`、`WordChip.tsx:16,31,33` | 展示 `word.name`、发音取 name | 展示编码，发音按展示编码取 | 低 |
   | 9 | `ErrorBook/hooks/useGetWord.ts:13`、`DropdownExport.tsx:62`、`Gallery-N/hooks/useErrorWords.ts:60` | `find(w => w.name === name)` 回查 | **回查键**：若落库存展示编码则回查仍成立；若存用户实际输入则回查断裂 | 高 |
   | 10 | `Analysis/hooks/useWordStats.ts:122`、`KeyboardWithBarCharts.tsx:67` | 按 name 聚合错键 | 聚合键需统一为展示编码 | 中 |
   | 11 | `PrevAndNextWord/index.tsx:30` | 展示 name/notation | 展示编码，不变 | 低 |
   | 12 | `WordPronunciationIcon/index.tsx:21` | 发音取 `word.name` | 展示编码 | 低 |
   | 13 | `useWordList.ts` / Dexie `word` 索引（`db/index.ts:30`） | name 作记录键 | 见下方"数据结构方案" | 中 |

2. **数据结构方案对比**（Spike 需给出推荐）：

   - **方案 A：`Word` 增可选 `acceptedCodes?: string[]`，`name` 保持主展示编码（string）**。校验层读 `acceptedCodes ?? [name]`。优点：`name` 仍是 string，**全部展示/回查/聚合消费点（#5,7,8,9,10,11,12）零改动**（它们只认 name=展示编码）；只有校验核心（#2,3,4）与落库口径（#6）需改。缺点：多编码信息不进 Dexie，历史记录无法还原"当时接受了哪些编码"。
   - **方案 B：`name` 直接改为 `string | string[]`**。改动面最大——13 个消费点全部要处理联合类型，TypeScript 编译期会强制暴露所有点，但工作量与回归风险最高。**不推荐**。
     **实证证据（team-lead 验码补充）**：`Word/index.tsx:59-62` 对 `name` 是 string 做了**显式运行时断言并留有 `console.error` 兜底**（try 包 `word.name.replace(...)`，catch 中 `headword = ''`）——说明「name 必须是 string」已是既有代码的硬假设，且历史上真的出现过非 string 的情况。方案 B 下若有任何一处遗漏改造，数组型 name 会在 `.replace` 处抛 TypeError 走 catch 分支，**displayWord 静默退化为空字符串**（表现为空词 + 一条 console 记录，不报编译错误、不崩溃），是最难排查的一类回归。这条证据把方案 A「改造面收敛到校验核心 3 点（#2,3,4）+ 落库口径 1 点（#6），其余各点零改动」的结论**从推断升为实证**。
   - **方案 C：新增独立 `codes` 结构 + `name` 保留**（方案 A 的增强，把主口径/兼容口径分离，呼应 S8 的 `zeroMap` primary/accepted）。推荐作为 A 的演进目标。

   **初步结论：推荐方案 A（可平滑演进到 C）**——它把改造面收敛到校验核心 3 点 + 落库口径 1 点，展示层与回查层因 `name` 仍是 string 而完全隔离，与 03 文档"inputMode 缺省即默认、旧词典零感知"的兼容哲学一致（`acceptedCodes` 缺省则退化为单编码，现有 380 词典与英文轨零改动）。

3. **校验算法设计**（#2 核心）：多编码下逐字符校验从"比对唯一正确字符"变为"比对当前输入前缀是否仍是集合中某编码的合法前缀"：
   - 维护 `acceptedCodes` 的**前缀 trie**（构建期生成，运行期 O(1) 查）；
   - 每输入一字符，检查 `inputWord` 是否仍为某编码前缀：是→该位 correct；否→wrong；
   - 完成条件：`inputWord` 全等于集合中某编码；
   - letterStates 索引锚定"展示编码"（主口径），兼容口径命中时该位仍标 correct（视觉以展示编码为准）。
   - 与 03 文档 7.1/7.2 时序的衔接：code-match 轨走前缀 trie，ime 轨的整串上屏比对同样可用集合（多编码整串全等判定）。
   - **`primary` 语义裁定（team-lead 已确认，供 05 主口径正确率使用）**：`acceptedCodes[0]` 恒为主口径（S8 决策树中 α 在前）；**主口径正确率只用 `acceptedCodes[0]` 计算；兼容口径命中记为 correct 但不计入主口径分子，单独落 `altCodeHit` 计数**。这样既保证 Rime 混输用户不被判错，又不污染主口径指标。落库方式：Dexie `word` 字段恒存展示编码（= `acceptedCodes[0]`），用户实际输入存 `inputCode` 可选字段（已并入 03 §8.2 v4 schema 第 6 条）。

4. **人日估算**（分方案 A）：
   - 校验核心改造（#2,3,4 前缀 trie + letterStates 锚定）：1.5 人日；
   - 落库口径与回查（#6,9 确认展示编码为键，补 05 口径）：0.5 人日；
   - 聚合/展示回归测试（#7,8,10,11,12 验证零改动确实成立）：0.5 人日；
   - 构建期 trie 生成 + 单测（多编码字用例集，含 S8 零声母、S4 多音字长尾）：1 人日；
   - **合计约 3.5 人日**（方案 A）。方案 B 估算 8-10 人日（13 点全改 + 联合类型回归），方案 C 在 A 基础上 +1 人日。

### 验收标准

- [ ] 13 个消费点改造性质逐一确认（上表"改造性质"列由 Spike 实测校准，标注实际行数）；
- [ ] 数据结构方案定稿（预期方案 A），给出 `Word` 类型扩展的确切定义与 `acceptedCodes` 缺省语义；
- [ ] 校验算法（前缀 trie）设计文档化，明确 letterStates 索引锚定规则与兼容口径命中的视觉表现；
- [ ] 人日估算落到 ±0.5 人日精度，明确是否纳入首发范围（team-lead 决策输入）；
- [ ] 确认方案 A 下英文轨/现有 380 词典**零改动零回归**（`acceptedCodes` 缺省即单编码）；
- [ ] `acceptedCodes[0]` 恒主口径 + `altCodeHit` 单独计数的裁定落地验证（指标口径详见 05，落库详见 03 §8.2 第 6 条）。

### 预估工作量

**本 Spike 自身**：1 人日（消费点盘点 + 方案设计 + 估算，不写实现代码）。
**若决定实施**：方案 A 约 3.5 人日（见上）。

### 阻塞哪些功能

- **不阻塞首发 MVP**——S8 的降级方案 3（双口径全兼容判对）已能用"单展示编码 + 兼容串判对"覆盖零声母；S4 多音字长尾（27 处读音取舍）可先用 `pinyinOverride`（S4 降级方案 2）钉死单编码绕过。
- 多合法编码是**质量增强项**：阻塞"生僻多音字/多口径字进入出题池且不判错"的完整体验，阻塞 A1 §5.3 第 4 层"零声母双口径兼容测试"的引擎侧支撑。
- **统一收口裁定（team-lead 已确认，按此表述执行）**：统一的是**运行期校验接口**，不是取消构建期的三种处理逻辑。三者本质不同——`pinyinOverride`（S4）= 构建期的**多音字读音消歧**（输入「词 + 语境」，输出「选定一个读音」）；`zeroMap` 多口径（S5/S8）= 构建期的**方案层零声母规则**（输入「音节」，输出「α/β 两种键位表达」）；`acceptedCodes`（S9）= 运行期的**合法编码集合校验**。正确表述：**构建期的三种不确定性（多音字读音、零声母 α/β 口径、方案歧义）在构建管线末端统一收敛为「该词条的合法编码集合」，运行期只暴露一个接口 `acceptedCodes: string[]`；构建期三套逻辑保留、不合并。**这样 `pinyinOverride` 不会被误删，且运行期引擎只有一种校验语义（前缀 trie / 线性 `some(startsWith)`），符合本 Spike「集合 ≤3 项、编码长度 ≤6」的性能判断。已同步写入 03 §6.2（M2 与 M6 的多编码收敛契约）。

### 失败时的降级方案

1. **方案 A 校验核心改造超预算**：首发**不做多编码引擎**，改用 S4 的 `pinyinOverride` + S8 降级方案 3（构建期为每个多口径字**预选单一主口径编码**写入 name，兼容口径暂不判对）。代价：Rime 混输用户打 β 编码会被判错，但 α 主口径用户（商业输入法，覆盖面最大）不受影响。多编码引擎延后到 P1。
2. **前缀 trie 与现有 immer/letterStates 结构冲突过大**：退化为"运行期对 `acceptedCodes` 数组做 `some(code => code.startsWith(inputWord))` 线性扫描"——编码集合通常 ≤3 项、编码长度 ≤6，线性扫描性能完全可接受（无需 trie），实现更简单，作为方案 A 的简化实现。
3. **回查/聚合口径无法统一**（#9 落库存用户实际输入导致回查断裂）：强制约定 Dexie `word` 字段**永远存展示编码（主口径 name）**，用户实际输入的兼容编码存入 `mistakes` 或新增 `inputCode` 可选字段，回查键与聚合键恒为 name，从根上隔离该风险（并入 03 文档 8.2 的 v4 schema 设计）。

---

## 附录 A：PR #348「加个中文拼音打字」失败复盘

> 上游 PR：RealKai42/qwerty-learner #348，2023 年提交，最终被 stale-bot 自动关闭，**零人工 review**。

### A.1 该 PR 的方案概要

- 目标：在 qwerty-learner 中加入中文拼音打字练习；
- 实现路径：依赖 **AutoHotkey 脚本**（Windows 专属自动化工具）辅助完成输入法状态控制与按键映射；
- 补丁基于当时的代码结构，与当前 master 的 `WordPanel/InputHandler` 体系已不兼容（无法直接 cherry-pick）。

### A.2 失败根因分析

| # | 根因 | 对本项目的教训 |
|---|---|---|
| 1 | **致命缺陷：AutoHotkey 依赖**。要求用户安装 Windows 专属第三方自动化软件，违背 Web 应用"开箱即用"底线；且 AHK 脚本涉及系统级按键钩子，安全软件普遍拦截 | 任何需要用户离开浏览器安装东西的方案直接否决。S1 验证的 password 方案是纯 Web 手段，这是本质差异 |
| 2 | **零人工 review，死于 stale-bot**。维护者未评估即超时关闭 | 说明上游对中文打字方向无既定路线，本 fork 自主推进无上游冲突风险；也提示我们的 PR 拆分要小而完整 |
| 3 | 补丁与主干演进脱节，无法 rebase | 本项目 03 文档的贯穿点清单（39 处）即为此设计：改动面显式登记，与上游同步时可逐点核对（基线已同步至 PR #1111） |

### A.3 可回收的价值

- 该 PR 讨论区（如有）对"输入法状态检测"的社区反馈可作为 S7 调研输入；
- 其"拼音码作为练习目标"的思路方向与对码轨一致，验证了需求真实性；
- 反面教材价值最大：**证明了绕开 Web 平台能力的方案走不通**，反衬 ShanRenMa fork 的 type=password 纯 Web 方案（S1）与 compositionend 方案（S6）是唯一两条可行路径。

---

## 附录 B：Spike 产出物归档约定

- 所有 POC 代码放 `spike/` 独立分支或仓库外沙箱目录，**不合入 master、不修改 src/**（与本项目探查任务的只读约束一致）；
- 兼容矩阵、事件序列日志等实测数据以 markdown 表格/附件形式归档至 `md/spec/appendix/`（如需），并在对应 Spike 章节留链接；
- 每个 Spike 完成后：结论回写本文件对应小节（新增"实测结论"子标题），重大偏差同步回写 03 文档相应章节并通知 team-lead。
