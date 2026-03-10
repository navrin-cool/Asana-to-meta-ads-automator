import express from "express";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import fetch from "node-fetch";
import crypto from "crypto";
import Database from "better-sqlite3";
import fs from "fs";
import { parse } from "csv-parse/sync";

dotenv.config();

const db = new Database("campaign_automator.db");

// Initialize Database Tables
db.exec(`
  DROP TABLE IF EXISTS locations;
  DROP TABLE IF EXISTS brands;
  DROP TABLE IF EXISTS clients;

  CREATE TABLE clients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE,
    meta_ad_account_id TEXT,
    meta_access_token TEXT,
    meta_pixel_id TEXT,
    asana_pat TEXT
  );

  CREATE TABLE brands (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER,
    brand_name TEXT,
    meta_page_id TEXT,
    instagram_page_id TEXT,
    tiktok_page_id TEXT,
    tiktok_ad_account_id TEXT,
    tiktok_pixel_id TEXT,
    tiktok_access_token TEXT,
    UNIQUE(client_id, brand_name),
    FOREIGN KEY (client_id) REFERENCES clients(id)
  );

  CREATE TABLE locations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    brand_id INTEGER,
    cinema_name TEXT,
    latitude REAL,
    longitude REAL,
    radius INTEGER,
    distance_unit TEXT,
    json_snippet TEXT,
    UNIQUE(brand_id, cinema_name),
    FOREIGN KEY (brand_id) REFERENCES brands(id)
  );
`);

// Seeding Function
const seedDatabase = () => {
  console.log("Seeding database from CSV files...");
  
  try {
    // 1. Seed Clients and Brands
    const brandsCsvPath = "./data/Automated Ads Setup Tool - Page_Profile IDs.csv";
    if (fs.existsSync(brandsCsvPath)) {
      const brandsContent = fs.readFileSync(brandsCsvPath, "utf-8");
      const brandsRecords = parse(brandsContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true
      });

      for (const record of brandsRecords as any[]) {
        // Insert/Update Client
        const clientName = record.CLIENT_NAME;
        if (!clientName) continue;

        // CRITICAL FIX: Meta Ad Account ID formatting
        let metaAdAccountId = record.META_AD_ACCOUNT_ID;
        if (metaAdAccountId && metaAdAccountId.startsWith("act=")) {
          metaAdAccountId = metaAdAccountId.replace("=", "_");
        } else if (metaAdAccountId && !metaAdAccountId.startsWith("act_")) {
          metaAdAccountId = `act_${metaAdAccountId}`;
        }

        db.prepare(`
          INSERT INTO clients (name, meta_ad_account_id, meta_access_token, meta_pixel_id, asana_pat)
          VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(name) DO UPDATE SET
            meta_ad_account_id = excluded.meta_ad_account_id,
            meta_access_token = excluded.meta_access_token,
            meta_pixel_id = excluded.meta_pixel_id,
            asana_pat = excluded.asana_pat
        `).run(
          clientName,
          metaAdAccountId,
          record.META_ACCESS_TOKEN,
          record.META_PIXEL_ID,
          record.ASANA_PAT
        );

        const client = db.prepare("SELECT id FROM clients WHERE name = ?").get(clientName) as any;
        const clientId = client.id;

        // Insert/Replace Brand
        db.prepare(`
          INSERT INTO brands (
            client_id, brand_name, meta_page_id, instagram_page_id, tiktok_page_id,
            tiktok_ad_account_id, tiktok_pixel_id, tiktok_access_token
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(client_id, brand_name) DO UPDATE SET
            meta_page_id = excluded.meta_page_id,
            instagram_page_id = excluded.instagram_page_id,
            tiktok_page_id = excluded.tiktok_page_id,
            tiktok_ad_account_id = excluded.tiktok_ad_account_id,
            tiktok_pixel_id = excluded.tiktok_pixel_id,
            tiktok_access_token = excluded.tiktok_access_token
        `).run(
          clientId,
          record.BRAND_NAME,
          record.META_PAGE_ID,
          record.INSTAGRAM_PAGE_ID,
          record.TIKTOK_PAGE_ID,
          record.TIKTOK_AD_ACCOUNT_ID,
          record.TIKTOK_PIXEL_ID,
          record.TIKTOK_ACCESS_TOKEN
        );
      }
      console.log("Brands seeded successfully.");
    }

    // 2. Seed Locations
    const locationsCsvPath = "./data/Automated Ads Setup Tool - Locations.csv";
    if (fs.existsSync(locationsCsvPath)) {
      const locationsContent = fs.readFileSync(locationsCsvPath, "utf-8");
      const locationsRecords = parse(locationsContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        bom: true
      });

      console.log(`Found ${locationsRecords.length} location records in CSV.`);
      if (locationsRecords.length > 0) {
        console.log("CSV Headers:", Object.keys(locationsRecords[0]));
      }

      let seededCount = 0;
      for (const record of locationsRecords as any[]) {
        const clientName = record.CLIENT_NAME;
        const brandName = record.BRAND_NAME;
        if (!clientName || !brandName) {
          console.log("Skipping record due to missing client/brand name:", record);
          continue;
        }

        const client = db.prepare("SELECT id FROM clients WHERE name = ?").get(clientName) as any;
        if (!client) {
          console.log(`Client not found for location seed: "${clientName}"`);
          continue;
        }
        
        const brand = db.prepare("SELECT id FROM brands WHERE client_id = ? AND brand_name = ?").get(client.id, brandName) as any;
        if (!brand) {
          console.log(`Brand not found for location seed: "${brandName}" (Client: "${clientName}")`);
          continue;
        }

        try {
          db.prepare(`
            INSERT INTO locations (
              brand_id, cinema_name, latitude, longitude, radius, distance_unit, json_snippet
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(brand_id, cinema_name) DO UPDATE SET
              latitude = excluded.latitude,
              longitude = excluded.longitude,
              radius = excluded.radius,
              distance_unit = excluded.distance_unit,
              json_snippet = excluded.json_snippet
          `).run(
            brand.id,
            record["Cinema Name"],
            parseFloat(record.Latitude),
            parseFloat(record.Longitude),
            parseInt(record.Radius),
            record["Distance Unit"],
            record["JSON Snippet"]
          );
          seededCount++;
        } catch (e: any) {
          console.error(`Failed to insert location ${record["Cinema Name"]}:`, e.message);
        }
      }
      console.log(`Locations seeded successfully. Total: ${seededCount}`);
    }
  } catch (error) {
    console.error("Error seeding database:", error);
  }
};

