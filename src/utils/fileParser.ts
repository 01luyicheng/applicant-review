import type * as XLSXType from 'xlsx';
import type { Applicant, ViewConfig, StatusValue } from '../types';
import { getStatusLabel } from '../config';

// i18n: error.duplicateHeader / error.readFailed / error.workerFailed / error.workerInvalid
// 提取为常量以便 i18n 键对照，throw 处保留中文但标注 i18n 键；运行时可替换为 t('error.duplicateHeader')
export const ERR_DUP_HEADER_PREFIX = '表头重复'; // i18n: error.duplicateHeader
export const ERR_READ_FAILED = '读取文件失败'; // i18n: error.readFailed
export const ERR_WORKER_FAILED = 'Worker 解析失败'; // i18n: error.workerFailed
export const ERR_WORKER_INVALID = 'Worker 返回异常'; // i18n: error.workerInvalid
function dupHeaderMessage(dupHeaders: string[]): string {
  // i18n: error.duplicateHeader -> zh.json/en.json error.duplicateHeader {headers}
  return `${ERR_DUP_HEADER_PREFIX}: ${dupHeaders.join(', ')}`;
}

/** 尝试用 exceljs 解析 xlsx（动态 import，不进主包）；失败返回 null 触发 xlsx 回退 */
async function tryParseWithExcelJS(
  buffer: ArrayBuffer,
  fileName: string,
  config: ViewConfig
): Promise<Applicant[] | null> {
  if (fileName.toLowerCase().endsWith('.csv')) return null;
  try {
    const mod: unknown = await import('exceljs');
    const ExcelJS = (mod as { default?: unknown }).default ?? mod;
    const WorkbookCtor = (ExcelJS as { Workbook?: new () => { xlsx: { load: (b: ArrayBuffer) => Promise<void> }; worksheets: unknown[]; getWorksheet?: (i: number) => unknown } }).Workbook;
    if (!WorkbookCtor) return null;
    const wb: {
      xlsx: { load: (b: ArrayBuffer | Uint8Array) => Promise<void> };
      worksheets: unknown[];
      getWorksheet?: (i: number) => unknown;
      columnCount?: number;
      rowCount?: number;
    } = new WorkbookCtor() as unknown as typeof wb;
    // workbook.xlsx.load 支持 ArrayBuffer / Uint8Array；传 ArrayBuffer 即可
    await wb.xlsx.load(buffer);
    const wsRaw: unknown =
      (wb.worksheets && (wb.worksheets as unknown[])[0]) ??
      (typeof wb.getWorksheet === 'function' ? wb.getWorksheet(1) : null);
    if (!wsRaw) return [];
    const ws = wsRaw as {
      getRow: (n: number) => {
        getCell: (c: number) => { value: unknown; text: string };
        values?: unknown[];
        cellCount: number;
      };
      getCell: (addr: string) => { value: unknown };
      rowCount: number;
      columnCount: number;
      actualRowCount?: number;
    };

    const MAX_HEADER_LEN = 128;
    const PROTO_KEY_RE = /^(__proto__|constructor|prototype)$/;

    const headerRow = ws.getRow(1);
    // 列数以 columnCount / headerRow.cellCount / headerRow.values 长度取最大，兼容稀疏表头
    const valuesLen = Array.isArray(headerRow.values) ? (headerRow.values as unknown[]).length - 1 : 0;
    const colCount = Math.max(ws.columnCount || 0, headerRow.cellCount || 0, valuesLen, 0);
    if (colCount === 0) return [];

    const headers: string[] = [];
    for (let c = 1; c <= colCount; c++) {
      const cell = headerRow.getCell(c);
      let raw: string;
      const v = cell.value as unknown;
      if (v && typeof v === 'object' && (v as { formula?: unknown }).formula) {
        raw = '=' + String((v as { formula: unknown }).formula);
      } else if (cell.text !== '' && cell.text != null) {
        raw = String(cell.text);
      } else if (v != null) {
        // hyperlink { text, hyperlink } 或 richText
        if (typeof v === 'object') {
          const ov = v as { text?: unknown; hyperlink?: unknown; richText?: { text: string }[] };
          if (ov.richText) raw = ov.richText.map((t) => t.text).join('');
          else if (ov.text) raw = String(ov.text);
          else raw = String(cell.text ?? '');
        } else {
          raw = String(v);
        }
      } else {
        raw = '';
      }
      headers.push(raw.trim().slice(0, MAX_HEADER_LEN));
    }

    const seen = new Set<string>();
    const dupHeaders = headers.filter((h) => {
      if (seen.has(h)) return true;
      seen.add(h);
      return false;
    });
    if (dupHeaders.length > 0) {
      throw new Error(dupHeaderMessage(dupHeaders)); // i18n: error.duplicateHeader
    }

    if (ws.rowCount < 2) return [];

    const sanitizeImportCell = (cell: string): string => {
      const s = String(cell);
      if (/^[=@]/.test(s)) return "'" + s;
      return s;
    };

    const applicants: Applicant[] = [];
    // 使用 getRow + getCell 逐行读取，复刻 xlsx 的 defval:'' 语义
    for (let r = 2; r <= ws.rowCount; r++) {
      const row = ws.getRow(r);
      const raw: Record<string, string> = Object.create(null);
      let isEmptyRow = true;
      for (let c = 1; c <= headers.length; c++) {
        const h = headers[c - 1];
        if (PROTO_KEY_RE.test(h)) continue;
        const cell = row.getCell(c);
        const v = cell.value as unknown;
        let str: string;
        if (v && typeof v === 'object' && (v as { formula?: unknown }).formula) {
          const fv = v as { formula: unknown; result?: unknown };
          // exceljs 公式对象：优先用 formula 还原导入注入语义（与 xlsx 的 f 字段一致）
          str = '=' + String(fv.formula);
          // 若 result 为空则保留 formula
        } else if (v && typeof v === 'object' && (v as { richText?: unknown }).richText) {
          str = (v as { richText: { text: string }[] }).richText.map((t) => t.text).join('');
        } else if (v && typeof v === 'object' && (v as { text?: unknown }).text && (v as { hyperlink?: unknown }).hyperlink) {
          str = String((v as { text: unknown }).text);
        } else if (cell.text !== '' && cell.text != null) {
          str = String(cell.text);
        } else if (v != null) {
          str = String(v);
        } else {
          str = '';
        }
        str = str.trim();
        if (str !== '') isEmptyRow = false;
        raw[h] = sanitizeImportCell(str);
      }
      // 完全空行跳过，保持与 xlsx sheet_to_json 行为一致（sheet_to_json 默认跳过空行；我们显式过滤全空行避免污染）
      // 但保留至少 headers 映射；若全空则不计入 applicants
      if (isEmptyRow) {
        // 检查是否整行在 exceljs 中为 undefinedRow；仍跳过
        const allEmpty = headers.every((h) => !PROTO_KEY_RE.test(h) && (raw[h] === '' || raw[h] === undefined));
        if (allEmpty) continue;
      }
      applicants.push({
        id: String(raw[config.idField] || `${fileName}-${r - 2}-${Date.now()}`),
        raw,
      });
    }

    return applicants;
  } catch {
    return null;
  }
}

