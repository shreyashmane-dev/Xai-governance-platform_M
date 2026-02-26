import React from 'react'

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error) {
    console.error(error)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="m-6 card">
          <h2 className="text-lg font-semibold">Something went wrong</h2>
          <p className="mt-2 text-slate-400">Please refresh the page or contact support.</p>
        </div>
      )
    }
    return this.props.children
  }
}
