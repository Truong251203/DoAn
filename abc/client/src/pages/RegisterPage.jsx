import React, { useState } from "react";
import api from "../services/api";
import { useNavigate } from "react-router-dom";
import AddressAutocomplete from "../components/AddressAutocomplete";

function RegisterPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState(""); // Chỉ giữ lại state địa chỉ
  const [role, setRole] = useState("customer");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      // Chỉ gửi address chữ, không gửi tọa độ nữa
      const res = await api.post("/auth/register", {
        name,
        email,
        password,
        phone,
        address,
        role,
      });

      setMessage(res.data.message);

      setTimeout(() => {
        navigate("/login");
      }, 2000);
    } catch (err) {
      setError(err.response?.data?.message || "Lỗi đăng ký");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 py-10">
      <form
        onSubmit={handleSubmit}
        className="bg-white p-8 rounded shadow-md w-[500px]"
      >
        <h2 className="text-2xl font-bold mb-6 text-center">Đăng ký</h2>

        {message && <p className="text-green-600 mb-4">{message}</p>}
        {error && <p className="text-red-500 mb-4">{error}</p>}

        <input
          type="text"
          placeholder="Họ và tên"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="border p-2 w-full mb-4 rounded"
          required
        />

        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="border p-2 w-full mb-4 rounded"
          required
        />

        <input
          type="password"
          placeholder="Mật khẩu"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="border p-2 w-full mb-4 rounded"
          required
        />

        <input
          type="tel"
          placeholder="Số điện thoại"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="border p-2 w-full mb-4 rounded"
          required
        />

        {/* Ô nhập địa chỉ có gợi ý, không cho gõ bừa */}
        <div className="mb-4">
          <AddressAutocomplete
            value={address}
            onChange={setAddress}
          />
        </div>

        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="border p-2 w-full mb-6 rounded"
        >
          <option value="customer">Khách hàng</option>
          <option value="driver">Tài xế</option>
        </select>

        <button
          type="submit"
          className="w-full bg-green-600 text-white py-2 rounded hover:bg-green-700 transition"
        >
          Đăng ký
        </button>
      </form>
    </div>
  );
}

export default RegisterPage;