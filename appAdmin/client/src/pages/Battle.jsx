import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Swords, ArrowLeft } from 'lucide-react';
import Navbar from '../components/Navbar';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';

export default function Battle() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [battles, setBattles] = useState([]);
  const [form, setForm] = useState({ promptA: '', promptB: '', imageA: '', imageB: '' });
  const [msg, setMsg] = useState('');
  const [aiNotes, setAiNotes] = useState({});

  const load = () => api.get('/features/battles').then((r) => setBattles(r.data)).catch(() => {});

  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!user) return navigate('/login');
    try {
      await api.post('/features/battle', form);
      setMsg('Battle created!');
      setForm({ promptA: '', promptB: '', imageA: '', imageB: '' });
      load();
    } catch (e) {
      setMsg(e.response?.data?.message || 'Failed');
    }
  };

  const aiComment = async (b) => {
    try {
      const { data } = await api.post('/features/battle/ai-comment', {
        promptA: b.promptA,
        promptB: b.promptB,
      });
      setAiNotes((prev) => ({ ...prev, [b._id]: data }));
    } catch {
      setAiNotes((prev) => ({ ...prev, [b._id]: { comment: 'AI unavailable' } }));
    }
  };

  const vote = async (id, side) => {
    if (!user) return navigate('/login');
    try {
      await api.post(`/features/battle/${id}/vote`, { side });
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
          <h1 className="text-2xl font-bold flex items-center gap-2"><Swords className="text-fuchsia-400" /> Prompt Battle</h1>
        </div>

        <div className="bg-dark-800 border border-dark-600 rounded-2xl p-5 mb-8 space-y-3">
          <p className="text-sm font-medium">Create a battle</p>
          <div className="grid sm:grid-cols-2 gap-3">
            <input value={form.promptA} onChange={(e) => setForm({ ...form, promptA: e.target.value })} placeholder="Prompt A" className="bg-dark-700 border border-dark-500 rounded-xl px-3 py-2 text-sm" />
            <input value={form.promptB} onChange={(e) => setForm({ ...form, promptB: e.target.value })} placeholder="Prompt B" className="bg-dark-700 border border-dark-500 rounded-xl px-3 py-2 text-sm" />
            <input value={form.imageA} onChange={(e) => setForm({ ...form, imageA: e.target.value })} placeholder="Image A URL" className="bg-dark-700 border border-dark-500 rounded-xl px-3 py-2 text-sm" />
            <input value={form.imageB} onChange={(e) => setForm({ ...form, imageB: e.target.value })} placeholder="Image B URL" className="bg-dark-700 border border-dark-500 rounded-xl px-3 py-2 text-sm" />
          </div>
          <button onClick={create} className="bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white px-5 py-2.5 rounded-xl text-sm font-medium">Create Battle</button>
          {msg && <p className="text-xs text-gray-400">{msg}</p>}
        </div>

        <div className="space-y-6">
          {battles.map((b) => (
            <div key={b._id} className="bg-dark-800 border border-dark-600 rounded-2xl p-4">
              <div className="mb-3 flex items-center justify-between">
                <button onClick={() => aiComment(b)} className="text-xs px-3 py-1.5 rounded-lg bg-fuchsia-600/20 border border-fuchsia-500/40 text-fuchsia-300">
                  AI compare prompts
                </button>
                {aiNotes[b._id] && (
                  <p className="text-xs text-gray-400 max-w-md text-right">
                    {aiNotes[b._id].winner && aiNotes[b._id].winner !== 'tie' ? `AI leans ${aiNotes[b._id].winner} · ` : ''}
                    {aiNotes[b._id].comment}
                  </p>
                )}
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <img src={b.imageA} alt="" className="w-full rounded-xl aspect-square object-cover mb-2" />
                  <p className="text-xs text-gray-400 mb-2 line-clamp-2">{b.promptA}</p>
                  <button onClick={() => vote(b._id, 'A')} className="w-full py-2 rounded-lg bg-violet-600/20 border border-violet-500/40 text-violet-300 text-sm">
                    Vote A · {b.votesA}
                  </button>
                </div>
                <div>
                  <img src={b.imageB} alt="" className="w-full rounded-xl aspect-square object-cover mb-2" />
                  <p className="text-xs text-gray-400 mb-2 line-clamp-2">{b.promptB}</p>
                  <button onClick={() => vote(b._id, 'B')} className="w-full py-2 rounded-lg bg-fuchsia-600/20 border border-fuchsia-500/40 text-fuchsia-300 text-sm">
                    Vote B · {b.votesB}
                  </button>
                </div>
              </div>
            </div>
          ))}
          {battles.length === 0 && <p className="text-gray-500">No battles yet.</p>}
        </div>
      </div>
    </div>
  );
}
