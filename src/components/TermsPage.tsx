import React from 'react';
import { X, ArrowLeft } from 'lucide-react';

interface TermsPageProps {
    onClose: () => void;
}

const TermsPage: React.FC<TermsPageProps> = ({ onClose }) => {
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
                    <span className="text-[11px] font-mono tracking-[0.3em] uppercase text-cyan-400 mb-4 block">Legal</span>
                    <h1 className="text-4xl md:text-5xl font-bold text-white mb-6">Terms of Service</h1>
                    <p className="text-white/50 text-lg">Last updated: February 2026</p>
                </div>

                <div className="space-y-10 text-white/70">
                    <section>
                        <h2 className="text-xl font-semibold text-white mb-4">1. Acceptance of Terms</h2>
                        <p className="leading-relaxed">
                            By accessing and using PustakamAI ("the Service"), you accept and agree to be bound by
                            these Terms of Service. If you do not agree to these terms, please do not use our Service.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-white mb-4">2. Description of Service</h2>
                        <p className="leading-relaxed mb-4">
                            PustakamAI is an AI-powered platform that generates personalized educational content
                            and learning materials. The Service allows users to:
                        </p>
                        <ul className="list-disc list-inside space-y-2 ml-4">
                            <li>Generate AI-created books and learning guides</li>
                            <li>Access and read generated content</li>
                            <li>Track learning progress</li>
                            <li>Store and manage personal learning library</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-white mb-4">3. User Accounts</h2>
                        <p className="leading-relaxed mb-4">
                            To use certain features, you must create an account. You are responsible for:
                        </p>
                        <ul className="list-disc list-inside space-y-2 ml-4">
                            <li>Maintaining the confidentiality of your account credentials</li>
                            <li>All activities that occur under your account</li>
                            <li>Providing accurate and complete information</li>
                            <li>Notifying us immediately of any unauthorized use</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-white mb-4">4. Acceptable Use</h2>
                        <p className="leading-relaxed mb-4">You agree not to:</p>
                        <ul className="list-disc list-inside space-y-2 ml-4">
                            <li>Use the Service for any illegal or unauthorized purpose</li>
                            <li>Generate content that is harmful, offensive, or violates others' rights</li>
                            <li>Attempt to gain unauthorized access to our systems</li>
                            <li>Interfere with the proper functioning of the Service</li>
                            <li>Resell or redistribute generated content commercially without permission</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-white mb-4">5. Intellectual Property</h2>
                        <p className="leading-relaxed mb-4">
                            The Service and its original content (excluding user-generated content) are protected
                            by copyright, trademark, and other intellectual property laws.
                        </p>
                        <p className="leading-relaxed">
                            Content generated through our AI is provided for personal, educational use.
                            You retain rights to use generated content for your personal learning purposes.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-white mb-4">6. Limitation of Liability</h2>
                        <p className="leading-relaxed">
                            PustakamAI and its affiliates shall not be liable for any indirect, incidental,
                            special, consequential, or punitive damages resulting from your use of the Service.
                            AI-generated content is provided "as is" and may contain inaccuracies.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-white mb-4">7. Changes to Terms</h2>
                        <p className="leading-relaxed">
                            We reserve the right to modify these terms at any time. Continued use of the Service
                            after changes constitutes acceptance of the new terms.
                        </p>
                    </section>
                    <section>
                        <h2 className="text-xl font-semibold text-white mb-4">8. Security and Shared Devices</h2>
                        <p className="leading-relaxed">
                            To ensure your privacy and data security, we strongly recommend using PustakamAI exclusively on
                            your own personal devices. The Service utilizes local storage to persist certain data
                            and preferences for a seamless experience. Accessing the Service on public or shared computers
                            (such as those in libraries or educational institutions) may allow subsequent users to
                            access your stored information. Always ensure you are on a trusted device and follow
                            proper security practices if using a shared environment.
                        </p>
                    </section>
                    <section className="pt-8 border-t border-white/10">
                        <h2 className="text-xl font-semibold text-white mb-4">Contact</h2>
                        <p className="leading-relaxed">
                            For questions about these Terms, contact us at{' '}
                            <a href="mailto:hello@tanmaysk.in" className="text-cyan-400 hover:text-cyan-300 transition-colors">
                                hello@tanmaysk.in
                            </a>
                        </p>
                    </section>
                </div>
            </main>
        </div>
    );
};

export default TermsPage;
