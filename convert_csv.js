import fs from 'fs';
import { parse } from 'csv-parse/sync';

const brandsContent = fs.readFileSync('data/Automated Ads Setup Tool - Page_Profile IDs.csv', 'utf-8');
const brandsRecords = parse(brandsContent, {
  columns: true,
  skip_empty_lines: true,
  trim: true
});
console.log('const brandsData = ' + JSON.stringify(brandsRecords, null, 2) + ';');

const locationsContent = fs.readFileSync('data/Automated Ads Setup Tool - Locations.csv', 'utf-8');
const locationsRecords = parse(locationsContent, {
  columns: true,
  skip_empty_lines: true,
  trim: true,
  bom: true
});
console.log('const locationsData = ' + JSON.stringify(locationsRecords, null, 2) + ';');
