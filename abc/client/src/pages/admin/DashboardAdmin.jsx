import React, { useEffect, useState } from "react";
import api from "../../services/api";
import LogoutButton from "../../components/LogoutButton";

// --- IMPORTS ICONS ---
const UserIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
  </svg>
);
const CheckIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
  </svg>
);
const TrashIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);
const RefreshIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
  </svg>
);
const LockIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
  </svg>
);
const UnlockIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
  </svg>
);

function DashboardAdmin() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // 1. LẤY TOÀN BỘ USER VÀ LỌC Ở FRONTEND
  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await api.get("/users");
      setUsers(res.data);
      setLoading(false);
    } catch (err) {
      setError(err.response?.data?.message || "Lỗi khi tải dữ liệu");
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  // --- CÁC HÀM XỬ LÝ NGHIỆP VỤ ---
  const approveUser = async (id) => {
    try {
      await api.put(`/users/approve/${id}`);
      fetchUsers();
    } catch (err) { alert("Phê duyệt thất bại"); }
  };

  const deleteUser = async (id) => {
    if (!window.confirm("Bạn có chắc muốn xóa vĩnh viễn người dùng này?")) return;
    try {
      await api.delete(`/users/${id}`); 
      fetchUsers();
    } catch (err) { alert("Xóa thất bại"); }
  };

  const lockUser = async (id) => {
    if (!window.confirm("Bạn có chắc chắn muốn KHÓA tài khoản này? Người dùng sẽ không thể đăng nhập.")) return;
    try {
      // 1. Gọi API
      await api.put(`/users/${id}/lock`);
      
      // 2. Ép giao diện React cập nhật ngay lập tức
      setUsers(prev => prev.map(u => 
        u._id === id ? { ...u, status: 'locked' } : u
      ));
      
    } catch (err) { alert("Khóa tài khoản thất bại"); }
  };

  const unlockUser = async (id) => {
    if (!window.confirm("Bạn muốn MỞ KHÓA và tha bổng cho tài khoản này?")) return;
    try {
      // 1. Gọi API
      await api.put(`/users/${id}/unlock`);
      
      // 2. Ép giao diện React cập nhật ngay lập tức (Chuyển về active và xóa lý do)
      setUsers(prev => prev.map(u => 
        u._id === id ? { ...u, status: 'active', appealStatus: 'resolved', appealReason: '' } : u
      ));

    } catch (err) { alert("Mở khóa thất bại"); }
  };

  // --- PHÂN LOẠI DANH SÁCH ---
  const pendingUsers = users.filter(u => !u.approved && u.status !== 'locked');
  const activeUsers = users.filter(u => u.approved && u.status !== 'locked');
  const lockedUsers = users.filter(u => u.status === 'locked');

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-600 border-t-transparent mx-auto"></div>
          <p className="mt-4 text-gray-600 font-medium">Đang tải dữ liệu hệ thống...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-800 pb-20">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-blue-600 p-2 rounded-lg text-white">
              <UserIcon />
            </div>
            <h1 className="text-xl font-bold text-gray-900">Quản trị viên</h1>
          </div>
          <div className="flex items-center gap-4">
            <button 
              onClick={fetchUsers} 
              className="text-gray-500 hover:text-blue-600 transition p-2 rounded-full hover:bg-gray-100"
              title="Làm mới dữ liệu"
            >
              <RefreshIcon />
            </button>
            <LogoutButton />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        
        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-md shadow-sm">
            <p className="text-sm text-red-700 font-medium">Đã xảy ra lỗi: {error}</p>
          </div>
        )}

        {/* THỐNG KÊ (STATS CARDS) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Chờ phê duyệt</p>
              <p className="text-3xl font-bold text-orange-600">{pendingUsers.length}</p>
            </div>
            <div className="p-3 bg-orange-100 rounded-full text-orange-600"><UserIcon /></div>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Đang hoạt động</p>
              <p className="text-3xl font-bold text-green-600">{activeUsers.length}</p>
            </div>
            <div className="p-3 bg-green-100 rounded-full text-green-600"><CheckIcon /></div>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Bị khóa</p>
              <p className="text-3xl font-bold text-red-600">{lockedUsers.length}</p>
            </div>
            <div className="p-3 bg-red-100 rounded-full text-red-600"><LockIcon /></div>
          </div>
        </div>

        {/* =========================================================
            SECTION 1: YÊU CẦU CHỜ DUYỆT (TÀI KHOẢN MỚI)
        ========================================================= */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 bg-orange-50 flex justify-between items-center">
            <h2 className="text-lg font-bold text-orange-800 flex items-center gap-2">
              <span className="w-2 h-2 bg-orange-500 rounded-full animate-pulse"></span>
              Yêu cầu chờ duyệt
            </h2>
            <span className="px-3 py-1 bg-white text-orange-600 text-xs font-bold rounded-full border border-orange-200">
              {pendingUsers.length} Yêu cầu
            </span>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-600">
              <thead className="bg-gray-50 text-xs uppercase font-semibold text-gray-500">
                <tr>
                  <th className="px-6 py-3">Tên người dùng</th>
                  <th className="px-6 py-3">Email / SĐT</th>
                  <th className="px-6 py-3">Vai trò</th>
                  <th className="px-6 py-3 text-right">Hành động</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {pendingUsers.length === 0 ? (
                  <tr><td colSpan="4" className="px-6 py-8 text-center text-gray-400 italic">Không có yêu cầu nào.</td></tr>
                ) : (
                  pendingUsers.map((user) => (
                    <tr key={user._id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 font-bold text-gray-900">{user.name}</td>
                      <td className="px-6 py-4">{user.email}<br/><span className="text-xs text-gray-400">{user.phone || 'Chưa cập nhật SĐT'}</span></td>
                      <td className="px-6 py-4"><span className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs font-bold uppercase border">{user.role}</span></td>
                      <td className="px-6 py-4 text-right space-x-2">
                        <button onClick={() => approveUser(user._id)} className="inline-flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white text-xs font-bold rounded-md hover:bg-green-700 transition">
                          <CheckIcon /> Duyệt
                        </button>
                        <button onClick={() => deleteUser(user._id)} className="inline-flex items-center gap-1 px-3 py-1.5 bg-white text-red-600 border border-red-200 text-xs font-bold rounded-md hover:bg-red-50 transition">
                          <TrashIcon /> Từ chối
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* =========================================================
            SECTION 2: TÀI KHOẢN ĐANG HOẠT ĐỘNG
        ========================================================= */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
            <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
              <CheckIcon className="text-green-500" /> Tài khoản đang hoạt động
            </h2>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-600">
              <thead className="bg-gray-50 text-xs uppercase font-semibold text-gray-500">
                <tr>
                  <th className="px-6 py-3">Tên người dùng</th>
                  <th className="px-6 py-3">Email / SĐT</th>
                  <th className="px-6 py-3">Vai trò</th>
                  <th className="px-6 py-3 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {activeUsers.length === 0 ? (
                  <tr><td colSpan="4" className="px-6 py-8 text-center text-gray-400 italic">Chưa có thành viên nào.</td></tr>
                ) : (
                  activeUsers.map((user) => (
                    <tr key={user._id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 font-bold text-gray-900">{user.name}</td>
                      <td className="px-6 py-4">{user.email}<br/><span className="text-xs text-gray-400">{user.phone || ''}</span></td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded text-xs font-bold uppercase border ${user.role === 'admin' ? 'bg-purple-100 text-purple-700 border-purple-200' : 'bg-blue-50 text-blue-700 border-blue-100'}`}>
                          {user.role}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        {user.role !== "admin" ? (
                          <button onClick={() => lockUser(user._id)} className="inline-flex items-center gap-1 px-3 py-1.5 bg-red-100 text-red-700 border border-red-200 text-xs font-bold rounded-md hover:bg-red-200 transition">
                            <LockIcon /> Khóa
                          </button>
                        ) : (
                          <span className="text-xs text-gray-400 font-medium">Quyền tối cao</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* =========================================================
            SECTION 3: TÀI KHOẢN BỊ KHÓA & KHÁNG CÁO
        ========================================================= */}
        <div className="bg-white rounded-xl shadow-sm border border-red-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-red-100 bg-red-50 flex justify-between items-center">
            <h2 className="text-lg font-bold text-red-800 flex items-center gap-2">
              <LockIcon /> Tài khoản bị khóa
            </h2>
            <span className="px-3 py-1 bg-white text-red-600 text-xs font-bold rounded-full border border-red-200">
              {lockedUsers.length} Tài khoản
            </span>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-600">
              <thead className="bg-red-50/50 text-xs uppercase font-semibold text-gray-500 border-b border-red-100">
                <tr>
                  <th className="px-6 py-3 w-1/4">Tên / Email</th>
                  <th className="px-6 py-3 w-2/4">Tình trạng / Kháng cáo</th>
                  <th className="px-6 py-3 w-1/4 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {lockedUsers.length === 0 ? (
                  <tr><td colSpan="3" className="px-6 py-8 text-center text-gray-400 italic">Hệ thống đang bình yên, không có ai bị khóa.</td></tr>
                ) : (
                  lockedUsers.map((user) => (
                    <tr key={user._id} className="hover:bg-red-50/30 transition-colors">
                      <td className="px-6 py-4">
                        <span className="font-bold text-gray-900 block">{user.name}</span>
                        <span className="text-xs text-gray-500">{user.email}</span>
                      </td>
                      
                      {/* KHU VỰC HIỂN THỊ KHÁNG CÁO */}
                      <td className="px-6 py-4">
                        {user.appealStatus === 'pending' ? (
                          <div className="bg-orange-50 border border-orange-200 p-3 rounded-lg shadow-sm">
                            <span className="text-xs font-bold text-orange-700 uppercase flex items-center gap-1 mb-1">
                              ⚠️ Yêu cầu mở khóa:
                            </span>
                            <p className="text-sm text-gray-800 italic">"{user.appealReason}"</p>
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 text-xs font-bold rounded border border-red-200">
                            <LockIcon /> Đang khóa
                          </span>
                        )}
                      </td>

                      <td className="px-6 py-4 text-right">
                        <button onClick={() => unlockUser(user._id)} className="inline-flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white text-xs font-bold rounded-md hover:bg-green-700 transition shadow-sm">
                          <UnlockIcon /> Mở khóa
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </main>
    </div>
  );
}

export default DashboardAdmin;