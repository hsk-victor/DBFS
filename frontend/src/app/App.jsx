import { useCallback, useEffect, useState } from "react";
import { OngXuanApp } from "@/ong_xuan/OngXuanApp";
import { VictorApp } from "@/victor/VictorApp";
import { ZavierApp } from "@/zavier/ZavierApp";
import { sectionFromLocation, sectionUrl } from "@/shared/lib/navigation";

export default function App() {
  const [section, setSection] = useState(sectionFromLocation);

  useEffect(() => {
    const onPopState = () => setSection(sectionFromLocation());
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const navigate = useCallback((nextSection) => {
    if (nextSection === section) return;
    window.history.pushState({}, "", sectionUrl(nextSection));
    setSection(nextSection);
  }, [section]);

  if (section === "Crypto") return <ZavierApp onNavigate={navigate} />;
  if (section === "Forex") return <OngXuanApp onNavigate={navigate} />;
  return <VictorApp onNavigate={navigate} />;
}
