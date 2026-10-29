import { Navigate, Route, Routes } from "react-router-dom";
import { EntitiesPage } from "./pages/EntitiesPage";
import { EntityPage } from "./pages/EntityPage";
import { ReplayPage } from "./pages/ReplayPage";
import { ReviewPage } from "./pages/ReviewPage";

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/replay" replace />} />
      <Route path="/replay" element={<ReplayPage />} />
      <Route path="/review" element={<ReviewPage />} />
      <Route path="/entities" element={<EntitiesPage />} />
      <Route path="/entities/:id" element={<EntityPage />} />
      <Route path="*" element={<Navigate to="/replay" replace />} />
    </Routes>
  );
}
