import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import FileUploader from './FileUploader';
import i18n from '../i18n';

async function ensureZh() {
  try {
    localStorage.setItem('app-locale', 'zh');
    await i18n.changeLanguage('zh');
  } catch {}
}

function makeFile(name: string, size: number, type = 'text/csv'): File {
  const buf = new Uint8Array(size > 0 ? Math.min(size, 10) : 10);
  const file = new File([buf], name, { type });
  // override size for >10 bytes without allocating huge buffer
  if (size !== file.size) {
    Object.defineProperty(file, 'size', { value: size });
  }
  return file;
}

function getDropZone() {
  // the outer div with border-2
  return document.querySelector('.border-2') as HTMLElement;
}

describe('FileUploader', () => {
  beforeEach(async () => {
    await ensureZh();
    vi.restoreAllMocks();
  });

  it('渲染基础结构', () => {
    const onLoad = vi.fn();
    render(<FileUploader onLoad={onLoad} loading={false} />);
    expect(screen.getByText(/拖拽或点击上传/)).toBeInTheDocument();
    expect(screen.getByText(/支持飞书多维表格/)).toBeInTheDocument();
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(input).toBeInTheDocument();
    expect(input.accept).toContain('.xlsx');
  });

  it('loading 状态禁用 input 并显示解析中', () => {
    const onLoad = vi.fn();
    render(<FileUploader onLoad={onLoad} loading={true} />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(input.disabled).toBe(true);
    expect(screen.getByText(/解析中/)).toBeInTheDocument();
  });

  it('拖拽进入 isDragging 切换样式 + dragLeave 重置', () => {
    const onLoad = vi.fn();
    render(<FileUploader onLoad={onLoad} loading={false} />);
    const zone = getDropZone();
    expect(zone.className).toContain('border-gray-300');
    // dragOver with valid type
    const validFile = makeFile('a.xlsx', 100);
    fireEvent.dragOver(zone, { dataTransfer: { files: [validFile] } } as unknown as DragEvent);
    expect(zone.className).toContain('border-blue-400');
    expect(zone.className).toContain('bg-blue-50');
    // dragOver with invalid type sets dragInvalid
    const invalidFile = makeFile('b.txt', 100);
    fireEvent.dragOver(zone, { dataTransfer: { files: [invalidFile] } } as unknown as DragEvent);
    expect(zone.className).toContain('border-red-400');
    expect(screen.getByText(/仅支持/)).toBeInTheDocument();
    // dragLeave resets
    fireEvent.dragLeave(zone);
    expect(zone.className).toContain('border-gray-300');
    expect(zone.className).not.toContain('border-red-400');
    expect(screen.queryByText(/仅支持.*格式/)).not.toBeInTheDocument();
  });

  it('dragOver 空 files 时无 dragInvalid', () => {
    const onLoad = vi.fn();
    render(<FileUploader onLoad={onLoad} loading={false} />);
    const zone = getDropZone();
    fireEvent.dragOver(zone, { dataTransfer: { files: [] as unknown as FileList } } as unknown as DragEvent);
    expect(zone.className).toContain('border-blue-400');
    expect(zone.className).not.toContain('border-red-400');
  });

  it('drop 合法文件调用 onLoad', () => {
    const onLoad = vi.fn();
    render(<FileUploader onLoad={onLoad} loading={false} />);
    const zone = getDropZone();
    const file = makeFile('data.xlsx', 1024);
    fireEvent.dragOver(zone, { dataTransfer: { files: [file] } } as any);
    fireEvent.drop(zone, { dataTransfer: { files: [file] } } as any);
    expect(onLoad).toHaveBeenCalledWith(file);
    expect(zone.className).toContain('border-gray-300');
  });

  it('drop 非法类型显示错误不调用 onLoad', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const onLoad = vi.fn();
    render(<FileUploader onLoad={onLoad} loading={false} />);
    const zone = getDropZone();
    const file = makeFile('evil.txt', 1024);
    fireEvent.drop(zone, { dataTransfer: { files: [file] } } as any);
    expect(onLoad).not.toHaveBeenCalled();
    expect(screen.getByText(/不支持的文件类型/)).toBeInTheDocument();
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('drop 超过 10MB 校验失败', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const onLoad = vi.fn();
    render(<FileUploader onLoad={onLoad} loading={false} />);
    const zone = getDropZone();
    const big = makeFile('big.xlsx', 11 * 1024 * 1024);
    fireEvent.drop(zone, { dataTransfer: { files: [big] } } as any);
    expect(onLoad).not.toHaveBeenCalled();
    expect(screen.getByText(/文件过大/)).toBeInTheDocument();
    warnSpy.mockRestore();
  });

  it('drop 边界 10MB 刚好通过', () => {
    const onLoad = vi.fn();
    render(<FileUploader onLoad={onLoad} loading={false} />);
    const zone = getDropZone();
    const exact = makeFile('ok.xlsx', 10 * 1024 * 1024);
    fireEvent.drop(zone, { dataTransfer: { files: [exact] } } as any);
    expect(onLoad).toHaveBeenCalled();
  });

  it('drop 无文件时不调用', () => {
    const onLoad = vi.fn();
    render(<FileUploader onLoad={onLoad} loading={false} />);
    const zone = getDropZone();
    fireEvent.drop(zone, { dataTransfer: { files: [] as unknown as FileList } } as any);
    expect(onLoad).not.toHaveBeenCalled();
  });

  it('input change 合法/非法 + 大小写后缀', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const onLoad = vi.fn();
    render(<FileUploader onLoad={onLoad} loading={false} />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    // valid with uppercase extension
    const fileUpper = makeFile('DATA.XLSX', 100);
    fireEvent.change(input, { target: { files: [fileUpper] } });
    expect(onLoad).toHaveBeenCalledWith(fileUpper);
    expect(input.value).toBe('');
    onLoad.mockClear();
    // invalid type
    const bad = makeFile('bad.pdf', 100);
    fireEvent.change(input, { target: { files: [bad] } });
    expect(onLoad).not.toHaveBeenCalled();
    expect(screen.getByText(/不支持的文件类型/)).toBeInTheDocument();
    expect(warnSpy).toHaveBeenCalled();
    // file too large via input
    const big = makeFile('big.csv', 11 * 1024 * 1024);
    fireEvent.change(input, { target: { files: [big] } });
    expect(screen.getByText(/文件过大/)).toBeInTheDocument();
    // empty files
    fireEvent.change(input, { target: { files: [] } });
    // no throw
    expect(onLoad).not.toHaveBeenCalledTimes(2);
    warnSpy.mockRestore();
  });

  it('custom acceptedTypes 生效', () => {
    const onLoad = vi.fn();
    render(<FileUploader onLoad={onLoad} loading={false} acceptedTypes={['.csv']} />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(input.accept).toBe('.csv');
    const xlsx = makeFile('a.xlsx', 100);
    const zone = getDropZone();
    fireEvent.drop(zone, { dataTransfer: { files: [xlsx] } } as any);
    expect(onLoad).not.toHaveBeenCalled();
    const csv = makeFile('b.csv', 100);
    fireEvent.drop(zone, { dataTransfer: { files: [csv] } } as any);
    expect(onLoad).toHaveBeenCalledWith(csv);
  });

  it('成功后清除 localError', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const onLoad = vi.fn();
    render(<FileUploader onLoad={onLoad} loading={false} />);
    const zone = getDropZone();
    const bad = makeFile('bad.txt', 100);
    fireEvent.drop(zone, { dataTransfer: { files: [bad] } } as any);
    expect(screen.getByText(/不支持的文件类型/)).toBeInTheDocument();
    const good = makeFile('good.csv', 100);
    fireEvent.drop(zone, { dataTransfer: { files: [good] } } as any);
    expect(screen.queryByText(/不支持的文件类型/)).not.toBeInTheDocument();
    warnSpy.mockRestore();
  });
});
