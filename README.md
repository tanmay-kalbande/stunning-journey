# 📚 Pustakam Injin: GLM Book Forge

<p align="center">
  <img src="https://github.com/tanmay-kalbande/pustakam/raw/main/public/white-logo.png" alt="Pustakam Logo" width="120">
</p>

<p align="center">
  <strong>Your GLM-powered engine for generating digital books.</strong>
  <br />
  Pustakam Injin is a focused, local-first application designed to transform your ideas into fully-structured digital books. It now runs on a curated Zhipu GLM stack with secure proxy routing, analytics, and rate limiting support.
</p>

---

## ✨ Key Features

-   **Intelligent Book Generation**
    -   From a single learning goal, Pustakam's AI generates a comprehensive, multi-module learning roadmap.
    -   Generate entire chapters sequentially or all at once, building a complete book from the structured roadmap.
    -   The final book is automatically assembled with an introduction, a table of contents, a conclusion, and a glossary.

-   **🧠 Curated GLM Stack**
    -   Generation is now limited to four approved Zhipu models: `glm-5`, `glm-5-turbo`, `glm-4.7`, and `glm-4.7-flashx`.
    -   Switch between the Injin Stack presets to balance depth, speed, and long-form teaching quality.

-   **📖 Immersive Reading & Editing**
    -   Once your book is complete, switch to a beautiful, distraction-free reading mode.
    -   Enter fullscreen for a focused experience, perfect for studying.
    -   A built-in editor allows you to refine, modify, and save changes to the AI-generated content, making the final book truly yours.

-   **📊 Smart Analytics & Study Tools**
    -   Go beyond the text with a dedicated analytics dashboard for each completed book.
    -   Gain insights into total word count, estimated reading time, complexity level, and key topics covered.
    -   Download auto-generated study materials, including a markdown-based **Progress Tracker** and a **Study Summary**.

-   **🔒 Secure Proxy + Local Library**
    -   Browser sessions authenticate through Supabase, while the Zhipu API key stays on the server through the Vercel edge proxy.
    -   Export your entire library of books and settings to a single file for backup, or import data to a new device.

-   **📱 Modern PWA Experience**
    -   Install Pustakam as a standalone app on your desktop or mobile device for a native-app feel.
    -   The application is fully responsive and works seamlessly across all screen sizes.
    -   Offline support allows you to read your generated books even without an internet connection.

---

## 🚀 How It Works: From Idea to Book in 4 Steps

1.  **Define Your Goal:** Start a new project by describing what you want to learn or teach. Specify the target audience and desired complexity.
2.  **Review the AI Roadmap:** Pustakam's AI instantly proposes a detailed, multi-chapter roadmap for your book.
3.  **Generate the Content:** With a single click, instruct the AI to write all the chapters based on the approved roadmap. Watch the progress in real-time.
4.  **Read, Analyze & Export:** Enjoy your completed book in the reader, review its analytics, download study aids, and export the final `.md` file.

---

## 🛠️ Tech Stack

-   **Framework:** React with Vite
-   **Language:** TypeScript
-   **Styling:** Tailwind CSS
-   **Core AI Service:** Zhipu GLM proxy on Vercel Edge with Supabase-backed analytics and rate limiting.
-   **Deployment:** PWA-ready for local installation.
