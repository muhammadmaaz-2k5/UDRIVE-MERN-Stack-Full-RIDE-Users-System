# UDRIVE Workspace Rules

## UI & Aesthetics
- **Vanilla CSS First**: Prioritize Vanilla CSS for styling. Use CSS variables in a `variables.css` file for color palettes, spacing, and typography.
- **Premium Design**: Ensure a "WOW" factor. Avoid generic solid colors. Incorporate glassmorphism (backdrop-blur, subtle borders) and smooth gradients.
- **Animations**: Always include micro-interactions. Use smooth transitions on hover, focus, and state changes.
- **Typography**: Use modern Google Fonts (e.g., Inter, Outfit) and ensure clear hierarchical structure in font sizes and weights.
- **No Placeholders**: Never leave placeholder images. Generate assets using the image generation tool if necessary.

## Architecture & State
- **State Management**: Exclusively use `zustand` for global state. Avoid Context API for complex state.
- **Backend Communication**: Modularize API calls in `src/services/api.ts`. Use `socket.io-client` for real-time events (`src/services/socket.ts`).
- **Authentication**: Include JWT access tokens in the `Authorization` header for protected routes, and in handshake headers for Socket.IO.
- **Component Structure**: Keep components modular and separate business logic from presentation.
