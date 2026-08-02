# Sprint 1: Foundation & Design System

## Objective
Establish the core architecture, state management, and design system for the UDRIVE frontend.

## Tasks
1. **Project Setup & Dependencies**
   - Clean up Vite boilerplate.
   - Install `zustand`, `react-router-dom`, `socket.io-client`.
   - Setup project structure (`src/components`, `src/pages`, `src/store`, `src/services`, `src/styles`).

2. **Design System (Vanilla CSS)**
   - Create `src/styles/variables.css` for colors, typography, spacing, and glassmorphic effects.
   - Implement global reset and base styles in `index.css`.
   - Design a premium, modern aesthetic (dark mode by default, vibrant accents).

3. **Global State (Zustand)**
   - Create `src/store/useAuthStore.ts` to manage user authentication state, roles, and tokens.
   - Create `src/store/useRideStore.ts` to manage current ride state and location.

4. **Shared UI Components**
   - `Button.tsx`: Primary, secondary, loading states, micro-animations on hover.
   - `Input.tsx`: Floating labels, validation states, smooth focus rings.
   - `Loader.tsx`: Custom animated loader matching the brand.
   - `Modal.tsx`: Reusable dialog with backdrop blur (glassmorphism).

## Definition of Done
- All core dependencies are installed and configured.
- The design system variables are defined and applied globally.
- Zustand stores are accessible across components.
- Shared UI components are built and visually tested.
