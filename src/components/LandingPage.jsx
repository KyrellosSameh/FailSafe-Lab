import {
  GraduationCap,
  BookOpen,
  Zap,
  ShieldCheck,
  Microscope,
  Shield,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="landing-page">
      {/* High-Tech grid applied via index.css body background */}

      <div className="landing-content">
        {/* Logo / Title */}
        <div className="landing-logo">
          <div className="logo-icon-wrapper">
            <ShieldCheck size={40} strokeWidth={1.5} />
          </div>
          <div className="logo-text">
            <h1>FailSafe Lab</h1>
            <span>Virtual Simulator</span>
          </div>
        </div>

        {/* Hero Text */}
        <div className="landing-hero">
          <h2 className="hero-title">
            Interactive Physics
            <span className="hero-accent"> Experiments</span>
          </h2>
          <p className="hero-subtitle">
            Explore Ohm's Law, Wheatstone Bridge, Hooke's Law, and Viscosity
            through immersive virtual lab experiments.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="landing-actions">
          {/* Instructor Button */}
          <button
            className="landing-btn landing-btn--primary"
            onClick={() => navigate("/lab/instructor")}
            id="instructor-btn"
          >
            <div className="btn-icon-wrapper btn-icon--primary">
              <GraduationCap size={28} strokeWidth={1.8} />
            </div>
            <div className="btn-text">
              <span className="btn-title">استاذ</span>
              <span className="btn-subtitle">Instructor Login</span>
            </div>
            <Zap size={16} className="btn-arrow" />
          </button>

          {/* Student Button */}
          <button
            className="landing-btn landing-btn--secondary"
            onClick={() => navigate("/lab/student")}
            id="student-btn"
          >
            <div className="btn-icon-wrapper btn-icon--secondary">
              <BookOpen size={28} strokeWidth={1.8} />
            </div>
            <div className="btn-text">
              <span className="btn-title">طالب</span>
              <span className="btn-subtitle">Student Exam Entry</span>
            </div>
            <Zap size={16} className="btn-arrow" />
          </button>

          {/* Admin Button */}
          <button
            className="landing-btn landing-btn--lab"
            onClick={() => navigate("/lab/admin")}
            id="admin-btn"
            style={{ borderColor: "rgba(245, 158, 11, 0.3)" }}
          >
            <div
              className="btn-icon-wrapper"
              style={{
                background:
                  "linear-gradient(135deg, rgba(245,158,11,0.2), rgba(239,68,68,0.2))",
                color: "#f59e0b",
              }}
            >
              <Shield size={28} strokeWidth={1.8} />
            </div>
            <div className="btn-text">
              <span className="btn-title">مسؤول النظام</span>
              <span className="btn-subtitle">Admin Panel</span>
            </div>
            <Zap size={16} className="btn-arrow" />
          </button>

          {/* Browse Lab directly */}
          <button
            className="landing-btn landing-btn--lab"
            onClick={() => navigate("/lab/browse")}
            id="browse-lab-btn"
          >
            <div className="btn-icon-wrapper btn-icon--lab">
              <Microscope size={28} strokeWidth={1.8} />
            </div>
            <div className="btn-text">
              <span className="btn-title">تصفح التجارب</span>
              <span className="btn-subtitle">Browse all experiments</span>
            </div>
            <Zap size={16} className="btn-arrow" />
          </button>
        </div>

        {/* Stats Row */}
        <div className="landing-stats" style={{ marginBottom: "40px" }}>
          <div className="stat-item">
            <span className="stat-number">4</span>
            <span className="stat-label">Experiments</span>
          </div>
          <div className="stat-divider" />
          <div className="stat-item">
            <span className="stat-number">∞</span>
            <span className="stat-label">Sessions</span>
          </div>
          <div className="stat-divider" />
          <div className="stat-item">
            <span className="stat-number">100%</span>
            <span className="stat-label">Interactive</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default LandingPage;
