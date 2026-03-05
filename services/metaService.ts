import axios from "axios";
import crypto from "crypto";
import { MetaClientConfig } from "../config/clientsConfig";

// Helper to wait
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Helper to convert Drive/Dropbox links to download links
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

// Helper to wait for Meta video processing with polling
const waitForVideoProcessing = async (videoId: string, metaToken: string, addStatus: (msg: string) => void) => {
  addStatus(`Checking processing status for video ${videoId}...`);
  const maxAttempts = 20; 
  const interval = 15000; 

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await axios.get(`https://graph.facebook.com/v19.0/${videoId}?fields=status&access_token=${metaToken}`);
      const data = response.data;

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

      await sleep(interval);
    } catch (e: any) {
      addStatus(`Network error checking video status: ${e.message}`);
      await sleep(interval);
    }
  }

  addStatus(`Timed out waiting for video ${videoId} to process.`);
  return false;
};

// Helper to fetch location data
export const fetchLocationData = async () => {
  try {
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

export const fetchAdAccounts = async (accessToken: string) => {
  let allAccounts: any[] = [];
  let nextUrl: string | null = `https://graph.facebook.com/v19.0/me/adaccounts?fields=name,id&access_token=${accessToken}`;

  while (nextUrl) {
    const response = await axios.get(nextUrl);
    const data = response.data;
    if (data.error) throw new Error(data.error.message);
    allAccounts = [...allAccounts, ...(data.data || [])];
    nextUrl = data.paging?.next || null;
  }
  
  return allAccounts;
};

export const fetchPages = async (accessToken: string) => {
  let allPages: any[] = [];
  let nextUrl: string | null = `https://graph.facebook.com/v19.0/me/accounts?fields=name,id,access_token,instagram_business_account&access_token=${accessToken}`;

  while (nextUrl) {
    const response = await axios.get(nextUrl);
    const data = response.data;
    if (data.error) throw new Error(data.error.message);
    
    const batch = data.data || [];
    allPages = [...allPages, ...batch];
    
    // Meta pagination: next is a full URL
    nextUrl = data.paging?.next || null;
  }

  return allPages;
};

export const fetchInstagramAccount = async (pageId: string, pageAccessToken: string) => {
  const response = await axios.get(`https://graph.facebook.com/v19.0/${pageId}?fields=instagram_business_account&access_token=${pageAccessToken}`);
  const data = response.data;
  if (data.error) throw new Error(data.error.message);
  return data.instagram_business_account;
};

export const createMetaCampaign = async (clientConfig: MetaClientConfig, brief: any) => {
  const statusUpdates: string[] = [];
  const addStatus = (msg: string) => {
    console.log(msg);
    statusUpdates.push(msg);
  };

  try {
    const META_TOKEN = clientConfig.accessToken;
    let AD_ACCOUNT_ID = brief.adAccountId || clientConfig.adAccountId;
    const PIXEL_ID = clientConfig.pixelId;

    if (!META_TOKEN || !AD_ACCOUNT_ID) {
      throw new Error("Missing Meta API configuration for this client.");
    }

    if (!AD_ACCOUNT_ID.startsWith('act_')) {
      AD_ACCOUNT_ID = `act_${AD_ACCOUNT_ID}`;
    }

    const { movieName, campaignName, objective, startDate, endDate, budget, adSets } = brief;

    // Step 1: Create Campaign
    addStatus(`Creating Meta Campaign: ${campaignName}...`);
    
    let metaObjective = "OUTCOME_SALES";
    let optimizationGoal = "OFFSITE_CONVERSIONS";
    let attributionSpec = null;
    let promotedObject = null;

    const standardAttribution = [
      { event_type: "CLICK_THROUGH", window_days: 7 },
      { event_type: "VIEW_THROUGH", window_days: 1 },
      { event_type: "ENGAGED_VIDEO_VIEW", window_days: 1 }
    ];

    if (objective === "Sales") {
      metaObjective = "OUTCOME_SALES";
      optimizationGoal = "OFFSITE_CONVERSIONS";
      attributionSpec = standardAttribution;
      promotedObject = { pixel_id: PIXEL_ID, custom_event_type: "PURCHASE" };
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

    if (!startDate || !endDate) {
      throw new Error("Campaign start and end dates are required.");
    }

    const now = new Date();
    const start = new Date(startDate);
    const end = new Date(endDate);

    let adjustedStartTime = startDate;
    let adjustedEndTime = endDate;

    if (start < now) {
      adjustedStartTime = new Date(now.getTime() + 600000).toISOString();
      addStatus(`Adjusting start time to ${adjustedStartTime} (was in the past).`);
    }

    const minEnd = new Date(new Date(adjustedStartTime).getTime() + 3600000); 
    if (end < minEnd) {
      adjustedEndTime = new Date(new Date(adjustedStartTime).getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
      addStatus(`Adjusting end time to ${adjustedEndTime} (was in the past or too close to start).`);
    }

    const campaignResponse = await axios.post(`https://graph.facebook.com/v19.0/${AD_ACCOUNT_ID}/campaigns`, {
      name: campaignName,
      objective: metaObjective,
      status: "PAUSED",
      special_ad_categories: ["NONE"],
      bid_strategy: "LOWEST_COST_WITHOUT_CAP",
      lifetime_budget: Math.max(budget, 100) * 100, 
      access_token: META_TOKEN
    });
    const campaignResult = campaignResponse.data;
    if (campaignResult.error) {
      throw new Error(`Meta Campaign Error: ${campaignResult.error.message}`);
    }
    const campaignId = campaignResult.id;

    // Step 2: Process Ad Sets
    const { locationMap } = await fetchLocationData();

    for (const adSet of adSets) {
      addStatus(`Processing Ad Set: ${adSet.name}...`);
      
      const PAGE_ID = adSet.pageId || clientConfig.pageId;
      const INSTAGRAM_ID = adSet.instagramUserId || clientConfig.instagramUserId || "102615919157239";

      let targeting: any = {
        targeting_automation: { advantage_audience: 0 },
        publisher_platforms: ["facebook", "instagram"],
        facebook_positions: ["feed", "story", "facebook_reels", "profile_feed", "instream_video_reels"],
        instagram_positions: ["stream", "story", "explore", "reels", "profile_feed", "profile_reels"]
      };

      if (adSet.copyTargetingFromAdSetId) {
        addStatus(`Copying targeting from Ad Set ID: ${adSet.copyTargetingFromAdSetId}...`);
        const copyResponse = await axios.get(`https://graph.facebook.com/v19.0/${adSet.copyTargetingFromAdSetId}?fields=targeting&access_token=${META_TOKEN}`);
        const copyData = copyResponse.data;
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
        }
      }

      if (adSet.ageMin) targeting.age_min = adSet.ageMin;
      if (adSet.ageMax) targeting.age_max = adSet.ageMax;

      delete targeting.targeting_optimization;
      if (!targeting.targeting_automation) {
        targeting.targeting_automation = { advantage_audience: 0 };
      }

      if (adSet.csvData && adSet.csvName) {
        addStatus(`Creating Custom Audience: ${adSet.csvName}...`);
        const createAudienceResponse = await axios.post(`https://graph.facebook.com/v19.0/${AD_ACCOUNT_ID}/customaudiences`, {
          name: adSet.csvName,
          subtype: "CUSTOM",
          customer_file_source: "USER_PROVIDED_ONLY",
          access_token: META_TOKEN
        });
        const audienceResult = createAudienceResponse.data;
        if (!audienceResult.error) {
          const customAudienceId = audienceResult.id;
          targeting.custom_audiences = [{ id: customAudienceId }];
          
          const emails = adSet.csvData.split("\n").map((line: string) => line.trim()).filter((line: string) => line && line.includes("@"));
          const hashedEmails = emails.map((email: string) => hashData(email));
          await axios.post(`https://graph.facebook.com/v19.0/${customAudienceId}/users`, {
            payload: { schema: ["EMAIL"], data: hashedEmails },
            access_token: META_TOKEN
          });
        }
      }

      addStatus(`Creating Exclusion Audience for ${adSet.name}...`);
      const exclusionRule = {
        inclusions: {
          operator: "and",
          rules: [
            {
              event_sources: [{ type: "pixel", id: PIXEL_ID }],
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

      const createExclusionResponse = await axios.post(`https://graph.facebook.com/v19.0/${AD_ACCOUNT_ID}/customaudiences`, {
        name: `Palace - ${adSet.name} (Purchase) - 180 days`,
        subtype: "WEBSITE",
        pixel_id: PIXEL_ID,
        rule: JSON.stringify(exclusionRule),
        prefill: true,
        access_token: META_TOKEN
      });
      const exclusionResult = createExclusionResponse.data;
      if (!exclusionResult.error) {
        targeting.excluded_custom_audiences = [{ id: exclusionResult.id }];
      }

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

      const adSetResponse = await axios.post(`https://graph.facebook.com/v19.0/${AD_ACCOUNT_ID}/adsets`, {
        ...adSetPayload,
        access_token: META_TOKEN
      });
      const adSetResult = adSetResponse.data;
      if (adSetResult.error) {
        throw new Error(`Meta Ad Set Error: ${adSetResult.error.message}`);
      }
      const adSetId = adSetResult.id;

      for (const ad of adSet.ads) {
        addStatus(`Creating Ad: ${ad.adName || ad.headline || 'Untitled Ad'}...`);

        let creativeId = null;

        if (ad.manualAdId) {
          addStatus(`Using existing Ad ID: ${ad.manualAdId}...`);
          const existingAdResponse = await axios.get(`https://graph.facebook.com/v19.0/${ad.manualAdId}?fields=creative&access_token=${META_TOKEN}`);
          const existingAdData = existingAdResponse.data;
          if (existingAdData.creative && existingAdData.creative.id) {
            creativeId = existingAdData.creative.id;
          }
        }

        const ctaType = ad.ctaType || ((objective?.toLowerCase() === "sales" || objective?.toLowerCase() === "outcome_sales") ? "BOOK_NOW" : "LEARN_MORE");

        if (!creativeId && ad.type === 'video') {
          const feedUrl = getDownloadUrl(ad.feedVideoUrl);
          const verticalUrl = ad.verticalVideoUrl ? getDownloadUrl(ad.verticalVideoUrl) : null;
          const thumbnailUrl = ad.thumbnail ? getDownloadUrl(ad.thumbnail) : "https://picsum.photos/1200/628";

          addStatus(`Uploading Feed Video for ${ad.adName}...`);
          const feedVideoUpload = await axios.post(`https://graph.facebook.com/v19.0/${AD_ACCOUNT_ID}/advideos`, {
            file_url: feedUrl,
            access_token: META_TOKEN
          });
          const feedVideoResult = feedVideoUpload.data;
          if (feedVideoResult.error) {
            addStatus(`Feed Video Upload Error: ${feedVideoResult.error.message}`);
            continue;
          }
          const feedVideoId = feedVideoResult.id;

          let verticalVideoId = null;
          if (verticalUrl) {
            addStatus(`Uploading Vertical Video for ${ad.adName}...`);
            const verticalVideoUpload = await axios.post(`https://graph.facebook.com/v19.0/${AD_ACCOUNT_ID}/advideos`, {
              file_url: verticalUrl,
              access_token: META_TOKEN
            });
            const verticalVideoResult = verticalVideoUpload.data;
            if (!verticalVideoResult.error) {
              verticalVideoId = verticalVideoResult.id;
            }
          }

          addStatus("Waiting for video processing to complete...");
          const feedReady = await waitForVideoProcessing(feedVideoId, META_TOKEN, addStatus);
          if (!feedReady) continue;

          if (verticalVideoId) {
            const verticalReady = await waitForVideoProcessing(verticalVideoId, META_TOKEN, addStatus);
            if (!verticalReady) verticalVideoId = null;
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

          const creativeResponse = await axios.post(`https://graph.facebook.com/v19.0/${AD_ACCOUNT_ID}/adcreatives`, {
            ...creativePayload,
            access_token: META_TOKEN
          });
          const creativeResult = creativeResponse.data;
          if (creativeResult.error) {
            addStatus(`Creative Creation Error: ${creativeResult.error.message}`);
            continue;
          }
          creativeId = creativeResult.id;
        } else if (!creativeId && ad.type === 'carousel') {
          addStatus(`Creating Carousel Ad Creative for ${ad.adName}...`);
          const thumbnailUrl = ad.thumbnail ? getDownloadUrl(ad.thumbnail) : "https://picsum.photos/1080/1080";
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
          const creativeResponse = await axios.post(`https://graph.facebook.com/v19.0/${AD_ACCOUNT_ID}/adcreatives`, {
            ...creativePayload,
            access_token: META_TOKEN
          });
          const creativeResult = creativeResponse.data;
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
          const creativeResponse = await axios.post(`https://graph.facebook.com/v19.0/${AD_ACCOUNT_ID}/adcreatives`, {
            ...creativePayload,
            access_token: META_TOKEN
          });
          const creativeResult = creativeResponse.data;
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
            ad_format: "DESKTOP_FEED_STANDARD",
            multi_advertiser_ads_enabled: false,
            url_tags: ad.customUrlParams || `utm_source=facebook-instagram&utm_medium=gruvi-cpc&utm_campaign={{campaign.name}}&utm_content={{ad.name}}&utm_term={{adset.name}}&campaign_id={{campaign.id}}&adset_id={{adset.id}}&ad_id={{ad.id}}`,
            access_token: META_TOKEN
          };

          const adResponse = await axios.post(`https://graph.facebook.com/v19.0/${AD_ACCOUNT_ID}/ads`, {
            ...adPayload,
            access_token: META_TOKEN
          });
          const adResult = adResponse.data;
          if (adResult.error) {
            addStatus(`Ad Publishing Error: ${adResult.error.message}`);
          } else {
            addStatus(`Ad Published Successfully! ID: ${adResult.id}`);
          }
        }
      }
    }

    addStatus("Campaign Automation Complete!");
    return { success: true, logs: statusUpdates };

  } catch (error: any) {
    console.error(error);
    return { success: false, error: error.message, logs: statusUpdates };
  }
};
