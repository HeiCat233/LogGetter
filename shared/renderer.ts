
import { Block, LayoutDoc, LogMessage, ThemeId } from './types';

// ============ 纯函数渲染器：blocks → HTML（server 导出与 webui 预览共用同一份） ============

export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** 昵称 → 稳定柔和色（story-painter 思路：哈希到色相，固定饱和度/亮度） */
export function nicknameColor(nickname: string): string {
  let hash = 0;
  for (let i = 0; i < nickname.length; i++) hash = (hash * 31 + nickname.charCodeAt(i)) >>> 0;
  const hue = hash % 360;
  return `hsl(${hue}, 62%, 42%)`;
}

/** CQ 码 → HTML（图片渲染为 <img>，其余转可读文本） */
const CQ_RE = /\[CQ:([a-zA-Z]+)(?:,([^\]]*))?\]/g;

export function renderMessageLine(line: string): string {
  return escapeHtml(line).replace(CQ_RE, (_all, type: string, data?: string) => {
    const kv = new URLSearchParams(data ?? '');
    switch (type) {
      case 'image': {
        const url = kv.get('url') || kv.get('file') || '';
        if (/^https?:\/\//.test(url)) {
          return `<img class="lg-img" src="${escapeHtml(url)}" loading="lazy">`;
        }
        return '<span class="lg-cq">[图片]</span>';
      }
      case 'face':
        return '<span class="lg-cq">[表情]</span>';
      case 'at':
        return `<span class="lg-at">@${escapeHtml(kv.get('qq') ?? '')}</span>`;
      case 'reply':
        return '<span class="lg-cq lg-reply">[回复]</span>';
      case 'record':
        return '<span class="lg-cq">[语音]</span>';
      case 'video':
        return '<span class="lg-cq">[视频]</span>';
      default:
        return `<span class="lg-cq">[${escapeHtml(type)}]</span>`;
    }
  });
}

function renderMessage(msg: LogMessage, theme: ThemeId, idx: number): string {
  const content = msg.lines
    .filter((l, i, arr) => !(l === '' && i === arr.length - 1))
    .map((l) => renderMessageLine(l))
    .join(theme === 'painter' ? '<br>' : '</p><p>');
  if (theme === 'painter') {
    return `<div class="lg-msg${msg.outside ? ' lg-outside' : ''}" data-i="${idx}">
  <div class="lg-meta"><span class="lg-nick" style="color:${nicknameColor(msg.nickname)}">${escapeHtml(msg.nickname)}</span><span class="lg-time">${escapeHtml(msg.timeRaw)}</span></div>
  <div class="lg-bubble"><div class="lg-content">${content}</div></div>
</div>`;
  }
  return `<div class="lg-msg${msg.outside ? ' lg-outside' : ''}" data-i="${idx}">
  <p class="lg-doc-nick" style="color:${nicknameColor(msg.nickname)}">${escapeHtml(msg.nickname)}<span class="lg-time">${escapeHtml(msg.timeRaw)}</span></p>
  <p class="lg-doc-content">${content}</p>
</div>`;
}

function renderCover(fields: Record<string, string | undefined>): string {
  const title = fields.title ? `<h1 class="lg-cover-title">${escapeHtml(fields.title)}</h1>` : '';
  const subtitle = fields.subtitle ? `<p class="lg-cover-subtitle">${escapeHtml(fields.subtitle)}</p>` : '';
  const intro = fields.intro ? `<p class="lg-cover-intro">${escapeHtml(fields.intro)}</p>` : '';
  const date = fields.date ? `<p class="lg-cover-date">${escapeHtml(fields.date)}</p>` : '';
  const image = fields.image ? `<img class="lg-cover-img" src="${escapeHtml(fields.image)}">` : '';
  return `<div class="lg-cover">${image}${title}${subtitle}${intro}${date}</div>`;
}

/** 块列表 → 文档主体 HTML。includeOutside=false 时物理剔除场外消息（阅读/导出用）；默认保留并交给 CSS 显隐（编辑器预览用） */
export function renderBlocksHtml(layout: LayoutDoc, opts: { includeOutside?: boolean } = {}): string {
  const includeOutside = opts.includeOutside ?? true;
  let msgIndex = 0;
  const parts: string[] = [];
  for (const block of layout.blocks as Block[]) {
    switch (block.type) {
      case 'cover':
        parts.push(renderCover(block.fields ?? {}));
        break;
      case 'heading':
        parts.push(`<h2 class="lg-heading">${escapeHtml(block.text)}</h2>`);
        break;
      case 'message':
        if (includeOutside || !block.message.outside) {
          parts.push(renderMessage(block.message, layout.theme, msgIndex));
        }
        msgIndex++;
        break;
      case 'image': {
        const caption = block.caption ? `<p class="lg-img-caption">${escapeHtml(block.caption)}</p>` : '';
        parts.push(`<figure class="lg-figure"><img class="lg-img" src="${escapeHtml(block.src)}">${caption}</figure>`);
        break;
      }
    }
  }
  return parts.join('\n');
}

