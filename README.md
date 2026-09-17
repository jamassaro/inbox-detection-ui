# Inbox Detective UI

A React application for detecting and managing offers from your inbox. Built with TypeScript, Vite, Tailwind CSS, and Docker.

## Live API vs mock mode

By default the app talks to the Inbox-api backend: every page reads through
`apiFetch` + TanStack Query (`src/hooks/`), pointed at `VITE_API_BASE_URL`.

Set `VITE_USE_MOCKS=true` to develop without a backend: `src/mocks/mockApi.ts`
installs a contract-faithful, in-memory `window.fetch` layer (signed in as a
Pro user with sample discoveries) before React mounts. Mock mode mirrors the
real routes (`/account/me`, `/account/connections`, `/billing/status`,
`/discoveries`, `/investigation`, …) and is covered by its own test suite —
it is a dev convenience, never a second source of truth.

```bash
cp .env.example .env   # then adjust; VITE_USE_MOCKS=false means live API
```

## 🎨 Features

- **Offers Dashboard**: View all offers found in your inbox
- **Featured Offers**: Highlighted deals that are ending soon or newly added
- **Filtering**: Filter by All, Ending Soon, New, or Saved offers
- **Search**: Search companies or offers
- **Navigation**: Easy sidebar navigation between Offers, Companies, and Saved pages
- **Responsive Design**: Clean, modern UI built with Tailwind CSS

## 🚀 Quick Start

### Local Development
```bash
npm install
npm run dev
```
Visit: http://localhost:5173

### Production Build
```bash
npm run build
npm run preview
```

## 🐳 Docker Setup

### Development Mode
```bash
docker-compose up dev
```
Visit: http://localhost:5173

### Production Mode
```bash
docker-compose up prod
```
Visit: http://localhost:8080

## 📁 Project Structure

```
src/
├── components/        # Reusable UI components
│   ├── Sidebar.tsx
│   ├── StatCard.tsx
│   ├── FeaturedOfferCard.tsx
│   └── OfferListItem.tsx
├── pages/            # Page components
│   ├── OffersPage.tsx
│   ├── CompaniesPage.tsx
│   └── SavedPage.tsx
├── data/             # Mock data
│   └── mockOffers.ts
├── types/            # TypeScript types
│   └── index.ts
├── App.tsx           # Main app with routing
└── main.tsx          # App entry point
```

## 🛠 Tech Stack

- **React 19** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **Tailwind CSS** - Styling
- **React Router** - Navigation
- **Lucide React** - Icons
- **Docker** - Containerization

## 📝 Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run linter


Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend enabling type-aware lint rules by installing `oxlint-tsgolint` and editing `.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

See the [Oxlint rules documentation](https://oxc.rs/docs/guide/usage/linter/rules) for the full list of rules and categories.
