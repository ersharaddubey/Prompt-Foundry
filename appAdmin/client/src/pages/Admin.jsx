import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Trash2,
  Edit2,
  Save,
  X,
  Search,
  LayoutDashboard,
  Tag,
  FolderPlus,
  Upload,
  Bell,
  Send,
  Clock,
  Trophy,
} from 'lucide-react';
import Navbar from '../components/Navbar';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';

const emptyForm = {
  title: '',
  promptText: '',
  category: '',
  tags: '',
  authorName: 'Admin',
  authorUsername: '@admin',
};

export default function Admin() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const fileRef = useRef(null);

  const [tab, setTab] = useState('prompts'); // prompts | promo | categories
  const [prompts, setPrompts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [promos, setPromos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  // Promo form
  const [promoForm, setPromoForm] = useState({
    code: '',
    credits: 100,
    maxUses: 10,
  });

  // New category
  const [newCat, setNewCat] = useState('');

  // Notifications
  const [notifications, setNotifications] = useState([]);
  const [notifForm, setNotifForm] = useState({ title: '', body: '', scheduleMode: 'now', scheduledAt: '' });
  const [notifSaving, setNotifSaving] = useState(false);

  // Daily Challenge
  const [challengeForm, setChallengeForm] = useState({ theme: '', description: '', date: '' });
  const [challengeSaving, setChallengeSaving] = useState(false);
  const [todayChallenge, setTodayChallenge] = useState(null);

  useEffect(() => {
    if (!user) navigate('/login');
  }, [user, navigate]);

  const fetchCategories = async () => {
    try {
      const { data } = await api.get('/categories');
      setCategories(data || []);
      if (data?.length && !form.category) {
        setForm((f) => ({ ...f, category: data[0].name }));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchPrompts = async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/prompts', {
        params: {
          search: search || undefined,
          category: categoryFilter || undefined,
          limit: 100,
        },
      });
      setPrompts(data.prompts || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchPromos = async () => {
    try {
      const { data } = await api.get('/promo');
      setPromos(data || []);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchNotifications = async () => {
    try {
      const { data } = await api.get('/notifications');
      setNotifications(data || []);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchTodayChallenge = async () => {
    try {
      const { data } = await api.get('/features/challenge/today');
      setTodayChallenge(data);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchCategories();
    fetchPrompts();
    fetchPromos();
    fetchNotifications();
    fetchTodayChallenge();
  }, [search, categoryFilter]);

  const openCreate = () => {
    setEditingId(null);
    setForm({
      ...emptyForm,
      category: categories[0]?.name || '',
    });
    setImageFile(null);
    setImagePreview('');
    setShowForm(true);
  };

  const openEdit = (p) => {
    setEditingId(p._id);
    setForm({
      title: p.title || '',
      promptText: p.promptText || '',
      category: p.category || '',
      tags: (p.tags || []).join(', '),
      authorName: p.author?.name || 'Admin',
      authorUsername: p.author?.username || '@admin',
    });
    setImageFile(null);
    setImagePreview(p.imageUrl || '');
    setShowForm(true);
  };

  const handleImageSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setMessage('Only image files allowed');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setMessage('Max 10MB');
      return;
    }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.promptText.trim()) {
      setMessage('Title and Prompt required');
      return;
    }
    if (!editingId && !imageFile) {
      setMessage('Image upload required (no URL)');
      return;
    }
    if (!form.category) {
      setMessage('Please select a category');
      return;
    }

    setSaving(true);
    setMessage('');

    const fd = new FormData();
    fd.append('title', form.title.trim());
    fd.append('promptText', form.promptText.trim());
    fd.append('category', form.category);
    fd.append('tags', form.tags);
    fd.append('authorName', form.authorName);
    fd.append('authorUsername', form.authorUsername);
    if (imageFile) fd.append('image', imageFile);

    try {
      if (editingId) {
        await api.put(`/prompts/${editingId}`, fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        setMessage('Prompt updated');
      } else {
        await api.post('/prompts', fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        setMessage('Prompt created');
      }
      setShowForm(false);
      fetchPrompts();
    } catch (err) {
      setMessage(err.response?.data?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this prompt?')) return;
    try {
      await api.delete(`/prompts/${id}`);
      setPrompts((prev) => prev.filter((p) => p._id !== id));
    } catch (err) {
      setMessage(err.response?.data?.message || 'Delete failed');
    }
  };

  const deleteAllPrompts = async () => {
    const label = categoryFilter ? `all prompts in "${categoryFilter}"` : 'ALL prompts';
    if (!window.confirm(`Delete ${label}? Ye undo nahi hoga.`)) return;
    try {
      const { data } = await api.delete('/prompts/all', {
        params: categoryFilter ? { category: categoryFilter } : {},
      });
      setMessage(`${data.deletedCount} prompts deleted`);
      fetchPrompts();
    } catch (err) {
      setMessage(err.response?.data?.message || 'Delete all failed');
    }
  };

  const handleCategoryChange = async (id, newCategory) => {
    try {
      const fd = new FormData();
      fd.append('category', newCategory);
      await api.put(`/prompts/${id}`, fd);
      setPrompts((prev) =>
        prev.map((p) => (p._id === id ? { ...p, category: newCategory } : p))
      );
    } catch (e) {
      console.error(e);
    }
  };

  // —— Promo ——
  const createPromo = async (e) => {
    e.preventDefault();
    try {
      await api.post('/promo', promoForm);
      setPromoForm({ code: '', credits: 100, maxUses: 10 });
      setMessage('Promo code created');
      fetchPromos();
    } catch (err) {
      setMessage(err.response?.data?.message || 'Failed');
    }
  };

  const deletePromo = async (id) => {
    if (!window.confirm('Delete this promo code?')) return;
    try {
      await api.delete(`/promo/${id}`);
      fetchPromos();
    } catch (e) {
      console.error(e);
    }
  };

  const deleteAllPromos = async () => {
    if (!window.confirm('Saare promo codes delete karne hain? Ye undo nahi hoga.')) return;
    try {
      await api.delete('/promo/all');
      setMessage('All promo codes deleted');
      fetchPromos();
    } catch (err) {
      setMessage(err.response?.data?.message || 'Delete all failed');
    }
  };

  // —— Categories ——
  const addCategory = async (e) => {
    e.preventDefault();
    if (!newCat.trim()) return;
    try {
      await api.post('/categories', { name: newCat.trim() });
      setNewCat('');
      setMessage('Category added');
      fetchCategories();
    } catch (err) {
      setMessage(err.response?.data?.message || 'Failed');
    }
  };

  const deleteCategory = async (id) => {
    if (!window.confirm('Delete this category?')) return;
    try {
      await api.delete(`/categories/${id}`);
      fetchCategories();
    } catch (e) {
      console.error(e);
    }
  };

  const deleteAllCategories = async () => {
    if (!window.confirm('Saari categories delete karni hain? Ye undo nahi hoga.')) return;
    try {
      await api.delete('/categories/all');
      setMessage('All categories deleted');
      fetchCategories();
    } catch (err) {
      setMessage(err.response?.data?.message || 'Delete all failed');
    }
  };

  // —— Notifications ——
  const sendNotification = async (e) => {
    e.preventDefault();
    if (!notifForm.title.trim() || !notifForm.body.trim()) {
      setMessage('Title and message dono chahiye');
      return;
    }
    if (notifForm.scheduleMode === 'later' && !notifForm.scheduledAt) {
      setMessage('Schedule ke liye date/time select karo');
      return;
    }
    setNotifSaving(true);
    setMessage('');
    try {
      await api.post('/notifications', {
        title: notifForm.title.trim(),
        body: notifForm.body.trim(),
        scheduledAt: notifForm.scheduleMode === 'later' ? new Date(notifForm.scheduledAt).toISOString() : null,
      });
      setMessage(notifForm.scheduleMode === 'later' ? 'Notification schedule ho gaya' : 'Notification bhej diya');
      setNotifForm({ title: '', body: '', scheduleMode: 'now', scheduledAt: '' });
      fetchNotifications();
    } catch (err) {
      setMessage(err.response?.data?.message || 'Failed');
    } finally {
      setNotifSaving(false);
    }
  };

  const deleteAllNotifications = async () => {
    if (!window.confirm('Saari notifications (scheduled bhi) delete karni hain? Scheduled wali ab send nahi hongi.')) return;
    try {
      await api.delete('/notifications/all');
      setMessage('All notifications deleted');
      fetchNotifications();
    } catch (err) {
      setMessage(err.response?.data?.message || 'Delete all failed');
    }
  };

  const cancelNotification = async (id) => {
    if (!window.confirm('Ye scheduled notification cancel karna hai?')) return;
    try {
      await api.delete(`/notifications/${id}`);
      fetchNotifications();
    } catch (e) {
      setMessage(e.response?.data?.message || 'Failed');
    }
  };

  // —— Daily Challenge ——
  const publishChallenge = async (e) => {
    e.preventDefault();
    if (!challengeForm.theme.trim()) {
      setMessage('Challenge theme required hai');
      return;
    }
    setChallengeSaving(true);
    setMessage('');
    try {
      await api.post('/features/challenge/create', {
        theme: challengeForm.theme.trim(),
        description: challengeForm.description.trim(),
        date: challengeForm.date || undefined,
        notify: true,
      });
      setMessage('Challenge publish ho gaya aur notification bhej diya gaya ✅');
      setChallengeForm({ theme: '', description: '', date: '' });
      fetchTodayChallenge();
      fetchNotifications();
    } catch (err) {
      setMessage(err.response?.data?.message || 'Failed');
    } finally {
      setChallengeSaving(false);
    }
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-dark-900">
      <Navbar />

      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <LayoutDashboard className="text-violet-400" size={28} />
            <div>
              <h1 className="text-2xl font-bold text-white">Admin Panel</h1>
              <p className="text-sm text-gray-400">
                Prompts · Promo Codes · Categories · Daily Challenge · Notifications
              </p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-dark-600 pb-1">
          {[
            { id: 'prompts', label: 'Prompts' },
            { id: 'promo', label: 'Promo Codes' },
            { id: 'categories', label: 'Categories' },
            { id: 'challenge', label: 'Daily Challenge' },
            { id: 'notifications', label: 'Notifications' },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg transition ${
                tab === t.id
                  ? 'bg-dark-700 text-white border-b-2 border-violet-500'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {message && (
          <div className="mb-4 px-4 py-2.5 rounded-lg bg-dark-700 text-sm text-gray-200 border border-dark-600">
            {message}
          </div>
        )}

        {/* ========== PROMPTS TAB ========== */}
        {tab === 'prompts' && (
          <>
            <div className="flex flex-wrap gap-3 mb-6">
              <div className="relative flex-1 min-w-[200px]">
                <Search
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
                />
                <input
                  type="text"
                  placeholder="Search..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 bg-dark-800 border border-dark-600 rounded-xl text-sm text-white focus:outline-none focus:border-violet-500"
                />
              </div>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="px-4 py-2.5 bg-dark-800 border border-dark-600 rounded-xl text-sm text-white focus:outline-none focus:border-violet-500"
              >
                <option value="">All Categories</option>
                {categories.map((c) => (
                  <option key={c._id} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
              <button
                onClick={openCreate}
                className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white px-4 py-2.5 rounded-xl font-medium transition"
              >
                <Plus size={18} /> Add Prompt
              </button>
              <button
                onClick={deleteAllPrompts}
                disabled={prompts.length === 0}
                className="flex items-center gap-2 bg-red-900/40 hover:bg-red-800/60 disabled:opacity-40 text-red-300 px-4 py-2.5 rounded-xl font-medium transition"
              >
                <Trash2 size={16} /> {categoryFilter ? 'Delete category prompts' : 'Delete All'}
              </button>
            </div>

            {loading ? (
              <div className="flex justify-center py-20">
                <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-dark-600">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-dark-800 text-left text-gray-400">
                      <th className="px-4 py-3">Image</th>
                      <th className="px-4 py-3">Title</th>
                      <th className="px-4 py-3">Category</th>
                      <th className="px-4 py-3">Uses</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {prompts.map((p) => (
                      <tr key={p._id} className="border-t border-dark-700">
                        <td className="px-4 py-3">
                          <img
                            src={p.imageUrl}
                            alt=""
                            className="w-12 h-16 object-cover rounded-lg"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-white font-medium line-clamp-1 max-w-[200px]">
                            {p.title}
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          <select
                            value={p.category}
                            onChange={(e) =>
                              handleCategoryChange(p._id, e.target.value)
                            }
                            className="bg-dark-900 border border-dark-600 rounded-lg px-2 py-1.5 text-xs text-white max-w-[140px]"
                          >
                            {categories.map((c) => (
                              <option key={c._id} value={c.name}>
                                {c.name}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-4 py-3 text-gray-400">{p.uses || 0}</td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => openEdit(p)}
                              className="p-2 rounded-lg bg-dark-700 hover:bg-dark-600 text-gray-300"
                            >
                              <Edit2 size={15} />
                            </button>
                            <button
                              onClick={() => handleDelete(p._id)}
                              className="p-2 rounded-lg bg-dark-700 hover:bg-red-900/50 text-gray-300 hover:text-red-400"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {/* ========== PROMO TAB ========== */}
        {tab === 'promo' && (
          <div className="space-y-6">
            <form
              onSubmit={createPromo}
              className="bg-dark-800 border border-dark-600 rounded-2xl p-5 space-y-4 max-w-lg"
            >
              <h3 className="font-semibold text-white flex items-center gap-2">
                <Tag size={18} className="text-violet-400" />
                Create Promo Code
              </h3>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-gray-400">Code</label>
                  <input
                    value={promoForm.code}
                    onChange={(e) =>
                      setPromoForm({
                        ...promoForm,
                        code: e.target.value.toUpperCase(),
                      })
                    }
                    placeholder="WELCOME100"
                    className="w-full mt-1 px-3 py-2 bg-dark-900 border border-dark-600 rounded-lg text-sm text-white uppercase"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400">Credits to give</label>
                  <input
                    type="number"
                    min={1}
                    value={promoForm.credits}
                    onChange={(e) =>
                      setPromoForm({
                        ...promoForm,
                        credits: Number(e.target.value),
                      })
                    }
                    className="w-full mt-1 px-3 py-2 bg-dark-900 border border-dark-600 rounded-lg text-sm text-white"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400">Max uses</label>
                  <input
                    type="number"
                    min={1}
                    value={promoForm.maxUses}
                    onChange={(e) =>
                      setPromoForm({
                        ...promoForm,
                        maxUses: Number(e.target.value),
                      })
                    }
                    className="w-full mt-1 px-3 py-2 bg-dark-900 border border-dark-600 rounded-lg text-sm text-white"
                  />
                </div>
              </div>
              <button
                type="submit"
                className="px-5 py-2.5 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-sm font-medium"
              >
                Generate Code
              </button>
            </form>

            <div className="flex justify-end">
              <button
                onClick={deleteAllPromos}
                disabled={promos.length === 0}
                className="flex items-center gap-2 bg-red-900/40 hover:bg-red-800/60 disabled:opacity-40 text-red-300 px-4 py-2.5 rounded-xl font-medium transition"
              >
                <Trash2 size={16} /> Delete All
              </button>
            </div>
            <div className="overflow-x-auto rounded-xl border border-dark-600">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-dark-800 text-left text-gray-400">
                    <th className="px-4 py-3">Code</th>
                    <th className="px-4 py-3">Credits</th>
                    <th className="px-4 py-3">Used / Max</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {promos.map((p) => (
                    <tr key={p._id} className="border-t border-dark-700">
                      <td className="px-4 py-3 font-mono text-violet-300">
                        {p.code}
                      </td>
                      <td className="px-4 py-3 text-white">{p.credits}</td>
                      <td className="px-4 py-3 text-gray-400">
                        {p.usedCount} / {p.maxUses}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full ${
                            p.isActive
                              ? 'bg-green-900/40 text-green-400'
                              : 'bg-red-900/40 text-red-400'
                          }`}
                        >
                          {p.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => deletePromo(p._id)}
                          className="p-2 rounded-lg bg-dark-700 hover:bg-red-900/50 text-gray-300 hover:text-red-400"
                        >
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {promos.length === 0 && (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-4 py-8 text-center text-gray-500"
                      >
                        No promo codes yet
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ========== CATEGORIES TAB ========== */}
        {tab === 'categories' && (
          <div className="space-y-6 max-w-lg">
            <form
              onSubmit={addCategory}
              className="bg-dark-800 border border-dark-600 rounded-2xl p-5 space-y-4"
            >
              <h3 className="font-semibold text-white flex items-center gap-2">
                <FolderPlus size={18} className="text-violet-400" />
                Add New Category
              </h3>
              <div className="flex gap-2">
                <input
                  value={newCat}
                  onChange={(e) => setNewCat(e.target.value)}
                  placeholder="e.g. Travel Posters"
                  className="flex-1 px-3 py-2.5 bg-dark-900 border border-dark-600 rounded-xl text-sm text-white focus:outline-none focus:border-violet-500"
                />
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-sm font-medium"
                >
                  Add
                </button>
              </div>
            </form>

            <div className="flex justify-end">
              <button
                onClick={deleteAllCategories}
                disabled={categories.length === 0}
                className="flex items-center gap-2 bg-red-900/40 hover:bg-red-800/60 disabled:opacity-40 text-red-300 px-4 py-2.5 rounded-xl font-medium transition"
              >
                <Trash2 size={16} /> Delete All
              </button>
            </div>
            <div className="space-y-2">
              {categories.map((c) => (
                <div
                  key={c._id}
                  className="flex items-center justify-between bg-dark-800 border border-dark-600 rounded-xl px-4 py-3"
                >
                  <span className="text-white text-sm">{c.name}</span>
                  <button
                    onClick={() => deleteCategory(c._id)}
                    className="p-1.5 rounded-lg hover:bg-red-900/40 text-gray-400 hover:text-red-400"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
              {categories.length === 0 && (
                <p className="text-gray-500 text-sm text-center py-6">
                  No categories. Add one above.
                </p>
              )}
            </div>
          </div>
        )}

        {/* ========== DAILY CHALLENGE TAB ========== */}
        {tab === 'challenge' && (
          <div className="space-y-6 max-w-2xl">
            <form
              onSubmit={publishChallenge}
              className="bg-dark-800 border border-dark-600 rounded-2xl p-5 space-y-4"
            >
              <h3 className="font-semibold text-white flex items-center gap-2">
                <Trophy size={18} className="text-amber-400" />
                Publish Daily Challenge
              </h3>
              <p className="text-xs text-gray-500">
                Publish karte hi sab users ko push notification chala jayega ("🎨 New Daily Challenge!").
              </p>
              <div>
                <label className="text-xs text-gray-400">Theme *</label>
                <input
                  value={challengeForm.theme}
                  onChange={(e) => setChallengeForm({ ...challengeForm, theme: e.target.value })}
                  placeholder="e.g. Neon Cyberpunk City at night"
                  className="w-full mt-1 px-3 py-2.5 bg-dark-900 border border-dark-600 rounded-xl text-sm text-white"
                  required
                />
              </div>
              <div>
                <label className="text-xs text-gray-400">Description</label>
                <textarea
                  value={challengeForm.description}
                  onChange={(e) => setChallengeForm({ ...challengeForm, description: e.target.value })}
                  rows={2}
                  placeholder="Optional details shown on the Challenge page"
                  className="w-full mt-1 px-3 py-2.5 bg-dark-900 border border-dark-600 rounded-xl text-sm text-white resize-none"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400">Date (blank = today)</label>
                <input
                  type="date"
                  value={challengeForm.date}
                  onChange={(e) => setChallengeForm({ ...challengeForm, date: e.target.value })}
                  className="w-full mt-1 px-3 py-2.5 bg-dark-900 border border-dark-600 rounded-xl text-sm text-white"
                />
                <p className="text-[11px] text-gray-500 mt-1">
                  Future date daalne se challenge ban jayega lekin notification abhi turant jayega — agar aage ka reminder chahiye to Notifications tab se schedule karo.
                </p>
              </div>
              <button
                type="submit"
                disabled={challengeSaving}
                className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white rounded-xl text-sm font-medium disabled:opacity-50"
              >
                <Send size={16} />
                {challengeSaving ? 'Publishing…' : 'Publish & Notify'}
              </button>
            </form>

            {todayChallenge && (
              <div className="bg-dark-800 border border-dark-600 rounded-2xl p-5">
                <p className="text-xs text-gray-500 mb-1">Today's live challenge</p>
                <p className="text-white font-medium">{todayChallenge.theme}</p>
                {todayChallenge.description && (
                  <p className="text-sm text-gray-400 mt-1">{todayChallenge.description}</p>
                )}
                <p className="text-xs text-gray-500 mt-2">{todayChallenge.entries?.length || 0} entries so far</p>
              </div>
            )}
          </div>
        )}

        {/* ========== NOTIFICATIONS TAB ========== */}
        {tab === 'notifications' && (
          <div className="space-y-6">
            <form
              onSubmit={sendNotification}
              className="bg-dark-800 border border-dark-600 rounded-2xl p-5 space-y-4 max-w-lg"
            >
              <h3 className="font-semibold text-white flex items-center gap-2">
                <Bell size={18} className="text-violet-400" />
                Send Push Notification
              </h3>
              <div>
                <label className="text-xs text-gray-400">Title *</label>
                <input
                  value={notifForm.title}
                  onChange={(e) => setNotifForm({ ...notifForm, title: e.target.value })}
                  placeholder="e.g. 50% OFF today only!"
                  className="w-full mt-1 px-3 py-2.5 bg-dark-900 border border-dark-600 rounded-xl text-sm text-white"
                  required
                />
              </div>
              <div>
                <label className="text-xs text-gray-400">Message *</label>
                <textarea
                  value={notifForm.body}
                  onChange={(e) => setNotifForm({ ...notifForm, body: e.target.value })}
                  rows={2}
                  className="w-full mt-1 px-3 py-2.5 bg-dark-900 border border-dark-600 rounded-xl text-sm text-white resize-none"
                  required
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setNotifForm({ ...notifForm, scheduleMode: 'now' })}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium border ${
                    notifForm.scheduleMode === 'now'
                      ? 'bg-violet-600 border-violet-500 text-white'
                      : 'bg-dark-900 border-dark-600 text-gray-400'
                  }`}
                >
                  <Send size={14} /> Send now
                </button>
                <button
                  type="button"
                  onClick={() => setNotifForm({ ...notifForm, scheduleMode: 'later' })}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium border ${
                    notifForm.scheduleMode === 'later'
                      ? 'bg-violet-600 border-violet-500 text-white'
                      : 'bg-dark-900 border-dark-600 text-gray-400'
                  }`}
                >
                  <Clock size={14} /> Schedule
                </button>
              </div>
              {notifForm.scheduleMode === 'later' && (
                <div>
                  <label className="text-xs text-gray-400">Send at</label>
                  <input
                    type="datetime-local"
                    value={notifForm.scheduledAt}
                    onChange={(e) => setNotifForm({ ...notifForm, scheduledAt: e.target.value })}
                    className="w-full mt-1 px-3 py-2.5 bg-dark-900 border border-dark-600 rounded-xl text-sm text-white"
                    required
                  />
                </div>
              )}
              <button
                type="submit"
                disabled={notifSaving}
                className="px-5 py-2.5 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-sm font-medium disabled:opacity-50"
              >
                {notifSaving ? 'Saving…' : notifForm.scheduleMode === 'later' ? 'Schedule' : 'Send Now'}
              </button>
            </form>

            <div className="flex justify-end">
              <button
                onClick={deleteAllNotifications}
                disabled={notifications.length === 0}
                className="flex items-center gap-2 bg-red-900/40 hover:bg-red-800/60 disabled:opacity-40 text-red-300 px-4 py-2.5 rounded-xl font-medium transition"
              >
                <Trash2 size={16} /> Delete All
              </button>
            </div>
            <div className="overflow-x-auto rounded-xl border border-dark-600">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-dark-800 text-left text-gray-400">
                    <th className="px-4 py-3">Title</th>
                    <th className="px-4 py-3">Message</th>
                    <th className="px-4 py-3">When</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Sent</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {notifications.map((n) => (
                    <tr key={n._id} className="border-t border-dark-700">
                      <td className="px-4 py-3 text-white font-medium max-w-[160px] truncate">{n.title}</td>
                      <td className="px-4 py-3 text-gray-400 max-w-[220px] truncate">{n.body}</td>
                      <td className="px-4 py-3 text-gray-400 text-xs">
                        {n.status === 'scheduled' && n.scheduledAt
                          ? new Date(n.scheduledAt).toLocaleString()
                          : n.sentAt
                          ? new Date(n.sentAt).toLocaleString()
                          : new Date(n.createdAt).toLocaleString()}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full ${
                            n.status === 'sent'
                              ? 'bg-green-900/40 text-green-400'
                              : n.status === 'scheduled'
                              ? 'bg-amber-900/40 text-amber-400'
                              : n.status === 'cancelled'
                              ? 'bg-gray-700 text-gray-400'
                              : 'bg-red-900/40 text-red-400'
                          }`}
                        >
                          {n.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-400">
                        {n.status === 'sent' || n.status === 'failed' ? `${n.sentCount}/${n.sentCount + n.failedCount}` : '—'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {n.status === 'scheduled' && (
                          <button
                            onClick={() => cancelNotification(n._id)}
                            className="p-2 rounded-lg bg-dark-700 hover:bg-red-900/50 text-gray-300 hover:text-red-400"
                          >
                            <Trash2 size={15} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {notifications.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                        No notifications yet
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ========== PROMPT FORM MODAL ========== */}
        {showForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
            <div className="bg-dark-800 border border-dark-600 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between p-5 border-b border-dark-600">
                <h2 className="text-lg font-semibold text-white">
                  {editingId ? 'Edit Prompt' : 'New Prompt'}
                </h2>
                <button
                  onClick={() => setShowForm(false)}
                  className="text-gray-400 hover:text-white"
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleSave} className="p-5 space-y-4">
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">
                    Title *
                  </label>
                  <input
                    value={form.title}
                    onChange={(e) =>
                      setForm({ ...form, title: e.target.value })
                    }
                    className="w-full px-3 py-2.5 bg-dark-900 border border-dark-600 rounded-lg text-sm text-white"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs text-gray-400 mb-1 block">
                    Prompt Text *
                  </label>
                  <textarea
                    value={form.promptText}
                    onChange={(e) =>
                      setForm({ ...form, promptText: e.target.value })
                    }
                    rows={4}
                    className="w-full px-3 py-2.5 bg-dark-900 border border-dark-600 rounded-lg text-sm text-white resize-none"
                    required
                  />
                </div>

                {/* Image UPLOAD only — no URL */}
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">
                    Image * (Upload only, no link)
                  </label>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageSelect}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="w-full flex items-center justify-center gap-2 py-3 border border-dashed border-dark-500 rounded-xl text-sm text-gray-300 hover:border-violet-500 hover:text-white transition"
                  >
                    <Upload size={18} />
                    {imageFile ? imageFile.name : 'Choose image file'}
                  </button>
                  {imagePreview && (
                    <img
                      src={imagePreview}
                      alt="preview"
                      className="mt-2 h-28 rounded-lg object-cover"
                    />
                  )}
                </div>

                <div>
                  <label className="text-xs text-gray-400 mb-1 block">
                    Category *
                  </label>
                  <select
                    value={form.category}
                    onChange={(e) =>
                      setForm({ ...form, category: e.target.value })
                    }
                    className="w-full px-3 py-2.5 bg-dark-900 border border-dark-600 rounded-lg text-sm text-white"
                    required
                  >
                    <option value="">Select category</option>
                    {categories.map((c) => (
                      <option key={c._id} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-gray-500 mt-1">
                    Category nahi dikhi? Pehle Categories tab se add karo.
                  </p>
                </div>

                <div>
                  <label className="text-xs text-gray-400 mb-1 block">
                    Tags (comma separated)
                  </label>
                  <input
                    value={form.tags}
                    onChange={(e) =>
                      setForm({ ...form, tags: e.target.value })
                    }
                    className="w-full px-3 py-2.5 bg-dark-900 border border-dark-600 rounded-lg text-sm text-white"
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    className="flex-1 py-2.5 rounded-xl border border-dark-500 text-gray-300"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-violet-600 text-white font-medium disabled:opacity-50"
                  >
                    <Save size={16} />
                    {saving ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
