const jwt = require("jsonwebtoken");
const User = require("../models/User");

const verifyToken = (req, res, next) => {
    const authHeader = req.headers.authorization || req.headers.Authorization;
    
    if (authHeader && authHeader.startsWith("Bearer ")) {
        const token = authHeader.split(" ")[1];
        
        jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
            if (err) return res.status(401).json({ message: "Token không hợp lệ hoặc đã hết hạn!" });
            
            try {
                // 🔥 NÂNG CẤP BẢO MẬT: Kiểm tra trực tiếp trong Database xem user có bị khóa không
                const user = await User.findById(decoded.id);
                if (!user) return res.status(404).json({ message: "Người dùng không tồn tại" });
                
                if (user.status === 'locked') {
                    return res.status(403).json({ 
                        code: 'ACCOUNT_LOCKED', 
                        message: 'Tài khoản của bạn đã bị khóa!',
                        email: user.email
                    });
                }

                req.user = decoded; // Nếu qua ải, cho phép đi tiếp
                next();
            } catch (error) {
                res.status(500).json({ message: "Lỗi server khi xác thực" });
            }
        });
    } else {
        return res.status(401).json({ message: "Bạn chưa xác thực!" });
    }
};

const verifyAdmin = (req, res, next) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "Chỉ admin được truy cập" });
  }
  next();
};

const verifyCoordinator = (req, res, next) => {
  if (req.user.role !== "coordinator") {
    return res.status(403).json({ message: "Chỉ người điều phối được truy cập" });
  }
  next();
};

const verifyCustomer = (req, res, next) => {
  if (req.user.role !== "customer") {
    return res.status(403).json({ message: "Chỉ khách hàng được truy cập" });
  }
  next();
};

const verifyDriver = (req, res, next) => {
  if (req.user.role !== "driver") {
    return res.status(403).json({ message: "Chỉ tài xế được truy cập" });
  }
  next();
};

module.exports = {
  verifyToken,
  verifyAdmin,
  verifyCoordinator,
  verifyCustomer,
  verifyDriver,
};
