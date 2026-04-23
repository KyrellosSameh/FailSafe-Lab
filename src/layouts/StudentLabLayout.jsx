import React from "react";
import { useNavigate } from "react-router-dom";
import { ShieldCheck, LogOut, Activity, Atom, Scale, TestTube } from "lucide-react";

import OhmsLaw from "../features/experiments/OhmsLaw";
import WheatstoneBridge from "../features/experiments/WheatstoneBridge";
import HookesLaw from "../features/experiments/HookesLaw";
import Viscosity from "../features/experiments/Viscosity";
import CameraProctor from "../features/proctoring/CameraProctor";

export const EXPERIMENT_NAV_ITEMS = [
  { id: "ohm", label: "Ohm's Law", icon: <Activity size={20} /> },
  { id: "wheatstone", label: "Wheatstone", icon: <Atom size={20} /> },
  { id: "hooke", label: "Hooke's Law", icon: <Scale size={20} /> },
  { id: "viscosity", label: "Viscosity", icon: <TestTube size={20} /> },
];

export default function StudentLabLayout({
  isExamMode = false,
  activeTab,
  setActiveTab,
  examConfig,
  setExamConfig,
  timeLeft,
  showWarning,
  handleExamSubmit,
}) {
  const navigate = useNavigate();

  return (
    <div className="app-container">
      {/* Sidebar Navigation */}
      <aside className="sidebar">
        <div
          className="sidebar-header"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            marginBottom: "40px",
          }}
        >
          <div
            style={{
              padding: "8px",
              background: "var(--primary)",
              borderRadius: "8px",
              color: "white",
            }}
          >
            <ShieldCheck size={24} />
          </div>
          <div>
            <h1 style={{ fontSize: "1.2rem", lineHeight: "1.2" }}>
              FailSafe Lab
            </h1>
            <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
              Virtual Simulator
            </span>
          </div>
        </div>

        <nav
          className="sidebar-nav"
          style={{ display: "flex", flexDirection: "column", gap: "8px" }}
        >
          {EXPERIMENT_NAV_ITEMS.filter(
            (item) => !examConfig || item.id === examConfig.experiment,
          ).map((item) => {
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                style={{
                  display: "flex",
                  alignContent: "center",
                  alignItems: "center",
                  gap: "12px",
                  width: "100%",
                  textAlign: "left",
                  border: "none",
                  background:
                    activeTab === item.id ? "var(--primary)" : "transparent",
                  color: activeTab === item.id ? "#fff" : "var(--text-muted)",
                  boxShadow:
                    activeTab === item.id ? "var(--glow-shadow)" : "none",
                  cursor: "pointer",
                }}
              >
                {item.icon}
                {item.label}
              </button>
            );
          })}
        </nav>

        <div
          className="sidebar-footer"
          style={{
            marginTop: "auto",
            paddingTop: "20px",
            borderTop: "1px solid var(--border-color)",
          }}
        >
          <button
            onClick={() => {
              if (examConfig && !examConfig.examComplete) {
                if (
                  window.confirm(
                    "تحذير هام: هل أنت متأكد من رغبتك في إنهاء الامتحان والانسحاب؟\nسيتم إرسال إشعار للاستاذ بانسحابك ولن تتمكن من العودة للاختبار نهائياً."
                  )
                ) {
                  handleExamSubmit("--quit--", "N/A");
                }
                return;
              }
              setExamConfig(null);
              navigate("/");
            }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              width: "100%",
              background: "transparent",
              border: "none",
              color:
                examConfig && !examConfig.examComplete
                  ? "#ef4444"
                  : "var(--text-muted)",
              cursor: "pointer",
            }}
          >
            <LogOut size={20} />
            <span className="settings-text" style={{fontWeight: examConfig && !examConfig.examComplete ? "bold" : "normal"}}>
              {examConfig && !examConfig.examComplete
                ? "انسحاب من الامتحان"
                : "Exit Lab"}
            </span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="main-content">
        <header
          style={{
            padding: "24px 32px",
            borderBottom: "1px solid var(--border-color)",
            background: "var(--glass-bg)",
            backdropFilter: "blur(10px)",
            WebkitBackdropFilter: "blur(10px)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <h2 style={{ fontSize: "1.5rem", fontWeight: 500 }}>
            {EXPERIMENT_NAV_ITEMS.find((n) => n.id === activeTab)?.label}{" "}
            Experiment
          </h2>

          {examConfig && examConfig.studentName && (
            <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
              <div
                style={{
                  background: "rgba(255,255,255,0.05)",
                  padding: "8px 16px",
                  borderRadius: "8px",
                  border: "1px solid var(--border-color)",
                }}
              >
                <span
                  style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}
                >
                  Name:
                </span>{" "}
                <span style={{ fontWeight: 600, marginLeft: "6px" }}>
                  {examConfig.studentName}
                </span>
                <span
                  style={{ margin: "0 10px", color: "var(--border-color)" }}
                >
                  |
                </span>
                <span
                  style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}
                >
                  ID:
                </span>{" "}
                <span style={{ fontFamily: "monospace", marginLeft: "6px" }}>
                  {examConfig.studentId}
                </span>
              </div>

              {!examConfig.examComplete && timeLeft !== null && (
                <div
                  style={{
                    padding: "8px 16px",
                    borderRadius: "8px",
                    fontWeight: "bold",
                    letterSpacing: "1px",
                    background: showWarning
                      ? "rgba(239, 68, 68, 0.2)"
                      : "rgba(59, 130, 246, 0.1)",
                    color: showWarning ? "#ef4444" : "#3b82f6",
                    border: `1px solid ${showWarning ? "#ef4444" : "#3b82f6"}`,
                    animation: showWarning ? "pulse 2s infinite" : "none",
                  }}
                >
                  {Math.floor(timeLeft / 60000)
                    .toString()
                    .padStart(2, "0")}
                  :
                  {Math.floor((timeLeft % 60000) / 1000)
                    .toString()
                    .padStart(2, "0")}
                </div>
              )}

              {examConfig.examComplete && (
                <div
                  style={{
                    padding: "8px 16px",
                    borderRadius: "8px",
                    background: "rgba(16, 185, 129, 0.1)",
                    color: "#10b981",
                    border: "1px solid #10b981",
                  }}
                >
                  Exam Finished
                </div>
              )}
            </div>
          )}
        </header>

        <div className="experiment-area">
          {(!activeTab || activeTab.trim().toLowerCase() === "ohm") && (
            <OhmsLaw
              examConfig={examConfig}
              onSubmitResult={handleExamSubmit}
            />
          )}
          {activeTab?.trim().toLowerCase() === "wheatstone" && (
            <WheatstoneBridge
              examConfig={examConfig}
              onSubmitResult={handleExamSubmit}
            />
          )}
          {activeTab?.trim().toLowerCase() === "hooke" && (
            <HookesLaw
              examConfig={examConfig}
              onSubmitResult={handleExamSubmit}
            />
          )}
          {activeTab?.trim().toLowerCase() === "viscosity" && (
            <Viscosity
              examConfig={examConfig}
              onSubmitResult={handleExamSubmit}
            />
          )}
        </div>

        {isExamMode && examConfig && (
          <CameraProctor
            examConfig={examConfig}
            onKickStudent={() => handleExamSubmit("--kicked--", "N/A")}
          />
        )}
      </main>
    </div>
  );
}
