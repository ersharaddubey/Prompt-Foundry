import { useState, useEffect } from 'react';
import { Menu, X } from 'lucide-react';
import api from '../api/axios';

// Fallback if API fails
export const CATEGORIES = ['All Prompts'];

export default function Sidebar({ category, setCategory }) {
  const [open, setOpen] = useState(true);
  const [cats, setCats] = useState(['All Prompts']);

  useEffect(() => {
    api
      .get('/categories')
      .then(({ data }) => {
        const names = (data || []).map((c) => c.name);
        setCats(['All Prompts', ...names]);
      })
      .catch(() => {
        // keep default
      });
  }, []);

  return (
    <>
      <button
        onClick={() => setOpen(!open)}
        className="lg:hidden fixed bottom-6 left-6 z-50 w-12 h-12 rounded-full bg-violet-600 text-white flex items-center justify-center shadow-lg"
        aria-label="Toggle categories"
      >
        {open ? <X size={22} /> : <Menu size={22} />}
      </button>

      <aside
        className={`
          fixed top-[57px] left-0 bottom-0 z-40 w-64 bg-dark-800 border-r border-dark-700
          overflow-y-auto transition-transform duration-300
          ${open ? 'translate-x-0' : '-translate-x-full'}
          lg:translate-x-0
        `}
      >
        <div className="p-4">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 px-2">
            Categories
          </h2>
          <nav className="space-y-0.5">
            {cats.map((cat) => (
              <button
                key={cat}
                onClick={() => {
                  setCategory(cat);
                  setOpen(false);
                }}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition ${
                  category === cat
                    ? 'bg-violet-600/20 text-violet-300 font-medium'
                    : 'text-gray-400 hover:bg-dark-700 hover:text-white'
                }`}
              >
                {cat}
              </button>
            ))}
          </nav>
        </div>
      </aside>

      {open && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-30 top-[57px]"
          onClick={() => setOpen(false)}
        />
      )}
    </>
  );
}
