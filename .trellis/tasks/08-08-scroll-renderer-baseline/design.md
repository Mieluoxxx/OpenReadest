# Renderer baseline design

Change the submodule gitlink first, then keep all compatibility logic at the config hydration boundary. `BaseAppService.loadBookConfig()` and `readerStore.initViewState()` are the authoritative path; UI components must not independently reinterpret `continuousScroll`.

The normalized view settings object is the compatibility contract. Unknown book-config fields remain untouched, and new writes use the new fields. The old field remains readable for one compatibility window. Renderer attributes are applied by `FoliateViewer` and shared helpers, not by ad hoc settings effects.

Rollback is the previous gitlink plus the previous settings/type files. No downstream child starts until the baseline build and normalization tests pass.
