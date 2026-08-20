# long-play 音乐播放器技术调研总报告

> 调研日期：2026-08-19
> 产品定位：**只支持整张专辑顺序播放**的音乐播放器，界面风格对标 Apple Music（简洁、沉浸）。
> 技术栈：SvelteKit（web，部署 Cloudflare）+ Elysia（server，Node 运行时）+ Electrobun（desktop，CEF 渲染）。
>
> 本报告是四份子报告的综合版，详细来源与逐条证据见：
>
> - [Part 1 · 免费音乐 API 来源](./research-part-1-music-apis.md)
> - [Part 2 · 音频播放实现（浏览器 + Elysia + Svelte 5）](./research-part-2-player-impl.md)
> - [Part 3 · Apple Music 风格 UI/UX 与交互](./research-part-3-ui-ux.md)
> - [Part 4 · Electrobun 桌面打包可行性](./research-part-4-electrobun.md)
>
> 各子报告均区分「已验证事实（附来源 URL）」与「推断/建议」；本总报告沿用相同约定。

---

## 0. 执行摘要（TL;DR）

| 问题                    | 结论                                                                                                                                                                                                                                          |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 免费音乐 API 用什么？   | **Jamendo（CC 授权、原生专辑模型）+ Internet Archive（无 Key、CORS/Range 全开、item=专辑）** 双主源；SoundHelix 17 首占位曲目供开发期联调；FMA/Musopen/Pixabay/ccMixter 已排除（详见 Part 1）                                                 |
| 播放器怎么实现？        | **HTMLAudioElement 为主** + 双元素预载实现专辑内连播（`ended` 事件推进）；**Elysia Node 服务器做 Range 代理**统一拉流（自带 206/Content-Range 透传）；Media Session API 接入系统媒体键；Svelte 5 runes 单例 store 承载播放状态（详见 Part 2） |
| UI/UX 怎么做？          | 桌面三区骨架（sidebar + 内容区 + 底部迷你条）+ 移动端附底 tab bar 的全屏 Now Playing；**"专辑即队列"** 是产品交互内核；封面取色 + blur 材质营造 Apple Music 质感（详见 Part 3）                                                               |
| Electrobun 能不能打包？ | **能**，仓库脚手架已就绪约 80%。最高风险点是 **Media Session 的 OS 级集成需真机验证**（官方 API 无原生媒体键桥），以及必须把 `exitOnLastWindowClosed` 改为 `false` 支持关窗后台播放（详见 Part 4）                                            |

---

## 1. 免费音乐 API：怎么拿到"整张专辑"的合法音频

### 1.1 推荐：两主源并行

**Jamendo（质量优先）——唯一"专辑概念"原生的免费合法来源**

