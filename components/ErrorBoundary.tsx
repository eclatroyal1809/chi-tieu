import React, { Component, ReactNode, ErrorInfo } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public props: Props;
  public state: State;

  constructor(props: Props) {
    super(props);
    this.props = props;
    this.state = {
      hasError: false,
      error: null
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#f5f5f7] flex items-center justify-center p-6 text-center font-sans">
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-black/[0.06] max-w-sm w-full">
            <span className="material-symbols-rounded text-3xl text-[#ff3b30] mb-2">error</span>
            <h2 className="text-base font-semibold text-[#1d1d1f] mb-1">Đã xảy ra lỗi</h2>
            <p className="text-xs text-[#86868b] mb-4">Vui lòng tải lại ứng dụng.</p>
            <button
              onClick={() => window.location.reload()}
              className="w-full py-2.5 bg-[#1d1d1f] text-white text-xs font-medium rounded-full shadow-sm active:scale-95"
            >
              Tải lại trang
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
