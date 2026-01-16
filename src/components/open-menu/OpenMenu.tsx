/**
 * Open Menu Component
 *
 * Dropdown menu for opening files from examples or local files.
 */

import { useState, useRef, useEffect } from 'react';
import { useEditorStore } from '../../store';
import { openSTFile } from '../../services/file-service';
import trafficControllerST from '../../examples/traffic-controller.st?raw';
import dualPumpControllerST from '../../examples/dual-pump-controller.st?raw';
import './OpenMenu.css';

export function OpenMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const openFile = useEditorStore((state) => state.openFile);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close on escape
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen]);

  const handleLoadExample = (example: 'traffic' | 'dual-pump') => {
    if (example === 'traffic') {
      openFile('TrafficController.st', trafficControllerST);
    } else if (example === 'dual-pump') {
      openFile('DualPumpController.st', dualPumpControllerST);
    }

    setIsOpen(false);
  };

  const handleOpenLocalFile = async () => {
    try {
      const { programName, stCode } = await openSTFile();
      openFile(programName, stCode);
    } catch (error) {
      if ((error as Error).message !== 'File selection cancelled') {
        console.error('Error opening ST file:', error);
        alert(`Failed to open ST file: ${(error as Error).message}`);
      }
    }

    setIsOpen(false);
  };

  return (
    <div className="open-menu" ref={dropdownRef}>
      <button
        className="toolbar-btn"
        title="Open File"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="toolbar-icon">📂</span>
        <span className="toolbar-label">Open</span>
        <span className="dropdown-caret">{isOpen ? '▲' : '▼'}</span>
      </button>

      {isOpen && (
        <div className="open-menu-dropdown">
          <div className="open-menu-section">
            <div className="open-menu-header">Examples</div>
            <button
              className="open-menu-option"
              onClick={() => handleLoadExample('dual-pump')}
            >
              <span className="option-icon">🔧</span>
              <span className="option-text">
                <span className="option-title">Dual Pump Controller</span>
                <span className="option-desc">Lead/lag with 2oo3 voting</span>
              </span>
            </button>
            <button
              className="open-menu-option"
              onClick={() => handleLoadExample('traffic')}
            >
              <span className="option-icon">🚦</span>
              <span className="option-text">
                <span className="option-title">4-Way Intersection</span>
                <span className="option-desc">Traffic light with safety flash</span>
              </span>
            </button>
          </div>

          <div className="open-menu-divider" />

          <button
            className="open-menu-option"
            onClick={handleOpenLocalFile}
          >
            <span className="option-icon">📁</span>
            <span className="option-text">
              <span className="option-title">Open Local File...</span>
              <span className="option-desc">Load .st file from disk</span>
            </span>
          </button>
        </div>
      )}
    </div>
  );
}
