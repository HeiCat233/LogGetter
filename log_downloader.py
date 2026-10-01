
import argparse
import html
import os
import re
import subprocess
from pathlib import Path

from playwright.sync_api import sync_playwright

# 处理结果统一保存到跑团备份仓库的分类目录里（按模组名建子目录），
# 每次处理完自动在 D:\跑团 执行 git 提交推送；如果还没建仓库会跳过并提示
LOG_OUTPUT_ROOT = r'D:\跑团\log\log提取器'
PAOTUAN_REPO = r'D:\跑团'

# 消息头行：昵称(QQ号) [日期] 时间
# 兼容 log.weizaima.com（带日期 2025/11/15 20:04:03）和 logrender.dice.center（仅时间 23:11:14）两种格式
HEADER_RE = re.compile(r'^(.+)\((\d+)\)\s+(?:\d{4}[/-]\d{1,2}[/-]\d{1,2}\s+)?\d{1,2}:\d{2}(?::\d{2})?\s*$')

# 网站导出的 .doc 实为 Web 档案(MHTML)，每条发言是一个 div 块，内部无嵌套 div
MHTML_ITEM_RE = re.compile(r'<div class="list-item-dynamic">.*?</div>', re.S)
MHTML_MESSAGE_RE = re.compile(r'(<span class="_message"[^>]*>)(.*?)(</span>)', re.S)

# URL 不吃尾部中文标点（注意半角 ? ! 是 URL 合法字符，不能排除）
URL_RE = re.compile(r'https?://[^\s，。；、！？）】」』,;]+')

# 消息开头连续的 CQ 码（如 [CQ:reply,...][CQ:at,...]），判定场外前先剥掉——
# doc 渲染版中这些码不显示（at 变 @昵称），人类看到的首字符以渲染后为准
CQ_PREFIX_RE = re.compile(r'^(?:\[CQ:[^\]]*\])+\s*')

DOWNLOAD_TIMEOUT_MS = 120000

OUTSIDE_PREFIXES = ('(', '（')


def is_outside_message(first_content_line):
    """海豹规则：渲染后以 ( 或 （ 开头的发言视为场外"""
    stripped = CQ_PREFIX_RE.sub('', first_content_line).strip()
    return stripped.startswith(OUTSIDE_PREFIXES)


def filter_log_text(text):
    """剔除 txt 中的场外发言（含其归属的后续行，如 CQ 图片行）。

    返回 (过滤后文本, 剔除条数)。
    """
    # 按消息头行切分：匹配到消息头则开新消息，否则该行归属当前消息
    messages = []  # 每条为 [header_line, content_lines]
    current = None
    for line in text.splitlines():
        if HEADER_RE.match(line):
            current = [line, []]
            messages.append(current)
        elif current is None:
            # 文件开头没有消息头的杂散行，原样保留、不参与过滤
            current = ['', [line]]
            messages.append(current)
        else:
            current[1].append(line)

    kept = []
    removed = 0
    for header, content_lines in messages:
        first_content = next((l for l in content_lines if l.strip()), '')
        if is_outside_message(first_content):
            removed += 1
            continue
        kept.append(header)
        kept.extend(content_lines)
    return ('\n'.join(kept) + '\n') if kept else '', removed


def filter_mhtml_text(text):
    """剔除 Web 档案(.doc) 中消息文本以 ( 或 （ 开头的发言块。

    返回 (过滤后文本, 剔除块数)。
    """
    out = []
    last_end = 0
    removed = 0
    for m in MHTML_ITEM_RE.finditer(text):
        out.append(text[last_end:m.start()])
        block = m.group(0)
        msg = MHTML_MESSAGE_RE.search(block)
        if msg:
            # 剥掉标签后取纯文本判断（图片消息剥完为空，不会误判）
            inner_text = html.unescape(re.sub(r'<[^>]+>', '', msg.group(2)))
            if is_outside_message(inner_text.strip()):
                removed += 1
                last_end = m.end()
                continue
        out.append(block)
        last_end = m.end()
    out.append(text[last_end:])
    return ''.join(out), removed


def parse_input(input_str):
    pairs = []
    last_pos = 0
    for match in URL_RE.finditer(input_str):
        name_part = input_str[last_pos:match.start()].strip()
        if name_part:
            pairs.append((name_part, match.group(0)))
        last_pos = match.end()
    return pairs


def has_complete_files(module_name, base_dir):
    """该团的（未处理）和（不含场外）文件是否都已存在（增量模式下跳过）"""
    module_folder = os.path.join(base_dir, module_name)
    if not os.path.isdir(module_folder):
        return False
    files = os.listdir(module_folder)
    has_unprocessed = any(f.startswith(f'{module_name}（未处理）') for f in files)
    has_filtered = any(f.startswith(f'{module_name}（不含场外）') for f in files)
    return has_unprocessed and has_filtered


def download_via_button(page, button_text, target_dir, name_stem):
    """点击指定下载按钮，把文件保存为 target_dir/name_stem.扩展名，返回实际路径"""
    with page.expect_download(timeout=DOWNLOAD_TIMEOUT_MS) as download_info:
        page.click(f'text={button_text}')
    download = download_info.value
    ext = Path(download.suggested_filename).suffix
    target_path = os.path.join(target_dir, f'{name_stem}{ext}')
    download.save_as(target_path)
    size = os.path.getsize(target_path)
    if size == 0:
        raise RuntimeError(f'下载的文件为空: {target_path}')
    print(f'已下载: {name_stem}{ext}（{size} 字节）')
    return target_path


