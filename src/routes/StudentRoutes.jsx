import { useState, useEffect } from "react";
import { Routes, Route, useNavigate, useLocation, Navigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import StudentEntryPage from "../pages/student/StudentEntryPage";
import StudentLabLayout from "../layouts/StudentLabLayout";

export default function StudentRoutes() {
  const navigate = useNavigate();
  const location = useLocation();

  // --- CORE EXAM & UI STATE ---
  const [activeTab, setActiveTab] = useState(() => localStorage.getItem("app_activeTab") || "ohm");
  
  // Decrypt/Parse exam configuration from persistent storage
  const [examConfig, setExamConfig] = useState(() => {
    try {
      const saved = localStorage.getItem("app_examConfig");
      if (!saved) return null;
      // Handle legacy non-URI encoded data gracefully if present
      const decodedBase64 = atob(saved);
      try {
        return JSON.parse(decodeURIComponent(decodedBase64));
      } catch (err) {
        return JSON.parse(decodedBase64);
      }
    } catch (e) {
      return null;
    }
  });

  const [timeLeft, setTimeLeft] = useState(null);
  const [showWarning, setShowWarning] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  /**
   * --- SEB (SAFE EXAM BROWSER) PROTECTION ---
   * Detects if the student is using the mandatory secure browser.
   */
  const isSebBrowser =
    navigator.userAgent.toLowerCase().includes("seb") ||
    navigator.userAgent.toLowerCase().includes("safeexambrowser");

  useEffect(() => {
    if (isSebBrowser) {
      if (location.pathname !== "/lab/student" && location.pathname !== "/lab/exam") {
        navigate("/lab/student", { replace: true });
      }
    }
  }, [location.pathname, isSebBrowser, navigate]);

  // ─── Persistence ───
  useEffect(() => {
    if (examConfig && !examConfig.examComplete) {
      try {
        // Safe base64 encoding for UTF-8 (Arabic) strings to prevent btoa crash
        const safeBase64 = btoa(encodeURIComponent(JSON.stringify(examConfig)));
        localStorage.setItem("app_examConfig", safeBase64);
      } catch (e) {
        console.error("Failed to encrypt exam state", e);
      }
    } else {
      localStorage.removeItem("app_examConfig");
    }
  }, [examConfig]);

  // ─── Anti-Tamper & DevTools Blocker ───
  useEffect(() => {
    if (!examConfig || examConfig.examComplete) return;

    const handleKeyDown = (e) => {
      // SECURITY: Block F12, Ctrl+Shift+I (DevTools), and Ctrl+U (View Source)
      if (
        e.key === "F12" ||
        (e.ctrlKey && e.shiftKey && (e.key === "I" || e.key === "i" || e.key === "J" || e.key === "j" || e.key === "C" || e.key === "c")) ||
        (e.ctrlKey && (e.key === "U" || e.key === "u"))
      ) {
        e.preventDefault();
      }
    };

    const handleContextMenu = (e) => e.preventDefault();

    document.addEventListener("contextmenu", handleContextMenu);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("contextmenu", handleContextMenu);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [examConfig]);

  useEffect(() => {
    localStorage.setItem("app_activeTab", activeTab);
  }, [activeTab]);

  // ─── Force Active Tab Sync in Exam Mode ───
  // If the browser loaded an old tab from localStorage that doesn't match the current exam, override it.
  useEffect(() => {
    if (examConfig && examConfig.experiment && activeTab !== examConfig.experiment) {
      setActiveTab(examConfig.experiment);
    }
  }, [examConfig, activeTab]);

  // ─── Exam Validation ───
  useEffect(() => {
    const verifyNotSubmitted = async () => {
      if (examConfig && !examConfig.examComplete && examConfig.code) {
        const { data } = await supabase
          .from("results")
          .select("id, student_result")
          .eq("student_id", examConfig.studentId)
          .eq("exam_code", examConfig.code);

        if (data && data.length > 0) {
          const hasSubmitted = data.some(r => r.student_result !== "جاري الاختبار...");
          if (hasSubmitted) {
            alert("لقد قمت بإجراء هذا الاختبار مسبقاً.");
            setExamConfig(null);
            navigate("/");
          }
        }
      }
    };
    verifyNotSubmitted();
  }, [examConfig?.code, examConfig?.studentId, navigate]);

  // ─── Exam Timer & Heartbeat Ping ───
  useEffect(() => {
    let timer;
    let pingTimer;
    if (examConfig && examConfig.startTime && !examConfig.examComplete) {
      timer = setInterval(() => {
        // TIME PROTECTION: Auto-submit if time runs out
        const elapsed = Date.now() - examConfig.startTime;
        const remaining = Math.max(0, 30 * 60 * 1000 - elapsed);
        
        // Detect if the session resumed after it was ALREADY over (anti-stale logic)
        const isStale = (elapsed - (30 * 60 * 1000)) > 5000;

        setTimeLeft(remaining);

        if (remaining <= 5 * 60 * 1000 && remaining > 0) {
          setShowWarning(true);
        } else {
          setShowWarning(false);
        }

        if (remaining === 0) {
          handleExamSubmit("--", "N/A", isStale);
          clearInterval(timer);
        }
      }, 1000);

      // HEARTBEAT PING: Updates a specific column every 15s. 
      // If this stops, the Instructor knows the student disconnected or killed the process.
      pingTimer = setInterval(() => {
        supabase
          .from("results")
          .update({ unit: Date.now().toString() })
          .eq("student_id", examConfig.studentId.toString())
          .eq("exam_code", examConfig.code)
          .then(() => {});
      }, 15000);

    } else {
      setTimeLeft(null);
      setShowWarning(false);
    }
    return () => {
      if (timer) clearInterval(timer);
      if (pingTimer) clearInterval(pingTimer);
    };
  }, [examConfig]);

  // ─── Submit Handler ───
  const handleExamSubmit = async (studentValue, actualValue, isSilent = false) => {
    if (!examConfig || examConfig.examComplete || isSubmitting) return;
    setIsSubmitting(true);

    const unit =
      examConfig.experiment === "ohm" ? "Ω"
        : examConfig.experiment === "wheatstone" ? "Ω"
        : examConfig.experiment === "hooke" ? "N/m"
        : "Pa·s";

    try {
      const rpcPayload = {
        p_student_id: examConfig.studentId.toString(),
        p_student_name: examConfig.studentName,
        p_exam_code: examConfig.code || "N/A",
        p_experiment: examConfig.experiment,
        p_student_result: String(studentValue),
        p_actual_result: actualValue ? String(actualValue) : "N/A",
        p_unit: unit,
      };
      
      const { data: result, error: rpcError } = await supabase.rpc("submit_exam_result", rpcPayload);

      if (rpcError) {
        if (!isSilent) alert("خطأ في الاتصال بقاعدة البيانات: " + rpcError.message);
      } else if (result && result.status === "already_submitted") {
        if (!isSilent) alert("خطأ: لقد تم إرسال نتيجتك بالفعل مسبقاً.");
        localStorage.removeItem("app_examConfig");
        setExamConfig(null);
        navigate("/");
        setIsSubmitting(false);
        return;
      } else if (result && result.status === "time_exceeded") {
        if (!isSilent) alert("تم رصد تجاوز الوقت المسموح. لن يتم تسجيل الإجابة.");
        localStorage.removeItem("app_examConfig");
        setExamConfig(null);
        navigate("/");
        setIsSubmitting(false);
        return;
      } else if (result && result.status === "exam_not_found") {
        if (!isSilent) alert("خطأ: الاختبار غير موجود أو تم حذفه من قاعدة البيانات.");
        localStorage.removeItem("app_examConfig");
        setExamConfig(null);
        navigate("/");
        setIsSubmitting(false);
        return;
      }
    } catch (err) {
      console.error("Error saving result:", err);
    }

    setExamConfig({ ...examConfig, examComplete: true });
    setIsSubmitting(false);

    if (!isSilent) {
      if (studentValue === "--kicked--") {
        alert("⛔ تم إنهاء الامتحان تلقائياً بسبب غيابك عن الكاميرا. تم إبلاغ الاستاذ.");
      } else if (studentValue === "--") {
        alert("انتهى وقت الاختبار. تم إرسال إجابتك تلقائياً.");
      } else if (studentValue === "--quit--") {
        alert("لقد قمت بالانسحاب من الامتحان. تم إبلاغ الاستاذ بقرارك.");
      } else {
        alert("تم إرسال إجابتك وإنهاء الاختبار بنجاح.");
      }
    }

    setTimeout(() => {
      setExamConfig(null);
      navigate("/");
    }, isSilent ? 0 : 3000);
  };

  return (
    <Routes>
      <Route
        path="student"
        element={
          <StudentEntryPage
            onBack={() => navigate("/")}
            onJoin={async (config) => {
              try {
                await supabase
                  .from("exams")
                  .update({ opened_at: Date.now() })
                  .eq("session_code", config.code)
                  .eq("student_id", config.studentId.toString());
              } catch (err) {
                console.error("[App] Failed to mark exam as opened:", err);
              }
              setExamConfig(config);
              setActiveTab(config.experiment);
              navigate("/lab/exam");
            }}
          />
        }
      />

      <Route
        path="exam"
        element={
          examConfig ? (
            <StudentLabLayout
              isExamMode={true}
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              examConfig={examConfig}
              setExamConfig={setExamConfig}
              timeLeft={timeLeft}
              showWarning={showWarning}
              handleExamSubmit={handleExamSubmit}
            />
          ) : (
            <Navigate to="student" replace />
          )
        }
      />

      <Route
        path="browse"
        element={
          <StudentLabLayout
            isExamMode={false}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            examConfig={examConfig}
            setExamConfig={setExamConfig}
            timeLeft={timeLeft}
            showWarning={showWarning}
            handleExamSubmit={handleExamSubmit}
          />
        }
      />

      {/* Fallback to landing if direct access */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
