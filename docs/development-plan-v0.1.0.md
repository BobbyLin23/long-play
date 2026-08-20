# long-play v0.1.0 开发计划

> 制定日期：2026-08-20
> 版本目标：**v0.1.0**（第一个可用的 MVP）
> 范围：① Apple Music 风格的播放器界面 ② 音乐播放功能 ③ 用户登录 + 用户创建收藏列表
> 产品硬约束：**不支持单曲搜索、不支持单曲收藏**，只能播放整张专辑（收藏粒度 = 专辑）
> 存储策略：**不存放任何音源文件**，音频全部经在线 API 拉取，仅做临时分层缓存（详见 §3.2）
>
> 前置依据：
> - [技术调研总报告](./music-player-research.md)（及 Part 1–4 子报告）
> - 本仓库现有代码基础（SvelteKit + Elysia/oRPC + Drizzle/Neon + Better-Auth）

---

## 0. 执行摘要（TL;DR）

| 问题 | 结论 |
| --- | --- |
| v0.1.0 做什么 | 只做「Web 端」的三件事：Apple Music 风格界面、整张专辑顺序播放、登录 + 收藏列表（收藏专辑）。Electrobun 桌面打包留到 v0.2.0（需先真机验证 Media Session，见调研报告 Part 4） |
| 数据怎么存 | 新增 4 张表：`albums`、`tracks`（精选目录，种子脚本从 Jamendo/IA 抓取；开发期用 SoundHelix 占位）、`playlists`（用户收藏列表）、`playlist_items`（专辑 ↔ 列表，带顺序）。收藏粒度固定为"专辑"，**无单曲搜索/收藏**（产品硬约束）。**元数据缓存**在 DB（种子一次性抓取，播放期不再打上游 API）；**音频流缓存**走 L1 浏览器 HTTP 缓存 + L2 服务器磁盘 LRU（临时、可驱逐，不属于"存放音源文件"，详见 §3.2） |
| 播放怎么实现 | 浏览器 `<audio>` 双元素预载 + Svelte 5 runes 单例 store（`player.svelte.ts`）；流媒体**经 Elysia Range 代理**（`/proxy/audio/:trackId`）统一拉流，透传 206/Content-Range；Media Session 接系统媒体键。全部依据调研报告 Part 2 |
| 界面怎么做 | 桌面三区骨架（Sidebar + 内容区 + 底部迷你条）+ 移动端 tab bar + 全屏 Now Playing；专辑页大封面 + 曲目列表；封面取色 + blur 材质。全部依据调研报告 Part 3 |
| 怎么排期 | 6 个里程碑（M0–M5），约 2–3 周单人/双人工作量；每个里程碑有独立验收标准 |
| 建议执行方式 | 本仓库是 agent 友好环境（.agents/skills 里有 elysiajs / better-auth-best-practices / turborepo 技能），可把各里程碑拆给子 agent 并行推进，主 agent 负责 M0 基线和联调 |

---

## 1. 现状盘点（已核实的代码基础）

| 模块 | 现状 | v0.1.0 需要做的 |
| --- | --- | --- |
| `apps/web` | SvelteKit 5 + Svelte 5 runes + Tailwind 4 + TanStack Query + oRPC client + better-auth svelte client；`adapter-static` 已配置；只有默认主页（API Status 检查页） | 重写布局与页面 |
| `apps/server` | Elysia (Node 适配器) @ :5172，已挂载：`/api/auth/*`（better-auth）、`/rpc*`（oRPC）、`/api-reference*`、CORS 已配 | 新增音频代理路由 + 目录/收藏列表 oRPC 路由 |
| `packages/db` | Drizzle + Neon HTTP；schema 只有 better-auth 4 表（user/session/account/verification），已有 0000 迁移 | 新增 music 相关 4 表 + 迁移 |
| `packages/auth` | better-auth，邮箱密码登录已启用，drizzle adapter 已接 | 基本不用动；前端补登录/注册页 |
| `packages/api` | oRPC：`publicProcedure`（healthCheck）+ `protectedProcedure`（privateData，session 守卫已实现） | 新增目录 + 收藏列表的 procedure 组 |
| `packages/env` | server: DATABASE_URL/BETTER_AUTH_*/CORS_ORIGIN；web: PUBLIC_SERVER_URL | 新增 JAMENDO_CLIENT_ID 等可选变量 |
| `apps/desktop` | Electrobun 骨架就绪约 80%，未验证 Media Session OS 集成 | **不在 v0.1.0 范围** |
| `docs/` | 四份子报告 + 总报告，架构决策已完整 | 本计划文档 |

