# 🛡️ Guardian Bot - LINE Group Protection System & BackOffice

ระบบบอทดูแลและป้องกันกลุ่ม LINE (Anti-Link, Anti-Invite, Anti-Kick) พร้อมหน้าเว็บ BackOffice สำหรับตั้งค่าและสแกน QR Code ล็อกอินครั้งแรก และระบบฐานข้อมูล Supabase

---

## ✨ ฟังก์ชันหลักของระบบ (Features)

1. **🔗 Anti-Link (กันส่งลิงก์):**
   * ตรวจจับข้อความที่มี URL / เว็บไซต์ / ลิงก์เชิญกลุ่ม
   * สมาชิกทั่วไปที่ไม่ได้อยู่ใน Whitelist จะถูกเตะออกจากกลุ่มทันที พร้อมส่งข้อความเตือน

2. **👥 Anti-Invite (กันเชิญมั่ว):**
   * ตรวจจับการเชิญสมาชิกใหม่เข้ากลุ่มโดยไม่ได้รับอนุญาต
   * ยกเลิกคำเชิญ (Cancel Invitation) + สั่งเตะคนเชิญออกจากกลุ่มทันที

3. **⚡ Anti-Kick (กันเตะมั่ว / Kick-back):**
   * ตรวจจับเมื่อมีคนเตะสมาชิกอื่นในกลุ่ม
   * หากคนเตะไม่ใช่แอดมิน บอทจะเตะคนนั้นออกจากกลุ่มทันที (Kick-back)

4. **📱 First-Time QR Code Login บนหน้าเว็บ BackOffice:**
   * กดปุ่มเริ่มเข้าสู่ระบบ -> หน้าเว็บจะแสดงภาพ QR Code และรหัส PIN 4 หลักแบบ Real-time
   * สแกนและกรอกรหัส PIN ในแอป LINE ในมือถือเพื่อยืนยันตัวตน
   * บอทจะบันทึก Auth Token ลง Supabase โดยอัตโนมัติ ทำให้การรันครั้งต่อไปไม่ต้องสแกนอีก

5. **⚙️ จัดการระบบผ่านหน้าเว็บ BackOffice (BO):**
   * ดูสถานะบอท (ออนไลน์/ออฟไลน์), โปรไฟล์, Uptime
   * สลับสวิตช์เปิด/ปิด Anti-Link, Anti-Invite, Anti-Kick แยกรายกลุ่ม
   * เพิ่ม/ลบรายชื่อ Admin Whitelist (สมาชิกที่ไม่ถูกเตะ)
   * ดูประวัติการกระทำผิด (Audit Logs) ย้อนหลัง

6. **💬 คำสั่งควบคุมในแชตกลุ่ม (สำหรับ Whitelist Admin):**
   * `#สถานะ` - ดูสถานะการป้องกันของกลุ่มนั้น
   * `#เปิดกันลิงก์` / `#ปิดกันลิงก์` - เปิด/ปิดระบบกันส่งลิงก์
   * `#เปิดกันเชิญ` / `#ปิดกันเชิญ` - เปิด/ปิดระบบกันเชิญมั่ว
   * `#เปิดกันเตะ` / `#ปิดกันเตะ` - เปิด/ปิดระบบกันเตะมั่ว
   * `#เปิดระบบ` / `#ปิดระบบ` - เปิด/ปิดการทำงานของบอทในกลุ่ม
   * `#คำสั่ง` หรือ `#help` - ดูคำสั่งทั้งหมด

---

## 🚀 ขั้นตอนการติดตั้งและเริ่มต้นใช้งาน

### ขั้นตอนที่ 1: สร้างตารางใน Supabase (ทำครั้งเดียว)
1. เข้าสู่ระบบ [Supabase Dashboard](https://supabase.com/dashboard)
2. ไปที่โปรเจกต์ของคุณ -> เมนู **SQL Editor** ทางซ้ายมือ
3. คัดลอกโค้ดทั้งหมดจากไฟล์ [`supabase_schema.sql`](file:///c:/Users/USER/MyProject/botguardian/supabase_schema.sql) ไปวางแล้วกดปุ่ม **Run**

---

### ขั้นตอนที่ 2: รันระบบบนคอมพิวเตอร์ของคุณ (Local Run)
1. เปิด Terminal หรือ PowerShell ในโฟลเดอร์โปรเจกต์
2. ติดตั้ง Dependencies:
   ```bash
   npm install
   ```
3. สั่งรันเซิร์ฟเวอร์:
   ```bash
   npm start
   ```
4. เปิดเว็บเบราว์เซอร์เข้าที่:
   ```text
   http://localhost:3000
   ```
5. กดปุ่ม **"เริ่มเข้าสู่ระบบด้วย QR Code"** -> เปิด LINE ในมือถือสแกนภาพ QR Code บนหน้าจอ -> ใส่รหัส PIN ที่ปรากฏบนจอ -> บอทจะออนไลน์ทันที!

---

## ☁️ วิธีการนำขึ้น Deploy บน Railway (รัน 24 ชม.)

1. สมัคร/เข้าสู่ระบบ [Railway.app](https://railway.app)
2. นำโปรเจกต์นี้ขึ้น GitHub Repository ของคุณ (ไฟล์ `.env` จะถูก Ignore ตาม `.gitignore` ไว้อยู่แล้ว ปลอดภัย)
3. ที่หน้า Dashboard ของ Railway:
   * กด **New Project** -> เลือก **Deploy from GitHub repo**
   * เลือก Repository `botguardian` ของคุณ
4. ไปที่แท็บ **Variables** ใน Railway แล้วเพิ่มตัวแปรเหล่านี้:
   * `SUPABASE_URL` = `https://urtkmshlrnntwqqnnpxd.supabase.co`
   * `SUPABASE_ANON_KEY` = `(คีย์ Supabase ของคุณ)`
   * `PORT` = `3000`
5. ไปที่แท็บ **Settings** -> ส่วน **Networking** -> กด **Generate Domain** เพื่อรับ URL เว็บ BackOffice (เช่น `https://botguardian-production.up.railway.app`)
6. ระบบจะ Build และ Deploy อัตโนมัติ พร้อมทำงาน 24 ชั่วโมง!
