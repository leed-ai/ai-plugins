/**
 * The site header's behavior, from the Leed plugin's site-onboarding starter. Loaded by header.hbs.
 *
 * - Measures the fixed header and publishes --height-header, which site-template.hbs offsets the page
 *   by (site-patterns rule 12). Only a header marked data-measure-header is measured: on documentation
 *   pages the header sits inside Leed's wrapper and Leed's own script measures it, so two writers never
 *   fight. The header's height is never set from this value.
 * - Opens and closes the mobile drawer: the same menu list, toggled by one attribute.
 *
 * Desktop dropdowns are CSS-only (:hover and :focus-within in tailwind/partials/menu.css), so they need no
 * ready-class guard and nothing here has to run before they work.
 */
const header = document.getElementById("menu-container");

if (header) {
  if (header.hasAttribute("data-measure-header")) {
    const publish = () =>
      document.documentElement.style.setProperty(
        "--height-header",
        `${Math.round(header.getBoundingClientRect().height)}px`,
      );
    new ResizeObserver(publish).observe(header);
    publish();
  }

  const toggle = header.querySelector("[data-menu-toggle]");
  const drawer = header.querySelector("[data-menu]");
  if (toggle && drawer) {
    toggle.addEventListener("click", () => {
      const open = toggle.getAttribute("aria-expanded") !== "true";
      toggle.setAttribute("aria-expanded", String(open));
      drawer.toggleAttribute("data-open", open);
    });
  }
}
