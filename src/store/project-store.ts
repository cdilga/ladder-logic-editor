/**
 * Project Store
 *
 * Manages the overall project state including programs, variables, and configuration.
 * Source of Truth: Structured Text (ST)
 */

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type {
  LadderProject,
  ProgramUnit,
  ProjectConfiguration,
} from '../models/project';
import type { VariableDeclaration } from '../models/plc-types';
import type { LadderNode, LadderEdge } from '../models/ladder-elements';
import { createNewProject, createTrafficControllerProgram, createDualPumpControllerProgram } from '../models/project';
import { createDefaultIntersection } from '../models/traffic-controller';
import { transformSTToLadder, type TransformResult } from '../transformer';
import { loadFromLocalStorage } from '../services/file-service';

// ============================================================================
// State Interface
// ============================================================================

interface ProjectState {
  // Project data
  project: LadderProject | null;
  currentProgramId: string | null;
  isDirty: boolean;

  // File state
  filePath: string | null;

  // Transformer state
  lastTransformResult: TransformResult | null;
  transformedNodes: LadderNode[];
  transformedEdges: LadderEdge[];

  // Actions
  newProject: (name: string) => void;
  newTrafficControllerProject: (name: string) => void;
  newDualPumpControllerProject: (name: string) => void;
  loadProject: (project: LadderProject, filePath?: string, currentProgramId?: string) => void;
  loadFromSTCode: (programName: string, stCode: string, fileName?: string) => void;
  saveProject: () => LadderProject | null;
  markDirty: () => void;
  markClean: () => void;

  // Program actions
  setCurrentProgram: (programId: string) => void;
  getCurrentProgram: () => ProgramUnit | null;
  updateProgramST: (programId: string, st: string) => void;
  addProgram: (program: ProgramUnit) => void;
  removeProgram: (programId: string) => void;

  // Transformer actions
  transformCurrentProgram: () => TransformResult | null;
  getTransformedDiagram: () => { nodes: LadderNode[]; edges: LadderEdge[] };

  // Variable actions
  addGlobalVariable: (variable: VariableDeclaration) => void;
  updateGlobalVariable: (name: string, variable: Partial<VariableDeclaration>) => void;
  removeGlobalVariable: (name: string) => void;

  // Configuration actions
  setConfiguration: (config: ProjectConfiguration) => void;
}

// ============================================================================
// Store Implementation
// ============================================================================

