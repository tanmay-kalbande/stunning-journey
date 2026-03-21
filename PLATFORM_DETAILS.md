# Pustakam AI (AI Injin) - Platform Specifications

Pustakam AI is a high-performance, multi-model AI book generation engine designed to transform raw ideas into structured, professional, or "street-smart" digital knowledge. It is built as a local-first, privacy-conscious PWA that offers a premium, high-tech experience reminiscent of modern "God-mode" AI tools.

---

## 🎨 Design Philosophy & UX
The platform uses a **Grok-inspired minimal aesthetic** with a focus on immersive, dark environments.

### 1. Immersive Environment (Nebula Background)
- **Physics-Driven Background**: A realistic, real-time "Black Hole" simulation using orbital physics. It features celestial objects (planets, comets, asteroids) that get "spaghettified" as they fall into the singularity.
- **Dynamic Opacity**: Background intensity settles into a subtle ambient glow to maintain readability while keeping the cosmic feel.

### 2. UI Elements
- **Color System**: Optimized for OLED displays with #000000 blacks, accented by slate-gray borders and cyan/amber highlights.
- **Animations**:
  - **Pixel AI Waves**: Micro-animations that jitter and flow during generation, signifying active AI thought.
  - **3x3 Grid Loaders**: Modern, minimalist status indicators.
  - **Gradient Progress Bars**: Soft-flowing progress indicators for long-running generations.
- **Reading Modes**: Three distinct themes for consumption:
  - **Dark**: The signature Pustakam experience.
  - **Sepia**: Optimized for long-form reading, warm and easy on the eyes.
  - **Light**: High-contrast professional mode.
- **Typography**: Premium font pairings including **Outfit** (modern-bold), **Crimson Pro** (classic book style), and **Nunito** (soft-rounded).

---

## 🚀 The Generation Engine
The core of Pustakam is its "Infinite Knowledge Engine," which is designed to be resilient and highly customizable.

### 1. Intelligent AI Enhancer
Users don't need to write perfect prompts. The **Enhancer** analyzes any vague input (e.g., "coding") and automatically brainstorms:
- A specific, actionable **Learning Goal**.
- A compelling **Book Title**.
- A targeted **Audience Profile**.
- Optimized **Complexity Levels** (Beginner, Intermediate, Advanced).
- Structural preferences (Examples, Exercises, or Quizzes).

### 2. Quick-Start Templates
The platform includes 5 pre-engineered "Knowledge Blueprints" to jumpstart creation:
- **Programming Fundamentals**: 12 Modules, includes code snippets & debugging.
- **Business Strategy**: 10 Modules, focuses on market analysis & financial planning.
- **Data Science Mastery**: 15 Modules, covers stats to ML workflows.
- **Creative Writing Workshop**: 8 Modules, character development & plot structure.
- **Language Learning**: 12 Modules, grammar, vocabulary & cultural context.

These templates map directly to the platform's supported categories: **Programming**, **Science**, **Art**, **Business**, and **General**.

### 2. Dual Personalities (Generation Modes)
- **Stellar Mode**: The "Professor." It generates structured, professional, and academic content with a focus on clarity and depth.
- **Blackhole Mode (Street Mode)**: The "Hustler." A raw, aggressive, and direct persona. It uses "bro-talk" and street-smart slang (including Hindi terms like 'chutiye', 'hustle', 'grind') to roast the user and push them toward action. It’s designed for high-octane motivation and "no-bullshit" learning.

### 3. Generation Depth
- **Standard Mode**: Fast, efficient roadmap and content creation.
- **Deep Research Mode**: High-depth generation that explores the "why" behind concepts, using more tokens and complex reasoning.

---

## 🛠 Technical Architecture
Pustakam is a "Multi-Model" platform, meaning it doesn't rely on just one AI. It is designed to be the ultimate aggregator of AI intelligence.

### 1. The Multi-Model Hive
Supported AI Providers & Models:
- **Google**: Gemini 3 Flash Preview, Gemini 2.5 Flash, Gemma 3 27B.
- **xAI**: Grok 4.1 (Standard & Fast), Grok 4 Fast.
- **Mistral**: Small, Medium, and Large latest models.
- **Groq**: Llama 3.3 (70B), Cerebras GPT-OSS (120B), Moonshot (Kimi).
- **OpenRouter**: Access to arcee-ai, deepseek-r1, and dolphin-mistral.
- **Cohere**: Command R+ optimized for RAG and tool-use.

