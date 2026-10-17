import React, { createContext, useContext, useState, useEffect } from 'react';

type Language = 'en' | 'hi';
type FontSize = 'normal' | 'large';

interface AccessibilityContextType {
  lang: Language;
  setLang: (lang: Language) => void;
  highContrast: boolean;
  toggleHighContrast: () => void;
  fontSize: FontSize;
  setFontSize: (size: FontSize) => void;
  lowBandwidthMode: boolean;
  setLowBandwidthMode: (val: boolean | ((prev: boolean) => boolean)) => void;
  t: (key: string) => string;
  speak: (text: string) => void;
}

const translations: Record<Language, Record<string, string>> = {
  en: {
    appName: 'TransitEase',
    appSubtitle: 'Real-Time Public Transport Tracking for Small Cities',
    findBus: 'Find Your Bus',
    searchByBusNumber: 'Search by Bus Number',
    searchByDriverPhone: 'Search by Driver Mobile',
    enterBusNumberPlaceholder: 'e.g., UP16-1001, UP16-2005',
    enterDriverPhonePlaceholder: 'e.g., 9876543210 (10 digits)',
    searchButton: 'Track Live',
    journeyPlanner: 'A-to-B Journey Planner',
    dailyCommute: 'Daily Commute Alerts',
    stopsAndQR: 'Bus Stops & QR Codes',
    liveFleet: 'Live Fleet Map',
    driverPortal: 'Driver Portal',
    adminFleet: 'Admin Management',
    loginRegister: 'Sign In / Register',
    logout: 'Sign Out',
    fromStop: 'From (Origin Stop)',
    toStop: 'To (Destination Stop)',
    swapStops: 'Swap',
    findRoutes: 'Find Available Buses',
    seatsAvailable: 'Seats Available',
    moderatelyCrowded: 'Moderately Crowded',
    veryCrowded: 'Standing Only (Crowded)',
    staleGpsWarning: 'Last location update was several minutes ago. Location may not be current.',
    notSharingLocation: 'This driver is not currently sharing a live location.',
    noBusAssigned: 'No bus is currently assigned to this driver.',
    driverPhoneMaskedNotice: 'Driver phone number is securely masked for privacy.',
    textToSpeech: 'Listen Audio Announcement',
    lowBandwidthToggle: 'Low-Bandwidth (Text-Only)',
    highContrastToggle: 'High Contrast Mode',
    fontSizeToggle: 'Font Size',
    smsFeaturePhoneSandbox: 'Offline SMS Simulator',
    voiceHelpline: 'Voice IVR Helpline',
    reportIssue: 'Report Transit Issue',
    activeTrips: 'Active Buses',
    fare: 'Estimated Fare',
    estArrival: 'Est. Arrival',
    nextStop: 'Next Stop',
    speed: 'Speed',
    accuracy: 'Accuracy',
    lastUpdate: 'Last GPS Update',
    close: 'Close'
  },
  hi: {
    appName: 'ट्रांज़िटईज़',
    appSubtitle: 'छोटे शहरों के लिए रीयल-टाइम सार्वजनिक बस ट्रैकिंग',
    findBus: 'अपनी बस खोजें',
    searchByBusNumber: 'बस नंबर से खोजें',
    searchByDriverPhone: 'चालक के मोबाइल नंबर से खोजें',
    enterBusNumberPlaceholder: 'उदा. UP16-1001, UP16-2005',
    enterDriverPhonePlaceholder: 'उदा. 9876543210 (10 अंक)',
    searchButton: 'लाइव ट्रैक करें',
    journeyPlanner: 'यात्रा योजनाकार (A से B)',
    dailyCommute: 'दैनिक आवागमन अलर्ट',
    stopsAndQR: 'बस स्टॉप व क्यूआर कोड',
    liveFleet: 'लाइव फ्लीट मानचित्र',
    driverPortal: 'चालक पोर्टल',
    adminFleet: 'प्रशासन नियंत्रण',
    loginRegister: 'लॉग इन / पंजीकरण',
    logout: 'लॉग आउट',
    fromStop: 'कहाँ से (प्रारंभिक स्टॉप)',
    toStop: 'कहाँ तक (गंतव्य स्टॉप)',
    swapStops: 'बदलें',
    findRoutes: 'उपलब्ध बसें देखें',
    seatsAvailable: 'सीटें उपलब्ध हैं',
    moderatelyCrowded: 'मध्यम भीड़',
    veryCrowded: 'केवल खड़े रहने की जगह',
    staleGpsWarning: 'अंतिम जीपीएस अपडेट कुछ समय पुराना है। स्थान पूर्णतः सटीक नहीं हो सकता।',
    notSharingLocation: 'यह चालक वर्तमान में लाइव लोकेशन साझा नहीं कर रहा है।',
    noBusAssigned: 'वर्तमान में इस चालक को कोई बस आवंटित नहीं है।',
    driverPhoneMaskedNotice: 'गोपनीयता के लिए चालक का नंबर सुरक्षित रूप से छुपाया गया है।',
    textToSpeech: 'ऑडियो घोषणा सुनें',
    lowBandwidthToggle: 'धीमी इंटरनेट मोड (टेक्स्ट-ओनली)',
    highContrastToggle: 'हाई कंट्रास्ट मोड',
    fontSizeToggle: 'फॉन्ट आकार',
    smsFeaturePhoneSandbox: 'ऑफलाइन एसएमएस सिम्युलेटर',
    voiceHelpline: 'वॉयस हेल्पलाइन',
    reportIssue: 'शिकायत दर्ज करें',
    activeTrips: 'सक्रिय बसें',
    fare: 'अनुमानित किराया',
    estArrival: 'अनुमानित आगमन',
    nextStop: 'अगला स्टॉप',
    speed: 'गति',
    accuracy: 'सटीकता',
    lastUpdate: 'अंतिम जीपीएस अपडेट',
    close: 'बंद करें'
  }
};

