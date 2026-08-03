import { AuthProvider, useAuth } from "@/context/AuthContext";
import { ToastContainer } from "@/components/ui/Toast";
import { AuthScreen } from "@/screens/AuthScreen";
import { CustomerScreen } from "@/screens/CustomerScreen";
import { RiderScreen } from "@/screens/RiderScreen";
import { Loader2 } from "lucide-react";

function AppRoutes() {
  const { session, profile, loading, role } = useAuth();

  if (loading) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-slate-50 gap-3">
        <Loader2 className="w-8 h-8 text-udrive-700 animate-spin" />
        <p className="text-sm text-slate-500">Loading UDRIVE...</p>
      </div>
    );
  }

  if (!session || !profile) {
    return <AuthScreen />;
  }

  if (role === "rider") return <RiderScreen />;
  return <CustomerScreen />;
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
      <ToastContainer />
    </AuthProvider>
  );
}
