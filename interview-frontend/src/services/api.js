import { mockCandidates, mockStats, mockInterviewResults } from "../data/mockData";

// Simulation delay helper
const delay = (ms = 500) => new Promise(resolve => setTimeout(resolve, ms));

const mockInterviewReviews = [
  {
    interview: {
      interview_id: "INT-001",
      application_id: "APP-001",
      status: "completed",
      started_at: "2026-03-09T09:30:00Z",
      ended_at: "2026-03-09T09:56:00Z",
      candidate: mockCandidates[0],
      job: { title: "Full Stack Developer" },
    },
    questions: [
      {
        id: 1,
        text: "Tell me about a challenging project you delivered recently.",
        answer_text: "I led a React and Node.js migration for a multi-tenant dashboard and coordinated rollout in phases.",
        answer_summary: "Strong ownership, clear technical tradeoffs, and measurable delivery outcome.",
        ai_answer_score: 88,
        score_breakdown: { relevance: 90, completeness: 86, clarity: 88 },
        time_taken_seconds: 92,
        allotted_seconds: 120,
        skipped: false,
      },
      {
        id: 2,
        text: "How do you approach state management in large React applications?",
        answer_text: "I start by minimizing shared state, then use context or Zustand only where domain boundaries justify it.",
        answer_summary: "Balanced answer showing pragmatic tool selection.",
        ai_answer_score: 84,
        score_breakdown: { relevance: 85, completeness: 82, clarity: 85 },
        time_taken_seconds: 77,
        allotted_seconds: 120,
        skipped: false,
      },
    ],
    events: [
      {
        id: 1,
        event_type: "face_detected",
        created_at: "2026-03-09T09:31:00Z",
        score: 0.1,
        suspicious: false,
        meta_json: { faces_count: 1, frame_reasons: [] },
        snapshot_path: null,
      },
      {
        id: 2,
        event_type: "away_from_screen",
        created_at: "2026-03-09T09:45:00Z",
        score: 0.82,
        suspicious: true,
        meta_json: { faces_count: 0, frame_reasons: ["candidate_not_centered"] },
        snapshot_path: null,
      },
    ],
    hr_review: {
      notes: "Technically strong. Minor concern around attention drift mid-session.",
      final_score: 86,
      behavioral_score: 81,
      communication_score: 84,
      red_flags: "Brief screen drift",
    },
  },
  {
    interview: {
      interview_id: "INT-002",
      application_id: "APP-002",
      status: "selected",
      started_at: "2026-03-08T11:00:00Z",
      ended_at: "2026-03-08T11:22:00Z",
      candidate: mockCandidates[1],
      job: { title: "Frontend Engineer" },
    },
    questions: [
      {
        id: mockInterviewResults[0]?.questions?.length ? 3 : 3,
        text: "How do you balance accessibility with visual polish?",
        answer_text: "I start with semantic HTML and keyboard flows, then layer visual design without breaking core interaction paths.",
        answer_summary: "Strong accessibility-first answer.",
        ai_answer_score: 91,
        score_breakdown: { relevance: 92, completeness: 90, clarity: 91 },
        time_taken_seconds: 69,
        allotted_seconds: 120,
        skipped: false,
      },
    ],
    events: [
      {
        id: 3,
        event_type: "steady_presence",
        created_at: "2026-03-08T11:10:00Z",
        score: 0.02,
        suspicious: false,
        meta_json: { faces_count: 1, frame_reasons: [] },
        snapshot_path: null,
      },
    ],
    hr_review: {
      notes: "Excellent frontend fundamentals and communication.",
      final_score: 92,
      behavioral_score: 90,
      communication_score: 94,
      red_flags: "",
    },
  },
];

function findInterviewRecord(id) {
  return mockInterviewReviews.find((record) => record.interview.interview_id === id);
}