def process_module(page, module_name, url, force=False):
    """处理单个模组：下载未处理文件 -> 本地过滤生成不含场外版本。

    文件保存到 LOG_OUTPUT_ROOT/<模组名>/。返回 (状态, 剔除条数)。
    """
    module_folder = os.path.join(LOG_OUTPUT_ROOT, module_name)

    if not force and has_complete_files(module_name, LOG_OUTPUT_ROOT):
        print(f'{module_name}: 文件已齐全，跳过（如需重下请加 --force）')
        return ('跳过', 0)

    os.makedirs(module_folder, exist_ok=True)

    print(f'{module_name}: 打开页面 {url}')
    page.goto(url, timeout=60000, wait_until='networkidle')

    txt_path = download_via_button(page, '下载原始文件', module_folder, f'{module_name}（未处理）')

    doc_path = None
    try:
        doc_path = download_via_button(page, '下载带图doc', module_folder, f'{module_name}（未处理）')
    except Exception as e:
        print(f'{module_name}: 带图doc下载失败（不影响txt）: {e}')

    # 本地过滤生成「不含场外」版本，不再依赖网站上的过滤开关
    with open(txt_path, 'r', encoding='utf-8') as f:
        filtered_txt, removed_txt = filter_log_text(f.read())
    filtered_txt_path = os.path.join(module_folder, f'{module_name}（不含场外）.txt')
    with open(filtered_txt_path, 'w', encoding='utf-8') as f:
        f.write(filtered_txt)

    removed_doc = 0
    if doc_path:
        with open(doc_path, 'r', encoding='utf-8') as f:
            filtered_doc, removed_doc = filter_mhtml_text(f.read())
        filtered_doc_path = os.path.join(module_folder, f'{module_name}（不含场外）.doc')
        with open(filtered_doc_path, 'w', encoding='utf-8') as f:
            f.write(filtered_doc)

    if removed_txt == 0:
        print(f'{module_name}: 警告——未剔除任何场外发言，请核对日志格式是否匹配')
    else:
        print(f'{module_name}: 已剔除场外发言 {removed_txt} 条（doc {removed_doc} 块）')
    return ('成功', removed_txt)


def sync_paotuan_repo(module_names):
    """把本次处理的日志提交并推送到 D:\跑团 备份仓库（失败只警告，不影响日志本身）"""
    if not os.path.isdir(os.path.join(PAOTUAN_REPO, '.git')):
        print(f'\n提示: {PAOTUAN_REPO} 还不是 git 仓库，跳过自动备份')
        return
    log_dir = os.path.relpath(LOG_OUTPUT_ROOT, PAOTUAN_REPO)

    def git(*args):
        return subprocess.run(['git', *args], cwd=PAOTUAN_REPO,
                              capture_output=True, text=True, encoding='utf-8', errors='replace')

    git('add', '-A', '--', log_dir)
    changed = git('status', '--porcelain', '--', log_dir).stdout.strip()
    if not changed:
        print('\n跑团仓库无新变更，无需提交')
        return
    msg = 'log下载器同步: ' + ', '.join(module_names)
    commit = git('commit', '-m', msg)
    if commit.returncode != 0:
        print(f'\n跑团仓库提交失败: {commit.stderr.strip()}')
        return
    print(f'\n跑团仓库已提交: {msg}')
    push = git('push')
    if push.returncode != 0:
        print(f'跑团仓库推送失败（日志已本地提交，可稍后手动 git push）: {push.stderr.strip()}')
    else:
        print('跑团仓库已推送到远程')


def main():
    parser = argparse.ArgumentParser(description='跑团日志下载器：下载海豹骰日志并本地过滤场外发言')
    parser.add_argument('--force', action='store_true', help='忽略已有文件，强制重新下载')
    parser.add_argument('pairs', nargs='*', help='模组名和网址对：模组名 网址 模组名 网址 ...（不填则交互输入）')
    args = parser.parse_args()

    input_str = ' '.join(args.pairs).strip()
    if not input_str:
        print('=' * 50)
        print('日志下载器')
        print('=' * 50)
        print('请输入模组名和网址，格式为：模组名 网址 模组名 网址 ...')
        print('例如：封冻恶疾 https://logrender.dice.center/#2-log_xxx 稚林期（卫星桌） http://log.weizaima.com/?key=eue2#475530')
        print('=' * 50)
        input_str = input('请输入模组名和网址: ').strip()

    if not input_str:
        print('输入不能为空！')
        return

    module_url_pairs = parse_input(input_str)
    if not module_url_pairs:
        print('未找到有效的模组名和网址对！')
        return

    print(f'识别到 {len(module_url_pairs)} 个模组：')
    for i, (name, url) in enumerate(module_url_pairs, 1):
        print(f'  {i}. {name} -> {url}')

    results = []
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        page = browser.new_page()
        try:
            for module_name, url in module_url_pairs:
                print('\n' + '=' * 50)
                print(f'正在处理模组: {module_name}')
                print(f'网址: {url}')
                print('=' * 50)
                try:
                    status, removed = process_module(page, module_name, url, force=args.force)
                    results.append((module_name, status, removed))
                except Exception as e:
                    print(f'{module_name}: 失败 - {e}')
                    results.append((module_name, f'失败: {e}', 0))
        finally:
            browser.close()

    sync_paotuan_repo([name for name, _ in module_url_pairs])

    print('\n' + '=' * 50)
    print('处理结果汇总')
    print('=' * 50)
    for name, status, removed in results:
        if status == '成功':
            print(f'  [成功] {name}（剔除场外 {removed} 条）')
        elif status == '跳过':
            print(f'  [跳过] {name}（文件已齐全，如需重下请加 --force）')
        else:
            print(f'  [{status}] {name}')
    print('完成！')


if __name__ == '__main__':
    main()
