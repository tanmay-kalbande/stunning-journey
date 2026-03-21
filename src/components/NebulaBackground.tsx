// src/components/NebulaBackground.tsx
// Advanced Black Hole effect with realistic orbital physics and diverse celestial objects
import React, { useRef, useEffect, useState } from 'react';

interface NebulaBackgroundProps {
    opacity?: number;
    className?: string;
}

interface Star {
    x: number;
    y: number;
    size: number;
    brightness: number;
    twinkleSpeed: number;
    twinklePhase: number;
}

type OrbiterType = 'comet' | 'planet' | 'asteroid';

interface Orbiter {
    type: OrbiterType;
    angle: number;
    radius: number;
    baseSpeed: number;
    pullSpeed: number;
    size: number;
    alpha: number;
    color: string;
    trail: { x: number, y: number }[]; // For smooth tails
    inclination: number; // For 3D orbital plane effect
    direction: 1 | -1; // Clockwise or counter-clockwise
}

export const NebulaBackground: React.FC<NebulaBackgroundProps> = ({ opacity = 1, className = '' }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

    useEffect(() => {
        const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
        setPrefersReducedMotion(mediaQuery.matches);
        const handleChange = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
        mediaQuery.addEventListener('change', handleChange);
        return () => mediaQuery.removeEventListener('change', handleChange);
    }, []);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let animationFrameId: number;
        let time = 0;
        let lastFrameTime = 0;
        const targetFPS = prefersReducedMotion ? 30 : 60;
        const frameInterval = 1000 / targetFPS;

        let orbiters: Orbiter[] = [];
        let stars: Star[] = [];
        let centerX = 0;
        let centerY = 0;

        const initStars = (width: number, height: number) => {
            const starCount = Math.min(150, Math.floor((width * height) / 15000));
            stars = [];
            for (let i = 0; i < starCount; i++) {
                stars.push({
                    x: Math.random() * width,
                    y: Math.random() * height,
                    size: Math.random() * 1.5 + 0.2,
                    brightness: Math.random() * 0.5 + 0.1,
                    twinkleSpeed: Math.random() * 0.02 + 0.005,
                    twinklePhase: Math.random() * Math.PI * 2
                });
            }
        };

        const createOrbiter = (type?: OrbiterType): Orbiter => {
            // Remove dust - favor asteroids (70%), comets (20%), planets (10%)
            const random = Math.random();
            const orbType = type || (random > 0.9 ? 'planet' : (random > 0.7 ? 'comet' : 'asteroid'));

            let size = 1.2 + Math.random() * 1.5; // Larger default (asteroid)
            let color = 'rgba(180, 180, 180,'; // Default asteroid gray
            let radius = 80 + Math.random() * 520;
            let baseSpeed = 0.0004 + Math.random() * 0.001;

            if (orbType === 'planet') {
                size = 3 + Math.random() * 4;
                color = Math.random() > 0.5 ? 'rgba(100, 150, 255,' : 'rgba(255, 120, 100,';
                radius = 250 + Math.random() * 400;
            } else if (orbType === 'comet') {
                size = 1 + Math.random();
                color = 'rgba(180, 220, 255,';
                radius = 150 + Math.random() * 450;
                baseSpeed *= 1.5;
            } else if (orbType === 'asteroid') {
                size = 1 + Math.random() * 2;
                color = 'rgba(180, 180, 180,';
                radius = 200 + Math.random() * 300;
            }

            return {
                type: orbType,
                angle: Math.random() * Math.PI * 2,
                radius: radius,
                baseSpeed: baseSpeed,
                pullSpeed: 0.03 + Math.random() * 0.08,
                size: size,
                alpha: 0.4 + Math.random() * 0.4,
                color: color,
                trail: [],
                inclination: 0.3 + Math.random() * 0.2, // Flatter disk (0.3 to 0.5)
                direction: 1 // Unified flow
            };
        };

        let lastWidth = window.innerWidth;
        const init = () => {
            const currentWidth = window.innerWidth;

            // Check for mobile device
            const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

            // On mobile, height changes (address bar) shouldn't trigger full re-init 
            // completely ignore if width hasn't changed to prevent jump/flicker
            if (isMobile && currentWidth === lastWidth && orbiters.length > 0) {
                return;
            }

            // For mobile, we use screen height to prevent gaps when address bar hides
            // For desktop, we use innerHeight
            const targetHeight = isMobile ? window.screen.height : window.innerHeight;

            lastWidth = currentWidth;
            const dpr = window.devicePixelRatio || 1;
            canvas.width = currentWidth * dpr;
            canvas.height = targetHeight * dpr;
            canvas.style.width = `${currentWidth}px`;
            canvas.style.height = `${targetHeight}px`;
            ctx.scale(dpr, dpr);

            centerX = currentWidth * 0.5;
            centerY = targetHeight * 0.5;

            initStars(currentWidth, targetHeight);

            orbiters = [];
            const orbCount = prefersReducedMotion ? 40 : 120;
            for (let i = 0; i < orbCount; i++) {
                orbiters.push(createOrbiter());
            }
        };

        const drawStars = (currentTime: number) => {
            stars.forEach(star => {
                const twinkle = Math.sin(currentTime * star.twinkleSpeed + star.twinklePhase);
                const currentBrightness = star.brightness * (0.6 + twinkle * 0.4);
                ctx.beginPath();
                ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(255, 255, 255, ${currentBrightness})`;
                ctx.fill();
            });
        };

        const drawLiquidGas = (currentTime: number) => {
            // Draw multiple layered slow-rotating gas clouds
            for (let i = 0; i < 3; i++) {
                const shift = currentTime * (0.1 + i * 0.05);
                const gasRadius = 250 + i * 100;
                const gx = centerX + Math.cos(shift) * 20;
                const gy = centerY + Math.sin(shift) * 10;

                const gas = ctx.createRadialGradient(gx, gy, 50, gx, gy, gasRadius);
                gas.addColorStop(0, 'rgba(0, 0, 0, 0)');
                gas.addColorStop(0.4, `rgba(40, 20, 10, ${0.01 + i * 0.005})`); // Very subtle dark orange/brown smoke
                gas.addColorStop(0.7, 'rgba(0, 0, 0, 0.02)');
                gas.addColorStop(1, 'rgba(0, 0, 0, 0)');

                ctx.fillStyle = gas;
                ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);
            }
        };

        const animate = (currentFrameTime: number) => {
            const deltaTime = currentFrameTime - lastFrameTime;
            if (deltaTime < frameInterval) {
                animationFrameId = requestAnimationFrame(animate);
                return;
            }
            lastFrameTime = currentFrameTime - (deltaTime % frameInterval);
            time += 0.016;

            // Clear with lighter fade to allow light accumulation
            ctx.fillStyle = 'rgba(0, 0, 0, 0.12)';
            ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);

            drawStars(time);

            // Draw smooth background glow (from user snippet)
            const glowGradient = ctx.createRadialGradient(
                centerX, centerY, 0,
                centerX, centerY, 400
            );
            glowGradient.addColorStop(0, 'rgba(100, 150, 200, 0.08)');
            glowGradient.addColorStop(0.1, 'rgba(80, 120, 180, 0.05)');
            glowGradient.addColorStop(0.2, 'rgba(60, 100, 160, 0.03)');
            glowGradient.addColorStop(0.4, 'rgba(40, 80, 140, 0.015)');
            glowGradient.addColorStop(0.6, 'rgba(20, 60, 120, 0.008)');
            glowGradient.addColorStop(0.8, 'rgba(10, 40, 100, 0.003)');
            glowGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
            ctx.fillStyle = glowGradient;
            ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);

            // Keep subtle gas for extra texture
            drawLiquidGas(time);


            // Physics-driven orbital animation
            orbiters.forEach((p, index) => {
                // PHYSICS: From classic version (sucking effect)
                p.angle += p.baseSpeed * (300 / Math.max(p.radius, 20)) * p.direction;
                p.radius -= p.pullSpeed * (200 / Math.max(p.radius, 20));

                const x = centerX + Math.cos(p.angle) * p.radius;
                const y = centerY + Math.sin(p.angle) * p.radius * p.inclination; // Use varied inclination

                // Update trails - lengthen as they fall in
                if (p.type === 'comet') {
                    p.trail.unshift({ x, y });
                    const dynamicTrailLength = 30;
                    if (p.trail.length > dynamicTrailLength) p.trail.pop();
                }

                // Render based on type - Expansion & Spaghettification
                // Expands as it gets sucked in, then rapidly collapses to 0
                const expansion = Math.max(1, 120 / Math.max(p.radius, 10));
                const collapse = Math.min(1, Math.max(0, (p.radius - 22) / 30)); // Collapse starts at r=52, ends at r=22

                const finalAlpha = Math.min(1, p.alpha * expansion * (0.5 + collapse * 0.5));
                const finalSize = p.size * expansion * collapse;

                if (finalSize > 0.1 && finalAlpha > 0.01) {
                    if (p.type === 'comet') {
                        ctx.beginPath();
                        ctx.moveTo(x, y);
                        p.trail.forEach((pos, i) => {
                            const tailAlpha = finalAlpha * (1 - i / p.trail.length) * 0.5;
                            ctx.strokeStyle = `${p.color}${tailAlpha})`;
                            ctx.lineWidth = finalSize * (1 - i / p.trail.length);
                            ctx.lineTo(pos.x, pos.y);
                        });
                        ctx.stroke();

                        ctx.beginPath();
                        ctx.arc(x, y, finalSize * 1.5, 0, Math.PI * 2);
                        ctx.fillStyle = `${p.color}${finalAlpha})`;
                        ctx.fill();
                    } else if (p.type === 'planet') {
                        const gradient = ctx.createRadialGradient(x - finalSize / 3, y - finalSize / 3, 1, x, y, finalSize);
                        gradient.addColorStop(0, `${p.color}${finalAlpha})`);
                        gradient.addColorStop(1, 'rgba(0, 0, 0, 0.8)');
                        ctx.beginPath();
                        ctx.arc(x, y, finalSize, 0, Math.PI * 2);
                        ctx.fillStyle = gradient;
                        ctx.fill();
                    } else if (p.type === 'asteroid') {
                        ctx.beginPath();
                        ctx.moveTo(x + finalSize, y);
                        for (let i = 1; i < 6; i++) {
                            const ang = (i * Math.PI * 2) / 6;
                            const r = finalSize * (0.8 + Math.random() * 0.4);
                            ctx.lineTo(x + Math.cos(ang) * r, y + Math.sin(ang) * r);
                        }
                        ctx.closePath();
                        ctx.fillStyle = `${p.color}${finalAlpha})`;
                        ctx.fill();
                    }
                }

                if (p.radius < 22) {
                    orbiters[index] = createOrbiter(p.type);
                }
            });

            // Photon Ring - Soft, Diffuse, Metallic Shimmer (Not Solid)
            const ringIntensity = 0.3 + Math.sin(time * 1.5) * 0.1;
            const ringRadius = 42;
            const photonRing = ctx.createRadialGradient(centerX, centerY, ringRadius - 5, centerX, centerY, ringRadius + 10);
            photonRing.addColorStop(0, 'rgba(0, 0, 0, 0)');
            photonRing.addColorStop(0.4, `rgba(200, 220, 255, ${ringIntensity * 0.4})`); // Very faint bluish-white
            photonRing.addColorStop(0.6, `rgba(255, 255, 255, ${ringIntensity * 0.6})`); // Core highlight
            photonRing.addColorStop(0.8, `rgba(200, 180, 150, ${ringIntensity * 0.3})`); // Faint warmth spread
            photonRing.addColorStop(1, 'rgba(0, 0, 0, 0)');

            ctx.fillStyle = photonRing;
            ctx.beginPath();
            ctx.arc(centerX, centerY, ringRadius + 15, 0, Math.PI * 2);
            ctx.fill();


            // Soft Singularity (from classic version)
            const centerDark = ctx.createRadialGradient(
                centerX, centerY, 0,
                centerX, centerY, 60
            );
            centerDark.addColorStop(0, 'rgba(0, 0, 0, 0.95)');
            centerDark.addColorStop(0.5, 'rgba(0, 0, 0, 0.5)');
            centerDark.addColorStop(1, 'rgba(0, 0, 0, 0)');
            ctx.fillStyle = centerDark;
            ctx.beginPath();
            ctx.arc(centerX, centerY, 60, 0, Math.PI * 2);
            ctx.fill();

            animationFrameId = requestAnimationFrame(animate);
        };

        window.addEventListener('resize', init);
        init();
        animationFrameId = requestAnimationFrame(animate);

        return () => {
            window.removeEventListener('resize', init);
            cancelAnimationFrame(animationFrameId);
        };
    }, [prefersReducedMotion]);

    return (
        <canvas
            ref={canvasRef}
            className={`fixed inset-0 pointer-events-none z-0 ${className}`}
            style={{ opacity }}
        />
    );
};

export default NebulaBackground;
