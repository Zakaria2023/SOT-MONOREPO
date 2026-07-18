"use client";

import { Component } from "react";
import type { ReactNode } from "react";

type ErrorBoundaryProps = {
  fallbackRender: (reset: () => void) => ReactNode;
  children: ReactNode;
};

type ErrorBoundaryState = {
  hasError: boolean;
};

// Catches render/data errors from its children (including the async server
// component streamed into the Suspense it wraps) and shows a fallback instead
// of letting the whole route error out. Reset clears the error so a retry can
// re-render the children.
export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  reset = () => this.setState({ hasError: false });

  render() {
    if (this.state.hasError) {
      return this.props.fallbackRender(this.reset);
    }
    return this.props.children;
  }
}
