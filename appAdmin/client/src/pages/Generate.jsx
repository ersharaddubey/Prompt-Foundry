import { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Sparkles, Image as ImageIcon, Wand2, Upload, X, Zap, Download, Crown, Lock,
  Layers, Shuffle, Sliders, Shield, Mic, History, Swords, Trophy, RefreshCw,
  Grid, ArrowRightLeft, Type,
} from 'lucide-react';
import Navbar from '../components/Navbar';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';

const MODELS = [
  { id: 'flux', name: 'Flux 2 Klein', credits: 2, type: 'Basic' },
  { id: 'gpt-image', name: 'GPT Image 2', credits: 8, type: 'Premium' },
  { id: 'seedream', name: 'Seedream 5.0', credits: 10, type: 'Premium' },
  { id: 'midjourney', name: 'Midjourney', credits: 12, type: 'Premium' },
];

const RATIOS = ['1:1', '3:4', '4:3', '9:16', '16:9'];

const MODES = [
  { id: 'single', label: 'Single', icon: Wand2 },
  { id: 'batch', label: 'Batch ×4', icon: Grid },
  { id: 'remix', label: 'Remix ×5', icon: Shuffle },
  { id: 'compare', label: 'Compare', icon: Layers },
  { id: 'style', label: 'Style Transfer', icon: ArrowRightLeft },
  { id: 'reverse', label: 'Image→Prompt', icon: Type },
];

