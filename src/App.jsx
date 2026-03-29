import { useState, useEffect, useRef, useCallback } from "react";

/* ─── Design Tokens ─────────────────────────────────────────── */
const C = {
  bg:          "#faf7f2",
  surface:     "#ffffff",
  surfaceWarm: "#fdf9f4",
  surfaceDeep: "#f5ede0",
  border:      "#e8ddd0",
  borderLight: "#f0e8dc",
  borderFocus: "#c4a882",
  gold:        "#b8924a",
  goldLight:   "#d4ae72",
  goldPale:    "#f2e8d5",
  rose:        "#b87070",
  rosePale:    "#f5ebe8",
  sage:        "#7a9b8a",
  sagePale:    "#eaf2ee",
  ink:         "#2a2118",
  inkMid:      "#6b5c4e",
  inkLight:    "#a8998a",
  inkFaint:    "#d5ccc2",
  success:     "#7a9b8a",
};

const STAGE_META = {
  1: { label:"브레인덤프",    color:C.gold, colorPale:C.goldPale, duration:15*60 },
  2: { label:"깊이 파고들기", color:C.rose, colorPale:C.rosePale, duration:20*60 },
  3: { label:"영혼 확인",     color:C.sage, colorPale:C.sagePale, duration:null  },
};

const GUIDES = {
  1: "#태그로 주제를 나눠요. '쓰기 싫다'로 시작해도 괜찮아요. 그 중에 더 깊이 얘기하고 싶은 꼭지가 보일 거예요.",
  2: "다 쓴 뒤 스스로 물어봐요: 이 글이 진짜 내 영혼이 하는 말일까, 껍데기가 하는 말일까? 지우고 다시 쓰고 싶은 부분이 생길 거예요.",
  3: null,
};

/* ─── LocalStorage DB ───────────────────────────────────────── */
const DB = {
  get: ()    => { try { return JSON.parse(localStorage.getItem("sj_db")||"{}"); } catch { return {}; } },
  set: (d)   => localStorage.setItem("sj_db", JSON.stringify(d)),
  session:() => localStorage.getItem("sj_user")||null,
  login: (u) => localStorage.setItem("sj_user", u),
  logout:()  => localStorage.removeItem("sj_user"),
};

function initDB() {
  const d = DB.get();
  if (!d.users)   d.users   = {};
  if (!d.entries) d.entries = {};
  DB.set(d); return d;
}

const fmtDate = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,"0")}.${String(d.getDate()).padStart(2,"0")}`;
};
const fmtTime = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
};
const uid = () => "e_" + Date.now() + Math.random().toString(36).slice(2,6);
const extractTags = (t) => [...new Set((t||"").match(/#[^\s#\n]+/g)||[])];

/* ─── Global CSS ────────────────────────────────────────────── */
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;1,300;1,400&family=Nanum+Myeongjo:wght@400;700&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html, body, #root { height: 100%; }
  body { background: ${C.bg}; font-family: 'Cormorant Garamond', 'Nanum Myeongjo', Georgia, serif; -webkit-font-smoothing: antialiased; }
  ::-webkit-scrollbar { width: 4px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: ${C.borderFocus}55; border-radius: 4px; }
  textarea::placeholder, input::placeholder { color: ${C.inkFaint}; font-style: italic; }
  @keyframes fadeUp    { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }
  @keyframes fadeIn    { from { opacity:0; } to { opacity:1; } }
  @keyframes shimmer   { 0%,100% { opacity:.25; } 50% { opacity:.4; } }
  @keyframes bounce    { 0%,80%,100% { transform:translateY(0); opacity:.45; } 40% { transform:translateY(-5px); opacity:1; } }
  @keyframes slideUp   { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
  @keyframes toastIn   { from { opacity:0; transform:translate(-50%,10px); } to { opacity:1; transform:translate(-50%,0); } }
  .auth-card  { animation: fadeUp 0.5s cubic-bezier(.22,.84,.44,1); }
  .fade-in    { animation: fadeIn 0.35s ease; }
  .slide-up   { animation: slideUp 0.38s cubic-bezier(.22,.84,.44,1); }
  .btn:hover  { opacity: .82; }
  .btn:active { opacity: .7; transform: scale(.98); }
  /* Mobile sidebar overlay */
  .sidebar-overlay { display:none; position:fixed; inset:0; background:rgba(42,33,24,.35); z-index:40; }
  @media (max-width: 768px) {
    .sidebar-overlay.open { display:block; }
    .sidebar { position:fixed !important; left:0; top:0; bottom:0; z-index:50; transform:translateX(-100%); transition:transform .28s cubic-bezier(.22,.84,.44,1) !important; }
    .sidebar.open { transform:translateX(0) !important; }
    .editor-header-stages { overflow-x:auto; }
  }
`;