- API v3 数据模型原生支持 `albums` + `tracks` + 封面 + 每曲独立流地址：`https://api.jamendo.com/v3.0/albums/tracks/?id[]={id}` 一次返回完整曲目列表 [文档](https://developer.jamendo.com/v3.0/albums/tracks)。
- 全部曲目带 `license_ccurl`（CC 授权体系，逐曲目不同）。
- 实测：API 域带 CORS；音频流（`prod-x.storage.jamendo.com/?trackid=...&format=mp31`，mp31≈128kbps / mp32≈320kbps）**支持 Range（206）**，但**存储域无 CORS 头**——普通 `<audio>` 播放和 seek 不受影响，但 Web Audio 频谱分析等需要读样本的场景必须走服务器代理。
- 免费档仅限非商用：每月 35,000 次 API 请求，需注册 `client_id`。

**Internet Archive（体量与开放度优先）——无 Key、CORS + Range 全开**

- Advanced Search + Item Metadata 均无鉴权：[advancedsearch](https://archive.org/advancedsearch.php)、[metadata API](https://archive.org/developers/metadata.html)。
- 实测媒体 URL（`/download/{identifier}/{file}`）：302 重定向后返回 **206 + Content-Range + `Access-Control-Allow-Origin: *`**——浏览器直接播放、seek、Web Audio 全通。
- 数据模型天然匹配产品：**item = 专辑、files = 曲目列表**（文件级带 `title`（曲名）与 `length`（时长））。
- 法律干净的存量切片：
  - **78rpm / Great 78 公有领域老唱片**（约 30.9 万项）——1929 年前录音，美国公有领域；
  - **etree 授权现场录音**（约 30.3 万项，stream-only）——乐队授权的非商用现场；
  - **FMA 镜像 CC 专辑**（约 1.7 万项）。
- 风险：未经授权的翻录混在其中，**必须按 collection / licenseurl 白名单筛选**，不能全量入库；且 78rpm 的"公有领域"是基于版权年限的推断，建议逐 item 人工核验。

### 1.2 已排除的来源（有实测证据）

| 来源               | 排除原因                                                                                       |
| ------------------ | ---------------------------------------------------------------------------------------------- |
| Free Music Archive | API 已下线（实测 404），2018 年起改为邮件申请 Key；目录以 FMA 镜像活在 Internet Archive        |
| Musopen            | `api.musopen.org` 无法连接，官网 Cloudflare 反爬，无公共 API                                   |
| Pixabay Music      | 授权清晰但公共 API 只覆盖图片/视频，无音乐端点、无专辑模型                                     |
| ccMixter           | API 可用但无专辑概念、音频文件强校验 Referer 且无 CORS，浏览器播放必须代理                     |
| FreePD             | 已永久关站                                                                                     |
| SoundHelix         | 17 首程序生成 MP3（实测 206 + Range，单曲 8-10MB），无真实专辑、无授权明示——**仅作开发期占位** |

### 1.3 MVP 落地建议

1. Jamendo：`type=album` 拉真专辑 → `albums/tracks` 拿全辑 → 按 `license_ccurl` 过滤 → 流走 storage 域（普通播放无碍）。
2. Internet Archive：按白名单 collection（`78rpm` / `etree` / `freemusicarchive`）检索 → 校验 `licenseurl`/`access-restricted-item` → 组专辑模型。
3. 开发期：SoundHelix 直链做占位专辑，联调 seek/进度条/队列。

---

## 2. 播放器实现（SvelteKit + Elysia + Svelte 5）

### 2.1 浏览器音频方案：HTMLAudioElement 为主

| 方案             | 定位                                                   | 结论                                                                                                          |
| ---------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| HTMLAudioElement | 渐进式 URL 播放，`ended` 事件是专辑连播的核心钩子      | **MVP 主力**——进度、seek、事件全都现成 [MDN](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/audio) |
| Web Audio API    | 精确调度（`start(when, offset, duration)`）、gain 渐变 | 仅用于**交叉淡化**（可选）与未来"整张解码"增强 [规范](https://webaudio.github.io/web-audio-api/)              |
| MSE              | 分片自适应流（HLS/DASH）                               | 非 MVP——需要服务端切分，文档明说渐进式播放对非自适应场景"simple and adequate"                                 |

**Gapless（无间隙连播）**：MDN 未声明 `<audio>` 原生 gapless 能力，逐轨切换有解码重入间隙。推荐 **双 `<audio>` 元素 + 预载策略**：当前轨播放时把下一轨 `preload="auto"`，`ended` 时直接 swap（同专辑内默认直切，保持专辑连续感；交叉淡化作为可选开关）。更彻底的方案（整张专辑解码进 AudioBuffer 后按时间轴顺序调度）作为"预下载整张专辑"的后续增强，不做首播路径。

### 2.2 流式代理架构：经 Elysia Node 服务器做 Range 代理（推荐默认）

- 原理已验证：seek 依赖服务器支持 `Accept-Ranges: bytes` + 206 + `Content-Range` [MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Range_requests)。
- Elysia 已验证能力：可直接 `return fetch(upstream)` 自动流式转发、`set.status` 可设 206、`set.headers` 透传响应头、Node 适配器支持 ReadableStream 流式输出；**但 Elysia 不内置 Range 转发**，需手写透传（约 10 行，Part 2 §4.4 有代码骨架）。
- 为什么默认走自己的服务器而不是浏览器直连上游：
  - 单入口做鉴权/限流/缓存/URL 归一化；CORS 由自己域名下发（`@elysiajs/cors` 已在仓库）；
  - web 前端静态部署（adapter-static），纯浏览器端无法做 CORS 之外的鉴权；
  - 上游如已确认 CORS + Range + 公开，可加"直连模式"开关做 AB 比较省带宽。
- Cloudflare 路线（Pages Functions 代理音频）技术上可行（流式转发不计 CPU、无 wall-clock 上限），但占每日请求配额、与 Elysia 逻辑重复，**不建议作为唯一路径**。

### 2.3 Media Session API（系统级媒体控制）

- `navigator.mediaSession.metadata / playbackState / setActionHandler / setPositionState` 提供锁屏/系统媒体键/耳机的播放控制与进度 [MDN](https://developer.mozilla.org/en-US/docs/Web/API/Media_Session_API)。
- 浏览器支持：Chrome 73+ / Firefox 82+ / Safari 15+（WebView Android 不支持）。
- 对 long-play 的意义：**`nexttrack` 即"播专辑下一首"、`previoustrack` 即"回上一首"**——系统媒体键直接驱动专辑连播，不上系统里切专辑。
- artwork 需提供多尺寸（96→512）适配不同系统 UI；Safari 真机行为需实测（详见 Part 2 §3.3）。

### 2.4 Svelte 5 播放状态：runes 单例 store

分层架构（仓库现状：Svelte 5.56 + TanStack Query + oRPC，无任何播放代码）：

- **数据层**：TanStack Query / oRPC 负责专辑 + 曲目引用数据（`createQuery` → `client.albumDetail(id)`）。
- **播放层**：`$lib/player/player.svelte.ts` 模块级单例（getter 对象导出，规避裸 `$state` 不可外部重赋值），状态含 `album / tracks / index / isPlaying / currentTime / duration`，派生值 `currentTrack / hasNext / progress`，动作 `bind / play / pause / toggle / next / prev / seek / init`。
- 队列天然等于专辑曲目列表（产品约束直接用数据模型表达，无需单独的 queue 结构）。
- `init()` 绑定 `ended` → `next()` → 末轨 `finishAlbum()`（停在末尾，UI 给"重播整张专辑"）；Media Session 的 metadata/handler 集中在 store 内用 `$effect` 维护。
- 完整代码骨架见 Part 2 §5.4–5.7。

---

## 3. Apple Music 风格 UI/UX 与交互设计

### 3.1 界面骨架

- **桌面**：左侧窄 sidebar（Library / Browse / 底部 Settings）+ 主内容区 + **底部常驻迷你条**（封面 → 点击展开全屏 Now Playing；中间"曲目标题 > 专辑名 — 艺术家 > 进度"；右侧播放控制 + 队列）。源自 Apple HIG sidebar/tab-bar/materials 章节与 Music 官方用户指南的 MiniPlayer。
- **移动端**：底部 tab bar（≤3 tab）+ 浮于其上的迷你条；**全屏 Now Playing 即主播放界面**（大封面 + 大字标题 + 大进度条 + 大控制）。
- **专辑页**：大封面 + 专辑名（Large Title）+ 艺人/年份/曲数 + Play/Shuffle 主操作行 + 有序曲目列表（时长列、当前行高亮）。
- **质感**：封面取色生成背景渐变 + `backdrop-blur` 半透明材质叠控件（HIG Materials：亮底需叠 35% 压暗层保对比度）；SF 风格字体栈（`system-ui, -apple-system, ...`）；hover 渐进披露（默认显示序号，悬停浮现 Play 图标）；正在播放行 = 主题色高亮 + 动效均衡器条（`prefers-reduced-motion: reduce` 降级静态图标 + `aria-current`）。

### 3.2 交互设计：让"整张专辑"成为产品承诺

这是产品差异化的灵魂，逐项决策（详见 Part 3 §2）：

| 交互点         | 决策                                                                                                                                                      |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Play 按钮语义  | 恒为"播放整张专辑"（第 1 轨起按官方顺序）；若正在播该专辑，提供 Resume / 从头播放二级选择                                                                 |
| 队列语义       | **专辑即队列**——切专辑 = 替换队列（默认立即 + 5 秒可撤销 toast）；完全没有"加入单曲"入口；队列内部可拖拽排序/一键恢复官方顺序；队列与进度持久化           |
| 跳过           | 允许，但在专辑边界内：Next 永远停在专辑内下一首；Previous 遵守">3-5 秒先回本曲开头"惯例                                                                   |
| Shuffle        | 只做**专辑内洗牌**；按钮变色即开启（对齐 Apple Music 约定）；不做跨专辑 Shuffle Albums                                                                    |
| 专辑结束       | **默认播完停止**——不接歌不推荐；完成态给 Replay（重播）+ Repeat Album toggle（只保留 off / repeat all 两态，**去掉 repeat one**——单曲循环与产品精神冲突） |
| Up Next        | = 专辑剩余曲目清单，头部"正在播放：专辑 X（Track 3 of 12）"定位感；点击任意曲目跳播并续播剩余                                                             |
| 迷你条语境     | 标题 > 专辑名—艺术家 > 进度 + 轻量"N/12"徽标，任何页面都知道"我在专辑第几首"                                                                              |
| 自动续播下一张 | 不做（做成用户主动点击的"你可能也喜欢"卡片，opt-in 才考虑自动接续）                                                                                       |

### 3.3 快捷键与无障碍（P0 部分摘录）

- 全局：空格/K 播放暂停、N/P 前后曲目、Cmd/Ctrl-L 定位当前曲目、Cmd/Ctrl-U 队列、Cmd/Ctrl-Shift-F 全屏、`?` 帮助（焦点在输入框时不拦截）；系统媒体键走 Media Session。
- 无障碍：正文 4.5:1 对比度（压封面文字用 scrim/材质保证）；44px 触控热区；`aria-pressed`（开关类）、`aria-current`（当前曲目行）、`aria-live`（曲目切换播报）；`tabindex` 恪守 0/-1、`:focus-visible` 焦点环；控制台与键盘行为共享一份代码。

---

## 4. Electrobun 桌面打包

### 4.1 结论：可以打包，仓库已就绪大部分

- 架构：Bun 主进程 + webview；本仓库三平台强制 `bundleCEF: true`（Chromium，v1.18.0 起 CEF 147），UI 一致性最好。
- 集成路径已验证：SvelteKit `adapter-static` 导出 → `build.copy` 拷入 `views/mainview` → `views://` 协议加载。仓库已全部配好（`svelte.config.js`、`electrobun.config.ts`、`dev:hmr`/`build:stable` 脚本）。
- 自定义标题栏（`titleBarStyle: hidden/hiddenInset` + `trafficLightOffset` + `app-region: drag`）、原生窗口控制、多窗口、菜单、托盘、通知——全部有现成 API，做 Apple 风格无边框窗口没问题。
- 社区先例：`aueio-player-desktop`（Electrobun 跨平台音频播放器，Web Audio + 主进程内置 HTTP 音频服务）佐证可行性。

### 4.2 必须处理的点（按风险排序）

1. **Media Session OS 集成（最高风险，官方无承诺）**：页面里的 `navigator.mediaSession` 在 CEF 内正常执行，但"CEF 是否把媒体信息透出到 macOS 控制中心/锁屏、Windows SMTC、Linux MPRIS"**无文档承诺**（源码 grep 零命中）——必须先构建 CEF 包真机验证；若不透出，Electrobun 没有原生媒体键桥 API，需要自研原生层（超出框架能力）。
2. **`exitOnLastWindowClosed` 当前为 `true`**：关窗即退出。做"关窗继续听"必须改 `false` + `Tray` + RPC。
3. **持久化**：`views://` 只读，播放列表/设置要走主进程 `Utils.paths.userData`（typed RPC）或 webview `partition`。
4. **Chronium 行为实测**：自动播放策略（如需启动即播，`chromiumFlags` 配 autoplay-policy）、后台音频节流、`views://` origin 拉 archive.org 流的 CORS。
5. **发行收尾**：补 macOS codesign/notarize + 图标、`release.baseUrl`（静态托管即可自动更新）、三个原生 CI runner 出三平台包。
6. 桌面包里没有 `localhost:5172` 的 Elysia——远程 API 需走 HTTPS 公网地址。

---

## 5. MVP 落地顺序（整合建议）

1. **播放内核雏形**：`player.svelte.ts` + 裸 `<audio>` + 一条 Elysia Range 代理路由 → 验证"单曲可播、可 seek（206 端到端）"。
2. **专辑推进**：`bind(album, tracks)` + 双元素预载 + `ended → next → finishAlbum`。
3. **UI 骨架（P0）**：桌面三区 + 专辑页 + 底部迷你条；"专辑即队列"语义落地（无单曲入口）。
4. **系统集成**：Media Session metadata/handler/进度 + 全局快捷键。
5. **质感（P1）**：封面取色 + blur 材质 + 正在播放行动画 + 无障碍基线。
6. **Electrobun 验证**：CEF 构建 → 真机验证 Media Session OS 集成 → 改 exitOnLastWindowClosed + Tray。
7. **打磨（P2）**：专辑结束态、Up Next 面板、专辑内洗牌、平板断点。
8. 上线前必测：iOS Safari/Mac Safari 真机 Media Session、Android Chrome 锁屏/后台、上游不支持 Range 的回落（200 全量）场景。

## 6. 需要产品侧确认的开放问题

- 交叉淡化 vs 同专辑直切？（建议默认直切，淡化做开关）
- 是否要"继续上次播放位置"？（建议 MVP 后，localStorage 即可）
- 专辑播完的默认行为确定停止？（建议是——这是产品气质的一部分）
- 桌面端是否要"关窗继续播放"？（建议要，但需先过 Media Session 验证关）</think>调研完成。四份子报告 + 一份总报告都已在 `docs/` 目录下，下面是给你要点总结。

## 调研结论：三个问题的答案

### 1. 免费音乐 API —— 用 Jamendo + Internet Archive 双主源

**这可能是整个项目最顺利的部分，因为两个来源都天然支持"整张专辑"概念：**

- **Internet Archive**：无 Key 开放 API，媒体 URL 实测带 CORS 头 + 支持 Range 请求（206）——浏览器直接播放、拖动 seek 全通。它的模型就是 **item=专辑、files=曲目**，和你"只能整专播放"的理念完全吻合。法律干净的存量有三块：78rpm 公有领域老唱片（30.9 万）、etree 授权现场录音（30.3 万，仅可流播）、FMA 镜像 CC 专辑（1.7 万）。注意必须按 collection/licenseurl 白名单筛选，不能全量入库。
- **Jamendo**：CC 授权体系最完整，数据模型原生就是"专辑 + 完整曲目列表 + 封面 + 每曲独立流地址"，`albums/tracks` 一接口拿全辑。免费档非商用 3.5 万次/月。小坑：音频存储域无 CORS 头（普通播放无碍，做频谱可视化需要服务器代理）。
- **已排除**：FMA（API 已死）、Musopen（无 API）、Pixabay（无音乐 API）、ccMixter（无专辑）、FreePD（关站）。开发期可用 SoundHelix 17 首占位曲目联调。

### 2. 播放器实现 —— HTMLAudioElement 为主 + Elysia Range 代理

- **音频方案**：HTMLAudioElement 为主（`ended` 事件就是专辑连播的钩子），双 `<audio>` 元素预载实现无间隙连播；Web Audio 只留给可选交叉淡化。MSE 不需要（那是 HLS/DASH 场景）。
- **流式架构**：推荐**经 Elysia Node 服务器做 Range 代理**统一拉流——Elysia 支持透传 206/Content-Range/ReadableStream 流式转发（不内置 Range 转发，需手写约 10 行，报告里有代码骨架）。这样鉴权、限流、换源都在一处；Cloudflare 代理音频不推荐作为主路径。上游支持 CORS+Range 时可加"直连模式"开关省钱。
- **播放状态**：Svelte 5 runes 单例 store（`$lib/player/player.svelte.ts`），**队列就等于专辑曲目列表**，数据模型直接表达产品约束；TanStack Query 只管专辑元数据。
- **Media Session API**：系统媒体键/锁屏控制，`nexttrack` 即"播专辑下一首"——注意 Safari 行为需真机验证。

### 3. UI/UX —— 核心是"专辑即队列"的交互承诺

- **界面**：桌面 = sidebar + 内容区 + 底部迷你条；移动端 = tab bar + 全屏 Now Playing；专辑页 = 大封面 + 大字标题 + 曲目列表。质感来自封面取色背景 + blur 材质 + 正在播放行的动效均衡器（配 reduced-motion 降级）。
- **交互决策**（报告里每个都有依据和推荐）：Play = 整张专辑从头播放；无单曲入口；跳过允许但在专辑内；播放完**默认停止**（不自动接歌，这是产品气质）；Repeat 去掉单曲循环；Up Next 面板显示"Track 3 of 12"定位感。

### 4. Electrobun —— 能打包，仓库已就绪 80%

脚手架基本都对：adapter-static + CEF 三平台 + views:// 加载链路都通了，还有社区先例（Electrobun 做的跨平台音频播放器）。**唯一的高风险点**：Media Session 能否透出到 macOS 控制中心/锁屏是 CEF 内核行为，Electrobun 官方文档没承诺——必须先在真机构建验证；若不行需要自研原生层。另外记得把 `exitOnLastWindowClosed` 改成 `false` 并加托盘，才能"关窗继续听"。

---

**文件位置**：总报告 `docs/music-player-research.md`，四份详细子报告也留在 `docs/` 下（每份都带内联来源 URL，并明确区分了"已验证"与"推断"）。报告的 MVP 落地顺序一节（§5）可以直接作为下一步开发的路线图。需要的话，我可以接着按这个路线搭播放器 store 和 Elysia 代理路由的初始代码。
