import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from '@/store/auth';
import { AuthLayout } from '@/layouts/AuthLayout';
import { DashboardLayout } from '@/layouts/DashboardLayout';
import { LoginPage } from '@/pages/auth/LoginPage';
import { RegisterPage } from '@/pages/auth/RegisterPage';
import { AcceptInvitePage } from '@/pages/auth/AcceptInvitePage';
import { DashboardPage } from '@/pages/dashboard/DashboardPage';
import { CompanyPage } from '@/pages/company/CompanyPage';
import { CreateCompanyPage } from '@/pages/company/CreateCompanyPage';
import { InviteMembersPage } from '@/pages/company/InviteMembersPage';
import { ProjectsPage } from '@/pages/projects/ProjectsPage';
import { CreateProjectPage } from '@/pages/projects/CreateProjectPage';
import { ProjectDetailPage } from '@/pages/projects/ProjectDetailPage';
import { ProjectSamplesPage } from '@/pages/projects/ProjectSamplesPage';
import { ProjectPhotosPage } from '@/pages/projects/ProjectPhotosPage';
import { ProgramIeiPage } from '@/pages/projects/ProgramIeiPage';
import { InquiryRequestsPage } from '@/pages/projects/InquiryRequestsPage';
import { TechnicalTasksPage } from '@/pages/technical-tasks/TechnicalTasksPage';
import { CreateTechnicalTaskPage } from '@/pages/technical-tasks/CreateTechnicalTaskPage';
import { TechnicalTaskDetailPage } from '@/pages/technical-tasks/TechnicalTaskDetailPage';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuthStore();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function GuestRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuthStore();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      {/* Публичные маршруты */}
      <Route element={<AuthLayout />}>
        <Route
          path="/login"
          element={
            <GuestRoute>
              <LoginPage />
            </GuestRoute>
          }
        />
        <Route
          path="/register"
          element={
            <GuestRoute>
              <RegisterPage />
            </GuestRoute>
          }
        />
        <Route path="/invite/:token" element={<AcceptInvitePage />} />
      </Route>

      {/* Защищённые маршруты */}
      <Route
        element={
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/company" element={<CompanyPage />} />
        <Route path="/company/create" element={<CreateCompanyPage />} />
        <Route path="/company/invite" element={<InviteMembersPage />} />
        <Route path="/projects" element={<ProjectsPage />} />
        <Route path="/projects/create" element={<CreateProjectPage />} />
        <Route path="/projects/:id" element={<ProjectDetailPage />} />
        <Route path="/projects/:id/samples" element={<ProjectSamplesPage />} />
        <Route path="/projects/:id/photos" element={<ProjectPhotosPage />} />
        <Route path="/projects/:id/program-iei" element={<ProgramIeiPage />} />
        <Route path="/projects/:id/inquiry-requests" element={<InquiryRequestsPage />} />
        <Route path="/technical-tasks" element={<TechnicalTasksPage />} />
        <Route path="/technical-tasks/create" element={<CreateTechnicalTaskPage />} />
        <Route path="/technical-tasks/:id" element={<TechnicalTaskDetailPage />} />
      </Route>

      {/* Редирект по умолчанию */}
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

