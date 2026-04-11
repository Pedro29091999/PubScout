/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect } from "react";
import PubCrawlPlanner from "./components/PubCrawlPlanner";
import { initializeAdMob, showAppOpenAd, showBannerAd } from "./services/admobService";

export default function App() {
  useEffect(() => {
    const startAdMob = async () => {
      try {
        await initializeAdMob();
        await showAppOpenAd();
        await showBannerAd();
      } catch (e) {
        console.error("AdMob startup failed", e);
      }
    };
    startAdMob();
  }, []);

  return <PubCrawlPlanner />;
}

