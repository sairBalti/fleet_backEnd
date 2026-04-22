export const errorHandler = (err, req, res, next) => {
    console.error("ERROR With:", err);

    // ADD THIS LINE HERE
    console.log("ERROR META:", err.meta);
   
    res.status(err.statusCode || 500).json({
        success: false,
        message: err.message || "Internal Server Error",
        code: err.code || "SERVER_ERROR",
        field: err.meta?.field || null,
        details: err.meta?.details || null   //  REQUIRED
    });
};
