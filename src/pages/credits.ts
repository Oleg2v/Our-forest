/* Entry: /credits — photos (from images.json), fonts, open-source code. */
import { bootPage } from '../core/app';
import { initDoc } from '../static/legal';
import { initCredits } from '../static/credits';

initCredits(); // before the chrome scans images
bootPage('credits');
initDoc();
