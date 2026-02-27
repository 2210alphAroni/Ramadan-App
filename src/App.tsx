import { useState, useEffect, useCallback, useRef } from "react";
import { 
  Moon, 
  Sun, 
  Compass, 
  Bell, 
  BellOff, 
  Clock, 
  MapPin, 
  RotateCcw, 
  Fingerprint,
  ChevronRight,
  CalendarDays,
  Menu,
  X,
  Languages,
  Search,
  Check,
  Navigation2,
  WifiOff,
  Wallet
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { PrayerData, PrayerName, NextPrayer } from "./types";
import { BANGLADESH_DISTRICTS, District } from "./constants/districts";
import { translations, Language } from "./constants/translations";

const PRAYER_ORDER: PrayerName[] = ["Fajr", "Sunrise", "Dhuhr", "Asr", "Maghrib", "Isha"];

type Tab = "prayer" | "calendar" | "qibla" | "tasbih" | "zakat";

const toBengaliNumber = (num: string | number, lang: Language): string => {
  if (lang !== "bn") return String(num);
  const bengaliNumbers = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];
  return String(num).replace(/\d/g, (d) => bengaliNumbers[parseInt(d)]);
};

const formatTime = (time: string, lang: Language): string => {
  const cleanTime = time.split(" ")[0]; // Strip (+06) or other offsets
  if (lang !== "bn") return cleanTime;
  const [h, m] = cleanTime.split(":");
  return `${toBengaliNumber(h, lang)}:${toBengaliNumber(m, lang)}`;
};

const getBengaliDate = (date: Date): string => {
  // Simplified Bengali calendar logic for 2026
  // This is an approximation. For production, a more robust library would be used.
  const months = [
    "বৈশাখ", "জ্যৈষ্ঠ", "আষাঢ়", "শ্রাবণ", "ভাদ্র", "আশ্বিন", "কার্তিক", "অগ্রহায়ণ", "পৌষ", "মাঘ", "ফাল্গুন", "চৈত্র"
  ];
  // 2026-02-27 is around 14 Falgun 1432
  // Rough offset calculation
  const day = date.getDate();
  const month = date.getMonth();
  const year = date.getFullYear();
  
  // Very rough approximation for demo purposes
  return `${toBengaliNumber(day, "bn")} ফাল্গুন, ১৪৩২`;
};

