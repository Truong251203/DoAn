import axios from "axios";

const api = axios.create({
  baseURL: "http://localhost:5000/api",
});

// ✅ CỬA VÀO: Tự động thêm token vào header
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// 🔥 CỬA RA: Tự động rình lỗi khóa tài khoản
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    if (error.response && error.response.status === 403) {
      if (error.response.data?.code === 'ACCOUNT_LOCKED') {
        
        // 1. Xóa sạch mọi dấu vết đăng nhập
        localStorage.removeItem("token");
        localStorage.removeItem("role");
        localStorage.removeItem("userId");

        // 🔥 NÂNG CẤP: Chỉ báo động và ép tải lại trang nếu ĐANG Ở TRONG APP (Khác trang Login)
        const currentPath = window.location.pathname;
        if (currentPath !== '/login' && currentPath !== '/register') {
            alert("🚨 Tài khoản của bạn vừa bị Admin khóa! Bạn sẽ bị đăng xuất ngay lập tức.");
            window.location.href = "/login";
        }
      }
    }
    
    // Ném lỗi ra ngoài để trang Login tự bật Form Kháng Cáo
    return Promise.reject(error);
  }
);

export default api;