export const useProjectStore = create<ProjectState>()(
  subscribeWithSelector((set, get) => ({
    // Initial state
    project: null,
    currentProgramId: null,
    isDirty: false,
    filePath: null,
    lastTransformResult: null,
    transformedNodes: [],
    transformedEdges: [],

    // Create new empty project
    newProject: (name: string) => {
      const project = createNewProject(name);
      set({
        project,
        currentProgramId: project.programs[0]?.id || null,
        isDirty: false,
        filePath: null,
      });
    },

    // Create new traffic controller project
    newTrafficControllerProject: (name: string) => {
      const project = createNewProject(name);

      // Replace default program with traffic controller
      project.programs = [createTrafficControllerProgram()];

      // Add traffic controller configuration
      project.configuration = {
        type: 'traffic-controller',
        network: {
          id: 'main_network',
          name: 'Main Intersection Network',
          intersections: [createDefaultIntersection('INT_1', 'Main Intersection')],
          coordination: [],
          masterCycleTime: 130000,
        },
      };

      set({
        project,
        currentProgramId: project.programs[0]?.id || null,
        isDirty: false,
        filePath: null,
      });
    },

    // Create new dual pump controller project
    newDualPumpControllerProject: (name: string) => {
      const project = createNewProject(name);

      // Replace default program with dual pump controller
      project.programs = [createDualPumpControllerProgram()];

      set({
        project,
        currentProgramId: project.programs[0]?.id || null,
        isDirty: false,
        filePath: null,
      });
    },

    // Load existing project
    loadProject: (project: LadderProject, filePath?: string, currentProgramId?: string) => {
      // Use provided currentProgramId if valid, otherwise fall back to first program
      const validProgramId = currentProgramId && project.programs.some(p => p.id === currentProgramId)
        ? currentProgramId
        : project.programs[0]?.id || null;

      set({
        project,
        currentProgramId: validProgramId,
        isDirty: false,
        filePath: filePath || null,
      });
    },

    // Load from ST code directly (ST is source of truth)
    loadFromSTCode: (programName: string, stCode: string, fileName?: string) => {
      const now = new Date().toISOString();
      const programId = `program_${Date.now()}`;

      // Determine program type from ST code
      const typeMatch = stCode.match(/^(PROGRAM|FUNCTION_BLOCK|FUNCTION)\s+/im);
      const programType = (typeMatch?.[1]?.toUpperCase() || 'PROGRAM') as 'PROGRAM' | 'FUNCTION_BLOCK' | 'FUNCTION';

      const project: LadderProject = {
        meta: {
          version: '1.0',
          name: programName,
          created: now,
          modified: now,
          editorVersion: '1.0.0',
        },
        programs: [
          {
            id: programId,
            name: programName,
            type: programType,
            structuredText: stCode,
            lastSyncSource: 'st',
            syncValid: true,
            variables: [],
          },
        ],
        globalVariables: [],
      };

      set({
        project,
        currentProgramId: programId,
        isDirty: false,
        filePath: fileName || null,
      });
    },

    // Save project (returns project for serialization)
    saveProject: () => {
      const { project } = get();
      if (!project) return null;

      // Update modified timestamp
      project.meta.modified = new Date().toISOString();

      set({ isDirty: false });
      return project;
    },

    markDirty: () => set({ isDirty: true }),
    markClean: () => set({ isDirty: false }),

    // Program management
    setCurrentProgram: (programId: string) => {
      set({ currentProgramId: programId });
    },

    getCurrentProgram: () => {
      const { project, currentProgramId } = get();
      if (!project || !currentProgramId) return null;
      return project.programs.find((p) => p.id === currentProgramId) || null;
    },

    updateProgramST: (programId: string, st: string) => {
      const { project } = get();
      if (!project) return;

      const programIndex = project.programs.findIndex((p) => p.id === programId);
      if (programIndex === -1) return;

      const updatedPrograms = [...project.programs];
      updatedPrograms[programIndex] = {
        ...updatedPrograms[programIndex],
        structuredText: st,
        lastSyncSource: 'st',
        syncValid: true, // Will be validated by transformer
      };

      set({
        project: { ...project, programs: updatedPrograms },
        isDirty: true,
      });
    },

    addProgram: (program: ProgramUnit) => {
      const { project } = get();
      if (!project) return;

      set({
        project: {
          ...project,
          programs: [...project.programs, program],
        },
        isDirty: true,
      });
    },

    removeProgram: (programId: string) => {
      const { project, currentProgramId } = get();
      if (!project) return;

      const updatedPrograms = project.programs.filter((p) => p.id !== programId);

      // Update current program if necessary
      let newCurrentId = currentProgramId;
      if (currentProgramId === programId) {
        newCurrentId = updatedPrograms[0]?.id || null;
      }

      set({
        project: { ...project, programs: updatedPrograms },
        currentProgramId: newCurrentId,
        isDirty: true,
      });
    },

    // Transformer actions
    transformCurrentProgram: () => {
      const program = get().getCurrentProgram();
      if (!program) return null;

      const result = transformSTToLadder(program.structuredText, {
        warnOnUnsupported: true,
        includeIntermediates: true, // Include AST for interpreter execution
      });

      set({
        lastTransformResult: result,
        transformedNodes: result.nodes,
        transformedEdges: result.edges,
      });

      // Update the program's ladder if successful
      if (result.success && result.diagram) {
        const { project } = get();
        if (project) {
          const updatedPrograms = project.programs.map((p) =>
            p.id === program.id
              ? { ...p, ladder: result.diagram, syncValid: true }
              : p
          );
          set({ project: { ...project, programs: updatedPrograms } });
        }
      }

      return result;
    },

    getTransformedDiagram: () => {
      const { transformedNodes, transformedEdges } = get();
      return { nodes: transformedNodes, edges: transformedEdges };
    },

    // Global variables
    addGlobalVariable: (variable: VariableDeclaration) => {
      const { project } = get();
      if (!project) return;

      set({
        project: {
          ...project,
          globalVariables: [...project.globalVariables, variable],
        },
        isDirty: true,
      });
    },

    updateGlobalVariable: (name: string, updates: Partial<VariableDeclaration>) => {
      const { project } = get();
      if (!project) return;

      const updatedVars = project.globalVariables.map((v) =>
        v.name === name ? { ...v, ...updates } : v
      );

      set({
        project: { ...project, globalVariables: updatedVars },
        isDirty: true,
      });
    },

    removeGlobalVariable: (name: string) => {
      const { project } = get();
      if (!project) return;

      set({
        project: {
          ...project,
          globalVariables: project.globalVariables.filter((v) => v.name !== name),
        },
        isDirty: true,
      });
    },

    // Configuration
    setConfiguration: (config: ProjectConfiguration) => {
      const { project } = get();
      if (!project) return;

      set({
        project: { ...project, configuration: config },
        isDirty: true,
      });
    },
  }))
);

// ============================================================================
// Initialization (call once on app startup)
// ============================================================================

let initialized = false;

/**
 * Initialize the project store from localStorage on app startup.
 * Should be called once in main.tsx before the app renders.
 */
export function initializeProjectStore(): void {
  if (initialized) return;
  initialized = true;

  const saved = loadFromLocalStorage();
  if (saved) {
    useProjectStore.getState().loadProject(saved.project, undefined, saved.currentProgramId);
  } else {
    useProjectStore.getState().newProject('New Project');
  }
}
