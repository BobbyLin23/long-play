# Research Part 4: Electrobun Desktop Feasibility for long-play

**Scope:** Topic 4 only — can the Electrobun desktop shell package the SvelteKit music player "long-play" (apps/web), and ship as an always-on media app.

**Date:** 2026-08-19

**Primary sources used:**
- 安装在本仓库的 `electrobun@1.18.1` npm 包源码（`apps/desktop/node_modules/electrobun`）— 这是与仓库锁定的版本完全一致的权威来源（`dist/api/bun/*.ts`、`dist/api/browser/*.ts`、`src/cli/index.ts`、`README.md`）。
- 官方 repo：https://github.com/blackboardsh/electrobun （docs 就在 repo 内：`docs/src/content/docs/electrobun/...`，raw 地址 `https://raw.githubusercontent.com/blackboardsh/electrobun/main/docs/src/content/docs/electrobun/...`）
- 官方站点：https://electrobun.dev （302 重定向到 https://blackboard.sh/electrobun/）
- 官方文档：https://docs.electrobunny.ai/electrobun/ （当前 301 到 https://blackboard.sh/dash/，内容与 repo 内 docs 相同）
- 社区案例：https://github.com/tuomashatakka/aueio-player-desktop （Electrobun 写的跨平台音频播放器）

**重要版本说明（verified）：** 仓库锁定 `electrobun ^1.18.1`（`apps/desktop/package.json`），安装的正是 1.18.1（2026-05-04 发布）。README/docs 在 repo 的 `main` 分支上描述的是 2.x 线（Hutch + Cottontail）。1.x 与此的差异是：1.x 主进程固定为 Bun（不是 Cottontail），CLI 是 `electrobun dev/build --env=...`（不是 `hutch ...`），因此仓库脚本与 1.x 形态一致。官方 changelog 明确说明 v1.18.1+ 的客户端可直接消费 2.0 的更新产物（`guides/changelog/v1-18-1.mdx`、`guides/updates.mdx`），所以两者基本兼容。下文凡引用 2.x 文档处均已对照 v1.18.1 源码核验过 API 形态。

---

## 1. What Electrobun Is

### 架构（verified）

- Electrobun 是"macOS / Windows / Linux 桌面应用框架"，UI 用 HTML/CSS/TypeScript 写，"Electrobun gives you the native side: real windows, menus, trays, auto-updates, WebGPU surfaces, and platform integration"（`docs/src/content/docs/electrobun/guides/what-is-electrobun.mdx`）。
- 与 Electron/Tauri 的关键差异（README 原文）：Electrobun 用 **Bun 执行主进程**，用 Bun 打包 webview 的 TypeScript，原生绑定用 ObjC/C++/Zig 编写（`node_modules/electrobun/README.md`："Under the hood it uses bun to execute the main process and to bundle webview typescript, and has native bindings written in Objc, C++, and several core parts written in zig"）；v1.18 的 CLI 在构建失败时还会打印“NOTE FOR AI ASSISTANTS: Electrobun is NOT Electron. Different architecture, different APIs.”（`src/cli/index.ts`）。
- 默认使用**系统 webview**：macOS 用 WKWebView、Windows 用 WebView2、Linux 用 WebKitGTK 4.1；可通过 `bundleCEF: true` 捆绑一份固定的 Chromium（CEF）渲染器；`bundleWGPU` 可不用 webview 直接驱动 GPU surface（`docs/guides/architecture/overview.mdx`、`docs/guides/compatability.mdx`）。
- 进程模型：主进程持有原生对象（窗口/菜单/托盘/更新），webview 与主进程隔离，只能通过类型化 RPC / 事件桥通信（`docs/guides/architecture/overview.mdx`）。
- 目标体积：默认系统 webview 时自解压包约 14MB（大头是 Bun 运行时）；更新补丁可小到 4KB（ZSTD 压缩 + 自研 BSDIFF；`node_modules/electrobun/README.md`）。

### 应用结构（verified，v1.18.1 源码 + 2.x 文档一致）

