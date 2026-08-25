import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { ErrorBoundary } from './ErrorBoundary';

function Bomb({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) throw new Error('boom error message');
  return <div>ok</div>;
}

describe('ErrorBoundary', () => {
  it('捕获错误展示默认 fallback 与重试', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    // wrapper state: shouldThrow controlled by onReset
    function Wrapper() {
      const [shouldThrow, setShouldThrow] = React.useState(true);
      return (
        <ErrorBoundary onReset={() => setShouldThrow(false)}>
          <Bomb shouldThrow={shouldThrow} />
        </ErrorBoundary>
      );
    }
    render(<Wrapper />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('页面出现异常')).toBeInTheDocument();
    expect(screen.getByText('boom error message')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '重试' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '刷新页面' })).toBeInTheDocument();

    // 点击重试应重置并通过 onReset 将 shouldThrow 设为 false，随后展示 ok
    fireEvent.click(screen.getByRole('button', { name: '重试' }));
    expect(screen.getByText('ok')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    consoleSpy.mockRestore();
  });

  it('自定义 fallback 优先展示', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <ErrorBoundary fallback={<div>custom fallback</div>}>
        <Bomb shouldThrow={true} />
      </ErrorBoundary>
    );
    expect(screen.getByText('custom fallback')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    consoleSpy.mockRestore();
  });

  it('onReset 抛错时上报但不崩溃', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const badReset = vi.fn(() => { throw new Error('reset fail'); });
    render(
      <ErrorBoundary onReset={badReset}>
        <Bomb shouldThrow={true} />
      </ErrorBoundary>
    );
    expect(screen.getByRole('alert')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '重试' }));
    expect(badReset).toHaveBeenCalled();
    // 即使 onReset 抛错，ErrorBoundary 应已重置 hasError -> 此时 children 会尝试再渲染但仍抛错会再次捕获
    // 由于 Bomb 仍为 shouldThrow true，再次渲染会再次进入 error state；alert 仍存在
    expect(screen.getByRole('alert')).toBeInTheDocument();
    consoleSpy.mockRestore();
  });

  it('正常渲染时展示 children', () => {
    render(
      <ErrorBoundary>
        <Bomb shouldThrow={false} />
      </ErrorBoundary>
    );
    expect(screen.getByText('ok')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
