import { useEffect, useState } from "react";
import { InteractionManager } from "react-native";

// Returns false on the first render(s) of a screen, then flips to true once the
// current interaction (e.g. the tab/stack transition animation) has finished.
//
// Screens use this to defer their heavy, uncached compute: the navigation
// animation runs unblocked, a spinner shows, and the expensive work kicks in
// right after. Cached results should still render immediately (cache hit), so
// only gate the work behind this when there's nothing cached to show.
export function useInteractionReady(): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const handle = InteractionManager.runAfterInteractions(() => setReady(true));
    return () => handle.cancel();
  }, []);
  return ready;
}
