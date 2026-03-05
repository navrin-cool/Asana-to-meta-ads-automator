import express from "express";
import cors from "cors";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import fs from "fs";
import axios from "axios";
import { clientsConfig } from "./config/clientsConfig";
import { 
  createMetaCampaign, 
  fetchLocationData, 
  fetchAdAccounts, 
  fetchPages 
} from "./services/metaService";

dotenv.config();

process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
});

const app = express();
const PORT = 3000;

const logToFile = (msg: string) => {
  try {
    const timestamp = new Date().toISOString();
    const logLine = `[${timestamp}] ${msg}\n`;
    console.log(logLine.trim());
    fs.appendFileSync("server.log", logLine);
  } catch (e) {}
};

logToFile("Server initialization started...");

app.use(cors());
app.use(express.json());

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", uptime: process.uptime() });
});

app.get("/api/test", (req, res) => {
  res.json({ status: "ok" });
});

// Helper to convert Drive/Dropbox links to download links (Shared utility)
const getDownloadUrl = (url: string) => {
  if (!url) return url;
  let cleanUrl = url.trim();
  
  if (cleanUrl.includes("dropbox.com")) {
    if (cleanUrl.includes("dl=0")) {
      return cleanUrl.replace("dl=0", "dl=1");
    } else if (!cleanUrl.includes("dl=1")) {
      return cleanUrl.includes("?") ? `${cleanUrl}&dl=1` : `${cleanUrl}?dl=1`;
    }
    return cleanUrl;
  }
  
  if (cleanUrl.includes("drive.google.com")) {
    const match = cleanUrl.match(/\/d\/([^/]+)/) || cleanUrl.match(/id=([^&]+)/);
    if (match) {
      return `https://drive.google.com/uc?export=download&id=${match[1]}`;
    }
  }
  
  return cleanUrl;
};

// API Routes
app.get("/api/locations", async (req, res) => {
  logToFile("GET /api/locations");
  try {
    const { displayNames } = await fetchLocationData();
    const locationNames = Object.values(displayNames).sort();
    res.json(locationNames);
  } catch (error: any) {
    logToFile(`Error /api/locations: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/fetch-brief", async (req, res) => {
  const { asanaUrl, csvData, csvName } = req.body;
  try {
    const ASANA_PAT = process.env.ASANA_PAT;
    if (!ASANA_PAT) throw new Error("Missing ASANA_PAT");

    const taskIdMatch = asanaUrl.match(/asana\.com\/(?:.*\/task\/|0\/\d+\/)(\d+)/);
    if (!taskIdMatch) throw new Error("Invalid Asana URL format.");
    const taskId = taskIdMatch[1];

    const asanaResponse = await axios.get(`https://app.asana.com/api/1.0/tasks/${taskId}`, {
      headers: { Authorization: `Bearer ${ASANA_PAT}` }
    });
    const asanaData = asanaResponse.data;
    if (!asanaData.data) throw new Error("Failed to fetch Asana task data.");

    const customFields = asanaData.data.custom_fields;
    const getField = (name: string) => customFields.find((f: any) => f.name === name)?.display_value;

    const objective = getField("Objective") || "Sales";
    const startDateRaw = getField("Start Date");
    const endDateRaw = getField("End Date");

    const formatDate = (dateStr: string, time: string) => {
      if (!dateStr) return null;
      return `${dateStr}T${time}:00+08:00`;
    };

    const movieTitle = getField("Movie Title") || "Untitled Movie";

    const brief = {
      movieName: movieTitle,
      movieTitle: movieTitle,
      objective,
      startDate: formatDate(startDateRaw, "09:00"),
      endDate: formatDate(endDateRaw, "23:59"),
      budget: parseFloat(getField("Budget") || "0"),
      copy: getField("Copy") || "",
      thumbnail: getDownloadUrl(getField("Thumbnail")),
      headline: getField("Headline") || "",
      url: getField("URL") || "",
      locations: (getField("Locations") || "").split(",").map((l: string) => l.trim()).filter(Boolean),
      feedVideoUrl: getDownloadUrl(getField("Feed Video 1")),
      verticalVideoUrl: getDownloadUrl(getField("Vertical Video 1")),
      csvData,
      csvName,
      instagramUserId: getField("Instagram Page ID") || "102615919157239"
    };

    res.json(brief);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/meta/ad-accounts", async (req, res) => {
  const clientId = (req.query.clientId as string) || "palace-cinemas";
  try {
    const client = clientsConfig[clientId];
    if (!client?.platforms.meta) throw new Error(`Client or Meta config not found for ${clientId}`);
    const accounts = await fetchAdAccounts(client.platforms.meta.accessToken);
    res.json(accounts);
  } catch (error: any) {
    console.error("Ad Accounts Error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/meta/pages", async (req, res) => {
  const clientId = (req.query.clientId as string) || "palace-cinemas";
  try {
    const client = clientsConfig[clientId];
    if (!client?.platforms.meta) {
      throw new Error(`Client or Meta config not found for ${clientId}`);
    }
    const pages = await fetchPages(client.platforms.meta.accessToken);
    res.json(pages);
  } catch (error: any) {
    console.error("Pages Error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/meta/instagram-account", async (req, res) => {
  const { clientId, pageId } = req.query;
  try {
    const client = clientsConfig[clientId as string];
    if (!client?.platforms.meta) throw new Error("Client or Meta config not found");
    const pages = await fetchPages(client.platforms.meta.accessToken);
    const page = pages.find((p: any) => p.id === pageId);
    if (!page) throw new Error("Page not found");
    res.json(page.instagram_business_account || null);
  } catch (error: any) {
    console.error("Instagram Account Error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/launch-campaign", async (req, res) => {
  const { clientId, platform, brief } = req.body;

  try {
    const client = clientsConfig[clientId];
    if (!client) {
      return res.status(404).json({ error: `Client '${clientId}' not found in configuration.` });
    }

    if (platform === 'meta') {
      const metaConfig = client.platforms.meta;
      if (!metaConfig) {
        return res.status(400).json({ error: `Meta configuration missing for client '${clientId}'.` });
      }
      
      const result = await createMetaCampaign(metaConfig, brief);
      return res.json(result);
    } 
    
    // Placeholder for future platforms
    if (platform === 'tiktok') {
      return res.status(501).json({ error: "TikTok integration is coming soon." });
    }

    return res.status(400).json({ error: `Unsupported platform: ${platform}` });

  } catch (error: any) {
    console.error("Launch Error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Start server
const server = app.listen(PORT, "0.0.0.0", () => {
  logToFile(`Server listening on port ${PORT}`);
  logToFile(`Node version: ${process.version}`);
});

// Vite middleware for development
if (process.env.NODE_ENV !== "production") {
  logToFile("Starting Vite in middleware mode...");
  createViteServer({
    server: { middlewareMode: true },
    appType: "spa",
  }).then(vite => {
    app.use(vite.middlewares);
    logToFile("Vite middleware attached.");
  }).catch(err => {
    logToFile(`Vite initialization failed: ${err.message}`);
  });
}

// Global error handler
app.use((err: any, req: any, res: any, next: any) => {
  logToFile(`Unhandled Error: ${err.message}`);
  console.error("Unhandled Error:", err);
  res.status(500).json({ error: "Internal Server Error", message: err.message });
});
