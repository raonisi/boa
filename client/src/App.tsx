import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch, Redirect } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { BrandedLogin } from "./components/BrandedLogin";
import { ThemeProvider } from "./contexts/ThemeContext";
import { useAuth } from "./_core/hooks/useAuth";
import { getLoginUrlResult } from "./const";
import { Loader2 } from "lucide-react";

// Pages
import Dashboard from "./pages/Dashboard";
import CustomerList from "./pages/CustomerList";
import CustomerDetail from "./pages/CustomerDetail";
import CustomerAssign from "./pages/CustomerAssign";
import CustomerBulkImport from "./pages/CustomerBulkImport";
import CustomerMergeManagement from "./pages/CustomerMergeManagement";
import ImportBatchManagement from "./pages/ImportBatchManagement";
import ContractList from "./pages/ContractList";
import Performance from "./pages/Performance";
import PerformanceGoals from "./pages/PerformanceGoals";
import Notifications from "./pages/Notifications";
import Calendar from "./pages/Calendar";
import UserManagement from "./pages/UserManagement";
import OrganizationManagement from "./pages/OrganizationManagement";
import UserHandoffManagement from "./pages/UserHandoffManagement";
import TeamManagement from "./pages/TeamManagement";
import ActivityLog from "./pages/ActivityLog";
import Download from "./pages/Download";
import Settings from "./pages/Settings";
import PushNotificationPreferences from "./pages/PushNotificationPreferences";
import PushNotificationOperations from "./pages/PushNotificationOperations";
import ConsultationToolsManagement from "./pages/ConsultationToolsManagement";
import DeletedDataManagement from "./pages/DeletedDataManagement";
import Blocked from "./pages/Blocked";
import NotFound from "./pages/NotFound";
import SalesPipeline from "./pages/SalesPipeline";
import SalesFunnelAnalytics from "./pages/SalesFunnelAnalytics";
import OperationRiskCenter from "./pages/OperationRiskCenter";

function LoginConfigurationNotice({ message }: { message: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-lg border bg-card p-6 shadow-sm">
        <h1 className="text-xl font-semibold tracking-tight">로그인 설정 확인 필요</h1>
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

    return <BrandedLogin onLogin={() => { window.location.href = loginUrl.url; }} />;
  }

  if (user.accountStatus !== "active") {
    return <Blocked />;
  }

  return <>{children}</>;
}

function AdminGuard({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (!user || user.role !== "branch_admin") return <Redirect to="/" />;
  return <>{children}</>;
}

function ManagerGuard({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (!user || (user.role !== "branch_admin" && user.role !== "sub_branch_admin" && user.role !== "team_leader")) return <Redirect to="/" />;
  return <>{children}</>;
}

function SubBranchAdminOrAboveGuard({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (!user || (user.role !== "branch_admin" && user.role !== "sub_branch_admin")) return <Redirect to="/" />;
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
            <CustomerAssign />
          </ManagerGuard>
        </AuthGuard>
      </Route>
      <Route path="/customers/bulk-import">
        <AuthGuard>
          <CustomerBulkImport />
        </AuthGuard>
      </Route>
      <Route path="/customers/import-batches">
        <AuthGuard>
          <AdminGuard>
            <ImportBatchManagement />
          </AdminGuard>
        </AuthGuard>
      </Route>
      <Route path="/customers/merge">
        <AuthGuard>
          <AdminGuard>
            <CustomerMergeManagement />
          </AdminGuard>
        </AuthGuard>
      </Route>
      <Route path="/customers/:id">
        {(params) => (
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
          <PerformanceGoals />
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
      <Route path="/notification-preferences">
        <AuthGuard>
          <PushNotificationPreferences />
        </AuthGuard>
      </Route>
      <Route path="/push-notifications">
        <AuthGuard>
          <AdminGuard>
            <PushNotificationOperations />
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
            <UserHandoffManagement />
          </AdminGuard>
        </AuthGuard>
      </Route>
      <Route path="/organization">
        <AuthGuard>
          <ManagerGuard>
            <OrganizationManagement />
          </ManagerGuard>
        </AuthGuard>
      </Route>
      <Route path="/users">
        <AuthGuard>
          <AdminGuard>
            <UserManagement />
          </AdminGuard>
        </AuthGuard>
      </Route>
      <Route path="/teams">
        <AuthGuard>
          <AdminGuard>
            <TeamManagement />
          </AdminGuard>
        </AuthGuard>
      </Route>
      <Route path="/logs">
        <AuthGuard>
          <ManagerGuard>
            <ActivityLog />
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
          <AdminGuard>
            <OperationRiskCenter />
          </AdminGuard>
        </AuthGuard>
      </Route>
      <Route path="/download">
        <AuthGuard>
          <AdminGuard>
            <Download />
          </AdminGuard>
        </AuthGuard>
      </Route>
      <Route path="/settings">
        <AuthGuard>
          <AdminGuard>
            <Settings />
          </AdminGuard>
        </AuthGuard>
      </Route>
      <Route path="/consultation-tools">
        <AuthGuard>
          <AdminGuard>
            <ConsultationToolsManagement />
          </AdminGuard>
        </AuthGuard>
      </Route>
      <Route path="/deleted-data">
        <AuthGuard>
          <AdminGuard>
            <DeletedDataManagement />
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
