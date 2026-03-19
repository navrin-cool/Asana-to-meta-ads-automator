import express from "express";
import dotenv from "dotenv";
import fetch from "node-fetch";
import crypto from "crypto";
import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import os from "os";
import { pipeline } from "stream";
import { promisify } from "util";
import multer from "multer";
import FormData from "form-data";
import { parse } from "csv-parse/sync";
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const streamPipeline = promisify(pipeline);
const upload = multer({ dest: os.tmpdir() });

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
      return `https://drive.google.com/uc?id=${match[1]}&export=download&confirm=t`;
    }
  }
  
  return cleanUrl;
};

// Helper to download a file from a URL to a temporary path
const downloadFile = async (rawUrl: string): Promise<string> => {
  const url = getDownloadUrl(rawUrl);
  if (!url || !url.startsWith("http")) {
    throw new Error(`Invalid URL provided for download: "${url}"`);
  }
  const response = await fetch(url, { redirect: 'follow' });
  if (!response.ok) throw new Error(`Failed to download file from ${url}: ${response.statusText}`);
  
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("text/html")) {
    throw new Error(`The URL provided returned an HTML page instead of a file. This often happens with Google Drive or Dropbox links that are not direct download links, or if the file is too large and shows a virus scan warning. URL: ${url}`);
  }
  let ext = "";
  if (contentType.includes("video/mp4")) ext = ".mp4";
  else if (contentType.includes("video/quicktime")) ext = ".mov";
  else if (contentType.includes("image/jpeg")) ext = ".jpg";
  else if (contentType.includes("image/png")) ext = ".png";
  else if (contentType.includes("image/gif")) ext = ".gif";
  
  // Try to get from URL if content-type is generic
  if (!ext) {
    try {
      const urlPath = new URL(url).pathname;
      const urlExt = path.extname(urlPath);
      if (urlExt && urlExt.length < 6) ext = urlExt;
    } catch (e) {
      // Ignore URL parsing errors
    }
  }
  
  const tempPath = path.join(os.tmpdir(), `meta_asset_${crypto.randomBytes(8).toString("hex")}${ext || '.bin'}`);
  const fileStream = fs.createWriteStream(tempPath);
  
  await new Promise((resolve, reject) => {
    if (!response.body) return reject(new Error("Response body is null"));
    response.body.pipe(fileStream);
    response.body.on("error", reject);
    fileStream.on("finish", () => resolve(tempPath));
    fileStream.on("error", reject);
  });
  
  return tempPath;
};

dotenv.config();

// Hybrid Database Path: Use /tmp for SQLite on Vercel, local file otherwise
const dbPath = process.env.VERCEL 
  ? path.join(os.tmpdir(), "campaign_automator.db") 
  : path.join(process.cwd(), "campaign_automator.db");

const db = new Database(dbPath);

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

// Hardcoded Data for Seeding
const brandsData = [
  {"CLIENT_NAME":"Palace Cinemas","BRAND_NAME":"Palace Cinemas","META_PAGE_ID":"947415075356990","INSTAGRAM_PAGE_ID":"17841400293047168","TIKTOK_PAGE_ID":"","META_AD_ACCOUNT_ID":"act_1980661575743458","TIKTOK_AD_ACCOUNT_ID":"","META_PIXEL_ID":"627590211536590","TIKTOK_PIXEL_ID":"","META_ACCESS_TOKEN":"EAALL40C26hcBQ9SRU1q1NFZBnR1A5akfhaN29Bcm48ZCX0eSZC3LvZAJovXR6ZAq1JmKZBhamMUs26reoxksdTHkgCHO5frDPmCyfnICG0hBkF7P7riSmg3inT9fcT7jeWh6LvOO6i2s2lGAxixW3feandtjXmDSKdsfjGY3fp7X3bIPgpW9OPvjm4uklZCbfzV1gZDZD","TIKTOK_ACCESS_TOKEN":"","ASANA_PAT":"2/1200558601745523/1213331235166555:e24c248f8d16a5c3dc313a93983169b8"},
  {"CLIENT_NAME":"Moving Story","BRAND_NAME":"Classic Cinemas","META_PAGE_ID":"126864948822","INSTAGRAM_PAGE_ID":"17841400405604429","TIKTOK_PAGE_ID":"","META_AD_ACCOUNT_ID":"act_440729647365943","TIKTOK_AD_ACCOUNT_ID":"","META_PIXEL_ID":"213848060612075","TIKTOK_PIXEL_ID":"","META_ACCESS_TOKEN":"EAALL40C26hcBQ9SRU1q1NFZBnR1A5akfhaN29Bcm48ZCX0eSZC3LvZAJovXR6ZAq1JmKZBhamMUs26reoxksdTHkgCHO5frDPmCyfnICG0hBkF7P7riSmg3inT9fcT7jeWh6LvOO6i2s2lGAxixW3feandtjXmDSKdsfjGY3fp7X3bIPgpW9OPvjm4uklZCbfzV1gZDZD","TIKTOK_ACCESS_TOKEN":"","ASANA_PAT":"2/1200558601745523/1213331235166555:e24c248f8d16a5c3dc313a93983169b8"},
  {"CLIENT_NAME":"Moving Story","BRAND_NAME":"Lido Cinemas","META_PAGE_ID":"711293905547605","INSTAGRAM_PAGE_ID":"17841400216501946","TIKTOK_PAGE_ID":"","META_AD_ACCOUNT_ID":"act_440729647365943","TIKTOK_AD_ACCOUNT_ID":"","META_PIXEL_ID":"213848060612075","TIKTOK_PIXEL_ID":"","META_ACCESS_TOKEN":"EAALL40C26hcBQ9SRU1q1NFZBnR1A5akfhaN29Bcm48ZCX0eSZC3LvZAJovXR6ZAq1JmKZBhamMUs26reoxksdTHkgCHO5frDPmCyfnICG0hBkF7P7riSmg3inT9fcT7jeWh6LvOO6i2s2lGAxixW3feandtjXmDSKdsfjGY3fp7X3bIPgpW9OPvjm4uklZCbfzV1gZDZD","TIKTOK_ACCESS_TOKEN":"","ASANA_PAT":"2/1200558601745523/1213331235166555:e24c248f8d16a5c3dc313a93983169b8"},
  {"CLIENT_NAME":"Moving Story","BRAND_NAME":"Cameo Cinemas","META_PAGE_ID":"180938768076","INSTAGRAM_PAGE_ID":"17841400799340091","TIKTOK_PAGE_ID":"","META_AD_ACCOUNT_ID":"act_440729647365943","TIKTOK_AD_ACCOUNT_ID":"","META_PIXEL_ID":"213848060612075","TIKTOK_PIXEL_ID":"","META_ACCESS_TOKEN":"EAALL40C26hcBQ9SRU1q1NFZBnR1A5akfhaN29Bcm48ZCX0eSZC3LvZAJovXR6ZAq1JmKZBhamMUs26reoxksdTHkgCHO5frDPmCyfnICG0hBkF7P7riSmg3inT9fcT7jeWh6LvOO6i2s2lGAxixW3feandtjXmDSKdsfjGY3fp7X3bIPgpW9OPvjm4uklZCbfzV1gZDZD","TIKTOK_ACCESS_TOKEN":"","ASANA_PAT":"2/1200558601745523/1213331235166555:e24c248f8d16a5c3dc313a93983169b8"},
  {"CLIENT_NAME":"Moving Story","BRAND_NAME":"Ritz Cinemas","META_PAGE_ID":"103726829691577","INSTAGRAM_PAGE_ID":"17841401032673150","TIKTOK_PAGE_ID":"","META_AD_ACCOUNT_ID":"act_440729647365943","TIKTOK_AD_ACCOUNT_ID":"","META_PIXEL_ID":"213848060612075","TIKTOK_PIXEL_ID":"","META_ACCESS_TOKEN":"EAALL40C26hcBQ9SRU1q1NFZBnR1A5akfhaN29Bcm48ZCX0eSZC3LvZAJovXR6ZAq1JmKZBhamMUs26reoxksdTHkgCHO5frDPmCyfnICG0hBkF7P7riSmg3inT9fcT7jeWh6LvOO6i2s2lGAxixW3feandtjXmDSKdsfjGY3fp7X3bIPgpW9OPvjm4uklZCbfzV1gZDZD","TIKTOK_ACCESS_TOKEN":"","ASANA_PAT":"2/1200558601745523/1213331235166555:e24c248f8d16a5c3dc313a93983169b8"},
  {"CLIENT_NAME":"Reading Cinemas","BRAND_NAME":"Reading Cinemas - Australia","META_PAGE_ID":"156886911053167","INSTAGRAM_PAGE_ID":"17841400843124769","TIKTOK_PAGE_ID":"","META_AD_ACCOUNT_ID":"act_1378797462367397","TIKTOK_AD_ACCOUNT_ID":"","META_PIXEL_ID":"567384272786736","TIKTOK_PIXEL_ID":"","META_ACCESS_TOKEN":"EAALL40C26hcBQ9SRU1q1NFZBnR1A5akfhaN29Bcm48ZCX0eSZC3LvZAJovXR6ZAq1JmKZBhamMUs26reoxksdTHkgCHO5frDPmCyfnICG0hBkF7P7riSmg3inT9fcT7jeWh6LvOO6i2s2lGAxixW3feandtjXmDSKdsfjGY3fp7X3bIPgpW9OPvjm4uklZCbfzV1gZDZD","TIKTOK_ACCESS_TOKEN":"","ASANA_PAT":"2/1200558601745523/1213331235166555:e24c248f8d16a5c3dc313a93983169b8"},
  {"CLIENT_NAME":"Reading Cinemas","BRAND_NAME":"Reading Cinemas - New Zealand","META_PAGE_ID":"394081097321259","INSTAGRAM_PAGE_ID":"17841402245508157","TIKTOK_PAGE_ID":"","META_AD_ACCOUNT_ID":"act_1378797462367397","TIKTOK_AD_ACCOUNT_ID":"","META_PIXEL_ID":"567384272786736","TIKTOK_PIXEL_ID":"","META_ACCESS_TOKEN":"EAALL40C26hcBQ9SRU1q1NFZBnR1A5akfhaN29Bcm48ZCX0eSZC3LvZAJovXR6ZAq1JmKZBhamMUs26reoxksdTHkgCHO5frDPmCyfnICG0hBkF7P7riSmg3inT9fcT7jeWh6LvOO6i2s2lGAxixW3feandtjXmDSKdsfjGY3fp7X3bIPgpW9OPvjm4uklZCbfzV1gZDZD","TIKTOK_ACCESS_TOKEN":"","ASANA_PAT":"2/1200558601745523/1213331235166555:e24c248f8d16a5c3dc313a93983169b8"},
  {"CLIENT_NAME":"Reading Cinemas","BRAND_NAME":"State Cinema","META_PAGE_ID":"156883271006621","INSTAGRAM_PAGE_ID":"17841402322159893","TIKTOK_PAGE_ID":"","META_AD_ACCOUNT_ID":"act_1378797462367397","TIKTOK_AD_ACCOUNT_ID":"","META_PIXEL_ID":"567384272786736","TIKTOK_PIXEL_ID":"","META_ACCESS_TOKEN":"EAALL40C26hcBQ9SRU1q1NFZBnR1A5akfhaN29Bcm48ZCX0eSZC3LvZAJovXR6ZAq1JmKZBhamMUs26reoxksdTHkgCHO5frDPmCyfnICG0hBkF7P7riSmg3inT9fcT7jeWh6LvOO6i2s2lGAxixW3feandtjXmDSKdsfjGY3fp7X3bIPgpW9OPvjm4uklZCbfzV1gZDZD","TIKTOK_ACCESS_TOKEN":"","ASANA_PAT":"2/1200558601745523/1213331235166555:e24c248f8d16a5c3dc313a93983169b8"},
  {"CLIENT_NAME":"Reading Cinemas","BRAND_NAME":"Angelika Cinemas","META_PAGE_ID":"102997555940666","INSTAGRAM_PAGE_ID":"17841460256114682","TIKTOK_PAGE_ID":"","META_AD_ACCOUNT_ID":"act_1378797462367397","TIKTOK_AD_ACCOUNT_ID":"","META_PIXEL_ID":"567384272786736","TIKTOK_PIXEL_ID":"","META_ACCESS_TOKEN":"EAALL40C26hcBQ9SRU1q1NFZBnR1A5akfhaN29Bcm48ZCX0eSZC3LvZAJovXR6ZAq1JmKZBhamMUs26reoxksdTHkgCHO5frDPmCyfnICG0hBkF7P7riSmg3inT9fcT7jeWh6LvOO6i2s2lGAxixW3feandtjXmDSKdsfjGY3fp7X3bIPgpW9OPvjm4uklZCbfzV1gZDZD","TIKTOK_ACCESS_TOKEN":"","ASANA_PAT":"2/1200558601745523/1213331235166555:e24c248f8d16a5c3dc313a93983169b8"}
];

