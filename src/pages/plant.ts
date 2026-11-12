/* Entry: /plant — the configurator "העץ שלכם" (+ carpentry, workshops, corner modes). */
import { bootPage } from '../core/app';
import { initPlant } from '../plant';

bootPage('plant');
const root = document.querySelector<HTMLElement>('[data-plant]');
if (root) initPlant(root);
