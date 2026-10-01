
import {
  Body, Controller, Get, Post, Put, UploadedFile, UseInterceptors, Query,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { LibraryService } from './library.service';
import { LayoutDoc, LogMessage } from '../../../shared/types';

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

  @Put('log-file')
  writeTxt(
    @Body() body: { path: string; messages: LogMessage[]; spaced: boolean; strayLines: string[] },
  ) {
    this.library.writeTxt(body.path, body.messages, body.spaced, body.strayLines ?? []);
    return { ok: true };
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
