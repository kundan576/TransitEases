import React, { useState } from 'react';
import { AlertCircle, CheckCircle2, X, FileText, Search } from 'lucide-react';

interface ReportGrievanceModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ReportGrievanceModal: React.FC<ReportGrievanceModalProps> = ({ isOpen, onClose }) => {
  const [tab, setTab] = useState<'submit' | 'track'>('submit');
  const [category, setCategory] = useState<'incorrect_location' | 'missed_stop' | 'unsafe_driving' | 'accessibility' | 'cleanliness' | 'other'>('incorrect_location');
  const [description, setDescription] = useState('');
  const [passengerName, setPassengerName] = useState('');
  const [passengerMobile, setPassengerMobile] = useState('');
  const [busNumber, setBusNumber] = useState('UP16-1001');
  const [submittedRef, setSubmittedRef] = useState<string | null>(null);
  const [trackRef, setTrackRef] = useState('');
  const [trackedReport, setTrackedReport] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) {
      setError('Please provide details about the incident.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category,
          description,
          passengerName,
          passengerMobile,
          busId: busNumber
        })
      });
      const data = await res.json();
      if (res.ok) {
        setSubmittedRef(data.referenceNumber);
        setDescription('');
      } else {
        setError(data.error || 'Failed to submit report.');
      }
    } catch {
      setError('Connection failure submitting report.');
    } finally {
      setLoading(false);
    }
  };

  const handleTrack = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!trackRef.trim()) return;

    setLoading(true);
    setError(null);
    setTrackedReport(null);

    try {
      const res = await fetch(`/api/reports/${encodeURIComponent(trackRef.trim())}`);
      const data = await res.json();
      if (res.ok) {
        setTrackedReport(data.report);
      } else {
        setError(data.error || 'Report reference number not found.');
      }
    } catch {
      setError('Failed to connect to grievance tracking server.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[1200] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-xl max-w-lg w-full p-5 sm:p-6 shadow-xl border border-slate-200">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-slate-100 text-slate-800 rounded-lg">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900">Passenger Grievance Desk</h3>
              <p className="text-xs text-slate-500">Official feedback and incident reporting</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 rounded cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200 mb-4 text-xs font-semibold">
          <button
            onClick={() => setTab('submit')}
            className={`pb-2 px-3 border-b-2 cursor-pointer transition-colors ${
              tab === 'submit' ? 'border-slate-900 text-slate-900 font-bold' : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            Report Incident
          </button>
          <button
            onClick={() => setTab('track')}
            className={`pb-2 px-3 border-b-2 cursor-pointer transition-colors ${
              tab === 'track' ? 'border-slate-900 text-slate-900 font-bold' : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            Track Existing Grievance
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
        )}

        {tab === 'submit' ? (
          submittedRef ? (
            <div className="p-5 bg-emerald-50 border border-emerald-200 rounded-lg text-center space-y-2">
              <CheckCircle2 className="w-7 h-7 text-emerald-600 mx-auto" />
              <h4 className="font-bold text-slate-900 text-sm">Grievance Registered Successfully</h4>
              <p className="text-xs text-slate-600">Your complaint reference tracking number is:</p>
              <div className="font-mono text-sm font-bold text-emerald-800 bg-white py-1 px-3 rounded-md border border-emerald-300 inline-block">
                {submittedRef}
              </div>
              <p className="text-[11px] text-slate-500">
                Transit administrators have received this alert. Save this reference number to check resolution status.
              </p>
              <button
                onClick={() => setSubmittedRef(null)}
                className="mt-2 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold cursor-pointer shadow-2xs"
              >
                Submit Another Report
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Issue Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as any)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-900 text-xs"
                >
                  <option value="incorrect_location">Incorrect Bus GPS Location</option>
                  <option value="missed_stop">Bus Missed Designated Stop</option>
                  <option value="unsafe_driving">Unsafe Driving / Speeding</option>
                  <option value="accessibility">Accessibility / Ramp / Senior Citizen Issue</option>
                  <option value="cleanliness">Bus Cleanliness / Maintenance</option>
                  <option value="other">Other Service Feedback</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Bus Number (optional)</label>
                  <input
                    type="text"
                    value={busNumber}
                    onChange={(e) => setBusNumber(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 text-xs font-mono"
                    placeholder="e.g., UP16-1001"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Your Mobile (optional)</label>
                  <input
                    type="tel"
                    value={passengerMobile}
                    onChange={(e) => setPassengerMobile(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 text-xs font-mono"
                    placeholder="For status updates"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Describe Incident</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 text-xs"
                  placeholder="Provide stop name, time, or behavior details..."
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-semibold text-xs transition cursor-pointer disabled:opacity-50 shadow-2xs"
                >
                  {loading ? 'Submitting...' : 'File Grievance'}
                </button>
              </div>
            </form>
          )
        ) : (
          <div className="space-y-3 text-xs">
            <form onSubmit={handleTrack} className="flex gap-2">
              <input
                type="text"
                value={trackRef}
                onChange={(e) => setTrackRef(e.target.value)}
                placeholder="Enter Reference (e.g., REP-TE-...)"
                className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-mono text-slate-900 uppercase text-xs"
                required
              />
              <button
                type="submit"
                disabled={loading}
                className="px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-semibold text-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-2xs"
              >
                <Search className="w-3.5 h-3.5" />
                <span>Track</span>
              </button>
            </form>

            {trackedReport && (
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-slate-900">{trackedReport.referenceNumber}</span>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-sm uppercase border ${
                    trackedReport.status === 'resolved'
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                      : 'bg-amber-50 text-amber-800 border-amber-200'
                  }`}>
                    {trackedReport.status.replace('_', ' ')}
                  </span>
                </div>
                <div className="text-slate-600">Category: <strong>{trackedReport.category}</strong></div>
                <div className="text-slate-500 text-[11px] font-mono">Submitted: {new Date(trackedReport.createdAt).toLocaleString()}</div>
                {trackedReport.resolutionNotes && (
                  <div className="p-2 bg-emerald-50/70 border border-emerald-200 rounded text-emerald-900 font-medium text-xs mt-1">
                    Admin Resolution: {trackedReport.resolutionNotes}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
