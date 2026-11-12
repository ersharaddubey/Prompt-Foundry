import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Check, Sparkles, Tag } from 'lucide-react';
import Navbar from '../components/Navbar';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';

const PLANS = [
  {
    id: 'starter',
    name: 'Starter',
    price: 14,
    credits: 4000,
    images: '~4,000',
    color: 'border-gray-600',
    btn: 'bg-white text-black hover:bg-gray-100',
    features: [
      '4,000 credits / month',
      'Up to ~4,000 images',
      'Basic models access',
      'Watermark-free',
      'Commercial use rights',
    ],
  },
  {
    id: 'plus',
    name: 'Plus',
    price: 34,
    credits: 12000,
    images: '~12,000',
    color: 'border-cyan-500/50',
    btn: 'bg-white text-black hover:bg-gray-100',
    features: [
      '12,000 credits / month',
      'Up to ~12,000 images',
      'Add credits as needed',
      'Premium models',
      'Watermark-free',
      'Commercial use rights',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 56,
    credits: 24000,
    images: '~24,000',
    popular: true,
    color: 'border-fuchsia-500',
    btn: 'bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white hover:from-violet-500 hover:to-fuchsia-500',
    features: [
      '24,000 credits / month',
      'Up to ~24,000 images',
      'All premium models',
      'Priority support',
      'Watermark-free',
      'Commercial use rights',
    ],
  },
  {
    id: 'wonder',
    name: 'Wonder',
    price: 240,
    credits: 106000,
    images: '~106,000',
    best: true,
    color: 'border-yellow-500/60',
    btn: 'bg-yellow-400 text-black hover:bg-yellow-300',
    features: [
      '106,000 credits / month',
      'Up to ~106,000 images',
      'Unlimited creation feel',
      'All models + priority',
      'Watermark-free',
      'Commercial use rights',
    ],
  },
];

export default function Pricing() {
  const { user, updateUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from || '/generate';

  const [promoCode, setPromoCode] = useState('');
  const [promoMsg, setPromoMsg] = useState('');
  const [promoLoading, setPromoLoading] = useState(false);

  const handleRedeem = async (e) => {
    e.preventDefault();
    if (!user) {
      navigate('/login', { state: { from: '/pricing' } });
      return;
    }
    if (!promoCode.trim()) return;

    setPromoLoading(true);
    setPromoMsg('');
    try {
      const { data } = await api.post('/promo/redeem', { code: promoCode.trim() });
      updateUser({ credits: data.credits, dailyCredits: data.dailyCredits });
      setPromoMsg(data.message);
      setPromoCode('');
    } catch (err) {
      setPromoMsg(err.response?.data?.message || 'Invalid code');
    } finally {
      setPromoLoading(false);
    }
  };

  const handleSelectPlan = (plan) => {
    if (!user) {
      navigate('/login', { state: { from: '/pricing' } });
      return;
    }
    // Placeholder — integrate Razorpay / Stripe later
    alert(
      `Selected ${plan.name} ($${plan.price}/mo — ${plan.credits} credits).\n\nPayment gateway integrate karna baki hai (Razorpay/Stripe).\nAbhi ke liye Promo Code se credits add kar sakte ho.`
    );
  };

  return (
    <div className="min-h-screen bg-dark-900">
      <Navbar />

      <div className="max-w-6xl mx-auto px-4 py-12">
        <div className="text-center mb-10">
          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-3">
            Choose your plan
          </h1>
          <p className="text-gray-400 max-w-xl mx-auto">
            Credits chahiye generation ke liye. Package kharido ya Promo Code use karo.
          </p>
        </div>

        {/* Promo code box */}
        <div className="max-w-md mx-auto mb-12 bg-dark-800 border border-dark-600 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3 text-sm text-gray-300">
            <Tag size={16} className="text-violet-400" />
            Have a promo code?
          </div>
          <form onSubmit={handleRedeem} className="flex gap-2">
            <input
              type="text"
              value={promoCode}
              onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
              placeholder="ENTER CODE"
              className="flex-1 px-4 py-2.5 bg-dark-900 border border-dark-600 rounded-xl text-sm text-white uppercase tracking-wider focus:outline-none focus:border-violet-500"
            />
            <button
              type="submit"
              disabled={promoLoading}
              className="px-5 py-2.5 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-sm font-medium transition disabled:opacity-50"
            >
              {promoLoading ? '...' : 'Apply'}
            </button>
          </form>
          {promoMsg && (
            <p
              className={`mt-2 text-sm ${
                promoMsg.includes('Success') ? 'text-green-400' : 'text-red-400'
              }`}
            >
              {promoMsg}
            </p>
          )}
          {user && (
            <p className="mt-3 text-xs text-gray-500">
              Your balance: <span className="text-white font-medium">{user.credits || 0}</span> credits
            </p>
          )}
        </div>

        {/* Plans */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {PLANS.map((plan) => (
            <div
              key={plan.id}
              className={`relative rounded-2xl border bg-dark-800 p-6 flex flex-col ${plan.color}`}
            >
              {plan.popular && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-[10px] font-bold uppercase tracking-wider bg-fuchsia-600 text-white px-3 py-1 rounded-full">
                  Most Popular
                </span>
              )}
              {plan.best && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-[10px] font-bold uppercase tracking-wider bg-yellow-400 text-black px-3 py-1 rounded-full">
                  Best Value
                </span>
              )}

              <h3 className="text-lg font-semibold text-white mb-1">{plan.name}</h3>
              <div className="mb-4">
                <span className="text-3xl font-bold text-white">${plan.price}</span>
                <span className="text-gray-400 text-sm"> / month</span>
              </div>

              <p className="text-sm text-violet-300 mb-4 font-medium">
                {plan.credits.toLocaleString()} credits
              </p>

              <ul className="space-y-2.5 mb-6 flex-1">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-gray-300">
                    <Check size={15} className="text-green-400 mt-0.5 shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>

              <button
                onClick={() => handleSelectPlan(plan)}
                className={`w-full py-2.5 rounded-xl font-medium text-sm transition ${plan.btn}`}
              >
                Get Started
              </button>
            </div>
          ))}
        </div>

        <p className="text-center text-xs text-gray-500 mt-10">
          Payment gateway (Razorpay / Stripe) integrate karna baki hai. Abhi Promo Code se credits milenge.
        </p>

        <div className="text-center mt-6">
          <Link
            to={from}
            className="text-sm text-violet-400 hover:underline"
          >
            ← Back
          </Link>
        </div>
      </div>
    </div>
  );
}
