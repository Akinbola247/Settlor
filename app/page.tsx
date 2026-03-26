/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useRef, useState } from "react";
import { setCookie, getCookie } from "cookies-next";
import { SocialLoginProvider } from "@circle-fin/w3s-pw-web-sdk/dist/src/types";
import type { W3SSdk } from "@circle-fin/w3s-pw-web-sdk";
import Dashboard from "./components/Dashboard";

const appId = process.env.NEXT_PUBLIC_CIRCLE_APP_ID as string;
const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID as string;

type LoginResult = {
  userToken: string;
  encryptionKey: string;
};

type Wallet = {
  id: string;
  address: string;
  blockchain: string;
  [key: string]: unknown;
};

type AppState = "login" | "loading" | "dashboard";

export default function HomePage() {
  const sdkRef = useRef<W3SSdk | null>(null);
const [sdkReady, setSdkReady] = useState(false);
const [deviceIdLoading, setDeviceIdLoading] = useState(false);
  const [appState, setAppState] = useState<AppState>("loading");
  
  const [deviceId, setDeviceId] = useState<string>("");
  const [deviceToken, setDeviceToken] = useState<string>("");
  const [deviceEncryptionKey, setDeviceEncryptionKey] = useState<string>("");
  const [loginResult, setLoginResult] = useState<LoginResult | null>(null);
const [loginError, setLoginError] = useState<string | null>(null);
 
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [usdcBalance, setUsdcBalance] = useState<string | null>(null);
  const [loadingMessage, setLoadingMessage] = useState<string>("Initializing...");
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("Ready");
  const [challengeId, setChallengeId] = useState<string | null>(null);


  useEffect(() => {
    // Check if user is already logged in (has wallet data)
    const checkExistingSession = async () => {
      const savedUserToken = getCookie("userToken") as string;
      const savedEncryptionKey = getCookie("encryptionKey") as string;
  
      if (savedUserToken && savedEncryptionKey && appState === "login") {
        // User has a saved session, try to restore it
        setAppState("loading");
        setLoadingMessage("Restoring your session...");
        
        try {
          await loadWallets(savedUserToken);
          setLoginResult({
            userToken: savedUserToken,
            encryptionKey: savedEncryptionKey,
          });
        } catch (err) {
          // Session invalid, clear it
          setCookie("userToken", "");
          setCookie("encryptionKey", "");
          setAppState("login");
        }
      }
    };
  
    if (appState === "login") {
      void checkExistingSession();
    }
  }, [appState]);


  // Initialize SDK
  useEffect(() => {
    let cancelled = false;

    const initSdk = async () => {
      try {
        const { W3SSdk } = await import("@circle-fin/w3s-pw-web-sdk");

        const onLoginComplete = (error: unknown, result: any) => {
          if (cancelled) return;

          if (error) {
            const err = error as any;
            console.error("Login failed:", err);
            setError(err.message || "Login failed");
            setAppState("login");
            return;
          }

          setLoginResult({
            userToken: result.userToken,
            encryptionKey: result.encryptionKey,
          });
          
          handlePostLogin(result.userToken, result.encryptionKey);
        };

        const restoredAppId = (getCookie("appId") as string) || appId || "";
        const restoredGoogleClientId =
          (getCookie("google.clientId") as string) || googleClientId || "";
        const restoredDeviceToken = (getCookie("deviceToken") as string) || "";
        const restoredDeviceEncryptionKey =
          (getCookie("deviceEncryptionKey") as string) || "";

        const initialConfig = {
          appSettings: { appId: restoredAppId },
          loginConfigs: {
            deviceToken: restoredDeviceToken,
            deviceEncryptionKey: restoredDeviceEncryptionKey,
            google: {
              clientId: restoredGoogleClientId,
              redirectUri:
                typeof window !== "undefined" ? window.location.origin : "",
              selectAccountPrompt: true,
            },
          },
        };

        const sdk = new W3SSdk(initialConfig, onLoginComplete);
        sdkRef.current = sdk;

        if (!cancelled) {
          setSdkReady(true);
          await initializeDeviceAndAuth();
        }
      } catch (err) {
        console.error("Failed to initialize Web SDK:", err);
        if (!cancelled) {
          setError("Failed to initialize application");
          setAppState("login");
        }
      }
    };



    void initSdk();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleCreateDeviceToken = async () => {
    if (!deviceId) {
      setStatus("Missing deviceId");
      return;
    }

    try {
      setStatus("Creating device token...");
      const response = await fetch("/api/endpoints", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "createDeviceToken",
          deviceId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        console.log("Create device token failed:", data);
        setStatus("Failed to create device token");
        return;
      }

      setDeviceToken(data.deviceToken);
      setDeviceEncryptionKey(data.deviceEncryptionKey);

      setCookie("deviceToken", data.deviceToken);
      setCookie("deviceEncryptionKey", data.deviceEncryptionKey);

      setStatus("Device token created");
    } catch (err) {
      console.log("Error creating device token:", err);
      setStatus("Failed to create device token");
    }
  };

  const handleInitializeUser = async () => {
    if (!loginResult?.userToken) {
      setStatus("Missing userToken. Please login with Google first.");
      return;
    }

    try {
      setStatus("Initializing user...");

      const response = await fetch("/api/endpoints", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "initializeUser",
          userToken: loginResult.userToken,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        // 155106 = user already initialized
        if (data.code === 155106) {
          // User already initialized; load wallet details instead of trying to create again
          await loadWallets(loginResult.userToken);
          // No challenge to execute when wallet already exists
          setChallengeId(null);
          return;
        }

        const errorMsg = data.code
          ? `[${data.code}] ${data.error || data.message}`
          : data.error || data.message;
        setStatus("Failed to initialize user: " + errorMsg);
        return;
      }

      // Successful initialization → get challengeId
      setChallengeId(data.challengeId);
        handleExecuteChallenge();
      setStatus(`User initialized. challengeId: ${data.challengeId}`);
    } catch (err) {
      const error = err as any;

      if (error?.code === 155106 && loginResult?.userToken) {
        await loadWallets(loginResult.userToken,);
        setChallengeId(null);
        return;
      }

      const errorMsg = error?.code
        ? `[${error.code}] ${error.message}`
        : error?.message || "Unknown error";
      setStatus("Failed to initialize user: " + errorMsg);
    }
  };

  const handleExecuteChallenge = () => {
    const sdk = sdkRef.current;
    if (!sdk) {
      setStatus("SDK not ready");
      return;
    }

    if (!challengeId) {
      setStatus("Missing challengeId. Initialize user first.");
      return;
    }

    if (!loginResult?.userToken || !loginResult?.encryptionKey) {
      setStatus("Missing login credentials. Please login again.");
      return;
    }

    sdk.setAuthentication({
      userToken: loginResult.userToken,
      encryptionKey: loginResult.encryptionKey,
    });

    setStatus("Executing challenge...");

    sdk.execute(challengeId, (error) => {
      const err = (error || {}) as any;

      if (error) {
        console.log("Execute challenge failed:", err);
        setStatus(
          "Failed to execute challenge: " + (err?.message ?? "Unknown error"),
        );
        return;
      }

      setStatus("Challenge executed. Loading wallet details...");

      void (async () => {
        // small delay to give Circle time to index the wallet
        await new Promise((resolve) => setTimeout(resolve, 2000));

        // Challenge consumed; clear it and load wallet details (and balance)
        setChallengeId(null);
        await loadWallets(loginResult.userToken);
      })().catch((e) => {
        console.log("Post-execute follow-up failed:", e);
        setStatus("Wallet created, but failed to load wallet details.");
      });
    });
  }; 


  const initializeDeviceAndAuth = async () => {
    if (!sdkRef.current) return;
  
    try {
      const cached =
        typeof window !== "undefined"
          ? window.localStorage.getItem("deviceId")
          : null;
  
      let id = cached;
      if (!cached) {
        id = await sdkRef.current.getDeviceId();
        if (typeof window !== "undefined") {
          window.localStorage.setItem("deviceId", id);
        }
      }
      setDeviceId(id ?? "");
  
      // CHECK IF WE ALREADY HAVE VALID DEVICE TOKEN IN COOKIES
      const existingDeviceToken = getCookie("deviceToken") as string;
      const existingDeviceEncryptionKey = getCookie("deviceEncryptionKey") as string;
  
      if (existingDeviceToken && existingDeviceEncryptionKey) {
        // Reuse existing token instead of creating a new one
        setDeviceToken(existingDeviceToken);
        setDeviceEncryptionKey(existingDeviceEncryptionKey);
        setAppState("login");
        return;
      }
  
      // Only create a new device token if we don't have one
      setLoadingMessage("Setting up secure connection...");
      const response = await fetch("/api/endpoints", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "createDeviceToken",
          deviceId: id,
        }),
      });
  
      const data = await response.json();
  
      if (!response.ok) {
        throw new Error("Failed to create device token");
      }
  
      setDeviceToken(data.deviceToken);
      setDeviceEncryptionKey(data.deviceEncryptionKey);
  
      setCookie("deviceToken", data.deviceToken);
      setCookie("deviceEncryptionKey", data.deviceEncryptionKey);
  
      setAppState("login");
    } catch (err) {
      console.error("Initialization error:", err);
      setError("Failed to initialize secure connection");
      setAppState("login");
    }
  };

  const handlePostLogin = async (userToken: string, encryptionKey: string) => {
    setAppState("loading");
    setLoadingMessage("Setting up your wallet...");
  
    try {
      // SAVE USER SESSION
      setCookie("userToken", userToken);
      setCookie("encryptionKey", encryptionKey);
  
      const initResponse = await fetch("/api/endpoints", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "initializeUser",
          userToken,
        }),
      });
  
      const initData = await initResponse.json();
  
      if (initData.code === 155106) {
        await loadWallets(userToken);
        return;
      }
  
      if (!initResponse.ok) {
        throw new Error(initData.error || initData.message || "Failed to initialize user");
      }
  
      const challengeId = initData.challengeId;
      
      if (!sdkRef.current) {
        throw new Error("SDK not ready");
      }
  
      sdkRef.current.setAuthentication({
        userToken,
        encryptionKey,
      });
  
      setLoadingMessage("Creating your wallet...");
  
      sdkRef.current.execute(challengeId, async (error) => {
        if (error) {
          const err = error as any;
          console.error("Execute challenge failed:", err);
          setError("Failed to create wallet: " + (err?.message ?? "Unknown error"));
          setAppState("login");
          return;
        }
  
        await new Promise((resolve) => setTimeout(resolve, 2000));
        
        await loadWallets(userToken);
      });
    } catch (err: any) {
      console.error("Post-login flow error:", err);
      setError(err?.message || "Failed to complete setup");
      setAppState("login");
    }
  };

  const handleLogout = () => {
    // Clear all cookies and state
    setCookie("userToken", "");
    setCookie("encryptionKey", "");
    setCookie("deviceToken", "");
    setCookie("deviceEncryptionKey", "");
    setCookie("appId", "");
    setCookie("google.clientId", "");
    
    setLoginResult(null);
    setWallets([]);
    setUsdcBalance(null);
    setAppState("login");
  };

  const loadWallets = async (userToken: string) => {
    try {
      setLoadingMessage("Loading your wallet...");

      const response = await fetch("/api/endpoints", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "listWallets",
          userToken,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error("Failed to load wallet");
      }

      const wallets = (data.wallets as Wallet[]) || [];
      setWallets(wallets);

      if (wallets.length > 0) {
        await loadUsdcBalance(userToken, wallets[0].id);
      }

      setAppState("dashboard");
    } catch (err: any) {
      console.error("Failed to load wallet:", err);
      setError("Failed to load wallet details");
      setAppState("login");
    }
  };

  async function loadUsdcBalance(userToken: string, walletId: string) {
    try {
      const response = await fetch("/api/endpoints", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "getTokenBalance",
          userToken,
          walletId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error("Failed to load USDC balance:", data);
        return;
      }

      const balances = (data.tokenBalances as any[]) || [];
      const usdcEntry =
        balances.find((t) => {
          const symbol = t.token?.symbol || "";
          const name = t.token?.name || "";
          return symbol.startsWith("USDC") || name.includes("USDC");
        }) ?? null;

      const amount = usdcEntry?.amount ?? "0";
      setUsdcBalance(amount);
    } catch (err) {
      console.error("Failed to load USDC balance:", err);
    }
  }

  const handleLoginWithGoogle = async () => {
    const sdk = sdkRef.current;
    if (!sdk) {
      setError("SDK not ready");
      return;
    }

    if (!deviceToken || !deviceEncryptionKey) {
      setError("Missing device credentials");
      return;
    }

    setCookie("appId", appId);
    setCookie("google.clientId", googleClientId);
    setCookie("deviceToken", deviceToken);
    setCookie("deviceEncryptionKey", deviceEncryptionKey);

    sdk.updateConfigs({
      appSettings: { appId },
      loginConfigs: {
        deviceToken,
        deviceEncryptionKey,
        google: {
          clientId: googleClientId,
          redirectUri: window.location.origin,
          selectAccountPrompt: true,
        },
      },
    });

    setAppState("loading");
    setLoadingMessage("Redirecting to Google...");
    sdk.performLogin(SocialLoginProvider.GOOGLE);

  };
 
  const primaryWallet = wallets[0];

  if (appState === "loading") {
    return <LoadingScreen message={loadingMessage} />;
  }

  if (appState === "login") {
    return (
      <LoginPage 
        onLogin={handleLoginWithGoogle} 
        error={error}
        onClearError={() => setError(null)}
      />
    );
  }

  return (
    <Dashboard 
      wallet={primaryWallet}
      usdcBalance={usdcBalance}
    />
  );
}

