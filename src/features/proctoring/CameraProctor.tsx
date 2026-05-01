import { useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { AlertTriangle, Eye, EyeOff, ShieldAlert } from "lucide-react";

/**
 * CameraProctor - Updated AI Proctoring Component from GitHub.
 * Handles face detection, warning countdowns, and automatic kicking.
 */
function CameraProctor({ examConfig, onKickStudent }: { examConfig: any; onKickStudent: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const cameraStarted = useRef(false);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  // --- REAL-TIME TRACKING REFS ---
  const consecutiveMisses = useRef(0);      // Counter for sequential frames with no face
  const isWarningActive = useRef(false);    // True if the 30s countdown is visible
  const warningStartTime = useRef<number | null>(null);    // Absolute timestamp of warning start
  const warningTimerId = useRef<any>(null);      // ID for the 30s kick timeout
  const countdownTimerId = useRef<any>(null);    // ID for the 1s UI counter interval
  const faceCheckTimerId = useRef<any>(null);
  const snapshotTimerId = useRef<any>(null);
  const alertSentRef = useRef(false);
  const isKickedRef = useRef(false);
  const examCompleteRef = useRef(false);

  // React state for UI rendering only
  const [showWarning, setShowWarning] = useState(false);
  const [countdown, setCountdown] = useState(30);
  const [faceStatus, setFaceStatus] = useState("detecting"); // 'detected', 'absent', 'detecting'

  // Keep examComplete ref in sync
  useEffect(() => {
    examCompleteRef.current = examConfig?.examComplete || false;
  }, [examConfig?.examComplete]);

  // ─── Snapshot capture (reused for periodic + alert) ───
  const captureSnapshot = async (purpose = "periodic") => {
    if (!videoRef.current || !videoRef.current.videoWidth) return null;

    const canvas = document.createElement("canvas");
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);

    let blob: Blob | null = null;
    let ext = "webp";
    let mime = "image/webp";

    try {
      blob = await new Promise((resolve) =>
        canvas.toBlob((b) => resolve(b), "image/webp", 0.5),
      );
    } catch (e) {
      /* WebP not supported */
    }

    if (!blob) {
      ext = "jpg";
      mime = "image/jpeg";
      try {
        blob = await new Promise((resolve) =>
          canvas.toBlob((b) => resolve(b), "image/jpeg", 0.5),
        );
      } catch (e) {
        /* JPEG failed */
      }
    }
    if (!blob) {
      ext = "png";
      mime = "image/png";
      try {
        blob = await new Promise((resolve) =>
          canvas.toBlob((b) => resolve(b), "image/png"),
        );
      } catch (e) {
        return null;
      }
    }
    if (!blob) return null;

    const safeStudentId = examConfig.studentId
      .toString()
      .replace(/[^a-zA-Z0-9_-]/g, "_");
    const fileName = `${examConfig.code}/${safeStudentId}/${Date.now()}.${ext}`;

    try {
      const { error } = await supabase.storage
        .from("exam_snapshots")
        .upload(purpose === "alert" ? `alerts/${fileName}` : fileName, blob, {
          contentType: mime,
          cacheControl: "3600",
          upsert: false,
        });
      if (error) {
        console.error(`[Proctor] ${purpose} upload error:`, error.message);
        return null;
      }
      return purpose === "alert" ? `alerts/${fileName}` : fileName;
    } catch (err: any) {
      console.error(`[Proctor] ${purpose} upload exception:`, err.message);
      return null;
    }
  };

  // ─── Cancel warning (when face returns) ───
  const cancelWarning = () => {
    isWarningActive.current = false;
    warningStartTime.current = null;
    alertSentRef.current = false;

    if (warningTimerId.current) {
      clearTimeout(warningTimerId.current);
      warningTimerId.current = null;
    }
    if (countdownTimerId.current) {
      clearInterval(countdownTimerId.current);
      countdownTimerId.current = null;
    }

    setShowWarning(false);
    setCountdown(30);
  };

  // ─── Handle 30-second timeout → kick student ───
  const handleKick = async () => {
    if (isKickedRef.current) return;
    isKickedRef.current = true;

    const snapshotPath = await captureSnapshot("alert");

    if (!alertSentRef.current) {
      alertSentRef.current = true;
      try {
        await supabase.from("proctor_alerts").insert({
          student_id: examConfig.studentId.toString(),
          student_name: examConfig.studentName || "غير معروف",
          exam_code: examConfig.code,
          instructor_id: examConfig.instructorId,
          alert_type: "face_absent",
          snapshot_path: snapshotPath || null,
        });
      } catch (err) {
        console.error("[Proctor] Alert error:", err);
      }
    }

    if (onKickStudent) onKickStudent();
  };

  // ─── Start warning countdown ───
  const startWarning = () => {
    if (isWarningActive.current || isKickedRef.current) return;

    isWarningActive.current = true;
    warningStartTime.current = Date.now();
    setShowWarning(true);
    setCountdown(30);

    countdownTimerId.current = setInterval(() => {
      if (!warningStartTime.current) return;
      const elapsed = Math.floor((Date.now() - warningStartTime.current) / 1000);
      const remaining = Math.max(0, 30 - elapsed);
      setCountdown(remaining);
    }, 1000);

    warningTimerId.current = setTimeout(() => {
      if (countdownTimerId.current) clearInterval(countdownTimerId.current);
      countdownTimerId.current = null;
      setCountdown(0);
      handleKick();
    }, 30000);
  };

  const runFaceCheck = async () => {
    if (!videoRef.current || !(window as any).faceapi) return;
    if (examCompleteRef.current || isKickedRef.current) return;

    if (videoRef.current.readyState < 2 || !videoRef.current.videoWidth) return;

    try {
      const detection = await (window as any).faceapi.detectSingleFace(
        videoRef.current,
        new (window as any).faceapi.TinyFaceDetectorOptions({
          inputSize: 320,
          scoreThreshold: 0.25,
        }),
      );

      if (detection && detection.score > 0.2) {
        consecutiveMisses.current = 0;
        setFaceStatus("detected");
        if (isWarningActive.current) {
          cancelWarning();
        }
      } else {
        consecutiveMisses.current += 1;
        setFaceStatus("absent");
        if (consecutiveMisses.current >= 4 && !isWarningActive.current && !isKickedRef.current) {
          startWarning();
        }
      }
    } catch (err: any) {
      console.warn("[Proctor] Detection error (skipping):", err.message);
    }
  };

  // ─── Tab/Window Exit Detection ───
  useEffect(() => {
    if (!examConfig || examCompleteRef.current) return;

    const sendTabSwitchAlert = async () => {
      if (isKickedRef.current || examCompleteRef.current) return;
      try {
        await supabase.from("proctor_alerts").insert({
          student_id: examConfig.studentId.toString(),
          student_name: examConfig.studentName || "Unknown",
          exam_code: examConfig.code,
          instructor_id: examConfig.instructorId,
          alert_type: "tab_switch",
          snapshot_path: null,
        });
      } catch (err) {
        console.error("[Proctor] Tab-switch error:", err);
      }
    };

    const sendBrowserCloseAlert = () => {
      if (isKickedRef.current || examCompleteRef.current) return;
      try {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

        const alertParams = new URLSearchParams();
        alertParams.append("student_id", examConfig.studentId.toString());
        alertParams.append("student_name", examConfig.studentName || "غير معروف");
        alertParams.append("exam_code", examConfig.code || "");
        alertParams.append("instructor_id", examConfig.instructorId || "");
        alertParams.append("alert_type", "browser_closed");
        
        const alertsUrl = `${supabaseUrl}/rest/v1/proctor_alerts?apikey=${supabaseKey}`;
        navigator.sendBeacon(alertsUrl, alertParams);
        
        const rpcPayload = {
          p_student_id: examConfig.studentId.toString(),
          p_student_name: examConfig.studentName || "غير معروف",
          p_exam_code: examConfig.code || "N/A",
          p_experiment: examConfig.experiment || "unknown",
          p_student_result: "--quit--",
          p_actual_result: "N/A",
          p_unit: ""
        };

        const rpcUrl = `${supabaseUrl}/rest/v1/rpc/submit_exam_result?apikey=${supabaseKey}`;
        fetch(rpcUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseKey}`
          },
          body: JSON.stringify(rpcPayload),
          keepalive: true
        }).catch(() => {});
      } catch (err) {
        console.error("[Proctor] Browser-close alert error:", err);
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        sendTabSwitchAlert();
      }
    };

    let isClosing = false;
    const handleBeforeUnload = () => {
      if (isClosing) return;
      isClosing = true;
      sendBrowserCloseAlert();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener("pagehide", handleBeforeUnload);
    window.addEventListener("unload", handleBeforeUnload);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("pagehide", handleBeforeUnload);
      window.removeEventListener("unload", handleBeforeUnload);
    };
  }, [examConfig]);

  useEffect(() => {
    if (!examConfig || examCompleteRef.current) return;
    if (cameraStarted.current) return;
    cameraStarted.current = true;

    const start = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 480 } },
          audio: false,
        });
        mediaStreamRef.current = stream;

        if (!videoRef.current) return;
        videoRef.current.srcObject = stream;

        videoRef.current.onloadedmetadata = async () => {
          try {
            await videoRef.current!.play();
          } catch (e) {}

          captureSnapshot("periodic");
          snapshotTimerId.current = setInterval(() => captureSnapshot("periodic"), 1 * 60 * 1000);

          setTimeout(() => {
            faceCheckTimerId.current = setInterval(runFaceCheck, 3000);
          }, 3000);
        };
      } catch (err: any) {
        console.error("[Proctor] Camera access denied:", err.message);
      }
    };

    start();

    return () => {
      cameraStarted.current = false;
      if (faceCheckTimerId.current) clearInterval(faceCheckTimerId.current);
      if (snapshotTimerId.current) clearInterval(snapshotTimerId.current);
      if (warningTimerId.current) clearTimeout(warningTimerId.current);
      if (countdownTimerId.current) clearInterval(countdownTimerId.current);
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, [examConfig]);

  return (
    <>
      <video
        ref={videoRef}
        width={640}
        height={480}
        style={{
          position: "fixed",
          top: "-9999px",
          left: "-9999px",
          width: "640px",
          height: "480px",
          pointerEvents: "none",
          opacity: 0,
        }}
        muted
        playsInline
      />

      {!examConfig?.examComplete && (
        <div
          className="proctor-status-badge"
          style={{
            position: "fixed",
            bottom: "20px",
            right: "20px",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "8px 14px",
            borderRadius: "20px",
            background: faceStatus === "detected" ? "rgba(16, 185, 129, 0.15)" : faceStatus === "absent" ? "rgba(239, 68, 68, 0.15)" : "rgba(148, 163, 184, 0.15)",
            border: `1px solid ${faceStatus === "detected" ? "rgba(16, 185, 129, 0.3)" : faceStatus === "absent" ? "rgba(239, 68, 68, 0.3)" : "rgba(148, 163, 184, 0.3)"}`,
            color: faceStatus === "detected" ? "#10b981" : faceStatus === "absent" ? "#ef4444" : "#94a3b8",
            fontSize: "0.75rem",
            fontWeight: 500,
            zIndex: 999,
            transition: "all 0.5s ease",
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
          }}
        >
          {faceStatus === "detected" ? <Eye size={14} /> : <EyeOff size={14} />}
          <span>{faceStatus === "detected" ? "مراقب ✓" : faceStatus === "absent" ? "غير مرصود" : "جاري الكشف..."}</span>
        </div>
      )}

      {showWarning && !isKickedRef.current && (
        <div className="proctor-warning-overlay">
          <div className="proctor-warning-content">
            <div className="proctor-warning-icon"><ShieldAlert size={64} /></div>
            <div className="proctor-countdown-circle">
              <svg viewBox="0 0 120 120" className="proctor-countdown-svg">
                <circle cx="60" cy="60" r="54" className="proctor-countdown-bg" />
                <circle cx="60" cy="60" r="54" className="proctor-countdown-progress" style={{ strokeDasharray: `${2 * Math.PI * 54}`, strokeDashoffset: `${2 * Math.PI * 54 * (1 - countdown / 30)}` }} />
              </svg>
              <span className="proctor-countdown-number">{countdown}</span>
            </div>
            <h2 className="proctor-warning-title"><AlertTriangle size={28} style={{ display: "inline", verticalAlign: "middle", marginLeft: "8px" }} />⚠️ تم كشف غيابك!</h2>
            <p className="proctor-warning-text">عُد أمام الكاميرا فوراً خلال <strong>{countdown}</strong> ثانية<br />وإلا سيتم <strong style={{ color: "#ff4444" }}>إنهاء الامتحان وإبلاغ الاستاذ</strong> تلقائياً</p>
            <div className="proctor-warning-bar"><div className="proctor-warning-bar-fill" style={{ width: `${(countdown / 30) * 100}%` }} /></div>
          </div>
        </div>
      )}
    </>
  );
}

export default CameraProctor;
