import React, { useEffect, useState } from "react";
import axios from "axios";

const AssignOrder = () => {
  const [orders, setOrders] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(false);

  const token = localStorage.getItem("token");
  const api = axios.create({
    baseURL: "/api",
    headers: { Authorization: `Bearer ${token}` },
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      const [ordersRes, driversRes] = await Promise.all([
        api.get("/orders"),
        api.get("/users?role=driver"),
      ]);
      setOrders(ordersRes.data);
      setDrivers(driversRes.data);
    } catch (err) {
      console.error(err);
      alert("❌ Lỗi tải dữ liệu");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAssign = async (orderId, driverId) => {
    if (!driverId) return;
    try {
      await api.put(`/orders/assign/${orderId}`, { driverId });
      alert("✅ Đã gán đơn hàng cho tài xế!");
      fetchData();
    } catch (err) {
      console.error(err);
      alert("❌ Lỗi khi gán đơn hàng");
    }
  };

  const approveCancel = async (orderId) => {
    if (!window.confirm("Bạn có chắc muốn chấp nhận hủy đơn hàng này?")) return;
    try {
      await api.put(`/orders/${orderId}/approve-cancel`);
      alert("✅ Đã chấp nhận hủy đơn hàng");
      fetchData();
    } catch (err) {
      console.error(err);
      alert("❌ Lỗi khi duyệt hủy đơn");
    }
  };

  return (
    <div className="p-4 max-w-3xl mx-auto">
      <h2 className="text-2xl font-bold mb-4">🚚 Gán đơn hàng cho tài xế</h2>

      {loading && <p>Đang tải dữ liệu...</p>}

      {!loading && orders.length === 0 && (
        <p className="text-gray-600">Chưa có đơn hàng nào.</p>
      )}

      {orders.map((order) => (
        <div
          key={order._id}
          className="border p-4 mb-4 rounded shadow-sm bg-white"
        >
          <p><strong>Mã đơn:</strong> {order._id}</p>
          <p><strong>Trạng thái:</strong> {order.status}</p>
          <p><strong>Khách hàng:</strong> {order.customer?.name}</p>

          {order.cancelRequest ? (
            <div className="mt-3 p-3 bg-yellow-50 border border-yellow-300 rounded">
              <p className="text-yellow-700">
                ⚠️ Khách hàng đã gửi yêu cầu hủy đơn hàng này.
              </p>
              <button
                onClick={() => approveCancel(order._id)}
                className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
              >
                Chấp nhận hủy
              </button>
            </div>
          ) : (
            <div className="mt-2">
              <select
                onChange={(e) => handleAssign(order._id, e.target.value)}
                className="mt-2 border p-2 rounded w-full"
                defaultValue=""
              >
                <option value="">-- Chọn tài xế --</option>
                {drivers.map((d) => (
                  <option key={d._id} value={d._id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default AssignOrder;
