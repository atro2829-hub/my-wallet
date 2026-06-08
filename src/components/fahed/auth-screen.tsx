'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mail, Lock, User, Eye, EyeOff, ArrowLeft,
  Phone, KeyRound, PenLine, Trash2, Check,
  MapPin, MessageCircle, PhoneCall, ChevronLeft, ChevronRight,
  CreditCard
} from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { useTheme } from 'next-themes';
import { auth, database } from '@/lib/firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { ref, get, update, onValue, off } from 'firebase/database';
import { generateUserId } from '@/lib/utils';
import { LOGO_BASE64 } from '@/lib/logo';

// ─── Types ───────────────────────────────────────────────────────────
type AuthStep = 'login' | 'register' | 'signature' | 'password-recovery';

interface AuthBanner {
  id: string;
  imageUrl: string;
  title: string;
  description: string;
  isActive: boolean;
  order: number;
  link?: string;
}

// ─── Yemen Flag Indicator ────────────────────────────────────────────
function YemenFlagIndicator() {
  return (
    <div className="flex flex-col w-7 h-5 rounded-sm overflow-hidden shrink-0 border border-gray-200">
      <div className="flex-1 bg-red-600" />
      <div className="flex-1 bg-white" />
      <div className="flex-1 bg-black" />
    </div>
  );
}

// ─── Signature Canvas Component ──────────────────────────────────────
function SignatureCanvas({ onSignatureChange }: { onSignatureChange: (signature: string | null) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasContent, setHasContent] = useState(false);
  const lastPosRef = useRef<{ x: number; y: number } | null>(null);

  const getCanvasCoords = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    if ('touches' in e) {
      const touch = e.touches[0] || e.changedTouches[0];
      return {
        x: (touch.clientX - rect.left) * scaleX,
        y: (touch.clientY - rect.top) * scaleY,
      };
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  }, []);

  const startDrawing = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const pos = getCanvasCoords(e);
    lastPosRef.current = pos;
    setIsDrawing(true);
    setHasContent(true);

    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    ctx.lineTo(pos.x + 0.1, pos.y + 0.1);
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
  }, [getCanvasCoords]);

  const draw = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx || !lastPosRef.current) return;

    const pos = getCanvasCoords(e);
    ctx.beginPath();
    ctx.moveTo(lastPosRef.current.x, lastPosRef.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
    lastPosRef.current = pos;
  }, [isDrawing, getCanvasCoords]);

  const stopDrawing = useCallback(() => {
    setIsDrawing(false);
    lastPosRef.current = null;
    // Save signature
    const canvas = canvasRef.current;
    if (canvas && hasContent) {
      const dataUrl = canvas.toDataURL('image/png');
      onSignatureChange(dataUrl);
    }
  }, [hasContent, onSignatureChange]);

  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasContent(false);
    onSignatureChange(null);
  }, [onSignatureChange]);

  // Set canvas size on mount
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.scale(dpr, dpr);
    }
  }, []);

  return (
    <div className="w-full">
      <div
        className="relative w-full bg-white rounded-2xl border-2 border-dashed border-gray-300 overflow-hidden"
        style={{ height: '180px', touchAction: 'none' }}
      >
        {/* Signature line */}
        <div className="absolute bottom-8 left-6 right-6 border-b border-gray-300" />
        <div className="absolute bottom-2 right-6 text-[10px] text-gray-400">
          التوقيع
        </div>

        <canvas
          ref={canvasRef}
          className="w-full h-full cursor-crosshair"
          style={{ touchAction: 'none' }}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
        />

        {!hasContent && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="flex flex-col items-center gap-2 opacity-30">
              <PenLine size={32} />
              <span className="text-xs text-gray-500">وقّع هنا</span>
            </div>
          </div>
        )}
      </div>

      {hasContent && (
        <button
          onClick={clearCanvas}
          className="mt-3 flex items-center gap-1.5 text-xs text-gray-500 hover:text-red-500 transition-colors mx-auto"
        >
          <Trash2 size={14} />
          مسح التوقيع
        </button>
      )}
    </div>
  );
}

