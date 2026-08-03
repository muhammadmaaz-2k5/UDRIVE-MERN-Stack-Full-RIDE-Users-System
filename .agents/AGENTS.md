# Agent Guidelines for UBER Project

These rules guide the AI agents working in this workspace.

## General Behavior
- Always prioritize reading `.rules/uber-guidelines.md` and `.what-we-have/uber-status.md` before making architectural decisions.
- When generating code, ensure it aligns with the existing Tech Stack (Vite + React + Tailwind + Supabase).
- Avoid creating boilerplate code if a reusable component already exists in `UBER/src/components`.

## Tools and Executions
- When running tests, execute them from the `UBER` directory.
- Avoid introducing arbitrary third-party UI libraries like Material UI or Chakra UI; stick to Tailwind CSS and custom components or shadcn/ui if authorized by the user.

## Design Aesthetic
- Ensure all new components look premium. 
- Use modern fonts, smooth micro-animations, and clean layouts suitable for a high-quality mobile-first ride-sharing application.