function LoadingScreen({ message }: { message: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 to-slate-900">
      <div className="text-center">
        <div className="mb-8">
          <div className="text-5xl font-extrabold gradient-text tracking-tight">
            iPayX
          </div>
        </div>
        <div className="spinner mx-auto mb-6"></div>
        <p className="text-slate-400 text-sm">{message}</p>
      </div>
    </div>
  );
}

function LoginPage({ 
  onLogin, 
  error,
  onClearError 
}: { 
  onLogin: () => void;
  error: string | null;
  onClearError: () => void;
}) {
  useEffect(() => {
    if (error) {
      const timer = setTimeout(onClearError, 5000);
      return () => clearTimeout(timer);
    }
  }, [error, onClearError]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 to-slate-900 p-8">
      <div className="glass-card rounded-3xl p-12 max-w-md w-full shadow-2xl">
        <div className="text-center mb-12">
          <h1 className="text-6xl font-extrabold gradient-text mb-2 tracking-tight">
            iPayX
          </h1>
          <p className="text-slate-400 text-sm font-medium">
            Cross-Chain Crypto Invoicing & Payments
          </p>
        </div>

        <div className="space-y-3 mb-10">
          <div className="feature-card group">
            <div className="text-2xl flex-shrink-0">⚡</div>
            <div>
              <h3 className="text-white text-sm font-semibold mb-1">
                Instant Payments
              </h3>
              <p className="text-slate-400 text-xs leading-relaxed">
                Accept crypto payments from any blockchain
              </p>
            </div>
          </div>
          
          <div className="feature-card group">
            <div className="text-2xl flex-shrink-0">🔗</div>
            <div>
              <h3 className="text-white text-sm font-semibold mb-1">
                Cross-Chain
              </h3>
              <p className="text-slate-400 text-xs leading-relaxed">
                Unified USDC balance across all chains
              </p>
            </div>
          </div>
          
          <div className="feature-card group">
            <div className="text-2xl flex-shrink-0">💰</div>
            <div>
              <h3 className="text-white text-sm font-semibold mb-1">
                Predictable Fees
              </h3>
              <p className="text-slate-400 text-xs leading-relaxed">
                Dollar-denominated pricing, no surprises
              </p>
            </div>
          </div>
        </div>

        <button 
          onClick={onLogin}
          className="google-btn w-full"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Continue with Google
        </button>

        {error && (
          <div className="mt-4 p-3.5 bg-red-500/10 border border-red-500/30 rounded-lg">
            <p className="text-red-300 text-sm text-center">{error}</p>
          </div>
        )}

        <p className="mt-6 flex items-center justify-center gap-2 text-slate-500 text-xs">
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="5" y="11" width="14" height="10" rx="2"/>
            <path d="M7 11V7a5 5 0 0110 0v4"/>
          </svg>
          Secured by Circle & Arc Network
        </p>
      </div>
    </div>
  );
}

















































