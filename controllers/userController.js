import db from "../config/db.js";
import bcrypt from "bcrypt";

export const createUser = async (req, res) => {
  try {
    const {
      firstname,
      lastname,
      phone,
      email,
      password,
      role_id,
      company_id,
      branch_id = "",
      created_by
    } = req.body;

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    const [rows] = await db.execute(
      "CALL portal_spUserInsert(?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [
        firstname,
        lastname,
        phone,
        email,
        passwordHash,
        role_id,
        company_id,
        branch_id,
        created_by
      ]
    );

    res.json({
      success: true,
      message: "User created successfully",
      userId: rows[0][0].NewUserId
    });
  } catch (error) {
    console.error("Error in createUser:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};