import InstructorLogin from "../pages/instructor/InstructorLogin";
import AdminLogin from "../pages/admin/AdminLogin";

/**
 * A reusable ProtectedRoute component to handle Instructor and Admin authentication.
 * Without changing any core functionality!
 */
interface ProtectedInstructorRouteProps {
  instructorName: string | null;
  instructorId: string | number | null;
  onLogin: (data: { username: string; id: string | number }) => void;
  onBack: () => void;
  children: React.ReactNode;
}

export function ProtectedInstructorRoute({
  instructorName,
  instructorId,
  onLogin,
  onBack,
  children,
}: ProtectedInstructorRouteProps) {
  if (!instructorName || !instructorId) {
    return <InstructorLogin onLogin={onLogin} onBack={onBack} />;
  }
  return children;
}

interface ProtectedAdminRouteProps {
  adminLoggedIn: boolean;
  onLogin: () => void;
  onBack: () => void;
  children: React.ReactNode;
}

export function ProtectedAdminRoute({ adminLoggedIn, onLogin, onBack, children }: ProtectedAdminRouteProps) {
  if (!adminLoggedIn) {
    return <AdminLogin onLogin={onLogin} onBack={onBack} />;
  }
  return children;
}
