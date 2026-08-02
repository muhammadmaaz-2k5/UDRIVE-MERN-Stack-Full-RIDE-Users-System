# Sprint 2: Authentication & Onboarding

## Objective
Implement secure user authentication, onboarding flows, and protected routing.

## Tasks
1. **Welcome/Splash Screen**
   - Create `src/pages/Welcome.tsx`.
   - Implement engaging micro-animations (e.g., car driving across screen, logo reveal).
   - Role selection: "I need a ride" (Customer) vs "I want to drive" (Rider).

2. **Login & Registration Views**
   - Create `src/pages/Login.tsx` and `src/pages/Register.tsx`.
   - Implement form validation.
   - Add loading states to Buttons during API calls.

3. **API Integration**
   - Create `src/services/api.ts` utilizing native `fetch` or `axios`.
   - Implement `registerUser` and `loginUser` functions.
   - Connect API functions to Login/Register components.

4. **Protected Routing & Token Management**
   - Securely store JWT access and refresh tokens.
   - Create a `ProtectedRoute.tsx` wrapper that checks `useAuthStore`.
   - Redirect unauthenticated users to `/login`.
   - Redirect authenticated users to their respective dashboards based on role.

## Definition of Done
- Users can successfully register and login.
- JWT tokens are saved and managed properly.
- Unauthenticated access to dashboard routes is prevented.
- UI features smooth transitions between auth states.
