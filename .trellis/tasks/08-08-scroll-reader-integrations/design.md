# Scroll reader-integrations design

The renderer relocation event remains the single progress source. TTS, section info, progress bars, headers, and footers consume normalized renderer geometry rather than maintaining separate scroll offsets. Annotation selection may temporarily set `scrollLocked`; cleanup must be paired with the selection lifecycle.

The mode-toggle path must update all renderer turn attributes and invalidate prepared captured-turn surfaces when leaving paginated mode. Existing OpenReadest translation and sync services remain consumers of progress/config, not owners of scroll geometry.
