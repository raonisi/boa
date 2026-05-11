import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch, Redirect } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { useAuth } from "./_core/hooks/useAuth";
import { getLoginUrl } from "./const";
import { Loader2 } from "lucide-react";

// Pages
import Dashboard from "./pages/Dashboard";
import CustomerList from "./pages/CustomerList";
import CustomerDetail from "./pages/CustomerDetail";
import CustomerAssign from "./pages/CustomerAssign";
import ContractList from "./pages/ContractList";
import Performance from "./pages/Performance";
import Notifications from "./pages/Notifications";
import Calendar from "./pages/Calendar";
import UserManagement from "./pages/UserManagement";
import TeamManagement from "./pages/TeamManagement";
import ActivityLog from "./pages/ActivityLog";
import Download from "./pages/Download";
import Settings from "./pages/Settings";
import Blocked from "./pages/Blocked";
import NotFound from "./pages/NotFound";

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
    window.location.href = getLoginUrl();
    return null;
  }

  if ((user as any).accountStatus !== "active") {
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
      <Route path="/customers">
        <AuthGuard>
          <CustomerList />
        </AuthGuard>
      </Route>
      <Route path="/customers/assign">
        <AuthGuard>
          <SubBranchAdminOrAboveGuard>
            <CustomerAssign />
          </SubBranchAdminOrAboveGuard>
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
      <Route path="/calendar">
        <AuthGuard>
          <Calendar />
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
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
