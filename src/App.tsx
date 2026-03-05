import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Rocket, CheckCircle2, AlertCircle, Loader2, ClipboardList, 
  ExternalLink, Plus, Trash2, Video, Image as ImageIcon, 
  Layers, Settings, MapPin, FileText, Calendar, DollarSign, 
  Link as LinkIcon, ChevronRight, Copy, Sparkles
} from 'lucide-react';
import { FILM_TRIVIA } from './constants';
import LocationSearch from './components/LocationSearch';

type AdType = 'video' | 'carousel' | 'image';

interface CarouselCard {
  id: string;
  imageUrl: string;
  headline: string;
  url: string;
}

interface Ad {
  id: string;
  type: AdType;
  adName: string;
  headline: string;
  copy: string;
  url: string;
  thumbnail: string;
  ctaType?: string;
  manualAdId?: string;
  customUrlParams?: string;
  feedVideoUrl?: string;
  verticalVideoUrl?: string;
  carouselCards?: CarouselCard[];
}

interface AdSet {
  id: string;
  name: string;
  platformAccountId: string;
  copyTargetingFromAdSetId?: string;
  locations: string[];
  ageMin?: number;
  ageMax?: number;
  budget?: number;
  csvData?: string;
  csvName?: string;
  ads: Ad[];
}

interface CampaignBrief {
  clientId: string;
  movieName: string;
  campaignName: string;
  objective: string;
  startDate: string;
  endDate: string;
  budget: number;
  budgetType: 'campaign' | 'adset';
  adSets: AdSet[];
}

interface Brand {
  id: number;
  client_id: number;
  brand_name: string;
  meta_page_id: string;
  instagram_page_id: string;
  meta_ad_account_id: string;
  meta_pixel_id: string;
}

interface Client {
  id: number;
  name: string;
  brands: Brand[];
}

