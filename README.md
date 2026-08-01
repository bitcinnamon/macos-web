# Leopard Web

**在现代浏览器中重现 Mac OS X 10.5 Leopard。**

Leopard Web 是一个纯前端的交互式桌面复刻。它不只还原壁纸、窗口和 Dock，也让 Finder、应用菜单、系统偏好设置、虚拟文件系统以及各个应用共享同一套状态，尽可能呈现一台可以真正操作的 Leopard。

项目使用 HTML、CSS 与原生 JavaScript 编写，无需安装依赖或执行构建。它不是虚拟机，也不包含 Darwin 或原版 WebKit；目标是在浏览器允许的范围内，还原 Leopard 的视觉、交互和使用逻辑。

## 核心体验

| 部分 | 实现内容 |
| --- | --- |
| 桌面与窗口 | Aqua 菜单栏、应用菜单、红黄绿窗口按钮、拖动与缩放、最小化动画、强制退出，以及 Leopard 风格的开机、关机和四语 Kernel Panic 画面 |
| Dock 与多任务 | 3D Dock、图标放大与弹跳、拖动排序、应用指示灯、Stacks、Exposé、四个 Spaces、Dashboard 与 Time Machine |
| Finder | 图标、列表、分栏和 Cover Flow 四种视图，Leopard 侧栏、搜索、Quick Look、简介、查看选项、别名以及完整的文件操作 |
| 文件系统 | Finder、桌面、Spotlight、终端和应用共用一套虚拟文件系统；文件可创建、移动、复制、删除、恢复、导入和下载，并保存在浏览器本地 |
| 系统偏好设置 | 覆盖外观、Dock、显示器、声音、网络、Bluetooth、账户、FileVault、VoiceOver 与 Time Machine 等面板及其辅助窗口 |
| 浏览器硬件桥接 | 在用户主动操作后请求摄像头、麦克风、屏幕捕捉、Bluetooth 或本地文件权限，并把产生的内容写回虚拟桌面 |
| 图形与动画 | WebGL2 用于 Dashboard、Time Machine、DVD 舞台等效果；其余高频动画主要使用 `requestAnimationFrame`、`transform` 与 `opacity` 合成 |

<details>
<summary><strong>内置应用与实用工具</strong></summary>

- 日常应用：Safari、Mail、通讯录、iChat、iCal、iTunes、Dictionary、Photo Booth、QuickTime Player、预览、文本编辑、备忘录、便笺与计算器
- 系统应用：Finder、系统偏好设置、Dashboard、Time Machine、Front Row、Automator、图像捕捉、DVD 播放器与国际象棋
- 实用工具：终端、活动监视器、控制台、磁盘工具、网络实用工具、系统报告、字体册、钥匙串访问、抓图、迁移助理、Boot Camp 助理与 OpenGL 演示

</details>

## 快速开始

```bash
git clone https://github.com/bitcinnamon/macos-web.git
cd macos-web
python3 -m http.server 8000
```

然后访问 [http://localhost:8000](http://localhost:8000)。

项目没有安装步骤。也可以直接打开 `index.html`，但摄像头、麦克风、Bluetooth、屏幕捕捉以及部分网络请求通常需要 `localhost` 或 HTTPS 安全上下文，因此建议使用静态服务器。

## 推荐体验路径

1. 打开 Finder，在四种视图间切换，创建文件夹并用 Quick Look 预览文件。
2. 在 Photo Booth 授权摄像头并拍照；照片会进入虚拟文件系统，可从 Finder 下载到真实电脑。
3. 打开“系统偏好设置”，尝试桌面与屏幕保护程序、Dock、Exposé 与 Spaces、显示器、声音、网络和万能辅助。
4. 打开“关于本机”与“系统报告”，查看浏览器能够读取到的主机、显示器、GPU、内存和设备信息。
5. 在终端执行 `help`，或试试 `kextunload QuartzExtreme.kext`；重新装载扩展可恢复图形合成。

## 真实能力与模拟边界

| 功能 | 实现方式与限制 |
| --- | --- |
| 文件 | 系统内文件保存在虚拟文件系统和 `localStorage` 中，不会直接改动真实磁盘。上传与下载是两者之间的显式桥梁 |
| 摄像头、麦克风与屏幕 | 使用浏览器媒体 API；只有用户点击相关功能后才会请求权限，拒绝授权时应用仍保留模拟界面 |
| Bluetooth | 使用浏览器提供的 Bluetooth API。是否可用取决于浏览器、操作系统、HTTPS 环境和设备支持 |
| 硬件信息 | “关于本机”和“系统报告”读取浏览器公开的数据；出于隐私保护，浏览器可能隐藏、概括或限制部分型号与容量信息 |
| Safari | 网页会直接在 Leopard Safari 窗口内尝试加载，不转交外部浏览器。网站若使用 CSP 或 `X-Frame-Options` 禁止嵌入，前端无法绕过 |
| 终端与系统设置 | 提供与虚拟文件系统联动的命令环境；内核扩展、磁盘、网络服务和多数系统级设置属于安全的网页模拟，不会修改宿主系统 |

## 键盘与宿主 macOS

普通模式使用网页专用组合键，避免直接抢占宿主 macOS 常用快捷键。可以在“系统偏好设置 → 键盘与鼠标 → 键盘快捷键”中查看或切换方案。用户主动进入全屏键盘捕获后，系统会在浏览器支持时尝试使用 Keyboard Lock API 接收更接近原版的按键；操作系统保留的组合键仍可能优先交给宿主系统。

所有核心操作同时提供菜单或鼠标入口，不依赖键盘捕获。

## 数据与隐私

- 虚拟磁盘、偏好设置、Dock 排列和桌面状态保存在当前浏览器中。
- 摄像头、麦克风、屏幕和 Bluetooth 权限由浏览器管理，本项目不会静默申请。
- Safari、Dictionary 以及终端中的网络功能可能访问外部站点；桌面本身不需要应用服务器。
- “系统偏好设置 → 还原”可以清除本地状态并恢复初始系统。

清除浏览器站点数据或更换浏览器配置文件，也会删除未下载到真实磁盘的虚拟文件。

## 项目结构

```text
index.html              页面入口与系统骨架
css/aqua.css            Aqua 控件、菜单栏、窗口与 Dock
css/apps.css            应用程序界面
css/leopard.css         Leopard 交互与视觉补充
js/system.js            窗口服务器、菜单、Dock、快捷键与系统服务
js/vfs.js               虚拟文件系统与本地持久化
js/leopard.js           Exposé、Spaces、Dashboard 与图形效果
js/apps/*.js            Finder、系统应用与实用工具
tests/*.mjs             VFS、硬件信息与系统界面契约测试
```

这是一个无框架、无打包器的单页项目。新增应用通常只需要注册应用定义、实现窗口内容，并通过 `System` 与 `VFS` 接入现有桌面状态。

## 检查

```bash
find js -name '*.js' -print0 | xargs -0 -n1 node --check
node --test tests/*.mjs
```

## 说明

Leopard Web 是非官方的致敬与学习项目，与 Apple Inc. 无关。Apple、Mac、Mac OS X 及相关名称和标识是其各自权利人的商标。本项目不会分发 macOS 系统文件，也不能替代真实的 Mac OS X 或浏览器虚拟机。
