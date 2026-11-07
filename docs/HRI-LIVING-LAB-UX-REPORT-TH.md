# รายงานสรุป: งานออกแบบ UX ใหม่ Living Lab (HRI Passport)

วันที่: 7 พฤศจิกายน 2026
Branch: `feat/living-lab-ux` (ฐานจาก `main` ที่ `3f0023b`)
Commit ล่าสุด: `3ccf62a` — ทั้งหมด 8 commits ยังอยู่เฉพาะในเครื่อง ยังไม่ push และไม่แตะ `main`
ฐานข้อมูลที่ใช้ทดสอบ: Neon branch `dev` เท่านั้น (`.env.local` = `NEON_BRANCH="dev"`) ไม่มีการแตะ production

---

## 1. บทสรุป

งานรอบนี้ไม่ได้รื้อ HRI Passport ใหม่ แต่ **แยกหน้าจอเดียวที่ยาวมากออกเป็น 6 route ที่มีหน้าที่ชัดเจน**
พร้อมวาง design system กลางของ Living Lab (สี ตัวอักษร ระยะห่าง ปุ่ม และสถานะ) ให้ทุกหน้าใช้ร่วมกัน
พฤติกรรมเดิมทั้งหมด — การสร้าง passport, API, การแก้/ลบ, หุ่น 3 ตัว, เส้นทางโรงพยาบาล,
observatory และ rate limit — ยังทำงานเหมือนเดิมและมีเทสต์คุมไว้

ผลลัพธ์หลัก:

- Unit tests **211/211 ผ่าน**
- Typecheck **ไม่มี error**
- Production build ผ่าน (ทดสอบในสำเนาแยก ไม่กระทบ dev server)
- Playwright: เทสต์ที่รันได้ **50/50 ผ่าน** และ **5 skipped by design**
  (แยกเป็น HRI batch 39 passed / 5 skipped / 1 flake ที่ผ่านเมื่อรันเดี่ยว 8.3 s + map/network/smoke 10/10)
- ตรวจภาพ 6 route × 3 ความกว้าง (1440 / 768 / 390 px) ภาษาไทย **18/18 ไม่มีหน้าล้นแนวนอน, ไม่มี console error, ไม่มี page error, ไม่มีรูปเสีย**

---

## 2. หน้าที่ออกแบบใหม่ และไฟล์ที่เปลี่ยน

### 2.1 โครง route ใหม่

| Route | หน้าที่ | ไฟล์หลัก |
|---|---|---|
| `/living-lab` | หน้าแรกของ lab: คืออะไร เริ่มตรงไหน สี่ส่วนเชื่อมกันอย่างไร อะไรจริง/อะไรจำลอง และทำไมต้องมีงานวิจัย | `app/living-lab/components/Overview.tsx` |
| `/living-lab/create` | สร้าง Care Passport (ย้ายมาจาก `/living-lab` เดิม) — 3 ขั้นตอนเริ่มต้น, แถบ 4 สถานะตลอด flow, หน้าจบที่มี "What next?" | `app/living-lab/create/page.tsx`, `LivingLabClient.tsx` |
| `/living-lab/passport/[token]` | การ์ด passport + "ใช้ passport นี้" ไปเส้นทางโรงพยาบาลหรือ Robot Lab, หน้าสถานะผิดพลาดมีทางไปต่อ | `passport/[token]/PassportCardClient.tsx` |
| `/living-lab/robot` | Robot Lab: passport → หุ่น 3 ตัวพร้อมชิปฮาร์ดแวร์ → พูดคุย → เครื่องมือนักวิจัย (protocol + JSON) | `robot/RobotConsoleClient.tsx` |
| `/living-lab/meet`, `/meet/[code]` | หน้าเข้าสู่เส้นทาง + ตัวเส้นทาง: คำอธิบายก่อนสถานีแรก, resume หลัง reload ด้วย journeyId เดิม, "Station n of N · Round n of 2" | `meet/page.tsx`, `meet/[code]/MeetClient.tsx` |
| `/living-lab/research` | Research Observatory (ย้ายมาจาก `#research`): panels ที่ขึ้นต้นด้วยคำถามวิจัย, แถบ sample จริง, ธง sample น้อย, panel ความเป็นส่วนตัว | `LabSections.tsx` → `ResearchObservatory` |

ลิงก์เก่า `#calibrate`, `#research`, `#robots`, `#journey` และ `?window=` ถูก forward ไป route ใหม่ทั้งหมด

### 2.2 Design system และโครงร่วม

