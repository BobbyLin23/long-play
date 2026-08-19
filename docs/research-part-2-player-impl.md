# Research Part 2: Audio Playback Implementation (long-play)

> Scope: browser audio playback only (HTMLAudioElement / Web Audio API / MSE, gapless & crossfade, Media Session API, HTTP Range/streaming via Elysia, Svelte 5 playback state). Music sources, UI/UX, and Electrobun are handled by other agents.
>
> 说明：本文区分「已验证事实（验证自官方文档/MDN/规范）」与「推断/建议（基于上述事实的工程推论）」。
> 日期：2026-08-19

## 目录

1. Browser Audio 方案对比（HTMLAudioElement vs Web Audio API vs MSE）
2. Gapless / Crossfade 实现
3. Media Session API
4. HTTP Range Requests 与 Elysia 流式代理
5. Svelte 5 播放状态架构（runes + TanStack Query）
6. MVP 实现建议

---

## 1. Browser Audio 方案对比（HTMLAudioElement vs Web Audio API vs MSE）

### 1.1 HTMLAudioElement（`.src` 渐进式播放）

已验证事实（来源：MDN `<audio>` / HTMLMediaElement 文档 https://developer.mozilla.org/en-US/docs/Web/HTML/Element/audio）：

- `<audio>` 元素内嵌声音内容，支持多个 `<source>`，浏览器自己选择能解码的第一个。
- 其 DOM 接口是 `HTMLAudioElement`，实现 `HTMLMediaElement` 的完整 API：事件、`currentTime`、`load()`、`srcObject`、播放/暂停等。
- 事件包括：`play`、`playing`、`pause`、`seeking`、`seeked`、`timeupdate`（`currentTime` 更新时触发）、`ended`（**媒体播到末尾时触发**——这是实现"专辑一首接一首"的核心钩子）。
- `preload` 属性（`none` / `metadata` / `auto`）：只是提示，浏览器不保证遵守；规范建议 `metadata`。
- 对 HTTP(S) URL 均可播放，浏览器缓存行为会影响请求频率；Data URL 只适合小文件。
- Browser support：Baseline "Widely available"（2015 年 7 月起跨浏览器可用）。
- **MDN 未提及 gapless（无间隙衔接）能力**——原生逐轨播放通常会在轨道之间出现可感知的停顿/空白（见第 2 节，属推断）。

### 1.2 Web Audio API（音频图，精确调度）

已验证事实（来源：MDN Web Audio API https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API、Web Audio 规范 https://webaudio.github.io/web-audio-api/）：

- 提供 "powerful and versatile system for controlling audio on the Web"：`AudioContext`、`AudioNode`、`AudioBuffer`、`AudioBufferSourceNode`、`AudioParam`、`destination`。
- **精确计时**："Timing is controlled with high precision and low latency"；`BaseAudioContext.currentTime`："All scheduled times in the Web Audio API are relative to the value of currentTime"；`currentTime` 精度约 15 位小数。
- `AudioBufferSourceNode.start(when, offset, duration)`（规范原文）：
  - `when`：与 `currentTime` 同一时间坐标系；传 0 或早于当前时间则立即播放；负数抛 `RangeError`。
  - `offset`：从 buffer 的该秒数处开始播放。
  - `duration`：要输出的总时长（受 `playbackRate` 影响，如 0.5 倍速播 5 秒内容输出 10 秒）；负数抛 `RangeError`。
- 可通过 `createMediaElementSource(audioElement)` 把 `<audio>` 元素接入 Web Audio 图（`MediaElementAudioSourceNode`），再做增益/分析/滤波等处理。
- Browser support：Baseline "Widely available"（2021 年 4 月起跨浏览器可用）。

### 1.3 Media Source Extensions (MSE)（分片流式）

已验证事实（来源：MDN MSE https://developer.mozilla.org/en-US/docs/Web/API/Media_Source_Extensions_API）：

- 用 `MediaSource` 对象 + 多个 `SourceBuffer` 取代单个渐进式 `src` URI，把媒体分块喂给 `<audio>`/`<video>`。
- 用于自适应码率流（DASH/HLS）客户端；对内容获取频率、内存占用（buffer eviction）有细粒度控制。
- 不适用性：需要对内容预先切分/打包（"laborious process"，耗时耗电耗算力，需外部工具）；对"整张专辑顺序播放"这种简单场景，文档明说 `<video>`/`<source>` 渐进式播放 "may well be a simple and adequate solution"。

