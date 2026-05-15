import React, { useState } from "react";
import { MapContainer, TileLayer, Marker, Polyline, Popup, useMap } from "react-leaflet";
import axios from "axios";
import L from "leaflet";

// Cấu hình icon marker mặc định
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

// Component con cập nhật vị trí map khi người dùng chọn địa chỉ
function ChangeView({ center }) {
  const map = useMap();
  map.setView(center, 13);
  return null;
}

function CreateOrderMap({ onSelect }) {
  const [mode, setMode] = useState("pickup"); // "pickup" hoặc "delivery"
  const [pickup, setPickup] = useState(null);
  const [delivery, setDelivery] = useState(null);
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);

  // Tìm kiếm địa chỉ
  const handleSearch = async (e) => {
    const value = e.target.value;
    setQuery(value);
    if (value.length < 3) {
      setSuggestions([]);
      return;
    }

    try {
      const res = await axios.get("https://nominatim.openstreetmap.org/search", {
        params: { q: value, format: "json", addressdetails: 1, limit: 5 },
      });
      setSuggestions(res.data);
    } catch (error) {
      console.error("Lỗi tìm kiếm:", error);
    }
  };

  // Khi chọn 1 gợi ý
  const handleSelect = (item) => {
    const coords = { lat: parseFloat(item.lat), lng: parseFloat(item.lon) };
    const address = item.display_name;

    if (mode === "pickup") {
      setPickup({ coords, address });
      setMode("delivery");
    } else {
      setDelivery({ coords, address });
    }

    setQuery("");
    setSuggestions([]);

    // Khi đã có đủ 2 điểm → gửi dữ liệu lên cha
    if (pickup && mode === "delivery") {
      onSelect(
        pickup,
        { coords, address } // delivery
      );
    }
  };

  // Hiển thị trung tâm bản đồ
  const center =
    delivery?.coords || pickup?.coords || { lat: 21.0285, lng: 105.8542 };

  return (
    <div className="w-full space-y-3">
      <div className="flex items-center gap-3">
        <input
          type="text"
          placeholder={
            mode === "pickup"
              ? "Nhập địa chỉ lấy hàng..."
              : "Nhập địa chỉ giao hàng..."
          }
          value={query}
          onChange={handleSearch}
          className="border p-2 rounded w-full"
        />
        <button
          className="px-3 py-2 bg-gray-200 rounded"
          onClick={() =>
            setMode((prev) => (prev === "pickup" ? "delivery" : "pickup"))
          }
        >
          {mode === "pickup" ? "Chọn giao hàng" : "Chọn lấy hàng"}
        </button>
      </div>

      {suggestions.length > 0 && (
        <ul className="bg-white border rounded w-full max-h-48 overflow-y-auto z-10 shadow-lg absolute">
          {suggestions.map((item, index) => (
            <li
              key={index}
              className="p-2 hover:bg-gray-100 cursor-pointer"
              onClick={() => handleSelect(item)}
            >
              {item.display_name}
            </li>
          ))}
        </ul>
      )}

      <div className="w-full h-80 rounded-lg overflow-hidden">
        <MapContainer
          center={[center.lat, center.lng]}
          zoom={13}
          style={{ height: "100%", width: "100%" }}
        >
          <ChangeView center={[center.lat, center.lng]} />
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution="© OpenStreetMap contributors"
          />

          {pickup && (
            <Marker position={[pickup.coords.lat, pickup.coords.lng]}>
              <Popup>📦 Điểm lấy hàng<br />{pickup.address}</Popup>
            </Marker>
          )}

          {delivery && (
            <Marker position={[delivery.coords.lat, delivery.coords.lng]}>
              <Popup>🚚 Điểm giao hàng<br />{delivery.address}</Popup>
            </Marker>
          )}

          {pickup && delivery && (
            <Polyline
              positions={[
                [pickup.coords.lat, pickup.coords.lng],
                [delivery.coords.lat, delivery.coords.lng],
              ]}
              color="blue"
            />
          )}
        </MapContainer>
      </div>

      <div className="text-sm text-gray-700 space-y-1">
        <p><strong>Điểm lấy hàng:</strong> {pickup?.address || "Chưa chọn"}</p>
        <p><strong>Điểm giao hàng:</strong> {delivery?.address || "Chưa chọn"}</p>
      </div>
    </div>
  );
}

export default CreateOrderMap;