export const authApi = {
  async login(payload) {
    await delay();
    const selectedRole = payload.role === "hr" ? "hr" : payload.email.includes("hr") ? "hr" : "candidate";
    if (selectedRole === "hr") {
      localStorage.setItem("user", JSON.stringify({ name: "HR Manager", role: "hr", email: payload.email }));
    } else {
      localStorage.setItem("user", JSON.stringify({ name: "Alex Johnson", role: "candidate", email: payload.email }));
    }
    return { status: "success" };
  },
  async signup(payload) {
    void payload;
    await delay();
    return { status: "success" };
  },
  async logout() {
    await delay(200);
    localStorage.removeItem("user");
    return { status: "success" };
  },
  async me() {
    await delay(100);
    const user = localStorage.getItem("user");
    if (!user) throw new Error("Not authenticated");
    return JSON.parse(user);
  },
};

export const candidateApi = {
  async dashboard() {
    await delay();
    return {
      candidate: mockCandidates[0],
      available_jds: [{ id: 1, title: "Full Stack Developer" }],
      selected_jd_id: 1,
      result: { shortlisted: true, score: 85 },
    };
  },
  async uploadResume(file) {
    void file;
    await delay(1500);
    return { status: "success", message: "Resume analyzed successfully" };
  },
  async practiceKit() {
    await delay();
    return {
      practice: {
        questions: [
          { text: "Explain React Hooks", type: "Technical", topic: "React", difficulty: "Medium" }
        ]
      },
      score_preview: 85
    };
  }
};