- 项目结构：主进程入口默认 `src/bun/index.ts`（`build.bun.entrypoint`，见 `node_modules/electrobun/dist/api/bun/ElectrobunConfig.ts` 注释 "Entry point for the main Bun process @default "src/bun/index.ts""）。
- `electrobun.config.ts` 是唯一配置：`app`（name/identifier/version/urlSchemes/fileAssociations）、`build`（bun 入口、views、copy、bundleCEF、defaultRenderer、codesign/notarize、icons、chromiumFlags……）、`runtime`、`scripts`（preBuild/postBuild/postWrap/postPackage）、`release`（baseUrl/generatePatch）——完整字段见 `dist/api/bun/ElectrobunConfig.ts`（487 行，主注释）。
- 打包后的资源布局（文档原文）：`Resources/app/bun/`（打包的主进程 JS）+ `Resources/app/views/`（webview 静态资源）+ `version.json`；用 **`views://` 协议**加载 `Resources/app/views` 下的文件，跨平台解析到正确位置（`docs/guides/architecture/overview.mdx`、`docs/apis/bundled-assets.mdx`）。

### 静态资源打包方式（verified）

- 两种方式（`docs/apis/bundled-assets.mdx`）：`build.views` 用 Bun 打包 TS/JS 入口；`build.copy` 原样拷贝 HTML/CSS/图片等到 `views/...` 目标路径。本仓库用的是 `build.copy`：`{ "../web/build": "views/mainview" }`（`apps/desktop/electrobun.config.ts`），即把 SvelteKit 的静态构建产物整体拷到 views 下，运行时 URL 为 `views://mainview/index.html`。
- 每个 view 会被输出为 `views/<view-name>/index.js`；HTML/CSS 里引用资源也用 `views://mainview/...`（`docs/apis/bundled-assets.mdx`）。
- `views://` 是只读打包内容（原文 note："views:// is read-only packaged content. Store mutable application data under Utils.paths.userData ..."），这对一个需要持久化播放列表/设置的播放器是个关键约束（见 §5）。

### SvelteKit 适配方式（verified + 推断）

- official 文档没有 SvelteKit 专页；但 2.x 文档明确要求："Framework templates that need plugin transforms run their own Vite build and copy its output"（`docs/apis/cli/build-configuration.mdx` “JavaScript Bundling”一节）——即框架类前端（SvelteKit 属于此类）应先用 Vite/SvelteKit 自己的构建产出静态文件，再由 `build.copy` 拷入 views。这与**推断**相符：Electrobun 不做 SvelteKit 的框架集成，只消费静态产物。
- 本仓库已基本就位（verified，仓库文件）：
  - `apps/web/svelte.config.js` 使用 `@sveltejs/adapter-static`，`pages: "build"`、`assets: "build"`、`fallback: "index.html"`（SPA fallback 模式，适配单入口 UI）。
  - README 第 106 行注明："Desktop builds package static web assets. SvelteKit needs a static/export build configuration before desktop packaging will work."——这个前置条件在仓库里已配置。
  - `apps/web/package.json` 的 build 脚本是 `vite build`（经 sveltekit vite 插件触发 adapter-static 输出到 `apps/web/build`）。
  - 桌面主进程 `apps/desktop/src/bun/index.ts`：dev 频道先探测 `http://localhost:5173`（Vite dev server，HMR），不可用则回退到 `views://mainview/index.html`；stable/canary 频道直接加载 `views://mainview/index.html`。
- 结论：SvelteKit app 的接入路径是「adapter-static 静态导出 → copy 到 views → views:// 加载」，本仓库已经按此搭好；不需要给 SvelteKit 写独立 adapter。

---

## 2. Supported Features

### Media Session API / 系统媒体键 / 通知媒体控制

