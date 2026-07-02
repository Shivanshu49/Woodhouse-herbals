'use client';

import { useEffect, useRef, useState } from 'react';
import { env } from '@/lib/env';

interface GoogleAccountsId {
  initialize: (config: {
    client_id: string;
    callback: (response: { credential: string }) => void;
  }) => void;
  renderButton: (
    parent: HTMLElement,
    options: {
      type?: 'standard' | 'icon';
      theme?: 'outline' | 'filled_blue' | 'filled_black';
      size?: 'large' | 'medium' | 'small';
      text?: 'signin_with' | 'signup_with' | 'continue_with';
      shape?: 'rectangular' | 'pill' | 'circle' | 'square';
      width?: number;
    },
  ) => void;
}

declare global {
  interface Window {
    google?: { accounts?: { id?: GoogleAccountsId } };
  }
}

const GSI_SRC = 'https://accounts.google.com/gsi/client';

/**
 * Official "Sign in with Google" button (Google Identity Services).
 * Renders nothing when NEXT_PUBLIC_GOOGLE_CLIENT_ID is not configured, so
 * the auth pages degrade gracefully in environments without OAuth set up.
 */
export function GoogleSignInButton({
  text = 'continue_with',
  onCredential,
  onError,
}: {
  text?: 'signin_with' | 'signup_with' | 'continue_with';
  onCredential: (credential: string) => void;
  onError?: (message: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!env.googleClientId || !containerRef.current) return;

    let cancelled = false;
    const renderInto = containerRef.current;

    const init = () => {
      if (cancelled) return;
      const id = window.google?.accounts?.id;
      if (!id) return;
      id.initialize({
        client_id: env.googleClientId as string,
        callback: (response) => onCredential(response.credential),
      });
      renderInto.replaceChildren();
      id.renderButton(renderInto, {
        type: 'standard',
        theme: 'outline',
        size: 'large',
        shape: 'pill',
        text,
        width: 320,
      });
    };

    if (window.google?.accounts?.id) {
      init();
    } else {
      let script = document.querySelector<HTMLScriptElement>(`script[src="${GSI_SRC}"]`);
      if (!script) {
        script = document.createElement('script');
        script.src = GSI_SRC;
        script.async = true;
        document.head.appendChild(script);
      }
      script.addEventListener('load', init);
      script.addEventListener('error', () => {
        if (cancelled) return;
        setFailed(true);
        onError?.('Google sign-in could not load. Check your connection and try again.');
      });
    }
    return () => {
      cancelled = true;
    };
    // onCredential/onError are stable enough per page; re-running on every
    // render would re-initialize the GSI widget and flicker the button.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  if (!env.googleClientId || failed) return null;

  return <div ref={containerRef} className="flex justify-center" />;
}
