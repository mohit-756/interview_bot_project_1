import { mockCandidates, mockStats, mockInterviewResults } from "../data/mockData";

// Simulation delay helper
const delay = (ms = 500) => new Promise(resolve => setTimeout(resolve, ms));

export const authApi = {
  async login(payload) {
    await delay();
    if (payload.email.includes("hr")) {
      localStorage.setItem("user", JSON.stringify({ name: "HR Manager", role: "hr", email: payload.email }));
    } else {
      localStorage.setItem("user", JSON.stringify({ name: "Alex Johnson", role: "candidate", email: payload.email }));
    }
    return { status: "success" };
  },
  async signup(payload) {
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
  }
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
