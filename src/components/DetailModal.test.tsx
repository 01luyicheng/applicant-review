import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import DetailModal from './DetailModal';
import { DEFAULT_CONFIG, ViewConfig } from '../types';
import i18n from '../i18n';

async function ensureZh() {
  try {
    localStorage.setItem('app-locale', 'zh');
    await i18n.changeLanguage('zh');
  } catch {}
}

function makeConfig(): ViewConfig {
  return {
    ...structuredClone(DEFAULT_CONFIG),
    detailGroups: [
      { label: '基本信息', fields: [
        { key: '姓名', label: '姓名' },
        { key: '邮箱', label: '邮箱' },
        { key: '空白', label: '空白字段' },
        { key: '多行', label: '备注', multiline: true },
      ]},
      { label: '扩展', fields: [
        { key: '状态', label: '状态' },
        { key: '空串', label: '空串字段' },
      ]},
    ],
    statusValues: [
      { value: '', label: '待审核', color: 'gray' },
      { value: '通过', label: '通过', color: 'green' },
      { value: '拒绝', label: '拒绝', color: 'red' },
      { value: '待定', label: '待定', color: 'yellow' },
    ],
  };
}

describe('DetailModal', () => {
  beforeEach(async () => {
    await ensureZh();
    document.body.style.overflow = '';
    vi.restoreAllMocks();
  });

  it('applicant 为 null 返回 null', () => {
    const { container } = render(<DetailModal applicant={null} config={makeConfig()} onClose={vi.fn()} onStatusChange={vi.fn()} />);
    expect(container.innerHTML).toBe('');
  });

  it('空值显示 未填写 + 样式 italic + 多行渲染 whitespace-pre-wrap', () => {
    const config = makeConfig();
    const applicant = { id: '1', raw: { '姓名': '张三', '邮箱': '', '空白': '   ', '多行': '第一行\n第二行', '状态': '', '空串': '' } };
    render(<DetailModal applicant={applicant} config={config} onClose={vi.fn()} onStatusChange={vi.fn()} />);
    // 未填写出现多次
    const empties = screen.getAllByText('未填写');
    expect(empties.length).toBeGreaterThanOrEqual(3);
    // 样式检查
    empties.forEach(el => {
      expect(el.className).toContain('italic');
      expect(el.className).toContain('border-dashed');
    });
    // 多行字段 — 兼容 Testing Library 的空白归一化（\n 会被视为空格）
    const multilineEl = screen.getByText((content, element) => element?.textContent === '第一行\n第二行');
    expect(multilineEl.className).toContain('whitespace-pre-wrap');
    expect(multilineEl.className).toContain('max-h-60');
    // 非空字段 – 标题与详情各有1份
    expect(screen.getAllByText('张三').length).toBeGreaterThanOrEqual(1);
  });

  it('空值包含 undefined 与空格均视为未填写', () => {
    const config = makeConfig();
    const applicant = { id: '1', raw: { '姓名': '李四' } as Record<string,string> };
    render(<DetailModal applicant={applicant} config={config} onClose={vi.fn()} onStatusChange={vi.fn()} />);
    // 邮箱 key missing => 未填写
    expect(screen.getAllByText('未填写').length).toBeGreaterThan(0);
  });

  it('未命名 fallback 当 nameField 为空', () => {
    const config = makeConfig();
    const applicant = { id: '1', raw: { '邮箱': 'a@b.com' } };
    render(<DetailModal applicant={applicant} config={config} onClose={vi.fn()} onStatusChange={vi.fn()} />);
    expect(screen.getByText('未命名')).toBeInTheDocument();
  });

  it('状态标签与颜色', () => {
    const config = makeConfig();
    const applicant = { id: '1', raw: { '姓名': '王五', '状态': '通过' } };
    render(<DetailModal applicant={applicant} config={config} onClose={vi.fn()} onStatusChange={vi.fn()} />);
    expect(screen.getAllByText('通过').length).toBeGreaterThanOrEqual(1);
    const badge = screen.getAllByText('通过')[0].closest('span');
    // getStatusColor for green => bg-green-100
    expect(badge?.className || document.body.innerHTML).toContain('bg-green');
  });

  it('按钮 disabled 当为当前状态', () => {
    const config = makeConfig();
    const applicant = { id: '1', raw: { '姓名': '张三甲', '状态': '通过' } };
    const onStatusChange = vi.fn();
    const onClose = vi.fn();
    render(<DetailModal applicant={applicant} config={config} onClose={onClose} onStatusChange={onStatusChange} />);
    const btnPass = screen.getByRole('button', { name: '通过' });
    expect(btnPass).toBeDisabled();
    const btnReject = screen.getByRole('button', { name: '拒绝' });
    expect(btnReject).not.toBeDisabled();
    fireEvent.click(btnReject);
    expect(onStatusChange).toHaveBeenCalledWith('拒绝');
    expect(onClose).toHaveBeenCalled();
  });

  it('过滤掉空 value 的 statusValues 不渲染按钮', () => {
    const config = makeConfig();
    // config.statusValues[0] value '' should be filtered
    const applicant = { id: '1', raw: { '姓名': '张三甲' } };
    render(<DetailModal applicant={applicant} config={config} onClose={vi.fn()} onStatusChange={vi.fn()} />);
    expect(screen.queryByRole('button', { name: '待审核' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '通过' })).toBeInTheDocument();
  });

  it('点击关闭按钮与底部关闭按钮', () => {
    const onClose = vi.fn();
    const config = makeConfig();
    const applicant = { id: '1', raw: { '姓名': '张三甲' } };
    render(<DetailModal applicant={applicant} config={config} onClose={onClose} onStatusChange={vi.fn()} />);
    const closeBtns = screen.getAllByText('关闭');
    // first is bottom close, second is × aria
    fireEvent.click(closeBtns[0]);
    expect(onClose).toHaveBeenCalledTimes(1);
    // aria close
    const ariaBtn = screen.getByLabelText('关闭详情');
    fireEvent.click(ariaBtn);
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('backdrop 点击关闭，内容区 stopPropagation 不关闭', () => {
    const onClose = vi.fn();
    const config = makeConfig();
    const applicant = { id: '1', raw: { '姓名': '张三甲' } };
    const { container } = render(<DetailModal applicant={applicant} config={config} onClose={onClose} onStatusChange={vi.fn()} />);
    const backdrop = container.firstChild as HTMLElement;
    // dialog inside
    const dialog = screen.getByRole('dialog');
    fireEvent.click(dialog);
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('Esc 键关闭 + overflow hidden + 焦点恢复', () => {
    const onClose = vi.fn();
    const config = makeConfig();
    const applicant = { id: '1', raw: { '姓名': '张三甲' } };
    // focusable element before modal
    const btn = document.createElement('button');
    btn.textContent = 'focusMe';
    document.body.appendChild(btn);
    btn.focus();
    expect(document.activeElement).toBe(btn);

    const { unmount } = render(<DetailModal applicant={applicant} config={config} onClose={onClose} onStatusChange={vi.fn()} />);
    expect(document.body.style.overflow).toBe('hidden');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
    // non-Esc should not
    fireEvent.keyDown(document, { key: 'Enter' });
    expect(onClose).toHaveBeenCalledTimes(1);
    // unmount restores overflow and focus
    unmount();
    expect(document.body.style.overflow).toBe('');
    expect(document.activeElement).toBe(btn);
    document.body.removeChild(btn);
  });

  it('Esc 在无 applicant 时不监听', () => {
    const onClose = vi.fn();
    render(<DetailModal applicant={null} config={makeConfig()} onClose={onClose} onStatusChange={vi.fn()} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('切换 applicant 时重新绑定', () => {
    const onClose = vi.fn();
    const config = makeConfig();
    const a1 = { id: '1', raw: { '姓名': '用户A甲' } };
    const a2 = { id: '2', raw: { '姓名': '用户B乙' } };
    const { rerender } = render(<DetailModal applicant={a1} config={config} onClose={onClose} onStatusChange={vi.fn()} />);
    expect(screen.getAllByText('用户A甲').length).toBeGreaterThanOrEqual(1);
    rerender(<DetailModal applicant={a2} config={config} onClose={onClose} onStatusChange={vi.fn()} />);
    expect(screen.getAllByText('用户B乙').length).toBeGreaterThanOrEqual(1);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });
});
