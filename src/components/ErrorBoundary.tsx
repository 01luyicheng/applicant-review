import React from 'react';
import { reportError } from '../utils/logger';

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Phase0 新增：类组件 ErrorBoundary，展示 fallback 与重试
 * - 捕获渲染期异常，避免上帝组件崩溃白屏
 * - 上报至 logger（SENTRY / /log），生产环境默认静默需 VITE_ENABLE_LOG=1
 * - 提供重试按钮（重置内部 error 状态并调用 onReset）
 */
export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    reportError(error, { source: 'ErrorBoundary', componentStack: info.componentStack });
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null });
    if (this.props.onReset) {
      try {
        this.props.onReset();
      } catch (e) {
        reportError(e, { source: 'ErrorBoundary.onReset' });
      }
    }
  };

  render(): React.ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <div
          role="alert"
          className="m-4 p-6 border border-red-200 bg-red-50 rounded text-sm text-red-700"
        >
          <h2 className="text-base font-semibold mb-2">页面出现异常</h2>
          <p className="mb-3">应用渲染时发生错误，已拦截避免白屏。你可以重试或刷新页面。</p>
          {this.state.error && (
            <pre className="mb-3 p-2 bg-white border border-red-100 rounded text-xs text-red-600 overflow-auto max-h-32">
              {this.state.error.message}
            </pre>
          )}
          <div className="flex gap-2">
            <button
              onClick={this.handleReset}
              className="px-3 py-1.5 text-xs bg-red-600 text-white rounded hover:bg-red-700"
            >
              重试
            </button>
            <button
              onClick={() => window.location.reload()}
              className="px-3 py-1.5 text-xs border border-gray-300 bg-white rounded hover:bg-gray-50 text-gray-700"
            >
              刷新页面
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