| ไฟล์ | สิ่งที่เปลี่ยน |
|---|---|
| `app/living-lab/lab-theme.css` | token ชุดเดียว (navy / ivory / living green / warm orange), สีข้อความผ่านการตรวจ contrast, type scale, spacing, radius, motion; ชื่อ `--lab-*` เดิมชี้มาที่ token ใหม่ |
| `app/living-lab/components/LabShell.tsx` | brand, สถานะจริงของ lab (WebGL, ไม่มีหุ่นจริง, มี Gemini key หรือไม่) และแท็บนำทางพร้อม active state; "My Passport" โผล่เฉพาะเมื่อเบราว์เซอร์นี้ถือ edit key |
| `app/living-lab/layout.tsx` | mount `LabShell` ให้ทุก route ใต้ `/living-lab` |
| `app/living-lab/components/lab-env.ts` | ตรวจข้อเท็จจริงฝั่งเบราว์เซอร์: WebGL, การมีอยู่ของ edit key |
| `app/living-lab/data.ts` | รวม server reads ของหน้า lab ไว้ที่เดียว |
| `app/living-lab/lab-copy.ts`, `copy.ts`, `passport/copy.ts`, `robot/copy.ts` | ข้อความ TH/EN ของทุกหน้าใหม่ |
| `app/globals.css` | 6 บรรทัด: ปรับ focus halo และสี panel/glow ของ `.lab` ให้ตรง token ใหม่ (ไม่แตะกฎ global อื่น) |

### 2.3 หน้าที่ยกเครื่องรายละเอียด

- **Overview** — hero ที่บอกว่าคืออะไร, ขั้นตอน 4 ส่วน (passport → robot → journey → research), สถานะ lab ที่แยก "จริง / จำลอง / ไม่พร้อม" ด้วยไอคอนและคำ (ไม่ใช้สีอย่างเดียว), ลิงก์ไปต่อ
- **Create** — หน้าเริ่ม 3 ขั้น (จะเกิดอะไร / ยินยอม / เลือกวิธีตอบ), consent บังคับก่อนเริ่ม, แถบ 4 สถานะ, บนมือถือหุ่นถูกปักหมุดเหนือคำถามและมี scroll padding กัน control ถูกบัง (WCAG 2.4.11)
- **Passport card** — hero เป็นการ์ด + ด้านข้างมี Copy/Share และสถานะย่อ, แบ่ง "สิ่งที่หุ่นทุกตัวอ่าน" เป็น *Interaction preferences* และ *Care and communication*, คง test id เดิมทั้งหมด
- **Robot Lab** — เรียงใหม่ passport → หุ่น 3 ตัว → พูดคุย → Researcher tools; ชิปฮาร์ดแวร์ yes/no ทำให้เห็นความต่าง A/B ก่อนอ่านรายละเอียด; `#token=…` โหลด passport แล้วลบ fragment ออกจาก address bar
- **Journey** — คำอธิบายก่อนสถานีแรก, resume จาก `sessionStorage` ด้วย journeyId เดิม (คงลำดับ counterbalanced), แก้ข้อความที่ไม่จริง (condition default ไม่ได้อ่าน passport)
- **Research** — panel นำด้วยคำถามวิจัย, "Sample in this period" แสดงจำนวนจริง, condition ที่ยังไม่มีคะแนนบอกตรง ๆ ไม่วาดแท่งเปล่า, mean จาก <5 ratings และ <5 คู่ถูกธง, panel ความเป็นส่วนตัวอธิบายกฎ n<5 และสิ่งที่อยู่ใน CSV; `lib/hri/observatory.ts` ไม่เปลี่ยน

### 2.4 เทสต์ที่เพิ่ม/ปรับ

- เพิ่ม `tests-node/hri-overview.spec.ts` (5 tests) — ข้อความจริง/จำลอง, ปุ่ม Continue ตาม edit key, ลิงก์เก่า, ไม่ล้นที่ 390, research sample/privacy
- เพิ่ม `tests-node/hri-journey.spec.ts` (2 tests) — intro, resume คงลำดับ condition, บันทึก 1 แถว, `?robot=` ที่ไม่ใช่สถานี
- ปรับ spec เดิมเฉพาะ **path** จาก `/living-lab` → `/living-lab/create` (6 ไฟล์) และเพิ่ม timeout ให้เทสต์ WebGL — ไม่มีการลด assertion หรือแก้เทสต์ให้ผ่าน
- ไม่มีการแก้ `lib/hri/*` ด้านพฤติกรรม, schema, API หรือ observatory logic ในรอบ redesign นี้

---

## 3. ฟังก์ชันเดิมที่ยังทำงานเหมือนเดิม

ยืนยันด้วย unit + Playwright ที่รันจริงในรอบนี้:

