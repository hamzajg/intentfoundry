# IntentFoundry Frontend

IntentFoundry frontend application - a dark industrial workspace for engineering teams.

## Tech Stack
- React 18 + TypeScript
- Vite
- Tailwind CSS
- React Router
- Zustand
- Axios

## Getting Started

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

## Environment Variables

Copy `.env.example` to `.env` and configure:

```
VITE_API_URL=http://localhost:8000/api/v1
```

## Design System

- **Theme**: Dark industrial workspace
- **Colors**: Deep charcoal backgrounds (#0a0a0b), molten amber accent (#d98200)
- **Fonts**: IBM Plex Mono (UI chrome), IBM Plex Sans (content)

## Project Structure

```
src/
├── api/          # API client
├── components/   # UI components
├── pages/        # Page components
├── stores/       # Zustand stores
└── App.tsx       # Router
```