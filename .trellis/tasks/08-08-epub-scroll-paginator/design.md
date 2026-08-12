# EPUB paginator design

Treat `foliate-js` as the owner of section geometry, stabilization, and scroll anchors. `FoliateViewer` adapts events and styles; `usePagination` chooses page, section, or relative scroll actions. Position persistence continues through the existing CFI/progress stores.

The upstream browser paginator tests are the source of behavior. Port fixtures selectively and replace only Readest-specific harness dependencies. The OpenReadest translation and cloud-sync layers remain outside paginator code.
