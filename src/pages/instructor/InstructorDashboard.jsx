import { useState, useEffect, useRef } from "react";
import {
  LogOut,
  PlusCircle,
  Users,
  Activity,
  GraduationCap,
  ClipboardList,
  TrendingUp,
  ShieldAlert,
  CheckCircle,
  Bell,
} from "lucide-react";
import { supabase } from "../../lib/supabaseClient";

function InstructorDashboard({
  instructorId,
  onBack,
  onCreateExam,
  onViewResults,
  username,
}) {
  const [stats, setStats] = useState({ totalExams: 0, totalStudents: 0 });
  const [alerts, setAlerts] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const audioRef = useRef(null);

  // Fetch stats
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const { data, error } = await supabase
          .from("results")
          .select("exam_code, student_id")
          .eq("instructor_id", instructorId);

        if (!error && data) {
          setStats({
            totalExams: new Set(data.map((r) => r.exam_code)).size || 0,
            totalStudents: data.length || 0,
          });
        }
      } catch (err) {
        console.error("Error fetching stats:", err);
      }
    };
    fetchStats();
  }, []);

  // Fetch existing alerts
  useEffect(() => {
    const fetchAlerts = async () => {
      try {
        const { data, error } = await supabase
          .from("proctor_alerts")
          .select("*")
          .eq("instructor_id", instructorId)
          .order("created_at", { ascending: false })
          .limit(50);

        if (!error && data) {
          // Enrich alerts with snapshot URLs
          const enriched = await Promise.all(
            data.map(async (alert) => {
              let snapshotUrl = null;
              if (alert.snapshot_path) {
                // Try proctor_alerts bucket first, then exam_snapshots
                const { data: urlData } = supabase.storage
                  .from("exam_snapshots")
                  .getPublicUrl(
                    alert.snapshot_path.startsWith("alerts/")
                      ? alert.snapshot_path
                      : `alerts/${alert.snapshot_path}`,
                  );

                if (urlData?.publicUrl) {
                  snapshotUrl = urlData.publicUrl;
                }

                // Also try direct path in exam_snapshots
                if (!snapshotUrl || snapshotUrl.includes("undefined")) {
                  const { data: urlData2 } = supabase.storage
                    .from("exam_snapshots")
                    .getPublicUrl(alert.snapshot_path);
                  if (urlData2?.publicUrl) {
                    snapshotUrl = urlData2.publicUrl;
                  }
                }
              }
              return { ...alert, snapshotUrl };
            }),
          );

          setAlerts(enriched);
          setUnreadCount(enriched.filter((a) => !a.is_read).length);
        }
      } catch (err) {
        console.error("Error fetching alerts:", err);
      }
    };

    fetchAlerts();
  }, [instructorId]);

  // Realtime subscription for new alerts
  useEffect(() => {
    const channel = supabase
      .channel("proctor-alerts-realtime")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "proctor_alerts",
          filter: `instructor_id=eq.${instructorId}`,
        },
        async (payload) => {
          console.log(
            "[InstructorDashboard] New proctor alert received:",
            payload,
          );

          const newAlert = payload.new;
          let snapshotUrl = null;

          if (newAlert.snapshot_path) {
            const { data: urlData } = supabase.storage
              .from("exam_snapshots")
              .getPublicUrl(newAlert.snapshot_path);
            if (urlData?.publicUrl) {
              snapshotUrl = urlData.publicUrl;
            }
          }

          const enrichedAlert = { ...newAlert, snapshotUrl };

          setAlerts((prev) => [enrichedAlert, ...prev]);
          setUnreadCount((prev) => prev + 1);

          // Play alert sound
          playAlertSound();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [instructorId]);

  // Play alert beep sound
  const playAlertSound = () => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();

      // Create a beep sequence: beep-beep-beep
      const playBeep = (startTime, freq = 880) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.3, startTime);
        gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.15);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(startTime);
        osc.stop(startTime + 0.15);
      };

      playBeep(ctx.currentTime, 880);
      playBeep(ctx.currentTime + 0.2, 880);
      playBeep(ctx.currentTime + 0.4, 1100);
    } catch (e) {
      console.warn("Could not play alert sound:", e);
    }
  };

  // Mark alert as read
  const handleDismissAlert = async (alertId) => {
    try {
      const { error } = await supabase
        .from("proctor_alerts")
        .update({ is_read: true })
        .eq("id", alertId);

      if (!error) {
        setAlerts((prev) =>
          prev.map((a) => (a.id === alertId ? { ...a, is_read: true } : a)),
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
    } catch (err) {
      console.error("Error dismissing alert:", err);
    }
  };

  // Format time
  const formatTime = (timestamp) => {
    if (!timestamp) return "";
    const date = new Date(timestamp);
    return date.toLocaleTimeString("ar-EG", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const handleLogout = () => {
    onBack();
  };

  return (
    <div
      className="app-container"
      style={{
        background: "#090d19",
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Top Navbar */}
      <nav
        style={{
          padding: "20px 40px",
          background: "rgba(17, 24, 39, 0.8)",
          backdropFilter: "blur(10px)",
          borderBottom: "1px solid rgba(255, 255, 255, 0.05)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div
            style={{
              background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
              padding: "10px",
              borderRadius: "12px",
              color: "white",
              boxShadow: "0 4px 15px rgba(99, 102, 241, 0.4)",
            }}
          >
            <GraduationCap size={28} />
          </div>
          <div>
            <h1
              style={{
                fontSize: "1.6rem",
                fontWeight: 600,
                margin: 0,
                color: "#f8fafc",
                letterSpacing: "-0.5px",
              }}
            >
              بوابة إدارة المختبر
            </h1>
            <span style={{ fontSize: "0.85rem", color: "#94a3b8" }}>
              Instructor Portal v2.0
            </span>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "24px" }}>
          {/* Alert bell indicator */}
          {unreadCount > 0 && (
            <div
              style={{
                position: "relative",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "8px 16px",
                borderRadius: "10px",
                background: "rgba(239, 68, 68, 0.1)",
                border: "1px solid rgba(239, 68, 68, 0.3)",
                animation: "proctorBadgePulse 2s ease-in-out infinite",
              }}
            >
              <Bell size={18} color="#ef4444" />
              <span
                style={{
                  color: "#fca5a5",
                  fontWeight: 600,
                  fontSize: "0.9rem",
                }}
              >
                {unreadCount} تنبيه مراقبة
              </span>
            </div>
          )}

          <div
            style={{
              textAlign: "right",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <span
              style={{ fontSize: "1rem", fontWeight: 500, color: "#e2e8f0" }}
            >
              {username || "د. محمد"}
            </span>
            <span style={{ fontSize: "0.8rem", color: "#818cf8" }}>
              أستاذ المادة
            </span>
          </div>
          <button
            onClick={handleLogout}
            style={{
              background: "rgba(239, 68, 68, 0.1)",
              border: "1px solid rgba(239, 68, 68, 0.2)",
              color: "#f87171",
              borderRadius: "8px",
              padding: "10px 16px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              fontWeight: 500,
              transition: "all 0.2s",
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.background = "rgba(239, 68, 68, 0.2)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.background = "rgba(239, 68, 68, 0.1)")
            }
          >
            <LogOut size={18} />
            <span>تسجيل الخروج</span>
          </button>
        </div>
      </nav>

      {/* Main Content */}
      <main
        style={{
          padding: "40px",
          maxWidth: "1200px",
          margin: "0 auto",
          width: "100%",
          flex: 1,
        }}
      >
        {/* ═══ PROCTOR ALERTS SECTION ═══ */}
        {alerts.length > 0 && (
          <div className="proctor-alerts-section">
            <div className="proctor-alerts-header">
              <div className="proctor-alerts-title">
                <ShieldAlert size={24} color="#ef4444" />
                <span>تنبيهات المراقبة الذكية</span>
                {unreadCount > 0 && (
                  <span className="proctor-alert-badge">{unreadCount}</span>
                )}
              </div>
            </div>

            <div className="proctor-alerts-grid">
              {alerts.map((alert) => (
                <div
                  key={alert.id}
                  className={`proctor-alert-card ${alert.is_read ? "read" : ""}`}
                >
                  <div className="proctor-alert-top">
                    <div className="proctor-alert-student">
                      <span className="proctor-alert-name">
                        {alert.is_read ? "✓" : "🔴"}{" "}
                        {alert.student_name || "طالب غير معروف"}
                      </span>
                      <span className="proctor-alert-id">
                        ID: {alert.student_id} | كود: {alert.exam_code}
                      </span>
                    </div>
                    <span className="proctor-alert-time">
                      {formatTime(alert.created_at)}
                    </span>
                  </div>

                  <div
                    style={{
                      padding: "10px 14px",
                      borderRadius: "8px",
                      background: alert.alert_type === "browser_closed"
                        ? "rgba(239, 68, 68, 0.12)"
                        : alert.alert_type === "tab_switch"
                        ? "rgba(245, 158, 11, 0.1)"
                        : "rgba(239, 68, 68, 0.08)",
                      color: alert.alert_type === "browser_closed"
                        ? "#fca5a5"
                        : alert.alert_type === "tab_switch"
                        ? "#fcd34d"
                        : "#fca5a5",
                      fontSize: "0.85rem",
                      lineHeight: 1.6,
                      direction: "rtl",
                    }}
                  >
                    {alert.alert_type === "browser_closed" ? (
                      <>
                        🚨 <strong>أغلق المتصفح أو غلق صفحة الامتحان كلياً!</strong>
                        <br />
                        <span style={{ opacity: 0.85 }}>الطالب خرج من الامتحان بإغلاق المتصفح أو التاب.</span>
                      </>
                    ) : alert.alert_type === "tab_switch" ? (
                      <>
                        ⚠️ <strong>غادر الطالب صفحة الامتحان مؤقتاً</strong>
                        <br />
                        <span style={{ opacity: 0.85 }}>تبديل تاب أو نافذة — قد يكون عاد بعدها.</span>
                      </>
                    ) : alert.alert_type === "tab_left" ? (
                      <>
                        ⚠️ الطالب خرج من صفحة الامتحان أو أغلق المتصفح (قد يكون
                        تم تبديل النوافذ).
                      </>
                    ) : (
                      <>
                        ⚠️ الطالب غاب عن الكاميرا لأكثر من 30 ثانية. تم إنهاء
                        الامتحان تلقائياً.
                      </>
                    )}
                  </div>

                  {/* Snapshot */}
                  {alert.snapshotUrl && (
                    <img
                      src={alert.snapshotUrl}
                      alt="لقطة غياب الطالب"
                      className="proctor-alert-snapshot"
                      onError={(e) => {
                        e.target.style.display = "none";
                      }}
                    />
                  )}

                  <div className="proctor-alert-actions">
                    {!alert.is_read && (
                      <button
                        className="proctor-alert-btn proctor-alert-btn--dismiss"
                        onClick={() => handleDismissAlert(alert.id)}
                      >
                        <CheckCircle
                          size={14}
                          style={{
                            display: "inline",
                            verticalAlign: "middle",
                            marginLeft: "6px",
                          }}
                        />
                        تم المراجعة
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Welcome & Stats Row */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "revert",
            gap: "24px",
            marginBottom: "40px",
          }}
        >
          <div
            style={{
              background:
                "linear-gradient(135deg, rgba(99, 102, 241, 0.1), rgba(139, 92, 246, 0.1))",
              border: "1px solid rgba(99, 102, 241, 0.2)",
              borderRadius: "20px",
              padding: "30px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div>
              <h2
                style={{
                  fontSize: "2rem",
                  color: "#fff",
                  marginBottom: "10px",
                }}
              >
                مرحباً بك مجدداً
              </h2>
              <p
                style={{
                  color: "#94a3b8",
                  fontSize: "1.1rem",
                  maxWidth: "500px",
                }}
              >
                يمكنك من خلال لوحة التحكم متابعة أداء طلابك وإعداد تجارب معملية
                جديدة بسهولة وأمان.
              </p>
            </div>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
            gap: "24px",
            marginBottom: "40px",
          }}
        >
          {/* Stat 1 */}
          <div
            className="glass-panel"
            style={{
              padding: "24px",
              display: "flex",
              alignItems: "center",
              gap: "20px",
              borderRadius: "16px",
            }}
          >
            <div
              style={{
                padding: "16px",
                background: "rgba(59, 130, 246, 0.1)",
                color: "#3b82f6",
                borderRadius: "12px",
              }}
            >
              <ClipboardList size={32} />
            </div>
            <div>
              <p
                style={{
                  color: "#94a3b8",
                  fontSize: "0.9rem",
                  marginBottom: "4px",
                }}
              >
                اختبارات مفتوحة
              </p>
              <h3 style={{ fontSize: "1.8rem", color: "#fff" }}>
                {stats.totalExams}
              </h3>
            </div>
          </div>

          {/* Stat 2 */}
          <div
            className="glass-panel"
            style={{
              padding: "24px",
              display: "flex",
              alignItems: "center",
              gap: "20px",
              borderRadius: "16px",
            }}
          >
            <div
              style={{
                padding: "16px",
                background: "rgba(16, 185, 129, 0.1)",
                color: "#10b981",
                borderRadius: "12px",
              }}
            >
              <Users size={32} />
            </div>
            <div>
              <p
                style={{
                  color: "#94a3b8",
                  fontSize: "0.9rem",
                  marginBottom: "4px",
                }}
              >
                إجمالي الطلاب المُختبرين
              </p>
              <h3 style={{ fontSize: "1.8rem", color: "#fff" }}>
                {stats.totalStudents}
              </h3>
            </div>
          </div>

          {/* Stat 3 - Alerts count */}
          <div
            className="glass-panel"
            style={{
              padding: "24px",
              display: "flex",
              alignItems: "center",
              gap: "20px",
              borderRadius: "16px",
            }}
          >
            <div
              style={{
                padding: "16px",
                background:
                  unreadCount > 0
                    ? "rgba(239, 68, 68, 0.1)"
                    : "rgba(245, 158, 11, 0.1)",
                color: unreadCount > 0 ? "#ef4444" : "#f59e0b",
                borderRadius: "12px",
              }}
            >
              <ShieldAlert size={32} />
            </div>
            <div>
              <p
                style={{
                  color: "#94a3b8",
                  fontSize: "0.9rem",
                  marginBottom: "4px",
                }}
              >
                تنبيهات المراقبة
              </p>
              <h3
                style={{
                  fontSize: "1.8rem",
                  color: unreadCount > 0 ? "#ef4444" : "#fff",
                }}
              >
                {unreadCount > 0 ? unreadCount : "لا يوجد"}
              </h3>
            </div>
          </div>
        </div>

        {/* Primary Actions */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(400px, 1fr))",
            gap: "30px",
          }}
        >
          {/* Create Exam */}
          <div
            onClick={onCreateExam}
            style={{
              padding: "40px",
              border: "1px solid rgba(99, 102, 241, 0.3)",
              borderRadius: "24px",
              background:
                "linear-gradient(180deg, rgba(30, 41, 59, 0.8) 0%, rgba(15, 23, 42, 0.9) 100%)",
              cursor: "pointer",
              transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
              position: "relative",
              overflow: "hidden",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-8px)";
              e.currentTarget.style.boxShadow =
                "0 20px 40px rgba(99, 102, 241, 0.2)";
              e.currentTarget.style.borderColor = "rgba(99, 102, 241, 0.6)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "none";
              e.currentTarget.style.boxShadow = "none";
              e.currentTarget.style.borderColor = "rgba(99, 102, 241, 0.3)";
            }}
          >
            <div
              style={{
                position: "absolute",
                top: "-20px",
                right: "-20px",
                background: "rgba(99, 102, 241, 0.1)",
                width: "150px",
                height: "150px",
                borderRadius: "50%",
                filter: "blur(30px)",
              }}
            />
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "24px",
                position: "relative",
                zIndex: 1,
              }}
            >
              <div
                style={{
                  padding: "20px",
                  background: "rgba(99, 102, 241, 0.15)",
                  borderRadius: "16px",
                  color: "#818cf8",
                  boxShadow: "inset 0 0 20px rgba(99, 102, 241, 0.1)",
                }}
              >
                <PlusCircle size={40} strokeWidth={1.5} />
              </div>
              <div style={{ flex: 1 }}>
                <h3
                  style={{
                    fontSize: "1.6rem",
                    color: "#fff",
                    marginBottom: "12px",
                  }}
                >
                  إنشاء اختبار جديد
                </h3>
                <p
                  style={{
                    color: "#94a3b8",
                    lineHeight: "1.6",
                    fontSize: "1.05rem",
                  }}
                >
                  توليد كود جلسة مؤمن وتحديد المعاملات الفيزيائية لبدء امتحان
                  للطلاب.
                </p>
              </div>
            </div>
          </div>

          {/* View Results */}
          <div
            onClick={onViewResults}
            style={{
              padding: "40px",
              border: "1px solid rgba(16, 185, 129, 0.3)",
              borderRadius: "24px",
              background:
                "linear-gradient(180deg, rgba(30, 41, 59, 0.8) 0%, rgba(15, 23, 42, 0.9) 100%)",
              cursor: "pointer",
              transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
              position: "relative",
              overflow: "hidden",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-8px)";
              e.currentTarget.style.boxShadow =
                "0 20px 40px rgba(16, 185, 129, 0.15)";
              e.currentTarget.style.borderColor = "rgba(16, 185, 129, 0.6)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "none";
              e.currentTarget.style.boxShadow = "none";
              e.currentTarget.style.borderColor = "rgba(16, 185, 129, 0.3)";
            }}
          >
            <div
              style={{
                position: "absolute",
                top: "-20px",
                right: "-20px",
                background: "rgba(16, 185, 129, 0.05)",
                width: "150px",
                height: "150px",
                borderRadius: "50%",
                filter: "blur(30px)",
              }}
            />
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "24px",
                position: "relative",
                zIndex: 1,
              }}
            >
              <div
                style={{
                  padding: "20px",
                  background: "rgba(16, 185, 129, 0.15)",
                  borderRadius: "16px",
                  color: "#34d399",
                  boxShadow: "inset 0 0 20px rgba(16, 185, 129, 0.1)",
                }}
              >
                <Activity size={40} strokeWidth={1.5} />
              </div>
              <div style={{ flex: 1 }}>
                <h3
                  style={{
                    fontSize: "1.6rem",
                    color: "#fff",
                    marginBottom: "12px",
                  }}
                >
                  سجل النتائج والتقييم
                </h3>
                <p
                  style={{
                    color: "#94a3b8",
                    lineHeight: "1.6",
                    fontSize: "1.05rem",
                  }}
                >
                  مراجعة درجات الطلاب، التحقق من الإجابات المعملية، ورصد
                  التقييمات النهائية.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default InstructorDashboard;
