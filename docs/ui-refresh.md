# Workspace UI

Today, Menu, Preferences and Settings share Geist typography, neutral light and dark surfaces, sage selection states, 44px controls and visible keyboard focus. Styles live in `src/app/workspace.css`; shared primitives remain in `src/components/ui.tsx`.

Today combines a meal-choice fit summary with plate ideas and a full-photo dish gallery. Native CSS columns arrange mixed card proportions without a layout library. Station, dish name and the current rating sit over a bottom gradient. The gallery uses three columns on desktop, two on tablets and one on phones. Selecting a dish opens an inline inspector with community notes and a separate review editor. The inspector stays beside the scrolling list on larger viewports and replaces it on phones. Star ratings support keyboard selection, save states and focus restoration.

Menu filters the dishes at a selected station. Its first dish is featured above the remaining photos. Missing photos use a neutral placeholder. Small screens place station controls before the dishes and the posted-menu action afterward.

Preferences uses single-choice eating-style radios, optional goal checkboxes and ingredient editors. Apply stages editor changes; Save commits the profile. A Save/Discard bar appears while changes are pending. Temporary restrictions save independently.

Appearance changes apply immediately. Email delivery uses an explicit save and reveals scheduling fields when enabled. Account changes retain the existing verification flow. Main navigation returns to the top, including repeat taps on the active tab. Section anchors retain their normal behavior.

Transitions affect local state and carousel movement. Reduced-motion settings disable these transitions. No animation or UI library was added.

For guest behavior and fit calculation, see [Public demo](public-demo.md). Generated food images and the sample poster are illustrative assets; recipe tags are sample data, not verified café ingredients.