### 1.4 三者对比与选择建议

| 维度 | HTMLAudioElement | Web Audio API | MSE |
|---|---|---|---|
| 定位 | 简单播放器（渐进式 URL） | 音频处理图、精确调度 | 分片流（ABR/DASH/HLS） |
| 读取远程音频 | 原生支持（Range/206） | 需先取整段数据 `decodeAudioData`（或经 `MediaElementSourceNode`） | 需切片+打包资源 |
| 精确调度/淡入淡出 | 无 | 强（`start(when,offset,duration)` + `GainNode` ramp） | 无（仍是元素播放模型） |
| 轨道衔接 | 依赖 `ended` 事件顺序切换（有间隙） | 可无缝/交叉淡化 | 可无间隙（需服务端切分） |
| 实现成本 | 低 | 中（流式大文件需策略） | 高 |

**推断/建议（针对 long-play）**：专辑=大量平均 3-5 分钟的远程音频文件，不需要 ABR。MVP 首选 **HTMLAudioElement 为主**（用它做进度、seeking、`ended`），需要**交叉淡化/无间隙**时把元素接入 Web Audio 图（`createMediaElementSource`）做增益控制，或用**预载 + 双元素重叠**策略。MSE 只在该专辑内容被统一打包为 DASH/HLS 分片时才值得用——不是 MVP 场景。

---

## 2. Gapless / Crossfade 实现

### 2.1 为什么原生逐轨播放会有间隙
- 已验证：MDN 的 HTMLAudioElement 文档没有 gapless 能力声明（见 1.1），`ended` 事件语义是"媒体播到末尾停止"。
- 推断（工程常识，需实测验证）：逐个切换 `<audio>` 时，解码器需要重入（重新解码头、对空 buffer 填充），MP3 等有损格式还带编码器固有延迟（encoder/decoder delay + padding），除非文件内含 LAME gapless 元数据，否则每轨首尾会出现可听空白/爆音。这是"整张专辑连播"体验的核心风险。

### 2.2 方案 A：双 `<audio>` 元素 + 提前预载（流式、简单、推荐 MVP）
- 实现：维护两个 `HTMLAudioElement`（A/B 循环使用），当前轨在 A 播放时，把 B 的 `src` 设为下一轨并 `preload="auto"`；在 A 触发 `ended` 时切换：同专辑内默认不做交叉淡化（保持"专辑连续感"），直接 swap；仅当产品明确要"交叉淡化"体验时才做重叠加温。
- 交叉淡化实现（已验证的技术积木）：
  - 把元素接进 Web Audio 图：`const src = ctx.createMediaElementSource(el); src.connect(gain); gain.connect(ctx.destination);`
  - 淡入淡出用 `GainNode`：`gain.gain.setValueAtTime(0, t); gain.gain.linearRampToValueAtTime(1, t + fadeIn)`；淡出同理（来源：MDN Web Audio "Advanced techniques" https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Advanced_techniques 的 envelope 示例）。
  - 时间轴统一用 `audioContext.currentTime`。
- 注意（已验证）：`createMediaElementSource` 一个元素只能调用一次；元素被接入后其输出改走 Audio 图，不再直接出声音。

### 2.3 方案 B：整张专辑解码进 AudioBuffer + `start(when, offset)` 顺序调度（真·gapless / 精确交叉淡化）
- 已验证：`AudioBufferSourceNode.start(when, offset, duration)` 可在精确时刻调度播放、可指定起点与时长（Web Audio 规范，URL 见 §1.2）。
- 实现思路（推断）：
  1. 把整张专辑的音频全部 `fetch` 下来 → `decodeAudioData()` 得到各轨 `AudioBuffer`（该流程本身也适合"提前缓存整张专辑"的产品定位）。
  2. 建立调度游标 `t = ctx.currentTime`；对第 i 轨调用 `src_i.start(t, 0)`，`t += duration_i`；如需交叉淡化，让第 i+1 轨在 `t - fade` 处起播，并给两轨各加 `GainNode` 在重叠窗口内反向 ramp。
  3. 深度应用：预计算专辑总时长、曲目起始时间表，可整张专辑连续播放到结尾；配合第 4 节的 206/Range 可实现"边下边播"式流式（复杂度高）。
- 局限（推断）：全量解码大文件内存占用高（一首 5 分钟 320kbps MP3 ≈ 12MB 压缩数据，解码后 PCM 更大）；且整张解码前无法立即起播，与"立刻开始播放"的 UX 冲突。**建议固化为"后台预取/缓存"能力，而非首播路径**。
- 补充：CD 抓轨/高码率无损（FLAC）源最适合方案 B；流式 MP3 源适合方案 A。

