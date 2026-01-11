# HMI Visualization Layer Spec

**Goal:** Enable users to wire up visual hardware components (traffic lights, LEDs, motors) to ST variables and watch their code run in real-time.

---

## Vision

Users write ST code that controls outputs (e.g., `TrafficLight_Red := TRUE`). A visual canvas displays hardware components that react to these variables in real-time. This creates the "see your code run" experience described in the product vision.

---

## Foundation (What Exists)

| Component | Location | Capability |
|-----------|----------|------------|
| Simulation Store | `store/simulation-store.ts` | Tracks all variable types (BOOL, INT, REAL, timers, counters) |
| ST Interpreter | `interpreter/` | Full execution of ST code with scan cycles |
| Simulation Loop | `MainLayout.tsx` | 100ms scan cycle, updates store |
| Traffic Controller Model | `models/traffic-controller.ts` | Domain types for traffic phases and light states |
| Variable Watch | `components/variable-watch/` | Live variable display with editing |

The interpreter already executes traffic light logic. The missing piece is visualization.

---

## What Needs to Be Built

### 1. HMI Canvas
A panel/area where users can see visual representations of hardware components.

**Considerations:**
- Where does it fit in the layout? (new panel, overlay, tab?)
- Fixed layout vs. user-arrangeable components?
- How does it scale with multiple components?

### 2. Visual Components
React components that render hardware visuals and subscribe to simulation state.

**Initial component set:**
- Traffic light (3-color vertical signal)
- LED indicator (single on/off light)
- Push button (input - user can click to set variable)
- Motor/pump indicator

**Considerations:**
- SVG vs. Canvas vs. CSS-based rendering?
- How are components configured (which variables they watch)?
- Styling/theming for different visual styles?

### 3. Variable Binding
A system to connect ST variables to component properties.

**Example concept:**
```
Component: TrafficLight
Bindings:
  - red ← TL1_RED (BOOL)
  - yellow ← TL1_YEL (BOOL)
  - green ← TL1_GRN (BOOL)
```

**Considerations:**
- Configuration format (JSON, inline props, visual wiring?)
- Validation (variable exists, correct type?)
- Bidirectional for inputs (button press → variable)?

### 4. Component Configuration
How users specify which components appear and what they're connected to.

**Considerations:**
- Stored in project file alongside ST code?
- Visual drag-and-drop placement vs. config file?
- Predefined scenarios (traffic light demo) vs. user-built?

---

## Integration Points

| Integration | Notes |
|-------------|-------|
| `useSimulationStore` | Components subscribe to variable changes via Zustand selectors |
| `MainLayout.tsx` | HMI canvas needs to be added to the layout |
| Project Store | HMI config should persist with the project |
| Traffic Controller Model | Can inform default variable naming conventions |

---

## Open Questions

1. **Layout approach** - Separate panel? Resizable? Tabs between ladder/HMI?
2. **Component placement** - Fixed grid? Free-form canvas? Config-driven?
3. **Predefined vs. custom** - Ship with traffic light scenario? Let users build from scratch?
4. **Input handling** - How do simulated buttons/switches work? Click to toggle?
5. **Scaling** - What happens with 20+ components? Performance?

---

## Success Criteria

- User can load a traffic light ST program
- Traffic light visual displays in HMI canvas
- Lights change color as simulation runs
- User can see correlation between ST code execution and visual output

---

*This enables the product vision: "wire up hardware like traffic lights... and visualize and simulate their operation"*