// import { useEffect, useRef, useState } from "react";
// import { setCookie, getCookie } from "cookies-next";
// import { SocialLoginProvider } from "@circle-fin/w3s-pw-web-sdk/dist/src/types";
// import type { W3SSdk } from "@circle-fin/w3s-pw-web-sdk";

// const appId = process.env.NEXT_PUBLIC_CIRCLE_APP_ID as string;
// const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID as string;

// type LoginResult = {
//   userToken: string;
//   encryptionKey: string;
//   // other fields (refreshToken, oAuthInfo, etc.) are ignored in this quickstart
// };

// type Wallet = {
//   id: string;
//   address: string;
//   blockchain: string;
//   [key: string]: unknown;
// };

// export default function HomePage() {
//   const sdkRef = useRef<W3SSdk | null>(null);

//   const [sdkReady, setSdkReady] = useState(false);
//   const [deviceId, setDeviceId] = useState<string>("");
//   const [deviceIdLoading, setDeviceIdLoading] = useState(false);

//   const [deviceToken, setDeviceToken] = useState<string>("");
//   const [deviceEncryptionKey, setDeviceEncryptionKey] = useState<string>("");

//   const [loginResult, setLoginResult] = useState<LoginResult | null>(null);
//   const [loginError, setLoginError] = useState<string | null>(null);

