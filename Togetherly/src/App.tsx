import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { DataProvider } from '@/context/DataContext';
import { AppLayout } from '@/components/AppLayout';
import { DashboardPage } from '@/pages/DashboardPage';
import { EmployeesPage } from '@/pages/EmployeesPage';
import { ProjectsPage } from '@/pages/ProjectsPage';
import { TeamBuilderPage } from '@/pages/TeamBuilderPage';
import { SkillsTrainingPage } from '@/pages/SkillsTrainingPage';
import { WorkloadPlannerPage } from '@/pages/WorkloadPlannerPage';
import { AnalyticsPage } from '@/pages/AnalyticsPage';
import { SettingsPage } from '@/pages/SettingsPage';

function App() {
  return (
    <DataProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/employees" element={<EmployeesPage />} />
            <Route path="/projects" element={<ProjectsPage />} />
            <Route path="/team-builder" element={<TeamBuilderPage />} />
            <Route path="/skills" element={<SkillsTrainingPage />} />
            <Route path="/workload" element={<WorkloadPlannerPage />} />
            <Route path="/analytics" element={<AnalyticsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </DataProvider>
  );
}

export default App;
