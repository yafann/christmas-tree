# Magic Christmas Tree

### Interactive 3D Experience with AI Hand Tracking

**Magic Christmas Tree** เป็นโปรเจกต์ Interactive 3D ที่ผสานการทำงานของ Three.js และ MediaPipe AI เพื่อสร้างประสบการณ์วันคริสต์มาสที่สามารถควบคุมผ่านการเคลื่อนไหวของมือแบบเรียลไทม์ พร้อมระบบแสง เอฟเฟกต์ และการตอบสนองต่อเสียงเพลงภายในฉาก

---

## Features

### Champagne Gold Visual Design

ระบบแสงและวัสดุโทนสีทองระดับพรีเมียม โดยใช้ SpotLight จำนวน 5 จุด ร่วมกับ UnrealBloom เพื่อสร้างความแวววาวและมิติของเครื่องประดับบนต้นคริสต์มาส

### AI Hand Tracking Control

**Tree Mode**

* กำมือหรือเลื่อนมือลงเพื่อรวมอนุภาคให้กลายเป็นรูปทรงต้นคริสต์มาส

**Scatter Mode**

* แบมือออกเพื่อกระจายอนุภาครอบฉากแบบอิสระ

**Focus Mode**

* ใช้ท่าจีบนิ้ว (Pinch Gesture) เพื่อสุ่มแสดงรูปภาพที่ผู้ใช้อัปโหลดขึ้นมาประดับบนต้นไม้

### Personal Ornaments

รองรับการอัปโหลดรูปภาพจากเครื่องคอมพิวเตอร์ เพื่อนำมาใช้เป็นของตกแต่งบนต้นคริสต์มาสแบบ 3D ได้ทันที

### Star Audio Visualizer

ยอดดาวด้านบนของต้นไม้จะตอบสนองต่อเสียงเพลง โดยมีการขยายตัวและเปล่งแสงตามจังหวะเบสแบบเรียลไทม์

### Real-time Day/Night Cycle

สภาพแวดล้อมภายในฉากจะเปลี่ยนความสว่าง สีของท้องฟ้า และหมอกตามช่วงเวลาจริงของวัน

---

## Controls

| Key | Function                   |
| --- | -------------------------- |
| H   | Show / Hide User Interface |
| G   | Toggle Webcam Preview      |
| M   | Toggle Background Music    |

---

## Technologies

* Three.js
* MediaPipe Hands
* WebGL
* JavaScript
* GLSL Shaders
* UnrealBloomPass

---

## Getting Started

### Clone Repository

```bash
git clone https://github.com/yafann/christmas-tree.git
```
