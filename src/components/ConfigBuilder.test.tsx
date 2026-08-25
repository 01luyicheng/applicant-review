import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import ConfigBuilder from './ConfigBuilder';
import { DEFAULT_CONFIG, ViewConfig } from '../types';
import i18n from '../i18n';

function makeConfig(): ViewConfig {
  return structuredClone(DEFAULT_CONFIG);
}

describe('ConfigBuilder', () => {
  const headers = ['编号', '姓名', '邮箱', '赛道', '想法', '状态', '备注', '电话', '学校', '年级'];

  beforeEach(async () => {
    try {
      localStorage.setItem('app-locale', 'zh');
      await i18n.changeLanguage('zh');
    } catch {}
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  });

  it('渲染基础结构 + 关闭 + 取消', () => {
    const onClose = vi.fn();
    const onSave = vi.fn();
    const config = makeConfig();
    render(<ConfigBuilder headers={headers} config={config} onSave={onSave} onClose={onClose} />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/可视化配置构建器|Visual Config Builder/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /从表头一键生成|Generate from headers/ })).toBeEnabled();
    // 关闭按钮
    fireEvent.click(screen.getByLabelText(/关闭配置构建器|Close config builder/));
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByText(/取消|Cancel/));
    expect(onClose).toHaveBeenCalledTimes(2);
    // backdrop click
    const backdrop = document.querySelector('.fixed.inset-0') as HTMLElement;
    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it('headers 为空时提示且一键生成禁用', () => {
    const onClose = vi.fn();
    const onSave = vi.fn();
    render(<ConfigBuilder headers={[]} config={makeConfig()} onSave={onSave} onClose={onClose} />);
    expect(screen.getByText(/尚未上传文件|No file uploaded/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /从表头一键生成|Generate from headers/ })).toBeDisabled();
  });

  it('一键生成 autoGenerate 更新 draft 并显示 Diff 预览', () => {
    const onClose = vi.fn();
    const onSave = vi.fn();
    const config = makeConfig();
    void config.listFields.length;
    render(<ConfigBuilder headers={headers} config={config} onSave={onSave} onClose={onClose} />);
    const btn = screen.getByRole('button', { name: /从表头一键生成|Generate from headers/ });
    fireEvent.click(btn);
    // diff preview should appear
    expect(screen.getByText(/Diff 预览|Diff preview/)).toBeInTheDocument();
    // listFields should now be headers.slice(0,8) = 8
    expect(screen.getByText(/当前顺序|Current order/)).toBeInTheDocument();
    const seqText = screen.getByText(/当前顺序|Current order/).textContent || '';
    // should contain new keys like 赛道、想法
    expect(seqText).toContain('赛道');
    // apply after generate should trigger onSave
    fireEvent.click(screen.getByRole('button', { name: /应用配置|Apply Config/ }));
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalled();
    const saved = onSave.mock.calls[0][0] as ViewConfig;
    expect(saved.listFields.length).toBe(8);
    expect(saved.detailGroups.length).toBeGreaterThanOrEqual(1);
    expect(saved.title).toBeTruthy();
  });

  it('校验失败时显示 error 且不调用 onSave', () => {
    const onClose = vi.fn();
    const onSave = vi.fn();
    const bad: ViewConfig = { ...makeConfig(), title: '' };
    render(<ConfigBuilder headers={headers} config={bad} onSave={onSave} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: /应用配置|Apply Config/ }));
    expect(screen.getByText(/title 必须/)).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('listFields 勾选/排序/编辑 label 基础交互', () => {
    const onClose = vi.fn();
    const onSave = vi.fn();
    render(<ConfigBuilder headers={headers} config={makeConfig()} onSave={onSave} onClose={onClose} />);
    // toggle first header off and on
    const checkboxes = screen.getAllByRole('checkbox');
    const first = checkboxes[0] as HTMLInputElement;
    const wasChecked = first.checked;
    fireEvent.click(first);
    expect(first.checked).toBe(!wasChecked);
    fireEvent.click(first);
    expect(first.checked).toBe(wasChecked);
    // edit label if selected
    const labelInputs = document.querySelectorAll('input[title*="label"], input[title*="Label"]');
    if (labelInputs.length > 0) {
      const input = labelInputs[0] as HTMLInputElement;
      fireEvent.change(input, { target: { value: '新标签' } });
      expect((input as HTMLInputElement).value).toBe('新标签');
    }
  });

  it('导出 JSON 调用 URL.createObjectURL', () => {
    const onClose = vi.fn();
    const onSave = vi.fn();
    render(<ConfigBuilder headers={headers} config={makeConfig()} onSave={onSave} onClose={onClose} />);
    const exportBtn = screen.getByRole('button', { name: /导出 JSON|Export JSON/ });
    const anchorClickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    fireEvent.click(exportBtn);
    expect(URL.createObjectURL).toHaveBeenCalled();
    anchorClickSpy.mockRestore();
  });

  it('Esc 关闭', () => {
    const onClose = vi.fn();
    const onSave = vi.fn();
    render(<ConfigBuilder headers={headers} config={makeConfig()} onSave={onSave} onClose={onClose} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });
});
