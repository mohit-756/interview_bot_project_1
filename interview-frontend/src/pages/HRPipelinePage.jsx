import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Eye, RefreshCw, ThumbsDown, ThumbsUp } from "lucide-react";
import StatusBadge from "../components/StatusBadge";
import ScoreBadge from "../components/ScoreBadge";
import { hrApi } from "../services/api";
import { ATS_STAGE_DEFINITIONS as PIPELINE_STAGES, normalizeStageKey } from "../utils/stages";

function getCandidateJdId(candidate) {
  const jdId = candidate?.assignedJd?.id ?? candidate?.job?.id ?? null;
  return jdId == null ? "" : String(jdId);
}

function CandidateCard({ candidate, onQuickAction, quickActionLoadingId }) {
  const currentStage = normalizeStageKey(candidate?.interviewStatus?.key);
  const isUpdating = quickActionLoadingId === candidate?.result_id;

  return (
    <div className="pipeline-card">
      <div className="pipeline-card-header">
        <div>
          <h4>{candidate?.name || "Unnamed candidate"}</h4>
          <p>{candidate?.candidate_uid || "No ID"}</p>
        </div>
        <StatusBadge status={candidate?.finalDecision} />
      </div>
      <div className="pipeline-card-body">
        <div className="pipeline-card-metrics">
          <div>
            <span>Final Score</span>
            <ScoreBadge score={candidate?.finalAIScore || 0} />
          </div>
          <div>
            <span>Match %</span>
            <strong>{candidate?.matchPercent || 0}%</strong>
          </div>
        </div>
        <p><strong>Recommendation:</strong> {candidate?.recommendationTag || "N/A"}</p>
        <p><strong>Assigned JD:</strong> {candidate?.assignedJd?.title || candidate?.role || "Not assigned"}</p>
      </div>
      <div className="pipeline-card-footer pipeline-card-actions">
        <Link to={`/hr/candidates/${candidate?.candidate_uid}`} className="pipeline-action-button pipeline-action-link"><Eye size={14} /><span>View</span></Link>
        <button type="button" disabled={isUpdating || currentStage === "shortlisted"} onClick={(event) => { event.stopPropagation(); onQuickAction(candidate, "shortlisted"); }} className="pipeline-action-button"><ThumbsUp size={14} /><span>Shortlist</span></button>
        <button type="button" disabled={isUpdating || currentStage === "rejected"} onClick={(event) => { event.stopPropagation(); onQuickAction(candidate, "rejected"); }} className="pipeline-action-button danger"><ThumbsDown size={14} /><span>Reject</span></button>
      </div>
    </div>
  );
}

