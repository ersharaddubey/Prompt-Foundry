import { Link, useNavigate } from 'react-router-dom';
import { Search, Sparkles, Heart, LogOut, LayoutDashboard, CreditCard, History, Trophy, Swords } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export default function Navbar({ onSearch }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);

  const handleSearch = (e) => {
    e.preventDefault();
    if (onSearch) onSearch(search);
  };

  return (
    <nav className="sticky top-0 z-50 bg-dark-900/95 backdrop-blur-md border-b border-dark-600">
      <div className="max-w-[1600px] mx-auto px-4 py-3 flex items-center justify-between gap-4">
        <Link to="/" className="flex items-center gap-2 shrink-0">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center">
            <Sparkles size={18} className="text-white" />
          </div>
          <span className="text-xl font-bold tracking-tight hidden sm:block">
            somyalaya
          </span>
        </Link>

        <form onSubmit={handleSearch} className="flex-1 max-w-xl hidden md:flex">
          <div className="relative w-full">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              size={18}
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search prompts, styles, artists..."
              className="w-full bg-dark-700 border border-dark-500 rounded-full py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:border-violet-500 transition"
            />
          </div>
        </form>

        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            to="/challenge"
            className="hidden lg:flex items-center gap-1.5 text-sm text-gray-300 hover:text-white px-2 py-2"
          >
            <Trophy size={16} />
            Challenge
          </Link>
          <Link
            to="/battle"
            className="hidden lg:flex items-center gap-1.5 text-sm text-gray-300 hover:text-white px-2 py-2"
          >
            <Swords size={16} />
            Battle
          </Link>
          <Link
            to="/history"
            className="hidden lg:flex items-center gap-1.5 text-sm text-gray-300 hover:text-white px-2 py-2"
          >
            <History size={16} />
            History
          </Link>
          <Link
            to="/pricing"
            className="hidden sm:flex items-center gap-1.5 text-sm text-gray-300 hover:text-white px-3 py-2"
          >
            <CreditCard size={16} />
            Pricing
          </Link>

          <Link
            to="/generate"
            className="flex items-center gap-1.5 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white px-3 sm:px-4 py-2 rounded-full text-sm font-medium transition"
          >
            <Sparkles size={16} />
            <span className="hidden sm:inline">Generate</span>
          </Link>

          {user ? (
            <div className="relative">
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="flex items-center gap-2 bg-dark-700 hover:bg-dark-600 rounded-full px-3 py-1.5 transition"
              >
                <div className="w-7 h-7 rounded-full bg-violet-600 flex items-center justify-center text-xs font-bold">
                  {user.name?.[0]?.toUpperCase()}
                </div>
                <span className="text-sm hidden sm:block">{user.name}</span>
              </button>

              {menuOpen && (
                <div className="absolute right-0 mt-2 w-52 bg-dark-700 border border-dark-500 rounded-xl shadow-xl py-2 z-50">
                  <div className="px-4 py-2 border-b border-dark-500">
                    <p className="text-xs text-gray-400">Credits</p>
                    <p className="text-sm font-medium">
                      {user.credits || 0} credits
                    </p>
                  </div>
                  <Link
                    to="/pricing"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2 px-4 py-2.5 hover:bg-dark-600 text-sm"
                  >
                    <CreditCard size={16} /> Buy Credits
                  </Link>
                  <Link
                    to="/favorites"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2 px-4 py-2.5 hover:bg-dark-600 text-sm"
                  >
                    <Heart size={16} /> Favorites
                  </Link>
                  <Link
                    to="/admin"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2 px-4 py-2.5 hover:bg-dark-600 text-sm"
                  >
                    <LayoutDashboard size={16} /> Admin Panel
                  </Link>
                  <button
                    onClick={() => {
                      logout();
                      setMenuOpen(false);
                      navigate('/');
                    }}
                    className="flex items-center gap-2 px-4 py-2.5 hover:bg-dark-600 text-sm w-full text-left text-red-400"
                  >
                    <LogOut size={16} /> Logout
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                to="/login"
                className="text-sm text-gray-300 hover:text-white px-3 py-2"
              >
                Log in
              </Link>
              <Link
                to="/register"
                className="text-sm bg-white text-black hover:bg-gray-200 px-4 py-2 rounded-full font-medium transition"
              >
                Sign up
              </Link>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
