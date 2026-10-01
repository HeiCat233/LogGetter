
<template>
  <div>
    <div class="head">
      <h2>📚 log 库</h2>
      <el-radio-group v-model="filter" size="small">
        <el-radio-button value="all">全部</el-radio-button>
        <el-radio-button value="none">待排版</el-radio-button>
        <el-radio-button value="draft">排版中</el-radio-button>
        <el-radio-button value="published">已排版</el-radio-button>
      </el-radio-group>
    </div>

    <el-card shadow="never">
      <el-empty v-if="dirNodes.length === 0" description="没有符合筛选的团" />
      <el-table :data="dirNodes" row-key="relPath" size="small">
        <el-table-column prop="name" label="团 / 目录" min-width="220" />
        <el-table-column label="排版状态" width="120">
          <template #default="{ row }">
            <el-tag v-if="row.layoutStatus" :type="statusTag(row.layoutStatus)" size="small">{{ statusText(row.layoutStatus) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="220">
          <template #default="{ row }">
            <template v-if="row.hasTxt && row.layoutStatus !== undefined">
              <el-button size="small" type="primary" plain @click="goEditor(row.relPath)">编辑排版</el-button>
              <el-button size="small" text @click="showFiles(row)">查看文件</el-button>
            </template>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-drawer v-model="drawer" :title="drawerDir" size="40%">
      <div v-for="(f, i) in drawerFiles" :key="i" class="file-row">📄 {{ f.name }}</div>
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { api } from '../api';

interface TreeNode { name: string; relPath: string; type: string; layoutStatus?: string; hasTxt?: boolean; children?: TreeNode[] }

const router = useRouter();
const root = ref<TreeNode | null>(null);
const filter = ref('all');
const drawer = ref(false);
const drawerDir = ref('');
const drawerFiles = ref<TreeNode[]>([]);

/** 收集库根下所有含 txt 的"团目录"（递归展开中间分类层） */
const dirNodes = computed(() => {
  const out: TreeNode[] = [];
  const walk = (node: TreeNode) => {
    for (const c of node.children ?? []) {
      if (c.type !== 'dir') continue;
      if (c.hasTxt) {
        if (filter.value === 'all' || (c.layoutStatus ?? 'none') === filter.value) out.push(c);
      } else {
        walk(c);
      }
    }
  };
  if (root.value) walk(root.value);
  return out;
});

function statusText(s: string) {
  return ({ none: '待排版', draft: '排版中', published: '已排版' } as Record<string, string>)[s] ?? s;
}
function statusTag(s: string) {
  return ({ none: 'info', draft: 'warning', published: 'success' } as Record<string, any>)[s] ?? 'info';
}

function goEditor(relPath: string) {
  router.push({ path: '/editor', query: { dir: relPath } });
}

function showFiles(row: TreeNode) {
  drawerDir.value = row.name;
  drawerFiles.value = (row.children ?? []).filter((c) => c.type === 'file');
  drawer.value = true;
}

onMounted(async () => {
  try {
    root.value = await api.get<TreeNode>('/api/log-tree');
  } catch (e: any) {
    ElMessage.error(String(e.message ?? e));
  }
});
</script>

<style scoped>
.head { display: flex; justify-content: space-between; align-items: center; }
.head h2 { margin: 0 0 12px; }
.file-row { padding: 6px 0; border-bottom: 1px dashed #eee; font-size: 13px; }
</style>
