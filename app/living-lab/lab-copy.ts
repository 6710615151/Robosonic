// Copy for the Living Lab landing sections (LabSections.tsx): hero, robot ecosystem, journey overview,
// calibration progress and the Research Observatory. Calibration step copy stays in copy.ts.
import type { Lang } from "./copy";

const en = {
  shell: {
    name: "Living Lab",
    tagline: "Human-robot interaction research environment",
    navLabel: "Living Lab",
    nav: { overview: "Overview", create: "Create Passport", mine: "My Passport", robot: "Robot Lab", journey: "Hospital Journey", research: "Research" },
    statusLabel: "Lab status",
    sim: { label: "Simulation", pending: "checking…", ok: "running in this browser", off: "3D not available on this device" },
    hardware: { label: "Physical robot", off: "not connected" },
    ai: { label: "AI assistant", ok: "configured", off: "not configured" },
    // Phone-width chips: still a word for every state, never colour alone.
    short: { sim: { pending: "3D sim …", ok: "3D sim on", off: "3D sim off" }, hardware: "No physical robot", ai: { ok: "AI on", off: "AI off" } }
  },
  tiers: { sim: "Simulation", api: "API", future: "Future" },
  overview: {
    hero: {
      eyebrow: "HumanoidTH · HRI Living Lab",
      title: "Where humans meet robots.",
      lead: "A human-robot interaction research lab in your browser. Teach a robot how you like to be cared for, once. Then watch different robots respect it, and help us learn what makes a robot feel safe and kind.",
      cta: "Create your Care Passport",
      ctaNote: "About 1 minute · camera optional · nothing is saved until you agree",
      explore: "Explore the Robot Lab",
      haveOne: "Already have a passport? Start the hospital journey",
      figureLabel: "Atlas, the Living Lab robot, greeting with a Thai wai",
      figureCaption: "Every calibration begins with a wai. Illustration: the robots in this lab are 3D simulations.",
      sampleKicker: "Example passport",
      sample: [["Distance", "medium"], ["Pace", "gentle"], ["Eye contact", "soft"]] as [string, string][]
    },
    resume: {
      eyebrow: "Continue",
      title: "Welcome back",
      body: "This browser keeps the edit key for a Care Passport you created. Open it to share the QR code, change your preferences, or find the code for the hospital journey.",
      open: "Open my passport"
    },
    how: {
      eyebrow: "How it works",
      title: "Four parts, one thread",
      lead: "Your Care Passport is what connects everything here. You create it once; robots read it; the journey tests whether it helps; the research shows what people learned.",
      forLabel: "For",
      audiences: { participant: "Participants", researcher: "Researchers", everyone: "Everyone" },
      steps: [
        { key: "passport", href: "/living-lab/create", title: "Create a Care Passport", for: ["participant"], meta: "About 1 minute", body: "Greet the robot with a wai, then tell it your comfortable distance, pace, eye contact and care needs, by buttons, voice, camera or Auto.", note: "Saved: your preferences. Never saved: video or audio.", action: "Create my passport" },
        { key: "robot", href: "/living-lab/robot", title: "See robots read it", for: ["participant", "researcher"], meta: "Robot A and Robot B", body: "A mobile humanoid and a fixed screen robot read the same passport. Each applies it within its own hardware, and safety rules always come first.", note: "Both robots are browser simulations.", action: "Open the Robot Lab" },
        { key: "journey", href: "/living-lab/meet", title: "Walk the hospital journey", for: ["participant"], meta: "Three stations", body: "At reception, medicine delivery and a doctor call you meet each robot twice, before and after it reads your passport, and rate your comfort from 1 to 5.", note: "Needs your 6-character passport code.", action: "Start the journey" },
        { key: "research", href: "/living-lab/research", title: "See what the lab learns", for: ["researcher", "everyone"], meta: "Anonymous averages", body: "Ratings are combined into group averages that compare the two versions of each robot. No one's individual answers are shown.", note: "Care details stay hidden until at least 5 people share them.", action: "Explore the research" }
      ]
    },
    status: {
      eyebrow: "Lab environment",
      title: "What is real, and what is simulated",
      lead: "Checked when this page loaded.",
      states: { ok: "Available", off: "Unavailable", pending: "Checking", none: "Not connected", live: "Live", configured: "Configured", notConfigured: "Not configured" },
      sim: { label: "Robot simulation", ok: "3D robots run in this browser with three.js. Distances are scene units, not metres.", off: "This device cannot show 3D graphics, so the robots cannot appear. The passport card and research pages still work.", pending: "Checking whether this browser can show 3D robots…" },
      robots: { label: "Robots in the lab", body: (registry: number | null) => `2 lab robots (Robot A and Robot B)${registry === null ? "" : `, plus ${registry} care robot model${registry === 1 ? "" : "s"} listed in the Atlas registry`}. All of them are simulated.` },
      hardware: { label: "Physical robots", body: "No physical robot is connected to or controlled by this site." },
      api: { label: "Passport API", body: "Any system can read a passport with its token at GET /api/hri/passport/{token}. Anxiety, nicknames and session logs are never shared." },
      data: { label: "Research database", ok: "Passports and ratings are saved here.", off: "The database cannot be reached right now, so nothing can be saved. Please try again later." },
      ai: { label: "AI assistant", ok: "Gemini is configured for the passport interview and robot conversation. If it is busy, the lab says so and the other methods still work.", off: "AI features are off on this server. Buttons, voice, camera and Auto all still work." }
    },
    research: {
      eyebrow: "Why this research",
      title: "Care robots should fit people, not the other way around",
      body: [
        "Care robots are arriving in hospitals and homes. But people differ: how close is too close, how fast is too fast, whether eye contact feels warm or intrusive. A capable robot that ignores this can still feel threatening.",
        "The Living Lab asks one question: does a robot that has read your Care Passport feel more comfortable than the same robot that has not?"
      ],
      methodTitle: "How we keep the comparison fair",
      method: [
        ["Same person, both versions", "Everyone meets each robot with and without the passport, so people are compared with themselves."],
        ["Balanced order", "The starting version is chosen at random and alternates between stations, to cancel out order effects."],
        ["One simple rating", "Comfort from 1 (very uncomfortable) to 5 (very comfortable) after each meeting."],
        ["Privacy first", "No video or audio is stored. Care details are hidden in any group smaller than 5."]
      ] as [string, string][],
      disclaimer: "This is simulation research in a web browser, not a clinical study.",
      action: "Explore the research data"
    }
  },
  calibrate: {
    eyebrow: "Care Passport",
    title: "Teach the robot once",
    lead: "Agree, choose how you want to answer, then greet the robot with a wai. Every answer changes how it behaves right away, so you can feel the difference before anything is saved.",
    progressLabel: "Calibration progress",
    stepOf: (n: number, total: number) => `Step ${n} of ${total}`,
    steps: { greet: "Greet", approach: "Distance & pace", care: "Care needs", gaze: "Eye contact", voice: "Voice", confirm: "Review", done: "Passport", auto: "Camera reads you", review: "Review" },
    previewTitle: "Your passport preview",
    previewNote: "This is what robots will read. Nothing is saved until you press Save."
  },
  robots: {
    eyebrow: "Robot ecosystem",
    title: "Different hardware, same respect",
    lead: "A Care Passport describes the person. A capability profile describes the robot. The adapter translates one into the other, and safety rules always come first.",
    capabilities: { mobile: "Moves", head: "Head & gaze", arms: "Arms", speaker: "Speaker", screen: "Screen", maxSpeed: "Max speed" },
    yes: "yes", no: "no",
    open: "See it adapt in the robot console",
    priorityTitle: "Adaptation priority",
    priority: ["Hardware safety", "Clinical protocol", "Your Care Passport", "Robot default"],
    priorityNote: "A passport can make a robot slower or keep it farther away. It never overrides a safety rule.",
    registryTitle: "Care robots in the Atlas registry",
    registrySub: "Real robot models from the HumanoidTH registry. In the hospital journey their behaviour is simulated in the browser; none of them is connected.",
    registryTier: "Registry · simulated",
    meet: "Meet with my passport"
  },
  journey: {
    eyebrow: "Hospital journey",
    title: "Three stations, two robots each",
    lead: "At every station you meet the same robot twice: once as a default robot that has not read your passport, once after it has. You rate each from 1 to 5. The order alternates between stations, so the comparison is fair.",
    stations: [
      { key: "reception", title: "Reception & check-in", body: "A reception robot greets you and points you to the clinic." },
      { key: "delivery", title: "Medicine delivery", body: "A delivery robot brings your medicine, handing it over or placing it nearby." },
      { key: "telepresence", title: "Doctor call", body: "A telepresence robot connects you to your doctor." }
    ],
    protocol: ["Introduction", "Robot without passport", "Robot with passport", "Rate your comfort"],
    protocolNote: "Steps 2 and 3 swap order from one station to the next.",
    start: "Start the journey",
    startWithCode: (code: string) => `Start the journey with ${code}`,
    needPassport: "You need a Care Passport first, or enter an existing code."
  },
  research: {
    eyebrow: "Research Observatory",
    title: "What the Living Lab is learning",
    provenance: "Simulation data. Visitors rated three.js robots in a web browser, not physical robots, under uncontrolled conditions. This is not a clinical study and should not be cited as one.",
    window: "Period",
    windows: { all: "All time", "30d": "Last 30 days", "7d": "Last 7 days" },
    export: "Download aggregates (CSV)",
    offline: "The research database is not reachable right now, so no statistics can be shown.",
    empty: "No data in this period yet.",
    n: (n: number) => `n = ${n}`,
    comfortTitle: "Human comfort",
    comfortSub: "Mean rating, 1 (very uncomfortable) to 5 (very comfortable)",
    passport: "With passport",
    default: "Default robot",
    paired: "Within-person difference",
    pairedSub: (n: number) => `Passport minus default, same person and station · ${n} pair${n === 1 ? "" : "s"}`,
    pairedNone: "No paired ratings yet. Pairs come from the counterbalanced journey.",
    byStation: "By station",
    byRobot: "By robot",
    stationNames: { reception: "Reception", delivery: "Medicine delivery", telepresence: "Doctor call", unknown: "Unlabelled" } as Record<string, string>,
    orderTitle: "Condition order",
    orderBody: (p: number, d: number, u: number) => `Passport first: ${p} · Default first: ${d} · Before counterbalancing: ${u}`,
    prefsTitle: "Behaviour preferences",
    prefsSub: (n: number) => `Share of ${n} passport${n === 1 ? "" : "s"}`,
    prefs: { softGaze: "Soft eye contact", slower: "Slower movement", voiceOn: "Spoken voice", noReach: "No reaching", largeCaptions: "Large captions" },
    suppressed: (min: number) => `hidden below ${min} people`,
    greetingTitle: "Greeting",
    greetings: { wai: "Wai", wave: "Wave", none: "No gesture" },
    calibrationTitle: "Calibration",
    calibrationSub: (n: number) => `${n} saved calibration${n === 1 ? "" : "s"} by input mode`,
    inputModes: { buttons: "Buttons", voice: "Voice", camera: "Camera", auto: "Auto (camera)" },
    tooClose: (n: number) => `"Too close" signals during calibration: ${n}`,
    avgDistance: "Typical comfort distance",
    distance: { close: "close", medium: "medium", far: "far" } as Record<string, string>,
    qualityTitle: "Data quality",
    quality: {
      participants: "Verified participants",
      unlinked: "Passports without a verified email",
      stations: "Station sessions",
      missing: "Sessions without a valid rating"
    },
    limitsTitle: "Limitations",
    limits: [
      "Simulated robots on a screen do not create the physical presence of a real robot. Comfort may differ in person.",
      "Visitors self-select. The sample is not representative of patients.",
      "Camera-based measurements have not been validated against real people; they are estimates.",
      "Not tracked, by design: calibration abandonment, recalibration and consent withdrawal. Deleting a passport is a hard delete and leaves no record to count.",
      "Without a verified email, one person can create several passports, which can count them more than once."
    ]
  }
};

