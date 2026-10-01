
import { createRouter, createWebHistory } from 'vue-router';

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', redirect: '/extract' },
    { path: '/extract', component: () => import('./views/Extract.vue'), meta: { title: '提取' } },
    { path: '/library', component: () => import('./views/Library.vue'), meta: { title: 'log 库' } },
    { path: '/editor', component: () => import('./views/Editor.vue'), meta: { title: '编辑器' } },
    { path: '/books', component: () => import('./views/Books.vue'), meta: { title: '书架' } },
    { path: '/books/:id/manage', component: () => import('./views/BookManage.vue'), meta: { title: '书籍管理' } },
    { path: '/books/:id/read', component: () => import('./views/Reader.vue'), meta: { title: '阅读' } },
  ],
});
