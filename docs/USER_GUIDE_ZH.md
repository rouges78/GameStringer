# 📖 GameStringer - 完整用户指南

## 目录

1. [概述](#概述)
2. [首次启动和配置文件](#首次启动和配置文件)
3. [游戏库和游戏详情](#游戏库和游戏详情)
4. [Neural Translator Pro](#neural-translator-pro)
5. [Translation Wizard](#translation-wizard)
6. [Translation Bridge](#translation-bridge)
7. [Subtitle Translator Pro](#subtitle-translator-pro)
8. [Retro ROM Tools](#retro-rom-tools)
9. [公共API v1](#公共api-v1)
10. [Voice Clone Studio](#voice-clone-studio) *(新功能 v1.0.5)*
11. [VR Text Overlay](#vr-text-overlay) *(新功能 v1.0.5)*
12. [Quality Gates](#quality-gates) *(新功能 v1.0.5)*
13. [Player Feedback](#player-feedback) *(新功能 v1.0.5)*
14. [新AI提供商 v1.0.6](#新ai提供商-v106) *(新功能 v1.0.6)*
15. [Community Hub v1.0.7](#community-hub-v107) *(新功能 v1.0.7)*
16. [UI改进 v1.0.9](#ui改进-v109) *(新功能 v1.0.9)*
17. [补丁导出](#补丁导出)
18. [应用到游戏](#应用到游戏)
19. [备份管理](#备份管理)
20. [翻译编辑器](#翻译编辑器)
21. [活动历史](#活动历史)
22. [词典](#词典)
23. [故障排除](#故障排除)

---

## 概述

GameStringer是一个用于视频游戏自动和手动翻译的高级系统。支持：

- **游戏引擎**：Unity、Unreal Engine、RPG Maker、Ren'Py、Godot、Telltale、Wolf RPG、Kirikiri等
- **文件格式**：CSV、JSON、XML、PO/POT、YAML、TXT、SRT、VTT、ASS/SSA等
- **AI提供商**：Claude、Gemini、GPT、DeepSeek、Mistral、Groq、Ollama、**Qwen 3**、**NLLB-200**（18+提供商）
- **语言**：200+支持语言（使用NLLB-200）
- **多语言界面**：IT、EN、ES、FR、DE、JA、ZH、KO、PT、RU、PL（11种语言）
- **游戏商店**：Steam、Epic Games、GOG、Origin、Battle.net、Ubisoft、itch.io、Amazon Games
- **新功能 v1.0.5**：Voice Clone Studio、VR Text Overlay、Quality Gates、Player Feedback
- **新功能 v1.0.6**：Qwen 3（亚洲语言）、NLLB-200（200种语言）、错误修复
- **新功能 v1.0.7**：Community Hub、GitHub Discussions、许可证 v1.1
- **新功能 v1.0.8**：更新下载修复
- **新功能 v1.0.9**：动画标题、更新通知、UI优化

---

## 首次启动和配置文件

### 创建配置文件

首次启动时，GameStringer要求创建用户配置文件：

1. **点击"创建配置文件"**（初始屏幕）
2. **输入配置文件名称**（例如："我的名字"）
3. **设置密码**（至少6个字符）
4. **点击"创建"**确认

### 登录

访问现有配置文件：

1. **从列表中选择配置文件**
2. **输入密码**
3. **（可选）**勾选"记住密码"以自动登录
4. **点击"登录"**

### 配置文件管理

- **切换配置文件**：点击右上角的配置文件图标 → "切换配置文件"
- **注销**：点击配置文件图标 → "注销"
- **配置文件设置**：前往设置 → 配置文件

---

## 游戏库和游戏详情

### 游戏库

游戏库显示从Steam、Epic Games、GOG和其他商店同步的所有游戏。

- **刷新**：重新加载游戏列表
- **共享**：显示/隐藏家庭共享游戏
- **筛选**：按平台、安装状态、引擎筛选

### 游戏详情页面

点击游戏打开**3:1**布局的详情页面：

#### 主列（75%）

- **截图画廊**：可点击的最多12张截图网格（灯箱效果）
- **快速信息**：引擎、文件数量、安装路径、DLC
- **文件/翻译/补丁选项卡**：
  - **文件**：带"Neural Translator"按钮的可翻译文件
  - **翻译**：此游戏的活动翻译
  - **补丁**：安装/删除Unity、Unreal、RPG Maker补丁

#### 右侧边栏（25%）

- **游戏信息**：开发商、发行商、发布日期、类型、支持语言
- **操作**：翻译游戏、扫描文件
- **HowLongToBeat**：完成游戏的预计时间

#### 翻译建议

页面底部，系统分析游戏并建议**最佳翻译方法**：

| 方法 | 何时使用 |
|------|---------|
| **Live Unity** | 带BepInEx + XUnity的Unity游戏 |
| **File Translation** | 找到本地化文件（JSON、CSV等） |
| **OCR Overlay** | 未找到文件，实时视觉翻译 |

---

## Neural Translator Pro

### 如何翻译文件

1. **从Steam库选择游戏**或手动上传
2. **加载要翻译的文件**（拖放或浏览）
3. **配置选项**：
   - **源语言**：原始语言（例如：英语）
   - **目标语言**：翻译语言（例如：中文）
   - **AI提供商**：Claude（推荐）、Gemini或GPT
   - **API密钥**：输入所选提供商的API密钥
4. **点击"开始翻译"**启动翻译
5. **在进度条中监控进度**

### 高级选项

| 选项 | 描述 |
|------|------|
| **Quality Checks** | 自动质量检查（数字、格式等） |
| **Translation Memory** | 重用以前的翻译以加速 |
| **Batch Size** | 并行翻译的字符串数量（默认：10） |

### 预估成本

系统在开始前显示成本估算：
- **Claude**：每1K token约$0.003
- **Gemini**：每1K token约$0.0005（更便宜）
- **GPT-4**：每1K token约$0.01

---

## Translation Wizard

Translation Wizard是自动翻译游戏文件的引导式程序。

### 如何使用向导

1. **前往Translator** → 点击"Translation Wizard"
2. **从库中选择游戏**或手动输入路径
3. **扫描文件**：向导自动找到可翻译文件
4. **选择要翻译的文件**（可选择多个）
5. **配置选项**：
   - 源语言和目标语言
   - AI提供商
   - 质量选项
6. **开始批量翻译**
7. **在进度条中监控进度**

### 自动检测的格式

| 扩展名 | 类型 |
|--------|------|
| `.json` | JSON本地化 |
| `.csv` | 文本表格 |
| `.xml` | XML配置 |
| `.po/.pot` | Gettext（Linux标准） |
| `.txt` | 纯文本 |
| `.yaml` | YAML配置 |

---

## Translation Bridge

Translation Bridge允许在游戏过程中**实时**翻译Unity游戏。

### 要求

- Unity游戏（Mono或IL2CPP）
- 已安装BepInEx
- XUnity.AutoTranslator插件

### 如何配置

1. **前往菜单中的Translation Bridge**
2. **从列表中选择Unity游戏**
3. **安装BepInEx**（如果未安装则自动）
4. **配置XUnity.AutoTranslator**：
   - 目标语言
   - 翻译端点
5. **启动游戏** - 翻译将自动显示

### 运行模式

- **本地缓存**：翻译保存以供重用
- **实时翻译**：新字符串即时翻译
- **回退**：离线时仅使用缓存

---

## Subtitle Translator Pro

> v1.0.4新功能

Subtitle Translator Pro允许翻译各种格式的字幕。

### 支持的格式

| 格式 | 扩展名 | 描述 |
|------|--------|------|
| **SubRip** | .srt | 最常见格式 |
| **WebVTT** | .vtt | Web标准 |
| **ASS/SSA** | .ass/.ssa | 带样式的高级字幕 |

### 使用方法

1. **前往菜单中的Subtitle Translator**
2. **加载字幕文件**（拖放或浏览）
3. **选择源语言和目标语言**
4. **实时预览**翻译
5. **导出**为所需格式

### 功能

- **QA验证**：自动检查时间轴和格式
- **同步预览**：使用原始时间轴查看翻译
- **多格式导出**：在SRT、VTT、ASS之间转换

---

## Retro ROM Tools

> v1.0.4新功能

用于翻译ROM上复古游戏的工具。

### 支持的游戏机

| 游戏机 | 缩写 |
|--------|------|
| Nintendo Entertainment System | NES |
| Super Nintendo | SNES |
| Game Boy | GB |
| Game Boy Color | GBC |
| Game Boy Advance | GBA |
| Sega Genesis/Mega Drive | Genesis |
| PlayStation 1 | PSX |
| Nintendo 64 | N64 |

### 功能 (2)

- **Table File Parser**：读取和生成用于字符映射的.TBL文件
- **Font Injection**：注入包含中文字符的字体
- **集成Hex编辑器**：直接ROM修改

### 使用方法 (2)

1. **前往菜单中的Retro ROM Tools**
2. **加载游戏ROM**
3. **加载或生成Table File（.TBL）**
4. **从ROM提取文本**
5. **使用AI或手动翻译**
6. **将翻译注入ROM**

---

## 公共API v1

> v1.0.4新功能

GameStringer提供用于外部集成的REST API。

### 可用端点

| 方法 | 端点 | 描述 |
|------|------|------|
| `POST` | `/api/v1/translate` | 单个字符串翻译 |
| `POST` | `/api/v1/batch` | 批量翻译（最多100个字符串） |
| `GET` | `/api/v1/languages` | 20种支持语言列表 |
| `GET` | `/api/v1/health` | 服务健康检查 |

### 请求示例

```json
POST /api/v1/translate
{
  "text": "Hello, world!",
  "source": "en",
  "target": "zh",
  "provider": "gemini"
}
```

### 响应示例

```json
{
  "translation": "你好，世界！",
  "source": "en",
  "target": "zh",
  "provider": "gemini",
  "tokens": 12
}
```

### CI/CD使用

API非常适合将GameStringer集成到自动化构建管道中。

---

## Voice Clone Studio

> v1.0.5新功能

使用AI克隆语音，实现游戏自动配音。

### 支持的提供商

| 提供商 | 类型 | 质量 |
|--------|------|------|
| **ElevenLabs** | 云端 | ⭐⭐⭐⭐⭐ 卓越 |
| **OpenAI TTS** | 云端 | ⭐⭐⭐⭐ 非常好 |

### 语音预设

- 🎭 **旁白**：平静而权威的声音
- ⚔️ **英雄**：勇敢而坚定的声音
- 😈 **反派**：威胁而深沉的声音
- 👶 **儿童**：年轻而快乐的声音
- 🤖 **机器人**：合成而金属的声音
- 👻 **耳语**：低沉而神秘的声音

### 使用方法 (3)

1. **前往菜单中的Voice Clone**
2. **输入要转换为音频的文本**
3. **选择提供商**（ElevenLabs或OpenAI）
4. **选择语音预设**
5. **生成音频**并下载MP3/WAV文件

---

## VR Text Overlay

> v1.0.5新功能

VR游戏的3D空间字幕。

### 支持的头显

| 头显 | 支持 |
|------|------|
| **Oculus Quest/Rift** | ✅ 完全 |
| **SteamVR**（Valve Index、HTC Vive） | ✅ 完全 |
| **Windows Mixed Reality** | ✅ 完全 |

### 位置预设

- **Center** - 玩家前方
- **Bottom** - 底部（经典字幕）
- **Top** - 顶部（通知）
- **Follow Head** - 跟随视线

### 使用方法 (4)

1. **前往菜单中的VR Overlay**
2. **自动检测头显**
3. **配置位置和文字大小**
4. **在启动VR游戏前启动覆盖层**
5. 字幕将显示在3D空间中

---

## Quality Gates

> v1.0.5新功能

翻译自动质量控制系统。

### 自动检查

| 检查 | 描述 |
|------|------|
| **Placeholder** | 验证{0}、{1}、%s等 |
| **数字** | 数字正确保留 |
| **HTML标签** | `<color>`、`<b>`等完整 |
| **长度** | 翻译不会太长/太短 |
| **标点符号** | 与原文一致 |

### 置信度级别

| 级别 | 分数 | 颜色 |
|------|------|------|
| 🔴 严重 | < 40% | 红色 |
| 🟠 低 | 40-59% | 橙色 |
| 🟡 中 | 60-74% | 黄色 |
| 🟢 高 | 75-89% | 绿色 |
| 💚 完美 | 90-100% | 深绿 |

### 使用方法 (5)

1. **前往菜单中的Quality Gates**
2. **加载翻译**（JSON、CSV或粘贴）
3. **自动分析**每个字符串
4. **按置信度级别筛选**
5. **导出JSON报告**

---

## Player Feedback

> v1.0.5新功能

收集和管理玩家对翻译的反馈。

### 反馈类别

- 📝 **翻译错误** - 意思不对
- 🔤 **语法错误** - 语法/拼写
- 🎭 **语气不当** - 语言风格错误
- ❓ **不清楚** - 翻译令人困惑
- ✨ **建议** - 改进建议

### 评分系统

⭐⭐⭐⭐⭐ 每个翻译1-5星评分

### 反馈状态

| 状态 | 描述 |
|------|------|
| 🆕 新的 | 刚收到 |
| 👀 审核中 | 正在分析 |
| ✅ 已解决 | 已修正 |
| ❌ 已拒绝 | 不适用 |

### 使用方法 (6)

1. **前往菜单中的Player Feedback**
2. **查看收到的反馈**
3. **按类别、状态、评分筛选**
4. **更新反馈状态**
5. **导出CSV进行分析**

---

## 新AI提供商 v1.0.6

> v1.0.6新功能

### Qwen 3 - 亚洲语言

针对中文、日语和韩语优化的提供商。

| 模型 | 参数 | 所需RAM |
|------|------|---------|
| `qwen3:4b` | 4B | 4GB |
| `qwen3:8b` | 8B | 8GB |
| `qwen3:14b` | 14B | 16GB |
| `qwen3:32b` | 32B | 32GB |

**安装**：
```bash
ollama pull qwen3:14b
```

**优化语言**：中文、日本語（日语）、한국어（韩语）

### NLLB-200 - 200种语言

支持200种语言的Meta AI提供商，包括稀有语言。

**支持的特殊语言**：
- 泰语、越南语、印地语、阿拉伯语
- 斯瓦希里语、印尼语、土耳其语
- 乌克兰语、孟加拉语、泰米尔语

**配置**：
1. 前往**设置 → API密钥**
2. 输入**HuggingFace API密钥**（免费）
3. 选择**NLLB-200**作为提供商

### Generic Ollama

使用Ollama中安装的任何模型进行翻译。

**推荐模型**：
- `llama3.2` - 质量/速度平衡好
- `mistral` - 欧洲语言优秀
- `gemma2` - 快速轻量

---

## Community Hub v1.0.7

> v1.0.7新功能

GameStringer社区的集中枢纽。

### GitHub Discussions

直接访问社区讨论：

- **公告**：官方新闻和更新
- **问答**：社区的问题和答案
- **想法**：新功能建议
- **展示**：社区项目和翻译

### 如何访问

1. **前往侧边栏中的Community Hub**
2. **浏览**讨论类别
3. **在GitHub上直接参与**

### 许可证 v1.1

- **YouTuber/主播**：标注来源即可
- **非商业分支**：允许
- **商业用途**：需要授权

---

## UI改进 v1.0.9

> v1.0.9新功能

界面的美学和功能更新。

### 动画标题

所有翻译页面现在都有带以下效果的标题：

- **"呼吸"效果**：平滑扩展/收缩的渐变（12秒）
- **深阴影**：带蓝色色调的shadow-xl
- **统一渐变**：Sky → Blue → Cyan

### 更新通知

导航栏中的**铃铛**现在管理更新：

| 状态 | 行为 |
|------|------|
| 🔔 灰色 | 无通知 |
| 🔔 黄色 | 有未读通知 |
| 🔔 绿色 + 脉冲 | 有可用更新！ |

**功能**：
- **声音**：检测到更新时播放两个旋律音
- **绿色徽章**：动画下载图标
- **点击**：打开包含更新内容的弹窗
- **下载按钮**：打开下载页面

### 侧边菜单

- **子项悬停**：深绿色（emerald-600）
- **视觉一致性**：统一风格

### 登录屏幕

- **logo下方版本号**：在logo下显示v1.0.9
- **页脚**：用俏皮话代替版权

---

## 补丁导出

Unity Patcher自动在Unity游戏上安装BepInEx和XUnity.AutoTranslator。

### 使用方法 (7)

1. **前往侧边栏中的Unity Patcher**
2. **从列表中选择Unity游戏**（绿色"Unity"徽章）
3. **选择目标语言**（例如：中文）
4. **选择模式**：
   - **仅捕获**：捕获文本以供手动翻译
   - **Google翻译**：游戏内自动翻译
   - **DeepL**：更高质量的自动翻译
5. **点击"安装补丁"**
6. **启动游戏** - 按`ALT+T`打开XUnity菜单

### 翻译徽章

安装后，您会看到指示状态的徽章：

| 徽章 | 含义 |
|------|------|
| 🥈 银色 | 启用自动翻译的XUnity（Google/DeepL） |
| 🥉 铜色 | 仅文本捕获（手动翻译） |

### 活动跟踪

每个安装的补丁都记录在仪表板的**最近活动**中：
- 游戏名称
- 选择的翻译模式
- 目标语言

---

## 活动历史

活动历史跟踪所有执行的操作。

### 访问

前往侧边栏中的**活动历史**。

### 记录的活动类型

| 图标 | 类型 | 描述 |
|------|------|------|
| 🌐 | Translation | 完成的翻译 |
| 🔧 | Patch | 创建/应用的补丁 |
| ♻️ | SteamSync | Steam同步 |
| ➕ | GameAdded | 添加的游戏 |
| 🎮 | GameLaunched | 启动的游戏 |
| 👤 | ProfileCreated | 创建的配置文件 |
| ⚙️ | SettingsChanged | 更改的设置 |

### 可用筛选器

- **按类型**：按活动类别筛选
- **按日期**：选择时间范围
- **按游戏**：仅显示特定游戏的活动

---

## 补丁导出

完成翻译后，您可以导出可供分发的包。

### "导出补丁"按钮

在您的**桌面**上创建包含以下内容的ZIP文件：

```
📦 游戏名_zh_patch.zip
├── 📁 translated/          # 可用的翻译文件
│   └── 翻译文件.csv
├── 📁 backup/               # 原始文件备份
│   └── 原始文件.csv
├── 📁 xunity/               # XUnity.AutoTranslator格式
│   └── AutoTranslator/
│       └── Translation/
│           └── zh/
│               └── _Translations.txt
├── 📄 README.txt            # 安装说明
└── 📄 metadata.json         # 翻译信息
```

### XUnity.AutoTranslator格式

XUnity格式兼容：
- 带BepInEx + XUnity.AutoTranslator的**Unity游戏**
- 格式：`原文=翻译`

---

## 应用到游戏

### "应用到游戏"按钮

自动将翻译**直接安装**到游戏中：

1. **检测游戏引擎**（Unity、Unreal等）
2. **检查与可用补丁程序的兼容性**
3. **如需要安装补丁程序**（例如：Unity用BepInEx）
4. **将翻译文件复制到正确文件夹**
5. **配置游戏以加载翻译**

### 支持的引擎

| 引擎 | 补丁程序 | 状态 |
|------|---------|------|
| Unity (Mono) | BepInEx + XUnity.AutoTranslator | ✅ 自动 |
| Unity (IL2CPP) | BepInEx IL2CPP | ⚠️ 部分 |
| Unreal Engine | - | 🔧 手动 |
| RPG Maker | - | ✅ 直接替换 |
| Ren'Py | - | ✅ 直接替换 |

### 原始文件会怎样？

**原始文件始终保留！**

1. 覆盖前自动创建备份
2. 备份保存在游戏文件夹的`.gamestringer_backups/`中
3. 备份名称包含时间戳：`20241228_001500_文件名.csv`

---

## 备份管理

### 在哪里找到备份

备份保存在两个位置：

1. **游戏文件夹中**：`[游戏文件夹]/.gamestringer_backups/`
2. **导出的ZIP包中**：`backup/`文件夹

### 如何恢复备份



前往应用的**备份**部分
2. 选择要恢复的文件
3. 点击**恢复**



在`.gamestringer_backups/`中找到备份文件
2. 将文件复制到原始位置
3. 删除时间戳重命名

---

## 翻译编辑器

编辑器允许手动编辑翻译。

### 层级结构

```
📁 游戏
├── 📁 Decarnation
│   ├── 📄 dialogues.csv (897个字符串)
│   └── 📄 items.csv (123个字符串)
└── 📁 其他游戏
    └── 📄 texts.json (456个字符串)
```

### 功能 (3)

- **搜索**：按文本查找字符串
- **筛选**：仅显示未完成的翻译、有错误的等
- **AI建议**：为单个字符串请求新翻译
- **自动保存**：更改保存到词典

---

## 词典

词典保存每个游戏的翻译。

### 工作原理

1. 每个游戏都有自己独立的词典
2. 翻译自动保存
3. 重用以加速未来翻译
4. 可导出为各种格式（JSON、CSV、TMX）

### 词典位置

```
%APPDATA%/GameStringer/dictionaries/
├── 1672310_decarnation.json
├── 123456_其他游戏.json
└── ...
```

---

## 故障排除

### 翻译很慢

- **原因**：字符串太多或提供商慢
- **解决方案**：增加批量大小或使用Gemini（更快）

### API密钥错误

- **原因**：API密钥无效或过期
- **解决方案**：在提供商网站上验证密钥

### 补丁程序无法安装

- **原因**：杀毒软件阻止BepInEx
- **解决方案**：为游戏文件夹添加例外

### 文件无法识别

- **原因**：不支持的文件格式
- **解决方案**：转换为CSV或JSON

### 翻译有格式错误

- **原因**：AI修改了变量或标签
- **解决方案**：启用"Quality Checks"自动检测

---

## 键盘快捷键

| 快捷键 | 操作 |
|--------|------|
| `Ctrl + S` | 保存当前翻译 |
| `Ctrl + Z` | 撤销更改 |
| `Ctrl + F` | 在文件中搜索 |
| `Esc` | 关闭对话框/面板 |

---

## 支持

- **GitHub**：[github.com/rouges78/GameStringer](https://github.com/rouges78/GameStringer)
- **Issues**：报告错误或请求功能
- **Wiki**：详细技术文档

---

## v1.4.0 新功能

### 统一 Radix UI

UI库已从单独的 `@radix-ui/react-*` 包迁移到统一的 `radix-ui` 包：

- **37个组件已迁移** — 简化导入
- **27个包已移除** — 更轻量的依赖
- 无视觉变化 — 相同的UI，更少的依赖

### Translator Pro 中的质量徽章

每个翻译行现在显示可视化质量指标：

- **QualityScoreBadge**：0-100分（🟢 ≥80、🟡 ≥60、🔴 <60）
- **ContentTypeBadge**：分类内容类型（UI、对话、叙事、系统、教程等）
- **实时预览**：批量翻译期间，最后3行实时显示分数
- **详情表格**：结果页面最多显示200行（原文、翻译、类型、质量）

### RTL支持

- 自动检测RTL语言（阿拉伯语、希伯来语）的文本方向
- `dir` 属性动态应用于HTML文档

### 通用 Ollama

- 新的 `translateWithOllamaGeneric` 提供商，可使用任何Ollama模型
- PROVIDER_MAP 自动模型映射
- 提供商之间自动回退的链式预设

### Bundle优化

- `optimizePackageImports` 已更新：`radix-ui`、`framer-motion`、`recharts`、`cmdk`、`react-hook-form`
- 源文件中零TypeScript错误

---

## v1.4.1新功能

### GOG Galaxy完整支持

- **GOG Galaxy 2.0库读取**: 从本地SQLite数据库读取拥有的游戏
- **通过GOG API获取封面和描述**: 自动获取图片和详情
- **与已安装游戏合并**: 结合注册表数据和Galaxy数据库
- **商店和下载链接**: 带有GOG Galaxy直接链接的商店页面

### 改进的仪表板

- **顶部连接商店**: 商店现在在最后打开的游戏旁边
- **带真实计数的商店徽章**: 显示每个商店的实际游戏数量
- **最后游戏占位符**: 未打开游戏时的优雅显示

### 增强的游戏详情

- **信息标签**: 系统要求、Metacritic评分、商店链接、DLC列表
- **GOG封面**: GOG游戏封面的自动回退
- **GOG描述**: 通过GOG API获取完整描述

### AI提供商修复

- **免费提供商永不永久封锁**: MyMemory、Lingva使用冷却时间（30秒）
- **Steam Wishlist**: 带有旧版回退的新IWishlistService端点

### 性能

- **sessionStorage缓存**: 从游戏详情返回库的即时导航
- **批量封面保存**: 带去抖（2秒）的保存以避免竞态条件
- **SteamGridDB获取去重**: 避免StrictMode中的重复请求

### 跨平台构建

- **Node.js构建脚本**: `build-tauri-cross.js`替换PowerShell脚本
- **Linux支持**: GitHub Actions工作流现在也为Linux构建 (.deb, .AppImage)
- **Windows**: 安装程序 (.msi, .exe NSIS) 和便携版 (.zip)

### 文档

- **11份用户指南**: markdown lint修复
- **修正索引编号**: 无跳跃的有序索引

---

*GameStringer v1.4.1 - 指南更新于 2026/03/02*
