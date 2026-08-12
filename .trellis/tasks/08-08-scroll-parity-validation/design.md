# Scroll parity validation design

Validation is layered: pure settings/renderer contracts, paginator browser behavior, fixed-layout/PDF behavior, gesture and Auto Scroll behavior, React reader integrations, then app/build smoke tests. Upstream tests are evidence of intended behavior; OpenReadest tests additionally protect its renamed paths and local integrations.

The release gate requires no unexplained failures in the targeted suite, full app tests, lint, and build. Platform-specific skips must name the missing toolchain or runtime limitation. Rollback is defined per child task and includes the previous submodule gitlink.