/** 内部：给定 buffer + fileName + config + XLSX 实例，复用主线程解析逻辑（与 Worker 保持一致） */
async function parseBufferInternal(
  buffer: ArrayBuffer,
  fileName: string,
  config: ViewConfig,
  XLSX: typeof XLSXType
): Promise<Applicant[]> {
  // 优先 exceljs（仅 xlsx）；成功则直接返回，失败回退 xlsx
  if (!fileName.toLowerCase().endsWith('.csv')) {
    const excelRes = await tryParseWithExcelJS(buffer, fileName, config);
    if (excelRes !== null) return excelRes;
  }

  const data = new Uint8Array(buffer);
  let workbook: XLSXType.WorkBook;

  if (fileName.toLowerCase().endsWith('.csv')) {
    const text = new TextDecoder('utf-8').decode(data);
    workbook = XLSX.read(text, { type: 'string', FS: ',' });
  } else {
    workbook = XLSX.read(data, { type: 'array' });
  }

  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    return [];
  }
  const worksheet = workbook.Sheets[sheetName];
  const json = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '', raw: false });

  if (json.length < 2) {
    return [];
  }

  const MAX_HEADER_LEN = 128;
  const headers = (json[0] as unknown[]).map((h) => String(h).trim().slice(0, MAX_HEADER_LEN));
  const PROTO_KEY_RE = /^(__proto__|constructor|prototype)$/;
  const seen = new Set<string>();
  const dupHeaders = headers.filter((h) => {
    if (seen.has(h)) return true;
    seen.add(h);
    return false;
  });
  if (dupHeaders.length > 0) {
    throw new Error(dupHeaderMessage(dupHeaders)); // i18n: error.duplicateHeader
  }
  const rows = json.slice(1) as unknown[][];

  // 仅对 = 和 @ 开头清洗，避免 +86 / -2 等正常数据被误加 ' 破坏数据；+ - | % 保留到 exportToCSV 阶段清洗
  const sanitizeImportCell = (cell: string): string => {
    const s = String(cell);
    if (/^[=@]/.test(s)) return "'" + s;
    return s;
  };

  const applicants: Applicant[] = rows.map((row, index) => {
    const raw: Record<string, string> = Object.create(null);
    headers.forEach((h, i) => {
      if (PROTO_KEY_RE.test(h)) return;
      let val: unknown = row[i];
      if ((val === '' || val == null) && worksheet) {
        const addr = XLSX.utils.encode_cell({ r: index + 1, c: i });
        const cell = (worksheet as Record<string, unknown>)[addr] as Record<string, unknown> | undefined;
        if (cell && typeof (cell as Record<string, unknown>).f === 'string') {
          const f = (cell as Record<string, unknown>).f as string;
          val = f.startsWith('=') ? f : '=' + f;
        } else if (cell && typeof (cell as Record<string, unknown>).w === 'string' && (cell as Record<string, unknown>).w !== '') {
          val = (cell as Record<string, unknown>).w as string;
        }
      }
      const str = val != null ? String(val).trim() : '';
      raw[h] = sanitizeImportCell(str);
    });
    return {
      id: String(raw[config.idField] || `${fileName}-${index}-${Date.now()}`),
      raw,
    };
  });

  return applicants;
}

