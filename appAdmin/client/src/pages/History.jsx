import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { History as HistIcon, RefreshCw, Download, ArrowLeft, Trash2 } from 'lucide-react';
import Navbar from '../components/Navbar';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';

export default function History() {
  const { user, updateUser } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);

  useEffect(() => {
    if (!user) return navigate('/login');
    api.get('/features/history').then((r) => setItems(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, [user]);

  const regen = async (item) => {
    setBusy(item._id);
    try {
      const { data } = await api.post('/features/regenerate', {
        prompt: item.promptText,
        ratio: item.ratio || '3:4',
        model: item.model || 'flux',
      });
      if (data.credits) updateUser(data.credits);
      setItems((prev) => [{ ...item, imageUrl: data.imageUrl, _id: data.id, createdAt: new Date() }, ...prev]);
    } catch (e) {
      alert(e.response?.data?.message || 'Failed');
    } finally {
      setBusy(null);
    }
  };

  const deleteAll = async () => {
    if (!window.confirm('Saari history delete karni hai? Ye undo nahi hoga.')) return;
    try {
      await api.delete('/features/history');
      setItems([]);
    } catch (e) {
      alert(e.response?.data?.message || 'Delete all failed');
    }
  };

  return (
    <div className="min-h-screen bg-dark-900">
      <Navbar />
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate('/generate')} className="p-2 rounded-lg bg-dark-700 border border-dark-500"><ArrowLeft size={18} /></button>
          <h1 className="text-2xl font-bold flex items-center gap-2"><HistIcon className="text-violet-400" /> Prompt History</h1>
          {items.length > 0 && (
            <button
              onClick={deleteAll}
              className="ml-auto flex items-center gap-2 px-4 py-2 rounded-lg bg-red-900/40 hover:bg-red-800/60 text-red-300 text-sm font-medium"
            >
              <Trash2 size={14} /> Delete All
            </button>
          )}
        </div>
        {loading ? (
          <p className="text-gray-400">Loading…</p>
        ) : items.length === 0 ? (
          <p className="text-gray-500">No generations yet. Create something!</p>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map((item) => (
              <div key={item._id} className="bg-dark-800 border border-dark-600 rounded-2xl overflow-hidden">
                <img src={item.imageUrl} alt="" className="w-full aspect-[3/4] object-cover" />
                <div className="p-3">
                  <p className="text-xs text-gray-400 line-clamp-2 mb-2">{item.promptText}</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => regen(item)}
                      disabled={busy === item._id}
                      className="flex-1 flex items-center justify-center gap-1 text-xs py-2 rounded-lg bg-violet-600/20 border border-violet-500/40 text-violet-300 hover:bg-violet-600/30"
                    >
                      <RefreshCw size={12} className={busy === item._id ? 'animate-spin' : ''} /> New seed
                    </button>
                    <a href={item.imageUrl} target="_blank" rel="noreferrer" className="flex items-center justify-center px-3 py-2 rounded-lg bg-dark-700 border border-dark-500 text-gray-300">
                      <Download size={12} />
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
