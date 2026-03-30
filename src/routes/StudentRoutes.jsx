import { useState, useEffect } from "react";
import { Routes, Route, useNavigate, useLocation, Navigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import SessionCodePage from "../components/SessionCodePage";
import StudentLabLayout from "../layouts/StudentLabLayout";

export default function StudentRoutes() {
  const navigate = useNavigate();
  const location = useLocation();

  // ─── State Management ───
  const [activeTab, setActiveTab] = useState(() => localStorage.getItem("app_activeTab") || "ohm");
  const [examConfig, setExamConfig] = useState(() => {
    try {
      const saved = localStorage.getItem("app_examConfig");
      return saved ? JSON.parse(atob(saved)) : null;
    } catch (e) {
      return null;
    }
  });

  const [timeLeft, setTimeLeft] = useState(null);
  const [showWarning, setShowWarning] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ─── SEB Lock ───
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
        localStorage.setItem("app_examConfig", btoa(JSON.stringify(examConfig)));
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

    const handleContextMenu = (e) => e.preventDefault();
    const handleKeyDown = (e) => {
      // Block F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+Shift+C, Ctrl+U
      if (
        e.key === "F12" ||
        (e.ctrlKey && e.shiftKey && (e.key === "I" || e.key === "i" || e.key === "J" || e.key === "j" || e.key === "C" || e.key === "c")) ||
        (e.ctrlKey && (e.key === "U" || e.key === "u"))
      ) {
        e.preventDefault();
      }
    };

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

  // ─── Exam Timer ───
  useEffect(() => {
    let timer;
    if (examConfig && examConfig.startTime && !examConfig.examComplete) {
      timer = setInterval(() => {
        const elapsed = Date.now() - examConfig.startTime;
        const remaining = Math.max(0, 30 * 60 * 1000 - elapsed);
        setTimeLeft(remaining);

        if (remaining <= 5 * 60 * 1000 && remaining > 0) {
          setShowWarning(true);
        } else {
          setShowWarning(false);
        }

        if (remaining === 0) {
          handleExamSubmit("--", "N/A");
        }
      }, 1000);
    } else {
      setTimeLeft(null);
      setShowWarning(false);
    }
    return () => clearInterval(timer);
  }, [examConfig]);

  // ─── Submit Handler ───
  const handleExamSubmit = async (studentValue, actualValue) => {
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
      console.log("Submitting exam with payload:", rpcPayload);
      const { data: result, error: rpcError } = await supabase.rpc("submit_exam_result", rpcPayload);

      if (rpcError) {
        alert("خطأ في الاتصال بقاعدة البيانات: " + rpcError.message);
      } else if (result && result.status === "already_submitted") {
        alert("خطأ: لقد تم إرسال نتيجتك بالفعل مسبقاً.");
        setExamConfig(null);
        navigate("/");
        setIsSubmitting(false);
        return;
      } else if (result && result.status === "time_exceeded") {
        alert("تم رصد تجاوز الوقت المسموح. لن يتم تسجيل الإجابة.");
        setExamConfig(null);
        navigate("/");
        setIsSubmitting(false);
        return;
      } else if (result && result.status === "exam_not_found") {
        alert("خطأ: الاختبار غير موجود أو تم حذفه من قاعدة البيانات.");
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

    if (studentValue === "--kicked--") {
      alert("⛔ تم إنهاء الامتحان تلقائياً بسبب غيابك عن الكاميرا. تم إبلاغ المعيد.");
    } else if (studentValue === "--") {
      alert("انتهى وقت الاختبار. تم إرسال إجابتك تلقائياً.");
    } else if (studentValue === "--quit--") {
      alert("لقد قمت بالانسحاب من الامتحان. تم إبلاغ المعيد بقرارك.");
    } else {
      alert("تم إرسال إجابتك وإنهاء الاختبار بنجاح.");
    }

    setTimeout(() => {
      setExamConfig(null);
      navigate("/");
    }, 3000);
  };

  return (
    <Routes>
      <Route
        path="student"
        element={
          <SessionCodePage
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