### 2.4 建议
- MVP 采用 方案 A（双元素 + 预载 + `ended` 顺序推进；同一专辑内默认无间隙直切，产品要求交叉淡化时再加 Web Audio 增益重叠）。
- 把方案 B（解码调度）收敛为后续增强：`AudioBuffer` 池 + 预取进度，可在设置页"预下载整张专辑"后启用。

---

## 3. Media Session API

### 3.1 API 构成（已验证，来源：MDN Media Session API https://developer.mozilla.org/en-US/docs/Web/API/Media_Session_API）

- 入口是 `navigator.mediaSession` 属性，不自行构造 `MediaSession` 实例。
- `metadata`：`navigator.mediaSession.metadata = new MediaMetadata({ title, artist, album, artwork })`。artwork 为对象数组，含 `src` / `sizes` / `type`，示例覆盖 96x96 到 512x512。
- `playbackState`：`"none" | "paused" | "playing"`，用于系统 UI 正确显示播放/暂停图标。
- `setActionHandler(type, callback)`：登记平台媒体键回调；MDN 列出的 action 类型包括 `play`、`pause`、`stop`、`seekbackward`、`seekforward`、`seekto`、`previoustrack`、`nexttrack`、`skipad`、`togglecamera`、`togglemicrophone`、`hangup`、`previousslide`、`nextslide` 等；`seekto` 回调收到 `{ seekTime }`，`seekforward`/`seekbackward` 收到 `{ seekOffset }`。
- `setPositionState({ duration, playbackRate, position })`：向系统暴露进度，用于锁屏进度条（Chrome 81+ / Safari 15+ / Firefox 82+）。
- 系统需要在底层面板中显示媒体控制（如 Firefox 的 MediaControl），API 本身才能生效。
- 移动端自动播放限制：需先用用户手势（如 `pointerup`）启动播放，再建立 media session；多个页面同时使用 API 时，由用户代理决定调用哪个页面的 handler。

### 3.2 浏览器支持（已验证，来源：MDN browser-compat-data，https://github.com/mdn/browser-compat-data 的 api/MediaSession.json，2026-08-19 抓取）

- 基础 API（`metadata`、`playbackState`、`setActionHandler`）：Chrome 73 / Chrome Android 57+、Edge（镜像 Chrome）、Firefox 82+、Safari 15+（iOS 镜像）、Samsung Internet（镜像 Chrome）；**WebView Android 不支持**（`webview_android: false`）。
- `setPositionState`：Chrome 81 / Android 57+、Firefox 82+、Safari 15+（iOS 镜像）。
- Firefox Android 的重要注记（BCD 原文）："Firefox exposes the API, but does not provide a corresponding user-facing media control interface."（API 存在但无可见媒体控制界面）。
- MDN 将整个 Media Session API 标为 **Limited availability**（"not Baseline because it does not work in some of the most widely-used browsers"）。

### 3.3 Safari / iOS 行为（部分验证 + 推断）

- 已验证：Safari 15+ 支持 `metadata` / `playbackState` / `setActionHandler` / `setPositionState`（见上）。
- 推断（常见工程认知，未能在本环境从 mdn/webkit 原文逐条核实，需真机测试）：Safari 对 action 种类支持是子集——常用的是 `play`、`pause`、`previoustrack`、`nexttrack`、`seekbackward`、`seekforward`、`seekto`；且 Safari 要求 `setPositionState` 在 `playbackState === "playing"` 时调用才生效。**建议在 iOS Safari + macOS Safari 真机验证 action 是否触发**，不要假设支持全表。
- 推断：Chrome 在桌面与 Android（含 Wear OS 手表媒体控制）均会出现系统级控制；Firefox 桌面通过 MediaControl 面板可用。

### 3.4 从 Svelte 5 接入的方式（推断，基于已验证的 runes 语义，见 §5）

- 在播放 store（§5 的单例）内集中管理：播放状态变化时（`$effect` 或显式调用）写 `navigator.mediaSession.metadata / playbackState / setPositionState`，并注册 `nexttrack` / `previoustrack` / `play` / `pause` / `seekto` handler，handler 内部调用 store 的 action（`next()`、`prev()`、`toggle()`、`seek(t)`）。
- 只在浏览器端执行（`browser` 守卫或 `$effect` 天然只在 client 运行，已验证：Svelte 5 文档 "Effects only run in the browser, not during SSR"）。
- 组件卸载/播放停止时应清除 handler（`setActionHandler(type, null)`）以免残留。

