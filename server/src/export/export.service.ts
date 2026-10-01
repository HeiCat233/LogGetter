
import { Injectable, BadRequestException } from '@nestjs/common';
import { LibraryService } from '../library/library.service';
import { renderFullHtml } from '../../../shared/renderer';
import { CONFIG } from '../config';

@Injectable()
export class ExportService {
  constructor(private readonly library: LibraryService) {}

  private build(dirRel: string, includeOutside: boolean) {
    const layout = this.library.readLayout(dirRel);
    const html = renderFullHtml(layout, { includeOutside });
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
