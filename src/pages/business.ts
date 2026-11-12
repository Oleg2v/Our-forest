/* Entry: /business — companies & organisations. */
import { bootPage } from '../core/app';
import { syncCopy } from '../static/util';
import { initBusiness } from '../business';

const main = document.getElementById('main');
if (main) syncCopy(main); // before the chrome splits headings for reveals
bootPage('business');
initBusiness();
