import jwt from "jsonwebtoken";
import AppError from "../utils/AppError.js";

export const protect = (roles = []) => (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) throw new AppError("Unauthorized – no token provided", 401);
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (roles.length && !roles.includes(decoded.role)) throw new AppError("Forbidden – insufficient role", 403);
    req.user = decoded;
    next();
  } catch (err) { next(err); }
};
