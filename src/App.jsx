import { Routes, Route } from "react-router-dom";
import "./App.css";

// Pages & Components
import LandingPage from "./pages/LandingPage";

// Modular Route Domains
import InstructorRoutes from "./routes/InstructorRoutes";
import AdminRoutes from "./routes/AdminRoutes";
import StudentRoutes from "./routes/StudentRoutes";

function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/secure/ta-portal-4m8p1/*" element={<InstructorRoutes />} />
      <Route path="/secure/ctrl-panel-9x7k2/*" element={<AdminRoutes />} />
      <Route path="/lab/*" element={<StudentRoutes />} />
      <Route path="*" element={<LandingPage />} />
    </Routes>
  );
}

export default App;
