import React, { useState, useEffect, useRef } from "react";
import {
  Play,
  Square,
  TestTube,
  CheckCircle2,
  XCircle,
  Ruler,
  Crosshair,
} from "lucide-react";
import "../styles/components/Viscosity.css";


export default function Viscosity({ examConfig, onSubmitResult }) {
  const g = 9.8;
  const ballDensity = 7800; // Steel
  const distanceMeters = 0.6;

  const [fluidProps] = useState(() => {
    if (examConfig && examConfig.parameters.viscosityLiquid) {
      const name = examConfig.parameters.viscosityLiquid;
      let density = 1260;
      let viscosity = 0.95;
      let color = "#d97706";
      let colorLight = "rgba(217, 119, 6, 0.4)";

      if (name === "Glycerin") {
        density = 1260;
        viscosity = 1.41;
        color = "#0ea5e9";
        colorLight = "rgba(14, 165, 233, 0.4)";
      } else if (name === "Castor Oil") {
        density = 960;
        viscosity = 0.98;
        color = "#eab308";
        colorLight = "rgba(234, 179, 8, 0.4)";
      } else if (name === "Motor Oil") {
        density = 880;
        viscosity = 0.65;
        color = "#b45309";
        colorLight = "rgba(180, 83, 9, 0.4)";
      }

      return { name, density, viscosity, color, colorLight };
    }

    const trueViscosity = parseFloat((Math.random() * 0.7 + 0.8).toFixed(3));
    return {
      name: "Mystery Fluid",
      density: 1260,
      viscosity: trueViscosity,
      color: "#06b6d4",
      colorLight: "rgba(6, 182, 212, 0.4)",
    };
  });

  const [balls, setBalls] = useState(() => {
    const arr = [];
    if (examConfig && examConfig.parameters.viscosityBalls) {
      examConfig.parameters.viscosityBalls.forEach((d, i) => {
        arr.push({
          id: i + 1,
          dTrue: d,
          radiusMeters: d / 2 / 1000,
          tMeasured: null,
          inputD: "",
          inputV: "",
          inputEta: "",
          dCorrect: null,
          vCorrect: null,
          etaCorrect: null,
        });
      });
      return arr
        .sort((a, b) => a.dTrue - b.dTrue)
        .map((b, i) => ({ ...b, id: i + 1 }));
    }

    while (arr.length < 5) {
      const d = parseFloat((Math.random() * 15 + 5).toFixed(1));
      const distinct = arr.every((b) => Math.abs(b.dTrue - d) >= 1.5);
      if (distinct || arr.length === 0) {
        arr.push({
          id: arr.length + 1,
          dTrue: d,
          radiusMeters: d / 2 / 1000,
          tMeasured: null,
          inputD: "",
          inputV: "",
          inputEta: "",
          dCorrect: null,
          vCorrect: null,
          etaCorrect: null,
        });
      }
    }
    return arr
      .sort((a, b) => a.dTrue - b.dTrue)
      .map((b, i) => ({ ...b, id: i + 1 }));
  });

  const [avgEtaInput, setAvgEtaInput] = useState("");
  const [avgEtaCorrect, setAvgEtaCorrect] = useState(null);

  const [activeBallId, setActiveBallId] = useState(1);
  const activeBall = balls.find((b) => b.id === activeBallId);

  // Manual Micrometer State
  const [micrometerGap, setMicrometerGap] = useState(25.0);
  const micrometerSliderRef = useRef(null);

  const [simState, setSimState] = useState("idle");
  const [dropPosition, setDropPosition] = useState(0);
  const [liveTime, setLiveTime] = useState(0);

  const requestRef = useRef();
  const startTimeRef = useRef(0);
  const timeAtTopMarkRef = useRef(0);

  const terminalVelocity =
    (2 *
      Math.pow(activeBall.radiusMeters, 2) *
      g *
      (ballDensity - fluidProps.density)) /
    (9 * fluidProps.viscosity);
  const maxDistanceMeters = 1.0;
  const topMarkMeters = 0.2;
  const bottomMarkMeters = 0.8;

  const [simMessage, setSimMessage] = useState("Select a ball and drop it.");

  const animate = (time) => {
    if (!startTimeRef.current) startTimeRef.current = time;

    const elapsedS = (time - startTimeRef.current) / 1000;
    const currentPosMeters = elapsedS * terminalVelocity;

    setDropPosition(Math.min(currentPosMeters, maxDistanceMeters));

    if (
      currentPosMeters >= topMarkMeters &&
      currentPosMeters < bottomMarkMeters
    ) {
      if (!timeAtTopMarkRef.current) timeAtTopMarkRef.current = elapsedS;
      setLiveTime(elapsedS - timeAtTopMarkRef.current);
      setSimMessage("Stopwatch: Running...");
    } else if (currentPosMeters >= bottomMarkMeters) {
      setSimState("idle");
      setDropPosition(bottomMarkMeters);

      const tTrue = distanceMeters / terminalVelocity;
      const error = Math.random() * 0.1 * (Math.random() > 0.5 ? 1 : -1);
      let tMeasured = Math.max(0.1, tTrue + error);

      setLiveTime(tMeasured);
      setSimMessage(`Stopwatch stopped at ${tMeasured.toFixed(2)} s`);

      setBalls((prev) =>
        prev.map((b) =>
          b.id === activeBallId ? { ...b, tMeasured: tMeasured } : b,
        ),
      );
      return;
    }

    if (currentPosMeters < maxDistanceMeters) {
      requestRef.current = requestAnimationFrame(animate);
    }
  };

  useEffect(() => {
    if (simState === "running") {
      requestRef.current = requestAnimationFrame(animate);
    }
    return () => cancelAnimationFrame(requestRef.current);
  }, [simState, activeBallId]);

  const handleDrop = () => {
    setSimState("running");
    setDropPosition(0);
    setLiveTime(0);
    startTimeRef.current = 0;
    timeAtTopMarkRef.current = 0;
    setSimMessage("Ball dropping...");
  };

  const handleMicrometerChange = (e) => {
    let val = parseFloat(e.target.value);
    if (val < activeBall.dTrue) {
      val = activeBall.dTrue; // Prevents closing beyond ball size
    }
    setMicrometerGap(val);
  };

  useEffect(() => {
    const el = micrometerSliderRef.current;
    if (!el) return;
    const handler = (e) => {
      e.preventDefault();
      setMicrometerGap((prev) => {
        const newVal = parseFloat(
          (prev + (e.deltaY < 0 ? 0.01 : -0.01)).toFixed(2),
        );
        const clamped = Math.min(25, Math.max(0, newVal));
        return clamped < activeBall.dTrue ? activeBall.dTrue : clamped;
      });
    };
    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, [activeBall.dTrue]);

  const handleInputChange = (id, field, value) => {
    setBalls((prev) =>
      prev.map((b) => (b.id === id ? { ...b, [field]: value } : b)),
    );
  };

  const checkAnswers = () => {
    let allCorrect = true;
    let validEtas = [];

    const newBalls = balls.map((b) => {
      const dNum = parseFloat(b.inputD);
      const isDCorrect = !isNaN(dNum) && Math.abs(dNum - b.dTrue) <= 0.2;

      let isVCorrect = false;
      if (b.tMeasured) {
        const expectedV = distanceMeters / b.tMeasured;
        const vNum = parseFloat(b.inputV);
        if (!isNaN(vNum) && Math.abs(vNum - expectedV) / expectedV <= 0.05) {
          isVCorrect = true;
        }
      }

      let isEtaCorrect = false;
      if (b.tMeasured && isDCorrect && isVCorrect) {
        const rMeters = dNum / 2 / 1000;
        const vNum = parseFloat(b.inputV);
        const expectedEta =
          (2 * Math.pow(rMeters, 2) * g * (ballDensity - fluidProps.density)) /
          (9 * vNum);
        const etaNum = parseFloat(b.inputEta);
        if (
          !isNaN(etaNum) &&
          Math.abs(etaNum - expectedEta) / expectedEta <= 0.08
        ) {
          isEtaCorrect = true;
          validEtas.push(etaNum);
        }
      }

      if (!isDCorrect || !isVCorrect || !isEtaCorrect) allCorrect = false;

      return {
        ...b,
        dCorrect: isDCorrect,
        vCorrect: isVCorrect,
        etaCorrect: isEtaCorrect,
      };
    });

    setBalls(newBalls);

    const avgExpected =
      validEtas.length > 0
        ? validEtas.reduce((a, b) => a + b, 0) / validEtas.length
        : 0;
    const avgInputNum = parseFloat(avgEtaInput);
    if (
      validEtas.length === 5 &&
      !isNaN(avgInputNum) &&
      Math.abs(avgInputNum - avgExpected) / avgExpected <= 0.05
    ) {
      setAvgEtaCorrect(true);
    } else {
      setAvgEtaCorrect(false);
      allCorrect = false;
    }

    if (examConfig) {
      alert("تم تسجيل جميع القراءات بنجاح");
    } else if (allCorrect) {
      alert("Excellent! All your measurements and calculations are correct.");
    }

    if (examConfig && onSubmitResult) {
      const studentTable = newBalls.map((b) => ({
        id: b.id,
        d: b.inputD || "-",
        t: b.tMeasured ? b.tMeasured.toFixed(2) : "-",
        v: b.inputV || "-",
        eta: b.inputEta || "-",
      }));

      const actualTable = newBalls.map((b) => {
        const expectedV = b.tMeasured
          ? (distanceMeters / b.tMeasured).toFixed(3)
          : "-";
        const expectedEta = b.tMeasured
          ? (
              (2 *
                Math.pow(b.dTrue / 2 / 1000, 2) *
                g *
                (ballDensity - fluidProps.density)) /
              (9 * expectedV)
            ).toFixed(3)
          : "-";
        return {
          id: b.id,
          d: b.dTrue,
          t: b.tMeasured ? b.tMeasured.toFixed(2) : "-",
          v: expectedV,
          eta: expectedEta,
        };
      });

      const studentOutput = JSON.stringify({
        avg: isNaN(avgInputNum) ? "-" : avgInputNum,
        table: studentTable,
      });

      const actualOutput = JSON.stringify({
        avg: fluidProps.viscosity,
        table: actualTable,
      });

      onSubmitResult(studentOutput, actualOutput);
    }
  };

  // Render Manual Micrometer (Split View)
  const renderMicrometer = () => {
    const pxPerMm = 15; // visual scaling for Main Scale
    const sleeveWidth = 25 * pxPerMm; // up to 25mm max

    // Exact value in terms of divisions (0 to 49)
    const exactThimble = (micrometerGap % 0.5) * 100;

    return (
      <div className="glass-panel viscosity-micrometer">
        <h3 className="viscosity-micrometer-title">
          <Crosshair size={20} /> Manual Micrometer
        </h3>
        <p className="viscosity-micrometer-subtitle">
          Adjust the gap until it closes on the ball. Read the{" "}
          <strong>Main Scale</strong> (mm) and the{" "}
          <strong>Circular Scale</strong> (0.01 mm) separately below.
        </p>

        {/* Visual Representation of Jaws/Object */}
        <div className="viscosity-micrometer-visual">
          <div
            style={{
              position: "absolute",
              top: "25px",
              left: "10px",
              width: "380px",
              height: "10px",
              background: "#334155",
            }}
          ></div>
          {/* Fixed Anvil */}
          <div
            style={{
              position: "absolute",
              top: "15px",
              left: "10px",
              width: "30px",
              height: "30px",
              background: "#94a3b8",
            }}
          ></div>
          {/* Target Ball */}
          <div
            style={{
              position: "absolute",
              top: 30 - (activeBall.dTrue * 8) / 2,
              left: 40,
              width: activeBall.dTrue * 8,
              height: activeBall.dTrue * 8,
              background:
                "radial-gradient(circle at 30% 30%, #f97316, #ea580c)",
              borderRadius: "50%",
            }}
          ></div>
          {/* Moving Spindle */}
          <div
            style={{
              position: "absolute",
              top: "15px",
              left: 40 + micrometerGap * 8,
              width: "350px",
              height: "30px",
              background: "#cbd5e1",
            }}
          ></div>
        </div>

        <div className="viscosity-micrometer-scales">
          {/* Main Scale SVG */}
          <div className="viscosity-micrometer-scale">
            <div className="viscosity-micrometer-scale-title">
              Main Scale (Sleeve) - 0.5 mm steps
            </div>
            <svg width={sleeveWidth + 40} height="60">
              <g transform="translate(15, 30)">
                {/* Base line */}
                <line
                  x1="0"
                  y1="0"
                  x2={sleeveWidth}
                  y2="0"
                  stroke="#475569"
                  strokeWidth="2"
                />
                {/* Ticks */}
                {Array.from({ length: 26 }).map((_, i) => (
                  <g key={`top-${i}`}>
                    <line
                      x1={i * pxPerMm}
                      y1="0"
                      x2={i * pxPerMm}
                      y2="-15"
                      stroke="#475569"
                      strokeWidth="1.5"
                    />
                    {i % 5 === 0 && (
                      <text
                        x={i * pxPerMm}
                        y="-20"
                        textAnchor="middle"
                        fontSize="11"
                        fill="#0f172a"
                      >
                        {i}
                      </text>
                    )}
                  </g>
                ))}
                {Array.from({ length: 25 }).map((_, i) => (
                  <line
                    key={`bot-${i}`}
                    x1={i * pxPerMm + pxPerMm / 2}
                    y1="0"
                    x2={i * pxPerMm + pxPerMm / 2}
                    y2="10"
                    stroke="#475569"
                    strokeWidth="1.5"
                  />
                ))}
                {/* Indicator Line (Red) */}
                <line
                  x1={micrometerGap * pxPerMm}
                  y1="-25"
                  x2={micrometerGap * pxPerMm}
                  y2="15"
                  stroke="#ef4444"
                  strokeWidth="3"
                />
                {/* Highlight exposed area on sleeve */}
                <rect
                  x="0"
                  y="-15"
                  width={micrometerGap * pxPerMm}
                  height="25"
                  fill="#3b82f6"
                  opacity="0.1"
                />
              </g>
            </svg>
          </div>

          {/* Circular Scale SVG */}
          <div className="viscosity-micrometer-scale">
            <div className="viscosity-micrometer-scale-title">
              Circular Scale (Thimble) - 0.01 mm steps
            </div>
            <svg width="100%" height="60">
              {/* Centered at 50% width via translate */}
              <g transform="translate(150, 30)">
                {/* Fixed Indicator Line (Center) */}
                <line
                  x1="0"
                  y1="-20"
                  x2="0"
                  y2="25"
                  stroke="#ef4444"
                  strokeWidth="3"
                />

                {/* Sliding Tape with numbers wrapping 0 to 49 */}
                {Array.from({ length: 25 }).map((_, i) => {
                  const offset = i - 12; // span around center
                  let val = Math.round(exactThimble) + offset;

                  // Handle wrap around 0-49
                  while (val < 0) val += 50;
                  while (val >= 50) val -= 50;

                  const pxPerDiv = 15; // Width spacing horizontally
                  const exactDiff =
                    offset - (exactThimble - Math.round(exactThimble));
                  const xPosition = exactDiff * pxPerDiv;

                  const opacity = 1 - Math.abs(xPosition) / 120;
                  if (opacity < 0.05) return null;

                  return (
                    <g
                      key={i}
                      transform={`translate(${xPosition}, 0)`}
                      opacity={opacity}
                    >
                      <line
                        x1="0"
                        y1="-10"
                        x2="0"
                        y2={val % 5 === 0 ? "10" : "5"}
                        stroke="#0f172a"
                        strokeWidth="1.5"
                      />
                      {val % 5 === 0 && (
                        <text
                          x="0"
                          y="24"
                          textAnchor="middle"
                          fontSize="12"
                          fontWeight="bold"
                          fill="#0f172a"
                        >
                          {val}
                        </text>
                      )}
                    </g>
                  );
                })}
              </g>
            </svg>
          </div>
        </div>

        {/* Slider Control */}
        <div className="viscosity-micrometer-controls">
          <span style={{ fontSize: "0.9rem", color: "#f59e0b", fontWeight: "bold" }}>
            Close Jaws
          </span>
          <input
            ref={micrometerSliderRef}
            type="range"
            min="0"
            max="25"
            step="0.01"
            value={micrometerGap}
            onChange={handleMicrometerChange}
            className="viscosity-micrometer-range"
          />
          <span
            style={{ fontSize: "0.9rem", color: "#f59e0b", fontWeight: "bold" }}
          >
            Open Jaws
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="glass-panel viscosity-container animate-fade-in w-full max-w-6xl mx-auto">
      <div className="viscosity-header">
        <div>
          <h2 className="viscosity-title">
            Viscosity Evaluation
          </h2>
          <p className="viscosity-subtitle">
            Measure the diameter of 5 different balls, time their fall, and
            calculate the viscosity coefficient of the mystery fluid.
          </p>
        </div>
      </div>

      <div className="viscosity-grid">
        {/* Simulation Area */}
        <div className="glass-panel viscosity-sim-area">
          <div className="viscosity-hud">
            <div className="viscosity-stopwatch">
              <div className="viscosity-stopwatch-label">
                Stopwatch
              </div>
              <div
                className="device-display"
                style={{
                  background: "#3b82f6",
                  color: "white",
                  minWidth: "100px",
                  textAlign: "center",
                  fontSize: "1.2rem",
                }}
              >
                {liveTime.toFixed(2)} s
              </div>
            </div>
            <div className="viscosity-sim-message">
              {simMessage}
            </div>
          </div>

          <div className="viscosity-physics-wrapper">
            <div className="viscosity-ruler">
              {[0, 20, 40, 60, 80, 100].map((cm, i) => (
                <div
                  key={i}
                  style={{
                    position: "absolute",
                    top: `${cm}%`,
                    left: 0,
                    width: "100%",
                    borderTop: "2px solid #a16207",
                    display: "flex",
                    alignItems: "center",
                  }}
                >
                  <span style={{ marginLeft: "4px", marginTop: "-12px" }}>
                    {cm}cm
                  </span>
                </div>
              ))}
              {Array.from({ length: 50 }).map((_, i) => (
                <div
                  key={i}
                  style={{
                    position: "absolute",
                    top: `${i * 2}%`,
                    left: 0,
                    width: i % 5 === 0 ? "0" : "50%",
                    borderTop: "1px solid #ca8a04",
                  }}
                ></div>
              ))}
            </div>

            <div
              style={{
                position: "relative",
                width: "120px",
                height: "400px",
                border: "4px solid rgba(255,255,255,0.2)",
                borderTop: "none",
                borderBottomLeftRadius: "20px",
                borderBottomRightRadius: "20px",
                overflow: "hidden",
                background: `linear-gradient(to bottom, ${fluidProps.colorLight}, ${fluidProps.color})`,
              }}
            >
              <div
                style={{
                  position: "absolute",
                  top: "20%",
                  left: 0,
                  width: "100%",
                  borderTop: "2px dashed red",
                  zIndex: 5,
                }}
              ></div>
              <div
                style={{
                  position: "absolute",
                  top: "80%",
                  left: 0,
                  width: "100%",
                  borderTop: "2px dashed red",
                  zIndex: 5,
                }}
              ></div>

              <div
                style={{
                  position: "absolute",
                  top: "20%",
                  right: "4px",
                  color: "red",
                  fontSize: "0.7rem",
                  fontWeight: "bold",
                  zIndex: 5,
                }}
              >
                20cm
              </div>
              <div
                style={{
                  position: "absolute",
                  top: "80%",
                  right: "4px",
                  color: "red",
                  fontSize: "0.7rem",
                  fontWeight: "bold",
                  zIndex: 5,
                }}
              >
                80cm
              </div>

              <div
                style={{
                  position: "absolute",
                  top: `${dropPosition * 100}%`,
                  left: "50%",
                  transform: "translate(-50%, -50%)",
                  width: `${activeBall.radiusMeters * 2000}px`,
                  height: `${activeBall.radiusMeters * 2000}px`,
                  background:
                    "radial-gradient(circle at 30% 30%, #e4e4e7, #71717a)",
                  borderRadius: "50%",
                  boxShadow: "0 5px 10px rgba(0,0,0,0.5)",
                  zIndex: 10,
                }}
              ></div>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <div className="glass-panel" style={{ padding: "20px" }}>
            <h3
              style={{
                fontSize: "1.2rem",
                marginBottom: "16px",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <TestTube size={20} color="var(--primary)" /> Equipment
            </h3>

            <div style={{ marginBottom: "16px" }}>
              <div
                style={{
                  color: "var(--text-muted)",
                  fontSize: "0.9rem",
                  marginBottom: "8px",
                }}
              >
                Select Ball:
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                {balls.map((b) => (
                  <button
                    key={b.id}
                    onClick={() => {
                      if (simState === "idle") {
                        setActiveBallId(b.id);
                        setMicrometerGap(25.0); // Reset micrometer
                        setDropPosition(0);
                        setLiveTime(0);
                        setSimMessage("Ready to drop.");
                      }
                    }}
                    style={{
                      padding: "8px 12px",
                      borderRadius: "8px",
                      background:
                        activeBallId === b.id
                          ? "var(--primary)"
                          : "rgba(255,255,255,0.1)",
                      color: activeBallId === b.id ? "white" : "inherit",
                      border: "none",
                      cursor: simState === "idle" ? "pointer" : "not-allowed",
                      opacity: simState === "idle" ? 1 : 0.6,
                    }}
                  >
                    B{b.id}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={handleDrop}
              disabled={simState === "running"}
              style={{
                width: "100%",
                padding: "12px",
                background: "#10b981",
                color: "white",
                border: "none",
                borderRadius: "8px",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                gap: "8px",
                cursor: simState === "running" ? "not-allowed" : "pointer",
              }}
            >
              <Play size={18} /> Drop Selected Ball
            </button>
          </div>

          {renderMicrometer()}

          <div
            className="glass-panel"
            style={{
              padding: "20px",
              background: "rgba(59, 130, 246, 0.05)",
              border: "1px solid rgba(59, 130, 246, 0.2)",
            }}
          >
            <h3
              style={{
                fontSize: "1.1rem",
                marginBottom: "12px",
                color: "#3b82f6",
              }}
            >
              Known Densities
            </h3>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: "0.9rem",
                color: "var(--text-muted)",
                marginBottom: "8px",
              }}
            >
              <span>
                Steel Ball (ρ<sub>s</sub>)
              </span>
              <span style={{ fontWeight: "bold" }}>{ballDensity} kg/m³</span>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: "0.9rem",
                color: "var(--text-muted)",
              }}
            >
              <span>
                Fluid (ρ<sub>f</sub>)
              </span>
              <span style={{ fontWeight: "bold" }}>
                {fluidProps.density} kg/m³
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Evaluation Table */}
      <div className="glass-panel" style={{ padding: "24px", overflowX: "auto" }}>
        <h3 className="viscosity-title" style={{ fontSize: "1.5rem", marginBottom: "16px" }}>
          Data Collection & Calculation
        </h3>

        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            minWidth: "800px",
          }}
        >
          <thead>
            <tr
              style={{
                borderBottom: "2px solid rgba(255,255,255,0.1)",
                textAlign: "left",
              }}
            >
              <th style={{ padding: "12px" }}>Ball</th>
              <th style={{ padding: "12px", color: "var(--text-muted)" }}>
                Measured Time (s)
              </th>
              <th style={{ padding: "12px" }}>Diameter (mm)</th>
              <th style={{ padding: "12px" }}>Velocity (m/s)</th>
              <th style={{ padding: "12px" }}>Viscosity η (Pa·s)</th>
            </tr>
          </thead>
          <tbody>
            {balls.map((b) => (
              <tr
                key={b.id}
                style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}
              >
                <td style={{ padding: "12px", fontWeight: "bold" }}>{b.id}</td>
                <td
                  style={{
                    padding: "12px",
                    color: "#10b981",
                    fontFamily: "monospace",
                    fontSize: "1.1rem",
                  }}
                >
                  {b.tMeasured ? b.tMeasured.toFixed(2) : "--"}
                </td>
                <td style={{ padding: "12px" }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                    }}
                  >
                    <input
                      type="text"
                      value={b.inputD}
                      onChange={(e) =>
                        handleInputChange(b.id, "inputD", e.target.value)
                      }
                      style={{
                        width: "80px",
                        padding: "6px",
                        background: "rgba(0,0,0,0.2)",
                        border: "1px solid var(--border-color)",
                        color: "white",
                        borderRadius: "4px",
                      }}
                    />
                    {!examConfig && b.dCorrect === true && (
                      <CheckCircle2 size={18} color="#10b981" />
                    )}
                    {!examConfig && b.dCorrect === false && (
                      <XCircle size={18} color="#ef4444" />
                    )}
                  </div>
                </td>
                <td style={{ padding: "12px" }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                    }}
                  >
                    <input
                      type="text"
                      value={b.inputV}
                      onChange={(e) =>
                        handleInputChange(b.id, "inputV", e.target.value)
                      }
                      style={{
                        width: "80px",
                        padding: "6px",
                        background: "rgba(0,0,0,0.2)",
                        border: "1px solid var(--border-color)",
                        color: "white",
                        borderRadius: "4px",
                      }}
                      placeholder="e.g. 0.05"
                    />
                    {!examConfig && b.vCorrect === true && (
                      <CheckCircle2 size={18} color="#10b981" />
                    )}
                    {!examConfig && b.vCorrect === false && (
                      <XCircle size={18} color="#ef4444" />
                    )}
                  </div>
                </td>
                <td style={{ padding: "12px" }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                    }}
                  >
                    <input
                      type="text"
                      value={b.inputEta}
                      onChange={(e) =>
                        handleInputChange(b.id, "inputEta", e.target.value)
                      }
                      style={{
                        width: "80px",
                        padding: "6px",
                        background: "rgba(0,0,0,0.2)",
                        border: "1px solid var(--border-color)",
                        color: "white",
                        borderRadius: "4px",
                      }}
                    />
                    {!examConfig && b.etaCorrect === true && (
                      <CheckCircle2 size={18} color="#10b981" />
                    )}
                    {!examConfig && b.etaCorrect === false && (
                      <XCircle size={18} color="#ef4444" />
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div
          style={{
            marginTop: "24px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            background: "rgba(0,0,0,0.2)",
            padding: "16px",
            borderRadius: "8px",
            border: "1px solid rgba(255,255,255,0.05)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <span style={{ fontSize: "1.2rem", fontWeight: "bold" }}>
              Average Viscosity (η):
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <input
                type="text"
                value={avgEtaInput}
                onChange={(e) => setAvgEtaInput(e.target.value)}
                style={{
                  width: "100px",
                  padding: "8px",
                  background: "rgba(0,0,0,0.4)",
                  border: "1px solid var(--primary)",
                  color: "white",
                  borderRadius: "6px",
                  fontSize: "1.1rem",
                }}
              />
              <span style={{ color: "var(--text-muted)" }}>Pa·s</span>
              {!examConfig && avgEtaCorrect === true && (
                <CheckCircle2
                  size={24}
                  color="#10b981"
                  style={{ marginLeft: "8px" }}
                />
              )}
              {!examConfig && avgEtaCorrect === false && (
                <XCircle
                  size={24}
                  color="#ef4444"
                  style={{ marginLeft: "8px" }}
                />
              )}
            </div>
          </div>

          <button
            onClick={checkAnswers}
            disabled={examConfig?.examComplete}
            style={{
              padding: "12px 24px",
              background: "var(--primary)",
              color: "white",
              border: "none",
              borderRadius: "8px",
              fontSize: "1.1rem",
              cursor: examConfig?.examComplete ? "not-allowed" : "pointer",
              fontWeight: "bold",
              opacity: examConfig?.examComplete ? 0.5 : 1,
            }}
          >
            {examConfig?.examComplete ? "تم التسجيل" : "Check Answers"}
          </button>
        </div>

        {!examConfig && (
          <div
            style={{
              marginTop: "16px",
              fontSize: "0.9rem",
              color: "var(--text-muted)",
            }}
          >
            <p>
              <strong>Hint:</strong> Use the formula η = [ 2 * (ρ<sub>s</sub> -
              ρ<sub>f</sub>) * g * r² ] / (9 * v)
            </p>
            <p>
              Remember that radius (r) is half the diameter, and must be in
              meters for the calculation! Also distance between marks is{" "}
              {distanceMeters}m for velocity.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