- **官方文档与 v1.18.1 源码中均无任何提及**（我对 docs 全部页面 + 包内 `dist/`、`src/` 做了 `grep -i "mediasession|media session|media key|nowplaying|mpnowplaying"`，零命中；`dist/main.js` 中也搜不到 `MPNowPlaying`/`MediaKey` 等原生符号）。
- 结论分层：
  - **推断（高置信）**：仓库配置了 `bundleCEF: true` + `defaultRenderer: "cef"`（`apps/desktop/electrobun.config.ts`），三平台 webview 都是 Chromium（v1.18.0 起 CEF 147，见 `docs/guides/changelog/v1-18-0.mdx`）。Chromium 实现了 Media Session API（`navigator.mediaSession`），所以**页面里现有的 Media Session 代码会正常执行**，行为与桌面 Chrome 一致。
  - **推断（中高置信，需真机验证）**：Chromium 的「Media Session → 系统级媒体控件（macOS 锁屏/控制中心 Now Playing、Windows SMTC 媒体按钮、Linux MPRIS）」集成是 Chrome 浏览器 UI 层的实现，CEF 嵌入壳是否自动把这些信息透出到操作系统**未在文档中承诺**。这是本课题最大的验证点——必须先做一次 CEF 构建、播放一段媒体、检查系统媒体控件是否出现（macOS 控制中心/锁屏、Windows 音量 OSD、Linux MPRIS/D-Bus）。官方未提供任何 `MPNowPlayingInfoCenter`/远程命令桥接 API（包内无对应导出）。
  - **推断（中置信）**：如果切换到 `native`（WEBKit/WKWebView/WebView2 系统 webview）渲染，Media Session 的 OS 集成更不可靠——macOS WKWebView 对 Media Session 的支持是 Safari 内核行为、版本差异大，跨三平台行为难以统一。因此为媒体按键一致性，仓库坚持 CEF 是正确选择。

### 自定义标题栏 / 无边框窗口 / 拖拽区域 / 红绿灯按钮（verified）

- `BrowserWindow` 支持 `titleBarStyle: "default" | "hidden" | "hiddenInset"`：`hidden` 完全无标题栏无原生控件（自定义 chrome），`hiddenInset` 保留 macOS 内嵌原生控件；另有 `trafficLightOffset`（macOS 红绿灯偏移）、`styleMask`（含 FullSizeContentView 等）、`transparent`、`passthrough`（透明区域鼠标穿透）——见 `node_modules/electrobun/dist/api/bun/core/BrowserWindow.ts`（WindowOptionsType 第 14-49 行、init 里 styleMask 逻辑 172-224 行）与 `docs/apis/browser-window.mdx`。
- 拖拽区域由注入的 preload 实现：CSS `-webkit-app-region: drag` / `app-region: drag` / 类名 `.electrobun-webkit-app-region-drag`，`no-drag` 子元素可点击（`docs/apis/browser/draggable-regions.mdx` + `node_modules/electrobun/dist/api/bun/preload/dragRegions.ts`）。
- 自定义窗口按钮（最小化/最大化/关闭）通过 typed RPC 调主进程的 `win.minimize()/win.maximize()/win.close()`（`docs/apis/browser/draggable-regions.mdx` 完整示例）。播放器要做一个 Apple 风格无边框窗口时，这套机制齐全。

### 原生窗口控制与全屏、多窗口、菜单、托盘（verified）

- 完整窗口控制：`setFullScreen/isFullScreen`、`setAlwaysOnTop`、`setVisibleOnAllWorkspaces`、`maximize/minimize/setFrame/setWindowButtonPosition`、`hide/show`（v1.18.0 新增原生 hide，`docs/guides/changelog/v1-18-0.mdx`）——`dist/api/bun/core/BrowserWindow.ts` + `docs/apis/browser-window.mdx`。
- 多窗口：可创建多个 `BrowserWindow` / `BrowserView`，支持 `<electrobun-webview>` 自定义元素做 OOPIF 子视图（`docs/apis/browser-view.mdx`、`docs/apis/browser/electrobun-webview-tag.mdx`）。
- 菜单：`ApplicationMenu.setApplicationMenu`（roles、accelerators、submenus、checked/hidden）+ `Tray`（托盘图标+菜单）+ `ContextMenu`——`dist/api/bun/core/ApplicationMenu.ts`、`dist/api/bun/core/Tray.ts`、`docs/apis/application-menu.mdx`、`docs/apis/tray.mdx`。这对"关窗后继续后台播放"场景是必需件（§5）。
- 本地存储：`views://` 只读；持久数据应走主进程 `Utils.paths.userData / userCache / userLogs`（`docs/apis/bundled-assets.mdx`、`docs/apis/utils.mdx`；v1.18 的 `ElectrobunConfig` 注释也说明 app 标识符会进入路径）。另外 `BrowserView` 有 `partition` 选项（"Persistent storage/session partition"）——webview 会话存储（cookies/localStorage/IndexedDB）可分区持久化（`docs/apis/browser-view.mdx` 构造参数表）。**推断**：`views://` 自定义 scheme 在 CEF 下是否提供可持久 localStorage/IndexedDB 未被文档明示，需实测；文档明确推荐的做法是通过 RPC 让主进程写入 userData 路径。