### 3.5 对 long-play 的意义
- 核心价值：锁屏/蓝牙耳机/手表上的"下一曲/上一曲/播放暂停"直接控制专辑播放（匹配"整张专辑连播"产品逻辑——`nexttrack` 即"播专辑下一首"，`previoustrack` 即"回到上一首"，不是切专辑）。
- artwork 必须提供多尺寸（96/128/192/256/384/512），以适配不同系统 UI。

---

## 4. HTTP Range Requests 与 Elysia 流式代理

### 4.1 HTTP Range 与音频 seeking（已验证，来源：MDN HTTP Range requests https://developer.mozilla.org/en-US/docs/Web/HTTP/Range_requests）

- 服务器用 `Accept-Ranges: bytes` 声明支持范围请求；若该头缺失或为 `none` 则不支持。
- 客户端请求：`Range: bytes=0-1023`。
- 成功响应：`HTTP/2 206 Partial Content`，`Content-Length` = 返回片段的字节数，`Content-Range: bytes start-end/total`（如 `bytes 0-1023/146515`）。
- 多范围：`Range: bytes=0-50, 100-150` → `multipart/byteranges` 响应体。
- 条件请求：`If-Range` + `Last-Modified` 或 `ETag`；条件满足回 206，否则回 200 全量。
- 越界范围：`416 Range Not Satisfiable`。
- 不支持范围时：服务器忽略 `Range`，回 200 全量内容。
- **媒体 seeking 的原理**：播放器只需下载所需字节范围即可跳转，不必下载整个文件；前提是服务器声明 `Accept-Ranges: bytes` 且能回 206。这正是 `<audio>` 元素进度条 seek 的工作机制（浏览器原生发起 Range 请求）。

### 4.2 Elysia 的流式能力（已验证，来源：Elysia 官方文档全量文本 https://elysiajs.com/llms-full.txt，2026-08-19 抓取；仓库内 elysia 版本 1.4.29，`@elysiajs/node` 1.4.5）

- **Generator/yield 流式**：handler 返回 generator 函数并在其中 `yield`，即流式响应；如果函数没有 yield（直接 return），Elysia 自动转成普通响应（"Conditional Stream"）。
- **SSE**：`import { sse } from 'elysia'`，包一层 `sse()` → 自动设置 `text/event-stream` 头并格式化事件。
- **流式响应头限制**（重要）：**headers 只能在第一个 chunk 写出之前设置**——`set.headers['x-name']='Elysia'` 在第一个 `yield` 前有效；之后修改无效。
- **ReadableStream / Response 直接返回**："Elysia supports continuous streaming of a `ReadableStream` and `Response`, allowing you to return streams directly"。
- **fetch 代理**："Elysia will proxy the fetch response with streaming support automatically"——直接 `return fetch(upstream, ...)` 即可把上游响应（含其 body 流）转发出去。
- **设置响应状态码**：`set.status` 可设任意状态码；文档明确举例 201/206 这类非标准默认状态码适合用 `set.status`。
- **设置响应头**：`set.headers` 对象可追加/删除响应头。
- **文件响应**：`file(path)` / `form(form({...}))` 可直接返回文件（自动设置 Content-Type）。
- **取消**：客户端取消请求时 Elysia 自动停止 generator（流式下游不再拉取）。
- **Node 适配器支持流式**（已验证，读仓库内 `@elysiajs/node` dist 源码）：`handle.js` 对 `ReadableStream` 和 async iterator 走 `streamResponse` 分发（含 `text/event-stream` 处理），即 Elysia on Node 可以流式输出。

- **Elysia 不内置 Range 转发**（已验证：官方文档全文检索不到 `Range` / `Accept-Ranges` / `Content-Range` / `416`，仅有 206 作为状态码示例）。所以"范围代理"需要自己组装：读上游响应的 `status` / `headers`，用 `set.status` + `set.headers` 透传，并 `return response.body`（ReadableStream）流式转发。

### 4.3 Cloudflare 相关的限制（已验证，来源：Cloudflare Workers Limits https://developers.cloudflare.com/workers/platform/limits/ 与 Pages Functions 页面 https://developers.cloudflare.com/pages/platform/functions/）

