# Togetherly | AI-Powered Workforce Intelligence

**Smarter workforce planning. Better team composition. Balanced workloads.**

Togetherly is a workforce intelligence platform for employee management, project staffing, skill-gap analysis, training, workload planning, and workforce analytics. It helps managers compare employee capabilities with project needs and make better-informed staffing decisions.

- **Repository:** https://github.com/Faizankhan-cyber/togetherly-workforce
- **Production app:** https://togetherly-tinyfish.vercel.app/

## Features

### Workforce Twin
- Define project skills, experience, and team-size requirements.
- Generate ranked employee recommendations.
- Compare skill match, experience, and workload availability.
- Review explainable matching scores and skill coverage.
- Adjust proposed teams before confirming an allocation.

**Prototype matching weights**

| Factor | Weight |
|---|---:|
| Skill match | 50% |
| Experience | 25% |
| Availability and workload fit | 25% |

These are prototype weights, not a guarantee that a recommendation is the right staffing decision.

### Employee Management
- View employee profiles, roles, skills, and experience.
- Review availability and workload.
- Support employee profile claims and verification.

### Skills and Training
- Identify gaps between employee skills and project requirements.
- Review training recommendations and submitted completion evidence.
- Support manager, HR, and admin verification workflows.

### Workload Planner and Analytics
- Review workload distribution and utilization.
- Identify possible overuse and underuse.
- Explore alternative staffing plans and workforce indicators.

### TinyFish Intelligence
- Search public sources for hiring demand, skills, and technology trends.
- Fetch readable content from selected public pages.
- Run goal-based, read-only web research.
- Review structured results without automatically changing employee records or project allocations.

TinyFish Agent runs may consume provider credits.

## Roles and access

Togetherly uses Supabase Authentication and database-backed employee identities. Application roles include **Admin, Manager, HR, and Employee**. Access to protected data is controlled by database row-level security policies and application permissions. A role shown in the interface is not a substitute for server-side authorization.

## Technology stack

| Technology | Purpose |
|---|---|
| React, TypeScript | Frontend |
| Vite | Build and development tooling |
| Tailwind CSS | Styling |
| Supabase Auth | User authentication |
| Supabase PostgreSQL | Application database |
| PostgreSQL RLS | Row-level data access control |
| Supabase Storage | Profile images and private evidence files |
| Supabase Edge Functions | Privileged server-side workflows |
| Vercel | Hosting and deployment |
| GitHub Actions | CI checks |
| TinyFish | External web research |

Blockchain is not a core component of Togetherly.

## Run locally

### Requirements
- Node.js 22 or a compatible supported version
- npm
- Git

### Install

```bash
git clone https://github.com/Faizankhan-cyber/togetherly-workforce.git
cd togetherly-workforce
npm ci
```

### Configure environment

Create a local `.env.local` file with the public Supabase project URL and publishable key used by your own development environment. Add any provider key only where the application requires it. Never commit real credentials or service-role keys.

Typical frontend variables:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key
```

### Start the app

```bash
npm run dev
```

Open the local URL printed by Vite.

### Validate a production build

```bash
npm run lint
npm run typecheck
npm run build
```

## Security

Togetherly handles workforce and employee information. Keep the following in mind:

- Do not expose Supabase service-role credentials in frontend code.
- Keep private evidence in private storage buckets and use scoped access.
- Keep row-level security enabled and test access with separate role accounts.
- Use least-privilege GitHub and cloud permissions.
- Review dependency alerts and CI results before merging.
- Do not use real employee data in test environments unless it is approved and protected.

Security findings and remediation status are tracked in [the security documentation](docs/security/).

## Project

Togetherly was developed as a workforce management and intelligence solution focused on employee-project matching, team planning, skill-gap analysis, and workload balancing.

**Category:** Workforce Management / Workforce Intelligence

**Togetherly: The right people, on the right projects, with the right balance.**

## License

No license is currently specified in this repository. Until a license is added, do not assume the source is licensed for reuse.
