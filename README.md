# Leopard Web

**在现代浏览器中重现 Mac OS X 10.5 Leopard 的桌面、应用和交互。**

Leopard Web 是一个纯前端、零构建的交互式复刻。Finder、桌面、Dock、应用菜单、系统偏好设置、窗口服务器与虚拟文件系统共享状态，目标是在浏览器允许的范围内，尽量接近一台可以实际操作的 Leopard。

它不是虚拟机，也不包含 Darwin、Apple 的系统文件或一套独立的 WebKit。所谓“Safari”“终端”“系统报告”和硬件设置仍运行在宿主浏览器的安全边界内；网页不能获得真实 macOS 的内核、文件系统或网络权限。

## 当前能力

| 部分 | 已实现内容 |
| --- | --- |
| 桌面与窗口 | Aqua 菜单栏与应用菜单、红黄绿窗口按钮、拖动/缩放/最小化、Aqua Sheet、打开/存储面板、强制退出、开关机与经典四语 Kernel Panic 画面 |
| Dock 与多任务 | 3D Dock、放大与弹跳、拖动排序、Stacks、Exposé、四个 Spaces、Dashboard、Time Machine 与应用状态指示 |
| Finder | 图标、列表、分栏、Cover Flow 四种视图，侧栏、搜索、Quick Look、简介、查看选项、标签、别名及常用文件操作 |
| 虚拟磁盘 | Finder、桌面、Spotlight、终端和应用共用一棵 VFS；支持创建、复制、移动、删除、恢复、导入与下载 |
| 系统偏好设置 | 外观、Dock、桌面与屏保、显示器、声音、网络、Bluetooth、账户、安全性、VoiceOver、Time Machine 等面板与辅助窗口 |
| 应用 | Safari、Mail、通讯录、iChat、iCal、iTunes、Dictionary、Photo Booth、QuickTime、预览、文本编辑、Automator 及一组系统实用工具 |
| 图形与动画 | 部分 Dashboard、Time Machine、DVD 舞台效果使用 WebGL2；高频 UI 动画优先使用 `requestAnimationFrame`、`transform` 与 `opacity` |
| 硬件桥接 | 在用户主动点击相应功能后，使用浏览器 API 请求摄像头、麦克风、屏幕捕捉、Bluetooth 或本地文件权限 |

## 快速开始

无需安装依赖，也无需执行构建：

```bash
git clone https://github.com/bitcinnamon/macos-web.git
cd macos-web
python3 -m http.server 8000
```

