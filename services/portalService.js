import db from "../config/db.js";

const defaultBusinessTypes = [
  "Logistics",
  "Transportations",
  "Delivery Services",
  "Constructions",
  "Maintaniance Services",
  "Rental Services",
  "Public Transport",
];

export const getRoleNavigation = async (roleName) => {
  const [result] = await db.execute("CALL portal_spGetRoleNavigation(?)", [roleName]);
  return result?.[0] || [];
};

const normalizeBusinessType = (value) => {
  const text = String(value || "").trim();
  if (!text) return "";
  const lowered = text.toLowerCase();
  if (lowered === "null" || lowered === "undefined") return "";
  return text;
};

export const getAvailableBusinessTypesForUser = async ({ userId, roleName }) => {
  if (["SuperAdmin", "Admin"].includes(roleName)) {
    const [lookupRows] = await db.execute(
      `SELECT DISTINCT business_type_name
       FROM lookup_businesstypes
       WHERE business_type_name IS NOT NULL
         AND TRIM(business_type_name) <> ''
       ORDER BY business_type_name`
    );
    const fromLookup = lookupRows.map((r) => normalizeBusinessType(r.business_type_name)).filter(Boolean);
    if (fromLookup.length) return fromLookup;

    const [companyRows] = await db.execute(
      `SELECT DISTINCT bt.business_type_name
       FROM companies c
       LEFT JOIN lookup_businesstypes bt ON bt.business_type_id = c.business_type_id
       WHERE c.isDeleted = 0
       ORDER BY bt.business_type_name`
    );
    const fromCompanies = companyRows.map((r) => normalizeBusinessType(r.business_type_name)).filter(Boolean);
    return fromCompanies.length ? fromCompanies : defaultBusinessTypes;
  }

  const [rows] = await db.execute(
    `SELECT bt.business_type_name
     FROM users u
     LEFT JOIN companies c ON c.company_id = u.company_id
     LEFT JOIN lookup_businesstypes bt ON bt.business_type_id = c.business_type_id
     WHERE u.id = ?
     LIMIT 1`,
    [userId]
  );
  const single = normalizeBusinessType(rows?.[0]?.business_type_name);
  return single ? [single] : [];
};

const CONSTRUCTION_MODULES = [
  {
    title: "Dashboard",
    iconKey: "dashboard",
    submodules: [
      { name: "KPIs", path: "/dashboard/kpis" },
      { name: "Real Time Statistics", path: "/dashboard/realtime" },
    ],
  },
  {
    title: "Projects",
    iconKey: "projects",
    submodules: [
      { name: "Project List", path: "/construction/projects" },
      { name: "Project Dashboard", path: "/construction/projects/dashboard" },
    ],
  },
  {
    title: "Workforce",
    iconKey: "workforce",
    submodules: [{ name: "Labor & Attendance", path: "/construction/workforce" }],
  },
  {
    title: "Equipment",
    iconKey: "equipment",
    submodules: [{ name: "Machinery Tracking", path: "/construction/equipment" }],
  },
  {
    title: "Materials",
    iconKey: "inventory",
    submodules: [{ name: "Inventory & Procurement", path: "/construction/materials" }],
  },
  {
    title: "Finance",
    iconKey: "finance",
    submodules: [{ name: "Budget & Expenses", path: "/construction/finance" }],
  },
  {
    title: "Inspections",
    iconKey: "inspection",
    submodules: [{ name: "Quality & Safety", path: "/construction/inspections" }],
  },
  {
    title: "Reports",
    iconKey: "reports",
    submodules: [{ name: "Construction Reports", path: "/construction/reports" }],
  },
  {
    title: "Documents",
    iconKey: "documents",
    submodules: [{ name: "Project Documents", path: "/construction/documents" }],
  },
  {
    title: "Chat",
    iconKey: "chat",
    submodules: [{ name: "Chat", path: "/chat" }],
  },
  {
    title: "Help Desk",
    iconKey: "help",
    submodules: [{ name: "Help Desk", path: "/helpdesk" }],
  },
];

