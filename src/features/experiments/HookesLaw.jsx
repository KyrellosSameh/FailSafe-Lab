import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Scale,
  ArrowDown,
  RefreshCw,
  TriangleRight,
  CheckCircle2,
  XCircle,
  Target,
  Ruler,
} from "lucide-react";
import "../../styles/components/HookesLaw.css";

export default function HookesLaw({ examConfig, onSubmitResult }) {
  // --- CORE STATE MANAGEMENT ---
  const [attachedMasses, setAttachedMasses] = useState([]); // Array of masses currently hanging: { id, grams }
  const [dragOverHook, setDragOverHook] = useState(false);  // Visual feedback for drag-and-drop

  // Physics & Spring State
  const [springConstant, setSpringConstant] = useState(20); // The "k" value to be calculated
  const [noiseMultiplier, setNoiseMultiplier] = useState(1); // Real-world measurement error simulator
  const [studentAnswer, setStudentAnswer] = useState("");   // User's calculated result
  const [isEvaluated, setIsEvaluated] = useState(false);    // Whether the answer was checked
  const [isCorrect, setIsCorrect] = useState(null);         // Validation result

  // Exam-specific logic (Manual data logging)
  const [examMasses, setExamMasses] = useState([]);         // Subset of masses for exam mode
  const [examStepResults, setExamStepResults] = useState([]); // Logged (F, x) readings
  const [studentF, setStudentF] = useState("");
  const [studentX, setStudentX] = useState("");
  
  // Graphing phase for exams
  const [graphPhase, setGraphPhase] = useState(false);
  const [graphF1, setGraphF1] = useState("");
  const [graphX1, setGraphX1] = useState("");
  const [graphF2, setGraphF2] = useState("");
  const [graphX2, setGraphX2] = useState("");
  const [studentSlope, setStudentSlope] = useState("");

  // 1-minute submission lock
  const [timeLeft, setTimeLeft] = useState(0);

  useEffect(() => {
    if (!examConfig || !examConfig.startTime) return;

    const calculateTimeLeft = () => {
      const start = new Date(examConfig.startTime).getTime();
      const now = new Date().getTime();
      const diff = now - start;
      const lockMinutes = 1 * 60 * 1000;
      const remaining = Math.max(0, Math.ceil((lockMinutes - diff) / 1000));
      setTimeLeft(remaining);
    };

    calculateTimeLeft();
    const timer = setInterval(calculateTimeLeft, 1000);
    return () => clearInterval(timer);
  }, [examConfig]);

  const canSubmit = !examConfig || timeLeft === 0;

  const generateNewSpring = useCallback(() => {
    if (examConfig) {
      setSpringConstant(examConfig.parameters.hookeSpringConstant);
      const allOptions = [10, 15, 20, 25, 30];
      const colors = ["#f87171", "#fb923c", "#facc15", "#4ade80", "#60a5fa"];
      // Shuffle and pick 4 out of 5
      const shuffled = allOptions.sort(() => Math.random() - 0.5).slice(0, 4);
      const newMasses = shuffled.map((g, i) => ({
        grams: g,
        color: colors[i],
        label: `${g} g`,
      }));
      setExamMasses(newMasses);
    } else {
      // Values typically between 10 and 50
      const newK = Math.floor(Math.random() * 41) + 10;
      setSpringConstant(newK);
      setExamMasses([]);
    }
    setNoiseMultiplier(1 + (Math.random() * 0.06 - 0.03)); // +/- 3% error

    // Reset
    setAttachedMasses([]);
    setStudentAnswer("");
    setIsEvaluated(false);
    setIsCorrect(null);
    setExamStepResults([]);
    setStudentF("");
    setStudentX("");
    setGraphPhase(false);
    setGraphF1("");
    setGraphX1("");
    setGraphF2("");
    setGraphX2("");
    setStudentSlope("");
  }, [examConfig]);

  // Initialize on mount
  useEffect(() => {
    generateNewSpring();
  }, [generateNewSpring, examConfig?.code]);

  useEffect(() => {
    if (examConfig?.examComplete) {
      setIsEvaluated(true);
    }
  }, [examConfig?.examComplete]);

  // Dynamic damping for bouncy springs with small exam masses
  // (keeping original damping = 0.6 from the git version intact in the loop above)

  // Available mass types in the lab tray
  const MASS_TYPES = [
    { grams: 10, color: "#f87171", label: "10 g" },
    { grams: 20, color: "#fb923c", label: "20 g" },
    { grams: 50, color: "#facc15", label: "50 g" },
    { grams: 100, color: "#4ade80", label: "100 g" },
    { grams: 200, color: "#60a5fa", label: "200 g" },
  ];
  
  const activeMasses = examConfig && examMasses.length > 0 ? examMasses : MASS_TYPES;

  const mass = attachedMasses.reduce((sum, m) => sum + m.grams / 1000, 0); // kg
  const [currentVisualDisplacement, setCurrentVisualDisplacement] = useState(0);

  const physicsRef = React.useRef({ y: 0, v: 0, lastTime: 0 });
  const reqRef = React.useRef();

  const g = 9.8; // m/s^2

  // Target Physics
  const theoreticalForce = mass * g; // Newtons
  const theoreticalDisplacement = theoreticalForce / springConstant; // meters
  const force = theoreticalForce;
  const targetDisplacement = theoreticalDisplacement * noiseMultiplier;

  // Live displacement for UI
  const liveDisplacement = currentVisualDisplacement / 1000;
  const readingNoiseCm = Math.sin(currentVisualDisplacement * 0.07) * 0.05;

  const visualTargetDisplacement = targetDisplacement * 1000; // Scaled to pixels for UI
  const baseSpringLength = 80; // Starting length of the spring in pixels

  /**
   * --- REAL-TIME PHYSICS ANIMATION ENGINE ---
   * Uses Euler integration to simulate a damped mass-spring system.
   * This provides the "bouncy" realistic feel when weights are added.
   */
  useEffect(() => {
    const loop = (timestamp) => {
      if (!physicsRef.current.lastTime) physicsRef.current.lastTime = timestamp;
      const dt = Math.min(
        (timestamp - physicsRef.current.lastTime) / 1000,
        0.05,
      );
      physicsRef.current.lastTime = timestamp;

      const state = physicsRef.current;
      const k = springConstant;
      const m = mass || 0.1;
      // Dynamic damping: 25% of critical = visible bouncy oscillation
      const damping = 0.25 * 2 * Math.sqrt(m * k);

      const springForce = -k * (state.y - visualTargetDisplacement);
      const dampingForce = -damping * state.v;
      const acceleration = (springForce + dampingForce) / m;

      // Apply basic Euler updates: v = v + a*dt, y = y + v*dt
      state.v += acceleration * dt;
      state.y += state.v * dt;

      // Update the visual state which triggers the SVG re-draw
      setCurrentVisualDisplacement(state.y);

      if (
        Math.abs(state.v) > 0.5 ||
        Math.abs(state.y - visualTargetDisplacement) > 0.5
      ) {
        reqRef.current = requestAnimationFrame(loop);
      }
    };

    physicsRef.current.lastTime = 0;
    reqRef.current = requestAnimationFrame(loop);

    return () => cancelAnimationFrame(reqRef.current);
  }, [mass, springConstant, visualTargetDisplacement]);

  // --- DYNAMIC SVG SPRING PATH GENERATION ---
  // Calculates 15 Bézier curve loops based on the current length
  const numCoils = 15;
  const totalSpringLength = baseSpringLength + currentVisualDisplacement;
  const coilHeight = (totalSpringLength - 10) / numCoils;
  const coilWidth = 20;

  let springPath = `M 0,0 L 0,10 `;
  for (let i = 0; i < numCoils; i++) {
    const yControl1 = 10 + i * coilHeight + coilHeight / 3;
    const yControl2 = 10 + i * coilHeight + (2 * coilHeight) / 3;
    const yEnd = 10 + (i + 1) * coilHeight;

    if (i % 2 === 0) {
      springPath += `C ${coilWidth},${yControl1} ${coilWidth},${yControl2} 0,${yEnd} `;
    } else {
      springPath += `C -${coilWidth},${yControl1} -${coilWidth},${yControl2} 0,${yEnd} `;
    }
  }
  springPath += `L 0,${totalSpringLength + 20}`;

  const handleEvaluate = (e) => {
    e.preventDefault();
    const parsedAnswer = parseFloat(studentAnswer);
    if (isNaN(parsedAnswer)) return;

    // The student should calculate it as F / x
    // x is the measured visual target displacement roughly
    const effectiveK = force / (visualTargetDisplacement / 1000 || 0.0001); // Avoid div by 0

    // If they get within 5% of either real K or the noise-included K, it's correct.
    const isMatchCalc = Math.abs(parsedAnswer - effectiveK) / effectiveK < 0.05;
    const isMatchReal =
      Math.abs(parsedAnswer - springConstant) / springConstant < 0.05;

    setIsCorrect(isMatchCalc || isMatchReal);
    setIsEvaluated(true);

    if (examConfig && onSubmitResult) {
      onSubmitResult(parsedAnswer, springConstant);
    }
  };

  return (
    <div className="glass-panel p-6 w-full max-w-7xl animate-fade-in hookes-law-container">
      <div className="hookes-law-header">
        <div>
          <h2 className="hookes-law-title">
            Hooke's Law
          </h2>
          <p className="hookes-law-subtitle">
            Investigate the elasticity and calculate the unknown spring
            constant.
          </p>
        </div>
        {!examConfig && (
          <div className="hookes-law-formula">
            <span>
              k = F / x
            </span>
          </div>
        )}
      </div>

      <div className="responsive-grid hookes-law-grid">
        {/* Simulation Area */}
        <div className="glass-panel hookes-law-sim-area">
          {/* Top Support */}
          <div className="hookes-law-top-support"></div>

          {/* Ruler */}
          <div className="hookes-law-ruler">
            {Array.from({ length: 51 }, (_, cm) => {
              const val = cm / 100;
              const isLarge = cm % 10 === 0;
              const isMed = cm % 5 === 0 && !isLarge;
              return (
                <div
                  key={cm}
                  style={{
                    position: "absolute",
                    top: `${val * 1000 + baseSpringLength + 10}px`,
                    right: 0,
                    width: isLarge ? "30px" : isMed ? "20px" : "10px",
                    height: isLarge ? "2px" : "1px",
                    background: isLarge
                      ? "#fbbf24"
                      : isMed
                        ? "rgba(251,191,36,0.6)"
                        : "rgba(251,191,36,0.25)",
                    display: "flex",
                    alignItems: "center",
                  }}
                >
                  {isLarge && (
                    <span
                      style={{
                        position: "absolute",
                        right: "34px",
                        fontSize: "0.7rem",
                        color: "#fbbf24",
                        fontWeight: "bold",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {cm} cm
                    </span>
                  )}
                  {isMed && (
                    <span
                      style={{
                        position: "absolute",
                        right: "24px",
                        fontSize: "0.6rem",
                        color: "rgba(251,191,36,0.7)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {cm}
                    </span>
                  )}
                </div>
              );
            })}
            {liveDisplacement > 0.005 && (
              <div
                style={{
                  position: "absolute",
                  top: `${liveDisplacement * 1000 + baseSpringLength + 10}px`,
                  right: "-4px",
                  width: "8px",
                  height: "8px",
                  background: "#f59e0b",
                  borderRadius: "50%",
                  border: "1px solid white",
                  transform: "translateY(-50%)",
                  zIndex: 20,
                  boxShadow: "0 0 6px #f59e0b",
                }}
              />
            )}
            <div
              style={{
                position: "absolute",
                top: `${baseSpringLength + 10}px`,
                left: "0",
                width: "300px",
                height: "1px",
                borderTop: "1px dashed rgba(59, 130, 246, 0.7)",
                zIndex: 1,
              }}
            >
              <span
                style={{
                  position: "absolute",
                  left: "60px",
                  top: "-18px",
                  color: "var(--primary)",
                  fontSize: "0.75rem",
                  whiteSpace: "nowrap",
                  fontWeight: "bold",
                }}
              >
                x = 0
              </span>
            </div>
          </div>

          {/* Spring Matrix */}
          <div className="hookes-law-spring-matrix">
            <svg
              width="100"
              height={totalSpringLength + 20}
              style={{ overflow: "visible" }}
            >
              <path
                d={springPath}
                fill="none"
                stroke="#cbd5e1"
                strokeWidth={4 + springConstant / 10}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d={springPath}
                fill="none"
                stroke="#ffffff"
                strokeWidth={(4 + springConstant / 10) / 3}
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ opacity: 0.5 }}
              />
            </svg>

            {mass > 0 && (
              <div
                style={{
                  width: `${50 + mass * 30}px`,
                  height: `${50 + mass * 30}px`,
                  background:
                    "radial-gradient(circle at 35% 35%, #a1a1aa, #3f3f46)",
                  borderRadius: "50%",
                  boxShadow:
                    "0 10px 20px -3px rgba(0, 0, 0, 0.6), inset 0 2px 4px rgba(255,255,255,0.25)",
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  color: "white",
                  fontWeight: "bold",
                  fontSize: "0.8rem",
                  marginTop: "-5px",
                }}
              >
                {mass.toFixed(2)} kg
              </div>
            )}

            {liveDisplacement > 0.003 && (
              <div
                style={{
                  position: "absolute",
                  left: "-70px",
                  top: `${baseSpringLength + 10}px`,
                  height: `${Math.max(0, currentVisualDisplacement)}px`,
                  display: "flex",
                  alignItems: "center",
                }}
              >
                <div
                  style={{
                    position: "relative",
                    height: "100%",
                    width: "2px",
                    background: "#f59e0b",
                  }}
                >
                  <div
                    style={{
                      position: "absolute",
                      top: 0,
                      left: "-4px",
                      width: "10px",
                      height: "2px",
                      background: "#f59e0b",
                    }}
                  ></div>
                  <div
                    style={{
                      position: "absolute",
                      bottom: 0,
                      left: "-4px",
                      width: "10px",
                      height: "2px",
                      background: "#f59e0b",
                    }}
                  ></div>
                  <ArrowDown
                    size={14}
                    color="#f59e0b"
                    style={{
                      position: "absolute",
                      top: "50%",
                      left: "-6px",
                      transform: "translateY(-50%)",
                    }}
                  />
                  <span
                    style={{
                      position: "absolute",
                      top: "50%",
                      right: "14px",
                      transform: "translateY(-50%)",
                      color: "#f59e0b",
                      fontSize: "0.75rem",
                      whiteSpace: "nowrap",
                    }}
                  >
                    x ={" "}
                    {Math.max(
                      0,
                      liveDisplacement * 100 + readingNoiseCm,
                    ).toFixed(1)}{" "}
                    cm
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Modules */}
        <div className="hookes-law-right-panel">
          {/* Mass Tray */}
          <div className="glass-panel hookes-law-module">
            <h3 className="hookes-law-module-title">
              <Scale size={18} color="var(--primary)" /> Mass Tray
            </h3>
            <p className="hookes-law-module-subtitle">
              Drag a mass and drop it on the spring hook
            </p>

            <div className="mass-button-container">
              {activeMasses.map((mt) => (
                <div
                  key={mt.grams}
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData("grams", mt.grams)}
                  style={{
                    width: `${32 + mt.grams * 0.18}px`,
                    height: `${28 + mt.grams * 0.12}px`,
                    background: `radial-gradient(circle at 35% 30%, ${mt.color}cc, ${mt.color}66)`,
                    border: `2px solid ${mt.color}`,
                    borderRadius: "6px",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "grab",
                    fontSize: "0.65rem",
                    fontWeight: "bold",
                    color: "white",
                    userSelect: "none",
                    boxShadow: `0 4px 8px rgba(0,0,0,0.4), inset 0 1px 2px rgba(255,255,255,0.2)`,
                    transition: "transform 0.1s",
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.transform =
                      "translateY(-3px) scale(1.05)")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.transform = "translateY(0) scale(1)")
                  }
                >
                  {mt.label}
                </div>
              ))}
            </div>

            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOverHook(true);
              }}
              onDragLeave={() => setDragOverHook(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOverHook(false);
                const grams = parseInt(e.dataTransfer.getData("grams"));
                const total =
                  attachedMasses.reduce((s, m) => s + m.grams, 0) + grams;
                if (total <= 500)
                  setAttachedMasses((prev) => [
                    ...prev,
                    { id: Date.now(), grams },
                  ]);
              }}
              style={{
                border: `2px dashed ${dragOverHook ? "#60a5fa" : "rgba(255,255,255,0.2)"}`,
                borderRadius: "10px",
                padding: "12px",
                minHeight: "60px",
                background: dragOverHook
                  ? "rgba(96,165,250,0.1)"
                  : "transparent",
                transition: "all 0.2s",
                display: "flex",
                flexWrap: "wrap",
                gap: "6px",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {attachedMasses.length === 0 ? (
                <span
                  style={{ color: "rgba(255,255,255,0.3)", fontSize: "0.8rem" }}
                >
                  ↓ Drop masses here to hang
                </span>
              ) : (
                attachedMasses.map((m) => {
                  const mt = activeMasses.find((t) => t.grams === m.grams);
                  return (
                    <div
                      key={m.id}
                      onClick={() =>
                        setAttachedMasses((prev) =>
                          prev.filter((x) => x.id !== m.id),
                        )
                      }
                      title="Click to remove"
                      style={{
                        padding: "3px 10px",
                        background: `${mt?.color}33`,
                        border: `1px solid ${mt?.color}`,
                        borderRadius: "20px",
                        color: mt?.color,
                        fontSize: "0.72rem",
                        fontWeight: "bold",
                        cursor: "pointer",
                      }}
                    >
                      {m.grams}g ✕
                    </div>
                  );
                })
              )}
            </div>
            {attachedMasses.length > 0 && (
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginTop: "8px",
                  alignItems: "center",
                }}
              >
                <span
                  style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}
                >
                  Total:{" "}
                  <strong style={{ color: "white" }}>
                    {(mass * 1000).toFixed(0)} g
                  </strong>
                </span>
                <button
                  onClick={() => setAttachedMasses([])}
                  style={{
                    background: "rgba(239,68,68,0.15)",
                    border: "1px solid #ef4444",
                    color: "#ef4444",
                    borderRadius: "6px",
                    padding: "3px 10px",
                    cursor: "pointer",
                    fontSize: "0.72rem",
                  }}
                >
                  Clear all
                </button>
              </div>
            )}
          </div>

          {/* Live Data */}
          {!examConfig && (
            <div
              className="glass-panel"
              style={{
                padding: "20px",
                background: "rgba(16, 185, 129, 0.05)",
                border: "1px solid rgba(16, 185, 129, 0.2)",
              }}
            >
              <h3
                style={{
                  marginBottom: "14px",
                  fontSize: "1rem",
                  color: "#10b981",
                }}
              >
                Live Reading
              </h3>
              <div className="live-reading-grid">
                <div className="live-reading-item">
                  <span className="live-reading-label">
                    Weight (F = m×g):
                  </span>
                  <span className="live-reading-value force">
                    {force.toFixed(3)} N
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", paddingTop: "8px" }}>
                  <span className="live-reading-label">
                    Displacement (x):
                  </span>
                  <span className="live-reading-value disp">
                    {(liveDisplacement * 100).toFixed(1)} cm
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Evaluation Block */}
          <div
            className="glass-panel"
            style={{
              padding: "24px",
              display: "flex",
              flexDirection: "column",
              background: "rgba(15, 23, 42, 0.9)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                marginBottom: "24px",
              }}
            >
              <div
                style={{
                  padding: "8px",
                  background: "#f59e0b33",
                  borderRadius: "50%",
                  color: "#f59e0b",
                }}
              >
                <TriangleRight size={20} />
              </div>
              <h3 style={{ margin: 0 }}>Unknown Spring (k)</h3>
            </div>

            <div
              style={{
                padding: "24px",
                background: "rgba(0,0,0,0.2)",
                borderRadius: "12px",
                marginBottom: "24px",
                textAlign: "center",
              }}
            >
              <div
                style={{
                  fontSize: "2.5rem",
                  fontWeight: 700,
                  color: isEvaluated
                    ? examConfig
                      ? "#3b82f6"
                      : isCorrect
                        ? "#10b981"
                        : "#ef4444"
                    : "#f59e0b",
                }}
              >
                {isEvaluated
                  ? examConfig
                    ? "*** N/m"
                    : `${springConstant} N/m`
                  : "? N/m"}
              </div>
              {isEvaluated && !examConfig && (
                <div
                  style={{
                    fontSize: "0.9rem",
                    color: "var(--text-muted)",
                    marginTop: "8px",
                  }}
                >
                  Target Value
                </div>
              )}
            </div>

          {examConfig && (
            <div style={{ marginBottom: "20px", display: "grid", gridTemplateColumns: "1fr", gap: "8px" }}>
               {examStepResults.length > 0 && <h4 style={{ margin: "0 0 8px 0", color: "var(--primary)" }}>النقاط المسجلة ({examStepResults.length}/4)</h4>}
               {examStepResults.map((res, idx) => (
                  <div key={idx} style={{
                     padding: "8px 12px",
                     background: "rgba(0,0,0,0.2)",
                     borderRadius: "8px",
                     border: "1px solid #10b981",
                     display: "flex", justifyContent: "space-between", alignItems: "center"
                  }}>
                     <span style={{color: "var(--text-muted)", fontSize: "0.85rem"}}>إضافة {idx + 1}:</span>
                     <span style={{fontWeight: "bold", color: "#fff", flex: 1, textAlign: "center"}}>
                        F: {res.f} N | x: {res.x} m
                     </span>
                     {!isEvaluated && (
                        <button
                           type="button"
                           onClick={() => {
                              const newResults = examStepResults.filter((_, i) => i !== idx);
                              setExamStepResults(newResults);
                              if (newResults.length < 4) setGraphPhase(false);
                           }}
                           style={{
                              background: "rgba(239, 68, 68, 0.2)",
                              border: "none",
                              color: "#ef4444",
                              borderRadius: "4px",
                              padding: "2px 8px",
                              cursor: "pointer",
                              fontSize: "0.8rem",
                              fontWeight: "bold"
                           }}
                        >
                           ✕
                        </button>
                     )}
                  </div>
               ))}
            </div>
          )}

            <div
              style={{
                background: "rgba(255,255,255,0.03)",
                padding: "20px",
                borderRadius: "12px",
                border: "1px solid var(--border-color)",
              }}
            >
              <h4
                style={{
                  marginBottom: "16px",
                  color: "var(--text-main)",
                  fontSize: "1.05rem",
                  display: "flex",
                  justifyContent: "space-between",
                }}
              >
                <span>{examConfig && graphPhase ? "حساب ثابت الزنبرك من الرسم" : (examConfig ? "سجل القراءات بيدك" : "Calculate k")}</span>
              </h4>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (examConfig) {
                     if (graphPhase) {
                        const slope = parseFloat(studentSlope);
                        if (isNaN(slope) || !graphF1 || !graphX1 || !graphF2 || !graphX2) return;
                        
                        setIsEvaluated(true);
                        const pointsStr = examStepResults.map((res, i) => `P${i+1}(F:${res.f}, x:${res.x})`).join(" | ");
                        const graphStr = `Graph P1(F:${graphF1}, x:${graphX1}) | Graph P2(F:${graphF2}, x:${graphX2})`;
                        const resultsStr = `${pointsStr} | ${graphStr} | Slope(k): ${slope}N/m`;
                        onSubmitResult(resultsStr, springConstant);
                     } else {
                        const f = studentF.trim();
                        const x = studentX.trim();
                        if (!f || !x) return;
                        
                        const newResults = [...examStepResults, { f, x }];
                        setExamStepResults(newResults);
                        
                        setStudentF("");
                        setStudentX("");
                        
                        if (newResults.length === 4) {
                           setGraphPhase(true);
                        }
                     }
                  } else {
                     handleEvaluate(e);
                  }
                }}
                style={{ display: "flex", gap: "12px", alignItems: "stretch", flexDirection: "column" }}
              >
                {!graphPhase ? (
                  <>
                    {examConfig && (
                      <div className="exam-input-group">
                        <input
                          type="text"
                          placeholder="القوة (F)"
                          value={studentF}
                          onChange={(e) => setStudentF(e.target.value)}
                          disabled={isEvaluated || examStepResults.length >= 4}
                          className="exam-input"
                        />
                        <input
                          type="text"
                          placeholder="الازاحة (x)"
                          value={studentX}
                          onChange={(e) => setStudentX(e.target.value)}
                          disabled={isEvaluated || examStepResults.length >= 4}
                          className="exam-input"
                        />
                      </div>
                    )}
                    {!examConfig && (
                      <div style={{ position: "relative", width: "100%" }}>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="Result..."
                          value={studentAnswer}
                          onChange={(e) => setStudentAnswer(e.target.value)}
                          disabled={isEvaluated || mass === 0}
                          style={{
                            width: "100%", padding: "12px 16px", paddingRight: "46px", background: "rgba(0,0,0,0.2)",
                            border: "1px solid var(--glass-border)", borderRadius: "8px", color: "#fff",
                            fontSize: "1rem", outline: "none", transition: "all 0.2s",
                            borderColor: isEvaluated ? (isCorrect ? "#10b981" : "#ef4444") : "var(--glass-border)",
                            opacity: mass === 0 && !isEvaluated ? 0.5 : 1,
                          }}
                        />
                        <span style={{ position: "absolute", right: "16px", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }}>N/m</span>
                      </div>
                    )}
                  </>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "12px", width: "100%" }}>
                    <div style={{color: "#3b82f6", fontWeight: "bold", fontSize: "0.95rem", lineHeight: "1.5", textAlign: "right"}}>
                      قم برسم علاقة بيانية بين القوة المحسوبة (F) والازاحة (x)، واستخرج نقطتين جديدتين من الخط المستقيم، ثم احسب الميل الذي يمثل الثابت (k).
                    </div>
                    <div className="exam-input-group">
                      <input type="text" placeholder="F1 (نقطة 1)" value={graphF1} onChange={(e)=>setGraphF1(e.target.value)} disabled={isEvaluated} className="exam-input" />
                      <input type="text" placeholder="x1 (نقطة 1)" value={graphX1} onChange={(e)=>setGraphX1(e.target.value)} disabled={isEvaluated} className="exam-input" />
                    </div>
                    <div className="exam-input-group">
                      <input type="text" placeholder="F2 (نقطة 2)" value={graphF2} onChange={(e)=>setGraphF2(e.target.value)} disabled={isEvaluated} className="exam-input" />
                      <input type="text" placeholder="x2 (نقطة 2)" value={graphX2} onChange={(e)=>setGraphX2(e.target.value)} disabled={isEvaluated} className="exam-input" />
                    </div>
                    <div style={{ position: "relative", width: "100%" }}>
                      <input type="number" step="0.01" min="0" placeholder="قيمة الثابت المحسوبة (N/m)..." value={studentSlope} onChange={(e)=>setStudentSlope(e.target.value)} disabled={isEvaluated} style={{ width: "100%", padding: "12px 16px", paddingRight: "40px", background: "rgba(0,0,0,0.2)", border: "1px solid #3b82f6", borderRadius: "8px", color: "#fff", fontSize: "1rem", outline: "none", borderColor: isEvaluated ? "#10b981" : "#3b82f6" }} />
                      <span style={{ position: "absolute", right: "16px", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }}>N/m</span>
                    </div>
                  </div>
                )}

                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "8px" }}>
                {!isEvaluated ? (
                  <button
                    type="submit"
                    disabled={graphPhase ? (!studentSlope.trim() || !graphF1.trim() || !graphX1.trim() || !graphF2.trim() || !graphX2.trim()) : (examConfig ? (!studentF.trim() || !studentX.trim()) : (!studentAnswer.trim() || mass === 0))}
                    style={{
                      background: "var(--primary)", color: "#fff", border: "none",
                      borderRadius: "8px", padding: "10px 24px", fontWeight: 600,
                      cursor: (graphPhase ? (studentSlope.trim() && graphF1.trim() && graphX1.trim() && graphF2.trim() && graphX2.trim()) : (examConfig ? (studentF.trim() && studentX.trim()) : (studentAnswer.trim() && mass > 0))) ? "pointer" : "not-allowed",
                      opacity: (graphPhase ? (studentSlope.trim() && graphF1.trim() && graphX1.trim() && graphF2.trim() && graphX2.trim()) : (examConfig ? (studentF.trim() && studentX.trim()) : (studentAnswer.trim() && mass > 0))) ? 1 : 0.6,
                    }}
                  >
                    {examConfig ? (graphPhase ? "إرسال النتيجة" : "تسجيل القراءة") : "Check"}
                  </button>
                ) : (
                  !examConfig && (
                    <button type="button" onClick={generateNewSpring} style={{ background: "transparent", border: "1px solid var(--primary)", color: "var(--primary)", borderRadius: "8px", padding: "10px 24px", display: "flex", alignItems: "center", gap: "8px" }}>
                      <RefreshCw size={18} /> Retry
                    </button>
                  )
                )}
                </div>
              </form>

              {isEvaluated && (
                <div
                  style={{
                    marginTop: "16px",
                    padding: "12px",
                    borderRadius: "8px",
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    background: examConfig
                      ? "rgba(59, 130, 246, 0.1)"
                      : isCorrect
                        ? "rgba(16, 185, 129, 0.1)"
                        : "rgba(239, 68, 68, 0.1)",
                    border: `1px solid ${examConfig ? "rgba(59, 130, 246, 0.3)" : isCorrect ? "rgba(16, 185, 129, 0.3)" : "rgba(239, 68, 68, 0.3)"}`,
                  }}
                >
                  {examConfig ? (
                    <CheckCircle2
                      size={24}
                      color="#3b82f6"
                      style={{ flexShrink: 0 }}
                    />
                  ) : isCorrect ? (
                    <CheckCircle2
                      size={24}
                      color="#10b981"
                      style={{ flexShrink: 0 }}
                    />
                  ) : (
                    <XCircle
                      size={24}
                      color="#ef4444"
                      style={{ flexShrink: 0 }}
                    />
                  )}
                  <div>
                    <div
                      style={{
                        fontWeight: 600,
                        color: examConfig
                          ? "#3b82f6"
                          : isCorrect
                            ? "#10b981"
                            : "#ef4444",
                      }}
                    >
                      {examConfig
                        ? "شكراً لك، لقت تم تسجيل إجابتك بنجاح"
                        : isCorrect
                          ? "Correct! Excellent job."
                          : "Incorrect."}
                    </div>
                    {!examConfig && !isCorrect && (
                      <div
                        style={{
                          fontSize: "0.85rem",
                          color: "var(--text-muted)",
                          marginTop: "4px",
                        }}
                      >
                        Make sure your distance (x) is in meters, and you
                        calculate k = F / x.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