const locationsData = [
  {"CLIENT_NAME":"Palace Cinemas","BRAND_NAME":"Palace Cinemas","Cinema Name":"Palace Balwyn","Latitude":"-37.8123","Longitude":"145.0784","Radius":"16","Distance Unit":"kilometer","JSON Snippet":"{\"latitude\":-37.8123,\"longitude\":145.0784,\"radius\":16,\"distance_unit\":\"kilometer\"}"},
  {"CLIENT_NAME":"Palace Cinemas","BRAND_NAME":"Palace Cinemas","Cinema Name":"The Astor","Latitude":"-37.8584","Longitude":"144.9928","Radius":"16","Distance Unit":"kilometer","JSON Snippet":"{\"latitude\":-37.8584,\"longitude\":144.9928,\"radius\":16,\"distance_unit\":\"kilometer\"}"},
  {"CLIENT_NAME":"Palace Cinemas","BRAND_NAME":"Palace Cinemas","Cinema Name":"Palace Brighton Bay","Latitude":"-37.8997","Longitude":"144.9996","Radius":"16","Distance Unit":"kilometer","JSON Snippet":"{\"latitude\":-37.8997,\"longitude\":144.9996,\"radius\":16,\"distance_unit\":\"kilometer\"}"},
  {"CLIENT_NAME":"Palace Cinemas","BRAND_NAME":"Palace Cinemas","Cinema Name":"Palace Cinema Como","Latitude":"-37.8398","Longitude":"144.9942","Radius":"16","Distance Unit":"kilometer","JSON Snippet":"{\"latitude\":-37.8398,\"longitude\":144.9942,\"radius\":16,\"distance_unit\":\"kilometer\"}"},
  {"CLIENT_NAME":"Palace Cinemas","BRAND_NAME":"Palace Cinemas","Cinema Name":"Kino Cinema","Latitude":"-37.814","Longitude":"144.9723","Radius":"16","Distance Unit":"kilometer","JSON Snippet":"{\"latitude\":-37.814,\"longitude\":144.9723,\"radius\":16,\"distance_unit\":\"kilometer\"}"},
  {"CLIENT_NAME":"Palace Cinemas","BRAND_NAME":"Palace Cinemas","Cinema Name":"Palace Westgarth","Latitude":"-37.7812","Longitude":"144.9959","Radius":"16","Distance Unit":"kilometer","JSON Snippet":"{\"latitude\":-37.7812,\"longitude\":144.9959,\"radius\":16,\"distance_unit\":\"kilometer\"}"},
  {"CLIENT_NAME":"Palace Cinemas","BRAND_NAME":"Palace Cinemas","Cinema Name":"Pentridge Cinema","Latitude":"-37.7479","Longitude":"144.9702","Radius":"16","Distance Unit":"kilometer","JSON Snippet":"{\"latitude\":-37.7479,\"longitude\":144.9702,\"radius\":16,\"distance_unit\":\"kilometer\"}"},
  {"CLIENT_NAME":"Palace Cinemas","BRAND_NAME":"Palace Cinemas","Cinema Name":"Palace Penny Lane","Latitude":"-37.7663","Longitude":"144.9248","Radius":"16","Distance Unit":"kilometer","JSON Snippet":"{\"latitude\":-37.7663,\"longitude\":144.9248,\"radius\":16,\"distance_unit\":\"kilometer\"}"},
  {"CLIENT_NAME":"Palace Cinemas","BRAND_NAME":"Palace Cinemas","Cinema Name":"Palace Norton Street","Latitude":"-33.8824","Longitude":"151.1565","Radius":"16","Distance Unit":"kilometer","JSON Snippet":"{\"latitude\":-33.8824,\"longitude\":151.1565,\"radius\":16,\"distance_unit\":\"kilometer\"}"},
  {"CLIENT_NAME":"Palace Cinemas","BRAND_NAME":"Palace Cinemas","Cinema Name":"Palace Central","Latitude":"-33.8841","Longitude":"151.2007","Radius":"16","Distance Unit":"kilometer","JSON Snippet":"{\"latitude\":-33.8841,\"longitude\":151.2007,\"radius\":16,\"distance_unit\":\"kilometer\"}"},
  {"CLIENT_NAME":"Palace Cinemas","BRAND_NAME":"Palace Cinemas","Cinema Name":"Palace Moore Park","Latitude":"-33.8943","Longitude":"151.2238","Radius":"16","Distance Unit":"kilometer","JSON Snippet":"{\"latitude\":-33.8943,\"longitude\":151.2238,\"radius\":16,\"distance_unit\":\"kilometer\"}"},
  {"CLIENT_NAME":"Palace Cinemas","BRAND_NAME":"Palace Cinemas","Cinema Name":"Palace Ballina Fair","Latitude":"-28.8601","Longitude":"153.5497","Radius":"16","Distance Unit":"kilometer","JSON Snippet":"{\"latitude\":-28.8601,\"longitude\":153.5497,\"radius\":16,\"distance_unit\":\"kilometer\"}"},
  {"CLIENT_NAME":"Palace Cinemas","BRAND_NAME":"Palace Cinemas","Cinema Name":"Palace James St","Latitude":"-27.4586","Longitude":"153.0401","Radius":"16","Distance Unit":"kilometer","JSON Snippet":"{\"latitude\":-27.4586,\"longitude\":153.0401,\"radius\":16,\"distance_unit\":\"kilometer\"}"},
  {"CLIENT_NAME":"Palace Cinemas","BRAND_NAME":"Palace Cinemas","Cinema Name":"Palace Barracks","Latitude":"-27.4661","Longitude":"153.0152","Radius":"16","Distance Unit":"kilometer","JSON Snippet":"{\"latitude\":-27.4661,\"longitude\":153.0152,\"radius\":16,\"distance_unit\":\"kilometer\"}"},
  {"CLIENT_NAME":"Palace Cinemas","BRAND_NAME":"Palace Cinemas","Cinema Name":"Palace Byron Bay","Latitude":"-28.6441","Longitude":"153.612","Radius":"16","Distance Unit":"kilometer","JSON Snippet":"{\"latitude\":-28.6441,\"longitude\":153.612,\"radius\":16,\"distance_unit\":\"kilometer\"}"},
  {"CLIENT_NAME":"Palace Cinemas","BRAND_NAME":"Palace Cinemas","Cinema Name":"Palace Electric","Latitude":"-35.2852","Longitude":"149.1241","Radius":"16","Distance Unit":"kilometer","JSON Snippet":"{\"latitude\":-35.2852,\"longitude\":149.1241,\"radius\":16,\"distance_unit\":\"kilometer\"}"},
  {"CLIENT_NAME":"Palace Cinemas","BRAND_NAME":"Palace Cinemas","Cinema Name":"Palace Raine Square","Latitude":"-31.9519","Longitude":"115.8562","Radius":"16","Distance Unit":"kilometer","JSON Snippet":"{\"latitude\":-31.9519,\"longitude\":115.8562,\"radius\":16,\"distance_unit\":\"kilometer\"}"},
  {"CLIENT_NAME":"Palace Cinemas","BRAND_NAME":"Palace Cinemas","Cinema Name":"Regent Ballarat","Latitude":"-37.5615","Longitude":"143.8587","Radius":"16","Distance Unit":"kilometer","JSON Snippet":"{\"latitude\":-37.5615,\"longitude\":143.8587,\"radius\":16,\"distance_unit\":\"kilometer\"}"},
  {"CLIENT_NAME":"Palace Cinemas","BRAND_NAME":"Palace Cinemas","Cinema Name":"Palace Church St","Latitude":"-37.9155","Longitude":"144.9921","Radius":"16","Distance Unit":"kilometer","JSON Snippet":"{\"latitude\":-37.9155,\"longitude\":144.9921,\"radius\":16,\"distance_unit\":\"kilometer\"}"},
  {"CLIENT_NAME":"Moving Story","BRAND_NAME":"Lido Cinemas","Cinema Name":"Lido Cinemas","Latitude":"-37.8208","Longitude":"145.0358","Radius":"16","Distance Unit":"kilometer","JSON Snippet":"{\"latitude\":-37.8208,\"longitude\":145.0358,\"radius\":16,\"distance_unit\":\"kilometer\"}"},
  {"CLIENT_NAME":"Moving Story","BRAND_NAME":"Classic Cinemas","Cinema Name":"Classic Cinemas","Latitude":"-37.8858","Longitude":"145.0005","Radius":"16","Distance Unit":"kilometer","JSON Snippet":"{\"latitude\":-37.8858,\"longitude\":145.0005,\"radius\":16,\"distance_unit\":\"kilometer\"}"},
  {"CLIENT_NAME":"Moving Story","BRAND_NAME":"Ritz Cinemas","Cinema Name":"Ritz Cinemas","Latitude":"-33.9201","Longitude":"151.2435","Radius":"16","Distance Unit":"kilometer","JSON Snippet":"{\"latitude\":-33.9201,\"longitude\":151.2435,\"radius\":16,\"distance_unit\":\"kilometer\"}"},
  {"CLIENT_NAME":"Moving Story","BRAND_NAME":"Cameo Cinemas","Cinema Name":"Cameo Cinemas","Latitude":"-37.9095","Longitude":"145.3521","Radius":"16","Distance Unit":"kilometer","JSON Snippet":"{\"latitude\":-37.9095,\"longitude\":145.3521,\"radius\":16,\"distance_unit\":\"kilometer\"}"},
  {"CLIENT_NAME":"Reading Cinemas","BRAND_NAME":"State Cinema","Cinema Name":"State Cinema","Latitude":"-42.8724","Longitude":"147.3147","Radius":"16","Distance Unit":"kilometer","JSON Snippet":"{\"latitude\":-42.8724,\"longitude\":147.3147,\"radius\":16,\"distance_unit\":\"kilometer\"}"},
  {"CLIENT_NAME":"Reading Cinemas","BRAND_NAME":"Angelika Cinemas","Cinema Name":"Angelika Film Centre","Latitude":"-27.4913","Longitude":"153.0368","Radius":"16","Distance Unit":"kilometer","JSON Snippet":"{\"latitude\":-27.4913,\"longitude\":153.0368,\"radius\":16,\"distance_unit\":\"kilometer\"}"},
  {"CLIENT_NAME":"Reading Cinemas","BRAND_NAME":"Reading Cinemas - Australia","Cinema Name":"Reading Cinemas Armadale","Latitude":"-32.1472","Longitude":"116.0152","Radius":"16","Distance Unit":"kilometer","JSON Snippet":"{\"latitude\":-32.1472,\"longitude\":116.0152,\"radius\":16,\"distance_unit\":\"kilometer\"}"},
  {"CLIENT_NAME":"Reading Cinemas","BRAND_NAME":"Reading Cinemas - Australia","Cinema Name":"Reading Cinemas Belmont","Latitude":"-31.9442","Longitude":"115.9324","Radius":"16","Distance Unit":"kilometer","JSON Snippet":"{\"latitude\":-31.9442,\"longitude\":115.9324,\"radius\":16,\"distance_unit\":\"kilometer\"}"},
  {"CLIENT_NAME":"Reading Cinemas","BRAND_NAME":"Reading Cinemas - Australia","Cinema Name":"Reading Cinemas Busselton","Latitude":"-33.6534","Longitude":"115.3444","Radius":"16","Distance Unit":"kilometer","JSON Snippet":"{\"latitude\":-33.6534,\"longitude\":115.3444,\"radius\":16,\"distance_unit\":\"kilometer\"}"},
  {"CLIENT_NAME":"Reading Cinemas","BRAND_NAME":"Reading Cinemas - Australia","Cinema Name":"Reading Cinemas Mandurah","Latitude":"-32.5269","Longitude":"115.717","Radius":"16","Distance Unit":"kilometer","JSON Snippet":"{\"latitude\":-32.5269,\"longitude\":115.717,\"radius\":16,\"distance_unit\":\"kilometer\"}"},
  {"CLIENT_NAME":"Reading Cinemas","BRAND_NAME":"Reading Cinemas - Australia","Cinema Name":"Reading Cinemas Auburn","Latitude":"-33.8504","Longitude":"151.0335","Radius":"16","Distance Unit":"kilometer","JSON Snippet":"{\"latitude\":-33.8504,\"longitude\":151.0335,\"radius\":16,\"distance_unit\":\"kilometer\"}"},
  {"CLIENT_NAME":"Reading Cinemas","BRAND_NAME":"Reading Cinemas - Australia","Cinema Name":"Reading Cinemas Charlestown","Latitude":"-32.9663","Longitude":"151.7101","Radius":"16","Distance Unit":"kilometer","JSON Snippet":"{\"latitude\":-32.9663,\"longitude\":151.7101,\"radius\":16,\"distance_unit\":\"kilometer\"}"},
  {"CLIENT_NAME":"Reading Cinemas","BRAND_NAME":"Reading Cinemas - Australia","Cinema Name":"Reading Cinemas Dubbo","Latitude":"-32.2474","Longitude":"148.6012","Radius":"16","Distance Unit":"kilometer","JSON Snippet":"{\"latitude\":-32.2474,\"longitude\":148.6012,\"radius\":16,\"distance_unit\":\"kilometer\"}"},
  {"CLIENT_NAME":"Reading Cinemas","BRAND_NAME":"Reading Cinemas - Australia","Cinema Name":"Reading Cinemas Maitland","Latitude":"-32.7348","Longitude":"151.5542","Radius":"16","Distance Unit":"kilometer","JSON Snippet":"{\"latitude\":-32.7348,\"longitude\":151.5542,\"radius\":16,\"distance_unit\":\"kilometer\"}"},
  {"CLIENT_NAME":"Reading Cinemas","BRAND_NAME":"Reading Cinemas - Australia","Cinema Name":"Reading Cinemas Rhodes","Latitude":"-33.8336","Longitude":"151.0858","Radius":"16","Distance Unit":"kilometer","JSON Snippet":"{\"latitude\":-33.8336,\"longitude\":151.0858,\"radius\":16,\"distance_unit\":\"kilometer\"}"},
  {"CLIENT_NAME":"Reading Cinemas","BRAND_NAME":"Reading Cinemas - Australia","Cinema Name":"Reading Cinemas Rouse Hill","Latitude":"-33.6811","Longitude":"150.9231","Radius":"16","Distance Unit":"kilometer","JSON Snippet":"{\"latitude\":-33.6811,\"longitude\":150.9231,\"radius\":16,\"distance_unit\":\"kilometer\"}"},
  {"CLIENT_NAME":"Reading Cinemas","BRAND_NAME":"Reading Cinemas - Australia","Cinema Name":"Reading Cinemas Bundaberg","Latitude":"-24.8741","Longitude":"152.3243","Radius":"16","Distance Unit":"kilometer","JSON Snippet":"{\"latitude\":-24.8741,\"longitude\":152.3243,\"radius\":16,\"distance_unit\":\"kilometer\"}"},
  {"CLIENT_NAME":"Reading Cinemas","BRAND_NAME":"Reading Cinemas - Australia","Cinema Name":"Reading Cinemas Harbour Town","Latitude":"-27.9315","Longitude":"153.3768","Radius":"16","Distance Unit":"kilometer","JSON Snippet":"{\"latitude\":-27.9315,\"longitude\":153.3768,\"radius\":16,\"distance_unit\":\"kilometer\"}"},
  {"CLIENT_NAME":"Reading Cinemas","BRAND_NAME":"Reading Cinemas - Australia","Cinema Name":"Reading Cinemas Jindalee","Latitude":"-27.5385","Longitude":"152.9361","Radius":"16","Distance Unit":"kilometer","JSON Snippet":"{\"latitude\":-27.5385,\"longitude\":152.9361,\"radius\":16,\"distance_unit\":\"kilometer\"}"},
  {"CLIENT_NAME":"Reading Cinemas","BRAND_NAME":"Reading Cinemas - Australia","Cinema Name":"Reading Cinemas Newmarket","Latitude":"-27.4411","Longitude":"153.0035","Radius":"16","Distance Unit":"kilometer","JSON Snippet":"{\"latitude\":-27.4411,\"longitude\":153.0035,\"radius\":16,\"distance_unit\":\"kilometer\"}"},
  {"CLIENT_NAME":"Reading Cinemas","BRAND_NAME":"Reading Cinemas - Australia","Cinema Name":"Reading Cinemas Townsville","Latitude":"-19.3134","Longitude":"146.7264","Radius":"16","Distance Unit":"kilometer","JSON Snippet":"{\"latitude\":-19.3134,\"longitude\":146.7264,\"radius\":16,\"distance_unit\":\"kilometer\"}"},
  {"CLIENT_NAME":"Reading Cinemas","BRAND_NAME":"Reading Cinemas - Australia","Cinema Name":"Reading Cinemas Burwood Brickworks","Latitude":"-37.8511","Longitude":"145.1436","Radius":"16","Distance Unit":"kilometer","JSON Snippet":"{\"latitude\":-37.8511,\"longitude\":145.1436,\"radius\":16,\"distance_unit\":\"kilometer\"}"},
  {"CLIENT_NAME":"Reading Cinemas","BRAND_NAME":"Reading Cinemas - Australia","Cinema Name":"Reading Cinemas Chirnside Park","Latitude":"-37.7533","Longitude":"145.3094","Radius":"16","Distance Unit":"kilometer","JSON Snippet":"{\"latitude\":-37.7533,\"longitude\":145.3094,\"radius\":16,\"distance_unit\":\"kilometer\"}"},
  {"CLIENT_NAME":"Reading Cinemas","BRAND_NAME":"Reading Cinemas - Australia","Cinema Name":"Reading Cinemas Dandenong","Latitude":"-37.9882","Longitude":"145.2135","Radius":"16","Distance Unit":"kilometer","JSON Snippet":"{\"latitude\":-37.9882,\"longitude\":145.2135,\"radius\":16,\"distance_unit\":\"kilometer\"}"},
  {"CLIENT_NAME":"Reading Cinemas","BRAND_NAME":"Reading Cinemas - Australia","Cinema Name":"Reading Cinemas Epping","Latitude":"-37.6495","Longitude":"145.0256","Radius":"16","Distance Unit":"kilometer","JSON Snippet":"{\"latitude\":-37.6495,\"longitude\":145.0256,\"radius\":16,\"distance_unit\":\"kilometer\"}"},
  {"CLIENT_NAME":"Reading Cinemas","BRAND_NAME":"Reading Cinemas - Australia","Cinema Name":"Reading Cinemas Melton","Latitude":"-37.6912","Longitude":"144.5901","Radius":"16","Distance Unit":"kilometer","JSON Snippet":"{\"latitude\":-37.6912,\"longitude\":144.5901,\"radius\":16,\"distance_unit\":\"kilometer\"}"},
  {"CLIENT_NAME":"Reading Cinemas","BRAND_NAME":"Reading Cinemas - Australia","Cinema Name":"Reading Cinemas Millers Junction","Latitude":"-37.8344","Longitude":"144.8512","Radius":"16","Distance Unit":"kilometer","JSON Snippet":"{\"latitude\":-37.8344,\"longitude\":144.8512,\"radius\":16,\"distance_unit\":\"kilometer\"}"},
  {"CLIENT_NAME":"Reading Cinemas","BRAND_NAME":"Reading Cinemas - Australia","Cinema Name":"Reading Cinemas Sunbury","Latitude":"-37.5813","Longitude":"144.7291","Radius":"16","Distance Unit":"kilometer","JSON Snippet":"{\"latitude\":-37.5813,\"longitude\":144.7291,\"radius\":16,\"distance_unit\":\"kilometer\"}"},
  {"CLIENT_NAME":"Reading Cinemas","BRAND_NAME":"Reading Cinemas - Australia","Cinema Name":"Reading Cinemas Traralgon","Latitude":"-38.1961","Longitude":"146.5401","Radius":"16","Distance Unit":"kilometer","JSON Snippet":"{\"latitude\":-38.1961,\"longitude\":146.5401,\"radius\":16,\"distance_unit\":\"kilometer\"}"},
  {"CLIENT_NAME":"Reading Cinemas","BRAND_NAME":"Reading Cinemas - Australia","Cinema Name":"Reading Cinemas Waurn Ponds","Latitude":"-38.2012","Longitude":"144.3123","Radius":"16","Distance Unit":"kilometer","JSON Snippet":"{\"latitude\":-38.2012,\"longitude\":144.3123,\"radius\":16,\"distance_unit\":\"kilometer\"}"},
  {"CLIENT_NAME":"Reading Cinemas","BRAND_NAME":"Reading Cinemas - Australia","Cinema Name":"Reading Cinemas Devonport","Latitude":"-41.1782","Longitude":"146.3614","Radius":"16","Distance Unit":"kilometer","JSON Snippet":"{\"latitude\":-41.1782,\"longitude\":146.3614,\"radius\":16,\"distance_unit\":\"kilometer\"}"},
  {"CLIENT_NAME":"Reading Cinemas","BRAND_NAME":"Reading Cinemas - Australia","Cinema Name":"Reading Cinemas Elizabeth","Latitude":"-34.7214","Longitude":"138.6712","Radius":"16","Distance Unit":"kilometer","JSON Snippet":"{\"latitude\":-34.7214,\"longitude\":138.6712,\"radius\":16,\"distance_unit\":\"kilometer\"}"},
  {"CLIENT_NAME":"Reading Cinemas","BRAND_NAME":"Reading Cinemas - Australia","Cinema Name":"Reading Cinemas West Lakes","Latitude":"-34.8845","Longitude":"138.4894","Radius":"16","Distance Unit":"kilometer","JSON Snippet":"{\"latitude\":-34.8845,\"longitude\":138.4894,\"radius\":16,\"distance_unit\":\"kilometer\"}"},
  {"CLIENT_NAME":"Reading Cinemas","BRAND_NAME":"Reading Cinemas - New Zealand","Cinema Name":"Reading Cinemas Dunedin","Latitude":"-45.8758","Longitude":"170.5032","Radius":"16","Distance Unit":"kilometer","JSON Snippet":"{\"latitude\":-45.8758,\"longitude\":170.5032,\"radius\":16,\"distance_unit\":\"kilometer\"}"},
  {"CLIENT_NAME":"Reading Cinemas","BRAND_NAME":"Reading Cinemas - New Zealand","Cinema Name":"Reading Cinemas Invercargill","Latitude":"-46.4131","Longitude":"168.3538","Radius":"16","Distance Unit":"kilometer","JSON Snippet":"{\"latitude\":-46.4131,\"longitude\":168.3538,\"radius\":16,\"distance_unit\":\"kilometer\"}"},
  {"CLIENT_NAME":"Reading Cinemas","BRAND_NAME":"Reading Cinemas - New Zealand","Cinema Name":"Reading Cinemas LynnMall","Latitude":"-36.9114","Longitude":"174.6841","Radius":"16","Distance Unit":"kilometer","JSON Snippet":"{\"latitude\":-36.9114,\"longitude\":174.6841,\"radius\":16,\"distance_unit\":\"kilometer\"}"},
  {"CLIENT_NAME":"Reading Cinemas","BRAND_NAME":"Reading Cinemas - New Zealand","Cinema Name":"Reading Cinemas Napier","Latitude":"-39.4921","Longitude":"176.9145","Radius":"16","Distance Unit":"kilometer","JSON Snippet":"{\"latitude\":-39.4921,\"longitude\":176.9145,\"radius\":16,\"distance_unit\":\"kilometer\"}"},
  {"CLIENT_NAME":"Reading Cinemas","BRAND_NAME":"Reading Cinemas - New Zealand","Cinema Name":"Reading Cinemas Porirua","Latitude":"-41.1415","Longitude":"174.8424","Radius":"16","Distance Unit":"kilometer","JSON Snippet":"{\"latitude\":-41.1415,\"longitude\":174.8424,\"radius\":16,\"distance_unit\":\"kilometer\"}"},
  {"CLIENT_NAME":"Reading Cinemas","BRAND_NAME":"Reading Cinemas - New Zealand","Cinema Name":"Reading Cinemas Rotorua","Latitude":"-38.1368","Longitude":"176.2511","Radius":"16","Distance Unit":"kilometer","JSON Snippet":"{\"latitude\":-38.1368,\"longitude\":176.2511,\"radius\":16,\"distance_unit\":\"kilometer\"}"},
  {"CLIENT_NAME":"Reading Cinemas","BRAND_NAME":"Reading Cinemas - New Zealand","Cinema Name":"Reading Cinemas The Palms","Latitude":"-43.5112","Longitude":"172.6745","Radius":"16","Distance Unit":"kilometer","JSON Snippet":"{\"latitude\":-43.5112,\"longitude\":172.6745,\"radius\":16,\"distance_unit\":\"kilometer\"}"}
];