seedDatabase();

const app = express();
const PORT = 3000;

app.use(express.json());

// Helper to wait for Meta video processing
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Helper to convert Drive/Dropbox links to download links
const getDownloadUrl = (url: string) => {
  if (!url) return url;
  let cleanUrl = url.trim();
  
  // Dropbox: Convert to direct download link
  if (cleanUrl.includes("dropbox.com")) {
    if (cleanUrl.includes("dl=0")) {
      return cleanUrl.replace("dl=0", "dl=1");
    } else if (!cleanUrl.includes("dl=1")) {
      return cleanUrl.includes("?") ? `${cleanUrl}&dl=1` : `${cleanUrl}?dl=1`;
    }
    return cleanUrl;
  }
  
  // Google Drive: Convert to direct download link
  if (cleanUrl.includes("drive.google.com")) {
    const match = cleanUrl.match(/\/d\/([^/]+)/) || cleanUrl.match(/id=([^&]+)/);
    if (match) {
      // Use the standard direct download endpoint
      return `https://drive.google.com/uc?export=download&id=${match[1]}`;
    }
  }
  
  return cleanUrl;
};

// Meta Ads Service
class MetaAdsService {
  private token: string;
  private adAccountId: string;
  private pixelId: string;
  private addStatus: (msg: string) => void;

  constructor(creds: any, addStatus: (msg: string) => void) {
    this.token = String(creds.meta_access_token || "").trim();
    this.adAccountId = String(creds.meta_ad_account_id || "").trim();
    this.pixelId = String(creds.meta_pixel_id || "").trim();
    // Ensure pixelId is purely numeric
    if (this.pixelId && !/^\d+$/.test(this.pixelId)) {
      console.warn(`Invalid Pixel ID format detected: "${this.pixelId}". It should be numeric.`);
      this.pixelId = ""; 
    }
    this.addStatus = addStatus;

    if (this.adAccountId && !this.adAccountId.startsWith('act_')) {
      this.adAccountId = `act_${this.adAccountId}`;
    }
    
    console.log(`Initialized MetaAdsService with Ad Account: ${this.adAccountId}, Pixel: ${this.pixelId}`);
  }

