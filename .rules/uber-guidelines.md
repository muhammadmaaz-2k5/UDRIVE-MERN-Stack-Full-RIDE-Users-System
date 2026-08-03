# UDRIVE / UBER Coding Guidelines & Rules

## 1. Code Style and Formatting
- **TypeScript First**: Write all logic and components in TypeScript (`.ts`, `.tsx`). Ensure proper typing for all props and state variables.
- **Tailwind CSS**: Use Tailwind for all styling. Avoid custom CSS unless absolutely necessary (for complex animations or Leaflet overrides).
- **Component Structure**: Follow a modular architecture. Keep components small, focused, and reusable.

## 2. Best Practices
- **State Management**: Use React's built-in hooks (`useState`, `useContext`, `useReducer`) for local and global state before reaching for external libraries.
- **Supabase Integration**: Centralize Supabase client initialization in a `supabase/client.ts` file. Keep database calls separated from UI logic (use custom hooks).
- **Responsive Design**: Ensure the app looks premium and works perfectly on mobile devices, as this is a ride-sharing app.

## 3. Git Workflow
- Write descriptive commit messages.
- Ensure `npm run lint` and `npm run typecheck` pass before pushing code.
