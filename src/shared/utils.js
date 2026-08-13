let nextId = 1;

export function createId(prefix = 'id') {
  return `${prefix}-${Date.now().toString(36)}-${(nextId++).toString(36)}`;
}

export function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype;
}

export function deepMerge(target, source) {
  if (!isPlainObject(source)) return Array.isArray(source) ? [...source] : source ?? target;
  const output = isPlainObject(target) ? { ...target } : {};
  for (const [key, value] of Object.entries(source)) {
    if (Array.isArray(value)) output[key] = [...value];
    else if (isPlainObject(value)) output[key] = deepMerge(output[key], value);
    else output[key] = value;
  }
  return output;
}

export function debounce(fn, delay = 100) {
  let timer = null;
  let lastArgs = [];
  const invoke = () => {
    timer = null;
    fn(...lastArgs);
  };
  const wrapped = (...args) => {
    lastArgs = args;
    clearTimeout(timer);
    timer = setTimeout(invoke, delay);
  };
  wrapped.cancel = () => { clearTimeout(timer); timer = null; };
  wrapped.flush = () => { if (timer !== null) { clearTimeout(timer); invoke(); } };
  wrapped.pending = () => timer !== null;
  return wrapped;
}

export function safeJsonParse(value, fallback = null) {
  try { return JSON.parse(value); } catch { return fallback; }
}

export function getPath(object, path, fallback = undefined) {
  if (!path) return object ?? fallback;
  const value = String(path).split('.').reduce((current, key) => current?.[key], object);
  return value ?? fallback;
}

export function setPath(object, path, value) {
  const keys = String(path).split('.').filter(Boolean);
  if (!keys.length) throw new Error('A non-empty path is required');
  let cursor = object;
  for (const key of keys.slice(0, -1)) cursor = cursor[key] ??= {};
  cursor[keys.at(-1)] = value;
  return object;
}

export function deletePath(object, path) {
  const keys = String(path).split('.').filter(Boolean);
  if (!keys.length) return false;
  const parent = keys.slice(0, -1).reduce((current, key) => current?.[key], object);
  return Boolean(parent && delete parent[keys.at(-1)]);
}

export function withTimeout(promise, timeoutMs, message = 'Operation timed out') {
  if (!timeoutMs || timeoutMs <= 0) return promise;
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(message)), timeoutMs); }),
  ]).finally(() => clearTimeout(timer));
}

export function assert(condition, message) {
  if (!condition) throw new Error(message);
}
