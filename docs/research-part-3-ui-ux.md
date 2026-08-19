# Research Part 3: Apple Music 式 UI/UX 与交互设计（专辑播放器）

> 本文档服务于 long-play 项目 —— 一个"只能整张专辑顺序播放"的音乐播放器（SvelteKit web + Elysia server + Electrobun shell）。
> 范围：Tab 3，仅研究 UI/UX 与交互设计。涉及器材源的调研由其他 agent 负责。

**证据标注约定**：`[验证]` = 来自权威来源（Apple HIG / Apple Music 官方用户指南 / MDN / WCAG），附源 URL；`[推断]` = 基于已验证事实的推理，供团队决策参考。涉及 Apple Music 视觉细节（如动效均衡器图标）官方文档未逐一文字化描述的部分，会明确标注为基于产品观察的推断。

---

## 目录框架

1. [Apple Music 的界面模式（Interface Patterns）](#1-apple-music-的界面模式)
2. [Album-only 播放的交互设计](#2-album-only-播放的交互设计)
3. [键盘快捷键与可访问性（Keyboard & Accessibility）](#3-键盘快捷键与可访问性)
4. [响应式布局（Responsive Layout）](#4-响应式布局)
5. [MVP 的 UI/UX 建议清单](#5-mvp-的-uiux-建议清单)

---

## 1. Apple Music 的界面模式

### 1.1 侧边栏导航（Sidebar）

Apple HIG 对 sidebar 的权威定义（src: https://developer.apple.com/design/human-interface-guidelines/sidebars）：

- [验证] Sidebar 用于导航到应用内的重要区域，条目可带 SF Symbols 图标 + 文字标签；图标默认使用应用的 accent color（macOS 用户可全局改 accent color，所有 app 的 sidebar 图标应变）——所以给 lazy 的 sidebar 图标上固定配色"永远不如"跟随主题色安全。
- [验证] 空间受限时，应转换为更紧凑的 tab bar（见 4.1）；iPadOS 的 `sidebarAdaptable` 样式可在 sidebar 与 tab bar 之间切换，随窗口宽度自动适配。
- [验证] 不默认隐藏 sidebar，避免导航不可发现；最多展示两层层级；内容可以"穿透/延伸到"sidebar 之下（background extension effect，翻折/模糊/延伸图片到 sidebar 底下）。这正解释了 Apple Music 专辑页大图延伸到侧边栏背后的观感。
- [验证] Apple Music 官方用户指南确认 macOS 端 sidebar 结构："点击 Library 下任意条目……例如点击 Albums 显示库中所有专辑"；Playlists 单独一节（src: https://support.apple.com/guide/music/play-songs-from-your-library-muscb1e04acf/mac 与 https://support.apple.com/guide/music/welcome/mac 的目录）。Apple Music/App Store 生态的顶层结构是 Library / Browse / Radio（Apple Music 应用在各平台一致采用）[推断，基于 Apple Music 产品观察]。
- [推断 → long-play] 桌面端用窄 sidebar：`Library（Albums / Artists / Recently Added）`、`Browse（推荐与分类）`、`Radio（如需）`、底部 `Settings`。长期 listening 场景下条目数少，符合 HIG"两层以内、勿堆叠"的建议。

### 1.2 底部 Now Playing 迷你条（MiniBar / MiniPlayer）

权威依据：

- [验证] HIG（Tab bars 章节）明确把 Music app 的 MiniPlayer 作为一个"attached accessory"，悬浮在 iOS tab bar 上方；向下滚动时 MiniPlayer 可收缩内联进 tab bar（`TabBarMinimizeBehavior`）（src: https://developer.apple.com/design/human-interface-guidelines/tab-bars）。
- [验证] Apple Music 用户指南描述 macOS MiniPlayer：显示正在播放歌曲的专辑插图；鼠标悬停到插图上方时浮现播放控制；下方是进度滑杆（拖动可跳转）、音量、歌词、队列按钮；可进一步收缩到"只留播放控制、隐藏封面"的小窗；点封面可展开 Full Screen Player（src: https://support.apple.com/guide/music/use-music-miniplayer-mus71d7dcfce/mac）。
- [验证] "Queue/Playing Next 面板"位于 macOS Music 窗口右上角（src: https://support.apple.com/guide/music/queue-your-songs-musb1e6d1c76/mac）。
- [推断 → long-play] 桌面端迷你条 = 常驻底部横条：左=封面（点击展开全屏 Now Playing，符合苹果"点封面打开播放器"的引导）；中间=当前曲目标题 + "艺术家 — 专辑名"；下方纤细进度线；右侧=上一首/播放暂停/下一首 + 音量 + 打开队列。迷你条应遵循 HIG Materials 的做法，用带 blur 的半透明材质承托控件，允许内容从底下透出并保持对比度（src: https://developer.apple.com/design/human-interface-guidelines/materials）。

### 1.3 全屏 Now Playing 视图

- [验证] HIG Playing audio 明确要求把播放状态接入系统 Now Playing UI（锁屏/控制中心/耳机控制），提供 title / artist / artwork / duration / elapsed / playback rate 等元数据，并注册 play/pause/next/previous 等 remote commands；中断（来电）时暂停并在可恢复时恢复；播放停止后要清除过期的 Now Playing 信息（src: https://developer.apple.com/design/human-interface-guidelines/playing-audio）。
- [验证] Web 端对应物是 Media Session API：`navigator.mediaSession.metadata = new MediaMetadata({title, artist, album, artwork})`，并 `setActionHandler("play"|"pause"|"seekbackward"|"seekforward"|"seekto"|"previoustrack"|"nexttrack"|…)` 绑定系统级媒体按键（src: https://developer.mozilla.org/en-US/docs/Web/API/Media_Session_API）。Electrobun shell 里这一点必须做，系统媒体键/锁屏才能控制 long-play。
- [验证] macOS Music 有 Full Screen Player，快捷键 Shift-Command-F（src: https://support.apple.com/guide/music/keyboard-shortcuts-mus1019/mac）。
- [推断 → long-play] 全屏 Now Playing = 模态覆层：大封面居中 + 大型标题/艺术家（typography 见 1.6）+ 大进度条 + 大号播放控制 + 一键切到"队列视图"。这是"听专辑"的主舞台，移动端它就是主界面（见 4.3）。

### 1.4 专辑页解剖（Album Page Anatomy）

- [验证] Apple Music 播放入口："把指针移动到任意歌曲或专辑上，点击播放按钮"即可播放（src: https://support.apple.com/guide/music/play-songs-from-your-library-muscb1e04acf/mac）——专辑页头部的大播放按钮 + hover 才显示的行内播放按钮是官方确认的交互。
- [验证] 专辑在 Music 中按"专辑内的歌曲顺序"播放（"Shuffle albums 时 Music 会先按专辑内顺序播完该专辑，再随机挑下一张专辑"）（src: https://support.apple.com/guide/music/shuffle-or-repeat-songs-mus2989/mac）——证明"专辑即有序曲目列表"是 Apple Music 的数据模型。
- [验证] 快捷键列表中存在"播放列表中上一张/下一张专辑"（Option-左右箭头），说明专辑列表是头等导航单元（src: https://support.apple.com/guide/music/keyboard-shortcuts-mus1019/mac）。
- [推断 → long-play] 专辑页结构（桌面）：顶部大图（约 240–320px）置于左侧或居中，右侧/下方=专辑名（Large Title）、艺人、发行年份、时长/曲数、描述；操作行=主要 Play 按钮 + Shuffle + More；下方=曲目列表（编号或显式符号、标题、艺术家（若多艺人合辑）、时长列）。滚动时标题栏可做 sticky 收窄（Apple Music 的粘性头部 [推断]）。

### 1.5 封面取色 / 背景调色与模糊（Artwork-derived tint & blur）

- [验证] HIG Materials 定义了标准材料体系（blur + vibrancy + blending modes）：`ultraThin/thin/regular/thick` 四档透明度，用于内容层；浮在媒体背景上的组件可用更透明的 clear 材质，让视觉丰富的背景透出，获得沉浸感；为保住文字可读性，明亮背景下要在 clear 材质背后叠 35% 不透明度的暗色压暗层；要尊重用户 Reduce Transparency / Increase Contrast 系统设置，系统设置改变时材质外观会相应变化（src: https://developer.apple.com/design/human-interface-guidelines/materials）。
- [验证] 苹果材质系统还配套 vibrant label（primary/secondary/tertiary），专为叠在材质上保持对比度设计（同上 URL）。
- [推断 → long-play] 从封面采样 2–4 个代表色，生成径向渐变/平均色作为页面/播放器背景；前景文字和控件平台放在半透明 blur 材质（Tailwind 下即 `backdrop-blur` + 透明度）上，并压低亮度保证白字对比度。采样与着色在前端做即可（Canvas/`getImageData`，Electrobun 内无跨域限制；Web 端注意 CORS）。为 Lighthouse/性能考虑，将采样结果缓存成每张专辑的低清调色板。始终提供"普通深色背景"的降级方案（对齐 HIG"媒体亮底必须提供不透明替代背景"的建议 [推断]）。

### 1.6 排版（Typography）

- [验证] HIG：iOS 默认正文 17pt、最小 11pt；macOS 默认 13pt、最小 10pt；系统字体 San Francisco（SF）；Large Title 是最大标题层级——iOS xSmall 档 31pt、AX1 档 44pt；macOS Large Title 26pt；Title/Headline/Body 逐级缩小；强调体多为 Bold/Semibold（src: https://developer.apple.com/design/human-interface-guidelines/typography）。
- [验证] 避免过细字重（Ultralight/Thin/Light），优先 Regular/Medium/Semibold/Bold；同一界面少用字体族；文字层级随用户字号设置等比缩放（Dynamic Type），布局在 310% 字号下仍可换行（src: https://developer.apple.com/design/human-interface-guidelines/typography 与 https://developer.apple.com/design/human-interface-guidelines/accessibility）。
- [推断 → long-play] 采用 SF 风格 sans-serif 栈（`system-ui, -apple-system, "SF Pro Display", "Inter", sans-serif`）；专辑页标题用粗 Large Title（约 34px，iOS default 档的常见值 [推断]）；曲目行正文约 15–16px；时长/元数据用次级灰色 13px；行距适度（HIG 建议正文留足多读行距）。

### 1.7 Hover 状态

- [验证] Apple Music 的 hover 惯例（用户指南确认）：悬停到歌曲/专辑行 → 浮现播放按钮；悬停 MiniPlayer 封面 → 浮现播放控制（src: https://support.apple.com/guide/music/use-music-miniplayer-mus71d7dcfce/mac 与 play-songs-from-your-library 页）。
- [验证] macOS 侧栏行高、文本与字形尺寸分 small/medium/large 三档（HIG sidebars，同上 URL）——桌面端菜单/侧栏需要 hover 高亮 + 选中态高亮。
- [推断 → long-play] hover 只做"渐进披露"：默认行显示序号或封面色块，hover 换成 Play 图标；选中/正在播放行保持高亮；悬停的交互元素不小于 44px 热区（对齐 HIG 触控目标建议，避免桌面端习惯导致的移动端踩空——见 3.3）。鼠标悬停效果需配合 `@media (hover: hover)` 判断，避免触屏设备 sticky-hover 卡死 [推断]。

### 1.8 播放中曲目指示（Playing-track indicator）

- [验证] Apple Music 提供"在列表中显示正在播放的歌曲"（Command-L 快捷键），并支持左右箭头在曲目间跳转（src: https://support.apple.com/guide/music/keyboard-shortcuts-mus1019/mac），即存在明确的"当前曲目"概念用于列表联动。
- [验证] 可访问性上，一组相关元素里被样式突出为"当前项"的元素应标注 `aria-current`（MDN：`aria-current` 用于标记集合中的当前条目，如面包屑当前页、步骤条当前步；只有一项可标 current）（src: https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Attributes/aria-current）。
- [推断 → long-play] 视觉上采用 Apple Music 通用惯例：正在播放行以主题色高亮，并在曲目序号位置放一组 3–4 根竖直小条做 60fps 等幅动画（播放时跳动、暂停时定格）；该动画默认开启，且在 `prefers-reduced-motion: reduce` 下退化为静态图标（src: https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion）。同时加上 `aria-current="true"` 和 aria-label（如"正在播放：曲目名"），让读屏用户获得等价信息。

---

## 2. Album-only 播放的交互设计

核心命题：**整张专辑顺序播放不是"一个个播放的拼接"，而是一种产品承诺**。下面每项都给出"Apple Music 做了什么（验证）→ long-play 应该怎么做（建议）"。

### 2.1 Play 按钮语义：播放整张专辑

- [验证] Apple Music 的专辑/歌曲统一入口是"悬停→点播放按钮"；专辑内容按专辑内顺序播放（src: https://support.apple.com/guide/music/play-songs-from-your-library-muscb1e04acf/mac 与 https://support.apple.com/guide/music/shuffle-or-repeat-songs-mus2989/mac）。
- [建议] 专辑页的 primary CTA 恒为 "Play/播放专辑"：从第 1 轨开始、按官方曲目顺序播放【推荐】。若该专辑正是当前会话正在播放的对象，按钮进入次级态提供 "Resume（从暂停处继续）" 和 "Play from Track 1（从头重播）" 两个选择（下拉或两次点击），避免用户想"接着听"却被拉回开头 [推断]。
- [建议] 专辑卡片（列表/网格里的封面缩略图）悬停/轻点显示与专辑页相同的 Play 图标，保持单一语义："按专辑顺序播放"。

### 2.2 队列语义：专辑即队列（The album IS the queue）

- [验证] Apple Music 的队列模型：可把歌曲/专辑 "Play Next" / "Add to Queue"；正在播专辑时若切去播另一张专辑，播完新专辑后"Music 会恢复播放原来的歌单"（src: https://support.apple.com/guide/music/queue-your-songs-musb1e6d1c76/mac）。即 Apple Music 里队列是全局的、可嵌套的。
- [验证] 队列面板分 History / Queue 两段；可拖拽排序、按 Delete 移除、"Clear" 一键清空；队列在退出 app 后自动保存（同上 URL）。
- [建议 → long-play（差异化）] 队列 = 专辑曲目本身：
  - "播放另一张专辑" = 用新专辑替换当前队列（不是叠加）。替换发生在"当前曲目播完"或"立即"可由用户二选一（默认立即，配一个 5 秒内可撤销的 toast）[推断]。
  - 不提供任何"加入单曲/单曲队列"入口——这是产品与 Apple Music 的核心差异点，反而让"按下播放=听完整张"这个心智模型极干净。
  - 保留队列面板的善用部分：History 段、拖拽排序（仅在该专辑内部）、"Clear/恢复专辑顺序"（把乱序/跳过痕迹一键还原为官方顺序）。
  - 队列状态持久化：刷新/重启后记忆"播到哪一首、进度多少"（对齐 Apple Music 保存队列的做法）[验证于同一 URL]。

### 2.3 Shuffle 专辑（可选但推荐）

- [验证] Apple Music 区分两档 shuffle：`Shuffle 当前曲目列表`（专辑内随机）和 `Shuffle Albums`（专辑内保持顺序、专辑间随机）；专辑页 More 菜单里有 "Shuffle [专辑名]"；选中专辑后点播放条上的 Shuffle 按钮也可快速洗牌；Shuffle 开启时按钮变色（src: https://support.apple.com/guide/music/shuffle-or-repeat-songs-mus2989/mac）。
- [建议] long-play 只做第一档：**专辑内洗牌**（track order 打乱但仍在同一张专辑内）【推荐】。入口放两处：专辑页 Play 旁的次级按钮 + Now Playing/MiniBar 的 shuffle toggle；开启后按钮以主题色高亮（对齐 Apple Music 的"变色即开启"约定）。"Shuffle Albums（一张洗完随机接另一张）"属于"专辑结束后行为"的选项（见 2.8），先不做。

### 2.4 专辑内自动续播（Auto-advance）

- [验证] 专辑/列表播放时曲目无缝自动接续是 Music 的默认行为（队列机制、没有 gap 的描述、Play/next 列表语义）[推断自 2.2/2.5 引用的官方页]。
- [建议] 曲目自动推进：Track N 结束 → 无缝接 Track N+1（同源文件可 gapless，建议预留 crossfade 开关为进阶项）。推进瞬时更新：Media Session 元数据、minibar 文案、专辑页当前行高亮、aria-live 播报（见 3.2）。

### 2.5 单曲跳过：允许，但在专辑边界内（Per-track skip）

- [验证] Music 明确支持 "播放列表/专辑中上一首/下一首"（左右箭头键），也支持在当前曲目内前后拖动进度（Option-Command-左右箭头，以及进度滑杆）（src: https://support.apple.com/guide/music/keyboard-shortcuts-mus1019/mac）。
- [建议] 跳过依然被允许——它不破坏"专辑即队列"：Next 永远停在专辑内下一首（不会跳到别的专辑）；Previous 的规则采用播放器惯例 [推断]：播放 >3–5 秒时先回到本曲开头，在开头处再按才回上一首（等同播客/主流播放器行为）。跳过不会改变专辑顺序，只是把"指针"前移；只有主动「洗牌/恢复顺序」才改变顺序。这让长专辑（如 20 轨概念专辑）可听可跳，又不破坏整听承诺。

### 2.6 Up Next（接下来播什么）

- [验证] Apple Music 的 "Playing Next" 面板：Queue 段列出接下来要播的曲目、History 段列出最近播过的；可从面板直接双击跳播（src: https://support.apple.com/guide/music/queue-your-songs-musb1e6d1c76/mac）。
- [建议 → long-play] Up Next 面板 = 当前专辑剩余曲目清单，头部写明"正在播放：专辑 X（Track 3 of 12）"；点击任意曲目 = 跳到该轨并继续按顺序播完剩余部分（符合"专辑即队列"线性心智）。面板置于全屏 Now Playing 的下半区或侧抽屉（桌面）【推荐】；History 段保留在面板底部帮助用户回溯。不做"Play Next 插入单曲"（产品内无单曲入口）。

### 2.7 MiniBar 如何传达上下文

- [验证] MiniPlayer 以"正在播放歌曲的封面 + 播放控制 + 进度"为最小信息集，封面即专辑身份（src: https://support.apple.com/guide/music/use-music-miniplayer-mus71d7dcfce/mac）。
- [建议 → long-play] 迷你条一行三个信息层次：**标题（当前曲目）> 专辑名 — 艺术家（当前专辑上下文）> 进度**；再外挂一个轻量"N/12"或专辑环形进度小徽标，让用户在任意页面都立刻知道"我在专辑的第几首"【推荐】。点击封面/标题 → 展开全屏 Now Playing；迷你条材质用 blur + 半透明，压暗保证对比（1.5）。

### 2.8 专辑结束后：怎么办（The album end）

- [验证] Apple Music：队列播完且 AutoPlay 关闭 → 停止；AutoPlay 开启 → 自动接续"相似歌曲"；若专辑是播单过程中的临时切换 → 播完自动恢复原播单（src: https://support.apple.com/guide/music/queue-your-songs-musb1e6d1c76/mac）。HIG 也提示：不要让媒体在无用户意图下自动播放，须提供可发现的停止/开始控制（src: https://developer.apple.com/design/human-interface-guidelines/accessibility 与 playing-audio）。
- [建议 → long-play] 默认行为 = **播完停止**：不接歌、不插广告、不推荐立即播放（让完整听完一张专辑成为"完整的体验"）【推荐】。同时：
  - Now Playing 进入"专辑播完"完成态：封面留驻、中央按钮变为 Replay（重播整张专辑）、下方提供 **Repeat Album**（循环整张）与 **Play a similar album（后续版本）** 两个显式选项。
  - Repeat Album 为独立 toggle（不是隐藏选项）：对齐 Apple Music 的 Repeat 按钮三态（off / repeat all / repeat one，src 同上 2.3 URL）。long-play 建议只保留 off / repeat all 两态，去掉 repeat one——单曲循环与产品精神冲突 [推断]。
  - "推荐下一张"做成**用户主动选择**的行为而非自动播放：播放结束画面显示"你可能也喜欢"一张专辑卡片，点击才播放（或进入队列）。
  - 桌面端若追求"电台式连续听"，可后期加 opt-in 的"自动接续相似专辑"开关，默认关闭。

---

## 3. 键盘快捷键与可访问性

### 3.1 键盘快捷键（Keyboard Shortcuts）

**Apple Music（macOS）的官方快捷键**（全部 [验证]，src: https://support.apple.com/guide/music/keyboard-shortcuts-mus1019/mac）：

| 动作 | Apple Music 快捷键 |
| --- | --- |
| 播放/暂停（选中条目） | 空格 Space |
| 从开头播放所选歌曲 | Return |
| 停止 | Command-Period |
| 曲目内前进/后退 | Option-Command-左/右箭头 |
| 列表内下一首/上一首（播放中） | 右箭头 / 左箭头 |
| 在列表中定位当前播放歌曲 | Command-L |
| 打开队列（Playing Next） | Option-Command-U |
| 上一张/下一张专辑 | Option-左/右箭头 |
| 音量增减 | Command-上/下箭头 |
| 打开/关闭 MiniPlayer | Option-Command-M / Shift-Command-M |
| 打开/关闭 Full Screen Player | Shift-Command-F |
| 快速洗牌（Genius Shuffle） | Option-空格 |

**long-play 对应的网页快捷键映射（建议）**，Mac 用 Command（⌘），Windows/Linux 用 Ctrl：

- 空格 / K：播放/暂停（全局生效，但焦点在文本输入框/搜索框时不拦截）【推荐】
- 右箭头 / N / Media Next：下一首（专辑内）；左箭头 / P / Media Prev：回到本曲开头或上一首（2.5 的规则）
- Option/Ctrl-右/左箭头 或 Shift-N/P：上一张/下一张专辑（从专辑列表上下文）【推荐】
- Command/Ctrl-L：定位当前播放曲目（滚动专辑页到当前行并高亮）【推荐，对齐 Apple Music】
- Command/Ctrl-U 或 J：打开队列/Up Next 面板【推荐】
- Command/Ctrl-Shift-F：全屏 Now Playing【推荐，对齐 Apple Music 的 Shift-Command-F】
- Command/Ctrl-M：开/关迷你条【可后置】
- ? 或 /：打开快捷键帮助覆层【推荐，低成本高回报的发现性设计】
- 媒体键（播放/暂停、上一首、下一首、快退、快进、seekto）：用 Media Session API 绑定，`setActionHandler('play'/'pause'/'previoustrack'/'nexttrack'/'seekbackward'/'seekforward'/'seekto')`（src: https://developer.mozilla.org/en-US/docs/Web/API/Media_Session_API）。**注意 HIG 明确反对改定义系统媒体控制语义**（src: https://developer.apple.com/design/human-interface-guidelines/playing-audio）。

MDN 对可键盘导航组件的约束 [验证]（src: https://developer.mozilla.org/en-US/docs/Web/Accessibility/Keyboard-navigable_JavaScript_widgets）：

- 尽量用原生 `<button>`/`<a>`（键盘可达性免费获得）；自制组件用 `tabindex="0"` 入列、`tabindex="-1"` 出列，绝不使用正数 `tabindex`。
- 组内（如曲目列表）方向键导航用 roving tabindex 或 `aria-activedescendant`：父容器入 tab 序，子项全部 `tabindex="-1"`，键盘处理把焦点/虚拟焦点移到当前项。
- 永远不要无条件 `outline: none`；用 `:focus-visible` 只在键盘聚焦时显示 focus ring。
- 键盘与鼠标要共享同一份行为代码（键盘也要能 Enter 触发、方向键导航）；拦截了按键就应 `preventDefault()` 阻止浏览器默认滚动等行为。

### 3.2 可访问性（Accessibility）

**对比度（Contrast）**（[验证] src: https://developer.apple.com/design/human-interface-guidelines/accessibility 与 https://developer.mozilla.org/en-US/docs/Web/Accessibility/Understanding_WCAG/Perceivable/Color_contrast）：

| 内容 | 最低对比度（AA） | 增强（AAA） |
| --- | --- | --- |
| 正文 | 4.5:1 | 7:1 |
| 大字号文字（约 ≥18pt 或 14pt bold） | 3:1 | 4.5:1 |
| UI 组件/图形/图标 | 3:1 | — |

- 文字压封面/渐变色上时，对比度按"实际合成后的底色"计算；要在亮封面上自动给文字加压暗 scrim 或材料层（1.5），并支持 Increase Contrast 时切换为不透明深色背景。
- 不只靠颜色传达状态：正在播放行要同时用图标 + 颜色（高亮 + 均衡器图标 + `aria-current`）；Shuffle/Repeat 开启用变色 + 图标态（如数字"1"）双信号（Apple Music 的 repeat-one 也是"图标 + 数字"双信号 [推断 自 2.3 引用页]）。

**语义与读屏**：

- 图标按钮必须带 aria-label（"播放""暂停""下一首""打开队列"），HIG 要求提供有意义的 label/hint（src: https://developer.apple.com/design/human-interface-guidelines/accessibility）。
- 开关类按钮（Shuffle/Repeat）用 `aria-pressed` 表达 pressed 态，且**保持 label 不变**（不要播放/暂停换字，MDN 明示）（src: https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Attributes/aria-pressed）。
- 当前曲目行用 `aria-current="true"`（src: https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Attributes/aria-current）。
- 曲目切换时用 `aria-live="polite"` 的区域内播报"正在播放：标题 — 艺术家"（不打断用户，仅在空闲时播报）[推断，属常见无障碍实践]。
- 页面结构用语义 landmark / 分级 heading（`<nav>`/`<main>`/`h1`）便于跳转；首个链接放"跳过导航"跳转锚点 [推断]。

**触控与目标尺寸** [验证 HIG accessibility]：iOS 默认 44×44pt、最小 28×28pt；macOS 默认 28×28pt、最小 20×20pt；有边框控件周围留约 12pt 间隙、无边框元素周边留约 24pt。long-play 统一按 44px 做主要交互，只有次级装饰（如序号、显式标记）可小。曲目行整行可点（整行热区），而不是只点小 button——降低误触。

**媒体播放的可访问性**（[验证] HIG accessibility 认知章节 + playing-audio）：不无用户手势自动播放；给予明确、可发现的开始/停止控制；支持系统级媒体键与锁屏控制（Media Session）；中断（来电）时暂停、结束按类型决定是否恢复；停止后清除系统 Now Playing 里的过期状态。

**动效**（[验证] HIG accessibility 认知章节 + MDN prefers-reduced-motion）：尊重 `prefers-reduced-motion: reduce`——均衡器动画退化为静态图标、切换专辑页的过渡用淡入淡出而非位移动画；避免无意义循环动画。

**文字缩放与布局**：布局在 200–310% 字号下不丢信息、不截断关键文案（专辑名、曲目名换行而非截断）；大字号时次要列（时长）允许隐藏或堆叠 [推断]。

---

## 4. 响应式布局（Responsive Layout）

### 4.1 Apple 的规模分级依据（verified facts）

- [验证] HIG 用 size classes 描述尺寸：`regular`（大屏/横屏）与 `compact`（小屏/竖屏）；iPhone 竖屏为 compact width；iPad 全尺寸始终 regular width；iPhone 横屏（除小屏机型）为 regular width（src: https://developer.apple.com/design/human-interface-guidelines/layout）。
- [验证] 导航随宽度自适应：iPadOS 的 tab bar 可以在 tab bar（顶部）与 sidebar 之间转换（`sidebarAdaptable`）；iOS 底部 tab bar 在竖屏是"图标在上、文字在下"，横屏/regular 是"图标在左、文字在右"（src: https://developer.apple.com/design/human-interface-guidelines/tab-bars）。
- [验证] "能撑开就不切紧凑视图"：用户重设窗口大小时，尽可能推迟切换到紧凑布局——优先收窄内容列而不是换导航形态（src: https://developer.apple.com/design/human-interface-guidelines/layout）。
- [验证] MiniPlayer 在 iOS 浮在 tab bar 之上，向下滚动时可收缩进 tab bar（src: tab-bars URL 同上）。

### 4.2 桌面（Desktop，≥ ~1100px）

```
┌────────┬──────────────────────────────────────────────┐
│ Sidebar│  ┌──────────┐  Album Title  (Large Title)   │
│ (icon+lbl)│  封面大图   │  Artist · 2026 · 12 tracks    │
│  Library │  └──────────┘  [ Play ] [ Shuffle ] ...    │
│   Albums │   ┌──────────────────────────────────┐    │
│   Artists│   │ 1  Track One               3:42   │    │
│  Search  │   │ 2  Track Two             4:01  ▶ │    │
│  Browse  │   │ 3  Track Three           2:58     │    │
│   New    │   └──────────────────────────────────┘    │
│   Radio  │                                            │
│  Settings│                                            │
├──────────┴────────────────────────────────────────────┤
│ [cover] Track Four · Album — Artist      3:01  ♪ Q  │
│ ────────────●─────────────────  ⏮  ▶  ⏭  [=]       │
└───────────────────────────────────────────────────────┘
```

- 结构 = 左侧 sidebar + 右侧主内容区 + 底部常驻迷你条（`grid-template-columns: 240px 1fr`）。
- 专辑页为宽屏双栏：左 封面大图，右 标题/元数据/操作；曲目列表在下方整幅宽度。
- sidebar 允许用户折叠（HIG 允许隐藏 sidebar，避免默认隐藏），折叠后内容区全宽，迷你条不受影响 [验证 折叠于 sidebars URL；布局建议为推断]。

### 4.3 移动端（Mobile，≤ ~700px，compact width）

```
┌──────────────────────────┐
│ ▴                        │   Now Playing (全屏/主界面)
│   ┌─────────────┐        │
│   │  封面大图    │        │  背景=封面取色+blur
│   └─────────────┘        │
│   Track Four             │
│   Album — Artist         │
│  ───────────●──── 3:01   │
│   ⏮     ▶     ⏭         │
│  [ Up Next / 队列列表 ]   │
├──────────────────────────┤
│ [迷你条: 封面 曲目  ▶ ]  │  mini bar (tab bar 附件)
├──────────────────────────┤
│  首页   浏览   我的库     │  tab bar (图标+文字)
└──────────────────────────┘
```

- 导航 = 底部 tab bar（3 个 tab 以内，对齐 HIG"少 tab 易用"）[验证 tab-bars URL]；MiniPlayer/迷你条以 accessory 形式浮在 tab bar 上方（[验证] tab-bars URL 中的 Music 截图）。
- 专辑页 = 上下滚动单栏：封面大图顶置 + 标题/元数据 + Play/Shuffle + 曲目列表；页面背景用封面取色 tint。
- 点击迷你条 → 上滑展开全屏 Now Playing（独立路由或全屏 modal，ESC/下拉关闭）。
- 触控热区 ≥44px；页面使用安全区（safe area）避免遮挡刘海/手势条 [验证 layout URL 的安全区概念]。

### 4.4 平板中间态（Tablet / 可调窗口，约 700–1100px）

```
┌──────────────────────────────────────┐
│ [ tab bar (顶部) 或 折叠 sidebar ]  │  iPadOS 采用顶部 tab bar [验证]
│  ┌──────────┐  Album Title          │
│  │ 封面     │  Artist · 2026        │
│  │          │  [ Play ] [Shuffle]   │
│  └──────────┘  ✔ Track 1   3:42     │
│                 Track 2   4:01      │
│                 Track 3   2:58      │
├──────────────────────────────────────┤
│ 迷你条                              │
└──────────────────────────────────────┘
```

- 宽度介于中间态时：优先保留双栏布局，把 sidebar 收成顶部 tab bar / 可转换 sidebar（`sidebarAdaptable`），而不是立刻退化成手机单栏（HIG 明确建议"延后切换到紧凑视图"）[验证 layout URL]。
- 专辑页在 700–1100px 下保持双栏头部；只有小于 700px 才转单栏堆叠 [推断]。

### 4.5 落地到 Tailwind 4 的断点建议 [推断]

- ≤ 640px（sm 以下）：移动单栏 + 底部 tab bar + 迷你条；全屏 Now Playing 为主播放界面。
- 640–1023px：双栏专辑页头部；sidebar 隐藏，用顶部 tab bar 导航。
- ≥ 1024px：sidebar 常驻 + 底部迷你条；专辑页宽屏双栏。
- 关键基线：迷你条高度约 64–72px、tab bar 约 48–56px、安全区 padding 依 `env(safe-area-inset-*)` 处理。

---

## 5. MVP 的 UI/UX 建议清单

按"先立骨架、再提质感"排序；括号内为对应章节。

**P0 —— 必须先对的产品骨架**

1. **专辑即队列的播放引擎语义**（2.2）：Play 专辑 → 替换队列；队列视图 = 专辑剩余曲目；无单曲加入入口；队列/进度持久化。这是产品差异化的根。
2. **桌面三区骨架**（4.2）：sidebar + 内容区 + 底部迷你条；迷你条 = 封面上下文 + 进度 + 控制，点击展开全屏 Now Playing（4.3）。
3. **移动端结构**（4.3）：底部 tab bar + 迷你条附件 + 全屏 Now Playing 主界面；专辑页单栏。
4. **专辑页**（1.4/2.1）：大封面 + 标题 + Play/Resume + Shuffle + 有序曲目列表（时长列、当前行高亮）。
5. **Media Session 接入**（1.3/3.1）：title/artist/album/artwork 元数据 + play/pause/prev/next/seek 系统媒体键；Electrobun 桌面 shell 下必须，否则锁屏/耳机不可控。
6. **全局快捷键**（3.1）：Space/K 播放暂停、N/P 前后曲目、Cmd/Ctrl-L 定位当前曲目、Cmd/Ctrl-U 队列、? 帮助。焦点在输入框时不拦截。

**P1 —— 立刻提升 Apple Music 质感**

7. **封面取色背景 + blur 材质**（1.5）：专辑页与 Now Playing 用封面调色渐变 + `backdrop-blur` 控件层；亮封面自动压暗；保留纯深色降级。
8. **正在播放行**（1.8）：主题色高亮 + 动效均衡器条（`prefers-reduced-motion` 降级静态）+ `aria-current`。
9. **hover 渐进披露**（1.7）：行内 Play 按钮悬停浮现；迷你条封面悬停浮现控制；`@media (hover:hover)` 区分触屏。
10. **Accessibility 基线**（3.2）：4.5:1/3:1 对比度、44px 热区、aria-label / aria-pressed / aria-live 播报、语义 landmark、`:focus-visible` 焦点环。

**P2 —— 打磨与后续**

11. **专辑结束态**（2.8）：播完停止的完成视图 + Replay + Repeat Album toggle；"相似专辑推荐"仅用户点击后播放（后续版本）。
12. **Up Next 面板**（2.6）：剩余曲目 + Track 3 of 12 定位感 + History 段 + 恢复专辑顺序。
13. **专辑内洗牌**（2.3）：专辑页与迷你条的 shuffle toggle（变色即开启）。
14. **可调窗口/平板适配**（4.4）：≥700px 保持双栏、导航 sidebar↔tab bar 转换；Tailwind 断点 ≤640 / 640–1023 / ≥1024。

**不做的（明确拒绝）**：单曲队列/加入单曲（2.2）、Repeat one 单曲循环（2.8）、自动续播下一张（2.8，需 opt-in 才考虑）、Shuffle Albums 跨专辑洗牌（2.3，后续）。

---

*来源汇总：Apple HIG（Typography / Accessibility / Sidebars / Tab bars / Materials / Layout / Playing audio）、Apple Music User Guide for Mac（MiniPlayer / Keyboard shortcuts / Queue / Shuffle-repeat / Play songs / Welcome）、MDN（Color contrast / Keyboard-navigable widgets / aria-current / aria-pressed / prefers-reduced-motion / Media Session API）。文中每项均已内联注 URL。*