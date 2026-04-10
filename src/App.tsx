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
      await initializeAdMob();
      await showAppOpenAd();
    };
    startAdMob();
  }, []);

  return <PubCrawlPlanner />;
}

