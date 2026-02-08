# ☕ CoffeeChat AI
**Builder-focused outreach automation for UofT Engineering.**

---

## 🚀 Getting Started

1. **Clone & Install**
   ```bash
   git clone https://github.com/yourusername/coffeechat-ai.git
   cd coffeechat-ai
   npm install

2. **Configure Environment**
* Create a `.env` file in the root directory.
* Add your **Gemini API Key** and your profile details (see .env_example).
* **Note:** All variables must start with `VITE_` for the frontend to access them.


3. **Launch**
```bash
npm run dev

```

Note: Just export your lead list as a CSV and upload—the app handles the rest.
Visit `http://localhost:3000` to start drafting. 

---

## 🛠 Tech Stack

* **Frontend:** React + Vite
* **Styling:** Tailwind CSS + Heroicons
* **Intelligence:** Google Gemini 3 Flash
* **PDF Engine:** PDF.js

---

## 🔒 Security (`.gitignore`)

Ensure your `.gitignore` includes the following to prevent leaking your private API keys and profile data:

```text
node_modules/
dist/
.env
.env.local
.env.*.local
.DS_Store

```

---

<div align="center">
<sub>Built for the Summer 2026 Internship Cycle.</sub>
</div>