export default function HRPipelinePage() {
  const [candidates, setCandidates] = useState([]);
  const [availableJds, setAvailableJds] = useState([]);
  const [selectedJdId, setSelectedJdId] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatingResultId, setUpdatingResultId] = useState(null);

  async function loadCandidates() {
    setLoading(true);
    setError("");
    try {
      let page = 1;
      let hasMore = true;
      let allCandidates = [];
      while (hasMore) {
        const response = await hrApi.listCandidates({ page, sort: "highest_score" });
        allCandidates = allCandidates.concat(response?.candidates || []);
        hasMore = Boolean(response?.has_next);
        page += 1;
      }

      const jds = await hrApi.listJds();
      const safeJds = Array.isArray(jds)
        ? jds
        : Array.isArray(jds?.jobs)
          ? jds.jobs
          : Array.isArray(jds?.jds)
            ? jds.jds
            : [];

      setAvailableJds(safeJds);
      setCandidates(Array.isArray(allCandidates) ? allCandidates.filter((item) => item?.result_id) : []);
    } catch (loadError) {
      setError(loadError.message || "Failed to load pipeline.");
      setCandidates([]);
      setAvailableJds([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCandidates();
  }, []);

  const filteredCandidates = useMemo(() => {
    if (selectedJdId === "all") return candidates;
    return candidates.filter((candidate) => getCandidateJdId(candidate) === String(selectedJdId));
  }, [candidates, selectedJdId]);

  const groupedCandidates = useMemo(() => {
    const groups = Object.fromEntries(PIPELINE_STAGES.map((stage) => [stage.key, []]));
    for (const candidate of filteredCandidates) {
      const stageKey = normalizeStageKey(candidate?.interviewStatus?.key);
      groups[stageKey].push(candidate);
    }
    return groups;
  }, [filteredCandidates]);

  const totalCandidates = filteredCandidates.length;

  function updateCandidateStageLocally(candidateId, nextStage) {
    const normalizedStage = normalizeStageKey(nextStage);
    setCandidates((current) => current.map((item) => item.result_id === candidateId ? {
      ...item,
      interviewStatus: {
        ...(item.interviewStatus || {}),
        key: normalizedStage,
        label: PIPELINE_STAGES.find((stage) => stage.key === normalizedStage)?.label || normalizedStage,
      },
    } : item));
  }

  async function persistStageChange(candidate, nextStage, notePrefix = "Updated from HR pipeline") {
    const normalizedStage = normalizeStageKey(nextStage);
    const currentStage = normalizeStageKey(candidate?.interviewStatus?.key);
    if (!candidate?.result_id || currentStage === normalizedStage) return;

    const previousCandidates = candidates;
    updateCandidateStageLocally(candidate.result_id, normalizedStage);
    setUpdatingResultId(candidate.result_id);
    setError("");

    try {
      await hrApi.updateCandidateStage(candidate.result_id, { stage: normalizedStage, note: `${notePrefix} to ${normalizedStage}.` });
      await loadCandidates();
    } catch (updateError) {
      setCandidates(previousCandidates);
      setError(updateError.message || "Failed to update candidate stage.");
    } finally {
      setUpdatingResultId(null);
    }
  }

  async function handleQuickAction(candidate, nextStage) {
    await persistStageChange(candidate, nextStage, "Updated from HR pipeline quick action");
  }

  if (loading) return <p className="center muted">Loading HR pipeline...</p>;

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 page-enter">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white font-display">HR Pipeline</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Drag candidates between ATS stages and manage the recruiting pipeline visually.</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="pipeline-filter-wrap">
            <label htmlFor="pipeline-jd-filter" className="pipeline-filter-label">JD Filter</label>
            <select id="pipeline-jd-filter" value={selectedJdId} onChange={(event) => setSelectedJdId(event.target.value)} className="pipeline-filter-select">
              <option value="all">All JDs</option>
              {availableJds.map((jd) => <option key={jd.id} value={jd.id}>{jd.title}</option>)}
            </select>
          </div>
          <Link to="/hr/candidates" className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 px-5 py-2.5 rounded-xl font-bold flex items-center space-x-2 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"><Eye size={18} /><span>Candidate List</span></Link>
          <button type="button" onClick={loadCandidates} className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-bold flex items-center space-x-2 transition-all shadow-lg shadow-blue-200 dark:shadow-none"><RefreshCw size={18} /><span>Refresh</span></button>
        </div>
      </div>

      {error ? <p className="alert error">{error}</p> : null}
      {updatingResultId ? <p className="muted text-sm">Updating stage for result #{updatingResultId}...</p> : null}

      {!totalCandidates ? (
        <section className="card stack empty-state-card">
          <p className="eyebrow">Pipeline</p>
          <h3>{selectedJdId === "all" ? "No candidates available" : "No candidates for selected JD"}</h3>
          <p className="muted">{selectedJdId === "all" ? "Candidates will appear here once applications are available." : "Try another JD or switch back to All JDs."}</p>
        </section>
      ) : (
        <div className="space-y-6">
          {PIPELINE_STAGES.map((stage) => {
            const stageCandidates = groupedCandidates[stage.key] || [];
            if (!stageCandidates.length) return null;
            return (
              <div key={stage.key} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                <div className="px-5 py-3 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                  <h3 className="font-bold text-slate-900 dark:text-white">{stage.label} <span className="text-slate-500 text-sm">({stageCandidates.length} candidates)</span></h3>
                  <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-sm font-bold rounded-full">{stageCandidates.length}</span>
                </div>
                <div className="p-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {stageCandidates.map((candidate) => (
                      <CandidateCard key={candidate.result_id} candidate={candidate} onQuickAction={handleQuickAction} quickActionLoadingId={updatingResultId} />
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
