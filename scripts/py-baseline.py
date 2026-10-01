# -*- coding: utf-8 -*-
"""生成解析对照基准：对 14 个团 txt 输出 消息数/场外数/过滤后字节数，供 TS 侧比对"""
import os, sys, json
sys.path.insert(0, r'D:\develop\log提取器')
import log_downloader as ld

os.chdir(r'D:\develop\log提取器')
result = {}
for d in sorted(os.listdir('D:\\跑团\\log\\log提取器')):
    p = os.path.join(r'D:\跑团\log\log提取器', d)
    if os.path.isdir(p):
        for f in os.listdir(p):
            if f.endswith('（未处理）.txt'):
                raw = open(os.path.join(p, f), encoding='utf-8').read()
                filtered, n = ld.filter_log_text(raw)
                msgs = sum(1 for l in raw.splitlines() if ld.HEADER_RE.match(l))
                result[d] = {'total': msgs, 'removed': n, 'filteredBytes': len(filtered.encode('utf-8'))}
raw = open('封冻恶疾（未处理）.txt', encoding='utf-8').read()
filtered, n = ld.filter_log_text(raw)
msgs = sum(1 for l in raw.splitlines() if ld.HEADER_RE.match(l))
result['根目录封冻恶疾'] = {'total': msgs, 'removed': n, 'filteredBytes': len(filtered.encode('utf-8'))}
json.dump(result, open(r'D:\develop\log提取器\scripts\py-baseline.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(json.dumps(result, ensure_ascii=False, indent=1))