/** 主线程回退：优先用 file.arrayBuffer()，兜底 FileReader（兼容 jsdom/旧浏览器） */
function parseOnMainThread(file: File, config: ViewConfig): Promise<Applicant[]> {
  const fallbackViaReader = (): Promise<Applicant[]> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const XLSX: typeof XLSXType = await import('xlsx');
          const buf = e.target?.result as ArrayBuffer;
          const res = await parseBufferInternal(buf, file.name, config, XLSX);
          resolve(res);
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = () => reject(new Error(ERR_READ_FAILED)); // i18n: error.readFailed
      reader.readAsArrayBuffer(file);
    });

  // 优先尝试 file.arrayBuffer()（现代浏览器 + Node 18+），失败则回退 FileReader
  const tryArrayBuffer = async (): Promise<Applicant[]> => {
    try {
      if (typeof (file as unknown as { arrayBuffer?: () => Promise<ArrayBuffer> }).arrayBuffer === 'function') {
        const ab = await (file as unknown as { arrayBuffer: () => Promise<ArrayBuffer> }).arrayBuffer();
        // arrayBuffer 可能返回共享内存，slice 保证可转移
        const copy = ab.slice(0);
        const XLSX: typeof XLSXType = await import('xlsx');
        return await parseBufferInternal(copy, file.name, config, XLSX);
      }
      return await fallbackViaReader();
    } catch (err) {
      // arrayBuffer 失败兜底 FileReader
      try {
        return await fallbackViaReader();
      } catch (e2) {
        throw err || e2;
      }
    }
  };

  return tryArrayBuffer();
}

/** Worker 路径：10s 超时回退主线程 */
function parseWithWorker(file: File, config: ViewConfig): Promise<Applicant[]> {
  return new Promise((resolve, reject) => {
    let settled = false;
    let worker: Worker | null = null;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const cleanup = () => {
      if (timeoutId) clearTimeout(timeoutId);
      if (worker) {
        try {
          worker.terminate();
        } catch {}
        worker = null;
      }
    };

    const fallback = () => {
      if (settled) return;
      settled = true;
      cleanup();
      parseOnMainThread(file, config).then(resolve).catch(reject);
    };

    timeoutId = setTimeout(() => {
      fallback();
    }, 10000);

    // 读取 buffer 后再创建 Worker（避免空转 10s）
    const getBuffer: Promise<ArrayBuffer> =
      typeof (file as unknown as { arrayBuffer?: () => Promise<ArrayBuffer> }).arrayBuffer === 'function'
        ? (file as unknown as { arrayBuffer: () => Promise<ArrayBuffer> }).arrayBuffer()
        : new Promise<ArrayBuffer>((res, rej) => {
            const r = new FileReader();
            r.onload = () => res(r.result as ArrayBuffer);
            r.onerror = () => rej(new Error(ERR_READ_FAILED)); // i18n: error.readFailed
            r.readAsArrayBuffer(file);
          });

    getBuffer
      .then((buffer) => {
        if (settled) return;
        try {
          worker = new Worker(new URL('../workers/parseWorker.ts', import.meta.url), { type: 'module' });
        } catch {
          fallback();
          return;
        }

        const onMessage = (ev: MessageEvent) => {
          if (settled) return;
          settled = true;
          cleanup();
          const data = ev.data as { type?: string; applicants?: Applicant[]; error?: string };
          if (data?.type === 'success' && Array.isArray(data.applicants)) {
            resolve(data.applicants);
          } else if (data?.type === 'error') {
            reject(new Error(data.error || ERR_WORKER_FAILED)); // i18n: error.workerFailed
          } else {
            reject(new Error(ERR_WORKER_INVALID)); // i18n: error.workerInvalid
          }
        };

        const onError = () => {
          fallback();
        };

        worker.addEventListener('message', onMessage);
        worker.addEventListener('error', onError);

        // 尝试 transfer buffer 提升性能；失败则普通 postMessage
        try {
          // slice 一份用于 transfer，避免原 buffer 被 detach 后 fallback 不可用（但 fallback 已在 worker 失败后重新读取 file，所以可直接 transfer）
          const transferBuf = buffer.slice(0);
          worker.postMessage({ buffer: transferBuf, fileName: file.name, config } as unknown as object, [transferBuf] as unknown as Transferable[]);
        } catch {
          try {
            worker.postMessage({ buffer, fileName: file.name, config } as unknown as object);
          } catch (e) {
            fallback();
          }
        }
      })
      .catch(() => {
        fallback();
      });
  });
}

