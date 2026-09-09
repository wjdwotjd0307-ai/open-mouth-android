import express from "express";
import dotenv from "dotenv";
import { createClient } from "@libsql/client";
import path from "path";
import { fileURLToPath } from "url";
import multer from "multer";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

app.use(express.static("public"));
app.use(express.text({ type: ["application/sdp", "text/plain"], limit: "1mb" }));
app.use(express.json({ limit: "2mb" }));

const db = createClient({
  url: process.env.TURSO_DATABASE_URL || "file:open-mouth.db",
  authToken: process.env.TURSO_AUTH_TOKEN || undefined
});

const dbRun = async (sql, args=[]) => await db.execute({ sql, args });
const dbAll = async (sql, args=[]) => (await db.execute({ sql, args })).rows;
const dbGet = async (sql, args=[]) => (await db.execute({ sql, args })).rows[0] || null;

async function initDatabase() {
  const schemaStatements = [
"CREATE TABLE IF NOT EXISTS profiles (\n  name TEXT PRIMARY KEY,\n  level INTEGER NOT NULL DEFAULT 2,\n  level_test_done INTEGER NOT NULL DEFAULT 0,\n  created_at TEXT NOT NULL\n)",
"CREATE TABLE IF NOT EXISTS sessions (\n  id INTEGER PRIMARY KEY AUTOINCREMENT,\n  profile TEXT NOT NULL,\n  mission_id TEXT NOT NULL,\n  mission_title TEXT NOT NULL,\n  category TEXT NOT NULL,\n  started_at TEXT NOT NULL,\n  ended_at TEXT NOT NULL,\n  duration_seconds INTEGER NOT NULL DEFAULT 0,\n  transcript_json TEXT NOT NULL\n)",
"CREATE TABLE IF NOT EXISTS review_items (\n  id INTEGER PRIMARY KEY AUTOINCREMENT,\n  session_id INTEGER NOT NULL,\n  profile TEXT NOT NULL,\n  original TEXT NOT NULL,\n  better TEXT NOT NULL,\n  reason_ko TEXT NOT NULL,\n  is_reviewed INTEGER NOT NULL DEFAULT 0,\n  created_at TEXT NOT NULL,\n  FOREIGN KEY(session_id) REFERENCES sessions(id)\n)",
"CREATE TABLE IF NOT EXISTS tomorrow_queue (\n  id INTEGER PRIMARY KEY AUTOINCREMENT,\n  profile TEXT NOT NULL,\n  sentence TEXT NOT NULL,\n  created_at TEXT NOT NULL,\n  is_done INTEGER NOT NULL DEFAULT 0\n)",
"CREATE TABLE IF NOT EXISTS repeat_attempts (\n  id INTEGER PRIMARY KEY AUTOINCREMENT,\n  profile TEXT NOT NULL,\n  target_sentence TEXT NOT NULL,\n  transcript TEXT NOT NULL,\n  score INTEGER NOT NULL,\n  passed INTEGER NOT NULL DEFAULT 0,\n  created_at TEXT NOT NULL\n)"
  ];
  for (const statement of schemaStatements) await db.execute(statement);

  const createdAt = new Date().toISOString();
  for (const name of ["재성", "송희"]) {
    await dbRun(
      `INSERT OR IGNORE INTO profiles (name, level, level_test_done, created_at) VALUES (?, ?, 0, ?)`,
      [name, name === "재성" ? 2 : 3, createdAt]
    );
  }
}


const nowIso = () => new Date().toISOString();

