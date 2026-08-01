// Register bundled applications. Large, infrequently opened apps keep their
// real Leopard descriptors visible to Finder/Dock and load implementation code
// only on first launch.

import { System } from '../system/index.js';
import { ICONS } from '../icons.js';
import { t } from '../i18n/index.js';
import { installPreferencesRuntime } from './preferences-runtime.js';

import './finder.js';
import './finder-leopard.js';
import './calculator.js';
import './notes.js';
import './stickies.js';
import './textedit.js';
import './terminal.js';
import './safari.js';
import './ical.js';
import './preview.js';
import './itunes.js';
import './chess.js';
import './leopard-native.js';
import './sysprofiler.js';
import './diskutil.js';
import './activity.js';
import './consoleapp.js';
import './netutil.js';
import './fontbook.js';
import './opengl.js';

installPreferencesRuntime();

const loadSystemPreferences = (attempt) => attempt === 1
  ? import('./sysprefs.js')
  : import(`./sysprefs.js?retry=${attempt}`);

System.registerLazyApp({
  id: 'sysprefs',
  name: t('app.sysprefs'),
  icon: ICONS.sysprefs,
  about: t('prefs.about'),
  keywords: t('prefs.ui8.c50116437a74'),
}, loadSystemPreferences);