//   const [challengeId, setChallengeId] = useState<string | null>(null);
//   const [wallets, setWallets] = useState<Wallet[]>([]);
//   const [usdcBalance, setUsdcBalance] = useState<string | null>(null);
//   const [status, setStatus] = useState<string>("Ready");

//   // Initialize SDK on mount, using cookies to restore config after redirect
//   useEffect(() => {
//     let cancelled = false;

//     const initSdk = async () => {
//       try {
//         const { W3SSdk } = await import("@circle-fin/w3s-pw-web-sdk");

//         const onLoginComplete = (error: unknown, result: any) => {
//           if (cancelled) return;

//           if (error) {
//             const err = error as any;
//             console.log("Login failed:", err);
//             setLoginError(err.message || "Login failed");
//             setLoginResult(null);
//             setStatus("Login failed");
//             return;
//           }

//           setLoginResult({
//             userToken: result.userToken,
//             encryptionKey: result.encryptionKey,
//           });
//           setLoginError(null);
//           setStatus("Login successful. Credentials received from Google.");
//         };

//         const restoredAppId = (getCookie("appId") as string) || appId || "";
//         const restoredGoogleClientId =
//           (getCookie("google.clientId") as string) || googleClientId || "";
//         const restoredDeviceToken = (getCookie("deviceToken") as string) || "";
//         const restoredDeviceEncryptionKey =
//           (getCookie("deviceEncryptionKey") as string) || "";

