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
  manualFeedVideoId?: string;
  manualVerticalVideoId?: string;
  manualThumbnailHash?: string;
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
  customAudiences?: string[];
  excludedCustomAudiences?: string[];
  geoLocations?: any;
  budget?: number;
  csvData?: string;
  csvName?: string;
  ads: Ad[];
}

interface CampaignBrief {
  clientId: string;
  movieName: string;
  genre: string;
  campaignName: string;
  objective: string;
  startDate: string;
  endDate: string;
  budget: number;
  budgetType: 'campaign' | 'adset';
  adSets: AdSet[];
  createAudience: boolean;
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

const VideoUploader = ({ 
  label, 
  onUpload, 
  clientId, 
  existingId 
}: { 
  label: string, 
  onUpload: (id: string) => void, 
  clientId: string,
  existingId?: string
}) => {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    if (!file.type.startsWith('video/')) {
      setError('Please upload a video file.');
      return;
    }

    setIsUploading(true);
    setError(null);

    const formData = new FormData();
    formData.append('video', file);
    formData.append('clientId', clientId);

    try {
      const response = await fetch('/api/upload-video', {
        method: 'POST',
        body: formData,
      });

      const contentType = response.headers.get('content-type');
      let data;
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        const text = await response.text();
        throw new Error(`Server returned non-JSON response (${response.status}): ${text.substring(0, 100)}...`);
      }

      if (!response.ok) throw new Error(data.error || 'Upload failed');
      
      onUpload(data.videoId);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <label className="text-[10px] font-bold uppercase tracking-widest text-[#5A5A40]/40 mb-1 block">{label}</label>
      <div 
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleFile(e.dataTransfer.files[0]);
          }
        }}
        className={`border-2 border-dashed rounded-xl p-4 flex flex-col items-center justify-center gap-2 cursor-pointer transition-all min-h-[100px] ${
          existingId ? 'border-green-500/30 bg-green-50/30' : 'border-[#5A5A40]/20 hover:border-[#5A5A40]/40 bg-white'
        }`}
      >
        <input 
          type="file" 
          ref={fileInputRef} 
          className="hidden" 
          accept="video/*"
          onChange={(e) => e.target.files && handleFile(e.target.files[0])}
        />
        {isUploading ? (
          <Loader2 size={20} className="animate-spin text-[#5A5A40]" />
        ) : existingId ? (
          <CheckCircle2 size={20} className="text-green-500" />
        ) : (
          <Video size={20} className="text-[#5A5A40]/40" />
        )}
        <span className="text-[10px] font-medium text-[#5A5A40]/60 text-center">
          {isUploading ? 'Uploading to Meta...' : existingId ? `Meta ID: ${existingId}` : 'Drag & drop or click to upload video file'}
        </span>
        {error && <span className="text-[8px] text-red-500 mt-1 text-center">{error}</span>}
      </div>
    </div>
  );
};

const ImageUploader = ({ 
  label, 
  onUpload, 
  clientId, 
  existingHash 
}: { 
  label: string, 
  onUpload: (hash: string) => void, 
  clientId: string,
  existingHash?: string
}) => {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Please upload an image file.');
      return;
    }

    setIsUploading(true);
    setError(null);

    const formData = new FormData();
    formData.append('image', file);
    formData.append('clientId', clientId);

    try {
      const response = await fetch('/api/upload-image', {
        method: 'POST',
        body: formData,
      });

      const contentType = response.headers.get('content-type');
      let data;
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        const text = await response.text();
        throw new Error(`Server returned non-JSON response (${response.status}): ${text.substring(0, 100)}...`);
      }

      if (!response.ok) throw new Error(data.error || 'Upload failed');
      
      onUpload(data.imageHash);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <label className="text-[10px] font-bold uppercase tracking-widest text-[#5A5A40]/40 mb-1 block">{label}</label>
      <div 
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleFile(e.dataTransfer.files[0]);
          }
        }}
        className={`border-2 border-dashed rounded-xl p-4 flex flex-col items-center justify-center gap-2 cursor-pointer transition-all min-h-[100px] ${
          existingHash ? 'border-green-500/30 bg-green-50/30' : 'border-[#5A5A40]/20 hover:border-[#5A5A40]/40 bg-white'
        }`}
      >
        <input 
          type="file" 
          ref={fileInputRef} 
          className="hidden" 
          accept="image/*"
          onChange={(e) => e.target.files && handleFile(e.target.files[0])}
        />
        {isUploading ? (
          <Loader2 size={20} className="animate-spin text-[#5A5A40]" />
        ) : existingHash ? (
          <CheckCircle2 size={20} className="text-green-500" />
        ) : (
          <ImageIcon size={20} className="text-[#5A5A40]/40" />
        )}
        <span className="text-[10px] font-medium text-[#5A5A40]/60 text-center">
          {isUploading ? 'Uploading to Meta...' : existingHash ? `Meta Hash: ${existingHash}` : 'Drag & drop or click to upload thumbnail'}
        </span>
        {error && <span className="text-[8px] text-red-500 mt-1 text-center">{error}</span>}
      </div>
    </div>
  );
};