### 其他与媒体应用相关的 verified 能力

- `Utils.showNotification`（原生通知）、`setDockIconVisible`（macOS Dock 显示/隐藏）、托盘、`open-dev-tools`（`webview.openDevTools()`）、`electron` 式 `navigationRules` 导航白名单（`docs/apis/browser-view.mdx`）、`sandbox` 模式（远程内容禁用 RPC，`docs/apis/browser-window.mdx` caution 提示不要把特权 RPC 暴露给可导航到远程页面的 view）。

---

## 3. Audio Playback Considerations

### 打包应用的 webview 来源 / origin（verified）

- 打包内容用自定义 `views://` scheme 加载（`views://mainview/index.html`），平台无关路径解析。远程内容可正常 `loadURL("https://...")` 加载，且可用 `navigationRules` 限制可导航域名（`docs/apis/browser-view.mdx`、`docs/guides/architecture/overview.mdx`）。
- 本仓库三平台强制 CEF 渲染（`apps/desktop/electrobun.config.ts`：mac/linux/win 均 `bundleCEF: true` + `defaultRenderer: "cef"`），所以页面的 origin / 安全模型与 Chromium 一致。

### CORS 行为（推断，基于 web 平台标准；docs 未专门讨论）

- `<audio>`/`<video>` 元素**跨源播放不需要 CORS**：媒体元素加载跨源流本身是允许的（由页面发起的普通媒体请求不受同源策略拦截）。
- 只有需要**读取媒体样本**（Web Audio `createMediaElementSource`/`AudioContext` 分析器、或 `fetch` 拉流再播放）才受 CORS 限制。archive.org 的流通常带 `Access-Control-Allow-Origin: *`，满足无凭证跨源读取——所以"从 archive.org 拉流播放/做可视化"在 CEF 里应可工作（需实测验证）。
- webview 页面自身 origin 是 `views://mainview`（自定义 scheme），其发出的跨源请求仍走标准 CORS 握手，而不是被"本地文件豁免"绕过——所以不要依赖"桌面应用里没有 CORS"，应保持 web 端已有的 CORS 处理逻辑不变（推断）。
- 官方文档没有专门针对 audio/CORS 的限制段落（没有找到 "audio" 或 "CORS" 相关内容）。

### 音频/媒体相关推断风险点（docs 未承诺，需实测）

- **自动播放策略**：Chromium 默认要求音频自动播放需要用户手势（autoplay policy）。音乐播放器若希望"启动即播放"或后台恢复播放，通常需要 `chromiumFlags: { "autoplay-policy": "no-user-gesture-required" }`。这是 Chromium 标准 flag，Electrobun 提供 `chromiumFlags` 透传通道（`dist/api/bun/ElectrobunConfig.ts` 与 `docs/apis/cli/build-configuration.mdx` 均支持），但需确认 CEF 对该 flag 的实际生效情况。
- **后台播放节流**：Chromium 对不可见页面有音频节流/静音策略，CEF 行为需实测（播放器常在窗口最小化/后台时持续播放）。
- 社区佐证：`aueio-player-desktop`（README 自述 "beautiful, minimal cross-platform audio player"）用 Electrobun 的 webview + Web Audio API（`AudioEngine.ts`）实现播放，并在 Bun 主进程里起一个 HTTP 音频服务给前端提供流（README 提到 "App window, HTTP audio server, RPC handlers"）；它三平台（macOS/Linux/Windows）GitHub Actions 出包。说明"Electrobun 上做流媒体音频播放器"有真实先例（community evidence，非官方背书）。

