import React, { useState } from 'react';
import { Smartphone, Send, X, Sparkles } from 'lucide-react';

interface SMSFeaturePhoneSimulatorProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Message {
  sender: 'user' | 'system';
  text: string;
  time: string;
}

export const SMSFeaturePhoneSimulator: React.FC<SMSFeaturePhoneSimulatorProps> = ({ isOpen, onClose }) => {
  const [mobileNumber, setMobileNumber] = useState('9988776655');
  const [commandInput, setCommandInput] = useState('BUS UP16-1001');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      sender: 'system',
      text: 'TransitEase SMS Gateway Ready. Send HELP for command list or BUS <num> for live GPS without internet.',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);

  if (!isOpen) return null;

  const handleSend = async (customCmd?: string) => {
    const textToSend = (customCmd !== undefined ? customCmd : commandInput).trim();
    if (!textToSend) return;

    const userTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setMessages(prev => [...prev, { sender: 'user', text: textToSend, time: userTime }]);
    if (customCmd === undefined) setCommandInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/sms/test-command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mobile: mobileNumber,
          commandText: textToSend
        })
      });

      const data = await res.json();
      const replyTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      setMessages(prev => [
        ...prev,
        {
          sender: 'system',
          text: data.replyMessage || 'No reply from SMS gateway.',
          time: replyTime
        }
      ]);
    } catch {
      setMessages(prev => [
        ...prev,
        {
          sender: 'system',
          text: 'TransitEase: Telecom network timeout. Please verify SMS gateway service.',
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const sampleCommands = [
    { label: 'Live Bus GPS', cmd: 'BUS UP16-1001' },
    { label: 'Stop Arrivals', cmd: 'STOP KNP01' },
    { label: 'Route Plan', cmd: 'ROUTE KNP01 SRJ05' },
    { label: 'Set Arrival SMS', cmd: 'ALERT UP16-1001 KNP01 10' },
    { label: 'Check My Alerts', cmd: 'MYALERTS' },
    { label: 'Opt-out / Cancel', cmd: 'CANCEL' },
    { label: 'Help Menu', cmd: 'HELP' }
  ];

  return (
    <div className="fixed inset-0 z-[1200] bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-slate-900 text-slate-100 rounded-xl max-w-md w-full shadow-2xl border border-slate-700 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Terminal Header */}
        <div className="p-3.5 bg-slate-800/90 border-b border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-slate-700 text-emerald-400 rounded-lg">
              <Smartphone className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-xs text-white flex items-center gap-1.5">
                <span>SMS Feature Phone Terminal</span>
                <span className="text-[10px] text-emerald-400 font-mono">
                  · 2G Offline Mode
                </span>
              </h3>
              <p className="text-[10px] text-slate-400">
                Simulating basic feature phone text messages
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-700/60 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Info Banner */}
        <div className="bg-slate-800/50 px-3.5 py-2 border-b border-slate-800 flex items-center justify-between text-[11px] text-slate-400 font-mono">
          <span>Shortcode: <strong>56767</strong></span>
          <div className="flex items-center gap-1">
            <span>Simulated SIM:</span>
            <input
              type="text"
              value={mobileNumber}
              onChange={(e) => setMobileNumber(e.target.value)}
              className="bg-slate-700 text-white px-1.5 py-0.5 rounded text-[11px] w-24 font-mono text-center border border-slate-600"
            />
          </div>
        </div>

        {/* Message History Screen */}
        <div className="flex-1 p-3.5 overflow-y-auto space-y-2.5 min-h-[240px] bg-slate-950 font-mono text-xs">
          {messages.map((m, idx) => (
            <div
              key={idx}
              className={`flex flex-col ${m.sender === 'user' ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-lg px-3 py-2 leading-relaxed text-xs ${
                  m.sender === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-800 text-emerald-300 border border-slate-700'
                }`}
              >
                {m.text}
              </div>
              <span className="text-[10px] text-slate-500 mt-0.5 px-1 font-mono">{m.time}</span>
            </div>
          ))}

          {loading && (
            <div className="flex items-center gap-2 text-slate-500 text-xs italic">
              <span className="text-[11px]">Transmitting SMS via telecom gateway...</span>
            </div>
          )}
        </div>

        {/* Quick Command Chips */}
        <div className="p-2.5 bg-slate-900 border-t border-slate-800">
          <div className="text-[10px] text-slate-400 font-semibold mb-1 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-amber-400" />
            <span>Try sample commands:</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {sampleCommands.map((c) => (
              <button
                key={c.cmd}
                onClick={() => handleSend(c.cmd)}
                className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded text-[10px] font-mono transition border border-slate-700/80 cursor-pointer"
              >
                {c.cmd}
              </button>
            ))}
          </div>
        </div>

        {/* Input Bar */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="p-2.5 bg-slate-800 border-t border-slate-700 flex gap-2"
        >
          <input
            type="text"
            value={commandInput}
            onChange={(e) => setCommandInput(e.target.value)}
            placeholder="Type command (e.g. BUS UP16-1001)"
            className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs font-mono text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
          />
          <button
            type="submit"
            disabled={loading}
            className="px-3.5 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white rounded-lg text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Send</span>
          </button>
        </form>
      </div>
    </div>
  );
};
