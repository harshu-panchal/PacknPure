/**
 * Maps a GeolocationPositionError to a clear, actionable title/message.
 * code 1 = PERMISSION_DENIED, 2 = POSITION_UNAVAILABLE (device/system location
 * turned off), 3 = TIMEOUT.
 */
export function getGeolocationErrorInfo(error) {
  const code = error?.code;

  if (code === 1) {
    return {
      title: 'Location access blocked',
      message:
        "You've blocked location access for this site. Please allow location permission in your browser or app settings, then try again.",
    };
  }

  if (code === 2) {
    return {
      title: 'Turn on your location',
      message:
        "We couldn't detect your location. Please turn on your device's location (GPS) and make sure it's enabled for this browser/app, then try again.",
    };
  }

  if (code === 3) {
    return {
      title: 'Location request timed out',
      message:
        'Getting your location took too long. Please make sure GPS/location is turned on and you have a clear signal, then try again.',
    };
  }

  return {
    title: 'Unable to detect location',
    message:
      "We couldn't detect your location. Please make sure location services are turned on, then try again.",
  };
}
