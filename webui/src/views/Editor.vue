
<template>
  <div v-if="doc" class="editor-shell">
    <div class="toolbar">
      <el-button size="small" @click="router.push('/library')">← 返回</el-button>
      <el-input v-model="doc.title" size="small" class="title-input" placeholder="排版标题" />
      <el-select v-model="doc.theme" size="small" style="width: 130px">
        <el-option label="气泡主题" value="painter" />
        <el-option label="文档主题" value="document" />
      </el-select>
      <el-select v-model="doc.status" size="small" style="width: 120px">
        <el-option label="排版中" value="draft" />
        <el-option label="已排版（可入书）" value="published" />
      </el-select>
      <el-switch v-model="showOutside" active-text="显示场外" size="small" />
      <el-dropdown @command="insertBlock" class="insert-dd">
        <el-button size="small" type="primary" plain>＋ 插入</el-button>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item command="heading">章节标题</el-dropdown-item>
            <el-dropdown-item command="image">插图</el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
      <el-button size="small" type="warning" plain @click="removeOutside">批量删除场外</el-button>
      <div class="spacer" />
      <el-dropdown @command="doExport" split-button size="small" type="success" @click="doExport('html-clean')">
        导出
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item command="html-clean">HTML（不含场外）</el-dropdown-item>
            <el-dropdown-item command="html-full">HTML（含场外）</el-dropdown-item>
            <el-dropdown-item command="doc-clean">Word 文档（不含场外）</el-dropdown-item>
            <el-dropdown-item command="doc-full">Word 文档（含场外）</el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
      <el-button size="small" type="primary" :loading="saving" @click="save">保存</el-button>
    </div>

    <div class="editor-body">
      <div class="block-pane">
        <el-alert v-if="coverFields" type="info" :closable="false" class="cover-tip">
          封面块已存在（列表内可编辑）；封面图片、导语等字段留作后续细化
        </el-alert>
        <draggable v-model="doc.blocks" item-key="_uid" handle=".drag-handle" animation="150" class="block-list">
          <template #item="{ element: b, index }">
            <div class="block-card" :class="'card-' + b.type">
              <div class="block-head">
                <span class="drag-handle" title="拖拽排序">⠿</span>
                <span class="block-type">{{ typeLabel(b.type) }}</span>
                <el-button size="small" text type="danger" @click="removeBlock(index)">删除</el-button>
              </div>

              <!-- 封面块 -->
              <div v-if="b.type === 'cover'" class="block-edit">
                <el-input v-model="b.fields!.title" size="small" placeholder="封面标题（留空则不显示）" class="mb6" />
                <el-input v-model="b.fields!.subtitle" size="small" placeholder="副标题" class="mb6" />
                <el-input v-model="b.fields!.intro" size="small" type="textarea" :rows="2" placeholder="导语" class="mb6" />
                <el-input v-model="b.fields!.date" size="small" placeholder="日期，如 2025.03 - 2025.06" class="mb6" />
                <el-input v-model="b.fields!.image" size="small" placeholder="封面图（外链或上传，可留空）">
                  <template #append>
                    <el-upload :show-file-list="false" :http-request="(o: any) => uploadTo(b.fields!, 'image', o)" accept="image/*">
                      <el-button size="small">上传</el-button>
                    </el-upload>
                  </template>
                </el-input>
              </div>

              <!-- 标题块 -->
              <el-input v-else-if="b.type === 'heading'" v-model="b.text" size="small" placeholder="章节标题" />

              <!-- 图片块 -->
              <div v-else-if="b.type === 'image'" class="block-edit">
                <el-input v-model="b.src" size="small" placeholder="图片地址（外链）" class="mb6">
                  <template #append>
                    <el-upload :show-file-list="false" :http-request="(o: any) => uploadImageBlock(o, index)" accept="image/*">
                      <el-button size="small">上传</el-button>
                    </el-upload>
                  </template>
                </el-input>
                <el-input v-model="b.caption" size="small" placeholder="图注（可留空）" />
              </div>

              <!-- 消息块 -->
              <div v-else-if="b.type === 'message'" class="block-edit">
                <div class="msg-head">
                  <el-tag v-if="b.message.outside" size="small" type="warning">场外</el-tag>
                  <el-input v-model="b.message.nickname" size="small" style="width: 130px" placeholder="昵称" />
                  <el-input v-model="b.message.timeRaw" size="small" style="width: 170px" placeholder="时间" />
                </div>
                <el-input
                  :model-value="linesText(b)"
                  size="small" type="textarea" :rows="2" placeholder="消息内容（换行保留）" class="mb6"
                  @update:model-value="(v: string) => setLines(b, v)"
                />
              </div>
            </div>
          </template>
        </draggable>
        <el-button class="add-block" size="small" plain @click="insertBlock('heading')" :disabled="!insertAtEnd">＋ 在末尾插入标题</el-button>
      </div>

      <div class="preview-pane">
        <div class="preview-title">实时预览</div>
        <iframe class="preview-frame" :srcdoc="previewHtml" title="预览"></iframe>
      </div>
    </div>
  </div>
  <el-empty v-else-if="loadError" :description="loadError" />
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import draggable from 'vuedraggable';
import { api } from '../api';
import { renderFullHtml } from '../../../shared/renderer';
import { Block, CoverBlock, HeadingBlock, ImageBlock, LayoutDoc, MessageBlock } from '../../../shared/types';

