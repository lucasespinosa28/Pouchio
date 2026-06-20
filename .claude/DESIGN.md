---
version: alpha
name: Duolingo
description: "A gamified, character-driven canvas built around Duo green (#58CC02) — one of the most recognized brand greens in consumer apps — with bright white surfaces, bold rounded typography, and a supporting cast of vibrant accent colors (yellow #FFC800, red #FF4B4B, blue #1CB0F6) that drive streak and XP mechanics. The system feels physically substantial: thick drop shadows on interactive elements, bold outlines on cards and buttons, and Duo the owl's presence throughout. Typography is set in Feather Bold — a custom rounded display face — that reads as fun and slightly educational, like a children's book that grew up."

colors:
  primary: "#58CC02"
  on-primary: "#ffffff"
  primary-hover: "#49AD00"
  primary-shadow: "#58A700"
  secondary: "#1CB0F6"
  on-secondary: "#ffffff"
  accent-yellow: "#FFC800"
  accent-red: "#FF4B4B"
  accent-purple: "#CE82FF"
  ink: "#3C3C3C"
  ink-muted: "#777777"
  canvas: "#ffffff"
  surface-1: "#F7F7F7"
  surface-2: "#EBEBEB"
  border: "#E5E5E5"
  streak: "#FF9600"
  xp: "#FFC800"

typography:
  display:
    fontFamily: "Feather Bold, Nunito, -apple-system, sans-serif"
    fontSize: 40px
    fontWeight: 800
    lineHeight: 1.15
    letterSpacing: -0.01em
  body:
    fontFamily: "Nunito, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: 15px
    fontWeight: 700
    lineHeight: 1.5
    letterSpacing: 0

spacing:
  base: 8px
  scale: [4, 8, 12, 16, 20, 24, 32, 40, 48, 64]

radius:
  sm: 8px
  md: 12px
  lg: 20px
  xl: 28px
  pill: 9999px

shadows:
  button: "0 4px 0 #58A700"
  card: "0 2px 0 #E5E5E5"
  elevated: "0 4px 16px rgba(0,0,0,0.1)"

motion:
  duration-fast: 80ms
  duration-base: 200ms
  easing: cubic-bezier(0.34, 1.56, 0.64, 1)
---

## 1. Visual Theme & Atmosphere
Duolingo is the most playful app at scale. Every surface decision reinforces the gamification loop: the green CTA button has a physical shadow (4px bottom) that depresses on press, streaks and XP use warm yellows and oranges, and Duo the owl mascot provides emotional feedback throughout. The app runs on positive reinforcement — correct answers trigger green explosions and character celebrations. The design system serves behavioral psychology as much as aesthetics.

## 2. Color System
Green is Duolingo's core identity:
- **Primary green**: #58CC02 — CTAs, correct states, active elements
- **Green shadow**: #58A700 — 3D button shadow effect, giving buttons physicality
- **Blue**: #1CB0F6 — secondary actions, listening exercises
- **Yellow**: #FFC800 — streaks, XP, gold achievements
- **Red**: #FF4B4B — incorrect answers, hearts/lives
- **Purple**: #CE82FF — gems, premium features
- **Canvas**: White with minimal gray surface layers

## 3. Typography
Feather Bold (and Nunito as fallback) is rounded and chunky — the letters feel approachable for language learners of all ages. Body text runs heavy (700) even at reading sizes, reinforcing the bold character of the system. All caps labels use tight tracking. No thin weights anywhere — this system doesn't whisper.

## 4. Components & Patterns
- **CTA button**: Full-width, 3D shadow effect that presses down on click, large border-radius (12px)
- **Progress bar**: Green fill with animated XP gain, rounded pill shape
- **Lesson cards**: Bold bordered tiles with character art, thick outline style
- **Answer options**: Large tap targets, 12px radius, border changes on select (green correct / red wrong)
- **Streak flame**: Animated fire icon, orange color, always in navigation header
- **Character feedback**: Full-screen celebration with Duo animation on lesson complete

