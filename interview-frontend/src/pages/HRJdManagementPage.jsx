import { useCallback, useEffect, useState } from "react";
import {
  FileText, Plus, Upload, Trash2, Edit2, CheckCircle2,
  ChevronRight, Loader2, X, Sparkles, AlertCircle, Save,
  RotateCcw, FileUp, Hash, Percent, HelpCircle
} from "lucide-react";
import { hrApi } from "../services/api";

// ─── Skill row editor ──────────────────────────────────────────────────────────
function SkillRow({ skill, weight, onWeight, onRemove }) {
  return (
    <div className="flex items-center gap-3 group">
      <div className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl text-sm font-medium text-slate-900 dark:text-white capitalize border border-slate-100 dark:border-slate-700">
        {skill}
      </div>
      <div className="flex items-center gap-1">
        {[1,2,3,4,5,6,7,8,9,10].map((n) => (
          <button
            key={n}
            onClick={() => onWeight(skill, n)}
            className={`w-6 h-6 rounded text-xs font-bold transition-all ${
              n <= weight
                ? "bg-blue-600 text-white shadow-sm shadow-blue-200"
                : "bg-slate-100 dark:bg-slate-800 text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
            }`}
          >
            {n}
          </button>
        ))}
      </div>
      <button
        onClick={() => onRemove(skill)}
        className="opacity-0 group-hover:opacity-100 p-1 text-slate-300 hover:text-red-500 transition-all rounded"
      >
        <X size={14} />
      </button>
    </div>
  );
}

