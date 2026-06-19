/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from "react";
import MyDashboard from "./components/MawridDashboard";
import AuthHelper from "./components/AuthHelper";

export default function App() {
  const [isAuthHelper, setIsAuthHelper] = useState(false);

  useEffect(() => {
    const checkPath = () => {
      const isAuthPath = 
        window.location.pathname === "/auth-helper" || 
        window.location.search.includes("auth-helper=true") ||
        window.location.hash.includes("auth-helper");
      setIsAuthHelper(isAuthPath);
    };

    checkPath();
    
    // Listen for state and URL adjustments dynamically
    window.addEventListener("popstate", checkPath);
    window.addEventListener("hashchange", checkPath);
    return () => {
      window.removeEventListener("popstate", checkPath);
      window.removeEventListener("hashchange", checkPath);
    };
  }, []);

  if (isAuthHelper) {
    return <AuthHelper />;
  }

  return <MyDashboard />;
}