  async createCampaign(name: string, objective: string, budget: number, budgetType: 'campaign' | 'adset' = 'campaign') {
    this.addStatus(`Creating Meta Campaign: ${name} (${budgetType === 'campaign' ? 'CBO' : 'ABO'})...`);
    
    let metaObjective = "OUTCOME_SALES";
    if (objective === "Reach") metaObjective = "OUTCOME_AWARENESS";
    else if (objective === "Traffic") metaObjective = "OUTCOME_TRAFFIC";
    else if (objective === "Engagement" || objective === "Video Views") metaObjective = "OUTCOME_ENGAGEMENT";

    const payload: any = {
      name,
      objective: metaObjective,
      status: "PAUSED",
      special_ad_categories: ["NONE"],
    };

    if (budgetType === 'campaign') {
      payload.lifetime_budget = Math.max(budget, 100) * 100;
      payload.bid_strategy = "LOWEST_COST_WITHOUT_CAP";
    } else {
      payload.is_adset_budget_sharing_enabled = false;
    }

    const response = await fetch(`https://graph.facebook.com/v22.0/${this.adAccountId}/campaigns`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...payload,
        access_token: this.token
      })
    });
    const result = await response.json() as any;
    if (result.error) {
      const errorMsg = `Meta Campaign Error: ${result.error.message} (Type: ${result.error.type}, Code: ${result.error.code}, Subcode: ${result.error.error_subcode})`;
      const userMsg = result.error.error_user_msg ? `\nUser Message: ${result.error.error_user_msg}` : "";
      throw new Error(`${errorMsg}${userMsg}`);
    }
    return result.id;
  }

  async createAdSet(payload: any) {
    this.addStatus(`Creating Meta Ad Set: ${payload.name}...`);
    if (payload.promoted_object) {
      this.addStatus(`Promoted Object: ${JSON.stringify(payload.promoted_object)}`);
    }
    const response = await fetch(`https://graph.facebook.com/v22.0/${this.adAccountId}/adsets`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, access_token: this.token })
    });
    const result = await response.json() as any;
    if (result.error) {
      const errorMsg = `Meta Ad Set Error: ${result.error.message} (Type: ${result.error.type}, Code: ${result.error.code}, Subcode: ${result.error.error_subcode})`;
      const userMsg = result.error.error_user_msg ? `\nUser Message: ${result.error.error_user_msg}` : "";
      throw new Error(`${errorMsg}${userMsg}`);
    }
    return result.id;
  }

  async uploadVideo(url: string) {
    const response = await fetch(`https://graph.facebook.com/v22.0/${this.adAccountId}/advideos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ file_url: url, access_token: this.token })
    });
    const result = await response.json() as any;
    if (result.error) {
      const errorMsg = `Video Upload Error: ${result.error.message} (Type: ${result.error.type}, Code: ${result.error.code}, Subcode: ${result.error.error_subcode})`;
      const userMsg = result.error.error_user_msg ? `\nUser Message: ${result.error.error_user_msg}` : "";
      throw new Error(`${errorMsg}${userMsg}`);
    }
    return result.id;
  }

  async createCreative(payload: any) {
    const response = await fetch(`https://graph.facebook.com/v22.0/${this.adAccountId}/adcreatives`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, access_token: this.token })
    });
    const result = await response.json() as any;
    if (result.error) {
      console.error("Creative Payload that failed:", JSON.stringify(payload, null, 2));
      const errorMsg = `Creative Error: ${result.error.message} (Type: ${result.error.type}, Code: ${result.error.code}, Subcode: ${result.error.error_subcode})`;
      const userMsg = result.error.error_user_msg ? `\nUser Message: ${result.error.error_user_msg}` : "";
      throw new Error(`${errorMsg}${userMsg}`);
    }
    return result.id;
  }

  async createAd(payload: any) {
    const response = await fetch(`https://graph.facebook.com/v22.0/${this.adAccountId}/ads`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, access_token: this.token })
    });
    const result = await response.json() as any;
    if (result.error) {
      const errorMsg = `Ad Error: ${result.error.message} (Type: ${result.error.type}, Code: ${result.error.code}, Subcode: ${result.error.error_subcode})`;
      const userMsg = result.error.error_user_msg ? `\nUser Message: ${result.error.error_user_msg}` : "";
      throw new Error(`${errorMsg}${userMsg}`);
    }
    return result.id;
  }

  async createCustomAudience(name: string, subtype: string = "CUSTOM", rule?: any) {
    const body: any = { name, access_token: this.token };
    if (subtype === "CUSTOM") body.customer_file_source = "USER_PROVIDED_ONLY";
    if (subtype === "WEBSITE") {
      if (!this.pixelId) throw new Error("Pixel ID is missing for WEBSITE custom audience.");
      body.pixel_id = this.pixelId;
      body.rule = JSON.stringify(rule);
      body.prefill = true;
      this.addStatus(`Creating Website Audience with Pixel: ${this.pixelId}`);
    }

    const response = await fetch(`https://graph.facebook.com/v22.0/${this.adAccountId}/customaudiences`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const result = await response.json() as any;
    if (result.error) {
      const errorMsg = `Audience Error: ${result.error.message} (Type: ${result.error.type}, Code: ${result.error.code}, Subcode: ${result.error.error_subcode})`;
      const userMsg = result.error.error_user_msg ? `\nUser Message: ${result.error.error_user_msg}` : "";
      throw new Error(`${errorMsg}${userMsg}`);
    }
    return result.id;
  }

  async addUsersToAudience(audienceId: string, hashedEmails: string[]) {
    await fetch(`https://graph.facebook.com/v22.0/${audienceId}/users`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        payload: { schema: ["EMAIL"], data: hashedEmails },
        access_token: this.token
      })
    });
  }

  async getExistingCreative(adId: string) {
    const response = await fetch(`https://graph.facebook.com/v22.0/${adId}?fields=creative&access_token=${this.token}`);
    const data = await response.json() as any;
    return data.creative?.id;
  }

  getCredentials() {
    return {
      token: this.token,
      adAccountId: this.adAccountId,
      pixelId: this.pixelId
    };
  }
}

