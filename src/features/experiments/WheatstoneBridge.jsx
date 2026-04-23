import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  RefreshCw,
  Activity,
  CheckCircle2,
  XCircle,
  TriangleRight,
} from "lucide-react";
import "../../styles/components/WheatstoneBridge.css";

const STANDARD_RESISTORS = [
  10, 22, 33, 47, 56, 68, 100, 150, 220, 330, 470, 560, 680, 1000,
];

export default function WheatstoneBridge({ examConfig, onSubmitResult }) {
  // --- WHEATSTONE BRIDGE LOGIC ---
  // Formula: Rx = R * (L / (100 - L))
  // The goal is to reach the "null point" (zero galvanometer deflection).
  const [knownR, setKnownR] = useState(100);
  const [rx, setRx] = useState(150); // Unknown resistor
  const [jockeyL, setJockeyL] = useState(50); // Position in cm (0 to 100)
  const [voltage] = useState(12);
  const jockeySliderRef = useRef(null);

  // Evaluation states
  const [studentAnswer, setStudentAnswer] = useState("");
  const [isEvaluated, setIsEvaluated] = useState(false);
  const [isCorrect, setIsCorrect] = useState(null);
  
  // Exam-specific states
  const [examFixedResistors, setExamFixedResistors] = useState([]);
  const [examStepResults, setExamStepResults] = useState({});
  const [studentAverage, setStudentAverage] = useState("");
  const [showAveragePhase, setShowAveragePhase] = useState(false);

  const [tKnown, setTKnown] = useState(1);
  const [wireTotalR, setWireTotalR] = useState(10);
  const [tNoise, setTNoise] = useState(1);

  // 5-minute submission lock
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

  const generateNewRx = useCallback(() => {
    if (examConfig) {
      setRx(examConfig.parameters.wheatstoneUnknown);
      const shuffled = [...STANDARD_RESISTORS].sort(() => 0.5 - Math.random());
      const selected = shuffled.slice(0, 4).sort((a,b) => a - b);
      setExamFixedResistors(selected);
      setKnownR(selected[0]);
    } else {
      const randomValue = Math.floor(Math.random() * 90 + 10) * 10; // 100 to 1000 in steps of 10
      setRx(randomValue);
      setKnownR(100);
      setExamFixedResistors([]);
    }

    // Reset evaluation
    setStudentAnswer("");
    setIsEvaluated(false);
    setIsCorrect(null);
    setExamStepResults({});
    setShowAveragePhase(false);
    setStudentAverage("");

    // Regenerate precision variations
    setTKnown(1 + (Math.random() * 0.02 - 0.01));
    setWireTotalR(10 + (Math.random() * 0.5 - 0.25));
    setTNoise(1 + (Math.random() * 0.02 - 0.01));
  }, [examConfig]);

  // Initialize on mount
  useEffect(() => {
    generateNewRx();
  }, [generateNewRx, examConfig?.code]);

  useEffect(() => {
    if (examConfig?.examComplete) {
      setIsEvaluated(true);
    }
  }, [examConfig?.examComplete]);

  useEffect(() => {
    const el = jockeySliderRef.current;
    if (!el) return;
    const handler = (e) => {
      e.preventDefault();
      setJockeyL((v) =>
        Math.min(
          99,
          Math.max(1, parseFloat((v + (e.deltaY < 0 ? 0.1 : -0.1)).toFixed(1))),
        ),
      );
    };
    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, []);

  const actualKnownR = knownR * tKnown;
  // For vUpper, Left=V, Right=0. Left is Rx, Right is KnownR.
  const vUpper = (voltage * actualKnownR) / (rx + actualKnownR);

  const actualWireL1 = wireTotalR * (jockeyL / 100);
  const actualWireL2 = wireTotalR * ((100 - jockeyL) / 100);
  const vLower = (voltage * actualWireL2) / (actualWireL1 + actualWireL2);

  const galvanometerV = vUpper - vLower;

  // Noise to jitter the reading slightly
  const displayV = galvanometerV + (Math.random() * 0.002 - 0.001) * tNoise;
  const isBalanced = Math.abs(displayV) < 0.05;

  // Calculation limit: +/- 12V rotation scaled to +/- 45deg
  const needleRotation = Math.max(-45, Math.min(45, (galvanometerV / 2) * 45));

  const handleEvaluate = (e) => {
    e.preventDefault();
    const parsedAnswer = parseFloat(studentAnswer);
    if (isNaN(parsedAnswer)) return;

    // Determine if they were roughly balanced somewhere logic
    // Rx = R * L / (100 - L)
    const studentCalcIdeal = knownR * (jockeyL / (100 - jockeyL || 1));

    // We will accept if they just calculated their current slider state OR the true rx
    const isMatchCalc =
      Math.abs(parsedAnswer - studentCalcIdeal) / studentCalcIdeal < 0.05;
    const isMatchReal = Math.abs(parsedAnswer - rx) / rx < 0.05;

    // If it's not well-balanced, matching 'calc' shouldn't be 'correct',
    // so we check if the bridge is somewhat balanced OR if they got the real answer.
    const isAnswerCorrect = (isMatchCalc && isBalanced) || isMatchReal;

    setIsCorrect(isAnswerCorrect);
    setIsEvaluated(true);

    if (examConfig && onSubmitResult) {
      onSubmitResult(parsedAnswer, rx);
    }
  };

  return (
    <div className="glass-panel wheatstone-container animate-fade-in">
      <div className="wheatstone-header">
        <div>
          <h2 className="wheatstone-title">
            Meter Bridge (Wheatstone)
          </h2>
          <p style={{ color: "var(--text-muted)" }}>
            Balance the bridge by sliding the jockey, then calculate the unknown
            resistance R<sub>x</sub>.
          </p>
        </div>
        {!examConfig && (
          <div className="wheatstone-formula">
            <span>
              R<sub style={{ fontSize: "0.8rem" }}>x</sub> = R × (L / (100 - L))
            </span>
          </div>
        )}
      </div>

      <div className="wheatstone-grid">
        {/* Left Side: Circuit and Meter Bridge */}
        <div className="wheatstone-left-side">
          {/* Circuit Schematic Area */}
          <div className="glass-panel wheatstone-circuit-panel">
            {/* Schema Visualizer */}
            <div className="wheatstone-schema-wrapper">
              {/* Galvanometer */}
              <div className="wheatstone-galvanometer">
                {/* Dial background */}
                <div className="wheatstone-galv-dial"></div>
                {/* Pivot point */}
                <div className="wheatstone-galv-pivot"></div>
                {/* Needle */}
                <div
                  className="wheatstone-galv-needle"
                  style={{ transform: `rotate(${needleRotation}deg)` }}
                ></div>
                {/* Scale marks */}
                <div className="wheatstone-galv-zero">
                  0
                </div>
                <div
                  className={`wheatstone-galv-reading ${isBalanced ? "balanced" : "unbalanced"}`}
                >
                  {displayV.toFixed(3)} A
                </div>
              </div>

              {/* Resistor Gaps Row */}
              <div className="wheatstone-gaps-row">
                {/* Left Gap */}
                <div className="wheatstone-gap wheatstone-gap-left">
                  <div className="wheatstone-gap-label">
                    Unknown R<sub>x</sub>
                  </div>
                  <div style={{ fontWeight: "bold" }}>Left Gap</div>
                </div>

                {/* Known R */}
                <div className="wheatstone-gap wheatstone-gap-right">
                  <div className="wheatstone-gap-label">
                    Known R
                  </div>
                  <div style={{ fontWeight: "bold" }}>{knownR} Ω</div>
                </div>
              </div>
            </div>

            {/* Meter Bridge Wire */}
            <div className="wheatstone-slider-wrapper">
              <div className="wheatstone-slider-labels">
                <span>0 cm</span>
                <span>100 cm</span>
              </div>
              <input
                ref={jockeySliderRef}
                type="range"
                min="1"
                max="99"
                step="0.1"
                value={jockeyL}
                onChange={(e) => setJockeyL(parseFloat(e.target.value))}
                style={{
                  width: "100%",
                  accentColor: "var(--primary)",
                  cursor: "pointer",
                  height: "6px",
                }}
              />
              <div className="wheatstone-slider-value">
                L = {jockeyL.toFixed(1)} cm
              </div>
            </div>
          </div>

          {/* Known R Control */}
          <div className="glass-panel wheatstone-panel">
            <div className="wheatstone-panel-header">
              <div className="wheatstone-icon-green">
                <Activity size={20} />
              </div>
              <h3 style={{ margin: 0 }}>Resistance Box (Known R)</h3>
            </div>

            <div className="device-display green wheatstone-meters">
              {knownR} Ω
            </div>

            <select
              value={knownR}
              onChange={(e) => setKnownR(parseInt(e.target.value))}
              disabled={showAveragePhase || isEvaluated}
              className="wheatstone-select"
            >
              {(examConfig && examFixedResistors.length > 0 ? examFixedResistors : STANDARD_RESISTORS).map((r) => (
                <option key={r} value={r}>
                  {r} Ω {examConfig && examStepResults[r] !== undefined ? "✓" : ""}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Right Side: Evaluation Block */}
        <div
          className="glass-panel"
          style={{ padding: "24px", display: "flex", flexDirection: "column" }}
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
            <h3 style={{ margin: 0 }}>
              Unknown Resistor (R<sub>x</sub>)
            </h3>
          </div>

          <div
            style={{
              padding: "24px",
              background: "rgba(0,0,0,0.2)",
              borderRadius: "12px",
              marginBottom: "24px",
              textAlign: "center",
              flex: 1,
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
            }}
          >
            {/* CSS Resistor visualization */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "20px 0",
              }}
            >
              <div
                style={{ width: "40px", height: "4px", background: "#94a3b8" }}
              ></div>
              <div
                style={{
                  width: "120px",
                  height: "40px",
                  background: `linear-gradient(90deg, #d97706, #f59e0b 20%, #b45309 80%, #d97706)`,
                  borderRadius: "8px",
                  display: "flex",
                  justifyContent: "space-evenly",
                  alignItems: "center",
                  boxShadow:
                    "0 4px 6px rgba(0,0,0,0.3), inset 0 2px 4px rgba(255,255,255,0.2)",
                }}
              >
                <div
                  style={{
                    width: "6px",
                    height: "100%",
                    background: "#bfdbfe",
                  }}
                ></div>
                <div
                  style={{
                    width: "6px",
                    height: "100%",
                    background: "#475569",
                  }}
                ></div>
                <div
                  style={{
                    width: "6px",
                    height: "100%",
                    background: "#1e293b",
                  }}
                ></div>
                <div
                  style={{
                    width: "6px",
                    height: "100%",
                    background: "#fbbf24",
                  }}
                ></div>
              </div>
              <div
                style={{ width: "40px", height: "4px", background: "#94a3b8" }}
              ></div>
            </div>
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
                marginTop: "16px",
              }}
            >
              {isEvaluated ? (examConfig ? "*** Ω" : `${rx} Ω`) : "? Ω"}
            </div>
            {isEvaluated && !examConfig && (
              <div
                style={{
                  fontSize: "1rem",
                  color: "var(--text-muted)",
                  marginTop: "8px",
                }}
              >
                True Value
              </div>
            )}
          </div>

          {examConfig && (
            <div style={{ marginBottom: "20px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
               {examFixedResistors.map(r => (
                  <div key={r} style={{
                     padding: "8px 12px",
                     background: "rgba(0,0,0,0.2)",
                     borderRadius: "8px",
                     border: `1px solid ${examStepResults[r] !== undefined ? "#10b981" : "var(--border-color)"}`,
                     display: "flex", justifyContent: "space-between", alignItems: "center"
                  }}>
                     <span style={{color: "var(--text-muted)", fontSize: "0.85rem"}}>عند {r}Ω:</span>
                     <span style={{fontWeight: "bold", color: examStepResults[r] !== undefined ? "#10b981" : "#fff", flex: 1, textAlign: "center"}}>
                        {examStepResults[r] !== undefined ? `${examStepResults[r]} Ω` : "--"}
                     </span>
                     {!isEvaluated && examStepResults[r] !== undefined && (
                        <button
                           type="button"
                           onClick={() => {
                              const newResults = {...examStepResults};
                              delete newResults[r];
                              setExamStepResults(newResults);
                              setShowAveragePhase(false);
                              setKnownR(r);
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

          {/* Student Input Section */}
          <div className="wheatstone-student-input">
            <h4 className="wheatstone-student-title">
              {examConfig && showAveragePhase ? "حساب متوسط الدائرة" : (examConfig ? "تسجيل قراءة الـ L الحالية" : "Calculate the Unknown R")}
            </h4>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (examConfig) {
                   if (showAveragePhase) {
                      const avg = parseFloat(studentAverage);
                      if (isNaN(avg)) return;
                      setIsEvaluated(true);
                      
                      const pointsStr = Object.entries(examStepResults)
                         .map(([k, ans], i) => `P${i+1}(Rk:${k}Ω -> Rx:${ans}Ω)`)
                         .join(" | ");
                      const finalStr = `${pointsStr} | Avg Rx: ${avg}Ω`;
                      onSubmitResult(finalStr, rx);
                   } else {
                      const parsedAnswer = parseFloat(studentAnswer);
                      if (isNaN(parsedAnswer)) return;
                      
                      const newResults = {...examStepResults, [knownR]: parsedAnswer};
                      setExamStepResults(newResults);
                      setStudentAnswer("");
                      
                      if (Object.keys(newResults).length === 4) {
                         setShowAveragePhase(true);
                      } else {
                         const nextR = examFixedResistors.find(r => newResults[r] === undefined);
                         if (nextR) setKnownR(nextR);
                      }
                   }
                } else {
                   handleEvaluate(e);
                }
              }}
              className="wheatstone-form"
            >
              {!showAveragePhase ? (
                <div className="wheatstone-input-wrapper">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder={examConfig ? "سجل قيمة Rx هنا..." : "Enter your result..."}
                    value={studentAnswer}
                    onChange={(e) => setStudentAnswer(e.target.value)}
                    disabled={isEvaluated || !isBalanced}
                    className="wheatstone-input"
                    style={{
                      borderColor: isEvaluated
                        ? examConfig
                          ? "#3b82f6"
                          : isCorrect
                            ? "#10b981"
                            : "#ef4444"
                        : "var(--glass-border)",
                      opacity: !isBalanced && !isEvaluated ? 0.5 : 1,
                    }}
                  />
                  <span className="wheatstone-unit">Ω</span>
                </div>
              ) : (
                <div className="wheatstone-input-wrapper">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="ادخل المتوسط..."
                    value={studentAverage}
                    onChange={(e) => setStudentAverage(e.target.value)}
                    disabled={isEvaluated}
                    className="wheatstone-input"
                    style={{
                      borderColor: isEvaluated ? "#10b981" : "#3b82f6"
                    }}
                  />
                  <span className="wheatstone-unit">Ω</span>
                </div>
              )}

              {!isEvaluated ? (
                <div className="wheatstone-submit-container">
                  <button
                    type="submit"
                    disabled={
                      !canSubmit ||
                      (showAveragePhase
                        ? !studentAverage.trim()
                        : !studentAnswer.trim() || !isBalanced)
                    }
                    className="wheatstone-submit-btn"
                    style={{
                      cursor:
                        canSubmit &&
                        (showAveragePhase
                          ? studentAverage.trim()
                          : studentAnswer.trim() && isBalanced)
                          ? "pointer"
                          : "not-allowed",
                      opacity:
                        canSubmit &&
                        (showAveragePhase
                          ? studentAverage.trim()
                          : studentAnswer.trim() && isBalanced)
                          ? 1
                          : 0.6,
                      height: showAveragePhase ? "45px" : "auto",
                    }}
                  >
                    {!canSubmit ? (
                      <span className="flex-center">
                        <RefreshCw size={16} className="animate-spin" />
                        انتظر {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, "0")} دقيقة
                      </span>
                    ) : (
                      <>{examConfig ? (showAveragePhase ? "إرسال النتيجة النهائية" : "تسجيل القيمه") : "Check"}</>
                    )}
                  </button>
                  {!canSubmit && (
                    <p style={{ fontSize: "0.8rem", color: "#fca5a5", textAlign: "center", margin: 0 }}>
                      يجب استيفاء وقت المراقبة الأدنى (5 دقائق) قبل إرسال النتيجة.
                    </p>
                  )}
                </div>
              ) : (
                !examConfig && (
                  <button
                    type="button"
                    onClick={generateNewRx}
                    className="wheatstone-retry-btn"
                  >
                    <RefreshCw size={18} /> Retry
                  </button>
                )
              )}
            </form>

            {/* Result Feedback */}
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
                  <CheckCircle2 size={24} color="#3b82f6" />
                ) : isCorrect ? (
                  <CheckCircle2 size={24} color="#10b981" />
                ) : (
                  <XCircle size={24} color="#ef4444" />
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
                      Remember:{" "}
                      <strong style={{ color: "#fff" }}>
                        R<sub>x</sub> = R × (L / (100 - L))
                      </strong>
                      . Did you use the balance length correctly?
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