---

## 4. Build / Packaging Workflow

### `electrobun build` 工作方式（verified，v1.18.1 源码 + 2.x 文档一致）

- v1 CLI（本仓库实际使用）：`electrobun dev` / `electrobun build --env=dev|canary|stable`（缺省 `dev`）；`--env` 的值限定 `dev`/`canary`/`stable`（`src/cli/index.ts` 2080-2082 行）。`electrobun dev --watch` 是热重载模式（仓库 `dev:hmr` 用了它）。
- 只构建**当前宿主机 OS/架构**：`const currentTarget = { os: OS, arch: ARCH }`（`src/cli/index.ts` 2099 行附近）；三平台发布需原生 CI runner 矩阵（`docs/guides/cross-platform-development.mdx`、`docs/guides/updates.mdx` 的 GitHub Actions 示例）。
- 产物（`docs/guides/bundling-and-distribution.mdx`）：
  - 默认输出目录 `build/<platform-prefix>/`，发布产物在 `artifacts/`。
  - macOS：`.app` bundle + 默认 DMG + `.app.tar.zst` 全量更新档 + `update.json` + 可选 `<prev-hash>.patch`（bsdiff 增量）。
  - Windows：`Setup.zip`（内含 setup.exe） + 更新档；Linux：`Setup.tar.gz` + 更新档。
  - canary/stable 通道相互独立，可并存安装。
- 资源布局：`Resources/app/bun/` + `Resources/app/views/`（`build.copy` 的目标），`useAsar` 可选把 Resources 打成 app.asar（默认 false，`dist/api/bun/ElectrobunConfig.ts`）。
- 生命周期钩子：`scripts.preBuild/postBuild/postWrap/postPackage`，以 ELECTROBUN_* 环境变量注入构建上下文（`dist/api/bun/ElectrobunConfig.ts`、`docs/apis/cli/build-configuration.mdx`）。

### 签名 / 公证（verified）

- macOS：`build.mac.codesign`（默认 false）、`build.mac.notarize`（默认 false，需先签）、`build.mac.createDmg`（默认 true）；默认 entitlements 已含 JIT/动态库三项（`com.apple.security.cs.allow-jit`、`allow-unsigned-executable-memory`、`disable-library-validation`，notarization 硬化运行时所必需，`src/cli/index.ts` 1494-1504 行）。需要环境变量：`ELECTROBUN_DEVELOPER_ID` + （App Store Connect API Key 或 AppleID 密码）`ELECTROBUN_APPLEAPIKEY/ISSUER/PATH` 或 `ELECTROBUN_APPLEID/APPLEIDPASS/TEAMID`（`docs/guides/code-signing.mdx`）。
- **Windows 渲染签名不在流水线中**（文档原文："Windows release signing is not currently part of Hutch's packaging pipeline"，`docs/guides/code-signing.mdx`；v1 源码同理无 win 签名逻辑）。
- 更新：`release.baseUrl` + `generatePatch: true`（默认），静态托管即可（R2/S3/GitHub Releases），无需更新服务器（`docs/guides/updates.mdx`）。

### 与仓库现有脚本的契合度（verified，仓库文件）

