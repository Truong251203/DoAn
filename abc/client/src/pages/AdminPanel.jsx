import React, { useEffect, useState } from "react";
import axios from "axios";
import { useUser } from "../services/userContext";

const AdminPanel = () => {
  const [pendingUsers, setPendingUsers] = useState([]);
  const { user } = useUser();

  useEffect(() => {
    const fetchPending = async () => {
      const token = localStorage.getItem("token");
      const res = await axios.get("/api/users/pending", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setPendingUsers(res.data);
    };
    fetchPending();
  }, []);

  const approveUser = async (id) => {
    const token = localStorage.getItem("token");
    await axios.put(`/api/users/approve/${id}`, {}, {
      headers: { Authorization: `Bearer ${token}` },
    });
    setPendingUsers((prev) => prev.filter((u) => u._id !== id));
  };

  const deleteUser = async (id) => {
    const token = localStorage.getItem("token");
    await axios.delete(`/api/users/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    setPendingUsers((prev) => prev.filter((u) => u._id !== id));
  };

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">Phê duyệt tài khoản</h2>
      {pendingUsers.map((user) => (
        <div key={user._id} className="flex items-center justify-between border p-2 mb-2">
          <span>{user.name} ({user.email}) - {user.role}</span>
          <div className="space-x-2">
            <button onClick={() => approveUser(user._id)} className="bg-green-500 px-2 py-1 text-white rounded">
              Duyệt
            </button>
            <button onClick={() => deleteUser(user._id)} className="bg-red-500 px-2 py-1 text-white rounded">
              Xóa
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

export default AdminPanel;
