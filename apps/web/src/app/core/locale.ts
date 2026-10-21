import { registerLocaleData } from '@angular/common';
import localeFr from '@angular/common/locales/fr';
import { LOCALE_ID, type Provider } from '@angular/core';

// Dates, nombres et devises au format français (DatePipe, DecimalPipe…).
registerLocaleData(localeFr);

export const provideFrenchLocale = (): Provider => ({ provide: LOCALE_ID, useValue: 'fr' });
