
import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { BooksService } from './books.service';
import { Book } from '../../../shared/types';

@Controller('books')
export class BooksController {
  constructor(private readonly books: BooksService) {}

  @Get()
  list() {
    return this.books.list();
  }

  @Get('candidates')
  candidates() {
    return this.books.publishedCandidates();
  }

  @Get(':id/chapter')
  chapter(@Param('id') id: string, @Query('index') index: string) {
    return this.books.chapterContent(id, Number(index));
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.books.get(id);
  }

  @Post()
  create(@Body() body: Partial<Book>) {
    return this.books.create(body);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() body: Partial<Book>) {
    return this.books.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.books.remove(id);
  }
}
