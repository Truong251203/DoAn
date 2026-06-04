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
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import RouteIcon from '@mui/icons-material/Route';
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
const grayIcon = new L.Icon({ iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-grey.png", shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png", iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41] }); 

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
    const [rawOrders, setRawOrders] = useState([]);
    const [rawDrivers, setRawDrivers] = useState([]);
    
    const [me, setMe] = useState(null);

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
    
    const [statFilterType, setStatFilterType] = useState('month');
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

    // STATE CHO BẢN ĐỒ HÀNH TRÌNH TÀI XẾ
    const [driverMapModal, setDriverMapModal] = useState(null);
    const [driverRealRoutes, setDriverRealRoutes] = useState({});
    const [driverEmptyRoutes, setDriverEmptyRoutes] = useState({});
    const [driverToFirstRoute, setDriverToFirstRoute] = useState([]); 
    const [liveDriverLocations, setLiveDriverLocations] = useState({});

    // STATE CHO TAB 3 - ĐÁNH GIÁ LỊCH SỬ
    const [evalDate, setEvalDate] = useState(() => {
        const d = new Date();
        d.setDate(d.getDate() - 1);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    });
    const [evalResults, setEvalResults] = useState(null);
    const [isEvaluating, setIsEvaluating] = useState(false);

    useEffect(() => {
        const fetchInitData = async () => {
            try {
                const meRes = await api.get('/users/me');
                setMe(meRes.data);
            } catch (error) { console.error("Không lấy được thông tin User", error); }
            fetchOrders();
            fetchDrivers();
        };

        fetchInitData();

        const savedResults = localStorage.getItem("algoResults");
        const savedSample = localStorage.getItem("algoSample");
        const savedParams = localStorage.getItem("algoParams");
        
        if (savedResults) setAlgoResults(JSON.parse(savedResults));
        if (savedSample) setAlgoSample(JSON.parse(savedSample));
        if (savedParams) setAlgoParams(JSON.parse(savedParams));
    }, []);

    const fetchOrders = async () => { try { const res = await api.get("/orders"); setRawOrders(res.data); } catch (e) { console.error(e); } };
    
    const fetchDrivers = async () => { 
        try { 
            const res = await api.get("/users/drivers"); 
            setRawDrivers(res.data); 
        } catch (e) { 
            try { 
                const r2 = await api.get("/users?role=driver"); 
                setRawDrivers(r2.data); 
            } catch(err){} 
        } 
    };

    const orders = useMemo(() => {
        if (me?.managedAreas && me.managedAreas.length > 0) {
            return rawOrders.filter(o => me.managedAreas.includes(o.region_id));
        }
        return rawOrders;
    }, [rawOrders, me]);

    const drivers = useMemo(() => {
        if (me?.managedAreas && me.managedAreas.length > 0) {
            return rawDrivers.filter(d => me.managedAreas.includes(d.region_id));
        }
        return rawDrivers;
    }, [rawDrivers, me]);

    const handleEvaluateHistorical = async () => {
        setIsEvaluating(true);
        try {
            const targetOrders = orders.filter(o => {
                if (!o.driverId) return false;
                const assignDate = new Date(o.updatedAt || o.createdAt);
                const dateStr = `${assignDate.getFullYear()}-${String(assignDate.getMonth() + 1).padStart(2, '0')}-${String(assignDate.getDate()).padStart(2, '0')}`;
                return dateStr === evalDate;
            });

            if (targetOrders.length === 0) {
                alert("Không có đơn hàng nào được điều phối hoàn tất trong ngày này!");
                setIsEvaluating(false);
                return;
            }

            const optimizedOrders = targetOrders.map(o => ({
                _id: o._id,
                pickupCoords: o.pickupCoords || o.pickup,
                dropoffCoords: o.dropoffCoords || o.deliveryCoords || o.dropoff,
                price: o.price || o.cost || 0,
                driverId: o.driverId?._id || o.driverId
            }));

            const optimizedDrivers = drivers.filter(d => d.status !== 'locked').map(d => ({
                _id: d._id,
                pickupCoords: d.pickupCoords,
                warehouse: d.warehouse
            }));

            const res = await api.post("/algo/evaluate-real-data", {
                date: evalDate,
                orders: optimizedOrders, 
                drivers: optimizedDrivers 
            });

            setEvalResults(res.data.comparison);
        } catch (e) {
            console.error(e);
            alert("Lỗi khi chạy đánh giá đối chiếu! Đảm bảo backend đã cập nhật.");
        } finally {
            setIsEvaluating(false);
        }
    };

    useEffect(() => {
        const handleDriverLocation = (data) => {
            const locObj = data.location || data; 
            const validLoc = normalizePoint(locObj);
            if (!validLoc) return;

            const incomingOrderId = data.orderId || data.id;
            let dId = data.driverId?._id || data.driverId || data.userId;

            if (!dId && driverMapModal) {
                const isBelongToDriver = driverMapModal.orders.some(o => o._id === incomingOrderId);
                if (isBelongToDriver) dId = driverMapModal.driver._id;
            }

            if (dId) {
                setLiveDriverLocations(prev => ({ ...prev, [dId]: validLoc }));
            }

            if (selectedOrder && (incomingOrderId === selectedOrder._id || data.order?._id === selectedOrder._id)) {
                setDriverLocation(validLoc);
                setSignalStatus(`📍 Xe tại: ${validLoc[0].toFixed(4)}, ${validLoc[1].toFixed(4)}`);
            }
        };

        const handleOrderUpdated = (updatedOrder) => {
            setRawOrders(prev => prev.map(o => o._id === updatedOrder._id ? updatedOrder : o));
            if (selectedOrder && selectedOrder._id === updatedOrder._id) {
                setSelectedOrder(updatedOrder);
                if(updatedOrder.status === 'completed') setDriverLocation(null);
            }
            if (driverMapModal) {
                setDriverMapModal(prev => {
                    const newOrders = prev.orders.map(o => o._id === updatedOrder._id ? updatedOrder : o);
                    return { ...prev, orders: newOrders };
                });
            }
        }
        const handleNewOrder = (newOrder) => { setRawOrders(prev => [newOrder, ...prev]); }

        socket.on("driverLocationUpdate", handleDriverLocation);
        socket.on("orderUpdated", handleOrderUpdated);
        socket.on("orderCreated", handleNewOrder);
        
        return () => { 
            socket.off("driverLocationUpdate", handleDriverLocation); 
            socket.off("orderUpdated", handleOrderUpdated); 
            socket.off("orderCreated", handleNewOrder);
        };
    }, [selectedOrder, driverMapModal]); 

    useEffect(() => {
        if (!driverMapModal) {
            setDriverRealRoutes({});
            setDriverEmptyRoutes({});
            setDriverToFirstRoute([]);
            return;
        }

        const fetchRoutesForMap = async () => {
            const orsKey = import.meta.env.VITE_ORS_API_KEY;
            if (!orsKey) return; 

            const sortedOrders = [...driverMapModal.orders].sort((a, b) => {
                const weight = { 'completed': 1, 'delivering': 2, 'assigned': 3, 'confirmed': 4, 'pending': 5 };
                const wA = weight[a.status] || 99;
                const wB = weight[b.status] || 99;
                if (wA !== wB) return wA - wB;
                return new Date(a.pickupTime || a.createdAt) - new Date(b.pickupTime || b.createdAt);
            });
            
            const newRoutes = {};
            const newEmptyRoutes = {};
            const promises = [];

            const firstActiveOrder = sortedOrders.find(o => o.status !== 'completed');
            if (firstActiveOrder) {
                const pFirst = getPoint(firstActiveOrder, 'pickup');
                const driverLoc = liveDriverLocations[driverMapModal.driver._id] || getSafeCoords(driverMapModal.driver);
                if (pFirst && driverLoc) {
                    promises.push(
                        axios.get(`https://api.openrouteservice.org/v2/directions/driving-car?api_key=${orsKey}&start=${driverLoc.lng},${driverLoc.lat}&end=${pFirst[1]},${pFirst[0]}`)
                        .then(res => {
                            const raw = res.data?.features?.[0]?.geometry?.coordinates || [];
                            if (raw.length > 0) setDriverToFirstRoute(raw.map(c => [c[1], c[0]]));
                        }).catch(e => { console.warn("Lỗi vẽ đường tới điểm lấy", e); })
                    );
                }
            }

            sortedOrders.forEach((order, idx) => {
                const p = getPoint(order, 'pickup');
                const d = getPoint(order, 'dropoff');
                
                if (p && d) {
                    promises.push(
                        axios.get(`https://api.openrouteservice.org/v2/directions/driving-car?api_key=${orsKey}&start=${p[1]},${p[0]}&end=${d[1]},${d[0]}`)
                        .then(res => {
                            const raw = res.data?.features?.[0]?.geometry?.coordinates || [];
                            if (raw.length > 0) newRoutes[order._id] = raw.map(c => [c[1], c[0]]);
                        }).catch(e => { console.warn("Lỗi vẽ đường ORS", e); })
                    );
                }

                const nextOrder = sortedOrders[idx + 1];
                if (nextOrder) {
                    const nextP = getPoint(nextOrder, 'pickup');
                    if (d && nextP) {
                        promises.push(
                            axios.get(`https://api.openrouteservice.org/v2/directions/driving-car?api_key=${orsKey}&start=${d[1]},${d[0]}&end=${nextP[1]},${nextP[0]}`)
                            .then(res => {
                                const raw = res.data?.features?.[0]?.geometry?.coordinates || [];
                                if (raw.length > 0) newEmptyRoutes[`${order._id}-${nextOrder._id}`] = raw.map(c => [c[1], c[0]]);
                            }).catch(e => {})
                        );
                    }
                }
            });

            await Promise.allSettled(promises);
            setDriverRealRoutes(newRoutes);
            setDriverEmptyRoutes(newEmptyRoutes);
        };
        fetchRoutesForMap();
    }, [driverMapModal?.driver?._id, driverMapModal?.orders.map(o => o.status).join(',')]); 

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
        
        const strategyName = strategy === 'proximity' ? 'Ưu tiên vị trí gần' : 
                             strategy === 'revenue' ? 'Cân bằng doanh thu' : 
                             'Tối Ưu AI (Ultimate VRP)';
                             
        if (!window.confirm(`Gán tự động ${validOrdersCount} đơn hàng theo chiến thuật: ${strategyName}?`)) return;
        
        setIsAutoAssigning(true);
        try {
            const res = await api.post("/orders/auto-assign-batch", { strategy });
            alert(`✅ ${res.data.message}`); fetchOrders();
        } catch (error) { alert("⚠️ Lỗi gán tự động"); } 
        finally { setIsAutoAssigning(false); }
    };

    // ===============================================
    // CẬP NHẬT LOGIC AI TÍNH DOANH THU/ĐƠN TRONG NGÀY
    // ===============================================
    const openAssignPreview = (order) => {
        if (!order.pickupCoords || !order.pickupCoords.lat) return alert("Đơn hàng này chưa có tọa độ lấy hàng chuẩn. Không thể phân tích!");
        
        const today = new Date();
        const startOfDay = new Date(today.setHours(0,0,0,0));
        const endOfDay = new Date(today.setHours(23,59,59,999));

        let availableDrivers = drivers.filter(d => d.status !== 'locked').map(d => {
            const safeLoc = getSafeCoords(d);
            const distance = getDistance(order.pickupCoords.lat, order.pickupCoords.lng, safeLoc.lat, safeLoc.lng);
            
            // Tính số đơn và doanh thu TRONG NGÀY (Bao gồm cả đơn đã giao xong)
            const todayOrders = orders.filter(o => {
                const isMatching = (o.driverId?._id === d._id || o.driverId === d._id);
                if (!isMatching) return false;
                const dDate = new Date(o.updatedAt || o.createdAt);
                return dDate >= startOfDay && dDate <= endOfDay && o.status !== 'cancelled';
            });

            const activeOrders = todayOrders.length; 
            const currentRevenue = todayOrders.reduce((sum, o) => sum + (o.price || o.cost || 0), 0);
            
            const fitnessScore = distance + (activeOrders * 3) + (currentRevenue / 50000);
            return { ...d, calculatedDistance: distance, activeOrders, currentRevenue, fitnessScore, dLat: safeLoc.lat, dLng: safeLoc.lng };
        });
        
        if (availableDrivers.length === 0) return alert("Không có tài xế nào đang online!");

        const bestDistance = [...availableDrivers].sort((a, b) => a.calculatedDistance - b.calculatedDistance)[0];
        const bestRevenue = [...availableDrivers].sort((a, b) => { 
            if (a.activeOrders !== b.activeOrders) return a.activeOrders - b.activeOrders; 
            return a.currentRevenue - b.currentRevenue; 
        })[0];
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

    // Hàm gọi Modal Bản đồ cho Tài xế - Tính đơn trong ngày
    const handleOpenDriverMap = (driver) => {
        const today = new Date();
        const startOfDay = new Date(today.setHours(0,0,0,0));
        const endOfDay = new Date(today.setHours(23,59,59,999));

        const dOrders = orders.filter(o => {
            const isMatchingDriver = (o.driverId === driver._id || o.driverId?._id === driver._id);
            if (!isMatchingDriver) return false;
            // Dựa vào thời điểm người điều phối phân công (updatedAt hoặc createdAt nếu chưa update)
            const assignDate = new Date(o.updatedAt || o.createdAt);
            return assignDate >= startOfDay && assignDate <= endOfDay && o.status !== 'cancelled';
        });

        const stats = {
            total: dOrders.length,
            remaining: dOrders.filter(o => ['pending', 'confirmed', 'assigned', 'delivering'].includes(o.status)).length,
            revenue: dOrders.reduce((acc, o) => acc + (o.price || o.cost || 0), 0)
        };

        setDriverMapModal({ driver, orders: dOrders, stats });
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

    const openOrderModal = (order) => { 
        setSelectedOrder(order); 
        setDriverLocation(null); 
        setSignalStatus("Đang chờ kết nối..."); 
        setSelectedDriverId(order.driverId ? (order.driverId._id || order.driverId) : ""); 
        
        const p1 = getPoint(order, 'pickup'); 
        const p2 = getPoint(order, 'dropoff'); 
        if (p1 && p2) computeRoute(p1, p2); else setRouteCoords([]); 
    };

    const resetFilters = () => { setFilterDate(''); setFilterCustomer(''); setFilterDriver(''); setFilterStatus('all'); }

    const ClickableStatBox = ({ label, value, color, icon, isActive, onClick }) => (
        <div onClick={onClick} className={`p-4 rounded-xl shadow-sm border cursor-pointer transition-all transform hover:scale-105 select-none ${isActive ? 'bg-indigo-50 border-indigo-500 ring-2 ring-indigo-200' : 'bg-white border-gray-100'}`}>
            <div className="flex items-center justify-between">
                <div><p className={`text-xs uppercase font-semibold ${isActive ? 'text-indigo-600' : 'text-gray-500'}`}>{label}</p><p className={`text-2xl font-bold ${isActive ? 'text-indigo-800' : 'text-gray-800'}`}>{value}</p></div>
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
                        <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2"><DashboardIcon /> Điều Phối Trung Tâm</h1>
                        <LogoutButton />
                    </div>
                    <div className="flex gap-6">
                        <button onClick={() => setActiveTab('orders')} className={`pb-2 px-1 font-semibold text-sm transition ${activeTab === 'orders' ? 'border-b-2 border-indigo-600 text-indigo-700' : 'text-gray-500 hover:text-gray-700'}`}>Quản lý Đơn hàng</button>
                        <button onClick={() => setActiveTab('drivers')} className={`pb-2 px-1 font-semibold text-sm transition ${activeTab === 'drivers' ? 'border-b-2 border-green-600 text-green-700' : 'text-gray-500 hover:text-gray-700'}`}>Quản lý Tài xế</button>
                        <button onClick={() => setActiveTab('algo-lab')} className={`pb-2 px-1 font-semibold text-sm transition ${activeTab === 'algo-lab' ? 'border-b-2 border-purple-600 text-purple-700' : 'text-gray-500 hover:text-gray-700'}`}>Mô phỏng Phân đơn</button>
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

                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex flex-wrap gap-4 items-end">
                            <div className="flex items-center gap-2 mb-1 w-full text-gray-700 font-semibold text-sm"><FilterAltIcon fontSize="small"/> Bộ lọc</div>
                            <div className="flex flex-col"><label className="text-[11px] font-semibold text-gray-500 mb-1">Ngày cần giao</label><input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:ring-1 focus:ring-indigo-400 outline-none w-40" /></div>
                            <div className="flex flex-col"><label className="text-[11px] font-semibold text-gray-500 mb-1">Khách hàng</label><input type="text" placeholder="Tên hoặc SĐT..." value={filterCustomer} onChange={(e) => setFilterCustomer(e.target.value)} className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:ring-1 focus:ring-indigo-400 outline-none w-48" /></div>
                            <div className="flex flex-col"><label className="text-[11px] font-semibold text-gray-500 mb-1">Tài xế nhận đơn</label>
                                <select value={filterDriver} onChange={(e) => setFilterDriver(e.target.value)} className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:ring-1 focus:ring-indigo-400 outline-none w-48">
                                    <option value="">-- Tất cả tài xế --</option>
                                    {drivers.map(d => <option key={d._id} value={d._id}>{d.name}</option>)}
                                </select>
                            </div>
                            <button onClick={resetFilters} className="px-4 py-1.5 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition">Xóa bộ lọc</button>
                        </div>

                        {/* THANH CÔNG CỤ (ACTION BAR) */}
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 mb-6">
                            <div className="flex flex-col xl:flex-row justify-between items-center gap-4">
                                {/* KHỐI TRÁI: GÁN THỦ CÔNG */}
                                <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
                                    <span className="font-medium text-gray-700 text-sm flex items-center gap-1">
                                        <PlaylistAddCheckIcon fontSize="small" className="text-indigo-600"/> {selectedOrderIds.length} đơn đã chọn
                                    </span>
                                    <select className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:ring-1 focus:ring-indigo-400 outline-none w-40 cursor-pointer" value={batchAssignDriverId} onChange={(e) => setBatchAssignDriverId(e.target.value)}>
                                        <option value="">-- Chọn tài xế --</option>
                                        {drivers.map(d => <option key={d._id} value={d._id}>{d.name}</option>)}
                                    </select>
                                    <button onClick={handleBatchManualAssign} disabled={selectedOrderIds.length === 0 || !batchAssignDriverId} className="bg-gray-800 hover:bg-gray-900 disabled:bg-gray-200 disabled:text-gray-400 text-white px-4 py-1.5 rounded-lg text-sm font-medium transition whitespace-nowrap">
                                        Gán tài xế
                                    </button>
                                    <button onClick={handleBatchDelete} disabled={selectedOrderIds.length === 0} className="bg-red-50 text-red-600 border border-red-200 hover:bg-red-600 hover:text-white disabled:border-transparent disabled:bg-gray-100 disabled:text-gray-400 px-4 py-1.5 rounded-lg text-sm font-medium transition whitespace-nowrap ml-auto md:ml-0">
                                        Xóa
                                    </button>
                                </div>

                                <div className="hidden xl:block w-px h-5 bg-gray-300"></div>

                                {/* KHỐI PHẢI: GÁN TỰ ĐỘNG AI */}
                                <div className="flex flex-wrap md:flex-nowrap gap-2 w-full xl:w-auto">
                                    <button onClick={() => handleBatchAutoAssign('proximity')} disabled={isAutoAssigning} className="flex-1 md:flex-none flex justify-center items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded-lg text-sm font-medium transition whitespace-nowrap">
                                        {isAutoAssigning ? <AccessTimeIcon fontSize="small" className="animate-spin"/> : <NearMeIcon fontSize="small"/>} Gán Vị Trí
                                    </button>
                                    <button onClick={() => handleBatchAutoAssign('revenue')} disabled={isAutoAssigning} className="flex-1 md:flex-none flex justify-center items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-1.5 rounded-lg text-sm font-medium transition whitespace-nowrap">
                                        {isAutoAssigning ? <AccessTimeIcon fontSize="small" className="animate-spin"/> : <AttachMoneyIcon fontSize="small"/>} Gán Doanh Thu
                                    </button>
                                    <button onClick={() => handleBatchAutoAssign('vrp')} disabled={isAutoAssigning} className="flex-1 md:flex-none flex justify-center items-center gap-1.5 bg-purple-600 hover:bg-purple-700 text-white px-4 py-1.5 rounded-lg text-sm font-medium transition whitespace-nowrap shadow-sm">
                                        {isAutoAssigning ? <AccessTimeIcon fontSize="small" className="animate-spin"/> : <AutoFixHighIcon fontSize="small"/>} Tối Ưu AI (VRP)
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                            <div className="flex items-center gap-2 p-4 border-b border-gray-100 bg-gray-50/50">
                                <h2 className="text-base font-bold text-gray-800">Danh sách đơn hàng</h2>
                                <span className="bg-gray-200 text-gray-700 text-xs font-semibold px-2 py-0.5 rounded-md">{filteredOrders.length}</span>
                            </div>
                            <div className="overflow-x-auto max-h-[600px] custom-scrollbar">
                                <table className="w-full text-sm text-left border-collapse">
                                    <thead className="bg-gray-50 text-gray-500 sticky top-0 z-10 border-b border-gray-200">
                                        <tr>
                                            <th className="p-3 text-center w-12"><input type="checkbox" className="w-4 h-4 cursor-pointer rounded" onChange={handleSelectAll} checked={assignableOrders.length > 0 && selectedOrderIds.length === assignableOrders.length} /></th>
                                            <th className="p-3 font-semibold text-xs">Mã Đơn / Khách</th>
                                            <th className="p-3 font-semibold text-xs min-w-[200px]">Tuyến Đường</th>
                                            <th className="p-3 font-semibold text-xs text-right">Phí (VNĐ)</th>
                                            <th className="p-3 text-center min-w-[140px]">
                                                <select 
                                                    className="bg-transparent font-semibold text-xs text-gray-600 cursor-pointer outline-none w-full text-center appearance-none"
                                                    value={filterStatus}
                                                    onChange={(e) => setFilterStatus(e.target.value)}
                                                >
                                                    <option value="all">Trạng thái ▾</option>
                                                    <option value="pending">Chờ xử lý / Chưa duyệt</option>
                                                    <option value="confirmed">Đã xác nhận</option>
                                                    <option value="assigned">Đã phân công</option>
                                                    <option value="delivering">Đang giao</option>
                                                    <option value="completed">Hoàn thành</option>
                                                    <option value="cancelled">Đã hủy</option>
                                                </select>
                                            </th>
                                            <th className="p-3 font-semibold text-xs">Tài Xế</th>
                                            <th className="p-3 font-semibold text-xs text-center min-w-[150px]">Thao tác</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {filteredOrders.length === 0 && (<tr><td colSpan="7" className="text-center py-10 text-gray-400 italic">Không tìm thấy đơn hàng nào.</td></tr>)}
                                        {filteredOrders.map((order) => (
                                        <tr key={order._id} className={`hover:bg-gray-50 transition ${selectedOrderIds.includes(order._id) ? 'bg-indigo-50/40' : ''}`}>
                                            <td className="p-3 text-center"><input type="checkbox" className="w-4 h-4 cursor-pointer rounded" checked={selectedOrderIds.includes(order._id)} onChange={() => handleSelectOrder(order._id)} /></td>
                                            <td className="p-3">
                                                <button onClick={() => openOrderModal(order)} className="font-mono font-medium text-indigo-600 hover:text-indigo-800 hover:underline block">#{order._id.slice(-6).toUpperCase()}</button>
                                                <div className="text-xs text-gray-600 mt-1">{order.customerId?.name || "Khách lẻ"}</div>
                                                <div className="text-[11px] text-gray-500 bg-gray-100 inline-block px-1.5 rounded mt-0.5">{order.weight} kg</div>
                                                {order.pickupTime && (<div className="mt-1 inline-block text-red-600 text-[11px] font-medium px-1.5 border border-red-200 rounded bg-red-50">{new Date(order.pickupTime).toLocaleString("vi-VN", { hour: '2-digit', minute:'2-digit', day: '2-digit', month: '2-digit' })}</div>)}
                                            </td>
                                            <td className="p-3"><div className="text-gray-800 truncate max-w-[250px] text-[13px]" title={order.pickupAddress}><span className="text-emerald-500 mr-1">●</span>{order.pickupAddress}</div><div className="text-gray-800 truncate max-w-[250px] text-[13px] mt-1.5" title={order.deliveryAddress}><span className="text-rose-500 mr-1">■</span>{order.deliveryAddress}</div></td>
                                            <td className="p-3 font-medium text-emerald-600 text-right">{(order.price || order.cost || 0).toLocaleString()} ₫</td>
                                            <td className="p-3 text-center">
                                                <StatusBadge status={order.status} />
                                                {order.cancelRequest && order.status !== 'cancelled' && (
                                                    <div className="text-[10px] bg-red-100 text-red-700 px-2 py-0.5 rounded mt-1 animate-pulse inline-block">Yêu cầu hủy</div>
                                                )}
                                                {order.status === 'cancelled' && order.cancelReason && (
                                                    <div className="text-[11px] text-red-500 mt-1 truncate w-24 mx-auto" title={order.cancelReason}>Lý do: {order.cancelReason}</div>
                                                )}
                                                {order.failedReason && order.status !== 'cancelled' && (
                                                    <div className="text-[11px] text-orange-600 mt-1 truncate w-24 mx-auto" title={order.failedReason}>⚠️ {order.failedReason}</div>
                                                )}
                                            </td>
                                            <td className="p-3 text-gray-800 text-[13px]">
                                                {order.driverId ? (
                                                    <span className="flex items-center gap-1 font-medium">
                                                        <span className="w-1.5 h-1.5 bg-blue-500 rounded-full inline-block"></span>
                                                        {order.driverId.name || "Đã gán"}
                                                    </span>
                                                ) : (
                                                    <span className="text-gray-400 italic">Chưa gán</span>
                                                )}
                                            </td>
                                            <td className="p-3">
                                                <div className="flex gap-1.5 items-center justify-center">
                                                    {order.cancelRequest && order.status !== 'cancelled' ? (
                                                        <button onClick={() => handleApproveCancel(order._id)} className="text-xs bg-red-600 text-white px-3 py-1.5 rounded-lg font-medium hover:bg-red-700 transition">Duyệt Hủy</button>
                                                    ) : (
                                                        <>
                                                            {(order.status === 'pending' || order.status === 'unconfirmed') && (<button onClick={() => handleUpdateStatus(order._id, 'confirmed')} title="Xác nhận đơn" className="p-1.5 text-emerald-600 bg-emerald-50 hover:bg-emerald-100 rounded-md transition"><CheckCircleOutlineIcon fontSize="small"/></button>)}
                                                            {(order.status === 'pending' || order.status === 'unconfirmed') && (<button onClick={() => openCancelModal(order._id)} title="Từ chối đơn" className="p-1.5 text-rose-500 bg-rose-50 hover:bg-rose-100 rounded-md transition"><HighlightOffIcon fontSize="small"/></button>)}
                                                            
                                                            {['pending', 'confirmed'].includes(order.status) && (
                                                                <button onClick={() => openAssignPreview(order)} title="Gán tài xế AI" className="p-1.5 text-purple-600 bg-purple-50 hover:bg-purple-100 rounded-md transition flex items-center gap-1">
                                                                    <PersonAddIcon fontSize="small"/>
                                                                </button>
                                                            )}

                                                            {(order.status === 'assigned') && (<button onClick={() => handleAssignDriver(order._id, null)} title="Hủy gán" className="p-1.5 text-orange-500 bg-orange-50 hover:bg-orange-100 rounded-md transition"><PersonRemoveIcon fontSize="small"/></button>)}
                                                            
                                                            {order.status !== 'cancelled' && (<button onClick={() => openOrderModal(order)} className="text-xs bg-indigo-50 text-indigo-600 px-2 py-1.5 rounded-md font-medium hover:bg-indigo-100 transition shadow-sm">Bản đồ</button>)}
                                                        </>
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
                        
                        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex flex-col sm:flex-row gap-4 justify-between items-center">
                            <h2 className="text-base font-bold text-gray-800 flex items-center gap-2"><LocalShippingIcon className="text-green-600"/> Danh sách Tài xế ({filteredDrivers.length})</h2>
                            <div className="relative w-full sm:w-80">
                                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400"><FilterAltIcon fontSize="small"/></span>
                                <input type="text" placeholder="Tìm tên, SĐT..." className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-1 focus:ring-green-400 outline-none text-sm" value={driverSearch} onChange={(e) => setDriverSearch(e.target.value)} />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {filteredDrivers.length === 0 && <div className="col-span-3 p-6 text-center text-sm text-gray-500 italic">Không tìm thấy tài xế.</div>}
                            {filteredDrivers.map(d => {
                                // LOGIC TÍNH TOÁN TRONG NGÀY HÔM NAY (TODAY)
                                const today = new Date();
                                const startOfDay = new Date(today.setHours(0,0,0,0));
                                const endOfDay = new Date(today.setHours(23,59,59,999));
                                
                                const todayOrders = orders.filter(o => {
                                    const isMatching = (o.driverId === d._id || o.driverId?._id === d._id);
                                    const isCompleted = o.status === 'completed';
                                    const date = new Date(o.completedAt || o.updatedAt || o.createdAt);
                                    return isMatching && isCompleted && date >= startOfDay && date <= endOfDay;
                                });

                                const todayRevenue = todayOrders.reduce((sum, o) => sum + (o.price || o.cost || 0), 0);
                                let todayKm = 0;
                                todayOrders.forEach(o => {
                                    const p = getPoint(o, 'pickup');
                                    const drop = getPoint(o, 'dropoff');
                                    if(p && drop) todayKm += getDistance(p[0], p[1], drop[0], drop[1]) * 1.3; // Nhân 1.3 mô phỏng sai số đường bộ
                                });

                                return (
                                    <div key={d._id} className="bg-white p-4 rounded-xl border border-gray-200 hover:border-green-300 shadow-sm transition flex flex-col justify-between h-full relative">
                                        <div className="absolute top-4 right-4">
                                            <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${d.status === 'locked' ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'}`}>
                                                {d.status === 'locked' ? 'Đang khóa' : 'Hoạt động'}
                                            </span>
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-3 mb-4">
                                                <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center text-lg">🛵</div>
                                                <div>
                                                    <p className="font-semibold text-gray-800 text-sm">{d.name}</p>
                                                    <p className="text-xs text-gray-500 font-mono mt-0.5">{d.phone}</p>
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-2 text-xs text-gray-600 mb-4">
                                                <div className="bg-gray-50 p-2 rounded-lg border border-gray-100">KM hôm nay: <strong className="text-gray-800 block mt-0.5">{todayKm.toFixed(1)} km</strong></div>
                                                <div className="bg-gray-50 p-2 rounded-lg border border-gray-100">Thu hôm nay: <strong className="text-emerald-600 block mt-0.5">{todayRevenue.toLocaleString()} đ</strong></div>
                                            </div>
                                        </div>
                                        
                                        <button onClick={() => handleOpenDriverMap(d)} className="w-full bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white py-2 rounded-lg text-xs font-medium transition flex items-center justify-center gap-1.5">
                                            <RouteIcon fontSize="small"/> Lộ trình hôm nay
                                        </button>
                                    </div>
                                );
                            })}
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-4">
                            <div className="lg:col-span-1 bg-white p-5 rounded-xl shadow-sm border border-gray-200 h-[400px] flex flex-col">
                                <div className="flex flex-col gap-3 mb-4">
                                    <h2 className="text-base font-bold text-gray-800">Xếp hạng Doanh thu</h2>
                                    <div className="flex gap-2">
                                        <select value={statFilterType} onChange={handleStatFilterChange} className="bg-gray-50 border border-gray-200 text-gray-700 rounded-lg px-2 py-1.5 text-xs focus:ring-1 focus:ring-indigo-400 outline-none flex-1">
                                            <option value="all">Tất cả</option>
                                            <option value="year">Theo Năm</option>
                                            <option value="month">Theo Tháng</option>
                                            <option value="day">Theo Ngày</option>
                                        </select>
                                        {statFilterType === 'day' && <input type="date" value={statFilterValue} onChange={(e) => setStatFilterValue(e.target.value)} className="bg-gray-50 border border-gray-200 text-gray-700 rounded-lg px-2 py-1.5 text-xs w-32 outline-none" />}
                                        {statFilterType === 'month' && <input type="month" value={statFilterValue} onChange={(e) => setStatFilterValue(e.target.value)} className="bg-gray-50 border border-gray-200 text-gray-700 rounded-lg px-2 py-1.5 text-xs w-28 outline-none" />}
                                        {statFilterType === 'year' && <input type="number" min="2020" max="2100" value={statFilterValue} onChange={(e) => setStatFilterValue(e.target.value)} className="bg-gray-50 border border-gray-200 text-gray-700 rounded-lg px-2 py-1.5 text-xs w-20 outline-none" placeholder="Năm..." />}
                                    </div>
                                </div>

                                <div className="overflow-y-auto flex-1 custom-scrollbar pr-1">
                                    <table className="w-full text-sm text-left">
                                        <thead className="text-[11px] text-gray-500 bg-white sticky top-0 border-b border-gray-100">
                                            <tr><th className="py-2 font-medium">Tài xế</th><th className="py-2 text-center font-medium">Đơn</th><th className="py-2 text-right font-medium">Tổng thu</th></tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-50">
                                            {driverStats.length === 0 && <tr><td colSpan="3" className="text-center py-5 text-gray-400 text-xs italic">Không có dữ liệu.</td></tr>}
                                            {driverStats.map((d, i) => (
                                            <tr key={i} className="hover:bg-gray-50">
                                                <td className="py-2.5 font-medium text-gray-800 text-xs flex items-center gap-1.5">
                                                    {i === 0 && <span className="text-amber-500">🏆</span>}
                                                    {i > 0 && <span className="text-gray-400 text-[10px]">#{i+1}</span>}
                                                    {d.name}
                                                </td>
                                                <td className="py-2.5 text-center text-gray-600 text-xs">{d.orders}</td>
                                                <td className="py-2.5 text-right font-medium text-emerald-600 text-xs">{d.revenue.toLocaleString()} ₫</td>
                                            </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            <div className="lg:col-span-2 bg-white p-5 rounded-xl shadow-sm border border-gray-200 h-[400px] flex flex-col">
                                <h2 className="text-base font-bold text-gray-800 mb-4">Biểu đồ Hiệu suất (Top 15)</h2>
                                <div className="flex-1 w-full min-h-0">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={driverStats.slice(0, 15)} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                                            <XAxis dataKey="name" tick={{fontSize: 11, fill: '#6b7280'}} interval={0} angle={-30} textAnchor="end" />
                                            <YAxis tick={{fontSize: 11, fill: '#6b7280'}} tickFormatter={(val) => (val/1000) + 'k'} />
                                            <Tooltip formatter={(value) => [value.toLocaleString() + " ₫", "Doanh thu"]} cursor={{fill: '#f9fafb'}} contentStyle={{borderRadius: '8px', fontSize: '12px'}} />
                                            <Bar dataKey="revenue" name="Doanh thu" fill="#6366f1" radius={[4, 4, 0, 0]} maxBarSize={40} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </div>

                    </div>
                )}

                {/* =======================================================
                    TAB 3: ALGO LAB (PHÒNG THÍ NGHIỆM THUẬT TOÁN)
                ======================================================= */}
                {activeTab === 'algo-lab' && (
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 min-h-[600px] animate-fadeIn">
                        <div className="flex items-center gap-3 border-b border-gray-100 pb-4 mb-6">
                            <AutoFixHighIcon className="text-indigo-600" />
                            <div>
                                <h2 className="text-xl font-bold text-gray-800">Đánh Giá Thuật Toán AI</h2>
                                <p className="text-sm text-gray-500 mt-0.5">So sánh hiệu năng điều phối thực tế và chạy giả lập thuật toán phân đơn.</p>
                            </div>
                        </div>

                        {/* 🔴 KHU VỰC 1: ĐÁNH GIÁ DỮ LIỆU THẬT */}
                        <div className="bg-white border border-gray-200 p-5 rounded-xl mb-8">
                            <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                                <CheckCircleOutlineIcon fontSize="small" className="text-indigo-600"/> Lịch sử Điều phối vs Thuật toán (Real Data)
                            </h3>
                            
                            <div className="flex flex-col sm:flex-row items-end gap-4 mb-5">
                                <div className="w-full sm:w-auto">
                                    <label className="block text-xs font-medium text-gray-600 mb-1">Chọn ngày gán đơn</label>
                                    <input type="date" value={evalDate} onChange={(e) => setEvalDate(e.target.value)} className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 outline-none focus:ring-1 focus:ring-indigo-400 w-full sm:w-48" />
                                </div>
                                <button onClick={handleEvaluateHistorical} disabled={isEvaluating} className="w-full sm:w-auto px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white font-medium text-sm rounded-lg transition flex items-center justify-center gap-2">
                                    {isEvaluating ? <AccessTimeIcon className="animate-spin" fontSize="small"/> : <BarChartIcon fontSize="small"/>} 
                                    {isEvaluating ? 'Đang phân tích...' : 'Chạy Đánh Giá'}
                                </button>
                            </div>

                            {evalResults && (
                                <div className="border border-gray-200 rounded-lg overflow-hidden animate-fadeIn">
                                    <table className="w-full text-left text-sm">
                                        <thead className="bg-gray-50 text-gray-600 text-xs border-b border-gray-200">
                                            <tr>
                                                <th className="p-3 font-medium">Phương Pháp</th>
                                                <th className="p-3 text-right font-medium">Tổng Quãng Đường</th>
                                                <th className="p-3 text-right font-medium">Độ lệch chuẩn (Cân bằng tải)</th>
                                                <th className="p-3 text-right font-medium">Thời gian tính toán</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {evalResults.map((res, idx) => (
                                                <tr key={idx} className={res.isHuman ? "bg-amber-50/30" : (res.name.includes("Local Search") || res.name.includes("VRP") ? "bg-indigo-50/30" : "bg-white")}>
                                                    <td className="p-3 font-medium text-gray-800 flex items-center gap-2">
                                                        {res.isHuman ? '🧑‍💻' : '🤖'} {res.name}
                                                        {res.isBestDistance && <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded ml-2">Tối ưu nhất</span>}
                                                    </td>
                                                    <td className="p-3 text-right font-mono text-gray-700">
                                                        {res.distance.toFixed(2)} <span className="text-xs text-gray-400">km</span>
                                                    </td>
                                                    <td className="p-3 text-right font-mono text-gray-700">{res.variance.toFixed(2)}</td>
                                                    <td className="p-3 text-right font-mono text-gray-500 text-xs">{res.time}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>

                        {/* 🔴 KHU VỰC 2: MÔ PHỎNG DỮ LIỆU NGẪU NHIÊN */}
                        <div className="bg-white border border-gray-200 p-5 rounded-xl">
                            <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                                <NearMeIcon fontSize="small" className="text-gray-500" /> Mô phỏng trên Data ngẫu nhiên (Virtual)
                            </h3>
                            
                            <div className="flex flex-col md:flex-row gap-6 mb-6 items-end">
                                <div className="flex-1">
                                    <div className="flex justify-between mb-1">
                                        <label className="text-xs font-medium text-gray-600">Số lượng Đơn: <strong className="text-indigo-600">{algoParams.numOrders}</strong></label>
                                    </div>
                                    <input type="range" min="200" max="500" step="50" value={algoParams.numOrders} onChange={(e) => setAlgoParams({...algoParams, numOrders: parseInt(e.target.value)})} className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600" />
                                </div>
                                <div className="flex-1">
                                    <label className="block text-xs font-medium text-gray-600 mb-2">Số lượng Tài xế</label>
                                    <div className="flex gap-2">
                                        {[20, 30, 50].map(num => (
                                            <button key={num} onClick={() => setAlgoParams({...algoParams, numDrivers: num})} className={`flex-1 py-1.5 text-xs font-medium rounded-md border transition ${algoParams.numDrivers === num ? 'bg-indigo-50 border-indigo-500 text-indigo-700' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}>{num} Xe</button>
                                        ))}
                                    </div>
                                </div>
                                <button onClick={runSimulation} disabled={isSimulating} className="w-full md:w-auto px-6 py-2 bg-gray-800 hover:bg-gray-900 disabled:bg-gray-300 text-white font-medium text-sm rounded-lg transition flex items-center justify-center gap-2 whitespace-nowrap">
                                    {isSimulating ? <AccessTimeIcon className="animate-spin" fontSize="small"/> : '🚀'} 
                                    {isSimulating ? 'Đang giả lập...' : 'Chạy Mô Phỏng'}
                                </button>
                            </div>

                            {algoResults && (
                                <div className="animate-fadeIn">
                                    <div className="border border-gray-200 rounded-lg overflow-hidden mb-4">
                                        <table className="w-full text-left text-sm">
                                            <thead className="bg-gray-50 text-gray-600 text-xs border-b border-gray-200">
                                                <tr>
                                                    <th className="p-3 font-medium">Tên Thuật Toán</th>
                                                    <th className="p-3 text-right font-medium">Tổng Quãng Đường</th>
                                                    <th className="p-3 text-right font-medium">Độ lệch chuẩn</th>
                                                    <th className="p-3 text-right font-medium">Thời gian</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100">
                                                {algoResults.map((res) => (
                                                    <tr key={res.id} className={res.name.includes("Local Search") ? "bg-indigo-50/30" : ""}>
                                                        <td className="p-3 font-medium text-gray-800 flex items-center gap-2">
                                                            {res.name}
                                                            {res.name.includes("Local Search") && <span className="text-[10px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded">Tối ưu</span>}
                                                        </td>
                                                        <td className="p-3 text-right font-mono text-gray-700">{res.distance} <span className="text-xs text-gray-400">km</span></td>
                                                        <td className="p-3 text-right font-mono text-gray-700">{res.variance}</td>
                                                        <td className="p-3 text-right font-mono text-gray-500 text-xs">{res.time} ms</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>

                                    {algoSample && algoSample.drivers && algoSample.orders && (
                                        <div className="border border-gray-200 rounded-lg overflow-hidden">
                                            <div className="bg-gray-50 p-3 border-b border-gray-200 flex justify-between items-center">
                                                <h3 className="text-sm font-medium text-gray-700 flex items-center gap-2">
                                                    <MapIcon fontSize="small"/> Bản đồ dữ liệu ảo (Lần chạy cuối)
                                                </h3>
                                                <div className="flex gap-3 text-xs text-gray-600">
                                                    <span>🛵 {algoSample.drivers.length} xe</span>
                                                    <span>📦 {algoSample.orders.length} đơn</span>
                                                </div>
                                            </div>
                                            <div className="h-[350px] w-full">
                                                <MapContainer center={[21.0285, 105.8542]} zoom={13} style={{ height: "100%", width: "100%" }}>
                                                    <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                                                    {algoSample.orders.map((o, idx) => (
                                                        <CircleMarker key={`o-${idx}`} center={[o.pickup.lat, o.pickup.lng]} radius={4} pathOptions={{ color: '#ffffff', weight: 1, fillColor: '#ef4444', fillOpacity: 0.8 }}>
                                                            <Popup className="text-xs text-red-600">Đơn {o.id}</Popup>
                                                        </CircleMarker>
                                                    ))}
                                                    {algoSample.drivers.map((d, idx) => (
                                                        <CircleMarker key={`d-${idx}`} center={[d.loc.lat, d.loc.lng]} radius={6} pathOptions={{ color: '#ffffff', weight: 1.5, fillColor: '#3b82f6', fillOpacity: 1 }}>
                                                            <Popup className="text-xs text-blue-600">Xe {d.id}</Popup>
                                                        </CircleMarker>
                                                    ))}
                                                </MapContainer>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* =======================================================
                CÁC MODAL DIALOGS
            ======================================================= */}
            
            {/* Modal Hủy Đơn */}
            {cancelModal.isOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 animate-fadeIn">
                    <div className="bg-white p-6 rounded-xl w-full max-w-md shadow-xl border border-gray-100">
                        <h3 className="text-lg font-bold text-gray-800 mb-2">Hủy / Từ chối đơn</h3>
                        <p className="text-sm text-gray-500 mb-4">Vui lòng cung cấp lý do để lưu vết hệ thống.</p>
                        <textarea className="w-full bg-gray-50 border border-gray-200 rounded-lg p-3 outline-none focus:ring-1 focus:ring-red-400 text-sm" rows="3" placeholder="Lý do hủy..." value={cancelModal.reason} onChange={(e) => setCancelModal({...cancelModal, reason: e.target.value})}></textarea>
                        <div className="flex justify-end gap-2 mt-4">
                            <button onClick={() => setCancelModal({ isOpen: false, orderId: null, reason: "" })} className="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-200 transition">Đóng</button>
                            <button onClick={() => handleUpdateStatus(cancelModal.orderId, 'cancelled', cancelModal.reason)} disabled={!cancelModal.reason.trim()} className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:bg-red-300 transition">Xác nhận Hủy</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal AI Gán Đơn Lẻ (Tách riêng khỏi nút Chi tiết) */}
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
                                        <Popup><b className="text-blue-600">🛵 {d.name}</b><br/>Cách: {d.calculatedDistance.toFixed(1)}km | Đơn hôm nay: {d.activeOrders} đơn</Popup>
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
                                <h3 className="font-black text-xl text-gray-800 flex items-center gap-2"><AutoFixHighIcon className="text-purple-600"/> Đề Xuất</h3>
                                <p className="text-xs text-gray-500 mt-2 font-medium leading-relaxed">Hệ thống đã phân tích và tìm ra 3 ứng cử viên xuất sắc nhất dựa trên các thuật toán tối ưu.</p>
                            </div>
                            
                            <div className="flex-1 overflow-y-auto p-5 space-y-4 custom-scrollbar">
                                
                                {/* 1. TỐI ƯU */}
                                <div className="bg-purple-50/50 border border-purple-200 p-4 rounded-xl shadow-sm relative flex items-center justify-between group hover:shadow-md transition">
                                    <div>
                                        <div className="inline-block bg-purple-600 text-white text-[9px] font-bold px-2 py-0.5 rounded mb-1.5 uppercase tracking-wider shadow-sm">Khuyên dùng</div>
                                        <h4 className="font-bold text-purple-800 text-xs mb-1">🌟 Tối Ưu (Local Search)</h4>
                                        <p className="font-black text-gray-900 text-sm mb-1">{assignModalData.suggestions.balanced.name}</p>
                                        <p className="text-[10px] text-gray-600 font-medium">Cách: <strong className="text-purple-700">{assignModalData.suggestions.balanced.calculatedDistance.toFixed(1)}km</strong> | Đơn h.nay: <strong className="text-purple-700">{assignModalData.suggestions.balanced.activeOrders}</strong></p>
                                    </div>
                                    <button onClick={() => confirmManualAssign(assignModalData.suggestions.balanced._id)} className="w-10 h-10 shrink-0 flex items-center justify-center bg-purple-600 hover:bg-purple-700 text-white rounded-full text-xl font-bold transition shadow-sm pb-0.5">+</button>
                                </div>

                                {/* 2. GẦN NHẤT */}
                                <div className="bg-white border border-blue-100 p-4 rounded-xl shadow-sm flex items-center justify-between group hover:shadow-md transition hover:border-blue-200">
                                    <div>
                                        <h4 className="font-bold text-blue-600 text-xs mb-1">📍 Gán Gần Nhất (Greedy)</h4>
                                        <p className="font-black text-gray-900 text-sm mb-1">{assignModalData.suggestions.distance.name}</p>
                                        <p className="text-[10px] text-gray-500 font-medium">Cách: <strong className="text-blue-600">{assignModalData.suggestions.distance.calculatedDistance.toFixed(1)}km</strong></p>
                                    </div>
                                    <button onClick={() => confirmManualAssign(assignModalData.suggestions.distance._id)} className="w-9 h-9 shrink-0 flex items-center justify-center bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white border border-blue-100 rounded-full text-lg font-bold transition shadow-sm pb-0.5">+</button>
                                </div>

                                {/* 3. ÍT VIỆC NHẤT */}
                                <div className="bg-white border border-emerald-100 p-4 rounded-xl shadow-sm flex items-center justify-between group hover:shadow-md transition hover:border-emerald-200">
                                    <div>
                                        <h4 className="font-bold text-emerald-600 text-xs mb-1">⚖️ Cân Bằng (Round-Robin)</h4>
                                        <p className="font-black text-gray-900 text-sm mb-1">{assignModalData.suggestions.revenue.name}</p>
                                        <p className="text-[10px] text-gray-500 font-medium">Đơn h.nay: <strong className="text-emerald-600">{assignModalData.suggestions.revenue.activeOrders} đơn</strong></p>
                                    </div>
                                    <button onClick={() => confirmManualAssign(assignModalData.suggestions.revenue._id)} className="w-9 h-9 shrink-0 flex items-center justify-center bg-emerald-50 text-emerald-600 hover:bg-emerald-500 hover:text-white border border-emerald-100 rounded-full text-lg font-bold transition shadow-sm pb-0.5">+</button>
                                </div>

                                <div>
                                    <div className="flex items-center gap-3 mb-4 mt-2">
                                        <div className="h-px bg-gray-200 flex-1"></div>
                                        <h4 className="font-black text-gray-400 text-[10px] uppercase tracking-widest">Danh sách tất cả</h4>
                                        <div className="h-px bg-gray-200 flex-1"></div>
                                    </div>
                                    <div className="space-y-2.5">
                                        {assignModalData.allDrivers.map(driver => (
                                            <div key={driver._id} className="bg-white p-3 rounded-xl border border-gray-100 flex justify-between items-center hover:bg-indigo-50/50 hover:border-indigo-100 transition group">
                                                <div>
                                                    <p className="font-bold text-sm text-gray-800 group-hover:text-indigo-700 transition">{driver.name}</p>
                                                    <p className="text-[10px] text-gray-500 mt-0.5 font-medium">Cách: <strong className="text-gray-700">{driver.calculatedDistance.toFixed(1)}km</strong> | Đơn h.nay: <strong className="text-gray-700">{driver.activeOrders} đơn</strong></p>
                                                </div>
                                                <button onClick={() => confirmManualAssign(driver._id)} className="w-8 h-8 shrink-0 flex items-center justify-center bg-gray-100 hover:bg-indigo-600 hover:text-white text-gray-600 rounded-full text-lg font-bold transition shadow-sm pb-0.5">+</button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Chi Tiết Đơn Hàng CŨ (Chỉ xem) */}
            {selectedOrder && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-fadeIn">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-5xl h-[80vh] flex flex-col md:flex-row overflow-hidden relative border border-gray-100">
                        <button onClick={() => setSelectedOrder(null)} className="absolute top-3 right-3 z-[999] bg-white text-gray-500 hover:text-red-500 p-1.5 rounded-md shadow border border-gray-200"><CloseIcon fontSize="small"/></button>
                        <div className="w-full md:w-1/3 bg-gray-50 p-5 overflow-y-auto border-r border-gray-200 custom-scrollbar">
                            <h2 className="text-lg font-bold text-gray-800 mb-1">Chi tiết đơn</h2>
                            <p className="text-xs text-gray-500 mb-4 font-mono">ID: {selectedOrder._id}</p>
                            
                            <div className="bg-white p-4 rounded-lg border border-gray-200 mb-4 text-sm">
                                <div className="mb-3 pb-3 border-b border-gray-100">
                                    <p className="font-semibold text-gray-800">{selectedOrder.customerId?.name || "Khách lẻ"}</p>
                                    <p className="text-gray-600 mt-1">SĐT Đặt: <span className="font-medium text-gray-900">{selectedOrder.customerId?.phone || "N/A"}</span></p>
                                    {selectedOrder.recipientPhone && (<p className="text-gray-600 mt-1">SĐT Nhận: <span className="font-medium text-gray-900">{selectedOrder.recipientPhone}</span></p>)}
                                </div>
                                <div className="space-y-3 mb-3">
                                    <div><span className="text-xs text-gray-500 block mb-0.5">Lấy hàng tại:</span><p className="font-medium text-gray-800">{selectedOrder.pickupAddress}</p></div>
                                    <div><span className="text-xs text-gray-500 block mb-0.5">Giao hàng đến:</span><p className="font-medium text-gray-800">{selectedOrder.deliveryAddress}</p></div>
                                </div>
                                <div className="flex justify-between bg-gray-50 p-2.5 rounded border border-gray-100 text-xs">
                                    <span>Nặng: <strong className="text-gray-800">{selectedOrder.weight} kg</strong></span>
                                    <span>Cước: <strong className="text-emerald-600">{(selectedOrder.price || selectedOrder.cost || 0).toLocaleString()} ₫</strong></span>
                                </div>
                            </div>
                            
                            <div className="bg-white p-4 rounded-lg border border-gray-200">
                                <h3 className="font-semibold text-gray-800 mb-3 text-sm">Điều phối tài xế</h3>
                                {['completed', 'cancelled', 'failed'].includes(selectedOrder.status) ? (
                                    <div className="text-center py-2 text-gray-500 text-sm">Đơn hàng đã đóng.</div>
                                ) : (
                                <div className="space-y-3">
                                    <select className="w-full bg-gray-50 p-2 border border-gray-200 rounded-md text-sm outline-none disabled:bg-gray-100" value={selectedDriverId} onChange={(e) => setSelectedDriverId(e.target.value)} disabled={selectedOrder.status === 'delivering'}>
                                        <option value="">-- Chưa gán tài xế --</option>
                                        {drivers.map(d => (<option key={d._id} value={d._id}>{d.name}</option>))}
                                    </select>
                                    <div className="flex gap-2">
                                        <button onClick={() => { handleAssignDriver(selectedOrder._id, selectedDriverId); setSelectedOrder(prev => ({...prev, status: 'assigned', driverId: drivers.find(d => d._id === selectedDriverId)})); }} disabled={selectedOrder.status === 'delivering'} className={`flex-1 py-1.5 text-white text-sm font-medium rounded-md transition ${selectedOrder.status === 'delivering' ? 'bg-gray-400' : 'bg-indigo-600 hover:bg-indigo-700'}`}>
                                            Cập nhật
                                        </button>
                                        {(selectedOrder.status === 'assigned' || selectedOrder.driverId) && selectedOrder.status !== 'delivering' && (
                                            <button onClick={() => { handleAssignDriver(selectedOrder._id, null); setSelectedOrder(prev => ({...prev, status: 'pending', driverId: null})); setSelectedDriverId(""); }} className="px-3 py-1.5 bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 text-sm font-medium rounded-md transition">Gỡ gán</button>
                                        )}
                                    </div>
                                </div>
                                )}
                            </div>
                        </div>
                        <div className="w-full md:w-2/3 h-full relative">
                            <MapContainer center={getPoint(selectedOrder, 'pickup') || [21.0285, 105.8542]} zoom={13} style={{ height: "100%", width: "100%" }}>
                                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                                {routeCoords.length > 0 && <Polyline positions={normalizeRoute(routeCoords)} color="#4f46e5" weight={5} opacity={0.7} />}
                                {getPoint(selectedOrder, 'pickup') && <Marker position={getPoint(selectedOrder, 'pickup')} icon={pickupIcon}><Popup className="text-sm">Lấy hàng</Popup></Marker>}
                                {getPoint(selectedOrder, 'dropoff') && <Marker position={getPoint(selectedOrder, 'dropoff')} icon={deliveryIcon}><Popup className="text-sm">Giao hàng</Popup></Marker>}
                                {driverLocation && selectedOrder.status === 'delivering' && (
                                    <Marker position={normalizePoint(driverLocation)} icon={driverIcon} zIndexOffset={99999}><Popup className="text-sm">Vị trí tài xế</Popup></Marker>
                                )}
                                <MapUpdater bounds={routeCoords.length > 0 ? normalizeRoute(routeCoords) : null} driverLocation={normalizePoint(driverLocation)} />
                            </MapContainer>
                            {selectedOrder.status === 'delivering' && (<div className="absolute top-3 left-3 z-[9999] bg-white px-3 py-1.5 rounded shadow border-l-4 border-green-500 text-xs font-medium text-gray-700">{signalStatus}</div>)}
                        </div>
                    </div>
                </div>
            )}

            {/* 🔥 MODAL BẢN ĐỒ LỘ TRÌNH TÀI XẾ */}
            {driverMapModal && (
                <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 p-4 animate-fadeIn">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-5xl h-[80vh] overflow-hidden relative flex flex-col border border-gray-100">
                        <button onClick={() => setDriverMapModal(null)} className="absolute top-3 right-3 z-[999] bg-white text-gray-500 hover:text-red-500 p-1.5 rounded-md shadow border border-gray-200"><CloseIcon fontSize="small"/></button>
                        
                        <div className="p-4 border-b border-gray-100 bg-white shrink-0 flex items-center gap-3 z-10">
                            <div className="w-8 h-8 bg-gray-100 rounded-md flex items-center justify-center"><RouteIcon fontSize="small" className="text-gray-600"/></div>
                            <div>
                                <h2 className="text-base font-bold text-gray-800">Lộ trình: {driverMapModal.driver.name}</h2>
                                <p className="text-xs text-gray-500 mt-0.5">{driverMapModal.driver.phone}</p>
                            </div>
                        </div>

                       <div className="flex-1 relative z-0">
                            <MapContainer center={liveDriverLocations[driverMapModal.driver._id] || getSafeCoords(driverMapModal.driver)} zoom={13} style={{ height: "100%", width: "100%" }}>
                                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                                
                                {(() => {
                                    const sortedOrders = [...driverMapModal.orders].sort((a, b) => {
                                        const weight = { 'completed': 1, 'delivering': 2, 'assigned': 3, 'confirmed': 4, 'pending': 5 };
                                        return (weight[a.status] || 99) - (weight[b.status] || 99) || new Date(a.pickupTime || a.createdAt) - new Date(b.pickupTime || b.createdAt);
                                    });
                                    
                                    return sortedOrders.map((order, idx) => {
                                        const pPickup = getPoint(order, 'pickup');
                                        const pDropoff = getPoint(order, 'dropoff');
                                        const isCompleted = order.status === 'completed';
                                        
                                        const routePositions = driverRealRoutes[order._id] || (pPickup && pDropoff ? [pPickup, pDropoff] : []);
                                        const emptyRouteKey = sortedOrders[idx + 1] ? `${order._id}-${sortedOrders[idx + 1]._id}` : null;
                                        const emptyRoutePositions = emptyRouteKey && driverEmptyRoutes[emptyRouteKey] ? driverEmptyRoutes[emptyRouteKey] : [];

                                        // MÀU SẮC ĐÃ ĐƯỢC CHỈNH LẠI: Rõ ràng và dễ nhìn hơn
                                        const routeColor = isCompleted ? '#6b7280' : '#4f46e5'; 
                                        const routeOpacity = isCompleted ? 0.85 : 1;
                                        const emptyColor = isCompleted ? '#fbbf24' : '#f59e0b';
                                        
                                        return (
                                            <React.Fragment key={order._id}>
                                                {routePositions.length > 0 && (
                                                    <Polyline positions={routePositions} color={routeColor} weight={5} opacity={routeOpacity} />
                                                )}
                                                {emptyRoutePositions.length > 0 && (
                                                    <Polyline positions={emptyRoutePositions} color={emptyColor} weight={4} opacity={0.8} dashArray="5, 8" />
                                                )}
                                                {pPickup && (
                                                    <Marker position={pPickup} icon={isCompleted ? grayIcon : pickupIcon} opacity={isCompleted ? 0.8 : 1}>
                                                        <Popup><span className="text-xs font-semibold">Lấy hàng (Đơn {idx+1})</span></Popup>
                                                    </Marker>
                                                )}
                                                {pDropoff && (
                                                    <Marker position={pDropoff} icon={isCompleted ? grayIcon : deliveryIcon} opacity={isCompleted ? 0.8 : 1}>
                                                        <Popup><span className="text-xs font-semibold">Giao hàng (Đơn {idx+1})</span></Popup>
                                                    </Marker>
                                                )}
                                            </React.Fragment>
                                        );
                                    });
                                })()}

                                {(() => {
                                    const driverLoc = liveDriverLocations[driverMapModal.driver._id] || getSafeCoords(driverMapModal.driver);
                                    return (
                                        <React.Fragment>
                                            {driverToFirstRoute.length > 0 ? (
                                                <Polyline positions={driverToFirstRoute} color="#3b82f6" weight={4} opacity={0.9} dashArray="5, 8" />
                                            ) : (
                                                driverLoc && driverMapModal.orders.some(o => o.status !== 'completed') && (
                                                    <Polyline 
                                                        positions={[
                                                            driverLoc, 
                                                            getPoint([...driverMapModal.orders].sort((a, b) => {
                                                                const weight = { 'completed': 1, 'delivering': 2, 'assigned': 3, 'confirmed': 4, 'pending': 5 };
                                                                return (weight[a.status] || 99) - (weight[b.status] || 99);
                                                            }).find(o => o.status !== 'completed'), 'pickup')
                                                        ].filter(Boolean)} 
                                                        color="#3b82f6" weight={4} opacity={0.9} dashArray="5, 8" 
                                                    />
                                                )
                                            )}
                                            {driverLoc && (
                                                <Marker position={driverLoc} icon={driverIcon} zIndexOffset={9999}>
                                                    <Popup><span className="text-xs font-bold">Vị trí tài xế</span></Popup>
                                                </Marker>
                                            )}
                                        </React.Fragment>
                                    );
                                })()}

                                <MapUpdater bounds={normalizeRoute([
                                    liveDriverLocations[driverMapModal.driver._id] || getSafeCoords(driverMapModal.driver),
                                    ...driverMapModal.orders.map(o => getPoint(o, 'pickup')),
                                    ...driverMapModal.orders.map(o => getPoint(o, 'dropoff'))
                                ])} driverLocation={normalizePoint(liveDriverLocations[driverMapModal.driver._id])} />
                            </MapContainer>
                            
                            {/* BẢNG CHÚ GIẢI (LEGEND) VỪA ĐƯỢC KHÔI PHỤC */}
                            <div className="absolute bottom-4 left-4 z-[1000] bg-white/95 backdrop-blur-sm p-3 rounded-lg shadow-md border border-gray-200 text-[11px] font-semibold text-gray-700 space-y-2 min-w-[180px]">
                                <div className="flex items-center gap-2"><span className="w-5 h-1.5 bg-gray-500 inline-block rounded"></span> Lộ trình đã qua (Hoàn thành)</div>
                                <div className="flex items-center gap-2"><span className="w-5 h-1.5 bg-indigo-600 inline-block rounded"></span> Lộ trình giao hàng (Sắp tới)</div>
                                <div className="flex items-center gap-2"><span className="w-5 h-0 border-t-[3px] border-dashed border-orange-500 inline-block"></span> Chạy rỗng đi lấy hàng</div>
                                <div className="flex items-center gap-2"><span className="w-5 h-0 border-t-[3px] border-dashed border-blue-500 inline-block"></span> Xe tới điểm lấy đầu</div>
                            </div>

                            <div className="absolute top-4 left-4 z-[1000] bg-white p-3 rounded-lg shadow border border-gray-200 min-w-[180px]">
                                <p className="text-[11px] text-gray-500 uppercase font-bold mb-2">Thống kê ngày</p>
                                <div className="space-y-1 text-sm">
                                    <div className="flex justify-between text-gray-700"><span>Đã nhận:</span> <span className="font-semibold">{driverMapModal.stats.total} đơn</span></div>
                                    <div className="flex justify-between text-gray-700"><span>Đang chờ:</span> <span className="font-semibold text-orange-600">{driverMapModal.stats.remaining} đơn</span></div>
                                    <div className="flex justify-between text-gray-700 pt-1 border-t border-gray-100"><span>Doanh thu:</span> <span className="font-semibold text-emerald-600">{driverMapModal.stats.revenue.toLocaleString()} ₫</span></div>
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
        unconfirmed: "bg-gray-100 text-gray-600", pending: "bg-orange-50 text-orange-600", confirmed: "bg-cyan-50 text-cyan-600",
        assigned: "bg-blue-50 text-blue-600", delivering: "bg-yellow-50 text-yellow-700", completed: "bg-emerald-50 text-emerald-600", cancelled: "bg-red-50 text-red-600" 
    }; 
    const labelMapping = { unconfirmed: "Chưa duyệt", pending: "Chờ xử lý", confirmed: "Đã xác nhận", assigned: "Đã phân công", delivering: "Đang giao", completed: "Hoàn thành", cancelled: "Đã hủy" };
    return <span className={`px-2 py-1 rounded text-[10px] font-semibold whitespace-nowrap ${styles[status] || "bg-gray-50 text-gray-500"}`}>{labelMapping[status] || status}</span>; 
};

export default DashboardCoordinator;