import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = { children: ReactNode };
type State = { error: Error | null };

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Unhandled frontend render error", error, errorInfo);
  }

  render() {
    if (this.state.error) {
      return (
        <main className="error-screen" role="alert">
          <h1>Something went wrong</h1>
          <p>
            Please refresh the page. The problem was logged locally for
            development.
          </p>
        </main>
      );
    }

    return this.props.children;
  }
}
