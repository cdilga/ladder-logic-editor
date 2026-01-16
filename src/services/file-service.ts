/**
 * File Service
 *
 * Handles project persistence: localStorage auto-save, file download/upload.
 */

import type { LadderProject } from '../models/project';
import { PROJECT_FILE_EXTENSION } from '../models/project';

// ============================================================================
// Constants
// ============================================================================

const LOCAL_STORAGE_KEY = 'ladder-logic-editor-project';
const AUTO_SAVE_DEBOUNCE_MS = 2000;

// ============================================================================
// Project File Format
// ============================================================================

export interface ProjectFile {
  $schema: string;
  fileVersion: string;
  exportedAt: string;
  project: LadderProject;
  currentProgramId?: string; // Track which program is currently selected
}

// ============================================================================
// Local Storage Operations
// ============================================================================

/**
 * Save project to localStorage
 */
export function saveToLocalStorage(project: LadderProject, currentProgramId?: string): void {
  try {
    const data: ProjectFile = {
      $schema: 'https://ladder-logic-editor/schema/project-v1.json',
      fileVersion: '1.0',
      exportedAt: new Date().toISOString(),
      project,
      currentProgramId,
    };
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.error('Failed to save project to localStorage:', error);
    throw new Error('Failed to save project');
  }
}

/**
 * Load project from localStorage
 */
export function loadFromLocalStorage(): { project: LadderProject; currentProgramId?: string } | null {
  try {
    const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!stored) return null;

    const data = JSON.parse(stored) as ProjectFile;
    return {
      project: data.project,
      currentProgramId: data.currentProgramId
    };
  } catch (error) {
    console.error('Failed to load project from localStorage:', error);
    return null;
  }
}

/**
 * Check if there's a saved project in localStorage
 */
export function hasSavedProject(): boolean {
  return localStorage.getItem(LOCAL_STORAGE_KEY) !== null;
}

/**
 * Clear saved project from localStorage
 */
export function clearLocalStorage(): void {
  localStorage.removeItem(LOCAL_STORAGE_KEY);
}

// ============================================================================
// File Download/Upload Operations
// ============================================================================

/**
 * Download project as a JSON file
 */
export function downloadProject(project: LadderProject): void {
  const data: ProjectFile = {
    $schema: 'https://ladder-logic-editor/schema/project-v1.json',
    fileVersion: '1.0',
    exportedAt: new Date().toISOString(),
    project,
  };

  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const fileName = `${project.meta.name.replace(/[^a-zA-Z0-9_-]/g, '_')}${PROJECT_FILE_EXTENSION}`;

  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}

/**
 * Open file picker and load project from selected file
 */
export function openProjectFile(): Promise<LadderProject> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = `${PROJECT_FILE_EXTENSION},.json`;

    input.onchange = async (event) => {
      const target = event.target as HTMLInputElement;
      const file = target.files?.[0];

      if (!file) {
        reject(new Error('No file selected'));
        return;
      }

      try {
        const text = await file.text();
        const data = JSON.parse(text) as ProjectFile;

        if (!data.project) {
          throw new Error('Invalid project file: missing project data');
        }

        resolve(data.project);
      } catch (error) {
        reject(new Error(`Failed to parse project file: ${error}`));
      }
    };

    input.oncancel = () => {
      reject(new Error('File selection cancelled'));
    };

    input.click();
  });
}

// ============================================================================
// Auto-Save Hook
// ============================================================================

let autoSaveTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Schedule an auto-save operation (debounced)
 */
export function scheduleAutoSave(project: LadderProject, currentProgramId?: string): void {
  if (autoSaveTimer) {
    clearTimeout(autoSaveTimer);
  }

  autoSaveTimer = setTimeout(() => {
    saveToLocalStorage(project, currentProgramId);
    autoSaveTimer = null;
  }, AUTO_SAVE_DEBOUNCE_MS);
}

/**
 * Cancel any pending auto-save
 */
export function cancelAutoSave(): void {
  if (autoSaveTimer) {
    clearTimeout(autoSaveTimer);
    autoSaveTimer = null;
  }
}

// ============================================================================
// Export ST as Text File
// ============================================================================

/**
 * Export the current program's ST code as a text file
 */
export function downloadSTFile(programName: string, stCode: string): void {
  const blob = new Blob([stCode], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);

  const fileName = `${programName.replace(/[^a-zA-Z0-9_-]/g, '_')}.st`;

  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}

// ============================================================================
// Import ST File
// ============================================================================

export interface STFileResult {
  fileName: string;
  programName: string;
  stCode: string;
}

/**
 * Open file picker and load ST code from selected file.
 * This is the primary way to load programs - ST is the source of truth.
 */
export function openSTFile(): Promise<STFileResult> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.st,.txt';

    input.onchange = async (event) => {
      const target = event.target as HTMLInputElement;
      const file = target.files?.[0];

      if (!file) {
        reject(new Error('No file selected'));
        return;
      }

      try {
        const stCode = await file.text();

        // Extract program name from the ST code if present
        const programMatch = stCode.match(/^(PROGRAM|FUNCTION_BLOCK|FUNCTION)\s+(\w+)/im);
        const programName = programMatch?.[2] || file.name.replace(/\.st$|\.txt$/i, '');

        resolve({
          fileName: file.name,
          programName,
          stCode,
        });
      } catch (error) {
        reject(new Error(`Failed to read ST file: ${error}`));
      }
    };

    input.oncancel = () => {
      reject(new Error('File selection cancelled'));
    };

    input.click();
  });
}
