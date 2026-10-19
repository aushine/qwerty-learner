<div align=center>
<img  src="src/assets/logo.svg"/>
</div>

<h1 align="center">
  Qwerty Learner · 双模式版
</h1>

<p align="center">
  <b>学习模式</b> 背单词 · <b>打字模式</b> 练输入法 —— 一个键盘，两种练法
</p>

<p align="center">
  <a href="./docs/README_EN.md">English</a>
  <a href="./docs/README_JP.md">日本語</a>
</p>

<p align="center">
  <a href="https://github.com/aushine/qwerty-learner/blob/master/LICENSE"><img src="https://img.shields.io/github/license/aushine/qwerty-learner" alt="License"></a>
  <a><img src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg"/></a>
  <a><img src="https://img.shields.io/badge/Powered%20by-React-blue"/></a>
  <a><img src="https://img.shields.io/badge/Star%20Up-Upstream%20Project-orange"/></a>
</p>

> 本项目 fork 自 [RealKai42/qwerty-learner](https://github.com/RealKai42/qwerty-learner)（GPL-3.0）。
> 在完整保留原「学习模式」的前提下，新增了一套**独立的打字练习模式**：中文全拼 / 小鹤双拼对码训练、
> 打字测速、拼音与汉字逐字对齐的题面、常驻键位键盘。两个模式共用统计与错题本，互不干扰。

---

## 📖 这是什么

原版 Qwerty Learner 解决的是「**背英语单词 + 练英语键入肌肉记忆**」。
这个 fork 在此基础上补上了另一端：**中文用户的输入法输出速度**。

我们每天要打的中文比英文多得多，但几乎没有人系统练过输入法：
全拼打不快、双拼记不住键位、换了个方案就得从头适应。
因此本版把「打字训练」做成了一等公民，而不是原版练习页的一个附属功能：

| | 学习模式（原版） | 打字模式（新增） |
| --- | --- | --- |
| 入口 | `/` | `/typing` · 素材选择 `/typing/gallery` |
| 练什么 | 英语单词 + 释义，练拼写记忆 | 中文全拼 / 小鹤双拼 / 英语长文，练输入法 |
| 判定单位 | 单个单词 | 对码轨：每个**字**的编码；测速轨：每个**字符** |
| 题面 | 单词 + 音标 + 释义 | **拼音行 / 汉字行逐字对齐**，或整段文章 |
| 键盘提示 | 无 | 常驻 QWERTY，小鹤三区标注 + 当前键高亮 |
| 出错策略 | 整词重打 | 对码轨整题回滚；测速轨只标红不回滚 |
| 统计口径 | WPM / 正确率 | 中文「字/分」，英语 WPM |

---

## 🚀 快速开始

```bash
git clone https://github.com/aushine/qwerty-learner.git
cd qwerty-learner
yarn install
yarn start          # http://localhost:5173/
```

- Node 18+ / Yarn 1 即可，无需额外配置。
- 开发服务器默认监听所有网卡（`server.host = true`），局域网可用 `http://<你的IP>:5173/` 访问。
- Windows 用户也可直接运行 `scripts/install.ps1`，macOS 运行 `scripts/install.sh` 一键安装并启动。

### 两个入口

| 地址 | 说明 |
| --- | --- |
| `/` | **学习模式**（原版功能，行为与上游一致） |
| `/typing` | **打字模式**练习页 |
| `/typing/gallery` | 打字模式素材选择页 |

模式切换在页头标题处：**鼠标悬停标题块 / 点击标题右侧箭头**即可展开模式浮层。
当前选择的模式会记在浏览器里，下次打开自动落地到该模式。

---

## ⌨️ 打字模式详解

### 三种输入方式

素材页第 ② 级提供三个互斥选项：

| 选项 | 内部轨道 | 说明 |
| --- | --- | --- |
| **全拼** | `code` | 按拼音字母逐个输入，练最通用的输入法 |
| **双拼** → 小鹤双拼 | `code` | 每字两键，键面标注声母 / 韵母；微软双拼、自然码、搜狗双拼显示为「敬请期待」 |
| **打字测速** | `ime` | 走你自己的输入法，直接对着文本上屏，只测真实打字速度 |

### 题面：拼音行 / 汉字行逐字对齐

中文题面按「一行拼音、一行汉字」交替排版，两行共用同一份网格列模板，因此**每个汉字正好落在它的编码正下方**：

```
jing ye si   li bai
 静   夜  思  李  白
```

- 某个字的编码全部打对后，**拼音与汉字同时转绿**；
- 正在输入的字，上下两行同时带底色高亮；
- 标点与空格极度淡化：显示出来帮你定位，但**不需要输入**；
- 分组按累积编码宽度切分，长句不会把拼音行撑出容器；`\n` 强制断组。

### 键盘：常驻显示，不靠猜

- 完整 QWERTY 布局（数字行 / 字母三行 / 空格行），键高随题面行数自动分三档压缩，**单屏不滚动**；
- 小鹤双拼下每键标注三区：左上角声母、中间主字母、下方韵母（长韵母如 `iang/uang` 自动缩字或拆行）；
- 待按键为实心高亮 + 底部标记条，不只靠颜色区分；
- 按错抖动变红；卡住 3 秒（或 `Ctrl+J`）自动闪烁提示当前键；
- 可点击键帽输入；可一键折叠（状态会记住）。

### 两种轨道，两套判定

| | 对码轨（全拼 / 双拼） | 上屏轨（打字测速） |
| --- | --- | --- |
| 输入绕过输入法 | 是（隐藏 `password` 输入框强制关 IME，只读 `e.code`） | 否，走你的中文输入法 |
| 判定单位 | 每个字的编码片段 | 每个字符 |
| 打错时 | 整题 300ms 后回滚清空，重打一遍 | 错字标红、**不回滚**，游标继续前进 |
| 一次上屏多字 | 不涉及 | 逐字全部校验，不会只校验最后一个字 |
| 标点 | 显示但不输入 | 必须输入全角标点；半角会单独提示「标点格式错误」 |
| 速度指标 | 已完成的汉字数 / 时间 | 上屏正确字数 / 时间（从**第一个按键**开始计时） |

### 快捷键

| 按键 | 作用 |
| --- | --- |
| 任意字母键 | 开始 / 继续练习 |
| `Tab` | 显示 / 隐藏汉字行（或点页头的语言图标） |
| `Ctrl + J` | 重放当前键提示 |
| `Ctrl + Shift + ← / →` | 上一题 / 下一题 |
| 素材页 `Enter` / `Esc` | 返回练习页（焦点在卡片等控件上时交给控件自己处理） |

### 素材

中文素材按 `全拼 / 小鹤双拼` 两套编码各生成一份 JSON，共 18 个文件；英语素材与方案无关。

**中文 · 输入法练习**

| 素材 | 全拼 | 小鹤双拼 | 章节 |
| --- | :-: | :-: | --- |
| 常用 500 字 | ✅ | ✅ | 10 字 / 章 |
| 常用 3500 字 | ✅ | ✅ | 10 字 / 章 |
| 常用 1000 词 | ✅ | ✅ | 10 词 / 章 |
| 成语 500 | — | ✅ | 8 条 / 章 |
| 短句 200 | — | ✅ | 8 句 / 章 |
| 医学常用词 | ✅ | ✅ | 10 词 / 章 |
| 计算机常用词 | ✅ | ✅ | 10 词 / 章 |
| 古诗文短篇 | ✅ | ✅ | 1 篇 / 段 |
| 轻松短文 | ✅ | ✅ | 1 篇 / 段 |
| 白话短文 10 篇 | ✅ | ✅ | 1 篇 / 段 |

**英语 · 文章练习**：English Paragraphs（段落）/ English Essays（文章）/ English Classics（培根、爱默生、梭罗等公版原文）。

素材页的选择全部反映在 URL 参数上（`?tab=&scheme=&track=&material=`），可直接分享或收藏某个练习组合；非法参数会被忽略并回落默认值。

### 数据与隐私

- 练习记录沿用本地 IndexedDB（`wordRecords` / `chapterRecords`，**无 schema 变更**），`dict` 字段直接写素材 id（如 `zh-flypy-zi-500`）；
- 打字模式的章节、素材、方案、键盘折叠等状态全部走独立 atom 与独立 localStorage key，**不写学习模式的状态**；
- 统计页会识别打字模式的素材 id 并单独归类展示；错题本同样可用。

---

## ✨ 学习模式（继承自上游）

完整保留原版能力，未做行为改动：

- **词库**：CET-4/6、GMAT、GRE、IELTS、SAT、TOEFL、考研、专四专八，程序员常用词与多种语言 API 等 380+ 词库；
- **音标与发音**：背单词同时记忆读音；
- **默写模式**：完成一章后可选择默写巩固；
- **速度与正确率**：把技能提升量化成可见的数字；
- **错题本、统计图表、深色模式、音效、主题定制**。

> 设计理念仍是「输错就重打整个单词」，避免形成错误的肌肉记忆。

---

## 🧱 技术栈

| 关注点 | 选型 |
| --- | --- |
| 框架 | React 18 + TypeScript + Vite 4 |
| 状态 | jotai（全局 atom）+ use-immer reducer（练习页局部状态） |
| 样式 | Tailwind CSS 3 + shadcn/ui 风格组件（Radix UI） |
| 交互浮层 | @floating-ui/react + Headless UI |
| 本地数据 | Dexie（IndexedDB） |
| 图表 / 导出 | ECharts / xlsx |
| 词库构建 | tsx + pinyin-pro（**仅构建期**，运行时不加载拼音库） |

### 目录结构（与打字模式相关的部分）

```
scripts/
  build-typing-dicts.ts      # 语料 → 编码 → 词库 JSON（全拼 + 小鹤双拼）
  schemes/flypy.ts           # 小鹤双拼编码规则
  probe-*.cjs                # Playwright 验收探针（键盘 / 深色 / 性能 / 学习模式回归）
src/
  corpus/                    # 打字模式语料原文（zh/ en/）
  pages/TypingLearner/       # 打字模式：index.tsx + Gallery + components
  resources/typingMaterials.ts   # 素材注册表
  resources/flypyKeyLabels.ts    # 小鹤键位标注（唯一真源）
  store/typingMode.ts        # 打字模式状态原子（持久化 + 协调）
  typings/typing.ts          # 打字模式独立类型线
public/dicts/zh|en/          # 生成的打字模式词库
```

---

## 🛠 常用命令

| 命令 | 说明 |
| --- | --- |
| `yarn start` | 启动开发服务器（:5173） |
| `yarn build` | 构建到 `build/` |
| `yarn lint` | ESLint 检查 |
| `yarn prettier` | 全量格式化 |
| `yarn build:typing-dicts` | 由语料重新生成打字模式词库 |
| `yarn build:typing-dicts --verify` | 抽检生成结果里的字编码 |
| `yarn test:e2e` | Playwright 端到端测试 |

修改语料后请务必执行 `yarn build:typing-dicts` 并提交生成的 `public/dicts/zh|en/*.json`——
运行时不做拼音推导，词库里 `name` 字段就是烘好的编码串。

---

## 🤝 贡献

- 打字模式相关改动请**不要修改学习模式已有组件的行为**（两条线共用底层 reducer 与统计口径，但页面与状态各自独立）；
- 新增素材：在 `src/corpus/` 放语料 → 在 `scripts/build-typing-dicts.ts` 的 `MATERIALS` 注册 → 在 `src/resources/typingMaterials.ts` 加一张卡片 → 重跑构建脚本；
- 新增双拼方案：实现 `scripts/schemes/` 下的编码器，并在 `TYPING_SCHEME_OPTIONS` 中把对应项置为 `available: true`；
- 原版词库贡献方式仍见 [导入词典](./docs/toBuildDict.md)。

---

## 🏆 上游荣誉

以下为上游 Qwerty Learner 获得的认可，与本源保持一致：

- GitHub 全球趋势榜上榜项目
- V2EX 全站热搜项目
- Gitee 全站推荐项目 / Gitee 最有价值开源项目（GVP）
- [少数派首页推荐](https://sspai.com/post/67535)
- GitCode 开源摘星计划-毕业项目（[G-Star 计划](https://gitcode.com/g-star)）

---

## 📕 学习模式词库列表

- CET-4 / CET-6 / GMAT / GRE / IELTS / SAT / TOEFL
- 考研英语 / 专业四级 / 专业八级 / 高考 / 中考 / 商务英语 / BEC
- 人教版英语 3-9 年级
- Coder Dict 程序员常用词
- 王陆雅思王听力语料库 [@Saigyouji_WKKun](https://github.com/ggehuliang)
- 日语常见词、N1 ～ N5 [@xiaojia](https://github.com/wetery)
- 哈萨克语基础 3000 词（哈拼版）来源于 [@Elgar](https://github.com/Elgar17)，由 [@Herbert He](https://github.com/HerbertHe) 通过 [哈拼](https://ha-pin.js.org) 支持

## 📗 API 词库

- JavaScript API [@sdu-gyf](https://github.com/sdu-gyf)
- Node.js API [@chrysalis1215](https://github.com/chrysalis1215)
- Java API [@darkSheep](https://github.com/darkSheep404)
- Linux Command [@归谜](https://github.com/vhxubo)
- C# List API [@nidbCN](https://github.com/nidbCN)

---

## 📜 来源与致谢

本项目站在很多人的肩膀上：

- **上游项目**：[Qwerty Learner](https://github.com/RealKai42/qwerty-learner)，感谢原作者 Kaiyi 与全部贡献者；
- **产品灵感**：[Keybr](https://www.keybr.com/)（按正确率与速度生成训练内容）、[Typing Academy](https://www.typing.academy)（速度 / 正确率的展示）、[react-code-game](https://github.com/webzhd/react-code-game)（API 词库的想法）；
- **学习模式词库数据**：[kajweb/dict](https://github.com/kajweb/dict)；
- **发音数据**：[有道词典](https://www.youdao.com/)开放 API；
- **打字模式中文语料**：字表取自《通用规范汉字表》（2013，国务院发布）；词组参考 CC-CEDICT（CC BY-SA 4.0）并人工审校多音字；成语、短句与专业术语为本项目自撰；古诗文与英文经典为公有领域作品。

原始项目的架构与设计，以及全部上游贡献者，见 [上游 Contributors](https://github.com/RealKai42/qwerty-learner/graphs/contributors)。

## LICENSE

[GPL-3.0](./LICENSE)。作为衍生作品，本仓库同样以 GPL-3.0 发布。
