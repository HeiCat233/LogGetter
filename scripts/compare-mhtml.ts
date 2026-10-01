// TS MHTML 过滤与 Python 基准对照
import * as fs from 'fs';
import * as path from 'path';
import { filterMhtmlText } from '../shared/mhtml';

const ROOT = 'D:\\跑团\\log\\log提取器';
const baseline = JSON.parse(fs.readFileSync(path.join(__dirname, 'py-mhtml-baseline.json'), 'utf-8')) as Record<string, { removed: number }>;

let fail = 0;
for (const [dir, expect] of Object.entries(baseline)) {
  const p = path.join(ROOT, dir, `${dir}（未处理）.doc`);
  const raw = fs.readFileSync(p, 'utf-8');
  const [, removed] = filterMhtmlText(raw);
  const ok = removed === expect.removed;
  if (!ok) { fail++; console.log(`✗ ${dir}: ${removed}/${expect.removed}`); }
  else console.log(`✓ ${dir}: removed=${removed}`);
}
console.log(fail === 0 ? '全部一致' : `${fail} 个不一致！`);
process.exit(fail === 0 ? 0 : 1);
