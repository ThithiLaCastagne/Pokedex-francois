import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'

export default class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    if (import.meta.env.DEV) console.error(error, info.componentStack)
  }
  render() {
    if (this.state.failed)
      return (
        <main className="recovery-screen">
          <h1>Le carnet a besoin d’un instant.</h1>
          <p>L’affichage a rencontré un problème. Les données de votre carnet n’ont pas été effacées.</p>
          <button className="btn btn-primary" onClick={() => location.reload()}>
            Recharger l’application
          </button>
          <p className="field-help">
            Si le problème persiste, réessayez avec une connexion Internet. N’effacez pas les données du
            navigateur.
          </p>
        </main>
      )
    return this.props.children
  }
}
