import { useEffect } from 'react';
import { useRouter } from 'expo-router';

// Puter bridge deep link router tak aata hai. Result openAuthSessionAsync handle karta hai.
// Home par mat bhejo: Generate tab par wapas bhejo taaki result dikhe.
export default function PuterAuthRedirect() {
  const router = useRouter();
  useEffect(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)/generate');
  }, []);
  return null;
}
