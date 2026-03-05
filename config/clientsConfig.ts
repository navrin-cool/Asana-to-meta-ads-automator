export interface MetaClientConfig {
  adAccountId: string;
  pageId: string;
  instagramUserId?: string;
  pixelId: string;
  accessToken: string;
}

export interface ClientConfig {
  id: string;
  name: string;
  platforms: {
    meta?: MetaClientConfig;
    tiktok?: any; // Placeholder for future
  };
}

export const clientsConfig: Record<string, ClientConfig> = {
  "palace-cinemas": {
    id: "palace-cinemas",
    name: "Palace Cinemas",
    platforms: {
      meta: {
        adAccountId: process.env.META_AD_ACCOUNT_ID || "",
        pageId: process.env.META_PAGE_ID || "",
        instagramUserId: "102615919157239",
        pixelId: "627590211536590",
        accessToken: process.env.META_ACCESS_TOKEN || "",
      }
    }
  }
};
