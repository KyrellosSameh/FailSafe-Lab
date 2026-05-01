import { useState } from "react";
import {
  ArrowLeft,
  Shield,
  Eye,
  EyeOff,
  LogIn,
  Lock,
  User,
} from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import bcrypt from "bcryptjs";
import "../../components/common/Auth/auth.css";

interface AdminLoginProps {
  onBack: () => void;
  onLogin: () => void;
}

function AdminLogin({ onBack, onLogin }: AdminLoginProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!username.trim() || !password.trim()) {
      setError("يرجى ملء جميع الحقول.");
      return;
    }
    setLoading(true);

    try {
      const { data, error: fetchError } = await supabase
        .from("admins")
        .select("password")
        .eq("username", username.trim())
        .single();

      if (fetchError || !data) {
        setError("اسم المستخدم أو كلمة المرور غير صحيحة.");
        setLoading(false);
        return;
      }

      const storedPassword = data.password;
      if (!storedPassword || !storedPassword.startsWith("$2")) {
        setError("خطأ في حساب المسؤول. كلمة المرور غير مشفرة.");
        setLoading(false);
        return;
      }
      const isMatch = bcrypt.compareSync(password.trim(), storedPassword);

      if (isMatch) {
        onLogin();
      } else {
        setError("اسم المستخدم أو كلمة المرور غير صحيحة.");
      }
    } catch (err) {
      console.error("Admin login error:", err);
      setError("حدث خطأ أثناء الاتصال بقاعدة البيانات.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="blob blob-1" />
      <div className="blob blob-2" />

      <div className="auth-card glass-panel">
        <button
          className="auth-back-btn"
          onClick={onBack}
          id="admin-login-back-btn"
        >
          <ArrowLeft size={18} />
          <span>Back</span>
        </button>

        <div className="auth-header">
          <div
            className="auth-icon-wrapper"
            style={{ background: "linear-gradient(135deg, #f59e0b, #ef4444)" }}
          >
            <Shield size={32} strokeWidth={1.5} />
          </div>
          <h2 className="auth-title">Admin Login</h2>
          <p className="auth-subtitle">تسجيل دخول مسؤول النظام</p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="auth-field">
            <label htmlFor="admin-username">Username</label>
            <div className="auth-input-wrapper">
              <User size={18} className="auth-input-icon" />
              <input
                id="admin-username"
                type="text"
                placeholder="Enter admin username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
              />
            </div>
          </div>

          <div className="auth-field">
            <label htmlFor="admin-password">Password</label>
            <div className="auth-input-wrapper">
              <Lock size={18} className="auth-input-icon" />
              <input
                id="admin-password"
                type={showPassword ? "text" : "password"}
                placeholder="Enter admin password"
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
            id="admin-login-submit-btn"
            disabled={loading}
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

export default AdminLogin;
