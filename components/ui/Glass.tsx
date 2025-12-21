'use client';

import React from 'react';
import { motion, HTMLMotionProps, useReducedMotion } from 'framer-motion';
import clsx from 'clsx';

/**
 * Shared Motion Variants for Liquid-Glass UI
 */
export const MotionPresets = {
    fadeBlur: {
        initial: { opacity: 0, backdropFilter: 'blur(0px)', y: 10 },
        animate: { opacity: 1, backdropFilter: 'blur(24px)', y: 0 },
        exit: { opacity: 0, backdropFilter: 'blur(0px)', y: 10 },
        transition: { type: 'spring', damping: 25, stiffness: 200 }
    },
    liquidScale: {
        hover: { scale: 1.04, filter: 'brightness(1.1) saturate(1.1)' },
        tap: { scale: 0.96, filter: 'brightness(0.9)' },
        transition: { type: 'spring', damping: 15, stiffness: 400 }
    },
    staggerChildren: {
        animate: { transition: { staggerChildren: 0.05 } }
    }
};

interface GlassPanelProps extends HTMLMotionProps<'div'> {
    children?: React.ReactNode;
    variant?: 'light' | 'dark';
    useReflection?: boolean;
}

/**
 * A reusable Glass Panel wrapper with organic entry animations
 */
export const GlassPanel = React.forwardRef<HTMLDivElement, GlassPanelProps>(
    ({ children, className, variant = 'light', useReflection = true, ...props }, ref) => {
        const shouldReduceMotion = useReducedMotion();

        return (
            <motion.div
                ref={ref}
                initial={shouldReduceMotion ? { opacity: 0 } : MotionPresets.fadeBlur.initial}
                animate={shouldReduceMotion ? { opacity: 1 } : MotionPresets.fadeBlur.animate}
                exit={shouldReduceMotion ? { opacity: 0 } : MotionPresets.fadeBlur.exit}
                className={clsx(
                    variant === 'light' ? 'glass-surface' : 'glass-surface-dark',
                    'relative overflow-hidden',
                    className
                )}
                {...props}
            >
                {useReflection && (
                    <div className="absolute inset-0 glass-reflection pointer-events-none" />
                )}
                {children}
            </motion.div>
        );
    }
);

GlassPanel.displayName = 'GlassPanel';

interface GlassButtonProps extends HTMLMotionProps<'button'> {
    children?: React.ReactNode;
    active?: boolean;
}

/**
 * A motion button with liquid scale and bloom effects
 */
export const GlassButton = React.forwardRef<HTMLButtonElement, GlassButtonProps>(
    ({ children, className, active, ...props }, ref) => {
        const shouldReduceMotion = useReducedMotion();

        return (
            <motion.button
                ref={ref}
                whileHover={shouldReduceMotion ? {} : MotionPresets.liquidScale.hover}
                whileTap={shouldReduceMotion ? {} : MotionPresets.liquidScale.tap}
                className={clsx(
                    'p-2 rounded-xl transition-all duration-300 relative group',
                    active
                        ? 'bg-black text-white shadow-lg shadow-black/20'
                        : 'text-gray-500 hover:text-black hover:bg-white/60',
                    className
                )}
                {...props}
            >
                {children}
            </motion.button>
        );
    }
);

GlassButton.displayName = 'GlassButton';
