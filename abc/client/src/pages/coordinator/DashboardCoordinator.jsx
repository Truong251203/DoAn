import React, { useEffect, useState, useMemo } from "react";
import api from "../../services/api";
import socket from "../../services/socket";
import axios from "axios";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap, Circle, CircleMarker } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Components
import LogoutButton from "../../components/LogoutButton";

// Icons & UI
import DashboardIcon from '@mui/icons-material/Dashboard';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import InventoryIcon from '@mui/icons-material/Inventory';
import MapIcon from '@mui/icons-material/Map';
import CloseIcon from '@mui/icons-material/Close';
import AssignmentIndIcon from '@mui/icons-material/AssignmentInd';
import BarChartIcon from '@mui/icons-material/BarChart';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import NearMeIcon from '@mui/icons-material/NearMe';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import HighlightOffIcon from '@mui/icons-material/HighlightOff';
import PersonRemoveIcon from '@mui/icons-material/PersonRemove';
import PlaylistAddCheckIcon from '@mui/icons-material/PlaylistAddCheck';
import FilterAltIcon from '@mui/icons-material/FilterAlt';

// Charts
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';

// ==========================================
// 1. CẤU HÌNH ICON BẢN ĐỒ
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

const driverIcon = new L.DivIcon({ html: driverSvgXml, className: 'coordinator-driver-icon', iconSize: [55, 55], iconAnchor: [27, 55], popupAnchor: [0, -50] });
const pickupIcon = new L.Icon({ iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png", shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png", iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41] });
const deliveryIcon = new L.Icon({ iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png", shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png", iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41] });

// ==========================================
// 2. HELPER FUNCTIONS
// ==========================================
const normalizePoint = (point) => { if (!point) return null; let lat = Array.isArray(point) ? point[0] : point.lat; let lng = Array.isArray(point) ? point[1] : point.lng; if (!lat || !lng) return null; if (lat > 80) return [lng, lat]; return [lat, lng]; };
const normalizeRoute = (route) => { if (!Array.isArray(route)) return []; return route.map(p => normalizePoint(p)).filter(p => p !== null); };
const getPoint = (obj, type) => { if (!obj) return null; if (type === 'pickup') return normalizePoint(obj.pickup || obj.pickupCoords); if (type === 'dropoff') return normalizePoint(obj.dropoff || obj.deliveryCoords || obj.dropoffCoords); return null; };
const getDistance = (lat1, lon1, lat2, lon2) => { if (!lat1 || !lon1 || !lat2 || !lon2) return Infinity; const R = 6371; const dLat = (lat2 - lat1) * (Math.PI / 180); const dLon = (lon2 - lon1) * (Math.PI / 180); const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2); return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)); };
const getSafeCoords = (driver) => { let lat = driver.pickupCoords?.lat || driver.warehouse?.lat; let lng = driver.pickupCoords?.lng || driver.warehouse?.lng; if (!lat || !lng) { lat = 21.0285 + (Math.random() * 0.02 - 0.01); lng = 105.8542 + (Math.random() * 0.02 - 0.01); } return { lat, lng }; };

// ==========================================
// 3. MAP UPDATER
// ==========================================
function MapUpdater({ bounds, driverLocation }) {
    const map = useMap();
    useEffect(() => { if (bounds && bounds.length > 0) { try { map.fitBounds(bounds, { padding: [80, 80] }); } catch (e) {} } }, [bounds, map]);
    useEffect(() => { if (driverLocation && driverLocation[0] !== 0) { map.panTo(driverLocation, { animate: true, duration: 0.5 }); } }, [driverLocation, map]);
    return null;
}

