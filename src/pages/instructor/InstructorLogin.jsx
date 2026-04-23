import { useState } from "react";
import {
  ArrowLeft,
  GraduationCap,
  Eye,
  EyeOff,
  LogIn,
  Lock,
  User,
} from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import bcrypt from "bcryptjs";

function LoginPage({ onBack, onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!username.trim() || !password.trim()) {
      setError("يرجى ملء جميع الحقول.");
      return;
    }
    setLoading(true);

    try {
      const { data, error: fetchError } = await supabase
        .from("instructors")
        .select("id, username, password")
        .eq("username", username.trim())
        .single();

      if (fetchError || !data) {
        setError("اسم المستخدم أو كلمة المرور غير صحيحة.");
        setLoading(false);
        return;
      }

      // Compare password (bcrypt only)
      if (!data.password || !data.password.startsWith("$2")) {
        setError("خطأ في حساب الاستاذ. يرجى التواصل مع المسؤول.");
        setLoading(false);
        return;
      }
      const isMatch = bcrypt.compareSync(password.trim(), data.password);

      if (!isMatch) {
        setError("اسم المستخدم أو كلمة المرور غير صحيحة.");
        setLoading(false);
        return;
      }

      if (onLogin) onLogin({ username: data.username, id: data.id });
    } catch (err) {
      console.error("Login error:", err);
      setError("حدث خطأ أثناء تسجيل الدخول. تأكد من اتصالك بالإنترنت.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="blob blob-1" />
      <div className="blob blob-2" />

      <div className="auth-card glass-panel">
        {/* Back Button */}
        <button className="auth-back-btn" onClick={onBack} id="login-back-btn">
          <ArrowLeft size={18} />
          <span>Back</span>
        </button>

        {/* Header */}
        <div className="auth-header">
          <div className="auth-icon-wrapper auth-icon--instructor">
            <GraduationCap size={32} strokeWidth={1.5} />
          </div>
          <h2 className="auth-title">Instructor Login</h2>
          <p className="auth-subtitle">تسجيل دخول المدرس لإنشاء اختبار جديد</p>
        </div>

        {/* Form */}
        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="auth-field">
            <label htmlFor="username">Username</label>
            <div className="auth-input-wrapper">
              <User size={18} className="auth-input-icon" />
              <input
                id="username"
                type="text"
                placeholder="Enter your username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
              />
            </div>
          </div>

          <div className="auth-field">
            <label htmlFor="password">Password</label>
            <div className="auth-input-wrapper">
              <Lock size={18} className="auth-input-icon" />
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
              <button
                type="button"
                className="auth-eye-btn"
                onClick={() => setShowPassword((v) => !v)}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {error && <p className="auth-error">{error}</p>}

          <button
            type="submit"
            className="auth-submit-btn"
            disabled={loading}
            id="login-submit-btn"
          >
            {loading ? (
              <span className="auth-spinner" />
            ) : (
              <>
                <LogIn size={18} />
                <span>تسجيل الدخول</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

export default LoginPage;
