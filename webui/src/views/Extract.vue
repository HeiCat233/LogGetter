
<template>
  <div>
    <h2>🧲 提取 log</h2>
    <el-card shadow="never" class="input-card">
      <p class="tip">每行一条，格式：<b>模组名 网址</b>（与命令行脚本格式一致，支持一次粘贴多个）</p>
      <el-input
        v-model="inputText"
        type="textarea"
        :rows="5"
        placeholder="例如：&#10;厕所已满 http://log.weizaima.com/?key=xxxx#123456&#10;封冻恶疾 https://logrender.dice.center/#2-log_xxx"
      />
      <div class="toolbar">
        <el-checkbox v-model="force">强制重下（忽略已有文件）</el-checkbox>
        <el-button type="primary" :disabled="pairs.length === 0 || taskRunning" @click="start">
          开始提取（{{ pairs.length }} 个模组）
        </el-button>
      </div>
      <div v-if="pairs.length" class="pairs">
        <el-tag v-for="(p, i) in pairs" :key="i" class="pair-tag" type="info">{{ p.name }} → {{ p.url.length > 60 ? p.url.slice(0, 60) + '…' : p.url }}</el-tag>
      </div>
    </el-card>

    <el-card v-if="task" shadow="never" class="task-card">
      <template #header>任务 {{ task.id }} · {{ statusText }}</template>
      <el-table :data="task.items" size="small">
        <el-table-column prop="name" label="模组" min-width="160" />
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="stateTag(row.state)" size="small">{{ row.state }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="removed" label="剔除场外" width="100" />
        <el-table-column prop="message" label="备注" min-width="180" show-overflow-tooltip />
      </el-table>
      <div class="logs" ref="logBox">
        <div v-for="(l, i) in task.logs" :key="i" class="log-line">{{ l }}</div>
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onUnmounted, ref, watch } from 'vue';
import { api } from '../api';

interface TaskItem { name: string; url: string; state: string; removed?: number; message?: string }
interface Task { id: string; status: string; items: TaskItem[]; logs: string[] }

const inputText = ref('');
const force = ref(false);
const task = ref<Task | null>(null);
const logBox = ref<HTMLElement>();
let timer: ReturnType<typeof setInterval> | null = null;

const pairs = computed(() => {
  const out: { name: string; url: string }[] = [];
  const re = /(https?:\/\/[^\s，。；、！？）】」』,;]+)/g;
  let last = 0;
  for (const m of inputText.value.matchAll(re)) {
    const name = inputText.value.slice(last, m.index ?? 0).trim();
    if (name) out.push({ name, url: m[0] });
    last = (m.index ?? 0) + m[0].length;
  }
  return out;
});

const taskRunning = computed(() => task.value?.status === 'running');

const statusText = computed(() => ({ running: '进行中', done: '已完成', failed: '失败' })[task.value?.status ?? ''] ?? '');

function stateTag(state: string) {
  return ({ success: 'success', skipped: 'info', failed: 'danger', running: 'warning', pending: 'info' } as Record<string, any>)[state] ?? 'info';
}

async function start() {
  const res = await api.post<{ ok: boolean; id?: string; error?: string }>('/api/extract', { items: pairs.value, force: force.value });
  if (!res.ok || !res.id) { ElMessage.error(res.error ?? '提交失败'); return; }
  const t = await api.get<Task>(`/api/tasks/${res.id}`);
  task.value = t;
  timer = setInterval(refresh, 2000);
}

async function refresh() {
  if (!task.value) return;
  task.value = await api.get<Task>(`/api/tasks/${task.value.id}`);
  await nextTick();
  logBox.value?.scrollTo(0, logBox.value.scrollHeight);
  if (task.value.status !== 'running' && timer) {
    clearInterval(timer);
    timer = null;
    ElMessage.success('提取任务结束');
  }
}

import { ElMessage } from 'element-plus';
watch(inputText, () => {/* 占位保持响应式 */ });
onUnmounted(() => { if (timer) clearInterval(timer); });
</script>

<style scoped>
h2 { margin-top: 0; }
.input-card, .task-card { margin-bottom: 16px; }
.tip { color: #888; margin-top: 0; }
.toolbar { display: flex; align-items: center; gap: 16px; margin-top: 12px; }
.pairs { margin-top: 12px; display: flex; flex-wrap: wrap; gap: 6px; }
.pair-tag { max-width: 100%; }
.logs { margin-top: 12px; max-height: 260px; overflow: auto; background: #14181f; color: #9fdca0; border-radius: 6px; padding: 10px 12px; font-family: Consolas, monospace; font-size: 12px; }
.log-line { white-space: pre-wrap; word-break: break-all; }
</style>
