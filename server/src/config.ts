
/** 全局配置：路径与监听（环境变量可覆盖，为未来局域网部署留空间） */
import * as path from 'path';

export const CONFIG = {
  /** 服务监听地址：默认仅本机；开放局域网时改 0.0.0.0 并配合鉴权 Guard */
  host: process.env.LOGGETTER_HOST ?? '127.0.0.1',
  port: Number(process.env.LOGGETTER_PORT ?? 8765),

  /** log 库白名单根：所有文件访问必须限制在该目录内 */
  libraryRoot: path.resolve(process.env.LOGGETTER_LIBRARY_ROOT ?? 'D:\\跑团\\log'),
  /** 书籍存储根 */
  booksRoot: path.resolve(process.env.LOGGETTER_BOOKS_ROOT ?? 'D:\\跑团\\书'),
  /** 下载器输出目录（log 库内） */
  outputRootName: 'log提取器',
  /** 跑团备份仓库（下载/排版后自动 git 同步） */
  paotuanRepo: process.env.LOGGETTER_PAOTUAN_REPO ?? 'D:\\跑团',

  downloadTimeoutMs: 120_000,
  gotoTimeoutMs: 60_000,
  /** 浏览器是否可见（保持与 CLI 脚本一致，便于观察下载过程） */
  headless: process.env.LOGGETTER_HEADLESS === '1',
};

/** 提取输出的绝对路径 */
export function outputRoot(): string {
  return path.join(CONFIG.libraryRoot, CONFIG.outputRootName);
}