const missions = [
  {id:"hotel_checkin",category:"travel",title:"🏨 호텔 체크인",role:"hotel front desk employee",goals:["say you have a reservation","give your name","ask what time breakfast is","ask which floor the room is on","ask one extra question"]},
  {id:"hotel_checkout",category:"travel",title:"🧳 호텔 체크아웃",role:"hotel front desk employee",goals:["say you want to check out","ask about the bill","ask about a late checkout","ask where to leave luggage","thank the staff"]},
  {id:"airport_immigration",category:"travel",title:"🛂 공항 입국심사",role:"immigration officer",goals:["state your travel purpose","say how long you will stay","say where you will stay","answer about a return ticket","ask for clarification if needed"]},
  {id:"airport_checkin",category:"travel",title:"✈️ 공항 체크인",role:"airline check-in agent",goals:["say your destination","show your passport","ask about baggage allowance","choose a seat","ask where the gate is"]},
  {id:"lost_luggage",category:"travel",title:"🧳 수하물 분실 신고",role:"airline baggage service agent",goals:["say your bag is missing","describe the bag","say where you arrived from","give your contact information","ask when it may arrive"]},
  {id:"taxi",category:"travel",title:"🚕 택시 타기",role:"taxi driver",goals:["say your destination","ask how long it will take","ask about payment","respond to small talk","ask to stop at a specific place"]},
  {id:"subway",category:"travel",title:"🚇 지하철 길 묻기",role:"local commuter",goals:["ask which line to take","ask where to transfer","confirm the direction","ask how many stops","say thank you"]},

  {id:"coffee_order",category:"food",title:"☕ 카페 주문",role:"friendly barista",goals:["order a drink","choose a size","ask for less sugar","ask if card payment is okay","respond to one follow-up question"]},
  {id:"restaurant",category:"food",title:"🍽️ 식당 주문",role:"restaurant server",goals:["ask for a table","order one main dish","ask about a menu item","request water","ask for the check"]},
  {id:"restaurant_problem",category:"food",title:"🥘 주문이 잘못 나왔을 때",role:"restaurant server",goals:["politely say the order is wrong","explain what you ordered","ask for a replacement","respond to an apology","close politely"]},
  {id:"fastfood",category:"food",title:"🍔 패스트푸드 주문",role:"fast-food cashier",goals:["order a combo","choose a drink","ask to remove one ingredient","answer dine-in or takeout","confirm the total"]},
  {id:"bakery",category:"food",title:"🥐 빵집에서 고르기",role:"bakery staff member",goals:["ask what is popular","choose two items","ask about ingredients","ask if it is fresh","pay for the order"]},
  {id:"bar_smalltalk",category:"food",title:"🍹 바에서 가벼운 대화",role:"friendly bartender",goals:["order a non-specific drink","answer where you are from","talk about your trip","ask a casual question","end the conversation naturally"]},

  {id:"shopping_clothes",category:"shopping",title:"👕 옷 쇼핑",role:"clothing store employee",goals:["ask for a size","ask to try it on","ask if another color exists","say how it fits","decide whether to buy it"]},
  {id:"shopping_return",category:"shopping",title:"🧾 상품 환불/교환",role:"customer service employee",goals:["say you want to return an item","explain the reason","show the receipt","ask about refund method","close politely"]},
  {id:"pharmacy_basic",category:"shopping",title:"💊 약국에서 일반약 문의",role:"pharmacist",goals:["say you need an over-the-counter product","describe a simple non-emergency need","ask how often to use it","ask about drowsiness","thank the pharmacist"]},
  {id:"souvenir",category:"shopping",title:"🎁 기념품 사기",role:"gift shop employee",goals:["ask for a local gift","give a price range","ask what is popular","ask for gift wrapping","pay for it"]},

  {id:"directions",category:"daily",title:"🗺️ 길 묻기",role:"helpful local person",goals:["ask how to get somewhere","confirm left or right","ask walking time","repeat the direction","thank the person"]},
  {id:"weather_smalltalk",category:"daily",title:"🌤️ 날씨 스몰토크",role:"friendly stranger",goals:["comment on the weather","compare it with Korea","say what you plan to do","ask the other person's plan","end naturally"]},
  {id:"neighbor",category:"daily",title:"🏠 이웃과 첫인사",role:"new neighbor",goals:["introduce yourself","say where you are from","ask how long they have lived there","mention one hobby","suggest talking again"]},
  {id:"gym",category:"daily",title:"🏋️ 헬스장에서 대화",role:"gym staff member",goals:["ask about a day pass","ask where the locker room is","ask about one machine","ask about closing time","thank the staff"]},
  {id:"movie",category:"daily",title:"🎬 영화 이야기",role:"friend",goals:["say what movie you watched","give a short opinion","talk about an actor or scene","ask for a recommendation","react naturally"]},
  {id:"weekend",category:"daily",title:"🌿 주말 계획 이야기",role:"friend",goals:["say your weekend plan","give one detail","ask the other person's plan","react to their answer","suggest an activity"]},

  {id:"office_intro",category:"work",title:"💼 직장에서 자기소개",role:"new coworker",goals:["introduce yourself","say what you do","say how long you have worked","ask about the other person's role","close warmly"]},
  {id:"meeting",category:"work",title:"🗣️ 회의에서 의견 말하기",role:"coworker in a meeting",goals:["state your opinion","give one reason","agree or disagree politely","ask for clarification","summarize your point"]},
  {id:"schedule",category:"work",title:"📅 일정 조율",role:"coworker",goals:["suggest a time","say when you are unavailable","offer another time","confirm the final time","close politely"]},
  {id:"phone_call",category:"work",title:"📞 업무 전화",role:"business contact",goals:["introduce yourself","say why you are calling","ask for the right person","leave a short message","confirm a callback"]},

  {id:"doctor_booking",category:"problem",title:"📅 진료 예약 전화",role:"clinic receptionist",goals:["say you want an appointment","give a preferred day","answer a basic scheduling question","confirm the time","ask what to bring"]},
  {id:"hotel_noise",category:"problem",title:"🔇 호텔 소음 문제",role:"hotel front desk employee",goals:["say there is too much noise","explain where it comes from","ask for help","respond to a solution","thank the staff"]},
  {id:"wrong_charge",category:"problem",title:"💳 결제 금액 오류",role:"store cashier",goals:["say the charge seems wrong","explain what you bought","ask them to check","confirm the corrected amount","close politely"]}
];

