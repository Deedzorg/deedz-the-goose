export function isMobilePlayEnvironment(environment = globalThis) {
  const navigator = environment.navigator ?? {};
  const coarsePointer = environment.matchMedia?.('(pointer: coarse)')?.matches ?? false;
  return Number(navigator.maxTouchPoints || 0) > 0 || coarsePointer || 'ontouchstart' in environment;
}

export function isStandaloneDisplay(environment = globalThis) {
  return Boolean(
    environment.navigator?.standalone
    || environment.matchMedia?.('(display-mode: standalone)')?.matches
    || environment.matchMedia?.('(display-mode: fullscreen)')?.matches
  );
}

export async function enterMobileFullscreen(environment = globalThis) {
  const document = environment.document;
  const root = document?.documentElement;
  if (!isMobilePlayEnvironment(environment) || isStandaloneDisplay(environment) || document?.fullscreenElement || !root?.requestFullscreen) return false;

  try {
    await root.requestFullscreen({ navigationUI: 'hide' });
    return true;
  } catch {
    try {
      await root.requestFullscreen();
      return true;
    } catch {
      return false;
    }
  }
}