// ─── JD Card in the list ─────────────────────────────────────────────────────
function JdCard({ jd, isSelected, onSelect, onDelete, deleting }) {
  const skillCount = Object.keys(jd.weights_json || {}).length;
  return (
    <div
      onClick={() => onSelect(jd)}
      className={`cursor-pointer rounded-2xl border p-4 transition-all ${
        isSelected
          ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20 shadow-md shadow-blue-100 dark:shadow-none"
          : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className={`text-sm font-bold truncate ${isSelected ? "text-blue-700 dark:text-blue-300" : "text-slate-900 dark:text-white"}`}>
            {jd.title}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            {skillCount} skill{skillCount !== 1 ? "s" : ""} · {jd.qualify_score}% cutoff · {jd.total_questions}Q
          </p>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {isSelected && <ChevronRight size={14} className="text-blue-500" />}
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(jd.id); }}
            disabled={deleting === jd.id}
            className="p-1 text-slate-300 hover:text-red-500 disabled:opacity-40 transition-colors rounded"
          >
            {deleting === jd.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function HRJdManagementPage() {
  const [jds, setJds] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [saving, setSaving] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Form state
  const [editingId, setEditingId] = useState(null); // null = new
  const [title, setTitle] = useState("");
  const [jdText, setJdText] = useState("");
  const [skills, setSkills] = useState({});
  const [qualifyScore, setQualifyScore] = useState(65);
  const [totalQuestions, setTotalQuestions] = useState(8);
  const [newSkill, setNewSkill] = useState("");
  const [isDirty, setIsDirty] = useState(false);

  const selectedJd = editingId ? jds.find((j) => j.id === editingId) : null;

  const loadJds = useCallback(async () => {
    try {
      const r = await hrApi.listJds();
      setJds(r?.jds || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => { loadJds(); }, [loadJds]);

  function resetForm() {
    setEditingId(null);
    setTitle("");
    setJdText("");
    setSkills({});
    setQualifyScore(65);
    setTotalQuestions(8);
    setIsDirty(false);
    setError("");
  }

  function loadJdIntoForm(jd) {
    setEditingId(jd.id);
    setTitle(jd.title || "");
    setJdText(jd.jd_text || "");
    setSkills(jd.weights_json || {});
    setQualifyScore(jd.qualify_score ?? 65);
    setTotalQuestions(jd.total_questions ?? 8);
    setIsDirty(false);
    setError("");
    setSuccess("");
  }

  // ── File upload → LLM extraction ──────────────────────────────────────────
  async function handleFileUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setExtracting(true);
    setError("");
    setSuccess("");
    try {
      const result = await hrApi.uploadJd(file);
      if (result.ai_skills && Object.keys(result.ai_skills).length > 0) {
        setSkills(result.ai_skills);
        setSuccess(`AI extracted ${Object.keys(result.ai_skills).length} skills from the file.`);
        setIsDirty(true);
      }
      if (result.jd_title && !title) setTitle(result.jd_title);
      if (result.jd_text) setJdText(result.jd_text);
    } catch (e) {
      setError("Extraction failed: " + e.message);
    } finally {
      setExtracting(false);
      e.target.value = "";
    }
  }

  // ── Re-extract from pasted text ───────────────────────────────────────────
  async function handleExtractFromText() {
    if (!jdText.trim()) { setError("Paste JD text first."); return; }
    setExtracting(true);
    setError("");
    try {
      const fakeFile = new Blob([jdText], { type: "text/plain" });
      const formData = new FormData();
      formData.append("jd_file", fakeFile, "jd.txt");
      const result = await hrApi.uploadJd(fakeFile.constructor === Blob
        ? (() => { const f = new File([jdText], "jd.txt", { type: "text/plain" }); return f; })()
        : fakeFile);
      if (result.ai_skills && Object.keys(result.ai_skills).length > 0) {
        setSkills(result.ai_skills);
        setSuccess(`AI extracted ${Object.keys(result.ai_skills).length} skills from your text.`);
        setIsDirty(true);
      }
    } catch (e) {
      setError("Extraction failed: " + e.message);
    } finally {
      setExtracting(false);
    }
  }

  // ── Skill editing ────────────────────────────────────────────────────────
  function handleWeight(skill, w) {
    setSkills((p) => ({ ...p, [skill]: w }));
    setIsDirty(true);
  }
  function handleRemoveSkill(skill) {
    setSkills((p) => { const n = { ...p }; delete n[skill]; return n; });
    setIsDirty(true);
  }
  function handleAddSkill() {
    const s = newSkill.trim().toLowerCase();
    if (!s || skills[s] !== undefined) return;
    setSkills((p) => ({ ...p, [s]: 5 }));
    setNewSkill("");
    setIsDirty(true);
  }

  // ── Save ─────────────────────────────────────────────────────────────────
  async function handleSave() {
    if (!title.trim()) { setError("Job title is required."); return; }
    if (!Object.keys(skills).length && !jdText.trim()) {
      setError("Add at least one skill or some JD text.");
      return;
    }
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const payload = {
        title: title.trim(),
        jd_text: jdText.trim() || title.trim(),
        weights_json: skills,
        qualify_score: Number(qualifyScore),
        total_questions: Number(totalQuestions),
        min_academic_percent: 0,
        project_question_ratio: 0.8,
      };
      if (editingId) {
        await hrApi.updateJd(editingId, payload);
        setSuccess("JD updated successfully.");
      } else {
        await hrApi.createJd(payload);
        setSuccess("JD created successfully.");
        resetForm();
      }
      setIsDirty(false);
      await loadJds();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(jdId) {
    if (!confirm("Delete this JD? This cannot be undone.")) return;
    setDeletingId(jdId);
    try {
      await hrApi.deleteJd(jdId);
      if (editingId === jdId) resetForm();
      await loadJds();
    } catch (e) {
      setError(e.message);
    } finally {
      setDeletingId(null);
    }
  }

  const skillEntries = Object.entries(skills).sort((a, b) => b[1] - a[1]);
  const isNewForm = !editingId;

  return (
    <div className="h-full flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
            Job Descriptions
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            Upload a JD file or paste text — AI extracts skills automatically.
          </p>
        </div>
        <button
          onClick={resetForm}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold shadow-lg shadow-blue-200 dark:shadow-none transition-all"
        >
          <Plus size={16} />
          New JD
        </button>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6 min-h-0">

        {/* ── Left: JD list ──────────────────────────────────────────────── */}
        <div className="space-y-3 overflow-y-auto">
          {loadingList ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="animate-spin text-slate-400" size={24} />
            </div>
          ) : !jds.length ? (
            <div className="text-center py-12 text-slate-400">
              <FileText size={32} className="mx-auto mb-3 opacity-40" />
              <p className="text-sm">No JDs yet. Create your first one →</p>
            </div>
          ) : (
            <>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider px-1">
                {jds.length} Job Description{jds.length !== 1 ? "s" : ""}
              </p>
              {jds.map((jd) => (
                <JdCard
                  key={jd.id}
                  jd={jd}
                  isSelected={editingId === jd.id}
                  onSelect={loadJdIntoForm}
                  onDelete={handleDelete}
                  deleting={deletingId}
                />
              ))}
            </>
          )}
        </div>

        {/* ── Right: form ────────────────────────────────────────────────── */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-y-auto">

          {/* Form header */}
          <div className="sticky top-0 z-10 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 px-8 py-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-2.5 h-2.5 rounded-full ${isNewForm ? "bg-blue-500" : "bg-emerald-500"}`} />
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                {isNewForm ? "Create new JD" : `Editing — ${selectedJd?.title || "JD"}`}
              </h2>
              {isDirty && (
                <span className="text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded-full font-medium">
                  Unsaved changes
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {editingId && (
                <button
                  onClick={resetForm}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 text-sm font-medium transition-all"
                >
                  <RotateCcw size={14} />
                  New
                </button>
              )}
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-bold transition-all"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                {saving ? "Saving..." : editingId ? "Update JD" : "Create JD"}
              </button>
            </div>
          </div>

          <div className="p-8 space-y-8">
            {error && (
              <div className="flex items-start gap-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl text-sm text-red-700 dark:text-red-400">
                <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
                {error}
              </div>
            )}
            {success && (
              <div className="flex items-start gap-3 p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-2xl text-sm text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 size={16} className="flex-shrink-0 mt-0.5" />
                {success}
              </div>
            )}

            {/* ── Section 1: Basic info ────────────────────────────────── */}
            <div className="space-y-4">
              <SectionLabel icon={<FileText size={14} />} label="Job details" />

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Job Title *
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => { setTitle(e.target.value); setIsDirty(true); }}
                  placeholder="e.g. Senior Backend Engineer"
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-sm dark:text-white transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                    <Percent size={11} />
                    Qualify Score
                    <Tooltip text="Minimum resume match % to shortlist a candidate" />
                  </label>
                  <div className="relative">
                    <input
                      type="number" min={0} max={100}
                      value={qualifyScore}
                      onChange={(e) => { setQualifyScore(e.target.value); setIsDirty(true); }}
                      className="w-full px-4 py-3 pr-10 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-sm dark:text-white"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">%</span>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                    <Hash size={11} />
                    No. of Questions
                    <Tooltip text="How many questions to ask in the interview" />
                  </label>
                  <input
                    type="number" min={1} max={20}
                    value={totalQuestions}
                    onChange={(e) => { setTotalQuestions(e.target.value); setIsDirty(true); }}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-sm dark:text-white"
                  />
                </div>
              </div>
            </div>

            {/* ── Section 2: JD text + file upload ──────────────────────── */}
            <div className="space-y-4">
              <SectionLabel icon={<FileUp size={14} />} label="Job description text" />

              {/* File upload zone */}
              <label className={`flex items-center gap-4 p-5 rounded-2xl border-2 border-dashed cursor-pointer transition-all ${
                extracting
                  ? "border-blue-400 bg-blue-50/40 dark:bg-blue-900/10"
                  : "border-slate-200 dark:border-slate-700 hover:border-blue-400 hover:bg-blue-50/20 dark:hover:bg-blue-900/10"
              }`}>
                <input type="file" accept=".pdf,.docx,.txt" className="hidden" onChange={handleFileUpload} disabled={extracting} />
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  extracting ? "bg-blue-100 dark:bg-blue-900/30" : "bg-slate-100 dark:bg-slate-800"
                }`}>
                  {extracting
                    ? <Loader2 size={18} className="text-blue-600 animate-spin" />
                    : <Upload size={18} className="text-slate-500" />
                  }
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900 dark:text-white">
                    {extracting ? "Extracting skills with AI..." : "Upload JD file"}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    PDF, DOCX, or TXT · AI will auto-extract skills and weights
                  </p>
                </div>
                {!extracting && (
                  <span className="ml-auto flex-shrink-0 px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300">
                    Browse
                  </span>
                )}
              </label>

              {/* Divider */}
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-slate-100 dark:bg-slate-800" />
                <span className="text-xs text-slate-400 font-medium">or paste text</span>
                <div className="flex-1 h-px bg-slate-100 dark:bg-slate-800" />
              </div>

              {/* Text area + extract button */}
              <div className="space-y-2">
                <textarea
                  rows={5}
                  value={jdText}
                  onChange={(e) => { setJdText(e.target.value); setIsDirty(true); }}
                  placeholder="Paste your full job description here..."
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 text-sm dark:text-white resize-none transition-all"
                />
                <button
                  onClick={handleExtractFromText}
                  disabled={extracting || !jdText.trim()}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-50 hover:bg-purple-100 dark:bg-purple-900/20 dark:hover:bg-purple-900/30 text-purple-700 dark:text-purple-400 text-sm font-bold disabled:opacity-40 transition-all border border-purple-200 dark:border-purple-800"
                >
                  <Sparkles size={14} />
                  {extracting ? "Extracting..." : "Extract skills from text"}
                </button>
              </div>
            </div>

            {/* ── Section 3: Skills editor ─────────────────────────────── */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <SectionLabel icon={<Sparkles size={14} />} label="Skills & importance weights" />
                <span className="text-xs text-slate-400">
                  {skillEntries.length} skill{skillEntries.length !== 1 ? "s" : ""}
                </span>
              </div>

              {skillEntries.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 p-8 text-center">
                  <Sparkles size={24} className="mx-auto mb-3 text-slate-300" />
                  <p className="text-sm text-slate-400">
                    No skills yet — upload a file or paste JD text and click "Extract skills"
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-between px-1 pb-1">
                    <span className="text-xs text-slate-400">Skill</span>
                    <div className="flex items-center gap-1 text-xs text-slate-400">
                      Importance
                      <Tooltip text="1 = nice to have, 10 = must have. Affects resume match score." />
                    </div>
                  </div>
                  {skillEntries.map(([skill, weight]) => (
                    <SkillRow
                      key={skill}
                      skill={skill}
                      weight={weight}
                      onWeight={handleWeight}
                      onRemove={handleRemoveSkill}
                    />
                  ))}
                </div>
              )}

              {/* Add skill manually */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newSkill}
                  onChange={(e) => setNewSkill(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddSkill()}
                  placeholder="Add a skill manually (e.g. python, docker, sql)"
                  className="flex-1 px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-sm dark:text-white"
                />
                <button
                  onClick={handleAddSkill}
                  disabled={!newSkill.trim()}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-sm font-bold disabled:opacity-40 transition-all"
                >
                  <Plus size={16} />
                </button>
              </div>
            </div>

            {/* ── Save button at bottom ──────────────────────────────── */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
              <p className="text-xs text-slate-400">
                {editingId ? `Editing JD #${editingId}` : "New JD — will be saved to the list"}
              </p>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold transition-all shadow-lg shadow-blue-100 dark:shadow-none"
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                {saving ? "Saving..." : editingId ? "Update JD" : "Create JD"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function SectionLabel({ icon, label }) {
  return (
    <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider">
      <span className="text-slate-400">{icon}</span>
      {label}
    </div>
  );
}

function Tooltip({ text }) {
  const [show, setShow] = useState(false);
  return (
    <span className="relative" onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
      <HelpCircle size={11} className="text-slate-300 cursor-help" />
      {show && (
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 px-3 py-2 bg-slate-900 dark:bg-slate-700 text-white text-xs rounded-xl shadow-xl z-50 whitespace-normal leading-relaxed">
          {text}
        </span>
      )}
    </span>
  );
}