- 请求体大小：Free/Pro 100 MB、Business 200 MB、Enterprise 500 MB；超限回 413（对音频 GET 影响不大，但对上传专辑/封面有影响）。
- **CPU 时间**：Free 10ms / Paid 默认 30s（可调至 5min 上限）；**CPU 时间不含网络 I/O 等待**——即"转发流式响应"这种以等待为主的工作几乎不消耗 CPU 配额。
- **执行时长（wall-clock）**：对 HTTP 触发的 Worker **没有硬性时长上限**；文档原文 "As long as the client remains connected, the Worker can continue processing, making subrequests, and streaming a response body."
- 响应体大小：无强制上限；CDN 缓存上限 Free/Pro/Business 512 MB。
- 每日请求：Free 100,000/天；子请求（subrequests）：Free 50 / Paid 10,000。
- Pages Functions 的请求会计入 Workers 计划配额（Pages 采用 Standard usage model）——即 Pages Functions 大体继承上述 Workers 限制。

### 4.4 架构决策：浏览器直连上游 vs 经 Elysia Node 服务器代理

背景（仓库现状，已验证）：web 用 `@sveltejs/adapter-static`（fallback `index.html`，为 Electrobun/Tauri 内嵌用），devDependencies 里另有 `@sveltejs/adapter-cloudflare` 与 `@cloudflare/workers-types`；web 通过 `PUBLIC_SERVER_URL` + `/rpc`（orpc）访问后端，后端是 Elysia（`@elysiajs/node`，Node 运行时）。

**方案 1：浏览器直接流式播放上游 URL（如 archive.org）**
- 优点（推断）：零中转带宽/成本；浏览器原生支持；延迟最低；`<audio>` 原生 Range seek 直接可用。
- 前置条件（推断，必须逐源验证）：上游必须支持 CORS（`Access-Control-Allow-Origin`，浏览器跨域拉流/读进度需要）、`Accept-Ranges: bytes` + 206、稳定的公开 URL、无鉴权需求。
- 缺点（推断）：无法做鉴权/按用户追踪/防盗链；URL 变更需改前端；无法统一做格式协商/转码；上游故障/慢速无兜底。

**方案 2：经 Elysia Node 服务器做 Range 代理（推荐作为默认架构）**
- 可行性（已验证的积木 + 推断组装）：Elysia 支持返回 `Response` / `ReadableStream` 流式转发、`set.status`/`set.headers`，Node 适配器支持流式；自己实现"透传 Range 并回 206 + Content-Range + Accept-Ranges + Content-Length + Content-Type"即可。核心代码形状（推断示例）：