/* ─── Timer ─────────────────────────────────────────────────── */
function Timer({ totalSeconds, color }) {
  const [left,setLeft]     = useState(totalSeconds);
  const [active,setActive] = useState(false);
  const [done,setDone]     = useState(false);
  useEffect(() => { setLeft(totalSeconds); setActive(false); setDone(false); }, [totalSeconds]);
  useEffect(() => {
    if (!active || done) return;
    const id = setInterval(() => setLeft(t => { if (t<=1) { clearInterval(id); setActive(false); setDone(true); return 0; } return t-1; }), 1000);
    return () => clearInterval(id);
  }, [active, done]);
  const R=20, circ=2*Math.PI*R;
  const pct = totalSeconds>0 ? ((totalSeconds-left)/totalSeconds)*100 : 0;
  const m   = Math.floor(left/60).toString().padStart(2,"0");
  const s   = (left%60).toString().padStart(2,"0");
  return (
    <div style={{ display:"flex", alignItems:"center", gap:12 }}>
      <div style={{ position:"relative", width:50, height:50 }}>
        <svg width={50} height={50} style={{ transform:"rotate(-90deg)" }}>
          <circle cx={25} cy={25} r={R} fill="none" stroke={C.borderFocus} strokeWidth={2} opacity={.3}/>
          <circle cx={25} cy={25} r={R} fill="none" stroke={done?C.success:active?color:C.inkFaint}
            strokeWidth={2.5} strokeDasharray={circ} strokeDashoffset={circ*(1-pct/100)}
            strokeLinecap="round" style={{ transition:"stroke-dashoffset 1s linear,stroke .4s" }}/>
        </svg>
        <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center",
          fontFamily:"'Courier New',monospace", fontSize:10, color:done?C.success:C.inkMid, fontWeight:600 }}>
          {done?"✓":`${m}:${s}`}
        </div>
      </div>
      <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
        {!done ? (
          <>
            <button className="btn" onClick={() => setActive(a=>!a)} style={{
              padding:"4px 12px", borderRadius:20, fontSize:11, fontWeight:600, fontFamily:"sans-serif",
              background:active?"transparent":color, border:`1.5px solid ${color}`,
              color:active?color:"#fff", cursor:"pointer", transition:"all .2s" }}>
              {active?"일시정지":left<totalSeconds?"재시작":"시작"}
            </button>
            {!active && left<totalSeconds && (
              <button onClick={()=>{setLeft(totalSeconds);setActive(false);}} style={{
                padding:"2px 10px", borderRadius:20, fontSize:10, fontFamily:"sans-serif",
                background:"transparent", border:`1.5px solid ${C.border}`, color:C.inkLight, cursor:"pointer" }}>
                리셋
              </button>
            )}
          </>
        ) : (
          <span style={{ fontSize:11, color:C.success, fontFamily:"sans-serif", fontWeight:500 }}>완료 ✦</span>
        )}
      </div>
    </div>
  );
}

/* ─── Toast ─────────────────────────────────────────────────── */
function Toast({ msg }) {
  if (!msg) return null;
  return (
    <div style={{ position:"fixed", bottom:28, left:"50%", transform:"translateX(-50%)",
      background:C.ink, color:"#fff", padding:"11px 22px", borderRadius:40,
      fontFamily:"sans-serif", fontSize:13, zIndex:9999, whiteSpace:"nowrap",
      animation:"toastIn .3s ease", boxShadow:`0 6px 24px ${C.ink}30` }}>{msg}</div>
  );
}

/* ─── Delete Modal ──────────────────────────────────────────── */
function DeleteModal({ onConfirm, onCancel }) {
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(42,33,24,.38)", backdropFilter:"blur(4px)",
      zIndex:8000, display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div style={{ background:C.surface, borderRadius:18, padding:"36px 40px", maxWidth:360, width:"90%",
        boxShadow:`0 12px 48px ${C.ink}22`, animation:"fadeUp .28s ease" }}>
        <h3 style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:20, fontWeight:400, color:C.ink, marginBottom:10 }}>
          이 글을 삭제할까요?
        </h3>
        <p style={{ fontSize:13, color:C.inkMid, fontFamily:"sans-serif", fontWeight:300, lineHeight:1.7, marginBottom:28 }}>
          한번 삭제하면 되돌릴 수 없어요.
        </p>
        <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
          <button className="btn" onClick={onCancel} style={{ padding:"10px 20px", background:C.surfaceDeep, border:"none", borderRadius:8, fontSize:13, color:C.inkMid, cursor:"pointer", fontFamily:"sans-serif" }}>취소</button>
          <button className="btn" onClick={onConfirm} style={{ padding:"10px 20px", background:C.rose, border:"none", borderRadius:8, fontSize:13, color:"#fff", fontWeight:600, cursor:"pointer", fontFamily:"sans-serif" }}>삭제</button>
        </div>
      </div>
    </div>
  );
}

