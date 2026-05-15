import React, { useEffect, useState } from "react";
import axios from "axios";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

const DriverStats = () => {
  const [mode, setMode] = useState("day"); // day | week
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [weekStart, setWeekStart] = useState(new Date());
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);

  // Tính ngày đầu tuần (thứ 2)
  const getWeekStart = (date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff));
  };

  const handleWeekChange = (d) => {
    setSelectedDate(d);
    setWeekStart(getWeekStart(d));
  };

  const fetchStats = async () => {
    setLoading(true);

    try {
      const token = localStorage.getItem("token");

      const params =
        mode === "day"
          ? {
              type: "day",
              date: selectedDate.toISOString().split("T")[0],
            }
          : {
              type: "week",
              weekStart: weekStart.toISOString().split("T")[0],
            };

      const res = await axios.get("/api/orders/stats/driver", {
        headers: { Authorization: `Bearer ${token}` },
        params,
      });

      setStats(res.data);
    } catch (err) {
      console.log("Lỗi thống kê:", err);
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchStats();
  }, [mode, selectedDate, weekStart]);

  if (loading || !stats) return <p>Đang tải thống kê...</p>;

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold mb-4">📊 Thống kê tài xế</h1>

      {/* CHỌN NGÀY / TUẦN */}
      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={() => setMode("day")}
          className={`px-4 py-2 rounded-md ${
            mode === "day" ? "bg-blue-600 text-white" : "bg-gray-200"
          }`}
        >
          Theo ngày
        </button>

        <button
          onClick={() => setMode("week")}
          className={`px-4 py-2 rounded-md ${
            mode === "week" ? "bg-blue-600 text-white" : "bg-gray-200"
          }`}
        >
          Theo tuần
        </button>
      </div>

      {/* DATE PICKER */}
      <div className="mb-4">
        <label className="font-medium mr-2">
          Chọn {mode === "day" ? "ngày" : "tuần"}:
        </label>

        <DatePicker
          selected={selectedDate}
          onChange={mode === "day" ? setSelectedDate : handleWeekChange}
          className="px-3 py-2 border rounded-md"
          dateFormat="dd/MM/yyyy"
        />
      </div>

      {/* THỐNG KÊ */}
      <ul className="list-disc ml-6 space-y-2">
        <li>
          <span className="font-medium">Số đơn hàng đã nhận:</span>{" "}
          {stats.totalOrders}
        </li>
        <li>
          <span className="font-medium">Số km đã đi:</span> {stats.totalKm} km
        </li>
        <li>
          <span className="font-medium">Nhiên liệu tiêu thụ:</span>{" "}
          {stats.fuelUsed} L
        </li>
        <li>
          <span className="font-medium">Lợi nhuận:</span>{" "}
          {stats.estimatedProfit.toLocaleString()} VND
        </li>
      </ul>

      {/* TUẦN RANGE */}
      {mode === "week" && (
        <p className="mt-3 text-gray-600 text-sm">
          Tuần:{" "}
          <b>{new Date(stats.start).toLocaleDateString("vi-VN")}</b> →{" "}
          <b>{new Date(stats.end).toLocaleDateString("vi-VN")}</b>
        </p>
      )}
    </div>
  );
};

export default DriverStats;
