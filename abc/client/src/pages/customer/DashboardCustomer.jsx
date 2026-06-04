import React, { useEffect, useState, useMemo } from "react";
import api from "../../services/api";
import socket from "../../services/socket";
import axios from "axios";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMapEvents,
  Polyline,
  useMap
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Components
import LogoutButton from "../../components/LogoutButton";
import GeoSearchComponent from "../../components/GeoSearchComponent";

// Icons Material UI
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import PersonIcon from '@mui/icons-material/Person';
import HistoryIcon from '@mui/icons-material/History';
import AddLocationAltIcon from '@mui/icons-material/AddLocationAlt';
import MyLocationIcon from '@mui/icons-material/MyLocation';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import CalculateIcon from '@mui/icons-material/Calculate';
import NoteAddIcon from '@mui/icons-material/NoteAdd';
import MonitorWeightIcon from '@mui/icons-material/MonitorWeight';
import PlaceIcon from '@mui/icons-material/Place';
import AccessTimeIcon from '@mui/icons-material/AccessTime'; 
import PhoneIcon from '@mui/icons-material/Phone';
import BadgeIcon from '@mui/icons-material/Badge';

// ==========================================
// 1. CẤU HÌNH ICON (XE MÁY VÀNG GIỐNG DRIVER)
// ==========================================
const driverSvgXml = `
<svg width="55px" height="55px" viewBox="0 0 64 64" version="1.1" xmlns="http://www.w3.org/2000/svg">
    <g stroke="none" stroke-width="1" fill="none" fill-rule="evenodd">
        <rect fill="#FF7F50" x="32" y="18" width="24" height="20" rx="3" stroke="#333" stroke-width="1"></rect>
        <path d="M14,42 L46,42 C48.209139,42 50,43.790861 50,46 L50,48 L10,48 L10,46 C10,43.790861 11.790861,42 14,42 Z" fill="#FFD700" stroke="#333" stroke-width="1"></path>
        <path d="M18,28 L26,28 L28,42 L16,42 L18,28 Z" fill="#FFD700" stroke="#333" stroke-width="1"></path>
        <circle fill="#333333" cx="14" cy="50" r="7"></circle>
        <circle fill="#333333" cx="46" cy="50" r="7"></circle>
        <circle fill="#CCCCCC" cx="14" cy="50" r="3"></circle>
        <circle fill="#CCCCCC" cx="46" cy="50" r="3"></circle>
        <circle fill="#FF7F50" cx="22" cy="22" r="6" stroke="#333" stroke-width="1"></circle>
    </g>
</svg>`;

const driverIcon = new L.DivIcon({
  html: driverSvgXml,
  className: 'customer-driver-icon',
  iconSize: [55, 55],
  iconAnchor: [27, 55],
  popupAnchor: [0, -50]
});

const pickupIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41],
});
const deliveryIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41],
});

// ==========================================
// 2. HELPER CHUẨN HÓA TỌA ĐỘ
// ==========================================
const normalizePoint = (point) => {
    if (!point) return null;
    let lat = Array.isArray(point) ? point[0] : point.lat;
    let lng = Array.isArray(point) ? point[1] : point.lng;
    if (!lat || !lng) return null;
    if (lat > 80) return [lng, lat];
    return [lat, lng];
};

const normalizeRoute = (route) => {
    if (!Array.isArray(route)) return [];
    return route.map(p => normalizePoint(p)).filter(p => p !== null);
};
const getAddressFromCoords = async (lat, lng) => {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`;
    const res = await axios.get(url);
    return res.data.display_name;
  } catch (error) {
    return `Tọa độ: ${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  }
};

// --- HELPER COMPONENTS ---
function MapClickHandler({ profile, setProfile, activeTab, setNewOrder, newOrder }) {
  useMapEvents({
    async click(e) {
      const { lat, lng } = e.latlng;
      if (activeTab === "profile") {
        setProfile((prev) => ({ ...prev, pickupCoords: { lat, lng }, address: "Đang tìm tên đường..." }));
      } else if (activeTab === "createOrder") {
        setNewOrder((prev) => ({ ...prev, deliveryCoords: { lat, lng }, deliveryAddress: "Đang tìm tên đường..." }));
      }
      const realAddress = await getAddressFromCoords(lat, lng);
      if (activeTab === "profile") {
        setProfile((prev) => ({ ...prev, address: realAddress }));
      } else if (activeTab === "createOrder") {
        setNewOrder((prev) => ({ ...prev, deliveryAddress: realAddress }));
      }
    },
  });
  return null;
}

function MapUpdater({ bounds, driverLocation }) {
  const map = useMap();
  useEffect(() => {
    if (bounds && bounds.length > 0) {
      try { map.fitBounds(bounds, { padding: [50, 50] }); } catch (e) {}
    }
  }, [bounds, map]);
  useEffect(() => {
      if (driverLocation) {
          map.panTo(driverLocation, { animate: true, duration: 0.5 });
      }
  }, [driverLocation, map]);
  return null;
}

