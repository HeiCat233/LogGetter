
import { Body, Controller, Post, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { ExportService } from './export.service';

@Controller()
export class ExportController {
  constructor(private readonly exporter: ExportService) {}

  private send(res: Response, filename: string, content: string, contentType: string) {
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
    res.send(content);
  }

  @Post('export/html')
  html(@Query('dir') dir: string, @Body() body: { includeOutside?: boolean }, @Res() res: Response) {
    this.exporter.assertDir(dir);
    const { filename, html } = this.exporter.toHtml(dir, Boolean(body?.includeOutside));
    this.send(res, filename, html, 'text/html; charset=utf-8');
  }

  @Post('export/doc')
  doc(@Query('dir') dir: string, @Body() body: { includeOutside?: boolean }, @Res() res: Response) {
    this.exporter.assertDir(dir);
    const { filename, html } = this.exporter.toDoc(dir, Boolean(body?.includeOutside));
    this.send(res, filename, html, 'application/msword');
  }
}
