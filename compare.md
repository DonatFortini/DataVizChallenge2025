# Comparison between `src` (Sane) and `src - Copy` (Tainted)

## Overview
- **`src` (Sane)**: Represents the original, structured application state. It features a split architecture where `Home` is a landing page that transitions into the main `App`. It uses lazy loading for the 3D scene (`IsulaScene`) and handles data prefetching in `main.tsx`.
- **`src - Copy` (Tainted)**: Represents the debug state where components were simplified and inlined to isolate the "blank screen" issue. It bypasses the prefetching logic and renders `Home` directly.

## File-by-File Analysis

### 1. `main.tsx`

| Feature | `src` (Sane) | `src - Copy` (Tainted) |
| :--- | :--- | :--- |
| **Entry Point** | Renders `<Root />` which manages state. | Renders `<Home />` directly. |
| **Data Loading** | Prefetches GeoJSONs (`communes`, `corse`, datasets) using `Promise.allSettled`. | No prefetching. Passes `prefetching={false}` prop. |
| **Routing/State** | Manages `stage` ('home' -> 'app'). | No stage management. |
| **Lazy Loading** | Lazy loads `App` component. | No lazy loading. |
| **DevTools** | Includes a patch for React DevTools renderer crash. | No patch. |

**Key Difference**: The sane version ensures data is loaded before showing the main app, whereas the tainted version tries to render immediately, which might fail if dependencies aren't ready.

### 2. `Home.tsx`

| Feature | `src` (Sane) | `src - Copy` (Tainted) |
| :--- | :--- | :--- |
| **3D Scene** | Imported as `LazyScene` from `./IsulaScene`. | Inline `<Canvas>`, `<Model>`, and `<InteractionRig>`. |
| **Visibility** | Uses `IntersectionObserver` to set `showScene` state. | Always renders (or conditionally renders based on `activeStep`). |
| **Components** | Uses reusable `<InfoCard />` component. | Inline HTML for cards. |
| **Logic** | Simpler. Focuses on scroll and visibility. | Contains complex animation logic (`useAnimations`) and step tracking. |
| **Debug** | Clean. | Contains `console.log` and `fetch` checks. |

**Key Difference**: The sane version refactors the heavy 3D logic into a separate file (`IsulaScene.tsx`), likely to improve initial load performance and code readability. The tainted version has everything in one file, making it harder to debug.

### 3. `IsulaScene.tsx`

- **Both versions**: Appear identical. This confirms that the sane version successfully extracted the 3D logic into this file.

## Conclusion & Recommendation

The "blank screen" issue likely originated from the **Tainted** version's attempt to inline complex 3D logic or bypass the necessary data prefetching in `main.tsx`.

**To restore functionality:**
1.  **Keep `src/main.tsx`**: The prefetching logic is crucial for the app to work (it loads the GeoJSONs needed by the engine).
2.  **Keep `src/Home.tsx`**: The refactored structure with `LazyScene` is cleaner and less prone to rendering errors.
3.  **Verify `IsulaScene.tsx`**: Ensure it is correctly importing the model.

**Next Steps:**
- If the "Sane" version is currently active in `src`, the app *should* work, provided `IsulaScene` loads correctly.
- If `IsulaScene` is causing issues, we can debug that specific file without touching the main architecture.
