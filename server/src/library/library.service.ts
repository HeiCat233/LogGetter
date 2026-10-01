
import * as fs from 'fs';
import * as path from 'path';
import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { CONFIG } from '../config';
import { syncPaotuanRepo } from '../git-sync';
import { parseLogText, serializeLogText } from '../../../shared/log-parser';
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

  private layoutFileFor(dirAbs: string): string {
    const dirName = path.basename(dirAbs);
    return path.join(dirAbs, `${dirName}.layout.json`);
  }

  /** 两层目录树：库根下的目录（递归到团目录层），带排版状态 */
  tree(maxDepth = 4): TreeNode {
    const build = (abs: string, rel: string, depth: number): TreeNode => {
      const node: TreeNode = { name: path.basename(abs), relPath: rel, type: 'dir' };
      const entries = fs.readdirSync(abs, { withFileTypes: true });
      const children: TreeNode[] = [];
      let hasTxt = false;
      let layoutStatus: TreeNode['layoutStatus'] = undefined;

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

      const layoutFile = this.layoutFileFor(abs);
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
    const abs = this.resolveSafe(relPath);
    fs.writeFileSync(abs, serializeLogText(messages, spaced, strayLines), 'utf-8');
  }

  readLayout(dirRel: string): LayoutDoc {
    const dirAbs = this.resolveSafe(dirRel);
    const layoutFile = this.layoutFileFor(dirAbs);
    if (fs.existsSync(layoutFile)) {
      return JSON.parse(fs.readFileSync(layoutFile, 'utf-8')) as LayoutDoc;
    }
    // 不存在则从 txt 初始化默认排版文档
    const txtRel = path.join(dirRel, `${path.basename(dirAbs)}（未处理）.txt`);
    const { messages } = this.readTxt(txtRel);
    return {
      schemaVersion: 1,
      status: 'draft',
      title: path.basename(dirAbs),
      theme: 'painter',
      blocks: [
        { type: 'cover', fields: { title: path.basename(dirAbs) } },
        ...messages.map((m) => ({ type: 'message' as const, message: m })),
      ],
    };
  }

  writeLayout(dirRel: string, layout: LayoutDoc): { sync: { ok: boolean; detail: string } } {
    const dirAbs = this.resolveSafe(dirRel);
    fs.writeFileSync(this.layoutFileFor(dirAbs), JSON.stringify(layout, null, 1), 'utf-8');
    // 排版文档变化时把消息源同步回写（编辑器里对消息的修改反映到 txt，保持单一来源兼容）
    const msgBlocks = layout.blocks.filter((b) => b.type === 'message');
    const messages = msgBlocks.map((b) => (b as { type: 'message'; message: LogMessage }).message);
    const txtAbs = path.join(dirAbs, `${path.basename(dirAbs)}（未处理）.txt`);
    if (fs.existsSync(txtAbs)) {
      const { spaced, strayLines } = parseLogText(fs.readFileSync(txtAbs, 'utf-8'));
      fs.writeFileSync(txtAbs, serializeLogText(messages, spaced, strayLines), 'utf-8');
    }
    // 保存（用户显式动作）时同步跑团备份仓库，失败仅返回警告
    const rel = path.relative(CONFIG.paotuanRepo, CONFIG.libraryRoot);
    const sync = syncPaotuanRepo(`排版更新: ${layout.title || path.basename(dirAbs)}`, rel);
    return { sync };
  }

  saveUpload(dirRel: string, filename: string, buffer: Buffer): string {
    const dirAbs = this.resolveSafe(dirRel);
    const assetsDir = path.join(dirAbs, 'assets');
    fs.mkdirSync(assetsDir, { recursive: true });
    const safeName = `${Date.now()}-${filename.replace(/[^\w.\-\u4e00-\u9fa5]/g, '_')}`;
    const relPath = path.join(path.relative(CONFIG.libraryRoot, assetsDir), safeName);
    fs.writeFileSync(path.join(assetsDir, safeName), buffer);
    return relPath.replace(/\\/g, '/');
  }
}
