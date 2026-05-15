import React, { useState } from "react";
import api from "../services/api";
import { useNavigate, Link } from "react-router-dom";

function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  // 🔥 THÊM STATE CHO MODAL KHÁNG CÁO
  const [showAppealModal, setShowAppealModal] = useState(false);
  const [appealEmail, setAppealEmail] = useState("");
  const [appealReason, setAppealReason] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    try {
      const res = await api.post("/auth/login", { email, password });
      const { token, user } = res.data;
      localStorage.setItem("token", token);
      localStorage.setItem("role", user.role);
      localStorage.setItem("userId", user.id || user._id); // Đề phòng user trả về id hoặc _id

      // Điều hướng theo vai trò
      switch (user.role) {
        case "admin":
          navigate("/admin");
          break;
        case "coordinator":
          navigate("/coordinator");
          break;
        case "customer":
          navigate("/customer");
          break;
        case "driver":
          navigate("/driver");
          break;
        default:
          navigate("/login");
      }
    } catch (err) {
      // 🔥 XỬ LÝ LỖI: BẮT RIÊNG MÃ 'ACCOUNT_LOCKED' TỪ BACKEND
      if (err.response?.data?.code === 'ACCOUNT_LOCKED') {
        setAppealEmail(err.response.data.email); // Lưu lại email bị khóa
        setShowAppealModal(true);                // Bật Modal kháng cáo lên
      } else {
        setError(err.response?.data?.message || "Lỗi đăng nhập");
      }
    }
  };

  // 🔥 HÀM GỬI YÊU CẦU MỞ KHÓA
  const handleSendAppeal = async () => {
    if (!appealReason.trim()) return alert("Vui lòng nhập lý do để Admin xem xét!");
    try {
      // Gọi API gửi kháng cáo (cùng route /auth với hàm login)
      const res = await api.post("/auth/appeal-unlock", { 
        email: appealEmail, 
        reason: appealReason 
      });
      alert(res.data.message);
      setShowAppealModal(false); // Đóng modal
      setAppealReason("");       // Xóa text
      setError("");              // Xóa câu báo lỗi cũ
    } catch (error) {
      alert(error.response?.data?.message || "Lỗi gửi yêu cầu.");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 relative">
      <form onSubmit={handleSubmit} className="bg-white p-8 rounded shadow-md w-96 relative z-10">
        <h2 className="text-2xl font-bold mb-6 text-center">Đăng nhập</h2>
        {error && <p className="text-red-500 text-sm mb-4 bg-red-50 p-2 rounded border border-red-100">{error}</p>}
        
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="border p-2 w-full mb-4 rounded focus:ring-2 focus:ring-blue-500 outline-none"
          required
        />
        <input
          type="password"
          placeholder="Mật khẩu"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="border p-2 w-full mb-6 rounded focus:ring-2 focus:ring-blue-500 outline-none"
          required
        />
        <button
          type="submit"
          className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 transition font-bold"
        >
          Đăng nhập
        </button>
        <div className="mt-4 text-center">
          <span className="text-sm text-gray-600">Chưa có tài khoản? </span>
          <Link to="/register" className="text-blue-600 hover:underline font-medium">
            Đăng ký
          </Link>
        </div>
      </form>

      {/* 🔥 MODAL KHÁNG CÁO (CHỈ HIỆN KHI BỊ KHÓA) */}
      {showAppealModal && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl">🔒</span>
                <h2 className="text-xl font-bold text-red-600">Tài khoản bị khóa</h2>
            </div>
            
            <p className="text-sm text-gray-600 mb-4">
              Tài khoản <strong>{appealEmail}</strong> của bạn đã bị khóa do vi phạm chính sách. Nếu bạn cho rằng đây là sự nhầm lẫn, vui lòng điền lý do bên dưới để Admin xem xét mở lại.
            </p>
            
            <textarea 
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 outline-none mb-4 h-32 text-sm resize-none" 
              placeholder="Nhập lý do của bạn (VD: Tôi bị khóa nhầm, xin hãy xem xét lại giúp tôi...)" 
              value={appealReason} 
              onChange={(e) => setAppealReason(e.target.value)}
            ></textarea>
            
            <div className="flex justify-end gap-3">
              <button 
                type="button"
                onClick={() => setShowAppealModal(false)} 
                className="px-4 py-2 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition"
              >
                Đóng
              </button>
              <button 
                type="button"
                onClick={handleSendAppeal} 
                className="px-4 py-2 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 transition shadow-md"
              >
                Gửi yêu cầu
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default LoginPage;