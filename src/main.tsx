import React from 'react'
import ReactDOM from 'react-dom/client'
import { Root } from './Root.tsx'
import './index.css'

// A new build only reaches the screen on the SECOND load: the service worker answers the
// first one from its cache while it fetches the update. It is built with skipWaiting +
// clientsClaim, so the moment the new worker takes over this page we reload once to show it.
// Skipped on the very first install (no previous worker = nothing stale on screen).
if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
  let reloading = false
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading) return
    reloading = true
    window.location.reload()
  })
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
)
