
import * as fs from 'fs';
import * as path from 'path';
import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { CONFIG } from '../config';
import { syncPaotuanRepo } from '../git-sync';
import { parseLogText } from '../../../shared/log-parser';
import { LayoutDoc, LogMessage } from '../../../shared/types';

export interface TreeNode {
  name: string;
  relPath: string;
  type: 'dir' | 'file';
  /** dir 节点的排版状态 */
  layoutStatus?: 'none' | 'draft' | 'published';
  hasTxt?: boolean;
  children?: TreeNode[];
}

@Injectable()
export class LibraryService {
  /** 白名单：解析并校验相对路径必须落在库根内 */
  resolveSafe(relPath: string): string {
    const root = path.resolve(CONFIG.libraryRoot);
    const abs = path.resolve(root, relPath);
    if (abs !== root && !abs.startsWith(root + path.sep)) {
      throw new BadRequestException('路径越界');
    }
    return abs;
  }

  /** 排版数据独立根：<库根>/.layout/<团相对路径>/（原始团目录保持只读，不受排版影响） */
  layoutDirFor(dirRel: string): string {
    return path.join(CONFIG.libraryRoot, '.layout', dirRel);
  }

  private layoutFileFor(dirRel: string): string {
    return path.join(this.layoutDirFor(dirRel), 'layout.json');
  }

  /** 两层目录树：库根下的目录（递归到团目录层），带排版状态（读独立 .layout 目录） */
  tree(maxDepth = 4): TreeNode {
    const build = (abs: string, rel: string, depth: number): TreeNode => {
      const node: TreeNode = { name: path.basename(abs), relPath: rel, type: 'dir' };
      const entries = fs.readdirSync(abs, { withFileTypes: true });
      const children: TreeNode[] = [];
      let hasTxt = false;

      for (const e of entries) {
        if (e.name.startsWith('.') || e.name.startsWith('~$')) continue;
        const childAbs = path.join(abs, e.name);
        const childRel = path.join(rel, e.name);
        if (e.isDirectory()) {
          if (depth > 1) children.push(build(childAbs, childRel, depth - 1));
        } else if (/\.(txt|doc|docx)$/i.test(e.name)) {
          if (e.name.endsWith('.txt')) hasTxt = true;
          children.push({ name: e.name, relPath: childRel, type: 'file' });
        }
      }

      const layoutFile = this.layoutFileFor(rel);
      let layoutStatus: TreeNode['layoutStatus'] = undefined;
      if (fs.existsSync(layoutFile)) {
        try {
          const layout = JSON.parse(fs.readFileSync(layoutFile, 'utf-8')) as LayoutDoc;
          layoutStatus = layout.status === 'published' ? 'published' : 'draft';
        } catch {
          layoutStatus = 'draft';
        }
      } else if (hasTxt) {
        layoutStatus = 'none';
      }
      node.hasTxt = hasTxt;
      node.layoutStatus = layoutStatus;
      node.children = children;
      return node;
    };
    return build(CONFIG.libraryRoot, '', maxDepth);
  }

  readTxt(relPath: string) {
    const abs = this.resolveSafe(relPath);
    if (!fs.existsSync(abs)) throw new NotFoundException('文件不存在');
    return parseLogText(fs.readFileSync(abs, 'utf-8'));
  }

  writeTxt(relPath: string, messages: LogMessage[], spaced: boolean, strayLines: string[]) {
    // 原始 log 文件保持只读——该接口不再被排版保存调用，仅保留给将来的显式用途
    void messages;
    void spaced;
    void strayLines;
    throw new BadRequestException('原始 log 文件为只读存档，排版内容请保存在排版文档中');
  }

  readLayout(dirRel: string): LayoutDoc {
    const layoutFile = this.layoutFileFor(dirRel);
    if (fs.existsSync(layoutFile)) {
      return JSON.parse(fs.readFileSync(layoutFile, 'utf-8')) as LayoutDoc;
    }
    // 不存在则从 txt 初始化默认排版文档（只读原始文件，不写回）
    this.resolveSafe(dirRel);
    const dirName = path.basename(dirRel);
    const txtRel = path.join(dirRel, `${dirName}（未处理）.txt`);
    const { messages } = this.readTxt(txtRel);
    return {
      schemaVersion: 1,
      status: 'draft',
      title: dirName,
      theme: 'painter',
      blocks: [
        { type: 'cover', fields: { title: dirName } },
        ...messages.map((m) => ({ type: 'message' as const, message: m })),
      ],
    };
  }

  writeLayout(dirRel: string, layout: LayoutDoc): { sync: { ok: boolean; detail: string } } {
    // 只写独立排版目录，绝不触碰原始团目录
    const layoutFile = this.layoutFileFor(dirRel);
    fs.mkdirSync(path.dirname(layoutFile), { recursive: true });
    fs.writeFileSync(layoutFile, JSON.stringify(layout, null, 1), 'utf-8');
    const rel = path.relative(CONFIG.paotuanRepo, CONFIG.libraryRoot);
    const sync = syncPaotuanRepo(`排版更新: ${layout.title || path.basename(dirRel)}`, rel);
    return { sync };
  }

  /** 图片等排版资产：存到 .layout/<团>/assets/，返回库内相对路径 */
  saveUpload(dirRel: string, filename: string, buffer: Buffer): string {
    const assetsDir = path.join(this.layoutDirFor(dirRel), 'assets');
    fs.mkdirSync(assetsDir, { recursive: true });
    const safeName = `${Date.now()}-${filename.replace(/[^\w.\-\u4e00-\u9fa5]/g, '_')}`;
    const relPath = path.join(path.relative(CONFIG.libraryRoot, assetsDir), safeName);
    fs.writeFileSync(path.join(assetsDir, safeName), buffer);
    return relPath.replace(/\\/g, '/');
  }

  /** 读取库内资产文件流（白名单） */
  readAsset(relPath: string): { buffer: Buffer; contentType: string } {
    const abs = this.resolveSafe(relPath);
    if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) throw new NotFoundException('文件不存在');
    const ext = path.extname(abs).toLowerCase();
    const types: Record<string, string> = {
      '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif',
      '.webp': 'image/webp', '.svg': 'image/svg+xml', '.bmp': 'image/bmp',
    };
    return { buffer: fs.readFileSync(abs), contentType: types[ext] ?? 'application/octet-stream' };
  }
}
