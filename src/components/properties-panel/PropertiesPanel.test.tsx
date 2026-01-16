/**
 * Properties Panel Tests
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PropertiesPanel } from './PropertiesPanel';
import type { LadderNode } from '../../models/ladder-elements';

describe('PropertiesPanel', () => {
  it('shows empty state when no node is selected', () => {
    render(<PropertiesPanel selectedNode={null} />);
    expect(screen.getByText('Select an element')).toBeInTheDocument();
  });

  it('displays contact node properties', () => {
    const contactNode: LadderNode = {
      id: 'contact-1',
      type: 'contact',
      position: { x: 100, y: 50 },
      data: {
        elementType: 'contact',
        id: 'contact-1',
        rungIndex: 0,
        columnIndex: 1,
        variable: 'Start_Button',
        contactType: 'NO',
        negated: false,
      },
    };

    render(<PropertiesPanel selectedNode={contactNode} />);

    expect(screen.getByText('Contact')).toBeInTheDocument();
    expect(screen.getByText('Start_Button')).toBeInTheDocument();
    expect(screen.getByText('NO')).toBeInTheDocument();
  });

  it('displays coil node properties', () => {
    const coilNode: LadderNode = {
      id: 'coil-1',
      type: 'coil',
      position: { x: 200, y: 50 },
      data: {
        elementType: 'coil',
        id: 'coil-1',
        rungIndex: 0,
        columnIndex: 5,
        variable: 'Motor_Run',
        coilType: 'standard',
      },
    };

    render(<PropertiesPanel selectedNode={coilNode} />);

    expect(screen.getByText('Coil')).toBeInTheDocument();
    expect(screen.getByText('Motor_Run')).toBeInTheDocument();
    expect(screen.getByText('standard')).toBeInTheDocument();
  });

  it('displays timer node properties', () => {
    const timerNode: LadderNode = {
      id: 'timer-1',
      type: 'timer',
      position: { x: 150, y: 50 },
      data: {
        elementType: 'timer',
        id: 'timer-1',
        rungIndex: 0,
        columnIndex: 3,
        instanceName: 'TON1',
        timerType: 'TON',
        presetTime: 'T#5s',
      },
    };

    render(<PropertiesPanel selectedNode={timerNode} />);

    expect(screen.getByText('Timer')).toBeInTheDocument();
    expect(screen.getByText('TON1')).toBeInTheDocument();
    expect(screen.getByText('TON')).toBeInTheDocument();
    expect(screen.getByText('T#5s')).toBeInTheDocument();
  });

  it('displays counter node properties', () => {
    const counterNode: LadderNode = {
      id: 'counter-1',
      type: 'counter',
      position: { x: 150, y: 50 },
      data: {
        elementType: 'counter',
        id: 'counter-1',
        rungIndex: 0,
        columnIndex: 3,
        instanceName: 'CTU1',
        counterType: 'CTU',
        presetValue: 10,
      },
    };

    render(<PropertiesPanel selectedNode={counterNode} />);

    expect(screen.getByText('Counter')).toBeInTheDocument();
    expect(screen.getByText('CTU1')).toBeInTheDocument();
    expect(screen.getByText('CTU')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
  });
});
