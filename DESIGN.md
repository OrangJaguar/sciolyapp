```markdown
# Design System Specification: Tactical Intelligence & HUD

## 1. Overview & Creative North Star
**Creative North Star: "The Brutalist Scholar"**

This design system is a high-fidelity convergence of academic rigor and tactical urgency. It rejects the "soft" friendliness of modern SaaS in favor of a "Bloomberg-meets-Black-Ops" aesthetic. It is designed for power users who prioritize data density over white space and precision over approachability.

The visual language breaks the standard "web" template by treating the screen as a high-performance Heads-Up Display (HUD). We achieve this through **intentional asymmetry**, **monochromatic layering**, and **kinetic typography**. Every pixel must feel like a deliberate calculation. The interface does not "welcome" the user; it equips them.

---

## 2. Colors & Surface Logic

The palette is rooted in absolute darkness, using high-contrast accents to guide the eye through dense information environments.

### The Palette
- **Background (Void):** `#050505` (Custom) / `surface_container_lowest`.
- **Primary (Cyber Cyan):** `#00f0ff` / `primary_container`. Used for active states, data fills, and "System Go" indicators.
- **Alert (System Red):** `#ff2a2a` / `on_tertiary_container`. Reserved strictly for critical failure or high-priority warnings.
- **Neutral Surface:** `#111111` / `surface_container`. Used for card backgrounds and secondary modules.

### The "No-Line" Rule
While the prompt allows for 1px borders, they must be used sparingly as "connectors" rather than "containers." Sectioning should primarily be achieved via background shifts. For example, a `surface_container_high` module should sit flush against a `surface_dim` background to define its boundary without a stroke.

### Surface Hierarchy & Nesting
Treat the UI as a physical instrument panel. 
1. **Base Layer:** `surface_dim` (#131313).
2. **Module Layer:** `surface_container` (#201F1F) with a 1px `outline_variant` at 10% opacity.
3. **Active/Focus Layer:** `surface_container_highest` (#353534).

### Signature Textures
To avoid a flat "bootstrap" look, apply a 2% opacity scanline pattern or a subtle `primary` to `primary_fixed_dim` linear gradient (45-degree angle) on large progress bars and active CTA states. This provides the "phosphor glow" of vintage hardware.

---

## 3. Typography: The Information Hierarchy

The typography system is split between **Data (Functional)** and **MetaData (Labeling)**.

*   **The Display Scale (`spaceGrotesk`):** Used for headlines and critical "at-a-glance" metrics. It is bold, technical, and authoritative.
*   **The Label Scale (`spaceGrotesk` All-Caps):** Set at 10px with `1.5px` (wide) tracking. This is used for headers, category tags, and HUD labeling. It must feel like etched serial numbers on hardware.
*   **The Data Scale (Monospace):** All numerical values, timestamps, and terminal outputs must use a monospace font (Inter or system-mono fallback) to ensure character alignment in dense tables.

**Hierarchy Strategy:**
Brand identity is conveyed through extreme scale contrast. A `display-lg` metric (3.5rem) should often sit directly adjacent to a `label-sm` (0.68rem) descriptor to create a "Technical Manual" editorial feel.

---

## 4. Elevation & Depth

In this system, "Elevation" does not mean shadows. It means **Luminance.**

*   **The Layering Principle:** Higher priority items are brighter, not closer. To elevate a card, move from `surface_container_low` to `surface_container_high`. 
*   **Shadows:** Strictly prohibited. Depth is achieved via **Ghost Borders**.
*   **The "Ghost Border":** Use the `outline` token (#849495) at 10% opacity for inactive modules and 40% opacity for active modules. This creates a "wireframe" depth reminiscent of CAD software.
*   **Glassmorphism:** For floating HUD overlays (modals or tooltips), use `surface_container_lowest` at 80% opacity with a `20px` backdrop-blur. This simulates a glass terminal screen.

---

## 5. Components

### Buttons (Tactical Triggers)
*   **Primary:** Solid `primary_container` (#00f0ff). Black text. 0px radius. No gradient.
*   **Secondary:** 1px `primary` border. Transparent background. `primary` text.
*   **State Change:** On hover, the button should "glitch" to a 100% white fill for 50ms before settling.

### Input Fields (Data Entry)
*   **Styling:** Underline-only or full 1px box using `outline_variant`.
*   **Active State:** The border glows `primary` (#00f0ff); a 2px vertical "caret" blinks in the right corner of the field.
*   **Spacing:** `spacing.2` (0.3rem) internal padding to maintain ultra-high density.

### Cards & Lists (Data Modules)
*   **Forbid Dividers:** Do not use horizontal rules. Separate list items using a 1px background shift or a `spacing.1` (0.15rem) vertical gap.
*   **Header:** Every card must have a `label-sm` header in All-Caps with wide tracking, left-aligned, often with a small "X-Y" coordinate or timestamp in the top right corner.

### HUD Data Gauges (Custom Component)
*   **The "Fill" Logic:** Use `primary_fixed_dim` for progress fills. Use a "segmented" bar (10 blocks) instead of a smooth continuous bar to reinforce the tactical hardware aesthetic.

---

## 6. Do's and Don'ts

### Do:
*   **Embrace Density:** Use `spacing.2` and `spacing.3` for almost all layouts. Content should feel tightly packed but organized.
*   **Align to a Grid:** Every element must snap to a strict 4px or 8px grid. Asymmetry should be calculated (e.g., a sidebar that is exactly 17.5% of the screen width).
*   **Use Monospace for Numbers:** This is non-negotiable for table alignment and the "Terminal" feel.

### Don't:
*   **No Rounded Corners:** Anything above a `2px` radius is a system failure. The UI should feel sharp enough to cut.
*   **No Soft Gradients:** Avoid "sunset" or "vibrant" multi-color gradients. Use only tonal shifts within the Cyan or Red spectrum.
*   **No Illustrations:** Use icons (strictly thin-stroke, 1px) or data visualizations. Never use "friendly" 3D characters or soft flat-design illustrations.

---

## 7. Spacing Scale Implementation

| Token | Value | Use Case |
| :--- | :--- | :--- |
| `px` | 1px | Borders, Hairlines, Connectors. |
| `1` | 0.15rem | Tight list grouping. |
| `2` | 0.3rem | Standard internal component padding. |
| `4` | 0.75rem | Gutter between major HUD modules. |
| `8` | 1.5rem | External page margins. |

*Note: For this system, "High Density" means never exceeding `spacing.8` for any internal layout logic.*```