import React, { useEffect } from "react";
import { useUser } from "../services/userContext";
import { useNavigate } from "react-router-dom";

const Dashboard = () => {
  const { user, logout } = useUser();
  const navigate = useNavigate();
  useEffect(() => {
    if (!user) {
      // Nếu không có user, có thể redirect về trang đăng nhập
      navigate("/login");
    }
  }, [user, navigate]);

  // Tránh lỗi khi user chưa load
  if (!user) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-lg text-gray-600">Đang tải thông tin người dùng...</p>
      </div>
    );
  }

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold">Xin chào, {user?.name}</h1>
      <p className="text-gray-600 mb-4">Vai trò: {user.role}</p>
      <button onClick={logout} className="bg-red-500 text-white px-4 py-2 rounded">
        Đăng xuất
      </button>

      <div className="mt-6 space-y-2">
        {user.role === "customer" && (
          <>
            <button onClick={() => navigate("/orders")} className="block bg-blue-500 text-white p-2 rounded">
              Quản lý đơn hàng
            </button>
          </>
        )}

        {user.role === "coordinator" && (
          <>
            <button onClick={() => navigate("/orders")} className="block bg-blue-500 text-white p-2 rounded">
              Danh sách đơn hàng
            </button>
          </>
        )}

        {user.role === "admin" && (
          <button onClick={() => navigate("/admin")} className="block bg-green-600 text-white p-2 rounded">
            Bảng điều khiển Admin
          </button>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