const th: typeof en = {
  shell: {
    name: "Living Lab",
    tagline: "สภาพแวดล้อมวิจัยปฏิสัมพันธ์ระหว่างมนุษย์กับหุ่นยนต์",
    navLabel: "Living Lab",
    nav: { overview: "ภาพรวม", create: "สร้างพาสปอร์ต", mine: "พาสปอร์ตของฉัน", robot: "ห้องทดลองหุ่นยนต์", journey: "เส้นทางโรงพยาบาล", research: "งานวิจัย" },
    statusLabel: "สถานะแล็บ",
    sim: { label: "การจำลอง", pending: "กำลังตรวจสอบ…", ok: "ทำงานในเบราว์เซอร์นี้", off: "อุปกรณ์นี้แสดงภาพ 3 มิติไม่ได้" },
    hardware: { label: "หุ่นยนต์จริง", off: "ไม่ได้เชื่อมต่อ" },
    ai: { label: "ผู้ช่วย AI", ok: "ตั้งค่าแล้ว", off: "ยังไม่ได้ตั้งค่า" },
    short: { sim: { pending: "จำลอง 3D …", ok: "จำลอง 3D ทำงาน", off: "จำลอง 3D ใช้ไม่ได้" }, hardware: "ไม่มีหุ่นยนต์จริง", ai: { ok: "AI พร้อม", off: "AI ปิด" } }
  },
  tiers: { sim: "จำลอง", api: "API", future: "อนาคต" },
  overview: {
    hero: {
      eyebrow: "HumanoidTH · HRI Living Lab",
      title: "ที่ที่มนุษย์พบกับหุ่นยนต์",
      lead: "ห้องวิจัยปฏิสัมพันธ์ระหว่างมนุษย์กับหุ่นยนต์ในเบราว์เซอร์ของคุณ สอนหุ่นยนต์เพียงครั้งเดียวว่าคุณอยากได้รับการดูแลแบบไหน แล้วดูหุ่นยนต์แต่ละตัวเคารพสิ่งนั้น และช่วยเราเรียนรู้ว่าอะไรทำให้หุ่นยนต์รู้สึกปลอดภัยและเป็นมิตร",
      cta: "สร้าง Care Passport ของคุณ",
      ctaNote: "ประมาณ 1 นาที · ไม่ต้องใช้กล้องก็ได้ · ไม่มีอะไรถูกบันทึกจนกว่าคุณจะยินยอม",
      explore: "สำรวจห้องทดลองหุ่นยนต์",
      haveOne: "มีพาสปอร์ตแล้ว? เริ่มเส้นทางโรงพยาบาล",
      figureLabel: "Atlas หุ่นยนต์ของ Living Lab กำลังไหว้ทักทาย",
      figureCaption: "การปรับเทียบทุกครั้งเริ่มด้วยการไหว้ ภาพประกอบ: หุ่นยนต์ในแล็บนี้เป็นการจำลอง 3 มิติ",
      sampleKicker: "ตัวอย่างพาสปอร์ต",
      sample: [["ระยะ", "ปานกลาง"], ["ความเร็ว", "นุ่มนวล"], ["การสบตา", "เบา ๆ"]] as [string, string][]
    },
    resume: {
      eyebrow: "ทำต่อ",
      title: "ยินดีต้อนรับกลับมา",
      body: "เบราว์เซอร์นี้เก็บรหัสแก้ไขของ Care Passport ที่คุณสร้างไว้ เปิดเพื่อแชร์ QR แก้ไขความต้องการ หรือดูรหัสสำหรับเส้นทางโรงพยาบาล",
      open: "เปิดพาสปอร์ตของฉัน"
    },
    how: {
      eyebrow: "ทำงานอย่างไร",
      title: "สี่ส่วน เชื่อมด้วยพาสปอร์ตใบเดียว",
      lead: "Care Passport คือสิ่งที่เชื่อมทุกส่วนเข้าด้วยกัน คุณสร้างครั้งเดียว หุ่นยนต์อ่านมัน เส้นทางโรงพยาบาลทดสอบว่ามันช่วยได้จริงไหม และงานวิจัยแสดงสิ่งที่ได้เรียนรู้",
      forLabel: "สำหรับ",
      audiences: { participant: "ผู้เข้าร่วม", researcher: "นักวิจัย", everyone: "ทุกคน" },
      steps: [
        { key: "passport", href: "/living-lab/create", title: "สร้าง Care Passport", for: ["participant"], meta: "ประมาณ 1 นาที", body: "ไหว้ทักทายหุ่นยนต์ แล้วบอกระยะ ความเร็ว การสบตา และความต้องการด้านการดูแลที่คุณสบายใจ ผ่านปุ่ม เสียง กล้อง หรือโหมดอัตโนมัติ", note: "บันทึก: ความต้องการของคุณ · ไม่บันทึก: วิดีโอหรือเสียง", action: "สร้างพาสปอร์ตของฉัน" },
        { key: "robot", href: "/living-lab/robot", title: "ดูหุ่นยนต์อ่านพาสปอร์ต", for: ["participant", "researcher"], meta: "Robot A และ Robot B", body: "หุ่นฮิวแมนนอยด์ที่เคลื่อนที่ได้ และหุ่นจอที่ติดอยู่กับที่ อ่านพาสปอร์ตใบเดียวกัน แต่ละตัวปรับตามฮาร์ดแวร์ของตัวเอง และกฎความปลอดภัยมาก่อนเสมอ", note: "หุ่นทั้งสองเป็นการจำลองในเบราว์เซอร์", action: "เปิดห้องทดลองหุ่นยนต์" },
        { key: "journey", href: "/living-lab/meet", title: "เดินเส้นทางโรงพยาบาล", for: ["participant"], meta: "สามจุด", body: "ที่จุดต้อนรับ จุดส่งยา และจุดโทรหาแพทย์ คุณจะพบหุ่นแต่ละตัวสองครั้ง ก่อนและหลังที่มันอ่านพาสปอร์ต แล้วให้คะแนนความสบายใจ 1 ถึง 5", note: "ต้องใช้รหัสพาสปอร์ต 6 ตัวอักษร", action: "เริ่มเส้นทาง" },
        { key: "research", href: "/living-lab/research", title: "ดูสิ่งที่แล็บเรียนรู้", for: ["researcher", "everyone"], meta: "ค่าเฉลี่ยแบบไม่ระบุตัวตน", body: "คะแนนถูกรวมเป็นค่าเฉลี่ยของกลุ่ม เพื่อเปรียบเทียบหุ่นสองแบบ ไม่มีการแสดงคำตอบของใครเป็นรายบุคคล", note: "ข้อมูลด้านการดูแลจะถูกซ่อนจนกว่าจะมีอย่างน้อย 5 คน", action: "สำรวจงานวิจัย" }
      ]
    },
    status: {
      eyebrow: "สภาพแวดล้อมของแล็บ",
      title: "อะไรจริง อะไรจำลอง",
      lead: "ตรวจสอบเมื่อเปิดหน้านี้",
      states: { ok: "พร้อม", off: "ใช้ไม่ได้", pending: "กำลังตรวจสอบ", none: "ไม่ได้เชื่อมต่อ", live: "ใช้งานได้", configured: "ตั้งค่าแล้ว", notConfigured: "ยังไม่ได้ตั้งค่า" },
      sim: { label: "การจำลองหุ่นยนต์", ok: "หุ่น 3 มิติทำงานในเบราว์เซอร์นี้ด้วย three.js ระยะทางเป็นหน่วยในฉาก ไม่ใช่เมตร", off: "อุปกรณ์นี้แสดงภาพ 3 มิติไม่ได้ จึงไม่เห็นหุ่นยนต์ แต่หน้าพาสปอร์ตและหน้างานวิจัยยังใช้ได้", pending: "กำลังตรวจว่าเบราว์เซอร์นี้แสดงหุ่น 3 มิติได้หรือไม่…" },
      robots: { label: "หุ่นยนต์ในแล็บ", body: (registry: number | null) => `หุ่นของแล็บ 2 ตัว (Robot A และ Robot B)${registry === null ? "" : ` และหุ่นดูแล ${registry} รุ่นที่อยู่ในทะเบียน Atlas`} ทั้งหมดเป็นการจำลอง` },
      hardware: { label: "หุ่นยนต์จริง", body: "ไม่มีหุ่นยนต์จริงตัวใดเชื่อมต่อหรือถูกควบคุมจากเว็บไซต์นี้" },
      api: { label: "Passport API", body: "ระบบใดก็อ่านพาสปอร์ตได้ด้วย token ที่ GET /api/hri/passport/{token} โดยไม่เปิดเผยระดับความกังวล ชื่อเล่น หรือบันทึกการใช้งาน" },
      data: { label: "ฐานข้อมูลวิจัย", ok: "พาสปอร์ตและคะแนนถูกบันทึกที่นี่", off: "ตอนนี้เชื่อมต่อฐานข้อมูลไม่ได้ จึงบันทึกอะไรไม่ได้ กรุณาลองใหม่ภายหลัง" },
      ai: { label: "ผู้ช่วย AI", ok: "ตั้งค่า Gemini แล้ว สำหรับการสัมภาษณ์พาสปอร์ตและการคุยกับหุ่นยนต์ ถ้าระบบไม่ว่าง แล็บจะแจ้ง และวิธีอื่นยังใช้ได้", off: "ปิดฟีเจอร์ AI บนเซิร์ฟเวอร์นี้ ปุ่ม เสียง กล้อง และโหมดอัตโนมัติยังใช้ได้ทั้งหมด" }
    },
    research: {
      eyebrow: "ทำไมต้องวิจัยเรื่องนี้",
      title: "หุ่นดูแลควรปรับตามคน ไม่ใช่ให้คนปรับตามหุ่น",
      body: [
        "หุ่นดูแลกำลังเข้ามาในโรงพยาบาลและบ้าน แต่คนแต่ละคนต่างกัน ใกล้แค่ไหนถึงจะใกล้เกินไป เร็วแค่ไหนถึงจะเร็วเกินไป การสบตาให้ความรู้สึกอบอุ่นหรือรุกล้ำ หุ่นที่เก่งแต่ไม่สนใจเรื่องเหล่านี้ก็ยังทำให้คนรู้สึกไม่ปลอดภัยได้",
        "Living Lab ถามคำถามเดียว: หุ่นยนต์ที่อ่าน Care Passport ของคุณแล้ว ทำให้รู้สึกสบายใจกว่าหุ่นตัวเดียวกันที่ยังไม่ได้อ่านหรือไม่"
      ],
      methodTitle: "เราทำให้การเปรียบเทียบยุติธรรมอย่างไร",
      method: [
        ["คนเดิม ทั้งสองแบบ", "ทุกคนพบหุ่นแต่ละตัวทั้งแบบมีและไม่มีพาสปอร์ต จึงเปรียบเทียบกับตัวเอง"],
        ["ลำดับที่สมดุล", "แบบที่เริ่มก่อนถูกสุ่ม และสลับกันในแต่ละจุด เพื่อตัดผลจากลำดับ"],
        ["คะแนนเดียวที่เข้าใจง่าย", "ความสบายใจ 1 (ไม่สบายใจมาก) ถึง 5 (สบายใจมาก) หลังพบหุ่นแต่ละครั้ง"],
        ["ความเป็นส่วนตัวมาก่อน", "ไม่เก็บวิดีโอหรือเสียง ข้อมูลด้านการดูแลจะถูกซ่อนในกลุ่มที่มีไม่ถึง 5 คน"]
      ] as [string, string][],
      disclaimer: "นี่คืองานวิจัยด้วยการจำลองในเว็บเบราว์เซอร์ ไม่ใช่การศึกษาทางคลินิก",
      action: "สำรวจข้อมูลงานวิจัย"
    }
  },
  calibrate: {
    eyebrow: "Care Passport",
    title: "สอนหุ่นยนต์เพียงครั้งเดียว",
    lead: "ให้ความยินยอม เลือกวิธีตอบ แล้วไหว้ทักทายหุ่นยนต์ ทุกคำตอบเปลี่ยนพฤติกรรมของหุ่นทันที คุณจึงรู้สึกถึงความต่างได้ก่อนจะบันทึกอะไร",
    progressLabel: "ความคืบหน้าการปรับเทียบ",
    stepOf: (n: number, total: number) => `ขั้นที่ ${n} จาก ${total}`,
    steps: { greet: "ทักทาย", approach: "ระยะและความเร็ว", care: "การดูแล", gaze: "การสบตา", voice: "เสียง", confirm: "ตรวจทาน", done: "พาสปอร์ต", auto: "กล้องอ่านท่าทาง", review: "ตรวจทาน" },
    previewTitle: "ตัวอย่างพาสปอร์ตของคุณ",
    previewNote: "นี่คือสิ่งที่หุ่นยนต์จะอ่าน ยังไม่มีอะไรถูกบันทึกจนกว่าคุณจะกดบันทึก"
  },
  robots: {
    eyebrow: "ระบบนิเวศหุ่นยนต์",
    title: "ฮาร์ดแวร์ต่างกัน แต่เคารพคุณเหมือนกัน",
    lead: "Care Passport อธิบายตัวคน โปรไฟล์ความสามารถอธิบายตัวหุ่น ตัวแปลง (adapter) แปลงสิ่งหนึ่งเป็นอีกสิ่ง และกฎความปลอดภัยมาก่อนเสมอ",
    capabilities: { mobile: "เคลื่อนที่", head: "หัวและการมอง", arms: "แขน", speaker: "ลำโพง", screen: "หน้าจอ", maxSpeed: "ความเร็วสูงสุด" },
    yes: "มี", no: "ไม่มี",
    open: "ดูการปรับตัวในคอนโซลหุ่นยนต์",
    priorityTitle: "ลำดับความสำคัญของการปรับ",
    priority: ["ความปลอดภัยของฮาร์ดแวร์", "ระเบียบทางคลินิก", "Care Passport ของคุณ", "ค่าเริ่มต้นของหุ่น"],
    priorityNote: "พาสปอร์ตทำให้หุ่นช้าลงหรือรักษาระยะห่างมากขึ้นได้ แต่ไม่มีทางอยู่เหนือกฎความปลอดภัย",
    registryTitle: "หุ่นดูแลใน registry ของ Atlas",
    registrySub: "หุ่นรุ่นจริงจาก registry ของ HumanoidTH ในเส้นทางโรงพยาบาล พฤติกรรมของหุ่นเหล่านี้จำลองในเบราว์เซอร์ ไม่มีตัวใดเชื่อมต่ออยู่จริง",
    registryTier: "Registry · จำลอง",
    meet: "พบด้วยพาสปอร์ตของฉัน"
  },
  journey: {
    eyebrow: "เส้นทางโรงพยาบาล",
    title: "สามสถานี สถานีละสองรอบ",
    lead: "ในแต่ละสถานีคุณจะพบหุ่นตัวเดิมสองครั้ง ครั้งหนึ่งเป็นหุ่นแบบปกติที่ยังไม่ได้อ่านพาสปอร์ต และอีกครั้งหลังจากอ่านแล้ว คุณให้คะแนนแต่ละครั้ง 1 ถึง 5 ลำดับจะสลับกันในแต่ละสถานีเพื่อให้การเปรียบเทียบยุติธรรม",
    stations: [
      { key: "reception", title: "ต้อนรับและลงทะเบียน", body: "หุ่นต้อนรับทักทายและชี้ทางไปคลินิก" },
      { key: "delivery", title: "ส่งยา", body: "หุ่นส่งของนำยามาให้ ยื่นให้ถึงมือหรือวางไว้ใกล้ ๆ" },
      { key: "telepresence", title: "พบแพทย์ทางไกล", body: "หุ่นเทเลเพรเซนซ์เชื่อมต่อคุณกับแพทย์" }
    ],
    protocol: ["แนะนำ", "หุ่นที่ไม่มีพาสปอร์ต", "หุ่นที่อ่านพาสปอร์ต", "ให้คะแนนความสบายใจ"],
    protocolNote: "ขั้นที่ 2 และ 3 สลับลำดับกันในแต่ละสถานี",
    start: "เริ่มเส้นทาง",
    startWithCode: (code: string) => `เริ่มเส้นทางด้วย ${code}`,
    needPassport: "ต้องมี Care Passport ก่อน หรือใส่รหัสที่มีอยู่แล้ว"
  },
  research: {
    eyebrow: "หอสังเกตการณ์งานวิจัย",
    title: "สิ่งที่ Living Lab กำลังเรียนรู้",
    provenance: "ข้อมูลจากการจำลอง ผู้เข้าชมให้คะแนนหุ่น three.js ในเว็บเบราว์เซอร์ ไม่ใช่หุ่นจริง และไม่ได้ควบคุมสภาพแวดล้อม นี่ไม่ใช่การศึกษาทางคลินิกและไม่ควรอ้างอิงในฐานะนั้น",
    window: "ช่วงเวลา",
    windows: { all: "ทั้งหมด", "30d": "30 วันล่าสุด", "7d": "7 วันล่าสุด" },
    export: "ดาวน์โหลดข้อมูลสรุป (CSV)",
    offline: "เชื่อมต่อฐานข้อมูลงานวิจัยไม่ได้ในขณะนี้ จึงแสดงสถิติไม่ได้",
    empty: "ยังไม่มีข้อมูลในช่วงเวลานี้",
    n: (n: number) => `n = ${n}`,
    comfortTitle: "ความสบายใจของคน",
    comfortSub: "คะแนนเฉลี่ย 1 (ไม่สบายใจเลย) ถึง 5 (สบายใจมาก)",
    passport: "มีพาสปอร์ต",
    default: "หุ่นแบบปกติ",
    paired: "ผลต่างภายในบุคคล",
    pairedSub: (n: number) => `พาสปอร์ตลบหุ่นปกติ คนเดียวกัน สถานีเดียวกัน · ${n} คู่`,
    pairedNone: "ยังไม่มีคะแนนแบบจับคู่ คู่คะแนนมาจากเส้นทางที่สลับลำดับ",
    byStation: "แยกตามสถานี",
    byRobot: "แยกตามหุ่นยนต์",
    stationNames: { reception: "ต้อนรับ", delivery: "ส่งยา", telepresence: "พบแพทย์ทางไกล", unknown: "ไม่ระบุ" } as Record<string, string>,
    orderTitle: "ลำดับเงื่อนไข",
    orderBody: (p: number, d: number, u: number) => `พาสปอร์ตก่อน: ${p} · หุ่นปกติก่อน: ${d} · ก่อนมีการสลับลำดับ: ${u}`,
    prefsTitle: "ความชอบด้านพฤติกรรม",
    prefsSub: (n: number) => `สัดส่วนจากพาสปอร์ต ${n} ใบ`,
    prefs: { softGaze: "สบตาแบบนุ่มนวล", slower: "เคลื่อนที่ช้าลง", voiceOn: "พูดออกเสียง", noReach: "ไม่ยื่นมือ", largeCaptions: "ตัวอักษรใหญ่" },
    suppressed: (min: number) => `ซ่อนไว้เมื่อน้อยกว่า ${min} คน`,
    greetingTitle: "การทักทาย",
    greetings: { wai: "ไหว้", wave: "โบกมือ", none: "ไม่แสดงท่าทาง" },
    calibrationTitle: "การปรับเทียบ",
    calibrationSub: (n: number) => `การปรับเทียบที่บันทึก ${n} ครั้ง แยกตามวิธีตอบ`,
    inputModes: { buttons: "ปุ่ม", voice: "เสียง", camera: "กล้อง", auto: "อัตโนมัติ (กล้อง)" },
    tooClose: (n: number) => `สัญญาณ "ใกล้ไป" ระหว่างปรับเทียบ: ${n}`,
    avgDistance: "ระยะที่สบายใจโดยทั่วไป",
    distance: { close: "ใกล้", medium: "ปานกลาง", far: "ห่าง" } as Record<string, string>,
    qualityTitle: "คุณภาพข้อมูล",
    quality: {
      participants: "ผู้เข้าร่วมที่ยืนยันแล้ว",
      unlinked: "พาสปอร์ตที่ไม่ได้ยืนยันอีเมล",
      stations: "เซสชันสถานี",
      missing: "เซสชันที่ไม่มีคะแนนที่ถูกต้อง"
    },
    limitsTitle: "ข้อจำกัด",
    limits: [
      "หุ่นจำลองบนจอไม่ได้สร้างความรู้สึกถึงการมีอยู่ทางกายภาพเหมือนหุ่นจริง ความสบายใจเมื่อพบจริงอาจต่างออกไป",
      "ผู้เข้าชมเลือกเข้าร่วมเอง กลุ่มตัวอย่างจึงไม่ได้เป็นตัวแทนของผู้ป่วย",
      "การวัดผ่านกล้องยังไม่ได้ตรวจสอบความแม่นยำกับคนจริง เป็นเพียงค่าประมาณ",
      "ไม่ได้ติดตามโดยตั้งใจ: การเลิกกลางคัน การปรับเทียบซ้ำ และการถอนความยินยอม การลบพาสปอร์ตเป็นการลบถาวรที่ไม่เหลือบันทึกให้นับ",
      "หากไม่ได้ยืนยันอีเมล คนเดียวอาจสร้างหลายพาสปอร์ต ซึ่งทำให้นับซ้ำได้"
    ]
  }
};

export const labCopy = { en, th } satisfies Record<Lang, typeof en>;
export type LabCopy = typeof en;
