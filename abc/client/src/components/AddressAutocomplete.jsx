import React, { useEffect, useState } from "react";
import axios from "axios";

function AddressAutocomplete({
  value,
  onChange,
  setLatitude,
  setLongitude,
}) {
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  useEffect(() => {
    const fetchAddresses = async () => {
      if (value.length < 3) {
        setSuggestions([]);
        return;
      }

      try {
        const res = await axios.get(
          `https://nominatim.openstreetmap.org/search`,
          {
            params: {
              q: value,
              format: "json",
              addressdetails: 1,
              limit: 5,
              countrycodes: "vn",
            },
          }
        );

        setSuggestions(res.data);
      } catch (err) {
        console.error(err);
      }
    };

    const debounce = setTimeout(fetchAddresses, 500);

    return () => clearTimeout(debounce);
  }, [value]);

  const handleSelect = (place) => {
    onChange(place.display_name);

    // ✅ Đã sửa: Kiểm tra xem có truyền props setLatitude không rồi mới gọi
    if (setLatitude) setLatitude(parseFloat(place.lat));
    if (setLongitude) setLongitude(parseFloat(place.lon));

    // Dọn rỗng mảng để tránh fetch lại và tắt hiển thị
    setSuggestions([]);
    setShowSuggestions(false);
  };

  return (
    <div className="relative w-full">
      <input
        type="text"
        value={value}
        placeholder="Nhập địa chỉ"
        onChange={(e) => {
          onChange(e.target.value);
          setShowSuggestions(true);
        }}
        className="border p-2 w-full rounded"
        required
      />

      {showSuggestions && suggestions.length > 0 && (
        <ul className="absolute bg-white border w-full mt-1 rounded shadow-lg z-50 max-h-60 overflow-y-auto">
          {suggestions.map((place, index) => (
            <li
              key={index}
              onMouseDown={() => handleSelect(place)} // ✅ Đổi onClick thành onMouseDown
              className="p-2 hover:bg-gray-100 cursor-pointer text-sm"
            >
              {place.display_name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default AddressAutocomplete;