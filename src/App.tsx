/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect } from "react";
import PubCrawlPlanner from "./components/PubCrawlPlanner";
import { initializeAdMob, showAppOpenAd } from "./services/admobService";

export default function App() {
  useEffect(() => {
    const startAdMob = async () => {
      try {
        await initializeAdMob();
        await showAppOpenAd();
      } catch (e) {
        console.error("AdMob startup failed", e);
      }
    };
    startAdMob();
  }, []);

  return <PubCrawlPlanner />;
}

