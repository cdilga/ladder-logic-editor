/**
 * Editor Store
 *
 * Manages open files and the active file. Replaces the old project-based model
 * with a simpler multi-file system where each file is an independent ST program.
 */

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type { LadderNode, LadderEdge } from '../models/ladder-elements';
import { transformSTToLadder, type TransformResult } from '../transformer';

// ============================================================================
// Types
// ============================================================================

export interface OpenFile {
  id: string;
  name: string;
  content: string;
  isDirty: boolean; // changed since last download
}

interface EditorState {
  // File management
  files: Map<string, OpenFile>;
  activeFileId: string | null;

  // Transformer state (for active file)
  lastTransformResult: TransformResult | null;
  transformedNodes: LadderNode[];
  transformedEdges: LadderEdge[];

  // File actions
  newFile: (name?: string) => string; // returns new file id
  openFile: (name: string, content: string) => string; // returns file id
  closeFile: (id: string) => void;
  setActiveFile: (id: string) => void;
  updateFileContent: (id: string, content: string) => void;
  renameFile: (id: string, newName: string) => void;
  markFileClean: (id: string) => void;
  getActiveFile: () => OpenFile | null;
  getFileById: (id: string) => OpenFile | null;

  // Transformer actions
  transformActiveFile: () => TransformResult | null;
  getTransformedDiagram: () => { nodes: LadderNode[]; edges: LadderEdge[] };
}

// ============================================================================
// Default Templates
// ============================================================================

const BLANK_TEMPLATE = `PROGRAM Main
VAR
  // Declare variables here
END_VAR

  // Write your ladder logic here

END_PROGRAM
`;

