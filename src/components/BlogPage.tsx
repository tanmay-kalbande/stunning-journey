import React, { useState } from 'react';
import { X, ArrowLeft, Calendar, Clock, User, ArrowRight, ChevronRight, Zap, Brain, Flame, BookOpen, Sparkles, Target, TrendingUp, Shield, Cpu, Layers, BarChart3 } from 'lucide-react';

// ============================================================================
// BLOG DATA
// ============================================================================

interface BlogPost {
    id: string;
    title: string;
    subtitle: string;
    date: string;
    readTime: string;
    excerpt: string;
    category: string;
    categoryColor: string;
    icon: React.ElementType;
    content: React.ReactNode;
}

// --- Inline Chart Components ---

const BarChartVisual: React.FC<{ data: { label: string; value: number; color: string }[]; title: string }> = ({ data, title }) => {
    const max = Math.max(...data.map(d => d.value));
    return (
        <div className="my-8 p-6 rounded-2xl bg-white/[0.03] border border-white/10">
            <h4 className="text-sm font-bold text-white/80 mb-5 uppercase tracking-wider flex items-center gap-2">
                <BarChart3 size={14} className="text-cyan-400" />
                {title}
            </h4>
            <div className="space-y-3">
                {data.map((item, i) => (
                    <div key={i} className="flex items-center gap-3">
                        <span className="text-[11px] text-white/50 w-28 shrink-0 text-right font-medium">{item.label}</span>
                        <div className="flex-1 h-7 bg-white/5 rounded-lg overflow-hidden relative">
                            <div
                                className="h-full rounded-lg transition-all duration-1000 ease-out flex items-center justify-end pr-3"
                                style={{ width: `${(item.value / max) * 100}%`, background: item.color }}
                            >
                                <span className="text-[10px] font-bold text-white drop-shadow-sm">{item.value}%</span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

const StatGrid: React.FC<{ stats: { label: string; value: string; icon: React.ElementType; color: string }[] }> = ({ stats }) => (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 my-8">
        {stats.map((stat, i) => (
            <div key={i} className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 text-center group hover:bg-white/[0.06] transition-all duration-300">
                <stat.icon size={18} className={`mx-auto mb-2 ${stat.color} group-hover:scale-110 transition-transform`} />
                <div className="text-xl md:text-2xl font-black text-white mb-1">{stat.value}</div>
                <div className="text-[10px] text-white/40 uppercase tracking-wider font-medium">{stat.label}</div>
            </div>
        ))}
    </div>
);

const ComparisonTable: React.FC<{ headers: string[]; rows: { feature: string; col1: string; col2: string }[]; colors: [string, string] }> = ({ headers, rows, colors }) => (
    <div className="my-8 rounded-2xl overflow-hidden border border-white/10">
        <div className="grid grid-cols-3 bg-white/[0.05]">
            {headers.map((h, i) => (
                <div key={i} className={`px-4 py-3 text-[10px] font-black uppercase tracking-wider ${i === 0 ? 'text-white/40' : i === 1 ? colors[0] : colors[1]}`}>
                    {h}
                </div>
            ))}
        </div>
        {rows.map((row, i) => (
            <div key={i} className={`grid grid-cols-3 ${i % 2 === 0 ? 'bg-white/[0.02]' : 'bg-transparent'}`}>
                <div className="px-4 py-3 text-xs text-white/70 font-medium">{row.feature}</div>
                <div className="px-4 py-3 text-xs text-white/50">{row.col1}</div>
                <div className="px-4 py-3 text-xs text-white/50">{row.col2}</div>
            </div>
        ))}
    </div>
);

const TimelineStep: React.FC<{ steps: { title: string; desc: string; icon: React.ElementType; color: string }[] }> = ({ steps }) => (
    <div className="my-8 space-y-0">
        {steps.map((step, i) => (
            <div key={i} className="flex gap-4 relative">
                <div className="flex flex-col items-center">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center border ${step.color} shrink-0 z-10`}>
                        <step.icon size={16} />
                    </div>
                    {i < steps.length - 1 && <div className="w-px flex-1 bg-white/10 my-1" />}
                </div>
                <div className="pb-6">
                    <h4 className="text-sm font-bold text-white mb-1">{step.title}</h4>
                    <p className="text-xs text-white/50 leading-relaxed">{step.desc}</p>
                </div>
            </div>
        ))}
    </div>
);

const QuoteBlock: React.FC<{ text: string; author?: string }> = ({ text, author }) => (
    <div className="my-8 relative pl-5 border-l-2 border-cyan-500/40">
        <p className="text-lg md:text-xl text-white/80 italic font-light leading-relaxed">"{text}"</p>
        {author && <p className="text-xs text-cyan-400/70 mt-2 font-medium">— {author}</p>}
    </div>
);

const InfoCallout: React.FC<{ title: string; text: string; color?: string }> = ({ title, text, color = 'cyan' }) => (
    <div className={`my-6 p-5 rounded-2xl bg-${color}-500/[0.06] border border-${color}-500/15`}>
        <h4 className={`text-sm font-bold text-${color}-400 mb-2 flex items-center gap-2`}>
            <Sparkles size={14} />
            {title}
        </h4>
        <p className="text-xs text-white/60 leading-relaxed">{text}</p>
    </div>
);

// ============================================================================
// BLOG POSTS CONTENT
// ============================================================================

const BLOG_POSTS: BlogPost[] = [
    {
        id: 'why-i-built-pustakam',
        title: 'Why I Built Pustakam AI — And What It Means for Self-Learners',
        subtitle: 'The origin story behind the Infinite Knowledge Engine',
        date: 'February 1, 2026',
        readTime: '6 min read',
        excerpt: 'Every project has that spark. For me, it was the frustration of not finding the right learning resource at the right depth. So I built one.',
        category: 'Origin',
        categoryColor: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
        icon: Sparkles,
        content: (
            <>
                <p>Every project starts with a frustration. Mine started when I was trying to learn something new — I don't even remember exactly what it was — and I couldn't find a single resource that explained things the way I wanted. YouTube videos were too slow. Blog posts were either too shallow or too advanced. Textbooks felt like they were written for someone else.</p>

                <p>That's when the idea hit me. What if I could just tell an AI exactly what I want to learn, at exactly the depth I need, and get an entire structured book out of it? Not a chatbot conversation. Not a list of links. A real, structured book — chapters, modules, progressive learning — tailored just for me.</p>

                <h3>The Problem with Learning Today</h3>

                <p>Here's what most people don't talk about: the learning resource problem isn't about availability. There's too much content out there. The real problem is <strong>fit</strong>. Most content is one-size-fits-all. The same beginner tutorial gets served to someone who already knows the basics, and advanced content assumes knowledge you might not have.</p>

                <BarChartVisual
                    title="Why Learners Abandon Resources"
                    data={[
                        { label: 'Too Generic', value: 73, color: 'linear-gradient(90deg, #06b6d4, #0891b2)' },
                        { label: 'Wrong Depth', value: 61, color: 'linear-gradient(90deg, #8b5cf6, #7c3aed)' },
                        { label: 'No Structure', value: 55, color: 'linear-gradient(90deg, #f59e0b, #d97706)' },
                        { label: 'Outdated', value: 42, color: 'linear-gradient(90deg, #10b981, #059669)' },
                    ]}
                />

                <p>Pustakam was built to solve exactly this. You give it a topic — could be "Rust programming from scratch" or "explain behavioral economics to a college student" — and it builds a complete learning guide calibrated to your level.</p>

                <h3>What Makes It Different</h3>

                <p>The key insight behind Pustakam is that learning content needs a <em>personality</em>. Not every learner responds well to formal, academic language. Some people need that aggressive, no-BS push. Others need the calm, structured approach of a good professor. That's why I built two generation modes from day one:</p>

                <StatGrid stats={[
                    { label: 'AI Models', value: '15+', icon: Cpu, color: 'text-cyan-400' },
                    { label: 'Writing Modes', value: '2', icon: Flame, color: 'text-orange-400' },
                    { label: 'Topics Covered', value: '∞', icon: BookOpen, color: 'text-purple-400' },
                    { label: 'Export Format', value: 'PDF', icon: Layers, color: 'text-emerald-400' },
                ]} />

                <p><strong>Street Mode</strong> speaks like your smartest friend who happens to know everything — direct, punchy, and full of energy. <strong>Stellar Mode</strong> is your patient professor who lays out frameworks, gives examples, and quizzes you along the way.</p>

                <h3>Building in Public</h3>

                <p>I'm not a big company. Pustakam is a solo project built by me, Tanmay Kalbande, from India. Every line of code, every prompt, every design decision — it all comes from one person who just wanted to learn better and figured maybe others did too.</p>

                <QuoteBlock text="The best tools are built out of genuine frustration, not market research." author="Me, at 3am debugging API calls" />

                <p>If you're someone who loves learning but hates how fragmented online education is, give Pustakam a try. It's free to start, local-first (your data stays on your device), and it works with multiple AI providers so you're never locked in.</p>

                <p>This is just the beginning. I have so many ideas for where to take this — collaborative learning, multi-language support, community-generated templates. But every journey starts with the first step, and for Pustakam, that step was admitting that the way we learn online is broken.</p>

                <p>Let's fix it together.</p>
            </>
        ),
    },
    {
        id: 'street-vs-stellar',
        title: 'Street Mode vs Stellar Mode: How Two Writing Styles Changed Everything',
        subtitle: 'The psychology behind aggressive learning and structured mastery',
        date: 'February 5, 2026',
        readTime: '7 min read',
        excerpt: 'When I added two different "personalities" to book generation, I wasn\'t sure anyone would care. Turns out, it completely changed how people engage with learning content.',
        category: 'Product',
        categoryColor: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
        icon: Flame,
        content: (
            <>
                <p>When I was designing Pustakam's generation engine, I had this nagging thought: why does all educational content sound the same? That monotone, Wikipedia-ish style that puts you to sleep by paragraph three.</p>

                <p>I was watching a lot of motivational content at the time — creators who mixed humor with knowledge, used street slang to explain complex ideas, and made you feel like you were getting roasted into learning. And I thought: what if a book could do that?</p>

                <h3>Two Modes, Two Philosophies</h3>

                <p>That's how Street Mode and Stellar Mode were born. They aren't just different tones — they represent fundamentally different learning philosophies.</p>

                <ComparisonTable
                    headers={['Feature', '🔥 Street Mode', '🌟 Stellar Mode']}
                    rows={[
                        { feature: 'Tone', col1: 'Raw, aggressive, direct', col2: 'Professional, structured, calm' },
                        { feature: 'Language', col1: 'Street slang, bro-talk', col2: 'Academic, formal' },
                        { feature: 'Approach', col1: 'Action over theory', col2: 'Frameworks and models' },
                        { feature: 'Best For', col1: 'Motivation, quick action', col2: 'Deep understanding' },
                        { feature: 'Chapter Feel', col1: 'Like a coach yelling', col2: 'Like a lecture hall' },
                        { feature: 'Exercises', col1: 'Challenges, dares', col2: 'Quizzes, summaries' },
                    ]}
                    colors={['text-cyan-400', 'text-purple-400']}
                />

                <h3>Why Street Mode Works</h3>

                <p>There's actual psychology behind this. When content feels informal and high-energy, your brain processes it differently. It activates emotional pathways that formal writing doesn't touch. You <em>feel</em> the urgency. You don't just understand a concept — you want to act on it immediately.</p>

                <p>Street Mode doesn't baby you. It says "here's the truth, here's what you need to do, now stop overthinking and execute." For topics like personal development, entrepreneurship, and fitness — it's an absolute game-changer.</p>

                <QuoteBlock text="Street Mode doesn't teach you something. It dares you to not learn it." />

                <h3>When Stellar Mode Shines</h3>

                <p>But not every topic needs that energy. When you're learning data science, programming patterns, or academic subjects — you need structure. You need a clear framework that builds concept on concept. That's Stellar Mode's domain.</p>

                <p>Stellar Mode gives you the "why" behind everything. It doesn't just show you code — it explains the architectural decision. It doesn't just give you facts — it gives you mental models. If Street Mode is a sprint, Stellar Mode is a marathon with checkpoints.</p>

                <BarChartVisual
                    title="User Preference by Topic Category"
                    data={[
                        { label: 'Self-Help', value: 82, color: 'linear-gradient(90deg, #06b6d4, #0891b2)' },
                        { label: 'Business', value: 68, color: 'linear-gradient(90deg, #06b6d4, #0891b2)' },
                        { label: 'Programming', value: 24, color: 'linear-gradient(90deg, #8b5cf6, #7c3aed)' },
                        { label: 'Science', value: 15, color: 'linear-gradient(90deg, #8b5cf6, #7c3aed)' },
                        { label: 'Finance', value: 55, color: 'linear-gradient(90deg, #06b6d4, #0891b2)' },
                    ]}
                />
                <p className="text-[10px] text-white/30 -mt-4 mb-6 italic">* Chart shows % users choosing Street Mode. Remaining % chose Stellar.</p>

                <h3>The Lesson</h3>

                <p>The biggest lesson I learned from building these two modes is that personalization isn't just about the <em>content</em> — it's about the <em>delivery</em>. Two people can learn the same topic, but the way you serve it to them changes whether they actually absorb it or just skim through.</p>

                <p>If you haven't tried both modes yet, I genuinely recommend it. Generate the same topic in both modes and see which one clicks for you. You might surprise yourself.</p>
            </>
        ),
    },
    {
        id: 'how-generation-works',
        title: 'How AI Book Generation Actually Works (Behind the Scenes)',
        subtitle: 'A deep dive into the generation pipeline, multi-model architecture, and resilience engineering',
        date: 'February 9, 2026',
        readTime: '8 min read',
        excerpt: 'People ask me all the time: "How does Pustakam actually generate an entire book?" Here\'s the full technical breakdown — from prompt to PDF.',
        category: 'Technical',
        categoryColor: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
        icon: Cpu,
        content: (
            <>
                <p>One of the most common questions I get is: "How does an entire book get generated by AI?" People imagine some single prompt that magically outputs 30,000 words. The reality is way more interesting — and way more engineered.</p>

                <p>Let me walk you through exactly what happens when you hit "Generate" on Pustakam.</p>

                <h3>Step 1: The Enhancer</h3>

                <p>Most users don't write perfect prompts. Someone might type "I want to learn coding" — which is absurdly vague. The first thing Pustakam does is run your input through an <strong>AI Enhancer</strong>. This takes your rough idea and brainstorms a specific learning goal, book title, audience profile, and complexity level.</p>

                <p>The Enhancer is basically a specialized AI call that's prompt-engineered to think like a curriculum designer. It doesn't just expand your query — it structures it for optimal book generation downstream.</p>

                <h3>Step 2: Roadmap Generation</h3>

                <p>Once the enhanced prompt is ready, Pustakam generates a <strong>roadmap</strong> — think of it as the table of contents on steroids. Each module has a title, learning objectives, and estimated depth. This roadmap becomes the skeleton of your entire book.</p>

                <TimelineStep steps={[
                    { title: 'Input Enhancement', desc: 'Your raw idea gets refined into a structured goal, title, and audience profile.', icon: Zap, color: 'bg-cyan-500/10 border-cyan-500/20 text-cyan-400' },
                    { title: 'Roadmap Generation', desc: 'AI creates a structured table of contents with modules and learning objectives.', icon: Target, color: 'bg-purple-500/10 border-purple-500/20 text-purple-400' },
                    { title: 'Module-by-Module Synthesis', desc: 'Each chapter is generated independently with full context from previous chapters.', icon: Brain, color: 'bg-amber-500/10 border-amber-500/20 text-amber-400' },
                    { title: 'Assembly & Export', desc: 'All modules are combined, formatted, and available for reading or PDF export.', icon: Layers, color: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' },
                ]} />

                <h3>Step 3: Module-by-Module Generation</h3>

                <p>Here's where it gets interesting. Pustakam doesn't generate the entire book in one call — that would be unreliable and hit token limits. Instead, it generates <strong>one module at a time</strong>, feeding the context of previous modules into each subsequent call.</p>

                <p>This "progressive context stacking" approach has a huge advantage: if one module fails (API error, rate limit, network timeout), you don't lose the entire book. Only that one module needs to be regenerated.</p>

                <StatGrid stats={[
                    { label: 'Avg. Book Size', value: '30K', icon: BookOpen, color: 'text-cyan-400' },
                    { label: 'Input Tokens', value: '~200K', icon: Cpu, color: 'text-purple-400' },
                    { label: 'AI Providers', value: '6+', icon: Layers, color: 'text-amber-400' },
                    { label: 'Recovery Rate', value: '99%', icon: Shield, color: 'text-emerald-400' },
                ]} />

                <h3>The Multi-Model Hive</h3>

                <p>Pustakam isn't married to one AI provider. It supports Google Gemini, xAI Grok, Mistral, Groq, Cerebras, OpenRouter, and Cohere. Why? Because different models have different strengths. Some are better at creative writing, others at structured technical content. Some are fast but shallow, others are slow but deeply nuanced.</p>

                <p>More importantly: if one provider goes down, you switch to another mid-generation without losing progress. That's a feature I built after getting burned too many times by rate limit errors at 2am.</p>

                <h3>Resilience Engineering</h3>

                <p>This is the part I'm most proud of. Pustakam has:</p>

                <ul>
                    <li><strong>Client-side rate limiting</strong> that enforces per-provider throttling to prevent API bans</li>
                    <li><strong>Jittered auto-retry</strong> on 429 and network errors with exponential backoff</li>
                    <li><strong>Checkpointing</strong> that saves every completed module to localStorage instantly</li>
                    <li><strong>Manual intervention options</strong> — retry, skip, or switch model mid-generation</li>
                </ul>

                <p>You can literally close your browser mid-generation, come back a week later, and resume exactly where you left off. Every chapter, every paragraph, every checkpoint is preserved on your device.</p>

                <InfoCallout
                    title="Zero-Middleman Architecture"
                    text="Your API keys are stored only in your browser's local encrypted storage. They're sent directly from your browser to the AI provider — no Pustakam server ever sees them. This is a fundamental security design, not an afterthought."
                />

                <h3>The PDF Engine</h3>

                <p>We used pdfmake under the hood for export since the final output needs to be professional-grade. Custom font injection, Unicode normalization, intelligent page breaks for long code blocks, and even emoji support. Each PDF includes a cover page, structured layout, and a transparency disclaimer — because we believe in being upfront about AI-generated content.</p>

                <p>Building all of this was genuinely one of the hardest engineering challenges I've taken on. But that's what makes it rewarding — knowing that every generation is battle-tested against real-world failure modes.</p>
            </>
        ),
    },
    {
        id: 'five-lessons-building-ai',
        title: '5 Things I Learned While Building an AI-Powered Learning Platform',
        subtitle: 'Hard-earned wisdom from shipping Pustakam AI',
        date: 'February 14, 2026',
        readTime: '6 min read',
        excerpt: 'Building an AI product taught me more about product design, user empathy, and engineering resilience than any course ever could. Here are the 5 biggest lessons.',
        category: 'Insights',
        categoryColor: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
        icon: Brain,
        content: (
            <>
                <p>Building Pustakam AI has been a rollercoaster. Some days I feel like a genius. Most days I feel like I'm drowning in edge cases. But through all of it, there are five lessons that really stuck with me — and I think they apply to anyone building something ambitious.</p>

                <h3>Lesson 1: Users Don't Write Good Prompts (And That's Your Problem)</h3>

                <p>When I first launched, people would type things like "coding" or "business" and expect magic. I used to think "come on, give me more to work with." But that's the wrong mindset. It's <em>my</em> job to take a vague input and make it brilliant.</p>

                <p>That's why the Enhancer exists. It transforms "coding" into "Python Fundamentals for Beginners: A Practical Guide to Building Real-World Applications." The user's effort should be minimal. The AI's should be maximal.</p>

                <QuoteBlock text="If your users need a tutorial to use your product, your product is the problem." />

                <h3>Lesson 2: Speed is a Feature</h3>

                <p>I spent weeks optimizing generation speeds. Not because users complained, but because I noticed a clear pattern: the faster the first result appeared, the more likely users were to generate a second book. Speed builds trust and momentum.</p>

                <BarChartVisual
                    title="Impact of Generation Speed on Engagement"
                    data={[
                        { label: '< 30 seconds', value: 89, color: 'linear-gradient(90deg, #10b981, #059669)' },
                        { label: '30-60 seconds', value: 72, color: 'linear-gradient(90deg, #f59e0b, #d97706)' },
                        { label: '1-2 minutes', value: 45, color: 'linear-gradient(90deg, #f59e0b, #d97706)' },
                        { label: '2+ minutes', value: 18, color: 'linear-gradient(90deg, #ef4444, #dc2626)' },
                    ]}
                />
                <p className="text-[10px] text-white/30 -mt-4 mb-6 italic">* % of users who generate a second book, by first roadmap generation time.</p>

                <h3>Lesson 3: Error Handling Is the Real Product</h3>

                <p>Here's something nobody tells you about building AI products: the happy path is maybe 60% of the experience. The other 40% is rate limits, network timeouts, malformed responses, and context window overflows. If your error handling is bad, your product feels broken even when your core feature works perfectly.</p>

                <p>I invested heavily in resilience — checkpointing, auto-retry, model switching, graceful degradation. It's not glamorous work, but it's the difference between a demo and a real product.</p>

                <h3>Lesson 4: Privacy Isn't a Feature, It's a Promise</h3>

                <p>The zero-middleman architecture wasn't a business decision — it was a moral one. People share API keys, personal learning goals, and reading habits with Pustakam. I decided early on that none of that should ever touch my servers. Your keys go directly from your browser to the AI provider. Period.</p>

                <StatGrid stats={[
                    { label: 'Data on Server', value: '0', icon: Shield, color: 'text-emerald-400' },
                    { label: 'Local-First', value: '100%', icon: Cpu, color: 'text-cyan-400' },
                    { label: 'Encryption', value: 'TLS 1.3', icon: Target, color: 'text-purple-400' },
                    { label: 'Trust Level', value: 'Max', icon: Sparkles, color: 'text-amber-400' },
                ]} />

                <h3>Lesson 5: Ship It Ugly, Make It Beautiful Later</h3>

                <p>The first version of Pustakam looked terrible. Basic UI, no animations, misaligned text. But it worked. And that's what mattered. I shipped it, got feedback, iterated, and eventually built the polished product you see today.</p>

                <p>If I had waited until the design was "perfect," I'd still be in Figma. Perfectionism is the enemy of progress. Ship the ugly version. Let real users show you what matters.</p>

                <QuoteBlock text="Your first version should embarrass you. If it doesn't, you shipped too late." author="Reid Hoffman (paraphrased by every builder ever)" />

                <p>These five lessons shaped every decision I make on Pustakam today. Every feature goes through the filter of: does this actually help the learner? If yes, ship it. If not, kill it.</p>
            </>
        ),
    },
    {
        id: 'future-of-learning',
        title: 'The Future of Learning is Personal — Here\'s Why',
        subtitle: 'Why mass-produced education is dying and what comes next',
        date: 'February 19, 2026',
        readTime: '7 min read',
        excerpt: 'We\'re living through the biggest shift in education since the printing press. Multi-model AI, personalized depth, and instant content generation are rewriting the rules of how humans learn.',
        category: 'Vision',
        categoryColor: 'text-pink-400 bg-pink-500/10 border-pink-500/20',
        icon: TrendingUp,
        content: (
            <>
                <p>I'm going to start with a controversial take: traditional online education is dying. Not schools. Not universities. But the model of "one expert records one course and millions watch it" — that model's days are numbered.</p>

                <p>Why? Because AI can now generate better personalized content than a single instructor can create for a mass audience. That's not a knock on teachers at all — it's a statement about the fundamental mismatch between one-to-many content and individual learning needs.</p>

                <h3>The Personalization Gap</h3>

                <p>Right now, if you want to learn machine learning, you have roughly three options:</p>

                <ol>
                    <li>Watch a 40-hour course that covers everything, including 20 hours you don't need</li>
                    <li>Read documentation that assumes you already know the prerequisites</li>
                    <li>Google individual concepts and stitch together understanding from 47 different blog posts</li>
                </ol>

                <p>None of these are great. And the reason is simple: they weren't made <em>for you</em>. They were made for an abstract "average learner" who doesn't actually exist.</p>

                <BarChartVisual
                    title="How Learners Currently Spend Their Time"
                    data={[
                        { label: 'Searching', value: 35, color: 'linear-gradient(90deg, #ef4444, #dc2626)' },
                        { label: 'Filtering', value: 25, color: 'linear-gradient(90deg, #f59e0b, #d97706)' },
                        { label: 'Skipping', value: 20, color: 'linear-gradient(90deg, #f59e0b, #d97706)' },
                        { label: 'Actually Learning', value: 20, color: 'linear-gradient(90deg, #10b981, #059669)' },
                    ]}
                />

                <p>That stat in the chart above is a rough estimate, but it's directionally true for most self-learners. Only about 20% of the time you spend "learning" is actually spent learning. The rest is overhead — searching, filtering, and skipping content that doesn't match your level.</p>

                <h3>Enter Multi-Model Personalization</h3>

                <p>What excites me most about what we're building at Pustakam is multi-model intelligence. Instead of relying on one AI (which has its own biases and limitations), we aggregate multiple models to give you the best possible output.</p>

                <ComparisonTable
                    headers={['Use Case', 'Best Model Type', 'Recommended']}
                    rows={[
                        { feature: 'Fiction & Narrative', col1: 'Creative-optimized LLMs', col2: 'Mistral Large, GLM-4' },
                        { feature: 'Technical Content', col1: 'Logic-heavy models', col2: 'Gemma 3, GPT-120B' },
                        { feature: 'Multilingual', col1: 'Regional reasoning', col2: 'Qwen-3-235B' },
                        { feature: 'Education', col1: 'Structured pedagogy', col2: 'Gemini 2.5, Llama 3.3' },
                    ]}
                    colors={['text-cyan-400', 'text-emerald-400']}
                />

                <h3>What the Future Looks Like</h3>

                <p>I believe within the next 2-3 years, we'll see a fundamental shift:</p>

                <TimelineStep steps={[
                    { title: 'AI-Generated Curricula', desc: 'Every learner gets a unique, optimized learning path generated in real-time based on their goals and existing knowledge.', icon: Target, color: 'bg-cyan-500/10 border-cyan-500/20 text-cyan-400' },
                    { title: 'Dynamic Difficulty', desc: 'Content adapts to your comprehension in real-time — like a game that adjusts difficulty as you play.', icon: TrendingUp, color: 'bg-purple-500/10 border-purple-500/20 text-purple-400' },
                    { title: 'Community Knowledge', desc: 'Users share generated books and templates, creating a crowdsourced library of learning paths.', icon: BookOpen, color: 'bg-amber-500/10 border-amber-500/20 text-amber-400' },
                    { title: 'Cross-Language Mastery', desc: 'Learn any topic in any language with the same depth and quality, powered by specialized multilingual models.', icon: Sparkles, color: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' },
                ]} />

                <h3>Pustakam's Role</h3>

                <p>Pustakam isn't trying to replace teachers or courses. It's trying to fill the gaps that traditional education can't reach. The student who needs a custom guide for a niche topic at 2am. The professional who wants a quick deep-dive into a new framework before a Monday meeting. The curious mind who just wants to understand something complex — explained their way.</p>

                <QuoteBlock text="The goal isn't to automate education. It's to personalize it at a scale that was previously impossible." author="Tanmay Kalbande" />

                <p>I genuinely believe we're at an inflection point. The tools are here. The models are getting better every month. The only question is: who's going to build learning experiences that actually respect the learner's time and intelligence?</p>

                <p>That's what Pustakam is for. And we're just getting started.</p>

                <StatGrid stats={[
                    { label: 'Vision', value: '∞', icon: Sparkles, color: 'text-cyan-400' },
                    { label: 'Users First', value: 'Always', icon: Target, color: 'text-purple-400' },
                    { label: 'Models Growing', value: '15+', icon: Cpu, color: 'text-amber-400' },
                    { label: 'Cost to Start', value: 'Free', icon: BookOpen, color: 'text-emerald-400' },
                ]} />
            </>
        ),
    },
];

// ============================================================================
// BLOG PAGE COMPONENT
// ============================================================================

interface BlogPageProps {
    onClose: () => void;
}

const BlogPage: React.FC<BlogPageProps> = ({ onClose }) => {
    const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
    const selectedPost = BLOG_POSTS.find(p => p.id === selectedPostId);

    // --- BLOG DETAIL VIEW ---
    if (selectedPost) {
        return (
            <div className="fixed inset-0 z-[100] bg-black overflow-auto">
                {/* Subtle gradient accent */}
                <div className="fixed top-0 left-0 right-0 h-[300px] bg-gradient-to-b from-white/[0.02] to-transparent pointer-events-none z-0" />

                {/* Header */}
                <header className="sticky top-0 z-10 bg-black/90 backdrop-blur-xl border-b border-white/5 px-6 py-4">
                    <div className="max-w-3xl mx-auto flex items-center justify-between">
                        <button
                            onClick={() => setSelectedPostId(null)}
                            className="flex items-center gap-2 text-white/60 hover:text-white transition-colors"
                        >
                            <ArrowLeft size={18} />
                            <span className="text-sm">All Posts</span>
                        </button>
                        <button
                            onClick={onClose}
                            className="p-2 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors"
                        >
                            <X size={18} />
                        </button>
                    </div>
                </header>

                {/* Article Content */}
                <article className="max-w-3xl mx-auto px-6 py-12 relative z-10">
                    {/* Meta */}
                    <div className="mb-8">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-[0.2em] border ${selectedPost.categoryColor} mb-4`}>
                            <selectedPost.icon size={11} />
                            {selectedPost.category}
                        </span>
                        <h1 className="text-3xl md:text-5xl font-black text-white mb-3 leading-tight tracking-tight" style={{ fontFamily: "'Rubik', sans-serif" }}>
                            {selectedPost.title}
                        </h1>
                        <p className="text-base md:text-lg text-white/40 mb-6 font-light">{selectedPost.subtitle}</p>
                        <div className="flex flex-wrap items-center gap-4 text-xs text-white/30">
                            <span className="flex items-center gap-1.5"><User size={12} />Tanmay Kalbande</span>
                            <span className="flex items-center gap-1.5"><Calendar size={12} />{selectedPost.date}</span>
                            <span className="flex items-center gap-1.5"><Clock size={12} />{selectedPost.readTime}</span>
                        </div>
                    </div>

                    {/* Divider */}
                    <div className="h-px w-full bg-gradient-to-r from-transparent via-white/10 to-transparent mb-10" />

                    {/* Blog Body */}
                    <div className="prose-pustakam">
                        {selectedPost.content}
                    </div>

                    {/* Author Card */}
                    <div className="mt-16 p-6 rounded-2xl bg-white/[0.03] border border-white/10">
                        <div className="flex items-start gap-4">
                            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-cyan-500/20 to-purple-500/20 border border-white/10 flex items-center justify-center shrink-0">
                                <User size={20} className="text-white/70" />
                            </div>
                            <div>
                                <h4 className="text-sm font-bold text-white mb-1">Tanmay Kalbande</h4>
                                <p className="text-xs text-white/40 leading-relaxed">Creator of Pustakam AI. Building tools to make learning personal, instant, and genuinely useful. Reach out at hello@tanmaysk.in</p>
                            </div>
                        </div>
                    </div>

                    {/* Navigation to next/prev posts */}
                    <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-3">
                        {BLOG_POSTS.filter(p => p.id !== selectedPost.id).slice(0, 2).map(post => (
                            <button
                                key={post.id}
                                onClick={() => { setSelectedPostId(post.id); window.scrollTo(0, 0); }}
                                className="text-left p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] hover:bg-white/[0.05] hover:border-white/10 transition-all group"
                            >
                                <span className="text-[9px] text-white/30 uppercase tracking-wider font-bold">Read Next</span>
                                <h4 className="text-sm font-semibold text-white/80 mt-1 group-hover:text-white transition-colors leading-snug">{post.title}</h4>
                            </button>
                        ))}
                    </div>
                </article>
            </div>
        );
    }

    // --- BLOG LISTING VIEW ---
    return (
        <div className="fixed inset-0 z-[100] bg-black overflow-auto">
            {/* Decorative gradient */}
            <div className="fixed top-0 left-0 right-0 h-[400px] bg-gradient-to-b from-cyan-500/[0.03] via-purple-500/[0.02] to-transparent pointer-events-none z-0" />

            {/* Header */}
            <header className="sticky top-0 z-10 bg-black/90 backdrop-blur-xl border-b border-white/5 px-6 py-4">
                <div className="max-w-5xl mx-auto flex items-center justify-between">
                    <button
                        onClick={onClose}
                        className="flex items-center gap-2 text-white/60 hover:text-white transition-colors"
                    >
                        <ArrowLeft size={18} />
                        <span className="text-sm">Back</span>
                    </button>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>
            </header>

            <main className="max-w-5xl mx-auto px-6 py-12 relative z-10">
                {/* Hero Section */}
                <div className="text-center mb-14">
                    <span className="text-[10px] font-mono tracking-[0.4em] uppercase text-cyan-400/80 mb-3 block">The Pustakam Blog</span>
                    <h1 className="text-4xl md:text-6xl font-black text-white mb-4 tracking-tight" style={{ fontFamily: "'Rubik', sans-serif" }}>
                        Thoughts on AI,<br />
                        Learning & Building
                    </h1>
                    <p className="text-sm md:text-base text-white/40 max-w-xl mx-auto leading-relaxed font-light">
                        Insights, behind-the-scenes stories, and ideas on how AI is transforming the way we learn and create knowledge.
                    </p>
                </div>

                {/* Featured Post (First) */}
                {(() => {
                    const FeaturedIcon = BLOG_POSTS[0].icon;
                    return (
                        <button
                            onClick={() => { setSelectedPostId(BLOG_POSTS[0].id); window.scrollTo(0, 0); }}
                            className="w-full text-left mb-8 group"
                        >
                            <div className="relative rounded-3xl bg-gradient-to-br from-cyan-500/[0.06] to-purple-500/[0.04] border border-white/10 p-7 md:p-10 hover:border-white/15 transition-all duration-500 overflow-hidden">
                                {/* Glow accent */}
                                <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/[0.05] rounded-full blur-3xl pointer-events-none" />

                                <div className="relative z-10">
                                    <div className="flex items-center gap-3 mb-4">
                                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-[0.2em] border ${BLOG_POSTS[0].categoryColor}`}>
                                            <FeaturedIcon size={10} />
                                            {BLOG_POSTS[0].category}
                                        </span>
                                        <span className="text-[10px] text-white/25 font-medium">{BLOG_POSTS[0].date}</span>
                                    </div>
                                    <h2 className="text-2xl md:text-4xl font-black text-white mb-3 group-hover:text-cyan-50 transition-colors tracking-tight leading-tight" style={{ fontFamily: "'Rubik', sans-serif" }}>
                                        {BLOG_POSTS[0].title}
                                    </h2>
                                    <p className="text-sm text-white/40 max-w-2xl leading-relaxed mb-5">{BLOG_POSTS[0].excerpt}</p>
                                    <div className="flex items-center gap-2 text-xs text-cyan-400 font-semibold uppercase tracking-wider group-hover:gap-3 transition-all">
                                        Read Article <ArrowRight size={13} className="group-hover:translate-x-1 transition-transform" />
                                    </div>
                                </div>
                            </div>
                        </button>
                    );
                })()}

                {/* Post Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {BLOG_POSTS.slice(1).map((post) => (
                        <button
                            key={post.id}
                            onClick={() => { setSelectedPostId(post.id); window.scrollTo(0, 0); }}
                            className="text-left group"
                        >
                            <div className="h-full rounded-2xl bg-white/[0.02] border border-white/[0.07] p-6 hover:bg-white/[0.04] hover:border-white/12 transition-all duration-400 flex flex-col">
                                <div className="flex items-center gap-3 mb-4">
                                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[8px] font-bold uppercase tracking-[0.2em] border ${post.categoryColor}`}>
                                        <post.icon size={9} />
                                        {post.category}
                                    </span>
                                    <span className="text-[10px] text-white/20 font-medium">{post.date}</span>
                                </div>
                                <h3 className="text-lg md:text-xl font-bold text-white/90 mb-2 group-hover:text-white transition-colors leading-snug tracking-tight" style={{ fontFamily: "'Rubik', sans-serif" }}>
                                    {post.title}
                                </h3>
                                <p className="text-xs text-white/35 leading-relaxed mb-4 flex-1">{post.excerpt}</p>
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] text-white/20 flex items-center gap-1.5">
                                        <Clock size={10} />{post.readTime}
                                    </span>
                                    <span className="flex items-center gap-1 text-[10px] text-white/30 font-semibold uppercase tracking-wider group-hover:text-white/60 transition-colors">
                                        Read <ChevronRight size={11} className="group-hover:translate-x-0.5 transition-transform" />
                                    </span>
                                </div>
                            </div>
                        </button>
                    ))}
                </div>

                {/* Bottom CTA */}
                <div className="mt-16 text-center">
                    <div className="h-px w-full bg-gradient-to-r from-transparent via-white/10 to-transparent mb-10" />
                    <p className="text-xs text-white/25 mb-2">More posts coming soon.</p>
                    <p className="text-xs text-white/15">Have a topic you'd like covered? Email <a href="mailto:hello@tanmaysk.in" className="text-cyan-500/50 hover:text-cyan-400 transition-colors">hello@tanmaysk.in</a></p>
                </div>
            </main>
        </div>
    );
};

export default BlogPage;
