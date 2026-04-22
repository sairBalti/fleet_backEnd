// middleware/authorizeRoles.js
import { ROLES } from "../utils/roles.js";

export const authorizeRoles = (...allowedRoleIds) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (allowedRoleIds.length && !allowedRoleIds.includes(req.user.role_id)) {
      return res.status(403).json({ message: "Access denied" });
    }

    next();
  };
};
