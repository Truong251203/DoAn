import React, { useState } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import GeoSearchComponent from "./GeoSearchComponent";

// Fix lỗi marker không hiện (do thiếu icon mặc định)
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const MapComponent = ({ newOrder, setNewOrder }) => {
  const [position, setPosition] = useState(
    newOrder.deliveryCoords || [21.0285, 105.8542] // Mặc định: Hà Nội
  );

  return (
    <div className="w-full h-[500px] rounded-2xl overflow-hidden shadow-md">
      <MapContainer
        center={position}
        zoom={13}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Component tìm kiếm địa chỉ */}
        <GeoSearchComponent setNewOrder={setNewOrder} />

        {/* Marker hiển thị sau khi chọn địa chỉ */}
        {newOrder.deliveryCoords && (
          <Marker position={newOrder.deliveryCoords}>
            <Popup>
              <b>Địa chỉ giao:</b> {newOrder.deliveryAddress}
            </Popup>
          </Marker>
        )}
      </MapContainer>
    </div>
  );
};

export default MapComponent;
