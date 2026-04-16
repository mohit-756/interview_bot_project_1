import { useState } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight, X, Eye, Check, XCircle } from "lucide-react";

const STATUS_COLORS = {
  completed: { bg: "bg-emerald-100", text: "text-emerald-700", border: "border-emerald-200", label: "Completed" },
  scheduled: { bg: "bg-blue-100", text: "text-blue-700", border: "border-blue-200", label: "Scheduled" },
  new: { bg: "bg-yellow-100", text: "text-yellow-700", border: "border-yellow-200", label: "New" },
  review: { bg: "bg-purple-100", text: "text-purple-700", border: "border-purple-200", label: "Needs Review" },
};

export default function CalendarModal({ isOpen, onClose, calendarData, loading }) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);

  if (!isOpen) return null;

  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();
    
    const days = [];
    for (let i = firstDay - 1; i >= 0; i--) {
      days.push({ day: daysInPrevMonth - i, isCurrentMonth: false, date: new Date(year, month - 1, daysInPrevMonth - i) });
    }
    for (let i = 1; i <= daysInMonth; i++) {
      days.push({ day: i, isCurrentMonth: true, date: new Date(year, month, i) });
    }
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      days.push({ day: i, isCurrentMonth: false, date: new Date(year, month + 1, i) });
    }
    return days;
  };

  const formatDateKey = (date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  };

  const getDateStatus = (date) => {
    const key = formatDateKey(date);
    return calendarData?.dates?.[key] || null;
  };

  const prevMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));
  const nextMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1));

  const days = getDaysInMonth(currentMonth);
  const selectedDateKey = selectedDate ? formatDateKey(selectedDate) : null;
  const selectedCandidates = selectedDateKey ? calendarData?.dates?.[selectedDateKey]?.candidates || [] : [];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <Calendar className="text-blue-600" size={24} />
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Interview Calendar</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors">
            <X size={24} className="text-slate-500" />
          </button>
        </div>

        <div className="flex flex-col lg:flex-row divide-y lg:divide-y-0 lg:divide-x border-slate-200 dark:border-slate-800">
          <div className="p-6 lg:w-1/2">
            <div className="flex items-center justify-between mb-6">
              <button onClick={prevMonth} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
                <ChevronLeft size={20} className="text-slate-600 dark:text-slate-400" />
              </button>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
              </h3>
              <button onClick={nextMonth} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
                <ChevronRight size={20} className="text-slate-600 dark:text-slate-400" />
              </button>
            </div>

            <div className="grid grid-cols-7 gap-1 mb-2">
              {dayNames.map((day) => (
                <div key={day} className="text-center text-xs font-bold text-slate-500 dark:text-slate-400 py-2">{day}</div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {days.map((item, index) => {
                const status = getDateStatus(item.date);
                const isSelected = selectedDate && formatDateKey(item.date) === formatDateKey(selectedDate);
                const isToday = formatDateKey(item.date) === formatDateKey(new Date());
                const hasEvents = status && (status.completed > 0 || status.scheduled > 0 || status.new > 0);

                return (
                  <button
                    key={index}
                    onClick={() => hasEvents && setSelectedDate(item.date)}
                    disabled={!hasEvents || !item.isCurrentMonth}
                    className={`
                      aspect-square rounded-lg flex flex-col items-center justify-center text-sm font-medium transition-all relative
                      ${!item.isCurrentMonth ? "text-slate-300 dark:text-slate-600" : ""}
                      ${isSelected ? "bg-blue-600 text-white" : ""}
                      ${!isSelected && item.isCurrentMonth && hasEvents ? "hover:bg-slate-100 dark:hover:bg-slate-800" : ""}
                      ${isToday && !isSelected ? "ring-2 ring-blue-500 ring-inset" : ""}
                      ${!hasEvents && item.isCurrentMonth ? "text-slate-400 dark:text-slate-500" : ""}
                    `}
                  >
                    {item.day}
                    {hasEvents && item.isCurrentMonth && (
                      <div className="absolute bottom-1 flex gap-0.5">
                        {status.completed > 0 && <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}
                        {status.scheduled > 0 && <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />}
                        {status.new > 0 && <div className="w-1.5 h-1.5 rounded-full bg-yellow-500" />}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="mt-6 flex flex-wrap gap-3 text-xs">
              <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Completed</div>
              <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-blue-500" /> Scheduled</div>
              <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-yellow-500" /> New</div>
            </div>
          </div>

          <div className="p-6 lg:w-1/2 max-h-[500px] overflow-y-auto">
            {loading ? (
              <div className="text-center py-12 text-slate-500">Loading...</div>
            ) : selectedDate ? (
              selectedCandidates.length > 0 ? (
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">
                    {selectedDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
                  </h3>
                  <div className="space-y-3">
                    {selectedCandidates.map((candidate) => {
                      const statusStyle = STATUS_COLORS[candidate.status] || STATUS_COLORS.scheduled;
                      return (
                        <div key={candidate.result_id} className={`p-4 rounded-xl border ${statusStyle.border} ${statusStyle.bg} dark:opacity-80`}>
                          <div className="flex items-center justify-between mb-2">
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${statusStyle.bg} ${statusStyle.text}`}>{statusStyle.label}</span>
                            <span className="text-sm font-bold text-slate-900 dark:text-white">{candidate.name}</span>
                          </div>
                          <p className="text-sm text-slate-600 dark:text-slate-300">{candidate.job_title}</p>
                          <div className="flex items-center gap-2 mt-3">
                            <Link to={`/hr/candidates/${candidate.candidate_uid}`} className="flex items-center gap-1 px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700">
                              <Eye size={14} /> View
                            </Link>
                            {candidate.status === "completed" && (
                              <>
                                <button className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 rounded-lg text-xs font-bold text-white hover:bg-emerald-700">
                                  <Check size={14} /> Select
                                </button>
                                <button className="flex items-center gap-1 px-3 py-1.5 bg-red-600 rounded-lg text-xs font-bold text-white hover:bg-red-700">
                                  <XCircle size={14} /> Reject
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 text-slate-500 dark:text-slate-400">No candidates on this date</div>
              )
            ) : (
              <div className="text-center py-12 text-slate-500 dark:text-slate-400">
                <Calendar size={48} className="mx-auto mb-4 text-slate-300" />
                <p>Click a date with dots to see candidates</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}