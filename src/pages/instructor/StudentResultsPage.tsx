import { useState, useEffect } from "react";
import { ArrowLeft, Users, Save, Camera, Printer, X } from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import "./StudentResultsPage.css";
import "./tables.css";


function StudentResultsPage({ instructorId, onBack }: { instructorId: any; onBack: any }) {
  const [results, setResults] = useState<any[]>([]);

  const [loading, setLoading] = useState(true);

  // Proctoring Modal State
  const [proctoringModalOpen, setProctoringModalOpen] = useState(false);
  const [proctoringImages, setProctoringImages] = useState<any[]>([]);
  const [loadingImages, setLoadingImages] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);

  useEffect(() => {
    const fetchResults = async () => {
      try {
        const { data, error } = await supabase
          .from("results")
          .select("*")
          .eq("instructor_id", instructorId)
          .order("created_at", { ascending: false });

        if (!error && data) {
          const processed = data.map(r => ({ ...r, _originalGrade: r.instructor_grade }));
          setResults(processed);
        }
      } catch (err) {
        console.error("Error fetching results:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchResults();
  }, []);

  const handleGradeChange = (index: any, value: any) => {
    const newResults = [...results];
    newResults[index].instructor_grade = value;
    setResults(newResults);
  };

  const saveSingleGrade = async (index: any, req: any) => {
    if (!req.instructor_grade) return;
    try {
      const { error } = await supabase
        .from("results")
        .update({ instructor_grade: req.instructor_grade })
        .eq("id", req.id);
      
      if (error) throw error;
      
      const newResults = [...results];
      newResults[index]._originalGrade = req.instructor_grade;
      setResults(newResults);
    } catch (err) {
      console.error("Error saving grade:", err);
      alert("حدث خطأ أثناء حفظ التقييم.");
    }
  };

  const fetchProctoringImages = async (req: any) => {
    setSelectedStudent(req.student_name);
    setProctoringModalOpen(true);
    setLoadingImages(true);
    setProctoringImages([]);

    const safeStudentId = req.student_id.replace(/[^a-zA-Z0-9_-]/g, "_");
    const folderPath = `${req.exam_code}/${safeStudentId}`;

    try {
      const { data, error } = await supabase.storage
        .from("exam_snapshots")
        .list(folderPath);
      if (error) throw error;

      if (data && data.length > 0) {
        const images = data
          .filter((file) => /\.(webp|jpg|jpeg|png)$/i.test(file.name))
          .map((file) => {
            const { data: publicUrlData } = supabase.storage
              .from("exam_snapshots")
              .getPublicUrl(`${folderPath}/${file.name}`);
            const nameWithoutExt = file.name.replace(
              /\.(webp|jpg|jpeg|png)$/i,
              "",
            );
            return {
              name: file.name,
              url: publicUrlData.publicUrl,
              timestamp: parseInt(nameWithoutExt),
            };
          })
          .sort((a, b) => a.timestamp - b.timestamp);

        setProctoringImages(images);
      }
    } catch (err) {
      console.error("Error fetching proctoring images:", err);
    } finally {
      setLoadingImages(false);
    }
  };

  const handlePrintPdf = (req: any) => {
    const finalGrade = req.instructor_grade ? req.instructor_grade : "لم يتم التقييم بعد";
    
    // Extracting a simpler string if student_result is JSON
    let studentResultDisplay = req.student_result;
    try {
      if (studentResultDisplay?.includes("{")) {
        const obj = JSON.parse(studentResultDisplay);
        if (obj.avg !== undefined) {
          studentResultDisplay = `${obj.avg} ${req.unit || ""}`;
        }
      } else {
        if (req.student_result !== "--" && req.student_result !== "--kicked--" && req.student_result !== "--quit--") {
          studentResultDisplay = `${studentResultDisplay} ${req.unit || ""}`;
        }
      }
    } catch {
      /* ignore */
    }

    const htmlContent = `
      <html dir="rtl" lang="ar">
        <head>
          <title>تقرير نتيجة الطالب - ${req.student_name}</title>
          <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 40px; color: #333; }
            .header { text-align: center; border-bottom: 2px solid #3b82f6; padding-bottom: 20px; margin-bottom: 30px; }
            .header h1 { color: #1e3a8a; margin: 0; }
            .header p { color: #6b7280; font-size: 1.1rem; }
            .info-table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
            .info-table th, .info-table td { padding: 12px; border: 1px solid #e5e7eb; text-align: right; font-size: 1.1rem; }
            .info-table th { background-color: #f3f4f6; width: 30%; color: #4b5563; }
            .footer { text-align: center; margin-top: 50px; font-size: 0.9rem; color: #9ca3af; }
            .grade { font-size: 1.5rem; font-weight: bold; color: #10b981; }
            @media print {
              body { padding: 0; margin: 20px; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>إفادة نتيجة معمل الفيزياء</h1>
            <p>تقرير رسمي بنتيجة الطالب في الاختبار العملي</p>
          </div>
          
          <table class="info-table">
            <tr>
              <th>الرقم الأكاديمي (ID)</th>
              <td>${req.student_id}</td>
            </tr>
            <tr>
              <th>اسم الطالب</th>
              <td>${req.student_name}</td>
            </tr>
            <tr>
              <th>التجربة المقررة</th>
              <td>${req.experiment}</td>
            </tr>
            <tr>
              <th>كود الاختبار</th>
              <td>${req.exam_code}</td>
            </tr>
            <tr>
              <th>الدرجة الممنوحة</th>
              <td class="grade">${finalGrade}</td>
            </tr>
          </table>
          
          <div class="footer">
            <p>تم استخراج هذا التقرير تلقائياً من منصة معمل الفيزياء الافتراضي.</p>
            <p>تاريخ الاستخراج: ${new Date().toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
          </div>
        </body>
      </html>
    `;
    
    // Create an invisible iframe to handle printing seamlessly
    const iframe = document.createElement('iframe');
    iframe.style.position = 'absolute';
    iframe.style.width = '0px';
    iframe.style.height = '0px';
    iframe.style.border = 'none';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (doc) {
      doc.open();
      doc.write(htmlContent);
      doc.close();
    }

    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      setTimeout(() => {
        document.body.removeChild(iframe);
      }, 1000);
    }, 500);
  };

  const handlePrintAllPdf = () => {
    if (!results || results.length === 0) {
      alert("لا توجد نتائج لطباعتها.");
      return;
    }

    const rowsHtml = results.map(req => {
      const finalGrade = req.instructor_grade ? req.instructor_grade : "-";
      return `
        <tr>
          <td dir="ltr" style="text-align: right;">${req.student_id}</td>
          <td>${req.student_name}</td>
          <td>${req.experiment}</td>
          <td>${req.exam_code}</td>
          <td style="font-weight: bold; color: #10b981;">${finalGrade}</td>
        </tr>
      `;
    }).join("");

    const htmlContent = `
      <html dir="rtl" lang="ar">
        <head>
          <title>سجل درجات الطلاب المجمع</title>
          <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 40px; color: #333; }
            .header { text-align: center; border-bottom: 2px solid #3b82f6; padding-bottom: 20px; margin-bottom: 30px; }
            .header h1 { color: #1e3a8a; margin: 0; }
            .header p { color: #6b7280; font-size: 1.1rem; }
            .data-table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
            .data-table th, .data-table td { padding: 10px; border: 1px solid #e5e7eb; text-align: center; font-size: 0.95rem; }
            .data-table th { background-color: #f3f4f6; color: #4b5563; font-weight: bold; }
            .footer { text-align: center; margin-top: 50px; font-size: 0.9rem; color: #9ca3af; }
            @media print {
              body { padding: 0; margin: 20px; }
              @page { size: landscape; margin: 1cm; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>سجل درجات الطلاب المجمع</h1>
            <p>تقرير رسمي شامل بنتائج جميع الطلاب في الاختبارات العملية</p>
          </div>
          
          <table class="data-table">
            <thead>
              <tr>
                <th>الرقم الأكاديمي (ID)</th>
                <th>اسم الطالب</th>
                <th>التجربة المقررة</th>
                <th>كود الاختبار</th>
                <th>الدرجة الممنوحة</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
          
          <div class="footer">
            <p>تم استخراج هذا التقرير المجمع تلقائياً من منصة معمل الفيزياء الافتراضي.</p>
            <p>تاريخ الاستخراج: ${new Date().toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
          </div>
        </body>
      </html>
    `;
    
    // Create an invisible iframe to handle printing seamlessly
    const iframe = document.createElement('iframe');
    iframe.style.position = 'absolute';
    iframe.style.width = '0px';
    iframe.style.height = '0px';
    iframe.style.border = 'none';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (doc) {
      doc.open();
      doc.write(htmlContent);
      doc.close();
    }

    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      setTimeout(() => {
        document.body.removeChild(iframe);
      }, 1000);
    }, 500);
  };

  const renderResultData = (dataStr: any, unit: any, isStudent: any, req: any) => {
    if (!dataStr) return "";

    // Check if student is disconnected (ping timeout)
    let isDisconnected = false;
    if (req && req.student_result === "جاري الاختبار...") {
      try {
        let lastPing = null;
        if (req.unit && !isNaN(parseInt(req.unit))) {
          lastPing = parseInt(req.unit);
        } else if (req.created_at) {
          lastPing = new Date(req.created_at).getTime();
        }
        if (lastPing && Date.now() - lastPing > 45000) {
          isDisconnected = true;
        }
      } catch {
        /* ignore */
      }
    }

    // Hide actual result if exam is not completed properly
    if (!isStudent && dataStr === "سيظهر بعد التسليم") {
      if (req && (req.student_result === "--quit--" || req.student_result === "--kicked--" || req.student_result === "--" || isDisconnected)) {
        return <span style={{ color: "var(--text-muted)" }}>-- (لم يكتمل)</span>;
      }
    }

    // Prevent displaying timestamp as a unit string
    let displayUnit = unit || "";
    if (displayUnit && !isNaN(parseInt(displayUnit)) && displayUnit.length > 10) {
      displayUnit = "";
    }

    if (dataStr === "--") return <span style={{ color: "#ef4444" }}>-- (انتهى الوقت)</span>;
    if (dataStr === "--kicked--") return <span style={{ color: "#ef4444", fontWeight: "bold" }}>غياب الكاميرا</span>;
    if (dataStr === "--quit--") return <span style={{ color: "#f59e0b", fontWeight: "bold" }}>منسحب (Withdrawn)</span>;
    
    if (dataStr === "جاري الاختبار...") {
      if (isDisconnected) {
        return <span style={{ color: "#f59e0b", fontWeight: "bold" }}>منسحب (فقد الاتصال) ⚠️</span>;
      }
      return <span style={{ color: "#3b82f6", fontWeight: "bold", animation: "pulse 2s infinite" }}>جاري أداء الاختبار... ⏳</span>;
    }

    try {
      const obj = JSON.parse(dataStr);
      const tableData = obj?.table;
      if (obj && tableData) {
        return (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "8px",
              minWidth: "180px",
            }}
          >
            <span
              style={{
                fontWeight: "bold",
                color: isStudent ? "#10b981" : "var(--text-muted)",
              }}
            >
              Avg: {obj.avg} {displayUnit}
            </span>
            <table
              style={{
                fontSize: "0.75rem",
                width: "100%",
                borderCollapse: "collapse",
                background: "rgba(0,0,0,0.2)",
                color: "var(--text-main)",
                textAlign: "center",
              }}
            >
              <tbody>
                <tr style={{ background: "rgba(255,255,255,0.05)" }}>
                  <th
                    style={{
                      border: "1px solid rgba(255,255,255,0.1)",
                      padding: "4px",
                    }}
                  >
                    B
                  </th>
                  <th
                    style={{
                      border: "1px solid rgba(255,255,255,0.1)",
                      padding: "4px",
                    }}
                  >
                    D
                  </th>
                  <th
                    style={{
                      border: "1px solid rgba(255,255,255,0.1)",
                      padding: "4px",
                    }}
                  >
                    t
                  </th>
                  <th
                    style={{
                      border: "1px solid rgba(255,255,255,0.1)",
                      padding: "4px",
                    }}
                  >
                    v
                  </th>
                  <th
                    style={{
                      border: "1px solid rgba(255,255,255,0.1)",
                      padding: "4px",
                    }}
                  >
                    η
                  </th>
                </tr>
                {tableData.map((row: any, i: any) => (
                  <tr key={i}>
                    <td
                      style={{
                        border: "1px solid rgba(255,255,255,0.1)",
                        padding: "4px",
                        color: "var(--primary)",
                      }}
                    >
                      {row.id}
                    </td>
                    <td
                      style={{
                        border: "1px solid rgba(255,255,255,0.1)",
                        padding: "4px",
                      }}
                    >
                      {row.d}
                    </td>
                    <td
                      style={{
                        border: "1px solid rgba(255,255,255,0.1)",
                        padding: "4px",
                      }}
                    >
                      {row.t}
                    </td>
                    <td
                      style={{
                        border: "1px solid rgba(255,255,255,0.1)",
                        padding: "4px",
                      }}
                    >
                      {row.v}
                    </td>
                    <td
                      style={{
                        border: "1px solid rgba(255,255,255,0.1)",
                        padding: "4px",
                      }}
                    >
                      {row.eta}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      }
    } catch {
      // fallback to plain string
    }
    return (
      <span
        style={{
          fontWeight: 600,
          color: isStudent
            ? (dataStr === "--" || dataStr === "--kicked--" || dataStr === "--quit--")
              ? "#ef4444"
              : "#10b981"
            : "var(--text-muted)",
        }}
      >
        {dataStr} {displayUnit}
      </span>
    );
  };

  return (
    <div className="app-container" style={{ background: "var(--bg-main)", flexDirection: "column", overflowY: "auto" }}>
      {/* Top Header */}
      <header className="results-header-container">
        <div className="results-header-content">
          <div>
            <h2 className="results-title">
              نتائج الطلاب
            </h2>
            <p className="results-subtitle">
              عرض درجات الامتحانات وتقييمها للحفظ أو للطباعة المجمعة
            </p>
          </div>
          <button
            onClick={onBack}
            className="results-back-btn"
          >
            <ArrowLeft size={20} />
            العودة للوحة التحكم
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="results-main">
        <div className="glass-panel results-panel">
          <div className="results-panel-header">
            <div className="results-panel-title">
              <Users size={24} />
              <h3>
                سجل اختبارات العملي
              </h3>
            </div>
            
            <button
              onClick={handlePrintAllPdf}
              className="results-print-btn"
            >
              <Printer size={18} />
              طباعة جميع النتائج (PDF)
            </button>
          </div>

          {loading ? (
            <div
              style={{
                padding: "40px",
                textAlign: "center",
                color: "var(--text-muted)",
              }}
            >
              جاري تحميل النتائج...
            </div>
          ) : results.length === 0 ? (
            <div
              style={{
                padding: "40px",
                textAlign: "center",
                color: "var(--text-muted)",
              }}
            >
              لا توجد أية نتائج للطلاب بعد.
            </div>
          ) : (
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                textAlign: "left",
                fontSize: "0.95rem",
              }}
            >
              <thead>
                <tr
                  style={{
                    background: "rgba(255,255,255,0.05)",
                    color: "var(--text-muted)",
                  }}
                >
                  <th
                    style={{
                      padding: "16px",
                      borderBottom: "1px solid var(--border-color)",
                      fontWeight: 500,
                    }}
                  >
                    التجربة
                  </th>
                  <th
                    style={{
                      padding: "16px",
                      borderBottom: "1px solid var(--border-color)",
                      fontWeight: 500,
                    }}
                  >
                    اسم الطالب
                  </th>
                  <th
                    style={{
                      padding: "16px",
                      borderBottom: "1px solid var(--border-color)",
                      fontWeight: 500,
                    }}
                  >
                    الرقم الأكاديمي (ID)
                  </th>
                  <th
                    style={{
                      padding: "16px",
                      borderBottom: "1px solid var(--border-color)",
                      fontWeight: 500,
                    }}
                  >
                    كود الاختبار
                  </th>
                  <th
                    style={{
                      padding: "16px",
                      borderBottom: "1px solid var(--border-color)",
                      fontWeight: 500,
                    }}
                  >
                    إجابة الطالب
                  </th>
                  <th
                    style={{
                      padding: "16px",
                      borderBottom: "1px solid var(--border-color)",
                      fontWeight: 500,
                    }}
                  >
                    القيمة الفعلية (الصحيحة)
                  </th>
                  <th
                    style={{
                      padding: "16px",
                      borderBottom: "1px solid var(--border-color)",
                      fontWeight: 500,
                    }}
                  >
                    المراقبة
                  </th>
                  <th
                    style={{
                      padding: "16px",
                      borderBottom: "1px solid var(--border-color)",
                      fontWeight: 500,
                    }}
                  >
                    الدرجة
                  </th>
                  <th
                    style={{
                      padding: "16px",
                      borderBottom: "1px solid var(--border-color)",
                      fontWeight: 500,
                      textAlign: "center"
                    }}
                  >
                    إجراءات
                  </th>
                </tr>
              </thead>
              <tbody>
                {results.map((req, index) => (
                  <tr
                    key={req.id || index}
                    style={{
                      borderBottom: "1px solid rgba(255,255,255,0.05)",
                      transition: "background 0.2s",
                    }}
                  >
                    <td style={{ padding: "16px", color: "var(--primary)" }}>
                      {req.experiment}
                    </td>
                    <td style={{ padding: "16px" }}>{req.student_name}</td>
                    <td
                      style={{
                        padding: "16px",
                        fontFamily: "monospace",
                        color: "#a78bfa",
                      }}
                    >
                      {req.student_id}
                    </td>
                    <td style={{ padding: "16px" }}>
                      <span
                        style={{
                          padding: "4px 8px",
                          background: "rgba(255,255,255,0.1)",
                          borderRadius: "4px",
                          fontSize: "0.85rem",
                        }}
                      >
                        {req.exam_code}
                      </span>
                    </td>
                    <td style={{ padding: "16px", verticalAlign: "top" }}>
                      {renderResultData(
                        req.student_result,
                        req.student_result !== "--" ? req.unit : "",
                        true,
                        req
                      )}
                    </td>
                    <td style={{ padding: "16px", verticalAlign: "top" }}>
                      {renderResultData(req.actual_result, req.unit, false, req)}
                    </td>
                    <td style={{ padding: "16px", textAlign: "center" }}>
                      <button
                        onClick={() => fetchProctoringImages(req)}
                        style={{
                          background: "rgba(59, 130, 246, 0.1)",
                          color: "#3b82f6",
                          border: "1px solid #3b82f6",
                          borderRadius: "6px",
                          padding: "6px 12px",
                          fontSize: "0.8rem",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: "6px",
                          margin: "0 auto",
                          transition: "all 0.2s",
                          whiteSpace: "nowrap",
                        }}
                      >
                        <Camera size={14} />
                        معاينة
                      </button>
                    </td>
                    <td style={{ padding: "16px", minWidth: "120px" }}>
                      {req._originalGrade ? (
                        <span style={{ fontSize: "1.1rem", fontWeight: "bold", color: "#10b981", display: "block", textAlign: "center" }}>
                          {req.instructor_grade}
                        </span>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: "8px", alignItems: "center" }}>
                          <input
                            type="text"
                            placeholder="0/10"
                            value={req.instructor_grade || ""}
                            onChange={(e) =>
                              handleGradeChange(index, e.target.value)
                            }
                            style={{
                              width: "80px",
                              padding: "8px",
                              background: "rgba(0,0,0,0.3)",
                              border: "1px solid var(--glass-border)",
                              color: "#fff",
                              borderRadius: "8px",
                              textAlign: "center",
                              outline: "none",
                            }}
                          />
                          <button
                            onClick={() => saveSingleGrade(index, req)}
                            style={{
                              background: "rgba(16, 185, 129, 0.2)",
                              color: "#10b981",
                              border: "none",
                              borderRadius: "6px",
                              padding: "4px 12px",
                              fontSize: "0.8rem",
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              gap: "4px",
                              fontWeight: "bold",
                            }}
                          >
                            <Save size={14} />
                            حفظ
                          </button>
                        </div>
                      )}
                    </td>
                    <td style={{ padding: "16px", textAlign: "center" }}>
                      <button
                        onClick={() => handlePrintPdf(req)}
                        title="طبع التقرير کـ PDF"
                        style={{
                          background: "rgba(16, 185, 129, 0.1)",
                          color: "#10b981",
                          border: "1px solid #10b981",
                          borderRadius: "6px",
                          padding: "6px 12px",
                          fontSize: "0.8rem",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: "6px",
                          margin: "0 auto",
                          transition: "all 0.2s",
                          whiteSpace: "nowrap",
                        }}
                      >
                        <Printer size={14} />
                        طباعة
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>

      {/* Proctoring Modal */}
      {proctoringModalOpen && (
        <div className="proctor-modal-overlay">
          <div className="proctor-modal-content">
            <div className="proctor-modal-header">
              <div className="proctor-modal-title">
                <Camera size={20} color="var(--primary)" />
                <h3>
                  لقطات المراقبة:{" "}
                  <span style={{ color: "var(--primary)", fontWeight: 600 }}>
                    {selectedStudent}
                  </span>
                </h3>
              </div>
              <button
                onClick={() => setProctoringModalOpen(false)}
                className="proctor-modal-close"
              >
                <X size={24} />
              </button>
            </div>
            
            <div className="proctor-modal-body">
            {loadingImages ? (
              <p
                style={{
                  textAlign: "center",
                  color: "var(--text-muted)",
                  padding: "40px",
                }}
              >
                جاري تحميل الصور من قاعدة البيانات...
              </p>
            ) : proctoringImages.length === 0 ? (
              <p
                style={{
                  textAlign: "center",
                  color: "var(--text-muted)",
                  padding: "60px",
                  background: "rgba(255,255,255,0.02)",
                  borderRadius: "12px",
                  border: "1px dashed rgba(255,255,255,0.1)",
                }}
              >
                لا توجد لقطات مسجلة لهذا الطالب.
                <br /> (إما أنه لم يفعل الكاميرا، أو اختباره كان بدون تفعيل الـ
                SEB).
              </p>
            ) : (
              <div className="proctor-grid">
                {proctoringImages.map((img, idx) => (
                  <div key={idx} className="proctor-image-card">
                    <div className="proctor-image-wrapper">
                      <img
                        src={img.url}
                        alt={`Snapshot ${idx}`}
                      />
                    </div>
                    <div className="proctor-image-footer">
                      <span>اللقطة #{idx + 1}</span>
                      <span style={{ color: "var(--text-muted)" }}>
                        {new Date(img.timestamp).toLocaleTimeString("ar-EG", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default StudentResultsPage;
