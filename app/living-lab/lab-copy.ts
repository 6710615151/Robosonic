// Copy for the Living Lab landing sections (LabSections.tsx): hero, robot ecosystem, journey overview,
// calibration progress and the Research Observatory. Calibration step copy stays in copy.ts.
import type { Lang } from "./copy";

const en = {
  nav: { label: "Living Lab sections", calibrate: "Create a passport", robots: "Robots", journey: "Hospital journey", research: "Research" },
  hero: {
    eyebrow: "HRI Wellness Living Lab",
    title: "One profile. Every robot understands you.",
    lead: "Every human has different needs. Every robot should know how to respect them. Teach one care robot your comfortable distance, pace, eye contact and care needs once. Your Care Passport carries them to every robot you meet, and each robot applies them within its own hardware.",
    cta: "Create my Care Passport",
    haveOne: "I already have a passport",
    console: "Open the robot console",
    facts: [
      { value: "≈ 1 min", label: "guided calibration" },
      { value: "4", label: "ways to answer: buttons, voice, camera, auto" },
      { value: "0", label: "video frames stored or sent" }
    ],
    diagramLabel: "One Care Passport is read by several robots, each with different hardware",
    passport: "Care Passport",
    passportSub: "Human preferences · schema v1",
    reads: "reads the same passport",
    tiers: { sim: "Simulation", api: "API", future: "Future" },
    nodes: [
      { tier: "sim", name: "Robot A · full humanoid", detail: "Moves, wais, looks at you, hands items over" },
      { tier: "sim", name: "Robot B · screen-only", detail: "Fixed base, no arms: adapts on screen" },
      { tier: "api", name: "Your system", detail: "GET /api/hri/passport/{token}" },
      { tier: "future", name: "Physical care robots", detail: "Not connected. No hardware is controlled." }
    ],
    tierNote: "Simulation: three.js robots running in this browser. API: a live HTTP contract any system can call today. Future: physical robot integration, not built."
  },
  calibrate: {
    eyebrow: "01 · Care Passport",
    title: "Teach the robot once",
    lead: "Verify your email if you want to keep the passport, give consent, then greet the robot. Every answer changes its behaviour right away, so you can feel the difference before you save.",
    progressLabel: "Calibration progress",
    stepOf: (n: number, total: number) => `Step ${n} of ${total}`,
    steps: { greet: "Greet", approach: "Distance & pace", care: "Care needs", gaze: "Eye contact", voice: "Voice", confirm: "Review", done: "Passport", auto: "Camera reads you", review: "Review" },
    previewTitle: "Your passport preview",
    previewNote: "This is what robots will read. Nothing is saved until you press Save."
  },
  robots: {
    eyebrow: "02 · Robot ecosystem",
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
    eyebrow: "03 · Hospital journey",
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
    eyebrow: "04 · Research Observatory",
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
  nav: { label: "ส่วนต่าง ๆ ของ Living Lab", calibrate: "สร้างพาสปอร์ต", robots: "หุ่นยนต์", journey: "เส้นทางโรงพยาบาล", research: "งานวิจัย" },
  hero: {
    eyebrow: "HRI Wellness Living Lab",
    title: "โปรไฟล์เดียว หุ่นยนต์ทุกตัวเข้าใจคุณ",
    lead: "มนุษย์แต่ละคนมีความต้องการต่างกัน หุ่นยนต์ทุกตัวควรรู้วิธีเคารพความต้องการนั้น สอนหุ่นดูแลหนึ่งตัวเพียงครั้งเดียวว่าระยะ ความเร็ว การสบตา และความต้องการด้านการดูแลแบบไหนที่คุณสบายใจ Care Passport จะพาข้อมูลนี้ไปยังหุ่นทุกตัวที่คุณพบ และหุ่นแต่ละตัวจะปรับตามฮาร์ดแวร์ของตัวเอง",
    cta: "สร้าง Care Passport ของฉัน",
    haveOne: "ฉันมีพาสปอร์ตแล้ว",
    console: "เปิดคอนโซลหุ่นยนต์",
    facts: [
      { value: "≈ 1 นาที", label: "การปรับเทียบแบบมีผู้นำทาง" },
      { value: "4", label: "วิธีตอบ: ปุ่ม เสียง กล้อง อัตโนมัติ" },
      { value: "0", label: "เฟรมวิดีโอที่ถูกเก็บหรือส่งออก" }
    ],
    diagramLabel: "Care Passport ใบเดียวถูกอ่านโดยหุ่นหลายตัวที่มีฮาร์ดแวร์ต่างกัน",
    passport: "Care Passport",
    passportSub: "ความต้องการของคน · schema v1",
    reads: "อ่านพาสปอร์ตใบเดียวกัน",
    tiers: { sim: "จำลอง", api: "API", future: "อนาคต" },
    nodes: [
      { tier: "sim", name: "Robot A · หุ่นเต็มรูปแบบ", detail: "เคลื่อนที่ ไหว้ สบตา และยื่นของให้ได้" },
      { tier: "sim", name: "Robot B · จออย่างเดียว", detail: "ฐานติดที่ ไม่มีแขน ปรับผ่านหน้าจอ" },
      { tier: "api", name: "ระบบของคุณ", detail: "GET /api/hri/passport/{token}" },
      { tier: "future", name: "หุ่นดูแลจริง", detail: "ยังไม่ได้เชื่อมต่อ ไม่มีการควบคุมฮาร์ดแวร์" }
    ],
    tierNote: "จำลอง: หุ่น three.js ที่ทำงานในเบราว์เซอร์นี้ · API: สัญญาเชื่อมต่อ HTTP ที่ระบบใดก็เรียกใช้ได้วันนี้ · อนาคต: การเชื่อมต่อกับหุ่นจริง ซึ่งยังไม่ได้สร้าง"
  },
  calibrate: {
    eyebrow: "01 · Care Passport",
    title: "สอนหุ่นยนต์เพียงครั้งเดียว",
    lead: "ยืนยันอีเมลหากต้องการเก็บพาสปอร์ตไว้ ให้ความยินยอม แล้วทักทายหุ่นยนต์ ทุกคำตอบเปลี่ยนพฤติกรรมของหุ่นทันที คุณจึงรู้สึกถึงความต่างได้ก่อนกดบันทึก",
    progressLabel: "ความคืบหน้าการปรับเทียบ",
    stepOf: (n: number, total: number) => `ขั้นที่ ${n} จาก ${total}`,
    steps: { greet: "ทักทาย", approach: "ระยะและความเร็ว", care: "การดูแล", gaze: "การสบตา", voice: "เสียง", confirm: "ตรวจทาน", done: "พาสปอร์ต", auto: "กล้องอ่านท่าทาง", review: "ตรวจทาน" },
    previewTitle: "ตัวอย่างพาสปอร์ตของคุณ",
    previewNote: "นี่คือสิ่งที่หุ่นยนต์จะอ่าน ยังไม่มีอะไรถูกบันทึกจนกว่าคุณจะกดบันทึก"
  },
  robots: {
    eyebrow: "02 · ระบบนิเวศหุ่นยนต์",
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
    eyebrow: "03 · เส้นทางโรงพยาบาล",
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
    eyebrow: "04 · หอสังเกตการณ์งานวิจัย",
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
