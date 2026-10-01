
import { LogMessage } from './types';

/**
 * 消息头行：昵称(QQ号) [日期] 时间
 * 兼容 log.weizaima.com（带日期 2025/11/15 20:04:03）和 logrender.dice.center（仅时间 23:11:14）
 * 与 Python 版 log_downloader.HEADER_RE 完全一致
 */
export const HEADER_RE = /^(.+)\((\d+)\)\s+(?:\d{4}[/-]\d{1,2}[/-]\d{1,2}\s+)?\d{1,2}:\d{2}(?::\d{2})?\s*$/;

/** 消息开头连续的 CQ 码（如 [CQ:reply,...][CQ:at,...]），判定场外前先剥掉——doc 渲染版中这些码不显示，人类看到的首字符以渲染后为准 */
export const CQ_PREFIX_RE = /^(?:\[CQ:[^\]]*\])+\s*/;

export const OUTSIDE_PREFIXES = ['(', '（'];

/** 海豹规则：渲染后以 ( 或 （ 开头的发言视为场外 */
export function isOutsideMessage(firstContentLine: string): boolean {
  const stripped = firstContentLine.replace(CQ_PREFIX_RE, '').trim();
  return OUTSIDE_PREFIXES.some((p) => stripped.startsWith(p));
}

export function matchHeader(line: string): { nickname: string; qq: string; timeRaw: string } | null {
  const m = HEADER_RE.exec(line);
  if (!m) return null;
  // timeRaw = 头行里 "昵称(QQ号) " 之后的日期时间原文（含可能的日期部分）
  const timeRaw = line.slice(m[1].length + m[2].length + 3).trim();
  return { nickname: m[1], qq: m[2], timeRaw };
}

export function headerLine(msg: LogMessage): string {
  return `${msg.nickname}(${msg.qq}) ${msg.timeRaw}`;
}

export interface ParseResult {
  messages: LogMessage[];
  /** true = 消息间有空行分隔（weizaima 格式），false = 紧凑（logrender 格式） */
  spaced: boolean;
  /** 文件开头没有消息头的杂散行（原样保留、不参与过滤） */
  strayLines: string[];
}

/**
 * 解析 log 文本为消息数组。
 * 空行归属：每条消息内容行包含其尾部分隔空行（与 Python 版一致），
 * 因此序列化时按消息原样拼接即可保持格式。
 */
export function parseLogText(text: string): ParseResult {
  const messages: LogMessage[] = [];
  const strayLines: string[] = [];
  let current: LogMessage | null = null;

  // JS 的 split 对结尾换行多产出一个空串元素（Python splitlines 不会），去掉以保持等价
  const rawLines = text.split(/\r?\n/);
  if (rawLines.length > 0 && rawLines[rawLines.length - 1] === '') rawLines.pop();

  for (const line of rawLines) {
    const header = matchHeader(line);
    if (header) {
      current = { ...header, lines: [], outside: false };
      messages.push(current);
    } else if (current === null) {
      // 文件开头没有消息头的杂散行（原样保留、不参与过滤）
      strayLines.push(line);
    } else {
      current.lines.push(line);
    }
  }

  // spaced 判定：有消息且任一消息尾部内容行含空行（weizaima 每条消息尾带空行）
  const spaced = messages.some((m) => m.lines.length > 0 && m.lines[m.lines.length - 1] === '');
  // 场外判定：取第一个非空内容行
  for (const m of messages) {
    const first = m.lines.find((l) => l.trim() !== '') ?? '';
    m.outside = isOutsideMessage(first);
  }
  return { messages, spaced, strayLines };
}

/** 消息数组的行表示（含头行）。lines 原样输出（含尾部空行），与 Python 版序列化行为一致；新消息是否补分隔空行由调用方在 lines 里处理 */
function messageLines(msg: LogMessage): string[] {
  return [headerLine(msg), ...msg.lines];
}

/** 序列化回 log.txt（保持原格式） */
export function serializeLogText(messages: LogMessage[], spaced: boolean, strayLines: string[] = []): string {
  void spaced;
  const out: string[] = [...strayLines];
  for (const m of messages) out.push(...messageLines(m));
  return out.length > 0 ? out.join('\n') + '\n' : '';
}

/** 过滤场外消息（与 Python filter_log_text 行为一致），返回 [过滤后文本, 剔除数] */
export function filterLogText(text: string): [string, number] {
  const { messages, spaced, strayLines } = parseLogText(text);
  const kept = messages.filter((m) => !m.outside);
  const removed = messages.length - kept.length;
  return [serializeLogText(kept, spaced, strayLines), removed];
}
