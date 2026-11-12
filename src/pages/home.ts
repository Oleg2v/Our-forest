/* Entry: / (home, long scroll). Section order = the "Roots" journey:
   preloader → hero (crown) → under the ground → seasons → forest map (checkout) → companies → wall → contact → footer */
import { bootPage } from '../core/app';
import { initPreloader } from '../sections/home/preloader';
import { initHero } from '../sections/home/hero';
import { initRoots } from '../sections/home/roots';
import { initSeasons } from '../sections/home/seasons';
import { initMap } from '../sections/home/map';
import { initCompanies } from '../sections/home/companies';
import { initWall } from '../sections/home/wall';
import { initContact } from '../sections/home/contact';

bootPage('home');
const ready = initPreloader();
initHero(ready);
initRoots();
initSeasons();
initMap();
initCompanies();
initWall();
initContact();