**关键技术决策（直接采用调研报告结论，不再重议）：**
1. 音频方案：`HTMLAudioElement` 为主，**双元素预载**实现专辑内无间隙连播，`ended → next → finishAlbum`。
2. 流媒体：**Elysia Range 代理**（`/proxy/audio/:trackId`，按 track id 查库拿上游 URL，不透传任意 URL 以避免开放代理），上游 SoundHelix/Jamendo 均支持 206。
3. 播放状态：Svelte 5 runes 模块级单例 store（用 getter 对象导出，规避裸 `$state` 外部重赋值问题）。
4. 队列语义：**专辑即队列**。播放一个专辑 = 队列 = 该专辑曲目列表；播放一个收藏列表 = 列表内各专辑按序连播。
5. 界面：深色主题、SF 风格字体栈、封面取色渐变 + `backdrop-blur` 材质（亮色封面叠 35% 压暗层保对比度）。
6. 交互细节按调研报告 Part 3 §2 落地：Play 恒为整张专辑、专辑内 Next/Prev、Shuffle 只做专辑内洗牌、专辑播完默认停止（Replay + Repeat Album 两态）、无单曲入口。
7. 缓存：**不存储音源文件**；音频流只做临时分层缓存（L1 浏览器 HTTP 缓存 + L2 服务器磁盘 LRU + P1 的 L3 对象存储），元数据缓存由 DB 目录表承担（详见 §3.2）。

---

## 2. 数据模型设计

新增 `packages/db/src/schema/music.ts`，在 `schema/index.ts` 导出。

```ts
// 目录：一张专辑（来源可为 jamendo / archive / soundhelix）
albums: {
  id: uuid PK,
  source: 'jamendo' | 'archive' | 'soundhelix',   // 来源标识
  externalId: text,                                // 上游专辑 ID（Jamendo album id / Archive identifier），
                                                   // (source, externalId) 唯一 → 幂等去重
  title, artist, year?: int,
  coverUrl: text,                                  // 封面（Jamendo image / Archive image 页）
  license?: text,                                  // license_ccurl / licenseurl，用于白名单筛选
  createdAt, updatedAt
}
unique index (source, externalId)

// 目录：专辑内曲目
tracks: {
  id: uuid PK,
  albumId: uuid FK → albums.id (cascade),
  position: int,                                   // 官方曲序，从 1 起
  title: text,
  durationSec?: int,                               // 来自上游元数据
  streamUrl: text,                                 // 上游规范音频 URL（代理按此拉流）
}
unique (albumId, position)

// 用户收藏列表（"收藏列表" = 收藏专辑的有序列表）
playlists: {
  id: uuid PK,
  userId: text FK → user.id (cascade),
  name: text,
  description?: text,
  createdAt, updatedAt,
  isDefault?: boolean,                             // 预留："我的收藏"默认列表（可选）
}
index (userId)

// 列表条目（专辑 ↔ 列表）
playlist_items: {
  id: uuid PK,
  playlistId: uuid FK → playlists.id (cascade),
  albumId: uuid FK → albums.id (cascade),
  position: int,
  addedAt: timestamp,
}
unique (playlistId, albumId)                       // 同一专辑不可重复收藏
unique (playlistId, position)
```