/* ─── Auth Screen ───────────────────────────────────────────── */
function AuthScreen({ onAuth }) {
  const [tab,setTab]   = useState("login");
  const [name,setName] = useState("");
  const [email,setEmail] = useState("");
  const [pw,setPw]     = useState("");
  const [err,setErr]   = useState("");

  const submit = () => {
    setErr("");
    const db = initDB();
    if (tab === "login") {
      if (!email||!pw) return setErr("이메일과 비밀번호를 입력해주세요.");
      const u = db.users[email];
      if (!u) return setErr("등록된 이메일이 없어요. 먼저 회원가입해주세요.");
      if (u.pw !== btoa(pw)) return setErr("비밀번호가 맞지 않아요.");
      DB.login(email); onAuth(email, u.name);
    } else {
      if (!name||!email||!pw) return setErr("모든 항목을 입력해주세요.");
      if (!/\S+@\S+\.\S+/.test(email)) return setErr("이메일 형식을 확인해주세요.");
      if (pw.length < 6) return setErr("비밀번호는 6자 이상이어야 해요.");
      if (db.users[email]) return setErr("이미 사용 중인 이메일이에요.");
      db.users[email] = { name, pw: btoa(pw) };
      if (!db.entries[email]) db.entries[email] = [];
      DB.set(db); DB.login(email); onAuth(email, name);
    }
  };

  const inp = {
    width:"100%", padding:"13px 16px", border:`1.5px solid ${C.border}`, borderRadius:10,
    fontFamily:"sans-serif", fontSize:14, color:C.ink, background:C.surfaceWarm, outline:"none", transition:"all .2s",
  };

  return (
    <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center",
      background:"linear-gradient(150deg,#fdf0e0 0%,#fde8d0 55%,#f8ddc8 100%)", padding:20 }}>
      <div className="auth-card" style={{ background:C.surface, borderRadius:24, padding:"48px 44px",
        width:"100%", maxWidth:420, boxShadow:`0 8px 48px ${C.ink}14, 0 0 0 1px ${C.gold}22` }}>
        <div style={{ textAlign:"center", marginBottom:28 }}>
          <div style={{ fontSize:36, marginBottom:8 }}>🕯️</div>
          <h1 style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:26, fontWeight:400, fontStyle:"italic",
            color:C.ink, letterSpacing:"0.08em" }}>영혼의 글쓰기</h1>
          <p style={{ fontSize:12, color:C.inkLight, marginTop:5, fontFamily:"sans-serif", fontWeight:300 }}>
            내 안의 작고 귀엽고 소중한 영혼에게
          </p>
        </div>
        <div style={{ display:"flex", background:C.surfaceDeep, borderRadius:10, padding:4, marginBottom:28 }}>
          {["login","signup"].map(t => (
            <button key={t} className="btn" onClick={()=>{setTab(t);setErr("");}} style={{
              flex:1, padding:"9px", border:"none", borderRadius:7, cursor:"pointer",
              fontFamily:"sans-serif", fontSize:13, transition:"all .22s",
              background:tab===t?C.surface:"transparent",
              color:tab===t?C.gold:C.inkLight, fontWeight:tab===t?600:400,
              boxShadow:tab===t?`0 2px 8px ${C.ink}12`:"none" }}>
              {t==="login"?"로그인":"회원가입"}
            </button>
          ))}
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
          {tab==="signup" && (
            <div>
              <label style={{ display:"block", fontSize:11, color:C.inkLight, marginBottom:6, fontFamily:"sans-serif", letterSpacing:"0.05em" }}>이름</label>
              <input style={inp} value={name} onChange={e=>setName(e.target.value)} placeholder="나만의 이름"
                onFocus={e=>{e.target.style.borderColor=C.gold;e.target.style.boxShadow=`0 0 0 3px ${C.gold}18`;}}
                onBlur={e=>{e.target.style.borderColor=C.border;e.target.style.boxShadow="none";}}/>
            </div>
          )}
          <div>
            <label style={{ display:"block", fontSize:11, color:C.inkLight, marginBottom:6, fontFamily:"sans-serif", letterSpacing:"0.05em" }}>이메일</label>
            <input type="email" style={inp} value={email} onChange={e=>setEmail(e.target.value)} placeholder="your@email.com"
              onFocus={e=>{e.target.style.borderColor=C.gold;e.target.style.boxShadow=`0 0 0 3px ${C.gold}18`;}}
              onBlur={e=>{e.target.style.borderColor=C.border;e.target.style.boxShadow="none";}}
              onKeyDown={e=>e.key==="Enter"&&submit()}/>
          </div>
          <div>
            <label style={{ display:"block", fontSize:11, color:C.inkLight, marginBottom:6, fontFamily:"sans-serif", letterSpacing:"0.05em" }}>비밀번호</label>
            <input type="password" style={inp} value={pw} onChange={e=>setPw(e.target.value)} placeholder={tab==="signup"?"6자 이상":"••••••••"}
              onFocus={e=>{e.target.style.borderColor=C.gold;e.target.style.boxShadow=`0 0 0 3px ${C.gold}18`;}}
              onBlur={e=>{e.target.style.borderColor=C.border;e.target.style.boxShadow="none";}}
              onKeyDown={e=>e.key==="Enter"&&submit()}/>
          </div>
        </div>
        {err && <p style={{ fontSize:12, color:C.rose, textAlign:"center", marginTop:14, fontFamily:"sans-serif" }}>{err}</p>}
        <button className="btn" onClick={submit} style={{
          width:"100%", padding:"14px", marginTop:22,
          background:`linear-gradient(135deg,${C.gold},${C.rose})`, border:"none", borderRadius:10,
          color:"#fff", fontFamily:"sans-serif", fontSize:14, fontWeight:600, cursor:"pointer",
          letterSpacing:"0.04em", boxShadow:`0 4px 20px ${C.gold}35`, transition:"all .2s" }}>
          {tab==="login"?"들어가기 →":"시작하기 →"}
        </button>
      </div>
    </div>
  );
}

/* ─── Sidebar Entry Item ────────────────────────────────────── */
function EntryItem({ entry, active, onOpen, onDelete }) {
  const [hov, setHov] = useState(false);
  const sc = { 1:C.gold, 2:C.rose, 3:C.sage };
  const sn = { 1:"브레인덤프", 2:"깊이 파고들기", 3:"영혼 확인" };
  const preview = (entry.texts?.[1]||"").replace(/\n/g," ").slice(0,46)||"내용 없음";
  return (
    <div onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
      onClick={()=>onOpen(entry.id)}
      style={{ padding:"13px 14px", borderRadius:10, cursor:"pointer", marginBottom:3, position:"relative",
        transition:"all .18s",
        background:active?`linear-gradient(135deg,${C.goldPale},${C.rosePale}22)`:hov?C.surfaceDeep:"transparent",
        border:`1.5px solid ${active?C.gold+"55":"transparent"}` }}>
      <div style={{ fontSize:10, color:sc[entry.stage||1], fontFamily:"sans-serif", fontWeight:600,
        letterSpacing:"0.06em", marginBottom:4, textTransform:"uppercase" }}>
        {sn[entry.stage||1]}
      </div>
      <div style={{ fontSize:13.5, fontWeight:500, color:C.ink, marginBottom:4,
        whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis",
        fontFamily:"'Cormorant Garamond',serif" }}>
        {entry.title||"제목 없음"}
      </div>
      <div style={{ fontSize:11, color:C.inkLight, whiteSpace:"nowrap", overflow:"hidden",
        textOverflow:"ellipsis", fontFamily:"sans-serif", fontWeight:300 }}>
        {preview}
      </div>
      <div style={{ fontSize:10, color:C.inkFaint, marginTop:5, fontFamily:"sans-serif" }}>
        {fmtDate(entry.updatedAt)}  {fmtTime(entry.updatedAt)}
      </div>
      {hov && (
        <button onClick={e=>{e.stopPropagation();onDelete(entry.id);}} style={{
          position:"absolute", right:10, top:10, background:"none", border:"none",
          cursor:"pointer", color:C.rose, fontSize:14, padding:"2px 6px",
          borderRadius:5, opacity:.75 }}>✕</button>
      )}
    </div>
  );
}

/* ─── Soul Type Legend ──────────────────────────────────────── */
function SoulTypeLegend() {
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:9 }}>
      {[{dot:C.rose,label:"에고의 글",desc:"누군가를 의식한 글"},
        {dot:C.gold,label:"무의식의 글",desc:"결론이 늘 같은 글"},
        {dot:C.sage,label:"영혼의 글",desc:"울컥하게 만드는 글"}].map(({dot,label,desc})=>(
        <div key={label} style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ width:7, height:7, borderRadius:"50%", background:dot, flexShrink:0, opacity:.85 }}/>
          <span style={{ fontSize:12, color:C.ink, fontFamily:"sans-serif", fontWeight:500 }}>{label}</span>
          <span style={{ fontSize:11, color:C.inkLight, fontFamily:"sans-serif" }}>{desc}</span>
        </div>
      ))}
    </div>
  );
}