const CONSTRUCTION_ROLE_RULES = {
  SuperAdmin: [/.*/],
  Admin: [/.*/],
  CompanyAdmin: [/.*/],
  CompanyManager: [/.*/],
  ConstructionAdmin: [/.*/],
  ProjectManager: [
    /^\/dashboard\//,
    /^\/construction\/(projects|projects\/dashboard|workforce|equipment|materials|finance|inspections|reports|documents)$/,
    /^\/chat$/,
    /^\/helpdesk$/,
  ],
  SiteEngineer: [
    /^\/dashboard\//,
    /^\/construction\/(projects|projects\/dashboard|equipment|inspections|documents)$/,
    /^\/chat$/,
    /^\/helpdesk$/,
  ],
  Supervisor: [
    /^\/dashboard\//,
    /^\/construction\/(projects|projects\/dashboard|workforce|inspections)$/,
    /^\/chat$/,
    /^\/helpdesk$/,
  ],
  Accountant: [
    /^\/dashboard\//,
    /^\/construction\/(projects\/dashboard|finance|reports)$/,
    /^\/chat$/,
    /^\/helpdesk$/,
  ],
  Contractor: [
    /^\/dashboard\//,
    /^\/construction\/(projects|projects\/dashboard|documents)$/,
    /^\/chat$/,
    /^\/helpdesk$/,
  ],
  Worker: [
    /^\/dashboard\//,
    /^\/construction\/(workforce|projects|projects\/dashboard)$/,
    /^\/chat$/,
    /^\/helpdesk$/,
  ],
};

export const getUserBusinessType = async (userId) => {
  const [rows] = await db.execute(
    `SELECT bt.business_type_name AS business_type_name
     FROM users u
     LEFT JOIN companies c ON c.company_id = u.company_id
     LEFT JOIN lookup_businesstypes bt ON bt.business_type_id = c.business_type_id
     WHERE u.id = ?
     LIMIT 1`,
    [userId]
  );
  return rows?.[0]?.business_type_name || null;
};

export const getConstructionNavigation = (roleName) => {
  const rules = CONSTRUCTION_ROLE_RULES[roleName] || [];
  const allow = (path) => rules.some((regex) => regex.test(path));

  return CONSTRUCTION_MODULES.map((module) => ({
    ...module,
    submodules: module.submodules.filter((submodule) => allow(submodule.path)),
  })).filter((module) => module.submodules.length > 0);
};

export const getBusinessTypeIntelligence = async (businessType) => {
  const selectedType = businessType && defaultBusinessTypes.includes(businessType) ? businessType : "Logistics";

  const insights = {
    Logistics: [
      "Predict ETA deviations using historical lane and weather behavior.",
      "Optimize loading plan and reduce empty return miles.",
      "Flag delayed handoffs early with route risk scoring.",
    ],
    Transportations: [
      "Balance fleet utilization across routes and service windows.",
      "Auto-prioritize high-value trips during peak congestion.",
      "Predict route overflow and suggest dynamic allocation.",
    ],
    "Delivery Services": [
      "Improve first-attempt delivery success using address intelligence.",
      "Detect delivery hotspots and optimize dispatch sequencing.",
      "Forecast late-delivery probability before dispatch.",
    ],
    Constructions: [
      "Track heavy equipment movement and idle-time inefficiencies.",
      "Predict maintenance windows around project timelines.",
      "Improve utilization of rented vs owned assets.",
    ],
    "Maintaniance Services": [
      "Predict technician route clusters and spare-part demand.",
      "Auto-schedule preventive tasks based on utilization patterns.",
      "Reduce emergency callouts through early anomaly detection.",
    ],
    "Rental Services": [
      "Forecast demand by zone and season for better placement.",
      "Track contract utilization and return-risk alerts.",
      "Recommend dynamic pricing bands from fleet occupancy.",
    ],
    "Public Transport": [
      "Predict crowding and route punctuality degradation.",
      "Alert on service reliability risks during rush windows.",
      "Optimize dispatch headways using live passenger patterns.",
    ],
  };

  return {
    businessTypes: defaultBusinessTypes,
    selectedType,
    insights: insights[selectedType] || insights.Logistics,
  };
};

export const getDashboardKpiData = async ({ companyId, branchId, userId }) => {
  const [result] = await db.execute("CALL portal_spDashboardKpiData(?,?,?)", [
    companyId || null,
    branchId || null,
    userId,
  ]);

  return {
    summary: result?.[0]?.[0] || {},
    driverProductivity: result?.[1] || [],
    routeCompliance: result?.[2]?.[0] || {},
    driversList: result?.[3] || [],
    notifications: result?.[4] || [],
  };
};
