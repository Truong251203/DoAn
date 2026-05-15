import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { UserProvider } from "./services/userContext";

// Import CSS
import "./index.css"; 
import "leaflet/dist/leaflet.css";
import "react-datepicker/dist/react-datepicker.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  // Bỏ StrictMode nếu muốn log console đỡ bị double (tùy chọn)
  <React.StrictMode> 
    <UserProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </UserProvider>
  </React.StrictMode>
);