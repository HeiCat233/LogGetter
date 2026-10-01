
import * as fs from 'fs';
import * as path from 'path';
import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { CONFIG } from '../config';
import { Book, LayoutDoc } from '../../../shared/types';
import { LibraryService } from '../library/library.service';

@Injectable()
export class BooksService {
  constructor(private readonly library: LibraryService) {}

  private resolveSafe(rel: string): string {
    const root = path.resolve(CONFIG.booksRoot);
    const abs = path.resolve(root, rel);
    if (abs !== root && !abs.startsWith(root + path.sep)) throw new BadRequestException('路径越界');
    return abs;
  }

  private bookFile(id: string): string {
    return path.join(this.resolveSafe(id), 'book.json');
  }

  list(): Book[] {
    if (!fs.existsSync(CONFIG.booksRoot)) return [];
    const books: Book[] = [];
    for (const d of fs.readdirSync(CONFIG.booksRoot, { withFileTypes: true })) {
      if (!d.isDirectory()) continue;
      const f = path.join(CONFIG.booksRoot, d.name, 'book.json');
      if (fs.existsSync(f)) {
        try {
          books.push({ id: d.name, ...JSON.parse(fs.readFileSync(f, 'utf-8')) } as Book);
        } catch {
          /* 跳过损坏的书籍文件 */
        }
      }
    }
    return books.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  get(id: string): Book {
    const f = this.bookFile(id);
    if (!fs.existsSync(f)) throw new NotFoundException('书籍不存在');
    return JSON.parse(fs.readFileSync(f, 'utf-8')) as Book;
  }

  create(data: Partial<Book>): Book & { id: string } {
    const title = (data.title ?? '').trim() || '未命名书';
    const id = `${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.random().toString(36).slice(2, 7)}`;
    const dir = path.join(CONFIG.booksRoot, id);
    fs.mkdirSync(dir, { recursive: true });
    const now = new Date().toISOString();
    const book: Book = {
      schemaVersion: 1,
      title,
      author: data.author ?? '',
      intro: data.intro ?? '',
      cover: data.cover ?? {},
      chapters: data.chapters ?? [],
      createdAt: now,
      updatedAt: now,
    };
    fs.writeFileSync(path.join(dir, 'book.json'), JSON.stringify(book, null, 1), 'utf-8');
    return { id, ...book };
  }

  update(id: string, data: Partial<Book>): Book & { id: string } {
    const existing = this.get(id);
    const book: Book = { ...existing, ...data, schemaVersion: 1, updatedAt: new Date().toISOString() };
    fs.writeFileSync(this.bookFile(id), JSON.stringify(book, null, 1), 'utf-8');
    return { id, ...book };
  }

  remove(id: string) {
    const dir = this.resolveSafe(id);
    if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true });
    return { ok: true };
  }

  /** 章节正文：读取章节引用的团的排版文档 */
  chapterContent(id: string, index: number): { title: string; layout: LayoutDoc } {
    const book = this.get(id);
    const ch = book.chapters[index];
    if (!ch) throw new NotFoundException('章节不存在');
    const layout = this.library.readLayout(ch.dir);
    return { title: ch.title, layout };
  }

  /** 可入书的章节候选：log 库中"已排版"的团 */
  publishedCandidates(): { dir: string; title: string; status: string }[] {
    const out: { dir: string; title: string; status: string }[] = [];
    const walk = (rel: string, depth: number) => {
      const abs = path.join(CONFIG.libraryRoot, rel);
      if (!fs.existsSync(abs)) return;
      for (const e of fs.readdirSync(abs, { withFileTypes: true })) {
        if (!e.isDirectory() || e.name.startsWith('.')) continue;
        const childRel = path.join(rel, e.name);
        const childAbs = path.join(abs, e.name);
        const layoutFile = path.join(childAbs, `${e.name}.layout.json`);
        if (fs.existsSync(layoutFile)) {
          const layout = JSON.parse(fs.readFileSync(layoutFile, 'utf-8')) as LayoutDoc;
          out.push({ dir: childRel, title: layout.title || e.name, status: layout.status });
        } else if (depth > 1) {
          walk(childRel, depth - 1);
        }
      }
    };
    walk('', 4);
    return out.filter((c) => c.status === 'published');
  }
}
