import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Users, UserCheck, UserX, CheckCircle2, Plus, TrendingUp } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import MetricCard from "../components/MetricCard";
import CandidateTable from "../components/CandidateTable";
import PageHeader from "../components/PageHeader";
import { hrApi } from "../services/api";

const EMPTY_LIST = [];

function ChartCard({ title, subtitle, accent, children }) {
  return (
    <div className={`bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden ${accent ? `chart-card-accent ${accent}` : ""}`}>
      <div className="p-6 border-b border-slate-100 dark:border-slate-800">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">{title}</h2>
        {subtitle ? <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{subtitle}</p> : null}
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}

export default function HRDashboardPage() {
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState(null);
  const [ranked, setRanked] = useState([]);
  const [candidatesData, setCandidatesData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tableLoading, setTableLoading] = useState(true);
  const [dashboardError, setDashboardError] = useState("");
  const [tableError, setTableError] = useState("");

const overview = dashboard?.analytics?.overview || {};
  const pipeline = dashboard?.analytics?.pipeline ?? EMPTY_LIST;
  const funnel = dashboard?.analytics?.funnel ?? EMPTY_LIST;

  const chartReadyFunnel = useMemo(() => funnel.map((item) => ({ name: item.label, value: item.count, fill: "#2563eb" })), [funnel]);

  if (loading && !dashboard) return (
    <div className="flex items-center justify-center py-20">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
        <p className="text-slate-500 dark:text-slate-400">Loading HR dashboard...</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="HR Dashboard"
        subtitle="Analytics, rankings, funnel health, and recent candidate activity."
        actions={(
          <>
            <button type="button" onClick={() => navigate("/hr/compare")} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 px-3 py-2 rounded-lg font-medium text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-all">
              Compare
            </button>
            <button type="button" onClick={() => navigate("/hr/candidates")} className="bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white px-3 py-2 rounded-lg font-medium text-sm transition-all">
              <Plus size={16} />
              <span>Manage</span>
            </button>
          </>
        )}
      />

      {dashboardError ? <p className="alert error">{dashboardError}</p> : null}
      {tableError ? <p className="alert error">{tableError}</p> : null}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 page-enter-delay-1">
        <MetricCard title="Total Candidates" value={overview.total_candidates || 0} icon={Users} color="blue" />
        <MetricCard title="Shortlisted" value={overview.shortlisted_count || 0} icon={UserCheck} color="green" />
        <MetricCard title="Rejected" value={overview.rejected_count || 0} icon={UserX} color="red" />
        <MetricCard title="Interview Completed" value={overview.completed_interviews || 0} icon={CheckCircle2} color="yellow" />
        <MetricCard title="Interview Success" value={`${Math.round(Number(overview.interview_success_rate || 0))}%`} icon={TrendingUp} color="blue" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 page-enter-delay-2">
        <div className="lg:col-span-3 space-y-6">
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <ChartCard title="Hiring Funnel" subtitle="Applied → shortlisted → interview completed → selected" accent="blue">
              {!chartReadyFunnel.length ? (
                <div className="text-center py-12 text-slate-500 dark:text-slate-400">
                  {loading ? "Loading..." : "No candidates yet"}
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={chartReadyFunnel} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis type="number" />
                    <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="value" fill="#2563eb" radius={[0, 8, 8, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartCard>

            <ChartCard title="Top Ranked Candidates" subtitle="Final weighted score sorted across current applications.">
              <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2">
                {!ranked.length ? <div className="text-center py-8 text-slate-500 dark:text-slate-400">No ranked candidates yet</div> : ranked.map((candidate) => {
                  const score = Math.round(Number(candidate.finalAIScore || candidate.score || 0));
                  const scoreColor = score >= 80 ? "green" : score >= 65 ? "blue" : "red";
                  return (
                    <div key={candidate.result_id} className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-800/30">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-bold text-slate-900 dark:text-white">#{candidate.rank || "-"} {candidate.name}</p>
                          <p className="text-xs text-slate-400">{candidate.candidate_uid}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-black text-blue-600">{score}%</p>
                          <div className="score-bar mt-1 w-16"><div className={`score-bar-fill ${scoreColor}`} style={{ width: `${score}%` }} /></div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ChartCard>
          </div>
        </div>

        <div className="lg:col-span-1" />

      </div>

      <ChartCard title="Recent Candidates" subtitle="List view preview with ranking and recommendations.">
        {tableLoading ? <p className="center muted py-8">Loading candidates...</p> : <CandidateTable candidates={candidatesData?.candidates || []} onDeleteCandidate={handleDeleteCandidate} onScheduleCandidate={handleScheduleCandidate} />}
      </ChartCard>
    </div>
  );
}
