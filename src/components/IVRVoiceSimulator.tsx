import React, { useState } from 'react';
import { PhoneCall, PhoneOff, Volume2, X } from 'lucide-react';
import { useAccessibility } from '../context/AccessibilityContext';

interface IVRVoiceSimulatorProps {
  isOpen: boolean;
  onClose: () => void;
}

export const IVRVoiceSimulator: React.FC<IVRVoiceSimulatorProps> = ({ isOpen, onClose }) => {
  const { speak } = useAccessibility();
  const [callActive, setCallActive] = useState(false);
  const [ivrStep, setIvrStep] = useState<'lang' | 'menu' | 'bus' | 'result'>('lang');
  const [selectedLang, setSelectedLang] = useState<'en' | 'hi'>('en');
  const [spokenMessage, setSpokenMessage] = useState('Dial 1800-TRANSIT (Toll Free Helpline)');

  if (!isOpen) return null;

  const startCall = () => {
    setCallActive(true);
    setIvrStep('lang');
    const msg = 'Welcome to TransitEase Voice Helpline. For English press 1. हिंदी के लिए 2 दबाएँ।';
    setSpokenMessage(msg);
    speak(msg);
  };

  const endCall = () => {
    setCallActive(false);
    setIvrStep('lang');
    setSpokenMessage('Call ended. Thank you for using TransitEase.');
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  };

  const handleKeypadPress = async (digit: string) => {
    if (!callActive) return;

    if (ivrStep === 'lang') {
      if (digit === '1') {
        setSelectedLang('en');
        setIvrStep('menu');
        const msg = 'Language set to English. Press 1 for Bus Arrival Status, Press 2 for Bus Stop Information.';
        setSpokenMessage(msg);
        speak(msg);
      } else if (digit === '2') {
        setSelectedLang('hi');
        setIvrStep('menu');
        const msg = 'भाषा हिंदी चुनी गई है। बस आगमन जानकारी के लिए 1 दबाएँ, बस स्टॉप की जानकारी के लिए 2 दबाएँ।';
        setSpokenMessage(msg);
        speak(msg);
      }
    } else if (ivrStep === 'menu') {
      if (digit === '1') {
        setIvrStep('bus');
        const msg = selectedLang === 'hi'
          ? 'कृपया अपनी बस का नंबर टाइप करें या 1 दबाकर बस 1001 की स्थिति जानें।'
          : 'Please enter your bus number, or press 1 to check Bus UP16-1001.';
        setSpokenMessage(msg);
        speak(msg);
      } else {
        setIvrStep('result');
        const msg = selectedLang === 'hi'
          ? 'नॉलेज पार्क स्टॉप पर अगली बस UP16-1001 लगभग 6 मिनट में आ रही है।'
          : 'At Knowledge Park stop, next bus UP16-1001 is expected in 6 minutes.';
        setSpokenMessage(msg);
        speak(msg);
      }
    } else if (ivrStep === 'bus') {
      try {
        const res = await fetch('/api/buses/search?query=UP16-1001');
        const data = await res.json();
        setIvrStep('result');

        let msg = '';
        if (data.found && data.bus) {
          const mins = data.nextStop?.estimatedMinutes || 6;
          const stopName = selectedLang === 'hi' ? (data.nextStop?.nameHi || 'परी चौक') : (data.nextStop?.name || 'Pari Chowk');
          msg = selectedLang === 'hi'
            ? `बस ${data.bus.busNumber} की स्थिति: अगला स्टॉप ${stopName} है, अनुमानित आगमन ${mins} मिनट में। सीटें उपलब्ध हैं। दोहराने के लिए 9 दबाएँ।`
            : `Bus ${data.bus.busNumber} status: Next stop is ${stopName}, expected in approximately ${mins} minutes. Seats are available. Press 9 to repeat.`;
        } else {
          msg = selectedLang === 'hi' ? 'बस की जानकारी उपलब्ध नहीं है।' : 'Bus information is currently unavailable.';
        }
        setSpokenMessage(msg);
        speak(msg);
      } catch {
        const err = 'Network service failure. Please try later.';
        setSpokenMessage(err);
        speak(err);
      }
    } else if (ivrStep === 'result' && digit === '9') {
      speak(spokenMessage);
    }
  };

  return (
    <div className="fixed inset-0 z-[1200] bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-slate-900 text-slate-100 rounded-xl max-w-sm w-full shadow-2xl border border-slate-700 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-3.5 bg-slate-800 border-b border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-slate-700 text-indigo-400 rounded-lg">
              <PhoneCall className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-xs text-white">IVR Voice Telephony</h3>
              <p className="text-[10px] text-slate-400">Toll-free helpline for feature phones</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-white rounded cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Call Screen Audio Display */}
        <div className="p-5 bg-slate-950 text-center flex flex-col items-center justify-center min-h-[130px] border-b border-slate-800">
          <div className={`p-2.5 rounded-full mb-2 ${callActive ? 'bg-emerald-500/20 text-emerald-400 animate-pulse' : 'bg-slate-800 text-slate-500'}`}>
            <Volume2 className="w-5 h-5" />
          </div>
          <p className="text-xs font-medium text-slate-300 leading-relaxed px-2">
            "{spokenMessage}"
          </p>
          <span className="text-[10px] text-indigo-400 font-mono mt-2">
            {callActive ? 'Connected · 1800-TRANSIT' : 'Disconnected'}
          </span>
        </div>

        {/* Dialpad */}
        <div className="p-4 bg-slate-900">
          <div className="grid grid-cols-3 gap-2 mb-3">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'].map((d) => (
              <button
                key={d}
                type="button"
                disabled={!callActive}
                onClick={() => handleKeypadPress(d)}
                className="py-2.5 bg-slate-800 hover:bg-slate-700 active:bg-indigo-600 disabled:opacity-40 text-white font-bold text-sm rounded-lg transition shadow-2xs cursor-pointer font-mono"
              >
                {d}
              </button>
            ))}
          </div>

          <div className="flex justify-center">
            {!callActive ? (
              <button
                type="button"
                onClick={startCall}
                className="w-full py-2.5 bg-emerald-700 hover:bg-emerald-600 text-white font-semibold text-xs rounded-lg flex items-center justify-center gap-2 shadow-xs transition cursor-pointer"
              >
                <PhoneCall className="w-3.5 h-3.5" />
                <span>Call Helpline (1800-TRANSIT)</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={endCall}
                className="w-full py-2.5 bg-rose-700 hover:bg-rose-600 text-white font-semibold text-xs rounded-lg flex items-center justify-center gap-2 shadow-xs transition cursor-pointer"
              >
                <PhoneOff className="w-3.5 h-3.5" />
                <span>End Call</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
