/**
 * Best-effort device fingerprinting for the login-activity log.
 * Purely descriptive (device class, browser family, OS) - nothing that could
 * be used to track a person across sites is collected or stored.
 */

const BROWSERS = [
  { name: 'Edge', re: /Edg[A-Z]?\/([\d.]+)/ },
  { name: 'Opera', re: /OPR\/([\d.]+)/ },
  { name: 'Samsung Internet', re: /SamsungBrowser\/([\d.]+)/ },
  { name: 'Chrome', re: /Chrome\/([\d.]+)/ },
  { name: 'Firefox', re: /Firefox\/([\d.]+)/ },
  { name: 'Safari', re: /Version\/([\d.]+).*Safari/ },
];

const PLATFORMS = [
  { name: 'Windows', re: /Windows NT ([\d.]+)/ },
  { name: 'Android', re: /Android ([\d.]+)/ },
  { name: 'iOS', re: /(?:iPhone|iPad).*OS ([\d_]+)/ },
  { name: 'macOS', re: /Mac OS X ([\d_]+)/ },
  { name: 'Linux', re: /Linux/ },
];

export const detectBrowser = (ua = navigator.userAgent) => {
  for (const browser of BROWSERS) {
    const match = ua.match(browser.re);
    if (match) return match[1] ? `${browser.name} ${match[1].split('.')[0]}` : browser.name;
  }
  return 'Unknown Browser';
};

export const detectPlatform = (ua = navigator.userAgent) => {
  for (const platform of PLATFORMS) {
    const match = ua.match(platform.re);
    if (match) {
      const version = match[1] ? match[1].replace(/_/g, '.') : '';
      return version ? `${platform.name} ${version}` : platform.name;
    }
  }
  return 'Unknown Platform';
};

export const detectDevice = (ua = navigator.userAgent) => {
  if (/iPad|Tablet|PlayBook|Silk/i.test(ua)) return 'Tablet';
  if (/Mobi|Android.*Mobile|iPhone|iPod/i.test(ua)) return 'Mobile';
  return 'Desktop';
};

/** Snapshot written alongside every login session document. */
export const getDeviceInfo = () => {
  if (typeof navigator === 'undefined') {
    return { device: 'Unknown', browser: 'Unknown', platform: 'Unknown', screen: '', timezone: '' };
  }
  const ua = navigator.userAgent;
  return {
    device: detectDevice(ua),
    browser: detectBrowser(ua),
    platform: detectPlatform(ua),
    screen:
      typeof window !== 'undefined' && window.screen
        ? `${window.screen.width}x${window.screen.height}`
        : '',
    timezone: Intl?.DateTimeFormat?.().resolvedOptions?.().timeZone || '',
  };
};
