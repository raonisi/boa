import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch, Redirect } from "wouter";
import { AndroidBackButtonHandler } from "./components/app/AndroidBackButtonHandler";
import { AppShellLoading, AppShellRoot } from "./components/AppShell";
import ErrorBoundary from "./components/ErrorBoundary";
import { BrandedLogin } from "./components/BrandedLogin";
import { ThemeProvider } from "./contexts/ThemeContext";
import { useAuth } from "./_core/hooks/useAuth";
import { getLoginUrlResult } from "./const";
import { getLoginConfigurationNotice } from "./lib/loginConfigurationCopy";
import { ForbiddenState } from "./components/ForbiddenState";
import { RouteAccessGuard } from "./components/RouteAccessGuard";
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
const GoogleCalendarIntegration = lazy(
  () => import("./pages/GoogleCalendarIntegration")
);
const CustomerDataQualityDashboard = lazy(
  () => import("./pages/CustomerDataQualityDashboard")
);
const ReferralManagement = lazy(() => import("./pages/ReferralManagement"));
const ClaimGuidanceManagement = lazy(
  () => import("./pages/ClaimGuidanceManagement")
);
const RetentionRiskManagement = lazy(
  () => import("./pages/RetentionRiskManagement")
);

function RouteFallback() {
  return (
    <div className="min-h-screen bg-slate-50/70 px-4 py-6 md:px-6">
      <div className="mx-auto max-w-6xl space-y-4">
        <div className="rounded-2xl border border-slate-200/80 bg-white/95 p-5 shadow-sm">
          <AppShellLoading
            className="min-h-0 bg-transparent p-0"
            description="필요한 관리 화면을 준비하고 있습니다"
          />
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

function LoginConfigurationNotice({
  reason,
}: {
  reason: "missing" | "invalid";
}) {
  const { title, description } = getLoginConfigurationNotice(reason);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-lg border bg-card p-6 shadow-sm">
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-3 text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <AppShellLoading />;
  }

  if (!user) {
    const loginUrl = getLoginUrlResult();

    if (!loginUrl.ok) {
      return <LoginConfigurationNotice reason={loginUrl.reason} />;
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
    return <ForbiddenState />;
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
          <RouteAccessGuard path="/customers/assign">
            <LazyRoute>
              <CustomerAssign />
            </LazyRoute>
          </RouteAccessGuard>
        </AuthGuard>
      </Route>
      <Route path="/customers/bulk-import">
        <AuthGuard>
          <RouteAccessGuard path="/customers/bulk-import">
            <LazyRoute>
              <CustomerBulkImport />
            </LazyRoute>
          </RouteAccessGuard>
        </AuthGuard>
      </Route>
      <Route path="/customers/import-batches">
        <AuthGuard>
          <RouteAccessGuard path="/customers/import-batches">
            <LazyRoute>
              <ImportBatchManagement />
            </LazyRoute>
          </RouteAccessGuard>
        </AuthGuard>
      </Route>
      <Route path="/customers/merge">
        <AuthGuard>
          <RouteAccessGuard path="/customers/merge">
            <LazyRoute>
              <CustomerMergeManagement />
            </LazyRoute>
          </RouteAccessGuard>
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
          <RouteAccessGuard path="/performance/goals">
            <LazyRoute>
              <PerformanceGoals />
            </LazyRoute>
          </RouteAccessGuard>
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
          <RouteAccessGuard path="/aftercare-campaigns">
            <LazyRoute>
              <AftercareCampaigns />
            </LazyRoute>
          </RouteAccessGuard>
        </AuthGuard>
      </Route>
      <Route path="/onboarding-checklists">
        <AuthGuard>
          <RouteAccessGuard path="/onboarding-checklists">
            <LazyRoute>
              <OnboardingDashboard />
            </LazyRoute>
          </RouteAccessGuard>
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
          <RouteAccessGuard path="/push-notifications">
            <LazyRoute>
              <PushNotificationOperations />
            </LazyRoute>
          </RouteAccessGuard>
        </AuthGuard>
      </Route>
      <Route path="/calendar">
        <AuthGuard>
          <Calendar />
        </AuthGuard>
      </Route>
      <Route path="/users/handoff">
        <AuthGuard>
          <RouteAccessGuard path="/users/handoff">
            <LazyRoute>
              <UserHandoffManagement />
            </LazyRoute>
          </RouteAccessGuard>
        </AuthGuard>
      </Route>
      <Route path="/organization">
        <AuthGuard>
          <RouteAccessGuard path="/organization">
            <LazyRoute>
              <OrganizationManagement />
            </LazyRoute>
          </RouteAccessGuard>
        </AuthGuard>
      </Route>
      <Route path="/users">
        <AuthGuard>
          <RouteAccessGuard path="/users">
            <LazyRoute>
              <UserManagement />
            </LazyRoute>
          </RouteAccessGuard>
        </AuthGuard>
      </Route>
      <Route path="/team-insights">
        <AuthGuard>
          <RouteAccessGuard path="/team-insights">
            <LazyRoute>
              <TeamInsights />
            </LazyRoute>
          </RouteAccessGuard>
        </AuthGuard>
      </Route>
      <Route path="/admin/sla">
        <AuthGuard>
          <RouteAccessGuard path="/admin/sla">
            <LazyRoute>
              <FirstContactSlaDashboard />
            </LazyRoute>
          </RouteAccessGuard>
        </AuthGuard>
      </Route>
      <Route path="/teams">
        <AuthGuard>
          <RouteAccessGuard path="/teams">
            <LazyRoute>
              <TeamManagement />
            </LazyRoute>
          </RouteAccessGuard>
        </AuthGuard>
      </Route>
      <Route path="/logs">
        <AuthGuard>
          <RouteAccessGuard path="/logs">
            <LazyRoute>
              <ActivityLog />
            </LazyRoute>
          </RouteAccessGuard>
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
          <RouteAccessGuard path="/operation-risk">
            <LazyRoute>
              <OperationRiskCenter />
            </LazyRoute>
          </RouteAccessGuard>
        </AuthGuard>
      </Route>
      <Route path="/admin/team-completion">
        <AuthGuard>
          <RouteAccessGuard path="/admin/team-completion">
            <LazyRoute>
              <TeamCompletionDashboard />
            </LazyRoute>
          </RouteAccessGuard>
        </AuthGuard>
      </Route>
      <Route path="/admin/team-coaching">
        <AuthGuard>
          <RouteAccessGuard path="/admin/team-coaching">
            <LazyRoute>
              <TeamCoachingDashboard />
            </LazyRoute>
          </RouteAccessGuard>
        </AuthGuard>
      </Route>
      <Route path="/admin/operations-center">
        <AuthGuard>
          <RouteAccessGuard path="/admin/operations-center">
            <LazyRoute>
              <AdminOperationsCenter />
            </LazyRoute>
          </RouteAccessGuard>
        </AuthGuard>
      </Route>
      <Route path="/management-reports">
        <AuthGuard>
          <RouteAccessGuard path="/management-reports">
            <LazyRoute>
              <ManagementReports />
            </LazyRoute>
          </RouteAccessGuard>
        </AuthGuard>
      </Route>
      <Route path="/action-plans">
        <AuthGuard>
          <RouteAccessGuard path="/action-plans">
            <LazyRoute>
              <ActionPlanManagement />
            </LazyRoute>
          </RouteAccessGuard>
        </AuthGuard>
      </Route>
      <Route path="/google-calendar-integration">
        <AuthGuard>
          <RouteAccessGuard path="/google-calendar-integration">
            <LazyRoute>
              <GoogleCalendarIntegration />
            </LazyRoute>
          </RouteAccessGuard>
        </AuthGuard>
      </Route>
      <Route path="/customer-data-quality">
        <AuthGuard>
          <RouteAccessGuard path="/customer-data-quality">
            <LazyRoute>
              <CustomerDataQualityDashboard />
            </LazyRoute>
          </RouteAccessGuard>
        </AuthGuard>
      </Route>
      <Route path="/referrals">
        <AuthGuard>
          <RouteAccessGuard path="/referrals">
            <LazyRoute>
              <ReferralManagement />
            </LazyRoute>
          </RouteAccessGuard>
        </AuthGuard>
      </Route>
      <Route path="/claim-guidance">
        <AuthGuard>
          <RouteAccessGuard path="/claim-guidance">
            <LazyRoute>
              <ClaimGuidanceManagement />
            </LazyRoute>
          </RouteAccessGuard>
        </AuthGuard>
      </Route>
      <Route path="/retention-risk">
        <AuthGuard>
          <RouteAccessGuard path="/retention-risk">
            <LazyRoute>
              <RetentionRiskManagement />
            </LazyRoute>
          </RouteAccessGuard>
        </AuthGuard>
      </Route>
      <Route path="/download">
        <AuthGuard>
          <RouteAccessGuard path="/download">
            <LazyRoute>
              <Download />
            </LazyRoute>
          </RouteAccessGuard>
        </AuthGuard>
      </Route>
      <Route path="/settings">
        <AuthGuard>
          <RouteAccessGuard path="/settings">
            <LazyRoute>
              <Settings />
            </LazyRoute>
          </RouteAccessGuard>
        </AuthGuard>
      </Route>
      <Route path="/consultation-tools">
        <AuthGuard>
          <RouteAccessGuard path="/consultation-tools">
            <LazyRoute>
              <ConsultationToolsManagement />
            </LazyRoute>
          </RouteAccessGuard>
        </AuthGuard>
      </Route>
      <Route path="/deleted-data">
        <AuthGuard>
          <RouteAccessGuard path="/deleted-data">
            <LazyRoute>
              <DeletedDataManagement />
            </LazyRoute>
          </RouteAccessGuard>
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
          <AppShellRoot>
            <Toaster />
            <AndroidBackButtonHandler />
            <Router />
          </AppShellRoot>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
