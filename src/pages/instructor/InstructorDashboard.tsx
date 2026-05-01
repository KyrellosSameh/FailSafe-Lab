import { useState, useEffect } from "react";
import {
  LogOut,
  PlusCircle,
  Users,
  Activity,
  GraduationCap,
  ClipboardList,
  ShieldAlert,
  CheckCircle,
  Bell,
} from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import "./InstructorDashboard.css";

interface InstructorDashboardProps {
  instructorId: string | number;
  onBack: () => void;
  onCreateExam: () => void;
  onViewResults: () => void;
  username: string;
}

function InstructorDashboard({
  instructorId,
  onBack,
  onCreateExam,
  onViewResults,
  username,
}: InstructorDashboardProps) {
  const [stats, setStats] = useState({ totalExams: 0, totalStudents: 0 });
  const [alerts, setAlerts] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

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
  }, [instructorId]);

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
          const enriched = await Promise.all(
            data.map(async (alert) => {
              let snapshotUrl = null;
              if (alert.snapshot_path) {
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

  // Play alert beep sound
  const playAlertSound = () => {
    try {
      const AudioContextClass = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();

      const playBeep = (startTime: number, freq = 880) => {
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
          playAlertSound();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [instructorId]);

  const handleDismissAlert = async (alertId: any) => {
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
    } catch (err: any) {
      console.error("Error dismissing alert:", err);
    }
  };

  const formatTime = (timestamp: any) => {
    if (!timestamp) return "";
    const date = new Date(timestamp);
    return date.toLocaleTimeString("ar-EG", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  return (
    <div className="instructor-dashboard">
      <nav className="id-navbar">
        <div className="id-logo-section">
          <div className="id-logo-icon">
            <GraduationCap size={28} />
          </div>
          <div className="id-logo-text">
            <h1>بوابة إدارة المختبر</h1>
            <span>Instructor Portal v2.0</span>
          </div>
        </div>

        <div className="id-user-section">
          {unreadCount > 0 && (
            <div className="id-notification-badge" style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "8px 16px",
              borderRadius: "10px",
              background: "rgba(239, 68, 68, 0.1)",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              animation: "proctorBadgePulse 2s ease-in-out infinite",
            }}>
              <Bell size={18} color="#ef4444" />
              <span style={{ color: "#fca5a5", fontWeight: 600, fontSize: "0.9rem" }}>
                {unreadCount} تنبيه مراقبة
              </span>
            </div>
          )}

          <div className="id-user-info">
            <span className="id-user-name">{username || "الأستاذ"}</span>
            <span className="id-user-role">أستاذ المادة</span>
          </div>
          
          <button onClick={onBack} className="id-logout-btn">
            <LogOut size={18} />
            <span>تسجيل الخروج</span>
          </button>
        </div>
      </nav>

      <main className="id-main-content">
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
                <div key={alert.id} className={`proctor-alert-card ${alert.is_read ? "read" : ""}`}>
                  <div className="proctor-alert-top">
                    <div className="proctor-alert-student">
                      <span className="proctor-alert-name">
                        {alert.is_read ? "✓" : "🔴"} {alert.student_name || "طالب غير معروف"}
                      </span>
                      <span className="proctor-alert-id">
                        ID: {alert.student_id} | كود: {alert.exam_code}
                      </span>
                    </div>
                    <span className="proctor-alert-time">{formatTime(alert.created_at)}</span>
                  </div>

                  <div className="proctor-alert-message" style={{
                    padding: "10px 14px",
                    borderRadius: "8px",
                    background: "rgba(255,255,255,0.03)",
                    fontSize: "0.85rem",
                    lineHeight: 1.6,
                    direction: "rtl"
                  }}>
                    {alert.alert_type === "browser_closed" ? (
                      <><strong style={{color: "#fca5a5"}}>🚨 أغلق المتصفح كلياً!</strong><br/>الطالب خرج من الامتحان بإغلاق المتصفح أو التاب.</>
                    ) : alert.alert_type === "tab_switch" ? (
                      <><strong style={{color: "#fcd34d"}}>⚠️ غادر صفحة الامتحان مؤقتاً</strong><br/>تبديل تاب أو نافذة.</>
                    ) : (
                      <><strong style={{color: "#fca5a5"}}>⚠️ غياب عن الكاميرا</strong><br/>الطالب غاب عن الكاميرا لأكثر من 30 ثانية.</>
                    )}
                  </div>

                  {alert.snapshotUrl && (
                    <img
                      src={alert.snapshotUrl}
                      alt="لقطة غياب الطالب"
                      className="proctor-alert-snapshot"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                    />
                  )}

                  <div className="proctor-alert-actions">
                    {!alert.is_read && (
                      <button className="proctor-alert-btn" onClick={() => handleDismissAlert(alert.id)}>
                        <CheckCircle size={14} style={{ marginLeft: "6px", verticalAlign: "middle" }} />
                        تم المراجعة
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="id-welcome-banner">
          <div className="id-welcome-content">
            <h2>مرحباً بك مجدداً</h2>
            <p>يمكنك من خلال لوحة التحكم متابعة أداء طلابك وإعداد تجارب معملية جديدة بسهولة وأمان.</p>
          </div>
        </div>

        <div className="id-stats-grid">
          <div className="id-stat-card">
            <div className="id-stat-icon blue"><ClipboardList size={32} /></div>
            <div className="id-stat-info">
              <p>اختبارات مفتوحة</p>
              <h3>{stats.totalExams}</h3>
            </div>
          </div>

          <div className="id-stat-card">
            <div className="id-stat-icon green"><Users size={32} /></div>
            <div className="id-stat-info">
              <p>إجمالي الطلاب</p>
              <h3>{stats.totalStudents}</h3>
            </div>
          </div>

          <div className="id-stat-card">
            <div className="id-stat-icon red"><ShieldAlert size={32} /></div>
            <div className="id-stat-info">
              <p>تنبيهات المراقبة</p>
              <h3>{unreadCount > 0 ? unreadCount : "لا يوجد"}</h3>
            </div>
          </div>
        </div>

        <div className="id-actions-grid">
          <div className="id-action-card primary" onClick={onCreateExam}>
            <div className="id-action-icon"><PlusCircle size={40} /></div>
            <div className="id-action-content">
              <h3>إنشاء اختبار جديد</h3>
              <p>توليد كود جلسة مؤمن وتحديد المعاملات الفيزيائية لبدء امتحان للطلاب.</p>
            </div>
          </div>

          <div className="id-action-card secondary" onClick={onViewResults}>
            <div className="id-action-icon"><Activity size={40} /></div>
            <div className="id-action-content">
              <h3>سجل النتائج والتقييم</h3>
              <p>مراجعة درجات الطلاب، التحقق من الإجابات المعملية، ورصد التقييمات النهائية.</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default InstructorDashboard;

