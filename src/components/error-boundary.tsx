'use client'

import { Component, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { AlertTriangle, RotateCcw, Home } from 'lucide-react'

type Props = { children: ReactNode; fallback?: ReactNode }
type State = { hasError: boolean; error?: Error }

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback
      return (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <AlertTriangle className="h-10 w-10 text-destructive mb-3" />
          <h2 className="text-lg font-semibold">Something went wrong</h2>
          <p className="text-sm text-muted-foreground mt-1 mb-4 max-w-sm">
            {this.state.error?.message || 'An unexpected error occurred in this view.'}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => this.setState({ hasError: false, error: undefined })}>
              <RotateCcw className="h-4 w-4 mr-1.5" /> Retry
            </Button>
            <Button onClick={() => { window.location.reload() }}>
              <Home className="h-4 w-4 mr-1.5" /> Reload
            </Button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
