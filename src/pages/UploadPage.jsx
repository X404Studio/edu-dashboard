import Sidebar from "../components/Sidebar";
import { useState, useEffect, useCallback } from "react";
import * as XLSX from "xlsx";
import { setDashboardData } from "../data/dashboardData";
import { UploadOutlined, FileExcelOutlined, CheckCircleOutlined, EyeOutlined, DeleteOutlined, DatabaseOutlined, WarningFilled } from "@ant-design/icons";
import { Layout, Card, Button, Modal, message, Empty, Select, Table, Alert, Tag, Popconfirm, Space, Input } from "antd";

const { Header, Content } = Layout;
 
// ตั้งค่า URL ของ Backend
const API = import.meta.env.VITE_API_URL || "http://localhost:8000";
 
// เดาตารางที่น่าจะตรงจากชื่อไฟล์แบบเบาๆ (แค่ pre-select ให้ ผู้ใช้ยังต้องยืนยันเองผ่าน preview)
function guessTableFromFilename(filename, tables) {
  const clean = filename.toLowerCase();
  const keywordMap = {
    tcas_admission: ["tcas"],
    student_enrollment: ["ลงทะเบียน", "enrollment"],
    student_retention: ["คงอยู่", "retention"],
    graduate_employment: ["งานทำ", "employment"],
    curriculum_quality: ["หลักสูตร", "curriculum"],
    graduate_quality: ["บัณฑิต", "graduate"],
    h_index: ["hindex", "h-index"],
    research_output: ["วิจัย", "research"],
    student_status: ["สถานภาพ", "status"],
  };
  for (const [tableName, keywords] of Object.entries(keywordMap)) {
    if (keywords.some((k) => clean.includes(k))) {
      const exists = tables.find((t) => t.table_name === tableName);
      if (exists) return tableName;
    }
  }
  return undefined;
}
 
