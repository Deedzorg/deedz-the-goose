export const ENGINE_VERSION = '1.6.1';
export const DEFAULT_FIXED_STEP = 1 / 60;
export const WORLD_LAYER_NAMES = Object.freeze(['background', 'world', 'effects', 'foreground', 'debug']);
export const UI_LAYER_NAMES = Object.freeze(['hud', 'menu', 'modal', 'toast']);
export const STORAGE_PREFIX = 'deedz-engine';
export const EngineState = Object.freeze({
  CREATED: 'created',
  INITIALIZING: 'initializing',
  READY: 'ready',
  STARTING: 'starting',
  RUNNING: 'running',
  STOPPING: 'stopping',
  STOPPED: 'stopped',
  FAILED: 'failed',
});