//         const initialConfig = {
//           appSettings: { appId: restoredAppId },
//           loginConfigs: {
//             deviceToken: restoredDeviceToken,
//             deviceEncryptionKey: restoredDeviceEncryptionKey,
//             google: {
//               clientId: restoredGoogleClientId,
//               redirectUri:
//                 typeof window !== "undefined" ? window.location.origin : "",
//               selectAccountPrompt: true,
//             },
//           },
//         };

//         const sdk = new W3SSdk(initialConfig, onLoginComplete);
//         sdkRef.current = sdk;

//         if (!cancelled) {
//           setSdkReady(true);
//           setStatus("SDK initialized. Ready to create device token.");
//         }
//       } catch (err) {
//         console.log("Failed to initialize Web SDK:", err);
//         if (!cancelled) {
//           setStatus("Failed to initialize Web SDK");
//         }
//       }
//     };

//     void initSdk();

//     return () => {
//       cancelled = true;
//     };
//   }, []);

//   // Get / cache deviceId
//   useEffect(() => {
//     const fetchDeviceId = async () => {
//       if (!sdkRef.current) return;

//       try {
//         const cached =
//           typeof window !== "undefined"
//             ? window.localStorage.getItem("deviceId")
//             : null;

//         if (cached) {
//           setDeviceId(cached);
//           return;
//         }

