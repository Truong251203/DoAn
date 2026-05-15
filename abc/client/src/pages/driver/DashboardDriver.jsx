import React, { useEffect, useState, useRef, useMemo } from "react";
import api from "../../services/api";
import L from "leaflet";
import { MapContainer, TileLayer, Marker, Polyline, Popup, useMap } from "react-leaflet";
import socket from "../../services/socket";
import LogoutButton from "../../components/LogoutButton";
import axios from "axios";
import "leaflet/dist/leaflet.css";

// Icons UI
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import SpeedIcon from '@mui/icons-material/Speed';
import LocalGasStationIcon from '@mui/icons-material/LocalGasStation';
import PersonIcon from '@mui/icons-material/Person';
import NavigationIcon from '@mui/icons-material/Navigation';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import PlayCircleFilledWhiteIcon from '@mui/icons-material/PlayCircleFilledWhite';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import CloseIcon from '@mui/icons-material/Close';
import CancelIcon from '@mui/icons-material/Cancel';
import AccessAlarmIcon from '@mui/icons-material/AccessAlarm';

// --- 1. ICON XE MÁY (SVG) ---
const driverSvgXml = `
<svg width="55px" height="55px" viewBox="0 0 64 64" version="1.1" xmlns="http://www.w3.org/2000/svg">
    <g stroke="none" stroke-width="1" fill="none" fill-rule="evenodd">
        <rect fill="#FF7F50" x="32" y="18" width="24" height="20" rx="3"></rect>
        <path d="M14,42 L46,42 C48.209139,42 50,43.790861 50,46 L50,48 L10,48 L10,46 C10,43.790861 11.790861,42 14,42 Z" fill="#FFD700"></path>
        <path d="M18,28 L26,28 L28,42 L16,42 L18,28 Z" fill="#FFD700"></path>
        <circle fill="#333333" cx="14" cy="50" r="7"></circle>
        <circle fill="#333333" cx="46" cy="50" r="7"></circle>
        <circle fill="#CCCCCC" cx="14" cy="50" r="3"></circle>
        <circle fill="#CCCCCC" cx="46" cy="50" r="3"></circle>
        <circle fill="#FF7F50" cx="22" cy="22" r="6"></circle>
    </g>
</svg>`;

const driverIcon = new L.DivIcon({
  html: driverSvgXml,
  className: 'svg-driver-icon',
  iconSize: [55, 55],
  iconAnchor: [27, 55],
  popupAnchor: [0, -50]
});

const deliveryIcon = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
});
const pickupIcon = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
});

// --- HELPER MỚI: TẤM KHIÊN CHỐNG SẬP TỌA ĐỘ ---
const normalizePoint = (point) => {
    if (!point) return null;
    if (typeof point.lat === 'number' && typeof point.lng === 'number') return { lat: point.lat, lng: point.lng };
    if (Array.isArray(point) && point.length >= 2) return { lat: point[0], lng: point[1] };
    return null;
};

const getPoint = (obj, type) => {
    if (!obj) return null;
    try {
        if (type === 'pickup') {
            if (obj.pickupCoords) return normalizePoint(obj.pickupCoords);
            if (obj.pickup) return normalizePoint(obj.pickup);
            if (Array.isArray(obj.route) && obj.route.length > 0) return normalizePoint(obj.route[0]);
        }
        if (type === 'dropoff') {
            if (obj.deliveryCoords) return normalizePoint(obj.deliveryCoords);
            if (obj.dropoffCoords) return normalizePoint(obj.dropoffCoords);
            if (obj.dropoff) return normalizePoint(obj.dropoff);
            if (Array.isArray(obj.route) && obj.route.length > 0) return normalizePoint(obj.route[obj.route.length - 1]);
        }
    } catch (e) {
        return null;
    }
    return null;
};

