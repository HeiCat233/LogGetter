
import { Injectable, BadRequestException } from '@nestjs/common';
import { LibraryService } from '../library/library.service';
import { renderFullHtml } from '../../../shared/renderer';
import { CONFIG } from '../config';

@Injectable()
export class ExportService {
  constructor(private readonly library: LibraryService) {}

  /** 把排版资产（.layout 下的本地图片）转成 base64 内嵌，导出单文件自包含；外链 URL 保持原样 */
  private inlineLocalImages(html: string): string {
    return html.replace(/(src=")\/api\/asset\?path=([^"]+)(")/g, (_all, pre, encoded: string, post) => {
      try {
        const relPath = decodeURIComponent(encoded);
        const { buffer, contentType } = this.library.readAsset(relPath);
        return `${pre}data:${contentType};base64,${buffer.toString('base64')}${post}`;
      } catch {
        return _all;
      }
    });
  }

  private build(dirRel: string, includeOutside: boolean) {
    const layout = this.library.readLayout(dirRel);
    const raw = renderFullHtml(layout, { includeOutside });
    const html = this.inlineLocalImages(raw);
    const name = layout.title || dirRel.split(/[\\/]/).pop() || 'log';
    return { html, name };
  }

  toHtml(dirRel: string, includeOutside: boolean) {
    const { html, name } = this.build(dirRel, includeOutside);
    return { filename: `${name}（排版）.html`, html };
  }

  /** MHTML 包装（与网站导出的 .doc 同构，Word 可直接打开） */
  toDoc(dirRel: string, includeOutside: boolean) {
    const { html, name } = this.build(dirRel, includeOutside);
    const mhtml = [
      'MIME-Version: 1.0',
      'Content-Type: multipart/related; boundary="----=_NextPart_WritingBug"',
      '',
      '此文档为“单个文件网页”，也称为“Web 档案”文件。',
      '',
      '------=_NextPart_WritingBug',
      'Content-Type: text/html; charset="utf-8"',
      'Content-Transfer-Encoding: 8bit',
      '',
      html,
      '------=_NextPart_WritingBug--',
      '',
    ].join('\r\n');
    return { filename: `${name}（排版）.doc`, html: mhtml };
  }

  assertDir(dirRel: string) {
    if (!dirRel) throw new BadRequestException('缺少 dir 参数');
  }
}
