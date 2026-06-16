import { Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell.jsx";
import { ProtectedRoute } from "./components/ProtectedRoute.jsx";
import { HomePage } from "./pages/HomePage.jsx";
import { LoginPage } from "./pages/LoginPage.jsx";
import { RegisterPage } from "./pages/RegisterPage.jsx";
import { SearchPage } from "./pages/SearchPage.jsx";
import { SearchResultsPage } from "./pages/SearchResultsPage.jsx";
import { SeatSelectionPage } from "./pages/SeatSelectionPage.jsx";
import { BookingPage } from "./pages/BookingPage.jsx";
import { PassengerDashboardPage } from "./pages/PassengerDashboardPage.jsx";
import { CashierPage } from "./pages/CashierPage.jsx";
import { AdminPage } from "./pages/AdminPage.jsx";
import { NotFoundPage } from "./pages/NotFoundPage.jsx";

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/search/results" element={<SearchResultsPage />} />
        <Route path="/trips/:tripId/seats" element={<SeatSelectionPage />} />
        <Route element={<ProtectedRoute allowedRoles={["passenger", "cashier", "admin"]} />}>
          <Route path="/dashboard" element={<PassengerDashboardPage />} />
          <Route path="/booking" element={<BookingPage />} />
        </Route>
        <Route element={<ProtectedRoute allowedRoles={["cashier", "admin"]} />}>
          <Route path="/cashier" element={<CashierPage />} />
        </Route>
        <Route element={<ProtectedRoute allowedRoles={["admin"]} />}>
          <Route path="/admin" element={<AdminPage />} />
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
