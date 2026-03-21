import React from 'react';
import { X, ArrowLeft } from 'lucide-react';

interface AboutPageProps {
    onClose: () => void;
}

const AboutPage: React.FC<AboutPageProps> = ({ onClose }) => {
    return (
        <div className="fixed inset-0 z-[100] bg-black overflow-auto">
            {/* Header */}
            <header className="sticky top-0 z-10 bg-black/90 backdrop-blur-xl border-b border-white/5 px-6 py-4">
                <div className="max-w-4xl mx-auto flex items-center justify-between">
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

            {/* Content */}
            <main className="max-w-4xl mx-auto px-6 py-12">
                <div className="mb-12">
                    <span className="text-[11px] font-mono tracking-[0.3em] uppercase text-cyan-400 mb-4 block">Company</span>
                    <h1 className="text-4xl md:text-5xl font-bold text-white mb-6">About Pustakam</h1>
                    <p className="text-white/50 text-lg leading-relaxed">
                        Your infinite knowledge engine, powered by AI.
                    </p>
                </div>

                <div className="space-y-12 text-white/70">
                    <section>
                        <h2 className="text-2xl font-semibold text-white mb-4">Our Mission</h2>
                        <p className="leading-relaxed mb-4">
                            At PustakamAI, we believe that knowledge should be accessible, personalized, and engaging.
                            Our mission is to democratize learning by using artificial intelligence to create
                            comprehensive, structured educational content on any topic imaginable.
                        </p>
                        <p className="leading-relaxed">
                            Whether you're a student exploring a new subject, a professional upskilling, or simply
                            curious about the world, Pustakam transforms your learning goals into complete,
                            well-organized books in seconds.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-semibold text-white mb-4">How It Works</h2>
                        <div className="space-y-4">
                            <div className="p-6 rounded-2xl bg-white/5 border border-white/10">
                                <h3 className="text-lg font-medium text-white mb-2">1. Describe Your Topic</h3>
                                <p className="text-white/50">Simply tell us what you want to learn. From programming languages to philosophy, from cooking to quantum physics — any topic works.</p>
                            </div>
                            <div className="p-6 rounded-2xl bg-white/5 border border-white/10">
                                <h3 className="text-lg font-medium text-white mb-2">2. AI Generates Your Book</h3>
                                <p className="text-white/50">Our advanced AI analyzes your request and creates a comprehensive, structured book with chapters, modules, and detailed explanations.</p>
                            </div>
                            <div className="p-6 rounded-2xl bg-white/5 border border-white/10">
                                <h3 className="text-lg font-medium text-white mb-2">3. Learn at Your Pace</h3>
                                <p className="text-white/50">Read through your personalized book, track your progress, and master new skills with content tailored specifically for you.</p>
                            </div>
                        </div>
                    </section>

                    <section>
                        <h2 className="text-2xl font-semibold text-white mb-4">Our Vision</h2>
                        <p className="leading-relaxed">
                            We envision a future where everyone has access to personalized education.
                            No more one-size-fits-all textbooks or generic courses. With PustakamAI,
                            every learner gets content that matches their specific needs, interests, and learning style.
                        </p>
                    </section>

                    <section className="pt-8 border-t border-white/10">
                        <h2 className="text-2xl font-semibold text-white mb-4">Contact Us</h2>
                        <p className="leading-relaxed mb-4">
                            Have questions, feedback, or just want to say hello? We'd love to hear from you.
                        </p>
                        <a
                            href="mailto:hello@tanmaysk.in"
                            className="inline-flex items-center gap-2 px-6 py-3 bg-white text-black font-medium rounded-lg hover:bg-white/90 transition-colors"
                        >
                            Get in Touch
                        </a>
                    </section>
                </div>
            </main>
        </div>
    );
};

export default AboutPage;