**设计说明：**
- **收藏粒度 = 专辑**：产品定位是"只支持整张专辑顺序播放"，收藏列表收藏专辑（Apple Music 中相当于把整张专辑加入资料库）。播放收藏列表 = 列表内专辑依次连播。
- **产品硬约束：不支持单曲搜索、不支持单曲收藏**——目录只到专辑级，`tracks` 仅作为专辑内部顺序播放使用，不暴露任何单曲级入口（无单曲搜索接口、无单曲收藏字段、播放器 UI 无单曲操作）。
- 目录为什么入库而不是运行时拉 API：① Browse/收藏列表需要稳定可查的专辑集合；② 收藏需要 FK 完整性；③ 种子脚本一次抓取，之后播放器只按 trackId 代理拉流，运行时不再打上游 API（省 Jamendo 35,000 次/月配额）。
- 迁移流程：`pnpm run db:generate`（生成迁移）→ `pnpm run db:push`（应用）。沿用 drizzle-kit，已配好 `drizzle.config.ts`（指向 `apps/server/.env`）。

---

## 3. 后端任务清单

### 3.1 新增包 `packages/music`（上游 API 客户端）

新建 workspace 包 `packages/music`，依赖 `zod`：
- `src/jamendo.ts`：Jamendo v3 客户端。`searchAlbums()`（`/albums/tracks` 一次拿全辑）、`albumDetail(id)`；返回统一类型 `AlbumMeta { source, externalId, title, artist, year, coverUrl, license, tracks: TrackMeta[] }`。需要 `JAMENDO_CLIENT_ID`（可选：无 Key 时走 SoundHelix 占位目录）。
- `src/archive.ts`：Internet Archive 客户端。按白名单 collection（`78rpm` / `etree` / `freemusicarchive`）检索 + `licenseurl` 筛选，组专辑模型。**v0.1.0 可只做 Jamendo + SoundHelix，Archive 作为 P1 扩展**。
- `src/types.ts`：统一 AlbumMeta / TrackMeta 类型。
- 幂等种子：`scripts/seed-catalog.ts` —— 抓取 N 张（建议 20–50 张）精选专辑写入 `albums`/`tracks`（`(source, externalId)` upsert 幂等）。开发期额外种入 SoundHelix 17 首占位曲目（3–4 个假专辑，用于无 Key 联调）。

### 3.2 音频代理路由 + 分层缓存（`apps/server/src/audio-proxy.ts`）

**存储策略总原则：不存放任何音源文件。** 音频全部经在线 API 拉取；缓存只是临时加速层，随时可清空、无持久化语义、不构成"音源文件库"。缓存的是「字节片段」，不是「源文件条目」——库里只有专辑/曲目元数据。

按调研报告 Part 2 §4.4 的代码骨架，`GET /proxy/audio/:trackId`：
- 查库拿 `tracks.streamUrl`（查不到回 404；不做任意 URL 透传）。
- 透传客户端 `Range` 头 → `fetch(upstream)`，`set.status`/`set.headers` 透传上游状态码（206/200）与 `Content-Range`/`Accept-Ranges`/`Content-Length`/`Content-Type`，`return response.body` 流式转发。
- 客户端断开时 abort 上游 fetch（Node 适配器需处理资源释放）；上游不支持 Range 时自动回落 200 全量。
- 在 `apps/server/src/index.ts` 挂载，与 CORS 中间件兼容（`credentials: true` 已配）。

**分层缓存设计（L1/L2/L3）：**

