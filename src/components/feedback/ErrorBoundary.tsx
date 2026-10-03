"use client";

import { Component, type ReactNode } from "react";

interface Props {
  /** Shown instead of the children after a crash; `retry` remounts them. */
  fallback: (retry: () => void) => ReactNode;
  children: ReactNode;
}

interface State {
  failed: boolean;
  attempt: number;
}

/**
 * Contains a crash to one part of the game. Rewards and the save live in the
 * stores, outside the failed subtree, so they are untouched by a retry.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { failed: false, attempt: 0 };

  static getDerivedStateFromError(): Partial<State> {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.error("[ErrorBoundary]", error);
  }

  retry = () => this.setState((s) => ({ failed: false, attempt: s.attempt + 1 }));

  render() {
    if (this.state.failed) return this.props.fallback(this.retry);
    return <div key={this.state.attempt} className="contents">{this.props.children}</div>;
  }
}
