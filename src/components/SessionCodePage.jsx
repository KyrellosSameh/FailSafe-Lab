import { useState, useEffect } from "react";
import {
  ArrowLeft,
  BookOpen,
  ArrowRight,
  Lock,
  User,
  PlayCircle,
  ShieldCheck,
} from "lucide-react";
import { supabase } from "../supabaseClient";
import bcrypt from "bcryptjs";
import emailjs from "@emailjs/browser";

function SessionCodePage({ onBack, onJoin }) {
  const [step, setStep] = useState("login"); // 'login' or 'lobby'
  const [studentId, setStudentId] = useState("");
  const [studentPassword, setStudentPassword] = useState("");
  const [loggedInStudent, setLoggedInStudent] = useState(null);

  // Stores the exam the student was assigned to
  const [assignedExam, setAssignedExam] = useState(null);
  // Flag to know if the assigned exam is already completed
  const [examCompleted, setExamCompleted] = useState(false);
  // Flag: exam was already opened in SEB (can't re-enter)
  const [examLocked, setExamLocked] = useState(false);

  const [showSebWarning, setShowSebWarning] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [modelsLoaded, setModelsLoaded] = useState(false);

  // Load Face Detection Models on Mount
  useEffect(() => {
    const loadModels = async () => {
      try {
        if (!window.faceapi) {
          console.warn("face-api.js not found in window. Waiting...");
          return;
        }
        const MODEL_URL =
          "https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@master/weights/";
        await Promise.all([
          window.faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          window.faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
        ]);
        setModelsLoaded(true);
        console.log("AI Face Models Loaded Successfully");
      } catch (err) {
        console.error("Failed to load AI face models:", err);
      }
    };

    // Small delay to ensure script is parsed
    const timer = setTimeout(loadModels, 1000);
    return () => clearTimeout(timer);
  }, []);

  const handleLaunchSeb = () => {
    // Convert current http/https URL to seb/sebs custom protocol
    const isHttps = window.location.protocol === "https:";
    const protocol = isHttps ? "sebs://" : "seb://";
    const launchUrl = protocol + window.location.host + window.location.pathname + window.location.hash;
    
    // Redirect browser to trigger OS app launch
    window.location.href = launchUrl;
  };

  const handleRequestPassword = async () => {
    if (!studentId.trim()) {
      setError(
        "يرجى كتابة رقمك الأكاديمي أولاً في خانة (الرقم الأكاديمي) لنرسل لك كلمة المرور.",
      );
      return;
    }
    setError("");
    setLoading(true);
    try {
      const { data: student, error: fetchErr } = await supabase
        .from("students")
        .select("name, email")
        .eq("student_id", studentId.trim())
        .single();

      if (fetchErr || !student) {
        setError("الرقم الأكاديمي غير مسجل في النظام.");
        setLoading(false);
        return;
      }
      if (!student.email) {
        setError("لا يوجد بريد إلكتروني مسجل لهذا الرقم الأكاديمي.");
        setLoading(false);
        return;
      }

      const tempPass = Math.floor(100000 + Math.random() * 900000).toString();
      const hashed = bcrypt.hashSync(tempPass, 10);

      const { error: updateErr } = await supabase
        .from("students")
        .update({ password: hashed })
        .eq("student_id", studentId.trim());
      if (updateErr) throw updateErr;

      await emailjs.send(
        import.meta.env.VITE_EMAILJS_SERVICE_ID,
        import.meta.env.VITE_EMAILJS_TEMPLATE_ID,
        {
          to_email: student.email,
          student_name: student.name || "طالب",
          student_id: studentId.trim(),
          password: tempPass,
        },
        import.meta.env.VITE_EMAILJS_PUBLIC_KEY,
      );
      alert(
        `تم توليد كلمة مرور جديدة وإرسالها بنجاح إلى بريدك الجامعي:\n${student.email}`,
      );
    } catch (err) {
      console.error(err);
      setError("حدث خطأ أثناء الاتصال بالخادم. تأكد من الإعدادات.");
    } finally {
      setLoading(false);
    }
  };

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    if (!studentId.trim() || !studentPassword.trim()) {
      setError("يرجى إدخال الرقم الأكاديمي وكلمة المرور.");
      return;
    }
    setError("");
    setLoading(true);

    try {
      // 1. Verify student
      const { data: studentData, error: studentError } = await supabase
        .from("students")
        .select("student_id, name, email, password")
        .eq("student_id", studentId.trim());

      if (studentError) throw studentError;
      if (!studentData || studentData.length === 0) {
        setError("هذا الرقم الأكاديمي غير مسجل.");
        setLoading(false);
        return;
      }

      const student = studentData[0];

      // Compare password (bcrypt only - no plain-text fallback)
      if (!student.password || !student.password.startsWith("$2")) {
        setError("خطأ في حساب الطالب. يرجى التواصل مع المسؤول.");
        setLoading(false);
        return;
      }
      const isMatch = bcrypt.compareSync(
        studentPassword.trim(),
        student.password,
      );

      if (!isMatch) {
        setError("كلمة المرور غير صحيحة.");
        setLoading(false);
        return;
      }

      setLoggedInStudent(student);

      // 2. Check if student already has an assigned exam in history
      const { data: startedExams } = await supabase
        .from("exams")
        .select("*")
        .eq("student_id", student.student_id);

      if (startedExams && startedExams.length > 0) {
        // They have drawn an exam before! (They can only draw 1 max)
        const myExam = startedExams[0];
        const safeExamFields = {
          session_code: myExam.session_code,
          experiment_name: myExam.experiment_name,
          started_at: myExam.started_at,
          instructor_id: myExam.instructor_id,
          parameters: myExam.parameters, // needed for SEB check only
        };
        setAssignedExam(safeExamFields);

        // Check if they submitted a result for it
        const { data: submittedResults } = await supabase
          .from("results")
          .select("id, student_result")
          .eq("student_id", student.student_id)
          .eq("exam_code", myExam.session_code);

        if (submittedResults && submittedResults.length > 0) {
          const hasRealSubmission = submittedResults.some(r => r.student_result !== "جاري الاختبار...");
          if (hasRealSubmission) {
            setExamCompleted(true);
            setExamLocked(false);
          } else if (myExam.opened_at) {
            setExamCompleted(false);
            setExamLocked(true);
          } else {
            setExamCompleted(false);
            setExamLocked(false);
          }
        } else if (myExam.opened_at) {
          // Exam was already opened in SEB but no result → student left SEB → LOCKED
          setExamCompleted(false);
          setExamLocked(true);
        } else {
          setExamCompleted(false);
          setExamLocked(false);
        }
      } else {
        setAssignedExam(null);
        setExamCompleted(false);
        setExamLocked(false);
      }

      setStep("lobby");
    } catch (err) {
      console.error(err);
      setError("حدث خطأ أثناء تسجيل الدخول. تأكد من اتصالك.");
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateAndJoin = async () => {
    setError("");
    setLoading(true);

    try {
      // Use atomic RPC to claim a random exam (prevents race conditions)
      const { data: result, error: rpcError } = await supabase.rpc(
        "claim_random_exam",
        { p_student_id: loggedInStudent.student_id.toString() },
      );

      if (rpcError) throw rpcError;

      if (result.status === "no_exams_available") {
        setError("عفواً، لا توجد أي اختبارات متاحة حالياً. يرجى إبلاغ الاستاذ.");
        setLoading(false);
        return;
      }

      const examData = result.exam;
      setAssignedExam(examData);
      await proceedToExam(examData);
    } catch (err) {
      console.error(err);
      setError("حدث خطأ أثناء سحب الاختبار: " + (err.message || JSON.stringify(err)));
      setLoading(false);
    }
  };

  const proceedToExam = async (exam) => {
    setLoading(true);
    setError("");
    try {
      // 1. ADVANCED VISUAL CAMERA CHECK (Liveliness Verification)
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
        });
        const videoTracks = stream.getVideoTracks();

        // Wait for hardware to warm up
        await new Promise((resolve) => setTimeout(resolve, 1000));

        const track = videoTracks[0];
        const settings = track.getSettings();

        // Part A: Basic Technical Check
        if (
          !track ||
          track.readyState === "ended" ||
          !track.enabled ||
          track.muted
        ) {
          if (stream) stream.getTracks().forEach((t) => t.stop());
          throw new Error("Hard connection failure");
        }

        // Part B: Visual Analysis (Detecting Shutter/Privacy-Switch Black Screens)
        const video = document.createElement("video");
        video.srcObject = stream;
        video.muted = true;
        await video.play();

        const canvas = document.createElement("canvas");
        canvas.width = 40; // Low res is enough for variance check
        canvas.height = 30;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;

        // Stop hardware immediately after capture
        stream.getTracks().forEach((t) => t.stop());
        video.srcObject = null;

        // Analyze: Is it perfectly solid black (0,0,0) or very dark noise?
        let total = 0;
        let squareSum = 0;
        const count = pixels.length / 4;

        for (let i = 0; i < pixels.length; i += 4) {
          const brightness = (pixels[i] + pixels[i + 1] + pixels[i + 2]) / 3;
          total += brightness;
          squareSum += brightness * brightness;
        }

        const averageBrightness = total / count;
        const variance =
          squareSum / count - averageBrightness * averageBrightness;
        const stdDev = Math.sqrt(Math.max(0, variance));

        console.log("Camera Check Metrics:", { averageBrightness, stdDev });

        // Rejection Criteria Optimized for User's Gray Placeholder:
        // 1. averageBrightness < 5: Too dark.
        // 2. stdDev < 4.5: Image is too "flat" (User's gray placeholder has very low variance).
        // 3. Specific Gray Pattern: Many drivers send exactly ~128 brightness.
        if (averageBrightness < 5.0 || stdDev < 4.5) {
          throw new Error(
            `Camera signal quality too low (B: ${averageBrightness.toFixed(2)}, V: ${stdDev.toFixed(2)})`,
          );
        }

        // Additional check: Detect the specific Gray Placeholder (around 120-135 brightness with near zero variance)
        if (
          averageBrightness > 120 &&
          averageBrightness < 140 &&
          stdDev < 8.0
        ) {
          throw new Error("System placeholder detected (Gray Screen)");
        }
      } catch (e) {
        console.error("Visual Security Failure:", e);
        setError(
          "خطأ أمني: الكاميرا مغلقة أو مغطاة. يجب أن تكون الكاميرا مفعلة وتكشف عن ضوء حقيقي لبدء الامتحان.",
        );
        setLoading(false);
        return;
      }

      // 1.5. AI FACE DETECTION CHECK
      if (!modelsLoaded) {
        setError(
          "جاري تحميل أنظمة الأمان الذكية... يرجى الانتظار ثانية والمحاولة مرة أخرى.",
        );
        setLoading(false);
        return;
      }

      try {
        // We need a temporary video element for faceapi to analyze
        const video = document.createElement("video");
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
        });
        video.srcObject = stream;
        await video.play();

        // Run AI Detection (Wait slightly for auto-focus)
        await new Promise((resolve) => setTimeout(resolve, 800));

        // Perform detection with face-api.js
        const detection = await window.faceapi.detectSingleFace(
          video,
          new window.faceapi.TinyFaceDetectorOptions(),
        );

        // Cleanup
        stream.getTracks().forEach((track) => track.stop());
        video.srcObject = null;

        if (!detection) {
          throw new Error("No face detected by AI");
        }

        console.log("AI Face Detection Success - Score:", detection.score);
      } catch (e) {
        console.error("AI Face Detection Failure:", e);
        setError(
          "عذراً، لم يتم العثور على وجهك أمام الكاميرا. يرجى التأكد من الجلوس في مكان مضاء وعدم تغطية العدسة لبدء الامتحان.",
        );
        setLoading(false);
        return;
      }

      // 2. SEB Check (MANDATORY for all exams)
      const ua = navigator.userAgent.toLowerCase();
      const isSeb = ua.includes("seb") || ua.includes("safeexambrowser");
      if (!isSeb) {
        setShowSebWarning(true);
        setLoading(false);
        return;
      }

      // Validated. Enter Exam!
      // Parameters are needed by experiment components to set up the simulation.
      // Answer verification is handled server-side by submit_exam_result RPC.
      onJoin({
        experiment: exam.experiment_name,
        code: exam.session_code,
        studentName: loggedInStudent.name,
        studentId: loggedInStudent.student_id,
        instructorId: exam.instructor_id,
        startTime: exam.started_at,
        parameters: exam.parameters || {},
      });
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  const isSebBrowser =
    navigator.userAgent.toLowerCase().includes("seb") ||
    navigator.userAgent.toLowerCase().includes("safeexambrowser");

  return (
    <div className="auth-page">
      <div className="auth-card glass-panel">
        {/* Back Button */}
        {!isSebBrowser && (
          <button className="auth-back-btn" onClick={onBack}>
            <ArrowLeft size={18} />
            <span>العودة للمنصة</span>
          </button>
        )}

        {/* SEB Warning View */}
        {showSebWarning ? (
          <div
            className="auth-form"
            style={{ textAlign: "center", marginTop: "20px" }}
          >
            <div
              style={{
                background: "rgba(239, 68, 68, 0.1)",
                padding: "24px",
                borderRadius: "12px",
                border: "1px solid rgba(239, 68, 68, 0.2)",
                marginBottom: "24px",
              }}
            >
              <Lock
                size={48}
                color="#ef4444"
                style={{ margin: "0 auto 16px auto", display: "block" }}
              />
              <h3
                style={{
                  color: "#ef4444",
                  marginBottom: "12px",
                  fontSize: "1.2rem",
                }}
              >
                بيئة اختبار آمنة إجبارية 🔒
              </h3>
              <p
                style={{
                  color: "var(--text-main)",
                  fontSize: "0.9rem",
                  lineHeight: 1.6,
                }}
              >
                هذا الاختبار محمي ومراقب. لن تتمكن من الدخول إليه من متصفحك
                الحالي. يجب فتح الاختبار داخل بيئة المتصفح الآمن (Safe Exam
                Browser).
              </p>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "20px" }}>
              <button
                onClick={handleLaunchSeb}
                className="auth-submit-btn"
                style={{
                  border: "none",
                  display: "flex",
                  justifyContent: "center",
                  background: "#10b981", // Green for launch
                  color: "#fff",
                  boxShadow: "0 0 15px rgba(16, 185, 129, 0.4)",
                  cursor: "pointer",
                }}
              >
                🚀 فتح الامتحان في المتصفح الآمن 
              </button>

              <a
                href="https://safeexambrowser.org/download_en.html"
                target="_blank"
                rel="noopener noreferrer"
                className="auth-submit-btn"
                style={{
                  border: "none",
                  display: "flex",
                  justifyContent: "center",
                  background: "#ef4444", // Red/warning for download
                  color: "#fff",
                  textDecoration: "none",
                  cursor: "pointer",
                }}
              >
                📥 تحميل المتصفح الآمن (إذا لم يكن لديك)
              </a>
            </div>
            <button
              type="button"
              onClick={() => setShowSebWarning(false)}
              style={{
                background: "transparent",
                border: "none",
                color: "var(--text-muted)",
                cursor: "pointer",
                textDecoration: "underline",
              }}
            >
              العودة للوحة الطالب
            </button>
          </div>
        ) : step === "login" ? (
          <>
            <div className="auth-header" style={{ marginBottom: "24px" }}>
              <div className="auth-icon-wrapper auth-icon--student">
                <BookOpen size={32} strokeWidth={1.5} />
              </div>
              <h2 className="auth-title">تسجيل دخول الطالب</h2>
              <p className="auth-subtitle">
                أدخل بياناتك لسحب ورقة الاختبار الخاصة بك
              </p>
            </div>

            <form className="auth-form" onSubmit={handleLoginSubmit}>
              <div className="auth-field" style={{ marginBottom: "24px" }}>
                <label
                  style={{
                    display: "block",
                    color: "var(--text-main)",
                    marginBottom: "8px",
                    fontSize: "0.9rem",
                  }}
                >
                  الرقم الأكاديمي (ID)
                </label>
                <div style={{ position: "relative" }}>
                  <User
                    size={18}
                    style={{
                      position: "absolute",
                      left: "14px",
                      top: "50%",
                      transform: "translateY(-50%)",
                      color: "#64748b",
                    }}
                  />
                  <input
                    type="text"
                    placeholder="أدخل رقمك الأكاديمي"
                    value={studentId}
                    onChange={(e) => setStudentId(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "12px 16px 12px 44px",
                      borderRadius: "8px",
                      background: "rgba(0,0,0,0.2)",
                      border: "1px solid var(--border-color)",
                      color: "#fff",
                      outline: "none",
                    }}
                    autoFocus
                  />
                </div>
              </div>

              <div className="auth-field" style={{ marginBottom: "24px" }}>
                <label
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    color: "var(--text-main)",
                    marginBottom: "8px",
                    fontSize: "0.9rem",
                  }}
                >
                  <span>كلمة المرور</span>
                  <button
                    type="button"
                    onClick={handleRequestPassword}
                    disabled={loading}
                    style={{
                      background: "transparent",
                      border: "none",
                      color: "#60a5fa",
                      fontSize: "0.8rem",
                      cursor: "pointer",
                      textDecoration: "underline",
                    }}
                  >
                   طلب كلمة المرور
                  </button>
                </label>
                <div style={{ position: "relative" }}>
                  <Lock
                    size={18}
                    style={{
                      position: "absolute",
                      left: "14px",
                      top: "50%",
                      transform: "translateY(-50%)",
                      color: "#64748b",
                    }}
                  />
                  <input
                    type="password"
                    placeholder="أدخل كلمة المرور"
                    value={studentPassword}
                    onChange={(e) => setStudentPassword(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "12px 16px 12px 44px",
                      borderRadius: "8px",
                      background: "rgba(0,0,0,0.2)",
                      border: "1px solid var(--border-color)",
                      color: "#fff",
                      outline: "none",
                    }}
                  />
                </div>
              </div>

              {error && <p className="auth-error">{error}</p>}

              <button
                type="submit"
                className="auth-submit-btn"
                disabled={
                  loading || !studentId.trim() || !studentPassword.trim()
                }
              >
                {loading ? (
                  <span className="auth-spinner" />
                ) : (
                  <>
                    <span>تسجيل الدخول</span>
                    <ArrowRight size={18} />
                  </>
                )}
              </button>
            </form>
          </>
        ) : (
          <div
            className="auth-form"
            style={{ textAlign: "center", marginTop: "10px" }}
          >
            <p
              style={{ color: "#fff", fontSize: "1.2rem", marginBottom: "8px" }}
            >
              مرحباً يا{" "}
              <span style={{ color: "var(--primary)", fontWeight: "bold" }}>
                {loggedInStudent?.name}
              </span>
            </p>
            <p style={{ color: "var(--text-muted)", marginBottom: "32px" }}>
              الرقم الأكاديمي: {loggedInStudent?.student_id}
            </p>

            {error && (
              <p className="auth-error" style={{ marginBottom: "24px" }}>
                {error}
              </p>
            )}

            {assignedExam ? (
              examCompleted ? (
                <div>
                  <p
                    style={{
                      color: "#10b981",
                      padding: "16px",
                      background: "rgba(16,185,129,0.1)",
                      borderRadius: "8px",
                      border: "1px solid rgba(16,185,129,0.2)",
                      marginBottom: "24px",
                      lineHeight: 1.5,
                      fontSize: "1.1rem",
                    }}
                  >
                    لقد أكملت اختبارك بنجاح مسبقاً 🎉
                    <br />
                    <span
                      style={{ fontSize: "0.9rem", color: "var(--text-main)" }}
                    >
                      لا يحق لك إعادة الاختبار أو سحب ورقة أخرى.
                    </span>
                  </p>
                  <button
                    onClick={onBack}
                    className="auth-submit-btn"
                    style={{
                      background: "transparent",
                      border: "1px solid var(--border-color)",
                      width: "100%",
                      display: "flex",
                      justifyContent: "center",
                      color: "var(--text-main)",
                      cursor: "pointer",
                    }}
                  >
                    العودة للرئيسية
                  </button>
                </div>
              ) : examLocked ? (
                <div>
                  <div
                    style={{
                      padding: "24px",
                      background: "rgba(239, 68, 68, 0.1)",
                      borderRadius: "12px",
                      border: "1px solid rgba(239, 68, 68, 0.3)",
                      marginBottom: "24px",
                      textAlign: "center",
                    }}
                  >
                    <div style={{ fontSize: "3rem", marginBottom: "12px" }}>
                      ⛔
                    </div>
                    <h3
                      style={{
                        color: "#ef4444",
                        marginBottom: "12px",
                        fontSize: "1.2rem",
                      }}
                    >
                      تم قفل الامتحان نهائياً
                    </h3>
                    <p
                      style={{
                        color: "#fca5a5",
                        lineHeight: 1.7,
                        fontSize: "0.95rem",
                      }}
                    >
                      لقد فتحت هذا الامتحان مسبقاً ثم خرجت من بيئة الاختبار
                      الآمنة.
                      <br />
                      <strong>لا يمكنك الدخول مرة أخرى.</strong>
                      <br />
                      <span style={{ color: "#94a3b8", fontSize: "0.85rem" }}>
                        يرجى التواصل مع الاستاذ في حالة وجود مشكلة تقنية.
                      </span>
                    </p>
                  </div>
                  <button
                    onClick={onBack}
                    className="auth-submit-btn"
                    style={{
                      background: "transparent",
                      border: "1px solid var(--border-color)",
                      width: "100%",
                      display: "flex",
                      justifyContent: "center",
                      color: "var(--text-main)",
                      cursor: "pointer",
                    }}
                  >
                    العودة للرئيسية
                  </button>
                </div>
              ) : (
                <div>
                  <p
                    style={{
                      color: "#3b82f6",
                      padding: "16px",
                      background: "rgba(59,130,246,0.1)",
                      borderRadius: "8px",
                      border: "1px solid rgba(59,130,246,0.2)",
                      marginBottom: "24px",
                      lineHeight: 1.5,
                    }}
                  >
                    لديك ورقة اختبار تم سحبها مسبقاً وما زالت قيد العمل.
                    <br />
                    اضغط على الزر للعودة إلى تجربتك المخصصة لك.
                  </p>
                  <button
                    onClick={() => proceedToExam(assignedExam)}
                    className="auth-submit-btn"
                    disabled={loading}
                    style={{
                      background: "linear-gradient(135deg, #3b82f6, #2563eb)",
                      boxShadow: "0 4px 15px rgba(59,130,246,0.3)",
                      border: "none",
                      cursor: "pointer",
                      display: "flex",
                      justifyContent: "center",
                    }}
                  >
                    {loading ? (
                      <span className="auth-spinner" />
                    ) : (
                      <>
                        <span>الدخول للاختبار المخصص</span>
                        <PlayCircle size={18} />
                      </>
                    )}
                  </button>
                </div>
              )
            ) : (
              <div>
                <p
                  style={{
                    color: "var(--text-main)",
                    marginBottom: "24px",
                    lineHeight: "1.6",
                    background: "rgba(255,255,255,0.05)",
                    padding: "16px",
                    borderRadius: "12px",
                  }}
                >
                  لم تقم بسحب ورقة اختبار بعد. للحصول على اختبارك، اضغط على الزر
                  أدناه ليقوم النظام باختيار وسحب تجربة عشوائية من بنك
                  الامتحانات وتخصيصها لك.
                  <br />
                  <br />
                  <span
                    style={{
                      color: "#ef4444",
                      fontSize: "0.85rem",
                      fontWeight: "bold",
                    }}
                  >
                    ⚠️ ملاحظة: يحق لك سحب اختبار واحد عشوائي فقط ولن تتمكن من
                    تغييره بعد السحب.
                  </span>
                </p>
                <button
                  onClick={handleGenerateAndJoin}
                  className="auth-submit-btn"
                  disabled={loading}
                  style={{
                    background: "linear-gradient(135deg, #8b5cf6, #6366f1)",
                    boxShadow: "0 4px 15px rgba(99,102,241,0.3)",
                    border: "none",
                    cursor: "pointer",
                    display: "flex",
                    justifyContent: "center",
                  }}
                >
                  {loading ? (
                    <span className="auth-spinner" />
                  ) : (
                    <>
                      <span>سحب اختبار عشوائي وبدء التقييم</span>
                      <ArrowRight size={18} />
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default SessionCodePage;