| 层 | 位置 | 机制 | 命中效果 | v0.1.0 |
| --- | --- | --- | --- | --- |
| **L1 浏览器 HTTP 缓存** | 用户浏览器 | 代理响应带 `Cache-Control: private, max-age=...` + `ETag`，浏览器对 `<audio>` 的 Range 请求做条件请求缓存 | 重复播放/seek 回看本地命中，零服务器流量 | **做**（默认） |
| **L2 服务器磁盘 LRU** | Elysia 服务器本地目录（`AUDIO_CACHE_DIR`，默认 `./.audio-cache`） | 代理首次拉流后，把**响应字节片段**按 `trackId + 字节区间` 写入磁盘；后续同区间请求先查缓存，未命中才回源。容量上限（如 512MB/2GB）+ LRU 驱逐 + 启动清理 | 多人/多设备重复听同一专辑时省上游流量与延迟；seek 区间复用 | **做**（M2） |
| **L3 对象存储**（P1，不做） | Cloudflare R2 / S3 | 与 L2 相同的片段缓存逻辑搬到对象存储 | 多实例部署时共享缓存 | 后置 |

**实现要点（L2）：**
- 缓存键 = `sha1(trackId + rangeStart + '-' + rangeEnd)`（或直接 trackId 分目录存整段/分片），避免缓存穿透与键爆炸。
- 命中时**只透传字节流，不回源**，仍构造 206 + `Content-Range`；部分命中时回源补区间。
- 驱逐策略：LRU（按最近访问时间）+ 总量水位线；进程启动时清理过期/孤儿文件。
- 目录路径、容量、TTL 进 `packages/env`（`AUDIO_CACHE_DIR`、`AUDIO_CACHE_MAX_MB`，均可选、有默认值）。
- 仅缓存**上游明确允许的**来源（Jamendo storage / SoundHelix 均为公开流，无授权冲突；缓存不改变来源授权属性，仅做技术加速）。
- 不缓存封面/元数据之外的非音频内容。

**为什么不直接让浏览器连上游**：报告已论证（鉴权/限流/换源统一入口、CORS 归一化、web 静态部署无服务器逻辑）。L2 是加在这条代理路径上的纯加速，不改变架构。

### 3.3 oRPC 路由扩展（`packages/api/src/routers/`）

新增 `catalog.ts` 与 `playlists.ts`，在 `routers/index.ts` 合并：

```ts
appRouter = {
  // 现有
  healthCheck, privateData,
  // 目录（public）
  albumList:      publicProcedure.input(分页/zod).handler(→ albums 列表，可含 coverUrl/artist/曲数)
  albumDetail:    publicProcedure.input({ id }).handler(→ 专辑 + tracks[] 按 position 排序)
  // 收藏列表（protected，全部走 session 守卫）
  playlistList:   protectedProcedure.handler(→ 当前用户列表 + 专辑数)
  playlistCreate: protectedProcedure.input({ name, description? })
  playlistRename / playlistDelete: protectedProcedure.input({ id, ... })
  playlistDetail: protectedProcedure.input({ id }).handler(→ 列表 + albums[] 按 position 排序)
  playlistAddAlbum / playlistRemoveAlbum: protectedProcedure.input({ playlistId, albumId })
  playlistReorder: protectedProcedure.input({ playlistId, orderedAlbumIds[] })  // 可选，P1
}
```

- 鉴权复用现有 `protectedProcedure`（`api/src/index.ts` 已实现 session 守卫），无新工作。
- 越权防护：playlist 操作前校验 `playlist.userId === session.user.id`。

### 3.4 env 扩展（`packages/env/src/server.ts`）

- `JAMENDO_CLIENT_ID: z.string().optional()`（开发期可空，空则只用 SoundHelix 目录）。
- `AUDIO_CACHE_DIR: z.string().default("./.audio-cache")`（L2 磁盘缓存目录，可被 `.gitignore` 忽略）。
- `AUDIO_CACHE_MAX_MB: z.coerce.number().default(512)`（L2 容量上限，LRU 驱逐水位）。
- 不做 TTL 化缓存（临时层，靠 LRU + 启动清理），后续需要再演进。

---

## 4. 前端任务清单

### 4.1 播放核心（`apps/web/src/lib/player/`）

