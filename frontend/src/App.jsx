import { BrowserRouter, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import ComparePage from "./pages/ComparePage";
import ProfileFormPage from "./pages/ProfileFormPage";
import ProfilesPage from "./pages/ProfilesPage";

export default function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<ComparePage />} />
          <Route path="profiles" element={<ProfilesPage />} />
          <Route path="profiles/new" element={<ProfileFormPage />} />
          <Route path="profiles/:id/edit" element={<ProfileFormPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
