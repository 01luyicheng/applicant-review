/**
 * Phase1.5 Worker 解析：卸载主线程 XLSX 解析，避免 5k+ 行阻塞 UI
 * 接收 { buffer: ArrayBuffer, fileName: string, config: ViewConfig }
 * 优先 exceljs（workbook.xlsx.load + worksheet.getRow 动态 import），xlsx 为 fallback
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

// Vite worker 类型：self 为 DedicatedWorkerGlobalScope
const ctx = self as unknown as DedicatedWorkerGlobalScope;

async function tryParseWithExcelJS(
  buffer: ArrayBuffer,
  fileName: string,
  config: ViewConfig
): Promise<{ applicants: Applicant[]; headers: string[] } | null> {
  if (fileName.toLowerCase().endsWith('.csv')) return null;
  try {
    const mod: unknown = await import('exceljs');
    const ExcelJS = (mod as { default?: unknown }).default ?? mod;
    const WorkbookCtor = (ExcelJS as { Workbook?: new () => { xlsx: { load: (b: ArrayBuffer) => Promise<void> }; worksheets: unknown[]; getWorksheet?: (i: number) => unknown } }).Workbook;
    if (!WorkbookCtor) return null;
    const wb = new WorkbookCtor() as unknown as {
      xlsx: { load: (b: ArrayBuffer) => Promise<void> };
      worksheets: unknown[];
      getWorksheet?: (i: number) => unknown;
      columnCount?: number;
      rowCount?: number;
    };
    await wb.xlsx.load(buffer);
    const wsRaw: unknown =
      (wb.worksheets && (wb.worksheets as unknown[])[0]) ??
      (typeof wb.getWorksheet === 'function' ? wb.getWorksheet(1) : null);
    if (!wsRaw) return { applicants: [], headers: [] };
    const ws = wsRaw as {
      getRow: (n: number) => { getCell: (c: number) => { value: unknown; text: string }; values?: unknown[]; cellCount: number };
      rowCount: number;
      columnCount: number;
    };
    const MAX_HEADER_LEN = 128;
    const PROTO_KEY_RE = /^(__proto__|constructor|prototype)$/;
    const headerRow = ws.getRow(1);
    const valuesLen = Array.isArray(headerRow.values) ? (headerRow.values as unknown[]).length - 1 : 0;
    const colCount = Math.max(ws.columnCount || 0, headerRow.cellCount || 0, valuesLen, 0);
    if (colCount === 0) return { applicants: [], headers: [] };
    const headers: string[] = [];
    for (let c = 1; c <= colCount; c++) {
      const cell = headerRow.getCell(c);
      const v = cell.value as unknown;
      let raw: string;
      if (v && typeof v === 'object' && (v as { formula?: unknown }).formula) {
        raw = '=' + String((v as { formula: unknown }).formula);
      } else if (cell.text !== '' && cell.text != null) {
        raw = String(cell.text);
      } else if (v != null) {
        if (typeof v === 'object') {
          const ov = v as { text?: unknown; richText?: { text: string }[] };
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
    if (dupHeaders.length > 0) throw new Error(`表头重复: ${dupHeaders.join(', ')}`);
    if (ws.rowCount < 2) return { applicants: [], headers };
    const sanitizeImportCell = (cell: string): string => {
      const s = String(cell);
      if (/^[=@]/.test(s)) return "'" + s;
      return s;
    };
    const applicants: Applicant[] = [];
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
          str = '=' + String((v as { formula: unknown }).formula);
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
      if (isEmptyRow) {
        const allEmpty = headers.every((h) => !PROTO_KEY_RE.test(h) && (raw[h] === '' || raw[h] === undefined));
        if (allEmpty) continue;
      }
      applicants.push({ id: String(raw[config.idField] || `${fileName}-${r - 2}-${Date.now()}`), raw });
    }
    return { applicants, headers };
  } catch (e) {
    // 若为表头重复等业务错误，应抛出让外层转为 error 响应，而不是静默回退；仅在 exceljs 未装/加载失败时回退
    if (e instanceof Error && /表头重复/.test(e.message)) throw e;
    return null;
  }
}

ctx.onmessage = async (e: MessageEvent<WorkerRequest>) => {
  const { buffer, fileName, config } = e.data;
  try {
    // 优先 exceljs（仅 xlsx）
    if (!fileName.toLowerCase().endsWith('.csv')) {
      try {
        const excelRes = await tryParseWithExcelJS(buffer, fileName, config);
        if (excelRes !== null) {
          const res: WorkerResponse = { type: 'success', applicants: excelRes.applicants, headers: excelRes.headers };
          ctx.postMessage(res);
          return;
        }
      } catch (err) {
        // 表头重复等业务异常直接抛给外层 error
        if (err instanceof Error && /表头重复/.test(err.message)) throw err;
        // 其他 exceljs 异常回退 xlsx
      }
    }

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

    // 仅对 = 和 @ 开头清洗，+ - | % 延后到 exportToCSV
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