const getMission = id => missions.find(m => m.id === id) || missions[0];

app.get("/api/profile/:name", async (req,res) => {
  const row = await dbGet("SELECT name, level, level_test_done FROM profiles WHERE name = ?", [req.params.name]);
  res.json(row || null);
});

app.post("/api/profile/:name/level", async (req,res) => {
  const level = Math.max(1, Math.min(5, Number(req.body.level || 2)));
  await dbRun("UPDATE profiles SET level = ?, level_test_done = 1 WHERE name = ?", [level, req.params.name]);
  res.json({ok:true, level});
});

app.get("/api/missions", (req,res) => {
  res.json(missions.map(({id,category,title,goals}) => ({id,category,title,goals})));
});

app.get("/api/recommendation/:profile", async (req,res) => {
  const profile = req.params.profile;
  const recent = await dbAll(`
    SELECT mission_id, category, ended_at FROM sessions
    WHERE profile = ? ORDER BY ended_at DESC LIMIT 12
  `, [profile]);

  const seen = new Set(recent.slice(0,5).map(r=>r.mission_id));
  const categoryCount = {};
  for (const r of recent) categoryCount[r.category] = (categoryCount[r.category] || 0) + 1;

  const scored = missions.map(m => {
    let score = 100;
    if (seen.has(m.id)) score -= 80;
    score -= (categoryCount[m.category] || 0) * 8;
    return {m, score};
  }).sort((a,b)=>b.score-a.score);

  const topScore = scored[0].score;
  const candidates = scored.filter(x=>x.score===topScore);
  const pick = candidates[Math.floor(Math.random()*candidates.length)]?.m || missions[0];

  res.json({
    mission: {id:pick.id,category:pick.category,title:pick.title,goals:pick.goals},
    reason: recent.length
      ? "최근에 덜 연습한 상황을 우선 추천했습니다."
      : "첫 학습에 부담이 적은 실전 상황부터 시작합니다."
  });
});

