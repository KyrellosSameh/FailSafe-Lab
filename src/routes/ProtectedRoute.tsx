import { Navigate } from "react-router-dom";
import InstructorLogin from "../pages/instructor/InstructorLogin";
import AdminLogin from "../pages/admin/AdminLogin";

/**
 * A reusable ProtectedRoute component to handle Instructor and Admin authentication.
 * Without changing any core functionality!
 */
export function ProtectedInstructorRoute({
  instructorName,
  instructorId,
  onLogin,
  onBack,
  children,
}) {
  if (!instructorName || !instructorId) {
    return <InstructorLogin onLogin={onLogin} onBack={onBack} />;
  }
  return children;
}

export function ProtectedAdminRoute({ adminLoggedIn, onLogin, onBack, children }) {
  if (!adminLoggedIn) {
    return <AdminLogin onLogin={onLogin} onBack={onBack} />;
  }
  return children;
}
