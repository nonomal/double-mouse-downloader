import { ipcMain } from 'electron';
import aria2Service from './services/aria2';
import bilibiliService from './services/bilibili';
import configService from './services/config-service';
import contextMenuService from './services/context-menu';
import dialogService from './services/dialog';
import githubService from './services/github';
import openInBrowserService from './services/open-in-browser';
import windowControlService from './services/window-control';

export const bridges = [
  bilibiliService,
  contextMenuService,
  openInBrowserService,
  windowControlService,
  configService,
  dialogService,
  githubService,
  aria2Service,
];

export function initBridge() {
  bridges.forEach((service) => {
    Object.entries(service.fns).forEach(([apiName, apiFn]) => {
      ipcMain.handle(makeChannelName(service.name, apiName), (ev, ...args) =>
        (apiFn as any)(...args)
      );
    });
  });
}

export function makeChannelName(featureName: string, apiName: string): string {
  return `${featureName}:${apiName}`;
}
