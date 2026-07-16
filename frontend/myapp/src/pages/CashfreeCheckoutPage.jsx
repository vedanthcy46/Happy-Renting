import React, { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * CashfreeCheckoutPage
 * ────────────────────────────────────────────────────────────────────────────
 * Public page served from happyrenting.netlify.app (which is whitelisted in
 * Cashfree's merchant dashboard). The mobile app opens this page via
 * Linking.openURL() in Chrome Custom Tabs.
 *
 * Flow:
 *  1. Mobile app calls backend → gets payment_session_id + order_id
 *  2. Mobile app opens:
 *     https://happyrenting.netlify.app/cashfree-checkout
 *       ?session_id=<id>&order_id=<id>&app_redirect=happyrenting://payment
 *  3. This page loads Cashfree SDK, calls checkout({ redirectTarget: '_self' })
 *  4. Cashfree redirects the browser to return_url (also on Netlify):
 *     /payments?order_id=xxx&app_redirect=happyrenting://payment
 *  5. PaymentsPage.jsx sees app_redirect → bounces to happyrenting://payment?order_id=xxx
 *  6. Android deep link fires → Chrome Custom Tabs closes → app handles it
 */
const CashfreeCheckoutPage = () => {
  const [searchParams] = useSearchParams();
  const sessionId   = searchParams.get('session_id');
  const orderId     = searchParams.get('order_id');
  const appRedirect = searchParams.get('app_redirect'); // e.g. happyrenting://payment
  const env         = searchParams.get('env') || 'PRODUCTION';

  const [status, setStatus] = useState('loading'); // loading | error
  const [errorMsg, setErrorMsg] = useState('');
  const scriptLoaded = useRef(false);

  const returnToApp = () => {
    if (appRedirect && orderId) {
      window.location.href = `${appRedirect}?order_id=${orderId}`;
    }
  };

  useEffect(() => {
    if (!sessionId) {
      setErrorMsg('Missing payment session. Please go back and try again.');
      setStatus('error');
      return;
    }

    // Avoid double-loading if React strict mode fires effect twice
    if (scriptLoaded.current) return;
    scriptLoaded.current = true;

    const mode = env === 'PRODUCTION' ? 'production' : 'sandbox';

    // Dynamically load the Cashfree SDK script
    const script = document.createElement('script');
    script.src = 'https://sdk.cashfree.com/js/v3/cashfree.js';
    script.async = true;

    script.onload = async () => {
      try {
        // window.Cashfree is set by the SDK script
        const cashfree = window.Cashfree({ mode });

        // With redirectTarget: '_self', Cashfree should do a full-page redirect
        // to their checkout. The promise SHOULD never resolve in that case.
        //
        // However, on some mobile browsers Cashfree renders as an overlay instead.
        // In overlay mode, clicking "More options" or dismissing closes the overlay
        // and resolves the promise — even though payment is NOT done yet.
        //
        // THEREFORE: we NEVER auto-redirect when the promise resolves.
        // We always show the manual "Return to App" button.
        // The user taps it only after they've actually completed the payment.
        await cashfree.checkout({
          paymentSessionId: sessionId,
          redirectTarget: '_self',
        });

        // Promise resolved → overlay was closed (payment done, cancelled, or dismissed).
        // Show the button. Do NOT auto-redirect — payment might not be complete.
        setStatus('done');
      } catch (err) {
        setErrorMsg(err.message || 'Failed to initialize payment gateway.');
        setStatus('error');
      }
    };

    script.onerror = () => {
      setErrorMsg('Could not load payment gateway. Please check your internet connection.');
      setStatus('error');
    };

    document.head.appendChild(script);

    return () => {
      // Clean up script on unmount
      if (script.parentNode) script.parentNode.removeChild(script);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, env]);

  if (status === 'error') {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <div style={styles.iconError}>✕</div>
          <h2 style={styles.title}>Payment Error</h2>
          <p style={styles.message}>{errorMsg}</p>
          {appRedirect && (
            <button style={styles.btn} onClick={returnToApp}>
              Return to App
            </button>
          )}
        </div>
      </div>
    );
  }

  // 'done' = SDK promise resolved (overlay was closed for any reason).
  // Show button — never auto-redirect since payment state is unknown here.
  if (status === 'done') {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>✅</div>
          <h2 style={styles.title}>Payment Complete</h2>
          <p style={styles.message}>
            Tap the button below to return to the app and confirm your payment status.
          </p>
          {appRedirect ? (
            <button style={styles.btn} onClick={returnToApp}>
              Return to App
            </button>
          ) : (
            <p style={{ ...styles.message, color: '#9ca3af', marginTop: '8px' }}>
              You can now close this window.
            </p>
          )}
        </div>
      </div>
    );
  }

  // Default: spinner shown while Cashfree SDK loads or while full-page
  // redirect is in progress (the page navigates away, so user won't see this long)
  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.spinner} />
        <h2 style={styles.title}>Initializing Payment…</h2>
        <p style={styles.message}>
          Redirecting you to secure checkout. Please do not close this window.
        </p>
      </div>
    </div>
  );
};

const styles = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#f9fafb',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    padding: '16px',
  },
  card: {
    background: '#fff',
    borderRadius: '16px',
    padding: '40px 32px',
    textAlign: 'center',
    boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
    maxWidth: '380px',
    width: '100%',
  },
  spinner: {
    width: '48px',
    height: '48px',
    border: '4px solid #e5e7eb',
    borderTopColor: '#2563eb',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
    margin: '0 auto 24px',
  },
  iconError: {
    width: '56px',
    height: '56px',
    background: '#fee2e2',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '24px',
    color: '#dc2626',
    margin: '0 auto 20px',
    lineHeight: '56px',
  },
  title: {
    fontSize: '20px',
    fontWeight: '700',
    color: '#111827',
    margin: '0 0 12px',
  },
  message: {
    fontSize: '14px',
    color: '#6b7280',
    lineHeight: '1.6',
    margin: '0 0 24px',
  },
  btn: {
    background: '#2563eb',
    color: '#fff',
    border: 'none',
    borderRadius: '10px',
    padding: '14px 28px',
    fontSize: '15px',
    fontWeight: '600',
    cursor: 'pointer',
    width: '100%',
  },
};

// Inject keyframe animation for spinner
const styleTag = document.createElement('style');
styleTag.textContent = '@keyframes spin { to { transform: rotate(360deg); } }';
document.head.appendChild(styleTag);

export default CashfreeCheckoutPage;
