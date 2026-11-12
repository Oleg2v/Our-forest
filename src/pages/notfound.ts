/* Entry: 404 — "העלה הזה הלך לאיבוד". */
import { bootPage } from '../core/app';
import { syncCopy } from '../static/util';
import { initNotFound } from '../static/notfound';

const main = document.getElementById('main');
if (main) syncCopy(main);
bootPage('notfound');
initNotFound();
