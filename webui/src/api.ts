
/** 后端 API 封装（fetch，中文 query 自动编码） */

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let msg = `${res.status}`;
    try {
      msg = (await res.json()).message ?? msg;
    } catch { /* 忽略解析失败 */ }
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
}

function withQuery(url: string, params?: Record<string, string | number | undefined>) {
  if (!params) return url;
  const qs = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join('&');
  return qs ? `${url}?${qs}` : url;
}

export const api = {
  get<T>(url: string, params?: Record<string, string | number | undefined>): Promise<T> {
    return fetch(withQuery(url, params)).then((r) => json<T>(r));
  },
  post<T>(url: string, body?: unknown, params?: Record<string, string | number | undefined>): Promise<T> {
    return fetch(withQuery(url, params), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body ?? {}),
    }).then((r) => json<T>(r));
  },
  put<T>(url: string, body: unknown, params?: Record<string, string | number | undefined>): Promise<T> {
    return fetch(withQuery(url, params), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then((r) => json<T>(r));
  },
  del<T>(url: string): Promise<T> {
    return fetch(url, { method: 'DELETE' }).then((r) => json<T>(r));
  },
  /** 上传文件 */
  async upload(url: string, form: FormData): Promise<{ ok: boolean; path?: string; error?: string }> {
    const res = await fetch(url, { method: 'POST', body: form });
    return json(res);
  },
  /** 下载导出文件（blob 触发保存） */
  async download(url: string, body: unknown, params: Record<string, string>) {
    const res = await fetch(withQuery(url, params), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body ?? {}),
    });
    if (!res.ok) throw new Error(`导出失败: ${res.status}`);
    const disposition = res.headers.get('Content-Disposition') ?? '';
    const match = /filename\*=UTF-8''([^;]+)/.exec(disposition);
    const filename = match ? decodeURIComponent(match[1]) : 'export.html';
    const blob = await res.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
    return filename;
  },
};