//         setDeviceIdLoading(true);
//         const id = await sdkRef.current.getDeviceId();
//         setDeviceId(id);

//         if (typeof window !== "undefined") {
//           window.localStorage.setItem("deviceId", id);
//         }
//       } catch (error) {
//         console.log("Failed to get deviceId:", error);
//         setStatus("Failed to get deviceId");
//       } finally {
//         setDeviceIdLoading(false);
//       }
//     };

//     if (sdkReady) {
//       void fetchDeviceId();
//     }
//   }, [sdkReady]);

//   // Helper to load USDC balance for a wallet
//   async function loadUsdcBalance(userToken: string, walletId: string) {
//     try {
//       const response = await fetch("/api/endpoints", {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify({
//           action: "getTokenBalance",
//           userToken,
//           walletId,
//         }),
//       });

//       const data = await response.json();

//       if (!response.ok) {
//         console.log("Failed to load USDC balance:", data);
//         setStatus("Failed to load USDC balance");
//         return null;
//       }

//       const balances = (data.tokenBalances as any[]) || [];

//       const usdcEntry =
//         balances.find((t) => {
//           const symbol = t.token?.symbol || "";
//           const name = t.token?.name || "";
//           return symbol.startsWith("USDC") || name.includes("USDC");
//         }) ?? null;

//       const amount = usdcEntry?.amount ?? "0";
//       setUsdcBalance(amount);
//       return amount;
//     } catch (err) {
//       console.log("Failed to load USDC balance:", err);
//       setStatus("Failed to load USDC balance");
//       return null;
//     }
//   }

//   // Helper to load wallets for the current user
//   const loadWallets = async (
//     userToken: string,
//     options?: { source?: "afterCreate" | "alreadyInitialized" },
//   ) => {
//     try {
//       setStatus("Loading wallet details...");
//       setUsdcBalance(null);

//       const response = await fetch("/api/endpoints", {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify({
//           action: "listWallets",
//           userToken,
//         }),
//       });

//       const data = await response.json();

//       if (!response.ok) {
//         console.log("List wallets failed:", data);
//         setStatus("Failed to load wallet details");
//         return;
//       }

//       const wallets = (data.wallets as Wallet[]) || [];
//       setWallets(wallets);

//       if (wallets.length > 0) {
//         // Load USDC balance for the primary wallet
//         await loadUsdcBalance(userToken, wallets[0].id);

//         if (options?.source === "afterCreate") {
//           setStatus(
//             "Wallet created successfully! 🎉 Wallet details and USDC balance loaded.",
//           );
//         } else if (options?.source === "alreadyInitialized") {
//           setStatus(
//             "User already initialized. Wallet details and USDC balance loaded.",
//           );
//         } else {
//           setStatus("Wallet details and USDC balance loaded.");
//         }
//       } else {
//         setStatus("No wallets found for this user.");
//       }
//     } catch (err) {
//       console.log("Failed to load wallet details:", err);
//       setStatus("Failed to load wallet details");
//     }
//   };

