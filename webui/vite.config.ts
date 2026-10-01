import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  build: {
    // 构建产物直接输出到 NestJS 静态托管目录
    outDir: '../server/public',
    emptyOutDir: true,
  },
  server: {
    port: 5175,
    proxy: {
      // 开发期 API 代理到 NestJS
      '/api': 'http://127.0.0.1:8765',
    },
  },
});
