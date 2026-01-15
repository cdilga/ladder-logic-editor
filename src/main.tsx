import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { initializeMobileStore } from './store/mobile-store'
import { initializeOnboarding } from './store/onboarding-store'

// Initialize mobile store to detect device type and set up listeners
initializeMobileStore();

// Initialize onboarding for first-time visitors
initializeOnboarding();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
