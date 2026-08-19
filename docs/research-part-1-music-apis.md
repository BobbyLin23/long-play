# 研究 Part 1：免费音乐 API 来源调研（专辑级曲库）

> 调研日期：2026-08-19
> 调研范围：仅限「合法、免费、且能提供完整专辑/整张唱片」的音乐来源。
> 结论标注说明：以下每条结论尽量区分「已验证事实（来自官方文档/官方页面/实测请求）」与「推断（基于常识/比对多个来源）。凡未找到官方文档支撑的，均明确写出「未找到文档」。
> 调研方法：抓取官方 API 文档、官方站点页面、Wayback Machine 存档，并直接对真实媒体 URL 发 HTTP 请求，验证 `Access-Control-Allow-Origin`（CORS）与 `Accept-Ranges`/`206`（HTTP Range 寻址）是否支持。

---

## 执行摘要

结论先行：**Jamendo 和 Internet Archive 是「专辑优先」音乐流媒体 MVP 的最佳起点**；SoundHelix 适合作为开发期的占位专辑。

| 来源 | 是否适合做专辑流媒体 MVP | 一句话理由 |
|---|---|---|
| Internet Archive | ✅ 主库之一 | 无鉴权开放 API、流媒体 URL 实测带 CORS + Range、album=item 天然对应"专辑=完整曲目列表"，且有多块法律安全的存量（78rpm 公有领域老唱片、etree 授权现场、FMA 镜像） |
| Jamendo | ✅ 主库之一 | 数据模型原生支持 album + 曲目列表 + 封面 + 流地址，全部 CC 授权，API 带 CORS，免费档 3.5 万次/月；但音频存储域 storage.jamendo.com 实测无 CORS 头（普通 `<audio>` 播放不受影响，Web Audio API 需代理） |
| Free Music Archive | ⚠️ 已死/降级 | API 已下线（404），目录以 CC 授权形式镜像在 Internet Archive，仍可间接使用 |
| Musopen | ❌ 不推荐 | 无可用公共 API（api.musopen.org 无法连接），全站 Cloudflare 保护，下载限速/需注册 |
| SoundHelix | 🔧 仅开发占位 | 17 首程序生成的示例 MP3 直链可用（实测 206 + Range），无 CORS，无真实专辑概念，无正式授权说明 |
| Pixabay Music | ❌ 不推荐 | 网站有免费音乐（内容许可），但公共 API 只覆盖图片/视频（文档明确无音乐端点），且无专辑模型 |
| ccMixter | ⚠️ 不推荐 | API 可用（返回 JSON），但无专辑概念、文件需 Referer 校验且无 CORS，浏览器播放必须代理，授权逐曲目而异 |

---

## 1. Internet Archive（archive.org）

### 1.1 提供的 API

