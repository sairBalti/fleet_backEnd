import jwt from "jsonwebtoken";

const verifyToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];

  if (!authHeader) {
    return res.status(401).json({ message: "No token provided" });
  }

  const [scheme, token] = authHeader.split(" ");

  if (!/^Bearer$/i.test(scheme) || !token) {
    return res.status(401).json({ message: "Invalid authorization format" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Validate required fields
    if (!decoded.user_id || !decoded.role_id) {
      return res.status(401).json({ message: "Invalid token payload" });
    }

    req.user = {
      user_id: decoded.user_id,
      role_id: decoded.role_id,
      role: decoded.role,    
      //  ACCESS CONTROL
      company_ids: decoded.company_ids || null,
      branch_ids: decoded.branch_ids || null
    };
    console.log("DECODED USER:", req.user);

    next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};

export default verifyToken;