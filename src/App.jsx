import { lazy, Suspense } from "react";
import {BrowserRouter, Routes, Route, Navigate, Outlet} from "react-router-dom";
import { GoogleOAuthProvider } from "@react-oauth/google";

const LoginPage = lazy(() => import("./pages/LoginPage"));
const EmploymentPage = lazy(() => import("./pages/EmploymentPage"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const UploadPage = lazy(() => import("./pages/UploadPage"));
const StudentPage = lazy(() => import("./pages/StudentPage"));
const FacultyPage = lazy(() => import("./pages/FacultyPage"));
const SummaryPage = lazy(() => import("./pages/SummaryPage"));
const StudentStatus = lazy(() => import("./pages/StudentStatus"));
const StudentSatisfactionPage = lazy(() => import("./pages/StudentSatisfactionPage"));
const EvaluationPage = lazy(() => import("./pages/EvaluationPage"));
const GraduateQualityPage = lazy(() => import("./pages/GraduateQualityPage"));
const CoursePage = lazy(() => import("./pages/CoursePage"));
const AdminManagementPage = lazy(() => import("./pages/AdminManagementPage"));
const ResearchPage = lazy(() => import("./pages/ResearchPage"));
const LearningSupportPage = lazy(() => import("./pages/LearningSupportPage"));

const GOOGLE_CLIENT_ID = "279564406031-jmit17s4jtcvrnbdolg8glqhdp9divj5.apps.googleusercontent.com";

// ตัวเช็กสำหรับผู้ใช้งานทั่วไป + Admin (ต้องล็อกอินก่อนถึงจะเข้าได้)
const ProtectedRoutes = () => {
  const isAuthenticated = localStorage.getItem("isLoggedIn") === "true";
  return isAuthenticated ? <Outlet /> : <Navigate to="/login" replace />;
};

// ตัวเช็คเฉพาะ Admin (เช็กทั้ง Role และ Email เพื่อความชัวร์)
const AdminRoute = () => {
  const isAuthenticated = localStorage.getItem("isLoggedIn") === "true";
  const role = localStorage.getItem("role");
  const email = (localStorage.getItem("email") || "").toLowerCase();

  const isAdmin = role === "admin" || email === "naramon.si@ku.th";

  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!isAdmin) return <Navigate to="/" replace />; // ถ้าไม่ใช่ Admin ให้เด้งกลับหน้าหลัก

  return <Outlet />;
};

function App() {
  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <BrowserRouter>
        <Suspense fallback={<div role="status">Loading page...</div>}>
          <Routes>
            {/* หน้า Login */}
            <Route path="/login" element={<LoginPage />} />

            {/* หน้าสำหรับผู้ใช้งานทุกคนที่ล็อกอินแล้ว */}
            <Route element={<ProtectedRoutes />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/employment" element={<EmploymentPage />} />
              <Route path="/students" element={<StudentPage />} />
              <Route path="/faculty" element={<FacultyPage />} />
              <Route path="/summary" element={<SummaryPage />} />
              <Route path="/student-status" element={<StudentStatus />} />
              <Route path="/student-satisfaction" element={<StudentSatisfactionPage />} />
              <Route path="/evaluation" element={<EvaluationPage />} />
              <Route path="/graduate-quality" element={<GraduateQualityPage />} />
              <Route path="/courses" element={<CoursePage />} />
              <Route path="/learning-support" element={<LearningSupportPage />} />
            </Route>

            {/* ล็อกเฉพาะ Admin เข้าได้ */}
            <Route element={<AdminRoute />}>
              <Route path="/upload" element={<UploadPage />} />
              <Route path="/research" element={<ResearchPage />} />
              <Route path="/admin-management" element={<AdminManagementPage />} />
            </Route>

            {/* ถ้าเข้า URL มั่ว ให้เด้งกลับหน้าหลัก */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </GoogleOAuthProvider>
  );
}

export default App;