### 2. Resilience & Error Handling
- **Streaming Content**: Chapters are generated in real-time, allowing users to read as the AI writes.
- **Client-Side Throttling**: The engine enforces local rate limits to prevent API bans:
  - **Groq**: 30 req/min (High Velocity)
  - **Cerebras**: 20 req/min (Wafer-Scale)
  - **Google**: 15 req/min
  - **Mistral**: 10 req/min
- **Auto-Recovery**: If an AI model hits a "Rate Limit" (429) or "Network Error," the system automatically attempts a jittered retry.
- **User Intervention**: If a model fails multiple times, the user can choose to **Retry**, **Skip**, or **Switch AI Model** mid-session without losing progress.
- **Checkpointing**: Every chapter generated is instantly saved to `localStorage`. You can close the tab mid-generation and resume weeks later exactly where you left off.
- **Zero-Middleman Security**: Pustakam functions as a standalone entity. Your API keys are stored only in local encrypted memory and tunneled directly to providers (Google, Groq, etc.) via peer-to-peer browser-to-API communication. No user keys ever touch the Pustakam backend.

### 3. Progressive Web App (PWA)
- **AI Injin**: The platform installs with the short-name "AI Injin" on mobile home screens for a sleek icon label.
- **Service Worker**: Features advanced cache versioning to ensure users always have the latest UI and logo updates.
- **Smart Install Prompt**: The app manages the `beforeinstallprompt` event to prevent spammy mini-infobars, respecting user dismissal for 24 hours.
- **Offline Capable**: The app shell and book assets remain accessible even without a connection.

---

## 💳 Membership & Subscriptions
Pustakam AI follows a flexible "Local-First / Premium Sync" model.
- **Standard (Local)**: Unlimited book creation and generation within the browser's local memory.
- **PRO Plans**:
  - **Monthly (₹149)**: Ideal for short-term power users.
  - **Yearly (₹1299)**: Best value for long-term knowledge building.
- **Unlimited Generation**: Unlike token-metered competitors, Pustakam allows unlimited knowledge synthesis for its active members.

---

## 📊 Analytics & Export
Every book project tracks its own "life stats":
- **Time spent** vs. **Words generated**.
- **Average generation speed** (Words Per Minute).
- **Module Completion Radar**: Visual breakdown of progress.
- **Token Economics**: Progressive context-stacking architecture. For a 30,000-word volume, the engine manages ~200,000 cumulative input tokens to ensure logical continuity across modules.
- **Complexity Analysis**: The engine scans content patterns to auto-tag books as **Beginner**, **Intermediate**, or **Advanced**.
- **Study Materials**: One-click generation of **Practice Questions** and **Executive Summaries** for any book.
- **Reading Progress**: Remembers your exact scroll position and module index for every book you've started.
- **PDF Export**: A specialized engine that converts Markdown books into high-fidelity PDFs with custom cover pages, signatures, and structured layouts.

---

## 🏗 PDF Engineering (High-Fidelity Export)
Pustakam doesn't just "print" a web page; it uses a custom-built PDF generation engine based on `pdfmake` for professional-grade formatting.

### 1. Advanced Typography
- **Custom Font Injection**: The engine dynamically loads high-fidelity fonts like **Aptos-Mono** (for code blocks) and **Rubik** (for brand-aligned titles).
- **Unicode Resilience**: It performs "Dash Normalization," converting complex Unicode characters (like em-dashes and smart quotes) into standard ASCII to prevent PDF corruption.
- **Emoji Support**: Native support for emojis in PDF content, slightly upscaled (11pt) for better visual impact.

### 2. Manual Layout Engine
- **Markdown-to-PDF Parser**: A bespoke parser that translates Markdown syntax into `pdfmake` objects, handling nested lists, blockquotes with custom color bars, and multi-page code blocks.
- **Intelligent Page Breaks**: Code blocks longer than 40 lines are automatically chunked and carried over to the next page with "(continued...)" markers.
- **Disclaimer & Transparency**: Every PDF includes a generated disclaimer page clarifying that the content is AI-created and should be fact-checked—maintaining high ethical standards.

---

## 🧠 Prompt Engineering (The Persona Matrix)
The "soul" of the platform lives in its specialized prompt services, which are strictly isolated from the core logic to allow for "personality updates."

### 1. Blackhole Mode (Street Oracle)
- **Vibe**: A battle-hardened hustler who treats learning like a war briefing.
- **Dialect**: US Street/Hustle slang ("bro-love," "corners 'em," " mission specs," "vibes check").
- **Constraint**: Mandates 2500–4500 words per chapter. No "warm-ups"—it starts chapters "straight to the throat."

