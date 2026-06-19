/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from "react";
import MyDashboard from "./components/MawridDashboard";
import AuthHelper from "./components/AuthHelper";

export default function App() {
  const [path, setPath] = useState(window.location.pathname);

  useEffect(() => {
    const handlePopState = () => {
      setPath(window.location.pathname);
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  if (path === "/auth-helper") {
    return <AuthHelper />;
  }

  return <MyDashboard />;
}
