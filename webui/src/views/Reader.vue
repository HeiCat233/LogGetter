
<template>
  <div v-if="book" class="reader-shell">
    <!-- 封面区（封面字段已预留：有图显示图，无图显示文字版式） -->
    <div class="reader-cover">
      <img v-if="book.cover?.image" :src="book.cover.image" class="rc-img">
      <div class="rc-text">
        <h1 class="rc-title">{{ book.title }}</h1>
        <p v-if="book.cover?.subtitle" class="rc-sub">{{ book.cover.subtitle }}</p>
        <p class="rc-author">{{ book.author || '佚名' }} · 共 {{ book.chapters.length }} 章</p>
      </div>
    </div>

    <div class="reader-body">
      <aside class="toc">
        <div class="toc-title">目录</div>
        <div
          v-for="(ch, i) in book.chapters" :key="ch.id"
          class="toc-item" :class="{ active: i === current }"
          @click="go(i)"
        >{{ i + 1 }}. {{ ch.title }}</div>
        <el-button class="toc-manage" size="small" text @click="router.push(`/books/${book.id}/manage`)">管理章节</el-button>
      </aside>

      <main class="chapter-pane">
        <div v-if="current < 0" class="chapter-placeholder">
          <el-empty description="从目录选择一章开始阅读" />
        </div>
        <template v-else-if="chapter">
          <h2 class="chapter-title">{{ chapter.title }}</h2>
          <iframe class="chapter-frame" :srcdoc="chapterHtml" title="章节内容"></iframe>
          <div class="chapter-nav">
            <el-button :disabled="current <= 0" @click="go(current - 1)">上一章</el-button>
            <el-select v-model="current" size="small" style="width: 200px">
              <el-option v-for="(ch, i) in book.chapters" :key="ch.id" :label="`${i + 1}. ${ch.title}`" :value="i" />
            </el-select>
            <el-button :disabled="current >= book.chapters.length - 1" @click="go(current + 1)">下一章</el-button>
          </div>
        </template>
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api } from '../api';
import { renderFullHtml } from '../../../shared/renderer';
import { Book, LayoutDoc } from '../../../shared/types';

const route = useRoute();
const router = useRouter();
const id = computed(() => String(route.params.id));

const book = ref<(Book & { id: string }) | null>(null);
const current = ref(-1);
const chapter = ref<{ title: string; layout: LayoutDoc } | null>(null);
const chapterHtml = ref('');

async function loadBook() {
  book.value = await api.get<Book & { id: string }>(`/api/books/${id.value}`);
}

async function go(i: number) {
  if (!book.value || i < 0 || i >= book.value.chapters.length) return;
  current.value = i;
  chapter.value = await api.get<{ title: string; layout: LayoutDoc }>(`/api/books/${id.value}/chapter`, { index: i });
  // 阅读视图不含场外发言
  chapterHtml.value = renderFullHtml(chapter.value.layout, { includeOutside: false });
}

watch(current, (v) => { void v; });
watch(id, loadBook, { immediate: true });
</script>

<style scoped>
.reader-shell { max-width: 1080px; margin: 0 auto; }
.reader-cover { background: linear-gradient(135deg, #2c3450, #5b4a78); border-radius: 14px; padding: 48px 32px; display: flex; gap: 28px; align-items: center; color: #fff; margin-bottom: 20px; }
.rc-img { height: 180px; border-radius: 10px; }
.rc-title { margin: 0 0 8px; font-size: 30px; letter-spacing: 3px; }
.rc-sub { margin: 0 0 6px; color: #cfd3e8; }
.rc-author { margin: 0; color: #9aa0bf; font-size: 14px; }
.reader-body { display: flex; gap: 16px; }
.toc { width: 250px; background: #fff; border-radius: 10px; padding: 12px; height: fit-content; position: sticky; top: 12px; max-height: calc(100vh - 40px); overflow: auto; }
.toc-title { font-weight: 700; padding: 4px 8px 10px; }
.toc-item { padding: 8px 10px; border-radius: 6px; cursor: pointer; font-size: 14px; color: #444; }
.toc-item:hover { background: #f2f4f8; }
.toc-item.active { background: #ecf3ff; color: #3b7cff; }
.toc-manage { margin-top: 8px; }
.chapter-pane { flex: 1; background: #fff; border-radius: 10px; padding: 20px; display: flex; flex-direction: column; min-height: 70vh; }
.chapter-title { margin: 0 0 14px; text-align: center; }
.chapter-frame { flex: 1; border: none; width: 100%; min-height: 55vh; }
.chapter-nav { display: flex; justify-content: center; gap: 14px; padding-top: 14px; border-top: 1px solid #f0f0f0; }
.chapter-placeholder { flex: 1; display: flex; align-items: center; justify-content: center; }
</style>
