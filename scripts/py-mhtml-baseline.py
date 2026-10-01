# -*- coding: utf-8 -*-
"""MHTML 过滤基准：各团（未处理）.doc 的剔除块数"""
import os, json
sys_dir = r'D:\跑团\log\log提取器'
import sys
sys.path.insert(0, r'D:\develop\log提取器')
import log_downloader as ld

result = {}
for d in sorted(os.listdir(sys_dir)):
    p = os.path.join(sys_dir, d)
    if os.path.isdir(p):
        for f in os.listdir(p):
            if f.endswith('（未处理）.doc'):
                raw = open(os.path.join(p, f), encoding='utf-8').read()
                _, n = ld.filter_mhtml_text(raw)
                result[d] = {'removed': n}
json.dump(result, open(r'D:\develop\log提取器\scripts\py-mhtml-baseline.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(json.dumps(result, ensure_ascii=False))