```ts
// GET /proxy/audio/:id —— 简化示意，MVP 时可按需扩展鉴权/缓存/限流
app.get("/proxy/audio/:id", async ({ request, set, params }) => {
  const up = await fetch(`https://upstream.example.com/files/${params.id}`, {
    headers: {
      // 透传客户端的 Range（浏览器 seek 时自动带上）
      ...(request.headers.get("range") ? { range: request.headers.get("range")! } : {}),
    },
  });
  // 透传状态码（200 或 206）与关键头
  set.status = up.status;
  set.headers["accept-ranges"] = up.headers.get("accept-ranges") ?? "bytes";
  if (up.headers.has("content-range")) set.headers["content-range"] = up.headers.get("content-range")!;
  if (up.headers.has("content-length")) set.headers["content-length"] = up.headers.get("content-length")!;
  set.headers["content-type"] = up.headers.get("content-type") ?? "application/octet-stream";
  return up.body; // ReadableStream -> Elysia/Node 适配器流式转发
});
```

- 优点（推断）：单一入口（鉴权、分析、限流、缓存、URL 归一化都在一处）；跨域 CORS 由自己的域名下发（`@elysiajs/cors` 已在仓库）；可为后续"预取整张专辑/下载"做缓存层；可换源（上游换地址只改服务端）。
- 缺点（推断）：服务器带宽/成本；多一跳延迟；需处理上游怪癖（如部分源不回 `Content-Length`、只回 chunked、不支持 Range 时回落 200 全量）；Node 侧需关注长连接资源管理（超时、取消时 abort 上游 fetch）。

**方案 3：让 Cloudflare Pages Functions 代理音频**
- 事实（已验证）：Worker 流式转发响应体没有时长上限、CPU 不计 I/O 等待、子请求 50 个（Free）足够单路转发；Free 100,000 请求/天。
- 推断：技术上可行，但音频流量走 Cloudflare 会占每日请求配额并产生带宽费用；且当前仓库 web 默认走 adapter-static（静态站），加 Pages Functions 等于引入第二套后端逻辑与 Elysia 重复。**不建议**作为唯一路径；可作为"CDN 缓存音频响应"的后续优化（Cache API 依据 206 缓存片段）。

**结论（推断/建议）**：MVP 走 **方案 2**：浏览器 `<audio>` 的 `src` 指向 Elysia 的音频代理路由（`{PUBLIC_SERVER_URL}/proxy/audio/:id`），代理转发 Range 并透传 206；seeking 即可端到端工作。上游源若已确认支持 CORS + Range + 公开无鉴权，可提供一个"直连模式"开关（A/B）用于省钱比较。注意：web 是静态部署，纯浏览器端无法做 CORS 之外的鉴权，所以默认走自己服务器代理更稳。

---

## 5. Svelte 5 播放状态架构（runes + TanStack Query）

### 5.1 仓库现状（已验证，读仓库文件 2026-08-19）

- `apps/web`：Svelte 5.56.8、Tailwind 4、`@tanstack/svelte-query` 6.1.38、orpc（`@orpc/client` + `@orpc/tanstack-query`）。
- `src/lib/orpc.ts` 导出单例 `queryClient` 与 `client`（`createORPCClient` + `RPCLink`，指向 `PUBLIC_SERVER_URL` 的 `/rpc`）；`+layout.svelte` 用 `<QueryClientProvider client={queryClient}>` 包裹全局。
- 目前仓库中**无任何播放相关代码**（无 `new Audio`、无 `mediaSession`、无播放 store）。

### 5.2 Svelte 5 runes 关键语义（已验证，来源：Svelte 5 官方文档 https://svelte.dev/docs/svelte/what-are-runes 、https://svelte.dev/docs/svelte/$state 、https://svelte.dev/docs/svelte/$derived 、https://svelte.dev/docs/svelte/$effect）

- `$state`：声明响应式状态；数组/简单对象会被**深度响应式代理**；`$state.raw` 可关掉深度代理（只能整体重赋值、不能内部修改）；`$state.snapshot` 可导出非代理快照（给外部库）。
- **模块级共享**：可在 `.svelte.ts` 中声明 `$state`，但**不建议直接导出被重新赋值的裸 `$state` 变量**（外部文件无法编译其重赋值）；官方给出两种方法：①导出带 getter 的对象/class；②保持私有并导出读/写函数。组件间共享单例即用此法。
- `$derived`：依赖其他响应式的派生值；只读（Svelte 5.25+ 可临时覆写，但默认按只读使用）；`$derived.by(fn)` 用于复杂计算；**惰性重算**；若新旧值引用相同则跳过下游更新。
- `$effect`：依赖追踪 + 自动重跑；**只在浏览器运行（SSR 不跑）**；在组件挂载后及状态变更后的 microtask 中运行；可返回 teardown 函数；**不应在 effect 内改 state**（会死循环），读与写同源时可配合 `untrack`。

### 5.3 推荐架构：runes 单例 store + TanStack Query 供数据

分层（推断，基于 5.2 的已验证语义）：

- **数据层（TanStack Query / orpc）**：负责"专辑信息 + 曲目列表"。组件里 `createQuery` 取得专辑与曲目数组（`url`、`title`、`artist`、`duration` 等）。数据是"引用数据"，不承载播放进度。
- **播放层（runes 单例 store，`$lib/player/player.svelte.ts`）**：承载"正在播哪张专辑、哪一轨、进度、播放与否"以及音频元素/媒体会话/事件绑定。所有 UI 组件（播放栏、专辑页、Media Session handler）只读写这个单例。
- 组件负责"喂数据"：拿到查询结果后调用 `player.bind(album, tracks, startIndex = 0)`；切专辑时重新 `bind` 即可。

### 5.4 Store API 形状（核心代码草图，推断设计）

```ts
// $lib/player/player.svelte.ts  （模块级单例，组件共享）
export type Track = { id: string; title: string; url: string; duration?: number };
export type Album = { id: string; title: string; artist: string; artwork?: string };

export const player = createPlayer();

