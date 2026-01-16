/**
 * CodeExample Component Tests
 *
 * Tests for the "Try in Editor" functionality that:
 * 1. Creates a new file with the correct content using EditorStore
 * 2. Switches to editor view on mobile
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { CodeExample } from './CodeExample';

// Track mock calls
const mockOpenFile = vi.fn().mockReturnValue('new-file-id');
const mockNavigate = vi.fn();
const mockSetActiveView = vi.fn();
const mockScheduleEditorAutoSave = vi.fn();

// Track isMobile state for tests
let mockIsMobile = false;

// Mock existing files in the editor store
let mockFiles = new Map();

// Mock react-router-dom
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Mock editor store
vi.mock('../../store/editor-store', () => ({
  useEditorStore: {
    getState: () => ({
      files: mockFiles,
      openFile: mockOpenFile,
    }),
  },
  scheduleEditorAutoSave: () => mockScheduleEditorAutoSave(),
}));

// Mock mobile store
vi.mock('../../store/mobile-store', () => ({
  useMobileStore: {
    getState: () => ({
      isMobile: mockIsMobile,
      setActiveView: mockSetActiveView,
    }),
  },
}));

describe('CodeExample', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsMobile = false;
    mockFiles = new Map();
  });

  const renderCodeExample = (props = {}) => {
    return render(
      <MemoryRouter>
        <CodeExample code="Motor := Start AND NOT Stop;" {...props} />
      </MemoryRouter>
    );
  };

  describe('Try in Editor button', () => {
    it('renders the Try in Editor button', () => {
      renderCodeExample();
      expect(screen.getByText('Try in Editor')).toBeInTheDocument();
    });

    it('creates a new file with the example code when clicked', () => {
      const testCode = 'Motor := Start AND NOT Stop;';
      renderCodeExample({ code: testCode });

      fireEvent.click(screen.getByText('Try in Editor'));

      // Verify openFile was called with correct arguments
      expect(mockOpenFile).toHaveBeenCalledTimes(1);
      expect(mockOpenFile).toHaveBeenCalledWith('Example', testCode);
    });

    it('uses provided title as file name', () => {
      renderCodeExample({ code: 'x := 1;', title: 'Counter Demo' });

      fireEvent.click(screen.getByText('Try in Editor'));

      expect(mockOpenFile).toHaveBeenCalledWith('Counter Demo', 'x := 1;');
    });

    it('generates unique name if title conflicts with existing file', () => {
      // Add an existing file with the same name
      mockFiles = new Map([
        ['file-1', { id: 'file-1', name: 'Existing Program.st', content: '' }],
      ]);

      renderCodeExample({ code: 'x := 1;', title: 'Existing Program' });

      fireEvent.click(screen.getByText('Try in Editor'));

      // Should append a number to make it unique
      expect(mockOpenFile).toHaveBeenCalledWith('Existing Program 1', 'x := 1;');
    });

    it('schedules auto-save after opening file', () => {
      renderCodeExample();

      fireEvent.click(screen.getByText('Try in Editor'));

      expect(mockScheduleEditorAutoSave).toHaveBeenCalled();
    });

    it('navigates to the editor root', () => {
      renderCodeExample();

      fireEvent.click(screen.getByText('Try in Editor'));

      expect(mockNavigate).toHaveBeenCalledWith('/');
    });
  });

  describe('Mobile behavior', () => {
    beforeEach(() => {
      mockIsMobile = true;
    });

    it('switches to editor view on mobile when Try in Editor is clicked', () => {
      renderCodeExample();

      fireEvent.click(screen.getByText('Try in Editor'));

      // Should set active view to 'editor' on mobile
      expect(mockSetActiveView).toHaveBeenCalledWith('editor');
    });
  });

  describe('Desktop behavior', () => {
    beforeEach(() => {
      mockIsMobile = false;
    });

    it('does not call setActiveView on desktop', () => {
      renderCodeExample();

      fireEvent.click(screen.getByText('Try in Editor'));

      // Should NOT call setActiveView on desktop
      expect(mockSetActiveView).not.toHaveBeenCalled();
    });
  });
});

describe('CodeExample copy functionality', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFiles = new Map();
  });

  it('displays the code content', () => {
    const testCode = 'TestVar := TRUE;';
    render(
      <MemoryRouter>
        <CodeExample code={testCode} />
      </MemoryRouter>
    );

    expect(screen.getByText(testCode)).toBeInTheDocument();
  });

  it('displays title when provided', () => {
    render(
      <MemoryRouter>
        <CodeExample code="x := 1;" title="Example Title" />
      </MemoryRouter>
    );

    expect(screen.getByText('Example Title')).toBeInTheDocument();
  });
});