//   const handleCreateDeviceToken = async () => {
//     if (!deviceId) {
//       setStatus("Missing deviceId");
//       return;
//     }

//     try {
//       setStatus("Creating device token...");
//       const response = await fetch("/api/endpoints", {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify({
//           action: "createDeviceToken",
//           deviceId,
//         }),
//       });

//       const data = await response.json();

//       if (!response.ok) {
//         console.log("Create device token failed:", data);
//         setStatus("Failed to create device token");
//         return;
//       }

//       setDeviceToken(data.deviceToken);
//       setDeviceEncryptionKey(data.deviceEncryptionKey);

//       setCookie("deviceToken", data.deviceToken);
//       setCookie("deviceEncryptionKey", data.deviceEncryptionKey);

//       setStatus("Device token created");
//     } catch (err) {
//       console.log("Error creating device token:", err);
//       setStatus("Failed to create device token");
//     }
//   };

//   const handleLoginWithGoogle = () => {
//     const sdk = sdkRef.current;
//     if (!sdk) {
//       setStatus("SDK not ready");
//       return;
//     }

//     if (!deviceToken || !deviceEncryptionKey) {
//       setStatus("Missing deviceToken or deviceEncryptionKey");
//       return;
//     }

//     // Persist configs so SDK can rehydrate after redirect
//     setCookie("appId", appId);
//     setCookie("google.clientId", googleClientId);
//     setCookie("deviceToken", deviceToken);
//     setCookie("deviceEncryptionKey", deviceEncryptionKey);

//     sdk.updateConfigs({
//       appSettings: {
//         appId,
//       },
//       loginConfigs: {
//         deviceToken,
//         deviceEncryptionKey,
//         google: {
//           clientId: googleClientId,
//           redirectUri: window.location.origin,
//           selectAccountPrompt: true,
//         },
//       },
//     });

//     setStatus("Redirecting to Google...");
//     sdk.performLogin(SocialLoginProvider.GOOGLE);
//   };

//   const handleInitializeUser = async () => {
//     if (!loginResult?.userToken) {
//       setStatus("Missing userToken. Please login with Google first.");
//       return;
//     }

//     try {
//       setStatus("Initializing user...");

//       const response = await fetch("/api/endpoints", {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify({
//           action: "initializeUser",
//           userToken: loginResult.userToken,
//         }),
//       });

//       const data = await response.json();

//       if (!response.ok) {
//         // 155106 = user already initialized
//         if (data.code === 155106) {
//           // User already initialized; load wallet details instead of trying to create again
//           await loadWallets(loginResult.userToken, {
//             source: "alreadyInitialized",
//           });
//           // No challenge to execute when wallet already exists
//           setChallengeId(null);
//           return;
//         }

//         const errorMsg = data.code
//           ? `[${data.code}] ${data.error || data.message}`
//           : data.error || data.message;
//         setStatus("Failed to initialize user: " + errorMsg);
//         return;
//       }

//       // Successful initialization → get challengeId
//       setChallengeId(data.challengeId);
//       setStatus(`User initialized. challengeId: ${data.challengeId}`);
//     } catch (err) {
//       const error = err as any;

//       if (error?.code === 155106 && loginResult?.userToken) {
//         await loadWallets(loginResult.userToken, {
//           source: "alreadyInitialized",
//         });
//         setChallengeId(null);
//         return;
//       }

//       const errorMsg = error?.code
//         ? `[${error.code}] ${error.message}`
//         : error?.message || "Unknown error";
//       setStatus("Failed to initialize user: " + errorMsg);
//     }
//   };

//   const handleExecuteChallenge = () => {
//     const sdk = sdkRef.current;
//     if (!sdk) {
//       setStatus("SDK not ready");
//       return;
//     }

