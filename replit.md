# Togetherly on Replit

The application lives in `Togetherly/`.

## Run the app

The Replit workflow starts the Vite development server on `0.0.0.0:5000`. To run it manually:

```sh
cd Togetherly
npm run dev -- --host 0.0.0.0 --port 5000
```

Useful checks from the `Togetherly/` directory:

```sh
npm run typecheck
npm run lint
npm run build
```

## Demo data

The Manager / HR and Employee switcher is at the bottom of the sidebar. Employee mode uses Aisha Patel as the demo employee. The selected role and workforce changes persist in this browser; project and employee data are stored in local storage. Use **Settings → Demo Data Reset** to restore the sample workforce and assignments.

The sample dataset has project assignments but no timesheets. Workload percentages are therefore an explicit estimate of 25% per active project assignment, not measured utilization.
