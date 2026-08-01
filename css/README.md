# CSS layout

| File | Responsibility |
| --- | --- |
| `aqua.css` | System chrome: menubar, windows, Dock, Aqua controls, boot/panic screens |
| `leopard.css` | Leopard extensions: Spaces, Dashboard, Time Machine, Exposé, stacks, effects |
| `apps.css` | In-window application UIs (Finder, Safari, prefs panes, utilities) |

Keep selectors scoped to their layer when possible. Prefer class names over deep nesting so app chrome does not fight system chrome.