- `player.svelte.ts`：模块级单例 store（getter 对象导出）。状态：`album / tracks / index / isPlaying / currentTime / duration / repeatMode`；派生：`currentTrack / hasNext / progress`；动作：`bind(album, tracks) / play / pause / toggle / next / prev / seek / finishAlbum / replayAlbum`。`init()` 绑定 `ended → next`，末轨 `finishAlbum()`（停在末尾，UI 给"重播整张专辑"）。
- `audio-manager.ts`：双 `<audio>` 元素管理。当前轨播时下一轨 `preload="auto"`，`ended` 时 swap（同一专辑内直切，保持连播连续感）。返回统一控制接口。
- `media-session.ts`：`navigator.mediaSession` 封装 —— `metadata`（含多尺寸 artwork 96→512）、`playbackState`、`setActionHandler`（play/pause/nexttrack/previoustrack/seekto）、`setPositionState`；在 store 内用 `$effect` 维护同步。
- `usePlayer.ts`（可选 Svelte 封装）：把 store 绑定到组件生命周期。

### 4.2 页面与路由（`apps/web/src/routes/`）

```
+layout.svelte          重构：桌面三区骨架（Sidebar + 内容 + 底部迷你条）/ 移动端 tab bar + 迷你条
                        内置 <audio> 容器 + player store init
+page.svelte            → Browse：专辑网格（封面 + 专辑名 + 艺人）
album/[id]/+page.svelte 专辑页：大封面 + Large Title + 艺人/年份/曲数 + Play/Shuffle + 曲目列表
playlists/+page.svelte  我的收藏列表：列表卡片 + 新建入口（+ 空态引导）
playlists/[id]/+page.svelte 列表详情：专辑有序列表（可移除/重排/播放整列表）
login/+page.svelte      登录页（邮箱 + 密码，调 authClient.signIn.email）
register/+page.svelte   注册页（authClient.signUp.email + 登录跳转）
settings/+page.svelte   简单设置：用户信息 + 退出登录（P0 最小版）
now-playing/（或全屏 overlay 组件） 全屏 Now Playing：大封面 + 大字标题 + 大进度条 + 大控制
```

### 4.3 组件库（`apps/web/src/lib/components/`）

- `Sidebar.svelte`（桌面）：Library / Browse / Playlists / Settings + 底部用户区（登录状态/退出）。
- `MiniPlayer.svelte`（底部常驻）：封面 → 点击展开 Now Playing；曲目标题 > 专辑名 — 艺术家 > 进度条；播放/暂停 + Next/Prev + "N/12" 徽标。
- `NowPlaying.svelte`：全屏播放页。
- `AlbumCover.svelte`：封面 + 取色（离屏 canvas 抽主色 → CSS 变量喂给背景渐变）。
- `TrackList.svelte`：有序曲目列表。默认显示序号，hover 浮现 Play 图标；当前行主题色高亮 + 动效均衡器条（`prefers-reduced-motion: reduce` 降级静态图标）；`aria-current`。
- `ProgressBar.svelte`：进度条 + seek（复用 `<audio>` 原生 timeupdate/seeked）。
- `PlayButton.svelte` / `ShuffleToggle.svelte`：按钮语义 = 整张专辑播放（调研 Part 3 §2）。
- `EqualizerBars.svelte`：正在播放动效。
- 表单组件：`LoginForm.svelte` / `RegisterForm.svelte` / `CreatePlaylistDialog.svelte`。

### 4.4 数据层与鉴权

- `src/lib/api/`：用 `@orpc/tanstack-query` 封装目录/收藏列表 hooks（`createQuery`/`createMutation`，沿用现有 `orpc.ts` 模式；RPC 已带 `credentials: include`，会话 cookie 自动携带）。
- `src/lib/session.svelte.ts`：会话单例 store（`authClient.useSession` / getSession），登录态驱动 UI（Sidebar 用户区、受保护页面守卫、登录后跳转回原页）。
- 路由守卫：playlists 路由在 `+page.server.ts` 或客户端守卫中判断登录态，未登录跳 `/login?redirect=...`。

