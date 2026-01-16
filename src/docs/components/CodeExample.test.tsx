/**
 * CodeExample Component Tests
 *
 * Tests for the "Try in Editor" functionality that:
 * 1. Creates a new file/program with the correct content
 * 2. Switches to editor view on mobile
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { CodeExample } from './CodeExample';

// Track mock calls
const mockAddProgram = vi.fn();
const mockSetCurrentProgram = vi.fn();
const mockNavigate = vi.fn();
const mockSetActiveView = vi.fn();

// Track isMobile state for tests
let mockIsMobile = false;

// Mock react-router-dom
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Mock uuid
vi.mock('uuid', () => ({
  v4: () => 'test-uuid-123',
}));

// Mock project store
vi.mock('../../store', () => ({
  useProjectStore: {
    getState: () => ({
      project: {
        programs: [{ id: 'existing-1', name: 'Existing Program' }],
      },
      addProgram: mockAddProgram,
      setCurrentProgram: mockSetCurrentProgram,
    }),
  },
}));

// Mock file service
vi.mock('../../services/file-service', () => ({
  saveToLocalStorage: vi.fn(),
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

    it('creates a new program with the example code when clicked', () => {
      const testCode = 'Motor := Start AND NOT Stop;';
      renderCodeExample({ code: testCode });

      fireEvent.click(screen.getByText('Try in Editor'));

      // Verify addProgram was called with correct structure
      expect(mockAddProgram).toHaveBeenCalledTimes(1);
      const addedProgram = mockAddProgram.mock.calls[0][0];

      expect(addedProgram).toMatchObject({
        id: 'test-uuid-123',
        name: 'Example',
        type: 'PROGRAM',
        structuredText: testCode,
        syncValid: true,
        lastSyncSource: 'st',
        variables: [],
      });
    });

    it('uses provided title as program name', () => {
      renderCodeExample({ code: 'x := 1;', title: 'Counter Demo' });

      fireEvent.click(screen.getByText('Try in Editor'));

      const addedProgram = mockAddProgram.mock.calls[0][0];
      expect(addedProgram.name).toBe('Counter Demo');
    });

    it('generates unique name if title conflicts with existing program', () => {
      // Mock store has 'Existing Program' already
      renderCodeExample({ code: 'x := 1;', title: 'Existing Program' });

      fireEvent.click(screen.getByText('Try in Editor'));

      const addedProgram = mockAddProgram.mock.calls[0][0];
      expect(addedProgram.name).toBe('Existing Program 1');
    });

    it('sets the new program as current', () => {
      renderCodeExample();

      fireEvent.click(screen.getByText('Try in Editor'));

      expect(mockSetCurrentProgram).toHaveBeenCalledWith('test-uuid-123');
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
