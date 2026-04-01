import { useEffect, useRef, useState } from "react";
import { supabase } from "../supabaseClient";
import { AlertTriangle, Eye, EyeOff, ShieldAlert } from "lucide-react";

function CameraProctor({ examConfig, onKickStudent }) {
  const videoRef = useRef(null);
  const cameraStarted = useRef(false);
  const mediaStreamRef = useRef(null);

  // Use refs for mutable state to avoid stale closures in intervals
  const consecutiveMisses = useRef(0);
  const isWarningActive = useRef(false);
  const warningStartTime = useRef(null);
  const warningTimerId = useRef(null);
  const countdownTimerId = useRef(null);
  const faceCheckTimerId = useRef(null);
  const snapshotTimerId = useRef(null);
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
    ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);

    let blob = null;
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
    } catch (err) {
      console.error(`[Proctor] ${purpose} upload exception:`, err.message);
      return null;
    }
  };

  // ─── Cancel warning (when face returns) ───
  const cancelWarning = () => {
    console.log("[Proctor] ✅ Face returned! Warning cancelled.");
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
    console.log("[Proctor] ⛔ 30s timeout. Kicking student...");

    // Capture snapshot
    const snapshotPath = await captureSnapshot("alert");

    // Send alert to instructor
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
        console.log("[Proctor] Alert sent to instructor.");
      } catch (err) {
        console.error("[Proctor] Alert error:", err);
      }
    }

    // Kick
    if (onKickStudent) onKickStudent();
  };

  // ─── Start warning countdown ───
  const startWarning = () => {
    if (isWarningActive.current || isKickedRef.current) return;
    console.log("[Proctor] ⚠️ Face absent! Starting 30-second warning...");

    isWarningActive.current = true;
    warningStartTime.current = Date.now();
    setShowWarning(true);
    setCountdown(30);

    // Countdown updater (every second)
    countdownTimerId.current = setInterval(() => {
      if (!warningStartTime.current) return;
      const elapsed = Math.floor(
        (Date.now() - warningStartTime.current) / 1000,
      );
      const remaining = Math.max(0, 30 - elapsed);
      setCountdown(remaining);
    }, 1000);

    // Kick after 30 seconds
    warningTimerId.current = setTimeout(() => {
      if (countdownTimerId.current) clearInterval(countdownTimerId.current);
      countdownTimerId.current = null;
      setCountdown(0);
      handleKick();
    }, 30000);
  };

  // ─── Core face detection check ───
  const runFaceCheck = async () => {
    if (!videoRef.current || !window.faceapi) return;
    if (examCompleteRef.current || isKickedRef.current) return;

    // Ensure video is playing and has dimensions
    if (videoRef.current.readyState < 2 || !videoRef.current.videoWidth) return;

    try {
      // Use larger input + lower threshold for better accuracy
      const detection = await window.faceapi.detectSingleFace(
        videoRef.current,
        new window.faceapi.TinyFaceDetectorOptions({
          inputSize: 320, // Larger = more accurate (was 224)
          scoreThreshold: 0.25, // Lower = less strict (was 0.4)
        }),
      );

      if (detection && detection.score > 0.2) {
        // ✅ Face detected
        consecutiveMisses.current = 0;
        setFaceStatus("detected");

        // If warning is active, cancel it!
        if (isWarningActive.current) {
          cancelWarning();
        }
      } else {
        // ❌ No face
        consecutiveMisses.current += 1;
        setFaceStatus("absent");

        // Require 4 consecutive misses (12 seconds) before triggering warning
        // This prevents false positives from brief glances or blinks
        if (
          consecutiveMisses.current >= 4 &&
          !isWarningActive.current &&
          !isKickedRef.current
        ) {
          startWarning();
        }
      }
    } catch (err) {
      // Don't count errors as misses - could be temporary
      console.warn("[Proctor] Detection error (skipping):", err.message);
    }
  };

  // ─── Main effect: start camera + detection loop ───
  useEffect(() => {
    if (!examConfig || examConfig.examComplete) return;
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
            await videoRef.current.play();
          } catch (e) {
            /* ignore */
          }

          // First periodic snapshot
          captureSnapshot("periodic");

          // Periodic snapshots every 1 minute
          snapshotTimerId.current = setInterval(
            () => captureSnapshot("periodic"),
            1 * 60 * 1000,
          );

          // Wait for camera to warm up & auto-focus, then start detection
          setTimeout(() => {
            // Run face check every 3 seconds
            faceCheckTimerId.current = setInterval(runFaceCheck, 3000);
          }, 3000);
        };
      } catch (err) {
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
      {/* Video element - still hidden but with proper size for detection */}
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

      {/* Small status indicator (bottom-right) */}
      {!examConfig?.examComplete && (
        <div
          style={{
            position: "fixed",
            bottom: "20px",
            right: "20px",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "8px 14px",
            borderRadius: "20px",
            background:
              faceStatus === "detected"
                ? "rgba(16, 185, 129, 0.15)"
                : faceStatus === "absent"
                  ? "rgba(239, 68, 68, 0.15)"
                  : "rgba(148, 163, 184, 0.15)",
            border: `1px solid ${
              faceStatus === "detected"
                ? "rgba(16, 185, 129, 0.3)"
                : faceStatus === "absent"
                  ? "rgba(239, 68, 68, 0.3)"
                  : "rgba(148, 163, 184, 0.3)"
            }`,
            color:
              faceStatus === "detected"
                ? "#10b981"
                : faceStatus === "absent"
                  ? "#ef4444"
                  : "#94a3b8",
            fontSize: "0.75rem",
            fontWeight: 500,
            zIndex: 999,
            transition: "all 0.5s ease",
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
          }}
        >
          {faceStatus === "detected" ? <Eye size={14} /> : <EyeOff size={14} />}
          <span>
            {faceStatus === "detected"
              ? "مراقب ✓"
              : faceStatus === "absent"
                ? "غير مرصود"
                : "جاري الكشف..."}
          </span>
        </div>
      )}

      {/* 30-Second Warning Overlay */}
      {showWarning && !isKickedRef.current && (
        <div className="proctor-warning-overlay">
          <div className="proctor-warning-content">
            <div className="proctor-warning-icon">
              <ShieldAlert size={64} />
            </div>

            <div className="proctor-countdown-circle">
              <svg viewBox="0 0 120 120" className="proctor-countdown-svg">
                <circle
                  cx="60"
                  cy="60"
                  r="54"
                  className="proctor-countdown-bg"
                />
                <circle
                  cx="60"
                  cy="60"
                  r="54"
                  className="proctor-countdown-progress"
                  style={{
                    strokeDasharray: `${2 * Math.PI * 54}`,
                    strokeDashoffset: `${2 * Math.PI * 54 * (1 - countdown / 30)}`,
                  }}
                />
              </svg>
              <span className="proctor-countdown-number">{countdown}</span>
            </div>

            <h2 className="proctor-warning-title">
              <AlertTriangle
                size={28}
                style={{
                  display: "inline",
                  verticalAlign: "middle",
                  marginLeft: "8px",
                }}
              />
              ⚠️ تم كشف غيابك!
            </h2>
            <p className="proctor-warning-text">
              عُد أمام الكاميرا فوراً خلال <strong>{countdown}</strong> ثانية
              <br />
              وإلا سيتم{" "}
              <strong style={{ color: "#ff4444" }}>
                إنهاء الامتحان وإبلاغ الاستاذ
              </strong>{" "}
              تلقائياً
            </p>

            <div className="proctor-warning-bar">
              <div
                className="proctor-warning-bar-fill"
                style={{ width: `${(countdown / 30) * 100}%` }}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default CameraProctor;