const getBengaliDay = (date: Date): string => {
  const days = ["রবিবার", "সোমবার", "মঙ্গলবার", "বুধবার", "বৃহস্পতিবার", "শুক্রবার", "শনিবার"];
  return days[date.getDay()];
};

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>("prayer");
  const [location, setLocation] = useState<{ lat: number; lon: number } | null>(null);
  const [selectedDistrict, setSelectedDistrict] = useState<District | null>(null);
  const [prayerData, setPrayerData] = useState<PrayerData | null>(null);
  const [monthlyData, setMonthlyData] = useState<any[]>([]);
  const [nextPrayer, setNextPrayer] = useState<NextPrayer | null>(null);
  const [tasbihCount, setTasbihCount] = useState(0);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [lastNotifiedPrayer, setLastNotifiedPrayer] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isDistrictModalOpen, setIsDistrictModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [language, setLanguage] = useState<Language>("en");
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [qiblaAngle, setQiblaAngle] = useState(0);
  const [deviceHeading, setDeviceHeading] = useState(0);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  // Zakat State
  const [zakatInputs, setZakatInputs] = useState({
    cash: "",
    gold: "",
    silver: "",
    business: "",
    debts: ""
  });
  const [zakatResult, setZakatResult] = useState<number | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const t = translations[language];

  const calculateZakat = () => {
    const total = 
      (parseFloat(zakatInputs.cash) || 0) + 
      (parseFloat(zakatInputs.gold) || 0) + 
      (parseFloat(zakatInputs.silver) || 0) + 
      (parseFloat(zakatInputs.business) || 0) - 
      (parseFloat(zakatInputs.debts) || 0);
    
    setZakatResult(Math.max(0, total * 0.025));
  };

  // Offline status listener
  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Load cached data on mount
  useEffect(() => {
    const cachedDaily = localStorage.getItem("prayerData");
    const cachedMonthly = localStorage.getItem("monthlyData");
    const cachedDistrict = localStorage.getItem("selectedDistrict");

    if (cachedDaily) setPrayerData(JSON.parse(cachedDaily));
    if (cachedMonthly) setMonthlyData(JSON.parse(cachedMonthly));
    if (cachedDistrict) setSelectedDistrict(JSON.parse(cachedDistrict));
    
    const savedNotifications = localStorage.getItem("notificationsEnabled");
    if (savedNotifications === "true" && Notification.permission === "granted") {
      setNotificationsEnabled(true);
    }
  }, []);

  // Initialize audio for notification
  useEffect(() => {
    audioRef.current = new Audio("https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3");
  }, []);

  // Theme management
  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === "light") {
      root.classList.add("light");
    } else {
      root.classList.remove("light");
    }
  }, [theme]);

  // Geolocation
  useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const loc = {
            lat: position.coords.latitude,
            lon: position.coords.longitude,
          };
          setLocation(loc);
          calculateQibla(loc.lat, loc.lon);
        },
        (err) => {
          const dhaka = BANGLADESH_DISTRICTS[0];
          setSelectedDistrict(dhaka);
          setLocation({ lat: dhaka.lat, lon: dhaka.lon });
          calculateQibla(dhaka.lat, dhaka.lon);
        }
      );
    } else {
      const dhaka = BANGLADESH_DISTRICTS[0];
      setSelectedDistrict(dhaka);
      setLocation({ lat: dhaka.lat, lon: dhaka.lon });
      calculateQibla(dhaka.lat, dhaka.lon);
    }
  }, []);

  // Qibla Calculation
  const calculateQibla = (lat: number, lon: number) => {
    const kaabaLat = 21.4225 * (Math.PI / 180);
    const kaabaLon = 39.8262 * (Math.PI / 180);
    const myLat = lat * (Math.PI / 180);
    const myLon = lon * (Math.PI / 180);

    const y = Math.sin(kaabaLon - myLon);
    const x = Math.cos(myLat) * Math.tan(kaabaLat) - Math.sin(myLat) * Math.cos(kaabaLon - myLon);
    let qibla = Math.atan2(y, x) * (180 / Math.PI);
    qibla = (qibla + 360) % 360;
    setQiblaAngle(qibla);
  };

  // Device Orientation for Compass
  useEffect(() => {
    const handleOrientation = (e: any) => {
      if (e.webkitCompassHeading) {
        setDeviceHeading(e.webkitCompassHeading);
      } else if (e.alpha !== null) {
        setDeviceHeading(360 - e.alpha);
      }
    };

    window.addEventListener("deviceorientation", handleOrientation, true);
    return () => window.removeEventListener("deviceorientation", handleOrientation);
  }, []);

  // Fetch Prayer Times & Monthly Data
  useEffect(() => {
    if (!location) return;

    const fetchAllData = async () => {
      setLoading(true);
      try {
        const now = new Date();
        const [dailyRes, monthlyRes] = await Promise.all([
          fetch(`https://api.aladhan.com/v1/timings?latitude=${location.lat}&longitude=${location.lon}&method=1`),
          fetch(`https://api.aladhan.com/v1/calendar?latitude=${location.lat}&longitude=${location.lon}&method=1&month=${now.getMonth() + 1}&year=${now.getFullYear()}`)
        ]);

        const dailyData = await dailyRes.json();
        const monthlyData = await monthlyRes.json();

        if (monthlyData.code === 200) {
          // Apply a consistent Hijri offset for 2026 to match user's requirement (Feb 27 = 9 Ramadan)
          const updatedMonthly = monthlyData.data.map((day: any) => {
            if (day.date.gregorian.year === "2026") {
              // The API is 1 day ahead of the user's requirement for Bangladesh
              const apiHijriDay = parseInt(day.date.hijri.day);
              let adjustedDay = apiHijriDay - 1;
              
              // Handle month boundary if necessary (simplified for Ramadan)
              if (adjustedDay < 1) adjustedDay = 29; // Assuming previous month had 29 or 30 days

              return {
                ...day,
                date: {
                  ...day.date,
                  hijri: {
                    ...day.date.hijri,
                    day: adjustedDay.toString().padStart(2, '0'),
                    month: { en: "Ramadan", ar: "রমজান" }
                  }
                }
              };
            }
            return day;
          });
          setMonthlyData(updatedMonthly);
          localStorage.setItem("monthlyData", JSON.stringify(updatedMonthly));
          
          // Also update the current prayerData if it's today
          const today = new Date();
          const todayStr = today.getDate().toString().padStart(2, '0');
          const todayMonth = (today.getMonth() + 1);
          const todayYear = today.getFullYear().toString();
          
          const todayData = updatedMonthly.find((d: any) => 
            d.date.gregorian.day === todayStr && 
            d.date.gregorian.month.number === todayMonth &&
            d.date.gregorian.year === todayYear
          );
          
          if (todayData) {
            setPrayerData(todayData);
            localStorage.setItem("prayerData", JSON.stringify(todayData));
          }
        }
        
        setError(null);
      } catch (err) {
        // If fetch fails, we already have cached data from useEffect on mount
        if (!prayerData) {
          setError(t.retry);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchAllData();
  }, [location, t.retry]);

  // Countdown Logic
  const calculateNextPrayer = useCallback(() => {
    if (!prayerData) return;

    const now = new Date();
    const timings = prayerData.timings;
    
    let next: NextPrayer | null = null;
    let minDiff = Infinity;

    const checkTime = (name: string, timeStr: string, isIftar = false, isSehri = false) => {
      const cleanTime = timeStr.split(" ")[0];
      const [hours, minutes] = cleanTime.split(":").map(Number);
      const prayerTime = new Date();
      prayerTime.setHours(hours, minutes, 0, 0);

      let diff = prayerTime.getTime() - now.getTime();
      if (diff < 0) {
        prayerTime.setDate(prayerTime.getDate() + 1);
        diff = prayerTime.getTime() - now.getTime();
      }

      if (diff < minDiff) {
        minDiff = diff;
        
        const h = Math.floor(diff / (1000 * 60 * 60));
        const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const s = Math.floor((diff % (1000 * 60)) / 1000);

        next = {
          name: t[name.toLowerCase() as keyof typeof t] || name,
          time: timeStr,
          remaining: `${h}h ${m}m ${s}s`,
          isIftar,
          isSehri
        };
      }
    };

    PRAYER_ORDER.forEach(name => checkTime(name, timings[name]));
    checkTime("Iftar", timings.Maghrib, true);
    checkTime("Sehri", timings.Fajr, false, true);

    setNextPrayer(next);

    // Robust notification trigger: check if we are within 1 minute of the prayer and haven't notified yet
    if (next && minDiff < 60000 && notificationsEnabled && lastNotifiedPrayer !== next.name) {
      showNotification(next.name);
      setLastNotifiedPrayer(next.name);
    }
    
    // Reset lastNotifiedPrayer when we are far from the next prayer
    if (minDiff > 65000) {
      setLastNotifiedPrayer(null);
    }

  }, [prayerData, notificationsEnabled, t, lastNotifiedPrayer]);

  useEffect(() => {
    const timer = setInterval(calculateNextPrayer, 1000);
    return () => clearInterval(timer);
  }, [calculateNextPrayer]);

  const showNotification = (title: string) => {
    if (Notification.permission === "granted") {
      new Notification(`${title}`, {
        body: t.ramadan_blessing,
        icon: "/favicon.ico"
      });
      audioRef.current?.play().catch(() => {});
    }
  };

  const toggleNotifications = async () => {
    try {
      if (notificationsEnabled) {
        setNotificationsEnabled(false);
        localStorage.setItem("notificationsEnabled", "false");
        return;
      }

      if (!("Notification" in window)) {
        alert(language === "bn" ? "আপনার ব্রাউজার নোটিফিকেশন সাপোর্ট করে না।" : "This browser does not support desktop notification");
        return;
      }
      
      const currentPermission = Notification.permission;
      
      if (currentPermission === "denied") {
        alert(language === "bn" ? "নোটিফিকেশন পারমিশন ব্লক করা আছে। দয়া করে ব্রাউজার সেটিংস থেকে এটি এলাও করুন।" : "Notification permission has been denied. Please enable it in your browser settings.");
        return;
      }

      if (currentPermission === "granted") {
        setNotificationsEnabled(true);
        localStorage.setItem("notificationsEnabled", "true");
        showNotification(language === "bn" ? "নোটিফিকেশন চালু হয়েছে" : "Notifications Enabled");
        return;
      }

      // If permission is "default", request it
      const permission = await Notification.requestPermission();
      if (permission === "granted") {
        setNotificationsEnabled(true);
        localStorage.setItem("notificationsEnabled", "true");
        showNotification(language === "bn" ? "নোটিফিকেশন চালু হয়েছে" : "Notifications Enabled");
      } else {
        alert(language === "bn" ? "নোটিফিকেশন পারমিশন পাওয়া যায়নি।" : "Notification permission was not granted.");
      }
    } catch (err) {
      console.error("Notification toggle error:", err);
      alert(language === "bn" ? "একটি ত্রুটি ঘটেছে। আবার চেষ্টা করুন।" : "An error occurred. Please try again.");
    }
  };

  const testNotification = () => {
    showNotification("Test Notification");
  };

  const handleTasbih = () => {
    setTasbihCount(prev => prev + 1);
    if ("vibrate" in navigator) navigator.vibrate(50);
  };

  const resetTasbih = () => {
    setTasbihCount(0);
  };

  const selectDistrict = (district: District) => {
    setSelectedDistrict(district);
    localStorage.setItem("selectedDistrict", JSON.stringify(district));
    setLocation({ lat: district.lat, lon: district.lon });
    calculateQibla(district.lat, district.lon);
    setIsDistrictModalOpen(false);
  };

  const filteredDistricts = BANGLADESH_DISTRICTS.filter(d => 
    d.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    d.bn.includes(searchQuery)
  );

  if (loading && !prayerData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-emerald-950">
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: "linear" }} className="mb-4">
          <Moon className="w-12 h-12 text-gold-500" />
        </motion.div>
        <p className="text-gold-500 font-medium animate-pulse">{t.loading}</p>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto min-h-screen flex flex-col pb-24 relative overflow-x-hidden">
      {/* Header */}
      <header className="p-4 flex items-center justify-between sticky top-0 z-50 glass backdrop-blur-xl h-20">
        <div className="flex items-center gap-2 overflow-hidden">
          <motion.div whileHover={{ rotate: 15 }} className="w-10 h-10 rounded-full bg-gold-500/20 flex-shrink-0 flex items-center justify-center border border-gold-500/30">
            <Moon className="w-5 h-5 text-gold-500" />
          </motion.div>
          <div className="truncate">
            <h1 className="text-lg font-bold leading-none truncate">{t.app_title}</h1>
            <p className="text-[10px] text-gold-500 uppercase tracking-widest font-bold truncate">{t.app_subtitle}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {isOffline && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex items-center justify-center w-8 h-8 rounded-full bg-red-500/10 text-red-500 border border-red-500/20"
              title={t.offline}
            >
              <WifiOff className="w-4 h-4" />
            </motion.div>
          )}
          <button onClick={() => setTheme(theme === "dark" ? "light" : "dark")} className="p-2 rounded-full glass hover:bg-gold-500/10 transition-all">
            {theme === "dark" ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
          <button onClick={() => setLanguage(language === "en" ? "bn" : "en")} className="p-2 rounded-full glass hover:bg-gold-500/10 transition-all flex items-center gap-1">
            <Languages className="w-5 h-5" />
            <span className="text-[10px] font-bold uppercase">{language}</span>
          </button>
          <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="p-2 rounded-full glass hover:bg-gold-500/10 transition-all">
            {isMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 px-6 space-y-6 pt-4">
        {activeTab === "prayer" && (
          <>
            {/* Date & Location Card */}
            <section className="glass rounded-3xl p-6 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-gold-500/5 rounded-full -mr-16 -mt-16 blur-3xl group-hover:bg-gold-500/10 transition-all" />
              <div className="flex justify-between items-start mb-4">
                <div>
                  <p className="text-gold-500 text-[10px] font-bold uppercase tracking-widest mb-1">{t.current_date}</p>
                  <div className="space-y-1">
                    <h2 className="text-xl font-bold">
                      {toBengaliNumber(prayerData?.date.hijri.day || "", language)} {language === "bn" ? prayerData?.date.hijri.month.ar : prayerData?.date.hijri.month.en} ({t.hijri})
                    </h2>
                    <p className="text-sm font-medium text-gold-500/80">
                      {toBengaliNumber(new Date().getDate(), language)} {new Date().toLocaleString(language === "bn" ? "bn-BD" : "en-US", { month: "long" })}, {toBengaliNumber(new Date().getFullYear(), language)} | {language === "bn" ? getBengaliDay(new Date()) : new Date().toLocaleString("en-US", { weekday: "long" })}
                    </p>
                    <p className="text-sm font-medium opacity-60">
                      {getBengaliDate(new Date())} ({t.bengali})
                    </p>
                  </div>
                </div>
                <button onClick={() => setIsDistrictModalOpen(true)} className="text-right group/loc">
                  <div className="flex items-center gap-1 text-gold-500 justify-end group-hover/loc:translate-x-[-2px] transition-transform">
                    <MapPin className="w-3 h-3" />
                    <span className="text-[10px] font-bold uppercase tracking-tighter">{t.live_location}</span>
                  </div>
                  <p className="text-xs mt-1 font-medium underline decoration-gold-500/30 underline-offset-4">
                    {selectedDistrict ? (language === "bn" ? selectedDistrict.bn : selectedDistrict.name) : prayerData?.meta.timezone}
                  </p>
                </button>
              </div>
            </section>

            {/* Live Ramadan Status (Iftar & Sehri) */}
            <section className="grid grid-cols-2 gap-4">
              <div className="glass p-4 rounded-2xl border-gold-500/20 bg-gold-500/5">
                <div className="flex items-center gap-2 mb-2">
                  <Moon className="w-4 h-4 text-gold-500" />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-gold-500">{t.sehri}</span>
                </div>
                <p className="text-2xl font-bold">{formatTime(prayerData?.timings.Fajr || "", language)}</p>
              </div>
              <div className="glass p-4 rounded-2xl border-gold-500/20 bg-gold-500/5">
                <div className="flex items-center gap-2 mb-2">
                  <Sun className="w-4 h-4 text-gold-500" />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-gold-500">{t.iftar}</span>
                </div>
                <p className="text-2xl font-bold">{formatTime(prayerData?.timings.Maghrib || "", language)}</p>
              </div>
            </section>

            {/* Next Event Countdown */}
            {nextPrayer && (
              <section className="relative">
                <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="glass-gold rounded-3xl p-8 text-center border-gold-500/30 relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-br from-gold-500/5 to-transparent pointer-events-none" />
                  <p className="text-gold-500 text-[10px] font-bold uppercase tracking-[0.3em] mb-2">{t.next_event}</p>
                  <h3 className="text-4xl font-bold mb-1 tracking-tight">{nextPrayer.name}</h3>
                  <p className="text-gold-500/80 text-sm mb-6">{t.at} {formatTime(nextPrayer.time, language)}</p>
                  <div className="flex justify-center">
                    <div className="glass bg-emerald-950/20 px-8 py-4 rounded-2xl border border-gold-500/20">
                      <p className="text-3xl font-mono font-bold text-gold-500 tracking-tighter">
                        {nextPrayer.remaining.split(" ").map(part => {
                          const val = part.slice(0, -1);
                          const unit = part.slice(-1);
                          return toBengaliNumber(val, language) + (language === "bn" ? (unit === "h" ? "ঘ" : unit === "m" ? "মি" : "সে") : unit);
                        }).join(" ")}
                      </p>
                      <p className="text-[10px] opacity-40 uppercase tracking-widest mt-1 font-bold">{t.remaining}</p>
                    </div>
                  </div>
                </motion.div>
              </section>
            )}

            {/* Ramadan Note */}
            <section className="px-2">
              <div className="glass p-4 rounded-2xl border-gold-500/10 bg-gold-500/5">
                <p className="text-[11px] text-gold-500/70 italic leading-relaxed">
                  {t.ramadan_note}
                </p>
              </div>
            </section>

            {/* Prayer Times Grid */}
            <section>
              <div className="flex items-center justify-between mb-4 px-2">
                <h4 className="text-xs font-bold uppercase tracking-widest text-gold-500">{t.prayer_times}</h4>
                <Clock className="w-4 h-4 text-gold-500/50" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                {PRAYER_ORDER.map((name) => (
                  <motion.div key={name} whileHover={{ y: -2 }} className={`glass p-4 rounded-2xl flex items-center justify-between transition-all ${nextPrayer?.name === (t[name.toLowerCase() as keyof typeof t] || name) ? 'border-gold-500/50 bg-gold-500/5 ring-1 ring-gold-500/20' : ''}`}>
                    <div>
                      <p className="text-[10px] text-gold-500 font-bold uppercase tracking-widest">{t[name.toLowerCase() as keyof typeof t] || name}</p>
                      <p className="text-lg font-bold">{formatTime(prayerData?.timings[name] || "", language)}</p>
                    </div>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${nextPrayer?.name === (t[name.toLowerCase() as keyof typeof t] || name) ? 'bg-gold-500 text-emerald-950' : 'bg-white/5 opacity-50'}`}>
                      {name === "Fajr" && <Moon className="w-4 h-4" />}
                      {name === "Sunrise" && <Sun className="w-4 h-4" />}
                      {name === "Dhuhr" && <Sun className="w-4 h-4" />}
                      {name === "Asr" && <Sun className="w-4 h-4" />}
                      {name === "Maghrib" && <Moon className="w-4 h-4" />}
                      {name === "Isha" && <Moon className="w-4 h-4" />}
                    </div>
                  </motion.div>
                ))}
              </div>
            </section>
          </>
        )}

        {activeTab === "calendar" && (
          <section className="space-y-6">
            <div className="flex items-center justify-between px-2">
              <h2 className="text-2xl font-bold text-gold-500">{t.calendar_title}</h2>
              <CalendarDays className="w-6 h-6 text-gold-500/50" />
            </div>
            
            <div className="glass rounded-3xl overflow-hidden border-gold-500/10">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gold-500/10 border-b border-gold-500/20">
                      <th className="p-4 text-[10px] font-bold uppercase tracking-widest text-gold-500">{t.date}</th>
                      <th className="p-4 text-[10px] font-bold uppercase tracking-widest text-gold-500">{t.sehri}</th>
                      <th className="p-4 text-[10px] font-bold uppercase tracking-widest text-gold-500">{t.iftar}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthlyData.map((day, idx) => {
                      const dateObj = new Date(day.date.gregorian.year, day.date.gregorian.month.number - 1, day.date.gregorian.day);
                      const isToday = new Date().toDateString() === dateObj.toDateString();
                      
                      return (
                        <tr key={idx} className={`border-b border-white/5 transition-colors hover:bg-white/5 ${isToday ? 'bg-gold-500/10' : ''}`}>
                          <td className="p-4">
                            <div className="flex flex-col">
                              <span className="font-bold text-sm">
                                {toBengaliNumber(day.date.hijri.day, language)} {language === "bn" ? day.date.hijri.month.ar : day.date.hijri.month.en}
                              </span>
                              <span className="text-[10px] opacity-60">
                                {toBengaliNumber(day.date.gregorian.day, language)} {new Date(day.date.gregorian.year, day.date.gregorian.month.number - 1, day.date.gregorian.day).toLocaleString(language === "bn" ? "bn-BD" : "en-US", { month: "long" })}
                              </span>
                              <span className="text-[9px] text-gold-500/70 font-medium">
                                {language === "bn" ? getBengaliDay(dateObj) : dateObj.toLocaleString("en-US", { weekday: "long" })}
                              </span>
                            </div>
                          </td>
                          <td className="p-4 font-mono text-sm">
                            {formatTime(day.timings.Fajr.split(" ")[0], language)}
                          </td>
                          <td className="p-4 font-mono text-sm">
                            {formatTime(day.timings.Maghrib.split(" ")[0], language)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
            
            <div className="px-2">
              <div className="glass p-4 rounded-2xl border-gold-500/10 bg-gold-500/5">
                <p className="text-[11px] text-gold-500/70 italic leading-relaxed">
                  {t.ramadan_note}
                </p>
              </div>
            </div>
          </section>
        )}

        {activeTab === "qibla" && (
          <section className="flex flex-col items-center justify-center py-10 space-y-8">
            <div className="text-center">
              <h2 className="text-3xl font-bold text-gold-500 mb-2">Qibla Compass</h2>
              <p className="text-sm opacity-60">Align your device to find the Kaaba</p>
            </div>
            
            <div className="relative w-64 h-64">
              {/* Compass Ring */}
              <div className="absolute inset-0 rounded-full border-4 border-white/10" />
              <div className="absolute inset-0 rounded-full border-t-4 border-gold-500 animate-pulse" />
              
              {/* Compass Needle */}
              <motion.div 
                animate={{ rotate: qiblaAngle - deviceHeading }}
                className="absolute inset-0 flex items-center justify-center"
              >
                <div className="relative w-full h-full flex items-center justify-center">
                  <div className="w-1 h-32 bg-gold-500 rounded-full shadow-lg shadow-gold-500/50" />
                  <div className="absolute top-0 w-4 h-4 bg-gold-500 rounded-full flex items-center justify-center">
                    <Navigation2 className="w-3 h-3 text-emerald-950" />
                  </div>
                </div>
              </motion.div>
              
              {/* Center Point */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-4 h-4 bg-gold-500 rounded-full ring-4 ring-emerald-950" />
              </div>
            </div>

            <div className="glass p-6 rounded-2xl text-center w-full">
              <p className="text-gold-500 text-xs font-bold uppercase tracking-widest mb-1">Angle to Kaaba</p>
              <p className="text-3xl font-bold">{Math.round(qiblaAngle)}°</p>
            </div>
          </section>
        )}

        {activeTab === "tasbih" && (
          <section className="glass rounded-3xl p-6 overflow-hidden relative">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-widest text-gold-500">{t.digital_tasbih}</h4>
                <p className="text-[10px] opacity-50">{t.dhikr_subtitle}</p>
              </div>
              <button onClick={resetTasbih} className="p-2 rounded-full glass hover:text-gold-500 transition-colors">
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>
            <div className="flex flex-col items-center">
              <div className="relative mb-8">
                <svg className="w-48 h-48 transform -rotate-90">
                  <circle cx="96" cy="96" r="88" stroke="currentColor" strokeWidth="6" fill="transparent" className="opacity-5" />
                  <motion.circle cx="96" cy="96" r="88" stroke="currentColor" strokeWidth="6" fill="transparent" strokeDasharray={553} initial={{ strokeDashoffset: 553 }} animate={{ strokeDashoffset: 553 - (tasbihCount % 33) * (553 / 33) }} className="text-gold-500" />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-5xl font-bold">{tasbihCount}</span>
                  <span className="text-[10px] text-gold-500 font-bold uppercase tracking-widest mt-1">{t.total_count}</span>
                </div>
              </div>
              <motion.button whileTap={{ scale: 0.98 }} onClick={handleTasbih} className="w-full py-5 rounded-2xl bg-gold-500 text-emerald-950 font-bold text-lg flex items-center justify-center gap-3 shadow-lg shadow-gold-500/20 hover:bg-gold-400 transition-colors">
                <Fingerprint className="w-6 h-6" />
                {t.tap_to_count}
              </motion.button>
            </div>
          </section>
        )}
        {activeTab === "zakat" && (
          <section className="glass rounded-3xl p-6 space-y-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-full bg-gold-500/20 flex items-center justify-center border border-gold-500/30">
                <Wallet className="w-5 h-5 text-gold-500" />
              </div>
              <h2 className="text-2xl font-bold text-gold-500">{t.zakat_calculator}</h2>
            </div>
            
            <div className="space-y-4">
              {[
                { key: "cash", label: t.cash },
                { key: "gold", label: t.gold },
                { key: "silver", label: t.silver },
                { key: "business", label: t.business_assets },
                { key: "debts", label: t.debts }
              ].map((item) => (
                <div key={item.key} className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-gold-500 ml-1">{item.label}</label>
                  <input 
                    type="number" 
                    value={zakatInputs[item.key as keyof typeof zakatInputs]} 
                    onChange={(e) => setZakatInputs({...zakatInputs, [item.key]: e.target.value})}
                    placeholder="0.00"
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 outline-none focus:border-gold-500/50 transition-colors"
                  />
                </div>
              ))}
              
              <button 
                onClick={calculateZakat}
                className="w-full py-4 rounded-xl bg-gold-500 text-emerald-950 font-bold text-lg shadow-lg shadow-gold-500/20 hover:bg-gold-400 transition-colors mt-4"
              >
                {t.calculate}
              </button>

              {zakatResult !== null && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="glass bg-gold-500/10 p-6 rounded-2xl border border-gold-500/30 text-center space-y-2"
                >
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gold-500">{t.zakat_payable}</p>
                  <p className="text-4xl font-bold text-gold-500">
                    {toBengaliNumber(zakatResult.toFixed(2), language)}
                  </p>
                  <p className="text-[10px] opacity-60 italic">{t.nisab_info}</p>
                </motion.div>
              )}
            </div>
          </section>
        )}
      </main>

      {/* Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto glass backdrop-blur-2xl border-t border-white/5 px-4 py-4 flex items-center justify-around z-50 rounded-t-3xl">
        <button onClick={() => setActiveTab("prayer")} className={`flex flex-col items-center gap-1 transition-all ${activeTab === "prayer" ? "text-gold-500 scale-110" : "opacity-40"}`}>
          <Clock className="w-6 h-6" />
          <span className="text-[10px] font-bold uppercase tracking-tighter">{t.sehri}</span>
        </button>
        <button onClick={() => setActiveTab("calendar")} className={`flex flex-col items-center gap-1 transition-all ${activeTab === "calendar" ? "text-gold-500 scale-110" : "opacity-40"}`}>
          <CalendarDays className="w-6 h-6" />
          <span className="text-[10px] font-bold uppercase tracking-tighter">{t.bengali}</span>
        </button>
        <button onClick={() => setActiveTab("qibla")} className={`flex flex-col items-center gap-1 transition-all ${activeTab === "qibla" ? "text-gold-500 scale-110" : "opacity-40"}`}>
          <Compass className="w-6 h-6" />
          <span className="text-[10px] font-bold uppercase tracking-tighter">Qibla</span>
        </button>
        <button onClick={() => setActiveTab("tasbih")} className={`flex flex-col items-center gap-1 transition-all ${activeTab === "tasbih" ? "text-gold-500 scale-110" : "opacity-40"}`}>
          <Fingerprint className="w-6 h-6" />
          <span className="text-[10px] font-bold uppercase tracking-tighter">Tasbih</span>
        </button>
        <button onClick={() => setActiveTab("zakat")} className={`flex flex-col items-center gap-1 transition-all ${activeTab === "zakat" ? "text-gold-500 scale-110" : "opacity-40"}`}>
          <Wallet className="w-6 h-6" />
          <span className="text-[10px] font-bold uppercase tracking-tighter">Zakat</span>
        </button>
      </nav>

      {/* District Selection Modal */}
      <AnimatePresence>
        {isDistrictModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-end justify-center px-4 pb-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsDistrictModalOpen(false)} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} className="glass w-full max-w-md rounded-3xl overflow-hidden z-10 flex flex-col max-h-[80vh]">
              <div className="p-6 border-b border-white/10">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-bold">{t.select_district}</h3>
                  <button onClick={() => setIsDistrictModalOpen(false)} className="p-2 glass rounded-full"><X className="w-5 h-5" /></button>
                </div>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 opacity-40" />
                  <input type="text" placeholder={t.search_district} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-4 outline-none focus:border-gold-500/50 transition-colors" />
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {filteredDistricts.map((district) => (
                  <button key={district.id} onClick={() => selectDistrict(district)} className={`w-full p-4 rounded-2xl flex items-center justify-between transition-all ${selectedDistrict?.id === district.id ? 'bg-gold-500/20 border border-gold-500/30' : 'hover:bg-white/5 border border-transparent'}`}>
                    <div className="text-left"><p className="font-bold">{district.name}</p><p className="text-xs opacity-50">{district.bn}</p></div>
                    {selectedDistrict?.id === district.id && <Check className="w-5 h-5 text-gold-500" />}
                  </button>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Side Menu Overlay */}
      <AnimatePresence>
        {isMenuOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsMenuOpen(false)} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60]" />
            <motion.div initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} className="fixed top-0 right-0 bottom-0 w-3/4 max-w-xs glass z-[70] p-8 shadow-2xl flex flex-col">
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-2xl font-bold text-gold-500">{t.settings}</h2>
                <button onClick={() => setIsMenuOpen(false)} className="p-2 glass rounded-full"><X className="w-5 h-5" /></button>
              </div>
              <div className="space-y-6 flex-1">
                <div className="space-y-2">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gold-500">{t.language}</p>
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => setLanguage("en")} className={`py-3 rounded-xl border transition-all cursor-pointer relative z-10 ${language === "en" ? 'bg-gold-500/20 border-gold-500/50 text-gold-500' : 'bg-white/5 border-white/10'}`}>English</button>
                    <button onClick={() => setLanguage("bn")} className={`py-3 rounded-xl border transition-all cursor-pointer relative z-10 ${language === "bn" ? 'bg-gold-500/20 border-gold-500/50 text-gold-500' : 'bg-white/5 border-white/10'}`}>বাংলা</button>
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gold-500">{t.theme}</p>
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => setTheme("dark")} className={`py-3 rounded-xl border transition-all cursor-pointer relative z-10 flex items-center justify-center gap-2 ${theme === "dark" ? 'bg-gold-500/20 border-gold-500/50 text-gold-500' : 'bg-white/5 border-white/10'}`}><Moon className="w-4 h-4" />{t.dark}</button>
                    <button onClick={() => setTheme("light")} className={`py-3 rounded-xl border transition-all cursor-pointer relative z-10 flex items-center justify-center gap-2 ${theme === "light" ? 'bg-gold-500/20 border-gold-500/50 text-gold-500' : 'bg-white/5 border-white/10'}`}><Sun className="w-4 h-4" />{t.light}</button>
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gold-500">{t.notifications}</p>
                  <div className="flex flex-col gap-2">
                    <button onClick={toggleNotifications} className={`w-full py-4 rounded-xl border flex items-center justify-between px-4 transition-all cursor-pointer relative z-10 ${notificationsEnabled ? 'bg-gold-500/20 border-gold-500/50 text-gold-500' : 'bg-white/5 border-white/10'}`}>
                      <span className="font-medium">{t.notifications}</span>
                      {notificationsEnabled ? <Bell className="w-5 h-5" /> : <BellOff className="w-5 h-5" />}
                    </button>
                    {notificationsEnabled && (
                      <button onClick={testNotification} className="w-full py-2 rounded-xl border border-white/10 bg-white/5 text-[10px] font-bold uppercase tracking-widest hover:bg-white/10 transition-all cursor-pointer relative z-10">
                        Test Notification
                      </button>
                    )}
                  </div>
                </div>
              </div>
              <div className="mt-auto">
                <div className="glass p-4 rounded-2xl border-gold-500/20">
                  <p className="text-[10px] text-gold-500 font-bold uppercase tracking-widest mb-1">Ramadan 2026</p>
                  <p className="text-xs opacity-60">{t.ramadan_blessing}</p>
                  <p className="text-center font-bold uppercase tracking-widest mb-1"> DevelopBY: <a href="https://roniportfolio.onrender.com">Nabinur Islam Roni</a></p>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
