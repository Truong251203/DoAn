import React from "react";
import { useNavigate } from "react-router-dom";

function LogoutButton() {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    localStorage.removeItem("userId");
    navigate("/login");
  };

  return (
    <button
      onClick={handleLogout}
      className="
        fixed top-4 right-4
        bg-red-500 text-white px-4 py-2 rounded-lg
        shadow-lg hover:bg-red-600 transition-all
        z-50
      "
    >
      Đăng xuất
    </button>
  );
}

export default LogoutButton;
