import { useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AppSidebar } from '@/components/AppSidebar';
import { Topbar } from '@/components/Topbar';
import { ToastContainer } from '@/components/Toast';
import { ProtectedRoute, AdminRoute } from '@/components/ProtectedRoute';
import { useData } from '@/context/DataContext';

import { LoginPage } from '@/pages/LoginPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { EmployeesPage } from '@/pages/EmployeesPage';
import { ProjectsPage } from '@/pages/ProjectsPage';
import { TeamBuilderPage } from '@/pages/TeamBuilderPage';
import { WorkforceTwinPage } from '@/pages/WorkforceTwinPage';
import { SkillsTrainingPage } from '@/pages/SkillsTrainingPage';
import { DevelopmentRoadmapPage } from '@/pages/DevelopmentRoadmapPage';
import { WorkloadPlannerPage } from '@/pages/WorkloadPlannerPage';
import { OpportunityFinderPage } from '@/pages/OpportunityFinderPage';
import { TinyFishIntelligencePage } from '@/pages/TinyFishIntelligencePage';
import { AllocationImpactPage } from '@/pages/AllocationImpactPage';
import { AnalyticsPage } from '@/pages/AnalyticsPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { EmployeeProjectsPage } from '@/pages/EmployeeExperiencePage';
import { EmployeeSettingsPage } from '@/pages/EmployeeSettingsPage';
import { EmployeeWorkloadPage } from '@/pages/EmployeeWorkloadPage';
import { EmployeeSkillsPage } from '@/pages/EmployeeSkillsPage';
import { EmployeeProfilePage } from '@/pages/EmployeeProfilePage';
import { TalentVerificationPage } from '@/pages/TalentVerificationPage';
import { ScenarioSimulatorPage } from '@/pages/ScenarioSimulatorPage';
import { EmployeeVerificationPage } from '@/pages/EmployeeVerificationPage';

function WorkspaceLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const { role, toasts, dismissToast } = useData();

  return (
    <div className="flex min-h-screen bg-base-bg text-text-primary antialiased selection:bg-primary/30 selection:text-white">
      {/* Sidebar */}
      <AppSidebar
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((v) => !v)}
        mobileOpen={mobileSidebarOpen}
        onCloseMobile={() => setMobileSidebarOpen(false)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen overflow-x-hidden">
        <Topbar onOpenMobileNav={() => setMobileSidebarOpen(true)} />

        <main className="flex-1 p-4 sm:p-5 lg:p-6 max-w-[1600px] w-full mx-auto animate-fade-in">
          <Routes>
            {/* Common / Shared entry */}
            <Route path="/" element={<DashboardPage />} />
            <Route path="/roadmap" element={<DevelopmentRoadmapPage />} />

            {/* Administrator-only route protected by real database administrator authorization (not demo role switcher) */}
            <Route
              path="/admin/employee-requests"
              element={
                <AdminRoute>
                  <EmployeeVerificationPage />
                </AdminRoute>
              }
            />

            {/* Manager specific routes */}
            {role === 'manager' && (
              <>
                <Route path="/employees" element={<EmployeesPage />} />
                <Route path="/projects" element={<ProjectsPage />} />
                <Route path="/team-builder" element={<TeamBuilderPage />} />
                <Route path="/workforce-twin" element={<WorkforceTwinPage />} />
                <Route path="/scenarios" element={<ScenarioSimulatorPage />} />
                <Route path="/skills" element={<SkillsTrainingPage />} />
                <Route path="/workload" element={<WorkloadPlannerPage />} />
                <Route path="/intelligence" element={<TinyFishIntelligencePage />} />
                <Route path="/opportunities" element={<OpportunityFinderPage />} />
                <Route path="/impact-report" element={<AllocationImpactPage />} />
                <Route path="/analytics" element={<AnalyticsPage />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="/talent-verification" element={<TalentVerificationPage />} />
              </>
            )}

            {/* Employee specific routes */}
            {role === 'employee' && (
              <>
                <Route path="/my-projects" element={<EmployeeProjectsPage />} />
                <Route path="/my-workload" element={<EmployeeWorkloadPage />} />
                <Route path="/my-skills" element={<EmployeeSkillsPage />} />
                <Route path="/my-settings" element={<EmployeeSettingsPage />} />
                <Route path="/my-profile" element={<EmployeeProfilePage />} />
              </>
            )}

            {/* Fallback route within workspace */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>

      {/* Floating System Toasts */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}

export function App() {
  return (
    <Routes>
      {/* Public Authentication Route */}
      <Route path="/login" element={<LoginPage />} />

      {/* Protected Workforce Application Routes */}
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <WorkspaceLayout />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

export default App;