// Helper to wait for Meta video processing with polling
const waitForVideoProcessing = async (videoId: string, metaToken: string, addStatus: (msg: string) => void) => {
  addStatus(`Checking processing status for video ${videoId}...`);
  const maxAttempts = 20; // 20 * 15s = 5 minutes max
  const interval = 15000; // 15 seconds

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await fetch(`https://graph.facebook.com/v22.0/${videoId}?fields=status&access_token=${metaToken}`);
      const data = await response.json() as any;

      if (data.error) {
        addStatus(`Error checking video status: ${data.error.message}`);
        return false;
      }

      const status = data.status?.video_status;
      addStatus(`Video ${videoId} status: ${status} (Attempt ${attempt}/${maxAttempts})`);

      if (status === 'ready') {
        return true;
      }

      if (status === 'error') {
        addStatus(`Meta reported an error processing video ${videoId}.`);
        return false;
      }

      // If still processing, wait and retry
      await sleep(interval);
    } catch (e: any) {
      addStatus(`Network error checking video status: ${e.message}`);
      await sleep(interval);
    }
  }

  addStatus(`Timed out waiting for video ${videoId} to process.`);
  return false;
};

// Helper to fetch location data from Database
const fetchLocationData = async (brandId?: string) => {
  try {
    let query = "SELECT * FROM locations";
    let params: any[] = [];
    
    if (brandId && brandId !== "") {
      query += " WHERE brand_id = ?";
      params.push(parseInt(brandId));
    }

    const rows = db.prepare(query).all(...params) as any[];
    console.log(`Fetched ${rows.length} locations for brandId: ${brandId || 'all'}`);

    const locationMap: Record<string, any> = {};
    const displayNames: Record<string, string> = {};
    
    rows.forEach(row => {
      const nameKey = row.cinema_name.toLowerCase();
      try {
        locationMap[nameKey] = JSON.parse(row.json_snippet);
        displayNames[nameKey] = row.cinema_name;
      } catch (e) {
        console.error(`Failed to parse JSON for ${row.cinema_name}:`, e);
      }
    });

    return { locationMap, displayNames };
  } catch (e) {
    console.error("Error processing location data:", e);
    return { locationMap: {}, displayNames: {} };
  }
};

// Helper to hash data for Meta (SHA256)
const hashData = (data: string) => {
  return crypto.createHash("sha256").update(data.trim().toLowerCase()).digest("hex");
};