// ==========================================
// 4. MAIN COMPONENT
// ==========================================
function DashboardCoordinator() {
    const [orders, setOrders] = useState([]);
    const [drivers, setDrivers] = useState([]);
    const [activeTab, setActiveTab] = useState("orders");
    
    const [selectedOrder, setSelectedOrder] = useState(null); 
    const [routeCoords, setRouteCoords] = useState([]);
    const [driverLocation, setDriverLocation] = useState(null); 
    const [selectedDriverId, setSelectedDriverId] = useState("");
    const [signalStatus, setSignalStatus] = useState("Đang chờ tín hiệu...");
    
    const [filterStatus, setFilterStatus] = useState('all');
    const [filterDate, setFilterDate] = useState(''); 
    const [filterCustomer, setFilterCustomer] = useState(''); 
    const [filterDriver, setFilterDriver] = useState(''); 
    const [isAutoAssigning, setIsAutoAssigning] = useState(false);
    const [selectedOrderIds, setSelectedOrderIds] = useState([]); 
    const [batchAssignDriverId, setBatchAssignDriverId] = useState(""); 
    const [cancelModal, setCancelModal] = useState({ isOpen: false, orderId: null, reason: "" });
    
    // 🔥 MỚI: State cho bộ lọc Thống kê Tài xế nâng cao
    const [statFilterType, setStatFilterType] = useState('month'); // 'all', 'year', 'month', 'day'
    const [statFilterValue, setStatFilterValue] = useState(() => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    });

    const [assignModalData, setAssignModalData] = useState(null); 
    const [driverSearch, setDriverSearch] = useState("");

    const [algoParams, setAlgoParams] = useState({ numDrivers: 30, numOrders: 200 });
    const [algoResults, setAlgoResults] = useState(null);
    const [algoSample, setAlgoSample] = useState(null); 
    const [isSimulating, setIsSimulating] = useState(false);

    useEffect(() => {
        fetchOrders();
        fetchDrivers();

        const savedResults = localStorage.getItem("algoResults");
        const savedSample = localStorage.getItem("algoSample");
        const savedParams = localStorage.getItem("algoParams");
        
        if (savedResults) setAlgoResults(JSON.parse(savedResults));
        if (savedSample) setAlgoSample(JSON.parse(savedSample));
        if (savedParams) setAlgoParams(JSON.parse(savedParams));
    }, []);

    useEffect(() => {
        const handleDriverLocation = (data) => {
            if (selectedOrder && data.orderId === selectedOrder._id) {
                const validLoc = normalizePoint(data.location);
                if (validLoc) { setDriverLocation(validLoc); setSignalStatus(`📍 Xe tại: ${validLoc[0].toFixed(4)}, ${validLoc[1].toFixed(4)}`); }
            }
        };
        const handleOrderUpdated = (updatedOrder) => {
            setOrders(prev => prev.map(o => o._id === updatedOrder._id ? updatedOrder : o));
            if (selectedOrder && selectedOrder._id === updatedOrder._id) {
                setSelectedOrder(updatedOrder);
                if(updatedOrder.status === 'completed') setDriverLocation(null);
            }
        }
        const handleNewOrder = (newOrder) => { setOrders(prev => [newOrder, ...prev]); }

        socket.on("driverLocationUpdate", handleDriverLocation);
        socket.on("orderUpdated", handleOrderUpdated);
        socket.on("orderCreated", handleNewOrder);
        return () => { socket.off("driverLocationUpdate"); socket.off("orderUpdated"); socket.off("orderCreated"); };
    }, [selectedOrder]); 

    const fetchOrders = async () => { try { const res = await api.get("/orders"); setOrders(res.data); } catch (e) { console.error(e); } };
    const fetchDrivers = async () => { try { const res = await api.get("/users?role=driver"); setDrivers(res.data); } catch (e) { try { const r2 = await api.get("/users"); setDrivers(r2.data.filter(u=>u.role==='driver')); } catch(err){} } };

    const handleAssignDriver = async (orderId, driverId) => {
        try {
            await api.put(`/orders/assign/${orderId}`, { driverId: driverId || null });
            alert(driverId ? "Đã gán tài xế thành công!" : "Đã hủy gán thành công!");
            fetchOrders();
        } catch (e) { alert("Lỗi khi cập nhật tài xế"); }
    };

    const handleUpdateStatus = async (orderId, newStatus, reason = "") => {
        try {
            const payload = { status: newStatus }; if (reason) payload.cancelReason = reason;
            await api.put(`/orders/${orderId}/coordinator-status`, payload);
            alert(`Đã cập nhật trạng thái thành công!`);
            if (cancelModal.isOpen) setCancelModal({ isOpen: false, orderId: null, reason: "" }); 
            fetchOrders();
        } catch (e) { alert("Lỗi cập nhật trạng thái"); }
    }

    const openCancelModal = (orderId) => { setCancelModal({ isOpen: true, orderId, reason: "" }); }

    const handleApproveCancel = async (orderId) => {
        if(!window.confirm("Khách hàng đang yêu cầu HỦY đơn này. Bạn có chắc chắn muốn DUYỆT HỦY không?")) return;
        try { await api.put(`/orders/${orderId}/cancel/approve`); alert("Đã duyệt hủy đơn thành công!"); fetchOrders(); } catch (e) { alert("Lỗi khi duyệt hủy đơn"); }
    }

    const handleSelectOrder = (id) => { setSelectedOrderIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]); }

    const handleBatchManualAssign = async () => {
        if (selectedOrderIds.length === 0) return alert("Vui lòng chọn ít nhất 1 đơn hàng!");
        if (!batchAssignDriverId) return alert("Vui lòng chọn tài xế để gán hàng loạt!");
        const validOrdersToAssign = selectedOrderIds.filter(id => { const order = orders.find(o => o._id === id); return order && !["delivering", "completed", "cancelled"].includes(order.status); });
        if (validOrdersToAssign.length === 0) return alert("⚠️ Các đơn hàng bạn chọn không hợp lệ để gán tài xế!");
        if (validOrdersToAssign.length < selectedOrderIds.length) {
            const confirmPartial = window.confirm(`⚠️ Trong số các đơn đã chọn, chỉ có ${validOrdersToAssign.length} đơn hợp lệ để gán.\nTiếp tục gán?`);
            if (!confirmPartial) return;
        }
        try {
            await Promise.all(validOrdersToAssign.map(id => api.put(`/orders/assign/${id}`, { driverId: batchAssignDriverId })));
            alert(`✅ Đã gán thành công ${validOrdersToAssign.length} đơn hàng!`);
            setSelectedOrderIds([]); setBatchAssignDriverId(""); fetchOrders();
        } catch (e) { alert("Có lỗi xảy ra khi gán hàng loạt!"); }
    }

    const handleBatchDelete = async () => {
        if (selectedOrderIds.length === 0) return alert("Vui lòng tick chọn ít nhất 1 đơn hàng!");
        const confirmDelete = window.confirm(`⚠️ CẢNH BÁO: Bạn có chắc chắn muốn XÓA VĨNH VIỄN ${selectedOrderIds.length} đơn hàng đã chọn không?`);
        if (!confirmDelete) return;
        try {
            const res = await api.post("/orders/batch-delete", { orderIds: selectedOrderIds });
            alert(`✅ ${res.data.message}`); setSelectedOrderIds([]); fetchOrders(); 
        } catch (e) { alert("❌ Có lỗi xảy ra khi xóa đơn hàng!"); }
    }

    const handleBatchAutoAssign = async (strategy) => {
        const validOrdersCount = orders.filter(o => ['pending', 'unconfirmed', 'confirmed'].includes(o.status)).length;
        if (validOrdersCount === 0) return alert("Không có đơn hàng nào đang chờ phân công!");
        const strategyName = strategy === 'proximity' ? 'Ưu tiên vị trí gần' : 'Cân bằng doanh thu';
        if (!window.confirm(`Gán tự động ${validOrdersCount} đơn hàng theo chiến thuật: ${strategyName}?`)) return;
        setIsAutoAssigning(true);
        try {
            const res = await api.post("/orders/auto-assign-batch", { strategy });
            alert(`✅ ${res.data.message}`); fetchOrders();
        } catch (error) { alert("⚠️ Lỗi gán tự động"); } 
        finally { setIsAutoAssigning(false); }
    };

    const openAssignPreview = (order) => {
        if (!order.pickupCoords || !order.pickupCoords.lat) return alert("Đơn hàng này chưa có tọa độ lấy hàng chuẩn. Không thể phân tích!");
        let availableDrivers = drivers.filter(d => d.status !== 'locked').map(d => {
            const safeLoc = getSafeCoords(d);
            const distance = getDistance(order.pickupCoords.lat, order.pickupCoords.lng, safeLoc.lat, safeLoc.lng);
            const activeOrders = orders.filter(o => (o.driverId?._id === d._id || o.driverId === d._id) && ['assigned', 'delivering'].includes(o.status)).length;
            const currentRevenue = d.totalProfit || 0;
            const fitnessScore = distance + (activeOrders * 3) + (currentRevenue / 50000);
            return { ...d, calculatedDistance: distance, activeOrders, currentRevenue, fitnessScore, dLat: safeLoc.lat, dLng: safeLoc.lng };
        });
        if (availableDrivers.length === 0) return alert("Không có tài xế nào đang online!");

        const bestDistance = [...availableDrivers].sort((a, b) => a.calculatedDistance - b.calculatedDistance)[0];
        const bestRevenue = [...availableDrivers].sort((a, b) => { if (a.activeOrders !== b.activeOrders) return a.activeOrders - b.activeOrders; return a.currentRevenue - b.currentRevenue; })[0];
        const bestBalanced = [...availableDrivers].sort((a, b) => a.fitnessScore - b.fitnessScore)[0];

        setAssignModalData({ 
            order, allDrivers: availableDrivers.sort((a, b) => a.calculatedDistance - b.calculatedDistance),
            suggestions: { distance: bestDistance, revenue: bestRevenue, balanced: bestBalanced }
        });
    };

    const confirmManualAssign = async (driverId) => {
        if(!window.confirm("Chốt gán đơn này cho tài xế đã chọn?")) return;
        try { await api.put(`/orders/${assignModalData.order._id}/assign`, { driverId }); alert("✅ Đã gán thành công!"); setAssignModalData(null); fetchOrders(); } catch (e) { alert("❌ Lỗi khi gán"); }
    };

    const runSimulation = async () => {
        setIsSimulating(true);
        try {
            const res = await api.post("/algo/simulate", algoParams);
            setAlgoResults(res.data.metrics); setAlgoSample(res.data.sampleData); 
            localStorage.setItem("algoResults", JSON.stringify(res.data.metrics)); localStorage.setItem("algoSample", JSON.stringify(res.data.sampleData)); localStorage.setItem("algoParams", JSON.stringify(algoParams));
        } catch (e) { alert("Lỗi khi chạy thuật toán!"); } finally { setIsSimulating(false); }
    };

    const statsHeader = useMemo(() => {
        return {
          total: orders.length,
          pending: orders.filter(o => o.status === 'pending' || o.status === 'unconfirmed').length,
          delivering: orders.filter(o => o.status === 'delivering').length,
          completed: orders.filter(o => o.status === 'completed').length,
        };
    }, [orders]);

    const filteredOrders = useMemo(() => {
        let result = orders;
        if (filterStatus === 'pending') result = result.filter(o => o.status === 'pending' || o.status === 'unconfirmed');
        else if (filterStatus !== 'all') result = result.filter(o => o.status === filterStatus);
        if (filterDate) result = result.filter(o => {
                if (!o.pickupTime) return false;
                const d = new Date(o.pickupTime);
                const orderDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                return orderDate === filterDate;
            });
        if (filterCustomer) {
            const kwd = filterCustomer.toLowerCase();
            result = result.filter(o => {
                const name = (o.customerId?.name || o.customerName || "Khách lẻ").toLowerCase();
                const phone = (o.customerId?.phone || o.recipientPhone || "").toLowerCase();
                return name.includes(kwd) || phone.includes(kwd);
            });
        }
        if (filterDriver) result = result.filter(o => { const dId = o.driverId?._id || o.driverId; return dId === filterDriver; });
        result.sort((a, b) => {
            if (a.pickupTime && b.pickupTime) return new Date(a.pickupTime) - new Date(b.pickupTime);
            if (a.pickupTime) return -1;
            if (b.pickupTime) return 1;
            return new Date(b.createdAt) - new Date(a.createdAt);
        });
        return result;
    }, [orders, filterStatus, filterDate, filterCustomer, filterDriver]);

    const assignableOrders = useMemo(() => { return filteredOrders.filter(o => !["delivering", "completed", "cancelled"].includes(o.status)); }, [filteredOrders]);

    const handleSelectAll = (e) => { if (e.target.checked) setSelectedOrderIds(filteredOrders.map(o => o._id)); else setSelectedOrderIds([]); }

    // 🔥 MỚI: Lọc Thống Kê Tài Xế Dựa Theo Loại Filter (Ngày/Tháng/Năm/Tất cả)
    const driverStats = useMemo(() => {
        if (drivers.length === 0 || orders.length === 0) return [];
        return drivers.map(driver => {
            let completedOrders = orders.filter(o => o.status === 'completed' && (o.driverId === driver._id || o.driverId?._id === driver._id));
            
            if (statFilterType !== 'all' && statFilterValue) {
                completedOrders = completedOrders.filter(o => {
                    const dateStr = o.completedAt || o.updatedAt || o.createdAt;
                    if (!dateStr) return false;
                    const d = new Date(dateStr);
                    
                    if (statFilterType === 'day') {
                        const orderDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                        return orderDate === statFilterValue;
                    } else if (statFilterType === 'month') {
                        const orderMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                        return orderMonth === statFilterValue;
                    } else if (statFilterType === 'year') {
                        return String(d.getFullYear()) === String(statFilterValue);
                    }
                    return true;
                });
            }
            return { name: driver.name, orders: completedOrders.length, revenue: completedOrders.reduce((acc, o) => acc + (o.price || o.cost || 0), 0) };
        }).sort((a, b) => b.revenue - a.revenue);
    }, [drivers, orders, statFilterType, statFilterValue]);

    // Xử lý khi đổi loại lọc (Tự sinh giá trị mặc định)
    const handleStatFilterChange = (e) => {
        const type = e.target.value;
        setStatFilterType(type);
        const d = new Date();
        if (type === 'day') setStatFilterValue(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
        if (type === 'month') setStatFilterValue(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
        if (type === 'year') setStatFilterValue(d.getFullYear().toString());
    };

    const filteredDrivers = useMemo(() => { return drivers.filter(d => (d.name || "").toLowerCase().includes(driverSearch.toLowerCase()) || (d.phone && d.phone.includes(driverSearch))); }, [drivers, driverSearch]);

    const computeRoute = async (pickup, dropoff) => {
        if (!pickup || !dropoff) { setRouteCoords([]); return; }
        setRouteCoords([pickup, dropoff]); 
        const orsKey = import.meta.env.VITE_ORS_API_KEY;
        if (orsKey) { try { const url = `https://api.openrouteservice.org/v2/directions/driving-car?api_key=${orsKey}&start=${pickup[1]},${pickup[0]}&end=${dropoff[1]},${dropoff[0]}`; const r = await axios.get(url); const raw = r.data?.features?.[0]?.geometry?.coordinates || []; if (raw.length > 0) setRouteCoords(raw.map(c => [c[1], c[0]])); } catch (e) {} }
    };

    const openOrderModal = (order) => { setSelectedOrder(order); setDriverLocation(null); setSignalStatus("Đang chờ kết nối..."); setSelectedDriverId(order.driverId ? (order.driverId._id || order.driverId) : ""); const p1 = getPoint(order, 'pickup'); const p2 = getPoint(order, 'dropoff'); if (p1 && p2) computeRoute(p1, p2); else setRouteCoords([]); };
    const resetFilters = () => { setFilterDate(''); setFilterCustomer(''); setFilterDriver(''); setFilterStatus('all'); }

    const ClickableStatBox = ({ label, value, color, icon, isActive, onClick }) => (
        <div onClick={onClick} className={`p-4 rounded-xl shadow-sm border cursor-pointer transition-all transform hover:scale-105 select-none ${isActive ? 'bg-indigo-50 border-indigo-500 ring-2 ring-indigo-200' : 'bg-white border-gray-100'}`}>
            <div className="flex items-center justify-between">
                <div><p className={`text-xs uppercase font-bold ${isActive ? 'text-indigo-600' : 'text-gray-500'}`}>{label}</p><p className={`text-2xl font-bold ${isActive ? 'text-indigo-800' : 'text-gray-800'}`}>{value}</p></div>
                <div className={`p-3 rounded-full text-white shadow-lg ${color} ${isActive ? 'scale-110' : ''}`}>{icon}</div>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-gray-50 font-sans pb-20">
            <style>{`
                .coordinator-driver-icon { background: transparent !important; border: none !important; }
                .coordinator-driver-icon svg { width: 100% !important; height: 100% !important; filter: drop-shadow(3px 3px 2px rgba(0,0,0,0.4)); overflow: visible !important; }
                .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
            `}</style>

            {/* HEADER & TABS */}
            <div className="bg-white shadow-sm sticky top-0 z-40 border-b border-gray-200">
                <div className="max-w-7xl mx-auto px-6 py-4 flex flex-col gap-4">
                    <div className="flex justify-between items-center">
                        <h1 className="text-2xl font-black text-indigo-800 flex items-center gap-2"><DashboardIcon /> Điều Phối Trung Tâm</h1>
                        <LogoutButton />
                    </div>
                    <div className="flex gap-6">
                        <button onClick={() => setActiveTab('orders')} className={`pb-3 px-2 font-bold uppercase text-sm tracking-wider transition ${activeTab === 'orders' ? 'border-b-4 border-indigo-600 text-indigo-700' : 'text-gray-400 hover:text-gray-600'}`}>📦 Quản lý Đơn hàng</button>
                        <button onClick={() => setActiveTab('drivers')} className={`pb-3 px-2 font-bold uppercase text-sm tracking-wider transition ${activeTab === 'drivers' ? 'border-b-4 border-green-600 text-green-700' : 'text-gray-400 hover:text-gray-600'}`}>🛵 Quản lý Tài xế</button>
                        <button onClick={() => setActiveTab('algo-lab')} className={`pb-3 px-2 font-bold uppercase text-sm tracking-wider transition ${activeTab === 'algo-lab' ? 'border-b-4 border-purple-600 text-purple-700' : 'text-gray-400 hover:text-gray-600'}`}>🧪 Phòng Thí Nghiệm Algo</button>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-6 mt-6 space-y-6">
                
                {/* =======================================================
                    TAB 1: QUẢN LÝ ĐƠN HÀNG
                ======================================================= */}
                {activeTab === 'orders' && (
                    <div className="animate-fadeIn space-y-6">
                        <div className="grid grid-cols-4 gap-4">
                            <ClickableStatBox label="Tổng đơn" value={statsHeader.total} color="bg-blue-500" icon={<InventoryIcon/>} isActive={filterStatus === 'all'} onClick={() => setFilterStatus('all')} />
                            <ClickableStatBox label="Chờ xử lý / Chưa duyệt" value={statsHeader.pending} color="bg-orange-500" icon={<AssignmentIndIcon/>} isActive={filterStatus === 'pending'} onClick={() => setFilterStatus('pending')} />
                            <ClickableStatBox label="Đang giao" value={statsHeader.delivering} color="bg-yellow-500" icon={<LocalShippingIcon/>} isActive={filterStatus === 'delivering'} onClick={() => setFilterStatus('delivering')} />
                            <ClickableStatBox label="Hoàn thành" value={statsHeader.completed} color="bg-green-600" icon={<MapIcon/>} isActive={filterStatus === 'completed'} onClick={() => setFilterStatus('completed')} />
                        </div>

                        {/* 🔥 NÂNG CẤP: THANH BỘ LỌC ĐẸP MẮT */}
                        <div className="bg-white/80 backdrop-blur-md rounded-2xl shadow-sm border border-indigo-100 p-5 flex flex-wrap gap-5 items-end">
                            <div className="flex items-center gap-2 mb-1 w-full text-indigo-800 font-bold"><FilterAltIcon fontSize="small"/> <span>Bộ lọc Nâng cao</span></div>
                            <div className="flex flex-col"><label className="text-[10px] font-black text-gray-400 uppercase mb-1 tracking-wider">Ngày cần giao</label><input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} className="bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-indigo-400 outline-none w-40 font-medium" /></div>
                            <div className="flex flex-col"><label className="text-[10px] font-black text-gray-400 uppercase mb-1 tracking-wider">Khách hàng</label><input type="text" placeholder="Tên hoặc SĐT..." value={filterCustomer} onChange={(e) => setFilterCustomer(e.target.value)} className="bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-indigo-400 outline-none w-48 font-medium" /></div>
                            <div className="flex flex-col"><label className="text-[10px] font-black text-gray-400 uppercase mb-1 tracking-wider">Tài xế nhận đơn</label>
                                <select value={filterDriver} onChange={(e) => setFilterDriver(e.target.value)} className="bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-indigo-400 outline-none w-48 font-medium">
                                    <option value="">-- Tất cả tài xế --</option>
                                    {drivers.map(d => <option key={d._id} value={d._id}>{d.name}</option>)}
                                </select>
                            </div>
                            <button onClick={resetFilters} className="bg-gray-100 text-gray-500 hover:text-gray-700 px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-gray-200 transition">Xóa lọc</button>
                        </div>

                        {/* 🔥 NÂNG CẤP: THANH CÔNG CỤ (ACTION BAR) ĐẸP MẮT */}
                        <div className="bg-white/80 backdrop-blur-md rounded-2xl shadow-sm border border-indigo-100 p-5">
                            <div className="flex flex-wrap md:flex-nowrap justify-between items-center gap-4">
                                <div className="flex items-center gap-3">
                                    <span className="font-bold text-gray-700 whitespace-nowrap bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-100"><PlaylistAddCheckIcon className="text-indigo-600 mr-1"/> Đã chọn: {selectedOrderIds.length}</span>
                                    <select className="bg-gray-50 border border-gray-200 rounded-xl p-2 text-sm focus:ring-2 focus:ring-indigo-400 outline-none w-48 font-medium" value={batchAssignDriverId} onChange={(e) => setBatchAssignDriverId(e.target.value)}>
                                        <option value="">-- Chọn tài xế gán --</option>
                                        {drivers.map(d => <option key={d._id} value={d._id}>{d.name}</option>)}
                                    </select>
                                    <button onClick={handleBatchManualAssign} disabled={selectedOrderIds.length === 0 || !batchAssignDriverId} className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 disabled:from-gray-300 disabled:to-gray-400 text-white px-5 py-2 rounded-xl text-sm font-bold transition shadow-md hover:shadow-lg disabled:shadow-none">Gán Hàng Loạt</button>
                                    <button onClick={handleBatchDelete} disabled={selectedOrderIds.length === 0} className="bg-white border border-red-200 text-red-500 hover:bg-red-50 hover:text-red-600 hover:border-red-300 disabled:border-gray-100 disabled:text-gray-300 px-5 py-2 rounded-xl text-sm font-bold transition shadow-sm">🗑️ Xóa Đơn</button>
                                </div>
                                <div className="w-px h-10 bg-gray-200 hidden md:block"></div>
                                <div className="flex gap-3">
                                    <button onClick={() => handleBatchAutoAssign('proximity')} disabled={isAutoAssigning} className="flex items-center gap-2 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white px-5 py-2 rounded-xl text-sm font-bold transition shadow-md hover:shadow-lg">{isAutoAssigning ? <AccessTimeIcon fontSize="small" className="animate-spin"/> : <NearMeIcon fontSize="small"/>} AI Gần Nhất</button>
                                    <button onClick={() => handleBatchAutoAssign('revenue')} disabled={isAutoAssigning} className="flex items-center gap-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white px-5 py-2 rounded-xl text-sm font-bold transition shadow-md hover:shadow-lg">{isAutoAssigning ? <AccessTimeIcon fontSize="small" className="animate-spin"/> : <AttachMoneyIcon fontSize="small"/>} AI Cân Bằng</button>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                            <div className="flex items-center gap-2 p-4 border-b border-gray-100 bg-gray-50/50"><h2 className="text-lg font-black text-gray-800">Danh sách đơn hàng</h2><span className="bg-indigo-100 text-indigo-800 text-xs font-bold px-2.5 py-1 rounded-full">{filteredOrders.length}</span></div>
                            <div className="overflow-x-auto max-h-[600px] custom-scrollbar">
                                <table className="w-full text-sm text-left border-collapse">
                                    <thead className="bg-gray-50 text-gray-500 sticky top-0 z-10 border-b border-gray-200 shadow-sm">
                                        <tr>
                                            <th className="p-3 text-center w-12"><input type="checkbox" className="w-4 h-4 cursor-pointer accent-indigo-600 rounded" onChange={handleSelectAll} checked={assignableOrders.length > 0 && selectedOrderIds.length === assignableOrders.length} /></th>
                                            <th className="p-3 uppercase font-black tracking-wider text-[11px]">Mã Đơn / Khách</th>
                                            <th className="p-3 uppercase font-black tracking-wider text-[11px] min-w-[200px]">Tuyến Đường</th>
                                            <th className="p-3 uppercase font-black tracking-wider text-[11px] text-right">Phí (VNĐ)</th>
                                            <th className="p-3 uppercase font-black tracking-wider text-[11px] text-center">Trạng Thái</th>
                                            <th className="p-3 uppercase font-black tracking-wider text-[11px]">Tài Xế (Sửa Nhanh)</th>
                                            <th className="p-3 uppercase font-black tracking-wider text-[11px] text-center min-w-[150px]">Nghiệp Vụ</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {filteredOrders.length === 0 && (<tr><td colSpan="7" className="text-center py-10 text-gray-400 italic font-medium">Không tìm thấy đơn hàng nào.</td></tr>)}
                                        {filteredOrders.map((order) => (
                                        <tr key={order._id} className={`hover:bg-indigo-50/30 transition ${selectedOrderIds.includes(order._id) ? 'bg-indigo-50/50' : ''}`}>
                                            <td className="p-3 text-center"><input type="checkbox" className="w-4 h-4 cursor-pointer accent-indigo-600 rounded" checked={selectedOrderIds.includes(order._id)} onChange={() => handleSelectOrder(order._id)} /></td>
                                            <td className="p-3">
                                                <button onClick={() => openOrderModal(order)} className="font-mono font-bold text-indigo-600 hover:text-indigo-800 hover:underline block">#{order._id.slice(-6).toUpperCase()}</button>
                                                <div className="text-xs text-gray-500 mt-1 font-medium">{order.customerId?.name || "Khách lẻ"}</div>
                                                <div className="text-[11px] text-gray-400 font-bold bg-gray-100 inline-block px-1.5 rounded mt-0.5">{order.weight} kg</div>
                                                {order.pickupTime && (<div className="mt-1.5 inline-block bg-red-50 border border-red-100 text-red-600 text-[10px] font-bold px-1.5 py-0.5 rounded">⏰ {new Date(order.pickupTime).toLocaleString("vi-VN", { hour: '2-digit', minute:'2-digit', day: '2-digit', month: '2-digit' })}</div>)}
                                            </td>
                                            <td className="p-3"><div className="font-medium text-gray-800 truncate max-w-[250px]" title={order.pickupAddress}><span className="text-emerald-500 mr-1">●</span>{order.pickupAddress}</div><div className="font-medium text-gray-800 truncate max-w-[250px] mt-1.5" title={order.deliveryAddress}><span className="text-rose-500 mr-1">■</span>{order.deliveryAddress}</div></td>
                                            <td className="p-3 font-bold text-emerald-600 text-right">{(order.price || order.cost || 0).toLocaleString()} ₫</td>
                                            <td className="p-3 text-center">
                                                <StatusBadge status={order.status} />
                                                {order.cancelRequest && order.status !== 'cancelled' && (<div className="text-[10px] bg-red-600 text-white font-bold px-2 py-1 rounded mt-1.5 animate-pulse inline-block shadow-sm">⚠️ YÊU CẦU HỦY</div>)}
                                                {order.status === 'cancelled' && order.cancelReason && (<div className="text-[10px] text-red-500 mt-1.5 truncate w-24 mx-auto font-medium" title={order.cancelReason}>Lý do: {order.cancelReason}</div>)}
                                            </td>
                                            <td className="p-3">
                                                <select className={`w-full p-2 border rounded-xl text-sm focus:ring-2 focus:ring-indigo-400 outline-none transition font-medium ${order.status === 'delivering' ? 'bg-gray-100 cursor-not-allowed border-gray-200 text-gray-500' : 'bg-white border-gray-200 hover:border-indigo-300'}`} value={order.driverId?._id || order.driverId || ""} onChange={(e) => handleAssignDriver(order._id, e.target.value)} disabled={order.status === 'delivering' || order.status === 'completed' || order.status === 'cancelled'}>
                                                    <option value="">-- Chưa gán / Hủy --</option>
                                                    {drivers.map(d => (<option key={d._id} value={d._id}>{d.name} - {d.phone}</option>))}
                                                </select>
                                            </td>
                                            <td className="p-3">
                                                <div className="flex flex-col items-center justify-center gap-1.5">
                                                    <div className="flex gap-1.5">
                                                        {order.cancelRequest && order.status !== 'cancelled' ? (
                                                            <button onClick={() => handleApproveCancel(order._id)} className="text-xs bg-red-600 text-white px-3 py-1.5 rounded-lg font-bold hover:bg-red-700 transition animate-bounce shadow-md">Duyệt Hủy</button>
                                                        ) : (
                                                            <>
                                                                {(order.status === 'pending' || order.status === 'unconfirmed') && (<button onClick={() => handleUpdateStatus(order._id, 'confirmed')} title="Xác nhận đơn" className="p-1.5 text-emerald-600 bg-emerald-50 hover:bg-emerald-100 border border-emerald-100 rounded-lg transition"><CheckCircleOutlineIcon fontSize="small"/></button>)}
                                                                {(order.status === 'pending' || order.status === 'unconfirmed') && (<button onClick={() => openCancelModal(order._id)} title="Từ chối đơn" className="p-1.5 text-rose-500 bg-rose-50 hover:bg-rose-100 border border-rose-100 rounded-lg transition"><HighlightOffIcon fontSize="small"/></button>)}
                                                                {(order.status === 'assigned') && (<button onClick={() => handleAssignDriver(order._id, null)} title="Hủy gán tài xế" className="p-1.5 text-orange-500 bg-orange-50 hover:bg-orange-100 border border-orange-100 rounded-lg transition flex items-center gap-1"><PersonRemoveIcon fontSize="small"/></button>)}
                                                                {order.status !== 'cancelled' && (<button onClick={() => openOrderModal(order)} className="text-xs bg-indigo-50 text-indigo-700 border border-indigo-100 px-3 py-1.5 rounded-lg font-bold hover:bg-indigo-100 transition shadow-sm">Bản đồ</button>)}
                                                            </>
                                                        )}
                                                    </div>
                                                    {['pending', 'confirmed'].includes(order.status) && (
                                                        <button onClick={() => openAssignPreview(order)} className="text-[11px] bg-gradient-to-r from-purple-500 to-indigo-500 text-white px-2 py-1.5 rounded-lg font-bold hover:from-purple-600 hover:to-indigo-600 transition w-full flex justify-center items-center gap-1 shadow-md">
                                                             Gán tài xế
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {/* =======================================================
                    TAB 2: QUẢN LÝ TÀI XẾ
                ======================================================= */}
                {activeTab === 'drivers' && (
                    <div className="animate-fadeIn space-y-6">
                        
                        {/* 🔥 NÂNG CẤP: DANH SÁCH BỊ KHÓA CHIỀU CAO & CÓ THANH CUỘN RIÊNG */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            
                            {/* Cột Trái: Search và List bị khóa trong h-[700px] */}
                            <div className="lg:col-span-1 flex flex-col h-[700px] gap-4">
                                {/* Search Bar Cố Định Phía Trên */}
                                <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-200 shrink-0">
                                    <div className="relative">
                                        <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400"><FilterAltIcon fontSize="small"/></span>
                                        <input type="text" placeholder="Tìm tên hoặc SĐT tài xế..." className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-400 outline-none font-medium text-sm" value={driverSearch} onChange={(e) => setDriverSearch(e.target.value)} />
                                    </div>
                                </div>
                                
                                {/* Danh Sách Tự Động Kéo Dãn Ra Lấp Đầy Khoảng Trống Còn Lại */}
                                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 flex flex-col flex-1 min-h-0 overflow-hidden">
                                    <div className="p-4 border-b border-gray-100 bg-gray-50/50 font-black text-gray-800 shrink-0 flex justify-between items-center">
                                        <span>Đội ngũ tài xế</span>
                                        <span className="bg-green-100 text-green-700 text-[10px] px-2 py-0.5 rounded-full">{filteredDrivers.length} xe</span>
                                    </div>
                                    
                                    {/* Khu vực danh sách cuộn */}
                                    <div className="divide-y divide-gray-100 overflow-y-auto custom-scrollbar flex-1 p-2">
                                        {filteredDrivers.map(d => (
                                            <div key={d._id} className="p-3 hover:bg-green-50/50 rounded-xl transition cursor-pointer mb-1 border border-transparent hover:border-green-100">
                                                <div className="flex justify-between items-start">
                                                    <div>
                                                        <p className="font-bold text-gray-900 text-sm">{d.name}</p>
                                                        <p className="text-[11px] text-gray-500 font-medium">{d.phone}</p>
                                                    </div>
                                                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-black tracking-wider uppercase ${d.status === 'locked' ? 'bg-red-50 text-red-500 border border-red-100' : 'bg-emerald-50 text-emerald-600 border border-emerald-100'}`}>{d.status === 'locked' ? 'Bị khóa' : 'Hoạt động'}</span>
                                                </div>
                                                <div className="mt-3 grid grid-cols-2 gap-2 text-[10px] uppercase font-bold text-gray-500">
                                                    <div className="bg-gray-50 p-2 rounded-lg text-center border border-gray-100">🏁 <span className="text-gray-800">{d.totalKm?.toFixed(1) || 0} KM</span></div>
                                                    <div className="bg-gray-50 p-2 rounded-lg text-center border border-gray-100">💰 <span className="text-emerald-600">{d.totalProfit?.toLocaleString() || 0} đ</span></div>
                                                </div>
                                            </div>
                                        ))}
                                        {filteredDrivers.length === 0 && <div className="p-6 text-center text-sm text-gray-400 font-medium italic">Không tìm thấy tài xế nào.</div>}
                                    </div>
                                </div>
                            </div>

                            {/* Cột Phải: Bản đồ cố định h-[700px] */}
                            <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex flex-col h-[700px]">
                                <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-white shrink-0">
                                    <h3 className="font-black text-gray-800 flex items-center gap-2"><MapIcon className="text-emerald-500"/> Bản đồ trực tuyến Đội xe</h3>
                                    <div className="flex gap-4 text-xs font-bold">
                                        <span className="flex items-center gap-1.5"><span className="w-3 h-3 bg-blue-500 rounded-full shadow-sm"></span> Vị trí Tài xế</span>
                                    </div>
                                </div>
                                <div className="flex-1 relative z-0">
                                    <MapContainer center={[21.0285, 105.8542]} zoom={12} style={{ height: "100%", width: "100%" }}>
                                        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                                        {drivers.map(d => {
                                            const safeLoc = getSafeCoords(d);
                                            return (
                                                <Marker key={d._id} position={[safeLoc.lat, safeLoc.lng]} icon={driverIcon}>
                                                    <Popup><div className="text-sm"><p className="font-bold text-indigo-700">{d.name}</p><p>📞 {d.phone}</p><hr className="my-1"/><p className="text-xs">Đã đi: <b>{d.totalKm?.toFixed(1) || 0} km</b></p></div></Popup>
                                                </Marker>
                                            );
                                        })}
                                    </MapContainer>
                                </div>
                            </div>
                        </div>

                        {/* 🔥 NÂNG CẤP: KHỐI THỐNG KÊ (LỌC TÙY Ý) */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-8 border-t border-gray-200 pt-8">
                            <div className="lg:col-span-1 bg-white p-6 rounded-2xl shadow-sm border border-gray-200 h-[450px] flex flex-col">
                                <div className="flex flex-col gap-3 mb-4 border-b border-gray-100 pb-4">
                                    <h2 className="text-lg font-black text-gray-800 flex items-center gap-2"><InventoryIcon className="text-indigo-600"/> Bảng xếp hạng Tài xế</h2>
                                    
                                    {/* Bộ điều khiển lọc */}
                                    <div className="flex gap-2 w-full">
                                        <select value={statFilterType} onChange={handleStatFilterChange} className="bg-gray-50 border border-gray-200 text-gray-700 font-bold rounded-xl p-2 text-xs focus:ring-2 focus:ring-indigo-400 outline-none flex-1 cursor-pointer">
                                            <option value="all">Tổng cộng (All-time)</option>
                                            <option value="year">Theo Năm</option>
                                            <option value="month">Theo Tháng</option>
                                            <option value="day">Theo Ngày</option>
                                        </select>
                                        {statFilterType === 'day' && <input type="date" value={statFilterValue} onChange={(e) => setStatFilterValue(e.target.value)} className="bg-white border border-indigo-200 text-indigo-700 font-bold rounded-xl p-2 text-xs w-32 outline-none focus:ring-2 focus:ring-indigo-400" />}
                                        {statFilterType === 'month' && <input type="month" value={statFilterValue} onChange={(e) => setStatFilterValue(e.target.value)} className="bg-white border border-indigo-200 text-indigo-700 font-bold rounded-xl p-2 text-xs w-28 outline-none focus:ring-2 focus:ring-indigo-400" />}
                                        {statFilterType === 'year' && <input type="number" min="2020" max="2100" value={statFilterValue} onChange={(e) => setStatFilterValue(e.target.value)} className="bg-white border border-indigo-200 text-indigo-700 font-bold rounded-xl p-2 text-xs w-20 outline-none focus:ring-2 focus:ring-indigo-400" placeholder="Năm..." />}
                                    </div>
                                </div>

                                <div className="overflow-y-auto flex-1 custom-scrollbar pr-2">
                                    <table className="w-full text-sm text-left">
                                        <thead className="text-[10px] text-gray-400 uppercase bg-white sticky top-0 border-b border-gray-100">
                                            <tr><th className="py-2 font-black tracking-wider">Tên</th><th className="py-2 text-center font-black tracking-wider">Đơn</th><th className="py-2 text-right font-black tracking-wider">Doanh thu</th></tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-50">
                                            {driverStats.length === 0 && <tr><td colSpan="3" className="text-center py-5 text-gray-400 text-xs italic">Không có dữ liệu trong khoảng thời gian này.</td></tr>}
                                            {driverStats.map((d, i) => (
                                            <tr key={i} className="hover:bg-gray-50 transition">
                                                <td className="py-3 font-bold text-gray-800 text-xs flex items-center gap-1.5">
                                                    {i === 0 && <span className="text-amber-500">👑</span>}
                                                    {i === 1 && <span className="text-gray-400">🥈</span>}
                                                    {i === 2 && <span className="text-amber-700">🥉</span>}
                                                    {d.name}
                                                </td>
                                                <td className="py-3 text-center text-indigo-600 font-black bg-indigo-50/50 rounded">{d.orders}</td>
                                                <td className="py-3 text-right font-black text-emerald-600">{d.revenue.toLocaleString()} ₫</td>
                                            </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-gray-200 h-[450px] flex flex-col">
                                <h2 className="text-lg font-black text-gray-800 mb-4 flex items-center gap-2"><BarChartIcon className="text-blue-500"/> Biểu đồ Hiệu suất Doanh thu</h2>
                                <div className="flex-1 w-full min-h-0 pt-4">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={driverStats.slice(0, 15)} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                                            <XAxis dataKey="name" tick={{fontSize: 10, fill: '#6b7280', fontWeight: 'bold'}} interval={0} angle={-30} textAnchor="end" />
                                            <YAxis tick={{fontSize: 10, fill: '#6b7280'}} tickFormatter={(val) => (val/1000) + 'k'} />
                                            <Tooltip formatter={(value) => [value.toLocaleString() + " ₫", "Doanh thu"]} cursor={{fill: '#f3f4f6'}} contentStyle={{borderRadius: '12px', fontWeight: 'bold', fontSize: '12px'}} />
                                            <Legend verticalAlign="top" height={36} wrapperStyle={{fontSize: '12px', fontWeight: 'bold'}} />
                                            <Bar dataKey="revenue" name="Doanh thu (VNĐ)" fill="url(#colorRevenue)" radius={[6, 6, 0, 0]} maxBarSize={50} />
                                            <defs>
                                                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#6366f1" stopOpacity={1}/>
                                                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.8}/>
                                                </linearGradient>
                                            </defs>
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                                <p className="text-center text-[10px] text-gray-400 font-bold uppercase mt-2">* Biểu đồ hiển thị top 15 tài xế trong bộ lọc hiện tại</p>
                            </div>
                        </div>

                    </div>
                )}

                {/* =======================================================
                    TAB 3: ALGO LAB (PHÒNG THÍ NGHIỆM THUẬT TOÁN)
                ======================================================= */}
                {activeTab === 'algo-lab' && (
                    <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-200 min-h-[600px] animate-fadeIn">
                        <div className="flex items-center gap-3 mb-8 border-b border-gray-100 pb-5">
                            <AutoFixHighIcon fontSize="large" className="text-purple-600" />
                            <div>
                                <h2 className="text-2xl font-black text-gray-800 tracking-tight">Phòng Thí Nghiệm & Đánh Giá Thuật Toán</h2>
                                <p className="text-sm text-gray-500 mt-1 font-medium">Mô phỏng ngẫu nhiên dữ liệu giao dịch. Chạy đối chiếu qua 5 bộ dữ liệu để đánh giá hiệu suất của Greedy, Round-Robin và Local Search.</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                            <div className="bg-gray-50 p-5 rounded-2xl border border-gray-200">
                                <label className="block text-[11px] font-black text-gray-500 uppercase mb-3 tracking-wider">Số lượng Đơn hàng (Requests)</label>
                                <input type="range" min="200" max="500" step="50" value={algoParams.numOrders} onChange={(e) => setAlgoParams({...algoParams, numOrders: parseInt(e.target.value)})} className="w-full h-2 bg-purple-200 rounded-lg appearance-none cursor-pointer accent-purple-600" />
                                <div className="text-right font-black text-purple-700 mt-3 text-2xl">{algoParams.numOrders} <span className="text-sm text-purple-500">Đơn</span></div>
                            </div>
                            <div className="bg-gray-50 p-5 rounded-2xl border border-gray-200">
                                <label className="block text-[11px] font-black text-gray-500 uppercase mb-3 tracking-wider">Số lượng Xe (Drivers)</label>
                                <div className="flex gap-2">
                                    {[20, 30, 50].map(num => (
                                        <button key={num} onClick={() => setAlgoParams({...algoParams, numDrivers: num})} className={`flex-1 py-2.5 font-bold rounded-xl border-2 transition ${algoParams.numDrivers === num ? 'bg-purple-100 border-purple-500 text-purple-700 shadow-sm' : 'bg-white border-gray-200 text-gray-500 hover:border-purple-300 hover:text-purple-600'}`}>{num} Xe</button>
                                    ))}
                                </div>
                            </div>
                            <div className="flex flex-col justify-end">
                                <button onClick={runSimulation} disabled={isSimulating} className="w-full h-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 disabled:from-gray-400 disabled:to-gray-500 text-white font-black text-lg rounded-2xl shadow-md hover:shadow-lg transition flex items-center justify-center gap-2 disabled:shadow-none">
                                    {isSimulating ? <AccessTimeIcon className="animate-spin" /> : '🚀'} 
                                    {isSimulating ? 'Đang chạy 5 bộ Data...' : 'Chạy Mô Phỏng'}
                                </button>
                            </div>
                        </div>

                        {algoResults && (
                            <div className="animate-fadeIn">
                                <h3 className="font-black text-lg mb-4 text-gray-800">📊 Kết Quả Trung Bình (Trên 5 tập dữ liệu ngẫu nhiên)</h3>
                                <div className="overflow-hidden rounded-2xl border border-gray-200 shadow-sm">
                                    <table className="w-full text-left text-sm">
                                        <thead className="bg-purple-50 text-purple-800 text-[11px] uppercase font-black tracking-wider">
                                            <tr>
                                                <th className="p-4">Tên Thuật Toán</th>
                                                <th className="p-4 text-right">Tổng Quãng Đường ↓</th>
                                                <th className="p-4 text-right">Độ lệch chuẩn ↓</th>
                                                <th className="p-4 text-right">Thời gian chạy</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {algoResults.map((res) => (
                                                <tr key={res.id} className={res.name.includes("Local Search") ? "bg-purple-50/30" : ""}>
                                                    <td className="p-4 font-bold text-gray-800 flex items-center gap-2">
                                                        {res.name}
                                                        {res.name.includes("Local Search") && <span className="text-[9px] bg-purple-600 text-white px-2 py-0.5 rounded-full uppercase tracking-wider shadow-sm">Tối ưu nhất</span>}
                                                    </td>
                                                    <td className={`p-4 text-right font-mono font-bold text-base ${res.name.includes("Local Search") ? "text-purple-600" : "text-gray-600"}`}>{res.distance} <span className="text-xs text-gray-400">km</span></td>
                                                    <td className={`p-4 text-right font-mono font-bold text-base ${res.name.includes("Revenue") ? "text-blue-600" : "text-gray-600"}`}>{res.variance}</td>
                                                    <td className="p-4 text-right font-mono text-gray-500 font-medium">{res.time} ms</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                <div className="mt-5 text-sm text-gray-600 bg-blue-50/50 p-5 rounded-2xl border border-blue-100 leading-relaxed font-medium">
                                    <p><strong className="text-blue-700">💡 Phân tích:</strong> Thuật toán <b>Local Search (Tối ưu hoán đổi)</b> cho ra tổng quãng đường ngắn nhất, tiết kiệm chi phí xăng xe nhất. Thuật toán <b>Round-Robin</b> cho độ lệch chuẩn thấp nhất, đảm bảo tính công bằng thu nhập cho các tài xế.</p>
                                </div>

                                {/* BẢN ĐỒ MINH CHỨNG */}
                                {algoSample && algoSample.drivers && algoSample.orders && (
                                    <div className="mt-8 border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
                                        <div className="bg-gray-50 p-5 border-b border-gray-200 flex justify-between items-center">
                                            <h3 className="font-black text-gray-800 flex items-center gap-2">
                                                <MapIcon className="text-purple-600" /> Minh chứng Phân bổ Dữ liệu (Lần chạy cuối)
                                            </h3>
                                            <div className="flex gap-4 text-xs font-black tracking-wider uppercase bg-white px-3 py-1.5 rounded-lg shadow-sm border border-gray-100">
                                                <span className="text-blue-600">🛵 {algoSample.drivers.length} Tài xế</span>
                                                <span className="text-red-500">📦 {algoSample.orders.length} Đơn hàng</span>
                                            </div>
                                        </div>
                                        <div className="h-[450px] w-full relative z-0">
                                            <MapContainer center={[21.0285, 105.8542]} zoom={13} style={{ height: "100%", width: "100%" }}>
                                                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                                                {algoSample.orders.map((o, idx) => (
                                                    <CircleMarker key={`o-${idx}`} center={[o.pickup.lat, o.pickup.lng]} radius={4} pathOptions={{ color: '#ffffff', weight: 1.5, fillColor: '#ef4444', fillOpacity: 0.9 }}>
                                                        <Popup className="font-bold text-xs text-red-600 shadow-sm rounded-lg">📦 Đơn {o.id}</Popup>
                                                    </CircleMarker>
                                                ))}
                                                {algoSample.drivers.map((d, idx) => (
                                                    <CircleMarker key={`d-${idx}`} center={[d.loc.lat, d.loc.lng]} radius={7} pathOptions={{ color: '#ffffff', weight: 2, fillColor: '#3b82f6', fillOpacity: 1 }}>
                                                        <Popup className="font-bold text-xs text-blue-600 shadow-sm rounded-lg">🛵 {d.id}</Popup>
                                                    </CircleMarker>
                                                ))}
                                            </MapContainer>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* =======================================================
                CÁC MODAL DIALOGS
            ======================================================= */}
            
            {/* Modal Nhập Lý Do Hủy */}
            {cancelModal.isOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn">
                    <div className="bg-white p-6 rounded-3xl w-full max-w-md shadow-2xl border border-gray-100">
                        <h3 className="text-xl font-black text-red-600 mb-2 flex items-center gap-2"><HighlightOffIcon/> Từ chối / Hủy đơn</h3>
                        <p className="text-sm text-gray-500 mb-5 font-medium">Vui lòng cung cấp lý do hủy để thông báo cho khách hàng và lưu lại hệ thống.</p>
                        <textarea className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-red-400 text-sm font-medium" rows="4" placeholder="Nhập lý do hủy đơn (bắt buộc)..." value={cancelModal.reason} onChange={(e) => setCancelModal({...cancelModal, reason: e.target.value})}></textarea>
                        <div className="flex justify-end gap-3 mt-6">
                            <button onClick={() => setCancelModal({ isOpen: false, orderId: null, reason: "" })} className="px-5 py-2.5 bg-gray-100 text-gray-600 rounded-xl font-bold hover:bg-gray-200 transition">Đóng</button>
                            <button onClick={() => handleUpdateStatus(cancelModal.orderId, 'cancelled', cancelModal.reason)} disabled={!cancelModal.reason.trim()} className="px-5 py-2.5 bg-red-500 text-white rounded-xl font-bold hover:bg-red-600 disabled:bg-red-300 transition shadow-md hover:shadow-lg disabled:shadow-none">Xác nhận Hủy</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Chi Tiết Đơn Hàng */}
            {selectedOrder && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-6xl h-[85vh] flex flex-col md:flex-row overflow-hidden relative border border-gray-100">
                        <button onClick={() => setSelectedOrder(null)} className="absolute top-4 right-4 z-[999] bg-white/80 backdrop-blur text-gray-500 hover:text-red-500 p-2 rounded-full shadow-sm hover:shadow transition border border-gray-200"><CloseIcon /></button>
                        <div className="w-full md:w-1/3 bg-gray-50 p-6 overflow-y-auto border-r border-gray-200 custom-scrollbar">
                            <h2 className="text-2xl font-black text-gray-800 mb-1">Chi tiết đơn</h2>
                            <p className="text-xs text-gray-500 mb-6 font-mono font-medium">ID: {selectedOrder._id}</p>
                            
                            <div className="bg-white p-5 rounded-2xl shadow-sm mb-6 border border-gray-200">
                                <div className="mb-4 pb-4 border-b border-gray-100">
                                    <span className="text-[10px] font-black text-indigo-500 uppercase tracking-wider">Thông tin người đặt </span>
                                    <p className="font-black text-lg text-gray-800 mt-1.5">{selectedOrder.customerId?.name || "Khách lẻ"}</p>
                                    <p className="text-sm text-gray-600 mt-1.5 font-medium">📞 SĐT người đặt: <strong className="text-gray-900">{selectedOrder.customerId?.phone || "Không cung cấp"}</strong></p>
                                    {selectedOrder.recipientPhone && (<p className="text-sm text-orange-600 mt-1.5 font-medium">📞 SĐT người nhận: <strong className="text-orange-700">{selectedOrder.recipientPhone}</strong></p>)}
                                </div>
                                <div className="space-y-4 mb-5">
                                    {selectedOrder.pickupTime && (<div className="bg-red-50 p-3.5 rounded-xl border border-red-100"><span className="text-[10px] font-black text-red-500 uppercase tracking-wider">⏰ Hạn giao hàng</span><p className="font-black text-red-700 text-sm mt-1">{new Date(selectedOrder.pickupTime).toLocaleString("vi-VN")}</p></div>)}
                                    <div><span className="text-[10px] font-black text-gray-400 uppercase tracking-wider">📍 Lấy hàng tại</span><p className="text-sm font-bold text-gray-800 mt-1 leading-relaxed">{selectedOrder.pickupAddress}</p></div>
                                    <div><span className="text-[10px] font-black text-gray-400 uppercase tracking-wider">📍 Giao hàng đến</span><p className="text-sm font-bold text-gray-800 mt-1 leading-relaxed">{selectedOrder.deliveryAddress}</p></div>
                                </div>
                                <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded-xl border border-gray-100">
                                    <div><span className="text-[10px] font-black text-gray-500 uppercase tracking-wider">Cân nặng</span><p className="font-black text-gray-800 mt-1 text-base">{selectedOrder.weight} <span className="text-xs text-gray-500">kg</span></p></div>
                                    <div><span className="text-[10px] font-black text-gray-500 uppercase tracking-wider">Giá cước</span><p className="font-black text-emerald-600 mt-1 text-base">{(selectedOrder.price || selectedOrder.cost || 0).toLocaleString()} ₫</p></div>
                                </div>
                                {selectedOrder.status === 'delivering' && <div className="mt-5 p-3 bg-yellow-50 border border-yellow-200 text-yellow-700 rounded-xl text-center text-sm font-bold animate-pulse shadow-sm">🚚 Tài xế đang giao hàng...</div>}
                                {selectedOrder.status === 'completed' && <div className="mt-5 p-3 bg-green-50 border border-green-200 text-green-700 rounded-xl text-center text-sm font-bold shadow-sm">✅ Đã giao thành công</div>}
                                {selectedOrder.status === 'cancelled' && <div className="mt-5 p-4 bg-red-50 text-red-600 rounded-xl text-sm font-medium border border-red-200"><strong>Lý do hủy:</strong> {selectedOrder.cancelReason || selectedOrder.failedReason || "Không có lý do"}</div>}
                            </div>
                            <div className="bg-gradient-to-br from-indigo-50 to-white p-5 rounded-2xl shadow-sm border border-indigo-100">
                                <h3 className="font-black text-gray-800 mb-4 flex items-center gap-2"><AssignmentIndIcon className="text-indigo-600"/> Điều phối tài xế</h3>
                                {['completed', 'cancelled', 'failed'].includes(selectedOrder.status) ? (
                                    <div className="text-center py-4 bg-white border border-gray-200 rounded-xl text-gray-500 font-medium">Đơn hàng đã kết thúc.</div>
                                ) : (
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-[11px] font-black text-gray-500 uppercase tracking-wider mb-2">Gán Tay / Sửa Lỗi</label>
                                        <select className="w-full bg-white p-2.5 border border-gray-200 rounded-xl font-medium focus:ring-2 focus:ring-indigo-400 outline-none disabled:bg-gray-100" value={selectedDriverId} onChange={(e) => setSelectedDriverId(e.target.value)} disabled={selectedOrder.status === 'delivering'}>
                                            <option value="">-- Chưa gán tài xế --</option>
                                            {drivers.map(d => (<option key={d._id} value={d._id}>{d.name} - {d.phone}</option>))}
                                        </select>
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={() => { handleAssignDriver(selectedOrder._id, selectedDriverId); setSelectedOrder(prev => ({...prev, status: 'assigned', driverId: drivers.find(d => d._id === selectedDriverId)})); }} disabled={selectedOrder.status === 'delivering'} className={`flex-1 py-2.5 text-white font-bold rounded-xl transition shadow-md hover:shadow-lg disabled:shadow-none ${selectedOrder.status === 'delivering' ? 'bg-gray-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'}`}>
                                            {selectedOrder.status === 'delivering' ? "Đang giao" : "Cập nhật gán"}
                                        </button>
                                        {(selectedOrder.status === 'assigned' || selectedOrder.driverId) && selectedOrder.status !== 'delivering' && (
                                            <button onClick={() => { handleAssignDriver(selectedOrder._id, null); setSelectedOrder(prev => ({...prev, status: 'pending', driverId: null})); setSelectedDriverId(""); }} className="px-5 py-2.5 bg-orange-50 text-orange-600 hover:bg-orange-100 hover:text-orange-700 border border-orange-200 font-bold rounded-xl transition shadow-sm hover:shadow">Hủy gán</button>
                                        )}
                                    </div>
                                </div>
                                )}
                            </div>
                        </div>
                        <div className="w-full md:w-2/3 h-full relative">
                            <MapContainer center={getPoint(selectedOrder, 'pickup') || [21.0285, 105.8542]} zoom={13} style={{ height: "100%", width: "100%" }}>
                                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                                {routeCoords.length > 0 && <Polyline positions={normalizeRoute(routeCoords)} color="#6366f1" weight={6} opacity={0.8} />}
                                {getPoint(selectedOrder, 'pickup') && <Marker position={getPoint(selectedOrder, 'pickup')} icon={pickupIcon}><Popup className="font-bold text-emerald-600">Lấy hàng</Popup></Marker>}
                                {getPoint(selectedOrder, 'dropoff') && <Marker position={getPoint(selectedOrder, 'dropoff')} icon={deliveryIcon}><Popup className="font-bold text-rose-600">Giao hàng</Popup></Marker>}
                                {driverLocation && selectedOrder.status === 'delivering' && (
                                    <Marker position={normalizePoint(driverLocation)} icon={driverIcon} zIndexOffset={99999}><Popup className="font-bold text-blue-600">Tài xế đang ở đây</Popup></Marker>
                                )}
                                <MapUpdater bounds={routeCoords.length > 0 ? normalizeRoute(routeCoords) : null} driverLocation={normalizePoint(driverLocation)} />
                            </MapContainer>
                            {selectedOrder.status === 'delivering' && (<div className="absolute top-4 left-4 z-[9999] bg-white/90 backdrop-blur-sm px-5 py-3 rounded-2xl shadow-lg border-l-4 border-green-500 font-black text-green-700 animate-pulse tracking-wide">{signalStatus}</div>)}
                        </div>
                    </div>
                </div>
            )}

            {/* 🔥 MODAL AI GÁN ĐƠN ĐƠN LẺ */}
            {assignModalData && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fadeIn">
                    <div className="bg-white w-full max-w-6xl rounded-3xl overflow-hidden flex h-[85vh] min-h-[500px] shadow-2xl relative border border-indigo-100">
                        <button onClick={() => setAssignModalData(null)} className="absolute top-4 right-4 z-[9999] bg-white/80 backdrop-blur text-gray-500 hover:text-red-500 p-2 rounded-full shadow-sm hover:shadow transition border border-gray-200"><CloseIcon /></button>

                        <div className="w-[65%] h-full relative z-0">
                            <MapContainer center={[assignModalData.order.pickupCoords.lat, assignModalData.order.pickupCoords.lng]} zoom={13} style={{ height: "100%", width: "100%" }}>
                                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                                <Marker position={[assignModalData.order.pickupCoords.lat, assignModalData.order.pickupCoords.lng]} icon={pickupIcon}>
                                    <Popup><b className="text-emerald-600">📦 ĐIỂM LẤY HÀNG</b><br/>{assignModalData.order.pickupAddress}</Popup>
                                </Marker>
                                <Circle center={[assignModalData.order.pickupCoords.lat, assignModalData.order.pickupCoords.lng]} radius={5000} pathOptions={{ color: '#8b5cf6', fillColor: '#d8b4fe', fillOpacity: 0.15, weight: 2, dashArray: '5, 5' }} />
                                {assignModalData.allDrivers.map(d => (
                                    <Marker key={d._id} position={[d.dLat, d.dLng]} icon={driverIcon}>
                                        <Popup><b className="text-blue-600">🛵 {d.name}</b><br/>Cách: {d.calculatedDistance.toFixed(1)}km | Đang giữ: {d.activeOrders} đơn</Popup>
                                    </Marker>
                                ))}
                            </MapContainer>
                            <div className="absolute top-5 left-5 z-[1000] bg-white/90 backdrop-blur px-5 py-3 rounded-2xl shadow-lg border border-purple-100">
                                <p className="text-[10px] font-black text-purple-500 uppercase tracking-wider">Phân tích AI cho Đơn</p>
                                <p className="text-2xl font-black text-purple-800 mt-0.5">#{assignModalData.order._id.slice(-6).toUpperCase()}</p>
                            </div>
                        </div>

                        <div className="w-[35%] h-full flex flex-col bg-gray-50 border-l border-gray-200 shadow-inner">
                            <div className="p-6 border-b border-gray-200 bg-white shadow-sm z-10 shrink-0">
                                <h3 className="font-black text-xl text-gray-800 flex items-center gap-2"><AutoFixHighIcon className="text-purple-600"/> AI Đề Xuất</h3>
                                <p className="text-xs text-gray-500 mt-2 font-medium leading-relaxed">Hệ thống đã phân tích và tìm ra 3 ứng cử viên xuất sắc nhất dựa trên các thuật toán tối ưu.</p>
                            </div>
                            
                            <div className="flex-1 overflow-y-auto p-5 space-y-5 custom-scrollbar">
                                
                                {/* 1. AI TỐI ƯU TỔNG HỢP */}
                                <div className="border border-purple-200 bg-gradient-to-br from-purple-50 to-white p-5 rounded-2xl shadow-md relative overflow-hidden group hover:shadow-lg transition">
                                    <div className="absolute top-0 right-0 bg-purple-600 text-white text-[10px] font-black px-3 py-1.5 rounded-bl-xl uppercase tracking-wider shadow-sm">Khuyên dùng</div>
                                    <h4 className="font-black text-purple-800 text-sm mb-3 flex items-center gap-1.5"><span className="text-lg">🌟</span> AI Tối Ưu (Local Search)</h4>
                                    <div className="flex justify-between items-center mb-4">
                                        <div>
                                            <p className="font-black text-gray-900 text-lg">{assignModalData.suggestions.balanced.name}</p>
                                            <p className="text-xs text-gray-600 mt-1 font-medium leading-tight">Sự kết hợp hoàn hảo giữa vị trí và khối lượng công việc hiện tại.</p>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3 text-[11px] mb-4">
                                        <div className="bg-white p-2.5 rounded-xl border border-purple-100 shadow-sm"><span className="text-gray-400 font-bold uppercase tracking-wider block mb-1">Khoảng cách</span><span className="font-black text-gray-800 text-sm">{assignModalData.suggestions.balanced.calculatedDistance.toFixed(1)} km</span></div>
                                        <div className="bg-white p-2.5 rounded-xl border border-purple-100 shadow-sm"><span className="text-gray-400 font-bold uppercase tracking-wider block mb-1">Đang giữ</span><span className="font-black text-gray-800 text-sm">{assignModalData.suggestions.balanced.activeOrders} đơn</span></div>
                                    </div>
                                    <button onClick={() => confirmManualAssign(assignModalData.suggestions.balanced._id)} className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white py-3 rounded-xl font-black text-sm shadow-md hover:shadow-xl transition flex items-center justify-center gap-2">
                                        Chốt Quán Quân Tối Ưu
                                    </button>
                                </div>

                                {/* 2. AI GẦN NHẤT */}
                                <div className="border border-blue-100 bg-white p-5 rounded-2xl shadow-sm hover:shadow-md hover:border-blue-200 transition">
                                    <h4 className="font-black text-blue-600 text-sm mb-3 flex items-center gap-1.5"><span className="text-lg">📍</span> AI Gần Nhất (Greedy)</h4>
                                    <div className="flex justify-between items-center">
                                        <div>
                                            <p className="font-black text-gray-900 text-base">{assignModalData.suggestions.distance.name}</p>
                                            <p className="text-xs text-gray-500 mt-1 font-medium">Cách điểm lấy hàng chỉ <strong className="text-blue-600 bg-blue-50 px-1 rounded">{assignModalData.suggestions.distance.calculatedDistance.toFixed(1)} km</strong>.</p>
                                        </div>
                                    </div>
                                    <button onClick={() => confirmManualAssign(assignModalData.suggestions.distance._id)} className="w-full mt-4 bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-600 hover:text-white hover:border-blue-600 py-2.5 rounded-xl font-bold text-sm shadow-sm hover:shadow transition">
                                        Chốt Người Gần Nhất
                                    </button>
                                </div>

                                {/* 3. AI CÂN BẰNG TẢI */}
                                <div className="border border-emerald-100 bg-white p-5 rounded-2xl shadow-sm hover:shadow-md hover:border-emerald-200 transition mb-8">
                                    <h4 className="font-black text-emerald-600 text-sm mb-3 flex items-center gap-1.5"><span className="text-lg">⚖️</span> AI Cân Bằng (Round-Robin)</h4>
                                    <div className="flex justify-between items-center">
                                        <div>
                                            <p className="font-black text-gray-900 text-base">{assignModalData.suggestions.revenue.name}</p>
                                            <p className="text-xs text-gray-500 mt-1 font-medium leading-relaxed">Người đang giữ ít đơn (<strong className="text-emerald-600 bg-emerald-50 px-1 rounded">{assignModalData.suggestions.revenue.activeOrders} đơn</strong>) hoặc có doanh thu thấp nhất.</p>
                                        </div>
                                    </div>
                                    <button onClick={() => confirmManualAssign(assignModalData.suggestions.revenue._id)} className="w-full mt-4 bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-500 hover:text-white hover:border-emerald-500 py-2.5 rounded-xl font-bold text-sm shadow-sm hover:shadow transition">
                                        Chốt Người Ít Việc Nhất
                                    </button>
                                </div>

                                {/* TẤT CẢ TÀI XẾ KHÁC */}
                                <div>
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="h-px bg-gray-200 flex-1"></div>
                                        <h4 className="font-black text-gray-400 text-[10px] uppercase tracking-widest">Danh sách tất cả</h4>
                                        <div className="h-px bg-gray-200 flex-1"></div>
                                    </div>
                                    <div className="space-y-2.5">
                                        {assignModalData.allDrivers.map(driver => (
                                            <div key={driver._id} className="bg-white p-3 rounded-xl border border-gray-100 flex justify-between items-center hover:bg-indigo-50/50 hover:border-indigo-100 transition cursor-pointer group" onClick={() => confirmManualAssign(driver._id)}>
                                                <div>
                                                    <p className="font-bold text-sm text-gray-800 group-hover:text-indigo-700 transition">{driver.name}</p>
                                                    <p className="text-[10px] text-gray-500 mt-0.5 font-medium">Cách: <strong className="text-gray-700">{driver.calculatedDistance.toFixed(1)}km</strong> | Giữ: <strong className="text-gray-700">{driver.activeOrders} đơn</strong></p>
                                                </div>
                                                <button className="bg-gray-100 group-hover:bg-indigo-600 group-hover:text-white text-gray-600 px-4 py-1.5 rounded-lg text-xs font-bold transition shadow-sm">Gán</button>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

const StatusBadge = ({ status }) => { 
    const styles = { 
        unconfirmed: "bg-gray-100 text-gray-600 border-gray-200", pending: "bg-orange-50 text-orange-600 border-orange-200", confirmed: "bg-cyan-50 text-cyan-600 border-cyan-200",
        assigned: "bg-blue-50 text-blue-600 border-blue-200 shadow-sm", delivering: "bg-yellow-50 text-yellow-700 border-yellow-200 shadow-sm animate-pulse", completed: "bg-emerald-50 text-emerald-600 border-emerald-200", cancelled: "bg-red-50 text-red-600 border-red-200" 
    }; 
    const labelMapping = { unconfirmed: "Chưa duyệt", pending: "Chờ xử lý", confirmed: "Đã xác nhận", assigned: "Đã phân công", delivering: "Đang giao", completed: "Hoàn thành", cancelled: "Đã hủy" };
    return <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black tracking-wider uppercase whitespace-nowrap border ${styles[status] || "bg-gray-50 border-gray-200 text-gray-500"}`}>{labelMapping[status] || status}</span>; 
};

export default DashboardCoordinator;