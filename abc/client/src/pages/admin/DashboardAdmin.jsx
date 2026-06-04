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
const MoneyIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);
const UserAddIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
  </svg>
);
const EditIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
  </svg>
);
const FilterIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
  </svg>
);

// Danh sách các khu vực hệ thống hỗ trợ (Có thể fetch từ API)
const AVAILABLE_AREAS = [
  "Hà Nội", "Hồ Chí Minh", "Đà Nẵng", "Hải Phòng", "Cần Thơ", 
  "Bình Dương", "Đồng Nai", "Bắc Ninh", "Hải Dương", "Thanh Hóa"
];

function DashboardAdmin() {
  const [activeTab, setActiveTab] = useState("accounts");

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // --- STATE: BỘ LỌC VAI TRÒ ---
  const [roleFilter, setRoleFilter] = useState("all");

  const [pricing, setPricing] = useState({ pricePerKm: 10000, pricePerKg: 2000 });
  const [isUpdatingPrice, setIsUpdatingPrice] = useState(false);

  // --- STATE: TẠO/SỬA ĐIỀU PHỐI VIÊN ---
  const [coordForm, setCoordForm] = useState({ name: '', email: '', phone: '', password: '', managedAreas: [] });
  const [isCreatingCoord, setIsCreatingCoord] = useState(false);
  const [coordMessage, setCoordMessage] = useState({ type: '', text: '' });
  
  // State quản lý việc sửa khu vực của điều phối viên đã tồn tại
  const [editingCoord, setEditingCoord] = useState(null); // { _id, name, managedAreas }
  const [isUpdatingAreas, setIsUpdatingAreas] = useState(false);

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

  const fetchPricing = async () => {
    try {
      const res = await api.get("/settings/pricing");
      if (res.data) setPricing(res.data);
    } catch (err) {
      console.warn("Chưa có cấu hình giá cước từ server, đang dùng giá mặc định.");
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchPricing();
  }, []);

  // --- HÀM LẤY DANH SÁCH CÁC KHU VỰC ĐÃ CÓ NGƯỜI QUẢN LÝ ---
  const getAssignedAreas = (excludeUserId = null) => {
    let assigned = new Set();
    users.forEach(u => {
      if (u.role === 'coordinator' && u._id !== excludeUserId && Array.isArray(u.managedAreas)) {
        u.managedAreas.forEach(area => assigned.add(area));
      }
    });
    return Array.from(assigned);
  };

  const assignedAreasGlobal = getAssignedAreas();

  // --- NGHIỆP VỤ USERS ---
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
      await api.put(`/users/${id}/lock`);
      setUsers(prev => prev.map(u => u._id === id ? { ...u, status: 'locked' } : u));
    } catch (err) { alert("Khóa tài khoản thất bại"); }
  };

  const unlockUser = async (id) => {
    if (!window.confirm("Bạn muốn MỞ KHÓA và tha bổng cho tài khoản này?")) return;
    try {
      await api.put(`/users/${id}/unlock`);
      setUsers(prev => prev.map(u => u._id === id ? { ...u, status: 'active', appealStatus: 'resolved', appealReason: '' } : u));
    } catch (err) { alert("Mở khóa thất bại"); }
  };

  // --- GIÁ CƯỚC ---
  const handleUpdatePricing = async (e) => {
    e.preventDefault();
    setIsUpdatingPrice(true);
    try {
      await api.put("/settings/pricing", pricing);
      alert("Cập nhật giá cước thành công!");
    } catch (err) {
      alert("Cập nhật giá cước thất bại. " + (err.response?.data?.message || ""));
    } finally {
      setIsUpdatingPrice(false);
    }
  };

  // --- TẠO TÀI KHOẢN COORDINATOR ---
  const handleCreateCoordinator = async (e) => {
    e.preventDefault();
    setIsCreatingCoord(true);
    setCoordMessage({ type: '', text: '' });
    try {
      await api.post("/users/create-coordinator", { 
        ...coordForm, 
        role: 'coordinator', 
        approved: true 
      });
      setCoordMessage({ type: 'success', text: 'Tạo tài khoản Điều phối viên thành công!' });
      setCoordForm({ name: '', email: '', phone: '', password: '', managedAreas: [] });
      fetchUsers(); 
    } catch (err) {
      setCoordMessage({ type: 'error', text: err.response?.data?.message || 'Lỗi khi tạo tài khoản' });
    } finally {
      setIsCreatingCoord(false);
    }
  };

  const toggleAreaForForm = (area) => {
    setCoordForm(prev => ({
      ...prev,
      managedAreas: prev.managedAreas.includes(area)
        ? prev.managedAreas.filter(a => a !== area)
        : [...prev.managedAreas, area]
    }));
  };

  // --- SỬA KHU VỰC CỦA ĐIỀU PHỐI VIÊN ---
  const handleUpdateAreas = async () => {
    if (!editingCoord) return;
    setIsUpdatingAreas(true);
    try {
      await api.put(`/users/${editingCoord._id}/areas`, { managedAreas: editingCoord.managedAreas });
      alert("Cập nhật khu vực thành công!");
      fetchUsers(); 
      setEditingCoord(null);
    } catch (err) {
      alert("Lỗi khi cập nhật khu vực: " + (err.response?.data?.message || err.message));
    } finally {
      setIsUpdatingAreas(false);
    }
  };

  const toggleAreaForEdit = (area) => {
    setEditingCoord(prev => ({
      ...prev,
      managedAreas: prev.managedAreas.includes(area)
        ? prev.managedAreas.filter(a => a !== area)
        : [...prev.managedAreas, area]
    }));
  };

  // --- PHÂN LOẠI DANH SÁCH ---
  const pendingUsers = users.filter(u => !u.approved && u.status !== 'locked');
  const activeUsers = users.filter(u => 
    u.approved && 
    u.status !== 'locked' &&
    (roleFilter === 'all' || u.role === roleFilter)
  );
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
            <div className="bg-blue-600 p-2 rounded-lg text-white"><UserIcon /></div>
            <h1 className="text-xl font-bold text-gray-900">Quản trị viên</h1>
          </div>
          <div className="flex items-center gap-4">
            <button 
              onClick={() => { fetchUsers(); fetchPricing(); }} 
              className="text-gray-500 hover:text-blue-600 transition p-2 rounded-full hover:bg-gray-100"
              title="Làm mới dữ liệu"
            >
              <RefreshIcon />
            </button>
            <LogoutButton />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        
        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-md shadow-sm">
            <p className="text-sm text-red-700 font-medium">Đã xảy ra lỗi: {error}</p>
          </div>
        )}

        {/* THỐNG KÊ NHANH */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Chờ phê duyệt</p>
              <p className="text-3xl font-bold text-orange-600">{pendingUsers.length}</p>
            </div>
            <div className="p-3 bg-orange-100 rounded-full text-orange-600"><UserIcon /></div>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Đang hoạt động (Tổng)</p>
              <p className="text-3xl font-bold text-green-600">
                {users.filter(u => u.approved && u.status !== 'locked').length}
              </p>
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

        {/* TABS NAVIGATION */}
        <div className="flex border-b border-gray-200 mb-6">
          <button 
            onClick={() => setActiveTab("accounts")}
            className={`flex items-center gap-2 py-3 px-6 font-bold text-sm transition-colors border-b-2 ${activeTab === "accounts" ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}
          >
            <UserIcon /> Quản lý Tài khoản
          </button>
          <button 
            onClick={() => setActiveTab("create-coord")}
            className={`flex items-center gap-2 py-3 px-6 font-bold text-sm transition-colors border-b-2 ${activeTab === "create-coord" ? "border-purple-600 text-purple-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}
          >
            <UserAddIcon /> Tạo Điều phối viên
          </button>
          <button 
            onClick={() => setActiveTab("settings")}
            className={`flex items-center gap-2 py-3 px-6 font-bold text-sm transition-colors border-b-2 ${activeTab === "settings" ? "border-green-600 text-green-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}
          >
            <MoneyIcon /> Điều chỉnh giá 
          </button>
        </div>

        {/* =========================================================
            TAB 1: QUẢN LÝ TÀI KHOẢN
        ========================================================= */}
        {activeTab === "accounts" && (
          <div className="space-y-8 animate-fadeIn">
            {/* SECTION 1: YÊU CẦU CHỜ DUYỆT */}
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

            {/* SECTION 2: TÀI KHOẢN ĐANG HOẠT ĐỘNG */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 flex flex-wrap justify-between items-center gap-4">
                <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                  <CheckIcon className="text-green-500" /> Tài khoản đang hoạt động
                </h2>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-gray-600">
                  <thead className="bg-gray-50 text-xs uppercase font-semibold text-gray-500 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-3">Tên người dùng</th>
                      <th className="px-6 py-3">Email / SĐT</th>
                      
                      {/* BỘ LỌC ĐƯỢC NHÚNG THẲNG VÀO THÀNH TEXT TIÊU ĐỀ */}
                      <th className="px-6 py-3">
                        <div className="relative inline-flex items-center group">
                          <select 
                            value={roleFilter}
                            onChange={(e) => setRoleFilter(e.target.value)}
                            title="Nhấp để lọc theo vai trò"
                            className="appearance-none bg-transparent uppercase font-semibold text-gray-500 group-hover:text-blue-600 cursor-pointer outline-none pr-5 z-10 w-full transition-colors"
                          >
                            <option value="all" className="text-gray-700 normal-case font-medium">Vai trò / Khu vực</option>
                            <option value="admin" className="text-gray-700 normal-case font-medium">Admin</option>
                            <option value="coordinator" className="text-gray-700 normal-case font-medium">Điều phối viên</option>
                            <option value="driver" className="text-gray-700 normal-case font-medium">Tài xế</option>
                            <option value="user" className="text-gray-700 normal-case font-medium">Khách hàng</option>
                          </select>
                          <div className="pointer-events-none absolute right-0 text-gray-400 group-hover:text-blue-600 transition-colors">
                            <FilterIcon />
                          </div>
                        </div>
                      </th>
                      
                      <th className="px-6 py-3 text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {activeUsers.length === 0 ? (
                      <tr><td colSpan="4" className="px-6 py-8 text-center text-gray-400 italic">Không tìm thấy thành viên nào phù hợp bộ lọc.</td></tr>
                    ) : (
                      activeUsers.map((user) => (
                        <tr key={user._id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 font-bold text-gray-900">{user.name}</td>
                          <td className="px-6 py-4">{user.email}<br/><span className="text-xs text-gray-400">{user.phone || ''}</span></td>
                          
                          {/* CỘT VAI TRÒ VÀ KHU VỰC QUẢN LÝ */}
                          <td className="px-6 py-4">
                            <span className={`inline-block mb-1 px-2 py-1 rounded text-xs font-bold uppercase border ${user.role === 'admin' ? 'bg-blue-100 text-blue-700 border-blue-200' : user.role === 'coordinator' ? 'bg-purple-100 text-purple-700 border-purple-200' : 'bg-gray-100 text-gray-700 border-gray-200'}`}>
                              {user.role}
                            </span>
                            {user.role === 'coordinator' && (
                              <div className="mt-1 text-xs text-gray-500">
                                {user.managedAreas && user.managedAreas.length > 0 ? (
                                  <div className="flex flex-wrap gap-1 mt-1">
                                    {user.managedAreas.map((area, idx) => (
                                      <span key={idx} className="bg-gray-100 px-2 py-0.5 rounded border border-gray-200">{area}</span>
                                    ))}
                                  </div>
                                ) : (
                                  <span className="italic text-gray-400">Chưa xếp khu vực</span>
                                )}
                              </div>
                            )}
                          </td>
                          
                          <td className="px-6 py-4 text-right space-x-2">
                            {user.role === "coordinator" && (
                              <button 
                                onClick={() => setEditingCoord({ _id: user._id, name: user.name, managedAreas: user.managedAreas || [] })} 
                                className="inline-flex items-center gap-1 px-3 py-1.5 bg-indigo-50 text-indigo-600 border border-indigo-200 text-xs font-bold rounded-md hover:bg-indigo-100 transition"
                              >
                                <EditIcon /> Sửa KV
                              </button>
                            )}

                            {user.role !== "admin" ? (
                              <button onClick={() => lockUser(user._id)} className="inline-flex items-center gap-1 px-3 py-1.5 bg-red-50 text-red-600 border border-red-200 text-xs font-bold rounded-md hover:bg-red-100 transition">
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

            {/* SECTION 3: TÀI KHOẢN BỊ KHÓA & KHÁNG CÁO */}
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
          </div>
        )}

        {/* =========================================================
            TAB 2: TẠO TÀI KHOẢN ĐIỀU PHỐI VIÊN
        ========================================================= */}
        {activeTab === "create-coord" && (
          <div className="max-w-3xl mx-auto animate-fadeIn">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
                <div className="p-2 bg-purple-100 text-purple-700 rounded-lg"><UserAddIcon /></div>
                <h2 className="text-lg font-bold text-gray-800">Tạo tài khoản Điều phối viên & Phân quyền Khu vực</h2>
              </div>
              <form onSubmit={handleCreateCoordinator} className="p-6 space-y-6">
                
                {coordMessage.text && (
                  <div className={`p-4 rounded-lg text-sm font-medium ${coordMessage.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                    {coordMessage.text}
                  </div>
                )}

                {/* THÔNG TIN CƠ BẢN */}
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-gray-900 border-b pb-2">1. Thông tin cá nhân</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Họ và tên</label>
                      <input type="text" required value={coordForm.name} onChange={(e) => setCoordForm({...coordForm, name: e.target.value})} className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Số điện thoại</label>
                      <input type="text" required value={coordForm.phone} onChange={(e) => setCoordForm({...coordForm, phone: e.target.value})} className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none" />
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email (Dùng để đăng nhập)</label>
                    <input type="email" required value={coordForm.email} onChange={(e) => setCoordForm({...coordForm, email: e.target.value})} className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none" />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Mật khẩu khởi tạo</label>
                    <input type="password" required value={coordForm.password} onChange={(e) => setCoordForm({...coordForm, password: e.target.value})} className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none" />
                  </div>
                </div>

                {/* PHÂN QUYỀN KHU VỰC */}
                <div className="space-y-4 pt-4">
                  <h3 className="text-sm font-bold text-gray-900 border-b pb-2 flex justify-between items-end">
                    <span>2. Chọn khu vực quản lý</span>
                    <span className="text-xs font-normal text-gray-500">*Mỗi khu vực chỉ có 1 người quản lý</span>
                  </h3>
                  
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {AVAILABLE_AREAS.map(area => {
                      const isAssigned = assignedAreasGlobal.includes(area);
                      const isSelected = coordForm.managedAreas.includes(area);
                      
                      return (
                        <label 
                          key={area} 
                          className={`flex items-center gap-2 p-3 border rounded-lg cursor-pointer transition-colors ${
                            isAssigned 
                              ? 'bg-gray-100 border-gray-200 opacity-60 cursor-not-allowed' 
                              : isSelected 
                                ? 'bg-purple-50 border-purple-400 text-purple-800' 
                                : 'bg-white border-gray-300 hover:bg-gray-50'
                          }`}
                        >
                          <input 
                            type="checkbox" 
                            className="w-4 h-4 text-purple-600 rounded"
                            checked={isSelected}
                            disabled={isAssigned}
                            onChange={() => toggleAreaForForm(area)}
                          />
                          <span className={`text-sm ${isAssigned ? 'text-gray-400 line-through' : 'font-medium'}`}>{area}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div className="pt-6 border-t border-gray-100">
                  <button 
                    type="submit" 
                    disabled={isCreatingCoord}
                    className="w-full bg-purple-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-purple-700 transition disabled:bg-purple-400"
                  >
                    {isCreatingCoord ? "Đang xử lý..." : "Xác nhận tạo Điều phối viên"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* =========================================================
            TAB 3: CẤU HÌNH HỆ THỐNG
        ========================================================= */}
        {activeTab === "settings" && (
          <div className="max-w-2xl mx-auto animate-fadeIn">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
                <div className="p-2 bg-green-100 text-green-700 rounded-lg"><MoneyIcon /></div>
                <h2 className="text-lg font-bold text-gray-800">Giá cước</h2>
              </div>
              <form onSubmit={handleUpdatePricing} className="p-6 space-y-6">
                
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 flex gap-3">
                  <span className="text-xl">💡</span>
                  <p className="text-sm text-blue-800">
                    Giá cước mới sẽ được áp dụng ngay lập tức cho các đơn hàng tạo sau thời điểm lưu cấu hình. Các đơn hàng cũ vẫn giữ nguyên giá đã tính.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Giá cước cơ bản mỗi Km (VNĐ)</label>
                  <div className="relative">
                    <input type="number" required value={pricing.pricePerKm} onChange={(e) => setPricing({...pricing, pricePerKm: Number(e.target.value)})} className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none text-lg font-medium" />
                    <span className="absolute right-4 top-3.5 text-gray-400 font-bold">VNĐ</span>
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Giá phụ thu mỗi Kg (VNĐ)</label>
                  <div className="relative">
                    <input type="number" required value={pricing.pricePerKg} onChange={(e) => setPricing({...pricing, pricePerKg: Number(e.target.value)})} className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none text-lg font-medium" />
                    <span className="absolute right-4 top-3.5 text-gray-400 font-bold">VNĐ</span>
                  </div>
                </div>

                <div className="pt-4 border-t border-gray-100">
                  <button type="submit" disabled={isUpdatingPrice} className="w-full bg-green-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-green-700 transition disabled:bg-green-400 shadow-sm">
                    {isUpdatingPrice ? "Đang lưu cấu hình..." : "Lưu thay đổi giá cước"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </main>

      {/* =========================================================
          MODAL: SỬA KHU VỰC QUẢN LÝ
      ========================================================= */}
      {editingCoord && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full p-6 animate-fadeIn">
            <h2 className="text-xl font-bold text-gray-900 mb-2">Điều chỉnh khu vực quản lý</h2>
            <p className="text-sm text-gray-500 mb-6">Đang điều chỉnh cho ĐPV: <span className="font-bold text-indigo-600">{editingCoord.name}</span></p>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6 max-h-64 overflow-y-auto p-2">
              {AVAILABLE_AREAS.map(area => {
                const assignedByOthers = getAssignedAreas(editingCoord._id);
                const isAssignedToOther = assignedByOthers.includes(area);
                const isSelected = editingCoord.managedAreas.includes(area);

                return (
                  <label 
                    key={area} 
                    className={`flex items-center gap-2 p-3 border rounded-lg cursor-pointer transition-colors ${
                      isAssignedToOther 
                        ? 'bg-gray-100 border-gray-200 opacity-60 cursor-not-allowed' 
                        : isSelected 
                          ? 'bg-indigo-50 border-indigo-400 text-indigo-800 shadow-sm' 
                          : 'bg-white border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <input 
                      type="checkbox" 
                      className="w-4 h-4 text-indigo-600 rounded"
                      checked={isSelected}
                      disabled={isAssignedToOther}
                      onChange={() => toggleAreaForEdit(area)}
                    />
                    <span className={`text-sm ${isAssignedToOther ? 'text-gray-400 line-through' : 'font-medium'}`}>{area}</span>
                  </label>
                );
              })}
            </div>

            <div className="flex justify-end gap-3 border-t pt-4">
              <button 
                onClick={() => setEditingCoord(null)}
                className="px-4 py-2 text-gray-600 font-medium bg-gray-100 hover:bg-gray-200 rounded-lg transition"
              >
                Hủy bỏ
              </button>
              <button 
                onClick={handleUpdateAreas}
                disabled={isUpdatingAreas}
                className="px-4 py-2 text-white font-bold bg-indigo-600 hover:bg-indigo-700 rounded-lg transition disabled:bg-indigo-400"
              >
                {isUpdatingAreas ? "Đang lưu..." : "Lưu thay đổi"}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default DashboardAdmin;