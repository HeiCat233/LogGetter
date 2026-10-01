
<template>
  <div v-if="book">
    <div class="head">
      <el-button size="small" @click="router.push('/books')">← 书架</el-button>
      <h2>《{{ book.title }}》管理</h2>
      <el-button size="small" type="primary" @click="router.push(`/books/${book.id}/read`)">阅读</el-button>
    </div>

    <el-card shadow="never" class="meta-card">
      <el-form label-width="70px" size="small">
        <el-form-item label="书名"><el-input v-model="book.title" /></el-form-item>
        <el-form-item label="作者"><el-input v-model="book.author" /></el-form-item>
        <el-form-item label="简介"><el-input v-model="book.intro" type="textarea" :rows="2" /></el-form-item>
        <el-form-item label="封面图">
          <el-input v-model="coverImage" placeholder="图片地址（可留空，封面功能后续细化）" />
        </el-form-item>
      </el-form>
      <el-button size="small" type="primary" :loading="savingMeta" @click="saveMeta">保存书籍信息</el-button>
    </el-card>

    <el-card shadow="never" class="chapter-card">
      <template #header>
        <div class="chapter-head">
          <span>章节（{{ book.chapters.length }}）</span>
          <el-button size="small" type="primary" plain @click="picker = true">＋ 从已排版 log 添加章节</el-button>
        </div>
      </template>
      <el-empty v-if="book.chapters.length === 0" description="还没有章节" />
      <draggable v-else v-model="book.chapters" item-key="id" handle=".drag-handle" animation="150">
        <template #item="{ element: ch, index }">
          <div class="chapter-row">
            <span class="drag-handle">⠿</span>
            <span class="chapter-no">{{ index + 1 }}</span>
            <el-input v-model="ch.title" size="small" style="flex: 1" />
            <el-tag size="small" type="info">{{ ch.dir }}</el-tag>
            <el-button size="small" text type="danger" @click="book!.chapters.splice(index, 1)">移除</el-button>
          </div>
        </template>
      </draggable>
      <el-button v-if="book.chapters.length" size="small" type="primary" :loading="savingChapters" @click="saveChapters" class="save-chapters">保存章节顺序</el-button>
    </el-card>

    <el-dialog v-model="picker" title="从已排版的 log 中添加章节" width="520px">
      <el-empty v-if="candidates.length === 0" description="没有已排版的 log——先在 log 库把状态改为「已排版」" />
      <div v-for="c in candidates" :key="c.dir" class="cand-row">
        <span class="cand-title">{{ c.title }}</span>
        <el-button size="small" type="primary" plain @click="addChapter(c)">添加为章节</el-button>
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import draggable from 'vuedraggable';
import { api } from '../api';
import { Book } from '../../../shared/types';

const route = useRoute();
const router = useRouter();
const id = computed(() => String(route.params.id));

const book = ref<(Book & { id: string }) | null>(null);
const savingMeta = ref(false);
const savingChapters = ref(false);
const picker = ref(false);
const candidates = ref<{ dir: string; title: string; status: string }[]>([]);

const coverImage = computed({
  get: () => book.value?.cover?.image ?? '',
  set: (v: string) => { if (book.value) book.value.cover = { ...book.value.cover, image: v }; },
});

async function load() {
  book.value = await api.get<Book & { id: string }>(`/api/books/${id.value}`);
}

async function saveMeta() {
  savingMeta.value = true;
  try {
    const { id: _ignored, ...data } = book.value!;
    void _ignored;
    book.value = await api.put<Book & { id: string }>(`/api/books/${id.value}`, data);
    ElMessage.success('已保存');
  } finally { savingMeta.value = false; }
}

async function saveChapters() {
  savingChapters.value = true;
  try {
    await api.put(`/api/books/${id.value}`, { chapters: book.value!.chapters });
    ElMessage.success('章节顺序已保存');
  } finally { savingChapters.value = false; }
}

async function addChapter(c: { dir: string; title: string }) {
  book.value!.chapters.push({ id: `ch-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`, title: c.title, dir: c.dir });
  await saveChapters();
  ElMessage.success(`已添加《${c.title}》`);
}

async function openPicker() {
  candidates.value = await api.get('/api/books/candidates');
  picker.value = true;
}

import { watch } from 'vue';
watch(picker, (v) => { if (v) openPicker(); });

onMounted(load);
</script>

<style scoped>
.head { display: flex; align-items: center; gap: 12px; margin-bottom: 14px; }
.head h2 { margin: 0; flex: 1; }
.meta-card { margin-bottom: 16px; }
.chapter-head { display: flex; justify-content: space-between; align-items: center; }
.chapter-row { display: flex; align-items: center; gap: 10px; padding: 6px 0; border-bottom: 1px dashed #eee; }
.drag-handle { cursor: grab; color: #a0a6ad; }
.chapter-no { color: #999; font-size: 13px; width: 24px; }
.save-chapters { margin-top: 12px; }
.cand-row { display: flex; align-items: center; justify-content: space-between; padding: 8px 0; border-bottom: 1px dashed #eee; }
.cand-title { flex: 1; }
</style>