### 2. Desi Mode (The Tapori Bhai)
- **Vibe**: A Mumbai/Pune "Bhai" who uses humor and "roasting" to teach.
- **Languages**: 
  - **Hinglish**: Hindi + English mix.
  - **Marthienglish**: Marathi + English mix (using "Bhava," "Rao," "Vishay hard aahe").
- **Slang Discipline**: 10-20% emphasis-only swearing. Strictly forbids crude insults; maintains a "tough-love" but uplifting and motivational tone.

---

## ☁️ Local-First & Supabase Sync
Pustakam is designed to work even if the backend is down, prioritizing user ownership of data.

- **Local-Only Prowess**: If the cloud (Supabase) isn't configured, the app defaults to "Local Mode" with unlimited books saved in `localStorage`.
- **Hybrid Sync**: For logged-in users, the app performs a silent background sync. It uses Supabase RPCs (Remote Procedure Calls) to increment book counts and update global stats like `total_words_generated` across devices.
- **Privacy First**: All active creation happens in-browser first, with the cloud serving as a backup and stats-tracking layer.

---

## 📈 Performance & Analytics
- **Live WPM Tracking**: Calculates "Words Per Minute" during generation to give users a sense of the AI's raw velocity.
- **Checkpoint Resilience**: The engine saves "Checkpoints" every few seconds. If a device dies mid-generation, it resumes precisely from the last successful paragraph.

---

## 🤝 User Engagement & Social Integration
The platform is designed to build a community and trust around AI-driven learning.

- **Direct Creator Access**: A "Message the Creator" feature integrated into the footer, allowing users to send feedback directly to the developer's inbox (`hello@tanmaysk.in`).
- **Demo Library**: Pre-generated sample books (e.g., "Burn the Boat" in Street Mode) are available on the landing page to demonstrate the system's output quality before a user even signs up.
- **Limited PRO Offer**: A dismissible promo system that offers a "1 Year Free Membership" to early adopters, incentivized via a pulse-animated notification.

---

## 🛡 Trust & Compliance
Despite its raw "Blackhole" persona, the platform maintains professional standards for security and legality.

- **Security Visuals**: Real-time indicators of "Secure Neural Channels" and TLS 1.3 encryption to reassure users about their data privacy.
- **Legal Infrastructure**: Dedicated, built-in pages for **Terms of Service**, **Privacy Policy**, **Compliance**, and a comprehensive **Disclaimer** to handle AI-related legal nuances.
- **API Transparency**: A dedicated **API Documentation** page that explains the "Intelligence Protocol," Zero-Middleman security, and outbound traffic transparency.

---

## 📖 The "Absolute" Reading Experience
The reading interface is a distraction-free vault designed for deep work.

### 1. Granular Customization
- **Modern Typography**: Switch between **Outfit** (Bold/Modern), **Nunito** (Soft/Rounded), **Crimson Pro** (Classic Book), and **Aptos Mono** (Technical/Code).
- **Adaptive Layouts**: Adjustable text alignment (Left/Justify), line-height, and content max-widths (Narrow/Medium/Wide).
- **Thematic Consistency**: Full support for Dark, Sepia, and Light modes across the entire reading flow.

### 2. Intelligent Interaction
- **Contextual UI**: The generation interface dynamically changes icons based on the book's topic (e.g., Brain for AI books, Heart for fitness, Code for programming).
- **Persistent Bookmarks**: High-fidelity reading progress that syncs across the "Local Library" and Supabase Cloud.
- **Data Sovereignty**: Complete "Data & Backup" suite allows users to export their entire library as an archive or "Purge All System Data" for an instant privacy reset.

---

## 🧠 Intelligence Selection Strategy
The platform recommends specific "Neural Cores" for different knowledge types:
- **Fiction & Narrative**: Prioritizes **GLM-4.7** or **Mistral Large** for deep world-building.
- **Technical & Logic**: Deploys **Gemma 3 27B** or **GPT-120B** for rigorous structural accuracy.
- **Multilingual Excellence**: Utilizes **Qwen-3-235B** for peak Marathi and Hindi regional reasoning.
- **Structured Pedagogy**: Selects **Gemini 2.0** or **Llama 3.3** for educational frameworks.

---

## 📩 Support & Contact
The platform is maintained with a personal touch:
- **Primary Support**: [hello@tanmaysk.in](mailto:hello@tanmaysk.in)
- **Feedback**: Integrated WhatsApp flow for direct communication.
- **Social Presence**: Linked directly to the creator's **X (Twitter)**, **GitHub**, and **LinkedIn** for real-time updates and professional networking.

---
**Pustakam AI: Built for those who don’t just want to read, but to master.**
