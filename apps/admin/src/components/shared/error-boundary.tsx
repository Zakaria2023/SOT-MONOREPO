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

/**
 * Next signals redirect() and notFound() by throwing, and the throw travels the
 * same path as a real failure. Caught here it would render the retry box: someone
 * who should have been sent to another page sees "something went wrong" instead,
 * and pressing Try again re-runs the redirect and shows them the same box again.
 *
 * The signals carry a `digest`, which is how Next's own boundaries tell them
 * apart from genuine errors.
 */
const isFrameworkSignal = (error: unknown): boolean => {
  if (typeof error !== "object" || error === null || !("digest" in error)) {
    return false;
  }
  const { digest } = error as { digest: unknown };
  return (
    typeof digest === "string" &&
    (digest.startsWith("NEXT_REDIRECT") ||
      digest.startsWith("NEXT_NOT_FOUND") ||
      digest.startsWith("NEXT_HTTP_ERROR_FALLBACK"))
  );
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

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    // Re-thrown rather than swallowed so it carries on to Next's own handler and
    // the redirect or 404 actually happens. A boundary cannot decline an error;
    // throwing is how it passes one along.
    if (isFrameworkSignal(error)) {
      throw error;
    }
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
