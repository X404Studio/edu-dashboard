import { Layout, Table, Button, Progress, Card, Empty, Tabs, Tag, Badge } from "antd";
import Sidebar from "../components/Sidebar";
import { useMemo, useState, useEffect } from "react";
import {
  ComposedChart,
  Bar,
  XAxis,
  Line,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LabelList,
  BarChart,
  ReferenceLine,
} from "recharts";
import {
  SearchOutlined,
  SmileOutlined,
  BookOutlined,
  ToolOutlined,
  TeamOutlined,
  RiseOutlined,
  TrophyOutlined,
  AlertOutlined,
  ReloadOutlined,
  StarFilled,
} from "@ant-design/icons";

const { Header, Content } = Layout;

function StudentSatisfactionPage() {
  const [selectedYear, setSelectedYear] = useState("");
  const [selectedMajor, setSelectedMajor] = useState("");
  const [selectedType, setSelectedType] = useState("");
  const [appliedFilters, setAppliedFilters] = useState({ year: "", major: "", type: "" });
  const [rawData, setRawData] = useState([]);

  const [supportIndexFilter, setSupportIndexFilter] = useState("all");

  // สเตตสำหรับแบนเนอร์วิเคราะห์แนวโน้ม
  const [trendMajor, setTrendMajor] = useState("");

  // โหลดข้อมูลจริงจาก Database
  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL}/api/dashboard-data`)
      .then((response) => {
        if (!response.ok) throw new Error(`Failed to load dashboard data: ${response.status}`);
        return response.json();
      })
      .then((data) => {
        const rows = Array.isArray(data)
          ? data
          : Object.values(data || {}).flatMap((value) => Array.isArray(value) ? value : []);
        setRawData(rows.flatMap((row, index) => {
          const year = extractYear(row["ปีการศึกษา"] ?? row.academic_year);
          const major = cleanString(row["ชื่อสาขา"] ?? row.program_name);
          const evalType = cleanString(row["ประเภทการประเมิน"] ?? row.eval_type);
          const evalIndex = cleanString(row["ดัชนีการประเมิน"] ?? row.eval_index);
          const score = Number(row["คะแนน"] ?? row.score);
          if (!year || !major || !evalType || !evalIndex || !Number.isFinite(score)) return [];
          return [{
            _id: row._id ?? `${year}-${major}-${evalType}-${evalIndex}-${index}`,
            year,
            major,
            evalType,
            evalIndex,
            score,
          }];
        }));
      });
  }, []);

  const cleanString = (str) => {
    if (!str) return "";
    return String(str).replace(/['"]+/g, '').trim();
  };

  const extractYear = (yearStr) => {
    if (!yearStr) return "";
    const match = String(yearStr).match(/\d+/);
    return match ? match[0] : String(yearStr).trim();
  };

  // 2. ดึงรายการตัวเลือก Dropdown
  const years = useMemo(() => {
    return [...new Set(rawData.map((item) => item.year))].filter(Boolean).sort().reverse();
  }, [rawData]);

  const majors = useMemo(() => {
    return [...new Set(rawData.map((item) => item.major))].filter(Boolean).sort();
  }, [rawData]);

  const evalTypes = useMemo(() => {
    return [...new Set(rawData.map((item) => item.evalType))].filter(Boolean);
  }, [rawData]);

  const handleApplyFilters = () => {
    setAppliedFilters({ year: selectedYear, major: selectedMajor, type: selectedType });
  };

  // 3. กรองข้อมูลหลักตามตัวกรองด้านบน
  const filteredData = useMemo(() => {
    return rawData.filter((item) => {
      if (appliedFilters.year && item.year !== appliedFilters.year) return false;
      if (appliedFilters.major && item.major !== appliedFilters.major) return false;
      if (appliedFilters.type && item.evalType !== appliedFilters.type) return false;
      return true;
    });
  }, [rawData, appliedFilters]);

  // 4. คำนวณ KPI แยกตามประเภทการประเมินทั้ง 3 ด้าน
  const kpiStats = useMemo(() => {
    const calcAvgByType = (keyword) => {
      const subset = filteredData.filter((d) => d.evalType.includes(keyword) && d.score > 0);
      if (subset.length === 0) return { avg: 0, text: "0.00", count: 0 };
      const sum = subset.reduce((acc, cur) => acc + cur.score, 0);
      const val = sum / subset.length;
      return { avg: val, text: val.toFixed(2), count: subset.length };
    };

    const validAll = filteredData.filter((d) => d.score > 0);
    const overallVal =
      validAll.length > 0
        ? validAll.reduce((acc, cur) => acc + cur.score, 0) / validAll.length
        : 0;

    return {
      overall: overallVal,
      overallText: overallVal.toFixed(2),
      studentOutcome: calcAvgByType("ผลที่เกิดกับนิสิต"),
      tqfOutcome: calcAvgByType("กรอบมาตรฐานคุณวุฒิ"),
      learningSupport: calcAvgByType("สิ่งสนับสนุนการเรียนรู้"),
      rowCount: filteredData.length,
    };
  }, [filteredData]);

  // แปลงคะแนนเป็นระดับคุณภาพ
  const getQualityBadge = (score) => {
    if (score >= 4.5) return { text: "ดีเยี่ยม (4.50 - 5.00)", color: "#10b981", bg: "rgba(16, 185, 129, 0.15)" };
    if (score >= 4.0) return { text: "ดีมาก (4.00 - 4.49)", color: "#38bdf8", bg: "rgba(56, 189, 248, 0.15)" };
    if (score >= 3.5) return { text: "ดี (3.50 - 3.99)", color: "#fbbf24", bg: "rgba(251, 191, 36, 0.15)" };
    if (score > 0) return { text: "ควรพัฒนา (< 3.50)", color: "#f87171", bg: "rgba(248, 113, 113, 0.15)" };
    return { text: "ไม่มีข้อมูล", color: "#94a3b8", bg: "rgba(148, 163, 184, 0.15)" };
  };

  // 5. ข้อมูลกราฟรายดัชนีการประเมิน: ผลที่เกิดกับนิสิตและ TQF
  const coreChartData = useMemo(() => {
    const subset = filteredData.filter(
      (d) => d.evalType.includes("ผลที่เกิดกับนิสิต") || d.evalType.includes("กรอบมาตรฐานคุณวุฒิ")
    );
    const indexScores = new Map();
    subset.forEach(({ evalIndex, score }) => {
      if (!indexScores.has(evalIndex)) indexScores.set(evalIndex, []);
      indexScores.get(evalIndex).push(score);
    });
    return [...indexScores].map(([name, scores], index) => ({
      name,
      score: Number((scores.reduce((sum, score) => sum + score, 0) / scores.length).toFixed(2)),
      color: ["#0d9488", "#2563eb", "#7c3aed", "#d97706"][index % 4],
    }));
  }, [filteredData]);

  // 6. ข้อมูลกราฟรายดัชนีการประเมิน: สิ่งสนับสนุนการเรียนรู้ + สรุป Top 3 / Bottom 3
  const { allSupportScores, filteredSupportChartData, top3Support, bottom3Support } = useMemo(() => {
    const subset = filteredData.filter((d) => d.evalType.includes("สิ่งสนับสนุนการเรียนรู้"));
    const indexScores = new Map();
    subset.forEach(({ evalIndex, score }) => {
      if (!indexScores.has(evalIndex)) indexScores.set(evalIndex, []);
      indexScores.get(evalIndex).push(score);
    });
    const calculated = [...indexScores].map(([name, scores]) => ({
      name,
      score: Number((scores.reduce((sum, score) => sum + score, 0) / scores.length).toFixed(2)),
    })).sort((a, b) => b.score - a.score);

    const validRanked = calculated.filter((item) => item.score > 0);
    const top3 = validRanked.slice(0, 3);
    const bottom3 = [...validRanked].reverse().slice(0, 3);

    const byIndex =
      supportIndexFilter === "all"
        ? calculated
        : calculated.filter((item) => item.name === supportIndexFilter);

    return {
      allSupportScores: calculated,
      filteredSupportChartData: byIndex,
      top3Support: top3,
      bottom3Support: bottom3,
    };
  }, [filteredData, supportIndexFilter]);

  // 7. ข้อมูลกราฟแนวโน้มรายปีแยกตามประเภทการประเมิน 3 ด้าน
  const trendChartsData = useMemo(() => {
    let subset = rawData;
    if (trendMajor) {
      subset = subset.filter((d) => d.major === trendMajor);
    }

    const yearMap = {};
    subset.forEach((item) => {
      if (!item.year || item.score <= 0) return;
      if (!yearMap[item.year]) {
        yearMap[item.year] = {
          year: `ปีการศึกษา ${item.year}`,
          rawYear: Number(item.year),
          outSum: 0, outCnt: 0,
          tqfSum: 0, tqfCnt: 0,
          supSum: 0, supCnt: 0,
        };
      }
      if (item.evalType.includes("ผลที่เกิดกับนิสิต")) {
        yearMap[item.year].outSum += item.score;
        yearMap[item.year].outCnt += 1;
      } else if (item.evalType.includes("กรอบมาตรฐานคุณวุฒิ")) {
        yearMap[item.year].tqfSum += item.score;
        yearMap[item.year].tqfCnt += 1;
      } else if (item.evalType.includes("สิ่งสนับสนุนการเรียนรู้")) {
        yearMap[item.year].supSum += item.score;
        yearMap[item.year].supCnt += 1;
      }
    });

    return Object.values(yearMap)
      .map((y) => ({
        year: y.year,
        rawYear: y.rawYear,
        studentOutcome: y.outCnt > 0 ? Number((y.outSum / y.outCnt).toFixed(2)) : 0,
        tqfOutcome: y.tqfCnt > 0 ? Number((y.tqfSum / y.tqfCnt).toFixed(2)) : 0,
        learningSupport: y.supCnt > 0 ? Number((y.supSum / y.supCnt).toFixed(2)) : 0,
      }))
      .sort((a, b) => a.rawYear - b.rawYear);
  }, [rawData, trendMajor]);

  // สีแท่งกราฟตามระดับคะแนน
  const getBarColorByScore = (score) => {
    if (score >= 4.5) return "#10b981"; // เขียวมรกต (ดีเยี่ยม)
    if (score >= 4.2) return "#6366f1"; // ม่วงคราม (ดีมาก)
    if (score >= 4.0) return "#0ea5e9"; // ฟ้าสดใส (ดี)
    return "#f59e0b"; // ส้มอำพัน (ควรเฝ้าระวัง/พัฒนา)
  };

  // 8. คอลัมน์ตารางแสดงผลตามข้อมูลรายแถว
  const tableColumns = [
    {
      title: "ปีการศึกษา",
      dataIndex: "year",
      key: "year",
      width: 105,
      align: "center",
      sorter: (a, b) => Number(a.year) - Number(b.year),
      render: (y) => <span style={{ fontWeight: 600, color: "#334155" }}>{y}</span>,
    },
    {
      title: "หลักสูตร / สาขาวิชา",
      dataIndex: "major",
      key: "major",
      width: 240,
      render: (m) => <span style={{ fontWeight: 600, color: "#0f172a" }}>{m}</span>,
    },
    {
      title: "ประเภทการประเมิน",
      dataIndex: "evalType",
      key: "evalType",
      width: 230,
      render: (type) => {
        if (type.includes("ผลที่เกิดกับนิสิต")) {
          return (
            <Tag style={{ background: "#ccfbf1", color: "#0f766e", border: "1px solid #99f6e4", fontWeight: 600, borderRadius: 6 }}>
              {type}
            </Tag>
          );
        }
        if (type.includes("กรอบมาตรฐานคุณวุฒิ")) {
          return (
            <Tag style={{ background: "#dbeafe", color: "#1d4ed8", border: "1px solid #bfdbfe", fontWeight: 600, borderRadius: 6 }}>
              ผลการดำเนินงานตามกรอบ TQF
            </Tag>
          );
        }
        return (
          <Tag style={{ background: "#ede9fe", color: "#6d28d9", border: "1px solid #ddd6fe", fontWeight: 600, borderRadius: 6 }}>
            {type}
          </Tag>
        );
      },
    },
    {
      title: "ดัชนีการประเมิน",
      dataIndex: "evalIndex",
      key: "evalIndex",
      width: 320,
    },
    {
      title: "คะแนน",
      dataIndex: "score",
      key: "score",
      width: 135,
      align: "center",
      sorter: (a, b) => a.score - b.score,
      render: (v) => {
        const num = Number(v);
        const bg = num >= 4.5 ? "#ecfdf5" : num >= 4.0 ? "#eff6ff" : "#fffbeb";
        const color = num >= 4.5 ? "#059669" : num >= 4.0 ? "#2563eb" : "#d97706";
        return (
          <span
            style={{
              display: "inline-block",
              padding: "4px 12px",
              borderRadius: 20,
              background: bg,
              color: color,
              fontWeight: 700,
              fontSize: 14,
            }}
          >
            {num.toFixed(2)}
          </span>
        );
      },
    },
  ];

  // ช่วยเรนเดอร์การ์ดกราฟแนวโน้ม (แยกสีประจำประเภทชัดเจน)
  const renderTrendCard = (title, subtitle, dataKey, tooltipName, primaryColor, lineColor, badgeBg) => (
    <Card
      bodyStyle={{ padding: "20px" }}
      style={{
        borderRadius: 16,
        boxShadow: "0 4px 12px rgba(15, 23, 42, 0.04)",
        border: "1px solid #e2e8f0",
        borderTop: `4px solid ${primaryColor}`,
        background: "#ffffff",
      }}
    >
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ width: 10, height: 10, borderRadius: "50%", background: primaryColor, display: "inline-block" }} />
          <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#0f172a" }}>{title}</h4>
        </div>
        <div style={{ fontSize: 12, color: "#64748b", paddingLeft: 18 }}>{subtitle}</div>
      </div>

      <div style={{ height: 220, width: "100%" }}>
        {trendChartsData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={trendChartsData} margin={{ top: 22, right: 12, left: -22, bottom: 0 }}>
              <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#f1f5f9" />
              <XAxis
                dataKey="year"
                tickFormatter={(v) => `ปี ${v.replace("ปีการศึกษา ", "")}`}
                tick={{ fontSize: 12, fill: "#475569", fontWeight: 600 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} domain={[0, 5]} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: "#0f172a", borderRadius: 10, border: "none", color: "#fff", fontSize: 12 }}
                formatter={(value) => [`${Number(value).toFixed(2)} คะแนน`, tooltipName]}
              />
              <Bar dataKey={dataKey} radius={[8, 8, 0, 0]} barSize={38}>
                {trendChartsData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={index % 2 === 0 ? primaryColor : badgeBg} />
                ))}
                <LabelList
                  dataKey={dataKey}
                  position="top"
                  style={{ fill: "#1e293b", fontSize: 12, fontWeight: 700 }}
                  formatter={(v) => (v > 0 ? Number(v).toFixed(2) : "")}
                />
              </Bar>
              <Line
                type="monotone"
                dataKey={dataKey}
                stroke={lineColor}
                strokeWidth={2.5}
                dot={{ r: 5, fill: "#ffffff", stroke: lineColor, strokeWidth: 2.5 }}
                activeDot={{ r: 7 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        ) : (
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%" }}>
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="ไม่มีข้อมูล" />
          </div>
        )}
      </div>
    </Card>
  );

  const qualityInfo = getQualityBadge(kpiStats.overall);

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Sidebar />
      <Layout>
        <Header
          style={{
            background: "white",
            padding: "18px 32px",
            height: "auto",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            borderBottom: "1px solid #e2e8f0",
          }}
        >
          <div>
            <h2 style={{ margin: "0 0 4px 0", fontSize: "21px", fontWeight: "700", color: "#0f172a", lineHeight: "1.2" }}>
              ผลการประเมินความพึงพอใจของนิสิตต่อหลักสูตร
            </h2>
            <div style={{ color: "#64748b", fontSize: "13px", lineHeight: "1.4" }}>
              วิเคราะห์ผลที่เกิดกับนิสิต ผลการดำเนินงานตามกรอบ TQF และสิ่งสนับสนุนการเรียนรู้
            </div>
          </div>
        </Header>

        <Content style={{ padding: "24px 32px 48px 32px", background: "#f1f5f9" }}>
          {/* 1. FILTER SECTION */}
          <div
            style={{
              background: "#ffffff",
              padding: "20px 24px",
              borderRadius: 16,
              marginBottom: 24,
              boxShadow: "0 2px 8px rgba(15, 23, 42, 0.03)",
              border: "1px solid #e2e8f0",
            }}
          >
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
              <div>
                <div style={{ marginBottom: 6, fontWeight: 600, fontSize: 13, color: "#334155" }}>ปีการศึกษา</div>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #cbd5e1", outline: "none", background: "#f8fafc" }}
                >
                  <option value="">ทั้งหมด 
                  
                  </option>
                  {years.map((y) => (
                    <option key={y} value={y}>
                      ปีการศึกษา {y}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div style={{ marginBottom: 6, fontWeight: 600, fontSize: 13, color: "#334155" }}>หลักสูตร / สาขาวิชา</div>
                <select
                  value={selectedMajor}
                  onChange={(e) => setSelectedMajor(e.target.value)}
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #cbd5e1", outline: "none", background: "#f8fafc" }}
                >
                  <option value="">ทั้งหมด </option>
                  {majors.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div style={{ marginBottom: 6, fontWeight: 600, fontSize: 13, color: "#334155" }}>ประเภทการประเมิน</div>
                <select
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value)}
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #cbd5e1", outline: "none", background: "#f8fafc" }}
                >
                  <option value="">ทั้งหมด </option>
                  {evalTypes.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 16 }}>
              <Button
                size="middle"
                icon={<ReloadOutlined />}
                onClick={() => {
                  setSelectedYear("");
                  setSelectedMajor("");
                  setSelectedType("");
                  setAppliedFilters({ year: "", major: "", type: "" });
                }}
                style={{ borderRadius: 10 }}
              >
                ล้างตัวกรอง
              </Button>
              <Button
                type="primary"
                size="middle"
                icon={<SearchOutlined />}
                onClick={handleApplyFilters}
                style={{ borderRadius: 10, background: "#0d9488", borderColor: "#0d9488", fontWeight: 600, paddingInline: 20 }}
              >
                ประมวลผล
              </Button>
            </div>
          </div>

          {/* 2. KPI SUMMARY ZONE (โฉมใหม่ แยกสีสันเด่นชัด) */}
          <div style={{ display: "grid", gridTemplateColumns: "1.1fr 2.4fr", gap: 20, marginBottom: 24 }}>
            {/* การ์ดหลักซ้ายมือ: คะแนนเฉลี่ยรวม (Gradient เข้มโดดเด่น) */}
            <div
              style={{
                borderRadius: 20,
                padding: "24px 20px",
                textAlign: "center",
                background: "linear-gradient(145deg, #0f172a 0%, #134e4a 100%)",
                color: "#ffffff",
                boxShadow: "0 10px 25px -5px rgba(15, 23, 42, 0.2)",
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 600, color: "#99f6e4", letterSpacing: "0.5px", marginBottom: 14 }}>
                คะแนนความพึงพอใจเฉลี่ยรวม
              </div>
              <Progress
                type="circle"
                percent={(kpiStats.overall / 5) * 100}
                format={() => (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                    <span style={{ fontWeight: 800, fontSize: 30, color: "#ffffff", lineHeight: 1 }}>
                      {kpiStats.overallText}
                    </span>
                    <span style={{ fontSize: 11, color: "#99f6e4", marginTop: 4 }}>เต็ม 5.00</span>
                  </div>
                )}
                strokeColor={{ "0%": "#2dd4bf", "100%": "#34d399" }}
                trailColor="rgba(255,255,255,0.12)"
                strokeWidth={9}
                size={142}
              />
              <div
                style={{
                  marginTop: 16,
                  padding: "5px 14px",
                  borderRadius: 20,
                  background: qualityInfo.bg,
                  color: qualityInfo.color,
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                <StarFilled style={{ marginRight: 5 }} /> {qualityInfo.text}
              </div>
            </div>

            {/* การ์ดย่อย 4 ใบขวามือ (แยก 4 สีประจำหมวดหมู่ชัดเจน) */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16 }}>
              {/* Card 1: ผลที่เกิดกับนิสิต (Teal Theme) */}
              <div
                style={{
                  background: "linear-gradient(135deg, #ffffff 60%, #f0fdfa 100%)",
                  padding: "18px 20px",
                  borderRadius: 18,
                  border: "1px solid #ccfbf1",
                  borderLeft: "5px solid #0d9488",
                  boxShadow: "0 4px 12px rgba(13, 148, 136, 0.06)",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <Tag color="cyan" style={{ borderRadius: 6, fontWeight: 600, marginBottom: 6 }}>
                      ด้านที่ 1 • ผลลัพธ์ผู้เรียน
                    </Tag>
                    <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#0f172a" }}>ผลที่เกิดกับนิสิต</h4>
                  </div>
                  <div style={{ width: 42, height: 42, borderRadius: 12, background: "#ccfbf1", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <SmileOutlined style={{ fontSize: 22, color: "#0d9488" }} />
                  </div>
                </div>
                <div style={{ marginTop: 12 }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                    <span style={{ fontSize: 30, fontWeight: 800, color: "#0f766e" }}>{kpiStats.studentOutcome.text}</span>
                    <span style={{ fontSize: 12, color: "#64748b" }}>/ 5.00 ({kpiStats.studentOutcome.count} รายการ)</span>
                  </div>
                  <Progress percent={(kpiStats.studentOutcome.avg / 5) * 100} showInfo={false} strokeColor="#0d9488" trailColor="#e2e8f0" size="small" />
                </div>
              </div>

              {/* Card 2: ผลการดำเนินงานตามกรอบ TQF (Royal Blue Theme) */}
              <div
                style={{
                  background: "linear-gradient(135deg, #ffffff 60%, #eff6ff 100%)",
                  padding: "18px 20px",
                  borderRadius: 18,
                  border: "1px solid #dbeafe",
                  borderLeft: "5px solid #2563eb",
                  boxShadow: "0 4px 12px rgba(37, 99, 235, 0.06)",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <Tag color="blue" style={{ borderRadius: 6, fontWeight: 600, marginBottom: 6 }}>
                      ด้านที่ 2 • มาตรฐานหลักสูตร
                    </Tag>
                    <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#0f172a" }}>ผลการดำเนินงานตามกรอบ TQF</h4>
                  </div>
                  <div style={{ width: 42, height: 42, borderRadius: 12, background: "#dbeafe", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <BookOutlined style={{ fontSize: 22, color: "#2563eb" }} />
                  </div>
                </div>
                <div style={{ marginTop: 12 }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                    <span style={{ fontSize: 30, fontWeight: 800, color: "#1d4ed8" }}>{kpiStats.tqfOutcome.text}</span>
                    <span style={{ fontSize: 12, color: "#64748b" }}>/ 5.00 ({kpiStats.tqfOutcome.count} รายการ)</span>
                  </div>
                  <Progress percent={(kpiStats.tqfOutcome.avg / 5) * 100} showInfo={false} strokeColor="#2563eb" trailColor="#e2e8f0" size="small" />
                </div>
              </div>

              {/* Card 3: สิ่งสนับสนุนการเรียนรู้ (Violet Theme) */}
              <div
                style={{
                  background: "linear-gradient(135deg, #ffffff 60%, #f5f3ff 100%)",
                  padding: "18px 20px",
                  borderRadius: 18,
                  border: "1px solid #ede9fe",
                  borderLeft: "5px solid #7c3aed",
                  boxShadow: "0 4px 12px rgba(124, 58, 237, 0.06)",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <Tag color="purple" style={{ borderRadius: 6, fontWeight: 600, marginBottom: 6 }}>
                      ด้านที่ 3 • สภาพแวดล้อมและบริการ
                    </Tag>
                    <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#0f172a" }}>สิ่งสนับสนุนการเรียนรู้</h4>
                  </div>
                  <div style={{ width: 42, height: 42, borderRadius: 12, background: "#ede9fe", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <ToolOutlined style={{ fontSize: 22, color: "#7c3aed" }} />
                  </div>
                </div>
                <div style={{ marginTop: 12 }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                    <span style={{ fontSize: 30, fontWeight: 800, color: "#6d28d9" }}>{kpiStats.learningSupport.text}</span>
                    <span style={{ fontSize: 12, color: "#64748b" }}>/ 5.00 ({kpiStats.learningSupport.count} รายการ)</span>
                  </div>
                  <Progress percent={(kpiStats.learningSupport.avg / 5) * 100} showInfo={false} strokeColor="#7c3aed" trailColor="#e2e8f0" size="small" />
                </div>
              </div>

              {/* Card 4: จำนวนรายการประเมิน (Amber/Orange Theme) */}
              <div
                style={{
                  background: "linear-gradient(135deg, #ffffff 60%, #fffbeb 100%)",
                  padding: "18px 20px",
                  borderRadius: 18,
                  border: "1px solid #fef3c7",
                  borderLeft: "5px solid #d97706",
                  boxShadow: "0 4px 12px rgba(217, 119, 6, 0.06)",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <Tag color="orange" style={{ borderRadius: 6, fontWeight: 600, marginBottom: 6 }}>
                      ข้อมูลที่แสดง
                    </Tag>
                    <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#0f172a" }}>รายการประเมิน</h4>
                  </div>
                  <div style={{ width: 42, height: 42, borderRadius: 12, background: "#fef3c7", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <TeamOutlined style={{ fontSize: 22, color: "#d97706" }} />
                  </div>
                </div>
                <div style={{ marginTop: 12 }}>
                  <span style={{ fontSize: 30, fontWeight: 800, color: "#b45309" }}>
                    {kpiStats.rowCount.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* 3. DETAILED CHARTS SECTION (TABS + TOP/BOTTOM INSIGHTS) */}
          <div
            style={{
              background: "white",
              padding: "24px 28px",
              borderRadius: 18,
              marginBottom: 24,
              border: "1px solid #e2e8f0",
              boxShadow: "0 2px 8px rgba(15, 23, 42, 0.03)",
            }}
          >
            <Tabs
              defaultActiveKey="support"
              size="large"
              items={[
                {
                  key: "support",
                  label: (
                    <span style={{ fontWeight: 600 }}>
                      <ToolOutlined /> เจาะลึกสิ่งสนับสนุนการเรียนรู้ตามดัชนี
                    </span>
                  ),
                  children: (
                    <div style={{ paddingTop: 10 }}>
                      {/* กล่องสรุปจุดเด่น 3 อันดับแรก vs จุดที่ควรพัฒนา 3 อันดับท้าย */}
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16, marginBottom: 20 }}>
                        {/* Top 3 จุดแข็ง */}
                        <div style={{ background: "#ecfdf5", border: "1px solid #a7f3d0", borderRadius: 14, padding: "14px 18px" }}>
                          <div style={{ fontWeight: 700, color: "#065f46", fontSize: 14, marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
                            <TrophyOutlined style={{ color: "#10b981", fontSize: 16 }} /> 3 ด้านที่นิสิตพึงพอใจสูงสุด
                          </div>
                          {top3Support.length > 0 ? (
                            top3Support.map((item, idx) => (
                              <div key={item.name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0", borderBottom: idx < 2 ? "1px dashed #a7f3d0" : "none" }}>
                                <span style={{ fontSize: 13, color: "#064e3b" }}>
                                  <strong>#{idx + 1}</strong> {item.name}
                                </span>
                                <Tag color="success" style={{ fontWeight: 700, margin: 0 }}>{item.score.toFixed(2)}</Tag>
                              </div>
                            ))
                          ) : (
                            <span style={{ fontSize: 12, color: "#64748b" }}>ไม่มีข้อมูล</span>
                          )}
                        </div>

                        {/* Bottom 3 จุดควรพัฒนา */}
                        <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 14, padding: "14px 18px" }}>
                          <div style={{ fontWeight: 700, color: "#92400e", fontSize: 14, marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
                            <AlertOutlined style={{ color: "#f59e0b", fontSize: 16 }} /> 3 ด้านที่คะแนนน้อยที่สุด
                          </div>
                          {bottom3Support.length > 0 ? (
                            bottom3Support.map((item, idx) => (
                              <div key={item.name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0", borderBottom: idx < 2 ? "1px dashed #fde68a" : "none" }}>
                                <span style={{ fontSize: 13, color: "#78350f" }}>
                                  <strong>#{allSupportScores.length - idx}</strong> {item.name}
                                </span>
                                <Tag color="warning" style={{ fontWeight: 700, margin: 0 }}>{item.score.toFixed(2)}</Tag>
                              </div>
                            ))
                          ) : (
                            <span style={{ fontSize: 12, color: "#64748b" }}>ไม่มีข้อมูล</span>
                          )}
                        </div>
                      </div>

                      {/* ตัวกรองดัชนี + คำอธิบายสี */}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 16, background: "#f8fafc", padding: "10px 16px", borderRadius: 12 }}>
                        <select
                          value={supportIndexFilter}
                          onChange={(event) => setSupportIndexFilter(event.target.value)}
                          style={{ maxWidth: "100%", padding: "8px 12px", borderRadius: 10, border: "1px solid #cbd5e1", background: "#ffffff" }}
                        >
                          <option value="all">ทุกดัชนี</option>
                          {allSupportScores.map((item) => (
                            <option key={item.name} value={item.name}>{item.name}</option>
                          ))}
                        </select>

                        {/* Legend สีตามเกณฑ์ */}
                        <div style={{ display: "flex", gap: 12, fontSize: 12, color: "#475569" }}>
                          <span><Badge color="#10b981" /> ≥ 4.50 ดีเยี่ยม</span>
                          <span><Badge color="#6366f1" /> 4.20 - 4.49 ดีมาก</span>
                          <span><Badge color="#0ea5e9" /> 4.00 - 4.19 ดี</span>
                          <span><Badge color="#f59e0b" /> &lt; 4.00 ควรพัฒนา</span>
                        </div>
                      </div>

                      {/* กราฟแท่งแนวนอน */}
                      <div style={{ height: Math.max(260, filteredSupportChartData.length * 34) }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart
                            data={filteredSupportChartData}
                            layout="vertical"
                            margin={{ top: 5, right: 55, left: 30, bottom: 5 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                            <XAxis type="number" domain={[0, 5]} axisLine={false} tickLine={false} />
                            <YAxis
                              type="category"
                              dataKey="name"
                              width={250}
                              axisLine={false}
                              tickLine={false}
                              tick={{ fill: "#1e293b", fontSize: 12, fontWeight: 500 }}
                            />
                            <Tooltip cursor={{ fill: "#f5f3ff" }} formatter={(val) => [`${Number(val).toFixed(2)} คะแนน`, "คะแนนเฉลี่ย"]} />
                            <ReferenceLine x={4.0} stroke="#94a3b8" strokeDasharray="4 4" label={{ value: "เกณฑ์ 4.00", position: "top", fill: "#64748b", fontSize: 11 }} />
                            <Bar dataKey="score" radius={[0, 8, 8, 0]} barSize={20}>
                              {filteredSupportChartData.map((entry, idx) => (
                                <Cell key={`cell-${idx}`} fill={getBarColorByScore(entry.score)} />
                              ))}
                              <LabelList
                                dataKey="score"
                                position="right"
                                dx={8}
                                style={{ fill: "#0f172a", fontSize: 12, fontWeight: 700 }}
                                formatter={(val) => Number(val).toFixed(2)}
                              />
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  ),
                },
                {
                  key: "core",
                  label: (
                    <span style={{ fontWeight: 600 }}>
                      <BookOutlined /> เปรียบเทียบด้านหลักสูตรและอาจารย์ (4 ด้านหลัก)
                    </span>
                  ),
                  children: (
                    <div style={{ paddingTop: 12 }}>
                      <p style={{ color: "#64748b", fontSize: 13, marginBottom: 16 }}>
                        ค่าเฉลี่ยความพึงพอใจจากแบบประเมิน "ผลที่เกิดกับนิสิต" และ "ผลการดำเนินงานตามกรอบ TQF"
                      </p>
                      <div style={{ height: 340 }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={coreChartData} margin={{ top: 25, right: 30, left: 0, bottom: 10 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "#1e293b", fontSize: 13, fontWeight: 600 }} />
                            <YAxis domain={[0, 5]} axisLine={false} tickLine={false} />
                            <Tooltip cursor={{ fill: "#f0fdfa" }} formatter={(val) => [`${Number(val).toFixed(2)} คะแนน`, "คะแนนเฉลี่ย"]} />
                            <Bar dataKey="score" radius={[10, 10, 0, 0]} barSize={64}>
                              <LabelList
                                dataKey="score"
                                position="top"
                                dy={-8}
                                style={{ fill: "#0f172a", fontSize: 14, fontWeight: 700 }}
                                formatter={(val) => Number(val).toFixed(2)}
                              />
                              {coreChartData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  ),
                },
              ]}
            />
          </div>

          {/* 4. TREND ANALYSIS BANNER & CHARTS */}
          <div
            style={{
              background: "linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%)",
              padding: "24px 32px",
              borderRadius: 18,
              marginBottom: 24,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 20,
              boxShadow: "0 10px 25px -5px rgba(30, 58, 138, 0.2)",
            }}
          >
            <div>
              <h3 style={{ color: "#ffffff", fontSize: "20px", fontWeight: "700", margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
                <RiseOutlined style={{ color: "#38bdf8" }} /> วิเคราะห์แนวโน้มความพึงพอใจรายปีการศึกษา
              </h3>
              <p style={{ color: "#cbd5e1", fontSize: "13px", margin: "4px 0 0 0" }}>
                เปรียบเทียบพัฒนาการคะแนนเฉลี่ยทั้ง 3 ประเภทการประเมินระหว่างปีการศึกษา 
              </p>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span style={{ color: "#93c5fd", fontSize: "11px", fontWeight: "600" }}>เลือกหลักสูตรเพื่อดูแนวโน้ม</span>
              <select
                value={trendMajor}
                onChange={(e) => setTrendMajor(e.target.value)}
                style={{
                  background: "rgba(255, 255, 255, 0.12)",
                  border: "1px solid rgba(255, 255, 255, 0.25)",
                  borderRadius: "10px",
                  padding: "9px 14px",
                  color: "#ffffff",
                  outline: "none",
                  cursor: "pointer",
                  minWidth: "270px",
                  fontSize: "13px",
                  fontWeight: 500,
                }}
              >
                <option value="" style={{ color: "#0f172a" }}>
                  ทุกหลักสูตรรวมกัน
                </option>
                {majors.map((m) => (
                  <option key={m} value={m} style={{ color: "#0f172a" }}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(310px, 1fr))", gap: 20, marginBottom: 28 }}>
            {renderTrendCard("ผลที่เกิดกับนิสิต", "คะแนนเฉลี่ยผลลัพธ์ที่เกิดกับผู้เรียน", "studentOutcome", "ผลที่เกิดกับนิสิต", "#0d9488", "#f43f5e", "#14b8a6")}
            {renderTrendCard("ผลการดำเนินงานตามกรอบ TQF", "คะแนนเฉลี่ยตามกรอบมาตรฐานคุณวุฒิฯ", "tqfOutcome", "กรอบ TQF", "#2563eb", "#f59e0b", "#3b82f6")}
            {renderTrendCard("สิ่งสนับสนุนการเรียนรู้", "คะแนนเฉลี่ยตามดัชนีการประเมิน", "learningSupport", "สิ่งสนับสนุนการเรียนรู้", "#7c3aed", "#10b981", "#8b5cf6")}
          </div>

          {/* 5. DATA TABLE ZONE */}
          <div style={{ background: "white", padding: 24, borderRadius: 18, border: "1px solid #e2e8f0", boxShadow: "0 2px 8px rgba(15, 23, 42, 0.03)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "#0f172a" }}>
                  ผลการประเมินรายดัชนี
                </h3>
                <span style={{ fontSize: 12, color: "#64748b" }}>แสดงข้อมูลทั้งหมด {filteredData.length} รายการ</span>
              </div>
            </div>

            <Table
              columns={tableColumns}
              dataSource={filteredData}
              rowKey={(record) => record._id}
              pagination={{ pageSize: 10, showSizeChanger: true }}
              scroll={{ x: 1100 }}
              bordered
            />
          </div>
        </Content>
      </Layout>
    </Layout>
  );
}

export default StudentSatisfactionPage;