## 5. Spacing & Layout
Mobile-first. Primary lesson view is single-column, 16px horizontal padding. Tap targets minimum 56px height. Marketing and web are centered column ~640px max. White space is minimal — the content is dense with interactive elements.

## 6. Motion & Interaction
Highly animated. Correct answers trigger particle explosions. Duo bounces and waves. Buttons physically press. Streak milestones play full-screen animations. The motion design is closer to a mobile game than a productivity app — every interaction has a reward signal.

## Rationale

**Green as correct + brand simultaneously** — #58CC02 serves double duty as both the primary brand color and the "correct answer" feedback color. This conflation is intentional: Duolingo wants users to associate the brand itself with success and positive reinforcement. Every time the app feels rewarding, it's also reinforcing brand recall.

**Physical button shadow as behavioral design** — The 4px bottom shadow on the primary CTA is not decoration — it's a behavioral cue. The button looks pressable, not just clickable. When it "depresses" on tap, users receive tactile-like feedback that reinforces the action. This physical metaphor makes the product feel more like a toy than a form, reducing resistance to engagement.

**Heavy body weight (700) as legibility for focus** — Running body text at 700 weight even at reading sizes makes text easier to process quickly during language exercises where cognitive load is already high. When you're trying to remember whether "el" or "la" is correct in Spanish, you don't want to spend attention parsing light typography.

**Streak orange + XP yellow as loss aversion mechanics** — The specific warm colors for streaks (#FF9600) and XP (#FFC800) are calibrated for loss aversion psychology. Orange (streak) creates urgency and heat; gold (XP) creates achievement and value. These aren't just brand colors — they're behavioral reinforcement tokens operating on well-documented psychological responses.

**Full-screen celebration as peak-end rule execution** — The full-screen Duo animation at lesson completion is the peak-end rule applied to learning: users remember the ending most vividly, so the ending should be the most rewarding moment. The design investment in these celebrations directly correlates to the product's industry-leading retention rates.

## Accessibility

### Contrast Ratios
- **Primary on background** (#58CC02 on #ffffff): 2.0:1 — fails AA and AAA (decorative/icon use only)
- **Text on surface** (#3C3C3C on #ffffff): 10.1:1 — passes AA
- **Muted on background** (#777777 on #ffffff): 4.0:1 — fails AA for normal text (large text only)

### Minimum Requirements
- **Touch target**: 44×44px minimum for all interactive elements (lesson tap targets 56px height)
- **Focus indicator**: #1CB0F6 outline, 2px, 2px offset
- **Focus contrast**: 3.0:1 against #ffffff — supplement with a non-color indicator (e.g. outline offset or box-shadow) to reinforce focus

### Motion
- Respects `prefers-reduced-motion`: yes — particle explosions, Duo character animations, button press physics, streak milestone full-screen animations, and floating reaction emojis must all be suppressed or replaced with instant state changes
- All transitions use `@media (prefers-reduced-motion: reduce)` guard

### Notes
- The primary green (#58CC02) has very low contrast at 2.0:1 on white — it must never be used as a text color; restrict it to filled button backgrounds (where white text at 4.5:1+ sits on top), large filled progress bars, and brand graphics
- White text on #58CC02 green button: white (L=1) vs green (L≈0.468) → (1.05/0.518) ≈ 2.0:1 — also fails AA; the green CTA button should carry an additional visual indicator (e.g. a border, icon, or shadow) and be used only at 18px+ bold to achieve large-text AA equivalence
- Muted gray (#777777) at 4.0:1 fails AA for normal text — use only at 18px+ or 14px+ bold; prefer the stronger #3C3C3C for any body-size secondary text
- Gamification feedback (green explosions, red wrong-answer flashes) uses color as the sole signal for correct/incorrect — always pair with text feedback ("Correct!" / "Oops!") and sound cues, never color alone
- The springy easing (cubic-bezier with overshoot) must be disabled under `prefers-reduced-motion: reduce` as the overshoot effect can trigger vestibular discomfort
