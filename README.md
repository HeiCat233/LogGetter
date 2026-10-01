# 日志下载器

把海豹骰（Seal Dice）骰娘发的 log 链接（logrender.dice.center、log.weizaima.com 等）批量下载到本地，并按统一格式整理保存。

## 功能说明

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