- `apps/desktop/package.json`：
  - `dev:hmr` = `concurrently "pnpm run hmr" "electrobun dev --watch"`；`hmr` = `turbo run dev -F web`（起 Vite dev server，端口 5173）。这与 `src/bun/index.ts` 的 dev 频道探测逻辑配套：探测到 5173 就加载 dev server（HMR），探不到就加载打包的 `views://mainview/index.html`。
  - `build:stable` = `turbo run build -F web && electrobun build --env=stable`；`build:canary` 同理（`--env=canary`）；`build` = 默认 `--env=dev`。`turbo run build -F web` 先产出 `apps/web/build`（adapter-static），随后 `electrobun build` 的 `copy` 把该目录拷进 `views/mainview`。流程与官方文档同构（官方文档 build-configuration 也要求"先跑框架自己的构建，再拷产物"）。
  - 缺口：`electrobun.config.ts` 未配置 `mac.codesign/notarize`（默认为 false），也未配置 `release.baseUrl`（无自动更新元数据）、没有图标（`mac.icons` 默认 `icon.iconset`，仓库没有该目录）、没有 `build.copy` 之外的 asar 设置。发行前需补齐这些。
- 一个小风险（推断，来自 `src/bun/index.ts` 逻辑）：`dev:hmr` 并发启动时 web dev server 尚未就绪的窗口期，首次 HEAD 探测会失败、回退到打包版而不是 HMR 版；需要重开应用或稍候。属开发体验问题，不影响发行。

---

## 5. Gotchas for an Always-On Media App

- **`exitOnLastWindowClosed` 默认 `true`**：关掉窗口应用直接退出（`dist/api/bun/ElectrobunConfig.ts` runtime 注释：“Quit the application when the last BrowserWindow is closed @default true”；`docs/apis/cli/build-configuration.mdx`：“set it to false for tray and background applications”）。要支持"关窗继续听"必须显式设 `false`，并配合 `Tray` + RPC 让主进程在窗口关闭后仍能控制播放（暂停/下一首/退出）。仓库当前 `electrobun.config.ts` 已设 `exitOnLastWindowClosed: true`——这是发行一个后台常驻媒体应用必须改的第一项。
- **`views://` 只读**：播放列表/设置/收藏等本地数据不能写进 views，必须通过 typed RPC 交给主进程写 `Utils.paths.userData`，或使用 webview `partition` 持久化会话存储；`views://` 上 localStorage 的可持久性未在文档承诺，需实测（`docs/apis/bundled-assets.mdx` note）。
- **无内置 OS 媒体键/Now Playing 桥**：官方 API 面没有媒体会话/媒体键相关导出（§2 已核实），所以你无法从主进程"主动"把自己的播放状态注册为系统媒体控件（那是浏览器内核行为，不归 Electrobun 管）。若 CEF 的 Media Session→OS 集成不如预期，需要自己评估方案（例如 Linux 上接收 MPRIS、macOS 上自己装 MPNowPlaying 之类原生桥——但这些都不在 Electrobun API 里，需要靠原生开发或社区方案，属调研范围外）。
- **CEF 体积代价（verified）**："CEF materially increases the application download and installed size. System webviews remain the better default..."（`docs/apis/bundling-cef.mdx`）。仓库三平台都 bundleCEF，换取跨平台一致的 Chromium（含 Media Session 页面 API）是可接受的取舍。
- **Linux 运行依赖（verified）**：即使捆绑 CEF，Linux 仍需要 `libgtk-3-0 libwebkit2gtk-4.1-0 libayatana-appindicator3-1 librsvg2-2` 等系统包（`docs/guides/cross-platform-development.mdx`）；且 Linux 进程只能选一种 webview 实现（CEF 或 GTK WebKit），不能混用。
- **多平台发布矩阵（verified）**：只能在本机平台构建，需要 macOS(macOS 14+)/Windows 11+/Ubuntu 22.04+ 的原生 CI runner（`node_modules/electrobun/README.md` 平台表 + 2.x 文档一致）。
- **抽查安装的 v1.18.1 与最新 2.x 的兼容**：changelog 与 updates 文档声明 v1.18.1+ 客户端可直接拉取 2.0 更新产物（"Electrobun v1.18.1 and later consume a 2.0 release directly"）。若后续升级大版本，需按 `docs/guides/migrating-to-v2.mdx` 迁移（CLI 从 `electrobun` 变为 `hutch`）。
- **无官方的"媒体/音频限制"文档**：我在文档中未找到针对音频播放、CORS、自动播放的专门限制段落；以上媒体相关点均是我基于 Chromium/Web 平台行为的推断，属于"必须实测验证"的清单，不是官方承诺。

