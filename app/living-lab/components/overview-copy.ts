// Copy for the Living Lab front door (/living-lab). The stage names and descriptions come from
// labCopy.stages so the overview and the shell always say the same thing.
import type { Lang } from "../copy";

export const overviewCopy = {
  en: {
    hero: {
      eyebrow: "HumanoidTH Living Lab · Human–robot interaction research",
      title: "Can robots understand you?",
      lead: "Every person is different. Let’s teach robots how to interact with you.",
      body: "A research lab in your browser. Create a Care Passport, meet robots that read it, and help find out whether personalization makes care robots more comfortable.",
      cta: "Begin your experiment",
      ctaNote: "About 1 minute to start · camera optional · nothing is saved until you agree",
      explore: "Explore the robots",
      haveOne: "Already have a passport? Start the hospital journey",
      robotLabel: "The HumanoidTH robot greeting you with a Thai wai. Drag to turn it.",
      robotCaption: "A 3D simulation running in your browser. Drag to turn it.",
      greet: "Greet again",
      fallbackCaption: "Illustration. This device cannot show the 3D robot."
    },
    resume: {
      title: "Welcome back",
      body: "This browser holds the edit key for a Care Passport you made. Pick up where you left off.",
      open: "Open my passport"
    },
    experiment: {
      eyebrow: "Your experiment",
      title: "Four stages, one passport",
      lead: "Each stage uses what the one before it made. Start at 01; you can stop after any stage.",
      done: "Done on this device"
    },
    robots: {
      eyebrow: "Meet the robots",
      title: "Same passport, different bodies",
      lead: "Robot A and Robot B read the same Care Passport. Their hardware differs, so each honours it in its own way, and says so when it cannot.",
      hardware: "Hardware",
      caps: { mobile: "Moves around", head: "Head and eyes", arms: "Arms", speaker: "Speaker", screen: "Screen" },
      yes: "yes",
      no: "no",
      maxSpeed: (x: number) => `Top speed ×${x}`,
      simulated: "Simulated",
      enter: "Meet them in the Robot Lab",
      journeyTitle: "On the hospital journey",
      journeyLead: "Real care-robot models from the Atlas registry play the journey’s stations. Their behaviour is simulated here; none is connected.",
      stations: { reception: "Reception", delivery: "Medicine delivery", telepresence: "Doctor call" }
    },
    story: {
      eyebrow: "The research",
      question: "Does personalization make human–robot interaction more comfortable?",
      body: "Care robots are arriving in hospitals and homes, but people differ: how close is too close, how fast is too fast, whether eye contact feels warm or intrusive. This lab asks whether a robot that has read your Care Passport feels more comfortable than the same robot that has not.",
      measured: "What is measured today: comfort, rated 1 to 5 after each meeting. Trust is not measured yet.",
      action: "See what the lab has found"
    },
    final: {
      title: "Help shape the future of care robotics.",
      body: "Your ratings, combined anonymously with everyone else’s, show whether robots that adapt to people feel better to be around. Nothing is saved until you agree.",
      cta: "Begin your experiment"
    }
  },
  th: {
    hero: {
      eyebrow: "HumanoidTH Living Lab · งานวิจัยปฏิสัมพันธ์ระหว่างมนุษย์กับหุ่นยนต์",
      title: "หุ่นยนต์เข้าใจคุณได้ไหม?",
      lead: "ทุกคนไม่เหมือนกัน มาสอนหุ่นยนต์ให้ดูแลคุณในแบบของคุณ",
      body: "ห้องวิจัยในเบราว์เซอร์ของคุณ สร้าง Care Passport พบหุ่นยนต์ที่อ่านมัน และช่วยหาคำตอบว่าการปรับให้เข้ากับแต่ละคนทำให้หุ่นดูแลน่าอยู่ใกล้ขึ้นไหม",
      cta: "เริ่มการทดลองของคุณ",
      ctaNote: "เริ่มได้ในประมาณ 1 นาที · ไม่ต้องใช้กล้องก็ได้ · ไม่มีอะไรถูกบันทึกจนกว่าคุณจะยินยอม",
      explore: "สำรวจหุ่นยนต์",
      haveOne: "มีพาสปอร์ตแล้ว? เริ่มเส้นทางโรงพยาบาล",
      robotLabel: "หุ่นยนต์ HumanoidTH กำลังไหว้ทักทายคุณ ลากเพื่อหมุนได้",
      robotCaption: "หุ่นจำลอง 3 มิติที่ทำงานในเบราว์เซอร์ของคุณ ลากเพื่อหมุนได้",
      greet: "ไหว้อีกครั้ง",
      fallbackCaption: "ภาพประกอบ อุปกรณ์นี้แสดงหุ่น 3 มิติไม่ได้"
    },
    resume: {
      title: "ยินดีต้อนรับกลับ",
      body: "เบราว์เซอร์นี้เก็บคีย์แก้ไขของ Care Passport ที่คุณสร้างไว้ ทำต่อจากที่ค้างไว้ได้เลย",
      open: "เปิดพาสปอร์ตของฉัน"
    },
    experiment: {
      eyebrow: "การทดลองของคุณ",
      title: "สี่ขั้น พาสปอร์ตใบเดียว",
      lead: "แต่ละขั้นใช้สิ่งที่ได้จากขั้นก่อนหน้า เริ่มที่ 01 และหยุดหลังขั้นไหนก็ได้",
      done: "ทำแล้วบนเครื่องนี้"
    },
    robots: {
      eyebrow: "พบหุ่นยนต์",
      title: "พาสปอร์ตเดียวกัน ร่างกายต่างกัน",
      lead: "Robot A และ Robot B อ่าน Care Passport ใบเดียวกัน แต่ฮาร์ดแวร์ต่างกัน จึงเคารพมันในแบบของตัวเอง และบอกตรง ๆ เมื่อทำไม่ได้",
      hardware: "ฮาร์ดแวร์",
      caps: { mobile: "เคลื่อนที่ได้", head: "หัวและดวงตา", arms: "แขน", speaker: "ลำโพง", screen: "จอ" },
      yes: "มี",
      no: "ไม่มี",
      maxSpeed: (x: number) => `ความเร็วสูงสุด ×${x}`,
      simulated: "จำลอง",
      enter: "พบพวกเขาในห้องทดลองหุ่นยนต์",
      journeyTitle: "ในเส้นทางโรงพยาบาล",
      journeyLead: "หุ่นดูแลรุ่นจริงจาก registry ของ Atlas ประจำจุดต่าง ๆ ในเส้นทาง พฤติกรรมจำลองในเบราว์เซอร์ ไม่มีตัวใดเชื่อมต่ออยู่จริง",
      stations: { reception: "จุดต้อนรับ", delivery: "จุดส่งยา", telepresence: "จุดโทรหาแพทย์" }
    },
    story: {
      eyebrow: "งานวิจัย",
      question: "การปรับให้เข้ากับแต่ละคน ทำให้การอยู่กับหุ่นยนต์สบายใจขึ้นไหม?",
      body: "หุ่นดูแลกำลังเข้ามาในโรงพยาบาลและบ้าน แต่แต่ละคนต่างกัน ใกล้แค่ไหนถึงจะใกล้เกินไป เร็วแค่ไหนถึงจะเร็วเกินไป การสบตาให้ความรู้สึกอบอุ่นหรือรุกล้ำ แล็บนี้ถามว่า หุ่นที่อ่าน Care Passport ของคุณแล้ว ทำให้รู้สึกสบายใจกว่าหุ่นตัวเดียวกันที่ยังไม่ได้อ่านหรือไม่",
      measured: "สิ่งที่วัดอยู่ตอนนี้: ความสบายใจ ให้คะแนน 1 ถึง 5 หลังพบหุ่นแต่ละครั้ง ยังไม่ได้วัดความไว้วางใจ",
      action: "ดูสิ่งที่แล็บค้นพบ"
    },
    final: {
      title: "ช่วยกำหนดอนาคตของหุ่นยนต์ดูแล",
      body: "คะแนนของคุณ เมื่อรวมกับของทุกคนแบบไม่ระบุตัวตน จะบอกว่าหุ่นที่ปรับตัวตามคนทำให้รู้สึกดีขึ้นจริงไหม ไม่มีอะไรถูกบันทึกจนกว่าคุณจะยินยอม",
      cta: "เริ่มการทดลองของคุณ"
    }
  }
} satisfies Record<Lang, unknown>;
