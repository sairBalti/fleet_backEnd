import pool from "../config/db.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
dotenv.config();
// Helper: validate email
const isValidEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
};

export const login = async (req, res) => {
    const { email, password } = req.body;

    try {
        // ==============================
        // 1. Input validation
        // ==============================
        if (!email || !password) {
            return res.status(400).json({ success: false, message: "Email and password are required" });
        }

        if (!isValidEmail(email)) {
            return res.status(400).json({ success: false, message: "Invalid email format" });
        }

        if (password.length < 8) {
            return res.status(400).json({ success: false, message: "Password must be at least 8 characters" });
        }

        // ==============================
        // 2. Call stored procedure
        // ==============================
        const [rows] = await pool.query("CALL portal_spUserLogin(?)", [email]);

        // MySQL stored procedure returns nested arrays
        const user = rows[0][0];

        if (!user) {
            return res.status(401).json({ success: false, message: "Invalid email or password" });
        }

        // ==============================
        // 3. Compare password securely
        // ==============================
        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            return res.status(401).json({ success: false, message: "Invalid email or password" });
        }
        // After user is fetched from DB
        if (Number(user.isActive) !== 1 || user.role === "UnauthorizedRole") {
            return res.status(403).json({
                success: false,
                message: "Unauthorized access. Please contact admin.",
            });
        }
        //  Generate JWT
        const jwtToken = jwt.sign(
            {
                user_id: user.user_id,
                email: user.email,
                role_id: user.role_id,   // from DB
                role: user.role,         // from joined lookup_roles
                company_ids: user.company_id ? String(user.company_id) : null,
                branch_ids: user.branch_id ? String(user.branch_id) : null
            },
            process.env.JWT_SECRET,
            { expiresIn: "1h" } // token valid for 1 hour
        );

        // ==============================
        // 4. Success response
        // ==============================
        return res.status(200).json({
            success: true,
            message: "Login successful",
            jwtToken,
            user: {
                user_id: user.user_id,
                email: user.email,
                role: user.role,
                company: user.company_name,
                company_active: user.company_active,
            },
        });
    } catch (error) {
        console.error("Login error:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};
