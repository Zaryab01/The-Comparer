import { BrowserRouter, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import AdminLayout from "./components/AdminLayout";
import CatalogPage from "./pages/CatalogPage";
import ComparePage from "./pages/ComparePage";
import ProfileFormPage from "./pages/ProfileFormPage";
import ProfilesPage from "./pages/ProfilesPage";
import AdminLoginPage from "./pages/admin/AdminLoginPage";
import AdminPerfumesPage from "./pages/admin/AdminPerfumesPage";
import AdminNotesPage from "./pages/admin/AdminNotesPage";
import AdminLogsPage from "./pages/admin/AdminLogsPage";

export default function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<ComparePage />} />
          <Route path="catalog" element={<CatalogPage />} />
          <Route path="profiles" element={<ProfilesPage />} />
          <Route path="profiles/new" element={<ProfileFormPage />} />
          <Route path="profiles/:id/edit" element={<ProfileFormPage />} />

          {/* Admin (token-gated) */}
          <Route path="admin/login" element={<AdminLoginPage />} />
          <Route path="admin" element={<AdminLayout />}>
            <Route index element={<AdminPerfumesPage />} />
            <Route path="perfumes" element={<AdminPerfumesPage />} />
            <Route path="notes" element={<AdminNotesPage />} />
            <Route path="logs" element={<AdminLogsPage />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
