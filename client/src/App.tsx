import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch, Redirect } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { BrandedLogin } from "./components/BrandedLogin";
import { ThemeProvider } from "./contexts/ThemeContext";
import { useAuth } from "./_core/hooks/useAuth";
import { getLoginUrlResult } from "./const";
import { Loader2 } from "lucide-react";
import { hasCustomerBulkImportAccess } from "@shared/permissions";
import { ForbiddenState } from "./components/ForbiddenState";
import { lazy, Suspense } from "react";

// Pages
import Dashboard from "./pages/Dashboard";
import CustomerList from "./pages/CustomerList";
import CustomerDetail from "./pages/CustomerDetail";
import ContractList from "./pages/ContractList";
import Performance from "./pages/Performance";
import Notifications from "./pages/Notifications";
import Calendar from "./pages/Calendar";
import Blocked from "./pages/Blocked";
import NotFound from "./pages/NotFound";
import SalesPipeline from "./pages/SalesPipeline";
import SalesFunnelAnalytics from "./pages/SalesFunnelAnalytics";

const CustomerAssign = lazy(() => import("./pages/CustomerAssign"));
const CustomerBulkImport = lazy(() => import("./pages/CustomerBulkImport"));
const CustomerMergeManagement = lazy(
  () => import("./pages/CustomerMergeManagement")
);
const ImportBatchManagement = lazy(
  () => import("./pages/ImportBatchManagement")
);
const PerformanceGoals = lazy(() => import("./pages/PerformanceGoals"));
const UserManagement = lazy(() => import("./pages/UserManagement"));
const OrganizationManagement = lazy(
  () => import("./pages/OrganizationManagement")
);
const UserHandoffManagement = lazy(
  () => import("./pages/UserHandoffManagement")
);
const TeamManagement = lazy(() => import("./pages/TeamManagement"));
const ActivityLog = lazy(() => import("./pages/ActivityLog"));
const Download = lazy(() => import("./pages/Download"));
const Settings = lazy(() => import("./pages/Settings"));
const PushNotificationPreferences = lazy(
  () => import("./pages/PushNotificationPreferences")
);
const PushNotificationOperations = lazy(
  () => import("./pages/PushNotificationOperations")
);
const ConsultationToolsManagement = lazy(
  () => import("./pages/ConsultationToolsManagement")
);
const DeletedDataManagement = lazy(
  () => import("./pages/DeletedDataManagement")
);
const OperationRiskCenter = lazy(() => import("./pages/OperationRiskCenter"));
const TeamInsights = lazy(() => import("./pages/TeamInsights"));
const FirstContactSlaDashboard = lazy(
  () => import("./pages/FirstContactSlaDashboard")
);
const TeamCompletionDashboard = lazy(
  () => import("./pages/TeamCompletionDashboard")
);
const TeamCoachingDashboard = lazy(
  () => import("./pages/TeamCoachingDashboard")
);
const AftercareCampaigns = lazy(() => import("./pages/AftercareCampaigns"));
const OnboardingDashboard = lazy(() => import("./pages/OnboardingDashboard"));
const AdminOperationsCenter = lazy(
  () => import("./pages/AdminOperationsCenter")
);
const ManagementReports = lazy(() => import("./pages/ManagementReports"));
const ActionPlanManagement = lazy(() => import("./pages/ActionPlanManagement"));
const CustomerDataQualityDashboard = lazy(
  () => import("./pages/CustomerDataQualityDashboard")
);

