/**
 * Native helpers for Capacitor plugins
 * These are safe to import - they won't crash if running in a browser
 */

import { Capacitor } from '@capacitor/core';

export function isNative(): boolean {
  return Capacitor.isNativePlatform();
}

// Initialize native features when running in Android
export async function initializeNativeFeatures() {
  if (!isNative()) return;

  try {
    // Set status bar
    const { StatusBar, Style } = await import('@capacitor/status-bar');
    await StatusBar.setStyle({ style: Style.Light });
    await StatusBar.setBackgroundColor({ color: '#E60000' });

    // Hide splash screen (if not auto-hidden)
    try {
      const { SplashScreen } = await import('@capacitor/splash-screen');
      await SplashScreen.hide({ fadeOutDuration: 300 });
    } catch {}
  } catch (error) {
    console.warn('Native initialization warning:', error);
  }
}

// Haptic feedback
export async function hapticImpact(style: 'light' | 'medium' | 'heavy' = 'light') {
  if (!isNative()) return;
  try {
    const { Haptics, ImpactStyle } = await import('@capacitor/haptics');
    const styleMap = { light: ImpactStyle.Light, medium: ImpactStyle.Medium, heavy: ImpactStyle.Heavy };
    await Haptics.impact({ style: styleMap[style] });
  } catch {}
}

export async function hapticNotification(type: 'success' | 'warning' | 'error' = 'success') {
  if (!isNative()) return;
  try {
    const { Haptics, NotificationType } = await import('@capacitor/haptics');
    const typeMap = { success: NotificationType.Success, warning: NotificationType.Warning, error: NotificationType.Error };
    await Haptics.notification({ type: typeMap[type] });
  } catch {}
}

// Share functionality
export async function shareContent(options: {
  title?: string;
  text?: string;
  url?: string;
}): Promise<boolean> {
  try {
    if (isNative()) {
      const { Share } = await import('@capacitor/share');
      await Share.share({
        title: options.title || 'محفظة الجنوب',
        text: options.text,
        url: options.url,
      });
      return true;
    } else if (navigator.share) {
      await navigator.share({
        title: options.title || 'محفظة الجنوب',
        text: options.text,
        url: options.url,
      });
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

// Copy to clipboard with fallback
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    } else {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      const result = document.execCommand('copy');
      document.body.removeChild(textarea);
      return result;
    }
  } catch {
    return false;
  }
}

// Save/share a card or receipt as an image
export async function shareAsImage(dataUrl: string, title?: string): Promise<boolean> {
  try {
    if (isNative()) {
      const { Share } = await import('@capacitor/share');
      await Share.share({
        title: title || 'محفظة الجنوب',
        text: title || 'محفظة الجنوب',
      });
      return true;
    } else if (navigator.share) {
      // Convert dataUrl to blob for Web Share API
      const response = await fetch(dataUrl);
      const blob = await response.blob();
      const file = new File([blob], 'south-wallet-card.png', { type: 'image/png' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: title || 'محفظة الجنوب',
          files: [file],
        });
        return true;
      }
    }
    return false;
  } catch {
    return false;
  }
}

// Download a file (for web fallback)
export function downloadDataUrl(dataUrl: string, filename: string) {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
