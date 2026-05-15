import React, { useState, useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from "react-leaflet";
import api from "../services/api";

// Component chọn điểm giao hàng trên map
function DeliveryMap({ deliveryCoords, setDeliveryCoords, deliveryAddress, setDeliveryAddress, pickupCoords }) {
  useMapEvents({
    click(e) {
      const lat = e.latlng.lat;
      const lng = e.latlng.lng;
      setDeliveryCoords({ lat, lng });
      setDeliveryAddress(`Vị trí: ${lat.toFixed(5)}, ${lng.toFixed(5)}`);
    },
  });

  return (
    <>
      {pickupCoords && (
        <Marker position={[pickupCoords.lat, pickupCoords.lng]}>
          <Popup>Điểm lấy hàng</Popup>
        </Marker>
      )}
      {deliveryCoords && (
        <Marker position={[deliveryCoords.lat, deliveryCoords.lng]}>
          <Popup>{deliveryAddress}</Popup>
        </Marker>
      )}
    </>
  );
}

function CreateOrder() {
  const [pickupList, setPickupList] = useState([]);
  const [selectedPickup, setSelectedPickup] = useState("");

  const [pickupAddress, setPickupAddress] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [pickupCoords, setPickupCoords] = useState(null);
  const [deliveryCoords, setDeliveryCoords] = useState(null);

  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [weight, setWeight] = useState("");
  const [cost, setCost] = useState(null);

  // Load pickup locations của user
  useEffect(() => {
    const loadPickupLocations = async () => {
      try {
        const res = await api.get("/users/me");
        setPickupList(res.data.pickupLocations || []);
        if (res.data.pickupLocations?.length > 0) {
          // Chọn địa chỉ đầu tiên mặc định
          const loc = res.data.pickupLocations[0];
          setPickupAddress(loc.address);
          setPickupCoords({ lat: loc.lat, lng: loc.lng });
          setSelectedPickup(loc._id);
        }
      } catch (err) {
        console.error("Lỗi load pickupLocations:", err);
      }
    };
    loadPickupLocations();
  }, []);

  // Khi chọn địa chỉ pickup từ dropdown
  const handlePickupSelect = (id) => {
    setSelectedPickup(id);
    const loc = pickupList.find((i) => i._id === id);
    if (loc) {
      setPickupAddress(loc.address);
      setPickupCoords({ lat: loc.lat, lng: loc.lng });
    }
  };

  const handleSubmit = async () => {
    if (!pickupCoords) {
      alert("Vui lòng chọn địa chỉ lấy hàng.");
      return;
    }
    if (!deliveryCoords) {
      alert("Vui lòng chọn địa chỉ giao hàng trên bản đồ.");
      return;
    }
    if (!weight || weight <= 0) {
      alert("Vui lòng nhập cân nặng hợp lệ.");
      return;
    }
    try {
      const orderData = {
        pickupAddress,
        pickupCoords,
        deliveryAddress,
        deliveryCoords,
        customerName,
        phone,
        weight: Number(weight),
      };
      const res = await api.post("/orders", orderData);
      if (res.data.cost) setCost(res.data.cost);
      alert("✅ Tạo đơn hàng thành công!");
      // Reset form
      setDeliveryAddress("");
      setDeliveryCoords(null);
      setWeight("");
      setCustomerName("");
      setPhone("");
    } catch (err) {
      console.error(err);
      alert("❌ Lỗi tạo đơn hàng");
    }
  };

  return (
    <div className="p-6 space-y-4 max-w-3xl mx-auto">
      <h2 className="text-2xl font-bold mb-4">Tạo đơn hàng mới</h2>

      {/* Dropdown chọn địa chỉ pickup */}
      <label className="font-semibold">Chọn địa chỉ lấy hàng:</label>
      <select
        className="border p-2 rounded w-full"
        value={selectedPickup}
        onChange={(e) => handlePickupSelect(e.target.value)}
      >
        <option value="">-- Chọn địa chỉ đã lưu --</option>
        {pickupList.map((loc) => (
          <option key={loc._id} value={loc._id}>
            {loc.address}
          </option>
        ))}
      </select>

      {pickupAddress && (
        <p className="text-green-600 mt-1">
          📍 Lấy tại: <strong>{pickupAddress}</strong>
        </p>
      )}

      {/* Map chọn delivery */}
      <p className="text-gray-600 font-semibold mt-4">
        🚚 Chọn địa chỉ giao hàng trên bản đồ
      </p>
      <div className="h-[400px] border rounded overflow-hidden">
        <MapContainer
          center={deliveryCoords ? [deliveryCoords.lat, deliveryCoords.lng] : [21.0285, 105.8542]}
          zoom={13}
          style={{ height: "100%", width: "100%" }}
        >
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <DeliveryMap
            pickupCoords={pickupCoords}
            deliveryCoords={deliveryCoords}
            setDeliveryCoords={setDeliveryCoords}
            deliveryAddress={deliveryAddress}
            setDeliveryAddress={setDeliveryAddress}
          />
        </MapContainer>
      </div>

      <input
        type="text"
        placeholder="Tên khách hàng"
        value={customerName}
        onChange={(e) => setCustomerName(e.target.value)}
        className="border p-2 rounded w-full"
      />
      <input
        type="text"
        placeholder="Số điện thoại"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        className="border p-2 rounded w-full"
      />
      <input
        type="number"
        placeholder="Cân nặng (kg)"
        value={weight}
        onChange={(e) => setWeight(e.target.value)}
        className="border p-2 rounded w-full"
      />

      <div className="mt-2">
        <p><strong>Địa chỉ lấy hàng:</strong> {pickupAddress || "Chưa chọn"}</p>
        <p><strong>Địa chỉ giao hàng:</strong> {deliveryAddress || "Chưa chọn"}</p>
      </div>

      {cost !== null && (
        <p className="text-green-700 font-semibold">
          💰 Chi phí dự kiến: {cost.toLocaleString()} đ
        </p>
      )}

      <button
        onClick={handleSubmit}
        className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
      >
        Tạo đơn hàng
      </button>
    </div>
  );
}

export default CreateOrder;
