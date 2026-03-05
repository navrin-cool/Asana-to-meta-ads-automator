import express from "express";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import fetch from "node-fetch";
import crypto from "crypto";

dotenv.config();

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

// Helper to wait for Meta video processing with polling
const waitForVideoProcessing = async (videoId: string, metaToken: string, addStatus: (msg: string) => void) => {
  addStatus(`Checking processing status for video ${videoId}...`);
  const maxAttempts = 20; // 20 * 15s = 5 minutes max
  const interval = 15000; // 15 seconds

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await fetch(`https://graph.facebook.com/v19.0/${videoId}?fields=status&access_token=${metaToken}`);
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

// Helper to fetch location data from Google Sheet
const fetchLocationData = async () => {
  try {
    // The user provided a specific CSV structure. We'll use the hardcoded list as primary source
    // to ensure 100% reliability as requested.
    const csvContent = `Cinema Name,Latitude,Longitude,Radius,Distance Unit,JSON Snippet
Palace Balwyn,-37.8123,145.0784,16,kilometer,"{""latitude"":-37.8123,""longitude"":145.0784,""radius"":16,""distance_unit"":""kilometer""}"
The Astor,-37.8584,144.9928,16,kilometer,"{""latitude"":-37.8584,""longitude"":144.9928,""radius"":16,""distance_unit"":""kilometer""}"
Palace Brighton Bay,-37.8997,144.9996,16,kilometer,"{""latitude"":-37.8997,""longitude"":144.9996,""radius"":16,""distance_unit"":""kilometer""}"
Palace Cinema Como,-37.8398,144.9942,16,kilometer,"{""latitude"":-37.8398,""longitude"":144.9942,""radius"":16,""distance_unit"":""kilometer""}"
Kino Cinema,-37.814,144.9723,16,kilometer,"{""latitude"":-37.814,""longitude"":144.9723,""radius"":16,""distance_unit"":""kilometer""}"
Palace Westgarth,-37.7812,144.9959,16,kilometer,"{""latitude"":-37.7812,""longitude"":144.9959,""radius"":16,""distance_unit"":""kilometer""}"
Pentridge Cinema,-37.7479,144.9702,16,kilometer,"{""latitude"":-37.7479,""longitude"":144.9702,""radius"":16,""distance_unit"":""kilometer""}"
Palace Penny Lane,-37.7663,144.9248,16,kilometer,"{""latitude"":-37.7663,""longitude"":144.9248,""radius"":16,""distance_unit"":""kilometer""}"
Palace Norton Street,-33.8824,151.1565,16,kilometer,"{""latitude"":-33.8824,""longitude"":151.1565,""radius"":16,""distance_unit"":""kilometer""}"
Palace Central,-33.8841,151.2007,16,kilometer,"{""latitude"":-33.8841,""longitude"":151.2007,""radius"":16,""distance_unit"":""kilometer""}"
Palace Moore Park,-33.8943,151.2238,16,kilometer,"{""latitude"":-33.8943,""longitude"":151.2238,""radius"":16,""distance_unit"":""kilometer""}"
Palace Ballina Fair,-28.8601,153.5497,16,kilometer,"{""latitude"":-28.8601,""longitude"":153.5497,""radius"":16,""distance_unit"":""kilometer""}"
Palace James St,-27.4586,153.0401,16,kilometer,"{""latitude"":-27.4586,""longitude"":153.0401,""radius"":16,""distance_unit"":""kilometer""}"
Palace Barracks,-27.4661,153.0152,16,kilometer,"{""latitude"":-27.4661,""longitude"":153.0152,""radius"":16,""distance_unit"":""kilometer""}"
Palace Byron Bay,-28.6441,153.612,16,kilometer,"{""latitude"":-28.6441,""longitude"":153.612,""radius"":16,""distance_unit"":""kilometer""}"
Palace Electric,-35.2852,149.1241,16,kilometer,"{""latitude"":-35.2852,""longitude"":149.1241,""radius"":16,""distance_unit"":""kilometer""}"
Palace Raine Square,-31.9519,115.8562,16,kilometer,"{""latitude"":-31.9519,""longitude"":115.8562,""radius"":16,""distance_unit"":""kilometer""}"
Regent Ballarat,-37.5615,143.8587,16,kilometer,"{""latitude"":-37.5615,""longitude"":143.8587,""radius"":16,""distance_unit"":""kilometer""}"
Palace Church St,-37.9155,144.9921,16,kilometer,"{""latitude"":-37.9155,""longitude"":144.9921,""radius"":16,""distance_unit"":""kilometer""}"`;

    const locationMap: Record<string, any> = {};
    const displayNames: Record<string, string> = {};
    
    const lines = csvContent.split(/\r?\n/).filter(line => line.trim());
    
    lines.slice(1).forEach(line => {
      // Find the last comma which starts the JSON snippet
      const lastQuoteIndex = line.lastIndexOf('"{');
      if (lastQuoteIndex !== -1) {
        const namePart = line.substring(0, line.indexOf(',')).trim();
        const jsonPart = line.substring(lastQuoteIndex + 1, line.length - 1).replace(/""/g, '"');
        
        const nameKey = namePart.toLowerCase();
        try {
          locationMap[nameKey] = JSON.parse(jsonPart);
          displayNames[nameKey] = namePart;
        } catch (e) {
          console.error(`Failed to parse JSON for ${namePart}:`, e);
        }
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
app.get("/api/locations", async (req, res) => {
  try {
    const { displayNames } = await fetchLocationData();
    const locationNames = Object.values(displayNames).sort();
    res.json(locationNames);
  } catch (error: any) {
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

    const asanaResponse = await fetch(`https://app.asana.com/api/1.0/tasks/${taskId}`, {
      headers: { Authorization: `Bearer ${ASANA_PAT}` }
    });
    const asanaData = await asanaResponse.json() as any;
    if (!asanaData.data) throw new Error("Failed to fetch Asana task data.");

    const customFields = asanaData.data.custom_fields;
    const getField = (name: string) => customFields.find((f: any) => f.name === name)?.display_value;

    const objective = getField("Objective") || "Sales";
    const startDateRaw = getField("Start Date");
    const endDateRaw = getField("End Date");

    // Format dates
    const formatDate = (dateStr: string, time: string) => {
      if (!dateStr) return null;
      return `${dateStr}T${time}:00+08:00`;
    };

    const movieTitle = getField("Movie Title") || "Untitled Movie";

    const brief = {
      movieName: movieTitle,
      movieTitle: movieTitle, // Keep for compatibility if needed
      objective,
      startDate: formatDate(startDateRaw, "09:00"),
      endDate: formatDate(endDateRaw, "23:59"), // Use end of day to avoid "past" errors
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

app.post("/api/process-asana", async (req, res) => {
  const { brief } = req.body;
  const statusUpdates: string[] = [];

  const addStatus = (msg: string) => {
    console.log(msg);
    statusUpdates.push(msg);
  };

  try {
    const META_TOKEN = process.env.META_ACCESS_TOKEN;
    let AD_ACCOUNT_ID = process.env.META_AD_ACCOUNT_ID;
    const PAGE_ID = process.env.META_PAGE_ID;

    if (!META_TOKEN || !AD_ACCOUNT_ID) {
      return res.status(400).json({ error: "Missing API configuration in environment variables." });
    }

    // Ensure AD_ACCOUNT_ID starts with 'act_'
    if (!AD_ACCOUNT_ID.startsWith('act_')) {
      AD_ACCOUNT_ID = `act_${AD_ACCOUNT_ID}`;
    }

    const { movieName, campaignName, objective, startDate, endDate, budget, instagramUserId, adSets } = brief;
    const INSTAGRAM_ID = instagramUserId || "102615919157239";

    // Step 1: Create Campaign
    addStatus(`Creating Meta Campaign: ${campaignName}...`);
    
    // Objective Mapping
    let metaObjective = "OUTCOME_SALES";
    let optimizationGoal = "OFFSITE_CONVERSIONS";
    let attributionSpec = null;
    let promotedObject = null;

    // Attribution settings: 7-day click, 1-day engaged-view, 1-day view
    const standardAttribution = [
      { event_type: "CLICK_THROUGH", window_days: 7 },
      { event_type: "VIEW_THROUGH", window_days: 1 },
      { event_type: "ENGAGED_VIDEO_VIEW", window_days: 1 }
    ];

    if (objective === "Sales") {
      metaObjective = "OUTCOME_SALES";
      optimizationGoal = "OFFSITE_CONVERSIONS";
      attributionSpec = standardAttribution;
      promotedObject = { pixel_id: "627590211536590", custom_event_type: "PURCHASE" };
    } else if (objective === "Reach") {
      metaObjective = "OUTCOME_AWARENESS";
      optimizationGoal = "REACH";
    } else if (objective === "Traffic") {
      metaObjective = "OUTCOME_TRAFFIC";
      optimizationGoal = "LINK_CLICKS";
    } else if (objective === "Engagement") {
      metaObjective = "OUTCOME_ENGAGEMENT";
      optimizationGoal = "POST_ENGAGEMENT";
    } else if (objective === "Video Views") {
      metaObjective = "OUTCOME_ENGAGEMENT";
      optimizationGoal = "THRUPLAY";
    }

    // Validate dates
    if (!startDate || !endDate) {
      throw new Error("Campaign start and end dates are required.");
    }

    // Ensure dates are in the future for Meta API
    const now = new Date();
    const start = new Date(startDate);
    const end = new Date(endDate);

    let adjustedStartTime = startDate;
    let adjustedEndTime = endDate;

    // If start is in the past, move to 10 mins from now
    if (start < now) {
      adjustedStartTime = new Date(now.getTime() + 600000).toISOString();
      addStatus(`Adjusting start time to ${adjustedStartTime} (was in the past).`);
    }

    // If end is in the past or before start, move to at least 1 hour after start
    const minEnd = new Date(new Date(adjustedStartTime).getTime() + 3600000); 
    if (end < minEnd) {
      adjustedEndTime = new Date(new Date(adjustedStartTime).getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
      addStatus(`Adjusting end time to ${adjustedEndTime} (was in the past or too close to start).`);
    }

    const campaignResponse = await fetch(`https://graph.facebook.com/v19.0/${AD_ACCOUNT_ID}/campaigns`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: campaignName,
        objective: metaObjective,
        status: "PAUSED",
        special_ad_categories: ["NONE"], // Use "NONE" instead of [] for better compatibility
        bid_strategy: "LOWEST_COST_WITHOUT_CAP",
        lifetime_budget: Math.max(budget, 100) * 100, 
        access_token: META_TOKEN
      })
    });
    const campaignResult = await campaignResponse.json() as any;
    if (campaignResult.error) {
      console.error("Meta Campaign Error Detail:", JSON.stringify(campaignResult.error, null, 2));
      throw new Error(`Meta Campaign Error: ${campaignResult.error.message} (Type: ${campaignResult.error.type})`);
    }
    const campaignId = campaignResult.id;

    // Step 2: Process Ad Sets
    const { locationMap } = await fetchLocationData();

    for (const adSet of adSets) {
      addStatus(`Processing Ad Set: ${adSet.name}...`);

      // A: Targeting
      let targeting: any = {
        targeting_automation: { advantage_audience: 0 },
        publisher_platforms: ["facebook", "instagram"],
        facebook_positions: ["feed", "story", "facebook_reels", "profile_feed", "instream_video_reels"],
        instagram_positions: ["stream", "story", "explore", "reels", "profile_feed", "profile_reels"]
      };

      if (adSet.copyTargetingFromAdSetId) {
        addStatus(`Copying targeting from Ad Set ID: ${adSet.copyTargetingFromAdSetId}...`);
        const copyResponse = await fetch(`https://graph.facebook.com/v19.0/${adSet.copyTargetingFromAdSetId}?fields=targeting&access_token=${META_TOKEN}`);
        const copyData = await copyResponse.json() as any;
        if (copyData.targeting) {
          targeting = { ...copyData.targeting, ...targeting }; // Keep our placements but copy the rest
        }
      } else {
        // Default geo targeting
        targeting.geo_locations = { countries: ["AU"] };
      }

      // Manual overrides (apply to both copied and scratch targeting)
      if (adSet.locations && adSet.locations.length > 0) {
        const customLocations: any[] = [];
        adSet.locations.forEach((loc: string) => {
          const data = locationMap[loc.toLowerCase()];
          if (data) customLocations.push(data);
        });
        if (customLocations.length > 0) {
          targeting.geo_locations = { custom_locations: customLocations };
        }
      }

      if (adSet.ageMin) targeting.age_min = adSet.ageMin;
      if (adSet.ageMax) targeting.age_max = adSet.ageMax;

      // Clean up targeting to avoid "removed field" errors (e.g. targeting_optimization)
      // Note: targeting_automation with advantage_audience is REQUIRED by some ad accounts
      delete targeting.targeting_optimization;
      if (!targeting.targeting_automation) {
        targeting.targeting_automation = { advantage_audience: 0 };
      }

      // B: Custom Audience (Optional)
      if (adSet.csvData && adSet.csvName) {
        addStatus(`Creating Custom Audience: ${adSet.csvName}...`);
        const createAudienceResponse = await fetch(`https://graph.facebook.com/v19.0/${AD_ACCOUNT_ID}/customaudiences`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: adSet.csvName,
            subtype: "CUSTOM",
            customer_file_source: "USER_PROVIDED_ONLY",
            access_token: META_TOKEN
          })
        });
        const audienceResult = await createAudienceResponse.json() as any;
        if (!audienceResult.error) {
          const customAudienceId = audienceResult.id;
          targeting.custom_audiences = [{ id: customAudienceId }];
          
          const emails = adSet.csvData.split("\n").map((line: string) => line.trim()).filter((line: string) => line && line.includes("@"));
          const hashedEmails = emails.map((email: string) => hashData(email));
          await fetch(`https://graph.facebook.com/v19.0/${customAudienceId}/users`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              payload: { schema: ["EMAIL"], data: hashedEmails },
              access_token: META_TOKEN
            })
          });
        }
      }

      // C: Exclusion Audience
      addStatus(`Creating Exclusion Audience for ${adSet.name}...`);
      const exclusionRule = {
        inclusions: {
          operator: "and",
          rules: [
            {
              event_sources: [{ type: "pixel", id: "627590211536590" }],
              retention_seconds: 15552000,
              filter: {
                operator: "and",
                filters: [
                  { field: "event", operator: "eq", value: "Purchase" },
                  { field: "content_name", operator: "i_contains", value: movieName || campaignName.replace("Campaign: ", "") }
                ]
              }
            }
          ]
        }
      };

      const createExclusionResponse = await fetch(`https://graph.facebook.com/v19.0/${AD_ACCOUNT_ID}/customaudiences`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `Palace - ${adSet.name} (Purchase) - 180 days`,
          subtype: "WEBSITE",
          pixel_id: "627590211536590",
          rule: JSON.stringify(exclusionRule),
          prefill: true,
          access_token: META_TOKEN
        })
      });
      const exclusionResult = await createExclusionResponse.json() as any;
      if (!exclusionResult.error) {
        targeting.excluded_custom_audiences = [{ id: exclusionResult.id }];
      }

      // D: Create Ad Set
      const adSetPayload: any = {
        name: adSet.name,
        campaign_id: campaignId,
        billing_event: "IMPRESSIONS",
        optimization_goal: optimizationGoal,
        start_time: adjustedStartTime,
        end_time: adjustedEndTime,
        targeting: targeting,
        status: "PAUSED",
        access_token: META_TOKEN
      };
      if (attributionSpec) adSetPayload.attribution_spec = attributionSpec;
      if (promotedObject) adSetPayload.promoted_object = promotedObject;

      const adSetResponse = await fetch(`https://graph.facebook.com/v19.0/${AD_ACCOUNT_ID}/adsets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(adSetPayload)
      });
      const adSetResult = await adSetResponse.json() as any;
      if (adSetResult.error) {
        console.error("Meta Ad Set Error Detail:", JSON.stringify(adSetResult.error, null, 2));
        throw new Error(`Meta Ad Set Error: ${adSetResult.error.message} (Type: ${adSetResult.error.type})`);
      }
      const adSetId = adSetResult.id;

      // Step 3: Create Ads
      for (const ad of adSet.ads) {
        addStatus(`Creating Ad: ${ad.adName || ad.headline || 'Untitled Ad'}...`);

        let creativeId = null;

        // Check if manual Ad ID is provided
        if (ad.manualAdId) {
          addStatus(`Using existing Ad ID: ${ad.manualAdId}...`);
          const existingAdResponse = await fetch(`https://graph.facebook.com/v19.0/${ad.manualAdId}?fields=creative&access_token=${META_TOKEN}`);
          const existingAdData = await existingAdResponse.json() as any;
          if (existingAdData.creative && existingAdData.creative.id) {
            creativeId = existingAdData.creative.id;
            addStatus(`Found Creative ID: ${creativeId} from existing ad.`);
          } else {
            addStatus(`Warning: Could not find creative for Ad ID ${ad.manualAdId}. Falling back to creation.`);
          }
        }

        const ctaType = ad.ctaType || ((objective?.toLowerCase() === "sales" || objective?.toLowerCase() === "outcome_sales") ? "BOOK_NOW" : "LEARN_MORE");

        if (!creativeId && ad.type === 'video') {
          const feedUrl = getDownloadUrl(ad.feedVideoUrl);
          const verticalUrl = ad.verticalVideoUrl ? getDownloadUrl(ad.verticalVideoUrl) : null;
          const thumbnailUrl = ad.thumbnail ? getDownloadUrl(ad.thumbnail) : "https://picsum.photos/1200/628";

          addStatus(`Uploading Feed Video for ${ad.adName}...`);
          if (feedUrl?.includes("drive.google.com")) {
            addStatus("Note: Google Drive links must be 'Public' (Anyone with the link) for Meta to fetch them.");
          }
          
          const feedVideoUpload = await fetch(`https://graph.facebook.com/v19.0/${AD_ACCOUNT_ID}/advideos`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ file_url: feedUrl, access_token: META_TOKEN })
          });
          const feedVideoResult = await feedVideoUpload.json() as any;
          if (feedVideoResult.error) {
            addStatus(`Feed Video Upload Error: ${feedVideoResult.error.message}`);
            addStatus(`URL attempted: ${feedUrl}`);
            continue;
          }
          const feedVideoId = feedVideoResult.id;

          let verticalVideoId = null;
          if (verticalUrl) {
            addStatus(`Uploading Vertical Video for ${ad.adName}...`);
            const verticalVideoUpload = await fetch(`https://graph.facebook.com/v19.0/${AD_ACCOUNT_ID}/advideos`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ file_url: verticalUrl, access_token: META_TOKEN })
            });
            const verticalVideoResult = await verticalVideoUpload.json() as any;
            if (verticalVideoResult.error) {
              addStatus(`Vertical Video Upload Error: ${verticalVideoResult.error.message}`);
              addStatus(`URL attempted: ${verticalUrl}`);
            } else {
              verticalVideoId = verticalVideoResult.id;
            }
          }

          addStatus("Waiting for video processing to complete...");
          const feedReady = await waitForVideoProcessing(feedVideoId, META_TOKEN, addStatus);
          if (!feedReady) {
            addStatus(`Skipping creative creation for ${ad.adName} because feed video is not ready.`);
            continue;
          }

          if (verticalVideoId) {
            const verticalReady = await waitForVideoProcessing(verticalVideoId, META_TOKEN, addStatus);
            if (!verticalReady) {
              addStatus(`Warning: Vertical video for ${ad.adName} failed processing. Falling back to feed video only.`);
              verticalVideoId = null;
            }
          }

          const creativePayload: any = {
            name: `Creative: ${ad.adName || ad.headline}`,
            object_story_spec: {
              page_id: PAGE_ID,
              instagram_user_id: INSTAGRAM_ID,
              video_data: {
                video_id: feedVideoId,
                image_url: thumbnailUrl,
                title: ad.headline,
                message: ad.copy,
                call_to_action: { type: ctaType, value: { link: ad.url } }
              }
            },
            access_token: META_TOKEN
          };

          if (verticalVideoId) {
            creativePayload.asset_customization_rules = [
              {
                customization_spec: { 
                  placements: [
                    "facebook_story", 
                    "instagram_story", 
                    "instagram_reels", 
                    "facebook_reels",
                    "profile_reels",
                    "instream_video_reels"
                  ] 
                },
                video_id: verticalVideoId
              }
            ];
          }

          const creativeResponse = await fetch(`https://graph.facebook.com/v19.0/${AD_ACCOUNT_ID}/adcreatives`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(creativePayload)
          });
          const creativeResult = await creativeResponse.json() as any;
          if (creativeResult.error) {
            addStatus(`Creative Creation Error: ${creativeResult.error.message}`);
            if (creativeResult.error.error_user_msg) addStatus(`Detail: ${creativeResult.error.error_user_msg}`);
            console.error("Full Creative Error:", JSON.stringify(creativeResult.error, null, 2));
            continue;
          }
          creativeId = creativeResult.id;
        } else if (!creativeId && ad.type === 'carousel') {
          addStatus(`Creating Carousel Ad Creative for ${ad.adName}...`);
          
          const thumbnailUrl = ad.thumbnail ? getDownloadUrl(ad.thumbnail) : "https://picsum.photos/1080/1080";
          
          // Use carouselCards if provided, otherwise fallback to thumbnail
          const cards = (ad.carouselCards && ad.carouselCards.length > 0) 
            ? ad.carouselCards.map((c: any) => ({ ...c, imageUrl: getDownloadUrl(c.imageUrl) }))
            : [{ imageUrl: thumbnailUrl, headline: ad.headline, url: ad.url }];
          
          const creativePayload: any = {
            name: `Creative: ${ad.adName || ad.headline}`,
            object_story_spec: {
              page_id: PAGE_ID,
              instagram_user_id: INSTAGRAM_ID,
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
            },
            access_token: META_TOKEN
          };
          const creativeResponse = await fetch(`https://graph.facebook.com/v19.0/${AD_ACCOUNT_ID}/adcreatives`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(creativePayload)
          });
          const creativeResult = await creativeResponse.json() as any;
          if (creativeResult.error) {
            addStatus(`Creative Creation Error: ${creativeResult.error.message}`);
            continue;
          }
          creativeId = creativeResult.id;
        } else if (!creativeId && ad.type === 'image') {
          addStatus(`Creating Image Ad Creative for ${ad.adName}...`);
          const thumbnailUrl = ad.thumbnail ? getDownloadUrl(ad.thumbnail) : "https://picsum.photos/1200/628";
          
          const creativePayload: any = {
            name: `Creative: ${ad.adName || ad.headline}`,
            object_story_spec: {
              page_id: PAGE_ID,
              instagram_user_id: INSTAGRAM_ID,
              link_data: {
                image_url: thumbnailUrl,
                link: ad.url,
                message: ad.copy,
                name: ad.headline,
                call_to_action: { type: ctaType, value: { link: ad.url } }
              }
            },
            access_token: META_TOKEN
          };
          const creativeResponse = await fetch(`https://graph.facebook.com/v19.0/${AD_ACCOUNT_ID}/adcreatives`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(creativePayload)
          });
          const creativeResult = await creativeResponse.json() as any;
          if (creativeResult.error) {
            addStatus(`Creative Creation Error: ${creativeResult.error.message}`);
            continue;
          }
          creativeId = creativeResult.id;
        }

        if (creativeId) {
          addStatus(`Publishing Ad: ${ad.adName}...`);
          const adPayload: any = {
            name: ad.adName || `Ad: ${ad.headline}`,
            adset_id: adSetId,
            creative: { creative_id: creativeId },
            status: "PAUSED",
            ad_format: "DESKTOP_FEED_STANDARD", // Try to force standard format to avoid enhancements
            multi_advertiser_ads_enabled: false,
            url_tags: ad.customUrlParams || `utm_source=facebook-instagram&utm_medium=gruvi-cpc&utm_campaign={{campaign.name}}&utm_content={{ad.name}}&utm_term={{adset.name}}&campaign_id={{campaign.id}}&adset_id={{adset.id}}&ad_id={{ad.id}}`,
            access_token: META_TOKEN
          };

          const adResponse = await fetch(`https://graph.facebook.com/v19.0/${AD_ACCOUNT_ID}/ads`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(adPayload)
          });
          const adResult = await adResponse.json() as any;
          if (adResult.error) {
            addStatus(`Ad Publishing Error: ${adResult.error.message}`);
          } else {
            addStatus(`Ad Published Successfully! ID: ${adResult.id}`);
          }
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