打开 [http://localhost:8000](http://localhost:8000)。

不要把 `file://.../index.html` 作为正式运行方式。ES modules、Service Worker、摄像头、麦克风、Bluetooth、屏幕捕捉和跨域请求都可能要求 HTTP(S)；`localhost` 在主流浏览器中通常可作为安全上下文。部署到公网时应使用 HTTPS。

建议使用当前版本的 Chrome、Edge 或 Safari。Web Bluetooth、Keyboard Lock 等 API 并非所有浏览器都实现，实际可用性还取决于操作系统、设备和浏览器策略。

## 推荐体验路径

1. 打开 Finder，切换四种视图，创建文件夹，并用 Quick Look 或预览打开文件。
2. 在 Photo Booth 中点击启动摄像头并授权；拍摄结果会写入虚拟文件系统，可在 Finder 中下载到真实电脑。
3. 打开“系统偏好设置”，体验桌面与屏幕保护程序、Dock、显示器、声音输入电平、网络、Bluetooth 和万能辅助。
4. 打开“关于本机”与“系统报告”，查看浏览器实际公开的信息以及明确标注的模拟项目。
5. 在终端运行 `help`，或尝试虚拟文件命令与网络命令。

## 启动与模块架构

项目是无框架、无打包器的原生 ES modules 单页应用。启动顺序刻意保证语言和磁盘状态先完成，再显示应用：

```text
index.html
  -> js/main.js
     -> initI18n()：只加载当前首选语言目录
     -> 动态加载 VFS / 图标 / System / Leopard
     -> await VFS.ready：等待持久层水合和迁移
     -> 动态加载应用注册表
     -> System.boot() + Leopard.init()
     -> leopard-ready 后注册 Service Worker
```

主要目录：

```text
index.html                         页面骨架、CSP 与单一 ES module 入口
css/aqua.css                       菜单栏、窗口、Dock、Aqua 控件
css/apps.css                       应用内容区样式
css/leopard.css                    Spaces、Dashboard、Time Machine 等扩展 UI
js/main.js                         启动编排、语言刷新、Service Worker 注册
js/config.js                       HOME、公共路径与 CACHE_VERSION
js/escape.js                       统一 HTML 转义 helper（esc/escapeHtml/helpEscape）
js/perf.js                         可选 Core Web Vitals + 启动阶段测量（?perf=1）
js/i18n/                           按语言动态加载的词条目录
js/vfs.js                          同步内存 VFS、迁移、历史与公共 API
js/vfs-storage.js                  IndexedDB/localStorage/memory 持久层
js/system/                         窗口、菜单、对话框、服务与应用注册表
js/apps/index.js                   eager 应用注册 + lazy 应用占位描述
js/apps/sysprefs.js                首次打开时动态加载的系统偏好设置
js/apps/leopard-native.js          原生感应用注册入口（按应用拆分为 mail.js / assistants.js 等）
sw.js                              版本化、网络优先的同源离线缓存
tests/*.mjs                        契约、行为和回归测试
scripts/check.sh                   本地与 CI 的统一检查入口
.github/workflows/ci.yml           GitHub Actions 配置
```

### 新增应用

1. 新建 `js/apps/myapp.js`，按需导入 `System`、`VFS`、`ICONS` 和 `t`。
2. 通过 `System.registerApp({ id, name, icon, open })` 注册实现。
3. eager 应用在 `js/apps/index.js` 静态导入；体积较大的应用可先用 `System.registerLazyApp()` 注册 Finder/Dock 可见描述，再在首次启动时 `import()`。
4. 如需显示在 Finder 的“应用程序”目录，在 `js/vfs.js` 的系统应用清单中登记相同 `appId`。
5. 界面文字放入 `js/i18n/locales/zh-CN.js` 与 `en.js`，然后运行完整检查。

## HOME 与旧数据迁移

当前配置的虚拟用户目录是：

```text
HOME_USER = macosx
HOME      = /用户/macosx
```

所有桌面、文稿、下载、图片、音乐、影片、公共、站点和废纸篓路径均从 `js/config.js` 的 `paths` 派生。应用代码不应再硬编码用户名。

早期版本使用 `/用户/roll`。启动时若检测到结构有效的旧磁盘、且新的 `/用户/macosx` 尚不存在，VFS 会执行一次原子迁移：

1. 把原始 `macweb.vfs.v1` 内容逐字保存到 `macweb.vfs.v1.backup.pre-home-migration`；这个备份不会在后续启动时被覆盖。
2. 在副本上把旧 HOME 分支移到 `/用户/macosx`，保留节点 ID、创建/修改时间和文件内容。
3. 只改写已知“路径元数据”字段；普通文档正文中即使出现 `/用户/roll` 也不会被替换。
4. 完成结构校验后才启用新树。若已经存在有效的新 HOME，不会把旧分支强行合并进去。

如果浏览器连安全备份都无法写入（例如配额已满），迁移后的树只用于只读启动，不会覆盖唯一的旧数据。清理浏览器站点数据会同时删除虚拟磁盘、迁移备份和偏好设置；重要文件应先从 Finder 下载到真实磁盘。

## VFS 持久化

VFS 对应用保持同步的内存 API，但持久化是异步的：

- 主后端是 IndexedDB 数据库 `macweb-vfs`，当前 schema 为 **v2**。
- `state` object store 保存文件树与元数据；`blobs` object store 单独保存照片、导入文件等 Blob 负载，避免把大型二进制内容长期塞进 JSON。
- 所有快照写入经过同一条 Promise 队列串行执行，连续 Finder 操作不会因较慢的旧事务反向覆盖新状态。
- IndexedDB 打开、水合或运行期写入失败时，后端会降级到 `localStorage`；若 `localStorage` 也不可写，VFS 仍保留在内存中，但刷新页面后不能保证恢复。
- 从早期 schema 或 Data URL 载入的二进制内容会在可行时升级为 Blob 记录，并在水合后恢复为 object URL。
- 旧 `localStorage` 树仍是迁移与兼容来源；存在有效 IndexedDB 状态时，以 IndexedDB 为准。

供应用、调试和测试使用的状态接口：

| API | 含义 |
| --- | --- |
| `await VFS.ready` | 等待 IndexedDB 打开、数据水合、schema 升级与系统目录协调完成；Finder 和应用在此之后才注册 |
| `await VFS.flush()` | 等待当前队列全部落盘，返回最近持久化是否成功 |
| `VFS.storageStatus()` / `getStorageStatus()` | 返回 `backend`、`pending`、`lastError`、`fallbackReason`、`estimatedBytes`、`schemaVersion`、`lastSavedAt` 与撤销历史体积 |
| `vfs-storage-status` 事件 | 后端、排队数量或错误状态变化时通知 UI/诊断工具 |

这些数据只保存在当前站点的浏览器存储中，不等于加密磁盘，也不会自动同步到其他浏览器或设备。

## 性能策略

- **语言目录懒加载**：启动只下载当前选中的 `zh-CN` 或 `en` 目录，不再同时解析两份大型词条表。首次切换到尚未加载的语言时才动态导入另一份目录；并发切换采用“最后一次选择生效”。
- **应用懒加载**：系统偏好设置保留 Finder/Dock 中的图标和名称，但约 240 KB 的实现模块在第一次打开时才下载。注册表会合并并发启动、保留占位对象身份，并允许加载失败后重试。
- **离线缓存**：桌面进入可交互状态后才注册 `sw.js`。Service Worker 按 `CACHE_VERSION` 建立版本化缓存，删除旧版本，对同源 GET 使用网络优先；断网时回退到已缓存的模块、样式、页面和资源。网络优先用于避免新 HTML 与旧 ES module 图混用。
- **动画与清理**：高频动画尽量落在合成层；窗口生命周期提供 AbortSignal、监听器/定时器/媒体流/object URL 清理接口，关闭窗口时集中释放资源。
- **模块预取**：`index.html` 用 `link rel="modulepreload"` 预取并预编译核心模块图（只 fetch+compile、不执行，求值顺序不变），让语言目录加载与核心模块下载并行。
- **可选的性能测量**：加 `?perf=1`（或 `localStorage['macweb.perf']='1'`）会加载 `js/perf.js`，把启动各阶段耗时与 FCP/LCP/CLS/INP/TTFB 上报到控制台和 `window.__leopardPerf`；默认零开销。
- **首屏取舍**：项目不打包、不压缩，仍会产生多个 ES module 请求。Service Worker 主要改善回访和离线可用性，并不能替代 HTTP/2/3、压缩、CDN 或生产服务器缓存头。

修改 JavaScript 或 CSS 后，应同步提高 `js/config.js` 中的 `CACHE_VERSION` 以及 `index.html` 中入口和样式的 `?v=`，避免旧缓存混入新模块图。

### 性能验证边界

源码体积、模块请求数、动画实现和单元测试都不能代替真实的 Core Web Vitals。FCP、LCP、CLS、TBT/INP、Speed Index、主线程长任务与网络瀑布应在静态服务器或真实部署上，使用 **Chrome DevTools MCP 的 Performance trace** 另行测量，并分别覆盖首次访问、回访缓存、不同窗口尺寸和 CPU/网络节流。本项目的 `scripts/check.sh` 不采集这些浏览器指标，因此 README 不宣称尚未实测的 Core Web Vitals 分数。

## 安全与隐私

### 页面安全基线

- `index.html` 声明 CSP：脚本只允许同源，禁用 object、base URI 和表单提交；图像/媒体/网络/iframe 只开放实现需要的协议。
- Safari 的普通网页 iframe 使用 sandbox；Bilibili 播放器使用更窄的 `allow-scripts allow-same-origin allow-presentation`，并设置 `referrerpolicy="no-referrer"`。
- 外部 Bilibili 列表内容在插入内部阅读器前经过 HTML 转义。
- 生产部署仍建议在 HTTP 响应头发送同等或更严格的 CSP、`X-Content-Type-Options`、`Referrer-Policy` 和必要的跨源策略；HTML `<meta>` 不是完整的服务器安全配置。

### 权限只由用户动作触发

项目不会在启动时静默请求硬件权限：

| 权限/API | 触发位置 | 数据去向 |
| --- | --- | --- |
| 摄像头 / `getUserMedia({ video })` | Photo Booth 中点击启用摄像头 | 实时流留在页面；拍摄结果写入 VFS |
| 麦克风 / `getUserMedia({ audio })` | 系统偏好设置“声音 → 输入”中启动监测 | 用 Web Audio 计算实时电平；关闭监测/窗口后停止轨道 |
| 屏幕捕捉 / `getDisplayMedia()` | 抓图/捕捉工具中主动选择 | 捕捉结果写入 VFS |
| Bluetooth / `requestDevice()` | Bluetooth 设置助理中点击扫描/继续 | 浏览器展示设备选择器；应用仅保存所选设备的显示名称等模拟状态 |
| 文件/文件夹选择 | 打开、导入、桌面图片等操作 | 只处理用户明确选择的内容 |

权限的实际范围、记忆方式和撤销入口由宿主浏览器控制。拒绝权限后，相关应用应保留可关闭的错误或模拟界面；网页不会因此获得系统级权限。

### 外部网络请求

Safari、Dictionary、网络实用工具、终端网络命令和示例媒体可能连接第三方站点。特别是：

- 访问 Bilibili 普通页面时，兼容阅读器会请求 `https://r.jina.ai/http://<目标地址>`。这会把目标 Bilibili URL 以及正常的网络请求元数据暴露给 `r.jina.ai`；它不是本项目自建或控制的服务。
- 播放 Bilibili 视频会另外连接 `player.bilibili.com`。普通 Safari iframe、搜索引擎、Wikipedia、Dictionary API、测试视频和网络诊断也会直接连接各自服务。
- Service Worker 只拦截并缓存同源 GET，不缓存上述跨域响应。

不要在此模拟系统中存放密码、密钥或敏感文件。VFS、钥匙串界面、FileVault、网络设置和磁盘工具均是网页级模拟，不提供真实系统加密或隔离。

## 浏览器限制

| 功能 | 真实边界 |
| --- | --- |
| Safari | 使用宿主浏览器的 iframe/fetch，不拥有独立进程、真实 Safari UA、Cookie 仓库、扩展体系或跨源读取权限。被 `X-Frame-Options`、CSP `frame-ancestors`、登录流程或第三方 Cookie 策略阻止的网站无法由纯前端强行打开 |
| 网页链接 | 同源可读页面可拦截链接并在模拟 Safari 新标签中打开；跨源 iframe 的 DOM 受同源策略保护，其内部导航由网站与宿主浏览器决定 |
| 文件 | VFS 不会直接修改真实磁盘。上传/文件选择和下载是虚拟磁盘与真实磁盘之间的显式桥梁 |
| 硬件报告 | 只能显示浏览器公开的数据。现代浏览器会主动模糊或隐藏 CPU 型号、内存、GPU、序列号和设备信息；无法读取的字段只能标注为推断或模拟 |
| Bluetooth | Web Bluetooth 支持范围有限，通常要求 Chromium、安全上下文、用户手势和兼容适配器；Safari/Firefox 多数版本不可用 |
| 键盘 | 普通模式避开常见宿主快捷键；Keyboard Lock 只在浏览器支持、用户进入允许状态时生效，系统保留组合键仍可能被宿主 macOS 截获 |
| 网络/磁盘/内核 | ping、端口扫描、分区、kext、FileVault、网络服务等只能用网页允许的 fetch、计时和模拟状态表达，不会操作宿主系统 |

## 检查与 CI

要求 Node.js 22（与 CI 一致）。单元/契约检查无需 `npm install`：

```bash
./scripts/check.sh
```

统一检查包含：

1. 使用 Node `vm.SourceTextModule` 按真正的 ES module 语法解析全部浏览器 JavaScript，而不是把模块误当脚本执行 `node --check`。
2. 审计中英文目录的键、值类型、插值变量、源码中实际使用的 key 和残留的字面 `${t(...)}`。
3. 静态审计所有 `innerHTML`/`insertAdjacentHTML`/`outerHTML` 插值，标记未转义的用户/文件文本字段（`scripts/check-html-escaping.mjs --strict`）。
4. 执行 `node --test tests/*.mjs`，覆盖 HOME 迁移、IndexedDB schema/Blob/串行写入与降级、VFS 操作、懒加载、菜单、窗口生命周期、缓存、安全和可访问性等契约。
5. 执行工作区与暂存区的 `git diff --check`。

GitHub Actions 在 `push` 和 `pull_request` 上使用 Node.js 22 运行同一 `./scripts/check.sh`，权限为只读，并取消同一分支上已过时的重复任务。

这些测试以模块和行为契约为主。摄像头、麦克风、Bluetooth、跨域 iframe、Service Worker 更新、真实下载以及响应式窗口布局仍需在 `localhost`/HTTPS 的真实浏览器中回归；浏览器控制台应保持无未解释错误。

### 真实浏览器回归（可选，需 dev 依赖）

附带的 Playwright 冒烟测试在真实 Chrome 里走完整启动路径（语言加载 → 模块图 → VFS 水合 → 应用注册 → 开机 → 桌面可交互），并断言打开应用、应用注册和"无未捕获异常"：

```bash
npm install                     # 只安装 @playwright/test；运行时代码仍零依赖
npm run test:e2e
```

`playwright.config.mjs` 默认复用已安装的 Google Chrome（`channel: 'chrome'`），无需下载 Playwright 浏览器；本机没有 Chrome 时先执行 `npx playwright install chrome`。它会自动用 `python3 -m http.server` 起静态服务器。摄像头、麦克风、Bluetooth、跨域 iframe 与真实下载仍只能在真实浏览器/硬件上人工验证。

## 常见问题

### 修改后仍看到旧界面

确认 `CACHE_VERSION` 与 `index.html` 的 `?v=` 一致，然后在 DevTools 的 Application 面板更新/注销旧 Service Worker，或清理该站点缓存后重载。开发时也可暂时勾选 Disable cache。

### 文件刷新后消失

在控制台检查：

```js
VFS.storageStatus()
await VFS.flush()
```

如果 `backend` 是 `memory`，或 `lastError`/`fallbackReason` 显示配额与隐私模式错误，当前改动可能没有持久化。先下载重要文件，再检查站点存储权限与剩余配额。

### 外部网站空白或拒绝连接

这是 iframe/CSP/登录/第三方 Cookie 限制，不代表地址栏或标签页逻辑一定失效。纯前端项目无法伪造一个具有独立网络栈和 UA 的真实 Safari；需要服务端代理时，应单独评估登录信息、Cookie、版权和隐私边界。

## 说明

Leopard Web 是非官方的致敬与学习项目，与 Apple Inc. 无关。Apple、Mac、Mac OS X 及相关名称和标识是其各自权利人的商标。本项目不分发 macOS 系统文件，不能替代真实的 Mac OS X、虚拟机或安全沙箱。