- **Advanced Search**：`https://archive.org/advancedsearch.php?q=...&fl[]=...&output=json`，支持 JSON / XML / CSV / RSS，返回 `response.docs` 数组，字段含 `identifier / title / creator / date / description / collection / mediatype / language / subject / genre / format / licenseurl / rights / downloads` 等（mediatype 取值含 `audio` 与 `etree`）。[Internet Archive Advanced Search](https://archive.org/advancedsearch.php)
- **Item Metadata API**：`https://archive.org/metadata/{identifier}`，一次请求返回 `metadata` 对象 + `files` 数组（每个文件含 `name / format / length / title`，format 如 `VBR MP3`、`Ogg Vorbis`、`Shorten`、`FLAC`）。读取无需鉴权。[Internet Archive Item Metadata API](https://archive.org/developers/metadata.html)
- **下载/流媒体 URL**：`https://archive.org/download/{identifier}/{file_name}`，会 302 重定向到节点服务器（如 `dn710801.ca.archive.org` / `ia801901.us.archive.org`）后直出音频文件。已实测。

### 1.2 流媒体形态与 Range/CORS（已实测）

对真实文件 URL（公有领域 78rpm 唱片与 etree 现场）实测结果：

```
请求存档文件 URL（带 Range: bytes=0-99）：
302 → 响应头含 access-control-allow-origin: *  和 accept-ranges: bytes
跟随重定向后节点服务器返回：
HTTP/2 206 Partial Content
content-type: audio/mpeg
content-range: bytes 0-99/5955960
access-control-allow-origin: *
access-control-allow-headers: ..., Content-Range, ..., Range, ...
```

- 支持 HTTP Range 请求（返回 206 + Content-Range）→ 浏览器内任意拖动（seek）可行。
- 带 CORS 头（`Access-Control-Allow-Origin: *`）→ 浏览器跨域直接播放、Web Audio API 解码均可。
- 格式：多数音频项目同时提供 VBR MP3 与 Ogg Vorbis；etree 项目另有 Shorten/FLAC 来源文件；78rpm 项目另有 AFPK 格式。（基于多个 item 的文件清单实测）
- 注意：部分 archive.org 项目是「stream-only」（如 NPR 新闻节目，实测下载返回 403）；etree 现场项目标记 `access-restricted-item: true` 且 collection 含 `stream_only`（实测 GD 1977-05-08 项目），即允许流式收听、禁止整包下载。

### 1.3 授权/版权（法律层面，部分为推断）

- 元数据字段 `licenseurl` 在部分音乐项目上有明确的 CC 链接，例如 Bad Panda 唱片（Bad Panda #09，The Underscore Orkestra）标注 `licenseurl: http://creativecommons.org/licenses/by-nc-sa/3.0/us/`（实测 metadata 返回）[该 item metadata](https://archive.org/metadata/The_Underscore_Orkestra_-_Singles-6873)。
- 78rpm 老唱片（collection `78rpm`，约 30.9 万项）：为 1929 年前录制的历史录音，在美国属公有领域；archive.org 的「78 RPMs and Cylinder Recordings」集合介绍指向 Great 78 Project 提供这批数字化的历史唱片（[集合页](https://archive.org/details/78rpm)、[Great 78 Project](https://great78.archive.org)）。**注意：多数 78rpm 条目的 metadata 里 `licenseurl` 为空（实测），"公有领域"是基于版权年限的推断 + 站点将其公开托管的事实，建议产品侧对单个 item 做人工核验。**
- etree / Live Music Archive（约 30.3 万项现场录音）：乐队授权的非商业现场录音文化，政策写明「禁止商业化用途、需尊重版权、站点需公示本声明」（Grateful Dead 合集的 rights 字段原文，[实测 metadata](https://archive.org/metadata/GratefulDead)）。适合做"现场专辑/合辑"式的非商用曲库；用于商业产品前需逐乐队确认。
- 混音授权复杂：archive.org 并非全部音频都免费；大量现代唱片翻录/上传没有任何授权标注。**产品侧必须按 collection / licenseurl 白名单筛选**，不能全量入库。

### 1.4 鉴权与限流

- 公共读 API（advancedsearch / metadata / download）不需要 API Key（实测无鉴权直接 200）。
- 官方未在开发者文档公布具体数值限流（开发者门户仅列出工具清单，无数字指标，[开发者门户](https://archive.org/developers/)）；已知其对爬虫/大流量下载会限制（推断；未找到官方量化文档，写为推断）。

### 1.5 专辑概念是否成立

- archive.org 的顶层对象是 **item（项目）**，一个 item 对应一张完整唱片/一张现场唱片：多轨 album 即「一个 item + 多个音频文件」，单轨文件级元数据带 `title`（曲名）与 `length`（时长，格式如 06:21）。实测 etree 项目 `gd77-05-08` 的文件列表：`gd77-05-08eaton-d1t01.mp3 | title: Minglewood Blues | length: 06:21` 等。
- 元数据字段 `album`、`artist`、`tracklist` 存在：检索 `mediatype:audio AND album:* AND licenseurl:*` 命中 9,387 项（实测）；但 `tracklist` 字段几乎不被使用（全库仅命中 1 项），曲目列表应直接取 item 的 `files` 数组。
- 结论：**album = item、tracklist = files** 的映射天然成立，且能保持"整张专辑"的产品叙事。

---

## 2. Jamendo（API v3）

### 2.1 提供的 API

- 统一入口 `https://api.jamendo.com/v3.0/{tracks|albums|artists|...}`，返回 JSON/JSONP。[Jamendo API v3 首页](https://developer.jamendo.com/v3.0)
- **tracks**：`https://api.jamendo.com/v3.0/tracks/?client_id=...`，字段含 `id / name / duration / artist_id / artist_name / album_id / album_name / releasedate / image（封面）/ audio（流地址）/ audiodownload（下载地址）/ license_ccurl / musicinfo / audiodownload_allowed`。[tracks 文档](https://developer.jamendo.com/v3.0/tracks)
- **albums**：`https://api.jamendo.com/v3.0/albums/?client_id=...`，字段含 `id / name / releasedate / artist_id / artist_name / image（封面，尺寸由 imagesize 参数控制）/ zip（整张专辑高品质 mp3 打包下载地址）/ zip_allowed`；`type=album` 可只筛多曲目的真专辑（默认混入单曲 single）。[albums 文档](https://developer.jamendo.com/v3.0/albums)
- **albums/tracks**：`https://api.jamendo.com/v3.0/albums/tracks/?id[]={album_id}` 一次返回该专辑 + 完整 tracks 数组（每首含 `position / name / duration / audio / license_ccurl / audiodownload`）。[albums/tracks 文档](https://developer.jamendo.com/v3.0/albums/tracks)

### 2.2 流媒体形态与 Range/CORS（实测）

- 流地址格式（取自官方文档示例 JSON）：`https://prod-1.storage.jamendo.com/?trackid={track_id}&format=mp31&from=app-de`（mp31≈128kbps，另有 mp32≈320kbps）。
- 对真实 trackid 实测：返回 `HTTP/2 206` + `content-range` + `content-type: audio/mpeg` → **支持 Range 寻址**。
- **存储域无 CORS 头**：向 storage.jamendo.com 发请求（含 Origin 头）均未见 `Access-Control-Allow-Origin`（实测）。含义：浏览器 `<audio>` 元素直接播放与拖动 seek 不受影响（audio 标签播放不需要 CORS）；但 Web Audio API（频谱分析、decodeAudioData）等需要读媒体数据的场景会被浏览器拦截，需走服务器代理。
- API 域本身带 CORS：`api.jamendo.com` 响应含 `access-control-allow-origin: *`（实测，即使 client_id 无效的报错响应也带该头）。

### 2.3 授权

- 曲目带 `license_ccurl` 指向 Creative Commons（官方文档示例即 `http://creativecommons.org/licenses/by-nc-nd/3.0/`，实际组合含 BY / BY-NC / BY-SA / BY-NC-SA 等变体；具体每曲目各不相同，以字段为准）。Jamendo 的官方表述是"数百个厂牌授权音乐可免费收听/下载，商用需遵守各自 CC 条款或购买 Jamendo 商用许可"。
- `audiodownload_allowed=false` 的曲目 `audiodownload` 字段为空（文档注明 2022 年 4 月起 album zip 字段在禁止下载时置空）。流式收听（audio 字段）对所有 CC 曲目可用。

### 2.4 鉴权与限流

- 必须注册应用获取 `client_id`（官方流程：注册 Jamendo 账号 → 在开发者后台创建应用）。[v3.0 首页](https://developer.jamendo.com/v3.0)
- 免费档：非商业用途，**每月至多 35,000 次 API 请求**；商业档另议（v3.0 首页的「Non-commercial apps」说明）。

### 2.5 专辑概念（本调研中最完整）

- 原生有 Album 实体：封面（image）、发行日、艺术家、`zip` 整轨打包、`albums/tracks` 直接给完整曲目列表与每曲独立流地址——与"只能整专收听"的产品形态完全匹配，无需自行拼接。

---

## 3. Free Music Archive（FMA）

### 3.1 历史 API（已下线）

- 历史文档确认存在过的 API：`https://freemusicarchive.org/api/get/{dataset}.{format}?api_key=...`，数据集含 curators / genres / artists / albums / tracks，另有一个 trackSearch 搜索接口；分页 limit 默认 20、最大 50，输出 XML/JSON/JSONP。[Wayback 存档的 2011 版文档](https://web.archive.org/web/20110522075309/http://freemusicarchive.org/api/docs)
- 2018 年已变为「不再自助发放 API Key，须邮件申请」并需同意 API 协议，且 archive 快照显示 `/api/get/albums.json` 等真实请求大多 403。[Wayback 存档的 2018 版 API 页](https://web.archive.org/web/20180129022406/https://freemusicarchive.org/api)
- **当前状态（实测）**：`https://freemusicarchive.org/api` 与 `/api/docs` 均 404，API 已实质上关停；站点已归 Tribe of Noise 运营（2019 年收购），继续以 CC 授权提供独立音乐试听下载。[FMA 关于页](https://freemusicarchive.org/about)
- FMA 的完整目录以 `freemusicarchive` 集合镜像在 Internet Archive（实测检索命中 16,797 项，且条目元数据带原专辑/艺术家/CC 链接，如 Bad Panda #09）。

### 3.2 结论

- FMA 自身 API 不可用；其资产通过 Internet Archive 仍可合法获得（需注意单条目的具体 CC 条款）。

---

## 4. Musopen（古典音乐、公有领域录音）

- 定位：古典音乐录音（多为公有领域作品的新录音，站点宣称主打公有领域与 CC 授权；成员制免费/付费下载，免费档每日限量）。
- **无可用公共 API**：`api.musopen.org` 无法连接（实测 HTTP 000 连接失败；Wayback 仅存有 2014–2015 年的 Django 管理后台快照），`musopen.org` 全站被 Cloudflare 挑战页保护（实测 curl 403）。[Musopen 官网](https://musopen.org/)（当前被反爬保护，正文无法抓取）
- 结论：不推荐；即使改走网页抓取，免费档下载限速、无批量专辑接口，且无流媒体 URL，不符合流媒体产品需求。

---

## 5. SoundHelix（程序生成的示例音乐）

- 机制：SoundHelix 是 GPL v3 的算法随机作曲 Java 框架（源码托管于 SourceForge），首页提供 17 首示例 MP3 供试听。[SoundHelix 存档主页](https://web.archive.org/web/20141029143248/http://www.soundhelix.com/)
- **直接文件 URL（实测可用）**：`https://www.soundhelix.com/examples/mp3/SoundHelix-Song-{1..17}.mp3`，返回 `HTTP/2 206`、`accept-ranges: bytes`、`content-type: audio/mpeg`、单个文件约 8–10 MB（3 首实测 8.9 / 10.2 / 8.2 MB）。
- **无 CORS 头（实测）**：响应未见 `Access-Control-Allow-Origin`；且站点主页当前 500 故障（实测），只有静态 MP3 还可访问。
- 授权：软件本体 GPL v3；**示例 MP3 自身的许可未找到官方明文说明**（原站没有任何免責声明/许可页被 Wayback 收录），业界多用作演示音频。适合开发期占位专辑，不适合正式内容。
- 无专辑概念（单首循环曲）。

---

## 6. Pixabay Music

- 站点提供免费图片/视频/音频/音效，授权为 Pixabay Content License：可免费使用、无需署名（但欢迎署名）、可修改、可商用；禁止将内容原样再分发/销售（Standalone），禁止用于商标/冒用等。[Pixabay 授权摘要（存档版）](https://web.archive.org/web/20240314205846/https://pixabay.com/service/license-summary/)（当前页面亦有 Cloudflare 拦截，正文取自 2024-03 存档）
- **但公共 API 只覆盖图片与视频**（文档列出的端点与参数均无音乐/音频；获取图片/视频需 API Key，默认 100 次/60 秒）[Pixabay API 文档](https://pixabay.com/api/docs/)。
- 音乐只能通过网站浏览/单曲获取，无专辑实体、无音乐 API 端点。不推荐作为专辑曲库来源。

---

## 7. ccMixter

- **API 可用（实测）**：`http://ccmixter.org/api/query?f=json&limit=...&tags=...` 返回 JSON，含曲目名、作者、`license_name`/`license_url`、`files` 数组（文件名等）、曲目页 URL。旧版协议（HTTP + PHP 5.4 服务器），有 `Vary: Origin`，但响应头 `Access-Control-Allow-Origin: regular` 是一个非法/非标准值（实测）→ 跨域浏览器读取 JSON 会失败。
- **文件 URL（实测）**：`https://ccmixter.org/content/{username}/{file_name}.mp3`：带 `Referer: https://ccmixter.org/` 时返回 `HTTP/1.1 206` + `Accept-Ranges: bytes` + `Content-Range`；**不带 Referer 或被识别为跨域来源时 403**；响应无 CORS 头。→ 浏览器内播放需自建代理。
- 授权：每曲目独立标注（请参阅上面实测结果中的 `Attribution (4.0)` / `Attribution Noncommercial (4.0)` 等）。
- **无专辑概念**：ccMixter 是单曲 remix 站（同一首歌的多个版本以单独上传呈现）。不适合，仅作参考。

---

## 8. 其他补充来源（快速结论）

- **FreePD（freepd.com）**：已永久关闭（实测官网仅剩关站公告，无许可信息）。排除。
- **Incompetech / Kevin MacLeod**：免费档为 CC BY（须署名），付费 Standard License 可免署名；直接 MP3 实测支持 Range（206）但无 CORS 头、content-type 为 application/octet-stream；有整包下载入口，但曲目为单曲、无专辑实体。[Incompetech 音乐页](https://incompetech.com/music/royalty-free/music.html)、[许可页](https://incompetech.com/music/royalty-free/licenses/)
- **Live Music Archive / etree（archive.org 子集）**：实际上是"整场演出的完整录音"型的专辑化内容（见第 1 节），适合"现场专辑"产品线，stream-only、非商用授权。

---

## 9. 对比表

| 维度 | Internet Archive | Jamendo | FMA | Musopen | SoundHelix | Pixabay Music | ccMixter |
|---|---|---|---|---|---|---|---|
| 公共 API 现状 | ✅ 开放无 Key | ✅ 需 client_id（免费） | ❌ 已下线(404) | ❌ 无法连接/无 API | ❌ 无 API（仅静态文件） | ⚠️ API 仅图片/视频 | ✅ 有 API（HTTP 旧版） |
| 曲目元数据 | ✅ metadata + files | ✅ 丰富（曲目/专辑/封面/时长） | 历史有（已死） | 站点内（无 API） | ❌ 无 | ❌ 无音乐 API | ✅ 有（单曲） |
| 封面/专辑图 | ✅ 部分有（__ia_thumb / PNG） | ✅ image 字段(可调尺寸) | 历史有 | 站点内 | ❌ | 站点内 | ❌（仅曲目页） |
| 音频流 URL | ✅ /download/{id}/{file} | ✅ storage.jamendo.com/?trackid=... | 历史有 | ❌ | ✅ 直链 MP3 | 站点内 | ✅ 但需 Referer |
| Range 寻址(206) | ✅ 实测 | ✅ 实测 | n/a | n/a | ✅ 实测 | n/a | ✅ 实测(带 Referer) |
| CORS 头 | ✅ 实测 `*` | API ✅ / 存储域 ❌ | n/a | n/a | ❌ 实测无 | n/a | ❌ 实测无 |
| 浏览器直接播放 | ✅ | ⚠️ 基本可播(无 Web Audio) | — | — | ⚠️ 无 CORS(播放可, 分析不可) | — | ❌ 需代理 |
| 清晰授权体系 | ⚠️ 需白名单筛选 | ✅ CC 体系 + 商用另计 | ✅ CC（历史） | ✅ PD/CC0 | ⚠️ 未明示 | ✅ 内容许可(免署名可商用) | ✅ CC(逐曲目) |
| 专辑概念 | ✅ item=专辑 files=曲目 | ✅ 原生专辑+tracklist+zip | 历史有 album/tracks | ❌ | ❌ | ❌ | ❌ |
| 免费档限流 | 无官方数字(会限爬) | 3.5万次/月 | — | 下载限速 | 无 | 100 次/60 秒(图片/视频) | 无公开数字 |

---

## 10. 推荐：MVP 起步曲库

### 首选曲库（二选一或并行）

1. **Jamendo（质量优先的「真实专辑」曲库）**
   - 唯一一个「专辑 + 完整曲目列表 + 封面 + 独立流地址 + 授权字段」全部原生的免费合法来源；`albums/tracks` 一接口拿全专辑数据（[albums/tracks 文档](https://developer.jamendo.com/v3.0/albums/tracks)）。
   - 建议策略：`type=album` 拉取真专辑 → 对每张专辑取 zip/tracks → 按 `license_ccurl` 过滤出允许的产品场景（非商用可全量；商用按 CC BY/CC0 或洽谈 Jamendo 商用授权）→ 流走 storage 域（无 CORS 的坑在 Web Audio 场景需 Node 代理转发，普通 `<audio>` 播放无碍）。
2. **Internet Archive（体量与纵深的归档库）**
   - 无 Key、CORS + Range 全开、`album=item / tracklist=files` 映射天然成立；提供三块法律相对干净的内容切片：**78rpm/Great 78 公有领域老唱片（30.9 万项）**、**etree 授权现场录音（30.3 万项，stream-only）**、**FMA 镜像 CC 专辑（1.7 万项）**。
   - 建议策略：按白名单 collection（78rpm / etree / freemusicarchive / audio_music）检索 → 逐个校验 `licenseurl`/`rights`/`access-restricted-item` → 组装专辑模型；metadata 拉取无 Key 且体积小，媒体走 `/download/` 直链。

### 配套建议

- **开发期占位**：SoundHelix 17 首示例 MP3 适合塞进开发环境模拟"整张专辑"的播放器交互（无需授权风险即可联调 seek/进度条），正式上线前替换。
- **明确排除**：Musopen、Pixabay Music（无音乐 API）、ccMixter（无专辑 + 反查 Referer + 无 CORS）、FreePD（关站）、Incompetech（无专辑，作补充单曲源考虑）。

### 风险提示（诚实声明）

- 上述「CORS / Range」结论来自 2026-08-19 的直接 HTTP 实测，仅代表当时少数采样文件；上线前应以全量抽样复核。
- Internet Archive 的授权状态需逐 item 核验（大量内容无授权标注），请勿无差别全量入库。
- Jamendo 免费档仅限非商用，商用需按 CC 条款过滤或购买授权；存储域 CORS 缺失会使需要读音频数据的特性（如频谱可视化）必须走服务端代理。