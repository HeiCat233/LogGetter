# 日志下载器

把海豹骰（Seal Dice）骰娘发的 log 链接（logrender.dice.center、log.weizaima.com 等）批量下载到本地，并按统一格式整理保存。

现在有两种使用方式：

- **Web 界面（推荐）**：`start.bat` 一键启动，浏览器打开 http://127.0.0.1:8765 —— 提取、排版编辑、成书阅读一站完成（见下文「Web 界面」）
- **命令行**：`python log_downloader.py`（原有方式，继续可用）

## Web 界面

双击 `start.bat`（首次会自动安装依赖并构建前端），自动打开浏览器：

| 页面 | 功能 |
|---|---|
| 🧲 提取 log | 按「模组名 网址」批量输入，实时进度与汇总；下载 + 本地过滤场外 |
| 📚 log 库 | 浏览 `D:\跑团\log` 全部团，显示排版状态（待排版/排版中/已排版），一键进入编辑器 |
| 编辑器 | 分块排版：封面（字段预留）、章节标题、消息逐条编辑/删除/拖拽排序、插图上传；右侧实时染色预览；气泡/文档两套主题；导出 HTML / Word |
| 📖 书架 | 把「已排版」的 log 组建成书：书名/简介/封面位（预留），网络小说式阅读页（目录 + 章节正文 + 翻章） |

- 保存排版**只写独立存储目录 `D:\跑团\log\.layout\<团路径>\`**（排版文档 layout.json + 上传图片 assets/），原始 log 的 txt/doc 文件永远只读、分毫不改
- 原始 txt 仍然是下载时的原始存档；编辑与排版全部记录在排版文档里，导出时按排版渲染（本地图片自动内嵌 base64，导出单文件自包含）
- 排版保存会自动提交推送到跑团备份仓库（含 `.layout` 目录，排版数据同样有云备份）
- 编辑器与阅读视图共用同一渲染器（`shared/renderer.ts`），预览即所得
- 服务默认只监听本机 127.0.0.1；未来开放局域网时改 `LOGGETTER_HOST=0.0.0.0` 并接入鉴权 Guard（`server/src/main.ts` 预留挂载点）
- 块类型是注册式扩展点：新增块（自由富文本、骰点表格等）只需在 `shared/types.ts` 登记 + 前端注册编辑/渲染组件

## 功能说明（命令行模式）

1. 一次性输入多个模组名和对应的网址
2. 自动访问每个网址，下载「未处理」的原始 txt 和带图 doc
3. **本地过滤**生成「不含场外」版本（剔除以 `(` 或 `（` 开头的场外发言，含其归属的图片行），不依赖网站上的过滤开关，结果可靠可复现
4. 每个模组自动建立同名文件夹归类，文件直接保存进对应文件夹
5. 增量模式：文件已齐全的模组自动跳过，只下载新团；`--force` 可强制重下
6. 结束时输出成功 / 跳过 / 失败汇总

## 安装步骤

1. 确保已安装 Python 3.9+
2. 安装依赖：
```bash
pip install -r requirements.txt
```
3. 安装 Playwright 浏览器（首次使用需要）：
```bash
playwright install chromium
```

使用虚拟环境的话：
```bash
python -m venv .venv
.venv/Scripts/pip install -r requirements.txt
.venv/Scripts/playwright install chromium
.venv/Scripts/python log_downloader.py
```

## 使用方法

```bash
python log_downloader.py
```
然后按提示输入模组名和网址对，格式为：
```
模组名 网址 模组名 网址 ...
```

例如：
```
封冻恶疾 https://logrender.dice.center/#2-log_eae3c508-c09b-42c0-b5ac-47b0a442a69a_xxx 稚林期（卫星桌） http://log.weizaima.com/?key=eue2#475530
```

也可以直接作为命令行参数传入（免去交互输入）：
```bash
python log_downloader.py 封冻恶疾 https://logrender.dice.center/#2-log_xxx
```

强制重新下载某个已有文件齐全的模组：
```bash
python log_downloader.py --force 封冻恶疾 https://logrender.dice.center/#2-log_xxx
```

## 文件整理规则

脚本为每个模组名创建同名文件夹，下载与过滤生成的文件都保存在里面：

```
封冻恶疾/
├── 封冻恶疾（未处理）.txt      ← 网站下载的原始文件
├── 封冻恶疾（未处理）.doc      ← 网站下载的带图 doc（Web 档案格式，Word 可直接打开）
├── 封冻恶疾（不含场外）.txt    ← 本地过滤生成
└── 封冻恶疾（不含场外）.doc    ← 本地过滤生成
```

## 场外过滤规则

与海豹骰一致：**消息内容以 `(` 或 `（` 开头的发言视为场外，整条剔除**（该发言附带的图片等后续行一并剔除）。支持两种日志格式：

- `log.weizaima.com`：`昵称(QQ号) 2025/11/15 20:04:03`，消息间有空行
- `logrender.dice.center`：`昵称(QQ号) 23:11:14`，消息间无空行

过滤时会打印每团剔除的条数；如果一条都没剔除会给出警告，提示核对日志格式。

## 注意事项

- 下载过程中会弹出浏览器窗口，属正常现象，完成后自动关闭
- 大日志生成较慢，下载超时已放宽到 120 秒；若仍超时，单独重跑该模组即可（已下载好的其他模组不会受影响）
- `.doc` 文件是网站的「单个文件网页」格式（MHTML），Word / WPS 可直接打开