function createPlayer() {
  // ---- 状态（深度响应式对象） ----
  let album = $state<Album | null>(null);
  let tracks = $state<Track[]>([]);
  let index = $state(-1);
  let isPlaying = $state(false);
  let currentTime = $state(0);
  let duration = $state(0);

  // ---- 派生值 ----
  const queue = $derived(tracks);                    // 队列=专辑曲目本身（产品约束）
  const currentTrack = $derived(tracks[index] ?? null);
  const hasNext = $derived(index >= 0 && index < tracks.length - 1);
  const hasPrev = $derived(index > 0);
  const progress = $derived(duration > 0 ? currentTime / duration : 0);

  // 音频元素（仅浏览器端创建；A/B 双元素预载策略见 §2.2）
  let audio: HTMLAudioElement[] | null = null;        // 非响应式普通字段

  // ---- 动作（组件/媒体会话/事件均调用这些） ----
  function bind(nextAlbum: Album, nextTracks: Track[], startAt = 0) { ... } // 装载专辑
  async function play() { ... }                        // 必须在用户手势里首次调用（自动播放策略）
  function pause() { ... }
  function toggle() { ... }
  function next() { ... }                              // 播下一轨；无下一轨则"专辑播放完成"
  function prev() { ... }                              // 回到上一轨（或回到本轨开头）
  function seek(t: number) { if (audio) audio[active].currentTime = t; }
  function init() { ... }                              // 创建元素、绑定事件，仅在浏览器调用一次

  return {
    get album() { return album },   // getter 形式导出，既是响应式也可被外部读取
    get tracks() { return tracks },
    get index() { return index },
    get isPlaying() { return isPlaying },
    get currentTime() { return currentTime },
    get duration() { return duration },
    get currentTrack() { return currentTrack },
    get hasNext() { return hasNext },
    get hasPrev() { return hasPrev },
    get progress() { return progress },
    bind, play, pause, toggle, next, prev, seek, init,
  };
}
```

要点（推断，基于 5.2 验证语义）：用"返回 getter 对象的工厂函数"规避"导出裸 `$state` 不可重赋值"的限制；模块级 `export const player = createPlayer()` 即全局单例；所有字段随 `$state` 深度响应，UI 处 `$derived`/模板直接读取自动订阅。

### 5.5 轨道推进（ended → 下一首 → 专辑结束）

- `init()` 里给当前元素绑定事件（草图，推断）：

```ts
audio[active].addEventListener("ended", () => {
  if (hasNext) next();
  else finishAlbum();   // isPlaying=false；可置 index=-1 或停在末尾；UI 显示"专辑播放完毕"
});
audio[0].addEventListener("timeupdate", () => {
  currentTime = audio[0].currentTime;
  duration = audio[0].duration;   // 或 loadedmetadata 时取
});
```

- `next()` 的实现（配合双元素预载，§2.2 方案 A）：把备用元素设为下一轨 `url` 并 `preload="auto"`；`ended` 时直接 `swap` 并 `play()`；同专辑内默认不做间隙，直接切。
- 专辑结束时（推断）：`finishAlbum()` 置 `isPlaying=false`、`index` 留在最后一轨，UI 给出"重新播放整张专辑"按钮；可把"整张专辑重播"做成设置项（`loop-album` 布尔）。

### 5.6 与 TanStack Query 的接线（组件层，草图）

```svelte
<script lang="ts">
  import { createQuery } from "@tanstack/svelte-query";
  import { client } from "$lib/orpc";
  import { player } from "$lib/player/player.svelte.ts";

  const albumQuery = createQuery({
    queryKey: ["album", id],
    queryFn: () => client.albumDetail(id),   // 或现有 orpc 过程
  });

  // 拿到专辑数据后喂给播放 store（$effect 自动在数据变化时重跑）
  $effect(() => {
    const d = albumQuery.data;
    if (!d) return;
    if (player.album?.id !== d.album.id) player.bind(d.album, d.tracks);
  });
</script>
```

- 不需要把播放进度缓存在 query 里（它不属于"服务端数据"）；查询缓存只管专辑/曲目引用数据。若未来要"继续上次播放位置"，单独做持久化（localStorage/服务端），不混入 query。
- 组件卸载时无需销毁单例（整站共享）；只有 `init()` 需要幂等（如 `if (audio) return`）。

### 5.7 Media Session 接线（草图，推断；依据 §3.4）

```ts
// 在 init() 中注册一次；实现见 §3
navigator.mediaSession.setActionHandler("play", () => player.play());
navigator.mediaSession.setActionHandler("pause", () => player.pause());
navigator.mediaSession.setActionHandler("nexttrack", () => player.next());
navigator.mediaSession.setActionHandler("previoustrack", () => player.prev());
navigator.mediaSession.setActionHandler("seekto", (e) => {
  if (e.seekTime != null) player.seek(e.seekTime);
});

