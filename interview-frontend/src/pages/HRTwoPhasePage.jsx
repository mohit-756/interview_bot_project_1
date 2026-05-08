import { useState, useCallback, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Users, Clock, CheckCircle2, Send, Copy, Calendar, MapPin, ChevronRight, ChevronDown, Loader2, AlertCircle, X } from "lucide-react";
import PageHeader from "../components/PageHeader";
import { hrApi, publicApi } from "../services/api";
import { useToast } from "../context/ToastContext";

const STAGE_COLORS = {
  applied: "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300",
  screening: "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300",
  shortlisted: "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300",
  interview_scheduled: "bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300",
  interview_completed: "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300",
  slots_created: "bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300",
  r1_selected: "bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300",
  final_selected: "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300",
};

function CandidateRow({ candidate, resultId, onSelectCandidate, selectedResultId }) {
  const isSelected = selectedResultId === resultId;
  return (
    <div
      onClick={() => onSelectCandidate(resultId, candidate)}
      className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
        isSelected
          ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
          : "border-slate-200 dark:border-slate-700 hover:border-blue-300 bg-white dark:bg-slate-800"
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-slate-900 dark:text-white truncate">{candidate.name}</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 truncate">{candidate.email}</p>
          <div className="mt-2">
            <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium ${STAGE_COLORS[candidate.status?.key] || STAGE_COLORS.applied}`}>
              {candidate.status?.label || "Applied"}
            </span>
          </div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{Math.round(candidate.finalAIScore || 0)}%</div>
          <p className="text-xs text-slate-500">Score</p>
        </div>
      </div>
    </div>
  );
}

function AssignTab({ candidates, jds, onSelectCandidate, selectedResultId, selectedCandidate }) {
  const [selectedJd, setSelectedJd] = useState("");
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  const filteredCandidates = useMemo(() => {
    if (!selectedJd) return candidates;
    return candidates.filter(c => {
      const jdId = c.assignedJd?.id || c.job?.id;
      return String(jdId) === String(selectedJd);
    });
  }, [candidates, selectedJd]);

  const handleAssign = useCallback(async (candidate) => {
    if (!selectedJd) {
      toast?.error("Select a JD first");
      return;
    }
    setLoading(true);
    try {
      await hrApi.assignCandidateToJd(candidate.candidate_uid, parseInt(selectedJd));
      toast?.success("Candidate assigned to JD");
    } catch (err) {
      toast?.error(err.message);
    } finally {
      setLoading(false);
    }
  }, [selectedJd, toast]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-semibold text-slate-900 dark:text-white mb-2">Select JD</label>
          <select
            value={selectedJd}
            onChange={(e) => setSelectedJd(e.target.value)}
            className="w-full px-4 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
          >
            <option value="">All JDs</option>
            {jds.map((jd) => (
              <option key={jd.id} value={jd.id}>{jd.title}</option>
            ))}
          </select>
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-900 dark:text-white mb-2">Total: {filteredCandidates.length}</p>
        </div>
      </div>

      <div className="space-y-3 max-h-96 overflow-y-auto">
        {filteredCandidates.map((candidate) => (
          <div key={candidate.candidate_uid} className="flex items-center gap-3">
            <div className="flex-1">
              <CandidateRow
                candidate={candidate}
                resultId={candidate.id}
                onSelectCandidate={(rid, cand) => onSelectCandidate(rid, cand)}
                selectedResultId={selectedResultId}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SlotsTab({ selectedCandidate, selectedResultId, onRefresh }) {
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(false);
  const [newSlot, setNewSlot] = useState("");
  const [creating, setCreating] = useState(false);
  const toast = useToast();

  const loadSlots = useCallback(async () => {
    if (!selectedResultId) return;
    setLoading(true);
    try {
      const data = await hrApi.getInterviewSlots(selectedResultId);
      setSlots(data.slots || []);
    } catch (err) {
      toast?.error(err.message);
    } finally {
      setLoading(false);
    }
  }, [selectedResultId, toast]);

  useEffect(() => {
    loadSlots();
  }, [loadSlots]);

  const handleAddSlot = useCallback(async () => {
    if (!newSlot) {
      toast?.error("Select a datetime");
      return;
    }
    setCreating(true);
    try {
      const currentSlots = slots.map((s) => s.datetime);
      const allSlots = [...currentSlots, newSlot];
      const result = await hrApi.createInterviewSlots(selectedResultId, allSlots);
      setSlots((prev) => [...prev, { id: Date.now(), datetime: newSlot, is_selected: false }]);
      setNewSlot("");
      onRefresh?.();
      toast?.success("Slot added successfully");
    } catch (err) {
      toast?.error(err.message);
    } finally {
      setCreating(false);
    }
  }, [newSlot, slots, selectedResultId, toast, onRefresh]);

  if (!selectedResultId) {
    return <div className="text-center py-8 text-slate-500 dark:text-slate-400">Select a candidate first</div>;
  }

  if (loading) {
    return <div className="flex items-center justify-center py-8"><Loader2 className="animate-spin mr-2" /> Loading slots...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
        <h3 className="font-semibold text-slate-900 dark:text-white mb-3">Add New Slot</h3>
        <div className="flex gap-3">
          <input
            type="datetime-local"
            value={newSlot}
            onChange={(e) => setNewSlot(e.target.value)}
            className="flex-1 px-4 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
          />
          <button
            onClick={handleAddSlot}
            disabled={creating || !newSlot}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white font-semibold rounded-lg transition-colors flex items-center gap-2"
          >
            {creating ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
            Add
          </button>
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="font-semibold text-slate-900 dark:text-white">Available Slots ({slots.length})</h3>
        {slots.length === 0 ? (
          <div className="text-center py-6 text-slate-500 dark:text-slate-400">No slots created yet</div>
        ) : (
          slots.map((slot) => (
            <div
              key={slot.id}
              className={`p-4 rounded-lg border flex items-center gap-3 ${
                slot.is_selected
                  ? "bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700"
                  : "bg-slate-50 dark:bg-slate-700/50 border-slate-200 dark:border-slate-600"
              }`}
            >
              <Clock size={18} className={slot.is_selected ? "text-green-600" : "text-slate-400"} />
              <span className="flex-1 text-slate-900 dark:text-white">
                {new Date(slot.datetime).toLocaleString()}
              </span>
              {slot.is_selected && (
                <span className="px-2.5 py-1 bg-green-600 text-white text-xs font-semibold rounded-full flex items-center gap-1">
                  <CheckCircle2 size={12} /> Selected
                </span>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function Round2Tab({ selectedCandidate, selectedResultId, onRefresh }) {
  const [round2, setRound2] = useState(null);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [datetime, setDatetime] = useState("");
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  const loadRound2 = useCallback(async () => {
    if (!selectedResultId) return;
    setLoading(true);
    try {
      const data = await hrApi.getRound2Details(selectedResultId);
      if (data.round2) {
        setRound2(data.round2);
        setDatetime(data.round2.interview_datetime);
        setLocation(data.round2.location || "");
        setNotes(data.round2.notes || "");
      }
    } catch (err) {
      toast?.error(err.message);
    } finally {
      setLoading(false);
    }
  }, [selectedResultId, toast]);

  useEffect(() => {
    loadRound2();
  }, [loadRound2]);

  const handleSchedule = useCallback(async () => {
    if (!datetime) {
      toast?.error("Select a datetime");
      return;
    }
    setSaving(true);
    try {
      await hrApi.scheduleRound2Interview(selectedResultId, {
        interview_datetime: datetime,
        location,
        notes,
      });
      setRound2({ interview_datetime: datetime, location, notes });
      setEditing(false);
      onRefresh?.();
      toast?.success("Round 2 scheduled successfully");
    } catch (err) {
      toast?.error(err.message);
    } finally {
      setSaving(false);
    }
  }, [datetime, location, notes, selectedResultId, toast, onRefresh]);

  if (!selectedResultId) {
    return <div className="text-center py-8 text-slate-500 dark:text-slate-400">Select a candidate first</div>;
  }

  if (loading) {
    return <div className="flex items-center justify-center py-8"><Loader2 className="animate-spin mr-2" /> Loading...</div>;
  }

  if (!round2 && !editing) {
    return (
      <div className="text-center py-8">
        <AlertCircle className="mx-auto mb-3 text-slate-400" size={32} />
        <p className="text-slate-600 dark:text-slate-400 mb-4">Round 2 not scheduled yet</p>
        <button
          onClick={() => setEditing(true)}
          className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg"
        >
          Schedule Round 2
        </button>
      </div>
    );
  }

  if (editing || !round2) {
    return (
      <div className="space-y-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
        <div>
          <label className="block text-sm font-semibold text-slate-900 dark:text-white mb-2">Interview Date & Time</label>
          <input
            type="datetime-local"
            value={datetime}
            onChange={(e) => setDatetime(e.target.value)}
            className="w-full px-4 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-slate-900 dark:text-white mb-2">Location</label>
          <input
            type="text"
            placeholder="e.g., Conference Room A or Meeting Link"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="w-full px-4 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-slate-900 dark:text-white mb-2">Notes</label>
          <textarea
            placeholder="e.g., Bring references, Interview will focus on..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            className="w-full px-4 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none resize-none"
          />
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleSchedule}
            disabled={saving}
            className="flex-1 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Calendar size={16} />}
            Schedule
          </button>
          {round2 && (
            <button
              onClick={() => setEditing(false)}
              className="px-6 py-2.5 bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-white font-semibold rounded-lg hover:bg-slate-300"
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <Calendar size={18} className="text-blue-600" />
            <p className="text-sm text-slate-500 dark:text-slate-400">Interview Date & Time</p>
          </div>
          <p className="text-lg font-semibold text-slate-900 dark:text-white">
            {new Date(round2.interview_datetime).toLocaleString()}
          </p>
        </div>
        <button
          onClick={() => setEditing(true)}
          className="px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold rounded-lg hover:bg-slate-200"
        >
          Edit
        </button>
      </div>
      {round2.location && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <MapPin size={18} className="text-blue-600" />
            <p className="text-sm text-slate-500 dark:text-slate-400">Location</p>
          </div>
          <p className="text-slate-900 dark:text-white font-medium">{round2.location}</p>
        </div>
      )}
      {round2.notes && (
        <div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">Notes</p>
          <p className="text-slate-900 dark:text-white whitespace-pre-wrap">{round2.notes}</p>
        </div>
      )}
    </div>
  );
}

export default function HRTwoPhasePage() {
  const navigate = useNavigate();
  const [candidates, setCandidates] = useState([]);
  const [jds, setJds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("assign");
  const [selectedResultId, setSelectedResultId] = useState(null);
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const toast = useToast();

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [candData, jdData] = await Promise.all([hrApi.listCandidates(), hrApi.listJds()]);
      setCandidates(candData.candidates || []);
      setJds(Array.isArray(jdData) ? jdData : jdData?.jds || []);
    } catch (err) {
      toast?.error(err.message);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-slate-500 dark:text-slate-400">Loading...</p>
        </div>
      </div>
    );
  }

  const tabs = [
    { key: "assign", label: "Assign JD", icon: Users },
    { key: "slots", label: "Create Slots", icon: Clock },
    { key: "round2", label: "Schedule Round 2", icon: CheckCircle2 },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="2-Phase Interview Workflow"
        subtitle="HR-managed workflow: assign JDs → create slots → schedule Round 2"
      />

      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="flex border-b border-slate-200 dark:border-slate-700">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex-1 px-6 py-4 font-semibold transition-colors flex items-center justify-center gap-2 ${
                  activeTab === tab.key
                    ? "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-b-2 border-blue-600"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                }`}
              >
                <Icon size={18} />
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="p-6">
          {activeTab === "assign" && (
            <AssignTab
              candidates={candidates}
              jds={jds}
              onSelectCandidate={(rid, cand) => {
                setSelectedResultId(rid);
                setSelectedCandidate(cand);
              }}
              selectedResultId={selectedResultId}
              selectedCandidate={selectedCandidate}
            />
          )}
          {activeTab === "slots" && (
            <SlotsTab
              selectedCandidate={selectedCandidate}
              selectedResultId={selectedResultId}
              onRefresh={loadData}
            />
          )}
          {activeTab === "round2" && (
            <Round2Tab
              selectedCandidate={selectedCandidate}
              selectedResultId={selectedResultId}
              onRefresh={loadData}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function Plus({ size = 24, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} {...props}>
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}
