# Togetherly — AI-Powered Workforce Intelligence

**Smarter workforce planning. Better team composition. Balanced workloads.**

Togetherly is a workforce intelligence platform that helps organizations make decisions about employee allocation, project staffing, skill development, and workload distribution. It brings workforce information and decision-support tools into one dashboard so managers can identify suitable employees, discover skill gaps, evaluate team composition, and improve workforce utilization.

- **Repository:** https://github.com/Faizankhan-cyber/togetherly-workforce
- **Live demo:** https://togetherly-omega.vercel.app/

## Problem

Employee skills, experience, availability, and workload are often spread across different systems, making workforce planning inefficient and difficult to manage. This can lead to:

- Poor employee-project matching
- Skill gaps that delay project delivery
- Uneven workloads and employee underutilization
- Limited visibility into workforce capabilities
- Inefficient team composition and resource allocation

Togetherly addresses these challenges with a centralized workforce intelligence platform.

## Solution

Togetherly combines employee management, project staffing, skills analysis, workload planning, and workforce analytics in a unified interface. It helps managers make informed workforce decisions using employee data, explainable matching scores, and workforce insights.

## Features

### Workforce Twin

The Workforce Twin is Togetherly’s flagship feature. It lets managers:

- Define project requirements, including required skills, experience, and team size
- Generate ranked employee recommendations
- Evaluate candidates by skill compatibility, experience, and workload availability
- Review explainable matching scores
- Modify proposed teams and compare team compositions
- Review skill coverage before confirming an allocation

**Prototype matching weights:**

| Factor | Weight |
|---|---:|
| Skill match | 50% |
| Experience | 25% |
| Availability and workload fit | 25% |

These weights represent the prototype’s matching approach and can be adjusted as the system evolves.

### Employee Management

- View employee profiles and workforce information
- Review technical skills and experience
- Examine availability and workload
- Identify candidates for project requirements

### Skills and Training

- Identify gaps between employee skills and project requirements
- Highlight areas where additional training may be useful
- Connect skill analysis with training recommendations

### Workload Planner

- Review employee workload distribution
- Identify potential overutilization and underutilization
- Explore alternative workforce allocations
- Support more balanced project planning

### Analytics and Reports

- Review workforce and project information
- Examine skill distribution and resource utilization
- Support data-informed workforce planning through a centralized analytics interface

### Dashboard

The dashboard provides an overview of workforce information, projects, and relevant workforce indicators.

### TinyFish Intelligence

TinyFish is Togetherly’s live web-intelligence layer, connecting external web research to workforce planning:

- **Search:** discover current public sources on hiring demand, emerging skills, and technology trends.
- **Fetch:** extract clean, readable content from selected public pages.
- **Agent:** delegate a goal-directed, read-only multi-step research task to a web agent and review its structured result.
- **Connected workflow:** search results can be opened with Fetch or used as the Agent starting point.

TinyFish research supports decisions; it does not automatically change employee records, project allocations, or internal match scores. Agent runs can consume TinyFish credits.


### Role-Based Demo Views

A demo role switcher provides manager/HR and employee views to demonstrate how information and actions can differ by role.

> Demo role switching is not production authentication or authorization.

## How the Workforce Twin Works

1. **Define the project:** Enter required skills, experience, and team size.
2. **Evaluate employees:** Compare employee profiles with project requirements.
3. **Calculate matching scores:** Combine skill compatibility, experience, and workload fit using the configured weights.
4. **Rank candidates:** Present suitable employees with explainable recommendations.
5. **Build the team:** Add, remove, or replace proposed team members.
6. **Evaluate the team:** Review team composition and skill coverage.
7. **Confirm allocation:** Finalize the proposed allocation through the application workflow.

The matching mechanism is a decision-support approach. Its recommendations should assist managers, not replace human judgment.

## Application Modules

| Module | Purpose |
|---|---|
| Dashboard | Workforce overview |
| Employees | Employee profiles and capabilities |
| Projects | Project and staffing requirements |
| Workforce Twin | Employee matching and team composition |
| Skills & Training | Skill gaps and learning opportunities |
| Workload Planner | Workload analysis and allocation planning |
| TinyFish Intelligence | Live web research via Search, Fetch, and Agent |
| Analytics & Reports | Workforce insights |
| Settings | Application preferences |
| Employee View | Employee-focused demo experience |

## Technology Stack

| Technology | Purpose |
|---|---|
| React | User interface |
| TypeScript | Type safety |
| Vite | Development server and build tooling |
| Tailwind CSS | Styling and responsive layouts |
| Lucide React | Icons |
| Recharts | Data visualization |
| TinyFish Search, Fetch, Agent | External live web intelligence and goal-based research workflows |
| React Router | Page navigation |
| Local storage / shared application state | Prototype data persistence |

**Blockchain is not a core component of this project.** Togetherly focuses on workforce intelligence and resource optimization.

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) compatible with the project’s dependencies
- npm
- Git

### Clone the repository

```bash
git clone https://github.com/Faizankhan-cyber/togetherly-workforce.git
cd togetherly-workforce
```

### Install dependencies

```bash
npm install
```

### Start the development server

```bash
npm run dev
```

Open the local URL printed in your terminal to access the application.

### Build and preview

```bash
npm run build
npm run preview
```

## Use Cases

Togetherly can support organizations that need to:

- Staff projects according to employee skills and experience
- Identify internal candidates for new assignments
- Detect skill gaps before project execution
- Recommend areas for employee development
- Identify workload imbalances
- Compare potential team compositions
- Improve visibility into workforce capabilities

## Security and Privacy

Togetherly is a hackathon prototype and should not be treated as a production HR system without further security work.

Before real-world deployment, the platform would require appropriate authentication, authorization, secure data storage, input validation, privacy controls, and auditability. Employee data should be handled according to applicable privacy requirements.

## Potential Future Enhancements

- Integration with real HR management systems
- Secure authentication and granular role-based access control
- Database-backed employee and project management
- Advanced optimization algorithms for team composition
- Integration with learning management systems
- Predictive workload and resource-demand forecasting
- Audit logs and explainable allocation history
- AI-assisted workforce insights using validated models and real organizational data

## Project

Togetherly was developed as a hackathon workforce management and intelligence solution focused on employee-project matching, team optimization, skill-gap analysis, and workload balancing. It demonstrates how a centralized platform and explainable matching logic can support more structured workforce planning.

**Category:** Workforce Management / Workforce Intelligence  
**Live demo:** https://togetherly-omega.vercel.app/

**Togetherly: The right people, on the right projects, with the right balance.**

## License

No license is currently specified in this repository. Until a license is added, do not assume the source is licensed for reuse.
