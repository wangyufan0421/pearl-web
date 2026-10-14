import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { CommunityReadError } from "./data/communityDiscussion";
import { useCommunityResource } from "./useCommunityResource";
afterEach(cleanup);
it("removes a previously public snapshot after hiding or deletion returns 404", async () => {
  const loader = vi.fn().mockResolvedValueOnce("archived source text").mockRejectedValueOnce(new CommunityReadError("missing"));
  function Page() { const state = useCommunityResource<string>(loader); return <div>{state.data ?? "empty"}</div>; }
  render(<Page />); await screen.findByText("archived source text");
  await act(async () => { window.dispatchEvent(new Event("focus")); });
  await waitFor(() => expect(screen.queryByText("archived source text")).toBeNull());
});