app.get("/api/dashboard/:profile", async (req,res) => {
  const profile = req.params.profile;
  const sessions = await dbAll(`SELECT * FROM sessions WHERE profile = ? ORDER BY ended_at DESC`, [profile]);
  const totalSeconds = sessions.reduce((s,x)=>s+(x.duration_seconds||0),0);

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate()-6);
  sevenDaysAgo.setHours(0,0,0,0);

  const week = sessions.filter(s=>new Date(s.ended_at)>=sevenDaysAgo);
  const weekSeconds = week.reduce((s,x)=>s+(x.duration_seconds||0),0);

  const daySet = new Set(sessions.map(s=>s.ended_at.slice(0,10)));
  let streak=0;
  const cursor=new Date();
  for(;;){
    const key=cursor.toISOString().slice(0,10);
    if(daySet.has(key)){streak++;cursor.setDate(cursor.getDate()-1);}
    else break;
  }

  const queue = await dbAll(`
    SELECT id, sentence, created_at FROM tomorrow_queue
    WHERE profile = ? AND is_done = 0 ORDER BY id ASC LIMIT 3
  `, [profile]);

  res.json({
    sessions:sessions.length,
    total_minutes:Math.round(totalSeconds/60),
    week_minutes:Math.round(weekSeconds/60),
    streak,
    queue
  });
});

app.get("/api/weekly-report/:profile", async (req,res) => {
  const profile=req.params.profile;
  const since=new Date(); since.setDate(since.getDate()-6); since.setHours(0,0,0,0);

  const sessions=await dbAll(`
    SELECT * FROM sessions WHERE profile=? AND ended_at>=? ORDER BY ended_at ASC
  `, [profile,since.toISOString()]);

  const reviews=await dbAll(`
    SELECT better, reason_ko, created_at FROM review_items
    WHERE profile=? AND created_at>=? ORDER BY id DESC LIMIT 10
  `, [profile,since.toISOString()]);

  const repeats=await dbAll(`
    SELECT score, passed FROM repeat_attempts
    WHERE profile=? AND created_at>=?
  `, [profile,since.toISOString()]);

  const totalSeconds=sessions.reduce((s,x)=>s+(x.duration_seconds||0),0);
  const avgRepeat=repeats.length?Math.round(repeats.reduce((s,x)=>s+x.score,0)/repeats.length):0;
  const categoryMap={};
  sessions.forEach(s=>categoryMap[s.category]=(categoryMap[s.category]||0)+1);
  const topCategory=Object.entries(categoryMap).sort((a,b)=>b[1]-a[1])[0]?.[0] || "-";

  res.json({
    session_count:sessions.length,
    minutes:Math.round(totalSeconds/60),
    repeat_average:avgRepeat,
    passed_repeats:repeats.filter(x=>x.passed).length,
    top_category:topCategory,
    expressions:reviews.slice(0,5)
  });
});

app.post("/api/review-queue/:id/done",async (req,res)=>{
  await dbRun("UPDATE tomorrow_queue SET is_done=1 WHERE id=?", [req.params.id]);
  res.json({ok:true});
});

