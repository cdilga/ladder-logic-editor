/**
 * Ladder Logic Editor Application
 *
 * A visual ladder logic diagram editor with Structured Text representation.
 */

import { useEffect } from 'react';
import { MainLayout } from './components/layout/MainLayout';
import { MobileLayout } from './components/mobile/MobileLayout';
import { useProjectStore } from './store';
import { useMobileStore } from './store/mobile-store';

import './App.css';

function App() {
  const newTrafficControllerProject = useProjectStore(
    (state) => state.newTrafficControllerProject
  );
  const project = useProjectStore((state) => state.project);
  const isMobile = useMobileStore((state) => state.isMobile);

  // Initialize with a traffic controller project on first load
  useEffect(() => {
    if (!project) {
      newTrafficControllerProject('Traffic Controller');
    }
  }, [project, newTrafficControllerProject]);

  return (
    <div className="app">
      {isMobile ? <MobileLayout /> : <MainLayout />}
    </div>
  );
}

export default App;