const route = useRoute();
const router = useRouter();
const dir = computed(() => String(route.query.dir ?? ''));

const doc = ref<LayoutDoc | null>(null);
const loadError = ref('');
const showOutside = ref(true);
const saving = ref(false);
const insertAtEnd = ref(true);
let uid = 0;

const previewHtml = ref('');
let previewTimer: ReturnType<typeof setTimeout> | null = null;

function withUid(b: Block): Block & { _uid: number } {
  return { ...b, _uid: ++uid } as Block & { _uid: number };
}

function typeLabel(t: string) {
  return ({ cover: '封面', heading: '章节标题', message: '消息', image: '插图' } as Record<string, string>)[t] ?? t;
}

const coverFields = computed(() => doc.value?.blocks.find((b) => b.type === 'cover'));

/** 消息内容行编辑（多行文本 ↔ lines 数组） */
function linesText(b: MessageBlock): string {
  return b.message.lines.join('\n');
}
function setLines(b: MessageBlock, v: string) {
  b.message.lines = v.split('\n');
  if (origSpaced && b.message.lines[b.message.lines.length - 1] !== '') b.message.lines.push('');
  b.message.outside = isOutsideOf(b.message.lines);
}
let origSpaced = true;
function isOutsideOf(lines: string[]): boolean {
  const first = lines.find((l) => l.trim() !== '') ?? '';
  return /^(?:\[CQ:[^\]]*\])+\s*/.test(first)
    ? first.replace(/^(?:\[CQ:[^\]]*\])+\s*/, '').trimStart().startsWith('(') || first.replace(/^(?:\[CQ:[^\]]*\])+\s*/, '').trimStart().startsWith('（')
    : first.startsWith('(') || first.startsWith('（');
}

function insertBlock(type: 'heading' | 'image') {
  const nb: Block = type === 'heading'
    ? { type: 'heading', text: '新章节' } as HeadingBlock
    : ({ type: 'image', src: '', caption: '' } as ImageBlock);
  doc.value!.blocks.push(withUid(nb));
  ElMessage.success('已插入到末尾，可拖拽到目标位置');
}

function removeBlock(index: number) {
  doc.value!.blocks.splice(index, 1);
}

function removeOutside() {
  ElMessageBox.confirm('将删除排版中所有场外消息（不影响 txt 里的历史，保存后生效）。继续？', '批量删除场外', { type: 'warning' })
    .then(() => {
      const before = doc.value!.blocks.length;
      doc.value!.blocks = doc.value!.blocks.filter((b) => b.type !== 'message' || !b.message.outside);
      ElMessage.success(`已移除 ${before - doc.value!.blocks.length} 条场外`);
    })
    .catch(() => {});
}

async function uploadTo(fields: CoverBlock['fields'], key: 'image', option: any) {
  const relPath = await doUpload(option.file);
  if (relPath) fields[key] = relPath;
}

async function uploadImageBlock(option: any, index: number) {
  const relPath = await doUpload(option.file);
  if (relPath) (doc.value!.blocks[index] as ImageBlock).src = relPath;
}

