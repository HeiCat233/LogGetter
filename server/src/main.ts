
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ServeStaticModule } from '@nestjs/serve-static';
import { Module } from '@nestjs/common';
import * as path from 'path';
import { CONFIG } from './config';
import { LibraryModule } from './library/library.module';
import { ExtractModule } from './extract/extract.module';
import { BooksModule } from './books/books.module';
import { ExportModule } from './export/export.module';

@Module({
  imports: [
    // 前端构建产物托管（webui build 输出到 server/public，服务从 server 目录启动）；
    // 开发期由 Vite dev server 代理，不影响
    ServeStaticModule.forRoot({
      rootPath: path.resolve(process.cwd(), 'public'),
      serveRoot: '/',
      exclude: ['/api/(.*)'],
    }),
    LibraryModule,
    ExtractModule,
    BooksModule,
    ExportModule,
  ],
})
export class AppModule {}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.setGlobalPrefix('api', { exclude: [''] });
  // SPA 前端路由兜底：非 /api、非静态资源的 GET 请求返回 index.html
  app.use((req: any, res: any, next: any) => {
    if (req.method === 'GET' && !req.path.startsWith('/api') && !path.extname(req.path)) {
      res.sendFile(path.resolve(process.cwd(), 'public', 'index.html'));
    } else {
      next();
    }
  });
  // 预留鉴权挂载点：开放局域网/多人时在此注册全局 Guard（如 APP_GUARD + JwtAuthGuard）
  await app.listen(CONFIG.port, CONFIG.host);
  console.log(`LogGetter 服务已启动: http://${CONFIG.host}:${CONFIG.port}`);
}

bootstrap();