export const hrApi = {
  async dashboard() {
    await delay();
    return {
      analytics: {
        overview: {
          active_candidates: mockStats.totalCandidates,
          total_applications: 156,
          avg_resume_score: 74,
          shortlist_rate: 32
        }
      },
      candidates: mockCandidates,
    };
  },
  async listCandidates() {
    await delay();
    return { candidates: mockCandidates, total_results: mockCandidates.length };
  },
  async candidateDetail(uid) {
    await delay();
    return { candidate: mockCandidates.find(c => c.uid === uid) || mockCandidates[0] };
  },
  async deleteCandidate() {
    await delay();
    return { status: "success" };
  },
  async interviews() {
    await delay();
    return {
      interviews: mockInterviewReviews.map((record) => ({
        interview_id: record.interview.interview_id,
        application_id: record.interview.application_id,
        status: record.interview.status,
        started_at: record.interview.started_at,
        events_count: record.events.length,
        suspicious_events_count: record.events.filter((event) => event.suspicious).length,
        candidate: record.interview.candidate,
        job: record.interview.job,
      })),
    };
  },
  async interviewDetail(id) {
    await delay();
    const record = findInterviewRecord(id);
    if (!record) {
      throw new Error("Interview not found");
    }
    return {
      interview: record.interview,
      questions: record.questions,
      events: record.events,
      hr_review: record.hr_review,
    };
  },
  async finalizeInterview(id, payload) {
    await delay();
    const record = findInterviewRecord(id);
    if (!record) {
      throw new Error("Interview not found");
    }
    record.interview.status = payload.decision;
    record.hr_review = {
      notes: payload.notes || "",
      final_score: payload.final_score,
      behavioral_score: payload.behavioral_score,
      communication_score: payload.communication_score,
      red_flags: payload.red_flags || "",
    };
    return { status: "success" };
  },

  // JD Management endpoints
  async listJds() {
    await delay();
    // Returns mock JDs from mockData
    const mockJDs = [
      {
        id: 1,
        title: "Full Stack Developer",
        jd_text: "Looking for experienced Full Stack developers...",
        qualify_score: 70,
        min_academic_percent: 60,
        total_questions: 8,
        weights_json: { "React": 10, "Node.js": 10, "Python": 5 },
        created_at: "2026-02-15T10:00:00Z",
        candidate_count: 3,
      },
      {
        id: 2,
        title: "Frontend Engineer",
        jd_text: "Seeking skilled Frontend developers...",
        qualify_score: 75,
        min_academic_percent: 65,
        total_questions: 8,
        weights_json: { "React": 15, "TypeScript": 10, "CSS": 8 },
        created_at: "2026-02-20T14:30:00Z",
        candidate_count: 2,
      },
      {
        id: 3,
        title: "Backend Developer",
        jd_text: "We are hiring Backend engineers...",
        qualify_score: 72,
        min_academic_percent: 60,
        total_questions: 8,
        weights_json: { "Python": 12, "SQL": 10, "Docker": 8 },
        created_at: "2026-03-01T09:15:00Z",
        candidate_count: 1,
      },
    ];
    return { ok: true, jds: mockJDs };
  },

  async getJd(jdId) {
    await delay();
    const mockJDs = [
      {
        id: 1,
        title: "Full Stack Developer",
        jd_text: "Looking for experienced Full Stack developers with 5+ years experience...",
        qualify_score: 70,
        min_academic_percent: 60,
        total_questions: 8,
        project_question_ratio: 0.8,
        weights_json: { "React": 10, "Node.js": 10, "Python": 5 },
        created_at: "2026-02-15T10:00:00Z",
        candidate_count: 3,
      },
      {
        id: 2,
        title: "Frontend Engineer",
        jd_text: "Seeking skilled Frontend developers...",
        qualify_score: 75,
        min_academic_percent: 65,
        total_questions: 8,
        project_question_ratio: 0.8,
        weights_json: { "React": 15, "TypeScript": 10, "CSS": 8 },
        created_at: "2026-02-20T14:30:00Z",
        candidate_count: 2,
      },
      {
        id: 3,
        title: "Backend Developer",
        jd_text: "We are hiring Backend engineers...",
        qualify_score: 72,
        min_academic_percent: 60,
        total_questions: 8,
        project_question_ratio: 0.75,
        weights_json: { "Python": 12, "SQL": 10, "Docker": 8 },
        created_at: "2026-03-01T09:15:00Z",
        candidate_count: 1,
      },
    ];
    const jd = mockJDs.find(j => j.id === Number(jdId));
    if (!jd) throw new Error("JD not found");
    return { ok: true, jd };
  },

  async createJd(payload) {
    await delay();
    // Simulate creating a new JD
    const newJd = {
      id: Math.floor(Math.random() * 10000),
      title: payload.title,
      jd_text: payload.jd_text,
      jd_dict_json: payload.jd_dict_json || {},
      qualify_score: payload.qualify_score || 65,
      min_academic_percent: payload.min_academic_percent || 0,
      total_questions: payload.total_questions || 8,
      project_question_ratio: payload.project_question_ratio || 0.8,
      weights_json: payload.weights_json || {},
      created_at: new Date().toISOString(),
      candidate_count: 0,
    };
    return { ok: true, jd: newJd };
  },

  async updateJd(jdId, payload) {
    await delay();
    // Simulate updating a JD
    return {
      ok: true,
      jd: {
        id: jdId,
        title: payload.title,
        jd_text: payload.jd_text,
        qualify_score: payload.qualify_score,
        min_academic_percent: payload.min_academic_percent,
        total_questions: payload.total_questions,
        weights_json: payload.weights_json || {},
      },
    };
  },

  async deleteJd(jdId) {
    await delay();
    return { ok: true, message: `JD ${jdId} deleted` };
  },

  async candidateSkillGap(candidateUid, jdId) {
    await delay();
    // Mock skill gap data
    return {
      ok: true,
      skill_gap: {
        matched_skills: ["React", "Node.js", "JavaScript"],
        missing_skills: ["Kubernetes", "GraphQL"],
        match_percentage: 78,
        recommendations: ["Learn GraphQL basics", "Get Kubernetes certification"],
      },
    };
  },
};

export const interviewApi = {
  async start() {
    await delay();
    return { session_id: "SESS-999", current_question: { id: 1, text: "First Question" } };
  },
  async submitAnswer() {
    await delay();
    return { next_question: { id: 2, text: "Second Question" } };
  }
};