export function themeCss(theme: ThemeId): string {
  if (theme === 'document') {
    return `
.lg-doc{max-width:820px;margin:0 auto;padding:40px 48px;background:#fdfaf3;color:#333;line-height:1.9;font-family:"Noto Serif SC","Source Han Serif SC",SimSun,serif}
.lg-cover{padding:120px 0 80px;text-align:center;border-bottom:2px solid #b8a68a;margin-bottom:48px}
.lg-cover-title{font-size:40px;letter-spacing:6px;margin:12px 0;font-weight:700;color:#2c2418}
.lg-cover-subtitle{font-size:18px;color:#6b5c46;margin:6px 0}
.lg-cover-intro{font-size:15px;color:#8a7a60;margin-top:28px;white-space:pre-wrap}
.lg-cover-date{font-size:14px;color:#a8946f;margin-top:8px}
.lg-cover-img{max-width:60%;border-radius:4px}
.lg-heading{font-size:26px;text-align:center;margin:56px 0 28px;color:#2c2418;letter-spacing:2px}
.lg-msg{margin:18px 0}
.lg-doc-nick{font-weight:700;font-size:16px;margin:0}
.lg-doc-nick .lg-time{font-weight:400;font-size:13px;color:#a8946f;margin-left:12px}
.lg-doc-content{margin:4px 0 0;text-indent:2em;white-space:normal}
.lg-doc-content>p{margin:2px 0}
.lg-img{max-width:100%;border-radius:4px}
.lg-figure{margin:20px 0;text-align:center}
.lg-img-caption{font-size:13px;color:#8a7a60;text-align:center;margin-top:6px}
.lg-outside{display:none}
`;
  }
  // painter：气泡时间线
  return `
.lg-doc{max-width:760px;margin:0 auto;padding:24px 20px;background:#f2f3f5;color:#222;line-height:1.7;font-family:"PingFang SC","Microsoft YaHei",system-ui,sans-serif}
.lg-cover{padding:80px 24px;text-align:center;background:linear-gradient(135deg,#e8eefc,#f6e8f0);border-radius:16px;margin-bottom:28px}
.lg-cover-title{font-size:32px;margin:12px 0;color:#33305a}
.lg-cover-subtitle{font-size:16px;color:#6b6a8a;margin:4px 0}
.lg-cover-intro{font-size:14px;color:#8a89a6;margin-top:20px;white-space:pre-wrap}
.lg-cover-date{font-size:13px;color:#9c9ab6;margin-top:8px}
.lg-cover-img{max-width:200px;border-radius:12px}
.lg-heading{font-size:18px;text-align:center;margin:36px 0 16px;color:#5b5a76;font-weight:600}
.lg-msg{margin:14px 0}
.lg-meta{display:flex;gap:10px;align-items:baseline;margin:0 6px 4px}
.lg-nick{font-size:14px;font-weight:600}
.lg-time{font-size:12px;color:#a0a0ae}
.lg-bubble{background:#fff;border-radius:4px 14px 14px 14px;padding:10px 14px;box-shadow:0 1px 2px rgba(0,0,0,.06)}
.lg-content{font-size:15px;word-break:break-word}
.lg-content>p{margin:2px 0}
.lg-at{color:#3b7cff;font-weight:500}
.lg-reply{background:#eef2ff;border-radius:4px;padding:0 4px;font-size:12px}
.lg-cq{color:#8a8a9a;font-size:13px}
.lg-img{max-width:280px;border-radius:8px;display:block}
.lg-figure{margin:14px 0;text-align:center}
.lg-img-caption{font-size:13px;color:#8a8a9a;margin-top:6px}
.lg-outside{display:none}
body.show-outside .lg-outside{display:block}
body.show-outside .lg-outside .lg-bubble{background:#fffbe6}
body.show-outside .lg-outside .lg-doc-content{background:#fffbe6;border-radius:6px;padding:4px 8px}
`;
}

export interface RenderOptions {
  includeOutside?: boolean;
  /** 显示场外（预览用；导出时用 includeOutside 控制） */
  showOutsideClass?: boolean;
}

/** 完整自包含 HTML 文档 */
export function renderFullHtml(layout: LayoutDoc, opts: RenderOptions = {}): string {
  const bodyClass = opts.showOutsideClass ? 'show-outside' : '';
  const title = escapeHtml(layout.title || '跑团日志');
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<style>${themeCss(layout.theme)}</style>
</head>
<body class="${bodyClass}">
<div class="lg-doc">
${renderBlocksHtml(layout, opts)}
</div>
</body>
</html>`;
}
