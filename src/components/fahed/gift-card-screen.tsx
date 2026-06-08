'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTheme } from 'next-themes';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Gift, Send, Copy, CheckCircle2, Share2,
  MessageCircle, Palette, User, FileText, ChevronLeft,
  ChevronRight, Clock, Check, X, Eye, Sparkles, Wallet
} from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { currencySymbols, currencyNames, formatNumber, generateReference } from '@/lib/utils';
import { ref, set, get, push, onValue, update } from 'firebase/database';
import { database } from '@/lib/firebase';
import { LOGO_BASE64 } from '@/lib/logo';

type Currency = 'YER' | 'SAR' | 'USD';
type CardTheme = 'red' | 'green' | 'blue' | 'gold';

interface GiftCard {
  code: string;
  fromUserId: string;
  fromUserName: string;
  toName: string;
  amount: number;
  currency: Currency;
  message: string;
  cardTheme: CardTheme;
  createdAt: string;
  isRedeemed: boolean;
  redeemedBy: string;
}

const cardThemes: { id: CardTheme; name: string; gradient: string; textColor: string; accentColor: string }[] = [
  { id: 'red', name: 'أحمر', gradient: 'linear-gradient(135deg, #DC2626 0%, #991B1B 50%, #7F1D1D 100%)', textColor: '#FFFFFF', accentColor: '#FCA5A5' },
  { id: 'green', name: 'أخضر', gradient: 'linear-gradient(135deg, #059669 0%, #065F46 50%, #064E3B 100%)', textColor: '#FFFFFF', accentColor: '#6EE7B7' },
  { id: 'blue', name: 'أزرق', gradient: 'linear-gradient(135deg, #2563EB 0%, #1E40AF 50%, #1E3A8A 100%)', textColor: '#FFFFFF', accentColor: '#93C5FD' },
  { id: 'gold', name: 'ذهبي', gradient: 'linear-gradient(135deg, #D97706 0%, #B45309 50%, #92400E 100%)', textColor: '#FFFFFF', accentColor: '#FDE68A' },
];