// Seeding Function
const seedDatabase = () => {
  console.log("Seeding database from hardcoded data...");
  
  try {
    // 1. Seed Clients and Brands
    for (const record of brandsData) {
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

    // 2. Seed Locations
    console.log(`Found ${locationsData.length} location records.`);
    
    let seededCount = 0;
    for (const record of locationsData) {
      const clientName = record.CLIENT_NAME;
      const brandName = record.BRAND_NAME;
      if (!clientName || !brandName) continue;

      const client = db.prepare("SELECT id FROM clients WHERE name = ?").get(clientName) as any;
      if (!client) continue;
      
      const brand = db.prepare("SELECT id FROM brands WHERE client_id = ? AND brand_name = ?").get(client.id, brandName) as any;
      if (!brand) continue;

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
  } catch (error) {
    console.error("Error seeding database:", error);
  }
};

seedDatabase();

const app = express();

app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

// Helper to wait for Meta video processing
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Helper to safely parse JSON from a fetch response
const safeJson = async (response: any, context: string) => {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch (e) {
    console.error(`JSON Parse Error in ${context}:`, text.substring(0, 1000));
    if (text.includes("<!doctype html>") || text.includes("<html>")) {
      throw new Error(`The Meta API returned an HTML error page instead of JSON during "${context}". Status: ${response.status}`);
    }
    throw new Error(`Invalid JSON response from Meta (${context}). Response start: ${text.substring(0, 100)}...`);
  }
};

// Helper to convert Drive/Dropbox links to download links

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
    if (this.pixelId && !/^\\d+$/.test(this.pixelId)) {
      this.pixelId = ""; 
    }
    this.addStatus = addStatus;

    if (this.adAccountId && !this.adAccountId.startsWith('act_')) {
      this.adAccountId = `act_${this.adAccountId}`;
    }
  }

  async createCampaign(name: string, objective: string, budget: number, budgetType: 'campaign' | 'adset' = 'campaign') {
    this.addStatus(`Creating Meta Campaign: ${name}...`);
    
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
      body: JSON.stringify({ ...payload, access_token: this.token })
    });
    const result = await safeJson(response, "createCampaign");
    if (result.error) throw new Error(`Meta Campaign Error: ${result.error.message}`);
    return result.id;
  }

  async createAdSet(payload: any) {
    this.addStatus(`Creating Meta Ad Set: ${payload.name}...`);
    const response = await fetch(`https://graph.facebook.com/v22.0/${this.adAccountId}/adsets`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, access_token: this.token })
    });
    const result = await safeJson(response, "createAdSet");
    if (result.error) throw new Error(`Meta Ad Set Error: ${result.error.message}`);
    return result.id;
  }

  async uploadVideo(source: string, isLocalFile: boolean = false) {
    this.addStatus(`Uploading video...`);
    if (isLocalFile) {
      const form = new FormData();
      form.append("source", fs.createReadStream(source), { filename: path.basename(source) });
      form.append("access_token", this.token);
      
      const response = await fetch(`https://graph.facebook.com/v22.0/${this.adAccountId}/advideos`, {
        method: "POST",
        headers: form.getHeaders(),
        body: form as any
      });
      const result = await safeJson(response, "uploadVideo (Local)");
      if (result.error) throw new Error(`Video Upload Error: ${result.error.message}`);
      return result.id;
    } else {
      const response = await fetch(`https://graph.facebook.com/v22.0/${this.adAccountId}/advideos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file_url: source, access_token: this.token })
      });
      const result = await safeJson(response, "uploadVideo (URL)");
      if (result.error) throw new Error(`Video Upload Error: ${result.error.message}`);
      return result.id;
    }
  }

  async uploadImage(source: string, isLocalFile: boolean = false) {
    this.addStatus(`Uploading image...`);
    if (isLocalFile) {
      const form = new FormData();
      form.append("filename", fs.createReadStream(source), { filename: path.basename(source) });
      form.append("access_token", this.token);
      
      const response = await fetch(`https://graph.facebook.com/v22.0/${this.adAccountId}/adimages`, {
        method: "POST",
        headers: form.getHeaders(),
        body: form as any
      });
      const result = await safeJson(response, "uploadImage (Local)");
      if (result.error) throw new Error(`Image Upload Error: ${result.error.message}`);
      const firstImage = Object.values(result.images)[0] as any;
      return firstImage.hash;
    } else {
      const tempFile = await downloadFile(source);
      try {
        return await this.uploadImage(tempFile, true);
      } finally {
        if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
      }
    }
  }

  async createCreative(payload: any) {
    const response = await fetch(`https://graph.facebook.com/v22.0/${this.adAccountId}/adcreatives`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, access_token: this.token })
    });
    const result = await safeJson(response, "createCreative");
    if (result.error) throw new Error(`Creative Error: ${result.error.message}`);
    return result.id;
  }

  async createWebsiteAudience(movieName: string) {
    this.addStatus(`Creating Website Audience for: ${movieName}...`);
    if (!this.pixelId) return null;

    const payload = {
      name: `Exclusion - ${movieName} - Purchasers (180d)`,
      subtype: "WEBSITE",
      retention_days: 180,
      pixel_id: this.pixelId,
      rule: JSON.stringify({
        and: [{ event_name: "Purchase", filters: [{ field: "content_name", operator: "i_contains", value: movieName }] }]
      }),
      access_token: this.token
    };

    const response = await fetch(`https://graph.facebook.com/v22.0/${this.adAccountId}/customaudiences`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const result = await safeJson(response, "createWebsiteAudience");
    if (result.error) return null;
    return result.id;
  }

  async createAd(payload: any) {
    const response = await fetch(`https://graph.facebook.com/v22.0/${this.adAccountId}/ads`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, access_token: this.token })
    });
    const result = await safeJson(response, "createAd");
    if (result.error) throw new Error(`Ad Error: ${result.error.message}`);
    return result.id;
  }

  async createCustomAudience(name: string, subtype: string = "CUSTOM", rule?: any) {
    const body: any = { name, subtype, access_token: this.token };
    if (subtype === "CUSTOM") body.customer_file_source = "USER_PROVIDED_ONLY";
    if (subtype === "WEBSITE") {
      if (!this.pixelId) throw new Error("Pixel ID is missing for WEBSITE custom audience.");
      body.pixel_id = this.pixelId;
      body.rule = JSON.stringify(rule);
      body.prefill = true;
    }

    const response = await fetch(`https://graph.facebook.com/v22.0/${this.adAccountId}/customaudiences`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const result = await safeJson(response, "createCustomAudience");
    if (result.error) throw new Error(`Audience Error: ${result.error.message}`);
    return result.id;
  }

  async addUsersToAudience(audienceId: string, schema: string[], data: string[][]) {
    const BATCH_SIZE = 5000;
    const results = [];

    for (let i = 0; i < data.length; i += BATCH_SIZE) {
      const batch = data.slice(i, i + BATCH_SIZE);
      const response = await fetch(`https://graph.facebook.com/v22.0/${audienceId}/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload: { schema, data: batch }, access_token: this.token })
      });
      const result = await safeJson(response, `addUsersToAudience`);
      if (result.error) throw new Error(`Add Users Error: ${result.error.message}`);
      results.push(result);
    }
    return results;
  }

  async getExistingCreative(adId: string) {
    const response = await fetch(`https://graph.facebook.com/v22.0/${adId}?fields=creative&access_token=${this.token}`);
    const data = await safeJson(response, "getExistingCreative");
    return data.creative?.id;
  }

  getCredentials() {
    return { token: this.token, adAccountId: this.adAccountId, pixelId: this.pixelId };
  }
}

const waitForVideoProcessing = async (videoId: string, metaToken: string, addStatus: (msg: string) => void) => {
  const maxAttempts = 20;
  const interval = 15000;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await fetch(`https://graph.facebook.com/v22.0/${videoId}?fields=status&access_token=${metaToken}`);
      const data = await safeJson(response, "waitForVideoProcessing");
      if (data.error) return false;
      const status = data.status?.video_status;
      if (status === 'ready') return true;
      if (status === 'error') return false;
      await sleep(interval);
    } catch (e) {
      await sleep(interval);
    }
  }
  return false;
};

