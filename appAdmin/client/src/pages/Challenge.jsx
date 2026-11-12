import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trophy, ArrowLeft, ThumbsUp } from 'lucide-react';
import Navbar from '../components/Navbar';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';

export default function Challenge() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [ch, setCh] = useState(null);
  const [loading, setLoading] = useState(true);
  const [imageUrl, setImageUrl] = useState('');
  const [prompt, setPrompt] = useState('');
  const [msg, setMsg] = useState('');
  const [ideas, setIdeas] = useState([]);
  const [ideasLoading, setIdeasLoading] = useState(false);

  const load = () => {
    api.get('/features/challenge/today').then((r) => setCh(r.data)).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const loadIdeas = async () => {
    if (!ch?.theme) return;
    setIdeasLoading(true);
    try {
      const { data } = await api.post('/features/challenge/ideas', { theme: ch.theme });
      setIdeas(data.ideas || []);
    } catch {
      setIdeas([]);
    } finally {
      setIdeasLoading(false);
    }
  };

  const submit = async () => {
    if (!user) return navigate('/login');
    if (!imageUrl.trim()) return setMsg('Paste your generated image URL');
    try {
      await api.post('/features/challenge/submit', { imageUrl, prompt });
      setMsg('Submitted!');
      setImageUrl('');
      load();
    } catch (e) {
      setMsg(e.response?.data?.message || 'Failed');
    }
  };

  const vote = async (entryIndex) => {
    if (!user) return navigate('/login');
    try {
      await api.post('/features/challenge/vote', { entryIndex });
      load();
    } catch (e) {
      alert(e.response?.data?.message || 'Failed');
    }
  };

  return (
    <div className="min-h-screen bg-dark-900">
      <Navbar />
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate('/generate')} className="p-2 rounded-lg bg-dark-700 border border-dark-500"><ArrowLeft size={18} /></button>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Trophy className="text-amber-400" /> Daily Challenge</h1>
        </div>

        {loading ? <p className="text-gray-400">Loading…</p> : ch && (
          <>
            <div className="bg-gradient-to-r from-violet-900/40 to-fuchsia-900/40 border border-violet-500/30 rounded-2xl p-6 mb-8">
              <p className="text-sm text-violet-300 mb-1">Today's theme</p>
              <h2 className="text-xl font-bold text-white mb-2">{ch.theme}</h2>
              <p className="text-sm text-gray-400">{ch.description}</p>
            </div>

            <div className="bg-dark-800 border border-dark-600 rounded-2xl p-5 mb-6">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-medium">AI prompt ideas (OpenRouter free)</p>
                <button onClick={loadIdeas} disabled={ideasLoading} className="text-xs px-3 py-1.5 rounded-lg bg-violet-600/20 border border-violet-500/40 text-violet-300">
                  {ideasLoading ? 'Loading…' : 'Get ideas'}
                </button>
              </div>
              {ideas.length > 0 && (
                <div className="space-y-2">
                  {ideas.map((idea, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => { setPrompt(idea); navigate('/generate', { state: { prompt: idea } }); }}
                      className="w-full text-left text-xs text-gray-300 bg-dark-700 border border-dark-500 rounded-xl px-3 py-2 hover:border-violet-500"
                    >
                      {idea}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-dark-800 border border-dark-600 rounded-2xl p-5 mb-8">
              <p className="text-sm font-medium mb-3">Submit your entry</p>
              <p className="text-xs text-gray-500 mb-2">Generate on the Generate page, copy image URL, paste here.</p>
              <input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="Image URL" className="w-full bg-dark-700 border border-dark-500 rounded-xl px-4 py-2.5 text-sm mb-2 focus:outline-none focus:border-violet-500" />
              <input value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Your prompt (optional)" className="w-full bg-dark-700 border border-dark-500 rounded-xl px-4 py-2.5 text-sm mb-3 focus:outline-none focus:border-violet-500" />
              <button onClick={submit} className="bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white px-5 py-2.5 rounded-xl text-sm font-medium">Submit</button>
              {msg && <p className="text-xs text-gray-400 mt-2">{msg}</p>}
            </div>

            <h3 className="text-lg font-semibold mb-4">Leaderboard</h3>
            {(!ch.entries || ch.entries.length === 0) ? (
              <p className="text-gray-500">No entries yet. Be the first!</p>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {ch.entries.map((e, i) => (
                  <div key={i} className="bg-dark-800 border border-dark-600 rounded-2xl overflow-hidden">
                    <img src={e.imageUrl} alt="" className="w-full aspect-square object-cover" />
                    <div className="p-3 flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-300">{e.user?.name || 'Anonymous'}</p>
                        <p className="text-xs text-gray-500">{e.votes} votes</p>
                      </div>
                      <button onClick={() => vote(i)} className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-violet-600/20 border border-violet-500/40 text-violet-300">
                        <ThumbsUp size={12} /> Vote
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
