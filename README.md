<div align="center">

# Scioly.app

### A better operating system for Science Olympiad teams.

Plan smarter. Prepare together. Compete ready.

[![Live App](https://img.shields.io/badge/Live_App-111111?style=for-the-badge&logo=vercel&logoColor=white)](https://scioly.app/)
[![TypeScript](https://img.shields.io/badge/TypeScript-111111?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-111111?style=for-the-badge&logo=react&logoColor=white)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-111111?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![Supabase](https://img.shields.io/badge/Supabase-111111?style=for-the-badge&logo=supabase&logoColor=white)](https://supabase.com/)

</div>

---

## Why Scioly.app

Science Olympiad teams do not lose because students lack motivation. They lose time to scattered resources, unclear ownership, inconsistent preparation, and no shared view of what needs to happen next.

Scioly.app is the workspace I wanted as a team president: one place for students and leaders to organize events, manage preparation, track progress, and prepare deliberately for competition.

> Built by a Science Olympiad student for Science Olympiad teams.

## What it is becoming

- **Team workspace** for organizing members, events, and preparation
- **Study system** for turning event material into actionable practice
- **Operations hub** for leaders managing team workflows and competition readiness
- **Profiles and progress** that help students see what to work on next
- **Admin tooling** for keeping the team organized without relying on scattered documents and group chats

Scioly.app is in active development. Features and workflows will evolve as the product is tested with real team needs.

## Technology

| Layer | Tools |
|---|---|
| Frontend | React, TypeScript, Vite |
| Styling | CSS, component-level design system |
| Backend and authentication | Supabase |
| Deployment | Vercel |
| Code quality | TypeScript, ESLint/Oxlint, GitHub |

## Local development

### Requirements

- Node.js 18+
- npm
- A Supabase project for authentication and database-backed features

### Setup

```bash
git clone https://github.com/OrangJaguar/sciolyapp.git
cd sciolyapp
npm install
```

Create a `.env` file based on `.env.example`:

```bash
cp .env.example .env
```

Add your project environment variables:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

Start the development server:

```bash
npm run dev
```

Open the local URL shown in your terminal.

## Project structure

```text
src/
├── components/      # Shared UI building blocks
├── features/        # Feature-specific logic, including auth and theme handling
├── pages/           # Application routes and product surfaces
│   ├── admin/       # Team administration workflows
│   ├── auth/        # Authentication flows
│   ├── cmd/         # Command-center experience
│   ├── ops/         # Team operations workflows
│   └── profile/     # User profile experience
├── lib/             # Shared application utilities
├── mocks/           # Development and prototype data
└── styles/          # Global and reusable styling
```

## Status

**Active development.**

The repository is public so builders, students, and Science Olympiad leaders can follow the project’s direction. The product is still evolving, and not every planned workflow is complete or production-ready.

## Contributing

Feedback from Science Olympiad students, coaches, captains, and alumni is welcome.

If you have an idea, a workflow that frustrates your team, or a feature request, open an issue with:

- Your role on the team
- The current process you use
- What breaks or wastes time
- What a better workflow would look like

## License

This project is currently not licensed for external redistribution or commercial use. See the repository owner before reusing substantial portions of the code.

---

<div align="center">

Built by [Sanskar Gupta](https://github.com/OrangJaguar)  
[Live app](https://scioly.app/) · [GitHub profile](https://github.com/OrangJaguar)

</div>
