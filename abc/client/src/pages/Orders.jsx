import React, { useEffect, useState } from "react";
import axios from "axios";
import { useUser } from "../services/userContext";
import MapComponent from "../components/MapComponent"; // ✅ Thêm bản đồ
import io from "socket.io-client";

const Orders = () => {
  const { user } = useUser();
  const [orders, setOrders] = useState([]);
  const [newOrder, setNewOrder] = useState({
    from: "",
    to: "",
    pickupCoords: null,
    deliveryCoords: null,
  });

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const res = await axios.get("/api/orders", {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        });
        setOrders(res.data);
      } catch (err) {
        console.error("Lỗi tải danh sách đơn:", err);
      }
    };
    fetchOrders();
    useEffect(() => {
  const socket = io("http://localhost:5000"); // hoặc domain backend
  
  socket.on("orderUpdated", (updatedOrder) => {
    setOrders((prev) =>
      prev.map((o) => (o._id === updatedOrder._id ? updatedOrder : o))
    );
  });

  return () => socket.disconnect();
}, []);

  }, []);

  const createOrder = async () => {
    try {
      if (!newOrder.pickupCoords || !newOrder.deliveryCoords) {
        alert("Vui lòng chọn địa chỉ lấy hàng và giao hàng trên bản đồ!");
        return;
      }

      const res = await axios.post("/api/orders", newOrder, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      setOrders((prev) => [...prev, res.data]);
      setNewOrder({
        from: "",
        to: "",
        pickupCoords: null,
        deliveryCoords: null,
      });
      alert("✅ Tạo đơn hàng thành công!");
    } catch (err) {
      console.error("Lỗi tạo đơn:", err);
      alert("❌ Tạo đơn hàng thất bại.");
    }
  };

  const assignOrder = async (orderId, driverId) => {
    try {
      const res = await axios.put(
  `/api/orders/assign/${orderId}`,
  { driverId },
  { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } }
);

setOrders((prev) =>
  prev.map((o) => (o._id === orderId ? res.data : o))
);

alert("Đã gán đơn cho tài xế");

    } catch (err) {
      console.error("Lỗi gán tài xế:", err);
    }
  };

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold mb-4">Quản lý đơn hàng</h1>

      {user.role === "customer" && (
        <div className="mb-8 border rounded-lg p-4 bg-gray-50">
          <h2 className="font-semibold mb-3 text-lg">Tạo đơn mới</h2>

          {/* --- Bản đồ chọn địa chỉ --- */}
          <MapComponent newOrder={newOrder} setNewOrder={setNewOrder} />

          {/* --- Hiển thị địa chỉ đã chọn --- */}
          <div className="mt-4 grid grid-cols-2 gap-4">
            <div>
              <label className="font-medium">Địa chỉ lấy hàng</label>
              <input
                type="text"
                value={newOrder.from}
                onChange={(e) =>
                  setNewOrder({ ...newOrder, from: e.target.value })
                }
                placeholder="Nhập hoặc chọn trên bản đồ"
                className="border p-2 rounded w-full mt-1"
              />
            </div>

            <div>
              <label className="font-medium">Địa chỉ giao hàng</label>
              <input
                type="text"
                value={newOrder.to}
                onChange={(e) =>
                  setNewOrder({ ...newOrder, to: e.target.value })
                }
                placeholder="Nhập hoặc chọn trên bản đồ"
                className="border p-2 rounded w-full mt-1"
              />
            </div>
          </div>

          <button
            onClick={createOrder}
            className="bg-blue-600 text-white px-4 py-2 mt-4 rounded hover:bg-blue-700"
          >
            Tạo đơn hàng
          </button>
        </div>
      )}

      {/* --- Danh sách đơn hàng --- */}
      <table className="w-full border rounded-md">
        <thead className="bg-gray-200">
          <tr>
            <th className="border p-2">Từ</th>
            <th className="border p-2">Đến</th>
            <th className="border p-2">Tài xế</th>
            <th className="border p-2">Trạng thái</th>
            {user.role === "coordinator" && (
              <th className="border p-2">Gán tài xế</th>
            )}
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => (
            <tr key={o._id}>
              <td className="border p-2">{o.from}</td>
              <td className="border p-2">{o.to}</td>
              <td className="border p-2">
                {o.driverId ? (o.driverId.name || o.driverId._id) : "Chưa gán"}
              </td>
              <td className="border p-2">{o.status}</td>
              {user.role === "coordinator" && (
                <td className="border p-2">
                  <input
                    placeholder="ID tài xế"
                    className="border p-1"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") assignOrder(o._id, e.target.value);
                    }}
                  />
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default Orders;