export default function App() {
  const createDefaultBrief = (): CampaignBrief => {
    const today = new Date().toISOString().split('T')[0];
    const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    const defaultUrlParams = "utm_source=facebook-instagram&utm_medium=gruvi-cpc&utm_campaign={{campaign.name}}&utm_content={{ad.name}}&utm_term={{adset.name}}&campaign_id={{campaign.id}}&adset_id={{adset.id}}&ad_id={{ad.id}}";
    
    return {
      clientId: '',
      movieName: '',
      campaignName: 'New Campaign',
      objective: 'Sales',
      startDate: today,
      endDate: nextWeek,
      budget: 1000,
      budgetType: 'campaign',
      adSets: [
        {
          id: Math.random().toString(36).substr(2, 9),
          name: 'Ad Set 1',
          platformAccountId: '',
          locations: [],
          ads: [
            {
              id: Math.random().toString(36).substr(2, 9),
              type: 'video',
              adName: 'Ad 1',
              headline: '',
              copy: '',
              url: '',
              thumbnail: '',
              ctaType: 'BOOK_NOW',
              customUrlParams: defaultUrlParams
            }
          ]
        }
      ]
    };
  };

  const [asanaUrl, setAsanaUrl] = useState('');
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [brief, setBrief] = useState<CampaignBrief>(createDefaultBrief());
  const [logs, setLogs] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [availableLocations, setAvailableLocations] = useState<string[]>([]);
  const [isLaunching, setIsLaunching] = useState(false);
  const [minimizedAdSets, setMinimizedAdSets] = useState<Record<string, boolean>>({});
  const [shuffledTrivia, setShuffledTrivia] = useState<string[]>([]);
  const [triviaIndex, setTriviaIndex] = useState(0);
  const [clients, setClients] = useState<Client[]>([]);
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isLaunching) {
      // Shuffle trivia on launch
      const shuffled = [...FILM_TRIVIA].sort(() => Math.random() - 0.5);
      setShuffledTrivia(shuffled);
      setTriviaIndex(0);
      
      interval = setInterval(() => {
        setTriviaIndex((prev) => (prev + 1) % FILM_TRIVIA.length);
      }, 10000);
    }
    return () => clearInterval(interval);
  }, [isLaunching]);

  useEffect(() => {
    fetch('/api/clients')
      .then(res => res.json())
      .then(data => {
        setClients(data);
        if (data.length > 0) {
          const firstClient = data[0];
          setBrief(prev => ({
            ...prev,
            clientId: firstClient.id.toString()
          }));
        }
      })
      .catch(err => console.error("Failed to load clients", err));

    fetch('/api/locations')
      .then(res => res.json())
      .then(data => setAvailableLocations(data))
      .catch(err => console.error("Failed to load locations", err));
  }, []);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setCsvFile(e.target.files[0]);
    }
  };

  const handleFetchBrief = async () => {
    if (!asanaUrl) {
      setError('Please paste an Asana Task URL first.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      let csvText = null;
      let csvName = null;
      
      if (csvFile) {
        csvText = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target?.result as string);
          reader.onerror = reject;
          reader.readAsText(csvFile);
        });
        csvName = csvFile.name.replace(/\.[^/.]+$/, "");
      }

      const response = await fetch('/api/fetch-brief', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ asanaUrl, csvData: csvText, csvName, clientId: brief.clientId }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to fetch briefing sheet');
      
      const defaultUrlParams = "utm_source=facebook-instagram&utm_medium=gruvi-cpc&utm_campaign={{campaign.name}}&utm_content={{ad.name}}&utm_term={{adset.name}}&campaign_id={{campaign.id}}&adset_id={{adset.id}}&ad_id={{ad.id}}";
      
      const initialBrief: CampaignBrief = {
        clientId: brief.clientId,
        movieName: data.movieName || data.movieTitle,
        campaignName: `Campaign: ${data.movieName || data.movieTitle}`,
        objective: data.objective,
        startDate: data.startDate?.split('T')[0] || '',
        endDate: data.endDate?.split('T')[0] || '',
        budget: data.budget,
        budgetType: 'campaign',
        adSets: [
          {
            id: Math.random().toString(36).substr(2, 9),
            name: `Ad Set: ${data.movieName || data.movieTitle}`,
            platformAccountId: '', // User will select
            locations: data.locations,
            csvData: data.csvData,
            csvName: data.csvName,
            ads: [
              {
                id: Math.random().toString(36).substr(2, 9),
                type: 'video',
                adName: `Ad: ${data.movieName || data.movieTitle}`,
                headline: data.headline,
                copy: data.copy,
                url: data.url,
                thumbnail: data.thumbnail,
                feedVideoUrl: data.feedVideoUrl,
                verticalVideoUrl: data.verticalVideoUrl,
                ctaType: 'BOOK_NOW',
                customUrlParams: defaultUrlParams
              }
            ]
          }
        ]
      };
      setBrief(initialBrief);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLaunch = async () => {
    if (!brief) return;

    setIsLoading(true);
    setIsLaunching(true);
    setError(null);
    setSuccess(null);
    setLogs(['Initializing launch process...']);

    try {
      const response = await fetch('/api/process-asana', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brief }),
      });

      const data = await response.json();
      if (data.logs) setLogs(data.logs);
      if (!response.ok) throw new Error(data.error || 'Failed to launch campaign');
      setSuccess(`Campaign launched successfully! Ad ID: ${data.adId}`);
      setIsLaunching(false);
    } catch (err: any) {
      setError(err.message);
      setIsLaunching(false);
    } finally {
      setIsLoading(false);
    }
  };

  const addAdSet = () => {
    if (!brief || brief.adSets.length === 0) return;
    const sourceAdSet = brief.adSets[0];
    const newAdSet: AdSet = {
      id: Math.random().toString(36).substr(2, 9),
      name: `New Ad Set ${brief.adSets.length + 1}`,
      platformAccountId: sourceAdSet.platformAccountId,
      locations: [...sourceAdSet.locations],
      ads: sourceAdSet.ads.map(ad => ({
        ...ad,
        id: Math.random().toString(36).substr(2, 9),
        carouselCards: ad.carouselCards ? ad.carouselCards.map(card => ({
          ...card,
          id: Math.random().toString(36).substr(2, 9)
        })) : undefined
      }))
    };
    setBrief({ ...brief, adSets: [...brief.adSets, newAdSet] });
  };

  const toggleMinimizeAdSet = (id: string) => {
    setMinimizedAdSets(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const removeAdSet = (id: string) => {
    if (!brief || brief.adSets.length <= 1) return;
    setBrief({ ...brief, adSets: brief.adSets.filter(as => as.id !== id) });
  };

  const addAd = (adSetId: string, type: AdType) => {
    if (!brief) return;
    const defaultUrlParams = "utm_source=facebook-instagram&utm_medium=gruvi-cpc&utm_campaign={{campaign.name}}&utm_content={{ad.name}}&utm_term={{adset.name}}&campaign_id={{campaign.id}}&adset_id={{adset.id}}&ad_id={{ad.id}}";
    const newAd: Ad = {
      id: Math.random().toString(36).substr(2, 9),
      type,
      adName: `New ${type.charAt(0).toUpperCase() + type.slice(1)} Ad`,
      headline: '',
      copy: '',
      url: '',
      thumbnail: '',
      ctaType: 'BOOK_NOW',
      customUrlParams: defaultUrlParams,
      carouselCards: type === 'carousel' ? [
        { id: Math.random().toString(36).substr(2, 9), imageUrl: '', headline: '', url: '' }
      ] : undefined
    };
    setBrief({
      ...brief,
      adSets: brief.adSets.map(as => as.id === adSetId ? { ...as, ads: [...as.ads, newAd] } : as)
    });
  };

  const removeAd = (adSetId: string, adId: string) => {
    if (!brief) return;
    setBrief({
      ...brief,
      adSets: brief.adSets.map(as => as.id === adSetId ? { ...as, ads: as.ads.filter(a => a.id !== adId) } : as)
    });
  };

  const updateAdSet = (id: string, updates: Partial<AdSet>) => {
    if (!brief) return;
    setBrief({
      ...brief,
      adSets: brief.adSets.map(as => as.id === id ? { ...as, ...updates } : as)
    });
  };

  const updateAd = (adSetId: string, adId: string, updates: Partial<Ad>) => {
    if (!brief) return;
    setBrief({
      ...brief,
      adSets: brief.adSets.map(as => as.id === adSetId ? {
        ...as,
        ads: as.ads.map(a => a.id === adId ? { ...a, ...updates } : a)
      } : as)
    });
  };

  return (
    <div className="min-h-screen bg-[#F5F5F0] text-[#141414] font-sans selection:bg-[#5A5A40] selection:text-white pb-24">
      <div className="max-w-6xl mx-auto px-6 py-16">
        {/* Header */}
        <header className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-[#5A5A40] rounded-full flex items-center justify-center text-white">
                <Rocket size={20} />
              </div>
              <h1 className="text-2xl font-semibold tracking-tight">Asana to Meta Ads v3</h1>
            </div>
            <p className="text-[#5A5A40] text-lg italic serif">
              Automate your Meta campaign creation with full control.
            </p>
          </div>
          
          <div className="flex gap-4">
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-[#5A5A40]/40">Asana Task URL</label>
              <input
                type="text"
                placeholder="Paste Asana URL..."
                className="bg-white border-none rounded-xl py-3 px-4 shadow-sm text-sm w-64 focus:ring-2 focus:ring-[#5A5A40] outline-none"
                value={asanaUrl}
                onChange={(e) => setAsanaUrl(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-[#5A5A40]/40">Audience CSV (Optional)</label>
              <input type="file" id="csv-file-top" className="hidden" onChange={handleFileChange} />
              <label htmlFor="csv-file-top" className="bg-white border-none rounded-xl py-3 px-4 shadow-sm text-sm w-48 cursor-pointer hover:bg-gray-50 flex items-center gap-2">
                <FileText size={14} />
                <span className="truncate">{csvFile ? csvFile.name : 'Choose CSV...'}</span>
              </label>
            </div>
            <button
              onClick={handleFetchBrief}
              disabled={isLoading}
              className="bg-[#5A5A40] text-white px-6 py-3 rounded-xl font-semibold self-end hover:bg-[#4A4A30] transition-all disabled:opacity-50"
            >
              {isLoading ? <Loader2 size={18} className="animate-spin" /> : 'Fetch from Asana'}
            </button>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Main Configuration Area */}
          <div className="lg:col-span-12 space-y-8">
            <AnimatePresence mode="wait">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-8"
              >
                  {/* Campaign Settings */}
                  <section className="bg-white rounded-[32px] p-8 shadow-xl shadow-black/5 border border-black/5">
                    <div className="flex items-center gap-2 mb-8">
                      <Settings size={18} className="text-[#5A5A40]" />
                      <h2 className="text-xl font-semibold tracking-tight">Campaign Settings</h2>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                      <div className="col-span-1">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-[#5A5A40]/40 mb-2 block">Client</label>
                        <select
                          className="w-full bg-[#F5F5F0] border-none rounded-2xl py-4 px-6 focus:ring-2 focus:ring-[#5A5A40] outline-none text-sm font-medium appearance-none"
                          value={brief.clientId}
                          onChange={(e) => {
                            const clientId = e.target.value;
                            setBrief({ 
                              ...brief, 
                              clientId,
                              adSets: brief.adSets.map(as => ({ ...as, platformAccountId: '' }))
                            });
                          }}
                        >
                          <option value="">Select Client...</option>
                          {clients.map(client => (
                            <option key={client.id} value={client.id}>{client.name}</option>
                          ))}
                        </select>
                      </div>
                      <div className="col-span-1">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-[#5A5A40]/40 mb-2 block">Movie Name</label>
                        <input
                          type="text"
                          className="w-full bg-[#F5F5F0] border-none rounded-2xl py-4 px-6 focus:ring-2 focus:ring-[#5A5A40] outline-none text-lg font-medium"
                          value={brief.movieName}
                          onChange={(e) => setBrief({ ...brief, movieName: e.target.value })}
                        />
                      </div>
                      <div className="col-span-1">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-[#5A5A40]/40 mb-2 block">Budget Type</label>
                        <div className="flex bg-[#F5F5F0] p-1 rounded-2xl h-[60px]">
                          <button
                            onClick={() => setBrief({ ...brief, budgetType: 'campaign' })}
                            className={`flex-1 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${brief.budgetType === 'campaign' ? 'bg-white text-[#5A5A40] shadow-sm' : 'text-[#5A5A40]/40 hover:text-[#5A5A40]'}`}
                          >
                            Campaign (CBO)
                          </button>
                          <button
                            onClick={() => setBrief({ ...brief, budgetType: 'adset' })}
                            className={`flex-1 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${brief.budgetType === 'adset' ? 'bg-white text-[#5A5A40] shadow-sm' : 'text-[#5A5A40]/40 hover:text-[#5A5A40]'}`}
                          >
                            Ad Set (ABO)
                          </button>
                        </div>
                      </div>
                      <div className="col-span-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-[#5A5A40]/40 mb-2 block">Campaign Name</label>
                        <input
                          type="text"
                          className="w-full bg-[#F5F5F0] border-none rounded-2xl py-4 px-6 focus:ring-2 focus:ring-[#5A5A40] outline-none text-lg font-medium"
                          value={brief.campaignName}
                          onChange={(e) => setBrief({ ...brief, campaignName: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-widest text-[#5A5A40]/40 mb-2 block">Objective</label>
                        <select
                          className="w-full bg-[#F5F5F0] border-none rounded-2xl py-4 px-6 focus:ring-2 focus:ring-[#5A5A40] outline-none text-sm font-medium appearance-none"
                          value={brief.objective}
                          onChange={(e) => setBrief({ ...brief, objective: e.target.value })}
                        >
                          <option value="Sales">Sales</option>
                          <option value="Reach">Reach</option>
                          <option value="Traffic">Traffic</option>
                          <option value="Engagement">Engagement</option>
                          <option value="Video Views">Video Views</option>
                        </select>
                      </div>
                      
                      <div className="flex flex-col gap-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-[#5A5A40]/40 mb-1 flex items-center gap-1">
                          <Calendar size={12} /> Start Date
                        </label>
                        <input
                          type="date"
                          className="w-full bg-[#F5F5F0] border-none rounded-2xl py-4 px-6 focus:ring-2 focus:ring-[#5A5A40] outline-none text-sm"
                          value={brief.startDate}
                          onChange={(e) => setBrief({ ...brief, startDate: e.target.value })}
                        />
                      </div>
                      <div className="flex flex-col gap-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-[#5A5A40]/40 mb-1 flex items-center gap-1">
                          <Calendar size={12} /> End Date
                        </label>
                        <input
                          type="date"
                          className="w-full bg-[#F5F5F0] border-none rounded-2xl py-4 px-6 focus:ring-2 focus:ring-[#5A5A40] outline-none text-sm"
                          value={brief.endDate}
                          onChange={(e) => setBrief({ ...brief, endDate: e.target.value })}
                        />
                      </div>
                      {brief.budgetType === 'campaign' && (
                        <div className="flex flex-col gap-2">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-[#5A5A40]/40 mb-1 flex items-center gap-1">
                            <DollarSign size={12} /> Campaign Lifetime Budget
                          </label>
                          <input
                            type="number"
                            className="w-full bg-[#F5F5F0] border-none rounded-2xl py-4 px-6 focus:ring-2 focus:ring-[#5A5A40] outline-none text-sm"
                            value={brief.budget}
                            onChange={(e) => setBrief({ ...brief, budget: parseFloat(e.target.value) })}
                          />
                        </div>
                      )}
                    </div>
                  </section>

                  {/* Ad Sets */}
                  <div className="space-y-8">
                    {brief.adSets.map((adSet, asIndex) => (
                      <section key={adSet.id} className="bg-white rounded-[32px] p-8 shadow-xl shadow-black/5 border border-black/5 relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-1 h-full bg-[#5A5A40]" />
                        
                        <div className="flex items-center justify-between mb-8">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-[#F5F5F0] rounded-full flex items-center justify-center text-[#5A5A40] font-bold text-xs">
                              {asIndex + 1}
                            </div>
                            <h2 className="text-xl font-semibold tracking-tight">Ad Set Segment</h2>
                            <button 
                              onClick={() => toggleMinimizeAdSet(adSet.id)}
                              className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest bg-[#F5F5F0] px-3 py-1.5 rounded-lg hover:bg-gray-200 transition-colors ml-4"
                            >
                              {minimizedAdSets[adSet.id] ? 'Expand Settings' : 'Minimize Settings'}
                            </button>
                          </div>
                          <button 
                            onClick={() => removeAdSet(adSet.id)}
                            className="text-red-400 hover:text-red-600 p-2 transition-colors"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>

                        {!minimizedAdSets[adSet.id] && (
                          <motion.div 
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.3 }}
                          >
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
                          <div>
                            <label className="text-[10px] font-bold uppercase tracking-widest text-[#5A5A40]/40 mb-2 block">Ad Set Name</label>
                            <input
                              type="text"
                              className="w-full bg-[#F5F5F0] border-none rounded-2xl py-4 px-6 focus:ring-2 focus:ring-[#5A5A40] outline-none text-sm font-medium"
                              value={adSet.name}
                              onChange={(e) => updateAdSet(adSet.id, { name: e.target.value })}
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold uppercase tracking-widest text-[#5A5A40]/40 mb-2 block">Brand / Account</label>
                            <select
                              className="w-full bg-[#F5F5F0] border-none rounded-2xl py-4 px-6 focus:ring-2 focus:ring-[#5A5A40] outline-none text-sm font-medium appearance-none"
                              value={adSet.platformAccountId}
                              onChange={(e) => updateAdSet(adSet.id, { platformAccountId: e.target.value })}
                            >
                              <option value="">Select Brand...</option>
                              {clients.find(c => c.id.toString() === brief.clientId)?.brands.map(brand => (
                                <option key={brand.id} value={brand.id}>{brand.brand_name}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="text-[10px] font-bold uppercase tracking-widest text-[#5A5A40]/40 mb-2 block">Copy Targeting From Ad Set ID (Optional)</label>
                            <div className="relative">
                              <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-[#5A5A40]/40">
                                <Copy size={14} />
                              </div>
                              <input
                                type="text"
                                placeholder="e.g. 238549203948..."
                                className="w-full bg-[#F5F5F0] border-none rounded-2xl py-4 pl-10 pr-6 focus:ring-2 focus:ring-[#5A5A40] outline-none text-sm"
                                value={adSet.copyTargetingFromAdSetId || ''}
                                onChange={(e) => updateAdSet(adSet.id, { copyTargetingFromAdSetId: e.target.value })}
                              />
                            </div>
                          </div>
                          {brief.budgetType === 'adset' && (
                            <div>
                              <label className="text-[10px] font-bold uppercase tracking-widest text-[#5A5A40]/40 mb-2 block">Ad Set Lifetime Budget</label>
                              <div className="relative">
                                <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-[#5A5A40]/40">
                                  <DollarSign size={14} />
                                </div>
                                <input
                                  type="number"
                                  className="w-full bg-[#F5F5F0] border-none rounded-2xl py-4 pl-10 pr-6 focus:ring-2 focus:ring-[#5A5A40] outline-none text-sm font-medium"
                                  value={adSet.budget || 0}
                                  onChange={(e) => updateAdSet(adSet.id, { budget: parseFloat(e.target.value) })}
                                />
                              </div>
                            </div>
                          )}
                          <div className="col-span-2">
                            <LocationSearch 
                              brandId={adSet.platformAccountId}
                              initialLocations={adSet.locations}
                              onLocationsChange={(locations) => updateAdSet(adSet.id, { locations })}
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="text-[10px] font-bold uppercase tracking-widest text-[#5A5A40]/40 mb-1 block">Min Age</label>
                              <input
                                type="number"
                                placeholder="18"
                                className="w-full bg-[#F5F5F0] border-none rounded-xl py-3 px-4 focus:ring-2 focus:ring-[#5A5A40] outline-none text-sm"
                                value={adSet.ageMin || ''}
                                onChange={(e) => updateAdSet(adSet.id, { ageMin: e.target.value ? parseInt(e.target.value) : undefined })}
                              />
                            </div>
                            <div>
                              <label className="text-[10px] font-bold uppercase tracking-widest text-[#5A5A40]/40 mb-1 block">Max Age</label>
                              <input
                                type="number"
                                placeholder="65"
                                className="w-full bg-[#F5F5F0] border-none rounded-xl py-3 px-4 focus:ring-2 focus:ring-[#5A5A40] outline-none text-sm"
                                value={adSet.ageMax || ''}
                                onChange={(e) => updateAdSet(adSet.id, { ageMax: e.target.value ? parseInt(e.target.value) : undefined })}
                              />
                            </div>
                          </div>
                        </div>

                        {/* Ads in this Ad Set */}
                        <div className="space-y-6">
                          <div className="flex items-center justify-between border-b border-black/5 pb-4">
                            <h3 className="text-xs font-bold uppercase tracking-widest text-[#5A5A40]">Ads in this Segment</h3>
                            <div className="flex gap-2">
                              <button onClick={() => addAd(adSet.id, 'video')} className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest bg-[#F5F5F0] px-3 py-1.5 rounded-lg hover:bg-gray-200 transition-colors">
                                <Video size={12} /> + Video Ad
                              </button>
                              <button onClick={() => addAd(adSet.id, 'carousel')} className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest bg-[#F5F5F0] px-3 py-1.5 rounded-lg hover:bg-gray-200 transition-colors">
                                <Layers size={12} /> + Carousel Ad
                              </button>
                              <button onClick={() => addAd(adSet.id, 'image')} className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest bg-[#F5F5F0] px-3 py-1.5 rounded-lg hover:bg-gray-200 transition-colors">
                                <ImageIcon size={12} /> + Image Ad
                              </button>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 gap-6">
                            {adSet.ads.map((ad, aIndex) => (
                              <div key={ad.id} className="bg-[#F5F5F0] rounded-2xl p-6 relative group">
                                <button 
                                  onClick={() => removeAd(adSet.id, ad.id)}
                                  className="absolute top-4 right-4 text-[#5A5A40]/20 hover:text-red-400 transition-colors"
                                >
                                  <Trash2 size={16} />
                                </button>
                                
                                <div className="flex items-center gap-2 mb-6">
                                  {ad.type === 'video' && <Video size={14} className="text-[#5A5A40]" />}
                                  {ad.type === 'carousel' && <Layers size={14} className="text-[#5A5A40]" />}
                                  {ad.type === 'image' && <ImageIcon size={14} className="text-[#5A5A40]" />}
                                  <span className="text-[10px] font-bold uppercase tracking-widest text-[#5A5A40]/60">
                                    Ad {aIndex + 1}: {ad.type}
                                  </span>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                  <div className="col-span-2">
                                    <label className="text-[10px] font-bold uppercase tracking-widest text-[#5A5A40]/40 mb-1 block">Ad Name</label>
                                    <input
                                      type="text"
                                      className="w-full bg-white border-none rounded-xl py-3 px-4 focus:ring-2 focus:ring-[#5A5A40] outline-none text-sm font-medium"
                                      value={ad.adName}
                                      onChange={(e) => updateAd(adSet.id, ad.id, { adName: e.target.value })}
                                    />
                                  </div>
                                  <div className="space-y-4">
                                    <div>
                                      <label className="text-[10px] font-bold uppercase tracking-widest text-[#5A5A40]/40 mb-1 block">Headline</label>
                                      <input
                                        type="text"
                                        className="w-full bg-white border-none rounded-xl py-3 px-4 focus:ring-2 focus:ring-[#5A5A40] outline-none text-sm"
                                        value={ad.headline}
                                        onChange={(e) => updateAd(adSet.id, ad.id, { headline: e.target.value })}
                                      />
                                    </div>
                                    <div>
                                      <label className="text-[10px] font-bold uppercase tracking-widest text-[#5A5A40]/40 mb-1 block">Ad Copy</label>
                                      <textarea
                                        className="w-full bg-white border-none rounded-xl py-3 px-4 focus:ring-2 focus:ring-[#5A5A40] outline-none text-sm min-h-[100px]"
                                        value={ad.copy}
                                        onChange={(e) => updateAd(adSet.id, ad.id, { copy: e.target.value })}
                                      />
                                    </div>
                                  </div>
                                  <div className="space-y-4">
                                    <div>
                                      <label className="text-[10px] font-bold uppercase tracking-widest text-[#5A5A40]/40 mb-1 block">Destination URL</label>
                                      <div className="relative">
                                        <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-[#5A5A40]/40">
                                          <LinkIcon size={12} />
                                        </div>
                                        <input
                                          type="text"
                                          className="w-full bg-white border-none rounded-xl py-3 pl-9 pr-4 focus:ring-2 focus:ring-[#5A5A40] outline-none text-sm"
                                          value={ad.url}
                                          onChange={(e) => updateAd(adSet.id, ad.id, { url: e.target.value })}
                                        />
                                      </div>
                                    </div>
                                    <div>
                                      <label className="text-[10px] font-bold uppercase tracking-widest text-[#5A5A40]/40 mb-1 block">Manual Ad ID (Optional)</label>
                                      <input
                                        type="text"
                                        placeholder="Existing Meta Ad ID..."
                                        className="w-full bg-white border-none rounded-xl py-3 px-4 focus:ring-2 focus:ring-[#5A5A40] outline-none text-sm"
                                        value={ad.manualAdId || ''}
                                        onChange={(e) => updateAd(adSet.id, ad.id, { manualAdId: e.target.value })}
                                      />
                                    </div>
                                    <div className="md:col-span-2">
                                      <label className="text-[10px] font-bold uppercase tracking-widest text-[#5A5A40]/40 mb-1 block">URL Parameters</label>
                                      <input
                                        type="text"
                                        className="w-full bg-white border-none rounded-xl py-3 px-4 focus:ring-2 focus:ring-[#5A5A40] outline-none text-sm"
                                        value={ad.customUrlParams || ''}
                                        onChange={(e) => updateAd(adSet.id, ad.id, { customUrlParams: e.target.value })}
                                      />
                                    </div>
                                    <div>
                                      <label className="text-[10px] font-bold uppercase tracking-widest text-[#5A5A40]/40 mb-1 block">Call to Action</label>
                                      <select
                                        className="w-full bg-white border-none rounded-xl py-3 px-4 focus:ring-2 focus:ring-[#5A5A40] outline-none text-sm appearance-none"
                                        value={ad.ctaType || 'BOOK_NOW'}
                                        onChange={(e) => updateAd(adSet.id, ad.id, { ctaType: e.target.value })}
                                      >
                                        <option value="BOOK_NOW">Book Now</option>
                                        <option value="LEARN_MORE">Learn More</option>
                                        <option value="SHOP_NOW">Shop Now</option>
                                        <option value="GET_SHOWTIMES">Get Showtimes</option>
                                        <option value="WATCH_MORE">Watch More</option>
                                        <option value="SIGN_UP">Sign Up</option>
                                      </select>
                                    </div>
                                    <div>
                                      <label className="text-[10px] font-bold uppercase tracking-widest text-[#5A5A40]/40 mb-1 block">Thumbnail URL</label>
                                      <input
                                        type="text"
                                        className="w-full bg-white border-none rounded-xl py-3 px-4 focus:ring-2 focus:ring-[#5A5A40] outline-none text-sm"
                                        value={ad.thumbnail}
                                        onChange={(e) => updateAd(adSet.id, ad.id, { thumbnail: e.target.value })}
                                      />
                                    </div>
                                    {ad.type === 'video' && (
                                      <div className="grid grid-cols-2 gap-4">
                                        <div>
                                          <label className="text-[10px] font-bold uppercase tracking-widest text-[#5A5A40]/40 mb-1 block">Feed Video</label>
                                          <input
                                            type="text"
                                            className="w-full bg-white border-none rounded-xl py-3 px-4 focus:ring-2 focus:ring-[#5A5A40] outline-none text-[10px]"
                                            value={ad.feedVideoUrl}
                                            onChange={(e) => updateAd(adSet.id, ad.id, { feedVideoUrl: e.target.value })}
                                          />
                                        </div>
                                        <div>
                                          <label className="text-[10px] font-bold uppercase tracking-widest text-[#5A5A40]/40 mb-1 block">Vertical Video</label>
                                          <input
                                            type="text"
                                            className="w-full bg-white border-none rounded-xl py-3 px-4 focus:ring-2 focus:ring-[#5A5A40] outline-none text-[10px]"
                                            value={ad.verticalVideoUrl}
                                            onChange={(e) => updateAd(adSet.id, ad.id, { verticalVideoUrl: e.target.value })}
                                          />
                                        </div>
                                      </div>
                                    )}
                                    {ad.type === 'carousel' && (
                                      <div className="col-span-2 space-y-4 mt-4 pt-4 border-t border-black/5">
                                        <div className="flex items-center justify-between">
                                          <label className="text-[10px] font-bold uppercase tracking-widest text-[#5A5A40]/40">Carousel Cards</label>
                                          <button 
                                            onClick={() => {
                                              const newCard = { id: Math.random().toString(36).substr(2, 9), imageUrl: '', headline: ad.headline, url: ad.url };
                                              updateAd(adSet.id, ad.id, { carouselCards: [...(ad.carouselCards || []), newCard] });
                                            }}
                                            className="text-[10px] font-bold uppercase tracking-widest text-[#5A5A40] hover:underline"
                                          >
                                            + Add Card
                                          </button>
                                        </div>
                                        <div className="space-y-4">
                                          {ad.carouselCards?.map((card, cIndex) => (
                                            <div key={card.id} className="bg-white rounded-xl p-4 border border-black/5 relative">
                                              <button 
                                                onClick={() => {
                                                  updateAd(adSet.id, ad.id, { carouselCards: ad.carouselCards?.filter(c => c.id !== card.id) });
                                                }}
                                                className="absolute top-2 right-2 text-red-400 hover:text-red-600"
                                              >
                                                <Trash2 size={12} />
                                              </button>
                                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                <div>
                                                  <label className="text-[8px] font-bold uppercase tracking-widest text-[#5A5A40]/40 mb-1 block">Card {cIndex + 1} Image URL</label>
                                                  <input
                                                    type="text"
                                                    className="w-full bg-[#F5F5F0] border-none rounded-lg py-2 px-3 text-xs outline-none focus:ring-1 focus:ring-[#5A5A40]"
                                                    value={card.imageUrl}
                                                    onChange={(e) => {
                                                      const newCards = ad.carouselCards?.map(c => c.id === card.id ? { ...c, imageUrl: e.target.value } : c);
                                                      updateAd(adSet.id, ad.id, { carouselCards: newCards });
                                                    }}
                                                  />
                                                </div>
                                                <div>
                                                  <label className="text-[8px] font-bold uppercase tracking-widest text-[#5A5A40]/40 mb-1 block">Card Headline</label>
                                                  <input
                                                    type="text"
                                                    className="w-full bg-[#F5F5F0] border-none rounded-lg py-2 px-3 text-xs outline-none focus:ring-1 focus:ring-[#5A5A40]"
                                                    value={card.headline}
                                                    onChange={(e) => {
                                                      const newCards = ad.carouselCards?.map(c => c.id === card.id ? { ...c, headline: e.target.value } : c);
                                                      updateAd(adSet.id, ad.id, { carouselCards: newCards });
                                                    }}
                                                  />
                                                </div>
                                                <div>
                                                  <label className="text-[8px] font-bold uppercase tracking-widest text-[#5A5A40]/40 mb-1 block">Card URL</label>
                                                  <input
                                                    type="text"
                                                    className="w-full bg-[#F5F5F0] border-none rounded-lg py-2 px-3 text-xs outline-none focus:ring-1 focus:ring-[#5A5A40]"
                                                    value={card.url}
                                                    onChange={(e) => {
                                                      const newCards = ad.carouselCards?.map(c => c.id === card.id ? { ...c, url: e.target.value } : c);
                                                      updateAd(adSet.id, ad.id, { carouselCards: newCards });
                                                    }}
                                                  />
                                                </div>
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </section>
                    ))}

                    <button 
                      onClick={addAdSet}
                      className="w-full py-6 border-2 border-dashed border-[#5A5A40]/20 rounded-[32px] flex items-center justify-center gap-2 text-[#5A5A40]/60 hover:bg-white hover:border-[#5A5A40]/40 transition-all font-semibold italic serif"
                    >
                      <Plus size={20} /> Add Another Ad Set Segment
                    </button>
                  </div>

                  {/* Launch Controls */}
                  <div className="flex flex-col md:flex-row gap-6 items-start">
                    <div className="flex-1 w-full">
                      <div className="bg-[#151619] rounded-[32px] p-8 font-mono text-[10px] text-white/80 space-y-2 max-h-96 overflow-y-auto shadow-2xl">
                        <div className="flex items-center justify-between mb-4 border-b border-white/10 pb-4">
                          <h3 className="text-[10px] font-bold uppercase tracking-widest text-white/40">Execution Logs</h3>
                          <div className="flex gap-1">
                            <div className="w-2 h-2 rounded-full bg-red-500/50" />
                            <div className="w-2 h-2 rounded-full bg-yellow-500/50" />
                            <div className="w-2 h-2 rounded-full bg-green-500/50" />
                          </div>
                        </div>
                        {logs.length === 0 && <p className="text-white/20 italic">Ready for launch...</p>}
                        {logs.map((log, i) => (
                          <div key={i} className="flex gap-3">
                            <span className="text-white/30">[{new Date().toLocaleTimeString([], { hour12: false })}]</span>
                            <span>{log}</span>
                          </div>
                        ))}
                        {error && (
                          <div className="flex gap-3 text-red-400 pt-2">
                            <AlertCircle size={12} className="shrink-0 mt-0.5" />
                            <span>Error: {error}</span>
                          </div>
                        )}
                        {success && (
                          <div className="flex gap-3 text-emerald-400 pt-2">
                            <CheckCircle2 size={12} className="shrink-0 mt-0.5" />
                            <span>{success}</span>
                          </div>
                        )}
                        <div ref={logEndRef} />
                      </div>
                    </div>

                    <div className="w-full md:w-80 space-y-4">
                      <button
                        onClick={handleLaunch}
                        disabled={isLoading}
                        className={`w-full py-8 rounded-[32px] font-bold text-xl tracking-tight transition-all flex flex-col items-center justify-center gap-2 shadow-xl ${
                          isLoading 
                            ? 'bg-[#5A5A40]/20 text-[#5A5A40] cursor-not-allowed' 
                            : 'bg-[#5A5A40] text-white hover:bg-[#4A4A30] active:scale-[0.95] hover:shadow-2xl hover:-translate-y-1'
                        }`}
                      >
                        {isLoading ? (
                          <>
                            <Loader2 size={32} className="animate-spin" />
                            <span className="text-sm font-medium">Launching Campaign...</span>
                          </>
                        ) : (
                          <>
                            <Rocket size={32} />
                            <span>Launch Now</span>
                            <span className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-50">Meta Ads API</span>
                          </>
                        )}
                      </button>
                      
                      <button
                        onClick={() => { setBrief(createDefaultBrief()); setLogs([]); setSuccess(null); setError(null); }}
                        className="w-full py-4 rounded-2xl border border-black/5 text-xs font-bold uppercase tracking-widest text-[#5A5A40]/60 hover:bg-white hover:text-[#5A5A40] transition-all"
                      >
                        Discard & Restart
                      </button>
                    </div>
                  </div>
                </motion.div>
              </AnimatePresence>
          </div>
        </div>

        {/* Footer Info */}
        <footer className="mt-24 text-center">
          <p className="text-[10px] text-[#5A5A40]/40 uppercase tracking-[0.3em] font-bold">
            Cinema Meta Ads Automation System v3.0 • Gruvi Internal Tool
          </p>
        </footer>
      </div>

      {/* Progress Modal */}
      <AnimatePresence>
        {isLaunching && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-[#F5F5F0]/80 backdrop-blur-xl"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white rounded-[48px] p-12 shadow-2xl border border-black/5 max-w-2xl w-full text-center relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-2 bg-[#F5F5F0]">
                <motion.div 
                  initial={{ width: "0%" }}
                  animate={{ width: "100%" }}
                  transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                  className="h-full bg-[#5A5A40]"
                />
              </div>

              <div className="mb-12 flex flex-col items-center">
                <div className="w-20 h-20 bg-[#F5F5F0] rounded-full flex items-center justify-center text-[#5A5A40] mb-6 relative">
                  <Loader2 size={40} className="animate-spin" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Rocket size={20} className="opacity-20" />
                  </div>
                </div>
                <h2 className="text-3xl font-semibold tracking-tight mb-2">Launching Campaign</h2>
                <p className="text-[#5A5A40]/60 italic serif">Please wait while we communicate with Meta Ads API...</p>
              </div>

              <div className="bg-[#F5F5F0] rounded-3xl p-8 relative min-h-[160px] flex flex-col justify-center">
                <div className="absolute -top-3 left-8 bg-[#5A5A40] text-white text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full flex items-center gap-1">
                  <Sparkles size={10} /> Film Facts
                </div>
                <AnimatePresence mode="wait">
                  <motion.p 
                    key={triviaIndex}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="text-xl font-medium text-[#141414] leading-relaxed italic serif"
                  >
                    "{shuffledTrivia[triviaIndex] || FILM_TRIVIA[0]}"
                  </motion.p>
                </AnimatePresence>
              </div>

              <div className="mt-12 flex flex-col items-center gap-4">
                <div className="flex gap-1">
                  {FILM_TRIVIA.slice(0, 5).map((_, i) => (
                    <div 
                      key={i} 
                      className={`w-1.5 h-1.5 rounded-full transition-all duration-500 ${
                        (triviaIndex % 5) === i ? 'bg-[#5A5A40] w-4' : 'bg-[#5A5A40]/20'
                      }`} 
                    />
                  ))}
                </div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#5A5A40]/40">
                  Processing Assets & Audiences
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function BriefItem({ label, value, fullWidth }: { label: string; value: string; fullWidth?: boolean }) {
  return (
    <div className={fullWidth ? 'col-span-2' : ''}>
      <label className="block text-[10px] font-bold uppercase tracking-widest text-[#5A5A40]/40 mb-1">{label}</label>
      <p className="text-sm font-medium text-[#141414] break-words">{value || <span className="text-red-400 italic">Missing</span>}</p>
    </div>
  );
}

function AssetLink({ label, url }: { label: string; url: string }) {
  if (!url) return null;
  return (
    <div className="flex items-center justify-between bg-[#F5F5F0] p-3 rounded-xl group">
      <span className="text-[10px] font-bold uppercase tracking-widest text-[#5A5A40]/60">{label}</span>
      <a 
        href={url} 
        target="_blank" 
        rel="noopener noreferrer"
        className="text-[#5A5A40] hover:text-[#141414] transition-colors flex items-center gap-1 text-xs font-medium"
      >
        View Asset <ExternalLink size={12} />
      </a>
    </div>
  );
}
