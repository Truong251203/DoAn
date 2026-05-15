import React, { useEffect } from "react";
import { GeoSearchControl, OpenStreetMapProvider } from "leaflet-geosearch";
import { useMap } from "react-leaflet";
import "leaflet-geosearch/assets/css/leaflet.css";
import L from "leaflet";

const GeoSearchComponent = ({ setNewOrder, setProfile, profile, mode = "order" }) => {
  const map = useMap();

  useEffect(() => {
    const provider = new OpenStreetMapProvider();

    const searchControl = new GeoSearchControl({
      provider,
      style: "bar",
      showMarker: true,
      showPopup: true,
      autoClose: true,
      retainZoomLevel: false,
      searchLabel: "Nhập địa chỉ để tìm...",
      keepResult: true,
    });

    map.addControl(searchControl);

    map.on("geosearch/showlocation", (e) => {
  const loc = e.location;
  const lat = loc.y || loc.raw?.lat;
  const lng = loc.x || loc.raw?.lon;
  const label = loc.label;

  console.log("📍 Đã chọn:", label, lat, lng);


      if (mode === "order" && setNewOrder) {
        setNewOrder((prev) => ({
          ...prev,
          deliveryAddress: label,
          deliveryCoords: {lat, lng},
        }));
      }

      if (mode === "profile" && setProfile) {
        setProfile({
          ...profile,
          pickupCoords: { lat: lat, lng: lng },
          address: label,
        });
      }

      // Thêm marker đảm bảo hiển thị
      L.marker([lat, lng]).addTo(map).bindPopup(label).openPopup();
    });

    return () => {
      map.removeControl(searchControl);
      map.off("geosearch/showlocation");
    };
  }, [map, mode, setNewOrder, setProfile, profile]);

  return null;
};

export default GeoSearchComponent;