### 4.5 风格基线（Apple Music 质感，调研 Part 3）

- 深色主题 + `system-ui, -apple-system` 字体栈（app.css 定义 design tokens）。
- 封面取色生成页面背景渐变；`backdrop-blur` 半透明材质叠控件。
- 正文 4.5:1 对比度、44px 触控热区、`:focus-visible` 焦点环。
- 快捷键（P0 子集）：空格/K 播放暂停、N/P 前后曲目、Cmd/Ctrl-L 定位当前曲目；焦点在输入框时不拦截。

---

## 5. 里程碑与验收标准

> 前置条件：`pnpm install` 已完成；`apps/server/.env` 已有 DATABASE_URL / BETTER_AUTH_SECRET / BETTER_AUTH_URL / CORS_ORIGIN；`apps/web/.env` 已有 PUBLIC_SERVER_URL。

### M0 · 基线验证（0.5 天）
- `pnpm run db:push` 成功；`pnpm run dev` 起服务。
- 浏览器注册 → 登录 → 调通 `/rpc` 的 `privateData`（验证 better-auth 会话全链路）。
- 验收：`pnpm run check-types` 通过；注册/登录后 `privateData` 返回用户信息。

### M1 · 播放内核雏形（1–2 天）
- 完成 §3.2 音频代理路由 + SoundHelix 直链种子；代理响应带 L1 浏览器缓存头（`Cache-Control: private` + `ETag`，重复播放/seek 回看命中浏览器缓存）。
- 完成 `player.svelte.ts` 单例 store + 单 `<audio>` 元素（先不做双元素）+ 测试页。
- 验收：任意 SoundHelix 曲目可播放/暂停/**拖动 seek**（代理 206 端到端，Network 面板可见 206 + Content-Range）；二次播放同曲目浏览器侧命中缓存（L1 生效）。

### M2 · 数据层 + 专辑推进（2–3 天）
- §2 四表迁移（generate + push）；§3.1 `packages/music` + 种子脚本（Jamendo + SoundHelix）。
- store 升级：`bind(album, tracks)` + 双元素预载 + `ended → next → finishAlbum` + Media Session。
- §3.2 L2 磁盘 LRU 缓存（`audio-proxy.ts` 加缓存层 + `AUDIO_CACHE_DIR/MAX_MB` env + LRU 驱逐 + 启动清理）。
- §3.3 catalog/playlists oRPC 路由 + 越权校验。
- 验收：专辑页连播整张专辑到尾轨后停止，出现"重播整张专辑"；系统媒体键可控制（桌面浏览器）；`playlistCreate/AddAlbum` 通过 RPC 调用成功入库；**第二台浏览器/二次听同一专辑时，服务器侧磁盘缓存命中（日志可见 L2 HIT），且清空 `./.audio-cache` 后回源正常**。

### M3 · UI 骨架（Apple Music 风格，2–3 天）
- §4.2 布局重构 + Browse / 专辑页 / 迷你条；§4.3 核心组件（封面取色、TrackList、ProgressBar）。
- 验收：桌面三区骨架完整；专辑页曲目悬停/当前行高亮/均衡器动效；迷你条显示"N/12"并能展开全屏 Now Playing；移动端宽度下 tab bar + 迷你条可用。

### M4 · 登录 + 收藏列表（2–3 天）
- §4.4 会话 store + 登录/注册页 + 路由守卫；§4.2 playlists 两页 + 新建/删除/改名/添加/移除交互。
- 验收：未登录访问 playlists 被引导到登录页，登录后回到原页；创建列表 → 从专辑页"加入收藏列表" → 列表详情可整列表播放；刷新页面会话保持。

### M5 · 打磨 + 联调（1–2 天）
- 无障碍基线（aria-current / aria-live / reduced-motion）；`biome check` + `check-types` 全绿。
- 跨浏览器验证：Safari 的 Media Session、移动端布局、收藏列表空态/错误态。
- 验收：清单见调研报告 §5「上线前必测」；产出 v0.1.0 演示路径（注册 → Browse → 专辑连播 → 收藏 → 列表播放）。

**总计约 8–13 个工作日**（单人）；M1/M2 与 M3/M4 有依赖关系（先内核后 UI），但 M3 的静态组件可部分与 M2 并行。

---

## 6. 需要产品侧确认的开放问题

> 已定（产品硬约束，不再讨论）：**不支持单曲搜索 / 单曲收藏**；**不存放音源文件**（音频经在线 API 拉取 + 临时分层缓存）。

| # | 问题 | 建议默认值 | 影响 |
| --- | --- | --- | --- |
| 1 | 专辑播完的默认行为 | 播完**停止**（不自动接下一张），UI 给 Replay + Repeat Album 两态 | 播放内核逻辑 |
| 2 | 是否需要"我的收藏"默认列表 | 不做，用户手动创建 | 少一张表字段 |
| 3 | Jamendo 无 Key 时目录来源 | 开发期用 SoundHelix 占位专辑；上线前注册 Jamendo 免费 Key（非商用 3.5 万次/月） | env + 种子脚本 |
| 4 | 收藏列表是否要拖拽排序 | P1 再做（先按加入顺序） | 排期 |
| 5 | L2 缓存容量/策略 | 默认 512MB LRU、启动清理、目录可配（`AUDIO_CACHE_DIR/MAX_MB`）；是否需要 L3 对象存储多实例共享，P1 再议 | 部署形态 |

---

## 7. 风险与对策

| 风险 | 等级 | 对策 |
| --- | --- | --- |
| 双元素预载的"无间隙"效果在 MP3 上有可听间隙/爆音 | 中 | M1 先单元素验证可播；M2 再上双元素；若效果差，调研报告 Part 2 §4 有"整张解码 AudioBuffer"的增强路径，作为 P2 |
| 上游（Jamendo storage）无 CORS 或拒绝某些请求 | 低 | 播放统一走 Elysia 代理（自己域），天然规避；报告已实测 storage 域普通播放无碍 |
| Jamendo API 配额 / Key 未就绪 | 低 | 开发期全程 SoundHelix；`JAMENDO_CLIENT_ID` 可选 |
| Safari 的 Media Session 行为差异 | 中 | M2 就接入，尽早用 Safari 真机验证；不阻塞主功能（媒体键只是增强） |
| 封面取色 + blur 在低端机上性能 | 低 | 取色离屏一次性计算 + 缓存；`backdrop-blur` 慎用大区域 |
| 播放列表 FK 上无数据（Browse 空目录） | 低 | 种子脚本是 M2 的一部分，先于任何收藏 UI 完成 |
| L2 缓存命中率低（多人听不同专辑） | 低 | 缓存只是加速层，不命中就回源，功能不受影响；容量/目录可配，后续可加 L3 对象存储共享 |
| L2 缓存一致性/陈旧片段（上游文件更新） | 低 | 片段带上游 ETag/Last-Modified 校验，不一致即回源；缓存可整体清空（`.gitignore` 的临时目录） |
| 磁盘缓存膨胀占满服务器磁盘 | 低 | LRU 水位线（`AUDIO_CACHE_MAX_MB`）+ 启动清理；超过上限自动驱逐最久未用片段 |

---

## 8. 相关资源

- 技能：`.agents/skills/elysiajs`（后端路由）、`.agents/skills/better-auth-best-practices`（登录）、`.agents/skills/turborepo`（monorepo 构建）
- 调研报告：Part 2（播放实现 + Range 代理代码骨架 §4.4、播放状态 §5.4–5.7）、Part 3（UI/UX 细节与交互决策 §2）、Part 1（Jamendo/IA 接口）
- 命令：`pnpm run dev`（web:5173 + server:5172）、`pnpm run db:generate/push`、`pnpm run check-types`、`pnpm run check`
