import React from "react";
import { GeoSearchControl, OpenStreetMapProvider } from "leaflet-geosearch";
import { useMap } from "react-leaflet";
import "leaflet-geosearch/dist/geosearch.css";

const GeoSearchPickup = ({ setProfile }) => {
  const map = useMap();

  React.useEffect(() => {
    const provider = new OpenStreetMapProvider();
    const searchControl = new GeoSearchControl({
      provider,
      style: "bar",
      showMarker: true,
      showPopup: true,
      autoClose: true,
      retainZoomLevel: false,
      animateZoom: true,
      searchLabel: "Nhập địa chỉ lấy hàng...",
    });

    map.addControl(searchControl);

    map.on("geosearch/showlocation", (result) => {
      const { x, y, label } = result.location;
      setProfile((prev) => ({
        ...prev,
        address: label,
        pickupCoords: [y, x],
      }));
    });

    return () => map.removeControl(searchControl);
  }, [map, setProfile]);

  return null;
};

export default GeoSearchPickup;
