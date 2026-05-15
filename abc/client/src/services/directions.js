
import axios from "axios";

const ORS_API_KEY =eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6IjUzZTk1ZmJjYjRlZjQ1NzA4ZmIwNzMwMzI0MDU3MzIyIiwiaCI6Im11cm11cjY0In0
; // Đăng ký miễn phí tại https://openrouteservice.org

export const getRoute = async (from, to) => {
  try {
    const res = await axios.post(
      "https://api.openrouteservice.org/v2/directions/driving-car/geojson",
      {
        coordinates: [
          [from.lng, from.lat], // Lưu ý: lng, lat
          [to.lng, to.lat],
        ],
      },
      {
        headers: {
          Authorization: ORS_API_KEY,
          "Content-Type": "application/json",
        },
      }
    );

    const geojson = res.data;
    const distance = geojson.features[0].properties.summary.distance / 1000; // km
    const route = geojson.features[0].geometry.coordinates.map(([lng, lat]) => [lat, lng]);
    return { distance, route };
  } catch (err) {
    console.error(err);
    return { distance: 0, route: [] };
  }
};