/* ─── AI Feedback Box ───────────────────────────────────────── */
function AiFeedback({ result, loading, onAsk, canAsk, color }) {
  if (loading) return (
    <div style={{ padding:"20px 22px", background:C.surfaceWarm, borderRadius:12,
      border:`1px solid ${C.borderLight}`, display:"flex", alignItems:"center", gap:12 }}>
      {[0,1,2].map(i=>(
        <div key={i} style={{ width:6, height:6, borderRadius:"50%", background:color, opacity:.6,
          animation:`bounce 1.2s ${i*0.2}s ease-in-out infinite` }}/>
      ))}
      <span style={{ fontSize:12, color:C.inkLight, fontFamily:"sans-serif", fontWeight:300 }}>영혼의 친구가 읽고 있어요...</span>
    </div>
  );

  if (result) return (
    <div className="slide-up" style={{ padding:"20px 22px", borderRadius:12,
      background:result.startsWith("오류")?C.rosePale:`linear-gradient(135deg,${color}0c,${color}05)`,
      border:`1.5px solid ${result.startsWith("오류")?C.rose+"40":color+"30"}`,
      borderLeft:`3px solid ${result.startsWith("오류")?C.rose:color}` }}>
      <div style={{ fontSize:10, color:color, fontFamily:"sans-serif", fontWeight:700,
        letterSpacing:"0.07em", textTransform:"uppercase", marginBottom:10 }}>
        ✦ 영혼의 친구
      </div>
      <p style={{ fontSize:15, color:C.ink, lineHeight:1.95, margin:0,
        fontFamily:"'Cormorant Garamond',serif", fontWeight:300, whiteSpace:"pre-wrap" }}>
        {result}
      </p>
      <button className="btn" onClick={onAsk} style={{
        marginTop:14, padding:"6px 16px", borderRadius:20, fontSize:11,
        background:"transparent", border:`1.5px solid ${color}55`,
        color:color, cursor:"pointer", fontFamily:"sans-serif", fontWeight:500,
        transition:"all .2s" }}>
        다시 물어보기
      </button>
    </div>
  );

  return (
    <button className="btn" onClick={onAsk} disabled={!canAsk}
      style={{
        padding:"12px 24px", borderRadius:10, fontSize:14, fontWeight:600,
        fontFamily:"sans-serif", letterSpacing:"0.03em", cursor:canAsk?"pointer":"default",
        background:canAsk?color:"transparent", border:`1.5px solid ${canAsk?color:C.border}`,
        color:canAsk?"#fff":C.inkFaint, opacity:canAsk?1:.45, transition:"all .2s",
        boxShadow:canAsk?`0 4px 18px ${color}2e`:"none",
        display:"flex", alignItems:"center", gap:8 }}>
      ✦ 영혼에게 묻기
    </button>
  );
}