export default function Generate() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, updateUser } = useAuth();
  const fileInputRef = useRef(null);
  const styleInputRef = useRef(null);
  const reverseInputRef = useRef(null);

  const [mode, setMode] = useState('single');
  const [prompt, setPrompt] = useState(location.state?.prompt || '');
  const [negative, setNegative] = useState('');
  const [model, setModel] = useState('flux');
  const [ratio, setRatio] = useState('3:4');
  const [strength, setStrength] = useState(7);
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState(null);
  const [multiResults, setMultiResults] = useState([]);
  const [error, setError] = useState('');
  const [fromCache, setFromCache] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [uploadedImage, setUploadedImage] = useState(null);
  const [styleImage, setStyleImage] = useState(null);
  const [reverseImage, setReverseImage] = useState(null);
  const [reversePrompts, setReversePrompts] = useState([]);
  const [negativePresets, setNegativePresets] = useState([]);
  const [safety, setSafety] = useState(null);
  const [enhancing, setEnhancing] = useState(false);
  const [listening, setListening] = useState(false);
  const [creditEstimate, setCreditEstimate] = useState(2);
  const [referenceImage] = useState(location.state?.image || null);

  const selectedModel = MODELS.find((m) => m.id === model);
  const isPremium = (user?.credits || 0) > 0;

  useEffect(() => {
    api.get('/features/negative-presets').then((r) => setNegativePresets(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!prompt.trim()) return;
    const t = setTimeout(() => {
      api.post('/features/estimate-credits', { prompt, mode }).then((r) => {
        setCreditEstimate(r.data.estimated);
      }).catch(() => {});
      api.post('/features/safety-score', { prompt }).then((r) => setSafety(r.data)).catch(() => {});
    }, 400);
    return () => clearTimeout(t);
  }, [prompt, mode]);

  const handleFile = (e, setter) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) return setError('Image only');
    if (file.size > 10 * 1024 * 1024) return setError('Max 10MB');
    setter({ preview: URL.createObjectURL(file), file });
    setError('');
  };

  const enhancePrompt = async () => {
    if (!prompt.trim()) return;
    setEnhancing(true);
    try {
      const { data } = await api.post('/features/enhance-prompt', { prompt });
      setPrompt(data.enhanced);
      setSafety({ score: data.safetyScore, label: data.safetyLabel, color: data.safetyScore >= 80 ? 'green' : data.safetyScore >= 50 ? 'yellow' : 'red' });
    } catch (e) {
      setError(e.response?.data?.message || 'Enhance failed');
    } finally {
      setEnhancing(false);
    }
  };

  const startVoice = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      setError('Voice not supported in this browser');
      return;
    }
    const rec = new SR();
    rec.lang = 'en-US';
    rec.interimResults = false;
    rec.onstart = () => setListening(true);
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    rec.onresult = (ev) => {
      const text = ev.results[0][0].transcript;
      setPrompt((p) => (p ? p + ' ' + text : text));
    };
    rec.start();
  };

  const handleGenerate = async () => {
    if (!user) return navigate('/login');
    setError('');
    setResult(null);
    setMultiResults([]);
    setReversePrompts([]);
    setFromCache(false);
    setGenerating(true);

    try {
      if (mode === 'single') {
        if (!prompt.trim()) throw new Error('Enter a prompt');
        const formData = new FormData();
        formData.append('prompt', negative ? `${prompt.trim()}. Avoid: ${negative}` : prompt.trim());
        formData.append('model', model);
        formData.append('ratio', ratio);
        formData.append('amount', selectedModel?.credits || 2);
        if (uploadedImage?.file) formData.append('image', uploadedImage.file);
        const { data } = await api.post('/generate', formData);
        if (data.credits) updateUser({ credits: data.credits.credits, dailyCredits: data.credits.dailyCredits });
        setResult({ imageUrl: data.imageUrl, prompt: data.prompt, model: selectedModel?.name, sourceImageUrl: data.sourceImageUrl, id: data.id });
        setFromCache(!!data.fromCache);
      } else if (mode === 'batch') {
        const { data } = await api.post('/features/batch', { prompt, ratio, model, negative, strength });
        if (data.credits) updateUser(data.credits);
        setMultiResults(data.results.map((r) => ({ ...r, label: `Seed ${r.seed}` })));
      } else if (mode === 'remix') {
        const { data } = await api.post('/features/remix', { prompt, ratio });
        if (data.credits) updateUser(data.credits);
        setMultiResults(data.results.map((r) => ({ ...r, label: r.style })));
      } else if (mode === 'compare') {
        const { data } = await api.post('/features/compare', { prompt, ratio });
        if (data.credits) updateUser(data.credits);
        setMultiResults(data.results.map((r) => ({ ...r, label: r.model })));
      } else if (mode === 'style') {
        if (!styleImage?.file) throw new Error('Upload a reference image');
        const fd = new FormData();
        fd.append('prompt', prompt.trim());
        fd.append('ratio', ratio);
        fd.append('strength', strength);
        fd.append('image', styleImage.file);
        const { data } = await api.post('/features/style-transfer', fd);
        if (data.credits) updateUser(data.credits);
        setResult({ imageUrl: data.imageUrl, prompt: data.prompt, model: 'Style Transfer', sourceImageUrl: data.sourceImageUrl, id: data.id });
      } else if (mode === 'reverse') {
        if (!reverseImage?.file) throw new Error('Upload an image');
        const fd = new FormData();
        fd.append('image', reverseImage.file);
        fd.append('hint', prompt || '');
        const { data } = await api.post('/features/image-to-prompt', fd);
        setReversePrompts(data.prompts || []);
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed');
    } finally {
      setGenerating(false);
    }
  };

  const applyWatermark = (img) =>
    new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth || img.width;
      canvas.height = img.naturalHeight || img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      const text = 'Somyalaya · Free';
      const fontSize = Math.max(18, Math.floor(canvas.width / 28));
      ctx.font = `600 ${fontSize}px Inter, system-ui, sans-serif`;
      ctx.fillStyle = 'rgba(255,255,255,0.22)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.save();
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((-28 * Math.PI) / 180);
      const stepX = fontSize * 9;
      const stepY = fontSize * 5;
      for (let y = -canvas.height; y < canvas.height * 2; y += stepY) {
        for (let x = -canvas.width; x < canvas.width * 2; x += stepX) {
          ctx.fillText(text, x, y);
        }
      }
      ctx.restore();
      canvas.toBlob((b) => resolve(b), 'image/png', 0.95);
    });

  const handleDownload = async (imageUrl, wantClean) => {
    if (!imageUrl) return;
    if (wantClean && !isPremium) return navigate('/pricing');
    setDownloading(true);
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      await new Promise((res, rej) => {
        img.onload = res;
        img.onerror = rej;
        img.src = imageUrl + (imageUrl.includes('?') ? '&' : '?') + 't=' + Date.now();
      });
      let blob;
      if (isPremium) {
        const c = document.createElement('canvas');
        c.width = img.naturalWidth || img.width;
        c.height = img.naturalHeight || img.height;
        c.getContext('2d').drawImage(img, 0, 0);
        blob = await new Promise((r) => c.toBlob(r, 'image/png', 1));
      } else {
        blob = await applyWatermark(img);
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `somyalaya-${isPremium ? 'premium' : 'free'}-${Date.now()}.png`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      window.open(imageUrl, '_blank');
    } finally {
      setDownloading(false);
    }
  };

  const safetyColor =
    safety?.color === 'green' ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10' :
    safety?.color === 'yellow' ? 'text-amber-400 border-amber-500/30 bg-amber-500/10' :
    safety?.color === 'red' ? 'text-red-400 border-red-500/30 bg-red-500/10' : '';

  return (
    <div className="min-h-screen bg-dark-900">
      <Navbar />
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Sparkles className="text-violet-400" /> Generate Image
          </h1>
          <div className="flex gap-2">
            <button onClick={() => navigate('/history')} className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg bg-dark-700 border border-dark-500 hover:border-violet-500 text-gray-300">
              <History size={15} /> History
            </button>
            <button onClick={() => navigate('/challenge')} className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg bg-dark-700 border border-dark-500 hover:border-violet-500 text-gray-300">
              <Trophy size={15} /> Challenge
            </button>
            <button onClick={() => navigate('/battle')} className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg bg-dark-700 border border-dark-500 hover:border-violet-500 text-gray-300">
              <Swords size={15} /> Battle
            </button>
          </div>
        </div>

        {/* Mode tabs */}
        <div className="flex flex-wrap gap-2 mb-6">
          {MODES.map((m) => {
            const Icon = m.icon;
            return (
              <button
                key={m.id}
                onClick={() => { setMode(m.id); setResult(null); setMultiResults([]); setError(''); }}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm transition border ${
                  mode === m.id
                    ? 'border-violet-500 bg-violet-500/15 text-violet-300'
                    : 'border-dark-500 bg-dark-800 text-gray-400 hover:border-dark-400'
                }`}
              >
                <Icon size={15} /> {m.label}
              </button>
            );
          })}
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Left */}
          <div className="space-y-5">
            {/* Prompt */}
            {(mode !== 'reverse') && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-sm text-gray-400">Prompt</label>
                  <div className="flex gap-2">
                    <button type="button" onClick={startVoice} className={`text-xs flex items-center gap-1 px-2 py-1 rounded-lg border ${listening ? 'border-red-500 text-red-400 animate-pulse' : 'border-dark-500 text-gray-400 hover:border-violet-500'}`}>
                      <Mic size={12} /> {listening ? 'Listening…' : 'Voice'}
                    </button>
                    <button type="button" onClick={enhancePrompt} disabled={enhancing || !prompt.trim()} className="text-xs flex items-center gap-1 px-2 py-1 rounded-lg border border-dark-500 text-gray-400 hover:border-violet-500 disabled:opacity-50">
                      <Sparkles size={12} /> {enhancing ? 'Enhancing…' : 'AI Enhance'}
                    </button>
                  </div>
                </div>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  rows={4}
                  placeholder="Describe the image you want..."
                  className="w-full bg-dark-700 border border-dark-500 rounded-xl p-4 text-sm focus:outline-none focus:border-violet-500 resize-none"
                />
                {safety && (
                  <div className={`mt-2 flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg border ${safetyColor}`}>
                    <Shield size={13} /> Safety: {safety.score}/100 · {safety.label}
                  </div>
                )}
              </div>
            )}

            {/* Negative prompts */}
            {(mode === 'single' || mode === 'batch') && (
              <div>
                <label className="text-sm text-gray-400 mb-1.5 block">Negative Prompt</label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {negativePresets.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setNegative(p.text)}
                      className="text-[11px] px-2.5 py-1 rounded-full bg-dark-700 border border-dark-500 text-gray-400 hover:border-violet-500 hover:text-violet-300"
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
                <input
                  value={negative}
                  onChange={(e) => setNegative(e.target.value)}
                  placeholder="Things to avoid..."
                  className="w-full bg-dark-700 border border-dark-500 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-violet-500"
                />
              </div>
            )}

            {/* Strength slider */}
            {(mode === 'single' || mode === 'batch' || mode === 'style') && (
              <div>
                <label className="text-sm text-gray-400 mb-1.5 flex items-center gap-2">
                  <Sliders size={14} /> Prompt Strength: <span className="text-violet-400 font-medium">{strength}/10</span>
                </label>
                <input
                  type="range"
                  min={1}
                  max={10}
                  value={strength}
                  onChange={(e) => setStrength(+e.target.value)}
                  className="w-full accent-violet-500"
                />
                <p className="text-[11px] text-gray-500 mt-1">Low = creative freedom · High = strict prompt follow</p>
              </div>
            )}

            {/* Upload for single */}
            {mode === 'single' && (
              <div>
                <label className="text-sm text-gray-400 mb-1.5 block">Reference image (optional)</label>
                {!uploadedImage ? (
                  <button type="button" onClick={() => fileInputRef.current?.click()} className="w-full border-2 border-dashed border-dark-500 hover:border-violet-500 rounded-xl p-5 flex flex-col items-center gap-2 text-gray-400 hover:text-violet-400 transition">
                    <Upload size={24} /><span className="text-sm">Upload image</span>
                  </button>
                ) : (
                  <div className="relative rounded-xl overflow-hidden border border-dark-500">
                    <img src={uploadedImage.preview} alt="" className="w-full max-h-40 object-contain bg-dark-800" />
                    <button onClick={() => setUploadedImage(null)} className="absolute top-2 right-2 bg-black/70 p-1.5 rounded-full"><X size={14} /></button>
                  </div>
                )}
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleFile(e, setUploadedImage)} />
              </div>
            )}

            {/* Style transfer upload */}
            {mode === 'style' && (
              <div>
                <label className="text-sm text-gray-400 mb-1.5 block">Style reference image *</label>
                {!styleImage ? (
                  <button type="button" onClick={() => styleInputRef.current?.click()} className="w-full border-2 border-dashed border-dark-500 hover:border-violet-500 rounded-xl p-5 flex flex-col items-center gap-2 text-gray-400 hover:text-violet-400">
                    <Upload size={24} /><span className="text-sm">Upload style photo</span>
                  </button>
                ) : (
                  <div className="relative rounded-xl overflow-hidden border border-dark-500">
                    <img src={styleImage.preview} alt="" className="w-full max-h-40 object-contain bg-dark-800" />
                    <button onClick={() => setStyleImage(null)} className="absolute top-2 right-2 bg-black/70 p-1.5 rounded-full"><X size={14} /></button>
                  </div>
                )}
                <input ref={styleInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleFile(e, setStyleImage)} />
              </div>
            )}

            {/* Reverse image upload */}
            {mode === 'reverse' && (
              <div>
                <label className="text-sm text-gray-400 mb-1.5 block">Image to reverse-engineer *</label>
                {!reverseImage ? (
                  <button type="button" onClick={() => reverseInputRef.current?.click()} className="w-full border-2 border-dashed border-dark-500 hover:border-violet-500 rounded-xl p-8 flex flex-col items-center gap-2 text-gray-400 hover:text-violet-400">
                    <Type size={28} /><span className="text-sm">Upload image → get prompts</span>
                  </button>
                ) : (
                  <div className="relative rounded-xl overflow-hidden border border-dark-500">
                    <img src={reverseImage.preview} alt="" className="w-full max-h-48 object-contain bg-dark-800" />
                    <button onClick={() => setReverseImage(null)} className="absolute top-2 right-2 bg-black/70 p-1.5 rounded-full"><X size={14} /></button>
                  </div>
                )}
                <input ref={reverseInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleFile(e, setReverseImage)} />
                <p className="text-xs text-gray-500 mt-2">Optional: add a short hint in the prompt box above for better results.</p>
                <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={2} placeholder="Optional hint (e.g. portrait, landscape)..." className="w-full mt-2 bg-dark-700 border border-dark-500 rounded-xl p-3 text-sm focus:outline-none focus:border-violet-500 resize-none" />
              </div>
            )}

            {referenceImage && mode === 'single' && !uploadedImage && (
              <div>
                <label className="text-sm text-gray-400 mb-1.5 block">Reference (from idea)</label>
                <img src={referenceImage} alt="" className="w-full max-h-36 object-contain rounded-xl border border-dark-500 bg-dark-800" />
              </div>
            )}

            {/* Model + Ratio for relevant modes */}
            {(mode === 'single' || mode === 'batch') && (
              <>
                <div>
                  <label className="text-sm text-gray-400 mb-1.5 block">Model</label>
                  <div className="grid grid-cols-2 gap-2">
                    {MODELS.map((m) => (
                      <button key={m.id} onClick={() => setModel(m.id)} className={`p-3 rounded-xl border text-left transition ${model === m.id ? 'border-violet-500 bg-violet-500/10' : 'border-dark-500 bg-dark-700 hover:border-dark-400'}`}>
                        <p className="text-sm font-medium">{m.name}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{m.credits} credits · {m.type}</p>
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            {mode !== 'reverse' && (
              <div>
                <label className="text-sm text-gray-400 mb-1.5 block">Aspect Ratio</label>
                <div className="flex gap-2 flex-wrap">
                  {RATIOS.map((r) => (
                    <button key={r} onClick={() => setRatio(r)} className={`px-4 py-2 rounded-lg text-sm transition ${ratio === r ? 'bg-violet-600 text-white' : 'bg-dark-700 text-gray-300 hover:bg-dark-600'}`}>{r}</button>
                  ))}
                </div>
              </div>
            )}

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm px-4 py-3 rounded-xl">{error}</div>
            )}

            <button
              onClick={handleGenerate}
              disabled={generating}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 disabled:opacity-60 text-white font-medium py-3.5 rounded-xl transition"
            >
              {generating ? (
                <><div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> Working…</>
              ) : (
                <><Wand2 size={18} /> {mode === 'reverse' ? 'Extract Prompts' : `Generate · ~${creditEstimate} credits`}</>
              )}
            </button>
            <p className="text-[11px] text-center text-gray-500">Smart credits: longer / complex prompts cost more</p>
          </div>

          {/* Right - Results */}
          <div className="bg-dark-800 border border-dark-600 rounded-2xl p-6 flex flex-col min-h-[420px]">
            {generating ? (
              <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
                <div className="w-12 h-12 border-4 border-violet-500 border-t-transparent rounded-full animate-spin mb-4" />
                <p>Creating magic…</p>
                <p className="text-xs text-gray-500 mt-1">May take a few seconds</p>
              </div>
            ) : multiResults.length > 0 ? (
              <div className="w-full">
                <p className="text-sm text-gray-400 mb-3">{multiResults.length} results</p>
                <div className="grid grid-cols-2 gap-3">
                  {multiResults.map((r, i) => (
                    <div key={i} className="rounded-xl overflow-hidden border border-dark-500 bg-dark-900">
                      <img src={r.imageUrl} alt="" className="w-full aspect-square object-cover" />
                      <div className="p-2 flex items-center justify-between gap-1">
                        <span className="text-[11px] text-gray-400 truncate capitalize">{r.label}</span>
                        <button onClick={() => handleDownload(r.imageUrl, true)} className="text-violet-400 hover:text-violet-300"><Download size={14} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : reversePrompts.length > 0 ? (
              <div className="w-full space-y-3">
                <p className="text-sm text-gray-300 font-medium">Suggested prompts</p>
                {reversePrompts.map((p, i) => (
                  <div key={i} className="bg-dark-700 border border-dark-500 rounded-xl p-3">
                    <p className="text-sm text-gray-200 mb-2">{p}</p>
                    <button
                      onClick={() => { setPrompt(p); setMode('single'); setReversePrompts([]); }}
                      className="text-xs text-violet-400 hover:text-violet-300 flex items-center gap-1"
                    >
                      <Wand2 size={12} /> Use this prompt
                    </button>
                  </div>
                ))}
              </div>
            ) : result ? (
              <div className="w-full">
                {fromCache && (
                  <div className="mb-3 flex items-center justify-center gap-1.5 text-emerald-400 text-xs font-medium bg-emerald-500/10 border border-emerald-500/30 rounded-lg py-1.5">
                    <Zap size={14} /> Instant from cache
                  </div>
                )}
                <div className="relative rounded-xl overflow-hidden shadow-2xl">
                  <img src={result.imageUrl} alt="Generated" className="w-full" />
                  {!isPremium && (
                    <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-black/60 backdrop-blur-sm border border-white/10 text-white/90 text-[11px] font-medium px-2.5 py-1 rounded-full">
                      <Lock size={12} className="text-amber-300" /> Free preview
                    </div>
                  )}
                </div>
                <p className="text-xs text-gray-400 mt-3 text-center">
                  {result.model}{result.sourceImageUrl && ' · with reference'}
                </p>
                <div className="mt-4 space-y-2">
                  {isPremium ? (
                    <button onClick={() => handleDownload(result.imageUrl, true)} disabled={downloading} className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-violet-600 via-fuchsia-600 to-pink-500 text-white font-semibold py-3.5 rounded-xl shadow-lg shadow-violet-900/40">
                      <Crown size={18} className="text-amber-300" /> Download High-Res · No Watermark
                    </button>
                  ) : (
                    <>
                      <button onClick={() => handleDownload(result.imageUrl, false)} disabled={downloading} className="w-full flex items-center justify-center gap-2 bg-dark-700 border border-dark-500 text-gray-200 py-3 rounded-xl">
                        <Download size={17} /> Download with Watermark
                      </button>
                      <button onClick={() => handleDownload(result.imageUrl, true)} className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-violet-600 via-fuchsia-600 to-pink-500 text-white font-semibold py-3.5 rounded-xl">
                        <Crown size={18} className="text-amber-300" /> Download HD · No Watermark <span className="text-[10px] bg-black/30 px-2 py-0.5 rounded-full">Premium</span>
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => {
                      api.post('/features/regenerate', { prompt: result.prompt || prompt, ratio, model }).then(({ data }) => {
                        if (data.credits) updateUser(data.credits);
                        setResult({ ...result, imageUrl: data.imageUrl, id: data.id });
                      }).catch((e) => setError(e.response?.data?.message || 'Failed'));
                    }}
                    className="w-full flex items-center justify-center gap-2 text-sm text-gray-400 hover:text-violet-300 py-2"
                  >
                    <RefreshCw size={14} /> Generate again (new seed)
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-gray-500">
                <ImageIcon size={48} className="mb-3 opacity-40" />
                <p>Your result will appear here</p>
                <p className="text-xs mt-2 text-gray-600">Pick a mode and generate</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
