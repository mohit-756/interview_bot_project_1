import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { interviewApi, proctorApi } from "../services/api";

export default function Interview() {
  const { resultId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const getTokenFromHash = () => {
    try {
      const hash = location.hash || "";
      const hashPath = hash.replace("#", "");
      const qIndex = hashPath.indexOf("?");
      if (qIndex >= 0) {
        return new URLSearchParams(hashPath.substring(qIndex)).get("token") || "";
      }
    } catch (e) {}
    return "";
  };
  const tokenFromUrl = getTokenFromHash() || new URLSearchParams(location.search).get("token") || "";
  const interviewToken = tokenFromUrl || sessionStorage.getItem(`interview-token:${resultId}`) || "";

  const [sessionId, setSessionId] = useState(null);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [questionNumber, setQuestionNumber] = useState(1);
  const [maxQuestions, setMaxQuestions] = useState(1);
  const [answer, setAnswer] = useState("");
  const [timeLeft, setTimeLeft] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [previewReady, setPreviewReady] = useState(false);

  const videoRef = useRef(null);
  const streamRef = useRef(null);

  const formatTime = (sec) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const loadSession = useCallback(async () => {
    setLoading(true);
    setError("");
    
    const storedToken = sessionStorage.getItem(`interview-token:${resultId}`);
    console.log("[Interview] resultId:", resultId, "token from sessionStorage:", storedToken);
    
    try {
      const res = await interviewApi.start({
        result_id: Number(resultId),
        interview_token: interviewToken,
      });
      
      console.log("[Interview] API response received");
      
      if (!res || typeof res !== 'object') {
        console.error("[Interview] Invalid response type:", typeof res);
        setError("Invalid server response. Please try again or contact support.");
        setLoading(false);
        return;
      }
      
      if (!res.current_question) {
        console.log("[Interview] No current question - redirecting to completed");
        navigate(`/interview/${resultId}/completed`);
        return;
      }

      setSessionId(res.session_id);
      setCurrentQuestion(res.current_question);
      setQuestionNumber(res.question_number || 1);
      setMaxQuestions(res.max_questions || 1);
      setTimeLeft(res.time_limit_seconds || 0);
    } catch (e) {
      const msg = e.message || "";
      console.error("[Interview] Load error:", msg);
      
      if (msg.includes("Not authenticated") || msg.includes("403") || msg.includes("401")) {
        setError("Session expired. Please go back to the interview link from your email and try again.");
      } else if (msg.includes("invalid") || msg.includes("token")) {
        setError("Invalid interview link. Please use the link from your email.");
      } else if (msg.includes("already completed")) {
        navigate(`/interview/${resultId}/completed`);
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  }, [resultId, interviewToken, navigate]);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  useEffect(() => {
    if (!currentQuestion) return;
    const t = setInterval(() => {
      setTimeLeft((p) => (p > 0 ? p - 1 : 0));
    }, 1000);
    return () => clearInterval(t);
  }, [currentQuestion]);

  useEffect(() => {
    async function initCam() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          setPreviewReady(true);
        }
      } catch {
        setPreviewReady(false);
      }
    }
    initCam();

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  const handleSubmit = async () => {
    if (!sessionId || !currentQuestion) return;
    setIsSubmitting(true);
    try {
      const res = await interviewApi.submitAnswer({
        session_id: sessionId,
        question_id: currentQuestion.id,
        answer_text: answer,
      });

      if (!res.next_question) {
        navigate(`/interview/${resultId}/completed`);
        return;
      }

      setCurrentQuestion(res.next_question);
      setAnswer("");
      setQuestionNumber(res.question_number);
      setTimeLeft(res.time_limit_seconds || 0);
    } catch (e) {
      setError(e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRetry = () => {
    navigate(`/interview/${resultId}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600 dark:text-slate-400">Loading interview...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-6 rounded-2xl max-w-md text-center">
          <h2 className="text-xl font-bold text-red-600 dark:text-red-400 mb-2">Cannot Start Interview</h2>
          <p className="text-red-600 dark:text-red-300 mb-4">{error}</p>
          <button
            onClick={handleRetry}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-xl font-bold"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">Live AI Interview</h1>
          <div className="text-xl font-mono">{formatTime(timeLeft)}</div>
        </div>

        <div className="flex gap-2">
          {[...Array(maxQuestions)].map((_, i) => (
            <div key={i} className={i < questionNumber ? "bg-green-500 w-4 h-2" : "bg-gray-300 w-4 h-2"} />
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-white border rounded-2xl p-6">
              <h2 className="text-lg font-bold">{currentQuestion?.text}</h2>
            </div>

            <div className="bg-white border rounded-2xl p-6 space-y-4">
              <textarea
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                className="w-full h-40 border rounded p-3"
                placeholder="Type your answer..."
              />

              <div className="flex gap-3">
                <button
                  onClick={() => setIsRecording(!isRecording)}
                  className="px-4 py-2 bg-blue-600 text-white rounded"
                >
                  {isRecording ? "Stop Recording" : "Start Recording"}
                </button>

                <button
                  onClick={handleSubmit}
                  disabled={isSubmitting || !answer.trim()}
                  className="flex-1 bg-green-600 disabled:bg-gray-400 text-white py-2 rounded"
                >
                  {isSubmitting ? "Submitting..." : "Submit"}
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="bg-white border rounded-2xl p-4">
              <h3 className="font-bold mb-2">Camera</h3>
              <video ref={videoRef} autoPlay className="w-full" />
              {!previewReady && <p className="text-red-500">Camera not ready</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}