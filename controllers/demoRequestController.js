import db from "../config/db.js";
import nodemailer from "nodemailer";

const createTableQuery = `
  CREATE TABLE IF NOT EXISTS demo_requests (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    full_name VARCHAR(120) NOT NULL,
    email VARCHAR(190) NOT NULL,
    company_name VARCHAR(160) NOT NULL,
    business_type VARCHAR(120) NOT NULL,
    fleet_size VARCHAR(80) NULL,
    preferred_date DATE NULL,
    goals TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id)
  )
`;

const hasMailConfig = () =>
  process.env.SMTP_HOST &&
  process.env.SMTP_PORT &&
  process.env.SMTP_USER &&
  process.env.SMTP_PASS &&
  process.env.SMTP_FROM &&
  process.env.DEMO_REQUEST_TO;

const sendDemoRequestEmail = async (payload) => {
  if (!hasMailConfig()) {
    return false;
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to: process.env.DEMO_REQUEST_TO,
    subject: `New Demo Request - ${payload.companyName}`,
    text: [
      `Full Name: ${payload.fullName}`,
      `Email: ${payload.email}`,
      `Company Name: ${payload.companyName}`,
      `Business Type: ${payload.businessType}`,
      `Fleet Size: ${payload.fleetSize || "-"}`,
      `Preferred Demo Date: ${payload.preferredDate || "-"}`,
      `Goals: ${payload.goals || "-"}`,
    ].join("\n"),
  });

  return true;
};

export const submitDemoRequest = async (req, res, next) => {
  try {
    const { fullName, email, companyName, businessType, fleetSize, preferredDate, goals } = req.body;

    if (!fullName || !email || !companyName || !businessType) {
      return res.status(400).json({
        success: false,
        message: "fullName, email, companyName and businessType are required",
      });
    }

    await db.execute(createTableQuery);

    const insertQuery = `
      INSERT INTO demo_requests (
        full_name, email, company_name, business_type, fleet_size, preferred_date, goals
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    await db.execute(insertQuery, [
      fullName,
      email,
      companyName,
      businessType,
      fleetSize || null,
      preferredDate || null,
      goals || null,
    ]);

    const emailSent = await sendDemoRequestEmail({
      fullName,
      email,
      companyName,
      businessType,
      fleetSize,
      preferredDate,
      goals,
    });

    return res.status(201).json({
      success: true,
      message: "Demo request submitted successfully",
      data: { emailSent },
    });
  } catch (error) {
    return next(error);
  }
};

export const getDemoRequestMainPageData = async (req, res, next) => {
  try {
    let {
      pageNumber = 1,
      pageSize = 20,
      sortColumn = "created_at",
      sortDirection = "DESC",
      nameFilter = null,
      emailFilter = null,
      businessTypeFilter = null,
      startDate = null,
      endDate = null,
    } = req.body;

    pageNumber = Number(pageNumber) > 0 ? Number(pageNumber) : 1;
    pageSize = Number(pageSize) > 0 ? Number(pageSize) : 20;

    const allowedSortColumns = [
      "id",
      "full_name",
      "email",
      "company_name",
      "business_type",
      "fleet_size",
      "preferred_date",
      "created_at",
    ];
    if (!allowedSortColumns.includes(sortColumn)) {
      sortColumn = "created_at";
    }

    sortDirection = String(sortDirection || "DESC").toUpperCase() === "ASC" ? "ASC" : "DESC";

    const [result] = await db.execute("CALL portal_spDemoRequestMainPageData(?,?,?,?,?,?,?,?,?)", [
      pageNumber,
      pageSize,
      sortColumn,
      sortDirection,
      nameFilter,
      emailFilter,
      businessTypeFilter,
      startDate,
      endDate,
    ]);

    const data = result[0] || [];
    const totalRecords = result[1]?.[0]?.totalRecords || 0;

    return res.status(200).json({
      success: true,
      data,
      pagination: {
        pageNumber,
        pageSize,
        totalRecords,
        totalPages: Math.ceil(totalRecords / pageSize),
      },
    });
  } catch (error) {
    return next(error);
  }
};
