import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import PromptCard from '../components/PromptCard';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import { Heart, Trash2 } from 'lucide-react';

export default function Favorites() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    const fetch = async () => {
      try {
        const { data } = await api.get('/user/favorites');
        setFavorites(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [user, navigate]);

  const clearAll = async () => {
    if (!window.confirm('Saare favorites hatane hain?')) return;
    try {
      await api.delete('/user/favorites');
      setFavorites([]);
    } catch (err) {
      alert(err.response?.data?.message || 'Clear failed');
    }
  };

  return (
    <div className="min-h-screen bg-dark-900">
      <Navbar />
      <main className="max-w-[1600px] mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-6 flex items-center gap-2">
          <Heart className="text-pink-500" /> Your Favorites
          {favorites.length > 0 && (
            <button
              onClick={clearAll}
              className="ml-auto flex items-center gap-2 px-4 py-2 rounded-lg bg-red-900/40 hover:bg-red-800/60 text-red-300 text-sm font-medium"
            >
              <Trash2 size={14} /> Delete All
            </button>
          )}
        </h1>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : favorites.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <Heart size={48} className="mx-auto mb-4 opacity-30" />
            <p className="text-lg">No favorites yet</p>
            <p className="text-sm mt-2">Save prompts you like from the gallery</p>
          </div>
        ) : (
          <div className="gallery-grid">
            {favorites.map((prompt) => (
              <PromptCard key={prompt._id} prompt={prompt} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
