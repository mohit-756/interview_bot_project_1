import { useState, useCallback, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Clock, CheckCircle2, AlertCircle, Loader2, Mail } from "lucide-react";
import { publicApi } from "../services/api";

function LoadingState() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-4">
      <div className="text-center">
        <div className="w-10 h-10 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-slate-600 dark:text-slate-300">Loading your interview slots...</p>
      </div>
    </div>
  );
}

function ErrorState({ error }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-4">
      <div className="max-w-md w-full bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-8 text-center shadow-lg">
        <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="text-red-600 dark:text-red-400" size={32} />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Link Expired</h1>
        <p className="text-slate-600 dark:text-slate-400 mb-4">{error}</p>
        <p className="text-sm text-slate-500 dark:text-slate-500">Please contact the hiring team to request a new link.</p>
      </div>
    </div>
  );
}

function SuccessState({ candidateName, jobTitle }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-slate-900 dark:to-slate-800 p-4">
      <div className="max-w-md w-full bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-8 text-center shadow-lg">
        <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 className="text-emerald-600 dark:text-emerald-400 animate-bounce" size={32} />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-1">Slot Selected!</h1>
        <p className="text-slate-600 dark:text-slate-400 mb-6">Your interview slot has been confirmed.</p>
        
        <div className="space-y-4 text-left mb-6">
          <div className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
            <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold">Position</p>
            <p className="text-lg font-semibold text-slate-900 dark:text-white">{jobTitle}</p>
          </div>
          <div className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
            <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold">Candidate</p>
            <p className="text-lg font-semibold text-slate-900 dark:text-white">{candidateName}</p>
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-sm text-slate-600 dark:text-slate-400">You'll receive an email with interview details shortly.</p>
          <button
            onClick={() => window.close()}
            className="w-full px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default function SlotSelectionPage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    async function loadSlots() {
      setLoading(true);
      setError(null);
      try {
        const result = await publicApi.getSlotPickerData(token);
        setData(result);
      } catch (err) {
        setError(err.message || "Unable to load interview slots");
      } finally {
        setLoading(false);
      }
    }
    
    if (token) {
      loadSlots();
    }
  }, [token]);

  const handleSelectSlot = useCallback(async () => {
    if (!selectedSlot || !data) return;
    
    setSubmitting(true);
    try {
      await publicApi.selectInterviewSlot(token, selectedSlot.id);
      setSubmitted(true);
    } catch (err) {
      setError(err.message || "Failed to select slot");
    } finally {
      setSubmitting(false);
    }
  }, [selectedSlot, token, data]);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState error={error} />;
  if (submitted) return <SuccessState candidateName={data?.candidate_name} jobTitle={data?.job_title} />;

  const slots = data?.slots || [];
  const sortedSlots = [...slots].sort((a, b) => 
    new Date(a.datetime).getTime() - new Date(b.datetime).getTime()
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-4 sm:p-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-slate-900 dark:text-white mb-2">
            Select Your Interview Time
          </h1>
          <p className="text-lg text-slate-600 dark:text-slate-400">
            Choose your preferred slot for the technical interview
          </p>
        </div>

        {/* Candidate Info Card */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 sm:p-8 mb-8 shadow-sm">
          <div className="grid grid-cols-2 gap-6">
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold mb-1">
                Candidate
              </p>
              <p className="text-xl font-bold text-slate-900 dark:text-white">
                {data?.candidate_name}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold mb-1">
                Position
              </p>
              <p className="text-xl font-bold text-slate-900 dark:text-white">
                {data?.job_title}
              </p>
            </div>
          </div>
          {data?.candidate_email && (
            <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700 flex items-center gap-2 text-slate-600 dark:text-slate-400">
              <Mail size={16} />
              <span className="text-sm">{data.candidate_email}</span>
            </div>
          )}
        </div>

        {/* Slots Grid */}
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
            Available Slots ({slots.length})
          </h2>
          
          {slots.length === 0 ? (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-xl p-6 text-center">
              <AlertCircle className="mx-auto mb-2 text-yellow-600 dark:text-yellow-400" size={28} />
              <p className="text-yellow-800 dark:text-yellow-200 font-medium">No slots available</p>
              <p className="text-yellow-700 dark:text-yellow-300 text-sm mt-1">
                Please contact the hiring team
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
                {sortedSlots.map((slot) => (
                  <button
                    key={slot.id}
                    onClick={() => setSelectedSlot(slot)}
                    disabled={submitting}
                    className={`p-4 rounded-xl border-2 transition-all text-left ${
                      selectedSlot?.id === slot.id
                        ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                        : "border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-600 bg-white dark:bg-slate-800"
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`mt-1 p-2 rounded-lg ${
                        selectedSlot?.id === slot.id
                          ? "bg-blue-100 dark:bg-blue-900"
                          : "bg-slate-100 dark:bg-slate-700"
                      }`}>
                        <Clock size={18} className={selectedSlot?.id === slot.id ? "text-blue-600" : "text-slate-500"} />
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-slate-900 dark:text-white">
                          {new Date(slot.datetime).toLocaleDateString("en-US", {
                            weekday: "short",
                            month: "short",
                            day: "numeric",
                          })}
                        </p>
                        <p className="text-slate-600 dark:text-slate-400 text-sm">
                          {new Date(slot.datetime).toLocaleTimeString("en-US", {
                            hour: "2-digit",
                            minute: "2-digit",
                            hour12: true,
                          })}
                        </p>
                        {slot.is_selected && (
                          <p className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold mt-1">
                            ✓ Already selected
                          </p>
                        )}
                      </div>
                      {selectedSlot?.id === slot.id && (
                        <CheckCircle2 className="text-blue-600 dark:text-blue-400 mt-1" size={20} />
                      )}
                    </div>
                  </button>
                ))}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={handleSelectSlot}
                  disabled={!selectedSlot || submitting}
                  className="flex-1 px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 disabled:cursor-not-allowed"
                >
                  {submitting ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      Confirming...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={18} />
                      Confirm Selection
                    </>
                  )}
                </button>
              </div>
            </>
          )}
        </div>

        {/* Footer Info */}
        <div className="mt-12 text-center text-sm text-slate-600 dark:text-slate-400">
          <p>Need to reschedule? Contact the hiring team for a new link.</p>
        </div>
      </div>
    </div>
  );
}
