import React, { useEffect, useState, useRef } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
  useMapEvents,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import axios from "axios";

// Fix icon lỗi
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.3/images/marker-icon-2x.png",
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.3/images/marker-icon.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.3/images/marker-shadow.png",
});

// Component chọn vị trí
function LocationSelector({ onSelect }) {
  useMapEvents({
    click(e) {
      const { lat, lng } = e.latlng;
      onSelect({ lat, lng });
    },
  });
  return null;
}

const MapPage = () => {
  const [locations, setLocations] = useState([]);
  const [selected, setSelected] = useState(null);
  const [orders, setOrders] = useState([]);
  const [routeCoords, setRouteCoords] = useState([]);
  const token = localStorage.getItem("token");

  // 🟢 1. Lấy danh sách đơn hàng để vẽ lộ trình (ví dụ đơn hàng đầu tiên)
  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const res = await axios.get("http://localhost:5000/api/orders", {
          headers: { Authorization: `Bearer ${token}` },
        });
        setOrders(res.data);

        // Lấy đơn hàng đầu tiên để demo
        if (res.data.length > 0) {
          const order = res.data[0];
          if (order.pickupLocation && order.deliveryLocation) {
  getRoute(order.pickupLocation, order.deliveryLocation);
}

        }
      } catch (err) {
        console.error("Lỗi tải đơn hàng:", err);
      }
    };
    fetchOrders();
  }, [token]);

  // 🟢 2. Lấy vị trí tài xế realtime
  useEffect(() => {
    const fetchLocations = async () => {
      try {
        const res = await axios.get("http://localhost:5000/api/location", {
          headers: { Authorization: `Bearer ${token}` },
        });
        setLocations(res.data);
      } catch (err) {
        console.error("Lỗi tải vị trí:", err);
      }
    };

    fetchLocations();
    const interval = setInterval(fetchLocations, 5000);
    return () => clearInterval(interval);
  }, [token]);

  // 🟢 3. Hàm tính route giữa 2 điểm (pickup → dropoff)
  const getRoute = async (pickup, dropoff) => {
  try {
    const orsApiKey = import.meta.env.VITE_ORS_API_KEY;
    const pickupLat = Array.isArray(pickup) ? pickup[0] : pickup.lat;
    const pickupLng = Array.isArray(pickup) ? pickup[1] : pickup.lng;
    const dropoffLat = Array.isArray(dropoff) ? dropoff[0] : dropoff.lat;
    const dropoffLng = Array.isArray(dropoff) ? dropoff[1] : dropoff.lng;


    const res = await axios.post(
      "https://api.openrouteservice.org/v2/directions/driving-car/geojson",
      {
        coordinates: [
          [pickup.lng, pickup.lat],
          [dropoff.lng, dropoff.lat],
        ],
      },
      {
        headers: {
          Authorization: orsApiKey,
          "Content-Type": "application/json",
        },
      }
    );

    const coords = res.data.features[0].geometry.coordinates.map(([lng, lat]) => [lat, lng]);
    setRouteCoords(coords);
  } catch (err) {
    console.error("Lỗi tính lộ trình:", err.response?.data || err);
  }
};

  return (
    <div className="p-4 h-full">
      <h2 className="text-xl font-semibold mb-3">Theo dõi tài xế & lộ trình đơn hàng</h2>

      <MapContainer
        center={[21.0285, 105.8542]} // Hà Nội
        zoom={13}
        style={{ height: "500px", width: "100%" }}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; OpenStreetMap contributors'
        />

        {/* Chọn tọa độ */}
        <LocationSelector onSelect={setSelected} />

        {/* Marker người dùng chọn */}
        {selected && (
          <Marker position={[selected.lat, selected.lng]}>
            <Popup>
              <b>Vị trí đã chọn</b>
              <br />
              Lat: {selected.lat.toFixed(5)} <br />
              Lng: {selected.lng.toFixed(5)}
            </Popup>
          </Marker>
        )}

        {/* Marker tài xế */}
        {Array.isArray(locations) &&
          locations.map((loc) => (
            <Marker key={loc._id} position={[loc.lat, loc.lng]}>
              <Popup>
                <b>Tài xế:</b> {loc.driverId?.name || "Không xác định"}
                <br />
                Vĩ độ: {loc.lat}
                <br />
                Kinh độ: {loc.lng}
              </Popup>
            </Marker>
          ))}

        {/* 🟩 Hiển thị lộ trình đơn hàng */}
        {routeCoords.length > 0 && (
          <Polyline positions={routeCoords} color="blue" weight={5} />
        )}
      </MapContainer>
    </div>
  );
};

export default MapPage;