/* ─── Main App ──────────────────────────────────────────────── */
export default function App() {
  const [user, setUser]           = useState(null);
  const [entries, setEntries]     = useState([]);
  const [activeId, setActiveId]   = useState(null);
  const [search, setSearch]       = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Editor state
  const [stage, setStage]         = useState(1);
  const [texts, setTexts]         = useState({1:"",2:"",3:""});
  const [title, setTitle]         = useState("");
  const [selectedTag, setSelTag]  = useState("");
  const [saveStatus, setSaveStatus] = useState("");
  const [reviewSource, setReviewSource] = useState("2");

  // AI state — single-shot per stage
  const [aiResult, setAiResult]   = useState({1:null,2:null,3:null});
  const [aiLoading, setAiLoading] = useState(false);

  // UI
  const [toast, setToast]         = useState("");
  const [deleteId, setDeleteId]   = useState(null);
  const [taFocused, setTaFocused] = useState(false);
  const autoSaveRef = useRef(null);

  /* Boot */
  useEffect(() => {
    const db    = initDB();
    const email = DB.session();
    if (email && db.users[email]) {
      setUser({ email, name: db.users[email].name });
      setEntries(db.entries[email]||[]);
    }
  }, []);

  const showToast = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2400);
  }, []);

  const persist = useCallback((list, email) => {
    const db = DB.get();
    db.entries[email||(user?.email)] = list;
    DB.set(db);
  }, [user]);

  const activeEntry = entries.find(e => e.id===activeId)||null;

  /* Open entry */
  const openEntry = useCallback((id) => {
    const e = entries.find(x => x.id===id);
    if (!e) return;
    setActiveId(id);
    setTitle(e.title||"");
    setTexts(e.texts||{1:"",2:"",3:""});
    setStage(e.stage||1);
    setSelTag("");
    setReviewSource("2");
    setAiResult({1:null,2:null,3:null});
    setSaveStatus("");
    setSidebarOpen(false);
  }, [entries]);

  /* New entry */
  const newEntry = () => {
    const e = { id:uid(), title:"", texts:{1:"",2:"",3:""}, stage:1,
      createdAt:new Date().toISOString(), updatedAt:new Date().toISOString() };
    const next = [e, ...entries];
    setEntries(next); persist(next);
    setActiveId(e.id); setTitle(""); setTexts({1:"",2:"",3:""}); setStage(1);
    setSelTag(""); setReviewSource("2"); setAiResult({1:null,2:null,3:null}); setSaveStatus("");
    setSidebarOpen(false);
  };

  /* Save */
  const saveEntry = useCallback((silent=false) => {
    if (!activeId) return;
    const now  = new Date().toISOString();
    const next = entries.map(e => e.id===activeId ? {...e,title,texts,stage,updatedAt:now} : e);
    setEntries(next); persist(next);
    setSaveStatus("saved");
    setTimeout(() => setSaveStatus(s => s==="saved"?"":s), 2200);
    if (!silent) showToast("저장되었어요 💛");
  }, [activeId, entries, title, texts, stage, persist, showToast]);

  const onEdit = () => {
    setSaveStatus("editing");
    clearTimeout(autoSaveRef.current);
    autoSaveRef.current = setTimeout(() => saveEntry(true), 2500);
  };

  /* Delete */
  const confirmDelete = () => {
    if (!deleteId) return;
    const next = entries.filter(e => e.id!==deleteId);
    setEntries(next); persist(next);
    if (activeId===deleteId) { setActiveId(null); setTitle(""); setTexts({1:"",2:"",3:""}); }
    setDeleteId(null); showToast("삭제했어요.");
  };

  /* Stage */
  const goToStage = (s) => {
    if (s===2 && !selectedTag) {
      const t = extractTags(texts[1]);
      if (t.length>0) setSelTag(t[0]);
    }
    setStage(s);
    if (activeId) {
      const next = entries.map(e => e.id===activeId?{...e,stage:s}:e);
      setEntries(next); persist(next);
    }
  };

  /* Logout */
  const logout = () => {
    if (saveStatus==="editing") saveEntry(true);
    DB.logout();
    setUser(null); setEntries([]); setActiveId(null);
    setTitle(""); setTexts({1:"",2:"",3:""}); setStage(1);
  };

  /* Auth */
  const handleAuth = (email, name) => {
    const db = DB.get();
    setUser({ email, name });
    setEntries(db.entries[email]||[]);
  };

  /* AI — single-shot, calls Netlify Function */
  const askSoul = async () => {
    const targetText = stage===3
      ? (reviewSource==="2"?(texts[2]||""):(texts[1]||""))
      : (texts[stage]||"");
    if (!targetText.trim() || aiLoading) return;
    setAiLoading(true);
    setAiResult(p => ({...p,[stage]:null}));
    try {
      const res = await fetch("/api/ask-soul", {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({ text:targetText, stage, selectedTag, reviewSource }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setAiResult(p => ({...p,[stage]:data.reply}));
    } catch(e) {
      setAiResult(p => ({...p,[stage]:`오류: ${e.message||"연결 실패. 다시 시도해주세요."}`}));
    }
    setAiLoading(false);
  };

  const tags        = extractTags(texts[1]);
  const meta        = STAGE_META[stage];
  const currentText = texts[stage]||"";
  const hasStage1   = (texts[1]||"").trim().length > 0;
  const hasStage2   = (texts[2]||"").trim().length > 0;
  const reviewText  = reviewSource==="2" ? (texts[2]||"") : (texts[1]||"");
  const canAsk      = stage===3 ? reviewText.trim().length>0 : currentText.trim().length>0;

  const filteredEntries = search
    ? entries.filter(e => (e.title+(e.texts?.[1]||"")).toLowerCase().includes(search.toLowerCase()))
    : entries;

  /* ── Auth gate ── */
  if (!user) return (
    <>
      <style>{CSS}</style>
      <AuthScreen onAuth={handleAuth}/>
    </>
  );

  /* ── SIDEBAR ── */
  const Sidebar = (
    <>
      <div className={`sidebar-overlay ${sidebarOpen?"open":""}`} onClick={()=>setSidebarOpen(false)}/>
      <div className={`sidebar ${sidebarOpen?"open":""}`} style={{
        width:272, minWidth:272, display:"flex", flexDirection:"column",
        background:C.surface, borderRight:`1px solid ${C.border}`,
        height:"100vh", overflow:"hidden", boxShadow:`2px 0 16px ${C.ink}06` }}>

        <div style={{ padding:"22px 18px 14px", borderBottom:`1px solid ${C.borderLight}` }}>
          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:14 }}>
            <span style={{ fontSize:18 }}>🕯️</span>
            <span style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:16, fontWeight:400,
              fontStyle:"italic", color:C.ink, letterSpacing:"0.06em" }}>영혼의 글쓰기</span>
          </div>
          <button className="btn" onClick={newEntry} style={{
            width:"100%", padding:"10px", background:`linear-gradient(135deg,${C.gold},${C.rose})`,
            border:"none", borderRadius:10, color:"#fff", fontFamily:"sans-serif",
            fontSize:13, fontWeight:600, cursor:"pointer", display:"flex",
            alignItems:"center", justifyContent:"center", gap:7,
            boxShadow:`0 3px 14px ${C.gold}28`, transition:"all .2s" }}>
            ✦ 새 글 쓰기
          </button>
        </div>

        <div style={{ padding:"10px 14px 6px" }}>
          <input value={search} onChange={e=>setSearch(e.target.value)}
            placeholder="🔍  검색..." style={{ width:"100%", padding:"8px 12px",
              background:C.surfaceDeep, border:"none", borderRadius:8,
              fontFamily:"sans-serif", fontSize:12, color:C.ink, outline:"none" }}/>
        </div>

        <div style={{ flex:1, overflowY:"auto", padding:"4px 8px" }}>
          {filteredEntries.length===0 ? (
            <div style={{ textAlign:"center", padding:"40px 16px", color:C.inkFaint,
              fontFamily:"sans-serif", fontSize:13, fontWeight:300, lineHeight:2 }}>
              <div style={{ fontSize:28, marginBottom:10 }}>🌿</div>
              {search?"검색 결과가 없어요.":"아직 쓴 글이 없어요.\n새 글을 시작해보세요."}
            </div>
          ) : filteredEntries.map(e => (
            <EntryItem key={e.id} entry={e} active={e.id===activeId}
              onOpen={openEntry} onDelete={id=>setDeleteId(id)}/>
          ))}
        </div>

        <div style={{ padding:"12px 18px", borderTop:`1px solid ${C.borderLight}`,
          display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <span style={{ fontSize:12, color:C.inkMid, fontFamily:"sans-serif", fontWeight:300 }}>{user.name}</span>
          <button className="btn" onClick={logout} style={{ background:"none", border:"none",
            cursor:"pointer", fontSize:12, color:C.inkFaint, padding:"5px 10px",
            borderRadius:6, fontFamily:"sans-serif" }}
            onMouseOver={e=>e.currentTarget.style.color=C.rose}
            onMouseOut={e=>e.currentTarget.style.color=C.inkFaint}>
            로그아웃
          </button>
        </div>
      </div>
    </>
  );

  /* ── MAIN ── */
  return (
    <>
      <style>{CSS}</style>

      {/* ambient glow */}
      <div style={{ position:"fixed", top:-200, left:"50%", transform:"translateX(-50%)",
        width:600, height:360, borderRadius:"50%", pointerEvents:"none", zIndex:0,
        background:`radial-gradient(ellipse,${meta.color}12 0%,transparent 68%)`,
        animation:"shimmer 7s ease-in-out infinite", transition:"background .9s" }}/>

      <div style={{ display:"flex", height:"100vh", overflow:"hidden", position:"relative", zIndex:1 }}>
        {Sidebar}

        {/* ── EDITOR AREA ── */}
        <div style={{ flex:1, display:"flex", flexDirection:"column", height:"100vh",
          overflow:"hidden", background:C.bg, minWidth:0 }}>

          {activeId ? (
            <>
              {/* Header */}
              <div style={{ padding:"14px 20px 12px", display:"flex", alignItems:"center",
                gap:12, background:C.surface, borderBottom:`1px solid ${C.border}`,
                boxShadow:`0 2px 16px ${C.border}40`, flexShrink:0 }}>

                {/* Mobile menu button */}
                <button className="btn" onClick={()=>setSidebarOpen(true)}
                  style={{ display:"none", background:"none", border:`1.5px solid ${C.border}`,
                    borderRadius:8, padding:"7px 10px", cursor:"pointer", color:C.inkMid,
                    fontSize:16, lineHeight:1, flexShrink:0,
                    // shown via media query below
                  }}
                  id="menu-btn">☰</button>

                <div className="editor-header-stages" style={{ display:"flex", gap:8, flex:1, minWidth:0 }}>
                  {[1,2,3].map(s => {
                    const sm = STAGE_META[s];
                    const active = stage===s, past = stage>s;
                    return (
                      <button key={s} className="btn" onClick={()=>goToStage(s)} style={{
                        display:"flex", flexDirection:"column", alignItems:"center", gap:2,
                        padding:"8px 0", borderRadius:10, flex:1,
                        background:active?sm.colorPale:"transparent",
                        border:`1.5px solid ${active?sm.color:past?C.border:C.borderLight}`,
                        color:active?sm.color:past?C.inkLight:C.inkFaint,
                        cursor:"pointer", transition:"all .25s", whiteSpace:"nowrap",
                        boxShadow:active?`0 2px 12px ${sm.color}18`:"none" }}>
                        <span style={{ fontSize:9, fontFamily:"sans-serif", letterSpacing:"0.07em",
                          textTransform:"uppercase", opacity:.6 }}>{s}단계</span>
                        <span style={{ fontSize:11, fontWeight:active?600:400, fontFamily:"sans-serif" }}>
                          {sm.label}
                        </span>
                        {past&&<span style={{ fontSize:9, color:sm.color }}>✓</span>}
                      </button>
                    );
                  })}
                </div>

                <div style={{ display:"flex", alignItems:"center", gap:10, flexShrink:0 }}>
                  {saveStatus==="editing"&&<span style={{ fontSize:11,color:C.inkFaint,fontFamily:"sans-serif" }}>수정 중...</span>}
                  {saveStatus==="saved"&&<span style={{ fontSize:11,color:C.success,fontFamily:"sans-serif" }}>저장됨 ✓</span>}
                  <button className="btn" onClick={()=>saveEntry(false)} style={{
                    padding:"8px 18px", borderRadius:8,
                    background:`linear-gradient(135deg,${C.gold},${C.rose})`,
                    border:"none", color:"#fff", fontSize:12, fontWeight:600,
                    cursor:"pointer", fontFamily:"sans-serif",
                    boxShadow:`0 3px 12px ${C.gold}28`, transition:"all .2s" }}>
                    저장
                  </button>
                </div>
              </div>

              {/* Editor Body */}
              <div style={{ flex:1, overflowY:"auto", padding:"24px 28px 48px",
                display:"flex", flexDirection:"column", gap:20 }}>

                {/* Title */}
                <input value={title} onChange={e=>{setTitle(e.target.value);onEdit();}}
                  placeholder="오늘의 제목..."
                  style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:26, fontWeight:400,
                    fontStyle:"italic", color:C.ink, border:"none", background:"none",
                    outline:"none", width:"100%", letterSpacing:"0.02em" }}/>

                {/* Meta row */}
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
                  paddingBottom:16, borderBottom:`1px solid ${C.borderLight}` }}>
                  <span style={{ fontSize:11, color:C.inkFaint, fontFamily:"sans-serif", fontWeight:300 }}>
                    {activeEntry ? `${fmtDate(activeEntry.updatedAt)} ${fmtTime(activeEntry.updatedAt)} 저장` : ""}
                  </span>
                  <div style={{ display:"flex", alignItems:"center", gap:14 }}>
                    <span style={{ fontSize:11, color:C.inkFaint, fontFamily:"sans-serif" }}>
                      {currentText.replace(/\s/g,"").length}자
                    </span>
                    {meta.duration && <Timer totalSeconds={meta.duration} color={meta.color}/>}
                  </div>
                </div>

                {/* Stage heading */}
                <div>
                  <h2 style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:18,
                    fontWeight:400, color:meta.color, letterSpacing:"0.04em" }}>
                    {{ 1:"오늘 하루 떠오르는 것들",
                       2:selectedTag?`${selectedTag} — 깊이 들어가기`:"주제를 선택해주세요",
                       3:"다시 읽기 & 영혼 확인" }[stage]} <span style={{opacity:.5}}>✦</span>
                  </h2>
                  <p style={{ fontSize:11, color:C.inkLight, marginTop:4, fontFamily:"sans-serif",
                    fontWeight:300, letterSpacing:"0.03em" }}>
                    {{ 1:"#태그로 구분하며 자유롭게 · 15분 권장",
                       2:"내 영혼이 진짜 하고 싶은 말 · 20분 권장",
                       3:"에고 / 무의식 / 영혼 — 어디서 나온 글인가요?" }[stage]}
                  </p>
                </div>

                {/* Stage 2 — tag selector */}
                {stage===2 && tags.length>0 && (
                  <div style={{ display:"flex", alignItems:"center", flexWrap:"wrap", gap:8,
                    padding:"12px 15px", background:C.surfaceDeep,
                    borderRadius:10, border:`1px solid ${C.borderLight}` }}>
                    <span style={{ fontSize:11, color:C.inkLight, fontFamily:"sans-serif" }}>주제 선택</span>
                    {tags.map(t => (
                      <button key={t} className="btn" onClick={()=>setSelTag(t)} style={{
                        padding:"5px 13px", borderRadius:20,
                        background:selectedTag===t?C.rosePale:"transparent",
                        border:`1.5px solid ${selectedTag===t?C.rose:C.border}`,
                        color:selectedTag===t?C.rose:C.inkLight,
                        fontSize:12, cursor:"pointer", transition:"all .2s",
                        fontFamily:"sans-serif", fontWeight:selectedTag===t?500:400 }}>
                        {t}
                      </button>
                    ))}
                  </div>
                )}
                {stage===2 && tags.length===0 && (
                  <div style={{ padding:"14px 18px", borderRadius:10, background:C.goldPale,
                    border:`1px solid ${C.borderFocus}55` }}>
                    <p style={{ margin:0, fontSize:13, color:C.inkMid, fontFamily:"sans-serif", lineHeight:1.7 }}>
                      1단계에서 #태그 형식으로 주제를 적으면 여기서 선택할 수 있어요.{" "}
                      <span style={{ color:C.gold, cursor:"pointer", fontWeight:500 }}
                        onClick={()=>setStage(1)}>→ 1단계로</span>
                    </p>
                  </div>
                )}

                {/* Stage 3 — review panel */}
                {stage===3 ? (
                  <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
                    {!hasStage1 && !hasStage2 ? (
                      <div style={{ padding:"18px 20px", borderRadius:12, background:C.sagePale,
                        border:`1px solid ${C.sage}30` }}>
                        <p style={{ margin:0, fontSize:13, color:C.inkMid, fontFamily:"sans-serif", lineHeight:1.8 }}>
                          1단계와 2단계에서 글을 써야 영혼 확인을 할 수 있어요.{" "}
                          <span style={{ color:C.gold, cursor:"pointer", fontWeight:500 }}
                            onClick={()=>goToStage(1)}>→ 1단계로</span>
                        </p>
                      </div>
                    ) : (
                      <>
                        <div style={{ display:"flex", gap:8 }}>
                          {[{key:"2",label:"2단계 글",color:C.rose,pale:C.rosePale,has:hasStage2},
                            {key:"1",label:"1단계 원문",color:C.gold,pale:C.goldPale,has:hasStage1}].map(({key,label,color,pale,has})=>(
                            <button key={key} className="btn" onClick={()=>has&&setReviewSource(key)} style={{
                              flex:1, padding:"10px 12px", borderRadius:10,
                              background:reviewSource===key?pale:"transparent",
                              border:`1.5px solid ${reviewSource===key?color:C.border}`,
                              color:reviewSource===key?color:has?C.inkLight:C.inkFaint,
                              cursor:has?"pointer":"default", fontFamily:"sans-serif",
                              fontSize:12, fontWeight:reviewSource===key?600:400,
                              transition:"all .2s", opacity:has?1:.45, textAlign:"left" }}>
                              <div style={{ marginBottom:2 }}>{reviewSource===key?"✦":"○"} {label}</div>
                              {has&&<div style={{ fontSize:10, color, opacity:.65, marginTop:2 }}>
                                {(key==="2"?texts[2]:texts[1]).replace(/\n/g," ").slice(0,28)}...
                              </div>}
                            </button>
                          ))}
                        </div>
                        {reviewText.trim() && (
                          <div style={{ padding:"18px 22px", borderRadius:12, maxHeight:200, overflowY:"auto",
                            background:reviewSource==="2"?C.rosePale:C.goldPale,
                            border:`1.5px solid ${reviewSource==="2"?C.rose:C.gold}28`,
                            borderLeft:`3px solid ${reviewSource==="2"?C.rose:C.gold}` }}>
                            <div style={{ fontSize:9, color:reviewSource==="2"?C.rose:C.gold,
                              fontFamily:"sans-serif", fontWeight:700, letterSpacing:"0.07em",
                              textTransform:"uppercase", marginBottom:8 }}>
                              {reviewSource==="2"?"깊이 파고든 글":"브레인덤프 원문"} — 다시 읽어봐요
                            </div>
                            <p style={{ margin:0, fontSize:15, color:C.ink, lineHeight:2,
                              whiteSpace:"pre-wrap", fontFamily:"'Cormorant Garamond',serif",
                              fontWeight:300 }}>{reviewText}</p>
                          </div>
                        )}
                        <div style={{ fontSize:11, color:C.inkLight, fontFamily:"sans-serif" }}>
                          ↓ 읽고 나서 느낀 것, 수정하고 싶은 것을 적어보세요
                        </div>
                        <textarea value={texts[3]||""}
                          onChange={e=>{setTexts(p=>({...p,3:e.target.value}));onEdit();}}
                          placeholder={"이 글이 에고의 말인가요, 무의식인가요, 아니면 진짜 영혼의 소리인가요?\n\n수정하고 싶은 부분이 있다면 지우고 다시 써봐요.\n눈물이 핑 돌면 그게 영혼의 글이에요."}
                          onFocus={()=>setTaFocused(true)} onBlur={()=>setTaFocused(false)}
                          style={{ minHeight:180, background:taFocused?C.surface:C.surfaceWarm,
                            border:`1.5px solid ${taFocused?C.sage+"85":C.border}`, borderRadius:14,
                            padding:"20px 22px", color:C.ink, fontSize:16, lineHeight:2.05,
                            fontFamily:"'Cormorant Garamond',serif", fontWeight:300,
                            resize:"vertical", outline:"none", width:"100%",
                            transition:"border-color .28s,background .28s" }}/>
                      </>
                    )}
                  </div>
                ) : (
                  /* Stage 1 & 2 textarea */
                  <textarea value={currentText}
                    onChange={e=>{setTexts(p=>({...p,[stage]:e.target.value}));onEdit();}}
                    placeholder={{ 1:`오늘 하루 떠오르는 것들을 그냥 막 써봐요.\n#태그 형식으로 주제를 나눠도 좋아요.\n\n예시:\n# 커피\n오늘 아침 커피가 유독 맛있었다...\n\n# 상사와의 갈등\n진짜 너무 힘들었다...`,
                      2:selectedTag?`'${selectedTag}'\n\n내 영혼이 이것에 대해 진짜 하고 싶은 말은 무엇인가요?\n천천히, 기다려봐요.`:"위에서 주제 태그를 먼저 선택해주세요." }[stage]}
                    disabled={stage===2&&tags.length>0&&!selectedTag}
                    onFocus={()=>setTaFocused(true)} onBlur={()=>setTaFocused(false)}
                    style={{ flex:1, minHeight:280, background:taFocused?C.surface:C.surfaceWarm,
                      border:`1.5px solid ${taFocused?meta.color+"85":C.border}`, borderRadius:14,
                      padding:"22px 24px", color:C.ink, fontSize:17, lineHeight:2.05,
                      fontFamily:"'Cormorant Garamond',serif", fontWeight:300,
                      resize:"vertical", outline:"none", transition:"border-color .28s,background .28s",
                      boxShadow:taFocused?`0 0 0 4px ${meta.color}0a,0 4px 20px ${C.border}50`:"none" }}/>
                )}

                {/* Extracted tags (stage 1) */}
                {stage===1 && tags.length>0 && (
                  <div style={{ display:"flex", flexWrap:"wrap", gap:8, alignItems:"center" }}>
                    <span style={{ fontSize:11, color:C.inkLight, fontFamily:"sans-serif" }}>감지된 꼭지</span>
                    {tags.map(t => (
                      <span key={t} style={{ padding:"3px 12px", borderRadius:20,
                        background:C.goldPale, border:`1px solid ${C.goldLight}80`,
                        color:C.gold, fontSize:11.5, fontFamily:"sans-serif", fontWeight:500 }}>{t}</span>
                    ))}
                  </div>
                )}

                {/* Next stage button */}
                {stage<3 && currentText.length>=10 && (
                  <div style={{ display:"flex", justifyContent:"flex-end" }}>
                    <button className="btn" onClick={()=>goToStage(stage+1)} style={{
                      padding:"9px 20px", borderRadius:8, background:"transparent",
                      border:`1.5px solid ${C.border}`, color:C.inkMid,
                      fontSize:12, cursor:"pointer", fontFamily:"sans-serif", transition:"all .2s" }}>
                      다음 단계 →
                    </button>
                  </div>
                )}

                {/* AI Feedback */}
                <AiFeedback
                  result={aiResult[stage]}
                  loading={aiLoading}
                  onAsk={askSoul}
                  canAsk={canAsk && !aiLoading}
                  color={meta.color}/>

                {/* Guide box */}
                <div style={{ padding:"16px 20px", background:meta.colorPale, borderRadius:12,
                  border:`1px solid ${meta.color}28` }}>
                  <p style={{ fontSize:10, color:meta.color, margin:"0 0 8px",
                    fontFamily:"sans-serif", fontWeight:700, letterSpacing:"0.07em",
                    textTransform:"uppercase" }}>
                    ✦ {["브레인덤프 가이드","깊이 파고들기","영혼 확인"][stage-1]}
                  </p>
                  {GUIDES[stage]
                    ? <p style={{ fontSize:13, color:C.inkMid, margin:0, lineHeight:1.85,
                        fontFamily:"sans-serif", fontWeight:300 }}>{GUIDES[stage]}</p>
                    : <SoulTypeLegend/>}
                </div>

              </div>
            </>
          ) : (
            /* Welcome */
            <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center",
              flexDirection:"column", gap:16, padding:40, textAlign:"center" }}>
              {/* Mobile menu button on welcome */}
              <button className="btn" onClick={()=>setSidebarOpen(true)}
                style={{ position:"absolute", top:16, left:16, display:"none",
                  background:"none", border:`1.5px solid ${C.border}`, borderRadius:8,
                  padding:"8px 11px", cursor:"pointer", color:C.inkMid, fontSize:16, lineHeight:1 }}
                id="menu-btn-welcome">☰</button>
              <div style={{ fontSize:50 }}>🕯️</div>
              <h2 style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:26,
                fontWeight:400, fontStyle:"italic", color:C.ink, letterSpacing:"0.06em" }}>
                안녕, 내 영혼의 친구
              </h2>
              <p style={{ fontSize:15, color:C.inkMid, fontFamily:"sans-serif",
                fontWeight:300, lineHeight:1.9, maxWidth:300 }}>
                오늘 하루 어땠나요?<br/>말하고 싶을 때만 와도 돼요.<br/>여기선 아무도 판단하지 않아요.
              </p>
              <button className="btn" onClick={newEntry} style={{
                marginTop:8, padding:"13px 32px",
                background:`linear-gradient(135deg,${C.gold},${C.rose})`,
                border:"none", borderRadius:12, color:"#fff",
                fontFamily:"sans-serif", fontSize:14, fontWeight:600, cursor:"pointer",
                letterSpacing:"0.04em", boxShadow:`0 5px 22px ${C.gold}30`, transition:"all .2s" }}>
                ✦ 새 글 시작하기
              </button>
            </div>
          )}
        </div>
      </div>

      {deleteId && <DeleteModal onConfirm={confirmDelete} onCancel={()=>setDeleteId(null)}/>}
      <Toast msg={toast}/>

      {/* Mobile menu button injection */}
      <style>{`
        @media (max-width: 768px) {
          #menu-btn, #menu-btn-welcome { display:block !important; }
          .editor-header-stages button { padding:8px 4px !important; }
        }
      `}</style>
    </>
  );
}