//     if (!challengeId) {
//       setStatus("Missing challengeId. Initialize user first.");
//       return;
//     }

//     if (!loginResult?.userToken || !loginResult?.encryptionKey) {
//       setStatus("Missing login credentials. Please login again.");
//       return;
//     }

//     sdk.setAuthentication({
//       userToken: loginResult.userToken,
//       encryptionKey: loginResult.encryptionKey,
//     });

//     setStatus("Executing challenge...");

//     sdk.execute(challengeId, (error) => {
//       const err = (error || {}) as any;

//       if (error) {
//         console.log("Execute challenge failed:", err);
//         setStatus(
//           "Failed to execute challenge: " + (err?.message ?? "Unknown error"),
//         );
//         return;
//       }

//       setStatus("Challenge executed. Loading wallet details...");

//       void (async () => {
//         // small delay to give Circle time to index the wallet
//         await new Promise((resolve) => setTimeout(resolve, 2000));

//         // Challenge consumed; clear it and load wallet details (and balance)
//         setChallengeId(null);
//         await loadWallets(loginResult.userToken, { source: "afterCreate" });
//       })().catch((e) => {
//         console.log("Post-execute follow-up failed:", e);
//         setStatus("Wallet created, but failed to load wallet details.");
//       });
//     });
//   };

//   const primaryWallet = wallets[0];

//   return (
//     <main>
//       <div style={{ width: "50%", margin: "0 auto" }}>
//         <h1>Create a user wallet with Google social login</h1>
//         <p>Follow the buttons below to complete the flow:</p>

//         <div>
//           <button
//             onClick={handleCreateDeviceToken}
//             style={{ margin: "6px" }}
//             disabled={!sdkReady || !deviceId || deviceIdLoading}
//           >
//             1. Create device token
//           </button>
//           <br />
//           <button
//             onClick={handleLoginWithGoogle}
//             style={{ margin: "6px" }}
//             disabled={!deviceToken || !deviceEncryptionKey}
//           >
//             2. Login with Google
//           </button>
//           <br />
//           <button
//             onClick={handleInitializeUser}
//             style={{ margin: "6px" }}
//             disabled={!loginResult || wallets.length > 0}
//           >
//             3. Initialize user (get challenge)
//           </button>
//           <br />
//           <button
//             onClick={handleExecuteChallenge}
//             style={{ margin: "6px" }}
//             disabled={!challengeId || wallets.length > 0}
//           >
//             4. Create wallet (execute challenge)
//           </button>
//         </div>

//         <p>
//           <strong>Status:</strong> {status}
//         </p>

//         {loginError && (
//           <p style={{ color: "red" }}>
//             <strong>Error:</strong> {loginError}
//           </p>
//         )}

//         {primaryWallet && (
//           <div style={{ marginTop: "12px" }}>
//             <h2>Wallet details</h2>
//             <p>
//               <strong>Address:</strong> {primaryWallet.address}
//             </p>
//             <p>
//               <strong>Blockchain:</strong> {primaryWallet.blockchain}
//             </p>
//             {usdcBalance !== null && (
//               <p>
//                 <strong>USDC balance:</strong> {usdcBalance}
//               </p>
//             )}
//           </div>
//         )}

//         <pre
//           style={{
//             whiteSpace: "pre-wrap",
//             wordBreak: "break-all",
//             lineHeight: "1.8",
//             marginTop: "16px",
//           }}
//         >
//           {JSON.stringify(
//             {
//               deviceId,
//               deviceToken,
//               deviceEncryptionKey,
//               userToken: loginResult?.userToken,
//               encryptionKey: loginResult?.encryptionKey,
//               challengeId,
//               wallets,
//               usdcBalance,
//             },
//             null,
//             2,
//           )}
//         </pre>
//       </div>
//       <button className="h-[50px] w-[100px] border-2 bg-black text-white text-center flex justify-center items-center cursor-pointer">LOGIN TEST</button>
//     </main>
//   );
// }