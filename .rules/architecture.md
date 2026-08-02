# Antigravity Rules: Architecture & State

1. **State Management**: Exclusively use `zustand` for global state (e.g., user authentication, active ride data). Avoid Context API for complex state to prevent unnecessary re-renders.
2. **Backend Communication**: 
   - REST API calls should be modularized in a `src/services/api.ts` file using native `fetch` or `axios`.
   - Real-time communication must use `socket.io-client`. Maintain the socket connection in a dedicated service (`src/services/socket.ts`).
3. **Authentication**: All API requests to protected routes must include the JWT access token in the `Authorization` header. Socket connections must pass the token in the handshake headers.
4. **Component Structure**: Keep components modular. Separate business logic (custom hooks) from presentation components.