// --- HELPER: TÍNH KHOẢNG CÁCH (Haversine) ---
const getDistance = (lat1, lon1, lat2, lon2) => {
    if (typeof lat1 !== 'number' || typeof lon1 !== 'number' || typeof lat2 !== 'number' || typeof lon2 !== 'number') return Infinity;
    const R = 6371; 
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

// --- HELPER: MAP UPDATER ---
function MapUpdater({ center, route }) {
  const map = useMap();
  useEffect(() => {
    if (center && center[0] > 0) map.flyTo(center, 16, { animate: true, duration: 1.0 });
  }, [center, map]);

  useEffect(() => {
      if (route && route.length > 0) {
          try { map.fitBounds(L.latLngBounds(route), { padding: [50, 50] }); } catch (e) {}
      }
  }, [route, map]);
  return null;
}

// --- MAIN COMPONENT ---
function DashboardDriver() {
  const [orders, setOrders] = useState([]);
  
  // Stats & Modals
  const [stats, setStats] = useState({ totalOrders: 0, totalKm: 0, totalFuel: 0, totalProfit: 0 });
  const [dailyStats, setDailyStats] = useState([]);
  const [showRevenueModal, setShowRevenueModal] = useState(false);
  
  // Fail Modal State
  const [showFailPopup, setShowFailPopup] = useState(false);
  const [failReason, setFailReason] = useState("");
  const [failOrderId, setFailOrderId] = useState(null);

  // Map & Simulation
  const [currentLocation, setCurrentLocation] = useState([21.0285, 105.8542]); 
  const [activeOrder, setActiveOrder] = useState(null);
  const [routeCoords, setRouteCoords] = useState([]); 
  
  const [isSimulating, setIsSimulating] = useState(false);
  const simulationIndexRef = useRef(0); 
  const [profile, setProfile] = useState({});

  useEffect(() => {
    fetchProfile();
    fetchOrders();
    fetchStats();
    fetchDailyStats();
    // Giả lập lấy vị trí GPS hiện tại
    navigator.geolocation?.getCurrentPosition(
        (pos) => setCurrentLocation([pos.coords.latitude, pos.coords.longitude])
    );
  }, []);

  // --- LOGIC MÔ PHỎNG ---
  useEffect(() => {
    let interval;
    if (isSimulating && routeCoords.length > 0 && activeOrder?.status === 'delivering') {
        interval = setInterval(() => {
            let idx = simulationIndexRef.current;
            if (idx >= routeCoords.length - 1) {
                setIsSimulating(false);
                clearInterval(interval);
                return;
            }
            const nextLoc = routeCoords[idx];
            setCurrentLocation(nextLoc);
            socket.emit("driverLocationUpdate", { orderId: activeOrder._id, location: nextLoc });
            simulationIndexRef.current = idx + 1; 
        }, 800); 
    }
    return () => clearInterval(interval);
  }, [isSimulating, routeCoords, activeOrder]);
  // =====================================================================
  // --- LOGIC TRACKING GPS THỰC TẾ (DÙNG CHO PRODUCTION) ---
  // =====================================================================
  /*
  useEffect(() => {
    let watchId;

    // Chỉ bắt đầu theo dõi vị trí liên tục khi tài xế bấm "Bắt đầu giao"
    if (activeOrder?.status === 'delivering') {
        watchId = navigator.geolocation.watchPosition(
            (position) => {
                const realLoc = [position.coords.latitude, position.coords.longitude];
                
                // 1. Cập nhật vị trí xe trên bản đồ của chính tài xế
                setCurrentLocation(realLoc);
                
                // 2. Bắn tọa độ THẬT lên Server để Khách hàng và Điều phối viên cùng thấy
                socket.emit("driverLocationUpdate", { 
                    orderId: activeOrder._id, 
                    location: realLoc 
                });
            },
            (error) => {
                console.error("Lỗi lấy GPS thực tế: ", error);
            },
            { 
                enableHighAccuracy: true, // Bật GPS độ chính xác cao nhất
                maximumAge: 0,            // Không dùng dữ liệu cũ lưu cache
                timeout: 10000            // Cập nhật lại nếu quá 10s
            }
        );
    }

    // Khi hoàn thành đơn hoặc tắt app, tự động hủy theo dõi GPS để đỡ tốn pin
    return () => {
        if (watchId) navigator.geolocation.clearWatch(watchId);
    };
  }, [activeOrder]);
  */
  // --- SOCKET ---
  useEffect(() => {
    socket.on("orderUpdated", (updatedOrder) => {
      setOrders(prev => prev.map(o => (o._id === updatedOrder._id ? updatedOrder : o)));
      if (activeOrder && updatedOrder._id === activeOrder._id) {
          setActiveOrder(updatedOrder);
          if(updatedOrder.status === 'completed' || updatedOrder.status === 'failed') setIsSimulating(false);
      }
      fetchStats();
      fetchDailyStats();
    });
    return () => socket.off("orderUpdated");
  }, [activeOrder]);

  // --- API ---
  const fetchProfile = async () => { try { const res = await api.get("/users/me"); setProfile(res.data); } catch (e) {} };
  const fetchOrders = async () => {
    try {
      const res = await api.get("/orders");
      const myOrders = res.data.filter(o => ["assigned", "delivering", "completed"].includes(o.status));
      setOrders(myOrders);
    } catch (e) {}
  };
  const fetchStats = async () => { try { const res = await api.get("/drivers/stats"); if(res.data) setStats(res.data); } catch(e){} };
  const fetchDailyStats = async () => {
      try {
          const res = await api.get("/orders");
          const completed = res.data.filter(o => o.status === 'completed');
          const dailyMap = {};
          completed.forEach(order => {
              const date = new Date(order.createdAt).toLocaleDateString("vi-VN");
              if (!dailyMap[date]) dailyMap[date] = { date, orders: 0, revenue: 0, fuel: 0 };
              dailyMap[date].orders += 1;
              dailyMap[date].revenue += (order.price || order.cost || 0);
              dailyMap[date].fuel += (order.fuelUsed || 0);
          });
          setDailyStats(Object.values(dailyMap).sort((a,b) => new Date(b.date) - new Date(a.date))); 
      } catch (e) {}
  };

  // --- THUẬT TOÁN SẮP XẾP ĐƠN HÀNG THÔNG MINH ---
  const sortedOrders = useMemo(() => {
      const delivering = orders.filter(o => o.status === 'delivering');
      const completed = orders.filter(o => o.status === 'completed' || o.status === 'failed');
      let assigned = orders.filter(o => o.status === 'assigned');

      const now = new Date().getTime();
      const fiveHoursInMs = 5 * 60 * 60 * 1000;
      let sequenced = [];
      let currLoc = currentLocation;

      while (assigned.length > 0) {
          let nextIdx = -1;
          
          const urgentOrders = assigned.filter(o => o.pickupTime && (new Date(o.pickupTime).getTime() - now) <= fiveHoursInMs);

          if (urgentOrders.length > 0) {
              let earliestTime = Infinity;
              assigned.forEach((o, idx) => {
                  if (o.pickupTime) {
                      const t = new Date(o.pickupTime).getTime();
                      if (t < earliestTime) {
                          earliestTime = t;
                          nextIdx = idx;
                      }
                  }
              });
          } else {
              let minDistance = Infinity;
              assigned.forEach((o, idx) => {
                  const pickup = getPoint(o, 'pickup');
                  if (pickup && typeof pickup.lat === 'number') {
                      const dist = getDistance(currLoc[0], currLoc[1], pickup.lat, pickup.lng);
                      if (dist < minDistance) {
                          minDistance = dist;
                          nextIdx = idx;
                      }
                  }
              });
              if (nextIdx === -1) nextIdx = 0; 
          }

          const chosenOrder = assigned.splice(nextIdx, 1)[0];
          sequenced.push(chosenOrder);

          const dropoff = getPoint(chosenOrder, 'dropoff');
          if (dropoff && typeof dropoff.lat === 'number') {
              currLoc = [dropoff.lat, dropoff.lng];
          }
      }

      return [...delivering, ...sequenced, ...completed];
  }, [orders, currentLocation]);

  const isCurrentlyDelivering = useMemo(() => {
      return orders.some(o => o.status === 'delivering');
  }, [orders]);

  // --- HÀM VẼ ĐƯỜNG 3 ĐIỂM (TÀI XẾ -> LẤY HÀNG -> GIAO HÀNG) ---
  const drawRoute = async (order, currentLoc) => {
      const pickup = getPoint(order, 'pickup');
      const dropoff = getPoint(order, 'dropoff');

      // Nếu đơn bị lỗi dữ liệu, thoát
      if (!pickup || !dropoff || typeof pickup.lat !== 'number' || typeof dropoff.lat !== 'number') {
          setRouteCoords([]); 
          return;
      }

      const p1 = [pickup.lat, pickup.lng]; // Điểm lấy
      const p2 = [dropoff.lat, dropoff.lng]; // Điểm giao
      
      // Fallback: Mặc định vẽ đường thẳng nối 3 điểm (Tài xế -> Lấy -> Giao)
      let finalRouteCoords = [currentLoc, p1, p2].filter(Boolean);
      
      const orsKey = import.meta.env.VITE_ORS_API_KEY;
      if (orsKey) {
          try {
              let driverToPickupCoords = [];
              let pickupToDropoffCoords = [];

              // Chặng 1: Tài xế -> Điểm Lấy Hàng (Chỉ gọi nếu có vị trí hiện tại)
              if (currentLoc && currentLoc[0] && currentLoc[1]) {
                  const url1 = `https://api.openrouteservice.org/v2/directions/driving-car?api_key=${orsKey}&start=${currentLoc[1]},${currentLoc[0]}&end=${p1[1]},${p1[0]}`;
                  const r1 = await axios.get(url1);
                  driverToPickupCoords = r1.data?.features?.[0]?.geometry?.coordinates?.map(c => [c[1], c[0]]) || [];
              }

              // Chặng 2: Điểm Lấy Hàng -> Điểm Giao Hàng
              const url2 = `https://api.openrouteservice.org/v2/directions/driving-car?api_key=${orsKey}&start=${p1[1]},${p1[0]}&end=${p2[1]},${p2[0]}`;
              const r2 = await axios.get(url2);
              pickupToDropoffCoords = r2.data?.features?.[0]?.geometry?.coordinates?.map(c => [c[1], c[0]]) || [];

              // Gộp 2 chặng lại thành 1 lộ trình duy nhất
              if (driverToPickupCoords.length > 0 || pickupToDropoffCoords.length > 0) {
                  finalRouteCoords = [...driverToPickupCoords, ...pickupToDropoffCoords];
              }
          } catch (e) {
              console.warn("Không thể tải API vẽ đường, sử dụng đường thẳng.");
          }
      }
      
      setRouteCoords(finalRouteCoords);
  };

  const selectOrder = (order) => {
      setActiveOrder(order);
      // Khi chọn đơn, vẽ lộ trình từ vị trí hiện tại của tài xế
      drawRoute(order, currentLocation);
  };

  // --- CÁC HÀNH ĐỘNG NÚT BẤM ---
  const handleStartDelivery = async (order) => {
      try {
          await api.put(`/orders/${order._id}/status`, { status: "delivering" });
          
          const updatedOrder = { ...order, status: "delivering" };
          setActiveOrder(updatedOrder);
          setOrders(prev => prev.map(o => o._id === order._id ? updatedOrder : o));

          alert("Bắt đầu giao hàng! 🚚");
          
          // Vẽ lại đường đi cập nhật nhất khi bấm bắt đầu giao
          drawRoute(order, currentLocation);
          setIsSimulating(true);
          simulationIndexRef.current = 0;
      } catch (e) { alert("Lỗi bắt đầu"); }
  };

  const handleCompleteDelivery = async (orderId) => {
      try {
          await api.put(`/orders/${orderId}/status`, { status: "completed", distance: 5, fuelUsed: 0.5, revenue: activeOrder.price || 0 });
          
          setOrders(prev => prev.map(o => o._id === orderId ? { ...o, status: "completed" } : o));
          setActiveOrder(null); 
          setIsSimulating(false);
          
          alert("Hoàn thành! 💰");
          fetchStats(); 
          fetchDailyStats();
      } catch (e) { alert("Lỗi hoàn thành"); }
  };

  const handleFailDelivery = async () => {
      if(!failReason.trim()) return alert("Vui lòng nhập lý do thất bại!");
      try {
          await api.put(`/orders/${failOrderId}/status`, { 
              status: "failed", 
              failedReason: failReason 
          });
          
          setOrders(prev => prev.map(o => o._id === failOrderId ? { ...o, status: "failed" } : o));
          setActiveOrder(null);
          
          setShowFailPopup(false);
          setFailReason("");
          setIsSimulating(false);
          alert("Đã báo cáo đơn hàng thất bại.");
      } catch (e) { alert("Lỗi gửi báo cáo"); }
  };

  // Các biến an toàn để render Map Marker
  const activePickup = getPoint(activeOrder, 'pickup');
  const activeDropoff = getPoint(activeOrder, 'dropoff');

  return (
    <div className="min-h-screen bg-gray-50 pb-20 font-sans">
      <style>{`.svg-driver-icon { background: none !important; border: none !important; }`}</style>

      {/* Header */}
      <div className="bg-gradient-to-r from-green-600 to-teal-700 text-white p-6 pb-24 rounded-b-[2.5rem] shadow-xl">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-bold flex items-center gap-2"><LocalShippingIcon fontSize="large"/> Driver</h1>
          <div className="flex items-center gap-4"><span className="font-bold">{profile.name}</span><LogoutButton className="bg-white/20 hover:bg-white/30 px-3 py-1 rounded-full text-sm transition"/></div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 -mt-16 space-y-6">
        
        {/* STATS */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-fade-in">
            <StatCard icon={<LocalShippingIcon/>} title="Tổng đơn" value={stats.totalOrders || 0} color="bg-blue-500" />
            
            <StatCard icon={<SpeedIcon/>} title="Tổng Km" value={`${(stats.totalKm || 0).toFixed(1)} km`} color="bg-indigo-500" />
            
            <div onClick={() => setShowRevenueModal(true)} className="cursor-pointer transform transition hover:scale-105">
                <StatCard icon={<LocalGasStationIcon/>} title="Nhiên liệu (L)" value={`${(stats.fuelUsed || 0).toFixed(1)} L`} color="bg-orange-500" />
            </div>
            
            <div onClick={() => setShowRevenueModal(true)} className="cursor-pointer transform transition hover:scale-105">
                <StatCard icon={<AttachMoneyIcon/>} title="Doanh thu" value={`${(stats.revenue || 0).toLocaleString()} đ`} color="bg-green-600" />
            </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* List Orders */}
            <div className="lg:col-span-1 bg-white rounded-2xl shadow-sm border border-gray-100 p-4 h-[650px] overflow-hidden flex flex-col">
                <h2 className="font-bold text-lg mb-1 text-gray-800 flex items-center gap-2"><PersonIcon className="text-green-600"/> Lịch trình đề xuất</h2>
                <p className="text-xs text-gray-500 mb-4 italic">Đã sắp xếp tối ưu theo Hạn giao & Quãng đường</p>
                <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-3">
                    {sortedOrders.length === 0 && <p className="text-center text-gray-400 py-10">Chưa có đơn hàng.</p>}
                    {sortedOrders.map((order, idx) => {
                        const now = new Date().getTime();
                        let isOverdue = false;
                        let isUrgent = false;

                        if (order.pickupTime && order.status === 'assigned') {
                            const deadline = new Date(order.pickupTime).getTime();
                            isOverdue = deadline < now;
                            isUrgent = !isOverdue && (deadline - now) <= 5 * 60 * 60 * 1000;
                        }

                        return (
                        <div key={order._id} onClick={() => selectOrder(order)} className={`p-4 rounded-xl border cursor-pointer transition relative ${activeOrder?._id === order._id ? "bg-green-50 border-green-500 shadow-md" : "bg-white border-gray-200 hover:shadow-sm"}`}>
                            
                            <div className="flex justify-between items-start mb-2">
                                <div className="flex flex-col gap-1 items-start">
                                    {idx === 0 && order.status === 'assigned' && (
                                        <span className="bg-blue-600 text-white text-[10px] font-bold px-2 py-1 rounded-full shadow-sm animate-bounce w-max">
                                            📍 ĐIỂM TIẾP THEO
                                        </span>
                                    )}
                                    <span className="bg-gray-100 text-gray-700 text-xs px-2 py-1 rounded-md font-bold w-max">
                                        #{order._id.slice(-6).toUpperCase()}
                                    </span>
                                </div>
                                <StatusBadge status={order.status} />
                            </div>
                            
                            {order.pickupTime && order.status !== 'completed' && order.status !== 'failed' && (
                                <div className={`mb-3 flex items-center gap-1 text-xs font-bold px-2 py-1.5 rounded-lg border w-fit ${isOverdue ? 'bg-red-50 text-red-600 border-red-200' : isUrgent ? 'bg-orange-50 text-orange-600 border-orange-200' : 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                                    <AccessAlarmIcon fontSize="inherit"/>
                                    {isOverdue ? '🔴 QUÁ HẠN:' : isUrgent ? '⚠️ GẤP:' : 'Hạn giao:'} {new Date(order.pickupTime).toLocaleString("vi-VN", { hour: '2-digit', minute:'2-digit', day: '2-digit', month: '2-digit'})}
                                </div>
                            )}

                            <div className="text-sm space-y-1 text-gray-600">
                                <p className="line-clamp-1"><strong className="text-blue-600">Lấy:</strong> {order.pickupAddress}</p>
                                <p className="line-clamp-1"><strong className="text-red-600">Giao:</strong> {order.deliveryAddress}</p>
                                <p className="pt-2 border-t border-dashed mt-2 font-bold text-gray-800 text-right">{(order.price || order.cost || 0).toLocaleString()} đ</p>
                            </div>
                            
                            <div className="mt-4 flex gap-2">
                                {order.status === "assigned" && (
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); handleStartDelivery(order); }} 
                                        disabled={isCurrentlyDelivering}
                                        className={`w-full py-2 rounded-lg font-bold shadow flex items-center justify-center gap-1 transition ${isCurrentlyDelivering ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}
                                        title={isCurrentlyDelivering ? "Bạn phải hoàn thành đơn đang giao trước!" : ""}
                                    >
                                        <PlayCircleFilledWhiteIcon fontSize="small"/> {isCurrentlyDelivering ? 'Đang bận giao đơn khác' : 'Bắt đầu'}
                                    </button>
                                )}
                                {order.status === "delivering" && (
                                    <>
                                        <button onClick={(e) => { e.stopPropagation(); handleCompleteDelivery(order._id); }} className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg font-bold shadow flex items-center justify-center gap-1 transition"><CheckCircleIcon fontSize="small"/> Hoàn thành</button>
                                        <button onClick={(e) => { e.stopPropagation(); setFailOrderId(order._id); setShowFailPopup(true); }} className="flex-1 bg-red-500 hover:bg-red-600 text-white py-2 rounded-lg font-bold shadow flex items-center justify-center gap-1 transition"><CancelIcon fontSize="small"/> Thất bại</button>
                                    </>
                                )}
                            </div>
                        </div>
                    )})}
                </div>
            </div>

            {/* Map */}
            <div className="lg:col-span-2 bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden h-[650px] relative z-0">
                {activeOrder ? (
                    <MapContainer center={currentLocation} zoom={14} style={{ height: "100%", width: "100%" }}>
                        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                        <MapUpdater center={currentLocation} route={routeCoords} />
                        {routeCoords.length > 0 && <Polyline positions={routeCoords} color="#2563eb" weight={6} opacity={0.8} />}
                        <Marker position={currentLocation} icon={driverIcon} zIndexOffset={1000}><Popup>Xe của bạn</Popup></Marker>
                        
                        {activePickup?.lat && <Marker position={[activePickup.lat, activePickup.lng]} icon={pickupIcon}><Popup>Lấy hàng</Popup></Marker>}
                        {activeDropoff?.lat && <Marker position={[activeDropoff.lat, activeDropoff.lng]} icon={deliveryIcon}><Popup>Giao hàng</Popup></Marker>}
                    </MapContainer>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-gray-400 bg-gray-50"><NavigationIcon style={{ fontSize: 80 }} className="mb-4 opacity-20 text-green-500"/><p className="text-lg font-medium">Chọn đơn hàng để xem chi tiết</p></div>
                )}
                {isSimulating && <div className="absolute top-4 left-4 z-[999] bg-white/90 px-4 py-2 rounded-lg shadow border-l-4 border-green-500 font-bold text-green-700 animate-pulse">🚚 Đang chia sẻ vị trí...</div>}
            </div>
        </div>
      </div>

      {/* --- MODAL DOANH THU --- */}
      {showRevenueModal && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden relative">
                  <div className="bg-green-600 p-4 text-white flex justify-between items-center"><h2 className="text-xl font-bold flex items-center gap-2"><CalendarTodayIcon/> Chi tiết theo ngày</h2><button onClick={() => setShowRevenueModal(false)} className="hover:bg-white/20 p-1 rounded-full transition"><CloseIcon/></button></div>
                  <div className="p-4 max-h-[400px] overflow-y-auto custom-scrollbar">
                      {dailyStats.length === 0 ? <p className="text-center text-gray-500 py-6">Chưa có dữ liệu.</p> : (
                          <table className="w-full text-sm text-left border-collapse">
                              <thead className="text-xs text-gray-500 uppercase bg-gray-50 sticky top-0"><tr><th className="px-3 py-3 border-b">Ngày</th><th className="px-3 py-3 border-b text-center">Đơn</th><th className="px-3 py-3 border-b text-right">Nhiên liệu</th><th className="px-3 py-3 border-b text-right">Doanh thu</th></tr></thead>
                              <tbody className="divide-y divide-gray-100">{dailyStats.map((stat, idx) => (<tr key={idx} className="hover:bg-gray-50 transition"><td className="px-3 py-3 font-medium text-gray-800">{stat.date}</td><td className="px-3 py-3 text-center font-bold text-blue-600">{stat.orders}</td><td className="px-3 py-3 text-right text-orange-600 font-medium">{stat.fuel.toFixed(1)} L</td><td className="px-3 py-3 text-right font-bold text-green-600">{stat.revenue.toLocaleString()} ₫</td></tr>))}</tbody>
                          </table>
                      )}
                  </div>
              </div>
          </div>
      )}

      {/* --- MODAL BÁO CÁO THẤT BẠI --- */}
      {showFailPopup && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden p-6">
                  <h2 className="text-xl font-bold text-red-600 mb-4 flex items-center gap-2"><CancelIcon/> Báo cáo thất bại</h2>
                  <textarea className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-red-500 outline-none mb-4 h-32" placeholder="Nhập lý do (VD: Khách không nghe máy, Sai địa chỉ...)" value={failReason} onChange={(e) => setFailReason(e.target.value)}></textarea>
                  <div className="flex justify-end gap-3">
                      <button onClick={() => setShowFailPopup(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">Hủy</button>
                      <button onClick={handleFailDelivery} className="px-4 py-2 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700">Gửi báo cáo</button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
}

const StatCard = ({ icon, title, value, color }) => (<div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4 hover:shadow-md transition"><div className={`p-3 rounded-xl text-white shadow-lg ${color}`}>{icon}</div><div><p className="text-gray-400 text-xs uppercase font-bold tracking-wide">{title}</p><p className="text-xl font-extrabold text-gray-800">{value}</p></div></div>);
const StatusBadge = ({ status }) => { const color = { assigned: "bg-blue-100 text-blue-700", delivering: "bg-yellow-100 text-yellow-800 animate-pulse border border-yellow-300", completed: "bg-green-100 text-green-700", failed: "bg-red-100 text-red-700" }; return <span className={`text-xs px-2 py-1 rounded-full font-bold uppercase ${color[status] || "bg-gray-100"}`}>{status}</span> };

export default DashboardDriver;