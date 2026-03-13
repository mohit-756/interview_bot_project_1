import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Search, Filter, X, ChevronLeft, ChevronRight } from "lucide-react";
import { hrApi } from "../services/api";
import { cn } from "../utils/utils";

export default function HRJdManagementPage() {
  // Data state
  const [jds, setJds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Filter and search state
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    title: "",
    jd_text: "",
    qualify_score: 65,
    min_academic_percent: 0,
    total_questions: 8,
    weights_json: {},
  });

  // Fetch JDs on mount
  useEffect(() => {
    loadJds();
  }, []);

  async function loadJds() {
    setLoading(true);
    setError("");
    try {
      const response = await hrApi.listJds();
      setJds(response.jds || []);
    } catch (err) {
      setError(`Failed to load JDs: ${err.message}`);
      setJds([]);
    } finally {
      setLoading(false);
    }
  }

  function handleFormChange(field, value) {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  }

  async function handleSubmitForm(e) {
    e.preventDefault();
    setIsSubmitting(true);
    setError("");
    setSuccess("");

    // Validation
    if (!formData.title.trim()) {
      setError("Job Title is required");
      setIsSubmitting(false);
      return;
    }
    if (!formData.jd_text.trim()) {
      setError("Job Description is required");
      setIsSubmitting(false);
      return;
    }

    try {
      const payload = {
        title: formData.title.trim(),
        jd_text: formData.jd_text.trim(),
        qualify_score: Number(formData.qualify_score),
        min_academic_percent: Number(formData.min_academic_percent),
        total_questions: Number(formData.total_questions),
        weights_json: formData.weights_json || {},
      };

      await hrApi.createJd(payload);
      
      setSuccess(`JD "${formData.title}" created successfully!`);
      
      // Reset form
      setFormData({
        title: "",
        jd_text: "",
        qualify_score: 65,
        min_academic_percent: 0,
        total_questions: 8,
        weights_json: {},
      });
      
      // Close modal and refresh list
      setShowModal(false);
      await loadJds();
      setCurrentPage(1);
    } catch (err) {
      setError(`Failed to create JD: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  }

  // Filter and search
  const filteredJds = jds.filter((jd) => {
    const matchesSearch =
      jd.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      jd.jd_text.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  // Pagination
  const totalPages = Math.ceil(filteredJds.length / itemsPerPage);
  const startIdx = (currentPage - 1) * itemsPerPage;
  const paginatedJds = filteredJds.slice(startIdx, startIdx + itemsPerPage);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white font-display">
            Job Descriptions
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Manage and configure all job descriptions in your workspace
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/hr"
            className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
          >
            Back to Dashboard
          </Link>
          <button
            onClick={() => setShowModal(true)}
            className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold transition-all shadow-lg shadow-blue-200 dark:shadow-none flex items-center space-x-2"
          >
            <Plus size={20} />
            <span>Add New JD</span>
          </button>
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-xl text-red-700 dark:text-red-400">
          {error}
        </div>
      )}
      {success && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/50 rounded-xl text-emerald-700 dark:text-emerald-400">
          {success}
        </div>
      )}

      {/* Search and Filter */}
      <div className="flex gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-4 top-3.5 text-slate-400" size={20} />
          <input
            type="text"
            placeholder="Search JDs by title or description..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full pl-12 pr-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 dark:text-white"
          />
        </div>
        <button className="px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all flex items-center space-x-2">
          <Filter size={20} />
          <span>Filter</span>
        </button>
      </div>

      {/* Stats */}
      {jds.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total JDs</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white mt-2">{jds.length}</p>
          </div>
          <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Active</p>
            <p className="text-2xl font-bold text-emerald-600 mt-2">{jds.length}</p>
          </div>
          <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Candidates</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white mt-2">
              {jds.reduce((sum, jd) => sum + (jd.candidate_count || 0), 0)}
            </p>
          </div>
          <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Avg Cutoff</p>
            <p className="text-2xl font-bold text-blue-600 mt-2">
              {jds.length > 0 ? (jds.reduce((sum, jd) => sum + (jd.qualify_score || 0), 0) / jds.length).toFixed(0) : 0}%
            </p>
          </div>
        </div>
      )}

      {/* Table */}
      {paginatedJds.length === 0 ? (
        <div className="p-12 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 text-center">
          <p className="text-slate-500 dark:text-slate-400 text-lg">
            {jds.length === 0 ? "No JDs created yet. Click 'Add New JD' to create one." : "No JDs match your search."}
          </p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                    Title
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                    Cutoff Score
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                    Questions
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                    Candidates
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {paginatedJds.map((jd) => (
                  <tr
                    key={jd.id}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div className="font-semibold text-slate-900 dark:text-white">
                        {jd.title}
                      </div>
                      <div className="text-sm text-slate-500 dark:text-slate-400 truncate max-w-xs">
                        {jd.jd_text}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-bold text-slate-900 dark:text-white">
                        {jd.qualify_score}%
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-slate-900 dark:text-white">
                        {jd.total_questions || 8}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-slate-900 dark:text-white font-medium">
                        {jd.candidate_count || 0}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-500 dark:text-slate-400">
                      {new Date(jd.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4">
                      <button className="text-blue-600 hover:text-blue-700 font-medium text-sm">
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <div className="text-sm text-slate-600 dark:text-slate-400">
                Showing {startIdx + 1} to {Math.min(startIdx + itemsPerPage, filteredJds.length)} of{" "}
                {filteredJds.length}
              </div>
              <div className="flex gap-2">
                <button
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="p-2 border border-slate-200 dark:border-slate-800 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  <ChevronLeft size={20} />
                </button>
                <div className="flex items-center gap-2">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={cn(
                        "px-3 py-2 rounded-lg font-medium transition-all",
                        currentPage === page
                          ? "bg-blue-600 text-white"
                          : "border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
                      )}
                    >
                      {page}
                    </button>
                  ))}
                </div>
                <button
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="p-2 border border-slate-200 dark:border-slate-800 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  <ChevronRight size={20} />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Add JD Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-800 sticky top-0 bg-white dark:bg-slate-900">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white font-display">
                Add New JD
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSubmitForm} className="p-6 space-y-4">
              {/* Title */}
              <div className="space-y-2">
                <label className="block text-sm font-bold text-slate-900 dark:text-white">
                  Job Title *
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => handleFormChange("title", e.target.value)}
                  placeholder="e.g., Senior Full Stack Engineer"
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 dark:text-white"
                />
              </div>

              {/* Job Description */}
              <div className="space-y-2">
                <label className="block text-sm font-bold text-slate-900 dark:text-white">
                  Job Description *
                </label>
                <textarea
                  value={formData.jd_text}
                  onChange={(e) => handleFormChange("jd_text", e.target.value)}
                  placeholder="Enter detailed job description including responsibilities, requirements, skills..."
                  rows={6}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 dark:text-white"
                />
              </div>

              {/* Settings Grid */}
              <div className="grid grid-cols-2 gap-4">
                {/* Qualify Score */}
                <div className="space-y-2">
                  <label className="block text-sm font-bold text-slate-900 dark:text-white">
                    Shortlist Cutoff (%)
                  </label>
                  <input
                    type="number"
                    value={formData.qualify_score}
                    onChange={(e) => handleFormChange("qualify_score", e.target.value)}
                    min="0"
                    max="100"
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 dark:text-white"
                  />
                </div>

                {/* Min Academic */}
                <div className="space-y-2">
                  <label className="block text-sm font-bold text-slate-900 dark:text-white">
                    Min Academic (%)
                  </label>
                  <input
                    type="number"
                    value={formData.min_academic_percent}
                    onChange={(e) => handleFormChange("min_academic_percent", e.target.value)}
                    min="0"
                    max="100"
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 dark:text-white"
                  />
                </div>

                {/* Question Count */}
                <div className="space-y-2">
                  <label className="block text-sm font-bold text-slate-900 dark:text-white">
                    Interview Questions
                  </label>
                  <input
                    type="number"
                    value={formData.total_questions}
                    onChange={(e) => handleFormChange("total_questions", e.target.value)}
                    min="1"
                    max="50"
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 dark:text-white"
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 justify-end pt-4 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-6 py-3 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-3 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold transition-all flex items-center space-x-2"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Creating...</span>
                    </>
                  ) : (
                    <span>Create JD</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
