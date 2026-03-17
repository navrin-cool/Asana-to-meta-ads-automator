import React, { useState } from 'react';
import { Trash2, Link as LinkIcon, Video, Image as ImageIcon, Layers } from 'lucide-react';

interface BulkAdGeneratorProps {
  clientId: string;
  onGenerateAds: (ads: any[]) => void;
}

type GenerationMode = 'video' | 'image' | 'carousel';

export default function BulkAdGenerator({ clientId, onGenerateAds }: BulkAdGeneratorProps) {
  const [mode, setMode] = useState<GenerationMode>('video');
  const [globalUrl, setGlobalUrl] = useState('');
  const [globalCta, setGlobalCta] = useState('BOOK_NOW');
  const [adNamePrefix, setAdNamePrefix] = useState('');
  const [carouselDescription, setCarouselDescription] = useState('');
  const [copies, setCopies] = useState<string[]>(['']);
  const [headlines, setHeadlines] = useState<string[]>(['']);
  
  // URL States
  const [feedUrls, setFeedUrls] = useState('');
  const [verticalUrls, setVerticalUrls] = useState('');
  const [thumbnailUrls, setThumbnailUrls] = useState('');
  const [imageUrls, setImageUrls] = useState('');

  const handleUrlPaste = (e: React.ClipboardEvent<HTMLTextAreaElement>, setter: (val: string) => void, currentVal: string) => {
    const pastedText = e.clipboardData.getData('text');
    if (pastedText.trim().startsWith('http')) {
      e.preventDefault();
      const target = e.target as HTMLTextAreaElement;
      const start = target.selectionStart;
      const end = target.selectionEnd;
      
      const textToInsert = pastedText.trim() + '\n';
      const newValue = currentVal.substring(0, start) + textToInsert + currentVal.substring(end);
      setter(newValue);
      
      // Set cursor position after insertion
      setTimeout(() => {
        target.selectionStart = target.selectionEnd = start + textToInsert.length;
      }, 0);
    }
  };

  const handleGenerate = () => {
    const validCopies = copies.filter(c => c.trim() !== '');
    const fallbackCopy = validCopies.length > 0 ? validCopies[0] : '';

    const validHeadlines = headlines.filter(h => h.trim() !== '');
    const fallbackHeadline = validHeadlines.length > 0 ? validHeadlines[0] : 'Default Headline';
    
    const parseUrls = (text: string) => text.split('\n').map(u => u.trim()).filter(u => u !== '');
    
    let newAds: any[] = [];

    if (mode === 'video') {
      const feeds = parseUrls(feedUrls);
      const verticals = parseUrls(verticalUrls);
      const thumbnails = parseUrls(thumbnailUrls);
      
      if (feeds.length === 0) return;

      newAds = feeds.map((feedUrl, index) => {
        const adCopy = validCopies.length > 0 ? (validCopies.length === 1 ? validCopies[0] : validCopies[index % validCopies.length]) : fallbackCopy;
        const adHeadline = validHeadlines.length > 0 ? (validHeadlines.length === 1 ? validHeadlines[0] : validHeadlines[index % validHeadlines.length]) : fallbackHeadline;
        const vUrl = verticals.length > 0 ? (verticals.length === 1 ? verticals[0] : verticals[index] || '') : '';
        const tUrl = thumbnails.length > 0 ? (thumbnails.length === 1 ? thumbnails[0] : thumbnails[index] || '') : '';

        return {
          id: Math.random().toString(36).substr(2, 9),
          type: 'video',
          adName: adNamePrefix ? `${adNamePrefix} ${index + 1}` : `Bulk Video Ad - ${index + 1}`,
          headline: adHeadline,
          copy: adCopy,
          url: globalUrl,
          ctaType: globalCta,
          thumbnail: tUrl,
          feedVideoUrl: feedUrl,
          verticalVideoUrl: vUrl,
          customUrlParams: "utm_source=facebook-instagram&utm_medium=gruvi-cpc&utm_campaign={{campaign.name}}&utm_content={{ad.name}}&utm_term={{adset.name}}&campaign_id={{campaign.id}}&adset_id={{adset.id}}&ad_id={{ad.id}}"
        };
      });
    } else if (mode === 'image') {
      const images = parseUrls(imageUrls);
      if (images.length === 0) return;

      newAds = images.map((imageUrl, index) => {
        const adCopy = validCopies.length > 0 ? (validCopies.length === 1 ? validCopies[0] : validCopies[index % validCopies.length]) : fallbackCopy;
        const adHeadline = validHeadlines.length > 0 ? (validHeadlines.length === 1 ? validHeadlines[0] : validHeadlines[index % validHeadlines.length]) : fallbackHeadline;
        return {
          id: Math.random().toString(36).substr(2, 9),
          type: 'image',
          adName: adNamePrefix ? `${adNamePrefix} ${index + 1}` : `Bulk Image Ad - ${index + 1}`,
          headline: adHeadline,
          copy: adCopy,
          url: globalUrl,
          ctaType: globalCta,
          thumbnail: imageUrl,
          customUrlParams: "utm_source=facebook-instagram&utm_medium=gruvi-cpc&utm_campaign={{campaign.name}}&utm_content={{ad.name}}&utm_term={{adset.name}}&campaign_id={{campaign.id}}&adset_id={{adset.id}}&ad_id={{ad.id}}"
        };
      });
    } else if (mode === 'carousel') {
      const images = parseUrls(imageUrls);
      if (images.length === 0) return;

      const adCopy = validCopies.length > 0 ? validCopies[0] : fallbackCopy;
      const adHeadline = validHeadlines.length > 0 ? validHeadlines[0] : fallbackHeadline;
      
      // Create ONE carousel ad with multiple cards
      newAds = [{
        id: Math.random().toString(36).substr(2, 9),
        type: 'carousel',
        adName: adNamePrefix || `Bulk Carousel Ad`,
        headline: adHeadline,
        copy: adCopy,
        url: globalUrl,
        ctaType: globalCta,
        customUrlParams: "utm_source=facebook-instagram&utm_medium=gruvi-cpc&utm_campaign={{campaign.name}}&utm_content={{ad.name}}&utm_term={{adset.name}}&campaign_id={{campaign.id}}&adset_id={{adset.id}}&ad_id={{ad.id}}",
        carouselCards: images.map((img, idx) => ({
          id: Math.random().toString(36).substr(2, 9),
          imageUrl: img,
          headline: adHeadline, // FIXED: Maps the user's inputted headline to the cards
          description: carouselDescription,
          url: globalUrl
        }))
      }];
    }

    onGenerateAds(newAds);
    // Note: URL pools intentionally left populated so the user can generate more variations
  };

  const isGeneratingDisabled = !globalUrl || (mode === 'video' && !feedUrls.trim()) || (mode !== 'video' && !imageUrls.trim());

  return (
    <div className="bg-[#5A5A40]/5 rounded-2xl p-6 border border-[#5A5A40]/10 mb-8">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-sm font-bold uppercase tracking-widest text-[#5A5A40] flex items-center gap-2">
          <LinkIcon size={16} /> URL Bulk Generator
        </h3>
        <div className="flex bg-white rounded-lg p-1 border border-black/5 shadow-sm">
          <button onClick={() => setMode('video')} className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest rounded-md flex items-center gap-1 transition-all ${mode === 'video' ? 'bg-[#5A5A40] text-white' : 'text-[#5A5A40]/60 hover:bg-[#F5F5F0]'}`}>
            <Video size={12} /> Video
          </button>
          <button onClick={() => setMode('image')} className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest rounded-md flex items-center gap-1 transition-all ${mode === 'image' ? 'bg-[#5A5A40] text-white' : 'text-[#5A5A40]/60 hover:bg-[#F5F5F0]'}`}>
            <ImageIcon size={12} /> Images
          </button>
          <button onClick={() => setMode('carousel')} className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest rounded-md flex items-center gap-1 transition-all ${mode === 'carousel' ? 'bg-[#5A5A40] text-white' : 'text-[#5A5A40]/60 hover:bg-[#F5F5F0]'}`}>
            <Layers size={12} /> Carousel
          </button>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Left Column: Global Settings & Copy */}
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-[#5A5A40]/60 mb-1 block">Ad Name Prefix</label>
              <input
                type="text"
                className="w-full bg-white border border-black/5 rounded-xl py-3 px-4 focus:ring-2 focus:ring-[#5A5A40] outline-none text-sm"
                value={adNamePrefix}
                onChange={e => setAdNamePrefix(e.target.value)}
                placeholder="e.g. Now Showing"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-[#5A5A40]/60 mb-1 block">Global Call to Action</label>
              <select
                className="w-full bg-white border border-black/5 rounded-xl py-3 px-4 focus:ring-2 focus:ring-[#5A5A40] outline-none text-sm appearance-none"
                value={globalCta}
                onChange={e => setGlobalCta(e.target.value)}
              >
                <option value="BOOK_NOW">Book Now</option>
                <option value="LEARN_MORE">Learn More</option>
                <option value="SHOP_NOW">Shop Now</option>
                <option value="GET_SHOWTIMES">Get Showtimes</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-[#5A5A40]/60 mb-1 block">Global Destination URL</label>
            <input
              type="text"
              className="w-full bg-white border border-black/5 rounded-xl py-3 px-4 focus:ring-2 focus:ring-[#5A5A40] outline-none text-sm"
              value={globalUrl}
              onChange={e => setGlobalUrl(e.target.value)}
              placeholder="https://..."
            />
          </div>
          {mode === 'carousel' && (
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-[#5A5A40]/60 mb-1 block">Carousel Card Description</label>
              <input
                type="text"
                className="w-full bg-white border border-black/5 rounded-xl py-3 px-4 focus:ring-2 focus:ring-[#5A5A40] outline-none text-sm"
                value={carouselDescription}
                onChange={e => setCarouselDescription(e.target.value)}
                placeholder="Description for all cards..."
              />
            </div>
          )}
          
          <div className="pt-2">
            <div className="flex items-center justify-between mb-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-[#5A5A40]/60 block">Headlines (Rotates)</label>
              <button onClick={() => setHeadlines([...headlines, ''])} className="text-[10px] font-bold uppercase text-[#5A5A40] hover:underline">+ Add Variation</button>
            </div>
            <div className="space-y-2 max-h-[150px] overflow-y-auto pr-1 mb-4">
              {headlines.map((headline, idx) => (
                <div key={idx} className="relative">
                  <input
                    type="text"
                    className="w-full bg-white border border-black/5 rounded-xl py-2 px-3 text-sm pr-8"
                    value={headline}
                    onChange={e => {
                      const newH = [...headlines];
                      newH[idx] = e.target.value;
                      setHeadlines(newH);
                    }}
                    placeholder={`Headline variation ${idx + 1}...`}
                  />
                  {headlines.length > 1 && (
                    <button onClick={() => setHeadlines(headlines.filter((_, i) => i !== idx))} className="absolute top-2 right-2 text-red-400 hover:text-red-600">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between mb-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-[#5A5A40]/60 block">Ad Copies (Rotates)</label>
              <button onClick={() => setCopies([...copies, ''])} className="text-[10px] font-bold uppercase text-[#5A5A40] hover:underline">+ Add Variation</button>
            </div>
            <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
              {copies.map((copy, idx) => (
                <div key={idx} className="relative">
                  <textarea
                    className="w-full bg-white border border-black/5 rounded-xl py-2 px-3 text-sm min-h-[60px] pr-8"
                    value={copy}
                    onChange={e => {
                      const newC = [...copies];
                      newC[idx] = e.target.value;
                      setCopies(newC);
                    }}
                    placeholder={`Ad copy variation ${idx + 1}...`}
                  />
                  {copies.length > 1 && (
                    <button onClick={() => setCopies(copies.filter((_, i) => i !== idx))} className="absolute top-2 right-2 text-red-400 hover:text-red-600">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Asset Links */}
        <div className="space-y-4">
          <div className="bg-blue-50/50 p-3 rounded-xl border border-blue-100 mb-2">
            <p className="text-[10px] text-blue-800 font-medium">
              Paste Dropbox or Google Drive links (one per line). Ensure links are set to "Anyone with the link can view".
            </p>
          </div>

          {mode === 'video' ? (
            <>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-[#5A5A40]/60 mb-1 block">Feed Video URLs (One per line)</label>
                <textarea
                  className="w-full bg-white border border-black/5 rounded-xl py-3 px-4 text-[10px] font-mono whitespace-pre min-h-[120px] focus:ring-2 focus:ring-[#5A5A40] outline-none"
                  value={feedUrls}
                  onChange={e => setFeedUrls(e.target.value)}
                  onPaste={e => handleUrlPaste(e, setFeedUrls, feedUrls)}
                  placeholder="https://drive.google.com/..."
                />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-[#5A5A40]/60 mb-1 block">Vertical Video URLs (Pairs by line)</label>
                <textarea
                  className="w-full bg-white border border-black/5 rounded-xl py-3 px-4 text-[10px] font-mono whitespace-pre min-h-[100px] focus:ring-2 focus:ring-[#5A5A40] outline-none"
                  value={verticalUrls}
                  onChange={e => setVerticalUrls(e.target.value)}
                  onPaste={e => handleUrlPaste(e, setVerticalUrls, verticalUrls)}
                  placeholder="https://drive.google.com/..."
                />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-[#5A5A40]/60 mb-1 block">Thumbnail URLs (Pairs by line)</label>
                <textarea
                  className="w-full bg-white border border-black/5 rounded-xl py-3 px-4 text-[10px] font-mono whitespace-pre min-h-[100px] focus:ring-2 focus:ring-[#5A5A40] outline-none"
                  value={thumbnailUrls}
                  onChange={e => setThumbnailUrls(e.target.value)}
                  onPaste={e => handleUrlPaste(e, setThumbnailUrls, thumbnailUrls)}
                  placeholder="https://drive.google.com/..."
                />
              </div>
            </>
          ) : (
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-[#5A5A40]/60 mb-1 block">Image URLs (One per line)</label>
              <textarea
                className="w-full bg-white border border-black/5 rounded-xl py-3 px-4 text-[10px] font-mono whitespace-pre min-h-[260px] focus:ring-2 focus:ring-[#5A5A40] outline-none"
                value={imageUrls}
                onChange={e => setImageUrls(e.target.value)}
                onPaste={e => handleUrlPaste(e, setImageUrls, imageUrls)}
                placeholder="https://dropbox.com/..."
              />
              {mode === 'carousel' && (
                <p className="text-[10px] text-[#5A5A40]/60 mt-2 italic">
                  Note: This will generate a single Ad with multiple carousel cards.
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t border-[#5A5A40]/10">
        <button
          onClick={() => {
            setFeedUrls('');
            setVerticalUrls('');
            setThumbnailUrls('');
            setImageUrls('');
          }}
          className="px-6 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest text-[#5A5A40]/60 hover:bg-[#F5F5F0] hover:text-[#5A5A40] transition-colors"
        >
          Clear URLs
        </button>
        <button
          onClick={handleGenerate}
          disabled={isGeneratingDisabled}
          className="bg-[#5A5A40] text-white px-6 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#4A4A30] transition-colors shadow-md"
        >
          Generate {mode === 'carousel' ? 'Carousel Ad' : 'Ads'} into Segment
        </button>
      </div>
    </div>
  );
}