- สร้าง passport ด้วยปุ่ม / เสียง / Auto (MediaPipe) — consent gate เดิม, บันทึก preference ชุดเดิม
- `GET /api/hri/passport/[token]` — 200/400/404/410/429, CORS preflight, ไม่ส่ง anxiety/nickname/code/id/token hash
- Rate limit และการแชร์ budget การเดา token ระหว่าง API กับหน้า legacy code
- การ์ด owner: unlock ด้วย edit key, แก้แล้ว version เพิ่ม, ลบแบบ hard delete, เปลี่ยน QR แล้ว token เก่าใช้ไม่ได้
- Robot console: passport หนึ่งใบ → แผนของ Robot A/B/Default ต่างกัน, ไม่มีข้อมูลอ่อนไหวในหน้า/URL
- เส้นทางโรงพยาบาล: 3 สถานี × 2 รอบ, ลำดับ counterbalanced, บันทึกคะแนน 1–5, resume หลัง reload
- Research observatory: ตัวเลข aggregate และกฎ n<5 เหมือนเดิม
- หน้าเดิมนอก Living Lab (smoke crawl, admin security) ยังผ่าน

---

## 4. ผลทดสอบ (ตัวเลขจริง)

| การทดสอบ | คำสั่ง | ผล |
|---|---|---|
| Unit tests | `pnpm test` | **211 passed / 211**, 0 fail, 0 skipped (2.1 s) |
| Typecheck | `node ./node_modules/typescript/bin/tsc --noEmit` | **0 errors** |
| Production build | `pnpm build` (สำเนาแยก) | **ผ่าน** |
| Playwright: HRI batch | `PLAYWRIGHT_EXTERNAL_SERVER=1 npx playwright test tests-node/hri-*.spec.ts --workers=1 --timeout=120000` | **39 passed / 5 skipped / 1 flake** (flake ผ่านเดี่ยว 8.3 s) |
| Playwright: map + network + smoke | `… tests-node/map-no-sample-data.spec.ts tests-node/network.spec.ts tests-node/smoke.spec.ts --workers=1 --timeout=120000` | **10 passed / 10** |
| รวม Playwright | | **50/50 runnable ผ่าน, 5 skipped by design** |
| Visual audit | `node scratch/capture-living-lab.mjs` | **18/18 clean** |

### 4.1 Visual audit (ภาษาไทย, 6 route × 3 ความกว้าง)

ทุกหน้าตรวจ 4 อย่าง: `documentElement.scrollWidth <= clientWidth`, console error, uncaught page error, รูปที่โหลดไม่ขึ้น

| Route | 1440 px | 768 px | 390 px |
|---|---|---|---|
| `/living-lab` | ผ่าน | ผ่าน | ผ่าน |
| `/living-lab/create` | ผ่าน | ผ่าน | ผ่าน |
| `/living-lab/passport/[token]` | ผ่าน | ผ่าน | ผ่าน |
| `/living-lab/robot` | ผ่าน | ผ่าน | ผ่าน |
| `/living-lab/meet/[code]` | ผ่าน | ผ่าน | ผ่าน |
| `/living-lab/research` | ผ่าน | ผ่าน | ผ่าน |

- ภาพเต็มหน้า 18 ภาพ: `screenshots/living-lab/` (ยัง untracked) พร้อม `index.html` และ `manifest.json`
- หน้าล้นแนวนอน: **0**; console error: **0**; page error: **0**; broken image: **0**
- ภาษาไทยแสดงผลทุกหน้า (cookie `lang=th`, locale `th-TH`) และฟอนต์ไทยโหลดครบ
- แถบแท็บบนมือถือเลื่อนแนวนอนได้โดยเจตนา (อยู่ใน container ที่มี overflow ของตัวเอง) ไม่ทำให้หน้าล้น

### 4.2 หมายเหตุความเสถียรของชุดเทสต์

รันแบบ parallel (ค่า default ของ config) รอบหนึ่งทำให้ `next dev` ล้มกลางทาง
ทำให้ 6 เทสต์ล้มด้วย `ERR_CONNECTION_REFUSED` / assertion timeout จากนั้น **รันทีละไฟล์ใหม่ทั้งหมดและผ่านครบ**:
journey 2/2, passport API 8/8, robot console 4/4, map 3/3, smoke 2/2

รอบ 1-worker แบบเต็มได้ 49 passed / 5 skipped / 1 failed โดยตัวที่ล้มคือ `smoke.spec.ts` (admin crawl)
ที่ชนเพดาน 30 วินาทีต่อเทสต์ของ Playwright ระหว่าง dev compile — `/database` เองตอบใน 2.9 วินาที
และเมื่อรันด้วย `--timeout=120000` ผ่าน 2/2 โดยไม่แก้ assertion