const AccessibilityContext = createContext<AccessibilityContextType | undefined>(undefined);

export const AccessibilityProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLang] = useState<Language>(() => {
    return (localStorage.getItem('transitease_lang') as Language) || 'en';
  });

  const [highContrast, setHighContrast] = useState<boolean>(() => {
    return localStorage.getItem('transitease_contrast') === 'true';
  });

  const [fontSize, setFontSize] = useState<FontSize>(() => {
    return (localStorage.getItem('transitease_fontsize') as FontSize) || 'normal';
  });

  const [lowBandwidthMode, setLowBandwidthMode] = useState<boolean>(() => {
    return localStorage.getItem('transitease_low_bandwidth') === 'true';
  });

  useEffect(() => {
    localStorage.setItem('transitease_lang', lang);
    document.documentElement.lang = lang;
  }, [lang]);

  useEffect(() => {
    localStorage.setItem('transitease_contrast', highContrast ? 'true' : 'false');
    if (highContrast) {
      document.documentElement.classList.add('high-contrast');
    } else {
      document.documentElement.classList.remove('high-contrast');
    }
  }, [highContrast]);

  useEffect(() => {
    localStorage.setItem('transitease_fontsize', fontSize);
    if (fontSize === 'large') {
      document.documentElement.classList.add('text-scale-large');
    } else {
      document.documentElement.classList.remove('text-scale-large');
    }
  }, [fontSize]);

  useEffect(() => {
    localStorage.setItem('transitease_low_bandwidth', lowBandwidthMode ? 'true' : 'false');
  }, [lowBandwidthMode]);

  const toggleHighContrast = () => setHighContrast(prev => !prev);

  const t = (key: string): string => {
    return translations[lang]?.[key] || translations.en[key] || key;
  };

  const speak = (text: string) => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang === 'hi' ? 'hi-IN' : 'en-US';
    utterance.rate = 0.95;
    window.speechSynthesis.speak(utterance);
  };

  return (
    <AccessibilityContext.Provider
      value={{
        lang,
        setLang,
        highContrast,
        toggleHighContrast,
        fontSize,
        setFontSize,
        lowBandwidthMode,
        setLowBandwidthMode,
        t,
        speak
      }}
    >
      {children}
    </AccessibilityContext.Provider>
  );
};

export const useAccessibility = () => {
  const context = useContext(AccessibilityContext);
  if (!context) throw new Error('useAccessibility must be used within AccessibilityProvider');
  return context;
};
