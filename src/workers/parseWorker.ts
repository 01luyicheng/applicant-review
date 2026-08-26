/**
 * Phase1.5 Worker 解析：卸载主线程 XLSX 解析，避免 5k+ 行阻塞 UI
 * 接收 { buffer: ArrayBuffer, fileName: string, config: ViewConfig }
 * 返回 { type:'success', applicants, headers } 或 { type:'error', error }
 */
/// <reference lib="webworker" />
import type { Applicant, ViewConfig } from '../types';
import type * as XLSXType from 'xlsx';

type WorkerRequest = {
  buffer: ArrayBuffer;
  fileName: string;
  config: ViewConfig;
};

type WorkerSuccess = {
  type: 'success';
  applicants: Applicant[];
  headers: string[];
};

type WorkerError = {
  type: 'error';
  error: string;
};

type WorkerResponse = WorkerSuccess | WorkerError;

const ctx = self as unknown as DedicatedWorkerGlobalScope;

ctx.onmessage = async (e: MessageEvent<WorkerRequest>) => {
  const { buffer, fileName, config } = e.data;
  try {
    const XLSX: typeof XLSXType = await import('xlsx');
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
      const res: WorkerResponse = { type: 'success', applicants: [], headers: [] };
      ctx.postMessage(res);
      return;
    }
    const worksheet = workbook.Sheets[sheetName];
    const json = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '', raw: false });

    if (json.length < 2) {
      const res: WorkerResponse = { type: 'success', applicants: [], headers: [] };
      ctx.postMessage(res);
      return;
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
      throw new Error(`表头重复: ${dupHeaders.join(', ')}`);
    }
    const rows = json.slice(1) as unknown[][];

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

    const res: WorkerResponse = { type: 'success', applicants, headers };
    ctx.postMessage(res);
  } catch (err) {
    const res: WorkerResponse = { type: 'error', error: (err as Error).message || String(err) };
    ctx.postMessage(res);
  }
};

export {};
