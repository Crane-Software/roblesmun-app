import { useState, useEffect } from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { SlotsProvider } from "./providers/SlotsProvider";
import Sidebar from "./components/Sidebar";
import Header from "./components/Header";
import Home from "./views/Home";
import Footer from "./components/Footer";
import PressView from "./views/PressView";
import SponsorsView from "./views/SponsorsView";
import CommitteesView from "./views/CommitteesView";
import RegistrationsView from "./views/RegistrationsView";
import Login from "./views/Login";
import Registrations from "./views/Registrations";
import AdminDashboard from "./views/admin/AdminDashboard";
import SponsorsManagement from "./views/admin/SponsorsManagement";
import ProtectedRoute from "./components/ProtectedRoute";
import RegistrationsManagement from "./views/admin/RegistrationsManagement";
import CommitteesManagement from "./views/admin/CommitteesManagement";
import DelegatesManagement from "./views/admin/DelegatesManagement";
import PresssManagement from "./views/admin/PressManagement";
import UsersManagement from "./views/admin/UsersManagement";
import InstitutionsManagement from "./views/admin/InstitutionsManagement";
import SeatManagement from "./views/admin/SeatManagement";

function App() {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 640),
    location = useLocation();

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const hideNavigation =
    ["/login", "/registrations/checkout"].includes(location.pathname) ||
    location.pathname.startsWith("/admin");

  return (
    <AuthProvider>
      <SlotsProvider>
        <div className="flex flex-col justify-start items-center">
          {!hideNavigation && <Sidebar />}
          {!isMobile && !hideNavigation && <Header />}

          <main className="w-full flex flex-col justify-center items-center box-border">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/press" element={<PressView />} />
              <Route path="/sponsors" element={<SponsorsView />} />
              <Route path="/registrations" element={<RegistrationsView />} />
              <Route path="/committees" element={<CommitteesView />} />
              <Route path="/login" element={<Login />} />
              <Route
                path="/registrations/checkout"
                element={<Registrations />}
              />
              {/* <Route path="*" element={<div>404 Not Found</div>} /> */}
            </Routes>
          </main>

          <Routes>
            <Route
              path="/admin"
              element={
                <ProtectedRoute requireAdmin={true}>
                  <AdminDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/press"
              element={
                <ProtectedRoute requireAdmin={true}>
                  <PresssManagement />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/sponsors"
              element={
                <ProtectedRoute requireAdmin={true}>
                  <SponsorsManagement />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/registrations"
              element={
                <ProtectedRoute requireAdmin={true}>
                  <RegistrationsManagement />
                </ProtectedRoute>
              }
            />

            <Route
              path="/admin/committees"
              element={
                <ProtectedRoute requireAdmin={true}>
                  <CommitteesManagement />
                </ProtectedRoute>
              }
            />

            <Route
              path="/admin/delegates"
              element={
                <ProtectedRoute requireAdmin={true}>
                  <DelegatesManagement />
                </ProtectedRoute>
              }
            />

            <Route
              path="/admin/users"
              element={
                <ProtectedRoute requireAdmin={true}>
                  <UsersManagement />
                </ProtectedRoute>
              }
            />

            <Route
              path="/admin/institutions"
              element={
                <ProtectedRoute requireAdmin={true}>
                  <InstitutionsManagement />
                </ProtectedRoute>
              }
            />

            <Route
              path="/admin/seats"
              element={
                <ProtectedRoute requireAdmin={true}>
                  <SeatManagement />
                </ProtectedRoute>
              }
            />
          </Routes>

          {!hideNavigation && <Footer />}
        </div>
      </SlotsProvider>
    </AuthProvider>
  );
}

export default App;
