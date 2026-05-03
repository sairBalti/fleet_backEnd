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
