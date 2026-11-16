import React from 'react';
import { Redirect, usePathname } from 'expo-router';
import * as Sentry from '@sentry/react-native';

export default function NotFound() {
  const pathname = usePathname();
  Sentry.captureMessage('Unmatched route: ' + pathname, {
    level: 'warning',
    extra: { pathname },
  });
  return <Redirect href="/" />;
}
