import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Heart,
  Copy,
  Sparkles,
  Image as ImageIcon,
  Download,
  ChevronLeft,
} from 'lucide-react';
import Navbar from '../components/Navbar';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';

export default function PromptDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, updateUser } = useAuth();

  const [prompt, setPrompt] = useState(null);
  const [related, setRelated] = useState([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [showFullPrompt, setShowFullPrompt] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const { data } = await api.get(`/prompts/${id}`);
        setPrompt(data);
        const { data: relatedData } = await api.get('/prompts', {
          params: { category: data.category, limit: 8 },
        });
        setRelated(
          (relatedData.prompts || []).filter((p) => p._id !== data._id).slice(0, 6)
        );
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  const isFavorite = user?.favorites?.some(
    (f) => (f._id || f) === prompt?._id
  );

  const goToPricing = () => {
    navigate('/pricing', { state: { from: `/prompt/${id}` } });
  };

  const handleCopy = async () => {
    if (!prompt?.promptText) return;
    try {
      await navigator.clipboard.writeText(prompt.promptText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      // After copy → send to payment / pricing
      setTimeout(() => goToPricing(), 600);
    } catch (e) {
      console.error(e);
    }
  };

  // Generate actions → pricing page (credits required)
  const handleGenerateWithPrompt = async () => {
    try {
      await api.post(`/prompts/${id}/use`);
    } catch (e) {}
    goToPricing();
  };

  const handleGenerateWithRef = async () => {
    try {
      await api.post(`/prompts/${id}/use`);
    } catch (e) {}
    goToPricing();
  };

  const handleFavorite = async () => {
    if (!user) {
      navigate('/login');
      return;
    }
    try {
      const { data } = await api.post(`/user/favorites/${prompt._id}`);
      updateUser({ favorites: data.favorites });
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-dark-900 flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!prompt) {
    return (
      <div className="min-h-screen bg-dark-900 flex flex-col items-center justify-center text-gray-400">
        <p className="text-lg">Prompt not found</p>
        <Link to="/" className="mt-4 text-violet-400 hover:underline">
          ← Back to gallery
        </Link>
      </div>
    );
  }

  const promptPreview =
    prompt.promptText.length > 220 && !showFullPrompt
      ? prompt.promptText.slice(0, 220) + '...'
      : prompt.promptText;

  return (
    <div className="min-h-screen bg-dark-900">
      <Navbar />

      <div className="max-w-[1400px] mx-auto px-4 py-6">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white mb-5 transition"
        >
          <ChevronLeft size={18} />
          Back
        </button>

        <div className="flex flex-col lg:flex-row gap-8">
          {/* LEFT — Image */}
          <div className="flex-1 flex items-start justify-center">
            <div className="relative w-full max-w-[520px] rounded-2xl overflow-hidden bg-dark-800 border border-dark-600 shadow-2xl">
              <img
                src={prompt.imageUrl}
                alt={prompt.title}
                className="w-full h-auto object-contain max-h-[80vh]"
              />
              <div className="absolute top-3 right-3 flex gap-2">
                <button
                  onClick={handleCopy}
                  className="w-9 h-9 rounded-full bg-black/60 backdrop-blur flex items-center justify-center text-white hover:bg-black/80 transition"
                  title="Copy prompt"
                >
                  <Copy size={16} />
                </button>
                <a
                  href={prompt.imageUrl}
                  download
                  target="_blank"
                  rel="noreferrer"
                  className="w-9 h-9 rounded-full bg-black/60 backdrop-blur flex items-center justify-center text-white hover:bg-black/80 transition"
                  title="Download"
                >
                  <Download size={16} />
                </a>
              </div>
            </div>
          </div>

          {/* RIGHT — Details */}
          <div className="w-full lg:w-[400px] shrink-0">
            <div className="sticky top-20 space-y-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-600 to-fuchsia-600 flex items-center justify-center text-white font-semibold text-sm">
                    {(prompt.author?.name || 'C')[0]}
                  </div>
                  <div>
                    <p className="font-medium text-white">
                      {prompt.author?.name || 'Community'}
                    </p>
                    <p className="text-xs text-gray-400">
                      {prompt.author?.username || '@community'}
                    </p>
                  </div>
                </div>
                <span className="text-xs px-2.5 py-1 rounded-full bg-dark-700 text-gray-300 border border-dark-600">
                  {prompt.category || 'General'}
                </span>
              </div>

              <h1 className="text-xl font-semibold text-white leading-snug">
                {prompt.title}
              </h1>

              <div className="flex items-center gap-3">
                <button
                  onClick={handleFavorite}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition ${
                    isFavorite
                      ? 'bg-pink-600/20 text-pink-400'
                      : 'bg-dark-700 text-gray-300 hover:bg-dark-600'
                  }`}
                >
                  <Heart size={15} fill={isFavorite ? 'currentColor' : 'none'} />
                  {prompt.likes || 0}
                </button>
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm bg-dark-700 text-gray-300 hover:bg-dark-600 transition"
                >
                  <Copy size={15} />
                  {copied ? 'Copied!' : 'Copy Prompt'}
                </button>
                <span className="text-xs text-gray-500 ml-auto">
                  {prompt.uses || 0} uses
                </span>
              </div>

              <div className="bg-dark-800 border border-dark-600 rounded-xl p-4">
                <p className="text-xs font-medium text-gray-400 mb-2 uppercase tracking-wider">
                  Prompt
                </p>
                <p className="text-sm text-gray-200 leading-relaxed whitespace-pre-wrap">
                  {promptPreview}
                </p>
                {prompt.promptText.length > 220 && (
                  <button
                    onClick={() => setShowFullPrompt(!showFullPrompt)}
                    className="text-xs text-violet-400 mt-2 hover:underline"
                  >
                    {showFullPrompt ? 'Show less' : 'Show more'}
                  </button>
                )}
              </div>

              {/* Renamed buttons → both go to Pricing */}
              <div className="flex gap-3">
                <button
                  onClick={handleGenerateWithPrompt}
                  className="flex-1 flex items-center justify-center gap-2 bg-white text-black font-medium py-3 rounded-xl hover:bg-gray-100 transition"
                >
                  <Sparkles size={18} />
                  Create with this
                </button>
                <button
                  onClick={handleGenerateWithRef}
                  className="flex-1 flex items-center justify-center gap-2 bg-dark-700 border border-dark-500 text-white font-medium py-3 rounded-xl hover:bg-dark-600 transition"
                >
                  <ImageIcon size={18} />
                  Style Transfer
                </button>
              </div>

              {prompt.tags?.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {prompt.tags.map((tag) => (
                    <span
                      key={tag}
                      className="text-xs px-2.5 py-1 rounded-full bg-dark-700 text-gray-400"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              )}

              {related.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-gray-300 mb-3">
                    More like this
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    {related.map((item) => (
                      <Link
                        key={item._id}
                        to={`/prompt/${item._id}`}
                        className="group rounded-xl overflow-hidden bg-dark-800 border border-dark-600 hover:border-violet-500/40 transition"
                      >
                        <img
                          src={item.imageUrl}
                          alt={item.title}
                          className="w-full aspect-[3/4] object-cover group-hover:scale-105 transition duration-300"
                          loading="lazy"
                        />
                        <div className="p-2">
                          <p className="text-xs text-gray-300 truncate">{item.title}</p>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
