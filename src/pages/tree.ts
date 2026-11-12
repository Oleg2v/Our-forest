/* Entry: /tree/0427 — "העץ שלכם", the living tree (owned by the tree-ui agent). */
import { bootPage } from '../core/app';
import { initTreePage } from '../tree/ui';

bootPage('tree');
const main = document.querySelector<HTMLElement>('[data-tree]');
if (main) initTreePage(main);
