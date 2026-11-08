/**
 * Jumps to the top of the page immediately. The site sets `scroll-behavior: smooth`
 * for in-page anchors, so a plain scrollTo(0, 0) would glide up from the footer;
 * 'instant' makes a newly opened page start at the top, like a normal page load.
 */
export function scrollToTop() {
  try {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  } catch {
    window.scrollTo(0, 0); // older browsers that don't accept an options object
  }
}
