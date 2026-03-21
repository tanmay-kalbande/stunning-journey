import React from 'react';
import { X, ArrowLeft } from 'lucide-react';

interface PrivacyPageProps {
    onClose: () => void;
}

const PrivacyPage: React.FC<PrivacyPageProps> = ({ onClose }) => {
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
                    <h1 className="text-4xl md:text-5xl font-bold text-white mb-6">Privacy Policy</h1>
                    <p className="text-white/50 text-lg">Last updated: January 2026</p>
                </div>

                <div className="space-y-10 text-white/70">
                    <section>
                        <h2 className="text-xl font-semibold text-white mb-4">1. Information We Collect</h2>
                        <p className="leading-relaxed mb-4">We collect information you provide directly to us:</p>
                        <ul className="list-disc list-inside space-y-2 ml-4">
                            <li><strong className="text-white">Account Information:</strong> Name, email address, profession, and learning interests when you create an account</li>
                            <li><strong className="text-white">Usage Data:</strong> Topics you search for, books you generate, and your learning progress</li>
                            <li><strong className="text-white">Communications:</strong> Messages you send to us for support or feedback</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-white mb-4">2. How We Use Your Information</h2>
                        <p className="leading-relaxed mb-4">We use the information we collect to:</p>
                        <ul className="list-disc list-inside space-y-2 ml-4">
                            <li>Provide, maintain, and improve the Service</li>
                            <li>Generate personalized learning content</li>
                            <li>Send you updates and notifications (with your consent)</li>
                            <li>Respond to your inquiries and provide support</li>
                            <li>Analyze usage patterns to enhance user experience</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-white mb-4">3. Data Storage & Security</h2>
                        <p className="leading-relaxed mb-4">
                            We take reasonable measures to protect your personal information:
                        </p>
                        <ul className="list-disc list-inside space-y-2 ml-4">
                            <li>Data is encrypted in transit and at rest</li>
                            <li>We use secure authentication methods</li>
                            <li>Access to personal data is restricted to authorized personnel</li>
                            <li>We regularly review our security practices</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-white mb-4">4. Information Sharing</h2>
                        <p className="leading-relaxed mb-4">
                            We do not sell your personal information. We may share your information only:
                        </p>
                        <ul className="list-disc list-inside space-y-2 ml-4">
                            <li>With your consent</li>
                            <li>To comply with legal obligations</li>
                            <li>To protect our rights and prevent fraud</li>
                            <li>With service providers who assist our operations (under strict confidentiality)</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-white mb-4">5. Your Rights</h2>
                        <p className="leading-relaxed mb-4">You have the right to:</p>
                        <ul className="list-disc list-inside space-y-2 ml-4">
                            <li>Access your personal data</li>
                            <li>Correct inaccurate information</li>
                            <li>Request deletion of your account and data</li>
                            <li>Opt out of marketing communications</li>
                            <li>Export your data in a portable format</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-white mb-4">6. Cookies & Tracking</h2>
                        <p className="leading-relaxed">
                            We use essential cookies to maintain your session and preferences.
                            We do not use third-party tracking or advertising cookies.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-white mb-4">7. Children's Privacy</h2>
                        <p className="leading-relaxed">
                            Our Service is not intended for children under 13. We do not knowingly
                            collect personal information from children under 13.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-white mb-4">8. Changes to This Policy</h2>
                        <p className="leading-relaxed">
                            We may update this Privacy Policy from time to time. We will notify you
                            of any changes by posting the new policy on this page and updating the
                            "Last updated" date.
                        </p>
                    </section>

                    <section className="pt-8 border-t border-white/10">
                        <h2 className="text-xl font-semibold text-white mb-4">Contact Us</h2>
                        <p className="leading-relaxed">
                            For privacy-related inquiries, contact us at{' '}
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

export default PrivacyPage;
