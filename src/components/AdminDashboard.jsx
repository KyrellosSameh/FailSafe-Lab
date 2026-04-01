import { useState, useEffect } from "react";
import {
  LogOut,
  UserPlus,
  Users,
  GraduationCap,
  Trash2,
  Mail,
  Shield,
  Search,
} from "lucide-react";
import { supabase } from "../supabaseClient";
import bcrypt from "bcryptjs";
import emailjs from "@emailjs/browser";
import "../styles/components/AdminDashboard.css";


function AdminDashboard({ onBack }) {
  const [activeSection, setActiveSection] = useState("addInstructor");
  const [instructors, setInstructors] = useState([]);
  const [students, setStudents] = useState([]);

  // Add Instructor form
  const [instrUsername, setInstrUsername] = useState("");
  const [instrPassword, setInstrPassword] = useState("");

  // Add Student form
  const [stuName, setStuName] = useState("");
  const [stuId, setStuId] = useState("");
  const [stuEmail, setStuEmail] = useState("");
  const [stuPassword, setStuPassword] = useState("");
  const [stuInstructor, setStuInstructor] = useState("");

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });

  const fetchData = async () => {
    const { data: iData } = await supabase
      .from("instructors")
      .select("id, username")
      .order("id", { ascending: true });
    if (iData) setInstructors(iData);

    const { data: sData } = await supabase
      .from("students")
      .select("student_id, name, email, instructor_id")
      .order("student_id", { ascending: true });
    if (sData) setStudents(sData);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const showMessage = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage({ type: "", text: "" }), 4000);
  };

  // ── Add Instructor ──
  const handleAddInstructor = async (e) => {
    e.preventDefault();
    if (!instrUsername.trim() || !instrPassword.trim()) {
      showMessage("error", "يرجى ملء جميع الحقول.");
      return;
    }
    setLoading(true);
    try {
      // Check if instructor already exists
      const { data: existingInstr } = await supabase
        .from("instructors")
        .select("id")
        .eq("username", instrUsername.trim())
        .limit(1);
        
      if (existingInstr && existingInstr.length > 0) {
        showMessage("error", `الاستاذ "${instrUsername.trim()}" موجود بالفعل.`);
        setLoading(false);
        return;
      }

      const hashedPassword = bcrypt.hashSync(instrPassword.trim(), 10);
      const { error } = await supabase.from("instructors").insert([
        {
          username: instrUsername.trim(),
          password: hashedPassword,
        },
      ]);
      if (error) throw error;
      showMessage(
        "success",
        `تم إضافة الاستاذ "${instrUsername.trim()}" بنجاح!`,
      );
      setInstrUsername("");
      setInstrPassword("");
      fetchData();
    } catch (err) {
      showMessage("error", "خطأ: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // ── Add Student Only ──
  const handleAddStudentOnly = async (e) => {
    if (e) e.preventDefault();
    if (
      !stuName.trim() ||
      !stuId.trim() ||
      !stuEmail.trim() ||
      !stuPassword.trim() ||
      !stuInstructor
    ) {
      showMessage("error", "يرجى ملء جميع الحقول واختيار الاستاذ.");
      return;
    }
    setLoading(true);
    try {
      // Check if student already exists
      const { data: existingStudent } = await supabase
        .from("students")
        .select("student_id")
        .eq("student_id", stuId.trim())
        .limit(1);
        
      if (existingStudent && existingStudent.length > 0) {
        showMessage("error", `الطالب صاحب الرقم "${stuId.trim()}" مسجل مسبقاً.`);
        setLoading(false);
        return;
      }

      const hashedPassword = bcrypt.hashSync(stuPassword.trim(), 10);
      const { error } = await supabase.from("students").insert([
        {
          student_id: stuId.trim(),
          name: stuName.trim(),
          email: stuEmail.trim(),
          password: hashedPassword,
          instructor_id: parseInt(stuInstructor),
        },
      ]);
      if (error) throw error;
      showMessage(
        "success",
        `تم إضافة الطالب "${stuName.trim()}" لقاعدة البيانات بنجاح!`,
      );
      fetchData();
    } catch (err) {
      showMessage("error", "خطأ: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // ── Send Email Only ──
  const handleSendEmailOnly = async (e) => {
    if (e) e.preventDefault();
    if (
      !stuName.trim() ||
      !stuId.trim() ||
      !stuEmail.trim() ||
      !stuPassword.trim()
    ) {
      showMessage("error", "يرجى ملء جميع الحقول قبل إرسال الإيميل.");
      return;
    }
    setLoading(true);
    try {
      await emailjs.send(
        import.meta.env.VITE_EMAILJS_SERVICE_ID,
        import.meta.env.VITE_EMAILJS_TEMPLATE_ID,
        {
          to_email: stuEmail.trim(),
          student_name: stuName.trim(),
          student_id: stuId.trim(),
          password: stuPassword.trim(),
        },
        import.meta.env.VITE_EMAILJS_PUBLIC_KEY,
      );
      showMessage(
        "success",
        `تم إرسال الايميل اللي فيه الباسوورد للطالب بنجاح!`,
      );
    } catch (emailErr) {
      console.error("EmailJS error:", emailErr);
      showMessage("error", "فشل إرسال الإيميل. تأكد من إعدادات EmailJS.");
    } finally {
      setLoading(false);
    }
  };

  const handleClearForm = () => {
    setStuName("");
    setStuId("");
    setStuEmail("");
    setStuPassword("");
    setStuInstructor("");
  };

  // ── Delete ──
  const handleDeleteInstructor = async (id) => {
    if (!confirm("هل أنت متأكد من حذف هذا الاستاذ بشكل نهائي؟ (سيتم حذف جميع الطلاب والاختبارات المرتبطة به)")) return;
    setLoading(true);
    try {
      const { error } = await supabase.rpc("admin_delete_instructor", { p_instructor_id: id });
      if (error) throw error;
      showMessage("success", "تم حذف الاستاذ وجميع بياناته بنجاح!");
      fetchData();
    } catch (err) {
      console.error(err);
      showMessage("error", "خطأ في الحذف: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteStudent = async (studentId) => {
    if (!confirm("هل أنت متأكد من حذف هذا الطالب بشكل نهائي؟ (سيتم حذف جميع اختباراته المرتبطة به)")) return;
    setLoading(true);
    try {
      const { error } = await supabase.rpc("admin_delete_student", { p_student_id: studentId });
      if (error) throw error;
      showMessage("success", "تم حذف الطالب وجميع اختباراته بنجاح!");
      fetchData();
    } catch (err) {
      console.error(err);
      showMessage("error", "خطأ في الحذف: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResendPassword = async (stu) => {
    if (!stu.email) {
      showMessage("error", "لا يوجد بريد إلكتروني مسجل لهذا الطالب.");
      return;
    }
    const newPassword = prompt(
      `أدخل كلمة المرور الجديدة التي سيتم تعيينها وإرسالها للطالب ${stu.name || stu.student_id}:`,
    );
    if (!newPassword || !newPassword.trim()) return;

    setLoading(true);
    try {
      const hashedPassword = bcrypt.hashSync(newPassword.trim(), 10);

      // Update the password in database
      const { error } = await supabase
        .from("students")
        .update({ password: hashedPassword })
        .eq("student_id", stu.student_id);
      if (error) throw error;

      // Send the new password via email
      await emailjs.send(
        import.meta.env.VITE_EMAILJS_SERVICE_ID,
        import.meta.env.VITE_EMAILJS_TEMPLATE_ID,
        {
          to_email: stu.email,
          student_name: stu.name || "طالب",
          student_id: stu.student_id,
          password: newPassword.trim(),
        },
        import.meta.env.VITE_EMAILJS_PUBLIC_KEY,
      );
      showMessage(
        "success",
        `تم تعيين كلمة المرور الجديدة وإرسالها بنجاح إلى ${stu.email}`,
      );
    } catch (err) {
      console.error(err);
      showMessage("error", "حدث خطأ أثناء المعالجة: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const sections = [
    {
      id: "addInstructor",
      label: "إضافة استاذ",
      icon: <GraduationCap size={20} />,
    },
    { id: "addStudent", label: "إضافة طالب", icon: <UserPlus size={20} /> },
    { id: "viewInstructors", label: "عرض الاساتذة", icon: <Users size={20} /> },
    { id: "viewStudents", label: "عرض الطلاب", icon: <Search size={20} /> },
  ];

  const inputStyle = {
    width: "100%",
    padding: "14px 18px",
    borderRadius: "12px",
    background: "rgba(15, 23, 42, 0.5)",
    border: "1px solid rgba(148, 163, 184, 0.2)",
    color: "#f8fafc",
    outline: "none",
    fontSize: "0.95rem",
    transition: "border-color 0.2s, box-shadow 0.2s",
  };

  const labelStyle = {
    display: "block",
    color: "#cbd5e1",
    marginBottom: "8px",
    fontSize: "0.9rem",
    fontWeight: 500,
  };

  return (
    <div className="admin-layout">
      {/* Top Navbar */}
      <nav className="admin-navbar">
        <div className="admin-nav-brand">
          <div className="admin-nav-icon">
            <Shield size={28} />
          </div>
          <div>
            <h1 className="admin-nav-title">
              لوحة تحكم الأدمن
            </h1>
            <span className="admin-nav-subtitle">
              Admin Control Panel
            </span>
          </div>
        </div>

        <button
          onClick={onBack}
          className="admin-logout-btn"
        >
          <LogOut size={18} />
          <span>تسجيل الخروج</span>
        </button>
      </nav>

      <div className="admin-body">
        {/* Sidebar */}
        <aside className="admin-sidebar">
          {sections.map((sec) => (
            <button
              key={sec.id}
              onClick={() => setActiveSection(sec.id)}
              className={`admin-sidebar-btn ${activeSection === sec.id ? "active" : ""}`}
            >
              {sec.icon}
              {sec.label}
            </button>
          ))}
        </aside>

        {/* Main Content */}
        <main className="admin-main">
          {/* Message Toast */}
          {message.text && (
            <div
              style={{
                padding: "16px 24px",
                borderRadius: "12px",
                marginBottom: "24px",
                background:
                  message.type === "success"
                    ? "rgba(16, 185, 129, 0.15)"
                    : "rgba(239, 68, 68, 0.15)",
                border: `1px solid ${message.type === "success" ? "rgba(16,185,129,0.3)" : "rgba(239,68,68,0.3)"}`,
                color: message.type === "success" ? "#34d399" : "#f87171",
                fontSize: "0.95rem",
                fontWeight: 500,
                animation: "fadeIn 0.3s ease-out",
              }}
            >
              {message.text}
            </div>
          )}

          {/* ── Add Instructor Form ── */}
          {activeSection === "addInstructor" && (
            <div>
              <h2 className="admin-section-title">
                إضافة استاذ جديد
              </h2>
              <p className="admin-section-desc">
                أضف حساب استاذ جديد للنظام
              </p>

              <form
                onSubmit={handleAddInstructor}
                className="admin-form"
              >
                <div>
                  <label style={labelStyle}>اسم المستخدم (Username)</label>
                  <input
                    style={inputStyle}
                    type="text"
                    placeholder="مثال: dr_ahmed"
                    value={instrUsername}
                    onChange={(e) => setInstrUsername(e.target.value)}
                  />
                </div>
                <div>
                  <label style={labelStyle}>كلمة المرور (Password)</label>
                  <input
                    style={inputStyle}
                    type="text"
                    placeholder="اختر كلمة مرور قوية"
                    value={instrPassword}
                    onChange={(e) => setInstrPassword(e.target.value)}
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className={`admin-submit-btn ${loading ? "loading" : ""}`}
                >
                  {loading ? (
                    <span className="auth-spinner" />
                  ) : (
                    <>
                      <GraduationCap size={18} />
                      <span>إضافة الاستاذ</span>
                    </>
                  )}
                </button>
              </form>
            </div>
          )}

          {/* ── Add Student Form ── */}
          {activeSection === "addStudent" && (
            <div>
              <h2 className="admin-section-title">
                إضافة طالب جديد
              </h2>
              <p className="admin-section-desc">
                أضف بيانات الطالب، ثم قرر إذا كنت تريد حفظه في القاعدة أو إرسال
                كلمة المرور.
              </p>

              <form className="admin-form">
                <div>
                  <label style={labelStyle}>اسم الطالب</label>
                  <input
                    style={inputStyle}
                    type="text"
                    placeholder="مثال: أحمد محمد"
                    value={stuName}
                    onChange={(e) => setStuName(e.target.value)}
                  />
                </div>
                <div>
                  <label style={labelStyle}>الرقم الأكاديمي (Student ID)</label>
                  <input
                    style={inputStyle}
                    type="text"
                    placeholder="مثال: 202301234"
                    value={stuId}
                    onChange={(e) => setStuId(e.target.value)}
                  />
                </div>
                <div>
                  <label style={labelStyle}>الإيميل الجامعي</label>
                  <div style={{ position: "relative" }}>
                    <input
                      style={{ ...inputStyle, paddingLeft: "44px" }}
                      type="email"
                      placeholder="student@university.edu"
                      value={stuEmail}
                      onChange={(e) => setStuEmail(e.target.value)}
                    />
                    <Mail
                      size={18}
                      style={{
                        position: "absolute",
                        left: "14px",
                        top: "50%",
                        transform: "translateY(-50%)",
                        color: "#64748b",
                      }}
                    />
                  </div>
                </div>
                <div>
                  <label style={labelStyle}>كلمة المرور</label>
                  <input
                    style={inputStyle}
                    type="text"
                    placeholder="اختر كلمة مرور للطالب"
                    value={stuPassword}
                    onChange={(e) => setStuPassword(e.target.value)}
                  />
                </div>
                <div>
                  <label style={labelStyle}>الاستاذ المسؤول</label>
                  <select
                    style={{...inputStyle, appearance: "auto", cursor: "pointer"}}
                    value={stuInstructor}
                    onChange={(e) => setStuInstructor(e.target.value)}
                  >
                    <option value="" disabled>اختر الاستاذ</option>
                    {instructors.map(inst => (
                      <option key={inst.id} value={inst.id}>{inst.username}</option>
                    ))}
                  </select>
                </div>

                <div
                  style={{ display: "flex", gap: "12px", marginTop: "10px" }}
                >
                  <button
                    type="button"
                    onClick={handleAddStudentOnly}
                    disabled={loading}
                    style={{
                      flex: 1,
                      padding: "14px",
                      borderRadius: "12px",
                      border: "none",
                      cursor: "pointer",
                      background: "linear-gradient(135deg, #3b82f6, #2563eb)",
                      color: "#fff",
                      fontSize: "0.95rem",
                      fontWeight: 600,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "8px",
                      opacity: loading ? 0.6 : 1,
                      transition: "all 0.2s",
                      boxShadow: "0 4px 15px rgba(59, 130, 246, 0.3)",
                    }}
                  >
                    {loading ? (
                      <span className="auth-spinner" />
                    ) : (
                      <>
                        <UserPlus size={18} />
                        <span>إضافة للسجل</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={handleSendEmailOnly}
                    disabled={loading}
                    style={{
                      flex: 1,
                      padding: "14px",
                      borderRadius: "12px",
                      border: "solid 1px #3b82f6",
                      cursor: "pointer",
                      background: "rgba(59, 130, 246, 0.1)",
                      color: "#60a5fa",
                      fontSize: "0.95rem",
                      fontWeight: 600,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "8px",
                      opacity: loading ? 0.6 : 1,
                      transition: "all 0.2s",
                    }}
                  >
                    {loading ? (
                      <span className="auth-spinner" />
                    ) : (
                      <>
                        <Mail size={18} />
                        <span>إرسال الباسوورد</span>
                      </>
                    )}
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleClearForm}
                  style={{
                    background: "transparent",
                    color: "#64748b",
                    border: "none",
                    textDecoration: "underline",
                    cursor: "pointer",
                    marginTop: "8px",
                    padding: "8px",
                    width: "fit-content",
                    margin: "0 auto",
                  }}
                >
                  تفريغ الحقول (طالب جديد)
                </button>
              </form>
            </div>
          )}

          {/* ── View Instructors ── */}
          {activeSection === "viewInstructors" && (
            <div>
              <h2 className="admin-section-title">
                الاساتذة المسجلون
              </h2>
              <p className="admin-section-desc">
                إجمالي: {instructors.length} استاذ
              </p>
              <div className="admin-list-container">
                {instructors.map((inst) => (
                  <div key={inst.id} className="admin-list-item">
                    <div className="admin-list-info">
                      <div className="admin-list-icon">
                        <GraduationCap size={20} />
                      </div>
                      <div>
                        <p className="admin-list-name">
                          {inst.username}
                        </p>
                        <p className="admin-list-sub">
                          ID: {inst.id}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteInstructor(inst.id)}
                      style={{
                        background: "rgba(239,68,68,0.1)",
                        border: "1px solid rgba(239,68,68,0.2)",
                        color: "#f87171",
                        borderRadius: "8px",
                        padding: "8px 12px",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        fontSize: "0.85rem",
                      }}
                    >
                      <Trash2 size={14} />
                      حذف
                    </button>
                  </div>
                ))}
                {instructors.length === 0 && (
                  <p
                    style={{
                      color: "#64748b",
                      textAlign: "center",
                      padding: "40px",
                    }}
                  >
                    لا يوجد اساتذة مسجلون حالياً
                  </p>
                )}
              </div>
            </div>
          )}

          {/* ── View Students ── */}
          {activeSection === "viewStudents" && (
            <div>
              <h2 className="admin-section-title">
                الطلاب المسجلون
              </h2>
              <p className="admin-section-desc">
                إجمالي: {students.length} طالب
              </p>
              <div className="admin-list-container">
                {students.map((stu) => (
                  <div key={stu.student_id} className="admin-list-item">
                    <div className="admin-list-info">
                      <div className="admin-list-icon" style={{ background: "rgba(16,185,129,0.15)", color: "#34d399" }}>
                        <Users size={20} />
                      </div>
                      <div>
                        <p className="admin-list-name">
                          {stu.name || "بدون اسم"}
                        </p>
                        <p className="admin-list-sub">
                          ID: {stu.student_id} • {stu.email || "بدون إيميل"}
                          <br/>
                          <span style={{color: "#818cf8"}}>الاستاذ: {instructors.find(i => i.id === stu.instructor_id)?.username || "غير محدد"}</span>
                        </p>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                      <button
                        onClick={() => handleResendPassword(stu)}
                        disabled={loading}
                        style={{
                          background: "rgba(59,130,246,0.1)",
                          border: "1px solid rgba(59,130,246,0.2)",
                          color: "#60a5fa",
                          borderRadius: "8px",
                          padding: "8px 12px",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: "6px",
                          fontSize: "0.85rem",
                          opacity: loading ? 0.6 : 1,
                        }}
                      >
                        <Mail size={14} />
                        توليد كلمة مرور وإرسالها
                      </button>

                      <button
                        onClick={() => handleDeleteStudent(stu.student_id)}
                        disabled={loading}
                        className="admin-action-btn-danger"
                        style={{ opacity: loading ? 0.6 : 1, display: "flex", alignItems: "center", gap: "6px" }}
                      >
                        <Trash2 size={14} />
                        حذف
                      </button>
                    </div>
                  </div>
                ))}
                {students.length === 0 && (
                  <p
                    style={{
                      color: "#64748b",
                      textAlign: "center",
                      padding: "40px",
                    }}
                  >
                    لا يوجد طلاب مسجلون حالياً
                  </p>
                )}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default AdminDashboard;
