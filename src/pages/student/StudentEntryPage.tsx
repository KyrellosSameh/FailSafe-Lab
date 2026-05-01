/// <reference types="vite/client" />
import { useState, useEffect } from "react";

declare global {
  interface Window {
    faceapi: any;
  }
}
import {
  ArrowLeft,
  BookOpen,
  ArrowRight,
  Lock,
  User,
  PlayCircle,
} from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import bcrypt from "bcryptjs";
import emailjs from "@emailjs/browser";
import "./StudentEntryPage.css";

function SessionCodePage({ onBack, onJoin }: { onBack: any; onJoin: any }) {
  const isSebBrowser =
    navigator.userAgent.toLowerCase().includes("seb") ||
    navigator.userAgent.toLowerCase().includes("safeexambrowser");

  const [step, setStep] = useState(isSebBrowser ? "login" : "seb_check"); // 'seb_check', 'login' or 'lobby'
  const [studentId, setStudentId] = useState("");
  const [studentPassword, setStudentPassword] = useState("");
  const [loggedInStudent, setLoggedInStudent] = useState<any>(null);

  // Stores the exam the student was assigned to
  const [assignedExam, setAssignedExam] = useState<any>(null);
  // Flag to know if the assigned exam is already completed
  const [examCompleted, setExamCompleted] = useState(false);
  // Flag: exam was already opened in SEB (can't re-enter)
  const [examLocked, setExamLocked] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [modelsLoaded, setModelsLoaded] = useState(false);

  import.meta.env.VITE_BYPASS_CAMERA; // keep the import meta check clean

  useEffect(() => {
    let attempts = 0;
    const loadModels = async () => {
      if (!window.faceapi) {
        if (attempts < 10) {
          attempts++;
          setTimeout(loadModels, 500);
        }
        return;
      }
      try {
        const MODEL_URL = "https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@master/weights/";
        await Promise.all([
          window.faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        ]);
        setModelsLoaded(true);
      } catch (err: any) {
        console.error("Error loading faceapi models:", err);
      }
    };
    loadModels();
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
    } catch (err: any) {
      console.error(err);
      setError("حدث خطأ أثناء الاتصال بالخادم. تأكد من الإعدادات.");
    } finally {
      setLoading(false);
    }
  };

  /**
   * --- STUDENT AUTHENTICATION FLOW ---
   * 1. Check for duplicate sessions
   * 2. Verify password with bcrypt (hashed)
   * 3. Randomize experiment if session is new
   */
  const handleLoginSubmit = async (e: any) => {
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
    } catch (err: any) {
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
    } catch (err: any) {
      console.error(err);
      setError("حدث خطأ أثناء سحب الاختبار: " + (err.message || JSON.stringify(err)));
      setLoading(false);
    }
  };

  const proceedToExam = async (exam: any) => {
    setLoading(true);
    setError("");
    try {
      // SEB Check (MANDATORY for all exams)
      const ua = navigator.userAgent.toLowerCase();
      const isSeb = ua.includes("seb") || ua.includes("safeexambrowser");
      if (!isSeb) {
        setStep("seb_check");
        setLoading(false);
        return;
      }

      // Camera check for exam entry
      const isDevBypass = import.meta.env.VITE_BYPASS_CAMERA === "true";
      if (!isDevBypass) {
        if (!modelsLoaded) {
          setError("جاري تحميل نظام المراقبة الذكي. يرجى الانتظار بضع ثوانٍ ثم المحاولة...");
          setLoading(false);
          return;
        }
        
        setError("جاري التحقق من الكاميرا والوجه...");
        console.log("[Camera] Starting camera check...");
        
        // Step 1: Request camera access
        let stream: MediaStream;
        try {
          console.log("[Camera] Requesting getUserMedia...");
          stream = await navigator.mediaDevices.getUserMedia({
            video: { width: { ideal: 640 }, height: { ideal: 480 } },
          });
          console.log("[Camera] getUserMedia SUCCESS. Tracks:", stream.getVideoTracks().length);
          const track = stream.getVideoTracks()[0];
          if (track) {
            console.log("[Camera] Track label:", track.label, "| enabled:", track.enabled, "| readyState:", track.readyState);
          }
        } catch (camErr: any) {
          console.error("[Camera] getUserMedia FAILED:", camErr.name, camErr.message);
          setError("تعذر الوصول للكاميرا: " + camErr.message + " — يرجى التأكد من السماح للمتصفح باستخدام الكاميرا.");
          setLoading(false);
          return;
        }

        // Step 2: Create video element and attach stream
        const video = document.createElement("video");
        video.setAttribute("autoplay", "true");
        video.setAttribute("playsinline", "true");
        video.setAttribute("muted", "true");
        video.muted = true;
        video.playsInline = true;
        video.width = 640;
        video.height = 480;
        video.style.position = "fixed";
        video.style.top = "0";
        video.style.left = "0";
        video.style.width = "1px";
        video.style.height = "1px";
        video.style.opacity = "0.01";
        video.style.zIndex = "-9999";
        document.body.appendChild(video);
        
        video.srcObject = stream;
        console.log("[Camera] Video element created and stream attached.");

        // Step 3: Wait for video to be ready with timeout
        const videoReady = await Promise.race([
          new Promise<boolean>((resolve) => {
            video.onloadedmetadata = () => {
              console.log("[Camera] onloadedmetadata fired. videoWidth:", video.videoWidth, "videoHeight:", video.videoHeight);
              video.play()
                .then(() => {
                  console.log("[Camera] video.play() SUCCESS");
                  resolve(true);
                })
                .catch((playErr) => {
                  console.error("[Camera] video.play() FAILED:", playErr);
                  resolve(false);
                });
            };
          }),
          new Promise<boolean>((resolve) => {
            setTimeout(() => {
              console.warn("[Camera] TIMEOUT waiting for onloadedmetadata (5s)");
              resolve(false);
            }, 5000);
          }),
        ]);

        if (!videoReady) {
          stream.getTracks().forEach((t) => t.stop());
          video.srcObject = null;
          document.body.removeChild(video);
          setError("تعذر تشغيل الكاميرا. يرجى التأكد من عدم استخدام الكاميرا في برنامج آخر وإعادة المحاولة.");
          setLoading(false);
          return;
        }

        // Step 4: Wait for camera to warm up (auto-exposure/focus)
        console.log("[Camera] Waiting 2s for camera warmup...");
        await new Promise((resolve) => setTimeout(resolve, 2000));
        console.log("[Camera] After warmup - videoWidth:", video.videoWidth, "videoHeight:", video.videoHeight, "paused:", video.paused);

        // Step 4.5: Check if camera is producing actual frames (not black)
        const checkCanvas = document.createElement("canvas");
        checkCanvas.width = video.videoWidth || 640;
        checkCanvas.height = video.videoHeight || 480;
        const checkCtx = checkCanvas.getContext("2d");
        if (checkCtx) {
          checkCtx.drawImage(video, 0, 0, checkCanvas.width, checkCanvas.height);
          const imageData = checkCtx.getImageData(0, 0, checkCanvas.width, checkCanvas.height);
          const pixels = imageData.data;
          let nonBlackPixels = 0;
          // Sample every 100th pixel for performance
          for (let i = 0; i < pixels.length; i += 400) {
            if (pixels[i] > 10 || pixels[i + 1] > 10 || pixels[i + 2] > 10) {
              nonBlackPixels++;
            }
          }
          const totalSampled = Math.floor(pixels.length / 400);
          const percentNonBlack = (nonBlackPixels / totalSampled) * 100;
          console.log(`[Camera] Frame check: ${nonBlackPixels}/${totalSampled} non-black pixels (${percentNonBlack.toFixed(1)}%)`);
          
          if (percentNonBlack < 1) {
            console.error("[Camera] Camera is producing BLACK frames — hardware not active!");
            stream.getTracks().forEach((t) => t.stop());
            video.srcObject = null;
            document.body.removeChild(video);
            setError("الكاميرا لا تعمل بشكل صحيح (شاشة سوداء). يرجى:\n1. التأكد من تفعيل الكاميرا في إعدادات Safe Exam Browser\n2. إغلاق أي برنامج آخر يستخدم الكاميرا\n3. التأكد من عدم وجود غطاء على الكاميرا");
            setLoading(false);
            return;
          }
        }

        // Step 5: Face detection with retries
        let detection = null;
        let attempts = 0;
        
        while (!detection && attempts < 8) {
          try {
            console.log(`[Camera] Face detection attempt ${attempts + 1}/8...`);
            detection = await window.faceapi.detectSingleFace(
              video,
              new window.faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.3 })
            );
            if (detection) {
              console.log("[Camera] Face DETECTED! Score:", detection.score);
            }
          } catch (detectErr: any) {
            console.error("[Camera] Face detection error:", detectErr.message);
          }
          if (!detection) {
            attempts++;
            await new Promise((resolve) => setTimeout(resolve, 600));
          }
        }

        // Step 6: Cleanup
        stream.getTracks().forEach((t) => t.stop());
        video.srcObject = null;
        document.body.removeChild(video);
        console.log("[Camera] Camera stopped and cleaned up.");

        if (!detection) {
          console.warn("[Camera] Face NOT detected after all attempts.");
          setError("لم يتم التعرف على وجهك. يرجى الجلوس أمام الكاميرا بشكل واضح وإضاءة جيدة لدخول الاختبار.");
          setLoading(false);
          return;
        }
      }

      setError("");
      
      // Validated. Enter Exam!
      // Parameters are needed by experiment components to set up the simulation.
      onJoin({
        experiment: exam.experiment_name,
        code: exam.session_code,
        studentName: loggedInStudent.name,
        studentId: loggedInStudent.student_id,
        instructorId: exam.instructor_id,
        startTime: exam.started_at,
        parameters: exam.parameters || {},
      });
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

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
        {step === "seb_check" ? (
          <div
            className="auth-form"
            style={{ textAlign: "center", marginTop: "20px" }}
          >
            <div className="student-entry-seb-warning">
              <Lock
                size={48}
                color="#ef4444"
                className="student-entry-seb-icon"
              />
              <h3 className="student-entry-seb-title">
                بيئة اختبار آمنة إجبارية 🔒
              </h3>
              <p className="student-entry-seb-text">
                هذا الاختبار محمي ومراقب. لن تتمكن من الدخول إليه من متصفحك
                الحالي. يجب فتح الاختبار داخل بيئة المتصفح الآمن (Safe Exam
                Browser).
              </p>
            </div>

            <div className="student-entry-seb-actions">
              <button
                onClick={handleLaunchSeb}
                className="auth-submit-btn student-entry-seb-btn-launch"
              >
                🚀 فتح الامتحان في المتصفح الآمن
              </button>

              <a
                href="https://safeexambrowser.org/download_en.html"
                target="_blank"
                rel="noopener noreferrer"
                className="auth-submit-btn student-entry-seb-btn-download"
              >
                📥 تحميل المتصفح الآمن (إذا لم يكن لديك)
              </a>
            </div>
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
                <label className="student-entry-label">
                  الرقم الأكاديمي (ID)
                </label>
                <div className="student-entry-input-wrapper">
                  <User
                    size={18}
                    className="student-entry-input-icon"
                  />
                  <input
                    type="text"
                    placeholder="أدخل رقمك الأكاديمي"
                    value={studentId}
                    onChange={(e) => setStudentId(e.target.value)}
                    className="student-entry-input"
                    autoFocus
                  />
                </div>
              </div>

              <div className="auth-field" style={{ marginBottom: "24px" }}>
                <label className="student-entry-label-flex">
                  <span>كلمة المرور</span>
                  <button
                    type="button"
                    onClick={handleRequestPassword}
                    disabled={loading}
                    className="student-entry-forgot-btn"
                  >
                    طلب كلمة المرور
                  </button>
                </label>
                <div className="student-entry-input-wrapper">
                  <Lock
                    size={18}
                    className="student-entry-input-icon"
                  />
                  <input
                    type="password"
                    placeholder="أدخل كلمة المرور"
                    value={studentPassword}
                    onChange={(e) => setStudentPassword(e.target.value)}
                    className="student-entry-input"
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
          <div className="student-entry-lobby-container">
            <p className="student-entry-welcome">
              مرحباً يا{" "}
              <span className="student-entry-welcome-name">
                {loggedInStudent?.name}
              </span>
            </p>
            <p className="student-entry-id">
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
                  <p className="student-entry-completed">
                    لقد أكملت اختبارك بنجاح مسبقاً 🎉
                    <br />
                    <span className="student-entry-completed-sub">
                      لا يحق لك إعادة الاختبار أو سحب ورقة أخرى.
                    </span>
                  </p>
                  <button
                    onClick={onBack}
                    className="student-entry-back-btn auth-submit-btn"
                  >
                    العودة للرئيسية
                  </button>
                </div>
              ) : examLocked ? (
                <div>
                  <div className="student-entry-locked">
                    <div className="student-entry-locked-icon">
                      ⛔
                    </div>
                    <h3 className="student-entry-locked-title">
                      تم قفل الامتحان نهائياً
                    </h3>
                    <p className="student-entry-locked-text">
                      لقد فتحت هذا الامتحان مسبقاً ثم خرجت من بيئة الاختبار
                      الآمنة.
                      <br />
                      <strong>لا يمكنك الدخول مرة أخرى.</strong>
                      <br />
                      <span className="student-entry-locked-sub">
                        يرجى التواصل مع الاستاذ في حالة وجود مشكلة تقنية.
                      </span>
                    </p>
                  </div>
                  <button
                    onClick={onBack}
                    className="student-entry-back-btn auth-submit-btn"
                  >
                    العودة للرئيسية
                  </button>
                </div>
              ) : (
                <div>
                  <p className="student-entry-assigned">
                    لديك ورقة اختبار تم سحبها مسبقاً وما زالت قيد العمل.
                    <br />
                    اضغط على الزر للعودة إلى تجربتك المخصصة لك.
                  </p>
                  <button
                    onClick={() => proceedToExam(assignedExam)}
                    className="auth-submit-btn student-entry-start-btn"
                    disabled={loading}
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
                <p className="student-entry-info">
                  لم تقم بسحب ورقة اختبار بعد. للحصول على اختبارك، اضغط على الزر
                  أدناه ليقوم النظام باختيار وسحب تجربة عشوائية من بنك
                  الامتحانات وتخصيصها لك.
                  <br />
                  <br />
                  <span className="student-entry-warning-text">
                    ⚠️ ملاحظة: يحق لك سحب اختبار واحد عشوائي فقط ولن تتمكن من
                    تغييره بعد السحب.
                  </span>
                </p>
                <button
                  onClick={handleGenerateAndJoin}
                  className="auth-submit-btn student-entry-generate-btn"
                  disabled={loading}
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