function UploadPage() {
  // ── State: รายชื่อตารางจาก backend (มี row_count ด้วย) ──────────
  const [tables, setTables] = useState([]);
  const [tableName, setTableName] = useState(undefined);
  const [tablesLoading, setTablesLoading] = useState(false);
 
  // ── State: ไฟล์ที่เลือก ──────────────────────────────────────────
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileName, setFileName] = useState("");
 
  // ── State: ผลลัพธ์จาก /preview และ modal ────────────────────────
  const [previewData, setPreviewData] = useState(null);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
 
  // ── State: modal ดูข้อมูลในตาราง ──────────────────────────────────
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [viewData, setViewData] = useState(null);
  const [viewLoading, setViewLoading] = useState(false);
 
  // ── โหลดรายชื่อตาราง (เรียกซ้ำได้หลัง insert/delete เพื่อ refresh row_count) ──
  const fetchTables = () => {
    setTablesLoading(true);
    fetch(`${API}/api/tables`)
      .then((res) => res.json())
      .then((data) => setTables(data))
      .catch(() =>
        message.error("โหลดรายชื่อตารางไม่ได้ — ตรวจสอบว่า Backend กำลังทำงานอยู่")
      )
      .finally(() => setTablesLoading(false));
  };
 
  useEffect(() => {
    fetchTables();
  }, []);
 
  // ── เลือกไฟล์ ──
  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (!file) return;
 
    const ext = file.name.split(".").pop().toLowerCase();
    if (!["xlsx", "csv"].includes(ext)) {
      message.error("รองรับเฉพาะไฟล์ .xlsx และ .csv เท่านั้น");
      return;
    }
 
    setSelectedFile(file);
    setFileName(file.name);
 
    // เดาตารางให้เบาๆ จากชื่อไฟล์
    if (!tableName) {
      const guessed = guessTableFromFilename(file.name, tables);
      if (guessed) {
        setTableName(guessed);
        message.info(`ระบบเดาว่าไฟล์นี้น่าจะเป็นตาราง "${guessed}" — กรุณาตรวจสอบก่อนยืนยัน`);
      }
    }
  };
 
  // ── Step 1: ส่งไฟล์ไปตรวจสอบ (preview) ───────────────────────────
  const handlePreview = async () => {
    if (!tableName) {
      message.warning("กรุณาเลือกตารางก่อน");
      return;
    }
    if (!selectedFile) {
      message.warning("กรุณาเลือกไฟล์ก่อน");
      return;
    }
 
    setLoading(true);
    const form = new FormData();
    form.append("table_name", tableName);
    form.append("file", selectedFile);
 
    try {
      const res = await fetch(`${API}/api/upload/preview`, {
        method: "POST",
        body: form,
      });
      const data = await res.json();
 
      if (!res.ok) {
        const detail = Array.isArray(data.detail)
          ? data.detail.join(" / ")
          : data.detail || "เกิดข้อผิดพลาด";
        message.error(detail);
        return;
      }
 
      setPreviewData(data);
      setPreviewModalOpen(true);
    } catch (err) {
      message.error("เชื่อมต่อ Backend ไม่ได้ — ตรวจสอบ API URL และการเชื่อมต่อ");
    } finally {
      setLoading(false);
    }
  };
 
  // ── Step 2: ยืนยันนำเข้าจริง (confirm) ───────────────────────────
  const handleConfirm = () => {
    Modal.confirm({
      title: `ยืนยันการนำเข้าข้อมูล ${previewData.total_rows} แถว?`,
      content: `ตาราง: ${tableName} — การกระทำนี้จะบันทึกข้อมูลลงฐานข้อมูลจริง`,
      okText: "ยืนยันนำเข้า",
      cancelText: "ยกเลิก",
      onOk: async () => {
        setLoading(true);
        try {
          const res = await fetch(`${API}/api/upload/confirm`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              table_name: tableName,
              session_data: previewData.session_data,
            }),
          });
          const result = await res.json();
 
          if (!res.ok) {
            message.error(result.detail || "นำเข้าไม่สำเร็จ");
            return;
          }
 
          if (result.status === "ok") {
            message.success(
              `นำเข้าสำเร็จ ${result.inserted} แถว` +
                (result.skipped ? ` (ข้ามซ้ำ ${result.skipped} แถว)` : "")
            );
          } else {
            message.warning(
              `นำเข้าบางส่วน: สำเร็จ ${result.inserted} / ผิดพลาด ${result.error_count} แถว`
            );
          }
 
          setPreviewModalOpen(false);
          setPreviewData(null);
          setSelectedFile(null);
          setFileName("");
          setTableName(undefined);
          fetchTables();
        } catch (err) {
          message.error("เชื่อมต่อ Backend ไม่ได้ระหว่างนำเข้าข้อมูล");
        } finally {
          setLoading(false);
        }
      },
    });
  };
 
  // ── ดูข้อมูลในตาราง ────────────────────────────────────────────────
  const handleViewData = async (table) => {
    setViewLoading(true);
    setViewModalOpen(true);
    try {
      const res = await fetch(`${API}/api/tables/${table.table_name}/data?limit=100`);
      const data = await res.json();
      if (!res.ok) {
        message.error(data.detail || "โหลดข้อมูลไม่สำเร็จ");
        setViewModalOpen(false);
        return;
      }
      setViewData(data);
    } catch (err) {
      message.error("เชื่อมต่อ Backend ไม่ได้");
      setViewModalOpen(false);
    } finally {
      setViewLoading(false);
    }
  };
 
  // ── ลบข้อมูลทั้งตาราง ────────────────────────────────────────────
  const handleDeleteData = async (table) => {
    try {
      const res = await fetch(`${API}/api/tables/${table.table_name}/data`, {
        method: "DELETE",
      });
      const result = await res.json();
      if (!res.ok) {
        message.error(result.detail || "ลบข้อมูลไม่สำเร็จ");
        return;
      }
      message.success(result.message);
      fetchTables(); // รีเฟรช row_count
    } catch (err) {
      message.error("เชื่อมต่อ Backend ไม่ได้ระหว่างลบข้อมูล");
    }
  };
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const openDeleteModal = (table) => {
   setDeleteTarget(table);
   setDeleteConfirmText("");
  };

  const confirmDelete = async () => {
   try {
     const res = await fetch(`${API}/api/tables/${deleteTarget.table_name}/data`, {
       method: "DELETE",
      });
     const result = await res.json();
     if (!res.ok) {
       message.error(result.detail || "ลบข้อมูลไม่สำเร็จ");
       return;
     }
     message.success(result.message);
     setDeleteTarget(null);
     fetchTables();
   } catch (err) {
      message.error("เชื่อมต่อ Backend ไม่ได้ระหว่างลบข้อมูล");
    }
  };
  // ── สร้าง columns สำหรับ antd Table จาก preview ──────────────────
  const previewColumns =
    previewData?.columns.map((col) => ({
      title: col,
      dataIndex: col,
      key: col,
      ellipsis: true,
      width: 140,
    })) || [];
 
  const viewColumns =
    viewData?.columns.map((col) => ({
      title: col,
      dataIndex: col,
      key: col,
      ellipsis: true,
      width: 140,
    })) || [];
 
  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Sidebar />
      <Layout>
        <Header
          style={{
            background: "white",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "20px 20px",
            height: "auto",
            lineHeight: "normal",
          }}
        >
          <div style={{ paddingTop: 10 }}>
            <h2 style={{ margin: 0 }}>Data Management</h2>
            <div style={{ color: "#888", fontSize: 13, marginTop: 2 }}>
              จัดการข้อมูล อัปโหลด และนำเข้าสู่ฐานข้อมูล PostgreSQL โดยตรง
            </div>
          </div>
        </Header>
 
        <Content style={{ padding: "16px 32px 32px 32px", background: "#f5f5f5" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "55% 45%",
              gap: 20,
              alignItems: "start",
            }}
          >
            {/* ฝั่งซ้าย: อัปโหลดไฟล์ */}
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <Card
                title="นำเข้าข้อมูลเข้าฐานข้อมูล"
                style={{ borderRadius: 16, boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}
                bodyStyle={{ padding: 20 }}
              >
                {/* เลือกตาราง */}
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: "block", marginBottom: 6, fontWeight: 500, fontSize: 13 }}>
                    เลือกตารางปลายทาง
                  </label>
                  <Select
                    style={{ width: "100%" }}
                    placeholder="— เลือกตาราง —"
                    value={tableName}
                    onChange={setTableName}
                    options={tables.map((t) => ({
                      value: t.table_name,
                      label: `${t.label} (${t.table_name}) — ${t.row_count} แถว`,
                    }))}
                  />
                </div>
 
                {/* เลือกไฟล์ */}
                <div
                  style={{
                    border: "2px dashed #d9d9d9",
                    padding: "20px 16px",
                    borderRadius: 12,
                    textAlign: "center",
                    background: "#fafafa",
                    marginBottom: 16,
                  }}
                >
                  <UploadOutlined style={{ fontSize: 24, color: "#888", marginBottom: 8 }} />
                  <div>
                    <label htmlFor="file-upload" style={{ cursor: "pointer", color: "#3b82f6", fontWeight: 600 }}>
                      คลิกเลือกไฟล์ข้อมูล
                    </label>
                    <input
                      id="file-upload"
                      type="file"
                      accept=".xlsx,.csv"
                      onChange={handleFileChange}
                      style={{ display: "none" }}
                    />
                  </div>
                  <div style={{ fontSize: 11, color: "#aaa", marginTop: 4 }}>
                    รองรับ .xlsx และ .csv (รวม CSV UTF-8)
                  </div>
                </div>
 
                {fileName && (
                  <div
                    style={{
                      background: "#f9fafb",
                      padding: 12,
                      borderRadius: 10,
                      border: "1px solid #e5e7eb",
                      marginBottom: 16,
                      fontSize: 13,
                    }}
                  >
                    <FileExcelOutlined style={{ color: "#10b981", marginRight: 6 }} />
                    <b>ไฟล์ที่เลือก:</b> {fileName}
                  </div>
                )}
 
                <Button
                  type="primary"
                  icon={<CheckCircleOutlined />}
                  disabled={!selectedFile || !tableName}
                  loading={loading}
                  onClick={handlePreview}
                  style={{ width: "100%", height: 40, borderRadius: 8 }}
                >
                  ตรวจสอบไฟล์ก่อนนำเข้า
                </Button>
              </Card>
            </div>
 
            {/* ฝั่งขวา: คลังข้อมูลปัจจุบัน — ดู/ลบได้ต่อตาราง */}
            <Card
              title={
                <span>
                  <DatabaseOutlined style={{ marginRight: 8, color: "#0077b6" }} />
                  คลังข้อมูลปัจจุบันในระบบ
                </span>
              }
              style={{ borderRadius: 16, boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}
              bodyStyle={{ padding: 20 }}
              loading={tablesLoading}
            >
              <p style={{ color: "#666", fontSize: 13, marginBottom: 16 }}>
                จำนวนแถวจริงในแต่ละตาราง — กด "ดูข้อมูล" เพื่อตรวจสอบ หรือ "ลบ" เพื่อล้างข้อมูลทั้งตาราง
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {tables.map((t) => (
                  <div
                    key={t.table_name}
                    style={{
                      padding: "12px 14px",
                      background: tableName === t.table_name ? "#f0f7ff" : "#fff",
                      border: "1px solid #e5e7eb",
                      borderRadius: 10,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                        <div
                          style={{
                            width: 6,
                            height: 6,
                            borderRadius: "50%",
                            background: t.row_count > 0 ? "#52c41a" : "#d9d9d9",
                            flexShrink: 0,
                          }}
                        />
                        <span style={{ fontWeight: 500, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis" }}>
                          {t.label}
                        </span>
                      </div>
                      <Tag color={t.row_count > 0 ? "green" : "default"}>{t.row_count} แถว</Tag>
                    </div>
                    <Space size="small">
                      <Button
                        size="small"
                        icon={<EyeOutlined />}
                        onClick={() => handleViewData(t)}
                        disabled={t.row_count === 0}
                      >
                        ดูข้อมูล
                      </Button>
                      <Button
                        size="small"
                        danger
                        icon={<DeleteOutlined />}
                        onClick={() => openDeleteModal(t)}
                        disabled={t.row_count === 0}
                        >
                          ลบข้อมูล
                        </Button>
                    </Space>
                  </div>
                ))}
                {tables.length === 0 && !tablesLoading && (
                  <Empty description="โหลดรายชื่อตารางไม่ได้" style={{ padding: "20px 0" }} />
                )}
              </div>
            </Card>
          </div>
        </Content>
      </Layout>
 
      {/* ── Preview Modal (ก่อนนำเข้า) ── */}
      <Modal
        title="ตัวอย่างข้อมูลก่อนนำเข้า"
        open={previewModalOpen}
        onCancel={() => setPreviewModalOpen(false)}
        width={900}
        footer={[
          <Button key="cancel" onClick={() => setPreviewModalOpen(false)}>
            ยกเลิก
          </Button>,
          <Button key="confirm" type="primary" loading={loading} onClick={handleConfirm}>
            ยืนยันนำเข้า {previewData?.total_rows} แถว
          </Button>,
        ]}
      >
        {previewData && (
          <>
            <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
              <Tag color="blue">ทั้งหมด {previewData.total_rows} แถว</Tag>
              <Tag color="orange">ตัดแถวสรุปออก {previewData.removed_rows} แถว</Tag>
              <Tag color="default">Encoding: {previewData.encoding}</Tag>
            </div>
 
            {previewData.warnings?.length > 0 && (
              <Alert
                type="warning"
                showIcon
                style={{ marginBottom: 16 }}
                message="ข้อควรระวัง"
                description={
                  <ul style={{ margin: 0, paddingLeft: 18 }}>
                    {previewData.warnings.map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                }
              />
            )}
 
            <Table
              dataSource={previewData.preview.map((row, i) => ({ ...row, key: i }))}
              columns={previewColumns}
              size="small"
              scroll={{ x: true }}
              pagination={false}
            />
          </>
        )}
      </Modal>
 
      {/* ── View Data Modal (ดูข้อมูลที่มีอยู่จริงในตาราง) ── */}
      <Modal
        title={viewData ? `ข้อมูลในตาราง: ${viewData.label}` : "กำลังโหลด..."}
        open={viewModalOpen}
        onCancel={() => {
          setViewModalOpen(false);
          setViewData(null);
        }}
        width={1000}
        footer={[
          <Button key="close" onClick={() => setViewModalOpen(false)}>
            ปิด
          </Button>,
        ]}
      >
        {viewData && (
          <>
            <div style={{ marginBottom: 16 }}>
              <Tag color="blue">ทั้งหมดในตาราง {viewData.total_rows} แถว</Tag>
              <Tag color="default">แสดง {viewData.showing} แถวแรก</Tag>
            </div>
            <Table
              loading={viewLoading}
              dataSource={viewData.rows.map((row, i) => ({ ...row, key: i }))}
              columns={viewColumns}
              size="small"
              scroll={{ x: true, y: 400 }}
              pagination={{ 
                        defaultPageSize: 10,
                        pageSizeOptions: ["10", "20", "50", "100"],
                        showSizeChanger: true,
                        showTotal: (total) => `รวม ${total} รายการ`
                      }}
            />
          </>
        )}
      </Modal>
      {/* ── Delete Confirmation Modal — เด่นชัด บังคับพิมพ์ยืนยัน ── */}
      <Modal
       title={
          <span style={{ color: "#cf1322" }}>
            <WarningFilled style={{ marginRight: 8 }} />
           ยืนยันการลบข้อมูลทั้งตาราง
         </span>
       }
        open={!!deleteTarget}
        onCancel={() => setDeleteTarget(null)}
        footer={[
          <Button key="cancel" onClick={() => setDeleteTarget(null)}>
           ยกเลิก
          </Button>,
          <Button
           key="confirm"
            danger
           type="primary"
           disabled={deleteConfirmText !== deleteTarget?.table_name}
           onClick={confirmDelete}
          >
            ลบถาวร — ไม่สามารถกู้คืนได้
         </Button>,
        ]}
      >
        {deleteTarget && (
          <>
           <Alert
              type="error"
              showIcon
             icon={<WarningFilled />}
             style={{ marginBottom: 16, fontWeight: 500 }}
             message={`กำลังจะลบข้อมูล ${deleteTarget.row_count} แถว ในตาราง "${deleteTarget.label}"`}
             description="การกระทำนี้ลบข้อมูลทั้งหมดออกจากฐานข้อมูลทันทีและไม่สามารถกู้คืนได้ ต้องอัปโหลดไฟล์ใหม่เพื่อกู้ข้อมูลกลับ"
           />
           <p style={{ marginBottom: 8, fontSize: 13 }}>
              พิมพ์ชื่อตาราง <b style={{ color: "#cf1322" }}>{deleteTarget.table_name}</b> เพื่อยืนยัน
            </p>
            <Input
             placeholder={deleteTarget.table_name}
             value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
             status={deleteConfirmText && deleteConfirmText !== deleteTarget.table_name ? "error" : ""}
            />
         </>
       )}
      </Modal>
    </Layout>
  );
}
 
export default UploadPage;