// ─── Banner Carousel ─────────────────────────────────────────────────
function BannerCarousel({ banners }: { banners: AuthBanner[] }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (banners.length <= 1) return;

    intervalRef.current = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % banners.length);
    }, 4000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [banners.length]);

  if (!banners || banners.length === 0) return null;

  const goTo = (index: number) => {
    setCurrentIndex(index);
    // Reset auto-rotation timer
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % banners.length);
    }, 4000);
  };

  return (
    <div className="w-full">
      <div className="relative w-full overflow-hidden rounded-xl" style={{ height: '130px' }}>
        <AnimatePresence mode="wait">
          <motion.div
            key={banners[currentIndex].id}
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            transition={{ duration: 0.3 }}
            className="absolute inset-0"
          >
            <img
              src={banners[currentIndex].imageUrl}
              alt={banners[currentIndex].title || 'banner'}
              className="w-full h-full object-cover"
            />
            {/* No red overlay - show as-is */}
          </motion.div>
        </AnimatePresence>

        {/* Navigation arrows */}
        {banners.length > 1 && (
          <>
            <button
              onClick={() => goTo((currentIndex - 1 + banners.length) % banners.length)}
              className="absolute left-1 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-white/80 backdrop-blur-sm flex items-center justify-center shadow-sm"
            >
              <ChevronLeft size={14} className="text-gray-700" />
            </button>
            <button
              onClick={() => goTo((currentIndex + 1) % banners.length)}
              className="absolute right-1 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-white/80 backdrop-blur-sm flex items-center justify-center shadow-sm"
            >
              <ChevronRight size={14} className="text-gray-700" />
            </button>
          </>
        )}
      </div>

      {/* Dots indicator */}
      {banners.length > 1 && (
        <div className="flex items-center justify-center gap-1.5 mt-2">
          {banners.map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              className={`w-2 h-2 rounded-full transition-all duration-300 ${
                i === currentIndex ? 'bg-red-600 w-4' : 'bg-gray-300'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Auth Screen ────────────────────────────────────────────────
export default function AuthScreen() {
  const { setUser } = useAppStore();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [step, setStep] = useState<AuthStep>('login');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Login fields
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  // Register fields
  const [regFirstName, setRegFirstName] = useState('');
  const [regSecondName, setRegSecondName] = useState('');
  const [regThirdName, setRegThirdName] = useState('');
  const [regFamilyName, setRegFamilyName] = useState('');
  const [regNationalId, setRegNationalId] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [regPhone, setRegPhone] = useState('');
  const [regGender, setRegGender] = useState<'male' | 'female' | ''>('');
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  // Signature
  const [electronicSignature, setElectronicSignature] = useState<string | null>(null);

  // Password recovery
  const [recoveryEmail, setRecoveryEmail] = useState('');

  // Banners
  const [banners, setBanners] = useState<AuthBanner[]>([]);

  // Load banners from Firebase
  useEffect(() => {
    const bannersRef = ref(database, 'adminSettings/authBanners');
    const unsubscribe = onValue(bannersRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const bannerList: AuthBanner[] = Object.values(data)
          .filter((b: unknown) => {
            const banner = b as Record<string, unknown>;
            return banner.isActive === true;
          })
          .sort((a: unknown, b: unknown) => {
            const ba = a as Record<string, unknown>;
            const bb = b as Record<string, unknown>;
            return ((ba.order as number) || 0) - ((bb.order as number) || 0);
          }) as AuthBanner[];
        setBanners(bannerList);
      } else {
        setBanners([]);
      }
    });

    return () => {
      off(bannersRef);
    };
  }, []);

  // ─── Phone handler ──────────────────────────────────────────────
  const handlePhoneChange = (value: string) => {
    const cleaned = value.replace(/\D/g, '').slice(0, 9);
    setRegPhone(cleaned);
  };

  // ─── Login ──────────────────────────────────────────────────────
  const handleLogin = async () => {
    if (!loginEmail || !loginPassword) {
      setError('يرجى إدخال البريد الإلكتروني وكلمة المرور');
      return;
    }
    setIsLoading(true);
    setError('');
    try {
      const userCredential = await signInWithEmailAndPassword(auth, loginEmail, loginPassword);
      const uid = userCredential.user.uid;
      const userRef = ref(database, `users/${uid}`);
      const snapshot = await get(userRef);
      if (snapshot.exists()) {
        const userData = snapshot.val();
        const isAdminEmail = loginEmail.toLowerCase().includes('admin');
        let effectiveRole: 'user' | 'admin' | 'owner' = userData.role || 'user';
        if (effectiveRole === 'owner') {
          // keep
        } else if (effectiveRole === 'admin' || isAdminEmail) {
          effectiveRole = 'admin';
          if (isAdminEmail && userData.role !== 'admin') {
            await update(ref(database, `users/${uid}`), { role: 'admin' });
          }
        }
        const fullName = [userData.firstName, userData.secondName, userData.thirdName, userData.familyName].filter((n: string) => n && n.trim()).join(' ') || userData.name || '';
        setUser({
          id: uid, email: userData.email || loginEmail, phone: userData.phone || '',
          name: fullName, firstName: userData.firstName || '', secondName: userData.secondName || '',
          thirdName: userData.thirdName || '', familyName: userData.familyName || '',
          nationalId: userData.nationalId || '', avatar: userData.avatar || '', role: effectiveRole,
          userId: userData.userId || '', kycStatus: userData.kycStatus || 'pending',
          isBlocked: userData.isBlocked || false, balanceYER: userData.balanceYER || 0,
          balanceSAR: userData.balanceSAR || 0, balanceUSD: userData.balanceUSD || 0,
          cardType: userData.cardType || '', cardNumber: userData.cardNumber || '',
          cardIssuedAt: userData.cardIssuedAt || '', governorate: userData.governorate || '',
          theme: userData.theme || 'light',
        });
      } else {
        const newUserId = generateUserId();
        const isAdminEmail = loginEmail.toLowerCase().includes('admin');
        const newUserData = {
          email: loginEmail, phone: '', name: '', firstName: '', secondName: '', thirdName: '',
          familyName: '', nationalId: '', avatar: '', role: isAdminEmail ? 'admin' as const : 'user' as const,
          userId: newUserId, kycStatus: 'pending', isBlocked: false, balanceYER: 0, balanceSAR: 0,
          balanceUSD: 0, cardType: '', cardNumber: '', cardIssuedAt: '', governorate: '', theme: 'light' as const,
        };
        await update(ref(database), {
          [`users/${uid}`]: newUserData,
          [`userIds/${newUserId}`]: uid,
        });
        setUser({ id: uid, ...newUserData });
      }
    } catch (err: unknown) {
      const firebaseError = err as { code?: string };
      if (firebaseError.code === 'auth/user-not-found') setError('الحساب غير موجود');
      else if (firebaseError.code === 'auth/wrong-password' || firebaseError.code === 'auth/invalid-credential') setError('كلمة المرور غير صحيحة');
      else setError('حدث خطأ في تسجيل الدخول');
    } finally { setIsLoading(false); }
  };

  // ─── Register Step 1 Validation ─────────────────────────────────
  const handleRegisterStep1 = () => {
    if (!regFirstName.trim()) {
      setError('يرجى إدخال الاسم الأول');
      return;
    }
    if (!regSecondName.trim()) {
      setError('يرجى إدخال الاسم الثاني');
      return;
    }
    if (!regEmail) {
      setError('يرجى إدخال البريد الإلكتروني');
      return;
    }
    if (!regPassword) {
      setError('يرجى إدخال كلمة المرور');
      return;
    }
    if (regPassword.length < 6) {
      setError('كلمة المرور يجب أن تكون 6 أحرف على الأقل');
      return;
    }
    if (!regGender) {
      setError('يرجى اختيار الجنس');
      return;
    }
    if (!agreedToTerms) {
      setError('يرجى الموافقة على الشروط والأحكام');
      return;
    }
    setError('');
    setStep('signature');
  };

  // ─── Register Step 2 - Create Account with Signature ────────────
  const handleCreateAccount = async () => {
    if (!electronicSignature) {
      setError('يرجى التوقيع أدناه قبل إنشاء الحساب');
      return;
    }
    setIsLoading(true);
    setError('');
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, regEmail, regPassword);
      const uid = userCredential.user.uid;
      const newUserId = generateUserId();
      const isAdminEmail = regEmail.toLowerCase().includes('admin');
      const fullName = `${regFirstName.trim()} ${regSecondName.trim()} ${regThirdName.trim()} ${regFamilyName.trim()}`.trim();
      const userData = {
        email: regEmail,
        phone: regPhone ? `+967${regPhone}` : '',
        name: fullName,
        firstName: regFirstName.trim(),
        secondName: regSecondName.trim(),
        thirdName: regThirdName.trim(),
        familyName: regFamilyName.trim(),
        nationalId: regNationalId.trim(),
        avatar: '',
        role: isAdminEmail ? 'admin' as const : 'user' as const,
        userId: newUserId,
        kycStatus: 'pending',
        isBlocked: false,
        balanceYER: 0,
        balanceSAR: 0,
        balanceUSD: 0,
        cardType: '',
        cardNumber: '',
        cardIssuedAt: '',
        governorate: '',
        theme: 'light' as const,
        gender: regGender,
        electronicSignature: electronicSignature,
      };
      const firebaseUpdates: Record<string, unknown> = {
        [`users/${uid}`]: userData,
        [`userIds/${newUserId}`]: uid,
      };
      if (regPhone) {
        firebaseUpdates[`phones/P967${regPhone}`] = uid;
      }
      await update(ref(database), firebaseUpdates);
      setUser({
        id: uid, email: regEmail, phone: regPhone ? `+967${regPhone}` : '',
        name: fullName, firstName: regFirstName.trim(), secondName: regSecondName.trim(),
        thirdName: regThirdName.trim(), familyName: regFamilyName.trim(),
        nationalId: regNationalId.trim(), avatar: '', role: isAdminEmail ? 'admin' : 'user',
        userId: newUserId, kycStatus: 'pending',
        isBlocked: false, balanceYER: 0, balanceSAR: 0, balanceUSD: 0,
        cardType: '', cardNumber: '', cardIssuedAt: '', governorate: '',
        theme: 'light',
      });
    } catch (err: unknown) {
      const firebaseError = err as { code?: string };
      if (firebaseError.code === 'auth/email-already-in-use') setError('البريد الإلكتروني مسجل مسبقاً');
      else if (firebaseError.code === 'auth/weak-password') setError('كلمة المرور ضعيفة');
      else setError('حدث خطأ في التسجيل');
    } finally { setIsLoading(false); }
  };

  // ─── Password Reset ─────────────────────────────────────────────
  const handlePasswordReset = async () => {
    if (!recoveryEmail.trim()) {
      setError('يرجى إدخال البريد الإلكتروني');
      return;
    }
    setIsLoading(true);
    setError('');
    try {
      await sendPasswordResetEmail(auth, recoveryEmail.trim());
      setSuccess('تم إرسال رابط إعادة تعيين كلمة المرور إلى بريدك الإلكتروني');
      setTimeout(() => {
        setStep('login');
        setSuccess('');
        setRecoveryEmail('');
      }, 3000);
    } catch (err: unknown) {
      const firebaseError = err as { code?: string };
      if (firebaseError.code === 'auth/user-not-found') {
        setError('لم يتم العثور على حساب بهذا البريد');
      } else {
        setError('حدث خطأ في إرسال رابط إعادة التعيين');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // ─── Common input styles ────────────────────────────────────────
  const inputBaseClass = "w-full bg-gray-50 dark:bg-[#1A1A1A] border border-gray-200 dark:border-[rgba(255,255,255,0.08)] rounded-xl px-4 py-3.5 text-sm text-gray-900 dark:text-white outline-none transition-all focus:border-red-400 focus:ring-2 focus:ring-red-100 dark:focus:ring-red-900/30 placeholder:text-gray-400";

  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-[#0F0F0F]" dir="rtl">
      {/* ─── Header Area ─────────────────────────────────────────── */}
      <div className="flex flex-col items-center pt-10 pb-4 px-6">
        {/* Logo */}
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 15 }}
          className="w-20 h-20 rounded-2xl overflow-hidden mb-4 flex items-center justify-center"
          style={{ boxShadow: '0 4px 16px rgba(230,0,0,0.15)', background: isDark ? '#0F0F0F' : '#FFFFFF' }}
        >
          <img src={LOGO_BASE64} alt="محفظة الجنوب" className="w-full h-full object-contain p-1" />
        </motion.div>

        <motion.h1
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="text-xl font-bold text-gray-900 dark:text-white"
        >
          مرحباً بك في محفظة الجنوب
        </motion.h1>
        <motion.p
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="text-sm mt-1 text-gray-500 dark:text-gray-400"
        >
          كل ما تريد معرفته عن خدماتنا
        </motion.p>
      </div>

      {/* ─── Banner Carousel (only on login) ─────────────────────── */}
      {step === 'login' && banners.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="px-6 mb-4"
        >
          <BannerCarousel banners={banners} />
        </motion.div>
      )}

      {/* ─── Form Area ───────────────────────────────────────────── */}
      <div className="flex-1 px-6 pb-4">
        <AnimatePresence mode="wait">

          {/* ═══════════════ LOGIN ═══════════════ */}
          {step === 'login' && (
            <motion.div
              key="login"
              initial={{ x: -300, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 300, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 200, damping: 25 }}
              className="space-y-4"
            >
              {/* Email */}
              <div className="relative">
                <Mail size={18} strokeWidth={1.5} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="email"
                  placeholder="البريد الإلكتروني"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  className={`${inputBaseClass} pr-11`}
                  dir="ltr"
                  autoComplete="email"
                />
              </div>

              {/* Password */}
              <div className="relative">
                <Lock size={18} strokeWidth={1.5} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type={showLoginPassword ? 'text' : 'password'}
                  placeholder="كلمة المرور"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  className={`${inputBaseClass} pr-11 pl-11`}
                  dir="ltr"
                  autoComplete="current-password"
                />
                <button
                  onClick={() => setShowLoginPassword(!showLoginPassword)}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
                >
                  {showLoginPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>

              {error && (
                <motion.p initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} className="text-xs text-center text-red-600">{error}</motion.p>
              )}
              {success && (
                <motion.p initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} className="text-xs text-center text-emerald-600">{success}</motion.p>
              )}

              {/* Login Button */}
              <button
                onClick={handleLogin}
                disabled={isLoading}
                className="w-full py-4 rounded-xl flex items-center justify-center gap-2 font-bold text-white transition-all active:scale-[0.98] disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #E60000 0%, #B30000 100%)', boxShadow: '0 4px 16px rgba(230,0,0,0.3)' }}
              >
                {isLoading ? (
                  <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }} className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full" />
                ) : (
                  <span>تسجيل الدخول</span>
                )}
              </button>

              {/* Password Recovery */}
              <button
                onClick={() => { setStep('password-recovery'); setError(''); setSuccess(''); }}
                className="w-full text-sm text-gray-500 hover:text-red-600 transition-colors py-2"
              >
                نسيت كلمة المرور؟
              </button>

              {/* Toggle to Register */}
              <div className="text-center pt-2">
                <span className="text-sm text-gray-500">ليس لديك حساب؟ </span>
                <button
                  onClick={() => { setStep('register'); setError(''); setSuccess(''); }}
                  className="text-sm font-bold text-red-600 hover:text-red-700 transition-colors"
                >
                  أنشئ حسابك الآن
                </button>
              </div>
            </motion.div>
          )}

          {/* ═══════════════ REGISTER ═══════════════ */}
          {step === 'register' && (
            <motion.div
              key="register"
              initial={{ x: 300, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -300, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 200, damping: 25 }}
              className="space-y-3"
            >
              {/* Back + Title */}
              <div className="flex items-center gap-2 mb-1">
                <button
                  onClick={() => { setStep('login'); setError(''); setSuccess(''); }}
                  className="w-8 h-8 rounded-full flex items-center justify-center bg-gray-100 dark:bg-[#1A1A1A]"
                >
                  <ArrowLeft size={16} className="text-gray-600 dark:text-gray-300" />
                </button>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">إنشاء حساب جديد</h2>
              </div>

              {/* Step indicator */}
              <div className="flex gap-2 mb-2">
                <div className="flex-1 h-1.5 rounded-full bg-red-600" />
                <div className="flex-1 h-1.5 rounded-full bg-gray-200 dark:bg-[#333]" />
              </div>

              {/* First Name */}
              <div className="relative">
                <User size={18} strokeWidth={1.5} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="الاسم الأول"
                  value={regFirstName}
                  onChange={(e) => setRegFirstName(e.target.value)}
                  className={`${inputBaseClass} pr-11`}
                />
              </div>

              {/* Second Name */}
              <div className="relative">
                <User size={18} strokeWidth={1.5} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="الاسم الثاني"
                  value={regSecondName}
                  onChange={(e) => setRegSecondName(e.target.value)}
                  className={`${inputBaseClass} pr-11`}
                />
              </div>

              {/* Third Name */}
              <div className="relative">
                <User size={18} strokeWidth={1.5} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="السم الثالث"
                  value={regThirdName}
                  onChange={(e) => setRegThirdName(e.target.value)}
                  className={`${inputBaseClass} pr-11`}
                />
              </div>

              {/* Family Name */}
              <div className="relative">
                <User size={18} strokeWidth={1.5} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="اللقب"
                  value={regFamilyName}
                  onChange={(e) => setRegFamilyName(e.target.value)}
                  className={`${inputBaseClass} pr-11`}
                />
              </div>

              {/* National ID */}
              <div className="relative">
                <CreditCard size={18} strokeWidth={1.5} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="رقم البطاقة"
                  value={regNationalId}
                  onChange={(e) => setRegNationalId(e.target.value)}
                  className={`${inputBaseClass} pr-11`}
                  dir="ltr"
                />
              </div>

              {/* Email */}
              <div className="relative">
                <Mail size={18} strokeWidth={1.5} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="email"
                  placeholder="البريد الإلكتروني"
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  className={`${inputBaseClass} pr-11`}
                  dir="ltr"
                  autoComplete="email"
                />
              </div>

              {/* Password */}
              <div className="relative">
                <Lock size={18} strokeWidth={1.5} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type={showRegPassword ? 'text' : 'password'}
                  placeholder="كلمة المرور"
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  className={`${inputBaseClass} pr-11 pl-11`}
                  dir="ltr"
                  autoComplete="new-password"
                />
                <button
                  onClick={() => setShowRegPassword(!showRegPassword)}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
                >
                  {showRegPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>

              {/* Phone */}
              <div className="flex items-center gap-2 bg-gray-50 dark:bg-[#1A1A1A] border border-gray-200 dark:border-[rgba(255,255,255,0.08)] rounded-xl px-4 py-3.5 transition-all focus-within:border-red-400 focus-within:ring-2 focus-within:ring-red-100 dark:focus-within:ring-red-900/30">
                <YemenFlagIndicator />
                <span className="text-sm font-medium text-gray-500 dark:text-gray-400 shrink-0" dir="ltr">+967</span>
                <div className="w-px h-5 bg-gray-300 dark:bg-gray-600 shrink-0" />
                <Phone size={16} className="text-gray-400 shrink-0" />
                <input
                  type="tel"
                  placeholder="7XX XXX XXX"
                  value={regPhone}
                  onChange={(e) => handlePhoneChange(e.target.value)}
                  className="flex-1 bg-transparent outline-none text-sm text-gray-900 dark:text-white placeholder:text-gray-400"
                  dir="ltr"
                />
              </div>

              {/* Gender Selection */}
              <div className="flex gap-3">
                <button
                  onClick={() => setRegGender('male')}
                  className={`flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl border-2 transition-all ${
                    regGender === 'male'
                      ? 'border-red-500 bg-red-50 dark:bg-red-900/20 text-red-600'
                      : 'border-gray-200 dark:border-[rgba(255,255,255,0.08)] bg-gray-50 dark:bg-[#1A1A1A] text-gray-500 dark:text-gray-400'
                  }`}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="10.5" cy="10.5" r="7.5" />
                    <line x1="15.5" y1="15.5" x2="21" y2="21" />
                  </svg>
                  <span className="text-sm font-medium">ذكر</span>
                </button>
                <button
                  onClick={() => setRegGender('female')}
                  className={`flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl border-2 transition-all ${
                    regGender === 'female'
                      ? 'border-red-500 bg-red-50 dark:bg-red-900/20 text-red-600'
                      : 'border-gray-200 dark:border-[rgba(255,255,255,0.08)] bg-gray-50 dark:bg-[#1A1A1A] text-gray-500 dark:text-gray-400'
                  }`}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="8" r="5" />
                    <path d="M3 21v-2a7 7 0 0 1 7-7h4a7 7 0 0 1 7 7v2" />
                  </svg>
                  <span className="text-sm font-medium">أنثى</span>
                </button>
              </div>

              {/* Terms Checkbox */}
              <div className="flex items-start gap-3 py-1">
                <button
                  onClick={() => setAgreedToTerms(!agreedToTerms)}
                  className={`mt-0.5 w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all ${
                    agreedToTerms
                      ? 'bg-red-600 border-red-600'
                      : 'bg-white dark:bg-[#1A1A1A] border-gray-300 dark:border-[rgba(255,255,255,0.08)]'
                  }`}
                >
                  {agreedToTerms && <Check size={12} className="text-white" strokeWidth={3} />}
                </button>
                <span className="text-sm text-gray-600 dark:text-gray-300">
                  أوافق على{' '}
                  <span className="text-red-600 font-medium cursor-pointer">الشروط والأحكام</span>
                </span>
              </div>

              {error && (
                <motion.p initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} className="text-xs text-center text-red-600">{error}</motion.p>
              )}

              {/* Register Button */}
              <button
                onClick={handleRegisterStep1}
                className="w-full py-4 rounded-xl flex items-center justify-center gap-2 font-bold text-white transition-all active:scale-[0.98]"
                style={{ background: 'linear-gradient(135deg, #E60000 0%, #B30000 100%)', boxShadow: '0 4px 16px rgba(230,0,0,0.3)' }}
              >
                <span>تسجيل</span>
              </button>

              {/* Toggle to Login */}
              <div className="text-center pt-1">
                <span className="text-sm text-gray-500">هل لديك حساب؟ </span>
                <button
                  onClick={() => { setStep('login'); setError(''); setSuccess(''); }}
                  className="text-sm font-bold text-red-600 hover:text-red-700 transition-colors"
                >
                  تسجيل الدخول
                </button>
              </div>
            </motion.div>
          )}

          {/* ═══════════════ ELECTRONIC SIGNATURE ═══════════════ */}
          {step === 'signature' && (
            <motion.div
              key="signature"
              initial={{ x: 300, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -300, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 200, damping: 25 }}
              className="space-y-4"
            >
              {/* Back + Title */}
              <div className="flex items-center gap-2 mb-1">
                <button
                  onClick={() => { setStep('register'); setError(''); }}
                  className="w-8 h-8 rounded-full flex items-center justify-center bg-gray-100 dark:bg-[#1A1A1A]"
                >
                  <ArrowLeft size={16} className="text-gray-600 dark:text-gray-300" />
                </button>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">التوقيع الإلكتروني</h2>
              </div>

              {/* Step indicator */}
              <div className="flex gap-2 mb-2">
                <div className="flex-1 h-1.5 rounded-full bg-red-600" />
                <div className="flex-1 h-1.5 rounded-full bg-red-600" />
              </div>

              {/* Subtitle */}
              <div className="flex flex-col items-center mb-2">
                <div className="w-14 h-14 rounded-full flex items-center justify-center mb-3" style={{ background: 'rgba(230,0,0,0.08)' }}>
                  <PenLine size={28} className="text-red-600" />
                </div>
                <p className="text-xs text-center text-gray-500 dark:text-gray-400 max-w-[280px]">
                  يرجى التوقيع أدناه لإتمام إنشاء حسابك
                </p>
              </div>

              {/* Signature Canvas */}
              <SignatureCanvas onSignatureChange={setElectronicSignature} />

              {error && (
                <motion.p initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} className="text-xs text-center text-red-600">{error}</motion.p>
              )}

              {/* Confirm Signature Button */}
              <button
                onClick={handleCreateAccount}
                disabled={isLoading || !electronicSignature}
                className="w-full py-4 rounded-xl flex items-center justify-center gap-2 font-bold text-white transition-all active:scale-[0.98] disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #E60000 0%, #B30000 100%)', boxShadow: electronicSignature ? '0 4px 16px rgba(230,0,0,0.3)' : 'none' }}
              >
                {isLoading ? (
                  <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }} className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full" />
                ) : (
                  <>
                    <Check size={18} />
                    <span>تأكيد التوقيع</span>
                  </>
                )}
              </button>
            </motion.div>
          )}

          {/* ═══════════════ PASSWORD RECOVERY ═══════════════ */}
          {step === 'password-recovery' && (
            <motion.div
              key="password-recovery"
              initial={{ x: 300, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -300, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 200, damping: 25 }}
              className="space-y-4"
            >
              {/* Back + Title */}
              <div className="flex items-center gap-2 mb-1">
                <button
                  onClick={() => { setStep('login'); setError(''); setSuccess(''); }}
                  className="w-8 h-8 rounded-full flex items-center justify-center bg-gray-100 dark:bg-[#1A1A1A]"
                >
                  <ArrowLeft size={16} className="text-gray-600 dark:text-gray-300" />
                </button>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">استعادة كلمة المرور</h2>
              </div>

              <div className="flex flex-col items-center mb-4">
                <div className="w-14 h-14 rounded-full flex items-center justify-center mb-3" style={{ background: 'rgba(230,0,0,0.08)' }}>
                  <KeyRound size={28} className="text-red-600" />
                </div>
                <p className="text-xs text-center text-gray-500 dark:text-gray-400 max-w-[250px]">
                  أدخل البريد الإلكتروني المرتبط بحسابك وسنرسل لك رابط إعادة التعيين
                </p>
              </div>

              {/* Email */}
              <div className="relative">
                <Mail size={18} strokeWidth={1.5} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="email"
                  placeholder="البريد الإلكتروني"
                  value={recoveryEmail}
                  onChange={(e) => setRecoveryEmail(e.target.value)}
                  className={`${inputBaseClass} pr-11`}
                  dir="ltr"
                  autoComplete="email"
                />
              </div>

              {error && (
                <motion.p initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} className="text-xs text-center text-red-600">{error}</motion.p>
              )}
              {success && (
                <motion.p initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} className="text-xs text-center text-emerald-600">{success}</motion.p>
              )}

              {/* Send Reset Button */}
              <button
                onClick={handlePasswordReset}
                disabled={isLoading}
                className="w-full py-4 rounded-xl flex items-center justify-center gap-2 font-bold text-white transition-all active:scale-[0.98] disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #E60000 0%, #B30000 100%)', boxShadow: '0 4px 16px rgba(230,0,0,0.3)' }}
              >
                {isLoading ? (
                  <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }} className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full" />
                ) : (
                  <span>إرسال رابط إعادة التعيين</span>
                )}
              </button>
            </motion.div>
          )}

        </AnimatePresence>
      </div>

      {/* ─── Support Icons at Bottom ──────────────────────────────── */}
      <div className="mt-auto pb-8 pt-4">
        <div className="flex items-center justify-center gap-8">
          {/* WhatsApp */}
          <a
            href="https://wa.me/967777777777"
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-col items-center gap-1 text-gray-400 hover:text-green-600 transition-colors"
          >
            <div className="w-10 h-10 rounded-full bg-gray-50 dark:bg-[#1A1A1A] flex items-center justify-center">
              <MessageCircle size={20} />
            </div>
            <span className="text-[10px]">واتساب</span>
          </a>

          {/* Location */}
          <a
            href="#"
            className="flex flex-col items-center gap-1 text-gray-400 hover:text-red-600 transition-colors"
          >
            <div className="w-10 h-10 rounded-full bg-gray-50 dark:bg-[#1A1A1A] flex items-center justify-center">
              <MapPin size={20} />
            </div>
            <span className="text-[10px]">الموقع</span>
          </a>

          {/* Phone Call */}
          <a
            href="tel:+967777777777"
            className="flex flex-col items-center gap-1 text-gray-400 hover:text-blue-600 transition-colors"
          >
            <div className="w-10 h-10 rounded-full bg-gray-50 dark:bg-[#1A1A1A] flex items-center justify-center">
              <PhoneCall size={20} />
            </div>
            <span className="text-[10px]">اتصل بنا</span>
          </a>
        </div>
      </div>
    </div>
  );
}