export default function App() {
  const createDefaultBrief = (): CampaignBrief => {
    const today = new Date().toISOString().split('T')[0];
    const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    const defaultUrlParams = "utm_source=facebook-instagram&utm_medium=gruvi-cpc&utm_campaign={{campaign.name}}&utm_content={{ad.name}}&utm_term={{adset.name}}&campaign_id={{campaign.id}}&adset_id={{adset.id}}&ad_id={{ad.id}}";
    
    return {
      clientId: '',
      movieName: '',
      genre: '',
      campaignName: 'New Campaign',
      objective: 'Sales',
      startDate: today,
      endDate: nextWeek,
      budget: 1000,
      budgetType: 'campaign',
      createAudience: true,
      adSets: [
        {
          id: Math.random().toString(36).substr(2, 9),
          name: 'Segment R - Behavioural Retargeting - ',
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
              ctaType: 'BOOK_NOW', // Default objective is 'Sales'
              customUrlParams: defaultUrlParams
            }
          ]
        }
      ]
    };
  };

  const [asanaUrl, setAsanaUrl] = useState('');
  const [importCampaignId, setImportCampaignId] = useState('');
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

  const handleImport = async () => {
    if (!asanaUrl) {
      setError('Please paste an Asana Task URL or Meta Campaign ID first.');
      return;
    }

    if (!brief.clientId) {
      setError('Please select a Client before importing.');
      return;
    }

    const trimmedInput = asanaUrl.trim();
    const isMetaId = /^\d{10,}$/.test(trimmedInput);

    if (isMetaId) {
      setImportCampaignId(trimmedInput);
      await fetchCampaignData(trimmedInput);
    } else {
      await handleFetchBrief();
    }
  };

  const fetchCampaignData = async (campaignId: string) => {
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch('/api/fetch-campaign-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaignId, clientId: brief.clientId })
      });

      const contentType = response.headers.get('content-type');
      let data;
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        const text = await response.text();
        throw new Error(`Server returned non-JSON response (${response.status}): ${text.substring(0, 100)}...`);
      }
      if (data.error) throw new Error(data.error);

      setBrief({
        ...data,
        clientId: brief.clientId
      });
      
      if (!data.adSets.every((as: any) => as.platformAccountId)) {
        setSuccess('Campaign data imported, but some brands could not be matched automatically. Please select them manually.');
      } else {
        setSuccess('Campaign data imported successfully!');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
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

      const contentType = response.headers.get('content-type');
      let data;
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        const text = await response.text();
        throw new Error(`Server returned non-JSON response (${response.status}): ${text.substring(0, 100)}...`);
      }
      if (!response.ok) throw new Error(data.error || 'Failed to fetch briefing sheet');
      
      const defaultUrlParams = "utm_source=facebook-instagram&utm_medium=gruvi-cpc&utm_campaign={{campaign.name}}&utm_content={{ad.name}}&utm_term={{adset.name}}&campaign_id={{campaign.id}}&adset_id={{adset.id}}&ad_id={{ad.id}}";
      
      const initialBrief: CampaignBrief = {
        clientId: brief.clientId,
        movieName: data.movieName || data.movieTitle,
        genre: data.genre || '',
        campaignName: data.campaignName || `Campaign: ${data.movieName || data.movieTitle}`,
        objective: data.objective,
        startDate: data.startDate?.split('T')[0] || '',
        endDate: data.endDate?.split('T')[0] || '',
        budget: data.budget,
        budgetType: 'campaign',
        createAudience: true,
        adSets: [
          {
            id: Math.random().toString(36).substr(2, 9),
            name: `Segment R - Behavioural Retargeting - ${data.movieName || data.movieTitle}`,
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
                ctaType: (data.objective === 'Sales' || data.objective === 'CV') ? 'BOOK_NOW' : 'LEARN_MORE',
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

    // Validation: Ensure all ad sets have a brand selected
    const missingBrand = brief.adSets.find(as => !as.platformAccountId);
    if (missingBrand) {
      setError(`Please select a Brand/Account for Ad Set: "${missingBrand.name}"`);
      return;
    }

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

      const contentType = response.headers.get('content-type');
      let data;
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        const text = await response.text();
        throw new Error(`Server returned non-JSON response (${response.status}): ${text.substring(0, 100)}...`);
      }
      if (data.logs) setLogs(data.logs);
      if (!response.ok) {
        const errorMsg = data.error || 'Failed to launch campaign';
        
        // Check for specific video upload failure
        if (errorMsg.startsWith('VIDEO_UPLOAD_FAILED:')) {
          const [_, type, url] = errorMsg.split(':');
          setError(`Automatic video upload failed for ${type} video. Please upload the file manually below.`);
          // We don't throw here, we want to show the manual upload UI
          setIsLaunching(false);
          setIsLoading(false);
          return;
        }
        
        throw new Error(errorMsg);
      }
      setSuccess(`Campaign launched successfully!`);
      setIsLaunching(false);
    } catch (err: any) {
      setError(err.message);
      setIsLaunching(false);
    } finally {
      setIsLoading(false);
    }
  };

  const copyLogsToClipboard = () => {
    const logText = logs.join('\n');
    navigator.clipboard.writeText(logText);
    setSuccess('Logs copied to clipboard!');
    setTimeout(() => setSuccess(null), 3000);
  };

  const addAdSet = () => {
    if (!brief || brief.adSets.length === 0) return;
    const sourceAdSet = brief.adSets[0];
    const newAdSet: AdSet = {
      id: Math.random().toString(36).substr(2, 9),
      name: `Segment R - Behavioural Retargeting - ${brief.movieName}`,
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
      ctaType: (brief.objective === 'Sales' || brief.objective === 'CV') ? 'BOOK_NOW' : 'LEARN_MORE',
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

  useEffect(() => {
    if (!brief.movieName && !brief.clientId) return;

    const selectedClient = clients.find(c => c.id.toString() === brief.clientId);
    const clientName = selectedClient?.name || 'CLIENT';
    const movieName = brief.movieName || 'MOVIE NAME';
    const genre = brief.genre || 'GENRE';
    
    const objectiveMap: Record<string, string> = {
      "Sales": "CV",
      "Traffic": "TR",
      "Reach": "Reach",
      "Engagement": "EG",
      "Video Views": "VV"
    };
    const displayObjective = objectiveMap[brief.objective] || brief.objective || 'OBJECTIVE';
    
    let newName = `${clientName} - ${movieName} - ${genre} - ${displayObjective}`;

    if (clientName.includes('Moving Story')) {
      newName = `15569 - ${movieName} | PRE (AU) - FB & IG - ${displayObjective} - Moving Story - ${genre} - Theatrical`;
    } else if (clientName.includes('Palace Cinemas')) {
      newName = `12396 - ${movieName} - FB & IG - ${displayObjective} - Palace Cinemas - ${genre} - Theatrical`;
    } else if (clientName.includes('Reading Cinemas')) {
      newName = `GRUVI - ${movieName} (AU) - FB & IG - ${displayObjective} - Reading Cinemas - ${genre} - Theatrical`;
    } else {
      const startDate = brief.startDate || 'START DATE';
      const endDate = brief.endDate || 'END DATE';
      newName = `${clientName} - ${movieName} - ${genre} - ${displayObjective} - ${startDate} - ${endDate}`;
    }
    
    // Only update if it's different to avoid infinite loops
    if (brief.movieName && brief.campaignName !== newName && (brief.campaignName === 'New Campaign' || brief.campaignName === '' || brief.campaignName.includes(' - '))) {
      setBrief(prev => ({ ...prev, campaignName: newName }));
    }
  }, [brief.movieName, brief.clientId, brief.genre, brief.objective, brief.startDate, brief.endDate, clients]);

  return (
    <div className="min-h-screen bg-[#F5F5F0] text-[#141414] font-sans selection:bg-[#5A5A40] selection:text-white pb-24">
      <div className="max-w-6xl mx-auto px-6 py-16">
        {/* Header */}
        <header className="mb-16 text-center">
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center justify-center w-16 h-16 bg-[#5A5A40] rounded-[20px] shadow-xl shadow-[#5A5A40]/20 text-white mb-6"
          >
            <Rocket size={32} />
          </motion.div>
          <motion.h1 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-4xl font-bold tracking-tight mb-3"
          >
            Asana to Meta Ads v3
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-[#5A5A40] text-xl italic serif max-w-2xl mx-auto mb-12"
          >
            Automate your Meta campaign creation with full control.
          </motion.p>

          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 }}
            className="bg-white rounded-[32px] p-8 shadow-xl shadow-black/5 border border-black/5 flex flex-wrap items-end justify-center gap-6"
          >
            <div className="flex flex-col gap-2 text-left">
              <label className="text-[10px] font-bold uppercase tracking-widest text-[#5A5A40]/40 ml-1">Client</label>
              <select
                className="bg-[#F5F5F0] border-none rounded-2xl py-4 px-6 shadow-inner text-sm w-56 focus:ring-2 focus:ring-[#5A5A40] outline-none transition-all appearance-none font-medium"
                value={brief.clientId || ''}
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

            <div className="flex flex-col gap-2 text-left">
              <label className="text-[10px] font-bold uppercase tracking-widest text-[#5A5A40]/40 ml-1">Import Source (Asana or Meta ID)</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-[#5A5A40]/40">
                  <LinkIcon size={14} />
                </div>
                <input
                  type="text"
                  placeholder="Paste Asana URL or Meta ID..."
                  className="bg-[#F5F5F0] border-none rounded-2xl py-4 pl-11 pr-6 shadow-inner text-sm w-80 focus:ring-2 focus:ring-[#5A5A40] outline-none transition-all"
                  value={asanaUrl || ''}
                  onChange={(e) => setAsanaUrl(e.target.value)}
                />
              </div>
            </div>

            <div className="flex flex-col gap-2 text-left">
              <label className="text-[10px] font-bold uppercase tracking-widest text-[#5A5A40]/40 ml-1">Audience CSV (Optional)</label>
              <input type="file" id="csv-file-top" className="hidden" onChange={handleFileChange} />
              <label htmlFor="csv-file-top" className="bg-[#F5F5F0] border-none rounded-2xl py-4 px-6 shadow-inner text-sm w-48 cursor-pointer hover:bg-[#EBEBE6] flex items-center gap-3 transition-all">
                <FileText size={16} className="text-[#5A5A40]/60" />
                <span className="truncate font-medium">{csvFile ? csvFile.name : 'Choose CSV...'}</span>
              </label>
            </div>

            <button
              onClick={handleImport}
              disabled={isLoading}
              className="bg-[#5A5A40] text-white px-8 py-4 rounded-2xl font-bold uppercase tracking-widest text-xs shadow-lg shadow-[#5A5A40]/20 hover:bg-[#4A4A30] hover:-translate-y-0.5 active:translate-y-0 transition-all disabled:opacity-50 h-[52px]"
            >
              {isLoading ? <Loader2 size={18} className="animate-spin" /> : 'Import'}
            </button>
          </motion.div>
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
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div className="col-span-1">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-[#5A5A40]/40 mb-2 block">Movie Name</label>
                        <input
                          type="text"
                          className="w-full bg-[#F5F5F0] border-none rounded-2xl py-4 px-6 focus:ring-2 focus:ring-[#5A5A40] outline-none text-lg font-medium"
                          value={brief.movieName || ''}
                          onChange={(e) => {
                            const newVal = e.target.value;
                            const oldVal = brief.movieName;
                            setBrief({ 
                              ...brief, 
                              movieName: newVal,
                              adSets: brief.adSets.map(as => {
                                const defaultPrefix = 'Segment R - Behavioural Retargeting - ';
                                if (as.name === defaultPrefix + oldVal || as.name === defaultPrefix) {
                                  return { ...as, name: defaultPrefix + newVal };
                                }
                                return as;
                              })
                            });
                          }}
                        />
                      </div>
                      <div className="col-span-1">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-[#5A5A40]/40 mb-2 block">Genre</label>
                        <input
                          type="text"
                          placeholder="e.g. Action, Drama..."
                          className="w-full bg-[#F5F5F0] border-none rounded-2xl py-4 px-6 focus:ring-2 focus:ring-[#5A5A40] outline-none text-lg font-medium"
                          value={brief.genre || ''}
                          onChange={(e) => setBrief({ ...brief, genre: e.target.value })}
                        />
                      </div>
                      <div className="col-span-1 flex items-center gap-4">
                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-[#5A5A40]/40 block">Create Audience</label>
                          <span className="text-[10px] text-[#5A5A40]/60 italic">Based on Movie Name</span>
                        </div>
                        <button
                          onClick={() => setBrief({ ...brief, createAudience: !brief.createAudience })}
                          className={`w-12 h-6 rounded-full transition-all relative ${brief.createAudience ? 'bg-[#5A5A40]' : 'bg-[#5A5A40]/20'}`}
                        >
                          <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${brief.createAudience ? 'left-7' : 'left-1'}`} />
                        </button>
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
                          value={brief.campaignName || ''}
                          onChange={(e) => setBrief({ ...brief, campaignName: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-widest text-[#5A5A40]/40 mb-2 block">Objective</label>
                        <select
                          className="w-full bg-[#F5F5F0] border-none rounded-2xl py-4 px-6 focus:ring-2 focus:ring-[#5A5A40] outline-none text-sm font-medium appearance-none"
                          value={brief.objective || ''}
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
                          value={brief.startDate || ''}
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
                          value={brief.endDate || ''}
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
                            value={brief.budget ?? 0}
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
                            <h2 className="text-xl font-semibold tracking-tight">{adSet.name || 'Ad Set Segment'}</h2>
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
                              value={adSet.name || ''}
                              onChange={(e) => updateAdSet(adSet.id, { name: e.target.value })}
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold uppercase tracking-widest text-[#5A5A40]/40 mb-2 block">Brand / Account</label>
                            <select
                              className="w-full bg-[#F5F5F0] border-none rounded-2xl py-4 px-6 focus:ring-2 focus:ring-[#5A5A40] outline-none text-sm font-medium appearance-none"
                              value={adSet.platformAccountId || ''}
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
                              geoLocations={adSet.geoLocations}
                              onLocationsChange={(locations) => updateAdSet(adSet.id, { locations, geoLocations: undefined })}
                              onGeoLocationsChange={(geoLocations) => updateAdSet(adSet.id, { geoLocations })}
                            />
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <label className="text-[10px] font-bold uppercase tracking-widest text-[#5A5A40]/40 mb-1 block">Custom Audiences (IDs)</label>
                              <input
                                type="text"
                                placeholder="ID1, ID2..."
                                className="w-full bg-[#F5F5F0] border-none rounded-xl py-3 px-4 focus:ring-2 focus:ring-[#5A5A40] outline-none text-sm"
                                value={adSet.customAudiences?.join(', ') || ''}
                                onChange={(e) => updateAdSet(adSet.id, { customAudiences: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                              />
                            </div>
                            <div>
                              <label className="text-[10px] font-bold uppercase tracking-widest text-[#5A5A40]/40 mb-1 block">Excluded Audiences (IDs)</label>
                              <input
                                type="text"
                                placeholder="ID1, ID2..."
                                className="w-full bg-[#F5F5F0] border-none rounded-xl py-3 px-4 focus:ring-2 focus:ring-[#5A5A40] outline-none text-sm"
                                value={adSet.excludedCustomAudiences?.join(', ') || ''}
                                onChange={(e) => updateAdSet(adSet.id, { excludedCustomAudiences: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                              />
                            </div>
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
                            {adSet.ads.map((ad, aIndex) => ad && (
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
                                      value={ad.adName || ''}
                                      onChange={(e) => updateAd(adSet.id, ad.id, { adName: e.target.value })}
                                    />
                                  </div>
                                  <div className="space-y-4">
                                    <div>
                                      <label className="text-[10px] font-bold uppercase tracking-widest text-[#5A5A40]/40 mb-1 block">Headline</label>
                                      <input
                                        type="text"
                                        className="w-full bg-white border-none rounded-xl py-3 px-4 focus:ring-2 focus:ring-[#5A5A40] outline-none text-sm"
                                        value={ad.headline || ''}
                                        onChange={(e) => updateAd(adSet.id, ad.id, { headline: e.target.value })}
                                      />
                                    </div>
                                    <div>
                                      <label className="text-[10px] font-bold uppercase tracking-widest text-[#5A5A40]/40 mb-1 block">Ad Copy</label>
                                      <textarea
                                        className="w-full bg-white border-none rounded-xl py-3 px-4 focus:ring-2 focus:ring-[#5A5A40] outline-none text-sm min-h-[100px]"
                                        value={ad.copy || ''}
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
                                          value={ad.url || ''}
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
                                        onChange={(e) => {
                                          const val = e.target.value;
                                          updateAd(adSet.id, ad.id, { manualAdId: val });
                                        }}
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
                                      <label className="text-[10px] font-bold uppercase tracking-widest text-[#5A5A40]/40 mb-1 block">Thumbnail URL (Auto-download)</label>
                                      <input
                                        type="text"
                                        className="w-full bg-white border-none rounded-xl py-3 px-4 focus:ring-2 focus:ring-[#5A5A40] outline-none text-sm"
                                        value={ad.thumbnail || ''}
                                        onChange={(e) => updateAd(adSet.id, ad.id, { thumbnail: e.target.value })}
                                      />
                                    </div>
                                    <ImageUploader 
                                      label="Manual Thumbnail Upload"
                                      clientId={brief.clientId}
                                      existingHash={ad.manualThumbnailHash}
                                      onUpload={(hash) => updateAd(adSet.id, ad.id, { manualThumbnailHash: hash })}
                                    />
                                    {ad.type === 'video' && (
                                      <div className="col-span-2 space-y-6 mt-4 pt-4 border-t border-black/5">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                          <div className="space-y-4">
                                            <div>
                                              <label className="text-[10px] font-bold uppercase tracking-widest text-[#5A5A40]/40 mb-1 block">Feed Video URL (Auto-download)</label>
                                              <input
                                                type="text"
                                                className="w-full bg-white border-none rounded-xl py-3 px-4 focus:ring-2 focus:ring-[#5A5A40] outline-none text-[10px]"
                                                value={ad.feedVideoUrl || ''}
                                                onChange={(e) => updateAd(adSet.id, ad.id, { feedVideoUrl: e.target.value })}
                                              />
                                            </div>
                                            <VideoUploader 
                                              label="Manual Feed Video Upload"
                                              clientId={brief.clientId}
                                              existingId={ad.manualFeedVideoId}
                                              onUpload={(id) => updateAd(adSet.id, ad.id, { manualFeedVideoId: id })}
                                            />
                                          </div>
                                          <div className="space-y-4">
                                            <div>
                                              <label className="text-[10px] font-bold uppercase tracking-widest text-[#5A5A40]/40 mb-1 block">Vertical Video URL (Auto-download)</label>
                                              <input
                                                type="text"
                                                className="w-full bg-white border-none rounded-xl py-3 px-4 focus:ring-2 focus:ring-[#5A5A40] outline-none text-[10px]"
                                                value={ad.verticalVideoUrl || ''}
                                                onChange={(e) => updateAd(adSet.id, ad.id, { verticalVideoUrl: e.target.value })}
                                              />
                                            </div>
                                            <VideoUploader 
                                              label="Manual Vertical Video Upload"
                                              clientId={brief.clientId}
                                              existingId={ad.manualVerticalVideoId}
                                              onUpload={(id) => updateAd(adSet.id, ad.id, { manualVerticalVideoId: id })}
                                            />
                                          </div>
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
                                                    value={card.imageUrl || ''}
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
                                                    value={card.headline || ''}
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
                                                    value={card.url || ''}
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

      {/* Progress & Status Modal */}
      <AnimatePresence>
        {(isLaunching || logs.length > 0) && (
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
              className="bg-white rounded-[48px] shadow-2xl border border-black/5 max-w-2xl w-full flex flex-col max-h-[90vh] relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-2 bg-[#F5F5F0]">
                {isLaunching && (
                  <motion.div 
                    initial={{ width: "0%" }}
                    animate={{ width: "100%" }}
                    transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                    className="h-full bg-[#5A5A40]"
                  />
                )}
              </div>

              <div className="p-10 border-b border-black/5 flex items-center justify-between">
                <div className="flex items-center gap-5">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${error ? 'bg-red-50 text-red-500' : 'bg-[#5A5A40] text-white'}`}>
                    {isLaunching ? <Loader2 size={28} className="animate-spin" /> : (error ? <AlertCircle size={28} /> : <CheckCircle2 size={28} />)}
                  </div>
                  <div className="text-left">
                    <h2 className="text-2xl font-bold tracking-tight">
                      {isLaunching ? 'Launching Campaign' : (error ? 'Launch Failed' : 'Launch Complete')}
                    </h2>
                    <p className="text-sm text-[#5A5A40]/60 font-medium">
                      {isLaunching ? 'Communicating with Meta Ads API...' : (error ? 'Check the diagnostics below' : 'Campaign is now live (paused)')}
                    </p>
                  </div>
                </div>
                {logs.length > 0 && (
                  <button 
                    onClick={copyLogsToClipboard}
                    className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest bg-[#F5F5F0] border border-black/5 px-4 py-2.5 rounded-xl hover:bg-white hover:shadow-sm transition-all"
                  >
                    <Copy size={12} /> Copy Logs
                  </button>
                )}
              </div>

              <div className="flex-1 overflow-y-auto p-10 space-y-4 bg-[#F5F5F0]/30 text-left">
                {isLaunching && (
                  <div className="bg-white rounded-3xl p-8 mb-8 shadow-sm border border-black/5">
                    <div className="flex items-center gap-2 mb-3">
                      <Sparkles size={14} className="text-[#5A5A40]" />
                      <span className="text-[10px] font-bold uppercase tracking-widest text-[#5A5A40]">Film Trivia</span>
                    </div>
                    <AnimatePresence mode="wait">
                      <motion.p 
                        key={triviaIndex}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="text-lg font-medium text-[#141414] italic serif"
                      >
                        "{shuffledTrivia[triviaIndex] || FILM_TRIVIA[0]}"
                      </motion.p>
                    </AnimatePresence>
                  </div>
                )}

                <div className="space-y-2">
                  <h3 className="text-[10px] font-bold uppercase tracking-widest text-[#5A5A40]/40 mb-4">Execution Logs</h3>
                  {logs.map((log, i) => (
                    <motion.div 
                      key={i}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="flex gap-4 text-sm"
                    >
                      <span className="text-[#5A5A40]/30 font-mono text-[10px] mt-1 w-4">{i + 1}</span>
                      <span className={`font-medium leading-relaxed ${log.toLowerCase().includes('error') || log.toLowerCase().includes('failed') ? 'text-red-500' : 'text-[#5A5A40]'}`}>
                        {log}
                      </span>
                    </motion.div>
                  ))}
                  {error && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-8 p-8 bg-red-50 rounded-[32px] border border-red-100"
                    >
                      <div className="flex items-start gap-4 text-red-600">
                        <AlertCircle size={20} className="mt-1 flex-shrink-0" />
                        <div>
                          <p className="font-bold text-xs uppercase tracking-widest mb-2">Diagnostic Error Information</p>
                          <p className="text-sm font-medium leading-relaxed whitespace-pre-wrap">{error}</p>
                        </div>
                      </div>
                    </motion.div>
                  )}
                  <div ref={logEndRef} />
                </div>
              </div>

              <div className="p-8 border-t border-black/5 bg-white flex justify-end">
                <button 
                  onClick={() => {
                    if (!isLaunching) {
                      setLogs([]);
                      setError(null);
                      setSuccess(null);
                    }
                  }}
                  disabled={isLaunching}
                  className="bg-[#141414] text-white px-12 py-5 rounded-2xl font-bold uppercase tracking-widest text-xs shadow-lg shadow-black/10 hover:bg-black transition-all disabled:opacity-50"
                >
                  {isLaunching ? 'Processing...' : 'Close Diagnostics'}
                </button>
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