export function parseFile(file: File, config: ViewConfig): Promise<Applicant[]> {
  const canUseWorker =
    typeof Worker !== 'undefined' &&
    typeof URL !== 'undefined' &&
    (() => {
      try {
        // jsdom 环境 Worker 为 undefined 或构造抛错
        return typeof import.meta.url === 'string';
      } catch {
        return false;
      }
    })();

  if (canUseWorker) {
    // 优先尝试 Worker，内部 10s 超时自动回退主线程；捕获同步异常也回退
    try {
      return parseWithWorker(file, config).catch(() => parseOnMainThread(file, config));
    } catch {
      return parseOnMainThread(file, config);
    }
  }
  return parseOnMainThread(file, config);
}

export function getUniqueValues(applicants: Applicant[], key: string): string[] {
  const values = new Set<string>();
  applicants.forEach((a) => {
    const v = a.raw[key];
    if (v) values.add(v);
  });
  return Array.from(values).sort();
}

export function calculateStats(applicants: Applicant[], statusField: string, statusValues: StatusValue[]) {
  const total = applicants.length;
  const counts: Record<string, number> = {};
  statusValues.forEach((sv) => {
    counts[sv.value] = 0;
  });
  for (const a of applicants) {
    const v = a.raw[statusField] || '';
    if (v in counts) counts[v]++;
    else if (statusValues.some((sv) => sv.value === v)) counts[v] = 1;
  }
  const pending = counts[''] ?? 0;
  return { total, counts, pending };
}

export function exportToCSV(applicants: Applicant[], config: ViewConfig): string {
  if (applicants.length === 0) return '';

  const rawKeys = Object.keys(applicants[0].raw);
  let exportKeys: string[];
  let exportLabels: string[];

  if (rawKeys.length > 0) {
    exportKeys = rawKeys;
    const labelMap = new Map<string, string>();
    config.listFields.forEach((f) => labelMap.set(f.key, f.label));
    config.detailGroups.forEach((g) =>
      g.fields.forEach((f) => {
        if (!labelMap.has(f.key)) labelMap.set(f.key, f.label);
      })
    );
    exportLabels = exportKeys.map((k) => {
      if (k === config.statusField) {
        return labelMap.get(k) || '审核状态';
      }
      return labelMap.get(k) || k;
    });
  } else {
    const seen = new Set<string>();
    const fields: { key: string; label: string }[] = [];
    const allFields = [...config.listFields, ...config.detailGroups.flatMap((g) => g.fields)];
    allFields.forEach((f) => {
      if (!seen.has(f.key)) {
        seen.add(f.key);
        fields.push(f);
      }
    });
    if (!seen.has(config.statusField)) {
      fields.push({ key: config.statusField, label: '审核状态' });
    }
    exportKeys = fields.map((f) => f.key);
    exportLabels = fields.map((f) => f.label);
  }

  const headers = ['序号', ...exportLabels];
  const rows = applicants.map((a, i) => [
    String(i + 1),
    ...exportKeys.map((k) => (k === config.statusField ? getStatusLabel(a.raw[k] || '', config) : a.raw[k] || '')),
  ]);

  // M1: CSV 注入防护：对以 = + - @ | % 开头的单元格加前缀 '
  const sanitizeCsvCell = (cell: string): string => {
    const s = String(cell);
    if (/^[=+\-@|%]/.test(s)) return "'" + s;
    return s;
  };
  return [headers, ...rows].map((r) => r.map((c) => `"${sanitizeCsvCell(String(c)).replace(/"/g, '""')}"`).join(',')).join('\n');
}
