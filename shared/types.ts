
// ============ 共享类型定义（server 与 webui 共用） ============

/** 单条消息（log.txt 的基本单元） */
export interface LogMessage {
  /** 昵称 */
  nickname: string;
  /** QQ 号 */
  qq: string;
  /** 头行中日期+时间的原文（回写时原样保留，如 "2025/11/15 20:04:03" 或 "23:11:14"） */
  timeRaw: string;
  /** 内容行（不含头行；weizaima 格式下尾部带空行，保持回写格式稳定） */
  lines: string[];
  /** 是否场外发言（剥 CQ 前缀后以 ( 或 （ 开头） */
  outside: boolean;
}

/** 排版块类型（扩展点：新增类型在此登记，前后端各注册编辑/渲染组件） */
export type BlockType = 'cover' | 'heading' | 'message' | 'image';

/** 封面块字段（本期只做数据位，不做封面生成） */
export interface CoverBlock {
  type: 'cover';
  fields: {
    title?: string;
    subtitle?: string;
    image?: string;
    intro?: string;
    date?: string;
  };
}

export interface HeadingBlock {
  type: 'heading';
  text: string;
}

export interface MessageBlock {
  type: 'message';
  message: LogMessage;
}

export interface ImageBlock {
  type: 'image';
  /** 团目录内相对路径（assets/xxx.jpg）或完整外链 URL */
  src: string;
  caption?: string;
}

export type Block = CoverBlock | HeadingBlock | MessageBlock | ImageBlock;

/** 排版主题 */
export type ThemeId = 'painter' | 'document';

/** 排版状态 */
export type LayoutStatus = 'draft' | 'published';

/** 排版文档（团目录下 <团名>.layout.json） */
export interface LayoutDoc {
  schemaVersion: number;
  /** draft=排版中 / published=已排版（可进书） */
  status: LayoutStatus;
  title: string;
  theme: ThemeId;
  blocks: Block[];
}

/** 书籍章节：引用团的排版文档（单一数据源，不复制正文） */
export interface BookChapter {
  id: string;
  title: string;
  /** 团目录，相对 D:\跑团\log（如 log提取器/封冻恶疾0） */
  dir: string;
}

/** 书籍（D:\跑团\书\<书名>\book.json） */
export interface Book {
  schemaVersion: number;
  title: string;
  author: string;
  intro: string;
  /** 封面字段：预留内容位，本期阅读页有图显示图、无图显示文字版式 */
  cover: {
    image?: string;
    subtitle?: string;
  };
  chapters: BookChapter[];
  createdAt: string;
  updatedAt: string;
}
