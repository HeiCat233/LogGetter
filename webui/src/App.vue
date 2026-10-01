
<template>
  <el-container class="app-shell">
    <el-aside width="200px" class="app-aside">
      <div class="app-logo">📖 LogGetter</div>
      <el-menu :default-active="active" router class="app-menu">
        <el-menu-item index="/extract">🧲 提取 log</el-menu-item>
        <el-menu-item index="/library">📚 log 库</el-menu-item>
        <el-menu-item index="/books">📖 书架</el-menu-item>
      </el-menu>
      <div class="app-foot">跑团日志工坊<br>本地服务 v0.1</div>
    </el-aside>
    <el-main class="app-main">
      <router-view />
    </el-main>
  </el-container>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';

const route = useRoute();
const active = computed(() => {
  if (route.path.startsWith('/editor')) return '/library';
  if (route.path.startsWith('/books')) return '/books';
  return route.path;
});
</script>

<style>
html, body, #app { height: 100%; margin: 0; }
.app-shell { height: 100%; }
.app-aside { background: #1d2530; display: flex; flex-direction: column; }
.app-logo { color: #fff; font-size: 18px; font-weight: 700; padding: 20px 16px; }
.app-menu { border-right: none; flex: 1; background: transparent; }
.app-menu .el-menu-item { color: #b8c0cc; }
.app-menu .el-menu-item.is-active { color: #409eff; background: rgba(64, 158, 255, 0.12); }
.app-menu .el-menu-item:hover { background: rgba(255, 255, 255, 0.06); }
.app-foot { color: #5a6472; font-size: 12px; padding: 16px; line-height: 1.8; }
.app-main { background: #f5f7fa; padding: 20px; overflow: auto; }
</style>
