/* eslint-disable no-console */
import { getMetadata } from '../../scripts/aem.js';
import { loadFragment } from '../fragment/fragment.js';

/**
 * loads and decorates the footer
 * @param {Element} block The footer block element
 */
export default async function decorate(block) {
  // load footer as fragment
  const footerMeta = getMetadata('footer');
  console.log(`footerMeta = ${footerMeta}`);
  console.log(`footerMeta footer = ${footerMeta.footer}`);
  const footerPath = footerMeta ? new URL(footerMeta, window.location).pathname : '/footer'; /* footerMeta.footer || '/footer'; */
  console.log(`footerPath = ${footerPath}`);
  const fragment = await loadFragment(footerPath);

  // decorate footer DOM
  block.textContent = '';
  const footer = document.createElement('div');
  footer.classList.add('wrapper');
  while (fragment.firstElementChild) footer.append(fragment.firstElementChild);

  block.append(footer);
}