// 状态变化时刷新元数据/进度（放在另一处 $effect 或显式调用中）
$effect(() => {
  const t = player.currentTrack;
  if (!t || !player.album) return;
  navigator.mediaSession.metadata = new MediaMetadata({
    title: t.title,
    artist: player.album.artist,
    album: player.album.title,
    artwork: player.album.artwork ? [{ src: player.album.artwork, sizes: "512x512" }] : [],
  });
  navigator.mediaSession.playbackState = player.isPlaying ? "playing" : "paused";
  if ("setPositionState" in navigator.mediaSession) {
    navigator.mediaSession.setPositionState?.({ duration: player.duration, playbackRate: 1, position: player.currentTime });
  }
});
```

---

## 6. MVP 实现建议

### 6.1 分层结论

- 播放内核：HTMLAudioElement（双元素预载 + `ended` 推进）；仅在需要交叉淡化时把元素接入 Web Audio 图做增益重叠（§2.2 / §2.3）。
- 音频来源：默认经 Elysia Node 服务器 Range 代理拉流（`/proxy/audio/:id`，透传 206/Content-Range）；上游若确认支持 CORS + Range 且公开，可加直连开关（§4.4）。
- 系统集成：Media Session 元数据/进度/handler 集中在播放 store 内维护（§3.4、§5.7）。
- 状态：runes 单例 store（`$lib/player/player.svelte.ts`，getter 导出）+ TanStack Query 只负责专辑/曲目引用数据（§5.3–5.6）。

### 6.2 落地顺序（推断）

1. 先做"单曲可播、可 seek"：`player.svelte.ts` 雏形 + 裸 `<audio>` + 一条代理路由（验证 206 端到端）。
2. 加"专辑队列入推进"：`bind(album, tracks)` + `ended → next() → finishAlbum()` + 双元素预载；同专辑内直切验证无大间隙。
3. 加 Media Session 系统控制 + 进度条 UI 绑定 store 派生值。
4. 再加交叉淡化（若产品确认要）与"预下载整张专辑"（方案 B 的 AudioBuffer 池化）。
5. 上线前必测：iOS Safari 真机 Media Session、Android Chrome 后台/锁屏、seek 到大文件随机位置、上游源不支持 Range 的回落（200 全量）场景。

### 6.3 需要产品/其他 agent 确认的边界

- 是否需要"交叉淡化"？默认建议同专辑直切（保持专辑连续感），交叉淡化作为可选开关。
- 是否需要"继续上次播放位置"？建议 MVP 后做（localStorage 即可）。
- 音频是否需要在 Electrobun 桌面端离线可用？这属于 Electrobun 主题（本文件不展开），但 store 与缓存层需预留"本地文件/缓存 URL"的 `url` 抽象（`Track.url` 将来可指向 blob: 或 file:）。

---

## 附：关键来源索引

- MDN `<audio>`/HTMLMediaElement：https://developer.mozilla.org/en-US/docs/Web/HTML/Element/audio
- MDN Web Audio API：https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API
- Web Audio 规范（AudioBufferSourceNode.start）：https://webaudio.github.io/web-audio-api/
- MDN Web Audio Advanced techniques（gain ramps）：https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Advanced_techniques
- MDN MSE：https://developer.mozilla.org/en-US/docs/Web/API/Media_Source_Extensions_API
- MDN Media Session API：https://developer.mozilla.org/en-US/docs/Web/API/Media_Session_API
- MDN BCD MediaSession 兼容数据：https://github.com/mdn/browser-compat-data （api/MediaSession.json，2026-08-19 抓取）
- MDN setActionHandler（action 类型列表）：https://developer.mozilla.org/en-US/docs/Web/API/MediaSession/setActionHandler
- MDN HTTP Range requests：https://developer.mozilla.org/en-US/docs/Web/HTTP/Range_requests
- Elysia 官方文档：https://elysiajs.com/llms-full.txt、https://elysiajs.com （2026-08-19 抓取；仓库内 elysia 1.4.29 / @elysiajs/node 1.4.5 源码核对）
- Cloudflare Workers Limits：https://developers.cloudflare.com/workers/platform/limits/
- Cloudflare Pages Functions：https://developers.cloudflare.com/pages/platform/functions/
- Svelte 5 runes：https://svelte.dev/docs/svelte/what-are-runes 、/docs/svelte/$state 、/docs/svelte/$derived 、/docs/svelte/$effect