function normalizeEnglish(text=""){
  return text.toLowerCase().replace(/[^a-z0-9'\s]/g," ").replace(/\s+/g," ").trim();
}
function levenshtein(a,b){
  const x=a.split(" "), y=b.split(" ");
  const dp=Array.from({length:x.length+1},()=>Array(y.length+1).fill(0));
  for(let i=0;i<=x.length;i++)dp[i][0]=i;
  for(let j=0;j<=y.length;j++)dp[0][j]=j;
  for(let i=1;i<=x.length;i++){
    for(let j=1;j<=y.length;j++){
      const cost=x[i-1]===y[j-1]?0:1;
      dp[i][j]=Math.min(dp[i-1][j]+1,dp[i][j-1]+1,dp[i-1][j-1]+cost);
    }
  }
  return dp[x.length][y.length];
}
function sentenceScore(target,spoken){
  const a=normalizeEnglish(target), b=normalizeEnglish(spoken);
  if(!a||!b)return 0;
  const denom=Math.max(a.split(" ").length,b.split(" ").length,1);
  return Math.max(0,Math.min(100,Math.round((1-levenshtein(a,b)/denom)*100)));
}

async function transcribeAudio(fileBuffer, mime, prompt=""){
  const fd=new FormData();
  fd.set("file",new Blob([fileBuffer],{type:mime||"audio/webm"}),"audio.webm");
  fd.set("model","gpt-4o-mini-transcribe");
  fd.set("language","en");
  if(prompt) fd.set("prompt",prompt);

  const apiRes=await fetch("https://api.openai.com/v1/audio/transcriptions",{
    method:"POST",
    headers:{Authorization:`Bearer ${process.env.OPENAI_API_KEY}`},
    body:fd
  });
  const data=await apiRes.json();
  if(!apiRes.ok) throw new Error(data?.error?.message || "음성 전사 실패");
  return data.text || "";
}

app.post("/api/repeat-check",upload.single("audio"),async(req,res)=>{
  if(!process.env.OPENAI_API_KEY)return res.status(500).json({error:"OPENAI_API_KEY가 설정되지 않았습니다."});
  if(!req.file)return res.status(400).json({error:"녹음 파일이 없습니다."});

  const profile=req.body.profile||"Learner";
  const target=req.body.target||"";
  if(!target.trim())return res.status(400).json({error:"목표 문장이 없습니다."});

  try{
    const spoken=await transcribeAudio(req.file.buffer,req.file.mimetype,`The learner is repeating: ${target}`);
    const score=sentenceScore(target,spoken);
    const passed=score>=80;

    await dbRun(`
      INSERT INTO repeat_attempts (profile,target_sentence,transcript,score,passed,created_at)
      VALUES (?,?,?,?,?,?)
    `, [profile,target,spoken,score,passed?1:0,nowIso()]);

    res.json({
      target,transcript:spoken,score,passed,
      feedback_ko:passed
        ?"좋습니다. 문장을 거의 정확하게 말했습니다."
        :score>=60
          ?"거의 다 왔습니다. 빠진 단어나 바뀐 단어를 확인하고 한 번 더 말해보세요."
          :"문장을 천천히 보고 다시 말해보세요."
    });
  }catch(err){
    console.error(err);
    res.status(500).json({error:err.message || "다시 말하기 분석 중 오류가 발생했습니다."});
  }
});

app.post("/api/level-test",upload.single("audio"),async(req,res)=>{
  if(!process.env.OPENAI_API_KEY)return res.status(500).json({error:"OPENAI_API_KEY가 설정되지 않았습니다."});
  if(!req.file)return res.status(400).json({error:"녹음 파일이 없습니다."});

  const profile=req.body.profile||"Learner";
  try{
    const transcript=await transcribeAudio(
      req.file.buffer,
      req.file.mimetype,
      "The learner is answering a short English speaking placement test about self-introduction, travel, and daily life."
    );

    const prompt=`
You are scoring a short English speaking placement sample from a Korean adult learner.

Transcript:
${transcript}

Score the learner from 1 to 5:
1 = can say isolated words/basic memorized phrases
2 = can make short simple sentences with frequent errors
3 = can sustain basic everyday conversation with pauses/errors
4 = can handle most everyday conversation naturally
5 = fluent, flexible, mostly natural conversation

Return ONLY valid JSON:
{"level":1,"summary_ko":"짧은 한국어 평가","strength_ko":"한 가지 강점","focus_ko":"한 가지 우선 연습점"}
`;
    const apiRes=await fetch("https://api.openai.com/v1/responses",{
      method:"POST",
      headers:{
        Authorization:`Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type":"application/json"
      },
      body:JSON.stringify({model:"gpt-5.6-luna",input:prompt})
    });
    const data=await apiRes.json();
    if(!apiRes.ok) throw new Error(data?.error?.message || "레벨 평가 실패");

    const text=data.output_text || data.output?.flatMap(o=>o.content||[]).find(c=>c.type==="output_text")?.text || "";
    let parsed;
    try{parsed=JSON.parse(text);}catch{
      parsed={level:2,summary_ko:"기초 회화부터 시작하기 좋은 단계입니다.",strength_ko:"영어로 말하려는 시도가 좋습니다.",focus_ko:"짧은 완성 문장을 반복해보세요."};
    }
    parsed.level=Math.max(1,Math.min(5,Number(parsed.level||2)));
    await dbRun("UPDATE profiles SET level=?, level_test_done=1 WHERE name=?", [parsed.level,profile]);
    res.json({...parsed,transcript});
  }catch(err){
    console.error(err);
    res.status(500).json({error:err.message || "레벨 테스트 중 오류가 발생했습니다."});
  }
});

app.post("/session",async(req,res)=>{
  if(!process.env.OPENAI_API_KEY)return res.status(500).json({error:"OPENAI_API_KEY가 설정되지 않았습니다."});

  const mission=getMission(req.query.mission_id);
  const profile=req.query.profile||"Learner";
  const profileRow=await dbGet("SELECT level FROM profiles WHERE name=?", [profile]);
  const level=String(profileRow?.level || req.query.level || 2);

  const levelInstruction={
    "1":"Speak very slowly. Use very simple English. Give a short Korean hint when the learner is stuck.",
    "2":"Speak clearly with simple everyday English. Give Korean hints only when needed.",
    "3":"Use natural everyday English at a moderate pace. Avoid Korean unless the learner is stuck.",
    "4":"Use natural native-like English and useful follow-up questions. Use almost no Korean.",
    "5":"Speak naturally with idiomatic English. Keep the conversation almost entirely in English."
  }[level];

  try{
    const fd=new FormData();
    fd.set("sdp",new Blob([req.body],{type:"application/sdp"}),"offer.sdp");
    fd.set("session",new Blob([JSON.stringify({
      type:"realtime",
      model:"gpt-realtime",
      output_modalities:["audio"],
      audio:{
        input:{
          transcription:{model:"gpt-4o-mini-transcribe"},
          turn_detection:{type:"semantic_vad",eagerness:"medium",create_response:true,interrupt_response:true}
        },
        output:{speed:level==="1"?0.82:level==="2"?0.9:level==="3"?0.96:1.0}
      },
      instructions:`
You are OPEN MOUTH, a friendly English speaking coach for a Korean adult learner named ${profile}.

CORE RULES:
- The learner must speak more than you.
- Keep your replies short.
- Stay in role.
- Do not correct every mistake during the roleplay.
- Ask one question at a time.
- Encourage the learner to ask questions too.
- If the learner freezes, give one tiny hint, then let them speak.
- Never shame mistakes.

LEVEL:
${levelInstruction}

ROLEPLAY:
You are a ${mission.role}.

MISSION GOALS:
${mission.goals.map((g,i)=>`${i+1}. ${g}`).join("\n")}

When the learner has reasonably completed the goals, say:
"Great job. Let's review your English."
Then give only a short wrap-up. Detailed correction happens after the call.
`
    })],{type:"application/json"}),"session.json");

    const apiRes=await fetch("https://api.openai.com/v1/realtime/calls",{
      method:"POST",
      headers:{Authorization:`Bearer ${process.env.OPENAI_API_KEY}`},
      body:fd
    });
    const body=await apiRes.text();
    if(!apiRes.ok)return res.status(apiRes.status).send(body);
    res.type("application/sdp").send(body);
  }catch(err){
    console.error(err);
    res.status(500).json({error:"Realtime 세션 생성 중 오류가 발생했습니다."});
  }
});

app.post("/review",async(req,res)=>{
  if(!process.env.OPENAI_API_KEY)return res.status(500).json({error:"OPENAI_API_KEY가 설정되지 않았습니다."});
  const {profile,mission,transcript,startedAt,endedAt}=req.body||{};
  if(!Array.isArray(transcript)||!transcript.length)return res.status(400).json({error:"대화 기록이 없습니다."});

  const missionObj=getMission(mission?.id);
  const userLines=transcript.filter(x=>x.role==="user").map(x=>x.text).filter(Boolean).join("\n");
  const prompt=`
You are an English speaking coach for a Korean adult learner named ${profile||"Learner"}.

Review only the learner's English below.
Choose exactly 3 high-value corrections.
Prioritize:
1) unnatural or broken sentences,
2) expressions that block conversation,
3) useful phrases worth repeating.

Return ONLY valid JSON:
{
  "summary":"short Korean summary",
  "items":[
    {"original":"learner sentence","better":"natural English","reason_ko":"short Korean explanation"}
  ],
  "tomorrow":"one short useful English sentence to review tomorrow"
}

Learner English:
${userLines}
`;

  try{
    const apiRes=await fetch("https://api.openai.com/v1/responses",{
      method:"POST",
      headers:{Authorization:`Bearer ${process.env.OPENAI_API_KEY}`,"Content-Type":"application/json"},
      body:JSON.stringify({model:"gpt-5.6-luna",input:prompt})
    });
    const data=await apiRes.json();
    if(!apiRes.ok) return res.status(apiRes.status).json(data);

    const text=data.output_text || data.output?.flatMap(o=>o.content||[]).find(c=>c.type==="output_text")?.text || "";
    let parsed;
    try{parsed=JSON.parse(text);}catch{
      parsed={summary:"오늘 대화에서 중요한 표현을 추렸습니다.",items:[],tomorrow:"Could you say that again, please?"};
    }

    const start=startedAt?new Date(startedAt):new Date();
    const end=endedAt?new Date(endedAt):new Date();
    const durationSeconds=Math.max(0,Math.round((end-start)/1000));

    const sessionResult=await dbRun(`
      INSERT INTO sessions (profile,mission_id,mission_title,category,started_at,ended_at,duration_seconds,transcript_json)
      VALUES (?,?,?,?,?,?,?,?)
    `, [profile,missionObj.id,missionObj.title,missionObj.category,start.toISOString(),end.toISOString(),durationSeconds,JSON.stringify(transcript)]);

    const sessionId = Number(sessionResult.lastInsertRowid);
    const createdAt=nowIso();

    for(const item of (parsed.items||[]).slice(0,3)){
      await dbRun(`
        INSERT INTO review_items (session_id,profile,original,better,reason_ko,created_at)
        VALUES (?,?,?,?,?,?)
      `, [sessionId,profile,item.original||"",item.better||"",item.reason_ko||"",createdAt]);
    }
    if(parsed.tomorrow){
      await dbRun(`INSERT INTO tomorrow_queue (profile,sentence,created_at) VALUES (?,?,?)`, [profile,parsed.tomorrow,createdAt]);
    }

    res.json({...parsed,saved:true,session_id:sessionId});
  }catch(err){
    console.error(err);
    res.status(500).json({error:"AI 교정 분석 중 오류가 발생했습니다."});
  }
});

app.get("/health",(req,res)=>res.json({ok:true,version:"1.0.0"}));

const port=Number(process.env.PORT||3000);
initDatabase()
  .then(() => app.listen(port, "0.0.0.0", () => console.log(`OPEN MOUTH mobile running on port ${port}`)))
  .catch(err => {
    console.error("Database initialization failed:", err);
    process.exit(1);
  });
