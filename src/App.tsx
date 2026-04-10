/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { Component, ErrorInfo, ReactNode } from "react";
import PubCrawlPlanner from "./components/PubCrawlPlanner";

class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean, error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-black text-white flex items-center justify-center p-8 text-center">
          <div className="max-w-md space-y-4">
            <h1 className="text-2xl font-bold text-red-500">Something went wrong</h1>
            <p className="text-white/60">{this.state.error?.message || "An unexpected error occurred."}</p>
            <button 
              onClick={() => window.location.reload()}
              className="px-6 py-2 bg-white/10 rounded-xl hover:bg-white/20 transition-all"
            >
              Reload App
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default function App() {
  return (
    <ErrorBoundary>
      <PubCrawlPlanner />
    </ErrorBoundary>
  );
}