const fetchLocationData = async (brandId?: string) => {
  try {
    let query = "SELECT * FROM locations";
    let params: any[] = [];
    if (brandId && brandId !== "") {
      query += " WHERE brand_id = ?";
      params.push(parseInt(brandId));
    }
    const rows = db.prepare(query).all(...params) as any[];
    const locationMap: Record<string, any> = {};
    const displayNames: Record<string, string> = {};
    rows.forEach(row => {
      const nameKey = row.cinema_name.toLowerCase();
      try {
        locationMap[nameKey] = JSON.parse(row.json_snippet);
        displayNames[nameKey] = row.cinema_name;
      } catch (e) {}
    });
    return { locationMap, displayNames };
  } catch (e) {
    return { locationMap: {}, displayNames: {} };
  }
};

const hashData = (data: string) => crypto.createHash("sha256").update(data.trim().toLowerCase()).digest("hex");

// API Routes
app.get("/api/clients", (req, res) => {
  try {
    const clients = db.prepare("SELECT * FROM clients").all() as any[];
    const result = clients.map(client => {
      const brands = db.prepare("SELECT * FROM brands WHERE client_id = ?").all(client.id);
      return { 
        id: client.id,
        name: client.name,
        meta_ad_account_id: client.meta_ad_account_id,
        meta_access_token: client.meta_access_token,
        meta_pixel_id: client.meta_pixel_id,
        asana_pat: client.asana_pat,
        brands 
      };
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
    res.json(Object.values(displayNames).sort());
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/audiences", async (req, res) => {
  try {
    const clientId = req.query.clientId as string;
    if (!clientId) return res.json([]);
    const client = db.prepare("SELECT * FROM clients WHERE id = ?").get(clientId) as any;
    if (!client) throw new Error("Client not found");
    let allAudiences: any[] = [];
    let nextUrl: string | null = `https://graph.facebook.com/v22.0/${client.meta_ad_account_id}/customaudiences?fields=id,name&limit=1000&access_token=${client.meta_access_token}`;
    while (nextUrl) {
      const response = await fetch(nextUrl);
      const data = await safeJson(response, "audiences");
      if (data.error) throw new Error(data.error.message);
      if (data.data) allAudiences = allAudiences.concat(data.data);
      nextUrl = data.paging?.next || null;
    }
    res.json(allAudiences);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/search-targeting", async (req, res) => {
  try {
    const { clientId, q } = req.query;
    if (!clientId || !q) return res.json([]);
    const client = db.prepare("SELECT meta_access_token FROM clients WHERE id = ?").get(clientId) as any;
    if (!client) throw new Error("Client not found");
    const token = client.meta_access_token;
    const [interests, behaviors, demographics] = await Promise.all([
      fetch(`https://graph.facebook.com/v22.0/search?type=adinterest&q=${encodeURIComponent(q as string)}&limit=50&access_token=${token}`).then(r => safeJson(r, "interests")),
      fetch(`https://graph.facebook.com/v22.0/search?type=adTargetingCategory&class=behaviors&access_token=${token}`).then(r => safeJson(r, "behaviors")),
      fetch(`https://graph.facebook.com/v22.0/search?type=adTargetingCategory&class=demographics&access_token=${token}`).then(r => safeJson(r, "demographics"))
    ]) as any[];
    let results: any[] = (interests.data || []).map((i: any) => ({ ...i, type: 'interests' }));
    results = results.concat((behaviors.data || []).filter((i: any) => i.name.toLowerCase().includes((q as string).toLowerCase())));
    results = results.concat((demographics.data || []).filter((i: any) => i.name.toLowerCase().includes((q as string).toLowerCase())));
    res.json(results.slice(0, 50));
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
    const asanaData = await safeJson(asanaResponse, "fetch-asana-task");
    if (!asanaData.data) throw new Error("Failed to fetch Asana task data.");

    const customFields = asanaData.data.custom_fields;
    const getField = (name: string) => {
      const field = customFields.find((f: any) => f.name === name);
      const val = (field?.display_value || "").trim();
      if (!val) return "";
      return val;
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

    const formatDate = (dateStr: string, time: string) => {
      if (!dateStr || dateStr === "START DATE" || dateStr === "END DATE") return null;
      return `${dateStr}T${time}:00+08:00`;
    };

    const movieTitle = getField("Movie Name");
    const asanaClient = getField("Client");
    const genre = getField("Genre");
    const startDateRaw = getField("Start Date");
    const endDateRaw = getField("End Date");

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
      movieTitle: movieTitle,
      campaignName,
      objective: rawObjective === "OBJECTIVE" ? "Sales" : rawObjective,
      startDate: formatDate(startDateRaw, "09:00"),
      endDate: formatDate(endDateRaw, "21:00"),
      budget: parseFloat(getField("Budget") || "0"),
      copy: getField("Copy") || "",
      thumbnail: getDownloadUrl(getField("Thumbnail")),
      headline: getField("Headline") || "",
      url: getField("URL") || "",
      locations: (getField("Locations") || "").split(",").map((l: string) => l.trim()).filter(Boolean),
      feedVideoUrl: getDownloadUrl(getField("Feed Video 1")),
      verticalVideoUrl: getDownloadUrl(getField("Vertical Video 1")),
      asanaClient: asanaClient,
      clientId,
      csvData,
      csvName
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

    const brands = db.prepare("SELECT * FROM brands WHERE client_id = ?").all(clientId) as any[];

    const campaignRes = await fetch(`https://graph.facebook.com/v22.0/${campaignId}?fields=name,objective,lifetime_budget,daily_budget,start_time,stop_time&access_token=${token}`);
    const campaignData = await safeJson(campaignRes, "fetch-campaign-data (campaign)");
    if (campaignData.error) throw new Error(`Meta Campaign Error: ${campaignData.error.message}`);

    const adSetsRes = await fetch(`https://graph.facebook.com/v22.0/${campaignId}/adsets?fields=id,name,targeting,start_time,end_time,lifetime_budget,daily_budget&access_token=${token}`);
    const adSetsData = await safeJson(adSetsRes, "fetch-campaign-data (adsets)");
    if (adSetsData.error) throw new Error(`Meta Ad Sets Error: ${adSetsData.error.message}`);

    const adSets: any[] = [];

    for (const metaAdSet of adSetsData.data) {
      const adsRes = await fetch(`https://graph.facebook.com/v22.0/${metaAdSet.id}/ads?fields=id,name,creative{id,name,object_story_spec,effective_object_story_id,body,title,image_url,instagram_actor_id,video_id,object_url,asset_feed_spec},url_tags&access_token=${token}`);
      const adsData = await safeJson(adsRes, "fetch-campaign-data (ads)");
      if (adsData.error) throw new Error(`Meta Ads Error: ${adsData.error.message}`);

      const ads: any[] = [];
      let detectedBrandId = "";

      for (const metaAd of adsData.data) {
        let creative = metaAd.creative;
        let storySpec = creative?.object_story_spec;
        let headline = creative?.title || "";
        let copy = creative?.body || "";
        let url = "";
        let ctaType = "LEARN_MORE";
        let type: 'video' | 'image' | 'carousel' = 'image';
        let thumbnail = creative?.image_url || "";
        let carouselCards: any[] = [];
        let manualFeedVideoId = creative?.video_id || "";

        if (manualFeedVideoId) {
          type = 'video';
        }

        if (!storySpec && creative?.effective_object_story_id) {
          try {
            const storyRes = await fetch(`https://graph.facebook.com/v22.0/${creative.effective_object_story_id}?fields=object_story_spec,link,type,source&access_token=${token}`);
            const storyData = await safeJson(storyRes, "fetch-effective-story");
            if (storyData.object_story_spec) {
              storySpec = storyData.object_story_spec;
            }
            if (!url && storyData.link) {
              url = storyData.link;
            }
            if (storyData.type === 'video') {
              type = 'video';
            }
          } catch (e) {
            console.error("Failed to fetch effective object story spec", e);
          }
        }
        
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

        if (storySpec) {
          const linkData = storySpec.link_data;
          const videoData = storySpec.video_data;
          
          if (videoData) {
            type = 'video';
            headline = videoData.title || headline;
            copy = videoData.message || copy;
            url = videoData.call_to_action?.value?.link || videoData.link_url || url;
            ctaType = videoData.call_to_action?.type || ctaType;
            thumbnail = videoData.image_url || thumbnail;
            if (videoData.video_id) manualFeedVideoId = videoData.video_id;
          } else if (linkData) {
            headline = linkData.name || headline;
            copy = linkData.message || copy;
            url = linkData.link || linkData.call_to_action?.value?.link || url;
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
          if (creative?.body) copy = creative.body;
          if (creative?.title) headline = creative.title;
        }

        if (!url || url.trim() === "") {
          url = creative?.object_url || "";
        }
        if (!url || url.trim() === "") {
          if (creative?.asset_feed_spec?.link_urls && creative.asset_feed_spec.link_urls.length > 0) {
            url = creative.asset_feed_spec.link_urls[0].website_url || "";
          }
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
          manualFeedVideoId: manualFeedVideoId || undefined,
          customUrlParams: metaAd.url_tags || "",
          carouselCards: carouselCards.length > 0 ? carouselCards : undefined
        });
      }

      let importedTargeting: any[] = [];
      const flexibleSpec = metaAdSet.targeting?.flexible_spec?.[0];
      if (flexibleSpec) {
        Object.keys(flexibleSpec).forEach(key => {
           importedTargeting = importedTargeting.concat(
             flexibleSpec[key].map((item: any) => ({ id: item.id, name: item.name, type: key }))
           );
        });
      }

      adSets.push({
        id: Math.random().toString(36).substr(2, 9),
        name: metaAdSet.name,
        platformAccountId: detectedBrandId,
        locations: [],
        ageMin: metaAdSet.targeting?.age_min,
        ageMax: metaAdSet.targeting?.age_max,
        customAudiences: metaAdSet.targeting?.custom_audiences?.map((a: any) => ({ id: a.id, name: a.name })) || [],
        excludedCustomAudiences: metaAdSet.targeting?.excluded_custom_audiences?.map((a: any) => ({ id: a.id, name: a.name })) || [],
        geoLocations: metaAdSet.targeting?.geo_locations,
        detailedTargeting: importedTargeting,
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
      movieName: "",
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
  const addStatus = (msg: string) => { console.log(msg); statusUpdates.push(msg); };

  try {
    const client = db.prepare("SELECT * FROM clients WHERE id = ?").get(brief.clientId) as any;
    if (!client) throw new Error("Client not found in database.");

    const metaService = new MetaAdsService(client, addStatus);
    const creds = metaService.getCredentials();

    const { movieName, campaignName, objective, startDate, endDate, budget, budgetType, adSets } = brief;
    
    const campaignId = await metaService.createCampaign(campaignName, objective, budget, budgetType);

    let campaignExclusionId = null;
    if (brief.createAudience && creds.pixelId && creds.pixelId !== "") {
      addStatus(`Creating Exclusion Audience for ${movieName} using Pixel: ${creds.pixelId}...`);
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
        campaignExclusionId = await metaService.createCustomAudience(
          `Palace - ${movieName} (Purchase) - 180 days`,
          "WEBSITE",
          exclusionRule
        );
      } catch (e: any) {
        addStatus(`Exclusion audience creation failed: ${e.message}`);
      }
    }

    for (const adSet of adSets) {
      addStatus(`Processing Ad Set: ${adSet.name}...`);
      const brand = db.prepare("SELECT * FROM brands WHERE id = ?").get(adSet.platformAccountId) as any;
      if (!brand) throw new Error(`Brand not found for Ad Set: ${adSet.name}`);

      const { locationMap } = await fetchLocationData(brand.id.toString());

      let targeting: any = {
        targeting_automation: { advantage_audience: 0 },
        publisher_platforms: ["facebook", "instagram"],
        facebook_positions: ["feed", "story", "facebook_reels", "profile_feed", "instream_video"],
        instagram_positions: ["stream", "story", "explore", "reels", "profile_feed"]
      };

      if (adSet.copyTargetingFromAdSetId) {
        const copyResponse = await fetch(`https://graph.facebook.com/v22.0/${adSet.copyTargetingFromAdSetId}?fields=targeting&access_token=${creds.token}`);
        const copyData = await safeJson(copyResponse, "copy-targeting");
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
      if (adSet.customAudiences && adSet.customAudiences.length > 0) {
        targeting.custom_audiences = adSet.customAudiences.map((a: any) => ({ id: a.id }));
      }
      if (adSet.excludedCustomAudiences && adSet.excludedCustomAudiences.length > 0) {
        targeting.excluded_custom_audiences = adSet.excludedCustomAudiences.map((a: any) => ({ id: a.id }));
      }
      if (adSet.detailedTargeting && adSet.detailedTargeting.length > 0) {
        const spec: any = {};
        for (const t of adSet.detailedTargeting) {
          const category = t.type || 'interests';
          if (!spec[category]) spec[category] = [];
          spec[category].push({ id: t.id, name: t.name });
        }
        targeting.flexible_spec = [spec];
      }

      if (adSet.geoLocations) targeting.geo_locations = adSet.geoLocations;
      delete targeting.targeting_optimization;
      targeting.targeting_automation = { ...targeting.targeting_automation, advantage_audience: 0 };

      if (adSet.csvData && adSet.csvName) {
        try {
          const customAudienceId = await metaService.createCustomAudience(adSet.csvName);
          targeting.custom_audiences = [{ id: customAudienceId }];
          const records = parse(adSet.csvData, { skip_empty_lines: true, trim: true });
          const schema = ["EMAIL", "FN", "LN", "GEN"];
          const data: string[][] = [];
          for (let i = 0; i < records.length; i++) {
            const row = records[i];
            if (i === 0 && (String(row[0] || "").toLowerCase().includes("email"))) continue;
            const email = String(row[0] || "").trim().toLowerCase();
            if (email) data.push([hashData(email), hashData(String(row[1] || "")), hashData(String(row[2] || "")), ""]);
          }
          if (data.length > 0) await metaService.addUsersToAudience(customAudienceId, schema, data);
        } catch (e: any) {
          addStatus(`Audience creation failed: ${e.message}`);
        }
      }

      if (campaignExclusionId) targeting.excluded_custom_audiences = [{ id: campaignExclusionId }];

      const adSetPayload: any = {
        name: adSet.name,
        campaign_id: campaignId,
        billing_event: "IMPRESSIONS",
        optimization_goal: (objective === "Reach") ? "REACH" : (objective === "Traffic" ? "LINK_CLICKS" : "OFFSITE_CONVERSIONS"),
        targeting: JSON.stringify(targeting),
        status: "ACTIVE"
      };

      if (startDate) adSetPayload.start_time = startDate.includes('T') ? startDate : `${startDate}T09:00:00+08:00`;
      if (endDate) adSetPayload.end_time = endDate.includes('T') ? endDate : `${endDate}T21:00:00+08:00`;
      if (budgetType === 'adset') {
        adSetPayload.lifetime_budget = Math.max(adSet.budget || 100, 100) * 100;
        adSetPayload.bid_strategy = "LOWEST_COST_WITHOUT_CAP";
      }

      if (objective.toLowerCase() === "sales") {
        adSetPayload.promoted_object = { pixel_id: String(creds.pixelId), custom_event_type: "PURCHASE" };
      } else if (objective === "Reach") {
        adSetPayload.promoted_object = { page_id: String(brand.meta_page_id) };
      }

      const adSetId = await metaService.createAdSet(adSetPayload);

      for (const ad of adSet.ads) {
        addStatus(`Creating Ad: ${ad.adName || ad.headline}...`);
        let creativeId = null;
        if (ad.manualAdId) creativeId = await metaService.getExistingCreative(ad.manualAdId);

        let rawCta = ad.ctaType || ((objective?.toLowerCase() === "sales") ? "BOOK_NOW" : "LEARN_MORE");
        const ctaType = rawCta === "BOOK_NOW" ? "BOOK_TRAVEL" : rawCta;
        const urlTags = ad.customUrlParams || `utm_source=facebook-instagram&utm_medium=gruvi-cpc&utm_campaign={{campaign.name}}&utm_content={{ad.name}}&utm_term={{adset.name}}&campaign_id={{campaign.id}}&adset_id={{adset.id}}&ad_id={{ad.id}}`;
        const finalUrl = ad.url || "https://www.example.com";

        if (!creativeId && ad.type === 'video') {
          let feedVideoId = ad.manualFeedVideoId;
          if (!feedVideoId) {
            const tempFile = await downloadFile(ad.feedVideoUrl);
            feedVideoId = await metaService.uploadVideo(tempFile, true);
            fs.unlinkSync(tempFile);
          }
          await waitForVideoProcessing(feedVideoId, creds.token, addStatus);

          const creativePayload: any = {
            name: `Creative: ${ad.adName || ad.headline}`,
            url_tags: urlTags,
            object_story_spec: {
              page_id: brand.meta_page_id,
              video_data: {
                video_id: feedVideoId,
                image_url: getDownloadUrl(ad.thumbnail),
                title: ad.headline.substring(0, 255),
                message: ad.copy,
                call_to_action: { type: ctaType, value: { link: finalUrl } }
              }
            }
          };

          if (adSet.instagramAccountId) {
            creativePayload.object_story_spec.instagram_actor_id = adSet.instagramAccountId;
          } else if (brand.instagram_page_id) {
            creativePayload.object_story_spec.instagram_actor_id = brand.instagram_page_id;
          }

          creativeId = await metaService.createCreative(creativePayload);
        } else if (!creativeId && ad.type === 'image') {
          let imageHash = ad.manualThumbnailHash;
          if (!imageHash) imageHash = await metaService.uploadImage(ad.thumbnail);

          const creativePayload: any = {
            name: `Creative: ${ad.adName || ad.headline}`,
            url_tags: urlTags,
            object_story_spec: {
              page_id: brand.meta_page_id,
              link_data: {
                link: finalUrl,
                message: ad.copy,
                name: ad.headline.substring(0, 255),
                image_hash: imageHash,
                call_to_action: { type: ctaType, value: { link: finalUrl } }
              }
            }
          };

          if (adSet.instagramAccountId) {
            creativePayload.object_story_spec.instagram_actor_id = adSet.instagramAccountId;
          } else if (brand.instagram_page_id) {
            creativePayload.object_story_spec.instagram_actor_id = brand.instagram_page_id;
          }

          creativeId = await metaService.createCreative(creativePayload);
        } else if (!creativeId && ad.type === 'carousel') {
          const childAttachments: any[] = [];
          if (ad.carouselCards && ad.carouselCards.length > 0) {
            for (const card of ad.carouselCards) {
              const imageHash = await metaService.uploadImage(getDownloadUrl(card.imageUrl));
              childAttachments.push({
                link: card.url || finalUrl,
                image_hash: imageHash,
                name: card.headline.substring(0, 255),
                call_to_action: { type: ctaType, value: { link: card.url || finalUrl } }
              });
            }
          }

          const creativePayload: any = {
            name: `Creative: ${ad.adName || ad.headline}`,
            url_tags: urlTags,
            object_story_spec: {
              page_id: brand.meta_page_id,
              link_data: {
                link: finalUrl,
                message: ad.copy,
                child_attachments: childAttachments,
                call_to_action: { type: ctaType, value: { link: finalUrl } }
              }
            }
          };

          if (adSet.instagramAccountId) {
            creativePayload.object_story_spec.instagram_actor_id = adSet.instagramAccountId;
          } else if (brand.instagram_page_id) {
            creativePayload.object_story_spec.instagram_actor_id = brand.instagram_page_id;
          }

          creativeId = await metaService.createCreative(creativePayload);
        }

        if (creativeId) {
          const adPayload: any = {
            name: ad.adName || `Ad: ${ad.headline}`,
            adset_id: adSetId,
            creative: { creative_id: creativeId },
            status: "PAUSED"
          };
          if (creds.pixelId) {
            adPayload.tracking_specs = [{ "action.type": ["offsite_conversion"], "fb_pixel": [String(creds.pixelId)] }];
          }
          await metaService.createAd(adPayload);
        }
      }
    }

    addStatus("Campaign Automation Complete!");
    res.json({ success: true, logs: statusUpdates });
  } catch (error: any) {
    res.status(500).json({ error: error.message, logs: statusUpdates });
  }
});

app.post("/api/upload-video", upload.single("video"), async (req, res) => {
  const { clientId } = req.body;
  const file = (req as any).file;
  if (!file || !clientId) return res.status(400).json({ error: "Missing data" });
  const ext = path.extname(file.originalname) || ".mp4";
  const newPath = `${file.path}${ext}`;
  fs.renameSync(file.path, newPath);
  try {
    const client = db.prepare("SELECT * FROM clients WHERE id = ?").get(clientId) as any;
    const metaService = new MetaAdsService(client, (msg) => console.log(msg));
    const videoId = await metaService.uploadVideo(newPath, true);
    fs.unlinkSync(newPath);
    res.json({ success: true, videoId });
  } catch (error: any) {
    if (fs.existsSync(newPath)) fs.unlinkSync(newPath);
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/upload-image", upload.single("image"), async (req, res) => {
  const { clientId } = req.body;
  const file = (req as any).file;
  if (!file || !clientId) return res.status(400).json({ error: "Missing data" });
  try {
    const client = db.prepare("SELECT * FROM clients WHERE id = ?").get(clientId) as any;
    const metaService = new MetaAdsService(client, (msg) => console.log(msg));
    const imageHash = await metaService.uploadImage(file.path, true);
    fs.unlinkSync(file.path);
    res.json({ success: true, imageHash });
  } catch (error: any) {
    if (file && fs.existsSync(file.path)) fs.unlinkSync(file.path);
    res.status(500).json({ error: error.message });
  }
});

app.use((err: any, req: any, res: any, next: any) => {
  res.status(500).json({ error: err.message || "An unexpected error occurred." });
});

// Hybrid Server Start: Only listen if NOT on Vercel
if (!process.env.VERCEL) {
  const startServer = async () => {
    const PORT = 3000;
    
    // Vite middleware for development (Google AI Studio)
    if (process.env.NODE_ENV !== "production") {
      const { createServer: createViteServer } = await import("vite");
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa",
      });
      app.use(vite.middlewares);
    } else {
      const distPath = path.join(process.cwd(), 'dist');
      app.use(express.static(distPath));
      app.get('*', (req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }

    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  };
  startServer();
}

app.get("/api/debug", (req, res) => {
  const dataPath = path.join(__dirname, "data");
  res.json({
    cwd: process.cwd(),
    dirname: __dirname,
    dataPath: dataPath,
    dataExists: fs.existsSync(dataPath),
    files: fs.existsSync(dataPath) ? fs.readdirSync(dataPath) : [],
    dbExists: fs.existsSync(dbPath)
  });
});

export default app;
