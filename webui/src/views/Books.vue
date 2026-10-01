
<template>
  <div>
    <div class="head">
      <h2>📖 书架</h2>
      <el-button type="primary" size="small" @click="dialog = true">＋ 新建书</el-button>
    </div>

    <el-empty v-if="books.length === 0" description="书架空空如也——先在 log 库里排版，再在这里成书" />
    <div class="shelf">
      <el-card v-for="b in books" :key="b.id ?? b.title" shadow="hover" class="book-card" @click="goRead(b)">
        <div class="book-cover">
          <img v-if="b.cover?.image" :src="b.cover.image" class="cover-img">
          <div v-else class="cover-text">{{ b.title }}</div>
        </div>
        <div class="book-info">
          <div class="book-title">{{ b.title }}</div>
          <div class="book-sub">{{ b.chapters.length }} 章 · {{ b.author || '佚名' }}</div>
          <div class="book-actions" @click.stop>
            <el-button size="small" text type="primary" @click="router.push(`/books/${b.id}/manage`)">管理</el-button>
            <el-button size="small" text type="primary" @click="goRead(b)">阅读</el-button>
            <el-popconfirm title="删除这本书？章节引用会移除，log 本身不受影响" @confirm="del(b)">
              <template #reference><el-button size="small" text type="danger">删除</el-button></template>
            </el-popconfirm>
          </div>
        </div>
      </el-card>
    </div>

    <el-dialog v-model="dialog" title="新建书" width="420px">
      <el-form label-width="70px">
        <el-form-item label="书名"><el-input v-model="form.title" /></el-form-item>
        <el-form-item label="作者"><el-input v-model="form.author" /></el-form-item>
        <el-form-item label="简介"><el-input v-model="form.intro" type="textarea" :rows="3" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialog = false">取消</el-button>
        <el-button type="primary" @click="create">创建</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { api } from '../api';
import { Book } from '../../../shared/types';

const router = useRouter();
const books = ref<(Book & { id?: string })[]>([]);
const dialog = ref(false);
const form = ref({ title: '', author: '', intro: '' });

async function load() {
  books.value = await api.get<(Book & { id?: string })[]>('/api/books');
}

async function create() {
  if (!form.value.title.trim()) { ElMessage.warning('书名不能为空'); return; }
  await api.post('/api/books', form.value);
  dialog.value = false;
  form.value = { title: '', author: '', intro: '' };
  await load();
}

async function del(b: Book & { id?: string }) {
  await api.del(`/api/books/${b.id}`);
  await load();
}

function goRead(b: Book & { id?: string }) {
  if (!b.chapters.length) { ElMessage.info('这本书还没有章节——点"管理"从已排版的 log 中添加'); return; }
  router.push(`/books/${b.id}/read`);
}

onMounted(load);
</script>

<style scoped>
.head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; }
.head h2 { margin: 0; }
.shelf { display: flex; flex-wrap: wrap; gap: 16px; }
.book-card { width: 210px; cursor: pointer; }
.book-cover { height: 240px; border-radius: 8px; overflow: hidden; background: linear-gradient(135deg, #3a4664, #6b5b8e); display: flex; align-items: center; justify-content: center; }
.cover-img { width: 100%; height: 100%; object-fit: cover; }
.cover-text { color: #fff; font-size: 20px; font-weight: 700; padding: 16px; text-align: center; letter-spacing: 2px; }
.book-info { padding: 10px 4px 2px; }
.book-title { font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.book-sub { font-size: 12px; color: #999; margin-top: 4px; }
.book-actions { margin-top: 6px; display: flex; }
</style>
