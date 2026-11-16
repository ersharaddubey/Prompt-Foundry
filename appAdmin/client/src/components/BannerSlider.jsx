import { useEffect, useState } from 'react';
import api from '../api/axios';

export default function BannerSlider() {
  const [banners, setBanners] = useState([]);
  const [active, setActive] = useState(0);
  useEffect(() => { api.get('/banners').then(({ data }) => setBanners(Array.isArray(data) ? data : [])).catch(() => {}); }, []);
  useEffect(() => {
    if (banners.length < 2) return undefined;
    const timer = setInterval(() => setActive((i) => (i + 1) % banners.length), 4000);
    return () => clearInterval(timer);
  }, [banners.length]);
  if (!banners.length) return null;
  const item = banners[active];
  return (
    <div className="w-full">
      <a href={item.linkUrl} target="_blank" rel="noreferrer" className="block relative overflow-hidden rounded-2xl border border-dark-600 bg-dark-800">
        <img src={item.imageUrl} alt={item.title || 'Explore'} className="w-full aspect-[16/7] object-cover" />
        {item.title ? <span className="absolute inset-x-0 bottom-0 bg-black/60 px-4 py-3 text-sm font-medium text-white">{item.title}</span> : null}
      </a>
      {banners.length > 1 ? <div className="mt-3 flex justify-center gap-2">{banners.map((b, i) => <button key={b._id || i} aria-label={`Go to slide ${i + 1}`} onClick={() => setActive(i)} className={`h-1.5 rounded-full transition-all ${i === active ? 'w-6 bg-violet-400' : 'w-1.5 bg-dark-500'}`} />)}</div> : null}
    </div>
  );
}
