
import {
  Body, Controller, Get, Post, Put, Res, UploadedFile, UseInterceptors, Query,
} from '@nestjs/common';
import type { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { LibraryService } from './library.service';
import { LayoutDoc } from '../../../shared/types';

@Controller()
export class LibraryController {
  constructor(private readonly library: LibraryService) {}

  @Get('log-tree')
  tree() {
    return this.library.tree();
  }

  @Get('log-file')
  readTxt(@Query('path') relPath: string) {
    return this.library.readTxt(relPath);
  }

  @Get('asset')
  asset(@Query('path') relPath: string, @Res() res: Response) {
    const { buffer, contentType } = this.library.readAsset(relPath);
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.send(buffer);
  }

  @Get('layout')
  readLayout(@Query('dir') dirRel: string) {
    return this.library.readLayout(dirRel);
  }

  @Put('layout')
  writeLayout(@Body() body: { dir: string; layout: LayoutDoc }) {
    return this.library.writeLayout(body.dir, body.layout);
  }

  @Post('library/upload')
  @UseInterceptors(FileInterceptor('file'))
  upload(@Body('dir') dirRel: string, @UploadedFile() file: Express.Multer.File) {
    if (!file) return { ok: false, error: '未收到文件' };
    const relPath = this.library.saveUpload(dirRel, file.originalname, file.buffer);
    return { ok: true, path: relPath };
  }
}
