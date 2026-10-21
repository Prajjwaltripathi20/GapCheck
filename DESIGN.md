---
name: GapCheck
description: Placement readiness and proof-of-skill platform with Apple Pro design aesthetic
colors:
  bg-app: "#000000"
  bg-surface: "#0c0c0e"
  bg-surface-elevated: "#16161a"
  bg-glass: "rgba(255, 255, 255, 0.04)"
  border-subtle: "rgba(255, 255, 255, 0.08)"
  border-medium: "rgba(255, 255, 255, 0.14)"
  text-primary: "#ffffff"
  text-secondary: "#86868b"
  text-tertiary: "#515154"
  status-verified: "#30d158"
  status-weak: "#ffd60a"
  status-unverified: "#ff453a"
typography:
  display:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Inter', sans-serif"
    fontSize: "clamp(2.5rem, 6vw, 4.5rem)"
    fontWeight: 600
    lineHeight: 1.05
    letterSpacing: "-0.035em"
  title:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Inter', sans-serif"
    fontSize: "clamp(1.75rem, 3.5vw, 2.5rem)"
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: "-0.025em"
  body:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Inter', sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "-0.016em"
rounded:
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  full: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
---

# Design System

## Overview
GapCheck follows Apple's human interface principles for pro developer tools: deep obsidian dark backgrounds, frosted glass translucency, high typographic clarity with negative letter-spacing, tactile pill controls, and crisp status signaling without AI clutter.

## Colors
- **Ground**: True Black `#000000` with subtle frosted glass overlays (`rgba(255, 255, 255, 0.04)`).
- **Text**: Pure White `#ffffff` for primary headings; neutral muted gray `#86868b` for body and secondary metadata.
- **Accents & Status**: Restrained Apple functional indicators:
  - Verified: Apple Green `#30d158`
  - Weak: Apple Amber `#ffd60a`
  - Missing/Unverified: Apple Red `#ff453a`

## Typography
- **Typeface**: Apple SF Pro / Inter system stack.
- **Scale**:
  - Hero display: `clamp(2.5rem, 6vw, 4.5rem)`, `-0.035em` letter-spacing, tight leading.
  - Section headers: `1.75rem – 2.5rem`, `-0.025em`.
  - Content titles: `0.875rem – 1rem`, `font-semibold`.
  - Body & metadata: `0.75rem – 0.875rem`, line height `1.5`.

## Layout
- **Containers**: Max-width `1200px` (`max-w-6xl`) with `px-6` gutters.
- **Grid**: 4-column Bento layout on desktop collapsing gracefully to single-column stacked viewports on mobile devices.
- **Alignment**: Consistent vertical rhythm with 8px increments.

## Elevation & Depth
- **Borders**: 1px subtle hairline outlines (`rgba(255, 255, 255, 0.08)`).
- **Specular Highlight**: Inset top rim lighting (`shadow-[inset_0_1px_0_0_rgba(255,255,255,0.12)]`).
- **Shadows**: Deep soft ambient shadows (`0 24px 64px rgba(0, 0, 0, 0.6)`), avoiding harsh zero-blur offsets.

## Shapes
- **Pills**: `rounded-full` (`999px`) for buttons, filter controls, and category tags.
- **Cards & Modules**: `rounded-2xl` (`16px – 18px`).
- **Inputs**: `rounded-xl` (`12px – 14px`).

## Components
- **Navbar**: Translucent frosted bar (`backdrop-blur-2xl bg-black/75 border-b border-white/[0.08]`) with segmented control links.
- **Button**: Apple pill button with tactile active scale (`active:scale-[0.98]`).
- **Activity Gauge**: Circular SVG progress meter visualizing candidate readiness (0–100%).
- **Audit Table**: Translucent table rows with hover vibrancy and status pills.

## Do's and Don'ts
- **Do**: Use high-contrast typography, generous whitespace, and continuous squircle corners.
- **Do**: Keep animations smooth, subtle, and fast (`duration-200 cubic-bezier(0.16, 1, 0.3, 1)`).
- **Don't**: Add colored drop shadows, purple AI gradients, or glowing neon halos.
- **Don't**: Place eyebrows or kickers above headings.
- **Don't**: Use emoji as UI iconography.