function GiftCardPreview({ theme: t, amount: a, currency: c, toName: to, message: m, code: cd, fromName }: {
  theme: CardTheme; amount: number; currency: Currency; toName: string;
  message: string; code?: string; fromName?: string;
}) {
  const themeData = cardThemes.find(th => th.id === t)!;
  return (
    <div className="relative w-full rounded-2xl overflow-hidden" style={{
      background: themeData.gradient,
      minHeight: 200,
      boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
    }}>
      {/* Decorative circles */}
      <div className="absolute -top-10 -left-10 w-40 h-40 rounded-full opacity-10" style={{ background: themeData.accentColor }} />
      <div className="absolute -bottom-8 -right-8 w-32 h-32 rounded-full opacity-10" style={{ background: themeData.accentColor }} />
      <div className="absolute top-1/2 -left-6 w-20 h-20 rounded-full opacity-5" style={{ background: themeData.accentColor }} />

      {/* Card content */}
      <div className="relative p-5 flex flex-col justify-between" style={{ minHeight: 200 }}>
        {/* Top row: Logo + label */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <img src={LOGO_BASE64} alt="محفظة الجنوب" className="w-8 h-8 rounded-lg" style={{ filter: 'brightness(0) invert(1)' }} />
            <div>
              <p className="text-xs font-bold" style={{ color: themeData.accentColor }}>بطاقة هدية</p>
              <p className="text-[10px] opacity-70" style={{ color: themeData.textColor }}>محفظة الجنوب</p>
            </div>
          </div>
          <Sparkles size={20} style={{ color: themeData.accentColor }} />
        </div>

        {/* Middle: Amount */}
        <div className="my-4">
          <p className="text-3xl font-bold" style={{ color: themeData.textColor }}>
            {formatNumber(a)} <span className="text-lg">{currencySymbols[c]}</span>
          </p>
          <p className="text-xs mt-1 opacity-70" style={{ color: themeData.textColor }}>{currencyNames[c]}</p>
        </div>

        {/* Bottom row */}
        <div className="flex items-end justify-between">
          <div>
            <p className="text-[10px] opacity-60" style={{ color: themeData.textColor }}>إلى</p>
            <p className="text-sm font-bold" style={{ color: themeData.textColor }}>{toName || '---------'}</p>
            {m && <p className="text-[10px] opacity-70 mt-0.5 max-w-[180px] truncate" style={{ color: themeData.textColor }}>{m}</p>}
          </div>
          <div className="text-left">
            {fromName && (
              <p className="text-[10px] opacity-60" style={{ color: themeData.textColor }}>من: {fromName}</p>
            )}
            {cd && (
              <p className="text-[10px] font-mono mt-0.5 opacity-80" style={{ color: themeData.accentColor }} dir="ltr">{cd}</p>
            )}
          </div>
        </div>
      </div>

      {/* Card chip decoration */}
      <div className="absolute left-1/2 top-0 w-6 h-3 rounded-b-md" style={{ background: themeData.accentColor, opacity: 0.3, transform: 'translateX(-50%)' }} />
    </div>
  );
}

export default function GiftCardScreen() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const { setActiveScreen, user } = useAppStore();

  // Form state
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState<Currency>('YER');
  const [recipientName, setRecipientName] = useState('');
  const [personalMessage, setPersonalMessage] = useState('');
  const [cardTheme, setCardTheme] = useState<CardTheme>('red');
  const [showPreview, setShowPreview] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [sentSuccess, setSentSuccess] = useState(false);
  const [generatedCode, setGeneratedCode] = useState('');

  // Sent cards list
  const [sentCards, setSentCards] = useState<GiftCard[]>([]);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<'create' | 'sent'>('create');

  // Card style helpers
  const cardBg = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.85)';
  const inputBg = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)';
  const textColor = isDark ? '#FFF' : '#1a1a1a';
  const subTextColor = isDark ? '#888' : '#AAA';
  const borderColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';

  // Listen to sent gift cards
  useEffect(() => {
    if (!user?.id) return;
    const giftRef = ref(database, 'giftCards');
    const unsubscribe = onValue(giftRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const cardsList = Object.values(data) as GiftCard[];
        const myCards = cardsList
          .filter(c => c.fromUserId === user.id)
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setSentCards(myCards);
      } else {
        setSentCards([]);
      }
    });
    return () => unsubscribe();
  }, [user?.id]);

  const generateGiftCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = 'SW-';
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  };

  const handlePreview = () => {
    if (!amount || parseFloat(amount) <= 0 || !recipientName) return;
    setShowPreview(true);
  };

  const handleSend = async () => {
    if (!user?.id || !amount || parseFloat(amount) <= 0 || !recipientName) return;
    setIsSending(true);
    try {
      const code = generateGiftCode();
      setGeneratedCode(code);
      const giftCard: GiftCard = {
        code,
        fromUserId: user.id,
        fromUserName: user.name || 'مستخدم',
        toName: recipientName,
        amount: parseFloat(amount),
        currency,
        message: personalMessage,
        cardTheme,
        createdAt: new Date().toISOString(),
        isRedeemed: false,
        redeemedBy: '',
      };
      await set(ref(database, `giftCards/${code}`), giftCard);
      setSentSuccess(true);
      // Reset form
      setAmount('');
      setRecipientName('');
      setPersonalMessage('');
      setShowPreview(false);
    } catch (error) {
      console.error('Error sending gift card:', error);
    }
    setIsSending(false);
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard?.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handleWhatsAppShare = (code: string) => {
    const message = `🎉 لقد أرسلت لك بطاقة هدية من محفظة الجنوب!\n\nكود الهدية: ${code}\n\nقم بإدخال الكود في تطبيق محفظة الجنوب لاستلام الهدية.`;
    const url = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: isDark ? '#0F0F0F' : '#F5F5F5', direction: 'rtl' }}>
      {/* Header */}
      <div className="relative overflow-hidden flex-shrink-0" style={{ background: 'linear-gradient(145deg, #1A0A2E 0%, #2D1B4E 50%, #0F0F0F 100%)' }}>
        <div className="absolute inset-0 opacity-30" style={{ background: 'radial-gradient(circle at 30% 50%, rgba(230,0,0,0.3) 0%, transparent 60%)' }} />
        <div className="relative px-4 pt-4 pb-4">
          <div className="flex items-center gap-3">
            <motion.button whileTap={{ scale: 0.9 }} onClick={() => setActiveScreen('account')} className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.1)' }}>
              <ArrowLeft size={18} strokeWidth={1.5} color="#FFF" />
            </motion.button>
            <div className="flex-1">
              <h1 className="text-white text-lg font-bold">بطاقة هدية</h1>
              <p className="text-white/40 text-[10px]">أرسل هدية لمن تحب</p>
            </div>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(230,0,0,0.2)', boxShadow: '0 4px 12px rgba(230,0,0,0.3)' }}>
              <Gift size={20} strokeWidth={1.5} color="#E60000" />
            </div>
          </div>
        </div>
      </div>

      {/* Tab Switcher */}
      <div className="px-4 pt-3">
        <div className="flex gap-2 p-1 rounded-2xl" style={{ background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }}>
          <button
            onClick={() => setActiveView('create')}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-all"
            style={{
              background: activeView === 'create' ? '#E60000' : 'transparent',
              color: activeView === 'create' ? '#FFF' : subTextColor,
            }}
          >
            إنشاء بطاقة
          </button>
          <button
            onClick={() => setActiveView('sent')}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-all"
            style={{
              background: activeView === 'sent' ? '#E60000' : 'transparent',
              color: activeView === 'sent' ? '#FFF' : subTextColor,
            }}
          >
            بطاقاتي المرسلة
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 pt-3 pb-8">
        <AnimatePresence mode="wait">
          {activeView === 'create' ? (
            <motion.div key="create" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="space-y-3">
              {/* Success Message */}
              <AnimatePresence>
                {sentSuccess && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="rounded-2xl p-4 text-center"
                    style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.2)' }}
                  >
                    <CheckCircle2 size={40} color="#10B981" className="mx-auto mb-2" />
                    <h3 className="text-base font-bold mb-1" style={{ color: '#10B981' }}>تم إرسال الهدية بنجاح!</h3>
                    <p className="text-sm mb-3" style={{ color: isDark ? '#AAA' : '#666' }}>كود الهدية:</p>
                    <div className="flex items-center justify-center gap-2 mb-3">
                      <span className="text-xl font-mono font-bold tracking-wider" style={{ color: textColor }} dir="ltr">{generatedCode}</span>
                      <button onClick={() => handleCopyCode(generatedCode)} className="p-2 rounded-lg" style={{ background: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)' }}>
                        {copiedCode === generatedCode ? <Check size={16} color="#10B981" /> : <Copy size={16} color={subTextColor} />}
                      </button>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleWhatsAppShare(generatedCode)}
                        className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium text-white"
                        style={{ background: '#25D366' }}
                      >
                        <MessageCircle size={16} />
                        <span>واتساب</span>
                      </button>
                      <button
                        onClick={() => { setSentSuccess(false); setGeneratedCode(''); }}
                        className="flex-1 py-2.5 rounded-xl text-sm font-medium"
                        style={{ background: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)', color: textColor }}
                      >
                        بطاقة جديدة
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {!sentSuccess && !showPreview && (
                <>
                  {/* Card Theme Selector */}
                  <div className="rounded-2xl p-4" style={{ background: cardBg, border: `1px solid ${borderColor}` }}>
                    <div className="flex items-center gap-2 mb-3">
                      <Palette size={16} color="#E60000" />
                      <h3 className="text-sm font-bold" style={{ color: textColor }}>تصميم البطاقة</h3>
                    </div>
                    <div className="flex gap-3 justify-center">
                      {cardThemes.map((t) => (
                        <button
                          key={t.id}
                          onClick={() => setCardTheme(t.id)}
                          className="relative w-14 h-14 rounded-xl transition-all"
                          style={{
                            background: t.gradient,
                            border: cardTheme === t.id ? `3px solid ${t.accentColor}` : '3px solid transparent',
                            transform: cardTheme === t.id ? 'scale(1.1)' : 'scale(1)',
                            boxShadow: cardTheme === t.id ? `0 4px 12px ${t.accentColor}40` : 'none',
                          }}
                        >
                          <span className="text-[8px] font-bold absolute bottom-1 left-0 right-0 text-center" style={{ color: t.textColor }}>{t.name}</span>
                          {cardTheme === t.id && (
                            <Check size={12} style={{ color: t.accentColor }} className="absolute top-1 right-1" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Amount Input */}
                  <div className="rounded-2xl p-4" style={{ background: cardBg, border: `1px solid ${borderColor}` }}>
                    <div className="flex items-center gap-2 mb-3">
                      <Wallet size={16} color="#E60000" />
                      <h3 className="text-sm font-bold" style={{ color: textColor }}>مبلغ الهدية</h3>
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        placeholder="المبلغ"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        className="flex-1 px-3 py-3 rounded-xl text-lg font-bold outline-none"
                        style={{ background: inputBg, color: textColor }}
                        dir="ltr"
                      />
                      <select
                        value={currency}
                        onChange={(e) => setCurrency(e.target.value as Currency)}
                        className="px-3 py-3 rounded-xl text-sm font-bold outline-none"
                        style={{ background: inputBg, color: textColor }}
                      >
                        <option value="YER">ر.ي</option>
                        <option value="SAR">ر.س</option>
                        <option value="USD">$</option>
                      </select>
                    </div>
                  </div>

                  {/* Recipient Name */}
                  <div className="rounded-2xl p-4" style={{ background: cardBg, border: `1px solid ${borderColor}` }}>
                    <div className="flex items-center gap-2 mb-3">
                      <User size={16} color="#E60000" />
                      <h3 className="text-sm font-bold" style={{ color: textColor }}>اسم المستلم</h3>
                    </div>
                    <input
                      type="text"
                      placeholder="اسم الشخص الذي سيرسل له الهدية"
                      value={recipientName}
                      onChange={(e) => setRecipientName(e.target.value)}
                      className="w-full px-3 py-3 rounded-xl text-sm outline-none"
                      style={{ background: inputBg, color: textColor }}
                    />
                  </div>

                  {/* Personal Message */}
                  <div className="rounded-2xl p-4" style={{ background: cardBg, border: `1px solid ${borderColor}` }}>
                    <div className="flex items-center gap-2 mb-3">
                      <FileText size={16} color="#E60000" />
                      <h3 className="text-sm font-bold" style={{ color: textColor }}>رسالة شخصية</h3>
                      <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: 'rgba(230,0,0,0.1)', color: '#E60000' }}>اختياري</span>
                    </div>
                    <textarea
                      placeholder="أضف رسالة شخصية مع الهدية..."
                      value={personalMessage}
                      onChange={(e) => setPersonalMessage(e.target.value)}
                      rows={2}
                      className="w-full px-3 py-3 rounded-xl text-sm outline-none resize-none"
                      style={{ background: inputBg, color: textColor }}
                    />
                  </div>

                  {/* Preview Button */}
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={handlePreview}
                    disabled={!amount || parseFloat(amount) <= 0 || !recipientName}
                    className="w-full py-3.5 rounded-2xl flex items-center justify-center gap-2 text-sm font-bold text-white"
                    style={{
                      background: (!amount || parseFloat(amount) <= 0 || !recipientName) ? '#555' : '#E60000',
                      opacity: (!amount || parseFloat(amount) <= 0 || !recipientName) ? 0.5 : 1,
                    }}
                  >
                    <Eye size={18} />
                    <span>معاينة البطاقة</span>
                  </motion.button>
                </>
              )}

              {/* Preview Mode */}
              {showPreview && !sentSuccess && (
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
                  <div className="rounded-2xl p-4" style={{ background: cardBg, border: `1px solid ${borderColor}` }}>
                    <div className="flex items-center gap-2 mb-3">
                      <Eye size={16} color="#E60000" />
                      <h3 className="text-sm font-bold" style={{ color: textColor }}>معاينة البطاقة</h3>
                    </div>
                    <GiftCardPreview
                      theme={cardTheme}
                      amount={parseFloat(amount)}
                      currency={currency}
                      toName={recipientName}
                      message={personalMessage}
                      fromName={user?.name}
                    />
                  </div>

                  <div className="flex gap-2">
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setShowPreview(false)}
                      className="flex-1 py-3.5 rounded-2xl flex items-center justify-center gap-2 text-sm font-medium"
                      style={{ background: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)', color: textColor }}
                    >
                      <ChevronRight size={16} />
                      <span>تعديل</span>
                    </motion.button>
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      onClick={handleSend}
                      disabled={isSending}
                      className="flex-[2] py-3.5 rounded-2xl flex items-center justify-center gap-2 text-sm font-bold text-white"
                      style={{ background: '#E60000' }}
                    >
                      {isSending ? (
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <>
                          <Send size={16} />
                          <span>إرسال الهدية</span>
                        </>
                      )}
                    </motion.button>
                  </div>
                </motion.div>
              )}
            </motion.div>
          ) : (
            /* Sent Cards List */
            <motion.div key="sent" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-3">
              {sentCards.length > 0 ? (
                sentCards.map((card) => {
                  const themeData = cardThemes.find(t => t.id === card.cardTheme) || cardThemes[0];
                  return (
                    <motion.div
                      key={card.code}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="rounded-2xl overflow-hidden"
                      style={{ background: cardBg, border: `1px solid ${borderColor}` }}
                    >
                      {/* Mini card preview */}
                      <div className="relative p-4" style={{ background: themeData.gradient }}>
                        <div className="absolute -top-6 -left-6 w-20 h-20 rounded-full opacity-10" style={{ background: themeData.accentColor }} />
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <img src={LOGO_BASE64} alt="" className="w-5 h-5 rounded" style={{ filter: 'brightness(0) invert(1)' }} />
                              <span className="text-[10px] font-bold" style={{ color: themeData.accentColor }}>بطاقة هدية</span>
                            </div>
                            <p className="text-xl font-bold" style={{ color: themeData.textColor }}>
                              {formatNumber(card.amount)} {currencySymbols[card.currency]}
                            </p>
                          </div>
                          <div className="text-left">
                            <p className="text-[10px] opacity-60" style={{ color: themeData.textColor }}>إلى: {card.toName}</p>
                            <p className="text-[10px] opacity-60" style={{ color: themeData.textColor }}>من: {card.fromUserName}</p>
                          </div>
                        </div>
                      </div>

                      {/* Card details */}
                      <div className="p-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-mono" style={{ color: subTextColor }} dir="ltr">{card.code}</span>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleCopyCode(card.code)}
                              className="p-1.5 rounded-lg"
                              style={{ background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)' }}
                            >
                              {copiedCode === card.code ? <Check size={14} color="#10B981" /> : <Copy size={14} color={subTextColor} />}
                            </button>
                            <button
                              onClick={() => handleWhatsAppShare(card.code)}
                              className="p-1.5 rounded-lg"
                              style={{ background: 'rgba(37,211,102,0.12)' }}
                            >
                              <MessageCircle size={14} color="#25D366" />
                            </button>
                          </div>
                        </div>
                        {card.message && (
                          <p className="text-xs italic" style={{ color: subTextColor }}>"{card.message}"</p>
                        )}
                        <div className="flex items-center justify-between">
                          <span className="text-[10px]" style={{ color: subTextColor }}>
                            <Clock size={10} className="inline ml-1" />
                            {new Date(card.createdAt).toLocaleDateString('ar-SA')}
                          </span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{
                            background: card.isRedeemed ? 'rgba(16,185,129,0.15)' : 'rgba(230,0,0,0.15)',
                            color: card.isRedeemed ? '#10B981' : '#E60000',
                          }}>
                            {card.isRedeemed ? 'تم الاستلام' : 'في الانتظار'}
                          </span>
                        </div>
                      </div>
                    </motion.div>
                  );
                })
              ) : (
                <div className="flex flex-col items-center py-12">
                  <Gift size={48} strokeWidth={1.5} color={isDark ? '#333' : '#DDD'} />
                  <p className="text-sm mt-3 font-bold" style={{ color: subTextColor }}>لا توجد بطاقات مرسلة</p>
                  <p className="text-xs mt-1" style={{ color: isDark ? '#555' : '#BBB' }}>أرسل بطاقة هدية لمن تحب</p>
                  <button
                    onClick={() => setActiveView('create')}
                    className="mt-4 px-6 py-2.5 rounded-xl text-sm font-bold text-white"
                    style={{ background: '#E60000' }}
                  >
                    إنشاء بطاقة
                  </button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
