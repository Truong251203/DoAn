import React, { useEffect, useState } from "react";
import axios from "axios";
import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix icon Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.3/images/marker-icon-2x.png",
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.3/images/marker-icon.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.3/images/marker-shadow.png",
});

// Map click component
const ClickableMap = ({ marker, setMarker }) => {
  useMapEvents({
    click(e) {
      setMarker({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });
  return marker ? <Marker position={[marker.lat, marker.lng]} /> : null;
};

const CustomerProfile = () => {
  const [user, setUser] = useState(null);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [warehouseMarker, setWarehouseMarker] = useState({
    lat: 21.0285,
    lng: 105.8542,
  });

  const [pickupList, setPickupList] = useState([]);

  const [newAddress, setNewAddress] = useState("");
  const [newMarker, setNewMarker] = useState(null);

  const token = localStorage.getItem("token");

  // Load user
  const fetchUser = async () => {
    try {
      const res = await axios.get("http://localhost:5000/users/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const u = res.data;

      setUser(u);
      setName(u.name || "");
      setAddress(u.warehouse?.address || "");
      setWarehouseMarker(
        u.warehouse?.lat
          ? { lat: u.warehouse.lat, lng: u.warehouse.lng }
          : { lat: 21.0285, lng: 105.8542 }
      );

      setPickupList(u.pickupLocations || []);
    } catch (err) {
      console.log(err);
    }
  };

  useEffect(() => {
    fetchUser();
  }, []);

  // SAVE profile
  const handleSave = async () => {
    try {
      await axios.put(
        "http://localhost:5000/users/me",
        {
          name,
          warehouse: {
            address,
            lat: warehouseMarker.lat,
            lng: warehouseMarker.lng,
          },
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      alert("Đã lưu thành công!");
      fetchUser(); // cập nhật lại user
    } catch (err) {
      alert("Lỗi khi lưu!");
    }
  };

  // ADD pickup
  const handleAddPickup = async () => {
    if (!newAddress || !newMarker) return alert("Điền địa chỉ + chọn điểm!");

    try {
      await axios.post(
        "http://localhost:5000/users/pickup-location",
        {
          address: newAddress,
          lat: newMarker.lat,
          lng: newMarker.lng,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      alert("Đã thêm địa chỉ!");

      // Load lại danh sách sau khi thêm
      fetchUser();

      // Reset input
      setNewAddress("");
      setNewMarker(null);
    } catch (err) {
      console.log(err);
      alert("Lỗi khi thêm địa chỉ!");
    }
  };

  // DELETE pickup
  const handleDeletePickup = async (index) => {
    try {
      await axios.delete(
        `http://localhost:5000/users/pickup-location/${index}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      alert("Đã xóa!");

      // Load lại danh sách sau khi xóa
      fetchUser();
    } catch (err) {
      alert("Lỗi khi xóa!");
    }
  };

  if (!user) return <div className="p-4">Đang tải...</div>;

  return (
    <div className="p-4 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Thông tin cá nhân</h1>

      <div className="mb-4">
        <label className="block">Tên</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="border p-2 w-full"
        />
      </div>

      <div className="mb-4">
        <label className="block">Email</label>
        <input
          value={user.email}
          disabled
          className="border p-2 w-full bg-gray-100"
        />
      </div>

      <div className="mb-4">
        <label className="block">Địa chỉ kho</label>
        <input
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          className="border p-2 w-full"
        />
      </div>

      <div className="mb-4">
        <label className="block mb-2">Vị trí kho hàng</label>
        <MapContainer
          center={warehouseMarker}
          zoom={13}
          style={{ height: 300, width: "100%" }}
        >
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <ClickableMap
            marker={warehouseMarker}
            setMarker={setWarehouseMarker}
          />
        </MapContainer>
      </div>

      <button
        onClick={handleSave}
        className="bg-blue-500 text-white px-4 py-2 rounded"
      >
        Lưu thông tin
      </button>

      {/* ADD PICKUP */}
      <h2 className="text-xl font-semibold mt-6">Thêm địa chỉ lấy hàng</h2>
      <input
        value={newAddress}
        onChange={(e) => setNewAddress(e.target.value)}
        placeholder="Nhập địa chỉ..."
        className="border p-2 w-full mt-2"
      />

      <MapContainer
        center={{ lat: 21.0285, lng: 105.8542 }}
        zoom={13}
        style={{ height: 250, width: "100%" }}
        className="mt-3"
      >
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <ClickableMap marker={newMarker} setMarker={setNewMarker} />
      </MapContainer>

      <button
        onClick={handleAddPickup}
        className="bg-green-600 text-white px-4 py-2 rounded mt-3"
      >
        ➕ Thêm địa chỉ
      </button>

      {/* PICKUP LIST */}
      <h2 className="text-xl font-semibold mt-6">Địa chỉ đã lưu</h2>

      <ul className="mt-2 space-y-2">
        {pickupList.length === 0 && <p>Chưa có địa chỉ nào.</p>}

        {pickupList.map((loc, index) => (
          <li
            key={index}
            className="p-3 border rounded flex justify-between items-center"
          >
            <div>
              📍 <strong>{loc.address}</strong>
              <br />
              lat: {loc.lat} - lng: {loc.lng}
            </div>

            <button
              onClick={() => handleDeletePickup(index)}
              className="bg-red-500 text-white px-2 py-1 rounded"
            >
              Xóa
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default CustomerProfile;
