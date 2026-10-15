import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { DataProvider } from '@/context/DataContext';
import { useData } from '@/context/DataContext';
import { AppLayout } from '@/components/AppLayout';

const DashboardPage = lazy(() => import('@/pages/DashboardPage').then((module) => ({ default: module.DashboardPage })));
const EmployeesPage = lazy(() => import('@/pages/EmployeesPage').then((module) => ({ default: module.EmployeesPage })));
const ProjectsPage = lazy(() => import('@/pages/ProjectsPage').then((module) => ({ default: module.ProjectsPage })));
const TeamBuilderPage = lazy(() => import('@/pages/TeamBuilderPage').then((module) => ({ default: module.TeamBuilderPage })));
const SkillsTrainingPage = lazy(() => import('@/pages/SkillsTrainingPage').then((module) => ({ default: module.SkillsTrainingPage })));
const WorkloadPlannerPage = lazy(() => import('@/pages/WorkloadPlannerPage').then((module) => ({ default: module.WorkloadPlannerPage })));
const AnalyticsPage = lazy(() => import('@/pages/AnalyticsPage').then((module) => ({ default: module.AnalyticsPage })));
const SettingsPage = lazy(() => import('@/pages/SettingsPage').then((module) => ({ default: module.SettingsPage })));
const WorkforceTwinPage = lazy(() => import('@/pages/WorkforceTwinPage').then((module) => ({ default: module.WorkforceTwinPage })));
const EmployeeProjectsPage = lazy(() => import('@/pages/EmployeeExperiencePage').then((module) => ({ default: module.EmployeeProjectsPage })));
const DevelopmentRoadmapPage = lazy(() => import('@/pages/DevelopmentRoadmapPage').then((module) => ({ default: module.DevelopmentRoadmapPage })));
const OpportunityFinderPage = lazy(() => import('@/pages/OpportunityFinderPage').then((module) => ({ default: module.OpportunityFinderPage })));
const AllocationImpactPage = lazy(() => import('@/pages/AllocationImpactPage').then((module) => ({ default: module.AllocationImpactPage })));

function ManagerRoutes() {
  const { role } = useData();
  return role === 'manager' ? <Outlet /> : <Navigate to="/" replace />;
}

function EmployeeRoutes() {
  const { role } = useData();
  return role === 'employee' ? <Outlet /> : <Navigate to="/" replace />;
}

function App() {
  return (
    <DataProvider>
      <BrowserRouter>
        <Suspense fallback={<div className="grid min-h-screen place-items-center text-sm text-text-secondary" role="status">Loading Togetherly…</div>}>
          <Routes>
            <Route element={<AppLayout />}>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/roadmap" element={<DevelopmentRoadmapPage />} />
              <Route element={<ManagerRoutes />}>
                <Route path="/employees" element={<EmployeesPage />} />
                <Route path="/projects" element={<ProjectsPage />} />
                <Route path="/team-builder" element={<TeamBuilderPage />} />
                <Route path="/workforce-twin" element={<WorkforceTwinPage />} />
                <Route path="/skills" element={<SkillsTrainingPage />} />
                <Route path="/workload" element={<WorkloadPlannerPage />} />
                <Route path="/opportunities" element={<OpportunityFinderPage />} />
                <Route path="/impact-report" element={<AllocationImpactPage />} />
                <Route path="/analytics" element={<AnalyticsPage />} />
                <Route path="/settings" element={<SettingsPage />} />
              </Route>
              <Route element={<EmployeeRoutes />}>
                <Route path="/my-projects" element={<EmployeeProjectsPage />} />
                <Route path="/my-learning" element={<DevelopmentRoadmapPage />} />
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </Suspense>
      </BrowserRouter>
    </DataProvider>
  );
}

export default App;
