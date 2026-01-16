import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { DocsLayout } from './docs/components/DocsLayout'
import { initializeMobileStore } from './store/mobile-store'
import { initializeOnboarding } from './store/onboarding-store'
import { initializeEditorStore } from './store/editor-store'
import { initializeUIStore } from './store/ui-store'
import { initializeProjectStore } from './store/project-store'

// Initialize mobile store to detect device type and set up listeners
initializeMobileStore();

// Initialize editor store from localStorage (once on app start)
initializeEditorStore();

// Initialize UI store (panel visibility, etc.)
initializeUIStore();

// Initialize project store from localStorage (once on app start)
initializeProjectStore();

// Initialize onboarding for first-time visitors
initializeOnboarding();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/docs/*" element={<DocsLayout />} />
      </Routes>
    </HashRouter>
  </StrictMode>,
)
