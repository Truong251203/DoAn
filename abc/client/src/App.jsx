import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import PrivateRoute from "./components/PrivateRoute";

// Import Pages (Chỉ giữ lại những file quan trọng)
import Login from "./pages/LoginPage";
import Register from "./pages/RegisterPage";
import Dashboard from "./pages/Dashboard";
import Orders from "./pages/Orders";
import AssignOrder from "./pages/AssignOrder";
import DriverStats from "./pages/DriverStats";
import MapPage from "./pages/mapPage";
import AdminDashboard from "./pages/admin/DashboardAdmin";
import CustomerDashboard from "./pages/customer/DashboardCustomer";
import CoordinatorDashboard from "./pages/coordinator/DashboardCoordinator";
import CustomerProfile from "./pages/customer/CustomerProfile";
import DashboardDriver from "./pages/driver/DashboardDriver"; 

function App() {
  return (
    <Routes>
        {/* --- Public Routes --- */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        
        {/* --- Protected Routes --- */}
        <Route path="/" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
        
        {/* --- Role Based Routes --- */}
        
        {/* Admin: Quản lý toàn bộ */}
        <Route path="/admin" element={
          <PrivateRoute role="admin"><AdminDashboard /></PrivateRoute>
        } />
        
        {/* Coordinator: Điều phối đơn */}
        <Route path="/coordinator" element={
          <PrivateRoute role="coordinator"><CoordinatorDashboard /></PrivateRoute>
        } />
        <Route path="/assign" element={
          <PrivateRoute role="coordinator"><AssignOrder /></PrivateRoute>
        } />

        {/* Customer: Đặt hàng & Xem hồ sơ */}
        <Route path="/customer" element={
          <PrivateRoute role="customer"><CustomerDashboard /></PrivateRoute>
        } />
        <Route path="/customer/profile" element={
          <PrivateRoute role="customer"><CustomerProfile /></PrivateRoute>
        } />

        {/* Driver: Nhận đơn & Thống kê */}
        <Route path="/driver" element={
          <PrivateRoute role="driver"><DashboardDriver /></PrivateRoute>
        } />
        <Route path="/stats" element={
          <PrivateRoute role="driver"><DriverStats /></PrivateRoute>
        } />

        {/* --- Shared Routes (Dùng chung cho người đã đăng nhập) --- */}
        <Route path="/orders" element={<PrivateRoute><Orders /></PrivateRoute>} />
        <Route path="/map" element={<PrivateRoute><MapPage /></PrivateRoute>} />
        
        {/* Fallback: Nhập linh tinh sẽ về Login */}
        <Route path="*" element={<Navigate to="/login" />} />
    </Routes>
  );
}

export default App;