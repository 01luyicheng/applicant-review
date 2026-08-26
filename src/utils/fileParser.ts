import type * as XLSXType from 'xlsx';
import type { Applicant, ViewConfig, StatusValue } from '../types';
import { getStatusLabel } from '../config';

// i18n: error.duplicateHeader / error.readFailed / error.workerFailed / error.workerInvalid
export const ERR_DUP_HEADER_PREFIX = '表头重复'; // i18n: error.duplicateHeader
export const ERR_READ_FAILED = '读取文件失败'; // i18n: error.readFailed
export const ERR_WORKER_FAILED = 'Worker 解析失败'; // i18n: error.workerFailed
export const ERR_WORKER_INVALID = 'Worker 返回异常'; // i18n: error.workerInvalid
function dupHeaderMessage(dupHeaders: string[]): string {
  return `${ERR_DUP_HEADER_PREFIX}: ${dupHeaders.join(', ')}`;
}

/** 内部：给定 buffer + fileName + config + XLSX 实例，解析 */
async function parseBufferInternal(
  buffer: ArrayBuffer,
  fileName: string,
  config: ViewConfig,
  XLSX: typeof XLSXType
): Promise<Applicant[]> {
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

  const tryArrayBuffer = async (): Promise<Applicant[]> => {
    try {
      if (typeof (file as unknown as { arrayBuffer?: () => Promise<ArrayBuffer> }).arrayBuffer === 'function') {
        const ab = await (file as unknown as { arrayBuffer: () => Promise<ArrayBuffer> }).arrayBuffer();
        const copy = ab.slice(0);
        const XLSX: typeof XLSXType = await import('xlsx');
        return await parseBufferInternal(copy, file.name, config, XLSX);
      }
      return await fallbackViaReader();
    } catch (err) {
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

        try {
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
        return typeof import.meta.url === 'string';
      } catch {
        return false;
      }
    })();

  if (canUseWorker) {
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

  const sanitizeCsvCell = (cell: string): string => {
    const s = String(cell);
    if (/^[=+\-@|%]/.test(s)) return "'" + s;
    return s;
  };
  return [headers, ...rows].map((r) => r.map((c) => `"${sanitizeCsvCell(String(c)).replace(/"/g, '""')}"`).join(',')).join('\n');
}
