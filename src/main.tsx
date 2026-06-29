import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles/globals.css'
import { installViewerGuard } from './lib/viewerGuard'

// Install the view-only write blocker BEFORE any component mounts.
installViewerGuard()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