function RouteFallback() {
  return (
    <div className="min-h-screen bg-slate-50/70 px-4 py-6 md:px-6">
      <div className="mx-auto max-w-6xl space-y-4">
        <div className="rounded-2xl border border-slate-200/80 bg-white/95 p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-[#b99b5f]" />
            <div>
              <p className="text-sm font-semibold text-slate-950">
                화면을 준비하고 있습니다
              </p>
              <p className="mt-1 text-xs text-slate-500">
                권한 확인 후 필요한 관리 화면만 불러옵니다.
              </p>
            </div>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {[0, 1, 2].map(item => (
            <div
              key={item}
              className="h-24 animate-pulse rounded-2xl border border-slate-200/80 bg-white/80 shadow-sm"
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function LazyRoute({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<RouteFallback />}>{children}</Suspense>;
}

function LoginConfigurationNotice({ message }: { message: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-lg border bg-card p-6 shadow-sm">
        <h1 className="text-xl font-semibold tracking-tight">
          로그인 설정 확인 필요
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">{message}</p>
        <p className="mt-2 text-sm text-muted-foreground">
          관리자에게 VITE_GOOGLE_CLIENT_ID 환경변수 설정을 요청해주세요.
        </p>
      </div>
    </div>
  );
}

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">로딩 중...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    const loginUrl = getLoginUrlResult();

    if (!loginUrl.ok) {
      return <LoginConfigurationNotice message={loginUrl.message} />;
    }

    return (
      <BrandedLogin
        onLogin={() => {
          window.location.href = loginUrl.url;
        }}
      />
    );
  }

  if (user.accountStatus !== "active") {
    return <Blocked />;
  }

  return <>{children}</>;
}

function AdminGuard({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (!user || user.role !== "branch_admin") {
    return (
      <ForbiddenState description="이 화면은 지점 관리자 권한으로만 사용할 수 있습니다. 필요한 경우 관리자에게 문의해 주세요." />
    );
  }
  return <>{children}</>;
}

function BulkImportGuard({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (!hasCustomerBulkImportAccess(user)) {
    return (
      <ForbiddenState description="고객 일괄 등록은 지점장 또는 별도 권한이 부여된 부지점장·팀장만 사용할 수 있습니다. 필요한 경우 관리자에게 문의해 주세요." />
    );
  }
  return <>{children}</>;
}

function ManagerGuard({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (
    !user ||
    (user.role !== "branch_admin" &&
      user.role !== "sub_branch_admin" &&
      user.role !== "team_leader")
  ) {
    return (
      <ForbiddenState description="이 화면은 관리자 또는 팀 리더 권한으로만 사용할 수 있습니다. 필요한 경우 관리자에게 문의해 주세요." />
    );
  }
  return <>{children}</>;
}

function SubBranchAdminOrAboveGuard({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = useAuth();
  if (
    !user ||
    (user.role !== "branch_admin" && user.role !== "sub_branch_admin")
  ) {
    return (
      <ForbiddenState description="이 화면은 지점 관리자 또는 부지점장 권한으로만 사용할 수 있습니다. 필요한 경우 관리자에게 문의해 주세요." />
    );
  }
  return <>{children}</>;
}

function Router() {
  return (
    <Switch>
      <Route path="/">
        <AuthGuard>
          <Dashboard />
        </AuthGuard>
      </Route>
      <Route path="/dashboard">
        <AuthGuard>
          <Redirect to="/" />
        </AuthGuard>
      </Route>
      <Route path="/sales-pipeline-preview">
        <AuthGuard>
          <Redirect to="/sales-pipeline" />
        </AuthGuard>
      </Route>
      <Route path="/sales-pipeline">
        <AuthGuard>
          <SalesPipeline />
        </AuthGuard>
      </Route>
      <Route path="/analytics">
        <AuthGuard>
          <SalesFunnelAnalytics />
        </AuthGuard>
      </Route>
      <Route path="/customers">
        <AuthGuard>
          <CustomerList />
        </AuthGuard>
      </Route>
      <Route path="/customers/assign">
        <AuthGuard>
          <ManagerGuard>
            <LazyRoute>
              <CustomerAssign />
            </LazyRoute>
          </ManagerGuard>
        </AuthGuard>
      </Route>
      <Route path="/customers/bulk-import">
        <AuthGuard>
          <BulkImportGuard>
            <LazyRoute>
              <CustomerBulkImport />
            </LazyRoute>
          </BulkImportGuard>
        </AuthGuard>
      </Route>
      <Route path="/customers/import-batches">
        <AuthGuard>
          <AdminGuard>
            <LazyRoute>
              <ImportBatchManagement />
            </LazyRoute>
          </AdminGuard>
        </AuthGuard>
      </Route>
      <Route path="/customers/merge">
        <AuthGuard>
          <AdminGuard>
            <LazyRoute>
              <CustomerMergeManagement />
            </LazyRoute>
          </AdminGuard>
        </AuthGuard>
      </Route>
      <Route path="/customers/:id">
        {params => (
          <AuthGuard>
            <CustomerDetail id={Number(params.id)} />
          </AuthGuard>
        )}
      </Route>
      <Route path="/contracts">
        <AuthGuard>
          <ContractList />
        </AuthGuard>
      </Route>
      <Route path="/performance/goals">
        <AuthGuard>
          <LazyRoute>
            <PerformanceGoals />
          </LazyRoute>
        </AuthGuard>
      </Route>
      <Route path="/performance">
        <AuthGuard>
          <Performance />
        </AuthGuard>
      </Route>
      <Route path="/notifications">
        <AuthGuard>
          <Notifications />
        </AuthGuard>
      </Route>
      <Route path="/aftercare-campaigns">
        <AuthGuard>
          <LazyRoute>
            <AftercareCampaigns />
          </LazyRoute>
        </AuthGuard>
      </Route>
      <Route path="/onboarding-checklists">
        <AuthGuard>
          <LazyRoute>
            <OnboardingDashboard />
          </LazyRoute>
        </AuthGuard>
      </Route>
      <Route path="/notification-preferences">
        <AuthGuard>
          <LazyRoute>
            <PushNotificationPreferences />
          </LazyRoute>
        </AuthGuard>
      </Route>
      <Route path="/push-notifications">
        <AuthGuard>
          <AdminGuard>
            <LazyRoute>
              <PushNotificationOperations />
            </LazyRoute>
          </AdminGuard>
        </AuthGuard>
      </Route>
      <Route path="/calendar">
        <AuthGuard>
          <Calendar />
        </AuthGuard>
      </Route>
      <Route path="/users/handoff">
        <AuthGuard>
          <AdminGuard>
            <LazyRoute>
              <UserHandoffManagement />
            </LazyRoute>
          </AdminGuard>
        </AuthGuard>
      </Route>
      <Route path="/organization">
        <AuthGuard>
          <ManagerGuard>
            <LazyRoute>
              <OrganizationManagement />
            </LazyRoute>
          </ManagerGuard>
        </AuthGuard>
      </Route>
      <Route path="/users">
        <AuthGuard>
          <AdminGuard>
            <LazyRoute>
              <UserManagement />
            </LazyRoute>
          </AdminGuard>
        </AuthGuard>
      </Route>
      <Route path="/team-insights">
        <AuthGuard>
          <ManagerGuard>
            <LazyRoute>
              <TeamInsights />
            </LazyRoute>
          </ManagerGuard>
        </AuthGuard>
      </Route>
      <Route path="/admin/sla">
        <AuthGuard>
          <ManagerGuard>
            <LazyRoute>
              <FirstContactSlaDashboard />
            </LazyRoute>
          </ManagerGuard>
        </AuthGuard>
      </Route>
      <Route path="/teams">
        <AuthGuard>
          <AdminGuard>
            <LazyRoute>
              <TeamManagement />
            </LazyRoute>
          </AdminGuard>
        </AuthGuard>
      </Route>
      <Route path="/logs">
        <AuthGuard>
          <ManagerGuard>
            <LazyRoute>
              <ActivityLog />
            </LazyRoute>
          </ManagerGuard>
        </AuthGuard>
      </Route>
      <Route path="/admin-audit">
        <AuthGuard>
          <AdminGuard>
            <Redirect to="/operation-risk?tab=logs" />
          </AdminGuard>
        </AuthGuard>
      </Route>
      <Route path="/operation-risk">
        <AuthGuard>
          <ManagerGuard>
            <LazyRoute>
              <OperationRiskCenter />
            </LazyRoute>
          </ManagerGuard>
        </AuthGuard>
      </Route>
      <Route path="/admin/team-completion">
        <AuthGuard>
          <ManagerGuard>
            <LazyRoute>
              <TeamCompletionDashboard />
            </LazyRoute>
          </ManagerGuard>
        </AuthGuard>
      </Route>
      <Route path="/admin/team-coaching">
        <AuthGuard>
          <ManagerGuard>
            <LazyRoute>
              <TeamCoachingDashboard />
            </LazyRoute>
          </ManagerGuard>
        </AuthGuard>
      </Route>
      <Route path="/admin/operations-center">
        <AuthGuard>
          <ManagerGuard>
            <LazyRoute>
              <AdminOperationsCenter />
            </LazyRoute>
          </ManagerGuard>
        </AuthGuard>
      </Route>
      <Route path="/management-reports">
        <AuthGuard>
          <ManagerGuard>
            <LazyRoute>
              <ManagementReports />
            </LazyRoute>
          </ManagerGuard>
        </AuthGuard>
      </Route>
      <Route path="/action-plans">
        <AuthGuard>
          <LazyRoute>
            <ActionPlanManagement />
          </LazyRoute>
        </AuthGuard>
      </Route>
      <Route path="/customer-data-quality">
        <AuthGuard>
          <LazyRoute>
            <CustomerDataQualityDashboard />
          </LazyRoute>
        </AuthGuard>
      </Route>
      <Route path="/download">
        <AuthGuard>
          <AdminGuard>
            <LazyRoute>
              <Download />
            </LazyRoute>
          </AdminGuard>
        </AuthGuard>
      </Route>
      <Route path="/settings">
        <AuthGuard>
          <AdminGuard>
            <LazyRoute>
              <Settings />
            </LazyRoute>
          </AdminGuard>
        </AuthGuard>
      </Route>
      <Route path="/consultation-tools">
        <AuthGuard>
          <AdminGuard>
            <LazyRoute>
              <ConsultationToolsManagement />
            </LazyRoute>
          </AdminGuard>
        </AuthGuard>
      </Route>
      <Route path="/deleted-data">
        <AuthGuard>
          <AdminGuard>
            <LazyRoute>
              <DeletedDataManagement />
            </LazyRoute>
          </AdminGuard>
        </AuthGuard>
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light" switchable>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