---

## Verdict

**结论：可以。** 一个"只播专辑、从远程源（archive.org 之类，带 CORS *）拉流"的音乐播放器完全可以打成 Electrobun 桌面应用，而且本仓库的脚手架已经做对了大部分工作：adapter-static 静态导出已配好、三平台 bundleCEF（Chromium）已配好、`build.copy` 把 web 构建产物拷入 `views://` 的链路已通、`dev:hmr`/`build:stable` 脚本与官方 build 流程一致。

**发行前必须改动/验证的清单（按优先级）：**

1. **验证 Media Session 的 OS 集成（最高风险）**：先构建一个 CEF 包，播放音频，检查 macOS 控制中心/锁屏、Windows SMTC、Linux MPRIS 是否出现媒体控件。这是唯一可能让方案落空的点；若 CEF 不透出系统媒体键，需要额外的原生层方案（Electrobun 不提供，需自行调研）。
2. 把 `exitOnLastWindowClosed` 改为 `false`，加 `Tray` + RPC 命令，实现关窗后继续播放、托盘恢复/退出。
3. 持久化方案：播放列表/设置走主进程 `Utils.paths.userData`（typed RPC）或 webview `partition`；不要依赖 `views://` 可写。
4. 曝光确认：Chromium 自动播放策略（如需启动即播或后台恢复，加 `chromiumFlags` 的 autoplay-policy）、后台音频节流/静音行为、以及从 `views://` origin 拉 archive.org 流的实际 CORS 行为，都要在 CEF 里实测。
5. 发行收尾：补 macOS `codesign`/`notarize` 与图标、设 `release.baseUrl` 启用自动更新、用三个原生 CI runner 出三平台发行物。
6. 保持 web 端架构不变，但确保播放核心不依赖本地 `localhost:3000` 的 Elysia API（那是开发/云部署服务；桌面包里没有它），远程 API 需通过 HTTPS 公网地址可达。

## 主要资料来源 URL 汇总

- README：https://github.com/blackboardsh/electrobun/blob/main/README.md （npm 包内亦有副本：`apps/desktop/node_modules/electrobun/README.md`）
- 架构总览：https://github.com/blackboardsh/electrobun/blob/main/docs/src/content/docs/electrobun/guides/architecture/overview.mdx
- static assets：https://github.com/blackboardsh/electrobun/blob/main/docs/src/content/docs/electrobun/apis/bundled-assets.mdx
- BrowserWindow：https://github.com/blackboardsh/electrobun/blob/main/docs/src/content/docs/electrobun/apis/browser-window.mdx
- BrowserView：https://github.com/blackboardsh/electrobun/blob/main/docs/src/content/docs/electrobun/apis/browser-view.mdx
- Draggable regions：https://github.com/blackboardsh/electrobun/blob/main/docs/src/content/docs/electrobun/apis/browser/draggable-regions.mdx
- 构建配置：https://github.com/blackboardsh/electrobun/blob/main/docs/src/content/docs/electrobun/apis/cli/build-configuration.mdx
- 分发产物：https://github.com/blackboardsh/electrobun/blob/main/docs/src/content/docs/electrobun/guides/bundling-and-distribution.mdx
- Code signing：https://github.com/blackboardsh/electrobun/blob/main/docs/src/content/docs/electrobun/guides/code-signing.mdx
- Updates：https://github.com/blackboardsh/electrobun/blob/main/docs/src/content/docs/electrobun/guides/updates.mdx
- CEF：https://github.com/blackboardsh/electrobun/blob/main/docs/src/content/docs/electrobun/apis/bundling-cef.mdx
- 兼容性/平台：https://github.com/blackboardsh/electrobun/blob/main/docs/src/content/docs/electrobun/guides/compatability.mdx
- Chromium 版本（v1.18.0 起 CEF 147）：https://github.com/blackboardsh/electrobun/blob/main/docs/src/content/docs/electrobun/guides/changelog/v1-18-0.mdx
- 社区音频播放器先例：https://github.com/tuomashatakka/aueio-player-desktop