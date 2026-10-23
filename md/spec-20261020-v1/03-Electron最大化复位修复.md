# 03 · Electron 最大化复位修复

**日期**：2026-10-20
**负责成员**：析客
**文档性质**：需求定义（缺陷修复），不含代码实现。
**对应需求**：批次需求 3（`00-README.md` §二 #3）。

---

## 一、背景与目标

**现象**：Electron 打包的 exe（`yarn dist:electron` 产物）中，点击最大化（或还原）后，页面被重置——整页导航回 `/`，直接停在学习模式初始页；正在进行的打字练习、路由位置全部丢失。

**根因（已定位，代码级）**：`src/index.tsx` 的 `handleResize`：

```js
const handleResize = () => {
  const isMobile = window.innerWidth <= 600
  if (!isMobile) {
    window.location.href = '/'   // ← 缺陷行
  }
  setIsMobile(isMobile)
}
window.addEventListener('resize', handleResize)
```

- 逻辑本意是「移动页 / 桌面态互切时做一次落地」；但写成「**桌面态下任何 resize 都硬跳转 `/`**」。
- 最大化 / 还原 / 拖动边缘缩放都会触发 `resize` → 桌面态 → `window.location.href = '/'` → **整页导航**（不是 SPA 路由跳转，是完整 reload）→ Root 重挂载 → 路由落到 `/` = 学习模式首页。
- 该代码来自上游仓库（commit `895f18b5` "feat: polish detail"，2024-09， Kai 作者；本仓库 origin/master 与上游 `RealKai42/qwerty-learner` 均含此代码），属于**上游遗留缺陷**，在浏览器里同样存在（只是浏览器用户较少在会话中 resize，暴露不明显）；Electron 下最大化是高频操作，因此必现。
- 已排除的其他怀疑对象：`electron/main.cjs` 的 `window:maximized-changed` IPC 只发状态给自绘标题栏（`DesktopTitlebar`），无 reload 行为；`app://` 协议处理器无重定向逻辑；`hasRestoredMode` 一次性模式恢复只在首挂载执行，均非根因。

**成功标准**：Electron 下最大化 / 还原 / 任意窗口缩放**不再**触发整页导航，路由与练习状态保持；移动端（≤600px）与桌面态的原有互切行为不变。

## 二、功能需求

### REQ-301 修复根因

- 删除 `src/index.tsx` `handleResize` 中的 `window.location.href = '/'` 硬跳转，仅保留 `setIsMobile(isMobile)`。
- 移动端 ↔ 桌面态互改由**既有路由层**接管：`isMobile` 翻转时 `Routes` 重渲染——`isMobile=true` 时 `/*` → `<Navigate to="/mobile" />`；`isMobile=false` 时 `/mobile` 命中 `/*` → `<Navigate to="/" />`。两者都是**客户端导航**，不整页 reload，行为与改版前对用户可见效果一致（阈值穿越才跳转，且不丢 SPA 状态以外的语义）。

### REQ-302 验收环境

- 主验：Electron 打包产物（`yarn build` → `yarn dist:electron` 的 exe，或 `yarn electron` 直接跑构建产物）。
- 辅验：桌面浏览器（dev server 与构建产物均可）。

### REQ-303 验收场景

| # | 场景 | 期望 |
| --- | --- | --- |
| 1 | Electron：在 `/typing` 练习中点击最大化 | 停在 `/typing`，练习状态、计时不重置；**不**发生整页刷新 |
| 2 | Electron：最大化后点还原 | 同上 |
| 3 | Electron：拖动窗口边缘缩放（跨 600px 阈值来回） | ≤600px 进 `/mobile`；>600px 回 `/`（客户端导航）；不整页刷新 |
| 4 | Electron：停在 `/typing/gallery`、`/typing/game`、`/analysis` 等页面时最大化 | 路由保持 |
| 5 | 浏览器：会话中拖动缩放窗口 | 不再被弹回 `/`（顺带修复的上游缺陷） |
| 6 | 浏览器：缩到 ≤600px | 进 `/mobile`；放大回桌面 | 回 `/`（与现状一致） |
| 7 | 刷新页面后的模式恢复（`hasRestoredMode`，ENTRY2-09-1） | 不受影响：上次在打字模式 → 刷新后仍落 `/typing` |

### REQ-304 回归清单

- `index.html` 的 dark mode init、`src/index.tsx` 的 mixpanel / Analytics 初始化、路由表（含 `/typing`、`/typing/gallery`、`/typing/game`、`/typing/game/:gameId`）不受影响。
- 移动端页面（`pages/Mobile`）行为不变。
- 本修复**不触碰**学习模式页面组件（`pages/Typing/**` 一行不改，REG-15）；`src/index.tsx` 是应用根文件，非学习模式页面，修改仅限删除缺陷行（净 -2 行量级）。

## 三、数据与接口

无新增数据结构、无接口变更。纯缺陷修复（删除两行）。

## 四、验收标准

1. 复现路径（Electron exe 最大化）不再复位；场景 1–4 全过。
2. 场景 3 / 6：600px 阈值行为与修复前一致（进 /mobile、回 /）。
3. 场景 5：浏览器 resize 不再跳首页。
4. 场景 7：刷新后模式恢复正常。
5. 全量回归：学习模式、打字模式（对码轨 + 上屏轨）、游戏中心入口链路正常。

## 五、与既有 Spec 的关系

- 无基线相关条目（缺陷修复，基线未定义 resize 行为）；根因代码属上游遗留，特此记录出处（commit `895f18b5`）。
- 与 `spec-20261017-v2/01` 的 ENTRY2-09-1（模式恢复）有交互但无冲突：修复后模式恢复链路更稳（不再被 resize 打断）。
