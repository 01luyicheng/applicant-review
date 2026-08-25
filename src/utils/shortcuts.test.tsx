import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { useKeyboardShortcuts } from './shortcuts';
import type { ViewConfig } from '../types';

function makeConfig(): ViewConfig {
  return {
    title: 't',
    idField: '编号',
    nameField: '姓名',
    listFields: [{ key: '姓名', label: '姓名' }],
    detailGroups: [],
    statusField: '状态',
    statusValues: [
      { value: '', label: '待审核', color: 'gray' },
      { value: '通过', label: '通过', color: 'green' },
      { value: '拒绝', label: '拒绝', color: 'red' },
      { value: '待定', label: '待定', color: 'yellow' },
    ],
  };
}

const applicants = [
  { id: '1', raw: { '姓名': '张三' } },
  { id: '2', raw: { '姓名': '李四' } },
  { id: '3', raw: { '姓名': '王五' } },
];

function idxMap(list: typeof applicants) {
  const m = new Map<string, number>();
  list.forEach((a, i) => m.set(a.id, i));
  return m;
}

type HarnessProps = {
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onStatusChange: (id: string, status: string) => void;
  onOpenDetail: (a: typeof applicants[number]) => void;
  filtered?: typeof applicants;
  config?: ViewConfig;
};

function Harness({ selectedId, onSelect, onStatusChange, onOpenDetail, filtered = applicants, config = makeConfig() }: HarnessProps) {
  useKeyboardShortcuts(filtered, idxMap(filtered), selectedId, onSelect, onStatusChange, config, onOpenDetail);
  return <div>harness</div>;
}

