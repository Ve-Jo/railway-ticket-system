export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    const userRole = req.session?.user?.role;

    if (!userRole) {
      return res.status(401).json({
        message: "Authentication required"
      });
    }

    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({
        message: "Forbidden"
      });
    }

    return next();
  };
}