async function doUpload(file: File): Promise<string | null> {
  const form = new FormData();
  form.append('dir', dir.value);
  form.append('file', file);
  const res = await api.upload('/api/library/upload', form);
  if (!res.ok || !res.path) { ElMessage.error(res.error ?? '上传失败'); return null; }
  return res.path;
}

async function save() {
  saving.value = true;
  try {
    // 剥离内部 uid 字段再保存
    const clean: LayoutDoc = {
      ...doc.value!,
      blocks: doc.value!.blocks.map((b) => {
        const { _uid, ...rest } = b as any;
        return rest as Block;
      }),
    };
    const res = await api.put<{ ok: boolean; sync?: { ok: boolean; detail: string } }>('/api/layout', { dir: dir.value, layout: clean });
    doc.value!.blocks = clean.blocks.map(withUid);
    ElMessage.success(res.sync?.ok === false ? `已保存（仓库同步失败：${res.sync.detail}）` : '已保存（含仓库同步）');
  } catch (e: any) {
    ElMessage.error(`保存失败: ${e.message ?? e}`);
  } finally {
    saving.value = false;
  }
}

async function doExport(cmd: string) {
  const [kind, part] = cmd.split('-');
  try {
    const name = await api.download(`/api/export/${kind}`, { includeOutside: part === 'full' }, { dir: dir.value });
    ElMessage.success(`已导出 ${name}`);
  } catch (e: any) {
    ElMessage.error(e.message ?? e);
  }
}

// 预览防抖刷新
watch(doc, () => {
  if (!doc.value) return;
  if (previewTimer) clearTimeout(previewTimer);
  previewTimer = setTimeout(() => {
    const clean: LayoutDoc = { ...doc.value!, blocks: doc.value!.blocks.map((b) => { const { _uid, ...rest } = b as any; return rest as Block; }) };
    previewHtml.value = renderFullHtml(clean, { showOutsideClass: showOutside.value });
  }, 350);
}, { deep: true });

onMounted(async () => {
  if (!dir.value) { loadError.value = '未指定目录'; return; }
  try {
    const layout = await api.get<LayoutDoc>('/api/layout', { dir: dir.value });
    doc.value = { ...layout, blocks: layout.blocks.map(withUid) };
    const txt = await api.get<{ spaced: boolean }>('/api/log-file', { path: `${dir.value}/${dir.value.split(/[\\/]/).pop()}（未处理）.txt` });
    origSpaced = txt.spaced;
  } catch (e: any) {
    loadError.value = `加载失败: ${e.message ?? e}`;
  }
});
</script>

<style scoped>
.editor-shell { display: flex; flex-direction: column; height: calc(100vh - 40px); }
.toolbar { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; flex-wrap: wrap; }
.title-input { width: 200px; }
.spacer { flex: 1; }
.insert-dd { margin-left: auto; }
.editor-body { display: flex; gap: 16px; flex: 1; min-height: 0; }
.block-pane { width: 46%; overflow: auto; background: #fff; border-radius: 8px; padding: 12px; }
.block-list { display: flex; flex-direction: column; gap: 8px; }
.block-card { border: 1px solid #e4e7ed; border-radius: 8px; padding: 8px; background: #fafbfc; }
.card-message { background: #fff; }
.block-head { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
.drag-handle { cursor: grab; color: #a0a6ad; font-size: 16px; }
.block-type { font-size: 12px; color: #909399; flex: 1; }
.block-edit { display: flex; flex-direction: column; gap: 6px; }
.mb6 { margin-bottom: 6px; }
.msg-head { display: flex; gap: 6px; align-items: center; margin-bottom: 6px; }
.add-block { margin-top: 8px; width: 100%; }
.cover-tip { margin-bottom: 10px; }
.preview-pane { flex: 1; display: flex; flex-direction: column; border-radius: 8px; overflow: hidden; border: 1px solid #e4e7ed; background: #fff; }
.preview-title { padding: 8px 14px; font-size: 12px; color: #909399; border-bottom: 1px solid #f0f0f0; }
.preview-frame { flex: 1; border: none; width: 100%; }
</style>