รอบแบตช์สุดท้าย: HRI 39 passed / 5 skipped / 1 flake (robot-console handoff — ผ่านเดี่ยว 8.3 s)
และ map+network+smoke 10/10 จึงสรุปได้ว่า **เทสต์ที่รันได้ทั้งหมด 50/50 ผ่าน**

เครื่องนี้มีหน่วยความจำเหลือน้อยมาก (ประมาณ 70 MB ตอนเปิด VS Code + Chromium) ทำให้บางหน้าใช้เวลาหลายนาที
และบางเทสต์ timeout — เป็นข้อจำกัดของ environment ไม่ใช่บั๊กในแอป และไม่ได้แก้โค้ดแอปหรือเทสต์เพื่อกลบปัญหา
สำหรับ gate ที่เชื่อถือได้ให้รัน `--workers=1 --timeout=120000` กับ dev server ที่อุ่นแล้ว
(config ใช้ 1 worker บน CI อยู่แล้ว) และห้ามรัน `next build` ในโฟลเดอร์เดียวกับ `next dev` เพราะใช้ `.next` ร่วมกัน

หมายเหตุ: `hri-identity-card.spec.ts` ออกแบบมาสำหรับเซิร์ฟเวอร์ที่ไม่มี DB/identity secret
เมื่อ source `.env.local` (มี `NEON_BRANCH`) เทสต์นี้จะ skip โดยเจตนา — ไม่ใช่ความล้มเหลว

---

## 5. ข้อจำกัดที่ยังเหลือ

1. **ยังไม่ push / deploy** — งานทั้งหมดอยู่บนเครื่องนี้ และ `main` ไม่ถูกแตะ
2. **Production ยังไม่มีคอลัมน์ของ Phase 2** — ก่อน push ต้อง migrate production ตามขั้นตอนใน `docs/hri-passport-api.md` (snapshot → review diff → `prisma db execute`) และต้องได้รับการอนุมัติชัดเจนจากทีม
3. **Auto mode ยังไม่ผ่านการทดสอบกับคนจริง** — ความแม่นของ wai / lean-back / gaze จาก pose landmarks ยัง UNKNOWN ต้องทำ go/no-go test ตาม `HRI_FEASIBILITY_SPIKE.md` §3.4 ก่อนเดโม
4. **Playwright แบบ parallel ยังเปราะกับ dev server** — ใช้ `--workers=1` เป็น gate; หากต้องการ parallel ควรชี้ไปที่ `next start` ที่ build แล้ว ไม่ใช่ `next dev`
5. **หน้า Living Lab เป็น client-heavy** — Overview/Research อ่านข้อมูลจาก server ผ่าน `data.ts` แต่ยังมี WebGL และ MediaPipe ที่กินทรัพยากรบนเครื่องสเปกต่ำ
6. **Screenshot เป็นหลักฐานชั่วคราว** — โฟลเดอร์ `screenshots/` และ `scratch/capture-living-lab.mjs` ยังไม่ commit (เป็นเครื่องมือตรวจ ไม่ใช่โค้ดแอป)
7. ปัญหาที่มีอยู่ก่อนแล้วและไม่ใช่ของงานนี้ (ไม่แก้): hydration error #418 ที่ `/database`, `notify` error ที่ `/network` บนมือถือ, horizontal scroll ของ `/`, `/contributions`, `/analytics` บางความกว้าง, `/map` ต้องมี `GEMINI_API_KEY`

---

## 6. ขั้นต่อไปที่เสนอ

1. ให้ทีมรีวิว branch `feat/living-lab-ux` และภาพ 18 ภาพใน `screenshots/living-lab/index.html`
2. ตัดสินใจเรื่อง production migration (ต้องอนุมัติ) แล้วจึง push/merge — ห้าม push ก่อน migrate
3. ทำ go/no-go test ของ Auto mode กับคนจริง 5 คน แล้วบันทึกผลตามจริง
4. ถ้าต้องการให้ CI รัน Playwright แบบขนาน ให้เปลี่ยนไปทดสอบกับ production build (`next start`) แทน `next dev`
5. พิจารณา commit เครื่องมือ `scratch/capture-living-lab.mjs` เป็นสคริปต์ตรวจ visual regression ในอนาคต (หรือเก็บไว้เป็น scratch ตามเดิม)

---

## 7. สิ่งที่ไม่ได้ทำตามกติกา

- ไม่ push
- ไม่ deploy
- ไม่แตะฐานข้อมูล production (ใช้เฉพาะ Neon `dev`)
- ไม่แก้เทสต์เพื่อให้ผ่าน — การแก้เทสต์ในรอบนี้มีเฉพาะการเปลี่ยน path ตาม route ใหม่และการเพิ่ม timeout ให้เทสต์ WebGL