describe('useKeyboardShortcuts', () => {
  let onSelect: ReturnType<typeof vi.fn>;
  let onStatusChange: ReturnType<typeof vi.fn>;
  let onOpenDetail: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onSelect = vi.fn();
    onStatusChange = vi.fn();
    onOpenDetail = vi.fn();
  });
  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  it('空列表不响应', () => {
    render(<Harness selectedId={null} onSelect={onSelect} onStatusChange={onStatusChange} onOpenDetail={onOpenDetail} filtered={[]} />);
    fireEvent.keyDown(window, { key: 'ArrowDown' });
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('ArrowDown 从无选中到首项，递增并 clamp 末尾', () => {
    const { rerender } = render(<Harness selectedId={null} onSelect={onSelect} onStatusChange={onStatusChange} onOpenDetail={onOpenDetail} />);
    fireEvent.keyDown(window, { key: 'ArrowDown' });
    expect(onSelect).toHaveBeenCalledWith('1');
    // simulate parent update to 1
    rerender(<Harness selectedId={'1'} onSelect={onSelect} onStatusChange={onStatusChange} onOpenDetail={onOpenDetail} />);
    onSelect.mockClear();
    fireEvent.keyDown(window, { key: 'ArrowDown' });
    expect(onSelect).toHaveBeenCalledWith('2');
    rerender(<Harness selectedId={'2'} onSelect={onSelect} onStatusChange={onStatusChange} onOpenDetail={onOpenDetail} />);
    onSelect.mockClear();
    fireEvent.keyDown(window, { key: 'ArrowDown' });
    expect(onSelect).toHaveBeenCalledWith('3');
    // clamp at end
    rerender(<Harness selectedId={'3'} onSelect={onSelect} onStatusChange={onStatusChange} onOpenDetail={onOpenDetail} />);
    onSelect.mockClear();
    fireEvent.keyDown(window, { key: 'ArrowDown' });
    expect(onSelect).toHaveBeenCalledWith('3');
  });

  it('ArrowUp 递减与环绕末尾', () => {
    const { rerender } = render(<Harness selectedId={'1'} onSelect={onSelect} onStatusChange={onStatusChange} onOpenDetail={onOpenDetail} />);
    fireEvent.keyDown(window, { key: 'ArrowUp' });
    expect(onSelect).toHaveBeenCalledWith('3'); // wrap to last
    rerender(<Harness selectedId={'2'} onSelect={onSelect} onStatusChange={onStatusChange} onOpenDetail={onOpenDetail} />);
    onSelect.mockClear();
    fireEvent.keyDown(window, { key: 'ArrowUp' });
    expect(onSelect).toHaveBeenCalledWith('1');
    // null wraps to last via length-1
    rerender(<Harness selectedId={null} onSelect={onSelect} onStatusChange={onStatusChange} onOpenDetail={onOpenDetail} />);
    onSelect.mockClear();
    fireEvent.keyDown(window, { key: 'ArrowUp' });
    expect(onSelect).toHaveBeenCalledWith('3');
  });

  it('Enter 打开详情，仅当 selectedId 存在且在 map 中', () => {
    const { rerender } = render(<Harness selectedId={null} onSelect={onSelect} onStatusChange={onStatusChange} onOpenDetail={onOpenDetail} />);
    fireEvent.keyDown(window, { key: 'Enter' });
    expect(onOpenDetail).not.toHaveBeenCalled();
    rerender(<Harness selectedId={'2'} onSelect={onSelect} onStatusChange={onStatusChange} onOpenDetail={onOpenDetail} />);
    fireEvent.keyDown(window, { key: 'Enter' });
    expect(onOpenDetail).toHaveBeenCalledWith(applicants[1]);
    onOpenDetail.mockClear();
    // id not in map
    rerender(<Harness selectedId={'999'} onSelect={onSelect} onStatusChange={onStatusChange} onOpenDetail={onOpenDetail} />);
    fireEvent.keyDown(window, { key: 'Enter' });
    expect(onOpenDetail).not.toHaveBeenCalled();
  });

  it('Escape 清空选中', () => {
    render(<Harness selectedId={'1'} onSelect={onSelect} onStatusChange={onStatusChange} onOpenDetail={onOpenDetail} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onSelect).toHaveBeenCalledWith(null);
  });

  it('数字 1-3 切换状态，尊重 statusValues 长度与 selectedId', () => {
    const config = makeConfig();
    // statusValues filtered non-empty => ['通过','拒绝','待定'] length 3, 4超出不应触发
    render(<Harness selectedId={'1'} onSelect={onSelect} onStatusChange={onStatusChange} onOpenDetail={onOpenDetail} config={config} />);
    fireEvent.keyDown(window, { key: '1' });
    expect(onStatusChange).toHaveBeenCalledWith('1', '通过');
    fireEvent.keyDown(window, { key: '2' });
    expect(onStatusChange).toHaveBeenCalledWith('1', '拒绝');
    fireEvent.keyDown(window, { key: '3' });
    expect(onStatusChange).toHaveBeenCalledWith('1', '待定');
    const callsBefore4 = onStatusChange.mock.calls.length;
    fireEvent.keyDown(window, { key: '4' });
    // 4 超出 3 长度，不应新增调用
    expect(onStatusChange.mock.calls.length).toBe(callsBefore4);
    onStatusChange.mockClear();
    // without selectedId, no status change — 需独立挂载避免多监听叠加
    const ns = vi.fn();
    const ns2 = vi.fn();
    const { unmount } = render(<Harness selectedId={null} onSelect={ns} onStatusChange={ns2} onOpenDetail={onOpenDetail} />);
    fireEvent.keyDown(window, { key: '1' });
    expect(ns2).not.toHaveBeenCalled();
    unmount();
  });

  it('数字超出 statusValues 长度不触发', () => {
    const smallConfig: ViewConfig = { ...makeConfig(), statusValues: [{ value: '', label: '待审核' }, { value: '通过', label: '通过' }] };
    // filtered => only '通过' length 1, so only 1 is valid
    render(<Harness selectedId={'1'} onSelect={onSelect} onStatusChange={onStatusChange} onOpenDetail={onOpenDetail} config={smallConfig} />);
    fireEvent.keyDown(window, { key: '1' });
    expect(onStatusChange).toHaveBeenCalledWith('1', '通过');
    onStatusChange.mockClear();
    fireEvent.keyDown(window, { key: '2' });
    expect(onStatusChange).not.toHaveBeenCalled();
  });

  it('Ctrl+F / Meta+F 聚焦搜索框', () => {
    const input = document.createElement('input');
    input.type = 'text';
    document.body.appendChild(input);
    const focusSpy = vi.spyOn(input, 'focus');
    render(<Harness selectedId={'1'} onSelect={onSelect} onStatusChange={onStatusChange} onOpenDetail={onOpenDetail} />);
    fireEvent.keyDown(window, { key: 'f', ctrlKey: true });
    expect(focusSpy).toHaveBeenCalled();
    focusSpy.mockClear();
    fireEvent.keyDown(window, { key: 'F', metaKey: true });
    expect(focusSpy).toHaveBeenCalled();
    // no meta/ctrl not trigger
    focusSpy.mockClear();
    fireEvent.keyDown(window, { key: 'f' });
    expect(focusSpy).not.toHaveBeenCalled();
  });

  it('在 input/select/textarea 中仅 Escape blur，其余忽略', () => {
    render(<Harness selectedId={'1'} onSelect={onSelect} onStatusChange={onStatusChange} onOpenDetail={onOpenDetail} />);
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();
    const blurSpy = vi.spyOn(input, 'blur');
    // ArrowDown on input should not navigate but Escape should blur
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(onSelect).not.toHaveBeenCalled();
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(blurSpy).toHaveBeenCalled();
    // other keys in input also early return
    blurSpy.mockClear();
    const ta = document.createElement('textarea');
    document.body.appendChild(ta);
    ta.focus();
    fireEvent.keyDown(ta, { key: '1' });
    expect(onStatusChange).not.toHaveBeenCalled();
    const sel = document.createElement('select');
    document.body.appendChild(sel);
    sel.focus();
    fireEvent.keyDown(sel, { key: 'Enter' });
    expect(onOpenDetail).not.toHaveBeenCalled();
  });

  it('动态更新 refs 后按键使用最新值', () => {
    const firstSelect = vi.fn();
    const secondSelect = vi.fn();
    const { rerender } = render(<Harness selectedId={'1'} onSelect={firstSelect} onStatusChange={onStatusChange} onOpenDetail={onOpenDetail} />);
    // update onSelect ref
    rerender(<Harness selectedId={'1'} onSelect={secondSelect} onStatusChange={onStatusChange} onOpenDetail={onOpenDetail} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(secondSelect).toHaveBeenCalledWith(null);
    expect(firstSelect).not.toHaveBeenCalled();
  });

  it('卸载时移除监听', () => {
    const { unmount } = render(<Harness selectedId={'1'} onSelect={onSelect} onStatusChange={onStatusChange} onOpenDetail={onOpenDetail} />);
    unmount();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onSelect).not.toHaveBeenCalled();
  });
});
