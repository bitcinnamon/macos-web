// Core system assembly.
import { VFS } from '../vfs.js';
import { ICONS } from '../icons.js';
import { HOME_USER, paths } from '../config.js';
import { install as installPrefs } from './prefs.js';
import { install as installServices } from './services.js';
import { install as installRegistry } from './registry.js';
import { install as installWindows } from './windows.js';
import { install as installMenus } from './menus.js';
import { install as installDialogs } from './dialogs.js';
import { install as installShell } from './shell.js';
import { install as installBoot } from './boot.js';

export { ICONS };

export const System = (() => {
  const sys = {};
  installPrefs(sys);
  installServices(sys);
  installRegistry(sys);
  installWindows(sys);
  installMenus(sys);
  installDialogs(sys);
  installShell(sys);
  installBoot(sys);

  return {
    registerApp: sys.registerApp,
    registerLazyApp: sys.registerLazyApp,
    launch: sys.launch,
    createWindow: sys.createWindow,
    resizeWindow: sys.resizeWindow,
    fitWindowToContent: sys.fitWindowToContent,
    closeWindow: sys.closeWindow,
    minimizeWindow: sys.minimizeWindow,
    focusWindow: sys.focusWindow,
    windowSignal: sys.windowSignal,
    addWindowCleanup: sys.addWindowCleanup,
    listenWindow: sys.listenWindow,
    setWindowTimeout: sys.setWindowTimeout,
    setWindowInterval: sys.setWindowInterval,
    trackWindowMedia: sys.trackWindowMedia,
    trackWindowObjectURL: sys.trackWindowObjectURL,
    boot: sys.boot,
    alertBox: sys.alertBox,
    quitApp: sys.quitApp,
    el: sys.el,
    textEl: sys.textEl,
    $: sys.$,
    appleIconSvg: sys.appleIconSvg,
    syslog: sys.syslog,
    syslogBuf: sys.syslogBuf,
    HW: sys.HW,
    Kexts: sys.Kexts,
    uptimeStr: sys.uptimeStr,
    toggleExpose: sys.toggleExpose,
    topWindowOf: sys.topWindowOf,
    contextMenu: sys.contextMenu,
    moveToTrash: sys.moveToTrash,
    emptyTrash: sys.emptyTrash,
    showAboutMac: sys.showAboutMac,
    TRASH: sys.TRASH,
    forceQuitDialog: sys.forceQuitDialog,
    startItemDrag: sys.startItemDrag,
    confirmBox: sys.confirmBox,
    showSheet: sys.showSheet,
    promptSheet: sys.promptSheet,
    confirmSheet: sys.confirmSheet,
    openPanel: sys.openPanel,
    savePanel: sys.savePanel,
    dispatchAppCommand: sys.dispatchAppCommand,
    shutdownSequence: sys.shutdownSequence,
    kernelPanicSequence: sys.kernelPanicSequence,
    dockCfg: sys.dockCfg,
    applyDockCfg: sys.applyDockCfg,
    applyBrightness: sys.applyBrightness,
    addToDock: sys.addToDock,
    removeFromDock: sys.removeFromDock,
    persistDockOrder: sys.persistDockOrder,
    beep: sys.beep,
    updateVolumeIcon: sys.updateVolumeIcon,
    getSound: sys.getSound,
    beginBusy: sys.beginBusy,
    canDownloadVfsFile: sys.canDownloadVfsFile,
    downloadVfsFile: sys.downloadVfsFile,
    getFinderPreferences: sys.getFinderPreferences,
    updateFinderPreferences: sys.updateFinderPreferences,
    getAppPreferences: sys.getAppPreferences,
    updateAppPreferences: sys.updateAppPreferences,
    showApplicationPreferences: sys.showApplicationPreferences,
    addRecentDocument: sys.addRecentDocument,
    getRecentItems: sys.getRecentItems,
    clearRecentItems: sys.clearRecentItems,
    clampWindowToViewport: sys.clampWindowToViewport,
    clampAllWindowsToViewport: sys.clampAllWindowsToViewport,
    clampDesktopIconsToViewport: sys.clampDesktopIconsToViewport,
    handleViewportResize: sys.handleViewportResize,
    updateDock: sys.updateDock,
    updateTrashIcon: sys.updateTrashIcon,
    renderDesktopIcons: sys.renderDesktopIcons,
    renderMenuTitles: sys.renderMenuTitles,
    setActiveApp: sys.setActiveApp,
    setWindowStatus: sys.setWindowStatus,
    applyI18nToDom: sys.applyI18nToDom,
    tickClock: () => sys.clockTick && sys.clockTick(),
    get apps() { return sys.apps; },
    get windows() { return sys.windows; },
    get bootTime() { return sys.bootTime; },
    get activeApp() { return sys.activeApp; },
  };
})();
