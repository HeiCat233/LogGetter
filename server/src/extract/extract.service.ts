
import { Injectable, NotFoundException } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { chromium, Browser } from 'playwright';
import { CONFIG, outputRoot } from '../config';
import { syncPaotuanRepo } from '../git-sync';
import { filterLogText } from '../../../shared/log-parser';
import { filterMhtmlText } from '../../../shared/mhtml';

export interface TaskItem {
  name: string;
  url: string;
  state: 'pending' | 'running' | 'success' | 'skipped' | 'failed';
  removed?: number;
  message?: string;
}

export interface Task {
  id: string;
  status: 'running' | 'done' | 'failed';
  force: boolean;
  items: TaskItem[];
  logs: string[];
  startedAt: string;
  finishedAt?: string;
}

@Injectable()
export class ExtractService {
  private tasks = new Map<string, Task>();
  /** 串行队列：Playwright 浏览器重资源，任务逐个执行 */
  private queue: Promise<void> = Promise.resolve();

  createTask(items: { name: string; url: string }[], force: boolean): string {
    const id = `task-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const task: Task = {
      id,
      status: 'running',
      force,
      items: items.map((it) => ({ ...it, state: 'pending' })),
      logs: [],
      startedAt: new Date().toISOString(),
    };
    this.tasks.set(id, task);
    this.queue = this.queue.then(() => this.runTask(task)).catch((e) => {
      task.status = 'failed';
      task.logs.push(`任务异常终止: ${e?.message ?? e}`);
    });
    return id;
  }

  getTask(id: string): Task {
    const t = this.tasks.get(id);
    if (!t) throw new NotFoundException('任务不存在');
    return t;
  }

  listTasks(): Task[] {
    return [...this.tasks.values()].sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  }

  private log(task: Task, line: string) {
    task.logs.push(`[${new Date().toLocaleTimeString('zh-CN', { hour12: false })}] ${line}`);
  }

  private async runTask(task: Task) {
    this.log(task, `开始处理 ${task.items.length} 个模组`);
    let browser: Browser | null = null;
    try {
      browser = await chromium.launch({ headless: CONFIG.headless });
      const page = await browser.newPage();
      for (const item of task.items) {
        item.state = 'running';
        try {
          const { skipped, removed } = await this.processOne(page, task, item, task.force);
          item.state = skipped ? 'skipped' : 'success';
          item.removed = removed;
        } catch (e: any) {
          item.state = 'failed';
          item.message = String(e?.message ?? e);
          this.log(task, `${item.name}: 失败 - ${item.message}`);
        }
      }
      const names = task.items.filter((i) => i.state === 'success').map((i) => i.name);
      if (names.length > 0) {
        const sync = syncPaotuanRepo(`log下载器同步: ${names.join(', ')}`, path.relative(CONFIG.paotuanRepo, outputRoot()));
        this.log(task, `跑团仓库同步: ${sync.detail}`);
      }
      task.status = 'done';
      this.log(task, '全部完成');
    } finally {
      await browser?.close();
      task.finishedAt = new Date().toISOString();
    }
  }

  private hasCompleteFiles(moduleDir: string): boolean {
    if (!fs.existsSync(moduleDir)) return false;
    const files = fs.readdirSync(moduleDir);
    const stem = path.basename(moduleDir);
    return (
      files.some((f) => f.startsWith(`${stem}（未处理）`)) &&
      files.some((f) => f.startsWith(`${stem}（不含场外）`))
    );
  }

  private async processOne(page: any, task: Task, item: TaskItem, force: boolean): Promise<{ skipped: boolean; removed: number }> {
    const moduleDir = path.join(outputRoot(), item.name);
    if (!force && this.hasCompleteFiles(moduleDir)) {
      this.log(task, `${item.name}: 文件已齐全，跳过`);
      return { skipped: true, removed: 0 };
    }
    fs.mkdirSync(moduleDir, { recursive: true });

    this.log(task, `${item.name}: 打开页面 ${item.url}`);
    await page.goto(item.url, { waitUntil: 'networkidle', timeout: CONFIG.gotoTimeoutMs });

    const stem = `${item.name}（未处理）`;
    const txtPath = await this.downloadViaButton(page, '下载原始文件', moduleDir, stem);
    this.log(task, `${item.name}: 已下载 ${path.basename(txtPath)}`);

    let docPath: string | null = null;
    try {
      docPath = await this.downloadViaButton(page, '下载带图doc', moduleDir, stem);
      this.log(task, `${item.name}: 已下载 ${path.basename(docPath)}`);
    } catch (e: any) {
      this.log(task, `${item.name}: 带图doc下载失败（不影响txt）: ${e?.message ?? e}`);
    }

    // 本地过滤生成「不含场外」
    const filteredTxt = filterLogText(fs.readFileSync(txtPath, 'utf-8'));
    fs.writeFileSync(path.join(moduleDir, `${item.name}（不含场外）.txt`), filteredTxt[0], 'utf-8');
    let removed = filteredTxt[1];

    if (docPath) {
      const [filteredDoc, removedDoc] = filterMhtmlText(fs.readFileSync(docPath, 'utf-8'));
      fs.writeFileSync(path.join(moduleDir, `${item.name}（不含场外）.doc`), filteredDoc, 'utf-8');
      this.log(task, `${item.name}: 已剔除场外 ${removed} 条（doc ${removedDoc} 块）`);
    } else {
      this.log(task, `${item.name}: 已剔除场外 ${removed} 条`);
    }
    if (removed === 0) this.log(task, `${item.name}: 警告——未剔除任何场外发言，请核对日志格式`);
    return { skipped: false, removed };
  }

  private async downloadViaButton(page: any, buttonText: string, dir: string, stem: string): Promise<string> {
    const downloadPromise = page.waitForEvent('download', { timeout: CONFIG.downloadTimeoutMs });
    await page.click(`text=${buttonText}`);
    const download = await downloadPromise;
    const ext = path.extname(download.suggestedFilename());
    const target = path.join(dir, `${stem}${ext}`);
    await download.saveAs(target);
    if (fs.existsSync(target) && fs.statSync(target).size === 0) {
      throw new Error(`下载的文件为空: ${target}`);
    }
    return target;
  }
}
