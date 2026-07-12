import AuditLog from "../../database/models/AuditLog.model.js";

const parseUserAgent = (uaString) => {
  if (!uaString) return { browser: "Unknown Browser", device: "Desktop" };
  
  let browser = "Unknown Browser";
  let device = "Desktop";

  const ua = uaString.toLowerCase();

  if (ua.includes("firefox")) {
    browser = "Firefox";
  } else if (ua.includes("opera") || ua.includes("opr")) {
    browser = "Opera";
  } else if (ua.includes("edge")) {
    browser = "Edge";
  } else if (ua.includes("chrome")) {
    browser = "Chrome";
  } else if (ua.includes("safari")) {
    browser = "Safari";
  } else if (ua.includes("msie") || ua.includes("trident")) {
    browser = "Internet Explorer";
  }

  if (ua.includes("mobi") || ua.includes("android") || ua.includes("iphone") || ua.includes("ipod")) {
    device = "Mobile";
  } else if (ua.includes("ipad") || (ua.includes("android") && !ua.includes("mobile"))) {
    device = "Tablet";
  }

  return { browser, device };
};

export const logOfficeCaptainAction = async ({
  officeId,
  captainId,
  action,
  reason,
  req,
  reqMetadata,
}) => {
  try {
    let ip = "Unknown IP";
    let browser = "Unknown Browser";
    let device = "Desktop";

    if (reqMetadata) {
      ip = reqMetadata.ip || "Unknown IP";
      browser = reqMetadata.browser || "Unknown Browser";
      device = reqMetadata.device || "Desktop";
      if (!reqMetadata.browser && reqMetadata.userAgent) {
        const parsed = parseUserAgent(reqMetadata.userAgent);
        browser = parsed.browser;
        device = parsed.device;
      }
    } else if (req) {
      ip = req.headers["x-forwarded-for"] || req.ip || req.socket.remoteAddress || "Unknown IP";
      if (ip.includes(",")) {
        ip = ip.split(",")[0].trim();
      }
      const userAgent = req.headers["user-agent"];
      const parsedUA = parseUserAgent(userAgent);
      browser = parsedUA.browser;
      device = parsedUA.device;
    }

    await AuditLog.create({
      officeId,
      captainId,
      action,
      reason,
      ip,
      browser,
      device,
      timestamp: new Date(),
    });
  } catch (err) {
    console.error("Failed to write audit log:", err);
  }
};