// API Routes
app.get("/api/clients", (req, res) => {
  try {
    const clients = db.prepare("SELECT * FROM clients").all() as any[];
    const result = clients.map(client => {
      const brands = db.prepare("SELECT * FROM brands WHERE client_id = ?").all(client.id);
      return { ...client, brands };
    });
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/locations", async (req, res) => {
  try {
    const brandId = req.query.brandId as string;
    const { displayNames } = await fetchLocationData(brandId);
    const locationNames = Object.values(displayNames).sort();
    res.json(locationNames);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/fetch-brief", async (req, res) => {
  const { asanaUrl, csvData, csvName, clientId } = req.body;
  try {
    const client = db.prepare("SELECT * FROM clients WHERE id = ?").get(clientId) as any;
    if (!client) throw new Error("Client not found");

    const ASANA_PAT = client.asana_pat || process.env.ASANA_PAT;
    if (!ASANA_PAT) throw new Error("Missing ASANA_PAT");

    const taskIdMatch = asanaUrl.match(/asana\.com\/(?:.*\/task\/|0\/\d+\/)(\d+)/);
    if (!taskIdMatch) throw new Error("Invalid Asana URL format.");
    const taskId = taskIdMatch[1];

    const asanaResponse = await fetch(`https://app.asana.com/api/1.0/tasks/${taskId}`, {
      headers: { Authorization: `Bearer ${ASANA_PAT}` }
    });
    const asanaData = await asanaResponse.json() as any;
    if (!asanaData.data) throw new Error("Failed to fetch Asana task data.");

    const customFields = asanaData.data.custom_fields;
    const getField = (name: string) => {
      const field = customFields.find((f: any) => f.name === name);
      return (field?.display_value || "").trim() || name.toUpperCase();
    };

    const rawObjective = getField("Objective");
    const objectiveMap: Record<string, string> = {
      "Sales": "CV",
      "Traffic": "TR",
      "Reach": "Reach",
      "Engagement": "EG",
      "Video Views": "VV"
    };
    const displayObjective = objectiveMap[rawObjective] || rawObjective;

    // Format dates
    const formatDate = (dateStr: string, time: string) => {
      if (!dateStr || dateStr === "START DATE" || dateStr === "END DATE") return null;
      return `${dateStr}T${time}:00+08:00`;
    };

    const movieTitle = getField("Movie Name");
    const asanaClient = getField("Client");
    const genre = getField("Genre");
    const startDateRaw = getField("Start Date");
    const endDateRaw = getField("End Date");

    // Dynamic campaign name based on client
    let campaignName = `${asanaClient} - ${movieTitle} - ${genre} - ${displayObjective} - ${startDateRaw} - ${endDateRaw}`;
    
    if (asanaClient.includes('Moving Story')) {
      campaignName = `15569 - ${movieTitle} | PRE (AU) - FB & IG - ${displayObjective} - Moving Story - ${genre} - Theatrical`;
    } else if (asanaClient.includes('Palace Cinemas')) {
      campaignName = `12396 - ${movieTitle} - FB & IG - ${displayObjective} - Palace Cinemas - ${genre} - Theatrical`;
    } else if (asanaClient.includes('Reading Cinemas')) {
      campaignName = `GRUVI - ${movieTitle} (AU) - FB & IG - ${displayObjective} - Reading Cinemas - ${genre} - Theatrical`;
    }

    const brief = {
      movieName: movieTitle,
      movieTitle: movieTitle, // Keep for compatibility if needed
      campaignName,
      objective: rawObjective === "OBJECTIVE" ? "Sales" : rawObjective, // Default to Sales for actual Meta objective if missing
      startDate: formatDate(startDateRaw, "09:00"),
      endDate: formatDate(endDateRaw, "21:00"), // Set to 9pm as requested
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
      instagramUserId: getField("Instagram Page ID") || ""
    };

    res.json(brief);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/fetch-campaign-data", async (req, res) => {
  const { campaignId, clientId } = req.body;
  try {
    const client = db.prepare("SELECT * FROM clients WHERE id = ?").get(clientId) as any;
    if (!client) throw new Error("Client not found");

    const token = client.meta_access_token;
    if (!token) throw new Error("Meta access token not found for this client");

    // Fetch all brands for this client to match later
    const brands = db.prepare("SELECT * FROM brands WHERE client_id = ?").all(clientId) as any[];

    // 1. Fetch Campaign
    const campaignRes = await fetch(`https://graph.facebook.com/v22.0/${campaignId}?fields=name,objective,lifetime_budget,daily_budget,start_time,stop_time&access_token=${token}`);
    const campaignData = await campaignRes.json() as any;
    if (campaignData.error) throw new Error(`Meta Campaign Error: ${campaignData.error.message}`);

    // 2. Fetch Ad Sets
    const adSetsRes = await fetch(`https://graph.facebook.com/v22.0/${campaignId}/adsets?fields=id,name,targeting,start_time,end_time,lifetime_budget,daily_budget&access_token=${token}`);
    const adSetsData = await adSetsRes.json() as any;
    if (adSetsData.error) throw new Error(`Meta Ad Sets Error: ${adSetsData.error.message}`);

    const adSets: any[] = [];

    // 3. Fetch Ads & Creatives
    for (const metaAdSet of adSetsData.data) {
      const adsRes = await fetch(`https://graph.facebook.com/v22.0/${metaAdSet.id}/ads?fields=id,name,creative{id,name,object_story_spec,body,title,image_url,instagram_actor_id},url_tags&access_token=${token}`);
      const adsData = await adsRes.json() as any;
      if (adsData.error) throw new Error(`Meta Ads Error: ${adsData.error.message}`);

      const ads: any[] = [];
      let detectedBrandId = "";

      for (const metaAd of adsData.data) {
        const creative = metaAd.creative;
        const storySpec = creative?.object_story_spec;
        
        // Determine Brand if not already set for this ad set
        if (!detectedBrandId && creative) {
          const pageId = storySpec?.page_id;
          const igPageId = storySpec?.instagram_actor_id || creative.instagram_actor_id;
          
          const matchedBrand = brands.find(b => 
            (pageId && b.meta_page_id === pageId) || 
            (igPageId && b.instagram_page_id === igPageId)
          );
          if (matchedBrand) {
            detectedBrandId = matchedBrand.id.toString();
          }
        }

        let headline = creative?.title || "";
        let copy = creative?.body || "";
        let url = "";
        let ctaType = "LEARN_MORE";
        let type: 'video' | 'image' | 'carousel' = 'image';
        let thumbnail = creative?.image_url || "";
        let carouselCards: any[] = [];
        let feedVideoUrl = "";

        // Improved detection: Check if it's a video
        if (storySpec?.video_data) {
          type = 'video';
        }

        if (storySpec) {
          const linkData = storySpec.link_data;
          const videoData = storySpec.video_data;
          
          if (videoData) {
            type = 'video';
            headline = videoData.title || headline;
            copy = videoData.message || copy;
            url = videoData.call_to_action?.value?.link || "";
            ctaType = videoData.call_to_action?.type || ctaType;
            thumbnail = videoData.image_url || thumbnail;
          } else if (linkData) {
            headline = linkData.name || headline;
            copy = linkData.message || copy;
            url = linkData.link || "";
            ctaType = linkData.call_to_action?.type || ctaType;
            thumbnail = linkData.image_url || thumbnail;
            
            if (linkData.child_attachments) {
              type = 'carousel';
              carouselCards = linkData.child_attachments.map((card: any) => ({
                id: Math.random().toString(36).substr(2, 9),
                imageUrl: card.image_url || "",
                headline: card.name || "",
                url: card.link || ""
              }));
            }
          }
        } else {
          // Fallback if story_spec is missing (common for existing posts)
          // Try to fetch the effective object story id if possible, but for now use creative fields
          if (creative?.body) copy = creative.body;
          if (creative?.title) headline = creative.title;
        }

        ads.push({
          id: Math.random().toString(36).substr(2, 9),
          type,
          adName: metaAd.name,
          headline,
          copy,
          url,
          thumbnail,
          ctaType,
          manualAdId: metaAd.id,
          customUrlParams: metaAd.url_tags || "",
          carouselCards: carouselCards.length > 0 ? carouselCards : undefined
        });
      }

      adSets.push({
        id: Math.random().toString(36).substr(2, 9),
        name: metaAdSet.name,
        platformAccountId: detectedBrandId,
        locations: [],
        ageMin: metaAdSet.targeting?.age_min,
        ageMax: metaAdSet.targeting?.age_max,
        customAudiences: metaAdSet.targeting?.custom_audiences?.map((a: any) => a.id) || [],
        excludedCustomAudiences: metaAdSet.targeting?.excluded_custom_audiences?.map((a: any) => a.id) || [],
        geoLocations: metaAdSet.targeting?.geo_locations,
        budget: parseFloat(metaAdSet.lifetime_budget || metaAdSet.daily_budget || "0") / 100,
        ads
      });
    }

    let displayObjective = "Sales";
    if (campaignData.objective === "OUTCOME_AWARENESS") displayObjective = "Reach";
    else if (campaignData.objective === "OUTCOME_TRAFFIC") displayObjective = "Traffic";
    else if (campaignData.objective === "OUTCOME_ENGAGEMENT") displayObjective = "Engagement";

    const hasCampaignBudget = campaignData.lifetime_budget || campaignData.daily_budget;

    const brief = {
      clientId: clientId.toString(),
      movieName: campaignData.name,
      campaignName: campaignData.name,
      objective: displayObjective,
      startDate: campaignData.start_time?.split('T')[0] || "",
      endDate: campaignData.stop_time?.split('T')[0] || "",
      budget: parseFloat(campaignData.lifetime_budget || campaignData.daily_budget || "0") / 100,
      budgetType: hasCampaignBudget ? 'campaign' : 'adset',
      adSets
    };

    res.json(brief);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/process-asana", async (req, res) => {
  const { brief } = req.body;
  const statusUpdates: string[] = [];

  const addStatus = (msg: string) => {
    console.log(msg);
    statusUpdates.push(msg);
  };

  try {
    const client = db.prepare("SELECT * FROM clients WHERE id = ?").get(brief.clientId) as any;
    if (!client) throw new Error("Client not found in database.");

    const metaService = new MetaAdsService(client, addStatus);
    const creds = metaService.getCredentials();

    const { movieName, campaignName, objective, startDate, endDate, budget, budgetType, adSets } = brief;
    
    // Step 1: Create Campaign
    const campaignId = await metaService.createCampaign(campaignName, objective, budget, budgetType);

    // Step 2: Process Ad Sets
    for (const adSet of adSets) {
      addStatus(`Processing Ad Set: ${adSet.name}...`);

      const brand = db.prepare("SELECT * FROM brands WHERE id = ?").get(adSet.platformAccountId) as any;
      if (!brand) throw new Error(`Brand not found for Ad Set: ${adSet.name}`);

      const { locationMap } = await fetchLocationData(brand.id.toString());

      // A: Targeting
      let targeting: any = {
        targeting_automation: { advantage_audience: 0 },
        publisher_platforms: ["facebook", "instagram"],
        facebook_positions: ["feed", "story", "facebook_reels", "profile_feed", "search"],
        instagram_positions: ["stream", "story", "explore", "reels", "profile_feed"]
      };

      if (adSet.copyTargetingFromAdSetId) {
        addStatus(`Copying targeting from Ad Set ID: ${adSet.copyTargetingFromAdSetId}...`);
        const copyResponse = await fetch(`https://graph.facebook.com/v22.0/${adSet.copyTargetingFromAdSetId}?fields=targeting&access_token=${creds.token}`);
        const copyData = await copyResponse.json() as any;
        if (copyData.targeting) {
          targeting = { ...copyData.targeting, ...targeting };
        }
      } else {
        targeting.geo_locations = { countries: ["AU"] };
      }

      if (adSet.locations && adSet.locations.length > 0) {
        const customLocations: any[] = [];
        adSet.locations.forEach((loc: string) => {
          const data = locationMap[loc.toLowerCase()];
          if (data) customLocations.push(data);
        });
        if (customLocations.length > 0) {
          targeting.geo_locations = { custom_locations: customLocations };
        } else {
          addStatus(`Warning: No valid locations found in database for provided names. Falling back to AU country targeting.`);
          targeting.geo_locations = { countries: ["AU"] };
        }
      }

      if (adSet.ageMin) targeting.age_min = adSet.ageMin;
      if (adSet.ageMax) targeting.age_max = adSet.ageMax;

      if (adSet.customAudiences && adSet.customAudiences.length > 0) {
        targeting.custom_audiences = adSet.customAudiences.map((id: string) => ({ id }));
      }
      if (adSet.excludedCustomAudiences && adSet.excludedCustomAudiences.length > 0) {
        targeting.excluded_custom_audiences = adSet.excludedCustomAudiences.map((id: string) => ({ id }));
      }

      if (adSet.geoLocations) {
        targeting.geo_locations = adSet.geoLocations;
      }

      delete targeting.targeting_optimization;
      targeting.targeting_automation = { 
        ...targeting.targeting_automation,
        advantage_audience: 0 
      };

      // B: Custom Audience
      if (adSet.csvData && adSet.csvName) {
        addStatus(`Creating Custom Audience: ${adSet.csvName}...`);
        try {
          const customAudienceId = await metaService.createCustomAudience(adSet.csvName);
          targeting.custom_audiences = [{ id: customAudienceId }];
          
          const emails = adSet.csvData.split("\n").map((line: string) => line.trim()).filter((line: string) => line && line.includes("@"));
          const hashedEmails = emails.map((email: string) => hashData(email));
          await metaService.addUsersToAudience(customAudienceId, hashedEmails);
        } catch (e: any) {
          addStatus(`Audience creation failed: ${e.message}`);
        }
      }

      // C: Exclusion Audience
      if (creds.pixelId && creds.pixelId !== "") {
        addStatus(`Creating Exclusion Audience for ${adSet.name} using Pixel: ${creds.pixelId}...`);
        const exclusionRule = {
          inclusions: {
            operator: "or",
            rules: [
              {
                event_sources: [{ type: "pixel", id: String(creds.pixelId) }],
                retention_seconds: 15552000,
                filter: {
                  operator: "and",
                  filters: [
                    { field: "event", operator: "eq", value: "Purchase" },
                    { field: "content_name", operator: "i_contains", value: String(movieName || campaignName.replace("Campaign: ", "")) }
                  ]
                }
              }
            ]
          }
        };

        try {
          const exclusionId = await metaService.createCustomAudience(
            `Palace - ${adSet.name} (Purchase) - 180 days`,
            "WEBSITE",
            exclusionRule
          );
          targeting.excluded_custom_audiences = [{ id: exclusionId }];
        } catch (e: any) {
          addStatus(`Exclusion audience failed: ${e.message}`);
          // If exclusion fails, we still want to try creating the ad set
        }
      } else {
        addStatus(`Warning: No Pixel ID found for client. Skipping exclusion audience creation.`);
      }

      // D: Create Ad Set
      const adSetPayload: any = {
        name: adSet.name,
        campaign_id: campaignId,
        billing_event: "IMPRESSIONS",
        optimization_goal: (objective === "Reach") ? "REACH" : (objective === "Traffic" ? "LINK_CLICKS" : "OFFSITE_CONVERSIONS"),
        targeting: JSON.stringify(targeting),
        status: "ACTIVE"
      };

      if (startDate) {
        adSetPayload.start_time = startDate.includes('T') ? startDate : `${startDate}T09:00:00+08:00`;
      }
      if (endDate) {
        adSetPayload.end_time = endDate.includes('T') ? endDate : `${endDate}T21:00:00+08:00`;
      }

      if (budgetType === 'adset') {
        adSetPayload.lifetime_budget = Math.max(adSet.budget || 100, 100) * 100;
        adSetPayload.bid_strategy = "LOWEST_COST_WITHOUT_CAP";
      }

      if (objective.toLowerCase() === "sales") {
        if (!creds.pixelId) {
          throw new Error("Pixel ID is required for Sales objective campaigns. Please update the client settings in the CSV/Database.");
        }
        adSetPayload.promoted_object = { pixel_id: String(creds.pixelId), custom_event_type: "PURCHASE" };
        adSetPayload.attribution_spec = [
          { event_type: "CLICK_THROUGH", window_days: 7 },
          { event_type: "VIEW_THROUGH", window_days: 1 },
          { event_type: "ENGAGED_VIDEO_VIEW", window_days: 1 }
        ];
      }

      const adSetId = await metaService.createAdSet(adSetPayload);

      // Step 3: Create Ads
      for (const ad of adSet.ads) {
        addStatus(`Creating Ad: ${ad.adName || ad.headline || 'Untitled Ad'}...`);

        let creativeId = null;

        if (ad.manualAdId) {
          creativeId = await metaService.getExistingCreative(ad.manualAdId);
        }

        const ctaType = ad.ctaType || ((objective?.toLowerCase() === "sales") ? "BOOK_NOW" : "LEARN_MORE");

        if (!creativeId && ad.type === 'video') {
          const feedUrl = getDownloadUrl(ad.feedVideoUrl);
          const verticalUrl = ad.verticalVideoUrl ? getDownloadUrl(ad.verticalVideoUrl) : null;
          const thumbnailUrl = ad.thumbnail ? getDownloadUrl(ad.thumbnail) : "https://picsum.photos/1200/628";

          const feedVideoId = await metaService.uploadVideo(feedUrl);
          let verticalVideoId = null;
          if (verticalUrl) {
            try {
              verticalVideoId = await metaService.uploadVideo(verticalUrl);
            } catch (e) {}
          }

          const feedReady = await waitForVideoProcessing(feedVideoId, creds.token, addStatus);
          if (!feedReady) throw new Error(`Feed video ${feedVideoId} failed to process in time. Please check the video link in Asana.`);

          if (verticalVideoId) {
            const verticalReady = await waitForVideoProcessing(verticalVideoId, creds.token, addStatus);
            if (!verticalReady) {
              addStatus(`Warning: Vertical video ${verticalVideoId} failed to process. Skipping vertical customization.`);
              verticalVideoId = null; // Don't use it if it failed
            }
          }

          const creativePayload: any = {
            name: `Creative: ${ad.adName || ad.headline}`,
            object_story_spec: {
              page_id: brand.meta_page_id,
              video_data: {
                video_id: feedVideoId,
                image_url: thumbnailUrl,
                title: ad.headline,
                message: ad.copy,
                call_to_action: { type: ctaType, value: { link: ad.url } }
              }
            }
          };

          if (brand.instagram_page_id && /^\d+$/.test(brand.instagram_page_id)) {
            creativePayload.object_story_spec.instagram_actor_id = brand.instagram_page_id;
          }

          creativePayload.degrees_of_freedom_spec = {
            creative_features_spec: {
              standard_enhancements: { enroll_status: "OPT_OUT" }
            }
          };

          if (verticalVideoId) {
            creativePayload.asset_customization_rules = [{
              customization_spec: { placements: ["facebook_story", "instagram_story", "instagram_reels", "facebook_reels"] },
              video_id: verticalVideoId
            }];
          }

          creativeId = await metaService.createCreative(creativePayload);
        } else if (!creativeId && ad.type === 'carousel') {
          const cards = (ad.carouselCards && ad.carouselCards.length > 0) 
            ? ad.carouselCards.map((c: any) => ({ ...c, imageUrl: getDownloadUrl(c.imageUrl) }))
            : [{ imageUrl: ad.thumbnail || "https://picsum.photos/1080/1080", headline: ad.headline, url: ad.url }];
          
          const creativePayload: any = {
            name: `Creative: ${ad.adName || ad.headline}`,
            object_story_spec: {
              page_id: brand.meta_page_id,
              link_data: {
                link: ad.url,
                message: ad.copy,
                caption: ad.headline,
                child_attachments: cards.map((card: any, idx: number) => ({
                  link: card.url || ad.url,
                  image_url: card.imageUrl,
                  name: card.headline || `${ad.headline} - ${idx + 1}`,
                  description: ad.copy.substring(0, 30),
                  call_to_action: { type: ctaType, value: { link: card.url || ad.url } }
                }))
              }
            }
          };

          if (brand.instagram_page_id && /^\d+$/.test(brand.instagram_page_id)) {
            creativePayload.object_story_spec.instagram_actor_id = brand.instagram_page_id;
          }
          creativePayload.degrees_of_freedom_spec = {
            creative_features_spec: {
              standard_enhancements: { enroll_status: "OPT_OUT" }
            }
          };
          creativeId = await metaService.createCreative(creativePayload);
        } else if (!creativeId && ad.type === 'image') {
          const creativePayload: any = {
            name: `Creative: ${ad.adName || ad.headline}`,
            object_story_spec: {
              page_id: brand.meta_page_id,
              link_data: {
                image_url: ad.thumbnail || "https://picsum.photos/1200/628",
                link: ad.url,
                message: ad.copy,
                name: ad.headline,
                call_to_action: { type: ctaType, value: { link: ad.url } }
              }
            }
          };

          if (brand.instagram_page_id && /^\d+$/.test(brand.instagram_page_id)) {
            creativePayload.object_story_spec.instagram_actor_id = brand.instagram_page_id;
          }
          creativePayload.degrees_of_freedom_spec = {
            creative_features_spec: {
              standard_enhancements: { enroll_status: "OPT_OUT" }
            }
          };
          creativeId = await metaService.createCreative(creativePayload);
        }

        if (creativeId) {
          await metaService.createAd({
            name: ad.adName || `Ad: ${ad.headline}`,
            adset_id: adSetId,
            creative: { creative_id: creativeId },
            status: "ACTIVE",
            multi_advertiser_ads_enabled: false,
            url_tags: ad.customUrlParams || `utm_source=facebook-instagram&utm_medium=gruvi-cpc&utm_campaign={{campaign.name}}&utm_content={{ad.name}}&utm_term={{adset.name}}&campaign_id={{campaign.id}}&adset_id={{adset.id}}&ad_id={{ad.id}}`
          });
        }
      }
    }

    addStatus("Campaign Automation Complete!");
    res.json({ success: true, logs: statusUpdates });

  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: error.message, logs: statusUpdates });
  }
});

// Vite middleware for development
if (process.env.NODE_ENV !== "production") {
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: "spa",
  });
  app.use(vite.middlewares);
}

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
