
/**
 * MHTML（网站导出的 .doc，实为 Web 档案）过滤
 * 与 Python 版 log_downloader.filter_mhtml_text 一致
 */

/** 每条发言是一个 div 块，内部无嵌套 div */
export const MHTML_ITEM_RE = /<div class="list-item-dynamic">.*?<\/div>/gs;
/** _message span（注意：带 g 的模块级正则 exec 会残留 lastIndex，匹配时须用局部副本） */
export const MHTML_MESSAGE_RE = /(<span class="_message"[^>]*>)(.*?)(<\/span>)/gs;

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, '');
}

function decodeEntities(text: string): string {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
}

/** 剔除 _message 以 ( 或 （ 开头的发言块，返回 [过滤后文本, 剔除块数] */
export function filterMhtmlText(text: string): [string, number] {
  const out: string[] = [];
  let lastEnd = 0;
  let removed = 0;

  for (const m of text.matchAll(MHTML_ITEM_RE)) {
    const block = m[0];
    out.push(text.slice(lastEnd, m.index!));
    lastEnd = m.index! + block.length;
    const msg = /(<span class="_message"[^>]*>)(.*?)(<\/span>)/s.exec(block);
    if (msg) {
      const inner = decodeEntities(stripTags(msg[2])).trim();
      if (inner.startsWith('(') || inner.startsWith('（')) {
        removed++;
        continue;
      }
    }
    out.push(block);
  }
  out.push(text.slice(lastEnd));
  return [out.join(''), removed];
}
