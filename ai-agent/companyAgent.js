// import OpenAI from "openai";
// import dotenv from "dotenv";

// dotenv.config();

// const openai = new OpenAI({
//   apiKey: process.env.OPENAI_API_KEY,
// });

// export const parseCompanyCommand = async (message) => {
//   try {
//     const response = await openai.chat.completions.create({
//       model: "gpt-4o",
//       messages: [
//         {
//           role: "system",
//           content: `You are a JSON converter. Convert user commands into structured JSON format.

// Allowed action: CREATE_COMPANY

// Expected JSON format:
// {
//   "action": "CREATE_COMPANY",
//   "data": {
//     "company_name": "string",
//     "business_type": "string"
//   }
// }

// Return ONLY valid JSON, no additional text.`,
//         },
//         {
//           role: "user",
//           content: message,
//         },
//       ],
//     });

//     const content = response.choices[0].message.content;
//     return JSON.parse(content);
//   } catch (error) {
//     console.error("Error parsing company command:", error);
//     throw error;
//   }
// };

// export default parseCompanyCommand;


export const parseCompanyCommand = async (message) => {
  if (!message) {
    throw new Error("Empty command");
  }

  const text = message.toLowerCase().trim();

  // =========================
  // Detect action
  // =========================
  let action = null;

  if (text.includes("add") || text.includes("create")) {
    action = "CREATE_COMPANY";
  } else if (text.includes("update") || text.includes("edit")) {
    action = "UPDATE_COMPANY";
  } else if (text.includes("Inactive") || text.includes("remove")) {
    action = "Inactive_COMPANY";
  }

  if (!action) {
    throw new Error("Unsupported command");
  }

  // =========================
  // Extract company name
  // =========================
  let company_name = "";

  const namePatterns = [
    /company\s+(.+?)\s+with/i,
    /add\s+(.+?)\s+company/i,
    /create\s+company\s+(.+?)\s+/i,
    /company\s+(.+)/i
  ];

  for (let pattern of namePatterns) {
    const match = message.match(pattern);
    if (match && match[1]) {
      company_name = match[1].trim();
      break;
    }
  }

  // =========================
  // Extract business type
  // =========================
  let business_type = "";

  const typePatterns = [
    /type\s+(.+)/i,
    /business\s+type\s+(.+)/i,
    /with\s+(.+?)\s+type/i,
    /with\s+(.+)/i
  ];

  for (let pattern of typePatterns) {
    const match = message.match(pattern);
    if (match && match[1]) {
      business_type = match[1].trim();
      break;
    }
  }

  // Clean extra words
  business_type = business_type
    .replace("business type", "")
    .replace("type", "")
    .trim();

  // Capitalize properly
  const capitalize = (str) =>
    str
      .split(" ")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");

  return {
    action,
    data: {
      company_name: capitalize(company_name),
      business_type: capitalize(business_type),
      
    },
  };
};

 export default parseCompanyCommand;