function generateFileId(): string {
  return `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function ensureSTExtension(name: string): string {
  if (name.toLowerCase().endsWith('.st')) {
    return name;
  }
  return `${name}.st`;
}

// ============================================================================
// Store Implementation
// ============================================================================

export const useEditorStore = create<EditorState>()(
  subscribeWithSelector((set, get) => ({
    // Initial state
    files: new Map(),
    activeFileId: null,
    lastTransformResult: null,
    transformedNodes: [],
    transformedEdges: [],

    // Create a new blank file
    newFile: (name?: string) => {
      const id = generateFileId();
      const fileName = ensureSTExtension(name || 'Untitled');

      const newFile: OpenFile = {
        id,
        name: fileName,
        content: BLANK_TEMPLATE.replace('Main', fileName.replace('.st', '')),
        isDirty: false,
      };

      set((state) => {
        const newFiles = new Map(state.files);
        newFiles.set(id, newFile);
        return {
          files: newFiles,
          activeFileId: id,
        };
      });

      return id;
    },

    // Open an existing file (from import or example)
    openFile: (name: string, content: string) => {
      const fileName = ensureSTExtension(name);

      // Check if file with same name is already open
      const existing = Array.from(get().files.values()).find(
        (f) => f.name.toLowerCase() === fileName.toLowerCase()
      );

      if (existing) {
        // Update existing file and switch to it
        set((state) => {
          const newFiles = new Map(state.files);
          newFiles.set(existing.id, {
            ...existing,
            content,
            isDirty: false,
          });
          return {
            files: newFiles,
            activeFileId: existing.id,
          };
        });
        return existing.id;
      }

      // Create new file
      const id = generateFileId();
      const newFile: OpenFile = {
        id,
        name: fileName,
        content,
        isDirty: false,
      };

      set((state) => {
        const newFiles = new Map(state.files);
        newFiles.set(id, newFile);
        return {
          files: newFiles,
          activeFileId: id,
        };
      });

      return id;
    },

    // Close a file
    closeFile: (id: string) => {
      const { files, activeFileId } = get();

      if (!files.has(id)) return;

      const newFiles = new Map(files);
      newFiles.delete(id);

      // If closing active file, switch to another
      let newActiveId = activeFileId;
      if (activeFileId === id) {
        const remainingIds = Array.from(newFiles.keys());
        newActiveId = remainingIds.length > 0 ? remainingIds[remainingIds.length - 1] : null;
      }

      // If no files left, create a new blank one
      if (newFiles.size === 0) {
        const blankId = generateFileId();
        newFiles.set(blankId, {
          id: blankId,
          name: 'Untitled.st',
          content: BLANK_TEMPLATE,
          isDirty: false,
        });
        newActiveId = blankId;
      }

      set({
        files: newFiles,
        activeFileId: newActiveId,
      });
    },

    // Switch active file
    setActiveFile: (id: string) => {
      if (get().files.has(id)) {
        set({ activeFileId: id });
      }
    },

    // Update file content (marks as dirty)
    updateFileContent: (id: string, content: string) => {
      set((state) => {
        const file = state.files.get(id);
        if (!file) return state;

        const newFiles = new Map(state.files);
        newFiles.set(id, {
          ...file,
          content,
          isDirty: true,
        });

        return { files: newFiles };
      });
    },

    // Rename a file
    renameFile: (id: string, newName: string) => {
      const fileName = ensureSTExtension(newName);

      set((state) => {
        const file = state.files.get(id);
        if (!file) return state;

        const newFiles = new Map(state.files);
        newFiles.set(id, {
          ...file,
          name: fileName,
          isDirty: true,
        });

        return { files: newFiles };
      });
    },

    // Mark file as clean (after download)
    markFileClean: (id: string) => {
      set((state) => {
        const file = state.files.get(id);
        if (!file) return state;

        const newFiles = new Map(state.files);
        newFiles.set(id, {
          ...file,
          isDirty: false,
        });

        return { files: newFiles };
      });
    },

    // Get active file
    getActiveFile: () => {
      const { files, activeFileId } = get();
      if (!activeFileId) return null;
      return files.get(activeFileId) || null;
    },

    // Get file by ID
    getFileById: (id: string) => {
      return get().files.get(id) || null;
    },

    // Transform active file
    transformActiveFile: () => {
      const file = get().getActiveFile();
      if (!file) return null;

      const result = transformSTToLadder(file.content, {
        warnOnUnsupported: true,
        includeIntermediates: true,
      });

      set({
        lastTransformResult: result,
        transformedNodes: result.nodes,
        transformedEdges: result.edges,
      });

      return result;
    },

    // Get transformed diagram
    getTransformedDiagram: () => {
      const { transformedNodes, transformedEdges } = get();
      return { nodes: transformedNodes, edges: transformedEdges };
    },
  }))
);

// ============================================================================
// Persistence
// ============================================================================

const EDITOR_STORAGE_KEY = 'ladder-logic-editor-files';

interface EditorStorageData {
  version: '2.0';
  files: Array<{
    id: string;
    name: string;
    content: string;
    isDirty: boolean;
  }>;
  activeFileId: string | null;
  savedAt: string;
}

/**
 * Save editor state to localStorage
 */
export function saveEditorState(): void {
  const { files, activeFileId } = useEditorStore.getState();

  const data: EditorStorageData = {
    version: '2.0',
    files: Array.from(files.values()),
    activeFileId,
    savedAt: new Date().toISOString(),
  };

  try {
    localStorage.setItem(EDITOR_STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.error('Failed to save editor state:', error);
  }
}

/**
 * Load editor state from localStorage
 */
export function loadEditorState(): boolean {
  try {
    const stored = localStorage.getItem(EDITOR_STORAGE_KEY);
    if (!stored) return false;

    const data = JSON.parse(stored) as EditorStorageData;

    if (data.version !== '2.0' || !data.files || data.files.length === 0) {
      return false;
    }

    const filesMap = new Map<string, OpenFile>();
    for (const file of data.files) {
      filesMap.set(file.id, file);
    }

    // Validate activeFileId
    const activeId = data.activeFileId && filesMap.has(data.activeFileId)
      ? data.activeFileId
      : filesMap.keys().next().value || null;

    useEditorStore.setState({
      files: filesMap,
      activeFileId: activeId,
    });

    return true;
  } catch (error) {
    console.error('Failed to load editor state:', error);
    return false;
  }
}

// ============================================================================
// Migration from old format
// ============================================================================

const OLD_STORAGE_KEY = 'ladder-logic-editor-project';

interface OldProjectFile {
  project: {
    programs: Array<{
      id: string;
      name: string;
      structuredText: string;
    }>;
  };
  currentProgramId?: string;
}

/**
 * Migrate from old project format to new file format
 */
export function migrateFromOldFormat(): boolean {
  try {
    const stored = localStorage.getItem(OLD_STORAGE_KEY);
    if (!stored) return false;

    const oldData = JSON.parse(stored) as OldProjectFile;

    if (!oldData.project?.programs || oldData.project.programs.length === 0) {
      return false;
    }

    // Convert programs to files
    const filesMap = new Map<string, OpenFile>();
    let activeFileId: string | null = null;

    for (const program of oldData.project.programs) {
      const file: OpenFile = {
        id: program.id,
        name: ensureSTExtension(program.name),
        content: program.structuredText,
        isDirty: false,
      };
      filesMap.set(program.id, file);

      // Set active file from old currentProgramId
      if (program.id === oldData.currentProgramId) {
        activeFileId = program.id;
      }
    }

    // Default to first file if no active
    if (!activeFileId) {
      activeFileId = filesMap.keys().next().value || null;
    }

    useEditorStore.setState({
      files: filesMap,
      activeFileId,
    });

    // Save in new format
    saveEditorState();

    // Clear old format
    localStorage.removeItem(OLD_STORAGE_KEY);

    console.log('Migrated from old project format to new file format');
    return true;
  } catch (error) {
    console.error('Failed to migrate from old format:', error);
    return false;
  }
}

// ============================================================================
// Initialization
// ============================================================================

let initialized = false;

/**
 * Initialize the editor store from localStorage on app startup.
 * Handles migration from old format if needed.
 */
export function initializeEditorStore(): void {
  if (initialized) return;
  initialized = true;

  // Try to load new format first
  if (loadEditorState()) {
    return;
  }

  // Try to migrate from old format
  if (migrateFromOldFormat()) {
    return;
  }

  // No saved state, create blank file
  useEditorStore.getState().newFile('Untitled');
}

// ============================================================================
// Auto-save
// ============================================================================

let autoSaveTimer: ReturnType<typeof setTimeout> | null = null;
const AUTO_SAVE_DEBOUNCE_MS = 1000;

/**
 * Schedule auto-save (debounced)
 */
export function scheduleEditorAutoSave(): void {
  if (autoSaveTimer) {
    clearTimeout(autoSaveTimer);
  }

  autoSaveTimer = setTimeout(() => {
    saveEditorState();
    autoSaveTimer = null;
  }, AUTO_SAVE_DEBOUNCE_MS);
}
