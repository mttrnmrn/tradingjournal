import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { DataProvider } from "@/context/DataContext";
import { ToastProvider } from "@/components/ui/toast";
import { AppLayout } from "@/components/layout/AppLayout";
import { LoadingScreen } from "@/components/common";
import { isSupabaseConfigured } from "@/lib/supabase";
import LoginPage from "@/pages/LoginPage";
import SetupPage from "@/pages/SetupPage";

const DashboardPage = lazy(() => import("@/pages/DashboardPage"));
const JournalPage = lazy(() => import("@/pages/JournalPage"));
const AnalyticsPage = lazy(() => import("@/pages/AnalyticsPage"));
const SettingsPage = lazy(() => import("@/pages/SettingsPage"));
const AccountsPage = lazy(() => import("@/pages/AccountsPage"));

function Protected({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  if (!isSupabaseConfigured) return <SetupPage />;
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, "")}>
      <AuthProvider>
        <ToastProvider>
          <DataProvider>
            <Suspense fallback={<LoadingScreen />}>
              <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route
                  element={
                    <Protected>
                      <AppLayout />
                    </Protected>
                  }
                >
                  <Route path="/dashboard" element={<DashboardPage />} />
                  <Route path="/journal" element={<JournalPage />} />
                  <Route path="/analytics" element={<AnalyticsPage />} />
                  <Route path="/accounts" element={<AccountsPage />} />
                  <Route path="/settings" element={<SettingsPage />} />
                </Route>
                <Route path="*" element={<Navigate to="/dashboard" replace />} />
              </Routes>
            </Suspense>
          </DataProvider>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
