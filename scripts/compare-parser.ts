// TS 解析器与 Python 基准对照：读 py-baseline.json，逐团比对 消息数/场外数/过滤后字节
import * as fs from 'fs';
import * as path from 'path';
import { parseLogText, serializeLogText } from '../shared/log-parser';

const ROOT = 'D:\\跑团\\log\\log提取器';
const baseline = JSON.parse(fs.readFileSync(path.join(__dirname, 'py-baseline.json'), 'utf-8')) as Record<string, { total: number; removed: number; filteredBytes: number }>;

let fail = 0;
for (const [dir, expect] of Object.entries(baseline)) {
  const p = dir === '根目录封冻恶疾'
    ? path.join('D:\\develop\\log提取器', '封冻恶疾（未处理）.txt')
    : path.join(ROOT, dir, `${dir}（未处理）.txt`);
  const raw = fs.readFileSync(p, 'utf-8');
  const { messages, spaced, strayLines } = parseLogText(raw);
  const removed = messages.filter((m) => m.outside).length;
  const filteredBytes = Buffer.byteLength(serializeLogText(messages.filter((m) => !m.outside), spaced, strayLines), 'utf-8');
  const ok = messages.length === expect.total && removed === expect.removed && filteredBytes === expect.filteredBytes;
  if (!ok) {
    fail++;
    console.log(`✗ ${dir}: total ${messages.length}/${expect.total}, removed ${removed}/${expect.removed}, bytes ${filteredBytes}/${expect.filteredBytes}`);
  } else {
    console.log(`✓ ${dir}: total=${messages.length} removed=${removed} bytes=${filteredBytes}`);
  }
}
console.log(fail === 0 ? '全部一致，TS 解析器与 Python 等价' : `${fail} 个团不一致！`);
process.exit(fail === 0 ? 0 : 1);
