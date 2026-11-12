import { Heart, Sparkles, Copy, Eye } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import { useState } from 'react';

const ASPECT_RATIOS = [
  'aspect-[3/4]',
  'aspect-square',
  'aspect-[4/5]',
  'aspect-[9/16]',
  'aspect-[16/9]',
  'aspect-[5/4]',
];

function getStableAspectClass(id) {
  if (!id) return ASPECT_RATIOS[0];
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  return ASPECT_RATIOS[hash % ASPECT_RATIOS.length];
}

export default function PromptCard({ prompt, onFavoriteToggle }) {
  const navigate = useNavigate();
  const { user, updateUser } = useAuth();
  const [copied, setCopied] = useState(false);

  const aspectClass = getStableAspectClass(prompt._id);

  const isFavorite = user?.favorites?.some(
    (f) => (f._id || f) === prompt._id
  );

  const handleOpenDetail = () => {
    navigate(`/prompt/${prompt._id}`);
  };

  const goPricing = () => {
    navigate('/pricing', { state: { from: `/prompt/${prompt._id}` } });
  };

  const handleUseIdea = (e) => {
    e.stopPropagation();
    goPricing();
  };

  const handleCopy = async (e) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(prompt.promptText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
      // After copy → pricing
      setTimeout(() => goPricing(), 500);
    } catch (err) {
      console.error(err);
    }
  };

  const handleFavorite = async (e) => {
    e.stopPropagation();
    if (!user) {
      navigate('/login');
      return;
    }
    try {
      const { data } = await api.post(`/user/favorites/${prompt._id}`);
      updateUser({ favorites: data.favorites });
      if (onFavoriteToggle) onFavoriteToggle();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div
      onClick={handleOpenDetail}
      className="gallery-item group relative rounded-xl overflow-hidden bg-dark-700 border border-dark-600 hover:border-violet-500/50 transition-all duration-300 cursor-pointer"
    >
      <div className="relative">
        <img
          src={prompt.imageUrl}
          alt={prompt.title}
          className={`w-full object-cover ${aspectClass}`}
          loading="lazy"
        />

        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-3">
          <p className="text-xs text-gray-200 line-clamp-2 mb-2.5">
            {prompt.title}
          </p>

          <div className="flex gap-2">
            <button
              onClick={handleOpenDetail}
              className="flex-1 flex items-center justify-center gap-1.5 bg-white/15 hover:bg-white/25 text-white text-xs font-medium py-2 rounded-lg transition backdrop-blur"
            >
              <Eye size={13} />
              View
            </button>

            <button
              onClick={handleCopy}
              className="flex items-center justify-center gap-1 px-2.5 bg-white/15 hover:bg-white/25 text-white text-xs font-medium py-2 rounded-lg transition backdrop-blur"
              title="Copy prompt"
            >
              <Copy size={13} />
              {copied ? '✓' : ''}
            </button>

            <button
              onClick={handleUseIdea}
              className="flex items-center justify-center gap-1 px-2.5 bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white text-xs font-medium py-2 rounded-lg transition"
              title="Create"
            >
              <Sparkles size={13} />
            </button>

            <button
              onClick={handleFavorite}
              className={`p-2 rounded-lg transition ${
                isFavorite
                  ? 'bg-pink-600 text-white'
                  : 'bg-white/10 hover:bg-white/20 text-white'
              }`}
            >
              <Heart size={13} fill={isFavorite ? 'currentColor' : 'none'} />
            </button>
          </div>
        </div>
      </div>

      <div className="p-2.5">
        <p className="text-xs font-medium truncate">{prompt.title}</p>
        <div className="flex items-center justify-between mt-1">
          <span className="text-[10px] text-gray-400">
            {prompt.author?.username || 'Community'}
          </span>
          <span className="text-[10px] text-gray-500">
            {prompt.uses || 0} uses
          </span>
        </div>
      </div>
    </div>
  );
}
