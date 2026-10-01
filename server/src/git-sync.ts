
import { execSync } from 'child_process';
import { CONFIG } from './config';

/**
 * 跑团备份仓库 git 同步（与 CLI 脚本行为一致：add + commit + push，失败仅警告不影响主流程）
 */
export function syncPaotuanRepo(message: string, subPath?: string): { ok: boolean; detail: string } {
  try {
    const run = (cmd: string) =>
      execSync(cmd, { cwd: CONFIG.paotuanRepo, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] });
    run(`git add -A -- "${subPath ?? '.'}"`);
    const status = run(`git status --porcelain -- "${subPath ?? '.'}"`).trim();
    if (!status) return { ok: true, detail: '无新变更' };
    run(`git commit -m "${message.replace(/"/g, "'")}"`);
    run('git push');
    return { ok: true, detail: '已提交并推送' };
  } catch (e: any) {
    return { ok: false, detail: String(e.stderr ?? e.message ?? e) };
  }
}