// --- MAIN COMPONENT ---
function DashboardCustomer() {
  const [orders, setOrders] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  
  // Tracking
  const [driverLocation, setDriverLocation] = useState(null);
  const [routeCoords, setRouteCoords] = useState([]); 
  const [signalStatus, setSignalStatus] = useState("Đang tải dữ liệu...");

  // Data (Bổ sung cccd)
  const [profile, setProfile] = useState({ name: "", email: "", phone: "", cccd: "", address: "", pickupCoords: { lat: 21.0285, lng: 105.8542 }, pickupLocations: [] });
  
  // Data tạo đơn
  const [newOrder, setNewOrder] = useState({ pickupAddress: "", pickupCoords: null, deliveryAddress: "", deliveryCoords: null, description: "", weight: "", pickupIndex: null, pickupTime: "", recipientPhone: "" });
  const [estimation, setEstimation] = useState({ distance: 0, price: 0 });
  const [activeTab, setActiveTab] = useState("createOrder");

  // ĐÃ BỔ SUNG: State lưu giá cước từ Server
  const [pricing, setPricing] = useState({ pricePerKm: 10000, pricePerKg: 2000 });

  // --- INITIAL DATA ---
  useEffect(() => {
    fetchOrders();
    fetchProfile();
    fetchPricing(); // Bổ sung gọi API lấy giá cước
  }, []);

  const fetchPricing = async () => {
    try {
      const res = await api.get("/settings/pricing");
      if (res.data) setPricing(res.data);
    } catch (error) {
      console.warn("Lỗi tải giá cước, dùng mặc định 10k/km");
    }
  };

  // --- SOCKET LISTENERS ---
  useEffect(() => {
    const handleDriverLocation = (data) => {
        if (selectedOrder && data.orderId === selectedOrder._id) {
            const validLoc = normalizePoint(data.location);
            if (validLoc) {
                setDriverLocation(validLoc);
                setSignalStatus("Xe đang di chuyển...");
            }
        }
    };

    const handleOrderUpdated = (updatedOrder) => {
        setOrders((prev) => {
            const isMyOrder = prev.some(o => o._id === updatedOrder._id);

            if (isMyOrder) {
                setTimeout(() => {
                    if (updatedOrder.status === 'confirmed') {
                        alert(`✅ TIN VUI: Đơn hàng #${updatedOrder._id.slice(-6).toUpperCase()} của bạn đã được hệ thống XÁC NHẬN!`);
                    } else if (updatedOrder.status === 'cancelled') {
                        const reason = updatedOrder.cancelReason || updatedOrder.failedReason || "Hệ thống từ chối";
                        alert(`❌ RẤT TIẾC: Đơn hàng #${updatedOrder._id.slice(-6).toUpperCase()} đã bị HỦY.\n\nLý do: ${reason}`);
                    }
                }, 100);
            }

            return prev.map((o) => (o._id === updatedOrder._id ? updatedOrder : o));
        });

        if (selectedOrder && selectedOrder._id === updatedOrder._id) {
            setSelectedOrder(updatedOrder);
            if (updatedOrder.status === "completed") {
                setDriverLocation(null);
                setSignalStatus("Đơn hàng hoàn tất");
            }
        }
    };

    socket.on("driverLocationUpdate", handleDriverLocation);
    socket.on("orderUpdated", handleOrderUpdated);
    
    return () => { 
        socket.off("driverLocationUpdate"); 
        socket.off("orderUpdated"); 
    };
  }, [selectedOrder]);

  // --- TỰ ĐỘNG TÍNH GIÁ ---
  useEffect(() => {
    if (newOrder.pickupCoords && newOrder.deliveryCoords) {
        fetchRouteAndPrice();
    } else {
        setEstimation({ distance: 0, price: 0 }); setRouteCoords([]); 
    }
    // Thêm pricing vào mảng dependency để tính lại nếu giá server trả về chậm
  }, [newOrder.pickupCoords, newOrder.deliveryCoords, newOrder.weight, pricing]);

  const fetchRouteAndPrice = async () => {
      try {
          const orsKey = import.meta.env.VITE_ORS_API_KEY;
          if (!orsKey) return;
          const url = `https://api.openrouteservice.org/v2/directions/driving-car?api_key=${orsKey}&start=${newOrder.pickupCoords.lng},${newOrder.pickupCoords.lat}&end=${newOrder.deliveryCoords.lng},${newOrder.deliveryCoords.lat}`;
          const res = await axios.get(url);
          const rawCoords = res.data?.features?.[0]?.geometry?.coordinates || [];
          setRouteCoords(rawCoords.map(([lng, lat]) => [lat, lng]));

          const summary = res.data?.features?.[0]?.properties?.summary || {};
          const distKm = (summary.distance || 0) / 1000;
          const weightVal = parseFloat(newOrder.weight) || 0;
          
          // ĐÃ SỬA: Tính toán dựa vào giá trị lấy từ Admin
          const price = (distKm * pricing.pricePerKm) + (weightVal * pricing.pricePerKg);
          
          setEstimation({ distance: distKm, price: Math.round(price) });
      } catch (error) { setRouteCoords([]); }
  };

  // --- API CALLS ---
  const fetchOrders = async () => { try { const res = await api.get("/orders"); setOrders(res.data); } catch { alert("Lỗi tải đơn hàng"); } };
  const fetchProfile = async () => {
    try {
      const res = await api.get("/users/me");
      setProfile(res.data);
      if(res.data.address && res.data.pickupCoords) {
          setNewOrder((prev) => ({ ...prev, pickupAddress: res.data.address, pickupCoords: res.data.pickupCoords, recipientPhone: res.data.phone || "" }));
      }
    } catch { alert("Lỗi tải thông tin"); }
  };
  
  const updateProfile = async (e) => {
    e.preventDefault();
    const updatedPickupLocations = [...(profile.pickupLocations || [])];
    if (profile.address?.trim() && profile.pickupCoords) {
      const exists = updatedPickupLocations.some(loc => loc.address === profile.address.trim() && loc.lat === profile.pickupCoords.lat);
      if (!exists) updatedPickupLocations.push({ address: profile.address.trim(), lat: profile.pickupCoords.lat, lng: profile.pickupCoords.lng });
    }
    try { await api.put("/users/me", { ...profile, pickupLocations: updatedPickupLocations }); alert("Cập nhật thành công"); fetchProfile(); } catch { alert("Lỗi cập nhật"); }
  };
  
  const handleDeleteLocation = async (index) => {
    if(!window.confirm("Xóa địa chỉ này?")) return;
    try { await api.delete(`/users/pickup-location/${index}`); alert("Đã xóa"); fetchProfile(); } catch { alert("Lỗi xóa"); }
  };
  
  const createOrder = async (e) => {
    e.preventDefault();
    if (!newOrder.deliveryCoords || !newOrder.pickupCoords) return alert("Vui lòng chọn địa chỉ.");
    if (!newOrder.pickupTime) return alert("Vui lòng chọn thời gian lấy hàng.");
    if (!newOrder.recipientPhone) return alert("Vui lòng nhập SĐT người nhận.");
    
    const orderData = { ...newOrder, weight: Number(newOrder.weight || 0), price: estimation.price, distance: estimation.distance, route: routeCoords.length > 0 ? routeCoords.map(p => [p[1], p[0]]) : [] };
    try { 
        await api.post("/orders", orderData); 
        alert("Tạo đơn thành công!"); 
        setNewOrder({ pickupAddress: profile.address || "", pickupCoords: profile.pickupCoords || null, deliveryAddress: "", deliveryCoords: null, description: "", weight: "", pickupIndex: null, pickupTime: "", recipientPhone: profile.phone || "" }); 
        setEstimation({ distance: 0, price: 0 }); 
        setRouteCoords([]); 
        fetchOrders(); 
        setActiveTab("orders"); 
    } catch { alert("Lỗi tạo đơn"); }
  };

  const cancelOrder = async (order) => { 
    let cancelFee = 0;
    if (order.status === "assigned" || order.status === "confirmed") {
        cancelFee = 15000;
    }

    const confirmMessage = cancelFee > 0 
        ? `Đơn hàng này đã được hệ thống xử lý. Yêu cầu huỷ đơn sẽ bị tính phí ${cancelFee.toLocaleString()} ₫. Bạn có chắc chắn muốn huỷ không?`
        : "Đơn hàng đang chờ nhận. Bạn có chắc chắn muốn huỷ đơn này? (Miễn phí huỷ)";

    if(!window.confirm(confirmMessage)) return; 

    try { 
        await api.put(`/orders/${order._id}/request-cancel`, { cancelFee }); 
        alert("Đã gửi yêu cầu huỷ đơn thành công"); 
        fetchOrders(); 
    } catch { alert("Lỗi huỷ đơn"); } 
  };

  const handleChangeProfile = (e) => { setProfile({ ...profile, [e.target.name]: e.target.value }); };

  // --- LOGIC TRACKING ---
  const fetchRouteAPI = async (pickup, dropoff) => {
      if (!pickup || !dropoff) return [];
      const orsKey = import.meta.env.VITE_ORS_API_KEY;
      if (!orsKey) return [normalizePoint(pickup), normalizePoint(dropoff)];
      try {
          const p1 = normalizePoint(pickup);
          const p2 = normalizePoint(dropoff);
          const url = `https://api.openrouteservice.org/v2/directions/driving-car?api_key=${orsKey}&start=${p1[1]},${p1[0]}&end=${p2[1]},${p2[0]}`;
          const res = await axios.get(url);
          const raw = res.data?.features?.[0]?.geometry?.coordinates || [];
          return raw.map(c => [c[1], c[0]]);
      } catch (e) { return [normalizePoint(pickup), normalizePoint(dropoff)]; }
  };

  const showRoute = async (order) => {
    setSelectedOrder(order); 
    setActiveTab("tracking"); 
    setDriverLocation(null);
    setSignalStatus("Đang tải bản đồ...");

    if (order.pickupCoords && order.deliveryCoords) {
        const cleanRoute = await fetchRouteAPI(order.pickupCoords, order.deliveryCoords);
        setRouteCoords(cleanRoute);
    } else {
        setRouteCoords([]);
    }
  };

  const createOrderBounds = useMemo(() => {
    if (routeCoords.length > 0) return routeCoords;
    if (newOrder.pickupCoords && newOrder.deliveryCoords) return [[newOrder.pickupCoords.lat, newOrder.pickupCoords.lng], [newOrder.deliveryCoords.lat, newOrder.deliveryCoords.lng]];
    return null;
  }, [newOrder.pickupCoords, newOrder.deliveryCoords, routeCoords]);

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 font-sans pb-20">
      
      <style>{`
        .customer-driver-icon { background: transparent !important; border: none !important; }
        .customer-driver-icon svg { filter: drop-shadow(3px 3px 2px rgba(0,0,0,0.4)); overflow: visible !important; }
      `}</style>

      {/* HEADER */}
      <div className="bg-white shadow-sm sticky top-0 z-[999]">
          <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
            <h1 className="text-2xl font-bold text-blue-600 flex items-center gap-2"><LocalShippingIcon fontSize="large"/> Customer</h1>
            <div className="flex items-center gap-4">
                <div className="text-right hidden sm:block"><span className="block font-bold text-gray-700">{profile.name}</span><span className="block text-xs text-gray-500">Khách hàng</span></div>
                <LogoutButton />
            </div>
          </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 mt-8">
        
        {/* TABS */}
        <div className="flex flex-wrap justify-center gap-4 mb-8">
          {[
            { key: "createOrder", label: "Tạo đơn hàng", icon: <AddLocationAltIcon/> },
            { key: "orders", label: "Lịch sử đơn", icon: <HistoryIcon/> },
            { key: "tracking", label: "Theo dõi vận chuyển", icon: <MyLocationIcon/> },
            { key: "profile", label: "Hồ sơ cá nhân", icon: <PersonIcon/> },
          ].map((tab) => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)} className={`flex items-center gap-2 px-6 py-3 rounded-full font-bold text-sm transition-all duration-300 transform hover:-translate-y-1 ${activeTab === tab.key ? "bg-blue-600 text-white shadow-lg shadow-blue-200" : "bg-white text-gray-600 shadow-sm hover:bg-gray-100"}`}>{tab.icon} {tab.label}</button>
          ))}
        </div>

        {/* TAB 1: TẠO ĐƠN */}
        {activeTab === "createOrder" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-fadeIn">
            <div className="lg:col-span-1 space-y-6">
                <div className="bg-white p-6 rounded-2xl shadow-xl border border-gray-100">
                    <h2 className="text-lg font-bold mb-5 text-gray-800 border-b pb-3 flex items-center gap-2"><CalculateIcon color="primary"/> Thông tin đơn hàng</h2>
                    <form onSubmit={createOrder} className="space-y-5">
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase ml-1 mb-1 block">Điểm lấy hàng</label>
                            <div className="flex items-center gap-2"><PlaceIcon className="text-green-600"/>
                                <select value={newOrder.pickupIndex ?? ""} onChange={(e) => { const i = e.target.value; if (i === "") setNewOrder({ ...newOrder, pickupAddress: profile.address || "", pickupCoords: null, pickupIndex: "" }); else { const loc = profile.pickupLocations[Number(i)]; if (loc) setNewOrder({ ...newOrder, pickupAddress: loc.address, pickupCoords: { lat: loc.lat, lng: loc.lng }, pickupIndex: Number(i) }); } }} className="w-full p-2 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
                                    <option value="">-- Chọn từ danh bạ --</option>
                                    {profile.pickupLocations?.map((loc, i) => (<option key={i} value={i}>{loc.address}</option>))}
                                </select>
                            </div>
                            {newOrder.pickupAddress && <div className="mt-2 ml-8 text-xs text-gray-600 bg-gray-100 p-2 rounded">📍 {newOrder.pickupAddress}</div>}
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase ml-1 mb-1 block">Điểm giao hàng</label>
                            <div className="flex items-center gap-2"><PlaceIcon className="text-red-600"/><div className="w-full p-3 bg-red-50 border border-red-100 rounded-lg text-sm text-red-800 truncate" title={newOrder.deliveryAddress}>{newOrder.deliveryAddress ? newOrder.deliveryAddress : "👉 Chọn trên bản đồ bên phải"}</div></div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase ml-1 mb-1 block">Nặng (kg)</label>
                                <div className="flex items-center border rounded-lg px-2 bg-white">
                                    <MonitorWeightIcon className="text-gray-400 mr-1" fontSize="small"/>
                                    <input type="number" min="0.1" step="0.1" value={newOrder.weight} onChange={(e) => setNewOrder({ ...newOrder, weight: e.target.value })} className="w-full p-2 outline-none font-bold" placeholder="0.0" required />
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase ml-1 mb-1 block">SĐT Người nhận</label>
                                <div className="flex items-center border rounded-lg px-2 bg-white">
                                    <PhoneIcon className="text-gray-400 mr-1" fontSize="small"/>
                                    <input type="text" value={newOrder.recipientPhone} onChange={(e) => setNewOrder({ ...newOrder, recipientPhone: e.target.value })} className="w-full p-2 outline-none font-medium text-sm" placeholder="VD: 0987654321" required />
                                </div>
                            </div>
                        </div>
                        
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase ml-1 mb-1 block">Phải giao hàng trước</label>
                            <div className="flex items-center border border-red-200 rounded-lg px-2 bg-red-50">
                                <AccessTimeIcon className="text-red-500 mr-1" fontSize="small"/>
                                <input type="datetime-local" value={newOrder.pickupTime} onChange={(e) => setNewOrder({ ...newOrder, pickupTime: e.target.value })} className="w-full py-2 outline-none text-sm font-bold bg-transparent text-red-700" required />
                            </div>
                        </div>
                        
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase ml-1 mb-1 block">Ghi chú cho tài xế</label>
                            <div className="flex items-center border rounded-lg px-2 bg-white">
                                <NoteAddIcon className="text-gray-400 mr-1" fontSize="small"/>
                                <input value={newOrder.description} onChange={(e) => setNewOrder({ ...newOrder, description: e.target.value })} className="w-full p-2 outline-none text-sm" placeholder="VD: Gọi trước khi đến, hàng dễ vỡ..." />
                            </div>
                        </div>

                        {estimation.distance > 0 && (
                            <div className="bg-gradient-to-r from-gray-900 to-gray-800 text-white p-4 rounded-xl shadow-lg mt-4">
                                <div className="flex justify-between items-center mb-1 text-sm text-gray-400"><span>Quãng đường:</span><span className="text-white font-bold">{estimation.distance.toFixed(2)} km</span></div>
                                <div className="border-t border-gray-700 my-2"></div>
                                <div className="flex justify-between items-center"><span className="text-gray-300">Thành tiền:</span><span className="text-2xl font-bold text-green-400">{estimation.price.toLocaleString()} ₫</span></div>
                            </div>
                        )}
                        <button type="submit" className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg transition-all active:scale-95">XÁC NHẬN TẠO ĐƠN</button>
                    </form>
                </div>
            </div>
            <div className="lg:col-span-2 h-[600px] bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden relative z-0">
                <MapContainer center={newOrder.pickupCoords || [21.0285, 105.8542]} zoom={13} style={{ height: "100%", width: "100%" }}>
                    <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                    <div className="absolute top-4 right-4 z-[999] w-72 shadow-xl"><GeoSearchComponent setNewOrder={setNewOrder} /></div>
                    <MapClickHandler activeTab={activeTab} setNewOrder={setNewOrder} newOrder={newOrder} profile={profile} setProfile={setProfile} />
                    <MapUpdater bounds={createOrderBounds} />
                    {newOrder.pickupCoords && <Marker position={newOrder.pickupCoords} icon={pickupIcon}><Popup>Lấy hàng: {newOrder.pickupAddress}</Popup></Marker>}
                    {newOrder.deliveryCoords && <Marker position={newOrder.deliveryCoords} icon={deliveryIcon}><Popup>Giao hàng: {newOrder.deliveryAddress}</Popup></Marker>}
                    {routeCoords.length > 0 && <Polyline positions={routeCoords} color="#3b82f6" weight={5} opacity={0.8} />}
                </MapContainer>
                <div className="absolute bottom-6 left-4 z-[999] bg-white/90 backdrop-blur px-4 py-2 rounded-lg shadow border-l-4 border-blue-500 text-xs max-w-xs"><b>Hướng dẫn:</b> Tìm kiếm địa chỉ (góc trên phải) hoặc click trực tiếp lên bản đồ để chọn điểm giao hàng.</div>
            </div>
          </div>
        )}

        {/* TAB 2: LỊCH SỬ ĐƠN */}
        {activeTab === "orders" && (
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden min-h-[500px]">
            <div className="p-5 border-b bg-gray-50 flex justify-between items-center"><h2 className="text-xl font-bold text-gray-800">📦 Đơn hàng của tôi</h2><button onClick={fetchOrders} className="text-sm text-blue-600 hover:underline">Làm mới</button></div>
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {orders.length === 0 && <p className="text-gray-500 col-span-full text-center py-10">Chưa có đơn hàng nào.</p>}
                {orders.map((order) => {
                    const isCancelFeeApplicable = order.status === "confirmed" || order.status === "assigned";
                    
                    return (
                    <div key={order._id} onClick={() => showRoute(order)} className={`relative group p-5 border rounded-2xl bg-white cursor-pointer transition-all duration-300 hover:shadow-xl hover:-translate-y-1 ${selectedOrder?._id === order._id ? 'ring-2 ring-blue-500 bg-blue-50' : 'hover:border-blue-300'}`}>
                        <div className="flex justify-between items-start mb-3">
                            <span className="bg-gray-100 text-gray-600 text-xs font-bold px-2 py-1 rounded">#{order._id.slice(-6).toUpperCase()}</span>
                            <span className={`text-xs font-bold px-2 py-1 rounded uppercase ${order.status === 'completed' ? 'bg-green-100 text-green-700' : order.status === 'delivering' ? 'bg-yellow-100 text-yellow-700 animate-pulse' : 'bg-blue-100 text-blue-700'}`}>{order.status}</span>
                        </div>
                        <h3 className="font-bold text-gray-800 mb-1 line-clamp-2 h-10" title={order.deliveryAddress}>{order.deliveryAddress}</h3>
                        <div className="text-sm text-gray-500 space-y-2 mt-3 pt-3 border-t border-dashed">
                            <div className="flex justify-between"><span>SĐT Nhận:</span> <span className="font-medium text-gray-800">{order.recipientPhone || "Chưa có"}</span></div>
                            <div className="flex justify-between"><span>Giá cước:</span> <span className="font-bold text-green-600">{(order.price || order.cost || 0).toLocaleString()} ₫</span></div>
                            <div className="flex justify-between"><span>Ngày tạo:</span> <span className="text-gray-600 text-xs mt-0.5">{new Date(order.createdAt).toLocaleString("vi-VN")}</span></div>
                            {order.pickupTime && (
                                <div className="flex justify-between bg-red-50 p-1.5 rounded border border-red-100">
                                    <span className="text-red-600 font-semibold">Giao/Lấy trước:</span> 
                                    <span className="text-red-700 font-bold">{new Date(order.pickupTime).toLocaleString("vi-VN")}</span>
                                </div>
                            )}
                        </div>
                        
                        {/* NÚT YÊU CẦU HUỶ */}
                        {(order.status === "pending" || order.status === "confirmed" || order.status === "assigned") && !order.cancelRequest && (
                            <button onClick={(e) => { e.stopPropagation(); cancelOrder(order); }} className="mt-4 w-full py-2 text-xs font-bold text-red-500 border border-red-200 rounded-lg hover:bg-red-50 transition">
                                YÊU CẦU HUỶ {isCancelFeeApplicable ? '(CÓ PHÍ 15K)' : ''}
                            </button>
                        )}

                        {/* TRẠNG THÁI CHỜ HUỶ */}
                        {order.cancelRequest && order.status !== 'cancelled' && (
                            <div className="mt-4 text-center text-xs text-orange-600 bg-orange-50 py-2 border border-orange-200 rounded-lg">
                                Đang chờ duyệt huỷ... {isCancelFeeApplicable || order.cancelFee > 0 ? `(Phí phạt: 15.000đ)` : '(Miễn phí)'}
                            </div>
                        )}

                        {/* HIỂN THỊ KHI ĐƠN ĐÃ BỊ HỦY */}
                        {order.status === 'cancelled' && (
                            <div className="mt-4 text-center text-xs text-red-600 bg-red-50 py-2 border border-red-100 rounded-lg font-medium">
                                Đơn hàng đã bị hủy. {order.cancelReason || order.failedReason ? `Lý do: ${order.cancelReason || order.failedReason}` : ''}
                            </div>
                        )}
                    </div>
                )})}
            </div>
          </div>
        )}

        {/* TAB 3: TRACKING */}
        {activeTab === "tracking" && (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 animate-fadeIn">
            <div className="lg:col-span-1 bg-white p-6 rounded-2xl shadow-lg h-fit border border-gray-100">
                {selectedOrder ? (
                    <div className="space-y-4">
                        <h2 className="text-lg font-bold border-b pb-2 text-gray-800">Chi tiết vận đơn</h2>
                        <div><p className="text-xs text-gray-400 uppercase">Mã đơn hàng</p><p className="font-mono font-bold text-blue-600 text-lg">#{selectedOrder._id.toUpperCase()}</p></div>
                        <div><p className="text-xs text-gray-400 uppercase">Trạng thái hiện tại</p><span className={`inline-block px-3 py-1 rounded-full text-sm font-bold uppercase mt-1 ${selectedOrder.status === 'delivering' ? 'bg-yellow-100 text-yellow-700' : 'bg-blue-100 text-blue-700'}`}>{selectedOrder.status}</span></div>
                        <div><p className="text-xs text-gray-400 uppercase">Tài xế phụ trách</p><p className="font-medium text-gray-800">{selectedOrder.driverId ? selectedOrder.driverId.name : "Đang tìm tài xế..."}</p></div>
                        <div><p className="text-xs text-gray-400 uppercase">SĐT Người Nhận</p><p className="font-bold text-gray-800">{selectedOrder.recipientPhone || "Chưa cập nhật"}</p></div>
                        
                        <div className="pt-2 border-t border-gray-100">
                            <div><p className="text-xs text-gray-400 uppercase">Ngày tạo đơn</p><p className="font-medium text-gray-600">{new Date(selectedOrder.createdAt).toLocaleString("vi-VN")}</p></div>
                            {selectedOrder.pickupTime && (
                                <div className="mt-2 bg-red-50 p-2 border border-red-100 rounded-lg">
                                    <p className="text-xs text-red-500 uppercase font-bold">Hạn lấy hàng/Giao hàng</p>
                                    <p className="font-bold text-red-700 text-sm mt-1">{new Date(selectedOrder.pickupTime).toLocaleString("vi-VN")}</p>
                                </div>
                            )}
                            {selectedOrder.status === 'cancelled' && (
        <div className="mt-2 bg-red-50 p-3 border border-red-200 rounded-lg">
            <p className="text-xs text-red-600 uppercase font-black">❌ Đơn hàng đã bị hủy</p>
            <p className="font-medium text-red-800 text-sm mt-1">Lý do: {selectedOrder.cancelReason || selectedOrder.failedReason || "Hệ thống từ chối"}</p>
        </div>
    )}
                        </div>

                        <div className="bg-gray-50 p-3 rounded-xl border border-gray-200">
                            <div className="flex items-start gap-2"><div className="mt-1 w-2 h-2 rounded-full bg-green-500"></div><div><p className="text-xs text-gray-400 uppercase">Điểm đi</p><p className="text-sm font-semibold text-gray-700 line-clamp-2">{selectedOrder.pickupAddress}</p></div></div>
                            <div className="h-4 border-l-2 border-dashed border-gray-300 ml-2 my-1"></div>
                            <div className="flex items-start gap-2"><div className="mt-1 w-2 h-2 rounded-full bg-red-500"></div><div><p className="text-xs text-gray-400 uppercase">Điểm đến</p><p className="text-sm font-semibold text-gray-700 line-clamp-2">{selectedOrder.deliveryAddress}</p></div></div>
                        </div>
                    </div>
                ) : <div className="text-center py-10 text-gray-400"><HistoryIcon fontSize="large" className="mb-2 opacity-50"/><p>Vui lòng chọn đơn hàng từ tab <b>"Lịch sử đơn"</b> để xem chi tiết.</p></div>}
            </div>
            <div className="lg:col-span-3 h-[600px] bg-white rounded-2xl shadow-xl overflow-hidden relative border border-gray-200">
                {selectedOrder?.status === 'delivering' && <div className="absolute top-4 left-4 z-[999] bg-white/90 px-4 py-2 rounded-lg shadow border-l-4 border-green-500"><p className="font-bold text-green-700 flex items-center gap-2">{signalStatus}</p></div>}
                <MapContainer center={normalizePoint(selectedOrder?.pickupCoords) || [21.0285, 105.8542]} zoom={13} style={{ height: "100%", width: "100%" }}>
                    <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                    {routeCoords.length > 0 && <Polyline positions={normalizeRoute(routeCoords)} color="#3b82f6" weight={6} opacity={0.8} />}
                    {selectedOrder && (
                        <>
                            {normalizePoint(selectedOrder.pickupCoords) && <Marker position={normalizePoint(selectedOrder.pickupCoords)} icon={pickupIcon}><Popup>Điểm đi: {selectedOrder.pickupAddress}</Popup></Marker>}
                            {normalizePoint(selectedOrder.deliveryCoords) && <Marker position={normalizePoint(selectedOrder.deliveryCoords)} icon={deliveryIcon}><Popup>Điểm đến: {selectedOrder.deliveryAddress}</Popup></Marker>}
                            {driverLocation && selectedOrder.status === 'delivering' && (
                                <Marker position={driverLocation} icon={driverIcon} zIndexOffset={9999}>
                                    <Popup>Shipper đang ở đây</Popup>
                                </Marker>
                            )}
                        </>
                    )}
                    <MapUpdater bounds={routeCoords.length > 0 ? normalizeRoute(routeCoords) : (selectedOrder?.pickupCoords ? [normalizePoint(selectedOrder.pickupCoords), normalizePoint(selectedOrder.deliveryCoords)] : [])} driverLocation={driverLocation} />
                </MapContainer>
            </div>
          </div>
        )}

        {/* TAB 4: PROFILE */}
        {activeTab === "profile" && profile && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-fadeIn">
            <div className="bg-white p-6 rounded-2xl shadow-xl border border-gray-100 h-fit">
                <h2 className="text-xl font-bold mb-5 flex items-center gap-2 text-gray-800"><PersonIcon className="text-blue-500"/> Hồ sơ & Địa chỉ</h2>
                <form onSubmit={updateProfile} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase ml-1">Họ tên</label>
                            <input name="name" value={profile.name} onChange={handleChangeProfile} className="border p-2 rounded-lg w-full focus:ring-2 focus:ring-blue-500 outline-none" required />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase ml-1">Email</label>
                            <input value={profile.email} readOnly className="w-full border p-2 rounded-lg bg-gray-100 text-gray-500 cursor-not-allowed" />
                        </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase ml-1 flex items-center gap-1"><PhoneIcon fontSize="small"/> Số điện thoại</label>
                            <input name="phone" value={profile.phone} onChange={handleChangeProfile} className="border p-2 rounded-lg w-full focus:ring-2 focus:ring-blue-500 outline-none" placeholder="VD: 0987654321" />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase ml-1 flex items-center gap-1"><BadgeIcon fontSize="small"/> CCCD / CMND</label>
                            <input name="cccd" value={profile.cccd || ''} onChange={handleChangeProfile} className="border p-2 rounded-lg w-full focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Nhập số CCCD..." />
                        </div>
                    </div>
                    <div className="pt-4 border-t border-gray-100">
                        <label className="text-sm font-bold text-gray-700">Thêm địa chỉ mới</label>
                        <div className="flex gap-2 mt-1"><input name="address" value={profile.address} onChange={handleChangeProfile} placeholder="Nhập tên gợi nhớ (VD: Nhà riêng)..." className="flex-1 border p-2 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" /></div>
                        <p className="text-xs text-blue-500 mt-1 flex items-center gap-1"><MyLocationIcon fontSize="small"/> Click bản đồ bên cạnh để lấy tên đường & tọa độ.</p>
                    </div>
                    <button type="submit" className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow transition">LƯU THÔNG TIN</button>
                </form>
                <div className="mt-8">
                    <h3 className="font-bold text-gray-700 mb-3 flex items-center gap-2"><PlaceIcon fontSize="small" className="text-red-500"/> Địa chỉ đã lưu</h3>
                    <ul className="space-y-2 max-h-[250px] overflow-y-auto pr-2 custom-scrollbar">
                        {profile.pickupLocations?.map((loc, i) => (
                            <li key={i} className="flex justify-between items-center p-3 bg-gray-50 border border-gray-200 rounded-xl hover:bg-white hover:shadow-md transition group">
                                <div className="overflow-hidden"><span className="font-bold text-sm block text-gray-800 truncate" title={loc.address}>{loc.address}</span><span className="text-xs text-gray-400 font-mono">Lat: {loc.lat?.toFixed(3)}, Lng: {loc.lng?.toFixed(3)}</span></div>
                                <button type="button" onClick={() => handleDeleteLocation(i)} className="text-gray-300 hover:text-red-500 p-2 transition group-hover:text-red-400" title="Xóa địa chỉ"><DeleteForeverIcon/></button>
                            </li>
                        ))}
                        {(!profile.pickupLocations || profile.pickupLocations.length === 0) && <p className="text-sm text-gray-400 italic text-center py-4">Chưa có địa chỉ nào.</p>}
                    </ul>
                </div>
            </div>
            <div className="h-[600px] bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden relative">
                 <MapContainer center={profile.pickupCoords?.lat ? [profile.pickupCoords.lat, profile.pickupCoords.lng] : [21.0285, 105.8542]} zoom={13} style={{ height: "100%", width: "100%" }}>
                    <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                    <div className="absolute top-4 right-4 z-[999] w-64 shadow-lg"><GeoSearchComponent mode="profile" setProfile={setProfile} profile={profile} /></div>
                    <MapClickHandler activeTab="profile" setProfile={setProfile} profile={profile} />
                    {profile.pickupCoords?.lat && <Marker position={[profile.pickupCoords.lat, profile.pickupCoords.lng]} icon={pickupIcon}><Popup>Vị trí đang chọn: {profile.address}</Popup></Marker>}
                 </MapContainer>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default DashboardCustomer;